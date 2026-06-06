// Blog post pages — /blogs/{slug}/
// Reads from D1 blog_posts table

export async function onRequest(context): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname; // e.g. /blogs/my-post/

  if (path === "/blogs/" || path === "/blogs") {
    return Response.redirect(new URL("/blogs", url.origin), 301);
  }

  // Extract slug from /blogs/{slug}/
  const match = path.match(/^\/blogs\/([^/]+)\/?$/);
  if (!match) {
    return new Response("Not Found", { status: 404 });
  }
  const slug = match[1];

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

    const html = buildBlogPostHTML(post);
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

function buildBlogPostHTML(post) {
  const title = escHtml(post.title_en || "MildMate Blog");
  const metaDesc = escHtml(post.meta_description_en || post.title_en || "");
  const category = escHtml(post.category || "General");
  const author = escHtml(post.author || "MildMate Team");
  const readTime = escHtml(post.read_time_en || "5 min read");
  const featuredImage = post.featured_image ? escHtml(post.featured_image) : "";
  const body = post.body_en || "<p>This article is coming soon.</p>";
  const createdAt = formatDate(post.created_at);
  const imageAlt = escHtml(post.featured_image_alt_en || title);

  const hasImage = featuredImage ? 'true' : 'false';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${metaDesc}">
  <title>${title} - MildMate Blog</title>
  <link rel="canonical" href="/blogs/${escHtml(post.slug)}/">
  <link href="/css/fonts.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/main.min.css">
  <style>
    body{background:#f0f7ff}
    .blog-post-page{min-height:100vh}
    .blog-hero{position:relative;height:480px;overflow:hidden;background:#1e293b}
    .blog-hero img{width:100%;height:100%;object-fit:cover;display:block}
    .blog-hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0.55) 100%)}
    .blog-hero-caption{position:absolute;bottom:0;left:0;right:0;padding:48px 24px 40px;max-width:1200px;margin:0 auto}
    .blog-category{display:inline-block;background:#2c96f4;color:#fff;font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;padding:4px 12px;border-radius:20px;margin-bottom:16px}
    .blog-hero-title{color:#fff;font-size:2.25rem;font-weight:700;line-height:1.2;max-width:800px;text-shadow:0 2px 8px rgba(0,0,0,0.3)}
    .blog-hero-meta{color:rgba(255,255,255,0.85);font-size:0.875rem;margin-top:16px;display:flex;gap:16px;align-items:center}
    .blog-hero-meta span{display:flex;align-items:center;gap:6px}
    .blog-container{max-width:760px;margin:0 auto;padding:48px 24px 80px}
    .blog-body{background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
    .blog-body h2{font-size:1.5rem;font-weight:700;margin:32px 0 16px;color:#0f172a}
    .blog-body h3{font-size:1.25rem;font-weight:600;margin:24px 0 12px;color:#0f172a}
    .blog-body p{color:#334155;line-height:1.75;margin-bottom:16px;font-size:1.0625rem}
    .blog-body ul,.blog-body ol{padding-left:24px;margin-bottom:16px}
    .blog-body li{color:#334155;line-height:1.7;margin-bottom:8px;font-size:1.0625rem}
    .blog-body blockquote{border-left:4px solid #2c96f4;padding:16px 20px;margin:24px 0;background:#f8fafc;border-radius:0 8px 8px 0;font-style:italic;color:#475569}
    .blog-body img{max-width:100%;height:auto;border-radius:8px;margin:24px 0}
    .blog-body a{color:#2c96f4;text-decoration:underline}
    .blog-body strong{color:#0f172a;font-weight:700}
    .blog-share{background:#fff;border-radius:12px;padding:24px;margin-top:24px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
    .blog-share p{font-weight:600;color:#0f172a;margin-bottom:12px}
    .share-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
    .share-btn{padding:10px 24px;border-radius:8px;font-weight:600;font-size:0.875rem;text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:all 0.2s}
    .share-btn.twitter{background:#1da1f2;color:#fff}
    .share-btn.facebook{background:#1877f2;color:#fff}
    .share-btn.linkedin{background:#0a66c2;color:#fff}
    .blog-back{margin-bottom:32px}
    .blog-back a{display:inline-flex;align-items:center;gap:8px;color:#2c96f4;font-weight:600;text-decoration:none;font-size:0.9375rem}
    .blog-back a:hover{color:#1a7fd4}
    .no-image-hero{height:280px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#2c96f4,#1a7fd4)}
    .no-image-hero .blog-hero-title{color:#fff;font-size:2rem;text-shadow:none}
    @media(max-width:768px){
      .blog-hero{height:320px}
      .blog-hero-title{font-size:1.5rem}
      .blog-body{padding:24px}
      .blog-container{padding:24px 16px 60px}
    }
  </style>
</head>
<body class="blog-post-page">
  <header class="site-header">
    <div class="header-inner container">
      <a href="/" class="logo-link"><img src="/images/logo.png" alt="MildMate" height="52" onerror="this.style.display='none'"></a>
      <nav class="header-nav" id="main-nav"></nav>
      <div class="header-actions">
        <button id="search-toggle" aria-label="Search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
        <a href="/checkout/" aria-label="Cart" class="cart-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <span id="cart-count" style="display:none">0</span>
        </a>
        <button id="mobile-menu-btn" aria-label="Menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
      </div>
    </div>
  </header>

  ${featuredImage ? `
  <div class="blog-hero">
    <img src="${featuredImage}" alt="${imageAlt}" loading="eager">
    <div class="blog-hero-overlay"></div>
    <div class="blog-hero-caption">
      <div class="blog-category">${category}</div>
      <h1 class="blog-hero-title">${title}</h1>
      <div class="blog-hero-meta">
        <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${author}</span>
        <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${readTime}</span>
        <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${createdAt}</span>
      </div>
    </div>
  </div>` : `
  <div style="background:linear-gradient(135deg,#2c96f4,#1a7fd4);padding:80px 24px 60px">
    <div style="max-width:1200px;margin:0 auto">
      <div class="blog-category" style="margin-bottom:16px">${category}</div>
      <h1 style="color:#fff;font-size:2.25rem;font-weight:700;max-width:800px;line-height:1.2">${title}</h1>
      <div class="blog-hero-meta" style="margin-top:16px">
        <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${author}</span>
        <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${readTime}</span>
        <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${createdAt}</span>
      </div>
    </div>
  </div>`}

  <div class="blog-container">
    <div class="blog-back">
      <a href="/blogs/">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Blog
      </a>
    </div>

    <article class="blog-body">
      ${body}
    </article>

    <div class="blog-share">
      <p>Share this article</p>
      <div class="share-btns">
        <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(`https://mildmate.com/blogs/${post.slug}/`)}" target="_blank" rel="noopener" class="share-btn twitter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Twitter/X
        </a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://mildmate.com/blogs/${post.slug}/`)}" target="_blank" rel="noopener" class="share-btn facebook">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Facebook
        </a>
        <a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(`https://mildmate.com/blogs/${post.slug}/`)}&title=${encodeURIComponent(title)}" target="_blank" rel="noopener" class="share-btn linkedin">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          LinkedIn
        </a>
      </div>
    </div>
  </div>

  <footer class="site-footer" id="site-footer"></footer>

  <script src="/js/nav.js"></script>
  <script src="/js/cart.js"></script>
  <script>
    // Mobile menu
    document.getElementById('mobile-menu-btn').addEventListener('click', function() {
      var drawer = document.getElementById('mobile-drawer') || document.querySelector('.mobile-drawer');
      if (drawer) drawer.classList.toggle('open');
    });
  </script>
</body>
</html>`;
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric"
    });
  } catch { return dateStr; }
}
