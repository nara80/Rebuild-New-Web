import { verifyClerkJwt } from "./clerk-verify";

let favoritesSchemaReady = false;
let favoritesSchemaPromise: Promise<void> | null = null;

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function ensureFavoritesSchema(env: any): Promise<void> {
  if (favoritesSchemaReady) return;
  if (!favoritesSchemaPromise) {
    favoritesSchemaPromise = (async () => {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          email TEXT NOT NULL,
          product_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, product_id),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )`
      ).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON favorites(user_id, created_at DESC)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_favorites_product ON favorites(product_id)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_favorites_email ON favorites(email)`).run();
      favoritesSchemaReady = true;
    })().finally(() => {
      if (!favoritesSchemaReady) favoritesSchemaPromise = null;
    });
  }
  await favoritesSchemaPromise;
}

function isProductionHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}

function collectRoles(raw: any): string[] {
  if (!raw || typeof raw !== "object") return [];
  const values: any[] = [];
  const add = (v: any) => { if (v !== undefined && v !== null) values.push(v); };

  add((raw as any).role);
  add((raw as any).roles);
  add((raw as any).org_role);
  add((raw as any).orgRole);
  add((raw as any).public_metadata?.role);
  add((raw as any).public_metadata?.roles);
  add((raw as any).unsafe_metadata?.role);
  add((raw as any).unsafe_metadata?.roles);
  add((raw as any).metadata?.role);
  add((raw as any).metadata?.roles);
  add((raw as any)["https://mildmate.com/role"]);
  add((raw as any)["https://mildmate.com/roles"]);

  const out: string[] = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}

function hasAdminRole(rawClaims: any): boolean {
  const roles = collectRoles(rawClaims);
  return roles.some((r) =>
    r === "admin" ||
    r === "super-admin" ||
    r === "super_admin" ||
    r === "superadmin" ||
    r.endsWith(":admin") ||
    r.endsWith("/admin")
  );
}

function emailAllowed(email: string, env: any): boolean {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

async function authorizeAdmin(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");

  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole(raw) || emailAllowed(verified.payload.email || "", env)) {
        return { ok: true };
      }

      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey },
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find((e: any) => e.id === user.primary_email_address_id)?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed(email, env)) return { ok: true };
            if (hasAdminRole(metadata)) return { ok: true };
          }
        } catch (e: any) {
          console.error("Clerk API lookup failed:", e?.message || e);
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
  }

  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) return { ok: false, status: 401, error: "Unauthorized" };

  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }

  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

async function getUserContext(request: Request, env: any): Promise<{ ok: true; userId: string; email: string } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Authentication required" };
  }

  const verified = await verifyClerkJwt(request, env);
  if (!verified.valid) {
    return { ok: false, status: verified.status, error: verified.error };
  }

  const userId = String(verified.payload.sub || "").trim();
  const email = String(verified.payload.email || request.headers.get("X-User-Email") || "").trim().toLowerCase();
  if (!userId) return { ok: false, status: 401, error: "Invalid user session" };
  if (!email) return { ok: false, status: 401, error: "No email in session" };
  return { ok: true, userId, email };
}

export async function handleFavorites(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Email, X-Admin-Secret",
      },
    });
  }

  // GET /api/admin/favorites/stats
  if (method === "GET" && path === "/api/admin/favorites/stats") {
    try {
      await ensureFavoritesSchema(env);
    } catch (e: any) {
      console.error("favorites schema init failed (admin stats):", e?.message || e);
      return json({ error: "Favorites storage unavailable" }, 500);
    }

    const auth = await authorizeAdmin(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "5", 10) || 5, 1), 20);

    const totals = await env.DB.prepare(
      `SELECT 
         COUNT(*) AS total_favorites,
         COUNT(DISTINCT user_id) AS total_users,
         COUNT(DISTINCT product_id) AS total_products
       FROM favorites`
    ).first();

    const topProducts = await env.DB.prepare(
      `SELECT 
         p.id,
         p.slug,
         p.title_en,
         p.image_url,
         COUNT(f.id) AS favorite_count,
         COUNT(DISTINCT f.user_id) AS unique_users
       FROM favorites f
       JOIN products p ON p.id = f.product_id
       GROUP BY f.product_id
       ORDER BY favorite_count DESC, MAX(f.created_at) DESC
       LIMIT ?1`
    ).bind(limit).all();

    const topUsers = await env.DB.prepare(
      `SELECT 
         email,
         COUNT(*) AS favorite_count,
         MIN(created_at) AS first_favorited_at,
         MAX(created_at) AS last_favorited_at
       FROM favorites
       GROUP BY user_id, email
       ORDER BY favorite_count DESC, last_favorited_at DESC
       LIMIT ?1`
    ).bind(limit).all();

    return json({
      totals: totals || { total_favorites: 0, total_users: 0, total_products: 0 },
      topProducts: topProducts.results || [],
      topUsers: topUsers.results || [],
    });
  }

  if (path !== "/api/favorites") {
    return json({ error: "Not found" }, 404);
  }

  const user = await getUserContext(request, env);
  if (!user.ok) return json({ error: user.error }, user.status);

  try {
    await ensureFavoritesSchema(env);
  } catch (e: any) {
    console.error("favorites schema init failed:", e?.message || e);
    return json({ error: "Favorites storage unavailable" }, 500);
  }

  // GET /api/favorites
  if (method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT 
         MIN(f.id) AS id,
         p.id AS product_id,
         MAX(f.created_at) AS created_at,
         p.slug,
         p.title_en,
         p.image_url,
         p.base_price_usd AS price_usd,
         p.base_price_thb AS price_thb,
         p.category,
         p.product_type,
         p.niches
       FROM favorites f
       JOIN products p ON p.id = f.product_id
       WHERE f.user_id = ?1 OR LOWER(f.email) = ?2
       GROUP BY p.id, p.slug, p.title_en, p.image_url, p.base_price_usd, p.base_price_thb, p.category, p.product_type, p.niches
       ORDER BY MAX(f.created_at) DESC
       LIMIT 100`
    ).bind(user.userId, user.email).all();

    return json({ favorites: rows.results || [] });
  }

  // POST /api/favorites
  if (method === "POST") {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const productSlug = String(body.productSlug || body.slug || "").trim();
    if (!productSlug) return json({ error: "productSlug is required" }, 400);

    const product = await env.DB.prepare(
      `SELECT id, slug, title_en, image_url, base_price_usd AS price_usd, base_price_thb AS price_thb
       FROM products
       WHERE slug = ?1
       LIMIT 1`
    ).bind(productSlug).first();

    if (!product) return json({ error: "Product not found" }, 404);

    const existing = await env.DB.prepare(
      `SELECT id FROM favorites
       WHERE product_id = ?1 AND (user_id = ?2 OR LOWER(email) = ?3)
       LIMIT 1`
    ).bind(product.id, user.userId, user.email).first();

    if (existing) {
      return json({
        success: true,
        isFavorite: true,
        created: false,
        product,
      });
    }

    const result = await env.DB.prepare(
      `INSERT OR IGNORE INTO favorites (user_id, email, product_id, created_at)
       VALUES (?1, ?2, ?3, datetime('now'))`
    ).bind(user.userId, user.email, product.id).run();

    return json({
      success: true,
      isFavorite: true,
      created: Number(result.meta?.changes || 0) > 0,
      product,
    });
  }

  // DELETE /api/favorites?productSlug=...
  if (method === "DELETE") {
    let productSlug = String(url.searchParams.get("productSlug") || "").trim();
    if (!productSlug) {
      try {
        const body: any = await request.json();
        productSlug = String(body.productSlug || body.slug || "").trim();
      } catch {}
    }
    if (!productSlug) return json({ error: "productSlug is required" }, 400);

    const product = await env.DB.prepare(
      `SELECT id FROM products WHERE slug = ?1 LIMIT 1`
    ).bind(productSlug).first();
    if (!product) return json({ success: true, isFavorite: false, removed: false });

    const result = await env.DB.prepare(
      `DELETE FROM favorites
       WHERE product_id = ?1
         AND (user_id = ?2 OR LOWER(email) = ?3)`
    ).bind(product.id, user.userId, user.email).run();

    return json({
      success: true,
      isFavorite: false,
      removed: Number(result.meta?.changes || 0) > 0,
    });
  }

  return json({ error: "Method not allowed" }, 405);
}
