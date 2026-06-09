// MildMate Admin Blog Posts API
// GET    /api/admin/blog          — list all posts
// POST   /api/admin/blog          — create post
// GET    /api/admin/blog?id=x     — get single post
// PUT    /api/admin/blog          — update post
// DELETE /api/admin/blog          — delete post

const BLOG_CATEGORY_OPTIONS = [
  "Marine & Yacht",
  "Family & Co-Sleep",
  "Pet Owners",
  "Deep Pocket",
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

function authorizeAdminSecret(request: Request, env: any): boolean {
  const provided = (request.headers.get("X-Admin-Secret") || "").trim();
  const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  const hostname = request.headers.get("Host") || "";
  const prodHost = isProductionHost(hostname);
  if (!provided) return false;
  if (!configured) return !prodHost;
  return provided === configured;
}

function normalizeCategories(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw.map((x) => String(x || "").trim()).filter(Boolean);
  return cleaned.filter((x) => BLOG_CATEGORY_OPTIONS.includes(x));
}

export async function handleAdminBlog(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  if (!authorizeAdminSecret(request, env)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
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
      return new Response(JSON.stringify({ post: { ...post, related_products: relatedProducts, categories_json: categories } }), { headers });
    }
    const { results } = await db.prepare(
      "SELECT id, slug, title_en, title_th, featured_image, category, categories_json, status, is_featured, author, created_at, updated_at FROM blog_posts ORDER BY updated_at DESC"
    ).all();
    return new Response(JSON.stringify({ posts: results || [] }), { headers });
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        slugNorm, title_en, title_th, meta_description_en, meta_description_th,
        body_en, body_th, featured_image, featured_image_alt_en, featured_image_alt_th,
        categoryPrimary, categoriesJson, author, read_time_en, read_time_th, status, is_featured ? 1 : 0, th_redirect_path, relatedJson, youtube_url || ""
      ).run();
    } catch (e: any) {
      if (!String(e.message || "").includes("categories_json")) throw e;
      result = await db.prepare(`
        INSERT INTO blog_posts (slug, title_en, title_th, meta_description_en, meta_description_th, body_en, body_th, featured_image, featured_image_alt_en, featured_image_alt_th, category, author, read_time_en, read_time_th, status, is_featured, th_redirect_path, related_products_json, youtube_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
