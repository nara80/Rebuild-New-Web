// MildMate Blog Posts API
// GET /api/blog/posts           — public listing (published posts, for blog index page)
const R2_PUBLIC_BASE = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";
function toPublicR2Url(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  return url.startsWith("/r2/") ? `${R2_PUBLIC_BASE}${url.slice(3)}` : url;
}

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
    const posts = results.map((p: any) => ({ ...p, featured_image: toPublicR2Url(p.featured_image) }));
    return new Response(JSON.stringify({ posts }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Failed: " + e.message }), { status: 500, headers });
  }
}
