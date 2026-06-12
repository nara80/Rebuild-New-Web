// Thai blog pages — /th/blogs/{slug}/
import { buildBlogListingHTML, buildBlogPostHTML } from "../../blog-shared";

export async function onRequest(context): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // /th/blogs/ → Thai SSR listing page
  if (path === "/th/blogs/" || path === "/th/blogs") {
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    return buildBlogListingHTML(env, page, "th");
  }

  // /th/blogs/{slug}/ → Thai SSR blog post
  const segments = path.replace(/^\/th\/blogs\/?/, "").split("/").filter(Boolean);
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

    const html = await buildBlogPostHTML(post, env, "th");
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Robots-Tag": "index, follow"
      }
    });
  } catch (err) {
    console.error("Blog post TH error:", err);
    return new Response("Server error", { status: 500 });
  }
}
