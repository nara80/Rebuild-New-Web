// MildMate Blog Posts API
// GET /api/blog/posts           — public listing (published posts, for blog index page)
export async function handleBlogPosts(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { ...headers, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    let results: any[] = [];
    try {
      const rows = await env.DB.prepare(
        "SELECT id, slug, title_en, title_th, meta_description_en, featured_image, category, categories_json, author, read_time_en, status, created_at, youtube_url FROM blog_posts WHERE status = 'published' ORDER BY updated_at DESC"
      ).all();
      results = rows.results || [];
    } catch (e: any) {
      if (!String(e.message || "").includes("categories_json")) throw e;
      const rows = await env.DB.prepare(
        "SELECT id, slug, title_en, title_th, meta_description_en, featured_image, category, author, read_time_en, status, created_at, youtube_url FROM blog_posts WHERE status = 'published' ORDER BY updated_at DESC"
      ).all();
      results = (rows.results || []).map((p: any) => ({ ...p, categories_json: p.category ? JSON.stringify([p.category]) : "[]" }));
    }
    return new Response(JSON.stringify({ posts: results }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Failed: " + e.message }), { status: 500, headers });
  }
}
