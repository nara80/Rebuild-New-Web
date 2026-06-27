// Blog post pages — /blogs/{slug}/
import { buildBlogListingHTML, buildBlogPostHTML } from "../blog-shared";

export async function onRequest(context): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // /blogs/ → SSR listing page
  if (path === "/blogs/" || path === "/blogs") {
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const category = (url.searchParams.get("category") || "All").trim();
    return buildBlogListingHTML(env, page, "en", category);
  }

  // Let static assets under /blogs/* pass through
  const segments = path.replace(/^\/blogs\/?/, "").split("/").filter(Boolean);
  if (segments.length !== 1 || segments[0].includes(".")) {
    return next();
  }
  const slug = decodeURIComponent(segments[0]);

  try {
    const stmt = env.DB.prepare(
      "SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'"
    ).bind(slug);
    const post = await stmt.first();

    if (!post) {
      return new Response("Blog post not found", {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    const html = await buildBlogPostHTML(post, env, "en");
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Robots-Tag": "index, follow"
      }
    });
  } catch (err) {
    console.error("Blog post error:", err);
    return new Response("Server error", { status: 500 });
  }
}
