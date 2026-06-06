// MildMate Blog Posts API
// GET /api/blog/posts           — public listing (published posts)
// GET /api/blog/posts?slug=x   — single post by slug

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

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  try {
    if (slug) {
      // Single post by slug
      const post = await env.DB.prepare(
        "SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'"
      ).bind(slug).first() as any;

      if (!post) {
        return new Response(JSON.stringify({ error: "Post not found" }), { status: 404, headers });
      }

      // Related products
      let relatedProducts = [];
      try { relatedProducts = JSON.parse(post.related_products_json || "[]"); } catch {}

      return new Response(JSON.stringify({ post: { ...post, related_products: relatedProducts } }), { headers });
    }

    // Listing — all published posts, newest first
    const { results } = await env.DB.prepare(
      "SELECT id, slug, title_en, title_th, meta_description_en, meta_description_th, featured_image, featured_image_alt_en, category, author, read_time_en, read_time_th, status, is_featured, th_redirect_path, created_at FROM blog_posts WHERE status = 'published' ORDER BY updated_at DESC"
    ).all();

    return new Response(JSON.stringify({ posts: results || [] }), { headers });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Failed to load posts: " + e.message }), { status: 500, headers });
  }
}
