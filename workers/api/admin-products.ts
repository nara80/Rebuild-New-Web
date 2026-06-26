// MildMate Admin API â€” Product editing
// GET  /api/admin/products          â€” list all products
// POST /api/admin/products          â€” create new product
// GET  /api/admin/products/:slug    â€” get single product
// PUT  /api/admin/products/:slug    â€” update product fields
import { verifyClerkJwt } from "./clerk-verify";

const R2_PUBLIC_BASE = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";

function toR2Url(url: string | null | undefined): string {
  if (!url) return url as string;
  if (url.startsWith("/r2/")) return `${R2_PUBLIC_BASE}${url.slice(3)}`;
  return url;
}

function r2Product(p: any): any {
  const out = { ...p, image_url: toR2Url(p.image_url) };
  if (out.images && typeof out.images === "string") {
    try {
      const arr: string[] = JSON.parse(out.images);
      out.images = JSON.stringify(arr.map(toR2Url));
    } catch (_) { /* ignore */ }
  }
  return out;
}

interface ProductRow {
  id: number;
  slug: string;
  title_en: string;
  title_th: string | null;
  description_en: string | null;
  description_th: string | null;
  faq_en: string | null;
  faq_th: string | null;
  card_benefit_en: string | null;
  card_benefit_th: string | null;
  category: string;
  product_type: string | null;
  niches: string | null;
  subcategory: string | null;
  fabric_options: string | null;
  base_price_usd: number | null;
  base_price_thb: number | null;
  is_custom: number;
  image_url: string | null;
  tags: string | null;
  youtube_url: string | null;
  images: string | null;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// Helper: parse category CSV to extract product_type + niches
function parseCategoryCsv(csv: string): { product_type: string; niches: string } {
  const parts = csv.split(',').map(s => s.trim()).filter(Boolean);
  const product_type = parts[0] || 'sheets';
  const niches = parts.slice(1).join(', ');
  return { product_type, niches };
}

function isProductionHost(hostname: string): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().split(":")[0];
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (host.endsWith(".pages.dev")) return false;
  if (host.endsWith(".local")) return false;
  return host === "www.mildmate.com" || host === "mildmate.com";
}
const ADMIN_SECRET_ERROR = JSON.stringify({ error: "Unauthorized" });

function collectRoles(raw: any): string[] {
  if (!raw || typeof raw !== "object") return [];
  const values: any[] = [];
  values.push(raw.role, raw.roles, raw.org_role, raw.org_roles, raw.permission, raw.permissions);
  if (raw.public_metadata && typeof raw.public_metadata === "object") {
    values.push(
      raw.public_metadata.role,
      raw.public_metadata.roles,
      raw.public_metadata.org_role,
      raw.public_metadata.org_roles,
      raw.public_metadata.permission,
      raw.public_metadata.permissions
    );
  }
  if (raw.metadata && typeof raw.metadata === "object") {
    values.push(raw.metadata.role, raw.metadata.roles, raw.metadata.permission, raw.metadata.permissions);
  }
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

async function authCheck(request: Request, env: any): Promise<boolean> {
  const hostname = request.headers.get("Host") || "";
  const prodHost = isProductionHost(hostname);
  if (!prodHost) return true;

  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const verified = await verifyClerkJwt(request, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole(raw) || emailAllowed(verified.payload.email || "", env)) return true;

      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find((e: any) => e.id === user.primary_email_address_id)?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed(email, env) || hasAdminRole(metadata)) return true;
          }
        } catch {}
      }
    }
  }

  const provided = (request.headers.get("X-Admin-Secret") || "").trim();
  const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!provided) return false;
  if (!configured) return false;
  return provided === configured;
}

export async function handleAdminProducts(request: Request, env: any): Promise<Response> {
  if (!(await authCheck(request, env))) {
    return new Response(ADMIN_SECRET_ERROR, {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, ""); // strip trailing slash
  const method = request.method;

  // GET /api/admin/products â€” list all
  if (method === "GET" && path === "/api/admin/products") {
    const db = env.DB as D1Database;
    const result = await db.prepare(
      `SELECT id, slug, title_en, title_th, description_en, description_th, faq_en, faq_th, card_benefit_en, card_benefit_th,
              category, product_type, niches, subcategory, fabric_options, base_price_usd, base_price_thb,
              is_custom, image_url, tags, youtube_url, images, sort_order, is_active
       FROM products ORDER BY sort_order, id`
    ).all();

    return new Response(JSON.stringify((result.results || []).map(r2Product)), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST /api/admin/products â€” create new product
  if (method === "POST" && path === "/api/admin/products") {
    const db = env.DB as D1Database;
    try {
      const body: any = await request.json();
      const slug = body.slug;
      if (!slug) {
        return new Response(JSON.stringify({ error: "Slug is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      // Check slug uniqueness
      const dup = await db.prepare("SELECT id FROM products WHERE slug = ?").bind(slug).first();
      if (dup) {
        return new Response(JSON.stringify({ error: "Slug already exists" }), { status: 409, headers: { "Content-Type": "application/json" } });
      }
      // Parse product_type + niches from category CSV
      const { product_type, niches } = parseCategoryCsv(body.category || "sheets");

      const placeholderImage = "/images/products/mattress-protector-standard/main.jpg";

      await db.prepare(
        `INSERT INTO products (slug, title_en, title_th, description_en, description_th, faq_en, faq_th, card_benefit_en, card_benefit_th, category, product_type, niches, fabric_options, image_url, youtube_url, images, tags, is_custom, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 99)`
      ).bind(
        slug,
        body.title_en || body.titleEN || slug,
        body.title_th || body.titleTH || null,
        body.description_en || body.descEN || null,
        body.description_th || body.descTH || null,
        body.faq_en || body.faqEN || null,
        body.faq_th || body.faqTH || null,
        body.card_benefit_en || body.cardBenefitEN || "",
        body.card_benefit_th || body.cardBenefitTH || "",
        body.category || "sheets",
        body.product_type || product_type,
        body.niches || niches,
        body.fabric_options || null,
        body.image_url || placeholderImage,
        body.youtube_url || body.video || null,
        body.images || "[]",
        body.tags || null
      ).run();
      return new Response(JSON.stringify({ success: true, slug }), { headers: { "Content-Type": "application/json" } });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
  }

  // GET /api/admin/products/:slug
  const slugMatch = path.match(/^\/api\/admin\/products\/(.+)$/);
  if (slugMatch && method === "GET") {
    const slug = slugMatch[1];
    const db = env.DB as D1Database;
    const result = await db.prepare(
      `SELECT * FROM products WHERE slug = ?`
    ).bind(slug).first();

    if (!result) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(r2Product(result)), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // PUT /api/admin/products/:slug â€” update product
  if (slugMatch && method === "PUT") {
    const slug = slugMatch[1];
    const db = env.DB as D1Database;

    // Verify product exists
    const existing = await db.prepare(
      `SELECT id FROM products WHERE slug = ?`
    ).bind(slug).first();
    if (!existing) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body: any = await request.json();

      // Build update query dynamically from allowed fields
      const allowed = [
        "title_en", "title_th", "description_en", "description_th",
        "faq_en", "faq_th",
        "card_benefit_en", "card_benefit_th",
        "tags", "youtube_url", "images", "image_url", "fabric_options", "category",
        "product_type", "niches"
      ];

      const sets: string[] = [];
      const values: any[] = [];

      for (const field of allowed) {
        if (body[field] !== undefined) {
          sets.push(`${field} = ?`);
          values.push(body[field]);
        }
      }

      // If category is being updated, also sync product_type + niches
      if (body.category !== undefined && body.product_type === undefined && body.niches === undefined) {
        const parsed = parseCategoryCsv(body.category);
        sets.push("product_type = ?");
        values.push(parsed.product_type);
        sets.push("niches = ?");
        values.push(parsed.niches);
      }

      if (sets.length === 0) {
        return new Response(JSON.stringify({ error: "No valid fields to update" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      sets.push("updated_at = datetime('now')");
      values.push(slug);

      await db.prepare(
        `UPDATE products SET ${sets.join(", ")} WHERE slug = ?`
      ).bind(...values).run();

      return new Response(JSON.stringify({
        success: true,
        slug,
        message: "Product updated"
      }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
