// MildMate Admin Blog Posts API
// GET    /api/admin/blog          — list all posts
// POST   /api/admin/blog          — create post
// GET    /api/admin/blog?id=x     — get single post
// PUT    /api/admin/blog          — update post
// DELETE /api/admin/blog          — delete post

import { verifyClerkJwt } from "./clerk-verify";

const R2_PUBLIC_BASE = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";

const BLOG_CATEGORY_OPTIONS = [
  "Marine & Yacht",
  "Family & Co-Sleep",
  "Pet Owner",
  "Deep Pocket",
  "Boarding Dorm",
  "RV & Truck Cab",
  "Bedding Guide",
  "Product News",
  "Other"
];

function isProductionHost(hostname: string): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().split(":")[0];
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (host.endsWith(".pages.dev")) return false;
  if (host.endsWith(".local")) return false;
  return host === "www.mildmate.com" || host === "mildmate.com";
}

function collectRoles(raw: any): string[] {
  if (!raw || typeof raw !== "object") return [];
  const values: any[] = [];
  const add = (v: any) => { if (v !== undefined && v !== null) values.push(v); };
  add(raw.role);
  add(raw.roles);
  add(raw.org_role);
  add(raw.orgRole);
  add(raw.public_metadata?.role);
  add(raw.public_metadata?.roles);
  add(raw.unsafe_metadata?.roles);
  add(raw.metadata?.role);
  add(raw.metadata?.roles);
  add(raw["https://mildmate.com/role"]);
  add(raw["https://mildmate.com/roles"]);
  const out: string[] = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}

function hasAdminRole(raw: any): boolean {
  const roles = collectRoles(raw);
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

function getClerkSessionTokenFromCookie(request: Request): string {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match =
    cookieHeader.match(/__session=([^;]+)/) ||
    cookieHeader.match(/__clerk_db_jwt=([^;]+)/);
  return match ? String(match[1] || "").trim() : "";
}

async function authorizeAdmin(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("Authorization") || "";
  const cookieToken = getClerkSessionTokenFromCookie(request);
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const token = bearerToken || cookieToken;

  if (token) {
    const verifyRequest = bearerToken
      ? request
      : new Request(request.url, {
          method: request.method,
          headers: new Headers({
            ...Object.fromEntries(request.headers.entries()),
            Authorization: "Bearer " + token,
          }),
        });
    const verified = await verifyClerkJwt(verifyRequest, env);
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

  const provided = (request.headers.get("X-Admin-Secret") || "").trim();
  const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!provided) return { ok: false, status: 401, error: "Unauthorized" };

  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }

  if (!configured) return { ok: true };
  if (provided === configured) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

function normalizeCategories(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw.map((x) => String(x || "").trim()).filter(Boolean);
  return cleaned.filter((x) => BLOG_CATEGORY_OPTIONS.includes(x));
}

function toR2Url(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/r2/")) return `${R2_PUBLIC_BASE}${url.slice(3)}`;
  return url;
}

export async function handleAdminBlog(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret, Authorization",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers });
  }

  const db = env.DB;
  const url = new URL(request.url);

  // GET — list all or single
  if (request.method === "GET") {
    const id = url.searchParams.get("id");
    if (id) {
      const post = await db.prepare("SELECT * FROM blog_posts WHERE id = ?").bind(Number(id)).first() as any;
      if (!post) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
      let relatedProducts = [];
      try { relatedProducts = JSON.parse(post.related_products_json || "[]"); } catch {}
      let categories = [];
      try { categories = JSON.parse(post.categories_json || "[]"); } catch {}
      return new Response(JSON.stringify({
        post: {
          ...post,
          featured_image: toR2Url(post.featured_image || ""),
          related_products: relatedProducts,
          categories_json: categories
        }
      }), { headers });
    }
    const { results } = await db.prepare(
      "SELECT id, slug, title_en, title_th, featured_image, category, categories_json, status, is_featured, author, created_at, updated_at FROM blog_posts ORDER BY updated_at DESC"
    ).all();
    const normalized = (results || []).map((p: any) => ({
      ...p,
      featured_image: toR2Url(p.featured_image || "")
    }));
    return new Response(JSON.stringify({ posts: normalized }), { headers });
  }

  // POST — create
  if (request.method === "POST") {
    let body: any;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }

    const {
      slug, title_en, title_th = "", meta_description_en = "", meta_description_th = "",
      body_en = "", body_th = "", featured_image = "", featured_image_alt_en = "",
      featured_image_alt_th = "", category = "General", author = "MildMate Team",
      read_time_en = "5 min read", read_time_th = "5 นาที อ่าน",
      status = "draft", is_featured = 0, th_redirect_path = "",
      related_products = [], youtube_url = "", categories_json = []
    } = body;

    if (!slug || !title_en) {
      return new Response(JSON.stringify({ error: "slug and title_en are required" }), { status: 400, headers });
    }

    const slugNorm = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    if (slugNorm.length < 2) {
      return new Response(JSON.stringify({ error: "Invalid slug" }), { status: 400, headers });
    }

    const existing = await db.prepare("SELECT id FROM blog_posts WHERE slug = ?").bind(slugNorm).first();
    if (existing) {
      return new Response(JSON.stringify({ error: "Slug already exists" }), { status: 409, headers });
    }

    const relatedJson = JSON.stringify(Array.isArray(related_products) ? related_products : []);
    const categories = normalizeCategories(categories_json);
    const categoryPrimary = categories[0] || category || "General";
    const categoriesJson = JSON.stringify(categories);

    let result: any;
    try {
      result = await db.prepare(`
        INSERT INTO blog_posts (slug, title_en, title_th, meta_description_en, meta_description_th, body_en, body_th, featured_image, featured_image_alt_en, featured_image_alt_th, category, categories_json, author, read_time_en, read_time_th, status, is_featured, th_redirect_path, related_products_json, youtube_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        slugNorm, title_en, title_th, meta_description_en, meta_description_th,
        body_en, body_th, featured_image, featured_image_alt_en, featured_image_alt_th,
        categoryPrimary, categoriesJson, author, read_time_en, read_time_th, status, is_featured ? 1 : 0, th_redirect_path, relatedJson, youtube_url || ""
      ).run();
    } catch (e: any) {
      if (!String(e.message || "").includes("categories_json")) throw e;
      result = await db.prepare(`
        INSERT INTO blog_posts (slug, title_en, title_th, meta_description_en, meta_description_th, body_en, body_th, featured_image, featured_image_alt_en, featured_image_alt_th, category, author, read_time_en, read_time_th, status, is_featured, th_redirect_path, related_products_json, youtube_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        slugNorm, title_en, title_th, meta_description_en, meta_description_th,
        body_en, body_th, featured_image, featured_image_alt_en, featured_image_alt_th,
        categoryPrimary, author, read_time_en, read_time_th, status, is_featured ? 1 : 0, th_redirect_path, relatedJson, youtube_url || ""
      ).run();
    }

    return new Response(JSON.stringify({ success: true, id: result.meta?.last_row_id, slug: slugNorm }), { headers });
  }

  // PUT — update
  if (request.method === "PUT") {
    let body: any;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }

    const {
      id, slug, title_en, title_th = "", meta_description_en = "", meta_description_th = "",
      body_en = "", body_th = "", featured_image = "", featured_image_alt_en = "",
      featured_image_alt_th = "", category = "General", author = "MildMate Team",
      read_time_en = "5 min read", read_time_th = "5 นาที อ่าน",
      status = "draft", is_featured = 0, th_redirect_path = "",
      related_products = [], youtube_url = "", categories_json = []
    } = body;

    if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers });

    const slugNorm = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") : null;

    const existing = await db.prepare("SELECT id FROM blog_posts WHERE id = ?").bind(Number(id)).first() as any;
    if (!existing) return new Response(JSON.stringify({ error: "Post not found" }), { status: 404, headers });

    // Check slug uniqueness if changed
    if (slugNorm) {
      const dup = await db.prepare("SELECT id FROM blog_posts WHERE slug = ? AND id != ?").bind(slugNorm, Number(id)).first();
      if (dup) return new Response(JSON.stringify({ error: "Slug already in use" }), { status: 409, headers });
    }

    const relatedJson = JSON.stringify(Array.isArray(related_products) ? related_products : []);
    const categories = normalizeCategories(categories_json);
    const categoryPrimary = categories[0] || category || "General";
    const categoriesJson = JSON.stringify(categories);

    const updates: string[] = [];
    const vals: any[] = [];
    const add = (k: string, v: any) => { updates.push(k + " = ?"); vals.push(v); };
    if (slugNorm) { add("slug", slugNorm); }
    add("title_en", title_en);
    add("title_th", title_th);
    add("meta_description_en", meta_description_en);
    add("meta_description_th", meta_description_th);
    add("body_en", body_en);
    add("body_th", body_th);
    add("featured_image", featured_image);
    add("featured_image_alt_en", featured_image_alt_en);
    add("featured_image_alt_th", featured_image_alt_th);
    add("category", categoryPrimary);
    add("author", author);
    add("read_time_en", read_time_en);
    add("read_time_th", read_time_th);
    add("status", status);
    add("is_featured", is_featured ? 1 : 0);
    add("th_redirect_path", th_redirect_path);
    add("related_products_json", relatedJson);
    add("youtube_url", youtube_url || "");
    add("categories_json", categoriesJson);
    updates.push("updated_at = datetime('now')");
    vals.push(Number(id));

    try {
      await db.prepare(`UPDATE blog_posts SET ${updates.join(", ")} WHERE id = ?`).bind(...vals).run();
    } catch (e: any) {
      if (!String(e.message || "").includes("categories_json")) throw e;
      const legacyUpdates = updates.filter((u) => !u.startsWith("categories_json"));
      const legacyVals = vals.slice(0, vals.length - 2).concat(vals[vals.length - 1]);
      await db.prepare(`UPDATE blog_posts SET ${legacyUpdates.join(", ")} WHERE id = ?`).bind(...legacyVals).run();
    }

    return new Response(JSON.stringify({ success: true }), { headers });
  }

  // DELETE
  if (request.method === "DELETE") {
    let body: any;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }
    const { id } = body;
    if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers });

    await db.prepare("DELETE FROM blog_posts WHERE id = ?").bind(Number(id)).run();
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
