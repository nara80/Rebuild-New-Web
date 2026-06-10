// Blog post pages — /blogs/{slug}/
// Reads from D1 blog_posts table

export async function onRequest(context): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname; // e.g. /blogs/my-post/

  // /blogs/ → SSR listing page
  if (path === "/blogs/" || path === "/blogs") {
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    return buildBlogListingHTML(env, page);
  }

  // Let static assets under /blogs/* pass through (e.g. /blogs/folder/image.png)
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

    const html = await buildBlogPostHTML(post, env);
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

// ─── Blog listing page ─────────────────────────────────────────────────────
async function buildBlogListingHTML(env: any, page: number = 1): Promise<Response> {
  try {
    const PER_PAGE = 8;
    const countStmt = env.DB.prepare("SELECT COUNT(*) as total FROM blog_posts WHERE status='published'");
    const countResult = await countStmt.first();
    const totalPosts = countResult?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalPosts / PER_PAGE));
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    const offset = (page - 1) * PER_PAGE;

    const stmt = env.DB.prepare(
      "SELECT id,slug,title_en,meta_description_en,featured_image,featured_image_alt_en,category,categories_json,author,read_time_en,created_at,is_featured FROM blog_posts WHERE status='published' ORDER BY is_featured DESC,created_at DESC LIMIT ? OFFSET ?"
    ).bind(PER_PAGE, offset);
    const { results } = await stmt.all();
    const posts = results || [];

    const parseCats = (raw: any): string[] => {
      try {
        const arr = JSON.parse(raw || "[]");
        if (!Array.isArray(arr)) return [];
        return arr.map((x: any) => String(x || "").trim()).filter(Boolean);
      } catch {
        return [];
      }
    };

    const categorySet = new Set(["All"]);
    posts.forEach((p: any) => {
      const cats = parseCats(p.categories_json);
      if (cats.length) {
        cats.forEach((c) => categorySet.add(c));
      } else if (p.category) {
        categorySet.add(p.category);
      }
    });
    const categories = Array.from(categorySet);

    const esc = (s: string) => s ? s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;") : "";

    let featuredHtml = "";
    let gridHtml = "";

    posts.forEach((post: any, i: number) => {
      const img = post.featured_image ? esc(post.featured_image) : "";
      const alt = esc(post.featured_image_alt_en || post.title_en || "");
      const slug = esc(post.slug);
      const title = esc(post.title_en || "");
      const desc = esc(post.meta_description_en || "").substring(0, 140);
      const cats = parseCats(post.categories_json);
      const cat = esc(cats[0] || post.category || "General");
      const date = formatDate(post.created_at);
      const link = "/blogs/" + slug + "/";
      const card = '<div class="blog-card"><div class="card-image"><a href="' + link + '"><img src="' + img + '" alt="' + alt + '" loading="lazy"></a></div><div class="card-body"><div class="card-category">' + cat + '</div><div class="card-date"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> ' + date + '</div><h2 class="card-title"><a href="' + link + '">' + title + '</a></h2><p class="card-excerpt">' + desc + (desc.length >= 140 ? "..." : "") + '</p><a href="' + link + '" class="card-read-more">Read more <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a></div></div>';

      if (page === 1 && i === 0 && post.is_featured) {
        featuredHtml = '<div class="featured-post"><div class="card-image"><a href="' + link + '"><img src="' + img + '" alt="' + alt + '" loading="eager"></a></div><div class="card-body"><div class="card-category">' + cat + '</div><div class="card-date"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> ' + date + '</div><h2 class="card-title"><a href="' + link + '">' + title + '</a></h2><p class="card-excerpt">' + esc(post.meta_description_en || "") + '</p><a href="' + link + '" class="card-read-more">Read article <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a></div></div>';
      } else {
        gridHtml += card;
      }
    });

    const filterBtns = categories.map((c: string) =>
      '<button class="filter-tab' + (c === "All" ? " active" : "") + '" onclick="window.location.href=\'/blogs/\'">' + c + '</button>'
    ).join("");

    const newsletter = '';

    // ─── Pagination ────────────────────────────────────────────
    let paginationHtml = '';
    if (totalPages > 1) {
      const prevPage = page > 1 ? page - 1 : 1;
      const nextPage = page < totalPages ? page + 1 : totalPages;
      const prevDisabled = page <= 1;
      const nextDisabled = page >= totalPages;

      const escAttr = (s: string) => String(s).replace(/"/g,"&quot;").replace(/&/g,"&amp;");
      const baseUrl = '/blogs/';

      let dotsHtml = '';
      for (let p = 1; p <= totalPages; p++) {
        dotsHtml += '<button class="pag-dot' + (p === page ? ' active' : '') + '" onclick="window.location.href=\'' + escAttr(baseUrl + '?page=' + p) + '\'" aria-label="Page ' + p + '"></button>';
      }

      paginationHtml = '<div class="blog-pagination">'
        + '<button class="pag-arrow' + (prevDisabled ? ' disabled' : '') + '" onclick="window.location.href=\'' + escAttr(baseUrl + (prevPage > 1 ? '?page=' + prevPage : '')) + '\'"' + (prevDisabled ? ' disabled' : '') + ' aria-label="Previous page">'
        + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>'
        + '</button>'
        + '<div class="pag-dots">' + dotsHtml + '</div>'
        + '<button class="pag-arrow' + (nextDisabled ? ' disabled' : '') + '" onclick="window.location.href=\'' + escAttr(baseUrl + '?page=' + nextPage) + '\'"' + (nextDisabled ? ' disabled' : '') + ' aria-label="Next page">'
        + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>'
        + '</button>'
        + '</div>';
    }

    const html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<meta name="description" content="MildMate Blog - bedding guides, sleep tips, and custom bedding advice for marine, family, and pet owners.">\n<title>MildMate Blog - Bedding Guides and Sleep Tips</title>\n<link href="/css/fonts.css" rel="stylesheet">\n<link rel="stylesheet" href="/css/main.min.css">\n<style>\n*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}\n.blog-index-page{background:#f0f7ff}\n.site-header{position:fixed;top:0;left:0;right:0;z-index:1000;background:#fff;border-bottom:1px solid #e2e8f0;height:80px;display:flex;align-items:center}\n.header-inner{max-width:1200px;margin:0 auto;padding:0 24px;width:100%;display:flex;align-items:center;justify-content:space-between}\n.logo-link{display:flex;align-items:center}\n.logo-link img{max-height:52px;width:auto}\n.main-nav{flex:1;display:flex;justify-content:center}\n.nav-list{display:flex;gap:32px;list-style:none;margin:0;padding:0}\n.nav-link{font-size:0.9375rem;font-weight:600;color:#1e293b;text-decoration:none;padding:4px 0;position:relative}\n.nav-link::after{content:"";position:absolute;bottom:-2px;left:0;right:0;height:2px;background:#2c96f4;transform:scaleX(0);transition:transform 0.2s}\n.nav-link:hover::after{transform:scaleX(1)}\n.header-actions{display:flex;gap:8px;align-items:center}\n.search-btn,.account-btn,.cart-btn{background:none;border:none;cursor:pointer;color:#1e293b;padding:8px;display:flex;align-items:center;gap:4px;text-decoration:none}\n.lang-toggle{display:flex;gap:4px;font-size:0.8125rem;font-weight:700;cursor:pointer}\n.lang-toggle span{padding:2px 4px}\n.cart-count{background:#2c96f4;color:#fff;border-radius:10px;font-size:0.6875rem;min-width:18px;text-align:center;padding:1px 5px}\n.mobile-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1001;display:none}\n.mobile-overlay.open{display:block}\n.mobile-drawer{position:fixed;top:0;left:-320px;width:300px;height:100%;background:#fff;z-index:1002;transition:left 0.3s;overflow-y:auto;padding:24px;box-shadow:4px 0 16px rgba(0,0,0,0.1)}\n.mobile-drawer.open{left:0}\n.mobile-drawer-search{margin-bottom:20px}\n.drawer-search-form{display:flex;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}\n.drawer-search-form input{flex:1;padding:10px 12px;border:none;outline:none;font-size:0.875rem;font-family:inherit}\n.drawer-search-form button{background:none;border:none;padding:10px 12px;cursor:pointer;color:#64748b}\n.mobile-nav-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}\n.mobile-nav-list a{display:block;padding:10px 12px;font-weight:600;color:#1e293b;text-decoration:none;border-radius:6px;font-size:0.9375rem}\n.mobile-nav-list a:hover{background:#f0f7ff;color:#2c96f4}\n.search-overlay{position:fixed;top:0;left:0;right:0;background:rgba(255,255,255,0.98);z-index:1100;display:none;padding:24px;box-shadow:0 4px 16px rgba(0,0,0,0.1)}\n.search-overlay.open{display:block}\n.search-overlay-inner{max-width:600px;margin:0 auto;display:flex;align-items:center;gap:12px}\n.search-close{background:none;border:none;cursor:pointer;padding:8px;color:#64748b}\n.search-form{flex:1;display:flex;border:2px solid #e2e8f0;border-radius:8px;overflow:hidden}\n.search-form input{flex:1;padding:12px 16px;border:none;outline:none;font-size:1rem;font-family:inherit}\n.search-form button{background:#2c96f4;border:none;padding:12px 20px;cursor:pointer;color:#fff;font-weight:600}\n.blog-hero{background:linear-gradient(135deg,#2c96f4 0%,#1a7fd4 100%);padding:80px 24px 48px;text-align:center;color:#fff;position:relative;overflow:hidden}\n.blog-hero::before{content:"";position:absolute;inset:0;opacity:0.08;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:40px 40px}\n.blog-hero h1{font-size:2.5rem;font-weight:700;margin-bottom:12px;color:#fff;position:relative;z-index:1}\n.blog-hero p{font-size:1.0625rem;color:rgba(255,255,255,0.9);max-width:560px;margin:0 auto;line-height:1.6;position:relative;z-index:1}\n.blog-filters{background:#fff;border-bottom:1px solid #e2e8f0;padding:0 24px}\n.blog-filters-inner{max-width:1200px;margin:0 auto;display:flex;gap:8px;overflow-x:auto;padding:16px 0}\n.filter-tab{padding:8px 20px;border-radius:20px;font-size:0.875rem;font-weight:600;white-space:nowrap;cursor:pointer;transition:background 0.2s,color 0.2s;background:#f8fafc;color:#1e293b;border:1px solid #e2e8f0}\n.filter-tab:hover,.filter-tab.active{background:#2c96f4;color:#fff;border-color:#2c96f4}\n.blog-listing-section{padding:48px 24px 80px;max-width:1200px;margin:0 auto}\n.blog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:28px;margin-top:40px}\n.blog-card{background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden;transition:transform 0.2s,box-shadow 0.2s;display:flex;flex-direction:column}\n.blog-card:hover{transform:translateY(-3px);box-shadow:0 6px 24px rgba(0,0,0,0.12)}\n.blog-card .card-image{position:relative;overflow:hidden;aspect-ratio:16/9}\n.blog-card .card-image img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.3s}\n.blog-card:hover .card-image img{transform:scale(1.04)}\n.blog-card .card-category{position:absolute;top:12px;left:12px;background:#2c96f4;color:#fff;font-size:0.625rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:4px 10px;border-radius:20px}\n.blog-card .card-body{padding:24px;flex:1;display:flex;flex-direction:column}\n.blog-card .card-date{font-size:0.75rem;color:#999;margin-bottom:8px;display:flex;align-items:center;gap:5px}\n.blog-card .card-title{font-size:1.0625rem;font-weight:700;color:#1e293b;line-height:1.35;margin-bottom:10px;flex:1}\n.blog-card .card-title a{color:inherit;text-decoration:none}\n.blog-card .card-title a:hover{color:#2c96f4}\n.blog-card .card-excerpt{font-size:0.875rem;color:#64748b;line-height:1.6;margin-bottom:16px}\n.blog-card .card-read-more{font-size:0.8125rem;font-weight:600;color:#2c96f4;text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-top:auto}\n.blog-card .card-read-more:hover{text-decoration:underline}\n.featured-post{background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden;display:grid;grid-template-columns:1fr 1fr;margin-bottom:48px}\n.featured-post .card-image{position:relative;overflow:hidden;min-height:380px}\n.featured-post .card-image img{width:100%;height:100%;object-fit:cover}\n.featured-post .card-body{padding:40px;display:flex;flex-direction:column;justify-content:center}\n.featured-post .card-date{font-size:0.8125rem;color:#999;margin-bottom:16px;display:flex;align-items:center;gap:6px}\n.featured-post .card-title{font-size:1.5rem;font-weight:700;color:#1e293b;line-height:1.3;margin-bottom:16px}\n.featured-post .card-title a{color:inherit;text-decoration:none}\n.featured-post .card-title a:hover{color:#2c96f4}\n.featured-post .card-excerpt{font-size:0.9375rem;color:#64748b;line-height:1.7;margin-bottom:24px}\n.featured-post .card-read-more{font-size:0.875rem;font-weight:600;color:#fff;text-decoration:none;display:inline-flex;align-items:center;gap:4px;padding:12px 28px;background:#2c96f4;border-radius:8px;width:fit-content;transition:background 0.2s}\n.featured-post .card-read-more:hover{background:#1a7fd4}\n.blog-pagination{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:48px;padding:16px 0}\n.pag-arrow{width:44px;height:44px;border-radius:50%;border:1px solid #e2e8f0;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#1e293b;transition:all 0.2s;padding:0}\n.pag-arrow:hover:not(.disabled){border-color:#2c96f4;color:#2c96f4;box-shadow:0 2px 8px rgba(44,150,244,0.15)}\n.pag-arrow.disabled{opacity:0.35;cursor:default}\n.pag-dots{display:flex;align-items:center;gap:8px}\n.pag-dot{width:10px;height:10px;border-radius:50%;border:2px solid #cbd5e1;background:transparent;cursor:pointer;padding:0;transition:all 0.25s}\n.pag-dot:hover{border-color:#2c96f4}\n.pag-dot.active{border-color:#2c96f4;background:#2c96f4}\n@media(max-width:768px){\n.hamburger{display:flex !important}\n.main-nav{display:none}\n.blog-hero h1{font-size:1.75rem}\n.featured-post{grid-template-columns:1fr}\n.featured-post .card-image{min-height:240px}\n.featured-post .card-body{padding:28px}\n.blog-grid{grid-template-columns:1fr}\n.blog-pagination{gap:12px}\n.pag-arrow{width:40px;height:40px}\n.pag-dot{width:11px;height:11px}\n}\n</style>\n</head>\n<body class="blog-index-page">\n<header class="site-header">\n  <div class="header-inner container">\n    <button class="hamburger" aria-label="Open menu" aria-expanded="false" style="display:none"><span></span><span></span><span></span></button>\n    <a href="/" class="logo-link" aria-label="MildMate Home"><picture><source srcset="/images/logo.webp" type="image/webp"><img src="/images/logo.png" alt="MildMate" width="180" height="50"></picture></a>\n    <nav class="main-nav" aria-label="Main navigation"><ul class="nav-list"><li class="nav-item"><a href="/products/" class="nav-link">Shop</a></li><li class="nav-item"><a href="/fabric/" class="nav-link">Fabrics</a></li><li class="nav-item"><a href="/sizeguide/" class="nav-link">Size Guide</a></li><li class="nav-item"><a href="/blogs/" class="nav-link">Blog</a></li></ul></nav>\n    <div class="header-actions">\n      <button class="search-btn" aria-label="Search products" aria-expanded="false"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>\n      <a href="/account/" class="account-btn" aria-label="My account"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></a>\n      <a href="/checkout/" class="cart-btn" aria-label="Shopping cart"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><span class="cart-count">0</span></a>\n      <div class="lang-toggle" role="group" aria-label="Language switch"><span data-lang="en" class="active" style="color:var(--color-primary);border-bottom:2px solid var(--color-primary);padding-bottom:1px">EN</span><span style="color:var(--color-border)">/</span><span data-lang="th" style="color:var(--color-muted)">TH</span></div>\n    </div>\n  </div>\n  <div class="mobile-overlay" aria-hidden="true"></div>\n  <div class="mobile-drawer" aria-label="Mobile menu"><div class="mobile-drawer-search"><form action="/products/" method="get" class="drawer-search-form"><input type="search" name="q" placeholder="Search bedding..." aria-label="Search" autocomplete="off"><button type="submit" aria-label="Submit search"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button></form></div><ul class="mobile-nav-list"><li><a href="/">Home</a></li><li><a href="/products/">Shop</a></li><li><a href="/fabric/">Fabrics</a></li><li><a href="/sizeguide/">Size Guide</a></li><li><a href="/blogs/">Blog</a></li><li class="mobile-nav-signin"><a href="/account/" class="sign-in-drawer-link" style="display:inline-block;background:var(--color-primary);color:#fff;font-weight:700;padding:8px 16px;border-radius:6px;margin-top:12px">Sign In</a></li></ul><div class="mobile-drawer-lang" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--color-border);display:flex;align-items:center;gap:8px"><span style="font-size:0.8125rem;font-weight:600;color:var(--color-muted)">Language:</span><span data-lang="en" class="active" style="color:var(--color-primary);font-weight:700;font-size:0.9375rem;cursor:pointer">EN</span><span style="color:var(--color-border)">/</span><span data-lang="th" style="color:var(--color-muted);font-weight:600;font-size:0.9375rem;cursor:pointer" onclick="window.location.href=\'/th/\'">TH</span></div></div>\n  <div class="search-overlay" aria-hidden="true"><div class="search-overlay-inner"><button class="search-close" aria-label="Close search"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button><form action="/products/" method="get" class="search-form"><input type="search" name="q" placeholder="Search bedding..." aria-label="Search" autocomplete="off"><button type="submit" aria-label="Submit search"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button></form></div></div>\n</header>\n<section class="blog-hero">\n  <h1>MildMate Blog</h1>\n  <p>Bedding guides, sleep tips, and custom bedding advice for marine, family, and pet owners - from MildMate engineers.</p>\n</section>\n' + (posts.length > 0 ? '<div class="blog-filters"><div class="blog-filters-inner">' + filterBtns + '</div></div>' : "") + '\n<section class="blog-listing-section">\n  ' + featuredHtml + '\n  ' + (posts.length > 0 ? '<div class="blog-grid">' + gridHtml + '</div>' : '<div style="text-align:center;padding:80px 0;color:#64748b"><p style="font-size:1.25rem;margin-bottom:8px">No posts yet.</p><p><a href="/admin/blog.html" style="color:#2c96f4">Create your first post in the admin panel</a></p></div>') + '\n  ' + newsletter + '\n  ' + paginationHtml + '\n</section>\n<footer class="site-footer"><div class="container"><div class="footer-grid"><div class="footer-col"><h3>Quick Links</h3><ul><li><a href="/about/">About Us</a></li><li><a href="/contact/">Contact Us</a></li><li><a href="/reviews/">Reviews</a></li></ul></div><div class="footer-col"><h3>Customer Service</h3><ul><li><a href="/faq/">FAQ</a></li><li><a href="/sizeguide/">Size Guide</a></li><li><a href="/blogs/">Blog</a></li></ul></div><div class="footer-col"><h3>Shop With Us</h3><div class="footer-icons-grid"><a href="https://www.etsy.com/shop/mildmate" target="_blank" rel="noopener noreferrer" aria-label="Etsy" class="footer-icon-circle"><img src="/images/Logo/Etsy.png" alt=""></a><a href="https://www.ebay.com/str/mildmate" target="_blank" rel="noopener noreferrer" aria-label="eBay" class="footer-icon-circle"><img src="/images/Logo/eBay.png" alt=""></a><a href="https://shopee.co.th/neededshop_bt.2n.1y" target="_blank" rel="noopener noreferrer" aria-label="Shopee" class="footer-icon-circle"><img src="/images/Logo/Shopee.png" alt=""></a><a href="https://www.lazada.co.th/shop/needed-shop" target="_blank" rel="noopener noreferrer" aria-label="Lazada" class="footer-icon-circle"><img src="/images/Logo/Lazada.png" alt=""></a></div></div><div class="footer-col"><h3>Contact</h3><ul><li><a href="mailto:contact@mildmate.com"><svg class="footer-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>contact@mildmate.com</a></li><li><a href="tel:+66872362364"><svg class="footer-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>+66 (0)87 236 2364</a></li></ul><div class="footer-icons-grid contact-icons"><a href="https://wa.me/66811515995" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" class="footer-icon-circle"><img src="/images/Logo/WhatsAPP.png" alt=""></a><a href="https://page.line.me/507abyoy" target="_blank" rel="noopener noreferrer" aria-label="LINE" class="footer-icon-circle"><img src="/images/Logo/LineOA.png" alt=""></a></div></div></div><div class="footer-social-center"><a href="https://www.facebook.com/mildmate.bedsheets" target="_blank" rel="noopener noreferrer" aria-label="Facebook" class="footer-social-icon"><img src="/images/Logo/Facebook.png" alt=""></a><a href="https://www.instagram.com/mild_mate/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" class="footer-social-icon"><img src="/images/Logo/Instagram.png" alt=""></a><a href="https://www.tiktok.com/@bt.mildmate" target="_blank" rel="noopener noreferrer" aria-label="TikTok" class="footer-social-icon"><img src="/images/Logo/TikTok.png" alt=""></a><a href="https://www.pinterest.com/mildmateshop/" target="_blank" rel="noopener noreferrer" aria-label="Pinterest" class="footer-social-icon"><img src="/images/Logo/Pinterest.png" alt=""></a><a href="https://www.youtube.com/channel/UCnxunfprych7pMss4zr6Qcw" target="_blank" rel="noopener noreferrer" aria-label="YouTube" class="footer-social-icon"><img src="/images/Logo/YouTube.png" alt=""></a></div><div class="footer-bottom"><p>&copy; MildMate 2026</p><div class="footer-bottom-links"><a href="/policy/">Privacy Policy</a><a href="/shipping/">Returns &amp; Delivery</a></div></div></div></footer>\n<script src="/js/nav.js"></script>\n<script src="/js/cart.js"></script>\n</body>\n</html>';

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" }
    });
  } catch (e) {
    return new Response("<html><body style='font-family:sans-serif;padding:40px'><h2>Server Error</h2><p>" + escHtml(e.message || String(e)) + "</p></body></html>", { status: 500 });
  }
}

// ─── Blog post page ────────────────────────────────────────────────────────
async function buildBlogPostHTML(post, env) {
  const title = escHtml(post.title_en || "MildMate Blog");
  const metaDesc = escHtml(post.meta_description_en || post.title_en || "");
  let categoryLabel = post.category || "General";
  try {
    const cats = JSON.parse(post.categories_json || "[]");
    if (Array.isArray(cats) && cats.length && String(cats[0] || "").trim()) {
      categoryLabel = String(cats[0]).trim();
    }
  } catch {}
  const category = escHtml(categoryLabel);
  const author = escHtml(post.author || "MildMate Team");
  const readTime = escHtml(post.read_time_en || "5 min read");
  const featuredImage = post.featured_image ? escHtml(post.featured_image) : "";
  const body = post.body_en || "<p>This article is coming soon.</p>";
  const createdAt = formatDate(post.created_at);
  const imageAlt = escHtml(post.featured_image_alt_en || title);

  const hasImage = featuredImage ? 'true' : 'false';

  // ─── Related Products (Approach A: niche mapping) ──────────
  const CATEGORY_NICHE_MAP = {
    "Marine & Yacht": "marine",
    "Family & Co-Sleep": "family",
    "RV & Truck Cab": "rv-truck",
    "Boarding Dorm": "boarding-dorm",
    "Pet Owner": "pets",
    "Deep Pocket": "deep-pocket",
    "Bedding Guide": "sheets"
  };
  const mappedNiche = CATEGORY_NICHE_MAP[categoryLabel] || "sheets";
  let relatedProductsHtml = "";
  try {
    const prodStmt = env.DB.prepare(
      "SELECT slug, title_en, image_url, base_price_usd FROM products WHERE niches LIKE ? AND is_active = 1 ORDER BY sort_order ASC LIMIT 4"
    ).bind("%" + mappedNiche + "%");
    const { results: products } = await prodStmt.all();
    if (products && products.length) {
      relatedProductsHtml = products.map((p) => {
        const pSlug = escHtml(p.slug);
        const pTitle = escHtml(p.title_en || "");
        const pImg = p.image_url ? escHtml(p.image_url) : "/images/placeholder.svg";
        const pPrice = p.base_price_usd ? "$" + Math.round(p.base_price_usd) : "";
        const pLink = "/product/" + pSlug + "/";
        return '<div class="related-card">'
          + '<a href="' + pLink + '" class="card-image"><img src="' + pImg + '" alt="' + pTitle + '" loading="lazy"></a>'
          + '<div class="card-body">'
          + '<div class="card-title"><a href="' + pLink + '" style="color:inherit;text-decoration:none">' + pTitle + '</a></div>'
          + (pPrice ? '<div class="card-price">' + pPrice + '</div>' : '')
          + '<a href="' + pLink + '" class="btn btn-primary">Shop Now</a>'
          + '</div></div>';
      }).join("");
    }
  } catch (e) {
    console.error("Related products query error:", e);
    relatedProductsHtml = "";
  }

  const relatedSectionHtml = relatedProductsHtml
    ? '<section class="related-products-section"><div class="container"><h2>You Might Also Like</h2><div class="related-grid">' + relatedProductsHtml + '</div></div></section>'
    : '';

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
    .related-products-section{background:#f0f7ff;padding:64px 24px 80px;border-top:1px solid #e2e8f0}
    .related-products-section h2{font-size:1.5rem;font-weight:700;text-align:center;margin-bottom:40px;color:#0f172a}
    .related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:24px}
    .related-card{background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06);overflow:hidden;transition:transform 0.2s,box-shadow 0.2s;display:flex;flex-direction:column}
    .related-card:hover{transform:translateY(-3px);box-shadow:0 6px 24px rgba(0,0,0,0.12)}
    .related-card .card-image{position:relative;overflow:hidden;background:#f8fafc}
    .related-card .card-image img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;transition:transform 0.3s}
    .related-card:hover .card-image img{transform:scale(1.04)}
    .related-card .card-body{padding:20px;flex:1;display:flex;flex-direction:column}
    .related-card .card-title{font-size:0.9375rem;font-weight:700;color:#1e293b;margin-bottom:10px;line-height:1.3;flex:1}
    .related-card .card-price{font-size:1.0625rem;font-weight:700;color:#2c96f4;margin-bottom:12px}
    .related-card .btn{display:block;text-align:center;text-decoration:none;padding:10px;border-radius:8px;font-weight:600;font-size:0.875rem;transition:background 0.2s;margin-top:auto}
    .related-card .btn-primary{background:#2c96f4;color:#fff}
    .related-card .btn-primary:hover{background:#1a7fd4}
    @media(max-width:768px){
      .blog-hero{height:320px}
      .blog-hero-title{font-size:1.5rem}
      .blog-body{padding:24px}
      .blog-container{padding:24px 16px 60px}
      .related-grid{grid-template-columns:1fr}
    }
  </style>
</head>
<body class="blog-post-page">
  <header class="site-header">
    <div class="header-inner container">
      <button class="hamburger" aria-label="Open menu" aria-expanded="false" style="display:none"><span></span><span></span><span></span></button>
      <a href="/" class="logo-link" aria-label="MildMate Home"><picture><source srcset="/images/logo.webp" type="image/webp"><img src="/images/logo.png" alt="MildMate" width="180" height="50"></picture></a>
      <nav class="main-nav" aria-label="Main navigation"><ul class="nav-list"><li class="nav-item"><a href="/products/" class="nav-link">Shop</a></li><li class="nav-item"><a href="/fabric/" class="nav-link">Fabrics</a></li><li class="nav-item"><a href="/sizeguide/" class="nav-link">Size Guide</a></li><li class="nav-item"><a href="/blogs/" class="nav-link">Blog</a></li></ul></nav>
      <div class="header-actions">
        <button class="search-btn" aria-label="Search products" aria-expanded="false"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>
        <a href="/account/" class="account-btn" aria-label="My account"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></a>
        <a href="/checkout/" class="cart-btn" aria-label="Shopping cart"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><span class="cart-count">0</span></a>
        <div class="lang-toggle" role="group" aria-label="Language switch"><span data-lang="en" class="active" style="color:var(--color-primary);border-bottom:2px solid var(--color-primary);padding-bottom:1px">EN</span><span style="color:var(--color-border)">/</span><span data-lang="th" style="color:var(--color-muted)">TH</span></div>
      </div>
    </div>
    <div class="mobile-overlay" aria-hidden="true"></div>
    <div class="mobile-drawer" aria-label="Mobile menu"><div class="mobile-drawer-search"><form action="/products/" method="get" class="drawer-search-form"><input type="search" name="q" placeholder="Search bedding..." aria-label="Search" autocomplete="off"><button type="submit" aria-label="Submit search"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button></form></div><ul class="mobile-nav-list"><li><a href="/">Home</a></li><li><a href="/products/">Shop</a></li><li><a href="/fabric/">Fabrics</a></li><li><a href="/sizeguide/">Size Guide</a></li><li><a href="/blogs/">Blog</a></li><li class="mobile-nav-signin"><a href="/account/" class="sign-in-drawer-link" style="display:inline-block;background:var(--color-primary);color:#fff;font-weight:700;padding:8px 16px;border-radius:6px;margin-top:12px">Sign In</a></li></ul><div class="mobile-drawer-lang" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--color-border);display:flex;align-items:center;gap:8px"><span style="font-size:0.8125rem;font-weight:600;color:var(--color-muted)">Language:</span><span data-lang="en" class="active" style="color:var(--color-primary);font-weight:700;font-size:0.9375rem;cursor:pointer">EN</span><span style="color:var(--color-border)">/</span><span data-lang="th" style="color:var(--color-muted);font-weight:600;font-size:0.9375rem;cursor:pointer" onclick="window.location.href='/th/'">TH</span></div></div>
    <div class="search-overlay" aria-hidden="true"><div class="search-overlay-inner"><button class="search-close" aria-label="Close search"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button><form action="/products/" method="get" class="search-form"><input type="search" name="q" placeholder="Search bedding..." aria-label="Search" autocomplete="off"><button type="submit" aria-label="Submit search"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button></form></div></div>
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

  ${relatedSectionHtml}

  <footer class="site-footer"><div class="container"><div class="footer-grid"><div class="footer-col"><h3>Quick Links</h3><ul><li><a href="/about/">About Us</a></li><li><a href="/contact/">Contact Us</a></li><li><a href="/reviews/">Reviews</a></li></ul></div><div class="footer-col"><h3>Customer Service</h3><ul><li><a href="/faq/">FAQ</a></li><li><a href="/sizeguide/">Size Guide</a></li><li><a href="/blogs/">Blog</a></li></ul></div><div class="footer-col"><h3>Shop With Us</h3><div class="footer-icons-grid"><a href="https://www.etsy.com/shop/mildmate" target="_blank" rel="noopener noreferrer" aria-label="Etsy" class="footer-icon-circle"><img src="/images/Logo/Etsy.png" alt=""></a><a href="https://www.ebay.com/str/mildmate" target="_blank" rel="noopener noreferrer" aria-label="eBay" class="footer-icon-circle"><img src="/images/Logo/eBay.png" alt=""></a><a href="https://shopee.co.th/neededshop_bt.2n.1y" target="_blank" rel="noopener noreferrer" aria-label="Shopee" class="footer-icon-circle"><img src="/images/Logo/Shopee.png" alt=""></a><a href="https://www.lazada.co.th/shop/needed-shop" target="_blank" rel="noopener noreferrer" aria-label="Lazada" class="footer-icon-circle"><img src="/images/Logo/Lazada.png" alt=""></a></div></div><div class="footer-col"><h3>Contact</h3><ul><li><a href="mailto:contact@mildmate.com"><svg class="footer-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>contact@mildmate.com</a></li><li><a href="tel:+66872362364"><svg class="footer-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>+66 (0)87 236 2364</a></li></ul><div class="footer-icons-grid contact-icons"><a href="https://wa.me/66811515995" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" class="footer-icon-circle"><img src="/images/Logo/WhatsAPP.png" alt=""></a><a href="https://page.line.me/507abyoy" target="_blank" rel="noopener noreferrer" aria-label="LINE" class="footer-icon-circle"><img src="/images/Logo/LineOA.png" alt=""></a></div></div></div><div class="footer-social-center"><a href="https://www.facebook.com/mildmate.bedsheets" target="_blank" rel="noopener noreferrer" aria-label="Facebook" class="footer-social-icon"><img src="/images/Logo/Facebook.png" alt=""></a><a href="https://www.instagram.com/mild_mate/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" class="footer-social-icon"><img src="/images/Logo/Instagram.png" alt=""></a><a href="https://www.tiktok.com/@bt.mildmate" target="_blank" rel="noopener noreferrer" aria-label="TikTok" class="footer-social-icon"><img src="/images/Logo/TikTok.png" alt=""></a><a href="https://www.pinterest.com/mildmateshop/" target="_blank" rel="noopener noreferrer" aria-label="Pinterest" class="footer-social-icon"><img src="/images/Logo/Pinterest.png" alt=""></a><a href="https://www.youtube.com/channel/UCnxunfprych7pMss4zr6Qcw" target="_blank" rel="noopener noreferrer" aria-label="YouTube" class="footer-social-icon"><img src="/images/Logo/YouTube.png" alt=""></a></div><div class="footer-bottom"><p>&copy; MildMate 2026</p><div class="footer-bottom-links"><a href="/policy/">Privacy Policy</a><a href="/shipping/">Returns &amp; Delivery</a></div></div></div></footer>

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
