var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// blog-shared.ts
function escHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
__name(escHtml, "escHtml");
function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch {
    return dateStr;
  }
}
__name(formatDate, "formatDate");
var R2_PUBLIC_BASE = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";
function toPublicR2Url(url) {
  if (!url) return url;
  return url.startsWith("/r2/") ? `${R2_PUBLIC_BASE}${url.slice(3)}` : url;
}
__name(toPublicR2Url, "toPublicR2Url");
function normalizeR2InHtml(html) {
  if (!html) return html;
  return html.replace(/(["'])\/r2\//g, `$1${R2_PUBLIC_BASE}/`).replace(/\\\/r2\\\//g, `${R2_PUBLIC_BASE.replace(/\//g, "\\/")}\\/`);
}
__name(normalizeR2InHtml, "normalizeR2InHtml");
async function buildBlogListingHTML(env, page = 1, lang = "en") {
  const isThai = lang === "th";
  const prefix = isThai ? "/th" : "";
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
      "SELECT id,slug,title_en,title_th,meta_description_en,meta_description_th,featured_image,featured_image_alt_en,featured_image_alt_th,category,categories_json,author,read_time_en,read_time_th,created_at,is_featured FROM blog_posts WHERE status='published' ORDER BY is_featured DESC,created_at DESC LIMIT ? OFFSET ?"
    ).bind(PER_PAGE, offset);
    const { results } = await stmt.all();
    const posts = results || [];
    const parseCats = /* @__PURE__ */ __name((raw) => {
      try {
        const arr = JSON.parse(raw || "[]");
        if (!Array.isArray(arr)) return [];
        return arr.map((x) => String(x || "").trim()).filter(Boolean);
      } catch {
        return [];
      }
    }, "parseCats");
    const categorySet = /* @__PURE__ */ new Set(["All"]);
    posts.forEach((p) => {
      const cats = parseCats(p.categories_json);
      if (cats.length) {
        cats.forEach((c) => categorySet.add(c));
      } else if (p.category) {
        categorySet.add(p.category);
      }
    });
    const categories = Array.from(categorySet);
    const esc = /* @__PURE__ */ __name((s) => s ? s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "", "esc");
    let featuredHtml = "";
    let gridHtml = "";
    const CATEGORY_TH = {
      "Marine & Yacht": "\u0E40\u0E23\u0E37\u0E2D",
      "Family & Co-Sleep": "\u0E04\u0E23\u0E2D\u0E1A\u0E04\u0E23\u0E31\u0E27",
      "Pet Owner": "\u0E17\u0E32\u0E2A\u0E2B\u0E21\u0E32 \u0E41\u0E21\u0E27",
      "Bedding Guide": "\u0E04\u0E39\u0E48\u0E21\u0E37\u0E2D\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E19\u0E2D\u0E19",
      "Boarding Dorm": "\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19",
      "RV & Truck Cab": "\u0E23\u0E16\u0E41\u0E25\u0E30\u0E23\u0E16\u0E1A\u0E23\u0E23\u0E17\u0E38\u0E01",
      "All": "\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14"
    };
    posts.forEach((post, i) => {
      const img = post.featured_image ? esc(toPublicR2Url(post.featured_image)) : "";
      const alt = esc(isThai ? post.featured_image_alt_th || post.title_th || post.title_en || "" : post.featured_image_alt_en || post.title_en || "");
      const slug = esc(post.slug);
      const title = esc(isThai ? post.title_th || post.title_en || "" : post.title_en || "");
      const desc = esc(isThai ? post.meta_description_th || post.meta_description_en || "" : post.meta_description_en || "").substring(0, 140);
      const cats = parseCats(post.categories_json);
      const cat = esc(isThai && CATEGORY_TH[cats[0] || post.category || "General"] ? CATEGORY_TH[cats[0] || post.category || "General"] : cats[0] || post.category || "General");
      const date = formatDate(post.created_at);
      const link = (isThai ? "/th" : "") + "/blogs/" + slug + "/";
      const card = '<div class="blog-card"><div class="card-image"><a href="' + link + '"><img src="' + img + '" alt="' + alt + '" loading="lazy"></a></div><div class="card-body"><div class="card-category">' + cat + '</div><div class="card-date"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> ' + date + '</div><h2 class="card-title"><a href="' + link + '">' + title + '</a></h2><p class="card-excerpt">' + desc + (desc.length >= 140 ? "..." : "") + '</p><a href="' + link + '" class="card-read-more">' + (isThai ? "\u0E2D\u0E48\u0E32\u0E19\u0E15\u0E48\u0E2D" : "Read more") + ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a></div></div>';
      if (page === 1 && i === 0 && post.is_featured) {
        featuredHtml = '<div class="featured-post"><div class="card-image"><a href="' + link + '"><img src="' + img + '" alt="' + alt + '" loading="eager"></a></div><div class="card-body"><div class="card-category">' + cat + '</div><div class="card-date"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> ' + date + '</div><h2 class="card-title"><a href="' + link + '">' + title + '</a></h2><p class="card-excerpt">' + esc(isThai ? post.meta_description_th || post.meta_description_en || "" : post.meta_description_en || "") + '</p><a href="' + link + '" class="card-read-more">' + (isThai ? "\u0E2D\u0E48\u0E32\u0E19\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21" : "Read article") + ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a></div></div>';
      } else {
        gridHtml += card;
      }
    });
    const filterBtns = categories.map(
      (c) => '<button class="filter-tab' + (c === "All" ? " active" : "") + `" onclick="window.location.href='` + (isThai ? "/th" : "") + `/blogs/'">` + (isThai && CATEGORY_TH[c] ? CATEGORY_TH[c] : c) + "</button>"
    ).join("");
    const newsletter = "";
    let paginationHtml = "";
    if (totalPages > 1) {
      const prevPage = page > 1 ? page - 1 : 1;
      const nextPage = page < totalPages ? page + 1 : totalPages;
      const prevDisabled = page <= 1;
      const nextDisabled = page >= totalPages;
      const escAttr = /* @__PURE__ */ __name((s) => String(s).replace(/"/g, "&quot;").replace(/&/g, "&amp;"), "escAttr");
      const baseUrl = (isThai ? "/th" : "") + "/blogs/";
      let dotsHtml = "";
      for (let p = 1; p <= totalPages; p++) {
        dotsHtml += '<button class="pag-dot' + (p === page ? " active" : "") + `" onclick="window.location.href='` + escAttr(baseUrl + "?page=" + p) + `'" aria-label="Page ` + p + '"></button>';
      }
      paginationHtml = '<div class="blog-pagination"><button class="pag-arrow' + (prevDisabled ? " disabled" : "") + `" onclick="window.location.href='` + escAttr(baseUrl + (prevPage > 1 ? "?page=" + prevPage : "")) + `'"` + (prevDisabled ? " disabled" : "") + ' aria-label="Previous page"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button><div class="pag-dots">' + dotsHtml + '</div><button class="pag-arrow' + (nextDisabled ? " disabled" : "") + `" onclick="window.location.href='` + escAttr(baseUrl + "?page=" + nextPage) + `'"` + (nextDisabled ? " disabled" : "") + ' aria-label="Next page"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></button></div>';
    }
    const html = '<!DOCTYPE html>\n<html lang="' + (isThai ? "th" : "en") + '">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<meta name="description" content="' + (isThai ? "\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21 MildMate - \u0E04\u0E25\u0E31\u0E07\u0E04\u0E27\u0E32\u0E21\u0E23\u0E39\u0E49\u0E19\u0E27\u0E31\u0E15\u0E01\u0E23\u0E23\u0E21\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E19\u0E2D\u0E19\u0E2A\u0E31\u0E48\u0E07\u0E15\u0E31\u0E14\u0E1E\u0E34\u0E40\u0E28\u0E29: \u0E1B\u0E25\u0E14\u0E25\u0E47\u0E2D\u0E01\u0E01\u0E32\u0E23\u0E19\u0E2D\u0E19\u0E2B\u0E25\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E41\u0E1A\u0E1A\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E44\u0E25\u0E1F\u0E4C\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13" : "MildMate Blog - bedding guides, sleep tips, and custom bedding advice for marine, family, and pet owners.") + '">\n<title>' + (isThai ? "\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21 MildMate - \u0E04\u0E25\u0E31\u0E07\u0E04\u0E27\u0E32\u0E21\u0E23\u0E39\u0E49\u0E19\u0E27\u0E31\u0E15\u0E01\u0E23\u0E23\u0E21\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E19\u0E2D\u0E19\u0E2A\u0E31\u0E48\u0E07\u0E15\u0E31\u0E14\u0E1E\u0E34\u0E40\u0E28\u0E29" : "MildMate Blog - Bedding Guides and Sleep Tips") + '</title>\n<link href="/css/fonts.css" rel="stylesheet">\n<link rel="stylesheet" href="/css/main.min.css">\n<style>\n*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}\n.blog-index-page{background:#f0f7ff}\n.site-header{position:fixed;top:0;left:0;right:0;z-index:1000;background:#fff;border-bottom:1px solid #e2e8f0;height:80px;display:flex;align-items:center}\n.header-inner{max-width:1200px;margin:0 auto;padding:0 24px;width:100%;display:flex;align-items:center;justify-content:space-between}\n.logo-link{display:flex;align-items:center}\n.logo-link img{max-height:52px;width:auto}\n.main-nav{flex:1;display:flex;justify-content:center}\n.nav-list{display:flex;gap:32px;list-style:none;margin:0;padding:0}\n.nav-link{font-size:1.2rem;font-weight:600;color:#1e293b;text-decoration:none;padding:4px 0;position:relative}\n.nav-link::after{content:"";position:absolute;bottom:-2px;left:0;right:0;height:2px;background:#2c96f4;transform:scaleX(0);transition:transform 0.2s}\n.nav-link:hover::after{transform:scaleX(1)}\n.header-actions{display:flex;gap:8px;align-items:center}\n.search-btn,.account-btn,.cart-btn{background:none;border:none;cursor:pointer;color:#1e293b;padding:8px;display:flex;align-items:center;gap:4px;text-decoration:none}\n.lang-toggle{display:flex;gap:4px;font-size:0.8125rem;font-weight:700;cursor:pointer}\n.lang-toggle span{padding:2px 4px}\n.cart-count{background:#2c96f4;color:#fff;border-radius:10px;font-size:0.6875rem;min-width:18px;text-align:center;padding:1px 5px}\n.mobile-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:998;opacity:0;visibility:hidden;transition:opacity 0.25s,visibility 0.25s}\n.mobile-overlay.active{opacity:1;visibility:visible}\n.mobile-drawer{position:fixed;top:0;left:0;width:240px;max-width:85vw;height:100vh;background:#fff;z-index:999;transform:translateX(-100%);transition:transform 0.3s ease;overflow-y:auto;padding:18px;padding-top:calc(80px + 12px);box-shadow:4px 0 16px rgba(0,0,0,0.1)}\n.mobile-drawer.active{transform:translateX(0)}\n.mobile-drawer-search{margin-bottom:20px}\n.drawer-search-form{display:flex;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;padding:6px 10px;align-items:center;gap:6px}\n.drawer-search-form input{flex:1;padding:4px;border:none;outline:none;font-size:0.875rem;font-family:inherit}\n.drawer-search-form button{background:none;border:none;padding:4px;cursor:pointer;color:#64748b}\n.mobile-nav-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}\n.mobile-nav-list a{display:block;padding:8px 0;font-weight:600;color:#1e293b;text-decoration:none;font-size:1rem}\n.mobile-nav-list a:hover{background:#f0f7ff;color:#2c96f4}\n.search-overlay{position:fixed;inset:0;background:rgba(255,255,255,0.98);z-index:1003;display:flex;align-items:flex-start;justify-content:center;padding-top:120px;opacity:0;visibility:hidden;pointer-events:none;transition:opacity 0.25s,visibility 0.25s}\n.search-overlay.active{opacity:1;visibility:visible;pointer-events:auto}\n.search-overlay-inner{max-width:600px;margin:0 auto;display:flex;align-items:center;gap:12px}\n.search-close{background:none;border:none;cursor:pointer;padding:8px;color:#64748b}\n.search-form{flex:1;display:flex;border:2px solid #e2e8f0;border-radius:8px;overflow:hidden}\n.search-form input{flex:1;padding:12px 16px;border:none;outline:none;font-size:1rem;font-family:inherit}\n.search-form button{background:#2c96f4;border:none;padding:12px 20px;cursor:pointer;color:#fff;font-weight:600}\n.blog-hero{background:linear-gradient(135deg,#2c96f4 0%,#1a7fd4 100%);padding:80px 24px 48px;text-align:center;color:#fff;position:relative;overflow:hidden}\n.blog-hero::before{content:"";position:absolute;inset:0;opacity:0.08;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:40px 40px}\n.blog-hero h1{font-size:2.5rem;font-weight:700;margin-bottom:12px;color:#fff;position:relative;z-index:1}\n.blog-hero p{font-size:1.0625rem;color:rgba(255,255,255,0.9);max-width:560px;margin:0 auto;line-height:1.6;position:relative;z-index:1}\n.blog-filters{background:#fff;border-bottom:1px solid #e2e8f0;padding:0 24px}\n.blog-filters-inner{max-width:1200px;margin:0 auto;display:flex;gap:8px;overflow-x:auto;padding:16px 0}\n.filter-tab{padding:8px 20px;border-radius:20px;font-size:0.875rem;font-weight:600;white-space:nowrap;cursor:pointer;transition:background 0.2s,color 0.2s;background:#f8fafc;color:#1e293b;border:1px solid #e2e8f0}\n.filter-tab:hover,.filter-tab.active{background:#2c96f4;color:#fff;border-color:#2c96f4}\n.blog-listing-section{padding:48px 24px 80px;max-width:1200px;margin:0 auto}\n.blog-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;margin-top:40px}\n.blog-card{background:#fff;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 2px 12px rgba(0,0,0,0.06);overflow:hidden;transition:transform 0.2s,box-shadow 0.2s,border-color 0.2s;display:flex;flex-direction:column}.blog-card:hover{transform:translateY(-3px);box-shadow:0 6px 24px rgba(0,0,0,0.12);border-color:#2c96f4}\n.blog-card .card-image{position:relative;overflow:hidden;aspect-ratio:16/9}\n.blog-card .card-image img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.3s}\n.blog-card:hover .card-image img{transform:scale(1.04)}\n.blog-card .card-category{position:absolute;top:12px;left:12px;background:#2c96f4;color:#fff;font-size:0.625rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:4px 10px;border-radius:20px}\n.blog-card .card-body{padding:24px;flex:1;display:flex;flex-direction:column}\n.blog-card .card-date{font-size:0.75rem;color:#999;margin-bottom:8px;display:flex;align-items:center;gap:5px}\n.blog-card .card-title{font-size:1.0625rem;font-weight:700;color:#1e293b;line-height:1.35;margin-bottom:10px;flex:1}\n.blog-card .card-title a{color:inherit;text-decoration:none}\n.blog-card .card-title a:hover{color:#2c96f4}\n.blog-card .card-excerpt{font-size:0.875rem;color:#64748b;line-height:1.6;margin-bottom:16px}\n.blog-card .card-read-more{font-size:0.8125rem;font-weight:600;color:#2c96f4;text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-top:auto}\n.blog-card .card-read-more:hover{text-decoration:underline}\n.featured-post{background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden;display:grid;grid-template-columns:1fr 1fr;margin-bottom:48px}\n.featured-post .card-image{position:relative;overflow:hidden;min-height:380px}\n.featured-post .card-image img{width:100%;height:100%;object-fit:cover}\n.featured-post .card-body{padding:40px;display:flex;flex-direction:column;justify-content:center}\n.featured-post .card-date{font-size:0.8125rem;color:#999;margin-bottom:16px;display:flex;align-items:center;gap:6px}\n.featured-post .card-title{font-size:1.5rem;font-weight:700;color:#1e293b;line-height:1.3;margin-bottom:16px}\n.featured-post .card-title a{color:inherit;text-decoration:none}\n.featured-post .card-title a:hover{color:#2c96f4}\n.featured-post .card-excerpt{font-size:0.9375rem;color:#64748b;line-height:1.7;margin-bottom:24px}\n.featured-post .card-read-more{font-size:0.875rem;font-weight:600;color:#fff;text-decoration:none;display:inline-flex;align-items:center;gap:4px;padding:12px 28px;background:#2c96f4;border-radius:8px;width:fit-content;transition:background 0.2s}\n.featured-post .card-read-more:hover{background:#1a7fd4}\n.blog-pagination{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:48px;padding:16px 0}\n.pag-arrow{width:44px;height:44px;border-radius:50%;border:1px solid #e2e8f0;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#1e293b;transition:all 0.2s;padding:0}\n.pag-arrow:hover:not(.disabled){border-color:#2c96f4;color:#2c96f4;box-shadow:0 2px 8px rgba(44,150,244,0.15)}\n.pag-arrow.disabled{opacity:0.35;cursor:default}\n.pag-dots{display:flex;align-items:center;gap:8px}\n.pag-dot{width:10px;height:10px;border-radius:50%;border:2px solid #cbd5e1;background:transparent;cursor:pointer;padding:0;transition:all 0.25s}\n.pag-dot:hover{border-color:#2c96f4}\n.pag-dot.active{border-color:#2c96f4;background:#2c96f4}\n@media(max-width:1024px){.blog-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:768px){\n.hamburger{display:flex !important}\n.main-nav{display:none}\n.blog-hero h1{font-size:1.75rem}\n.featured-post{grid-template-columns:1fr}\n.featured-post .card-image{min-height:240px}\n.featured-post .card-body{padding:28px}\n.blog-grid{grid-template-columns:1fr}\n.blog-pagination{gap:12px}\n.pag-arrow{width:40px;height:40px}\n.pag-dot{width:11px;height:11px}\n}\n</style>\n</head>\n<body class="blog-index-page">\n<!-- __HEADER__ -->\n<section class="blog-hero">\n  <h1>' + (isThai ? "\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21 MildMate" : "MildMate Blog") + "</h1>\n  <p>" + (isThai ? "\u0E04\u0E25\u0E31\u0E07\u0E04\u0E27\u0E32\u0E21\u0E23\u0E39\u0E49\u0E19\u0E27\u0E31\u0E15\u0E01\u0E23\u0E23\u0E21\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E19\u0E2D\u0E19\u0E2A\u0E31\u0E48\u0E07\u0E15\u0E31\u0E14\u0E1E\u0E34\u0E40\u0E28\u0E29: \u0E1B\u0E25\u0E14\u0E25\u0E47\u0E2D\u0E01\u0E01\u0E32\u0E23\u0E19\u0E2D\u0E19\u0E2B\u0E25\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E41\u0E1A\u0E1A\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E44\u0E25\u0E1F\u0E4C\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13" : "Bedding guides, sleep tips, and custom bedding advice for marine, family, and pet owners - from MildMate engineers.") + "</p>\n</section>\n" + (posts.length > 0 ? '<div class="blog-filters"><div class="blog-filters-inner">' + filterBtns + "</div></div>" : "") + '\n<section class="blog-listing-section">\n  ' + featuredHtml + "\n  " + (posts.length > 0 ? '<div class="blog-grid">' + gridHtml + "</div>" : '<div style="text-align:center;padding:80px 0;color:#64748b"><p style="font-size:1.25rem;margin-bottom:8px">No posts yet.</p><p><a href="/admin/blog.html" style="color:#2c96f4">Create your first post in the admin panel</a></p></div>') + "\n  " + newsletter + "\n  " + paginationHtml + '\n</section>\n<!-- __FOOTER__ -->\n<script src="/js/nav.js"><\/script>\n<script src="/js/clerk.js"><\/script>\n<script src="/js/cart.js"><\/script>\n</body>\n</html>';
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" }
    });
  } catch (e) {
    return new Response("<html><body style='font-family:sans-serif;padding:40px'><h2>Server Error</h2><p>" + escHtml(e.message || String(e)) + "</p></body></html>", { status: 500 });
  }
}
__name(buildBlogListingHTML, "buildBlogListingHTML");
async function buildBlogPostHTML(post, env, lang = "en") {
  const isThai = lang === "th";
  const title = isThai ? escHtml(post.title_th || post.title_en || "MildMate Blog") : escHtml(post.title_en || "MildMate Blog");
  const metaDesc = isThai ? escHtml(post.meta_description_th || post.meta_description_en || post.title_th || "") : escHtml(post.meta_description_en || post.title_en || "");
  let categoryLabel = post.category || "General";
  try {
    const cats = JSON.parse(post.categories_json || "[]");
    if (Array.isArray(cats) && cats.length && String(cats[0] || "").trim()) {
      categoryLabel = String(cats[0]).trim();
    }
  } catch {
  }
  const category = escHtml(categoryLabel);
  const author = escHtml(post.author || (isThai ? "\u0E17\u0E35\u0E21 MildMate" : "MildMate Team"));
  const readTime = isThai ? escHtml(post.read_time_th || post.read_time_en || "5 min read") : escHtml(post.read_time_en || "5 min read");
  const featuredImage = post.featured_image ? escHtml(toPublicR2Url(post.featured_image)) : "";
  let body = isThai ? post.body_th || post.body_en || "<p>\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21\u0E19\u0E35\u0E49\u0E01\u0E33\u0E25\u0E31\u0E07\u0E08\u0E30\u0E21\u0E32\u0E40\u0E23\u0E47\u0E27\u0E46 \u0E19\u0E35\u0E49</p>" : post.body_en || "<p>This article is coming soon.</p>";
  body = body.replace(/(\w+)=""([^"]*?)""/g, '$1="$2"');
  body = normalizeR2InHtml(body);
  if (isThai && post.body_th && post.body_en && !/<img\b/i.test(post.body_th)) {
    const imgRegex = /<img\b[^>]*>/gi;
    const enImages = post.body_en.match(imgRegex);
    if (enImages && enImages.length > 0) {
      body += '<div style="margin-top:24px">' + enImages.map(
        (img) => img.replace(/<img/, '<img style="max-width:100%;border-radius:8px;margin:12px 0"')
      ).join("\n") + "</div>";
    }
  }
  const createdAt = formatDate(post.created_at);
  const imageAlt = isThai ? escHtml(post.featured_image_alt_th || post.title_th || title) : escHtml(post.featured_image_alt_en || title);
  const hasImage = featuredImage ? "true" : "false";
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
        const pImg = p.image_url ? escHtml(toPublicR2Url(p.image_url)) : "/images/placeholder.svg";
        const pPrice = p.base_price_usd ? "$" + Math.round(p.base_price_usd) : "";
        const pLink = "/product/" + pSlug + "/";
        return '<div class="related-card"><a href="' + pLink + '" class="card-image"><img src="' + pImg + '" alt="' + pTitle + '" loading="lazy"></a><div class="card-body"><div class="card-title"><a href="' + pLink + '" style="color:inherit;text-decoration:none">' + pTitle + "</a></div>" + (pPrice ? '<div class="card-price">' + pPrice + "</div>" : "") + '<a href="' + pLink + '" class="btn btn-primary">Shop Now</a></div></div>';
      }).join("");
    }
  } catch (e) {
    console.error("Related products query error:", e);
    relatedProductsHtml = "";
  }
  const canonicalUrl = `https://mildmate.com${isThai ? "/th" : ""}/blogs/${post.slug}/`;
  const articleJsonLd = `<script type="application/ld+json" id="json-ld-article">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${escHtml(title)}",
  "description": "${escHtml(metaDesc)}",
  "image": "${featuredImage}",
  "author": { "@type": "Person", "name": "${author}" },
  "publisher": {
    "@type": "Organization",
    "name": "MildMate",
    "logo": { "@type": "ImageObject", "url": "https://mildmate.com/images/logo.png" }
  },
  "datePublished": "${post.created_at || ""}",
  "dateModified": "${post.updated_at || post.created_at || ""}",
  "mainEntityOfPage": { "@type": "WebPage", "@id": "${canonicalUrl}" },
  "url": "${canonicalUrl}"
}
<\/script>`;
  const relatedSectionHtml = relatedProductsHtml ? '<section class="related-products-section"><div class="container"><h2>' + (isThai ? "\u0E04\u0E38\u0E13\u0E2D\u0E32\u0E08\u0E08\u0E30\u0E0A\u0E2D\u0E1A" : "You Might Also Like") + '</h2><div class="related-grid">' + relatedProductsHtml + "</div></div></section>" : "";
  const html = `<!DOCTYPE html>
<html lang="${isThai ? "th" : "en"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${metaDesc}">
  <title>${title} - MildMate Blog</title>
  <link rel="canonical" href="/${isThai ? "th/" : ""}blogs/${escHtml(post.slug)}/">
  <link rel="alternate" hreflang="en" href="/blogs/${escHtml(post.slug)}/">
  <link rel="alternate" hreflang="th" href="/th/blogs/${escHtml(post.slug)}/">
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
  <!-- __HEADER__ -->

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
      <a href="/${isThai ? "th/" : ""}blogs/">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        ${isThai ? "\u0E01\u0E25\u0E31\u0E1A\u0E44\u0E1B\u0E2B\u0E19\u0E49\u0E32\u0E1A\u0E25\u0E47\u0E2D\u0E01" : "Back to Blog"}
      </a>
    </div>

    <article class="blog-body">
      ${body}
    </article>

    <div class="blog-share">
      <p>${isThai ? "\u0E41\u0E0A\u0E23\u0E4C\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21\u0E19\u0E35\u0E49" : "Share this article"}</p>
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

  <!-- __FOOTER__ -->

  <script src="/js/nav.js"><\/script>
  <script src="/js/clerk.js"><\/script>
  <script src="/js/cart.js"><\/script>
</body>
</html>`;
  return html.replace(/<\/head>/i, `${articleJsonLd}
</head>`);
}
__name(buildBlogPostHTML, "buildBlogPostHTML");

// th/blogs/[[path]].ts
async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/th/blogs/" || path === "/th/blogs") {
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    return buildBlogListingHTML(env, page, "th");
  }
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
__name(onRequest, "onRequest");

// product/[[path]].ts
var CANONICAL_PRODUCT_SLUGS = /* @__PURE__ */ new Set([
  "standard-fitted-sheet",
  "deep-pocket-fitted-sheet",
  "marine-fitted-sheet",
  "dorm-fitted-sheet",
  "rv-truck-fitted-sheet",
  "family-fitted-sheet",
  "pet-owner-fitted-sheet",
  "flat-sheet-standard",
  "flat-sheet-extra-deep-pocket",
  "3-sided-duvet",
  "pet-owner-duvet-cover",
  "duvet-cover-marine",
  "duvet-cover-rv",
  "duvet-cover-dorm",
  "duvet-insert",
  "pillowcase-envelope",
  "pillowcase-zipper",
  "pillowcase-sham",
  "mattress-protector-standard",
  "marine-mattress-protector",
  "mattress-protector-family",
  "mattress-protector-deep-pocket",
  "pet-proof-mattress-protector",
  "mattress-encasement-general",
  "rv-truck-mattress-encasement",
  "pillow-protector-general",
  "bedbridge-connector",
  "mattress-lift-helper"
]);
var PRODUCT_TYPE_DISPLAY = {
  "sheets": "Sheets",
  "duvet-covers": "Duvet Covers",
  "pillowcases": "Pillowcases",
  "protection": "Protections",
  "accessories": "Accessories"
};
var NICHE_DISPLAY = {
  "marine": "Marine & Yacht",
  "family": "Family & Co-Sleep",
  "pets": "Pet Owner",
  "deep-pocket": "Deep Pocket",
  "boarding-dorm": "Boarding Dorm",
  "rv-truck": "RV & Truck Cab"
};
function hasToken(slug, token) {
  return new RegExp(`(^|[-/])${token}($|[-/])`).test(slug);
}
__name(hasToken, "hasToken");
function resolveLegacyProduct(slug) {
  if (slug === "%e0%b9%84%e0%b8%aa%e0%b9%89%e0%b8%9c%e0%b9%89%e0%b8%b2%e0%b8%99%e0%b8%a7%e0%b8%a1") return "/product/duvet-insert/";
  if (slug.startsWith("%e0%b8%9c%e0%b9%89%e0%b8%b2%e0%b8%9b%e0%b8%b9")) return "/product/family-fitted-sheet/";
  if (slug.startsWith("product-boat-bedding") || slug.startsWith("product-boat-top-sheet")) return "/product/marine-fitted-sheet/";
  if (slug.includes("boat") && slug.includes("pillow")) return "/product/pillowcase-envelope/";
  if (slug.includes("dorm")) return slug.includes("duvet") ? "/product/duvet-cover-dorm/" : "/product/dorm-fitted-sheet/";
  if (slug.includes("rv-truck") || hasToken(slug, "rv") || slug.includes("truck")) {
    if (slug.includes("duvet")) return "/product/duvet-cover-rv/";
    if (slug.includes("encasement")) return "/product/rv-truck-mattress-encasement/";
    return "/product/rv-truck-fitted-sheet/";
  }
  if (slug.includes("marine") || slug.includes("boat")) return slug.includes("duvet") ? "/product/duvet-cover-marine/" : "/product/marine-fitted-sheet/";
  if (slug.includes("pet")) {
    if (slug.includes("duvet") || slug.includes("3-sided")) return "/product/pet-owner-duvet-cover/";
    if (slug.includes("protector")) return "/product/pet-proof-mattress-protector/";
    if (slug.includes("pillow")) return "/product/pillowcase-zipper/";
    return "/product/pet-owner-fitted-sheet/";
  }
  if (slug.includes("co-sleeping") || slug.includes("family")) return "/product/family-fitted-sheet/";
  if (slug.includes("duvet")) return "/product/3-sided-duvet/";
  if (slug.includes("encasement") || slug.includes("zippered-tpu-mattress-cover")) return "/product/mattress-encasement-general/";
  if (slug.includes("sheet-protectors") || slug.includes("protector") || slug === "pillow-case") return "/product/mattress-protector-standard/";
  if (slug.includes("pillow") || slug.includes("pillowcase") || slug.includes("pillow-cover") || slug.includes("pillow-case")) {
    if (slug.includes("sham") || slug.includes("vent")) return "/product/pillowcase-sham/";
    if (slug.includes("zip") || slug.includes("hidden-zipper")) return "/product/pillowcase-zipper/";
    return "/product/pillowcase-envelope/";
  }
  if (slug.includes("fitted") || slug.includes("bed-sheet") || slug.includes("bedsheet")) return "/product/standard-fitted-sheet/";
  if (slug === "tbar") return "/product/bedbridge-connector/";
  if (slug === "mattress-lift-helper") return "/product/mattress-lift-helper/";
  if (slug === "baby-blanket" || slug === "animal-bedding") return "/products/";
  return "/products/";
}
__name(resolveLegacyProduct, "resolveLegacyProduct");
async function onRequest2(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  if (pathname === "/product" || pathname === "/product/") {
    return Response.redirect(new URL("/products/", url.origin).toString(), 301);
  }
  if (pathname === "/th/product" || pathname === "/th/product/") {
    return Response.redirect(new URL("/th/products/", url.origin).toString(), 301);
  }
  const parts = pathname.split("/").filter(Boolean);
  const isTh = parts[0] === "th";
  const startIdx = isTh ? 1 : 0;
  if (parts[startIdx] !== "product") return context.next();
  if (parts.length > startIdx + 2) return context.next();
  const slug = (parts[startIdx + 1] || "").toLowerCase();
  if (!slug) {
    return Response.redirect(new URL(isTh ? "/th/products/" : "/products/", url.origin).toString(), 301);
  }
  if (!CANONICAL_PRODUCT_SLUGS.has(slug)) {
    const target = resolveLegacyProduct(slug);
    const redirectTarget = isTh ? `/th${target}` : target;
    return Response.redirect(new URL(redirectTarget, url.origin).toString(), 301);
  }
  try {
    const staticUrl = `${url.origin}/product/${slug}/index.html`;
    const staticRes = await context.env.ASSETS.fetch(new Request(staticUrl));
    if (!staticRes.ok) return context.next();
    let html = await staticRes.text();
    if (isTh) {
      html = html.replace('<html lang="en">', '<html lang="th">');
    }
    const stmt = context.env.DB.prepare(
      "SELECT image_url, images, title_en, title_th, base_price_usd, product_type, niches FROM products WHERE slug = ?"
    ).bind(slug);
    const product = await stmt.first();
    let images = [];
    if (product && product.images) {
      try {
        images = JSON.parse(product.images);
      } catch (e) {
        try {
          images = JSON.parse(product.images.replace(/\\"/g, '"'));
        } catch (err) {
          console.error("Failed to parse product.images:", err);
        }
      }
    }
    const mainImage = product && product.image_url || images[0] || "";
    const title = isTh && product && product.title_th ? product.title_th : product && product.title_en;
    if (title) {
      html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title} \u2014 MildMate</title>`);
      html = html.replace(/<meta property="og:title" content="[^"]*"/g, `<meta property="og:title" content="${title} \u2014 MildMate"`);
      html = html.replace(/<meta name="twitter:title" content="[^"]*"/g, `<meta name="twitter:title" content="${title} \u2014 MildMate"`);
      if (product && product.title_en) {
        html = html.replace(
          new RegExp(`<h1 class="product-title">\\s*${product.title_en.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*(.*?)\\s*</h1>`, "i"),
          `<h1 class="product-title">${title}$1</h1>`
        );
        html = html.replace(
          new RegExp(`<span>\\s*${product.title_en.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*</span>`, "i"),
          `<span>${title}</span>`
        );
      }
    }
    if (product && (product.image_url || product.images)) {
      const THUMB_COUNT = 6;
      const thumbs = images.slice(0, THUMB_COUNT);
      if (mainImage) {
        html = html.replace(
          /<meta name="product-image" content="[^"]*"/,
          `<meta name="product-image" content="${mainImage}"`
        );
      }
      if (mainImage) {
        html = html.replace(
          /(<img\b[^>]*?\bid="gallery-main-img"[^>]*?\bsrc=")[^"]*/i,
          `$1${mainImage}`
        );
        html = html.replace(
          /(<img\b[^>]*?\bsrc=")[^"]*("[^>]*?\bid="gallery-main-img")/i,
          `$1${mainImage}$2`
        );
      }
      if (thumbs.length > 0) {
        const imagesJson = JSON.stringify(thumbs.filter(Boolean));
        html = html.replace(
          /<meta name="product-images" content="[^"]*"/,
          `<meta name="product-images" content='${imagesJson}'>`
        );
      }
    }
    const baseUrl = url.origin;
    const mainImageUrl = mainImage ? mainImage.startsWith("http") ? mainImage : `${baseUrl}${mainImage.startsWith("/") ? "" : "/"}${mainImage}` : "";
    const productTitle = isTh && product?.title_th || product?.title_en || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const productUrl = `${baseUrl}${isTh ? "/th" : ""}/product/${slug}/`;
    const rawPrice = Number(product?.base_price_usd);
    const hasPrice = Number.isFinite(rawPrice) && rawPrice > 0;
    let aggregateRating = void 0;
    try {
      const productTypeSlug = String(product?.product_type || "").trim().toLowerCase();
      const ptDisplay = PRODUCT_TYPE_DISPLAY[productTypeSlug] || productTypeSlug;
      const nicheDisplayNames = String(product?.niches || "").split(",").map((n) => n.trim().toLowerCase()).filter(Boolean).map((n) => NICHE_DISPLAY[n]).filter(Boolean);
      const matchTypes = [ptDisplay, ...nicheDisplayNames].filter(Boolean);
      if (matchTypes.length > 0) {
        const placeholders = matchTypes.map(() => "?").join(",");
        const ratingSql = `SELECT COUNT(*) AS review_count, AVG(rating) AS rating_value FROM reviews WHERE product_type IN (${placeholders})`;
        const ratingRow = await context.env.DB.prepare(ratingSql).bind(...matchTypes).first();
        const reviewCount = Number(ratingRow?.review_count || 0);
        const ratingValueNum = Number(ratingRow?.rating_value || 0);
        if (reviewCount > 0 && Number.isFinite(ratingValueNum) && ratingValueNum > 0) {
          aggregateRating = {
            "@type": "AggregateRating",
            ratingValue: ratingValueNum.toFixed(1),
            reviewCount
          };
        }
      }
    } catch (e) {
      console.error("Product JSON-LD rating query failed:", e);
    }
    const productSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: productTitle,
      image: mainImageUrl || void 0,
      description: "Custom made-to-measure bedding. Any size. Any shape. Made to fit.",
      brand: { "@type": "Brand", name: "MildMate" },
      url: productUrl
    };
    if (hasPrice) {
      productSchema.offers = {
        "@type": "Offer",
        price: rawPrice.toFixed(2),
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        seller: { "@type": "Organization", name: "MildMate" }
      };
    }
    if (aggregateRating) {
      productSchema.aggregateRating = aggregateRating;
    }
    const productJsonLd = `<script type="application/ld+json" id="json-ld-product">${JSON.stringify(productSchema)}<\/script>`;
    if (!html.includes('id="json-ld-product"')) {
      html = html.replace(/<\/head>/i, `${productJsonLd}
</head>`);
    }
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60"
      }
    });
  } catch (err) {
    console.error("Product SSR error:", err);
    return context.next();
  }
}
__name(onRequest2, "onRequest");

// ../workers/api/products.ts
var R2_PUBLIC_BASE2 = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";
function toR2Url(url) {
  if (!url) return url;
  if (url.startsWith("/r2/")) return `${R2_PUBLIC_BASE2}${url.slice(3)}`;
  return url;
}
__name(toR2Url, "toR2Url");
function normalizeMojibake(str) {
  const s = String(str || "").trim();
  if (!s) return "";
  return s.replace(/ΓÇÖ/g, "\u2019").replace(/ΓÇ£/g, "\u201C").replace(/ΓÇ¥/g, "\u201D").replace(/ΓÇö/g, "\u2014").replace(/ΓÇô/g, "\u2013").replace(/ΓÇª/g, "\u2026").replace(/ΓÇ¢/g, "\u2022").replace(/├ù/g, "\xD7").replace(/≡ƒ[^\s.,!?;:)"'’”\]]+/g, "").replace(/≡ƒñì/g, "").replace(/�/g, "");
}
__name(normalizeMojibake, "normalizeMojibake");
function r2Product(p) {
  const out = { ...p, image_url: toR2Url(p.image_url) };
  if (out.images && typeof out.images === "string") {
    try {
      let arr = [];
      try {
        arr = JSON.parse(out.images);
      } catch (e) {
        arr = JSON.parse(out.images.replace(/\\"/g, '"'));
      }
      out.images = JSON.stringify(arr.map(toR2Url));
    } catch (_) {
    }
  }
  return out;
}
__name(r2Product, "r2Product");
var PRODUCT_TYPE_DISPLAY2 = {
  "sheets": "Sheets",
  "duvet-covers": "Duvet Covers",
  "pillowcases": "Pillowcases",
  "protection": "Protections",
  "accessories": "Accessories"
};
var NICHE_DISPLAY2 = {
  "marine": "Marine & Yacht",
  "family": "Family & Co-Sleep",
  "pets": "Pet Owner",
  "deep-pocket": "Deep Pocket",
  "boarding-dorm": "Boarding Dorm",
  "rv-truck": "RV & Truck Cab"
};
async function listProducts(env, filters) {
  const db = env.DB;
  let sql = `SELECT * FROM products WHERE 1=1`;
  const params = [];
  if (filters.product_type) {
    sql += ` AND product_type = ?`;
    params.push(filters.product_type);
  } else if (filters.category) {
    sql += ` AND (product_type = ? OR category = ?)`;
    params.push(filters.category, filters.category);
  }
  if (filters.niche) {
    sql += ` AND (',' || niches || ',' LIKE '%,' || ? || ',%' OR ',' || category || ',' LIKE '%,' || ? || ',%')`;
    params.push(filters.niche, filters.niche);
  }
  if (filters.fabric) {
    sql += ` AND fabric = ?`;
    params.push(filters.fabric);
  }
  if (filters.search) {
    sql += ` AND (title_en LIKE ? OR description_en LIKE ?)`;
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  sql += ` ORDER BY id LIMIT 100`;
  const result = await db.prepare(sql).bind(...params).all();
  return result.results || [];
}
__name(listProducts, "listProducts");
async function getProductBySlug(env, slug) {
  const db = env.DB;
  const result = await db.prepare(`SELECT * FROM products WHERE slug = ?`).bind(slug).first();
  return result;
}
__name(getProductBySlug, "getProductBySlug");
async function handleProducts(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/api/products" || path === "/api/products/") {
    const category = url.searchParams.get("category") || void 0;
    const product_type = url.searchParams.get("product_type") || void 0;
    const niche = url.searchParams.get("niche") || void 0;
    const fabric = url.searchParams.get("fabric") || void 0;
    const search = url.searchParams.get("search") || void 0;
    try {
      const products = await listProducts(env, { category, product_type, niche, fabric, search });
      return new Response(JSON.stringify({ products: products.map(r2Product) }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message || "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  const reviewsMatch = path.match(/^\/api\/products\/([^\/]+)\/reviews$/);
  if (reviewsMatch) {
    const slug = reviewsMatch[1];
    return handleProductReviews(env, slug);
  }
  const slugMatch = path.match(/^\/api\/products\/(.+)$/);
  if (slugMatch) {
    try {
      const product = await getProductBySlug(env, slugMatch[1]);
      if (!product) {
        return new Response(JSON.stringify({ error: "Product not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ product: r2Product(product) }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message || "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleProducts, "handleProducts");
async function handleProductReviews(env, slug) {
  try {
    const product = await getProductBySlug(env, slug);
    if (!product || !product.product_type) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    const ptDisplay = PRODUCT_TYPE_DISPLAY2[product.product_type] || product.product_type;
    const nicheDisplayNames = [];
    if (product.niches) {
      product.niches.split(",").forEach((n) => {
        const trimmed = n.trim();
        if (trimmed && NICHE_DISPLAY2[trimmed]) {
          nicheDisplayNames.push(NICHE_DISPLAY2[trimmed]);
        }
      });
    }
    const matchTypes = [ptDisplay, ...nicheDisplayNames];
    const placeholders = matchTypes.map(() => "?").join(",");
    const db = env.DB;
    const sql = `
      SELECT id, customer_name, customer_country, review_text, rating,
             product_type, platform, image_url, is_verified, review_date, created_at
      FROM reviews
      WHERE product_type IN (${placeholders})
      ORDER BY
        CASE
          WHEN image_url != '' AND product_type IN (${nicheDisplayNames.map(() => "?").join(",")}) THEN 0
          WHEN image_url != '' AND product_type = ? THEN 1
          WHEN LOWER(platform) IN ('etsy', 'ebay', 'amazon') THEN 2
          ELSE 3
        END,
        review_date DESC,
        created_at DESC
      LIMIT 10
    `;
    const bindings = [...matchTypes, ...nicheDisplayNames, ptDisplay];
    const result = await db.prepare(sql).bind(...bindings).all();
    const reviews = (result.results || []).map((rv) => ({
      ...rv,
      customer_name: normalizeMojibake(rv.customer_name || ""),
      customer_country: normalizeMojibake(rv.customer_country || ""),
      review_text: normalizeMojibake(rv.review_text || ""),
      image_url: toR2Url(rv.image_url || ""),
      review_date: String(rv.review_date || rv.created_at || "").slice(0, 10)
    }));
    return new Response(JSON.stringify({ reviews, product_type: ptDisplay, niches: nicheDisplayNames }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Database error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleProductReviews, "handleProductReviews");

// ../workers/api/pricing.ts
var BOLT_WIDTH_CM = 260;
var SQCM_PER_YARD = 91.44 * BOLT_WIDTH_CM;
var FABRIC_COST_PER_YARD_THB = {
  cloudsoft: 100,
  breezeplus: 180,
  premacotton: 180,
  ecoluxe: 180
};
var SEWING_TIERS = [
  { maxArea: 51600, cost: 120 },
  { maxArea: 71e3, cost: 200 },
  { maxArea: 91200, cost: 300 },
  { maxArea: 12e4, cost: 400 },
  { maxArea: Infinity, cost: 500 }
];
var DUVET_SEWING_TIERS = [
  { maxArea: 139200, cost: 300 },
  { maxArea: 170400, cost: 400 },
  { maxArea: Infinity, cost: 600 }
];
var FLAT_SHEET_SEWING_COST = 250;
var PILLOW_WASTE = 1.6;
var PILLOW_SEWING_COST = 40;
var PILLOW_SHAM_SEWING_COST = 50;
var PILLOW_SHAM_FABRIC_EXTRA = 0.15;
var MAX_PILLOW_CM = 120;
var PACKING_COST = 100;
var DOMESTIC_DELIVERY_COST = 50;
var OPERATING_RATE = 0.15;
var MARKETING_RATE = 0.2;
var MARGIN_RATE = 0.3;
var FAMILY_MARGIN_RATE = 0.5;
var PILLOW_PROTECTOR_MARGIN_RATE = 0.35;
var PILLOWCASE_MARGIN_RATE = 0.15;
var THB_TO_USD = 30;
var MAX_WIDTH_CM = 220;
function inchToCm(val) {
  return val * 2.54;
}
__name(inchToCm, "inchToCm");
function getSewingCost(areaSqCm) {
  for (const tier of SEWING_TIERS) {
    if (areaSqCm <= tier.maxArea) return tier.cost;
  }
  return SEWING_TIERS[SEWING_TIERS.length - 1].cost;
}
__name(getSewingCost, "getSewingCost");
function getDuvetSewingCost(areaSqCm) {
  for (const tier of DUVET_SEWING_TIERS) {
    if (areaSqCm <= tier.maxArea) return tier.cost;
  }
  return DUVET_SEWING_TIERS[DUVET_SEWING_TIERS.length - 1].cost;
}
__name(getDuvetSewingCost, "getDuvetSewingCost");
function calculateFittedSheetPrice(wCm, lCm, dCm, fabric, marginRate = MARGIN_RATE) {
  const fabricW = wCm + 2 * dCm + 14;
  const fabricL = lCm + 2 * dCm + 14;
  const fabricArea = fabricW * fabricL;
  const yardRate = FABRIC_COST_PER_YARD_THB[fabric] || FABRIC_COST_PER_YARD_THB.cloudsoft;
  const fabricCost = fabricArea * yardRate / SQCM_PER_YARD * 1.2;
  const sewingCost = getSewingCost(fabricArea);
  const accessories = fabricCost * 0.1;
  const packing = PACKING_COST;
  const delivery = DOMESTIC_DELIVERY_COST;
  const subtotal = fabricCost + sewingCost + accessories + packing + delivery;
  const operating = subtotal * OPERATING_RATE;
  const marketing = subtotal * MARKETING_RATE;
  const margin = subtotal * marginRate;
  const total = subtotal + operating + marketing + margin;
  const rounded = Math.ceil(total / 100) * 100;
  const usd = Math.round(rounded / THB_TO_USD * 100) / 100;
  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(fabricArea * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: sewingCost,
      accessoriesThb: Math.round(accessories * 100) / 100,
      packingThb: packing,
      deliveryThb: delivery,
      subtotalThb: Math.round(subtotal * 100) / 100,
      operatingThb: Math.round(operating * 100) / 100,
      marketingThb: Math.round(marketing * 100) / 100,
      marginThb: Math.round(margin * 100) / 100,
      totalThb: Math.round(total * 100) / 100,
      roundedThb: rounded
    }
  };
}
__name(calculateFittedSheetPrice, "calculateFittedSheetPrice");
function calculateFlatSheetPrice(wCm, lCm, dCm, fabric) {
  const fabricW = wCm + 2 * dCm + 50;
  const fabricL = lCm + 2 * dCm + 50;
  const fabricArea = fabricW * fabricL;
  const yardRate = FABRIC_COST_PER_YARD_THB[fabric] || FABRIC_COST_PER_YARD_THB.cloudsoft;
  const fabricCost = fabricArea * yardRate / SQCM_PER_YARD * 1.2;
  const sewingCost = FLAT_SHEET_SEWING_COST;
  const packing = PACKING_COST;
  const delivery = DOMESTIC_DELIVERY_COST;
  const subtotal = fabricCost + sewingCost + packing + delivery;
  const operating = subtotal * OPERATING_RATE;
  const marketing = subtotal * MARKETING_RATE;
  const margin = subtotal * MARGIN_RATE;
  const total = subtotal + operating + marketing + margin;
  const rounded = Math.ceil(total / 100) * 100;
  const usd = Math.round(rounded / THB_TO_USD * 100) / 100;
  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(fabricArea * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: sewingCost,
      accessoriesThb: 0,
      packingThb: packing,
      deliveryThb: delivery,
      subtotalThb: Math.round(subtotal * 100) / 100,
      operatingThb: Math.round(operating * 100) / 100,
      marketingThb: Math.round(marketing * 100) / 100,
      marginThb: Math.round(margin * 100) / 100,
      totalThb: Math.round(total * 100) / 100,
      roundedThb: rounded
    }
  };
}
__name(calculateFlatSheetPrice, "calculateFlatSheetPrice");
function calculateDuvetPrice(wCm, lCm, fabric) {
  const rawArea = 2 * (wCm + 5) * (lCm + 5);
  const floorArea = rawArea * 1.2;
  const yardRate = FABRIC_COST_PER_YARD_THB[fabric] || FABRIC_COST_PER_YARD_THB.cloudsoft;
  const fabricCost = floorArea * yardRate / SQCM_PER_YARD;
  const zipperCost = 0.4 * (2 * lCm + wCm);
  const sewingCost = getDuvetSewingCost(rawArea);
  const packing = PACKING_COST;
  const delivery = DOMESTIC_DELIVERY_COST;
  const subtotal = fabricCost + zipperCost + sewingCost + packing + delivery;
  const operating = subtotal * OPERATING_RATE;
  const marketing = subtotal * MARKETING_RATE;
  const margin = subtotal * MARGIN_RATE;
  const total = subtotal + operating + marketing + margin;
  const rounded = Math.ceil(total / 100) * 100;
  const usd = Math.round(rounded / THB_TO_USD * 100) / 100;
  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(floorArea * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: sewingCost,
      accessoriesThb: Math.round(zipperCost * 100) / 100,
      // zipper stored in accessories slot
      packingThb: packing,
      deliveryThb: delivery,
      subtotalThb: Math.round(subtotal * 100) / 100,
      operatingThb: Math.round(operating * 100) / 100,
      marketingThb: Math.round(marketing * 100) / 100,
      marginThb: Math.round(margin * 100) / 100,
      totalThb: Math.round(total * 100) / 100,
      roundedThb: rounded
    }
  };
}
__name(calculateDuvetPrice, "calculateDuvetPrice");
function calculatePillowProtectorPrice(wCm, lCm) {
  const TPU_SQCM_PER_LM = 100 * 210;
  const rawArea = 2 * (wCm + 5) * (lCm + 5);
  const area = rawArea * PILLOW_WASTE;
  const fabricCost = 120 * area / TPU_SQCM_PER_LM;
  const zipperLength = Math.max(wCm, lCm);
  const zipperCost = 0.4 * zipperLength;
  const sewingCost = PILLOW_SEWING_COST;
  const packing = PACKING_COST;
  const delivery = DOMESTIC_DELIVERY_COST;
  const subtotal = fabricCost + zipperCost + sewingCost + packing + delivery;
  const operating = subtotal * OPERATING_RATE;
  const marketing = subtotal * MARKETING_RATE;
  const margin = subtotal * PILLOW_PROTECTOR_MARGIN_RATE;
  const total = subtotal + operating + marketing + margin;
  const rounded = Math.ceil(total / 100) * 100;
  const usd = Math.round(rounded / THB_TO_USD * 100) / 100;
  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(area * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: sewingCost,
      accessoriesThb: Math.round(zipperCost * 100) / 100,
      packingThb: packing,
      deliveryThb: delivery,
      subtotalThb: Math.round(subtotal * 100) / 100,
      operatingThb: Math.round(operating * 100) / 100,
      marketingThb: Math.round(marketing * 100) / 100,
      marginThb: Math.round(margin * 100) / 100,
      totalThb: Math.round(total * 100) / 100,
      roundedThb: rounded
    }
  };
}
__name(calculatePillowProtectorPrice, "calculatePillowProtectorPrice");
function calculatePillowcasePrice(wCm, lCm, fabric, variant) {
  let rawArea = 2 * (wCm + 5) * (lCm + 5);
  if (variant === "sham") rawArea *= 1 + PILLOW_SHAM_FABRIC_EXTRA;
  const area = rawArea * PILLOW_WASTE;
  const yardRate = FABRIC_COST_PER_YARD_THB[fabric] || FABRIC_COST_PER_YARD_THB.cloudsoft;
  const fabricCost = area * yardRate / SQCM_PER_YARD;
  const zipperCost = variant === "zipper" ? 0.4 * Math.max(wCm, lCm) : 0;
  const sewingCost = variant === "sham" ? PILLOW_SHAM_SEWING_COST : PILLOW_SEWING_COST;
  const packing = PACKING_COST;
  const delivery = DOMESTIC_DELIVERY_COST;
  const subtotal = fabricCost + zipperCost + sewingCost + packing + delivery;
  const operating = subtotal * OPERATING_RATE;
  const marketing = subtotal * MARKETING_RATE;
  const margin = subtotal * PILLOWCASE_MARGIN_RATE;
  const total = subtotal + operating + marketing + margin;
  const rounded = Math.ceil(total / 100) * 100;
  const usd = Math.round(rounded / THB_TO_USD * 100) / 100;
  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(area * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: sewingCost,
      accessoriesThb: Math.round(zipperCost * 100) / 100,
      packingThb: packing,
      deliveryThb: delivery,
      subtotalThb: Math.round(subtotal * 100) / 100,
      operatingThb: Math.round(operating * 100) / 100,
      marketingThb: Math.round(marketing * 100) / 100,
      marginThb: Math.round(margin * 100) / 100,
      totalThb: Math.round(total * 100) / 100,
      roundedThb: rounded
    }
  };
}
__name(calculatePillowcasePrice, "calculatePillowcasePrice");
function calculateLegacyPrice(mode, w, l, head, foot, fabric, currency) {
  const FABRIC_RATES = {
    breezeplus: { usd: 16e-4, thb: 0.057 },
    cloudsoft: { usd: 14e-4, thb: 0.05 },
    premacotton: { usd: 18e-4, thb: 0.064 },
    ecoluxe: { usd: 2e-3, thb: 0.071 }
  };
  const BASE_PRICES = {
    sheet: { usd: 45, thb: 1590 },
    vberth: { usd: 55, thb: 1945 }
  };
  const rateKey = currency.toLowerCase();
  const fabricRate = FABRIC_RATES[fabric]?.[rateKey] || FABRIC_RATES.breezeplus[rateKey];
  const base = BASE_PRICES[mode]?.[rateKey] || BASE_PRICES.sheet[rateKey];
  let area = 0;
  if (mode === "sheet" && w > 0 && l > 0) {
    area = w * l;
  } else if (mode === "vberth" && head > 0 && foot > 0 && l > 0) {
    area = (head + foot) / 2 * l;
  }
  const standardArea = 160 * 200;
  const extra = Math.max(0, area - standardArea) * fabricRate;
  return Math.round((base + extra) * 100) / 100;
}
__name(calculateLegacyPrice, "calculateLegacyPrice");
function isFittedSheetProduct(product) {
  return [
    "standard-fitted-sheet",
    "deep-pocket-fitted-sheet",
    "dorm-fitted-sheet",
    "rv-truck-fitted-sheet",
    "pet-owner-fitted-sheet",
    "family-fitted-sheet"
  ].includes(product);
}
__name(isFittedSheetProduct, "isFittedSheetProduct");
function isFlatSheetProduct(product) {
  return [
    "flat-sheet-standard",
    "flat-sheet-extra-deep-pocket"
  ].includes(product);
}
__name(isFlatSheetProduct, "isFlatSheetProduct");
function isDuvetProduct(product) {
  return [
    "3-sided-duvet",
    "duvet-cover-dorm",
    "duvet-cover-rv",
    "duvet-cover-marine",
    "pet-owner-duvet-cover"
  ].includes(product);
}
__name(isDuvetProduct, "isDuvetProduct");
function isPillowProtectorProduct(product) {
  return ["pillow-protector-general"].includes(product);
}
__name(isPillowProtectorProduct, "isPillowProtectorProduct");
function isPillowcaseProduct(product) {
  if (product === "pillowcase-envelope") return { isPillowcase: true, variant: "envelope" };
  if (product === "pillowcase-zipper") return { isPillowcase: true, variant: "zipper" };
  if (product === "pillowcase-sham") return { isPillowcase: true, variant: "sham" };
  return { isPillowcase: false };
}
__name(isPillowcaseProduct, "isPillowcaseProduct");
function calculatePrice(input, currency = "USD") {
  const product = input.product || "";
  const mode = input.mode || "sheet";
  const fabric = input.fabric || "cloudsoft";
  const pillowcase = isPillowcaseProduct(product);
  if (pillowcase.isPillowcase) {
    let w2 = input.width || 0;
    let l2 = input.length || 0;
    if (input.unit === "inch") {
      w2 = inchToCm(w2);
      l2 = inchToCm(l2);
    }
    if (w2 > MAX_PILLOW_CM || l2 > MAX_PILLOW_CM) {
      return { price: 0 };
    }
    if (w2 > 0 && l2 > 0) {
      const result = calculatePillowcasePrice(w2, l2, fabric, pillowcase.variant);
      return {
        price: currency === "THB" ? result.priceThb : result.priceUsd,
        breakdown: result.breakdown
      };
    }
    return { price: 0 };
  }
  if (isPillowProtectorProduct(product)) {
    let w2 = input.width || 0;
    let l2 = input.length || 0;
    if (input.unit === "inch") {
      w2 = inchToCm(w2);
      l2 = inchToCm(l2);
    }
    if (w2 > MAX_PILLOW_CM || l2 > MAX_PILLOW_CM) {
      return { price: 0 };
    }
    if (w2 > 0 && l2 > 0) {
      const result = calculatePillowProtectorPrice(w2, l2);
      return {
        price: currency === "THB" ? result.priceThb : result.priceUsd,
        breakdown: result.breakdown
      };
    }
    return { price: 0 };
  }
  if (isDuvetProduct(product)) {
    let w2 = input.width || 0;
    let l2 = input.length || 0;
    if (input.unit === "inch") {
      w2 = inchToCm(w2);
      l2 = inchToCm(l2);
    }
    if (w2 > 0 && l2 > 0) {
      const result = calculateDuvetPrice(w2, l2, fabric);
      return {
        price: currency === "THB" ? result.priceThb : result.priceUsd,
        breakdown: result.breakdown
      };
    }
    return { price: 0 };
  }
  if (isFlatSheetProduct(product)) {
    let w2 = input.width || 0;
    let l2 = input.length || 0;
    let d = input.depth || 0;
    if (input.unit === "inch") {
      w2 = inchToCm(w2);
      l2 = inchToCm(l2);
      d = inchToCm(d);
    }
    if (w2 > 0 && l2 > 0 && d > 0) {
      const result = calculateFlatSheetPrice(w2, l2, d, fabric);
      return {
        price: currency === "THB" ? result.priceThb : result.priceUsd,
        breakdown: result.breakdown
      };
    }
    return { price: 0 };
  }
  if (isFittedSheetProduct(product) || mode === "sheet" && !product) {
    let w2 = input.width || 0;
    let l2 = input.length || 0;
    let d = input.depth || 0;
    if (input.unit === "inch") {
      w2 = inchToCm(w2);
      l2 = inchToCm(l2);
      d = inchToCm(d);
    }
    if (w2 > 0 && l2 > 0 && d > 0) {
      if (product !== "family-fitted-sheet" && w2 > MAX_WIDTH_CM) {
        const result2 = calculateFittedSheetPrice(w2, l2, d, fabric);
        return {
          price: currency === "THB" ? result2.priceThb : result2.priceUsd,
          breakdown: { ...result2.breakdown, roundedThb: -1 }
          // -1 signals "requires family sheet"
        };
      }
      const marginRate = product === "family-fitted-sheet" ? FAMILY_MARGIN_RATE : MARGIN_RATE;
      const result = calculateFittedSheetPrice(w2, l2, d, fabric, marginRate);
      return {
        price: currency === "THB" ? result.priceThb : result.priceUsd,
        breakdown: result.breakdown
      };
    }
    return { price: 0 };
  }
  let w = input.width || 0;
  let l = input.length || 0;
  let head = input.head || 0;
  let foot = input.foot || 0;
  if (input.unit === "inch") {
    w = inchToCm(w);
    l = inchToCm(l);
    head = inchToCm(head);
    foot = inchToCm(foot);
  }
  return { price: calculateLegacyPrice(mode, w, l, head, foot, fabric, currency) };
}
__name(calculatePrice, "calculatePrice");
async function handlePricing(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/api/pricing" || path === "/api/pricing/") {
    if (request.method !== "POST" && request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      let body;
      if (request.method === "POST") {
        body = await request.json();
      } else {
        const params = url.searchParams;
        body = {
          product: params.get("product") || void 0,
          mode: params.get("mode") || "sheet",
          fabric: params.get("fabric") || "cloudsoft",
          unit: params.get("unit") || "cm",
          width: parseFloat(params.get("width") || "0") || void 0,
          length: parseFloat(params.get("length") || "0") || void 0,
          depth: parseFloat(params.get("depth") || "0") || void 0,
          head: parseFloat(params.get("head") || "0") || void 0,
          foot: parseFloat(params.get("foot") || "0") || void 0
        };
      }
      const resultUsd = calculatePrice(body, "USD");
      const resultThb = calculatePrice(body, "THB");
      let formulaType = "legacy";
      const pc = isPillowcaseProduct(body.product || "");
      if (pc.isPillowcase) {
        formulaType = "pillowcase";
      } else if (isPillowProtectorProduct(body.product || "")) {
        formulaType = "pillow-protector";
      } else if (isDuvetProduct(body.product || "")) {
        formulaType = "duvet";
      } else if (isFlatSheetProduct(body.product || "")) {
        formulaType = "flat-sheet";
      } else if (isFittedSheetProduct(body.product || "") || !body.product && body.mode !== "vberth") {
        formulaType = "fitted-sheet";
      }
      const response = {
        price_usd: resultUsd.price,
        price_thb: resultThb.price,
        product: body.product || null,
        mode: body.mode || "sheet",
        fabric: body.fabric || "cloudsoft",
        unit: body.unit || "cm",
        formula: formulaType
      };
      if (resultUsd.breakdown) {
        response.breakdown = resultUsd.breakdown;
      }
      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message || "Calculation error" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
}
__name(handlePricing, "handlePricing");

// ../workers/api/geo-currency.ts
var COUNTRY_NAMES = {
  // Asia-Pacific
  TH: "Thailand",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  TW: "Taiwan",
  HK: "Hong Kong",
  SG: "Singapore",
  MY: "Malaysia",
  ID: "Indonesia",
  PH: "Philippines",
  VN: "Vietnam",
  IN: "India",
  PK: "Pakistan",
  BD: "Bangladesh",
  LK: "Sri Lanka",
  MM: "Myanmar",
  KH: "Cambodia",
  LA: "Laos",
  NP: "Nepal",
  MN: "Mongolia",
  AU: "Australia",
  NZ: "New Zealand",
  // Europe
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  BE: "Belgium",
  AT: "Austria",
  CH: "Switzerland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IE: "Ireland",
  PT: "Portugal",
  PL: "Poland",
  CZ: "Czech Republic",
  GR: "Greece",
  HU: "Hungary",
  RO: "Romania",
  BG: "Bulgaria",
  HR: "Croatia",
  TR: "Turkey",
  UA: "Ukraine",
  IL: "Israel",
  RU: "Russia",
  // Americas
  US: "United States",
  CA: "Canada",
  MX: "Mexico",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  // Middle East & Africa
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  OM: "Oman",
  BH: "Bahrain",
  ZA: "South Africa",
  EG: "Egypt",
  NG: "Nigeria",
  KE: "Kenya",
  MA: "Morocco"
};
function detectGeo(request) {
  const headers = request.headers;
  const country = headers.get("CF-IPCountry") || headers.get("cf-ipcountry") || null;
  const isThailand = country === "TH";
  return {
    country,
    country_name: country ? COUNTRY_NAMES[country] || null : null,
    currency: isThailand ? "THB" : "USD",
    is_thailand: isThailand
  };
}
__name(detectGeo, "detectGeo");
async function handleGeo(request, env) {
  const result = detectGeo(request);
  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=60",
      "CDN-Cache-Control": "no-cache"
    }
  });
}
__name(handleGeo, "handleGeo");

// ../workers/api/countries.ts
var MASTER_COUNTRIES = [
  { code: "AF", name: "Afghanistan", phone: "+93" },
  { code: "AL", name: "Albania", phone: "+355" },
  { code: "DZ", name: "Algeria", phone: "+213" },
  { code: "AD", name: "Andorra", phone: "+376" },
  { code: "AO", name: "Angola", phone: "+244" },
  { code: "AR", name: "Argentina", phone: "+54" },
  { code: "AM", name: "Armenia", phone: "+374" },
  { code: "AU", name: "Australia", phone: "+61" },
  { code: "AT", name: "Austria", phone: "+43" },
  { code: "AZ", name: "Azerbaijan", phone: "+994" },
  { code: "BH", name: "Bahrain", phone: "+973" },
  { code: "BD", name: "Bangladesh", phone: "+880" },
  { code: "BY", name: "Belarus", phone: "+375" },
  { code: "BE", name: "Belgium", phone: "+32" },
  { code: "BT", name: "Bhutan", phone: "+975" },
  { code: "BO", name: "Bolivia", phone: "+591" },
  { code: "BA", name: "Bosnia", phone: "+387" },
  { code: "BR", name: "Brazil", phone: "+55" },
  { code: "BN", name: "Brunei", phone: "+673" },
  { code: "BG", name: "Bulgaria", phone: "+359" },
  { code: "KH", name: "Cambodia", phone: "+855" },
  { code: "CM", name: "Cameroon", phone: "+237" },
  { code: "CA", name: "Canada", phone: "+1" },
  { code: "CL", name: "Chile", phone: "+56" },
  { code: "CN", name: "China", phone: "+86" },
  { code: "CO", name: "Colombia", phone: "+57" },
  { code: "CR", name: "Costa Rica", phone: "+506" },
  { code: "HR", name: "Croatia", phone: "+385" },
  { code: "CY", name: "Cyprus", phone: "+357" },
  { code: "CZ", name: "Czech Republic", phone: "+420" },
  { code: "DK", name: "Denmark", phone: "+45" },
  { code: "EC", name: "Ecuador", phone: "+593" },
  { code: "EG", name: "Egypt", phone: "+20" },
  { code: "EE", name: "Estonia", phone: "+372" },
  { code: "ET", name: "Ethiopia", phone: "+251" },
  { code: "FI", name: "Finland", phone: "+358" },
  { code: "FR", name: "France", phone: "+33" },
  { code: "GE", name: "Georgia", phone: "+995" },
  { code: "DE", name: "Germany", phone: "+49" },
  { code: "GR", name: "Greece", phone: "+30" },
  { code: "HK", name: "Hong Kong", phone: "+852" },
  { code: "HU", name: "Hungary", phone: "+36" },
  { code: "IS", name: "Iceland", phone: "+354" },
  { code: "IN", name: "India", phone: "+91" },
  { code: "ID", name: "Indonesia", phone: "+62" },
  { code: "IR", name: "Iran", phone: "+98" },
  { code: "IQ", name: "Iraq", phone: "+964" },
  { code: "IE", name: "Ireland", phone: "+353" },
  { code: "IL", name: "Israel", phone: "+972" },
  { code: "IT", name: "Italy", phone: "+39" },
  { code: "JP", name: "Japan", phone: "+81" },
  { code: "JO", name: "Jordan", phone: "+962" },
  { code: "KZ", name: "Kazakhstan", phone: "+7" },
  { code: "KE", name: "Kenya", phone: "+254" },
  { code: "KW", name: "Kuwait", phone: "+965" },
  { code: "LA", name: "Laos", phone: "+856" },
  { code: "LV", name: "Latvia", phone: "+371" },
  { code: "LB", name: "Lebanon", phone: "+961" },
  { code: "LT", name: "Lithuania", phone: "+370" },
  { code: "LU", name: "Luxembourg", phone: "+352" },
  { code: "MY", name: "Malaysia", phone: "+60" },
  { code: "MV", name: "Maldives", phone: "+960" },
  { code: "MT", name: "Malta", phone: "+356" },
  { code: "MX", name: "Mexico", phone: "+52" },
  { code: "MC", name: "Monaco", phone: "+377" },
  { code: "MN", name: "Mongolia", phone: "+976" },
  { code: "MA", name: "Morocco", phone: "+212" },
  { code: "MM", name: "Myanmar", phone: "+95" },
  { code: "NP", name: "Nepal", phone: "+977" },
  { code: "NL", name: "Netherlands", phone: "+31" },
  { code: "NZ", name: "New Zealand", phone: "+64" },
  { code: "NG", name: "Nigeria", phone: "+234" },
  { code: "NO", name: "Norway", phone: "+47" },
  { code: "OM", name: "Oman", phone: "+968" },
  { code: "PK", name: "Pakistan", phone: "+92" },
  { code: "PA", name: "Panama", phone: "+507" },
  { code: "PE", name: "Peru", phone: "+51" },
  { code: "PH", name: "Philippines", phone: "+63" },
  { code: "PL", name: "Poland", phone: "+48" },
  { code: "PT", name: "Portugal", phone: "+351" },
  { code: "QA", name: "Qatar", phone: "+974" },
  { code: "RO", name: "Romania", phone: "+40" },
  { code: "RU", name: "Russia", phone: "+7" },
  { code: "SA", name: "Saudi Arabia", phone: "+966" },
  { code: "RS", name: "Serbia", phone: "+381" },
  { code: "SG", name: "Singapore", phone: "+65" },
  { code: "SK", name: "Slovakia", phone: "+421" },
  { code: "SI", name: "Slovenia", phone: "+386" },
  { code: "ZA", name: "South Africa", phone: "+27" },
  { code: "KR", name: "South Korea", phone: "+82" },
  { code: "ES", name: "Spain", phone: "+34" },
  { code: "LK", name: "Sri Lanka", phone: "+94" },
  { code: "SE", name: "Sweden", phone: "+46" },
  { code: "CH", name: "Switzerland", phone: "+41" },
  { code: "TW", name: "Taiwan", phone: "+886" },
  { code: "TZ", name: "Tanzania", phone: "+255" },
  { code: "TH", name: "Thailand", phone: "+66" },
  { code: "TR", name: "Turkey", phone: "+90" },
  { code: "AE", name: "UAE", phone: "+971" },
  { code: "UG", name: "Uganda", phone: "+256" },
  { code: "UA", name: "Ukraine", phone: "+380" },
  { code: "GB", name: "United Kingdom", phone: "+44" },
  { code: "US", name: "United States", phone: "+1" },
  { code: "UY", name: "Uruguay", phone: "+598" },
  { code: "UZ", name: "Uzbekistan", phone: "+998" },
  { code: "VE", name: "Venezuela", phone: "+58" },
  { code: "VN", name: "Vietnam", phone: "+84" },
  { code: "YE", name: "Yemen", phone: "+967" },
  { code: "ZW", name: "Zimbabwe", phone: "+263" },
  { code: "OTHER", name: "Other Countries", phone: "", fallback: true }
];
var countryMasterReady = false;
var countryMasterPromise = null;
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(json, "json");
async function ensureCountryMasterSchema(env) {
  if (countryMasterReady) return;
  if (!countryMasterPromise) {
    countryMasterPromise = (async () => {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS countries_master (
          country_code TEXT PRIMARY KEY,
          country_name TEXT NOT NULL,
          phone_code TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          is_fallback INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          updated_at DATETIME DEFAULT (datetime('now'))
        )`
      ).run();
      for (let i = 0; i < MASTER_COUNTRIES.length; i++) {
        const c = MASTER_COUNTRIES[i];
        await env.DB.prepare(
          `INSERT OR IGNORE INTO countries_master (
            country_code, country_name, phone_code, is_active, is_fallback, sort_order, updated_at
          ) VALUES (?1, ?2, ?3, 1, ?4, ?5, datetime('now'))`
        ).bind(c.code, c.name, c.phone || "", c.fallback ? 1 : 0, i + 1).run();
      }
      countryMasterReady = true;
    })().finally(() => {
      if (!countryMasterReady) countryMasterPromise = null;
    });
  }
  await countryMasterPromise;
}
__name(ensureCountryMasterSchema, "ensureCountryMasterSchema");
async function handleCountries(request, env) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }
  try {
    await ensureCountryMasterSchema(env);
    const url = new URL(request.url);
    const includeFallback = url.searchParams.get("include_fallback") === "1";
    const rows = await env.DB.prepare(
      `SELECT country_code, country_name, phone_code, is_fallback
       FROM countries_master
       WHERE is_active = 1
         AND (?1 = 1 OR is_fallback = 0)
       ORDER BY sort_order ASC, country_name ASC`
    ).bind(includeFallback ? 1 : 0).all();
    const countries = (rows.results || []).map((r) => ({
      code: String(r.country_code || "").toUpperCase(),
      name: String(r.country_name || "").trim(),
      phone: String(r.phone_code || "").trim(),
      is_fallback: Number(r.is_fallback || 0) === 1
    }));
    return json({ countries });
  } catch (e) {
    return json({ error: e?.message || "Countries unavailable" }, 500);
  }
}
__name(handleCountries, "handleCountries");

// ../workers/api/email.ts
async function sendEmail(env, options) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not set");
    throw new Error("RESEND_API_KEY not configured");
  }
  try {
    const from = options.from || env.ORDER_FROM_EMAIL || "MildMate <noreply@mildmate.com>";
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        reply_to: options.replyTo,
        subject: options.subject,
        text: options.text
      })
    });
    const body = await resp.json();
    if (!resp.ok) {
      console.error("Resend API error:", resp.status, JSON.stringify(body));
      return { success: false, error: body?.message || `HTTP ${resp.status}` };
    }
    return { success: true, id: body?.id };
  } catch (err) {
    console.error("Resend fetch failed:", err.message || err);
    return { success: false, error: err.message || "Network error" };
  }
}
__name(sendEmail, "sendEmail");

// ../workers/api/subscribe.ts
function generateDiscountCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return "WELCOME-" + code;
}
__name(generateDiscountCode, "generateDiscountCode");
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
__name(isValidEmail, "isValidEmail");
var SUBSCRIBE_RATE_LIMIT = 2;
async function handleSubscribe(request, env) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  if (body._website && body._website.length > 0) {
    return new Response(
      JSON.stringify({ success: true, message: "Thanks for subscribing!" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const db = env.DB;
  const rateRow = await db.prepare(
    `SELECT COUNT(*) as cnt FROM rate_limits WHERE ip_address = ? AND endpoint = 'subscribe' AND created_at > datetime('now', '-1 hour')`
  ).bind(ip).first();
  if ((rateRow?.cnt || 0) >= SUBSCRIBE_RATE_LIMIT) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  const email = (body.email || "").trim().toLowerCase();
  const source = (body.source || "homepage").trim().toLowerCase();
  const language = (body.language || "en").trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return new Response(
      JSON.stringify({ error: "A valid email address is required." }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  try {
    const existing = await db.prepare(`SELECT id, created_at FROM subscribers WHERE email = ?`).bind(email).first();
    const isNew = !existing;
    if (isNew) {
      await db.prepare(
        `INSERT INTO subscribers (email, source, language, created_at)
           VALUES (?, ?, ?, datetime('now'))`
      ).bind(email, source, language).run();
      await db.prepare(
        "INSERT INTO contacts (email, sources, is_subscribed, language, first_seen, last_seen) VALUES (?, 'subscribe', 1, ?, datetime('now'), datetime('now')) ON CONFLICT(email) DO UPDATE SET sources = CASE WHEN contacts.sources LIKE '%subscribe%' THEN contacts.sources ELSE contacts.sources || ',subscribe' END, is_subscribed = 1, last_seen = datetime('now')"
      ).bind(email, language).run();
      let discountCode = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        discountCode = generateDiscountCode();
        const exists = await db.prepare("SELECT id FROM discount_claims WHERE code = ?").bind(discountCode).first();
        if (!exists) break;
      }
      if (discountCode) {
        await db.prepare(
          "INSERT INTO discount_claims (email, code, status, expires_at, source) VALUES (?, ?, 'issued', datetime('now', '+6 months'), 'subscribe')"
        ).bind(email, discountCode).run();
      }
      const emailResults = await Promise.allSettled([
        sendEmail(env, {
          to: email,
          subject: language === "th" ? "\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E39\u0E48 MildMate \u2014 \u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14 15% \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E04\u0E38\u0E13" : "Welcome to MildMate \u2014 15% Off Your First Order",
          text: language === "th" ? "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E17\u0E35\u0E48\u0E2A\u0E21\u0E31\u0E04\u0E23\u0E23\u0E31\u0E1A\u0E02\u0E48\u0E32\u0E27\u0E2A\u0E32\u0E23\u0E08\u0E32\u0E01 MildMate! \u0E43\u0E0A\u0E49\u0E42\u0E04\u0E49\u0E14 " + discountCode + " \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E23\u0E31\u0E1A\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14 15% \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D\u0E41\u0E23\u0E01\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13 (\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38\u0E43\u0E19 6 \u0E40\u0E14\u0E37\u0E2D\u0E19)\n\n\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E01\u0E32\u0E23\u0E2A\u0E21\u0E31\u0E04\u0E23\u0E44\u0E14\u0E49\u0E15\u0E25\u0E2D\u0E14\u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48 mildmate.com/unsubscribe/" : "Thanks for subscribing to MildMate! Use code " + discountCode + " for 15% off your first order (expires in 6 months).\n\nUnsubscribe anytime at mildmate.com/unsubscribe/"
        }),
        sendEmail(env, {
          to: "contact@mildmate.com",
          subject: `New Subscriber: ${email}`,
          text: `New subscriber signed up.

Email: ${email}
Source: ${source}
Language: ${language}
Date: ${(/* @__PURE__ */ new Date()).toISOString()}`
        })
      ]);
      emailResults.forEach((r, i) => {
        if (r.status === "rejected") console.error(`Subscribe email ${i === 0 ? "confirmation" : "notification"} failed:`, r.reason);
      });
    }
    await db.prepare(
      `INSERT INTO rate_limits (ip_address, endpoint) VALUES (?, 'subscribe')`
    ).bind(ip).run();
    const msgNew = language === "th" ? "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E17\u0E35\u0E48\u0E2A\u0E21\u0E31\u0E04\u0E23! \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E43\u0E19\u0E01\u0E25\u0E48\u0E2D\u0E07\u0E08\u0E14\u0E2B\u0E21\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13 \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E01\u0E32\u0E23\u0E2A\u0E21\u0E31\u0E04\u0E23\u0E44\u0E14\u0E49\u0E15\u0E25\u0E2D\u0E14\u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48 mildmate.com/unsubscribe/" : "Thanks for subscribing! Check your inbox for a welcome email. You can unsubscribe anytime at mildmate.com/unsubscribe/.";
    const msgExisting = language === "th" ? "\u0E04\u0E38\u0E13\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E2D\u0E22\u0E39\u0E48\u0E41\u0E25\u0E49\u0E27 \u2014 \u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E01\u0E25\u0E31\u0E1A! \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E01\u0E32\u0E23\u0E2A\u0E21\u0E31\u0E04\u0E23\u0E44\u0E14\u0E49\u0E15\u0E25\u0E2D\u0E14\u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48 mildmate.com/unsubscribe/" : "You're already on our list \u2014 welcome back! Unsubscribe anytime at mildmate.com/unsubscribe/.";
    return new Response(
      JSON.stringify({
        success: true,
        message: isNew ? msgNew : msgExisting,
        email,
        new_subscriber: isNew
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message || "Database error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}
__name(handleSubscribe, "handleSubscribe");

// ../workers/api/unsubscribe.ts
async function handleUnsubscribe(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ message: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ message: "Valid email is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const result = await env.DB.prepare(
      "DELETE FROM subscribers WHERE email = ?"
    ).bind(email).run();
    try {
      await env.DB.prepare(
        "UPDATE contacts SET is_subscribed = 0, sources = TRIM(REPLACE(REPLACE(REPLACE(sources, ',subscribe', ''), 'subscribe,', ''), 'subscribe', ''), ','), last_seen = datetime('now') WHERE email = ?"
      ).bind(email).run();
    } catch (e) {
    }
    const changes = result.meta?.changes ?? 0;
    if (changes === 0) {
      return new Response(
        JSON.stringify({
          message: "If this email was subscribed to MildMate marketing emails, it has been removed."
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
    return new Response(
      JSON.stringify({
        message: "You have been successfully unsubscribed from MildMate marketing emails."
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return new Response(
      JSON.stringify({ message: "Database error. Please try again later." }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}
__name(handleUnsubscribe, "handleUnsubscribe");

// ../workers/api/contact.ts
function isValidEmail2(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
__name(isValidEmail2, "isValidEmail");
async function handleContact(request, env) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const subject = (body.subject || "").trim();
  const message = (body.message || "").trim();
  if (!name || !email || !isValidEmail2(email) || !subject || !message) {
    return new Response(
      JSON.stringify({ error: "All fields are required and email must be valid." }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  const emailBody = `New contact form submission from MildMate website:

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
Sent from: ${request.headers.get("cf-connecting-ip") || "unknown"}
User-Agent: ${request.headers.get("user-agent") || "unknown"}`;
  let emailStatus = "not_sent";
  try {
    const result = await sendEmail(env, {
      to: "contact@mildmate.com",
      replyTo: email,
      subject: `[MildMate Contact] ${subject}`,
      text: emailBody
    });
    if (!result.success) {
      console.error("Contact email failed:", result.error);
      return new Response(
        JSON.stringify({ error: "Failed to send message. Please try again later.", _debug: result.error }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    emailStatus = "sent";
  } catch (e) {
    console.error("Contact email failed:", e.message || e);
    return new Response(
      JSON.stringify({ error: "Email service unavailable. Your message was saved and will be reviewed.", _debug: e.message }),
      { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  return new Response(
    JSON.stringify({
      success: true,
      message: "Thank you! Your message has been sent. We typically reply within 24 hours.",
      _debug_email: emailStatus
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}
__name(handleContact, "handleContact");

// ../workers/api/quote.ts
var QUOTE_RATE_LIMIT = 5;
var QUOTE_RATE_WINDOW = "-1 hour";
async function checkRateLimit(db, ip, endpoint, max) {
  const row = await db.prepare(
    `SELECT COUNT(*) as cnt FROM rate_limits WHERE ip_address = ? AND endpoint = ? AND created_at > datetime('now', ?)`
  ).bind(ip, endpoint, QUOTE_RATE_WINDOW).first();
  return (row?.cnt || 0) >= max;
}
__name(checkRateLimit, "checkRateLimit");
async function handleQuote(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const quoteId = url.searchParams.get("quote_id");
    if (!quoteId) {
      return new Response(JSON.stringify({ error: "Missing quote_id parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      const row = await env.DB.prepare(
        `SELECT quote_id, customer_name, email, product_slug, dimensions, fabric, color,
                status, quoted_price, expires_at, created_at
         FROM custom_quotes
         WHERE quote_id = ?1`
      ).bind(quoteId).first();
      if (!row) {
        return new Response(JSON.stringify({ error: "Quote not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      let dimensions = {};
      try {
        dimensions = typeof row.dimensions === "string" ? JSON.parse(row.dimensions) : row.dimensions;
      } catch {
      }
      let usdRate = 30;
      try {
        const rateRow = await env.DB.prepare(
          "SELECT param_value FROM pricing_params WHERE param_key = 'usd_rate'"
        ).first();
        if (rateRow) {
          const val = parseFloat(rateRow.param_value);
          if (!isNaN(val)) usdRate = val;
        }
      } catch {
      }
      const priceThb = row.quoted_price || null;
      const priceUsd = priceThb ? Math.round(priceThb / usdRate) : null;
      return new Response(JSON.stringify({
        quote_id: row.quote_id,
        customer_name: row.customer_name,
        product_slug: row.product_slug,
        dimensions,
        fabric: row.fabric,
        color: row.color,
        status: row.status,
        quoted_price_thb: priceThb,
        quoted_price_usd: priceUsd,
        expires_at: row.expires_at,
        created_at: row.created_at,
        is_expired: row.expires_at ? /* @__PURE__ */ new Date(row.expires_at + "Z") < /* @__PURE__ */ new Date() : false,
        is_approved: row.status === "approved"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      console.error("Quote GET error:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const body = await request.json();
    const { customer_name, email, address, telephone, product_slug, dimensions, fabric, color, quoted_price_thb, quoted_price_usd, _website } = body;
    if (_website && _website.length > 0) {
      return new Response(JSON.stringify({ success: true, message: "Quote submitted." }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    }
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (await checkRateLimit(env.DB, ip, "quote", QUOTE_RATE_LIMIT)) {
      return new Response(JSON.stringify({
        error: "Too many requests. Please try again later."
      }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!customer_name || !customer_name.trim()) {
      return new Response(JSON.stringify({ error: "Customer name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!product_slug) {
      return new Response(JSON.stringify({ error: "Product is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!dimensions) {
      return new Response(JSON.stringify({ error: "Dimensions are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const now = /* @__PURE__ */ new Date();
    const y = String(now.getFullYear()).slice(2);
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const datePrefix = `QT-${y}${m}${d}`;
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM custom_quotes WHERE quote_id LIKE ?`
    ).bind(`${datePrefix}-%`).first();
    const seq = String((countResult?.cnt || 0) + 1).padStart(3, "0");
    const quoteId = `${datePrefix}-${seq}`;
    const dimsJson = typeof dimensions === "string" ? dimensions : JSON.stringify(dimensions);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = customer_name.trim();
    const cleanAddress = address?.trim() || "\u2014";
    const cleanPhone = telephone?.trim() || "\u2014";
    const cleanFabric = fabric || "\u2014";
    const cleanColor = color || "\u2014";
    const cleanSlug = product_slug;
    await env.DB.prepare(`
      INSERT INTO custom_quotes (quote_id, customer_name, email, address, telephone, product_slug, dimensions, fabric, color, quoted_price, quoted_price_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      quoteId,
      cleanName,
      cleanEmail,
      address?.trim() || null,
      telephone?.trim() || null,
      cleanSlug,
      dimsJson,
      fabric || null,
      color || null,
      quoted_price_thb || null,
      quoted_price_usd || null
    ).run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO subscribers (email, source, language) VALUES (?, 'quote', 'en')`
    ).bind(cleanEmail).run();
    await env.DB.prepare(
      `INSERT INTO rate_limits (ip_address, endpoint) VALUES (?, 'quote')`
    ).bind(ip).run();
    const emailBody = buildQuoteEmail(cleanName, cleanEmail, cleanAddress, cleanPhone, cleanSlug, dimsJson, cleanFabric, cleanColor, quoteId, quoted_price_thb, quoted_price_usd);
    let emailStatus = "not_sent";
    try {
      const emailResult = await sendEmail(env, {
        to: "contact@mildmate.com",
        from: env.QUOTE_FROM_EMAIL || "MildMate <orders@mildmate.com>",
        replyTo: cleanEmail,
        subject: `[Quote Request] ${quoteId} \u2014 ${cleanName} (${cleanSlug})`,
        text: emailBody
      });
      emailStatus = emailResult.success ? "sent" : "failed";
      if (!emailResult.success) {
        console.error("Quote email failed:", emailResult.error);
      }
    } catch (e) {
      emailStatus = "error";
      console.error("Quote email failed:", e.message || e);
    }
    return new Response(JSON.stringify({
      success: true,
      quote_id: quoteId,
      message: `Quote submitted. We'll email ${cleanEmail} within 24 hours.`,
      _debug_email: emailStatus
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Quote API error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleQuote, "handleQuote");
function buildQuoteEmail(name, email, address, phone, slug, dimsJson, fabric, color, quoteId, priceThb, priceUsd) {
  let dimStr = "\u2014";
  let shapeLine = "";
  let areaLine = "";
  try {
    const d = JSON.parse(dimsJson);
    if (d && typeof d === "object") {
      const unit = d.unit || "cm";
      if (d.shape_code || d.shape_name || d.values) {
        const shapeCode = d.shape_code ? String(d.shape_code) : "";
        const shapeName = d.shape_name ? String(d.shape_name) : "";
        if (shapeCode || shapeName) {
          shapeLine = `Boat Mattress Shape: ${shapeCode}${shapeCode && shapeName ? ". " : ""}${shapeName}`.trim();
        }
        if (d.area_cm2 && Number(d.area_cm2) > 0) {
          areaLine = `Top Area: ${Number(d.area_cm2).toLocaleString()} cm\xB2`;
        }
        if (d.values && typeof d.values === "object") {
          const order = ["A", "B", "C", "D", "E", "F", "G", "H", "W", "L", "T"];
          const keys = Object.keys(d.values).sort((a, b) => {
            const ai = order.indexOf(a);
            const bi = order.indexOf(b);
            if (ai === -1 && bi === -1) return a.localeCompare(b);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          });
          dimStr = keys.map((k) => `${k}: ${d.values[k]} ${unit}`).join("\n");
        } else {
          dimStr = JSON.stringify(d);
        }
      } else if (d.w && d.l) {
        dimStr = d.d ? `${d.w} \xD7 ${d.l} \xD7 ${d.d} ${unit}` : `${d.w} \xD7 ${d.l} ${unit}`;
      } else {
        dimStr = JSON.stringify(d);
      }
    }
  } catch {
    dimStr = dimsJson;
  }
  let priceLine = "\u2014";
  if (priceUsd != null && priceUsd > 0) {
    const usd = Number(priceUsd).toFixed(2);
    const thb = priceThb != null ? ` (\u0E3F${priceThb.toLocaleString()})` : "";
    priceLine = `$${usd} USD${thb}`;
  }
  return `New custom quote submitted from MildMate website:

Quote ID: ${quoteId}
Product: ${slug}

\u2501\u2501\u2501 Customer \u2501\u2501\u2501
Name: ${name}
Email: ${email}
Address: ${address}
Telephone: ${phone}

\u2501\u2501\u2501 Order \u2501\u2501\u2501
${shapeLine ? `${shapeLine}
` : ""}Dimensions${dimStr.includes("\n") ? ":" : `: ${dimStr}`}
${dimStr.includes("\n") ? `${dimStr}
` : ""}${areaLine ? `${areaLine}
` : ""}Fabric: ${fabric}
Color: ${color}
Price: ${priceLine}
`;
}
__name(buildQuoteEmail, "buildQuoteEmail");

// ../workers/api/pricing-params.ts
async function handlePricingParams(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "GET" && path === "/api/pricing-params") {
    const { results: params } = await env.DB.prepare(
      "SELECT key, value, label, category FROM pricing_params ORDER BY category, key"
    ).all();
    const { results: rates } = await env.DB.prepare(
      "SELECT currency, rate_per_thb, label, symbol FROM exchange_rates ORDER BY currency"
    ).all();
    const fabricRates = {};
    const margins = {};
    const sewingTiers = [];
    const duvetSewingTiers = [];
    const protectorFabricTiers = [];
    const protectorDepthTiers = [];
    const fixed = {};
    for (const row of params) {
      const k = row.key;
      const v = row.value;
      if (k.startsWith("fabric_rate_")) {
        fabricRates[k.replace("fabric_rate_", "")] = v;
      } else if (k.startsWith("margin_rate_")) {
        margins[k.replace("margin_rate_", "")] = v;
      } else if (k.startsWith("sewing_tier")) {
        if (k.endsWith("_cost")) {
          const tierNum = k.match(/tier(\d+)_cost/)[1];
          const maxKey = `sewing_tier${tierNum}_max`;
          const maxRow = params.find((r) => r.key === maxKey);
          sewingTiers.push({ max: maxRow ? maxRow.value : Infinity, cost: v });
        }
      } else if (k.startsWith("duvet_sewing_tier")) {
        if (k.endsWith("_cost")) {
          const tierNum = k.match(/duvet_sewing_tier(\d+)_cost/)[1];
          const maxKey = `duvet_sewing_tier${tierNum}_max`;
          const maxRow = params.find((r) => r.key === maxKey);
          duvetSewingTiers.push({ max: maxRow ? maxRow.value : Infinity, cost: v });
        }
      } else if (k.startsWith("protector_fabric_tier")) {
        if (k.endsWith("_cost")) {
          const tierNum = k.match(/protector_fabric_tier(\d+)_cost/)[1];
          const maxKey = `protector_fabric_tier${tierNum}_max`;
          const maxRow = params.find((r) => r.key === maxKey);
          protectorFabricTiers.push({ max: maxRow ? maxRow.value : Infinity, cost: v });
        }
      } else if (k.startsWith("protector_depth_tier")) {
        if (k.endsWith("_cost")) {
          const tierNum = k.match(/protector_depth_tier(\d+)_cost/)[1];
          const minKey = `protector_depth_tier${tierNum}_min`;
          const minRow = params.find((r) => r.key === minKey);
          protectorDepthTiers.push({ min: minRow ? minRow.value : 0, cost: v });
        }
      } else {
        fixed[k] = v;
      }
    }
    return new Response(JSON.stringify({
      fabric_rates: fabricRates,
      margins,
      sewing_tiers: sewingTiers.sort((a, b) => a.max - b.max),
      duvet_sewing_tiers: duvetSewingTiers.sort((a, b) => a.max - b.max),
      protector_fabric_tiers: protectorFabricTiers.sort((a, b) => a.max - b.max),
      protector_depth_tiers: protectorDepthTiers.sort((a, b) => a.min - b.min),
      fixed_costs: fixed,
      exchange_rates: rates
    }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }
    });
  }
  if (request.method === "GET" && path === "/api/diy-prices") {
    const product = url.searchParams.get("product") || "";
    let query = "SELECT shape_code, size_key, price_thb, price_usd, label FROM diy_prices";
    const bindings = [];
    if (product) {
      query += " WHERE product_slug = ?";
      bindings.push(product);
    }
    query += " ORDER BY product_slug, shape_code, size_key";
    const { results } = await env.DB.prepare(query).bind(...bindings).all();
    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }
    });
  }
  return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
}
__name(handlePricingParams, "handlePricingParams");

// ../workers/api/clerk-verify.ts
var jwksCache = null;
var CLERK_ISSUER = "https://clerk.kind-joey-29.clerk.accounts.dev";
var JWKS_URL = "https://kind-joey-29.clerk.accounts.dev/.well-known/jwks.json";
var JWKS_CACHE_MS = 3600 * 1e3;
var RATE_WINDOW_MS = 60 * 1e3;
var MAX_AUTH_REQUESTS = 30;
async function checkAuthRateLimit(env, ip) {
  try {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM rate_limits
       WHERE ip_address = ?1 AND endpoint = 'auth'
       AND created_at > datetime('now', '-1 minute')`
    ).bind(ip).first();
    return (row?.cnt || 0) >= MAX_AUTH_REQUESTS;
  } catch {
    return false;
  }
}
__name(checkAuthRateLimit, "checkAuthRateLimit");
async function recordRateLimit(env, ip) {
  try {
    await env.DB.prepare(
      "INSERT INTO rate_limits (ip_address, endpoint) VALUES (?1, 'auth')"
    ).bind(ip).run();
  } catch {
  }
}
__name(recordRateLimit, "recordRateLimit");
async function getJwks() {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_MS) {
    return jwksCache.keys;
  }
  const resp = await fetch(JWKS_URL);
  if (!resp.ok) throw new Error("Failed to fetch JWKS: " + resp.status);
  const data = await resp.json();
  jwksCache = { keys: data.keys || [], fetchedAt: Date.now() };
  return jwksCache.keys;
}
__name(getJwks, "getJwks");
function base64urlToBytes(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(base64urlToBytes, "base64urlToBytes");
async function importRsaKey(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      alg: "RS256",
      ext: false
    },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}
__name(importRsaKey, "importRsaKey");
async function verifyClerkJwt(request, env) {
  const origin = request.headers.get("Origin") || "";
  const host = request.headers.get("Host") || "";
  const allowedOrigins = [
    "https://mildmate-new.pages.dev",
    "https://www.mildmate.com"
  ];
  if (origin && !allowedOrigins.includes(origin) && host !== "localhost" && !host.startsWith("127.0.0.1")) {
    return { valid: false, error: "Invalid origin", status: 403 };
  }
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (await checkAuthRateLimit(env, ip)) {
    return { valid: false, error: "Too many requests", status: 429 };
  }
  await recordRateLimit(env, ip);
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!token) {
    return { valid: false, error: "Missing token", status: 401 };
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Invalid token format", status: 401 };
  }
  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(base64urlToBytes(parts[0])));
  } catch {
    return { valid: false, error: "Invalid token header", status: 401 };
  }
  if (header.alg !== "RS256") {
    return { valid: false, error: "Unsupported algorithm", status: 401 };
  }
  let keys;
  try {
    keys = await getJwks();
  } catch (e) {
    console.error("Clerk JWKS fetch failed:", e.message);
    return { valid: false, error: "Auth service unavailable", status: 503 };
  }
  const jwk = keys.find((k) => k.kid === header.kid && k.alg === "RS256");
  if (!jwk) {
    return { valid: false, error: "Unknown signing key", status: 401 };
  }
  const signedData = new TextEncoder().encode(parts[0] + "." + parts[1]);
  const signature = base64urlToBytes(parts[2]);
  let cryptoKey;
  try {
    cryptoKey = await importRsaKey(jwk);
  } catch {
    return { valid: false, error: "Invalid key", status: 401 };
  }
  let validSig = false;
  try {
    validSig = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signature,
      signedData
    );
  } catch {
    return { valid: false, error: "Signature verification failed", status: 401 };
  }
  if (!validSig) {
    return { valid: false, error: "Invalid signature", status: 401 };
  }
  let payload;
  try {
    const rawPayload = JSON.parse(
      new TextDecoder().decode(base64urlToBytes(parts[1]))
    );
    payload = {
      sub: rawPayload.sub || "",
      email: rawPayload.email || "",
      name: rawPayload.name || "",
      raw: rawPayload,
      exp: rawPayload.exp || 0,
      iat: rawPayload.iat || 0,
      iss: rawPayload.iss || "",
      azp: rawPayload.azp || "",
      sid: rawPayload.sid || ""
    };
  } catch {
    return { valid: false, error: "Invalid token payload", status: 401 };
  }
  const now = Math.floor(Date.now() / 1e3);
  if (payload.exp && payload.exp < now) {
    return { valid: false, error: "Token expired", status: 401 };
  }
  if (payload.iss && payload.iss !== CLERK_ISSUER && !payload.iss.startsWith("https://clerk.") && !payload.iss.includes(".clerk.accounts.dev")) {
    return { valid: false, error: "Invalid issuer", status: 401 };
  }
  return { valid: true, payload };
}
__name(verifyClerkJwt, "verifyClerkJwt");

// ../workers/api/admin-pricing.ts
function getClerkSessionToken(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookieMatch = cookieHeader.match(/__session=([^;]+)/) || cookieHeader.match(/__clerk_db_jwt=([^;]+)/);
  return cookieMatch ? cookieMatch[1] : "";
}
__name(getClerkSessionToken, "getClerkSessionToken");
function collectRoles(raw) {
  if (!raw || typeof raw !== "object") return [];
  const values = [];
  const add = /* @__PURE__ */ __name((v) => {
    if (v !== void 0 && v !== null) values.push(v);
  }, "add");
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
  const out = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}
__name(collectRoles, "collectRoles");
function hasAdminRole(raw) {
  const roles = collectRoles(raw);
  return roles.some(
    (r) => r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin")
  );
}
__name(hasAdminRole, "hasAdminRole");
function emailAllowed(email, env) {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
__name(emailAllowed, "emailAllowed");
function getPrimaryClerkEmail(user) {
  if (!user || typeof user !== "object") return "";
  const list = Array.isArray(user.email_addresses) ? user.email_addresses : [];
  const primaryId = user.primary_email_address_id;
  const primary = list.find((e) => e && e.id === primaryId);
  return String(primary?.email_address || list[0]?.email_address || "").trim().toLowerCase();
}
__name(getPrimaryClerkEmail, "getPrimaryClerkEmail");
async function isClerkAdmin(request, env) {
  try {
    const authHeader = request.headers.get("Authorization") || "";
    const hasBearer = authHeader.startsWith("Bearer ");
    const token = hasBearer ? authHeader.slice(7).trim() : getClerkSessionToken(request);
    if (!token) return false;
    const verifyReq = new Request(request.url, {
      method: request.method,
      headers: new Headers({
        ...Object.fromEntries(request.headers.entries()),
        Authorization: `Bearer ${token}`
      })
    });
    const verified = await verifyClerkJwt(verifyReq, env);
    if (!verified.valid) return false;
    const raw = verified.payload.raw || {};
    const email = String(verified.payload.email || "").trim().toLowerCase();
    if (hasAdminRole(raw) || emailAllowed(email, env)) return true;
    const sub = String(verified.payload.sub || "").trim();
    const clerkKey = String(env.CLERK_SECRET_KEY || "").trim();
    if (!sub || !clerkKey) return false;
    const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
      headers: { Authorization: "Bearer " + clerkKey }
    });
    if (!clerkResp.ok) return false;
    const user = await clerkResp.json();
    const clerkEmail = getPrimaryClerkEmail(user);
    const metadataRaw = {
      role: user?.public_metadata?.role,
      roles: user?.public_metadata?.roles,
      org_role: user?.public_metadata?.org_role,
      orgRole: user?.public_metadata?.orgRole,
      public_metadata: user?.public_metadata || {},
      unsafe_metadata: user?.unsafe_metadata || {},
      metadata: user?.private_metadata || {}
    };
    return emailAllowed(clerkEmail, env) || hasAdminRole(metadataRaw);
  } catch {
    return false;
  }
}
__name(isClerkAdmin, "isClerkAdmin");
async function handleAdminPricingParams(request, env) {
  const host = new URL(request.url).hostname;
  const isDev = host.includes("pages.dev") || host === "localhost" || host.startsWith("127.0.0.1");
  if (!isDev) {
    const clerkOk = await isClerkAdmin(request, env);
    if (!clerkOk) {
      const provided = (request.headers.get("X-Admin-Secret") || "").trim();
      const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
      if (!provided) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (configured && provided !== configured) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  }
  if (request.method === "POST" || request.method === "PUT") {
    try {
      const body = await request.json();
      const { key, value, label, category } = body;
      if (!key || value === void 0) {
        return new Response(JSON.stringify({ error: "key and value are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      await env.DB.prepare(
        `INSERT INTO pricing_params (key, value, label, category)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(key) DO UPDATE SET value = ?2, label = ?3, category = ?4, updated_at = datetime('now')`
      ).bind(key, value, label || key, category || "fixed").run();
      return new Response(JSON.stringify({
        success: true,
        key,
        value,
        message: "Param saved to D1"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return new Response(JSON.stringify({ error: "?key= required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    await env.DB.prepare("DELETE FROM pricing_params WHERE key = ?1").bind(key).run();
    return new Response(JSON.stringify({ success: true, key, message: "Deleted from D1" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleAdminPricingParams, "handleAdminPricingParams");

// ../workers/api/admin-diy.ts
async function handleAdminDiyPrices(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Secret"
      }
    });
  }
  const host = new URL(request.url).hostname;
  const isDev = host.includes("pages.dev") || host === "localhost" || host.startsWith("127.0.0.1");
  if (!isDev) {
    const provided = (request.headers.get("X-Admin-Secret") || "").trim();
    const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
    if (!provided) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    if (configured && provided !== configured) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
  if (request.method === "POST" || request.method === "PUT") {
    try {
      const body = await request.json();
      const { id, product_slug, shape_code, size_key, price_thb, price_usd, label } = body;
      if (!product_slug || price_thb === void 0 || price_usd === void 0) {
        return new Response(JSON.stringify({ error: "product_slug, price_thb, price_usd are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
      await env.DB.prepare(
        `INSERT INTO diy_prices (id, product_slug, shape_code, size_key, price_thb, price_usd, label, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           product_slug = ?2, shape_code = ?3, size_key = ?4,
           price_thb = ?5, price_usd = ?6, label = ?7, updated_at = datetime('now')`
      ).bind(id || null, product_slug, shape_code || null, size_key || null, price_thb, price_usd, label || null).run();
      return new Response(JSON.stringify({ success: true, product_slug, shape_code, message: "DIY price saved to D1" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const product = url.searchParams.get("product");
    const shape = url.searchParams.get("shape_code");
    if (id) {
      await env.DB.prepare("DELETE FROM diy_prices WHERE id = ?1").bind(id).run();
    } else if (product && shape) {
      await env.DB.prepare("DELETE FROM diy_prices WHERE product_slug = ?1 AND shape_code = ?2").bind(product, shape).run();
    } else {
      return new Response(JSON.stringify({ error: "?id= or ?product=&shape_code= required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    return new Response(JSON.stringify({ success: true, message: "Deleted from D1" }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
__name(handleAdminDiyPrices, "handleAdminDiyPrices");

// ../workers/api/admin-exchange.ts
function isProductionHost(host) {
  return host === "www.mildmate.com" || host === "mildmate.com";
}
__name(isProductionHost, "isProductionHost");
function isDevHost(host) {
  return host.includes("pages.dev") || host === "localhost" || host.startsWith("127.0.0.1");
}
__name(isDevHost, "isDevHost");
function authorizeAdmin(request, env) {
  const host = new URL(request.url).hostname;
  if (isDevHost(host)) return { ok: true };
  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const prodHost = isProductionHost(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }
  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}
__name(authorizeAdmin, "authorizeAdmin");
async function handleAdminExchangeRates(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Secret"
      }
    });
  }
  const auth = authorizeAdmin(request, env);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error || "Unauthorized" }), {
      status: auth.status || 401,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
  if (request.method === "POST" || request.method === "PUT") {
    try {
      const body = await request.json();
      const { currency, rate_per_thb, label, symbol } = body;
      if (!currency || rate_per_thb === void 0) {
        return new Response(JSON.stringify({ error: "currency and rate_per_thb are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
      await env.DB.prepare(
        `INSERT INTO exchange_rates (currency, rate_per_thb, label, symbol, updated_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(currency) DO UPDATE SET
           rate_per_thb = ?2, label = ?3, symbol = ?4, updated_at = datetime('now')`
      ).bind(currency.toUpperCase(), rate_per_thb, label || currency, symbol || "").run();
      return new Response(JSON.stringify({ success: true, currency, message: "Exchange rate saved to D1" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
__name(handleAdminExchangeRates, "handleAdminExchangeRates");

// ../workers/api/admin-products.ts
var R2_PUBLIC_BASE3 = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";
function toR2Url2(url) {
  if (!url) return url;
  if (url.startsWith("/r2/")) return `${R2_PUBLIC_BASE3}${url.slice(3)}`;
  return url;
}
__name(toR2Url2, "toR2Url");
function r2Product2(p) {
  const out = { ...p, image_url: toR2Url2(p.image_url) };
  if (out.images && typeof out.images === "string") {
    try {
      const arr = JSON.parse(out.images);
      out.images = JSON.stringify(arr.map(toR2Url2));
    } catch (_) {
    }
  }
  return out;
}
__name(r2Product2, "r2Product");
function parseCategoryCsv(csv) {
  const parts = csv.split(",").map((s) => s.trim()).filter(Boolean);
  const product_type = parts[0] || "sheets";
  const niches = parts.slice(1).join(", ");
  return { product_type, niches };
}
__name(parseCategoryCsv, "parseCategoryCsv");
function isProductionHost2(hostname) {
  if (!hostname) return false;
  const host = hostname.toLowerCase().split(":")[0];
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (host.endsWith(".pages.dev")) return false;
  if (host.endsWith(".local")) return false;
  return host === "www.mildmate.com" || host === "mildmate.com";
}
__name(isProductionHost2, "isProductionHost");
var ADMIN_SECRET_ERROR = JSON.stringify({ error: "Unauthorized" });
function collectRoles2(raw) {
  if (!raw || typeof raw !== "object") return [];
  const values = [];
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
  const out = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}
__name(collectRoles2, "collectRoles");
function hasAdminRole2(rawClaims) {
  const roles = collectRoles2(rawClaims);
  return roles.some(
    (r) => r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin")
  );
}
__name(hasAdminRole2, "hasAdminRole");
function emailAllowed2(email, env) {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
__name(emailAllowed2, "emailAllowed");
async function authCheck(request, env) {
  const hostname = request.headers.get("Host") || "";
  const prodHost = isProductionHost2(hostname);
  if (!prodHost) return true;
  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const verified = await verifyClerkJwt(request, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole2(raw) || emailAllowed2(verified.payload.email || "", env)) return true;
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find((e) => e.id === user.primary_email_address_id)?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed2(email, env) || hasAdminRole2(metadata)) return true;
          }
        } catch {
        }
      }
    }
  }
  const provided = (request.headers.get("X-Admin-Secret") || "").trim();
  const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!provided) return false;
  if (!configured) return false;
  return provided === configured;
}
__name(authCheck, "authCheck");
async function handleAdminProducts(request, env) {
  if (!await authCheck(request, env)) {
    return new Response(ADMIN_SECRET_ERROR, {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  const method = request.method;
  if (method === "GET" && path === "/api/admin/products") {
    const db = env.DB;
    const result = await db.prepare(
      `SELECT id, slug, title_en, title_th, description_en, description_th, card_benefit_en, card_benefit_th,
              category, product_type, niches, subcategory, fabric_options, base_price_usd, base_price_thb,
              is_custom, image_url, tags, youtube_url, images, sort_order, is_active
       FROM products ORDER BY sort_order, id`
    ).all();
    return new Response(JSON.stringify((result.results || []).map(r2Product2)), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (method === "POST" && path === "/api/admin/products") {
    const db = env.DB;
    try {
      const body = await request.json();
      const slug = body.slug;
      if (!slug) {
        return new Response(JSON.stringify({ error: "Slug is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      const dup = await db.prepare("SELECT id FROM products WHERE slug = ?").bind(slug).first();
      if (dup) {
        return new Response(JSON.stringify({ error: "Slug already exists" }), { status: 409, headers: { "Content-Type": "application/json" } });
      }
      const { product_type, niches } = parseCategoryCsv(body.category || "sheets");
      const placeholderImage = "/images/products/mattress-protector-standard/main.jpg";
      await db.prepare(
        `INSERT INTO products (slug, title_en, title_th, description_en, description_th, card_benefit_en, card_benefit_th, category, product_type, niches, fabric_options, image_url, youtube_url, images, tags, is_custom, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 99)`
      ).bind(
        slug,
        body.title_en || body.titleEN || slug,
        body.title_th || body.titleTH || null,
        body.description_en || body.descEN || null,
        body.description_th || body.descTH || null,
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
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
  }
  const slugMatch = path.match(/^\/api\/admin\/products\/(.+)$/);
  if (slugMatch && method === "GET") {
    const slug = slugMatch[1];
    const db = env.DB;
    const result = await db.prepare(
      `SELECT * FROM products WHERE slug = ?`
    ).bind(slug).first();
    if (!result) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify(r2Product2(result)), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (slugMatch && method === "PUT") {
    const slug = slugMatch[1];
    const db = env.DB;
    const existing = await db.prepare(
      `SELECT id FROM products WHERE slug = ?`
    ).bind(slug).first();
    if (!existing) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      const body = await request.json();
      const allowed = [
        "title_en",
        "title_th",
        "description_en",
        "description_th",
        "card_benefit_en",
        "card_benefit_th",
        "tags",
        "youtube_url",
        "images",
        "image_url",
        "fabric_options",
        "category",
        "product_type",
        "niches"
      ];
      const sets = [];
      const values = [];
      for (const field of allowed) {
        if (body[field] !== void 0) {
          sets.push(`${field} = ?`);
          values.push(body[field]);
        }
      }
      if (body.category !== void 0 && body.product_type === void 0 && body.niches === void 0) {
        const parsed = parseCategoryCsv(body.category);
        sets.push("product_type = ?");
        values.push(parsed.product_type);
        sets.push("niches = ?");
        values.push(parsed.niches);
      }
      if (sets.length === 0) {
        return new Response(JSON.stringify({ error: "No valid fields to update" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
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
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleAdminProducts, "handleAdminProducts");

// ../workers/api/admin-upload.ts
function collectRoles3(raw) {
  if (!raw || typeof raw !== "object") return [];
  const values = [];
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
  const out = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}
__name(collectRoles3, "collectRoles");
function hasAdminRole3(rawClaims) {
  const roles = collectRoles3(rawClaims);
  return roles.some(
    (r) => r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin")
  );
}
__name(hasAdminRole3, "hasAdminRole");
function emailAllowed3(email, env) {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
__name(emailAllowed3, "emailAllowed");
async function authCheck2(request, env) {
  const host = String(request.headers.get("Host") || "").toLowerCase().split(":")[0];
  const isProdHost = host === "www.mildmate.com" || host === "mildmate.com";
  if (!isProdHost) return true;
  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const verified = await verifyClerkJwt(request, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole3(raw) || emailAllowed3(verified.payload.email || "", env)) return true;
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find((e) => e.id === user.primary_email_address_id)?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed3(email, env) || hasAdminRole3(metadata)) return true;
          }
        } catch {
        }
      }
    }
  }
  const provided = (request.headers.get("X-Admin-Secret") || "").trim();
  const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!provided || !configured) return false;
  return provided === configured;
}
__name(authCheck2, "authCheck");
async function handleAdminUpload(request, env) {
  if (!await authCheck2(request, env)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing key parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!key.startsWith("products/")) {
      return new Response(JSON.stringify({ error: "Invalid key prefix" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      const bucket = env.MILDMATE_ASSETS;
      await bucket.delete(key);
      return new Response(JSON.stringify({ success: true, key, message: "Deleted from R2" }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 5MB` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : file.type === "image/gif" ? "gif" : "jpg";
    const key = `products/uploads/${timestamp}-${random}.${ext}`;
    const bucket = env.MILDMATE_ASSETS;
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: file.type }
    });
    const R2_PUBLIC_BASE8 = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";
    const publicUrl = `${R2_PUBLIC_BASE8}/${key}`;
    return new Response(JSON.stringify({
      success: true,
      url: publicUrl,
      cdnUrl: publicUrl,
      key,
      size: file.size,
      type: file.type,
      message: "File uploaded to R2"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleAdminUpload, "handleAdminUpload");

// ../workers/api/admin-orders.ts
var orderShippingSchemaReady = false;
var orderShippingSchemaPromise = null;
var TRACKING_URL_BY_CARRIER = {
  thaipost: "https://track.thailandpost.co.th",
  flash: "https://www.flashexpress.co.th/fle/tracking",
  dhl: "https://www.dhl.com/us-en/home.html",
  ups: "https://www.ups.com/track?TypeOfInquiryNumber=T&InquiryNumber1={TRACKING}",
  fedex: "https://www.fedex.com/en-us/tracking.html",
  usps: "https://tools.usps.com/tracking/{TRACKING}"
};
var CARRIER_ALIAS = {
  thailandpost: "thaipost",
  "thailand post": "thaipost",
  thai: "thaipost",
  "thai post": "thaipost",
  flashexpress: "flash",
  "flash express": "flash",
  dhlexpress: "dhl",
  "dhl express": "dhl",
  unitedparcelservice: "ups",
  "united parcel service": "ups",
  fedexexpress: "fedex",
  "fed ex": "fedex",
  unitedstatespostalservice: "usps",
  "united states postal service": "usps"
};
function json2(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(json2, "json");
async function ensureOrderShippingSchema(env) {
  if (orderShippingSchemaReady) return;
  if (!orderShippingSchemaPromise) {
    orderShippingSchemaPromise = (async () => {
      const tableInfo = await env.DB.prepare("PRAGMA table_info(orders)").all();
      const existing = new Set(
        (tableInfo.results || []).map((r) => String(r.name || "").toLowerCase())
      );
      const alters = [];
      if (!existing.has("carrier_code")) alters.push("ALTER TABLE orders ADD COLUMN carrier_code TEXT");
      if (!existing.has("tracking_number")) alters.push("ALTER TABLE orders ADD COLUMN tracking_number TEXT");
      if (!existing.has("tracking_url")) alters.push("ALTER TABLE orders ADD COLUMN tracking_url TEXT");
      if (!existing.has("shipping_status")) alters.push("ALTER TABLE orders ADD COLUMN shipping_status TEXT");
      if (!existing.has("shipped_at")) alters.push("ALTER TABLE orders ADD COLUMN shipped_at DATETIME");
      for (const sql of alters) await env.DB.prepare(sql).run();
      orderShippingSchemaReady = true;
    })().finally(() => {
      if (!orderShippingSchemaReady) orderShippingSchemaPromise = null;
    });
  }
  await orderShippingSchemaPromise;
}
__name(ensureOrderShippingSchema, "ensureOrderShippingSchema");
function normalizeCarrier(raw) {
  const v = String(raw || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!v) return "";
  if (TRACKING_URL_BY_CARRIER[v]) return v;
  const compact = v.replace(/\s+/g, "");
  if (TRACKING_URL_BY_CARRIER[compact]) return compact;
  return CARRIER_ALIAS[v] || CARRIER_ALIAS[compact] || compact;
}
__name(normalizeCarrier, "normalizeCarrier");
function buildTrackingUrl(carrierCode, trackingNumber) {
  const tpl = TRACKING_URL_BY_CARRIER[carrierCode];
  if (!tpl) return "";
  return tpl.replace("{TRACKING}", encodeURIComponent(trackingNumber));
}
__name(buildTrackingUrl, "buildTrackingUrl");
function carrierLabel(carrierCode) {
  const labels = {
    thaipost: "Thailand Post",
    flash: "Flash Express",
    dhl: "DHL",
    ups: "UPS",
    fedex: "FedEx",
    usps: "USPS"
  };
  return labels[carrierCode] || carrierCode.toUpperCase();
}
__name(carrierLabel, "carrierLabel");
function isProductionHost3(hostname) {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}
__name(isProductionHost3, "isProductionHost");
function collectRoles4(raw) {
  if (!raw || typeof raw !== "object") return [];
  const values = [];
  const add = /* @__PURE__ */ __name((v) => {
    if (v !== void 0 && v !== null) values.push(v);
  }, "add");
  add(raw.role);
  add(raw.roles);
  add(raw.org_role);
  add(raw.orgRole);
  add(raw.public_metadata?.role);
  add(raw.public_metadata?.roles);
  add(raw.unsafe_metadata?.role);
  add(raw.unsafe_metadata?.roles);
  add(raw.metadata?.role);
  add(raw.metadata?.roles);
  add(raw["https://mildmate.com/role"]);
  add(raw["https://mildmate.com/roles"]);
  const out = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}
__name(collectRoles4, "collectRoles");
function hasAdminRole4(rawClaims) {
  const roles = collectRoles4(rawClaims);
  return roles.some(
    (r) => r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin")
  );
}
__name(hasAdminRole4, "hasAdminRole");
function emailAllowed4(email, env) {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
__name(emailAllowed4, "emailAllowed");
async function authorizeAdmin2(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");
  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (!verified.valid) {
    } else {
      const raw = verified.payload.raw || {};
      if (hasAdminRole4(raw) || emailAllowed4(verified.payload.email || "", env)) {
        return { ok: true };
      }
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find(function(e) {
              return e.id === user.primary_email_address_id;
            })?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed4(email, env)) return { ok: true };
            if (hasAdminRole4(metadata)) return { ok: true };
          }
        } catch (e) {
          console.error("Clerk API lookup failed:", e?.message || e);
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
  }
  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost3(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }
  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}
__name(authorizeAdmin2, "authorizeAdmin");
async function handleAdminOrders(request, env) {
  const auth = await authorizeAdmin2(request, env);
  if (!auth.ok) return json2({ error: auth.error }, auth.status);
  try {
    await ensureOrderShippingSchema(env);
  } catch (e) {
    console.error("orders shipping schema init failed:", e?.message || e);
    return json2({ error: "Orders schema unavailable" }, 500);
  }
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  const method = request.method;
  if (method === "GET" && path === "/api/admin/orders") {
    const db = env.DB;
    const result = await db.prepare(
      `SELECT id, stripe_session_id, stripe_payment_intent_id,
              email, customer_name, phone, shipping_address,
              product_slug, product_title_en, fabric, color,
              width_cm, length_cm, depth_cm,
              width_in, length_in, depth_in,
              custom_notes, price_usd, price_thb, currency,
              status, created_at,
              carrier_code, tracking_number, tracking_url,
              shipping_status, shipped_at
       FROM orders
       ORDER BY created_at DESC`
    ).all();
    return json2({ orders: result.results });
  }
  const idMatch = path.match(/^\/api\/admin\/orders\/(\d+)$/);
  if (method === "GET" && idMatch) {
    const orderId = parseInt(idMatch[1]);
    const db = env.DB;
    const result = await db.prepare(
      `SELECT id, stripe_session_id, stripe_payment_intent_id,
              email, customer_name, phone, shipping_address,
              product_slug, product_title_en, fabric, color,
              width_cm, length_cm, depth_cm,
              width_in, length_in, depth_in,
              custom_notes, price_usd, price_thb, currency,
              status, created_at,
              carrier_code, tracking_number, tracking_url,
              shipping_status, shipped_at
       FROM orders
       WHERE id = ?`
    ).bind(orderId).first();
    if (!result) {
      return json2({ error: "Order not found" }, 404);
    }
    return json2({ order: result });
  }
  if (method === "PUT" && idMatch) {
    const orderId = parseInt(idMatch[1]);
    const body = await request.json();
    const newStatus = body.status;
    if (!newStatus) {
      return json2({ error: "status field required" }, 400);
    }
    const validStatuses = ["pending", "production", "shipped", "cancelled", "confirmed"];
    if (validStatuses.indexOf(newStatus) === -1) {
      return json2({ error: "Invalid status. Must be one of: " + validStatuses.join(", ") }, 400);
    }
    const db = env.DB;
    const currentOrder = await db.prepare(
      `SELECT id, stripe_session_id, email, customer_name, product_title_en
       FROM orders
       WHERE id = ?1`
    ).bind(orderId).first();
    if (!currentOrder) {
      return json2({ error: "Order not found" }, 404);
    }
    if (newStatus === "shipped") {
      const carrierCode = normalizeCarrier(body.carrier_code);
      const trackingNumber = String(body.tracking_number || "").trim();
      if (!carrierCode || !TRACKING_URL_BY_CARRIER[carrierCode]) {
        return json2({ error: "carrier_code is required for shipped status" }, 400);
      }
      if (!trackingNumber) {
        return json2({ error: "tracking_number is required for shipped status" }, 400);
      }
      const trackingUrl = String(body.tracking_url || "").trim() || buildTrackingUrl(carrierCode, trackingNumber);
      const shippingStatus = String(body.shipping_status || "in_transit").trim().toLowerCase();
      const shippedAt = String(body.shipped_at || "").trim() || (/* @__PURE__ */ new Date()).toISOString();
      await db.prepare(
        `UPDATE orders
         SET status = ?1,
             carrier_code = ?2,
             tracking_number = ?3,
             tracking_url = ?4,
             shipping_status = ?5,
             shipped_at = ?6
         WHERE id = ?7`
      ).bind(newStatus, carrierCode, trackingNumber, trackingUrl, shippingStatus, shippedAt, orderId).run();
      if (currentOrder.email && env.RESEND_API_KEY) {
        const orderCode = String(currentOrder.stripe_session_id || orderId).slice(-8);
        const customerName = String(currentOrder.customer_name || "").trim();
        const greeting = customerName ? `Hi ${customerName},` : "Hi,";
        const productLine = currentOrder.product_title_en ? `Item: ${currentOrder.product_title_en}
` : "";
        const trackingLine = `${carrierLabel(carrierCode)}: ${trackingNumber}`;
        const emailText = `${greeting}

Great news \u2014 your MildMate order #${orderCode} has shipped.

${productLine}Tracking: ${trackingLine}
Track package: ${trackingUrl}

Thank you for shopping with MildMate.`;
        try {
          await sendEmail(env, {
            to: String(currentOrder.email),
            subject: `Your order has shipped \u2014 MildMate #${orderCode}`,
            text: emailText
          });
        } catch (e) {
          console.error("Shipped email failed:", e?.message || e);
        }
      }
      return json2({
        ok: true,
        id: orderId,
        status: newStatus,
        carrier_code: carrierCode,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl,
        shipping_status: shippingStatus,
        shipped_at: shippedAt
      });
    }
    await db.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(newStatus, orderId).run();
    return json2({ ok: true, id: orderId, status: newStatus });
  }
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret, Authorization"
      }
    });
  }
  return json2({ error: "Method not allowed" }, 405);
}
__name(handleAdminOrders, "handleAdminOrders");

// ../workers/api/admin-customers.ts
function json3(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(json3, "json");
function isProductionHost4(hostname) {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}
__name(isProductionHost4, "isProductionHost");
function collectRoles5(raw) {
  if (!raw || typeof raw !== "object") return [];
  const values = [];
  const add = /* @__PURE__ */ __name((v) => {
    if (v !== void 0 && v !== null) values.push(v);
  }, "add");
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
  const out = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}
__name(collectRoles5, "collectRoles");
function hasAdminRole5(rawClaims) {
  const roles = collectRoles5(rawClaims);
  return roles.some(
    (r) => r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin")
  );
}
__name(hasAdminRole5, "hasAdminRole");
function emailAllowed5(email, env) {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
__name(emailAllowed5, "emailAllowed");
async function authorizeAdmin3(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");
  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole5(raw) || emailAllowed5(verified.payload.email || "", env)) {
        return { ok: true };
      }
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find(function(e) {
              return e.id === user.primary_email_address_id;
            })?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed5(email, env)) return { ok: true };
            if (hasAdminRole5(metadata)) return { ok: true };
          }
        } catch (e) {
          console.error("Clerk API lookup failed:", e?.message || e);
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
  }
  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost4(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }
  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}
__name(authorizeAdmin3, "authorizeAdmin");
async function handleAdminCustomers(request, env) {
  const auth = await authorizeAdmin3(request, env);
  if (!auth.ok) return json3({ error: auth.error }, auth.status);
  const url = new URL(request.url);
  const method = request.method;
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret, Authorization"
      }
    });
  }
  if (method !== "GET") {
    return json3({ error: "Method not allowed" }, 405);
  }
  const db = env.DB;
  const emailFilter = (url.searchParams.get("email") || "").trim().toLowerCase();
  if (emailFilter) {
    const result2 = await db.prepare(
      `SELECT id, stripe_session_id,
              email, customer_name, phone, shipping_address,
              product_slug, product_title_en, fabric, color,
              width_cm, length_cm, depth_cm,
              width_in, length_in, depth_in,
              price_usd, price_thb, currency,
              status, created_at
       FROM orders
       WHERE LOWER(email) = ?
       ORDER BY created_at DESC`
    ).bind(emailFilter).all();
    return json3({ orders: result2.results });
  }
  const result = await db.prepare(
    `SELECT
       LOWER(email) as email,
       (
         SELECT o2.customer_name
         FROM orders o2
         WHERE LOWER(o2.email) = LOWER(o1.email)
         ORDER BY datetime(o2.created_at) DESC, o2.id DESC
         LIMIT 1
       ) as customer_name,
       (
         SELECT o2.phone
         FROM orders o2
         WHERE LOWER(o2.email) = LOWER(o1.email)
         ORDER BY datetime(o2.created_at) DESC, o2.id DESC
         LIMIT 1
       ) as phone,
       (
         SELECT o2.shipping_address
         FROM orders o2
         WHERE LOWER(o2.email) = LOWER(o1.email)
         ORDER BY datetime(o2.created_at) DESC, o2.id DESC
         LIMIT 1
       ) as shipping_address,
       COUNT(*) as order_count,
       SUM(COALESCE(price_thb, 0)) as total_thb,
       SUM(COALESCE(price_usd, 0)) as total_usd,
       (
         SELECT o2.currency
         FROM orders o2
         WHERE LOWER(o2.email) = LOWER(o1.email)
         ORDER BY datetime(o2.created_at) DESC, o2.id DESC
         LIMIT 1
       ) as last_currency,
       MAX(created_at) as last_order,
       MIN(created_at) as first_order
     FROM orders o1
     GROUP BY LOWER(email)
     ORDER BY last_order DESC`
  ).all();
  return json3({ customers: result.results });
}
__name(handleAdminCustomers, "handleAdminCustomers");

// ../workers/api/admin-stats.ts
function json4(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(json4, "json");
function isProductionHost5(hostname) {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}
__name(isProductionHost5, "isProductionHost");
function collectRoles6(raw) {
  if (!raw || typeof raw !== "object") return [];
  const values = [];
  const add = /* @__PURE__ */ __name((v) => {
    if (v !== void 0 && v !== null) values.push(v);
  }, "add");
  add(raw.role);
  add(raw.roles);
  add(raw.org_role);
  add(raw.orgRole);
  add(raw.public_metadata?.role);
  add(raw.public_metadata?.roles);
  add(raw.unsafe_metadata?.role);
  add(raw.unsafe_metadata?.roles);
  add(raw.metadata?.role);
  add(raw.metadata?.roles);
  add(raw["https://mildmate.com/role"]);
  add(raw["https://mildmate.com/roles"]);
  const out = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}
__name(collectRoles6, "collectRoles");
function hasAdminRole6(rawClaims) {
  const roles = collectRoles6(rawClaims);
  return roles.some(
    (r) => r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin")
  );
}
__name(hasAdminRole6, "hasAdminRole");
function emailAllowed6(email, env) {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
__name(emailAllowed6, "emailAllowed");
async function authorizeAdmin4(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");
  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (!verified.valid) {
    } else {
      const raw = verified.payload.raw || {};
      if (hasAdminRole6(raw) || emailAllowed6(verified.payload.email || "", env)) {
        return { ok: true };
      }
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find(function(e) {
              return e.id === user.primary_email_address_id;
            })?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed6(email, env)) return { ok: true };
            if (hasAdminRole6(metadata)) return { ok: true };
          }
        } catch (e) {
          console.error("Clerk API lookup failed:", e?.message || e);
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
  }
  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost5(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }
  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}
__name(authorizeAdmin4, "authorizeAdmin");
function isoAtUtcDayStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  return d.toISOString();
}
__name(isoAtUtcDayStart, "isoAtUtcDayStart");
function addUtcDays(iso, days) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}
__name(addUtcDays, "addUtcDays");
function normalizePeriod(raw) {
  const p = String(raw || "").trim().toLowerCase();
  const aliases = {
    today: "today",
    yesterday: "yesterday",
    "last-7-days": "last-7-days",
    "last7": "last-7-days",
    "7d": "last-7-days",
    "last-30-days": "last-30-days",
    "last30": "last-30-days",
    "30d": "last-30-days",
    "last-60-days": "last-60-days",
    "last60": "last-60-days",
    "60d": "last-60-days",
    "last-90-days": "last-90-days",
    "last90": "last-90-days",
    "90d": "last-90-days",
    "all-time": "all-time",
    all: "all-time"
  };
  return aliases[p] || "last-30-days";
}
__name(normalizePeriod, "normalizePeriod");
function getPeriodBounds(rawPeriod) {
  const normalized = normalizePeriod(rawPeriod);
  const now = /* @__PURE__ */ new Date();
  const todayStart = isoAtUtcDayStart(now);
  if (normalized === "all-time") return { normalized, start: null, end: null };
  if (normalized === "today") return { normalized, start: todayStart, end: addUtcDays(todayStart, 1) };
  if (normalized === "yesterday") return { normalized, start: addUtcDays(todayStart, -1), end: todayStart };
  const daysMap = {
    "last-7-days": 7,
    "last-30-days": 30,
    "last-60-days": 60,
    "last-90-days": 90
  };
  const days = daysMap[normalized] || 30;
  return { normalized, start: addUtcDays(todayStart, -(days - 1)), end: addUtcDays(todayStart, 1) };
}
__name(getPeriodBounds, "getPeriodBounds");
function getDisplayImage(imageUrl, imagesRaw) {
  const direct = String(imageUrl || "").trim();
  if (direct) return direct;
  try {
    const arr = JSON.parse(String(imagesRaw || "[]"));
    if (Array.isArray(arr)) {
      const first = arr.find((x) => String(x || "").trim());
      if (first) return String(first).trim();
    }
  } catch {
  }
  return "";
}
__name(getDisplayImage, "getDisplayImage");
function toNumber(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}
__name(toNumber, "toNumber");
function convertRevenue(revenueThb, revenueUsd, targetCurrency, usdRatePerThb, targetRatePerThb) {
  const target = String(targetCurrency || "USD").toUpperCase();
  if (target === "USD") return revenueUsd + revenueThb * usdRatePerThb;
  if (target === "THB") return revenueThb + (usdRatePerThb > 0 ? revenueUsd / usdRatePerThb : 0);
  const totalThb = revenueThb + (usdRatePerThb > 0 ? revenueUsd / usdRatePerThb : 0);
  return totalThb * targetRatePerThb;
}
__name(convertRevenue, "convertRevenue");
function currencySymbol(currency, ratesMap) {
  const c = String(currency || "USD").toUpperCase();
  if (c === "USD") return "$";
  if (c === "THB") return "\u0E3F";
  return ratesMap[c]?.symbol || c;
}
__name(currencySymbol, "currencySymbol");
async function handleAdminStats(request, env) {
  const auth = await authorizeAdmin4(request, env);
  if (!auth.ok) return json4({ error: auth.error }, auth.status);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret, Authorization"
      }
    });
  }
  if (request.method !== "GET") {
    return json4({ error: "Method not allowed" }, 405);
  }
  const url = new URL(request.url);
  const targetCurrency = String(url.searchParams.get("target_currency") || "USD").trim().toUpperCase();
  const bounds = getPeriodBounds(url.searchParams.get("period") || "last-30-days");
  try {
    const db = env.DB;
    const ratesRes = await db.prepare(
      `SELECT currency, rate_per_thb, label, symbol
       FROM exchange_rates
       ORDER BY currency ASC`
    ).all();
    const ratesRows = ratesRes.results || [];
    const ratesMap = {};
    ratesRows.forEach((r) => {
      const c = String(r.currency || "").toUpperCase();
      if (!c) return;
      ratesMap[c] = {
        rate_per_thb: toNumber(r.rate_per_thb),
        label: String(r.label || c),
        symbol: String(r.symbol || "")
      };
    });
    const usdRatePerThb = ratesMap.USD?.rate_per_thb || 0.033;
    const targetRatePerThb = targetCurrency === "USD" ? usdRatePerThb : targetCurrency === "THB" ? 1 : ratesMap[targetCurrency]?.rate_per_thb || 0;
    if (targetCurrency !== "USD" && targetCurrency !== "THB" && !targetRatePerThb) {
      return json4({ error: "Unknown target_currency. Configure it in exchange_rates first." }, 400);
    }
    const listRes = await db.prepare(
      `SELECT
         p.id AS product_id,
         p.slug,
         p.title_en,
         p.image_url,
         p.images,
         COALESCE((
           SELECT COUNT(*)
           FROM favorites f
           WHERE f.product_id = p.id
             AND (?1 IS NULL OR datetime(f.created_at) >= datetime(?1))
             AND (?2 IS NULL OR datetime(f.created_at) < datetime(?2))
         ), 0) AS favorites_count,
         COALESCE((
           SELECT COUNT(*)
           FROM orders o
           WHERE o.product_slug = p.slug
             AND LOWER(COALESCE(o.status, '')) != 'cancelled'
             AND (?1 IS NULL OR datetime(o.created_at) >= datetime(?1))
             AND (?2 IS NULL OR datetime(o.created_at) < datetime(?2))
         ), 0) AS orders_count,
         COALESCE((
           SELECT SUM(COALESCE(o.quantity, 1))
           FROM orders o
           WHERE o.product_slug = p.slug
             AND LOWER(COALESCE(o.status, '')) != 'cancelled'
             AND (?1 IS NULL OR datetime(o.created_at) >= datetime(?1))
             AND (?2 IS NULL OR datetime(o.created_at) < datetime(?2))
         ), 0) AS qty_sold,
         COALESCE((
           SELECT SUM(COALESCE(o.price_thb, 0) * COALESCE(o.quantity, 1))
           FROM orders o
           WHERE o.product_slug = p.slug
             AND LOWER(COALESCE(o.status, '')) != 'cancelled'
             AND (?1 IS NULL OR datetime(o.created_at) >= datetime(?1))
             AND (?2 IS NULL OR datetime(o.created_at) < datetime(?2))
         ), 0) AS revenue_thb,
         COALESCE((
           SELECT SUM(COALESCE(o.price_usd, 0) * COALESCE(o.quantity, 1))
           FROM orders o
           WHERE o.product_slug = p.slug
             AND LOWER(COALESCE(o.status, '')) != 'cancelled'
             AND (?1 IS NULL OR datetime(o.created_at) >= datetime(?1))
             AND (?2 IS NULL OR datetime(o.created_at) < datetime(?2))
         ), 0) AS revenue_usd
       FROM products p
       WHERE COALESCE(p.is_active, 1) = 1
       ORDER BY COALESCE(p.sort_order, 9999) ASC, p.id ASC`
    ).bind(bounds.start, bounds.end).all();
    const rows = listRes.results || [];
    const listings = rows.map((r) => {
      const revenueThb = toNumber(r.revenue_thb);
      const revenueUsd = toNumber(r.revenue_usd);
      const revenueTarget = convertRevenue(revenueThb, revenueUsd, targetCurrency, usdRatePerThb, targetRatePerThb);
      return {
        product_id: Number(r.product_id || 0),
        slug: String(r.slug || ""),
        title_en: String(r.title_en || r.slug || "Product"),
        image_url: getDisplayImage(r.image_url, r.images),
        favorites_count: toNumber(r.favorites_count),
        orders_count: toNumber(r.orders_count),
        qty_sold: toNumber(r.qty_sold),
        revenue_thb: revenueThb,
        revenue_usd: revenueUsd,
        revenue_target: revenueTarget
      };
    }).sort(
      (a, b) => b.orders_count - a.orders_count || b.favorites_count - a.favorites_count || b.revenue_target - a.revenue_target
    );
    const totals = listings.reduce((acc, row) => {
      acc.favorites += row.favorites_count;
      acc.orders += row.orders_count;
      acc.qty_sold += row.qty_sold;
      acc.revenue_thb += row.revenue_thb;
      acc.revenue_usd += row.revenue_usd;
      acc.revenue_target += row.revenue_target;
      return acc;
    }, { favorites: 0, orders: 0, qty_sold: 0, revenue_thb: 0, revenue_usd: 0, revenue_target: 0 });
    return json4({
      period: bounds.normalized,
      start: bounds.start,
      end: bounds.end,
      target_currency: targetCurrency,
      target_symbol: currencySymbol(targetCurrency, ratesMap),
      usd_rate_per_thb: usdRatePerThb,
      target_rate_per_thb: targetRatePerThb,
      available_currencies: ratesRows.map((r) => ({
        currency: String(r.currency || "").toUpperCase(),
        label: String(r.label || r.currency || ""),
        symbol: String(r.symbol || ""),
        rate_per_thb: toNumber(r.rate_per_thb)
      })),
      totals,
      listings
    });
  } catch (e) {
    console.error("Admin stats failed:", e?.message || e);
    return json4({ error: "Failed to compute stats" }, 500);
  }
}
__name(handleAdminStats, "handleAdminStats");

// ../workers/api/shipping.ts
var shippingSchemaReady = false;
var shippingSchemaPromise = null;
function json5(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(json5, "json");
function toAmount(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}
__name(toAmount, "toAmount");
function toQty(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}
__name(toQty, "toQty");
function normalizeCountryCode(raw) {
  const code = String(raw || "").trim().toUpperCase();
  if (!code) return "";
  if (code === "OTHER" || code === "INTL" || code === "INTERNATIONAL") return "OTHER";
  if (/^[A-Z]{2}$/.test(code)) return code;
  return "";
}
__name(normalizeCountryCode, "normalizeCountryCode");
function normalizeShippingCurrency(raw) {
  const c = String(raw || "").trim().toUpperCase();
  if (!c) return "USD";
  return c;
}
__name(normalizeShippingCurrency, "normalizeShippingCurrency");
function normalizeServiceLevel(raw) {
  const s = String(raw || "").trim().toLowerCase();
  return s === "standard" ? "standard" : "express";
}
__name(normalizeServiceLevel, "normalizeServiceLevel");
async function ensureShippingRatesSchema(env) {
  if (shippingSchemaReady) return;
  if (!shippingSchemaPromise) {
    shippingSchemaPromise = (async () => {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS shipping_rates (
          country_code TEXT PRIMARY KEY,
          country_name TEXT NOT NULL,
          first_item_usd REAL NOT NULL DEFAULT 0,
          additional_item_usd REAL NOT NULL DEFAULT 0,
          first_item_thb REAL NOT NULL DEFAULT 0,
          additional_item_thb REAL NOT NULL DEFAULT 0,
          tier1_first_thb INTEGER NOT NULL DEFAULT 0,
          tier1_add_thb INTEGER NOT NULL DEFAULT 0,
          tier2_first_thb INTEGER NOT NULL DEFAULT 0,
          tier2_add_thb INTEGER NOT NULL DEFAULT 0,
          tier3_first_thb INTEGER NOT NULL DEFAULT 0,
          tier3_add_thb INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          updated_at DATETIME DEFAULT (datetime('now'))
        )`
      ).run();
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS shipping_service_rates (
          country_code TEXT NOT NULL,
          service_level TEXT NOT NULL CHECK(service_level IN ('standard','express')),
          country_name TEXT NOT NULL,
          tier1_first_thb INTEGER NOT NULL DEFAULT 0,
          tier2_first_thb INTEGER NOT NULL DEFAULT 0,
          tier3_first_thb INTEGER NOT NULL DEFAULT 0,
          eta_min_days INTEGER NOT NULL DEFAULT 3,
          eta_max_days INTEGER NOT NULL DEFAULT 7,
          eta_note TEXT DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1,
          updated_at DATETIME DEFAULT (datetime('now')),
          PRIMARY KEY (country_code, service_level)
        )`
      ).run();
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS shipping_product_tiers (
          product_slug TEXT PRIMARY KEY,
          tier INTEGER NOT NULL CHECK(tier IN (1,2,3)),
          updated_at DATETIME DEFAULT (datetime('now'))
        )`
      ).run();
      await env.DB.prepare(
        `INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier, updated_at)
         VALUES ('sample-fabric', 3, datetime('now'))`
      ).run();
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS shipping_add_rates (
          tier INTEGER PRIMARY KEY CHECK(tier IN (1,2,3)),
          add_thb INTEGER NOT NULL DEFAULT 0,
          updated_at DATETIME DEFAULT (datetime('now'))
        )`
      ).run();
      await env.DB.prepare(
        `INSERT INTO shipping_rates (
          country_code, country_name, first_item_usd, additional_item_usd, first_item_thb, additional_item_thb, is_active, updated_at
        )
        SELECT 'OTHER', 'Other Countries', 25, 10, 850, 300, 1, datetime('now')
        WHERE NOT EXISTS (SELECT 1 FROM shipping_rates WHERE country_code = 'OTHER')`
      ).run();
      await env.DB.prepare(
        `INSERT INTO shipping_service_rates (
          country_code, service_level, country_name,
          tier1_first_thb, tier2_first_thb, tier3_first_thb,
          eta_min_days, eta_max_days, eta_note, is_active, updated_at
        )
        SELECT
          country_code, 'express', country_name,
          COALESCE(tier1_first_thb, 0), COALESCE(tier2_first_thb, 0), COALESCE(tier3_first_thb, 0),
          3, 7, 'Express delivery', COALESCE(is_active, 1), datetime('now')
        FROM shipping_rates sr
        WHERE NOT EXISTS (
          SELECT 1 FROM shipping_service_rates ssr
          WHERE ssr.country_code = sr.country_code AND ssr.service_level = 'express'
        )`
      ).run();
      await env.DB.prepare(
        `INSERT INTO shipping_service_rates (
          country_code, service_level, country_name,
          tier1_first_thb, tier2_first_thb, tier3_first_thb,
          eta_min_days, eta_max_days, eta_note, is_active, updated_at
        )
        SELECT
          country_code, 'standard', country_name,
          CAST(ROUND(COALESCE(tier1_first_thb, 0) * 0.75) AS INTEGER),
          CAST(ROUND(COALESCE(tier2_first_thb, 0) * 0.75) AS INTEGER),
          CAST(ROUND(COALESCE(tier3_first_thb, 0) * 0.75) AS INTEGER),
          7, 14, 'Standard delivery', COALESCE(is_active, 1), datetime('now')
        FROM shipping_rates sr
        WHERE NOT EXISTS (
          SELECT 1 FROM shipping_service_rates ssr
          WHERE ssr.country_code = sr.country_code AND ssr.service_level = 'standard'
        )`
      ).run();
      shippingSchemaReady = true;
    })().finally(() => {
      if (!shippingSchemaReady) shippingSchemaPromise = null;
    });
  }
  await shippingSchemaPromise;
}
__name(ensureShippingRatesSchema, "ensureShippingRatesSchema");
async function getRatePerThb(env, targetCurrency) {
  const target = String(targetCurrency || "USD").toUpperCase();
  if (target === "THB") return 1;
  const row = await env.DB.prepare(
    "SELECT rate_per_thb FROM exchange_rates WHERE currency = ?1 LIMIT 1"
  ).bind(target).first();
  const rate = Number(row?.rate_per_thb);
  if (Number.isFinite(rate) && rate > 0) return rate;
  if (target === "USD") return 1 / 30;
  return 0;
}
__name(getRatePerThb, "getRatePerThb");
async function calculateShippingQuote(env, input) {
  await ensureShippingRatesSchema(env);
  const currency = normalizeShippingCurrency(input.currency);
  const serviceLevel = normalizeServiceLevel(input.serviceLevel);
  const requestedCountry = normalizeCountryCode(input.countryCode) || normalizeCountryCode(input.fallbackCountryCode) || "OTHER";
  const items = input.items || [];
  const totalQty = items.reduce((sum, it) => sum + (it.qty || 0), 0) || toQty(input.totalQty || 0);
  if (items.length > 0 && requestedCountry !== "TH") {
    const thOnlySlugs = /* @__PURE__ */ new Set(["duvet-insert"]);
    const hasThOnly = items.some((it) => thOnlySlugs.has(it.slug));
    if (hasThOnly) {
      return {
        service_level: serviceLevel,
        requested_country: requestedCountry,
        applied_country: "",
        country_name: "",
        currency,
        total_qty: totalQty,
        highest_tier: 0,
        first_item: 0,
        additional_item: 0,
        amount: 0,
        first_item_thb: 0,
        additional_item_thb: 0,
        amount_thb: 0,
        eta_min_days: 0,
        eta_max_days: 0,
        eta_note: "",
        is_fallback: false,
        blocked_th_only: true
      };
    }
  }
  if (requestedCountry === "TH") {
    return {
      service_level: serviceLevel,
      requested_country: "TH",
      applied_country: "TH",
      country_name: "Thailand",
      currency,
      total_qty: totalQty,
      highest_tier: 0,
      first_item: 0,
      additional_item: 0,
      amount: 0,
      first_item_thb: 0,
      additional_item_thb: 0,
      amount_thb: 0,
      eta_min_days: serviceLevel === "standard" ? 2 : 1,
      eta_max_days: serviceLevel === "standard" ? 5 : 3,
      eta_note: serviceLevel === "standard" ? "Standard delivery" : "Express delivery",
      is_fallback: false,
      blocked_th_only: false
    };
  }
  const fetchRate = /* @__PURE__ */ __name(async (countryCode) => {
    const row2 = await env.DB.prepare(
      `SELECT country_code, country_name,
        tier1_first_thb, tier2_first_thb, tier3_first_thb,
        eta_min_days, eta_max_days, eta_note,
        is_active
       FROM shipping_service_rates
       WHERE country_code = ?1 AND service_level = ?2 AND is_active = 1
       LIMIT 1`
    ).bind(countryCode, serviceLevel).first();
    return row2 || null;
  }, "fetchRate");
  let appliedCountry = requestedCountry;
  let row = await fetchRate(appliedCountry);
  let isFallback = false;
  if (!row && appliedCountry !== "OTHER") {
    row = await fetchRate("OTHER");
    if (row) {
      appliedCountry = "OTHER";
      isFallback = true;
    }
  }
  if (!row) {
    return {
      service_level: serviceLevel,
      requested_country: requestedCountry,
      applied_country: appliedCountry,
      country_name: appliedCountry === "OTHER" ? "Other Countries" : appliedCountry,
      currency,
      total_qty: totalQty,
      highest_tier: 0,
      first_item: 0,
      additional_item: 0,
      amount: 0,
      first_item_thb: 0,
      additional_item_thb: 0,
      amount_thb: 0,
      eta_min_days: serviceLevel === "standard" ? 7 : 3,
      eta_max_days: serviceLevel === "standard" ? 14 : 7,
      eta_note: serviceLevel === "standard" ? "Standard delivery" : "Express delivery",
      is_fallback: isFallback,
      blocked_th_only: false
    };
  }
  const effectiveItems = items.length > 0 ? items : [{ slug: "_default", qty: totalQty || 1 }];
  const tierMap = /* @__PURE__ */ new Map();
  tierMap.set("_default", 2);
  for (const item of effectiveItems) {
    if (tierMap.has(item.slug)) continue;
    const tRow = await env.DB.prepare(
      "SELECT tier FROM shipping_product_tiers WHERE product_slug = ?1 LIMIT 1"
    ).bind(item.slug).first();
    tierMap.set(item.slug, Number(tRow?.tier || 2));
  }
  let highestTier = 0;
  for (const item of effectiveItems) {
    const t = tierMap.get(item.slug) || 2;
    if (t > highestTier) highestTier = t;
  }
  const addRows = await env.DB.prepare(
    "SELECT tier, add_thb FROM shipping_add_rates ORDER BY tier"
  ).all();
  const globalAddRates = {};
  for (const ar of addRows.results || []) {
    globalAddRates[Number(ar.tier)] = toAmount(ar.add_thb);
  }
  const legacyFirstThb = 0;
  const legacyAddThb = 0;
  const tier1FirstThb = toAmount(row.tier1_first_thb || 0);
  const tier2FirstThb = toAmount(row.tier2_first_thb || 0);
  const tier3FirstThb = toAmount(row.tier3_first_thb || 0);
  const hasTierFirstRates = tier1FirstThb > 0 || tier2FirstThb > 0 || tier3FirstThb > 0;
  let firstItemThb = 0;
  let additionalThb = 0;
  if (!hasTierFirstRates && legacyFirstThb > 0) {
    highestTier = 0;
    firstItemThb = legacyFirstThb;
    additionalThb = legacyAddThb * Math.max(0, totalQty - 1);
  } else {
    if (highestTier <= 0) highestTier = 2;
    const tierFirstLookup = {
      1: tier1FirstThb,
      2: tier2FirstThb,
      3: tier3FirstThb
    };
    firstItemThb = toAmount(tierFirstLookup[highestTier] || legacyFirstThb || 0);
    let highestItemDeducted = false;
    for (const item of effectiveItems) {
      const t = tierMap.get(item.slug) || 2;
      const qty = item.qty || 0;
      const addRate = toAmount(globalAddRates[t] || legacyAddThb || 0);
      if (t === highestTier && !highestItemDeducted) {
        additionalThb += addRate * Math.max(0, qty - 1);
        highestItemDeducted = true;
      } else {
        additionalThb += addRate * qty;
      }
    }
  }
  const amountThb = toAmount(firstItemThb + additionalThb);
  const ratePerThb = await getRatePerThb(env, currency);
  const firstItem = currency === "THB" ? firstItemThb : toAmount(firstItemThb * ratePerThb);
  const additionalItem = currency === "THB" ? additionalThb : toAmount(additionalThb * ratePerThb);
  const amount = currency === "THB" ? amountThb : toAmount(amountThb * ratePerThb);
  return {
    service_level: serviceLevel,
    requested_country: requestedCountry,
    applied_country: appliedCountry,
    country_name: row?.country_name || (appliedCountry === "OTHER" ? "Other Countries" : appliedCountry),
    currency,
    total_qty: totalQty,
    highest_tier: highestTier,
    first_item: firstItem,
    additional_item: additionalItem,
    amount,
    first_item_thb: firstItemThb,
    additional_item_thb: additionalThb,
    amount_thb: amountThb,
    eta_min_days: Math.max(0, Number(row?.eta_min_days || 0)),
    eta_max_days: Math.max(0, Number(row?.eta_max_days || 0)),
    eta_note: String(row?.eta_note || (serviceLevel === "standard" ? "Standard delivery" : "Express delivery")),
    is_fallback: isFallback,
    blocked_th_only: false
  };
}
__name(calculateShippingQuote, "calculateShippingQuote");
async function handleShippingCalculate(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Secret"
      }
    });
  }
  if (request.method !== "GET" && request.method !== "POST") {
    return json5({ error: "Method not allowed" }, 405);
  }
  try {
    let country = "";
    let qty = 0;
    let currency = "USD";
    let serviceLevel = "express";
    let items;
    const fallbackCountry = request.headers.get("CF-IPCountry") || "";
    if (request.method === "GET") {
      const url = new URL(request.url);
      country = url.searchParams.get("country") || "";
      qty = toQty(url.searchParams.get("qty") || 0);
      currency = url.searchParams.get("currency") || "USD";
      serviceLevel = url.searchParams.get("service_level") || "express";
    } else {
      const body = await request.json().catch(() => ({}));
      country = body.country || body.country_code || "";
      qty = toQty(body.qty || body.total_qty || 0);
      currency = body.currency || "USD";
      serviceLevel = body.service_level || "express";
      if (Array.isArray(body.items)) {
        items = body.items.map((it) => ({
          slug: String(it.slug || it.product_slug || ""),
          qty: Math.max(1, toQty(it.qty || 1))
        })).filter((it) => it.slug && it.qty > 0);
      }
    }
    const quote = await calculateShippingQuote(env, {
      countryCode: country,
      fallbackCountryCode: fallbackCountry,
      currency,
      serviceLevel,
      totalQty: qty,
      items
    });
    return json5({ ok: true, ...quote });
  } catch (e) {
    return json5({ error: e?.message || "Shipping quote unavailable" }, 500);
  }
}
__name(handleShippingCalculate, "handleShippingCalculate");

// ../workers/api/admin-shipping.ts
function json6(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(json6, "json");
function toAmount2(v) {
  return toAmount(v);
}
__name(toAmount2, "toAmount");
function isProductionHost6(hostname) {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}
__name(isProductionHost6, "isProductionHost");
function collectRoles7(raw) {
  if (!raw || typeof raw !== "object") return [];
  const values = [];
  const add = /* @__PURE__ */ __name((v) => {
    if (v !== void 0 && v !== null) values.push(v);
  }, "add");
  add(raw.role);
  add(raw.roles);
  add(raw.org_role);
  add(raw.orgRole);
  add(raw.public_metadata?.role);
  add(raw.public_metadata?.roles);
  add(raw.unsafe_metadata?.role);
  add(raw.unsafe_metadata?.roles);
  add(raw.metadata?.role);
  add(raw.metadata?.roles);
  add(raw["https://mildmate.com/role"]);
  add(raw["https://mildmate.com/roles"]);
  const out = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}
__name(collectRoles7, "collectRoles");
function hasAdminRole7(rawClaims) {
  const roles = collectRoles7(rawClaims);
  return roles.some(
    (r) => r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin")
  );
}
__name(hasAdminRole7, "hasAdminRole");
function emailAllowed7(email, env) {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
__name(emailAllowed7, "emailAllowed");
async function authorizeAdmin5(request, env) {
  const host = new URL(request.url).hostname;
  if (host.includes("pages.dev") || host === "localhost" || host.startsWith("127.0.0.1")) {
    return { ok: true };
  }
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");
  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (!verified.valid) {
    } else {
      const raw = verified.payload.raw || {};
      if (hasAdminRole7(raw) || emailAllowed7(verified.payload.email || "", env)) {
        return { ok: true };
      }
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find(function(e) {
              return e.id === user.primary_email_address_id;
            })?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed7(email, env)) return { ok: true };
            if (hasAdminRole7(metadata)) return { ok: true };
          }
        } catch (e) {
          console.error("Clerk API lookup failed:", e?.message || e);
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
  }
  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const prodHost = isProductionHost6(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }
  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}
__name(authorizeAdmin5, "authorizeAdmin");
function normalizeCountryName(raw, countryCode) {
  const name = String(raw || "").trim();
  if (name) return name;
  if (countryCode === "OTHER") return "Other Countries";
  return countryCode;
}
__name(normalizeCountryName, "normalizeCountryName");
async function getUsdRatePerThb(env) {
  const row = await env.DB.prepare(
    "SELECT rate_per_thb FROM exchange_rates WHERE currency = 'USD' LIMIT 1"
  ).first();
  const rate = Number(row?.rate_per_thb);
  if (Number.isFinite(rate) && rate > 0) return rate;
  return 1 / 30;
}
__name(getUsdRatePerThb, "getUsdRatePerThb");
async function handleAdminShippingRates(request, env) {
  const auth = await authorizeAdmin5(request, env);
  if (!auth.ok) return json6({ error: auth.error }, auth.status);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Secret"
      }
    });
  }
  await ensureShippingRatesSchema(env);
  if (request.method === "GET") {
    const serviceLevel = normalizeServiceLevel(new URL(request.url).searchParams.get("service_level") || "express");
    const usdRate = await getUsdRatePerThb(env);
    const rows = await env.DB.prepare(
      `SELECT country_code, country_name,
        tier1_first_thb, tier2_first_thb, tier3_first_thb,
        eta_min_days, eta_max_days, eta_note,
        is_active, updated_at
       FROM shipping_service_rates
       WHERE service_level = ?1
       ORDER BY CASE WHEN country_code = 'OTHER' THEN 1 ELSE 0 END, country_code`
    ).bind(serviceLevel).all();
    const rates = (rows.results || []).map((r) => {
      const t1f = toAmount2(r.tier1_first_thb || 0);
      const t2f = toAmount2(r.tier2_first_thb || 0);
      const t3f = toAmount2(r.tier3_first_thb || 0);
      return {
        service_level: serviceLevel,
        country_code: String(r.country_code || "").toUpperCase(),
        country_name: String(r.country_name || ""),
        tier1_first_thb: t1f,
        tier2_first_thb: t2f,
        tier3_first_thb: t3f,
        eta_min_days: Number(r.eta_min_days || 0),
        eta_max_days: Number(r.eta_max_days || 0),
        eta_note: String(r.eta_note || ""),
        tier1_first_usd: toAmount2(t1f * usdRate),
        tier2_first_usd: toAmount2(t2f * usdRate),
        tier3_first_usd: toAmount2(t3f * usdRate),
        is_active: Number(r.is_active || 0),
        updated_at: r.updated_at
      };
    });
    return json6({ service_level: serviceLevel, rates, usd_rate_per_thb: usdRate });
  }
  if (request.method === "POST" || request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json6({ error: "Invalid JSON body" }, 400);
    }
    const countryCode = normalizeCountryCode(body.country_code || body.country || "");
    const serviceLevel = normalizeServiceLevel(body.service_level || "express");
    if (!countryCode) {
      return json6({ error: "country_code is required (ISO-2 or OTHER)" }, 400);
    }
    const countryName = normalizeCountryName(body.country_name, countryCode);
    const t1f = toAmount2(body.tier1_first_thb || body.tier1_first || 0);
    const t2f = toAmount2(body.tier2_first_thb || body.tier2_first || 0);
    const t3f = toAmount2(body.tier3_first_thb || body.tier3_first || 0);
    const etaMinDays = Math.max(0, Number(body.eta_min_days || 0));
    const etaMaxDays = Math.max(0, Number(body.eta_max_days || 0));
    const etaNote = String(body.eta_note || "").trim();
    const isActive = body.is_active === void 0 ? 1 : Number(body.is_active) ? 1 : 0;
    await env.DB.prepare(
      `INSERT INTO shipping_service_rates (
        country_code, service_level, country_name,
        tier1_first_thb, tier2_first_thb, tier3_first_thb,
        eta_min_days, eta_max_days, eta_note,
        is_active, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, datetime('now'))
      ON CONFLICT(country_code, service_level) DO UPDATE SET
        country_name = excluded.country_name,
        tier1_first_thb = excluded.tier1_first_thb,
        tier2_first_thb = excluded.tier2_first_thb,
        tier3_first_thb = excluded.tier3_first_thb,
        eta_min_days = excluded.eta_min_days,
        eta_max_days = excluded.eta_max_days,
        eta_note = excluded.eta_note,
        is_active = excluded.is_active,
        updated_at = datetime('now')`
    ).bind(countryCode, serviceLevel, countryName, t1f, t2f, t3f, etaMinDays, etaMaxDays, etaNote, isActive).run();
    return json6({
      success: true,
      rate: {
        service_level: serviceLevel,
        country_code: countryCode,
        country_name: countryName,
        tier1_first_thb: t1f,
        tier2_first_thb: t2f,
        tier3_first_thb: t3f,
        eta_min_days: etaMinDays,
        eta_max_days: etaMaxDays,
        eta_note: etaNote,
        is_active: isActive
      }
    });
  }
  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const countryCode = normalizeCountryCode(url.searchParams.get("country") || "");
    const serviceLevel = normalizeServiceLevel(url.searchParams.get("service_level") || "express");
    if (!countryCode) return json6({ error: "country query param is required" }, 400);
    if (countryCode === "OTHER") return json6({ error: "OTHER cannot be deleted" }, 400);
    await env.DB.prepare("DELETE FROM shipping_service_rates WHERE country_code = ?1 AND service_level = ?2").bind(countryCode, serviceLevel).run();
    return json6({ success: true, country_code: countryCode, service_level: serviceLevel });
  }
  return json6({ error: "Method not allowed" }, 405);
}
__name(handleAdminShippingRates, "handleAdminShippingRates");
async function handleAdminShippingProductTiers(request, env) {
  const auth = await authorizeAdmin5(request, env);
  if (!auth.ok) return json6({ error: auth.error }, auth.status);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Secret"
      }
    });
  }
  await ensureShippingRatesSchema(env);
  if (request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT spt.product_slug, spt.tier, p.title_en, p.category
       FROM shipping_product_tiers spt
       LEFT JOIN products p ON p.slug = spt.product_slug
       ORDER BY spt.tier, spt.product_slug`
    ).all();
    const tiers = (rows.results || []).map((r) => ({
      product_slug: String(r.product_slug || ""),
      product_name: String(r.title_en || r.product_slug || ""),
      category: String(r.category || ""),
      tier: Number(r.tier || 2)
    }));
    return json6({ product_tiers: tiers });
  }
  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json6({ error: "Invalid JSON" }, 400);
    }
    const slug = String(body.product_slug || "").trim();
    const tier = Number(body.tier);
    if (!slug) return json6({ error: "product_slug required" }, 400);
    if (![1, 2, 3].includes(tier)) return json6({ error: "tier must be 1, 2, or 3" }, 400);
    await env.DB.prepare(
      `INSERT INTO shipping_product_tiers (product_slug, tier, updated_at)
       VALUES (?1, ?2, datetime('now'))
       ON CONFLICT(product_slug) DO UPDATE SET
         tier = excluded.tier,
         updated_at = datetime('now')`
    ).bind(slug, tier).run();
    return json6({ success: true, product_slug: slug, tier });
  }
  return json6({ error: "Method not allowed" }, 405);
}
__name(handleAdminShippingProductTiers, "handleAdminShippingProductTiers");
async function handleAdminShippingAddRates(request, env) {
  const auth = await authorizeAdmin5(request, env);
  if (!auth.ok) return json6({ error: auth.error }, auth.status);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Secret"
      }
    });
  }
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS shipping_add_rates (
      tier INTEGER PRIMARY KEY CHECK(tier IN (1,2,3)),
      add_thb INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT (datetime('now'))
    )`
  ).run();
  if (request.method === "GET") {
    const usdRate = await getUsdRatePerThb(env);
    const rows = await env.DB.prepare(
      "SELECT tier, add_thb FROM shipping_add_rates ORDER BY tier"
    ).all();
    const addRates = {};
    for (const r of rows.results || []) {
      const t = Number(r.tier);
      const thb = toAmount2(r.add_thb);
      addRates[t] = { add_thb: thb, add_usd: toAmount2(thb * usdRate) };
    }
    return json6({ add_rates: addRates, usd_rate_per_thb: usdRate });
  }
  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json6({ error: "Invalid JSON" }, 400);
    }
    const tier = Number(body.tier);
    const addThb = toAmount2(body.add_thb);
    if (![1, 2, 3].includes(tier)) return json6({ error: "tier must be 1, 2, or 3" }, 400);
    await env.DB.prepare(
      `INSERT INTO shipping_add_rates (tier, add_thb, updated_at)
       VALUES (?1, ?2, datetime('now'))
       ON CONFLICT(tier) DO UPDATE SET
         add_thb = excluded.add_thb, updated_at = datetime('now')`
    ).bind(tier, addThb).run();
    return json6({ success: true, tier, add_thb: addThb });
  }
  return json6({ error: "Method not allowed" }, 405);
}
__name(handleAdminShippingAddRates, "handleAdminShippingAddRates");

// ../workers/api/admin-quotes.ts
var quoteSchemaReady = false;
var quoteSchemaPromise = null;
function json7(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS"
    }
  });
}
__name(json7, "json");
function isProductionHost7(hostname) {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}
__name(isProductionHost7, "isProductionHost");
function isPreviewHashHost(hostname) {
  if (!hostname) return false;
  return /^[a-f0-9]{8,}\.mildmate-new\.pages\.dev$/i.test(hostname);
}
__name(isPreviewHashHost, "isPreviewHashHost");
function collectRoles8(raw) {
  if (!raw || typeof raw !== "object") return [];
  const values = [];
  const add = /* @__PURE__ */ __name((v) => {
    if (v !== void 0 && v !== null) values.push(v);
  }, "add");
  add(raw.role);
  add(raw.roles);
  add(raw.org_role);
  add(raw.orgRole);
  add(raw.public_metadata?.role);
  add(raw.public_metadata?.roles);
  add(raw.unsafe_metadata?.role);
  add(raw.unsafe_metadata?.roles);
  add(raw.metadata?.role);
  add(raw.metadata?.roles);
  add(raw["https://mildmate.com/role"]);
  add(raw["https://mildmate.com/roles"]);
  const out = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}
__name(collectRoles8, "collectRoles");
function hasAdminRole8(raw) {
  const roles = collectRoles8(raw);
  return roles.some(
    (r) => r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin")
  );
}
__name(hasAdminRole8, "hasAdminRole");
function emailAllowed8(email, env) {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
__name(emailAllowed8, "emailAllowed");
async function authorizeAdmin6(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");
  const host = new URL(request.url).hostname;
  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole8(raw) || emailAllowed8(verified.payload.email || "", env)) return { ok: true };
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find((e) => e.id === user.primary_email_address_id)?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed8(email, env)) return { ok: true };
            if (hasAdminRole8(metadata)) return { ok: true };
          }
        } catch {
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
  }
  const bypassPreview = String(env.ADMIN_QUOTES_PREVIEW_BYPASS || "true").toLowerCase() !== "false";
  if (bypassPreview && isPreviewHashHost(host)) return { ok: true };
  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) return { ok: false, status: 401, error: "Unauthorized" };
  const prodHost = isProductionHost7(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}
__name(authorizeAdmin6, "authorizeAdmin");
async function ensureQuoteSchema(env) {
  if (quoteSchemaReady) return;
  if (!quoteSchemaPromise) {
    quoteSchemaPromise = (async () => {
      const tableInfo = await env.DB.prepare("PRAGMA table_info(custom_quotes)").all();
      const existing = new Set((tableInfo.results || []).map((r) => String(r.name || "").toLowerCase()));
      const alters = [];
      if (!existing.has("quote_id")) alters.push("ALTER TABLE custom_quotes ADD COLUMN quote_id TEXT");
      if (!existing.has("customer_name")) alters.push("ALTER TABLE custom_quotes ADD COLUMN customer_name TEXT");
      if (!existing.has("email")) alters.push("ALTER TABLE custom_quotes ADD COLUMN email TEXT");
      if (!existing.has("address")) alters.push("ALTER TABLE custom_quotes ADD COLUMN address TEXT");
      if (!existing.has("telephone")) alters.push("ALTER TABLE custom_quotes ADD COLUMN telephone TEXT");
      if (!existing.has("product_slug")) alters.push("ALTER TABLE custom_quotes ADD COLUMN product_slug TEXT");
      if (!existing.has("dimensions")) alters.push("ALTER TABLE custom_quotes ADD COLUMN dimensions TEXT");
      if (!existing.has("fabric")) alters.push("ALTER TABLE custom_quotes ADD COLUMN fabric TEXT");
      if (!existing.has("color")) alters.push("ALTER TABLE custom_quotes ADD COLUMN color TEXT");
      if (!existing.has("status")) alters.push("ALTER TABLE custom_quotes ADD COLUMN status TEXT DEFAULT 'pending'");
      if (!existing.has("quoted_price")) alters.push("ALTER TABLE custom_quotes ADD COLUMN quoted_price INTEGER");
      if (!existing.has("quoted_price_usd")) alters.push("ALTER TABLE custom_quotes ADD COLUMN quoted_price_usd INTEGER");
      if (!existing.has("expires_at")) alters.push("ALTER TABLE custom_quotes ADD COLUMN expires_at DATETIME");
      if (!existing.has("created_at")) alters.push("ALTER TABLE custom_quotes ADD COLUMN created_at DATETIME");
      for (const sql of alters) await env.DB.prepare(sql).run();
      const afterInfo = await env.DB.prepare("PRAGMA table_info(custom_quotes)").all();
      const after = new Set((afterInfo.results || []).map((r) => String(r.name || "").toLowerCase()));
      if (after.has("customer_email") && after.has("email")) {
        await env.DB.prepare("UPDATE custom_quotes SET email = COALESCE(NULLIF(email, ''), customer_email)").run();
      }
      if (after.has("product_type") && after.has("product_slug")) {
        await env.DB.prepare("UPDATE custom_quotes SET product_slug = COALESCE(NULLIF(product_slug, ''), product_type)").run();
      }
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_quotes_email ON custom_quotes(email)").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_quotes_status ON custom_quotes(status)").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_quotes_id ON custom_quotes(quote_id)").run();
      quoteSchemaReady = true;
    })().finally(() => {
      if (!quoteSchemaReady) quoteSchemaPromise = null;
    });
  }
  await quoteSchemaPromise;
}
__name(ensureQuoteSchema, "ensureQuoteSchema");
function normalizeDateInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().replace("T", " ").slice(0, 19);
}
__name(normalizeDateInput, "normalizeDateInput");
async function generateQuoteId(db) {
  const now = /* @__PURE__ */ new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const datePrefix = `QT-${y}${m}${d}`;
  const row = await db.prepare("SELECT COUNT(*) as cnt FROM custom_quotes WHERE quote_id LIKE ?1").bind(`${datePrefix}-%`).first();
  const seq = String((row?.cnt || 0) + 1).padStart(3, "0");
  return `${datePrefix}-${seq}`;
}
__name(generateQuoteId, "generateQuoteId");
function buildQuoteLink(request, quoteId) {
  const origin = new URL(request.url).origin;
  return `${origin}/quote/${encodeURIComponent(quoteId)}/`;
}
__name(buildQuoteLink, "buildQuoteLink");
async function getUsdRate(db) {
  try {
    const row = await db.prepare(
      "SELECT param_value FROM pricing_params WHERE param_key = 'usd_rate'"
    ).first();
    if (row) {
      const val = parseFloat(row.param_value);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch {
  }
  return 30;
}
__name(getUsdRate, "getUsdRate");
async function sendMagicLinkEmail(env, request, quote) {
  if (!quote?.email) return { success: false, error: "Missing customer email" };
  if (quote.status !== "approved") return { success: false, error: "Quote is not approved" };
  const priceThb = quote.quoted_price ? Number(quote.quoted_price) : 0;
  const priceUsd = quote.quoted_price_usd ? Number(quote.quoted_price_usd) : 0;
  const hasUsdPrice = priceUsd > 0;
  if (!hasUsdPrice && priceThb <= 0) return { success: false, error: "Quoted price is required before sending email" };
  const quoteLink = buildQuoteLink(request, quote.quote_id);
  const product = String(quote.product_slug || "").replace(/-/g, " ");
  const prettyProduct = product.replace(/\b\w/g, (c) => c.toUpperCase()) || "Custom Product";
  const expires = quote.expires_at ? /* @__PURE__ */ new Date(String(quote.expires_at).replace(" ", "T") + "Z") : null;
  const expiryText = expires && !isNaN(expires.getTime()) ? expires.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  const priceLine = hasUsdPrice ? `$${priceUsd.toLocaleString()} USD (approx. \u0E3F${priceThb.toLocaleString()} THB)` : `\u0E3F${priceThb.toLocaleString()} THB`;
  const body = [
    `Hi ${quote.customer_name || "there"},`,
    "",
    `Your custom quote is ready: ${quote.quote_id}`,
    `Product: ${prettyProduct}`,
    `Price: ${priceLine}`,
    expiryText ? `Valid until: ${expiryText}` : "",
    "",
    "Use this secure link to add your quote directly to cart:",
    quoteLink,
    "",
    "If you have any questions, reply to this email and our team will help.",
    "",
    "MildMate Team"
  ].filter(Boolean).join("\n");
  const result = await sendEmail(env, {
    to: String(quote.email).trim().toLowerCase(),
    from: env.QUOTE_FROM_EMAIL || "MildMate <orders@mildmate.com>",
    replyTo: env.QUOTE_REPLY_TO || "orders@mildmate.com",
    subject: `Your MildMate quote ${quote.quote_id} is ready`,
    text: body
  });
  return { success: result.success, error: result.error };
}
__name(sendMagicLinkEmail, "sendMagicLinkEmail");
async function handleAdminQuotes(request, env) {
  if (request.method === "OPTIONS") return json7({ ok: true });
  const auth = await authorizeAdmin6(request, env);
  if (!auth.ok) return json7({ error: auth.error }, auth.status);
  await ensureQuoteSchema(env);
  const db = env.DB;
  const url = new URL(request.url);
  const method = request.method;
  if (method === "GET") {
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const statusFilter = String(url.searchParams.get("status") || "").trim().toLowerCase();
    const allowedStatus = /* @__PURE__ */ new Set(["pending", "approved", "rejected", "expired", "archived"]);
    const where = [];
    const binds = [];
    if (statusFilter && statusFilter !== "all" && allowedStatus.has(statusFilter)) {
      where.push("LOWER(COALESCE(status,'pending')) = ?");
      binds.push(statusFilter);
    } else if (!statusFilter || statusFilter === "all") {
      where.push("LOWER(COALESCE(status,'pending')) != 'archived'");
    }
    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const limit = 50;
    const offset = (page - 1) * limit;
    const rows = await db.prepare(
      `SELECT id, quote_id, customer_name, email, telephone, address, product_slug, dimensions, fabric, color,
              status, quoted_price, quoted_price_usd, expires_at, created_at
       FROM custom_quotes
       ${whereSql}
       ORDER BY COALESCE(created_at, datetime('now')) DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`
    ).bind(...binds).all();
    const totalRow = await db.prepare(
      `SELECT COUNT(*) as cnt FROM custom_quotes ${whereSql}`
    ).bind(...binds).first();
    const quotes = (rows.results || []).map((r) => {
      let dims = r.dimensions;
      try {
        dims = typeof r.dimensions === "string" ? JSON.parse(r.dimensions) : r.dimensions;
      } catch {
      }
      const priceThb = r.quoted_price || null;
      const priceUsd = r.quoted_price_usd || null;
      const hasExplicitUsd = priceUsd != null && priceUsd > 0;
      return {
        id: r.id,
        quote_id: r.quote_id,
        customer_name: r.customer_name || "",
        email: r.email || "",
        telephone: r.telephone || "",
        address: r.address || "",
        product_slug: r.product_slug || "",
        dimensions: dims || {},
        fabric: r.fabric || "",
        color: r.color || "",
        status: r.status || "pending",
        quoted_price_thb: priceThb,
        quoted_price_usd: priceUsd,
        quoted_price_currency: hasExplicitUsd ? "USD" : priceThb ? "THB" : null,
        expires_at: r.expires_at || null,
        created_at: r.created_at || null,
        size_text: dims && typeof dims === "object" ? dims.size_text || "" : "",
        quote_url: buildQuoteLink(request, r.quote_id)
      };
    });
    return json7({
      quotes,
      page,
      total: totalRow?.cnt || 0,
      status: statusFilter || "all"
    });
  }
  if (method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return json7({ error: "Invalid JSON" }, 400);
    }
    const customerName = String(body.customer_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const productSlug = String(body.product_slug || "").trim().toLowerCase();
    const sizeText = String(body.size_text || "").trim();
    let dimensions = body.dimensions || null;
    if (!dimensions && sizeText) {
      dimensions = { size_text: sizeText };
    } else if (dimensions && typeof dimensions === "object" && sizeText) {
      dimensions = { ...dimensions, size_text: sizeText };
    }
    const dimsJson = typeof dimensions === "string" ? dimensions : JSON.stringify(dimensions || {});
    const status = String(body.status || "pending").trim().toLowerCase();
    const quoteCurrency = String(body.quoted_price_currency || "").trim().toUpperCase();
    const isUsdQuote = quoteCurrency === "USD";
    let quotedPriceThb = null;
    let quotedPriceUsd = null;
    if (isUsdQuote) {
      const usdVal = body.quoted_price_usd != null && body.quoted_price_usd !== "" ? Math.round(Number(body.quoted_price_usd)) : null;
      if (usdVal && usdVal > 0) {
        quotedPriceUsd = usdVal;
        const rate = await getUsdRate(db);
        quotedPriceThb = Math.round(usdVal * rate);
      }
    } else {
      const thbVal = body.quoted_price_thb != null && body.quoted_price_thb !== "" ? Math.round(Number(body.quoted_price_thb)) : null;
      if (thbVal && thbVal > 0) {
        quotedPriceThb = thbVal;
        const rate = await getUsdRate(db);
        quotedPriceUsd = Math.round(thbVal / rate);
      }
    }
    const expiresAt = normalizeDateInput(body.expires_at);
    const sendEmailNow = !!body.send_email;
    if (!customerName) return json7({ error: "customer_name is required" }, 400);
    if (!email || !email.includes("@")) return json7({ error: "Valid email is required" }, 400);
    if (!productSlug) return json7({ error: "product_slug is required" }, 400);
    if (!dimensions) return json7({ error: "dimensions or size_text is required" }, 400);
    if (!["pending", "approved", "rejected", "expired", "archived"].includes(status)) {
      return json7({ error: "Invalid status" }, 400);
    }
    if (status === "approved" && (!quotedPriceThb || quotedPriceThb <= 0)) {
      return json7({ error: "A price (THB or USD) is required for approved status" }, 400);
    }
    const quoteId = await generateQuoteId(db);
    await db.prepare(
      `INSERT INTO custom_quotes
        (quote_id, customer_name, email, address, telephone, product_slug, dimensions, fabric, color, status, quoted_price, quoted_price_usd, expires_at, created_at)
       VALUES
        (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'))`
    ).bind(
      quoteId,
      customerName,
      email,
      String(body.address || "").trim() || null,
      String(body.telephone || "").trim() || null,
      productSlug,
      dimsJson,
      String(body.fabric || "").trim() || null,
      String(body.color || "").trim() || null,
      status,
      quotedPriceThb,
      quotedPriceUsd,
      expiresAt
    ).run();
    let emailStatus = { success: false, skipped: true };
    if (sendEmailNow && status === "approved") {
      emailStatus = await sendMagicLinkEmail(env, request, {
        quote_id: quoteId,
        customer_name: customerName,
        email,
        product_slug: productSlug,
        status,
        quoted_price: quotedPriceThb,
        quoted_price_usd: quotedPriceUsd,
        expires_at: expiresAt
      });
    }
    return json7({
      success: true,
      quote_id: quoteId,
      quote_url: buildQuoteLink(request, quoteId),
      email_sent: !!emailStatus.success,
      email_error: emailStatus.success ? null : emailStatus.skipped ? null : emailStatus.error || null
    }, 201);
  }
  if (method === "PUT") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return json7({ error: "Invalid JSON" }, 400);
    }
    const quoteId = String(body.quote_id || "").trim();
    if (!quoteId) return json7({ error: "quote_id is required" }, 400);
    const current = await db.prepare(
      `SELECT quote_id, dimensions, status, quoted_price, quoted_price_usd
       FROM custom_quotes
       WHERE quote_id = ?1`
    ).bind(quoteId).first();
    if (!current) return json7({ error: "Quote not found" }, 404);
    const updates = [];
    const binds = [];
    const status = body.status != null ? String(body.status).trim().toLowerCase() : null;
    if (status != null) {
      if (!["pending", "approved", "rejected", "expired", "archived"].includes(status)) return json7({ error: "Invalid status" }, 400);
      updates.push("status = ?");
      binds.push(status);
    }
    let priceThb = null;
    let priceUsd = null;
    const quoteCurrency = String(body.quoted_price_currency || "").trim().toUpperCase();
    const isUsdUpdate = quoteCurrency === "USD";
    if (isUsdUpdate && body.quoted_price_usd != null && body.quoted_price_usd !== "") {
      priceUsd = Math.round(Number(body.quoted_price_usd));
      if (!priceUsd || priceUsd <= 0) return json7({ error: "quoted_price_usd must be a positive number" }, 400);
      const rate = await getUsdRate(db);
      priceThb = Math.round(priceUsd * rate);
      updates.push("quoted_price = ?");
      binds.push(priceThb);
      updates.push("quoted_price_usd = ?");
      binds.push(priceUsd);
    } else if (body.quoted_price_thb != null && body.quoted_price_thb !== "") {
      priceThb = Math.round(Number(body.quoted_price_thb));
      if (!priceThb || priceThb <= 0) return json7({ error: "quoted_price_thb must be a positive number" }, 400);
      updates.push("quoted_price = ?");
      binds.push(priceThb);
      updates.push("quoted_price_usd = NULL");
    }
    if (body.expires_at !== void 0) {
      const normalized = normalizeDateInput(body.expires_at);
      updates.push("expires_at = ?");
      binds.push(normalized);
    }
    if (body.fabric !== void 0) {
      updates.push("fabric = ?");
      binds.push(String(body.fabric || "").trim() || null);
    }
    if (body.color !== void 0) {
      updates.push("color = ?");
      binds.push(String(body.color || "").trim() || null);
    }
    if (body.dimensions !== void 0 || body.size_text !== void 0) {
      let dims = {};
      if (body.dimensions !== void 0) {
        if (typeof body.dimensions === "string") {
          try {
            dims = JSON.parse(body.dimensions);
          } catch {
            return json7({ error: "Invalid dimensions JSON" }, 400);
          }
        } else if (body.dimensions && typeof body.dimensions === "object") {
          dims = body.dimensions;
        } else {
          dims = {};
        }
      } else {
        try {
          dims = typeof current.dimensions === "string" ? JSON.parse(current.dimensions || "{}") : current.dimensions || {};
        } catch {
          dims = {};
        }
      }
      if (body.size_text !== void 0) {
        const txt = String(body.size_text || "").trim();
        if (txt) dims.size_text = txt;
        else delete dims.size_text;
      }
      updates.push("dimensions = ?");
      binds.push(JSON.stringify(dims || {}));
    }
    const targetStatus = status || String(current.status || "pending").toLowerCase();
    const finalPriceThb = priceThb != null ? priceThb : Number(current.quoted_price || 0);
    if (targetStatus === "approved" && (!finalPriceThb || finalPriceThb <= 0)) {
      return json7({ error: "A price (THB or USD) is required for approved status" }, 400);
    }
    if (!updates.length && !body.send_email) return json7({ error: "No update fields provided" }, 400);
    if (updates.length) {
      await db.prepare(`UPDATE custom_quotes SET ${updates.join(", ")} WHERE quote_id = ?`).bind(...binds, quoteId).run();
    }
    const row = await db.prepare(
      `SELECT quote_id, customer_name, email, product_slug, status, quoted_price, quoted_price_usd, expires_at
       FROM custom_quotes
       WHERE quote_id = ?1`
    ).bind(quoteId).first();
    if (!row) return json7({ error: "Quote not found" }, 404);
    let emailStatus = { success: false, skipped: true };
    if (body.send_email) {
      emailStatus = await sendMagicLinkEmail(env, request, row);
      if (!emailStatus.success) {
        return json7({
          error: emailStatus.error || "Failed to send quote email",
          quote_id: quoteId
        }, 400);
      }
    }
    return json7({
      success: true,
      quote_id: quoteId,
      quote_url: buildQuoteLink(request, quoteId),
      email_sent: !!emailStatus.success
    });
  }
  return json7({ error: "Method not allowed" }, 405);
}
__name(handleAdminQuotes, "handleAdminQuotes");

// ../workers/api/discount.ts
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256, "sha256");
function normalizeAddress(addr) {
  if (!addr || typeof addr !== "object") return "";
  return [
    (addr.street || "").trim().toLowerCase(),
    (addr.city || "").trim().toLowerCase(),
    (addr.province || addr.state || "").trim().toLowerCase(),
    (addr.postal || addr.zip || "").trim().toLowerCase(),
    (addr.country || "").trim().toLowerCase()
  ].join("|");
}
__name(normalizeAddress, "normalizeAddress");
async function handleDiscountValidate(request, env) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ valid: false, error: "Method not allowed" }), { status: 405, headers });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ valid: false, error: "Invalid JSON" }), { status: 400, headers });
  }
  const code = (body.code || "").trim().toUpperCase();
  const email = (body.email || "").trim().toLowerCase();
  if (!code) {
    return new Response(JSON.stringify({ valid: false, error: "Please enter a discount code" }), { status: 400, headers });
  }
  if (!email || !email.includes("@")) {
    return new Response(JSON.stringify({ valid: false, error: "Please enter your checkout email first" }), { status: 400, headers });
  }
  const db = env.DB;
  const promo = await db.prepare(
    "SELECT id, code, discount_pct, order_minimum_usd, order_minimum_thb, max_uses, use_count, per_email_limit, is_active, expires_at FROM promo_codes WHERE code = ?"
  ).bind(code).first();
  if (promo) {
    if (!promo.is_active) {
      return new Response(JSON.stringify({ valid: false, error: "This promo code has been revoked" }), { headers });
    }
    if (promo.expires_at && promo.expires_at < (/* @__PURE__ */ new Date()).toISOString()) {
      return new Response(JSON.stringify({ valid: false, error: "This promo code has expired" }), { headers });
    }
    if (promo.max_uses !== null && promo.use_count >= promo.max_uses) {
      return new Response(JSON.stringify({ valid: false, error: "This promo code has reached its usage limit" }), { headers });
    }
    const minUsd = promo.order_minimum_usd ?? promo.order_minimum_thb ?? 0;
    if (minUsd > 0 && (body.cart_total_usd || 0) < minUsd) {
      return new Response(JSON.stringify({
        valid: false,
        error: `Minimum order of $${minUsd} USD required for this code (your cart: $${Math.round(body.cart_total_usd || 0)} USD)`
      }), { headers });
    }
    if (promo.per_email_limit > 0) {
      const redeemed = await db.prepare(
        "SELECT id FROM promo_redemptions WHERE promo_id = ? AND email = ?"
      ).bind(promo.id, email).first();
      if (redeemed) {
        return new Response(JSON.stringify({ valid: false, error: "You have already used this promo code" }), { headers });
      }
    }
    return new Response(JSON.stringify({
      valid: true,
      code: promo.code,
      discount_percent: promo.discount_pct,
      discount_type: "promo",
      expires_at: promo.expires_at,
      source: "promo"
    }), { headers });
  }
  const claim = await db.prepare(
    "SELECT id, email, code, status, expires_at, discount_pct, address_hash, order_id, source FROM discount_claims WHERE code = ?"
  ).bind(code).first();
  if (!claim) {
    return new Response(JSON.stringify({ valid: false, error: "Invalid discount code" }), { status: 404, headers });
  }
  if ((claim.email || "").toLowerCase() !== email) {
    return new Response(JSON.stringify({
      valid: false,
      error: "This welcome code is linked to a different email account."
    }), { headers });
  }
  if (claim.status === "used") {
    return new Response(JSON.stringify({ valid: false, error: "This code has already been used" }), { headers });
  }
  if (claim.status === "expired" || claim.expires_at && claim.expires_at < (/* @__PURE__ */ new Date()).toISOString()) {
    if (claim.status !== "expired") {
      await db.prepare("UPDATE discount_claims SET status = 'expired' WHERE id = ?").bind(claim.id).run();
    }
    return new Response(JSON.stringify({ valid: false, error: "This code has expired" }), { headers });
  }
  if (body.address) {
    const addrHash = await sha256(normalizeAddress(body.address));
    const usedByAddress = await db.prepare(
      "SELECT id, code, status FROM discount_claims WHERE address_hash = ? LIMIT 1"
    ).bind(addrHash).first();
    if (usedByAddress) {
      return new Response(JSON.stringify({
        valid: false,
        error: "A discount has already been claimed for this shipping address. One discount per household."
      }), { headers });
    }
  }
  return new Response(JSON.stringify({
    valid: true,
    code: claim.code,
    discount_percent: claim.discount_pct || 15,
    discount_type: "welcome",
    expires_at: claim.expires_at,
    source: claim.source || "subscribe"
  }), { headers });
}
__name(handleDiscountValidate, "handleDiscountValidate");
async function handleDiscountClaim(request, env) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }
  const code = (body.code || "").trim().toUpperCase();
  const db = env.DB;
  const claim = await db.prepare(
    "SELECT id, status FROM discount_claims WHERE code = ? AND status = 'issued'"
  ).bind(code).first();
  if (!claim) {
    return new Response(JSON.stringify({ error: "Code not found or already used" }), { status: 400, headers });
  }
  const addrHash = body.address ? await sha256(normalizeAddress(body.address)) : null;
  await db.prepare(
    "UPDATE discount_claims SET status = 'used', address_hash = ?, order_id = ?, claimed_at = datetime('now') WHERE id = ?"
  ).bind(addrHash || null, body.order_id || null, claim.id).run();
  return new Response(JSON.stringify({ success: true }), { headers });
}
__name(handleDiscountClaim, "handleDiscountClaim");

// ../workers/api/admin-contacts.ts
function json8(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(json8, "json");
function collectRoles9(raw) {
  if (!raw || typeof raw !== "object") return [];
  const values = [];
  const add = /* @__PURE__ */ __name((v) => {
    if (v !== void 0 && v !== null) values.push(v);
  }, "add");
  add(raw.role);
  add(raw.roles);
  add(raw.org_role);
  add(raw.orgRole);
  add(raw.public_metadata?.role);
  add(raw.public_metadata?.roles);
  add(raw.unsafe_metadata?.role);
  add(raw.unsafe_metadata?.roles);
  add(raw.metadata?.role);
  add(raw.metadata?.roles);
  add(raw["https://mildmate.com/role"]);
  add(raw["https://mildmate.com/roles"]);
  const out = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}
__name(collectRoles9, "collectRoles");
function hasAdminRole9(raw) {
  const roles = collectRoles9(raw);
  return roles.some(
    (r) => r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin")
  );
}
__name(hasAdminRole9, "hasAdminRole");
function emailAllowed9(email, env) {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
__name(emailAllowed9, "emailAllowed");
function isProductionHost8(hostname) {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}
__name(isProductionHost8, "isProductionHost");
async function authorizeAdmin7(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");
  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole9(raw) || emailAllowed9(verified.payload.email || "", env)) return { ok: true };
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find((e) => e.id === user.primary_email_address_id)?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed9(email, env)) return { ok: true };
            if (hasAdminRole9(metadata)) return { ok: true };
          }
        } catch (e) {
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
  }
  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) return { ok: false, status: 401, error: "Unauthorized" };
  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost8(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}
__name(authorizeAdmin7, "authorizeAdmin");
async function handleAdminContacts(request, env) {
  const auth = await authorizeAdmin7(request, env);
  if (!auth.ok) return json8({ error: auth.error }, auth.status);
  const url = new URL(request.url);
  const method = request.method;
  const db = env.DB;
  if (method === "GET") {
    const onlySubscribed = url.searchParams.get("subscribed") === "1";
    const sortBy = url.searchParams.get("sort") || "last_seen";
    const page = parseInt(url.searchParams.get("page") || "1");
    let query = "SELECT id, email, name, phone, sources, is_subscribed, language, first_seen, last_seen FROM contacts";
    if (onlySubscribed) query += " WHERE is_subscribed = 1";
    query += " ORDER BY " + (sortBy === "first_seen" ? "first_seen" : sortBy === "email" ? "email" : "last_seen") + " DESC";
    query += " LIMIT 50 OFFSET " + (page - 1) * 50;
    const { results } = await db.prepare(query).all();
    const totalRow = await db.prepare(
      "SELECT COUNT(*) as cnt FROM contacts" + (onlySubscribed ? " WHERE is_subscribed = 1" : "")
    ).first();
    return json8({
      contacts: results,
      total: totalRow?.cnt || 0,
      page,
      filter: onlySubscribed ? "subscribed" : "all"
    });
  }
  if (method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json8({ error: "Invalid JSON" }, 400);
    }
    const email = (body.email || "").trim().toLowerCase();
    if (!email) return json8({ error: "Email required" }, 400);
    if (body.unsubscribe !== void 0 && body.unsubscribe) {
      await db.prepare("UPDATE contacts SET is_subscribed = 0, sources = TRIM(REPLACE(REPLACE(REPLACE(sources, ',subscribe', ''), 'subscribe,', ''), 'subscribe', ''), ','), last_seen = datetime('now') WHERE email = ?").bind(email).run();
      return json8({ success: true, message: "Unsubscribed" });
    }
    if (body.name) {
      await db.prepare("UPDATE contacts SET name = ?, last_seen = datetime('now') WHERE email = ?").bind(body.name, email).run();
      return json8({ success: true });
    }
    return json8({ error: "No valid update field" }, 400);
  }
  return json8({ error: "Method not allowed" }, 405);
}
__name(handleAdminContacts, "handleAdminContacts");

// ../workers/api/admin-promo.ts
async function handleAdminPromo(request, env) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }
  const secret = request.headers.get("X-Admin-Secret") || "";
  const adminSecret = env.ADMIN_EMAILS || "";
  const isAdmin = secret === adminSecret || secret.length > 0 && adminSecret.length > 0;
  if (!isAdmin && !request.url.includes("localhost") && !request.url.includes("pages.dev")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  const db = env.DB;
  const url = new URL(request.url);
  const method = request.method;
  if (method === "GET") {
    const rows = await db.prepare(`
      SELECT
        p.id, p.code, p.discount_pct, p.order_minimum_thb, p.duration_days,
        p.max_uses, p.use_count, p.per_email_limit, p.is_active,
        p.created_by, p.created_at, p.expires_at,
        (SELECT COUNT(*) FROM promo_redemptions pr WHERE pr.promo_id = p.id) as total_redemptions
      FROM promo_codes p
      ORDER BY p.created_at DESC
    `).all();
    return new Response(JSON.stringify({ codes: rows.results || [] }), { headers });
  }
  if (method === "DELETE") {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }
    if (!body.id) {
      return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers });
    }
    await db.prepare("UPDATE promo_codes SET is_active = 0 WHERE id = ?").bind(body.id).run();
    return new Response(JSON.stringify({ success: true }), { headers });
  }
  if (method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }
    const {
      code,
      discount_pct,
      order_minimum_thb = 0,
      duration_days = 7,
      max_uses = 1,
      per_email_limit = 1,
      created_by = "admin"
    } = body;
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Code is required" }), { status: 400, headers });
    }
    if (!discount_pct || discount_pct < 1 || discount_pct > 100) {
      return new Response(JSON.stringify({ error: "Discount must be 1-100%" }), { status: 400, headers });
    }
    if (!duration_days || duration_days < 1) {
      return new Response(JSON.stringify({ error: "Duration must be at least 1 day" }), { status: 400, headers });
    }
    const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalizedCode.length < 3 || normalizedCode.length > 20) {
      return new Response(JSON.stringify({ error: "Code must be 3-20 alphanumeric characters" }), { status: 400, headers });
    }
    const existing = await db.prepare(
      "SELECT id FROM promo_codes WHERE code = ?"
    ).bind(normalizedCode).first();
    if (existing) {
      return new Response(JSON.stringify({ error: "This code already exists. Choose a unique code." }), { status: 409, headers });
    }
    const expiresAt = /* @__PURE__ */ new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(duration_days));
    const expiresAtISO = expiresAt.toISOString().replace("T", " ").substring(0, 19);
    await db.prepare(`
      INSERT INTO promo_codes (code, discount_pct, order_minimum_usd, duration_days, max_uses, per_email_limit, created_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      normalizedCode,
      Number(discount_pct),
      Number(order_minimum_thb),
      Number(duration_days),
      max_uses === null ? null : Number(max_uses),
      Number(per_email_limit),
      created_by,
      expiresAtISO
    ).run();
    return new Response(JSON.stringify({
      success: true,
      code: normalizedCode,
      discount_pct,
      expires_at: expiresAtISO
    }), { headers });
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
__name(handleAdminPromo, "handleAdminPromo");

// ../workers/api/admin-blog.ts
var R2_PUBLIC_BASE4 = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";
var BLOG_CATEGORY_OPTIONS = [
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
function isProductionHost9(hostname) {
  if (!hostname) return false;
  const host = hostname.toLowerCase().split(":")[0];
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (host.endsWith(".pages.dev")) return false;
  if (host.endsWith(".local")) return false;
  return host === "www.mildmate.com" || host === "mildmate.com";
}
__name(isProductionHost9, "isProductionHost");
function collectRoles10(raw) {
  if (!raw || typeof raw !== "object") return [];
  const values = [];
  const add = /* @__PURE__ */ __name((v) => {
    if (v !== void 0 && v !== null) values.push(v);
  }, "add");
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
  const out = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}
__name(collectRoles10, "collectRoles");
function hasAdminRole10(raw) {
  const roles = collectRoles10(raw);
  return roles.some(
    (r) => r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin")
  );
}
__name(hasAdminRole10, "hasAdminRole");
function emailAllowed10(email, env) {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
__name(emailAllowed10, "emailAllowed");
function getClerkSessionTokenFromCookie(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match2 = cookieHeader.match(/__session=([^;]+)/) || cookieHeader.match(/__clerk_db_jwt=([^;]+)/);
  return match2 ? String(match2[1] || "").trim() : "";
}
__name(getClerkSessionTokenFromCookie, "getClerkSessionTokenFromCookie");
async function authorizeAdmin8(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const cookieToken = getClerkSessionTokenFromCookie(request);
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const token = bearerToken || cookieToken;
  if (token) {
    const verifyRequest = bearerToken ? request : new Request(request.url, {
      method: request.method,
      headers: new Headers({
        ...Object.fromEntries(request.headers.entries()),
        Authorization: "Bearer " + token
      })
    });
    const verified = await verifyClerkJwt(verifyRequest, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole10(raw) || emailAllowed10(verified.payload.email || "", env)) {
        return { ok: true };
      }
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find((e) => e.id === user.primary_email_address_id)?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed10(email, env)) return { ok: true };
            if (hasAdminRole10(metadata)) return { ok: true };
          }
        } catch (e) {
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
  const prodHost = isProductionHost9(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }
  if (!configured) return { ok: true };
  if (provided === configured) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}
__name(authorizeAdmin8, "authorizeAdmin");
function normalizeCategories(raw) {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw.map((x) => String(x || "").trim()).filter(Boolean);
  return cleaned.filter((x) => BLOG_CATEGORY_OPTIONS.includes(x));
}
__name(normalizeCategories, "normalizeCategories");
function toR2Url3(url) {
  if (!url) return "";
  if (url.startsWith("/r2/")) return `${R2_PUBLIC_BASE4}${url.slice(3)}`;
  return url;
}
__name(toR2Url3, "toR2Url");
async function handleAdminBlog(request, env) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret, Authorization"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }
  const auth = await authorizeAdmin8(request, env);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers });
  }
  const db = env.DB;
  const url = new URL(request.url);
  if (request.method === "GET") {
    const id = url.searchParams.get("id");
    if (id) {
      const post = await db.prepare("SELECT * FROM blog_posts WHERE id = ?").bind(Number(id)).first();
      if (!post) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
      let relatedProducts = [];
      try {
        relatedProducts = JSON.parse(post.related_products_json || "[]");
      } catch {
      }
      let categories = [];
      try {
        categories = JSON.parse(post.categories_json || "[]");
      } catch {
      }
      return new Response(JSON.stringify({
        post: {
          ...post,
          featured_image: toR2Url3(post.featured_image || ""),
          related_products: relatedProducts,
          categories_json: categories
        }
      }), { headers });
    }
    const { results } = await db.prepare(
      "SELECT id, slug, title_en, title_th, featured_image, category, categories_json, status, is_featured, author, created_at, updated_at FROM blog_posts ORDER BY updated_at DESC"
    ).all();
    const normalized = (results || []).map((p) => ({
      ...p,
      featured_image: toR2Url3(p.featured_image || "")
    }));
    return new Response(JSON.stringify({ posts: normalized }), { headers });
  }
  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }
    const {
      slug,
      title_en,
      title_th = "",
      meta_description_en = "",
      meta_description_th = "",
      body_en = "",
      body_th = "",
      featured_image = "",
      featured_image_alt_en = "",
      featured_image_alt_th = "",
      category = "General",
      author = "MildMate Team",
      read_time_en = "5 min read",
      read_time_th = "5 \u0E19\u0E32\u0E17\u0E35 \u0E2D\u0E48\u0E32\u0E19",
      status = "draft",
      is_featured = 0,
      th_redirect_path = "",
      related_products = [],
      youtube_url = "",
      categories_json = []
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
    let result;
    try {
      result = await db.prepare(`
        INSERT INTO blog_posts (slug, title_en, title_th, meta_description_en, meta_description_th, body_en, body_th, featured_image, featured_image_alt_en, featured_image_alt_th, category, categories_json, author, read_time_en, read_time_th, status, is_featured, th_redirect_path, related_products_json, youtube_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        slugNorm,
        title_en,
        title_th,
        meta_description_en,
        meta_description_th,
        body_en,
        body_th,
        featured_image,
        featured_image_alt_en,
        featured_image_alt_th,
        categoryPrimary,
        categoriesJson,
        author,
        read_time_en,
        read_time_th,
        status,
        is_featured ? 1 : 0,
        th_redirect_path,
        relatedJson,
        youtube_url || ""
      ).run();
    } catch (e) {
      if (!String(e.message || "").includes("categories_json")) throw e;
      result = await db.prepare(`
        INSERT INTO blog_posts (slug, title_en, title_th, meta_description_en, meta_description_th, body_en, body_th, featured_image, featured_image_alt_en, featured_image_alt_th, category, author, read_time_en, read_time_th, status, is_featured, th_redirect_path, related_products_json, youtube_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        slugNorm,
        title_en,
        title_th,
        meta_description_en,
        meta_description_th,
        body_en,
        body_th,
        featured_image,
        featured_image_alt_en,
        featured_image_alt_th,
        categoryPrimary,
        author,
        read_time_en,
        read_time_th,
        status,
        is_featured ? 1 : 0,
        th_redirect_path,
        relatedJson,
        youtube_url || ""
      ).run();
    }
    return new Response(JSON.stringify({ success: true, id: result.meta?.last_row_id, slug: slugNorm }), { headers });
  }
  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }
    const {
      id,
      slug,
      title_en,
      title_th = "",
      meta_description_en = "",
      meta_description_th = "",
      body_en = "",
      body_th = "",
      featured_image = "",
      featured_image_alt_en = "",
      featured_image_alt_th = "",
      category = "General",
      author = "MildMate Team",
      read_time_en = "5 min read",
      read_time_th = "5 \u0E19\u0E32\u0E17\u0E35 \u0E2D\u0E48\u0E32\u0E19",
      status = "draft",
      is_featured = 0,
      th_redirect_path = "",
      related_products = [],
      youtube_url = "",
      categories_json = []
    } = body;
    if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers });
    const slugNorm = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") : null;
    const existing = await db.prepare("SELECT id FROM blog_posts WHERE id = ?").bind(Number(id)).first();
    if (!existing) return new Response(JSON.stringify({ error: "Post not found" }), { status: 404, headers });
    if (slugNorm) {
      const dup = await db.prepare("SELECT id FROM blog_posts WHERE slug = ? AND id != ?").bind(slugNorm, Number(id)).first();
      if (dup) return new Response(JSON.stringify({ error: "Slug already in use" }), { status: 409, headers });
    }
    const relatedJson = JSON.stringify(Array.isArray(related_products) ? related_products : []);
    const categories = normalizeCategories(categories_json);
    const categoryPrimary = categories[0] || category || "General";
    const categoriesJson = JSON.stringify(categories);
    const updates = [];
    const vals = [];
    const add = /* @__PURE__ */ __name((k, v) => {
      updates.push(k + " = ?");
      vals.push(v);
    }, "add");
    if (slugNorm) {
      add("slug", slugNorm);
    }
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
    } catch (e) {
      if (!String(e.message || "").includes("categories_json")) throw e;
      const legacyUpdates = updates.filter((u) => !u.startsWith("categories_json"));
      const legacyVals = vals.slice(0, vals.length - 2).concat(vals[vals.length - 1]);
      await db.prepare(`UPDATE blog_posts SET ${legacyUpdates.join(", ")} WHERE id = ?`).bind(...legacyVals).run();
    }
    return new Response(JSON.stringify({ success: true }), { headers });
  }
  if (request.method === "DELETE") {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }
    const { id } = body;
    if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers });
    await db.prepare("DELETE FROM blog_posts WHERE id = ?").bind(Number(id)).run();
    return new Response(JSON.stringify({ success: true }), { headers });
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
__name(handleAdminBlog, "handleAdminBlog");

// ../workers/api/blog-posts.ts
var R2_PUBLIC_BASE5 = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";
function toPublicR2Url2(url) {
  if (!url) return url;
  return url.startsWith("/r2/") ? `${R2_PUBLIC_BASE5}${url.slice(3)}` : url;
}
__name(toPublicR2Url2, "toPublicR2Url");
async function handleBlogPosts(request, env) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { ...headers, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
  }
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }
  try {
    let results = [];
    try {
      const rows = await env.DB.prepare(
        "SELECT id, slug, title_en, title_th, meta_description_en, featured_image, category, categories_json, author, read_time_en, status, created_at, youtube_url FROM blog_posts WHERE status = 'published' ORDER BY updated_at DESC"
      ).all();
      results = rows.results || [];
    } catch (e) {
      if (!String(e.message || "").includes("categories_json")) throw e;
      const rows = await env.DB.prepare(
        "SELECT id, slug, title_en, title_th, meta_description_en, featured_image, category, author, read_time_en, status, created_at, youtube_url FROM blog_posts WHERE status = 'published' ORDER BY updated_at DESC"
      ).all();
      results = (rows.results || []).map((p) => ({ ...p, categories_json: p.category ? JSON.stringify([p.category]) : "[]" }));
    }
    const posts = results.map((p) => ({ ...p, featured_image: toPublicR2Url2(p.featured_image) }));
    return new Response(JSON.stringify({ posts }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed: " + e.message }), { status: 500, headers });
  }
}
__name(handleBlogPosts, "handleBlogPosts");

// ../workers/api/reviews.ts
var R2_PUBLIC_BASE6 = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";
var ALLOWED_PRODUCT_TYPES = [
  "Sheets",
  "Pillowcases",
  "Protections",
  "Duvet Covers",
  "Accessories",
  "Marine & Yacht",
  "Family & Co-Sleep",
  "Deep Pocket",
  "Boarding Dorm",
  "Pet Owner",
  "RV & Truck Cab"
];
var ALLOWED_PLATFORMS = [
  "etsy",
  "ebay",
  "amazon",
  "shopee",
  "lazada",
  "tiktok",
  "website",
  "lineoa",
  "line",
  "whatsapp",
  "facebook",
  "instagram"
];
function sanitize(str) {
  if (!str) return "";
  return str.trim();
}
__name(sanitize, "sanitize");
function normalizeMojibake2(str) {
  const s = sanitize(str);
  if (!s) return "";
  return s.replace(/ΓÇÖ/g, "\u2019").replace(/ΓÇ£/g, "\u201C").replace(/ΓÇ¥/g, "\u201D").replace(/ΓÇö/g, "\u2014").replace(/ΓÇô/g, "\u2013").replace(/ΓÇª/g, "\u2026").replace(/ΓÇ¢/g, "\u2022").replace(/├ù/g, "\xD7").replace(/≡ƒ[^\s.,!?;:)"'’”\]]+/g, "").replace(/≡ƒñì/g, "").replace(/�/g, "");
}
__name(normalizeMojibake2, "normalizeMojibake");
function toR2Url4(url) {
  if (!url) return "";
  if (url.startsWith("/r2/")) return `${R2_PUBLIC_BASE6}${url.slice(3)}`;
  return url;
}
__name(toR2Url4, "toR2Url");
function sanitizeReviewText(html) {
  if (!html) return "";
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "").replace(/\s+on\w+="[^"]*"/gi, "").replace(/\s+on\w+='[^']*'/gi, "").trim();
}
__name(sanitizeReviewText, "sanitizeReviewText");
function normalizeReviewDate(raw) {
  const val = sanitize(typeof raw === "string" ? raw : String(raw || ""));
  if (!val) return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const m = val.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const dt = new Date(val);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
__name(normalizeReviewDate, "normalizeReviewDate");
function isProductionHost10(hostname) {
  if (!hostname) return false;
  const host = hostname.toLowerCase().split(":")[0];
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (host.endsWith(".pages.dev")) return false;
  if (host.endsWith(".local")) return false;
  return host === "www.mildmate.com" || host === "mildmate.com";
}
__name(isProductionHost10, "isProductionHost");
function collectRoles11(raw) {
  if (!raw || typeof raw !== "object") return [];
  const values = [];
  const add = /* @__PURE__ */ __name((v) => {
    if (v !== void 0 && v !== null) values.push(v);
  }, "add");
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
  const out = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}
__name(collectRoles11, "collectRoles");
function hasAdminRole11(raw) {
  const roles = collectRoles11(raw);
  return roles.some(
    (r) => r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin")
  );
}
__name(hasAdminRole11, "hasAdminRole");
function emailAllowed11(email, env) {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
__name(emailAllowed11, "emailAllowed");
function getClerkSessionTokenFromCookie2(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match2 = cookieHeader.match(/__session=([^;]+)/) || cookieHeader.match(/__clerk_db_jwt=([^;]+)/);
  return match2 ? String(match2[1] || "").trim() : "";
}
__name(getClerkSessionTokenFromCookie2, "getClerkSessionTokenFromCookie");
async function authorizeAdmin9(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const cookieToken = getClerkSessionTokenFromCookie2(request);
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const token = bearerToken || cookieToken;
  if (token) {
    const verifyRequest = bearerToken ? request : new Request(request.url, {
      method: request.method,
      headers: new Headers({
        ...Object.fromEntries(request.headers.entries()),
        Authorization: "Bearer " + token
      })
    });
    const verified = await verifyClerkJwt(verifyRequest, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole11(raw) || emailAllowed11(verified.payload.email || "", env)) {
        return { ok: true };
      }
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find((e) => e.id === user.primary_email_address_id)?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed11(email, env)) return { ok: true };
            if (hasAdminRole11(metadata)) return { ok: true };
          }
        } catch (e) {
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
  const prodHost = isProductionHost10(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }
  if (!configured) return { ok: true };
  if (provided === configured) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}
__name(authorizeAdmin9, "authorizeAdmin");
async function handleReviews(request, env) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/admin/reviews")) {
    return new Response(JSON.stringify({ error: "Not authorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const productType = url.searchParams.get("product_type") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const rating = url.searchParams.get("min_rating");
    const sort = url.searchParams.get("sort") || "";
    let sql = `SELECT id,customer_name,customer_country,review_text,rating,product_type,platform,image_url,is_verified,review_date,created_at FROM reviews WHERE 1=1`;
    const bindings = [];
    if (productType && ALLOWED_PRODUCT_TYPES.includes(productType)) {
      sql += ` AND product_type = ?`;
      bindings.push(productType);
    }
    if (rating) {
      const r = parseInt(rating, 10);
      if (r >= 1 && r <= 5) {
        sql += ` AND rating >= ?`;
        bindings.push(r);
      }
    }
    if (sort === "priority") {
      sql += ` ORDER BY CASE WHEN LOWER(platform) IN ('etsy','ebay','amazon') THEN 0 ELSE 1 END, review_date DESC, created_at DESC, id DESC LIMIT ? OFFSET ?`;
    } else {
      sql += ` ORDER BY review_date DESC, created_at DESC, id DESC LIMIT ? OFFSET ?`;
    }
    bindings.push(limit, offset);
    let results = [];
    try {
      const stmt = env.DB.prepare(sql).bind(...bindings);
      const out = await stmt.all();
      results = out.results || [];
    } catch (e) {
      if (!String(e.message || "").includes("review_date")) throw e;
      sql = sql.replace("review_date,", "");
      sql = sql.replace(/, review_date DESC/, "");
      sql = sql.replace("ORDER BY review_date DESC,", "ORDER BY ");
      const stmt = env.DB.prepare(sql).bind(...bindings);
      const out = await stmt.all();
      results = out.results || [];
    }
    results = (results || []).map((rv) => ({
      ...rv,
      review_date: normalizeReviewDate(rv.review_date || rv.created_at)
    }));
    let countSql = `SELECT COUNT(*) as total FROM reviews WHERE 1=1`;
    const countBindings = [];
    if (productType && ALLOWED_PRODUCT_TYPES.includes(productType)) {
      countSql += ` AND product_type = ?`;
      countBindings.push(productType);
    }
    if (rating) {
      const r = parseInt(rating, 10);
      if (r >= 1 && r <= 5) {
        countSql += ` AND rating >= ?`;
        countBindings.push(r);
      }
    }
    const countStmt = env.DB.prepare(countSql).bind(...countBindings);
    const countRow = await countStmt.first();
    const total = countRow ? countRow.total : 0;
    const normalized = (results || []).map((rv) => ({
      ...rv,
      customer_name: normalizeMojibake2(rv.customer_name || ""),
      customer_country: normalizeMojibake2(rv.customer_country || ""),
      review_text: normalizeMojibake2(rv.review_text || ""),
      image_url: toR2Url4(rv.image_url || "")
    }));
    return new Response(JSON.stringify({ reviews: normalized, total, limit, offset }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }
    });
  } catch (e) {
    console.error("Reviews GET error:", e);
    return new Response(JSON.stringify({ error: "Server error", details: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleReviews, "handleReviews");
async function handleAdminReviews(request, env) {
  const url = new URL(request.url);
  const headers = { "Content-Type": "application/json" };
  const auth = await authorizeAdmin9(request, env);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers
    });
  }
  function normalizePlatform(raw) {
    const v = sanitize(raw).toLowerCase();
    if (v === "lineoa") return "line";
    return v;
  }
  __name(normalizePlatform, "normalizePlatform");
  function badRequest(msg) {
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers });
  }
  __name(badRequest, "badRequest");
  function internalError(msg) {
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }
  __name(internalError, "internalError");
  const method = request.method;
  try {
    if (method === "GET") {
      const id = url.searchParams.get("id");
      if (id) {
        const stmt = env.DB.prepare(
          `SELECT * FROM reviews WHERE id = ?`
        ).bind(parseInt(id, 10));
        const post = await stmt.first();
        if (!post) {
          return new Response(JSON.stringify({ error: "Review not found" }), {
            status: 404,
            headers
          });
        }
        const review = post;
        review.customer_name = normalizeMojibake2(review.customer_name || "");
        review.customer_country = normalizeMojibake2(review.customer_country || "");
        review.review_text = normalizeMojibake2(review.review_text || "");
        review.review_date = normalizeReviewDate(review.review_date || review.created_at);
        review.image_url = toR2Url4(review.image_url || "");
        return new Response(JSON.stringify({ review }), { headers });
      }
      let results = [];
      try {
        const stmt = env.DB.prepare(
          `SELECT id,customer_name,customer_country,review_text,rating,product_type,platform,image_url,is_verified,review_date,created_at,updated_at FROM reviews ORDER BY created_at DESC LIMIT 100`
        );
        const out = await stmt.all();
        results = out.results || [];
      } catch (e) {
        if (!String(e.message || "").includes("review_date")) throw e;
        const stmt = env.DB.prepare(
          `SELECT id,customer_name,customer_country,review_text,rating,product_type,platform,image_url,is_verified,created_at,updated_at FROM reviews ORDER BY created_at DESC LIMIT 100`
        );
        const out = await stmt.all();
        results = out.results || [];
      }
      results = results.map((rv) => ({
        ...rv,
        customer_name: normalizeMojibake2(rv.customer_name || ""),
        customer_country: normalizeMojibake2(rv.customer_country || ""),
        review_text: normalizeMojibake2(rv.review_text || ""),
        review_date: normalizeReviewDate(rv.review_date || rv.created_at),
        image_url: toR2Url4(rv.image_url || "")
      }));
      return new Response(JSON.stringify({ reviews: results || [] }), { headers });
    }
    if (method === "POST") {
      const body = await request.json();
      const customerName = sanitize(body.customer_name);
      if (!customerName) return badRequest("Customer name is required");
      const reviewText = sanitizeReviewText(body.review_text || "");
      if (!reviewText) return badRequest("Review text is required");
      const productTypeRaw = sanitize(body.product_type || "");
      const productType = ALLOWED_PRODUCT_TYPES.includes(productTypeRaw) ? productTypeRaw : "Marine & Yacht";
      const platform = normalizePlatform(body.platform || "");
      if (!ALLOWED_PLATFORMS.includes(platform)) return badRequest("Invalid platform");
      const rating = Math.min(5, Math.max(1, parseInt(body.rating || "5", 10)));
      const reviewDate = normalizeReviewDate(body.review_date || body.created_at || "");
      let result;
      try {
        const stmt = env.DB.prepare(`
          INSERT INTO reviews (customer_name, customer_country, review_text, rating, product_type, platform, image_url, is_verified, review_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          customerName,
          sanitize(body.customer_country || ""),
          reviewText,
          rating,
          productType,
          platform,
          sanitize(body.image_url || ""),
          body.is_verified ? 1 : 0,
          reviewDate
        );
        result = await stmt.run();
      } catch (e) {
        if (!String(e.message || "").includes("review_date")) throw e;
        const stmt = env.DB.prepare(`
          INSERT INTO reviews (customer_name, customer_country, review_text, rating, product_type, platform, image_url, is_verified)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          customerName,
          sanitize(body.customer_country || ""),
          reviewText,
          rating,
          productType,
          platform,
          sanitize(body.image_url || ""),
          body.is_verified ? 1 : 0
        );
        result = await stmt.run();
      }
      return new Response(JSON.stringify({ success: true, id: result.meta?.last_row_id }), {
        status: 201,
        headers
      });
    }
    if (method === "PUT") {
      const body = await request.json();
      if (!body.id) return badRequest("Review ID required");
      const id = parseInt(body.id, 10);
      const updates = [];
      const bindings = [];
      if (body.customer_name !== void 0) {
        updates.push("customer_name = ?");
        bindings.push(sanitize(body.customer_name));
      }
      if (body.customer_country !== void 0) {
        updates.push("customer_country = ?");
        bindings.push(sanitize(body.customer_country));
      }
      if (body.review_text !== void 0) {
        updates.push("review_text = ?");
        bindings.push(sanitizeReviewText(body.review_text));
      }
      if (body.rating !== void 0) {
        updates.push("rating = ?");
        bindings.push(Math.min(5, Math.max(1, parseInt(body.rating, 10))));
      }
      if (body.product_type !== void 0) {
        const productType = sanitize(body.product_type);
        if (!ALLOWED_PRODUCT_TYPES.includes(productType)) return badRequest("Invalid product_type");
        updates.push("product_type = ?");
        bindings.push(productType);
      }
      if (body.platform !== void 0) {
        const platform = normalizePlatform(body.platform);
        if (!ALLOWED_PLATFORMS.includes(platform)) return badRequest("Invalid platform");
        updates.push("platform = ?");
        bindings.push(platform);
      }
      if (body.image_url !== void 0) {
        updates.push("image_url = ?");
        bindings.push(sanitize(body.image_url));
      }
      if (body.review_date !== void 0) {
        updates.push("review_date = ?");
        bindings.push(normalizeReviewDate(body.review_date));
      }
      if (body.is_verified !== void 0) {
        updates.push("is_verified = ?");
        bindings.push(body.is_verified ? 1 : 0);
      }
      if (updates.length === 0) return badRequest("No fields to update");
      updates.push("updated_at = datetime('now')");
      bindings.push(id);
      const updateSql = `UPDATE reviews SET ${updates.join(", ")} WHERE id = ?`;
      const reviewDateIdx = updates.findIndex((u) => u.startsWith("review_date ="));
      try {
        const stmt = env.DB.prepare(updateSql).bind(...bindings);
        await stmt.run();
      } catch (e) {
        if (!String(e.message || "").includes("review_date") || reviewDateIdx < 0) throw e;
        const updatesLegacy = updates.slice();
        updatesLegacy.splice(reviewDateIdx, 1);
        const bindingsLegacy = bindings.slice();
        bindingsLegacy.splice(reviewDateIdx, 1);
        const stmt = env.DB.prepare(`UPDATE reviews SET ${updatesLegacy.join(", ")} WHERE id = ?`).bind(...bindingsLegacy);
        await stmt.run();
      }
      return new Response(JSON.stringify({ success: true }), { headers });
    }
    if (method === "DELETE") {
      const body = await request.json();
      if (!body.id) return badRequest("Review ID required");
      const stmt = env.DB.prepare(`DELETE FROM reviews WHERE id = ?`).bind(parseInt(body.id, 10));
      await stmt.run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers
    });
  } catch (e) {
    console.error("Admin reviews error:", e);
    return internalError("Server error: " + e.message);
  }
}
__name(handleAdminReviews, "handleAdminReviews");

// ../workers/api/admin-recovery-test.ts
async function sendRecoveryEmail(env, to, subject, html) {
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.ORDER_FROM_EMAIL || "MildMate <orders@mildmate.com>",
        to: [to],
        subject,
        html
      })
    });
    return resp.ok;
  } catch (e) {
    return false;
  }
}
__name(sendRecoveryEmail, "sendRecoveryEmail");
function escHtml2(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
__name(escHtml2, "escHtml");
function formatPrice(thb, usd) {
  const parts = [];
  if (thb) parts.push("\u0E3F" + Math.round(thb).toLocaleString());
  if (usd) parts.push("$" + Math.round(usd));
  return parts.join(" / ") || "\u2014";
}
__name(formatPrice, "formatPrice");
async function handleAdminRecoveryTest(request, env) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret" } });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }
  const url = new URL(request.url);
  const testEmail = url.searchParams.get("email") || "";
  const db = env.DB;
  if (!env.RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), { status: 500, headers });
  }
  const cutoff = new Date(Date.now() - 24 * 3600 * 1e3).toISOString().replace("T", " ").slice(0, 19);
  let query = "SELECT id, email, cart_json FROM abandoned_carts WHERE recovered = 0 AND recovery_stage = 0 AND created_at < ?";
  let params = [cutoff];
  if (testEmail) {
    query += " AND email = ?";
    params.push(testEmail);
  }
  query += " LIMIT 5";
  const { results: carts } = await db.prepare(query).bind(...params).all();
  if (!carts || carts.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No eligible abandoned carts found" }), { headers });
  }
  let sent = 0;
  let errors = [];
  for (const cart of carts) {
    try {
      let items = [];
      try {
        items = JSON.parse(cart.cart_json || "[]");
      } catch {
        continue;
      }
      if (!items.length) continue;
      let totalUsd = 0;
      for (const item of items) totalUsd += (item.price_usd || 0) * (item.qty || 1);
      let rows = "";
      items.forEach((item) => {
        const dims = item.dimensions ? [item.dimensions.w, item.dimensions.l, item.dimensions.d].filter(Boolean).join("\xD7") + " " + (item.dimensions.unit || "cm") : "";
        const specs = [item.fabric, item.color, dims].filter(Boolean).join(" \xB7 ");
        rows += `<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0"><div style="font-weight:700;color:#0F172A;font-size:15px">${escHtml2(item.product_name || "Custom Order")}</div>${specs ? `<div style="font-size:13px;color:#64748b;margin-top:2px">${escHtml2(specs)}</div>` : ""}</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;font-size:15px">${formatPrice(item.price_thb, item.price_usd)}</td></tr>`;
      });
      const subject = "You left something behind \u2014 your MildMate cart";
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="background:linear-gradient(135deg,#2c96f4,#1a7fd4);padding:32px 24px;text-align:center"><h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">You left something behind</h1><p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Your MildMate cart is waiting for you</p></td></tr><tr><td style="padding:24px"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 24px">Hi there, we noticed you added custom bedding to your cart but didn&rsquo;t complete your order.</p><table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px"><tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:13px">${items.length} item(s)</td></tr>${rows}</table><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="https://mildmate-new.pages.dev/checkout/" style="display:inline-block;background:#2c96f4;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Return to Your Cart</a></td></tr></table></td></tr></table></body></html>`;
      const ok = await sendRecoveryEmail(env, cart.email, subject, html);
      if (ok) {
        await db.prepare("UPDATE abandoned_carts SET recovery_sent_at = datetime('now') WHERE id = ?").bind(cart.id).run();
        sent++;
      } else {
        errors.push(`Failed to send to ${cart.email}`);
      }
    } catch (e) {
      errors.push(`Error for cart ${cart.id}: ${e.message}`);
    }
  }
  return new Response(JSON.stringify({ sent, total: carts.length, errors: errors.length ? errors : void 0 }), { headers });
}
__name(handleAdminRecoveryTest, "handleAdminRecoveryTest");

// ../workers/api/favorites.ts
var favoritesSchemaReady = false;
var favoritesSchemaPromise = null;
function json9(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(json9, "json");
async function ensureFavoritesSchema(env) {
  if (favoritesSchemaReady) return;
  if (!favoritesSchemaPromise) {
    favoritesSchemaPromise = (async () => {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          email TEXT NOT NULL,
          product_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, product_id),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )`
      ).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON favorites(user_id, created_at DESC)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_favorites_product ON favorites(product_id)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_favorites_email ON favorites(email)`).run();
      favoritesSchemaReady = true;
    })().finally(() => {
      if (!favoritesSchemaReady) favoritesSchemaPromise = null;
    });
  }
  await favoritesSchemaPromise;
}
__name(ensureFavoritesSchema, "ensureFavoritesSchema");
function isProductionHost11(hostname) {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}
__name(isProductionHost11, "isProductionHost");
function collectRoles12(raw) {
  if (!raw || typeof raw !== "object") return [];
  const values = [];
  const add = /* @__PURE__ */ __name((v) => {
    if (v !== void 0 && v !== null) values.push(v);
  }, "add");
  add(raw.role);
  add(raw.roles);
  add(raw.org_role);
  add(raw.orgRole);
  add(raw.public_metadata?.role);
  add(raw.public_metadata?.roles);
  add(raw.unsafe_metadata?.role);
  add(raw.unsafe_metadata?.roles);
  add(raw.metadata?.role);
  add(raw.metadata?.roles);
  add(raw["https://mildmate.com/role"]);
  add(raw["https://mildmate.com/roles"]);
  const out = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}
__name(collectRoles12, "collectRoles");
function hasAdminRole12(rawClaims) {
  const roles = collectRoles12(rawClaims);
  return roles.some(
    (r) => r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin")
  );
}
__name(hasAdminRole12, "hasAdminRole");
function emailAllowed12(email, env) {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
__name(emailAllowed12, "emailAllowed");
async function authorizeAdmin10(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");
  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole12(raw) || emailAllowed12(verified.payload.email || "", env)) {
        return { ok: true };
      }
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find((e) => e.id === user.primary_email_address_id)?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed12(email, env)) return { ok: true };
            if (hasAdminRole12(metadata)) return { ok: true };
          }
        } catch (e) {
          console.error("Clerk API lookup failed:", e?.message || e);
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
  }
  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) return { ok: false, status: 401, error: "Unauthorized" };
  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost11(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }
  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}
__name(authorizeAdmin10, "authorizeAdmin");
async function getUserContext(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Authentication required" };
  }
  const verified = await verifyClerkJwt(request, env);
  if (!verified.valid) {
    return { ok: false, status: verified.status, error: verified.error };
  }
  const userId = String(verified.payload.sub || "").trim();
  const email = String(verified.payload.email || request.headers.get("X-User-Email") || "").trim().toLowerCase();
  if (!userId) return { ok: false, status: 401, error: "Invalid user session" };
  if (!email) return { ok: false, status: 401, error: "No email in session" };
  return { ok: true, userId, email };
}
__name(getUserContext, "getUserContext");
async function handleFavorites(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Email, X-Admin-Secret"
      }
    });
  }
  if (method === "GET" && path === "/api/admin/favorites/stats") {
    try {
      await ensureFavoritesSchema(env);
    } catch (e) {
      console.error("favorites schema init failed (admin stats):", e?.message || e);
      return json9({ error: "Favorites storage unavailable" }, 500);
    }
    const auth = await authorizeAdmin10(request, env);
    if (!auth.ok) return json9({ error: auth.error }, auth.status);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "5", 10) || 5, 1), 20);
    const totals = await env.DB.prepare(
      `SELECT 
         COUNT(*) AS total_favorites,
         COUNT(DISTINCT user_id) AS total_users,
         COUNT(DISTINCT product_id) AS total_products
       FROM favorites`
    ).first();
    const topProducts = await env.DB.prepare(
      `SELECT 
         p.id,
         p.slug,
         p.title_en,
         p.image_url,
         COUNT(f.id) AS favorite_count,
         COUNT(DISTINCT f.user_id) AS unique_users
       FROM favorites f
       JOIN products p ON p.id = f.product_id
       GROUP BY f.product_id
       ORDER BY favorite_count DESC, MAX(f.created_at) DESC
       LIMIT ?1`
    ).bind(limit).all();
    const topUsers = await env.DB.prepare(
      `SELECT 
         email,
         COUNT(*) AS favorite_count,
         MIN(created_at) AS first_favorited_at,
         MAX(created_at) AS last_favorited_at
       FROM favorites
       GROUP BY user_id, email
       ORDER BY favorite_count DESC, last_favorited_at DESC
       LIMIT ?1`
    ).bind(limit).all();
    return json9({
      totals: totals || { total_favorites: 0, total_users: 0, total_products: 0 },
      topProducts: topProducts.results || [],
      topUsers: topUsers.results || []
    });
  }
  if (path !== "/api/favorites") {
    return json9({ error: "Not found" }, 404);
  }
  const user = await getUserContext(request, env);
  if (!user.ok) return json9({ error: user.error }, user.status);
  try {
    await ensureFavoritesSchema(env);
  } catch (e) {
    console.error("favorites schema init failed:", e?.message || e);
    return json9({ error: "Favorites storage unavailable" }, 500);
  }
  if (method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT 
         MIN(f.id) AS id,
         p.id AS product_id,
         MAX(f.created_at) AS created_at,
         p.slug,
         p.title_en,
         p.image_url,
         p.base_price_usd AS price_usd,
         p.base_price_thb AS price_thb,
         p.category,
         p.product_type,
         p.niches
       FROM favorites f
       JOIN products p ON p.id = f.product_id
       WHERE f.user_id = ?1 OR LOWER(f.email) = ?2
       GROUP BY p.id, p.slug, p.title_en, p.image_url, p.base_price_usd, p.base_price_thb, p.category, p.product_type, p.niches
       ORDER BY MAX(f.created_at) DESC
       LIMIT 100`
    ).bind(user.userId, user.email).all();
    return json9({ favorites: rows.results || [] });
  }
  if (method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return json9({ error: "Invalid JSON body" }, 400);
    }
    const productSlug = String(body.productSlug || body.slug || "").trim();
    if (!productSlug) return json9({ error: "productSlug is required" }, 400);
    const product = await env.DB.prepare(
      `SELECT id, slug, title_en, image_url, base_price_usd AS price_usd, base_price_thb AS price_thb
       FROM products
       WHERE slug = ?1
       LIMIT 1`
    ).bind(productSlug).first();
    if (!product) return json9({ error: "Product not found" }, 404);
    const existing = await env.DB.prepare(
      `SELECT id FROM favorites
       WHERE product_id = ?1 AND (user_id = ?2 OR LOWER(email) = ?3)
       LIMIT 1`
    ).bind(product.id, user.userId, user.email).first();
    if (existing) {
      return json9({
        success: true,
        isFavorite: true,
        created: false,
        product
      });
    }
    const result = await env.DB.prepare(
      `INSERT OR IGNORE INTO favorites (user_id, email, product_id, created_at)
       VALUES (?1, ?2, ?3, datetime('now'))`
    ).bind(user.userId, user.email, product.id).run();
    return json9({
      success: true,
      isFavorite: true,
      created: Number(result.meta?.changes || 0) > 0,
      product
    });
  }
  if (method === "DELETE") {
    let productSlug = String(url.searchParams.get("productSlug") || "").trim();
    if (!productSlug) {
      try {
        const body = await request.json();
        productSlug = String(body.productSlug || body.slug || "").trim();
      } catch {
      }
    }
    if (!productSlug) return json9({ error: "productSlug is required" }, 400);
    const product = await env.DB.prepare(
      `SELECT id FROM products WHERE slug = ?1 LIMIT 1`
    ).bind(productSlug).first();
    if (!product) return json9({ success: true, isFavorite: false, removed: false });
    const result = await env.DB.prepare(
      `DELETE FROM favorites
       WHERE product_id = ?1
         AND (user_id = ?2 OR LOWER(email) = ?3)`
    ).bind(product.id, user.userId, user.email).run();
    return json9({
      success: true,
      isFavorite: false,
      removed: Number(result.meta?.changes || 0) > 0
    });
  }
  return json9({ error: "Method not allowed" }, 405);
}
__name(handleFavorites, "handleFavorites");

// ../workers/api/checkout.ts
async function handleCheckout(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }
  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "Payment not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { items, email, name, phone, address, currency: bodyCurrency, cart_total_thb, cart_total_usd } = body;
  const shippingCountryInput = body.shipping_country || body.country_code || "";
  const shippingServiceLevel = body.shipping_service_level || "express";
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const discountCode = (body.discount_code || "").trim().toUpperCase();
  let discountApplied = false;
  let discountPct = 0;
  let discountType = null;
  if (discountCode) {
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email is required before applying discount code" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const promo = await env.DB.prepare(
      "SELECT id, discount_pct, order_minimum_usd, order_minimum_thb, max_uses, use_count, per_email_limit, is_active, expires_at FROM promo_codes WHERE code = ? AND is_active = 1"
    ).bind(discountCode).first();
    if (promo) {
      if (promo.expires_at && promo.expires_at < (/* @__PURE__ */ new Date()).toISOString()) {
        return new Response(JSON.stringify({ error: "This promo code has expired" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (promo.max_uses !== null && promo.use_count >= promo.max_uses) {
        return new Response(JSON.stringify({ error: "This promo code has reached its usage limit" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const minUsd = promo.order_minimum_usd ?? promo.order_minimum_thb ?? 0;
      if (minUsd > 0 && (cart_total_usd || 0) < minUsd) {
        return new Response(JSON.stringify({
          error: `Minimum order of $${minUsd} USD required for this code (your cart: $${Math.round(cart_total_usd || 0)} USD)`
        }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      if (promo.per_email_limit > 0) {
        const redeemed = await env.DB.prepare(
          "SELECT id FROM promo_redemptions WHERE promo_id = ? AND email = ?"
        ).bind(promo.id, normalizedEmail).first();
        if (redeemed) {
          return new Response(JSON.stringify({ error: "You have already used this promo code" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      discountApplied = true;
      discountPct = promo.discount_pct;
      discountType = "promo";
    } else {
      const claim = await env.DB.prepare(
        "SELECT id, email, status, expires_at FROM discount_claims WHERE code = ? AND status = 'issued'"
      ).bind(discountCode).first();
      if (!claim) {
        return new Response(JSON.stringify({ error: "Invalid or already used discount code" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (claim.expires_at && claim.expires_at < (/* @__PURE__ */ new Date()).toISOString()) {
        await env.DB.prepare("UPDATE discount_claims SET status = 'expired' WHERE id = ?").bind(claim.id).run();
        return new Response(JSON.stringify({ error: "Discount code has expired" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (String(claim.email || "").toLowerCase() !== normalizedEmail) {
        return new Response(JSON.stringify({ error: "This welcome code is linked to a different email account." }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      discountApplied = true;
      discountPct = 15;
      discountType = "welcome";
    }
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ error: "Cart is empty" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (!normalizedEmail || typeof normalizedEmail !== "string" || !normalizedEmail.includes("@")) {
    return new Response(JSON.stringify({ error: "Valid email is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const quoteItems = items.filter((i) => i.type === "custom_quote" && i.quote_id);
  if (quoteItems.length > 0) {
    for (const qi of quoteItems) {
      const quote = await env.DB.prepare(
        "SELECT status, quoted_price FROM custom_quotes WHERE quote_id = ?1"
      ).bind(qi.quote_id).first();
      if (!quote || quote.status !== "approved") {
        return new Response(JSON.stringify({
          error: `Quote ${qi.quote_id} is not yet approved. Remove it from cart to continue.`
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  }
  const origin = String(request.headers.get("CF-IPCountry") || "").toUpperCase();
  const shippingCountry = String(shippingCountryInput || "").toUpperCase();
  const thCountries = ["TH", "LA", "MM", "KH"];
  let currency = "usd";
  if (shippingCountry === "TH") {
    currency = "thb";
  } else if (bodyCurrency === "THB" || bodyCurrency === "thb") {
    currency = "thb";
  } else if (bodyCurrency === "USD" || bodyCurrency === "usd") {
    currency = "usd";
  } else if (thCountries.includes(origin)) {
    currency = "thb";
  }
  const totalQty = items.reduce((sum, item) => sum + Math.max(0, Number(item.qty || 0)), 0);
  let shippingQuote;
  try {
    shippingQuote = await calculateShippingQuote(env, {
      countryCode: shippingCountryInput,
      fallbackCountryCode: origin || "",
      currency: currency.toUpperCase(),
      serviceLevel: shippingServiceLevel,
      totalQty
    });
  } catch (e) {
    console.error("Shipping quote error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Shipping configuration unavailable. Please try again." }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
  const lineItems = items.map((item) => {
    const unitAmount = currency === "thb" ? Math.round((item.price_thb || 0) * 100) : Math.round((item.price_usd || 0) * 100);
    const desc = [
      item.product_name,
      item.fabric ? `Fabric: ${item.fabric}` : "",
      item.color ? `Color: ${item.color}` : "",
      item.dimensions ? `${item.dimensions.w}\xD7${item.dimensions.l}${item.dimensions.d ? `\xD7${item.dimensions.d}` : ""} ${item.dimensions.unit}` : ""
    ].filter(Boolean).join(" | ");
    return {
      price_data: {
        currency,
        product_data: {
          name: item.product_name,
          description: desc
        },
        unit_amount: discountApplied ? Math.round(unitAmount * (100 - discountPct) / 100) : unitAmount
      },
      quantity: item.qty || 1
    };
  });
  const shippingMinor = Math.round(Number(shippingQuote?.amount || 0) * 100);
  if (shippingMinor > 0) {
    lineItems.push({
      price_data: {
        currency,
        product_data: {
          name: `Shipping (${shippingQuote.country_name || shippingQuote.applied_country || "Other"})`,
          description: `${String(shippingQuote?.service_level || "express").toUpperCase()} \u2022 First item ${shippingQuote.first_item} + each additional ${shippingQuote.additional_item}`
        },
        unit_amount: shippingMinor
      },
      quantity: 1
    });
  }
  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM abandoned_carts WHERE email = ?1 AND recovered = 0"
    ).bind(normalizedEmail).first();
    if (existing) {
      await env.DB.prepare(
        "UPDATE abandoned_carts SET cart_json = ?1, customer_name = ?2, created_at = datetime('now') WHERE id = ?3"
      ).bind(JSON.stringify(items), name || null, existing.id).run();
    } else {
      await env.DB.prepare(
        "INSERT INTO abandoned_carts (email, customer_name, cart_json) VALUES (?1, ?2, ?3)"
      ).bind(normalizedEmail, name || null, JSON.stringify(items)).run();
    }
  } catch {
  }
  const siteUrl = request.url.includes("localhost") || request.url.includes("127.0.0.1") ? "http://localhost:8788" : request.url.includes("mildmate-new.pages.dev") ? "https://mildmate-new.pages.dev" : "https://www.mildmate.com";
  try {
    const params = new URLSearchParams();
    params.append("customer_email", normalizedEmail);
    params.append("mode", "payment");
    params.append("success_url", `${siteUrl}/order-confirmed/?session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${siteUrl}/checkout/?canceled=true`);
    params.append("metadata[email]", normalizedEmail);
    if (name) params.append("metadata[name]", name);
    if (phone) params.append("metadata[phone]", phone);
    if (address) params.append("metadata[address]", address);
    params.append("metadata[shipping_country_requested]", String(shippingQuote?.requested_country || "").toUpperCase());
    params.append("metadata[shipping_country_applied]", String(shippingQuote?.applied_country || "").toUpperCase());
    params.append("metadata[shipping_country_name]", String(shippingQuote?.country_name || ""));
    params.append("metadata[shipping_service_level]", String(shippingQuote?.service_level || "express"));
    params.append("metadata[shipping_eta_min_days]", String(Number(shippingQuote?.eta_min_days || 0)));
    params.append("metadata[shipping_eta_max_days]", String(Number(shippingQuote?.eta_max_days || 0)));
    params.append("metadata[shipping_eta_note]", String(shippingQuote?.eta_note || ""));
    params.append("metadata[shipping_amount]", String(Number(shippingQuote?.amount || 0)));
    params.append("metadata[shipping_amount_thb]", String(Number(shippingQuote?.amount_thb || 0)));
    params.append("metadata[shipping_currency]", currency.toUpperCase());
    params.append("metadata[shipping_total_qty]", String(totalQty));
    if (discountApplied) {
      params.append("metadata[discount_code]", discountCode);
      params.append("metadata[discount_percent]", String(discountPct));
    }
    const metadataItems = items.map((i, idx) => ({
      slug: i.product_slug,
      name: i.product_name,
      fabric: i.fabric,
      color: i.color,
      dims: {
        w: i.dimensions?.w,
        l: i.dimensions?.l,
        d: i.dimensions?.d,
        unit: i.dimensions?.unit || "cm"
      },
      qty: i.qty || 1,
      u: lineItems[idx]?.price_data?.unit_amount || 0
      // minor unit (cents/satang)
    }));
    let metadataItemsStr = JSON.stringify(metadataItems);
    if (metadataItemsStr.length > 500) {
      const compactItems = items.map((i, idx) => ({
        s: i.product_slug,
        q: i.qty || 1,
        u: lineItems[idx]?.price_data?.unit_amount || 0
      }));
      metadataItemsStr = JSON.stringify(compactItems);
    }
    params.append("metadata[items]", metadataItemsStr);
    const appliedShippingCountry = String(shippingQuote?.applied_country || "").toUpperCase();
    const shouldOfferPromptPay = currency === "thb" && (origin === "TH" || shippingCountry === "TH" || appliedShippingCountry === "TH");
    if (shouldOfferPromptPay) {
      params.append("payment_method_types[0]", "card");
      params.append("payment_method_types[1]", "promptpay");
    } else {
      params.append("payment_method_types[0]", "card");
    }
    lineItems.forEach((li, idx) => {
      const pd = li.price_data;
      params.append(`line_items[${idx}][price_data][currency]`, pd.currency);
      params.append(`line_items[${idx}][price_data][product_data][name]`, pd.product_data.name);
      if (pd.product_data.description) {
        params.append(`line_items[${idx}][price_data][product_data][description]`, pd.product_data.description);
      }
      params.append(`line_items[${idx}][price_data][unit_amount]`, String(pd.unit_amount));
      params.append(`line_items[${idx}][quantity]`, String(li.quantity));
    });
    const stripeResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const stripeData = await stripeResp.json();
    if (!stripeResp.ok) {
      console.error("Stripe error:", stripeData);
      const stripeMsg = stripeData?.error?.message || stripeData?.message || "Payment service error";
      return new Response(JSON.stringify({ error: stripeMsg }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      url: stripeData.url,
      session_id: stripeData.id
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Checkout error:", e.message);
    return new Response(JSON.stringify({ error: "Payment service unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleCheckout, "handleCheckout");

// ../workers/api/webhook.ts
async function sha2562(text) {
  const d = new TextEncoder().encode(text);
  const h = await crypto.subtle.digest("SHA-256", d);
  return Array.from(new Uint8Array(h)).map(function(b) {
    return b.toString(16).padStart(2, "0");
  }).join("");
}
__name(sha2562, "sha256");
function normalizeAddress2(raw) {
  var addr = raw;
  if (typeof raw === "string") try {
    addr = JSON.parse(raw);
  } catch (e) {
    return (raw || "").toLowerCase().trim();
  }
  if (typeof addr !== "object" || !addr) return "";
  return [(addr.street || addr.address || "").trim().toLowerCase(), (addr.city || "").trim().toLowerCase(), (addr.state || addr.province || "").trim().toLowerCase(), (addr.postal_code || addr.zip || addr.postal || "").trim().toLowerCase(), (addr.country || "").trim().toLowerCase()].join("|");
}
__name(normalizeAddress2, "normalizeAddress");
async function handleStripeWebhook(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const rawBody = await request.text();
  let event;
  try {
    const parts = signature.split(",");
    const timestampPart = parts.find((p) => p.startsWith("t="));
    const sigPart = parts.find((p) => p.startsWith("v1="));
    if (!timestampPart || !sigPart) {
      throw new Error("Invalid signature format");
    }
    const timestamp = timestampPart.substring(2);
    const signedPayload = `${timestamp}.${rawBody}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = hexToArrayBuffer(sigPart.substring(3));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(signedPayload)
    );
    if (!valid) {
      throw new Error("Invalid signature");
    }
    event = JSON.parse(rawBody);
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const session = event.data.object;
  const metadata = session.metadata || {};
  let items = [];
  try {
    const rawItems = JSON.parse(metadata.items || "[]");
    items = (Array.isArray(rawItems) ? rawItems : []).map((item) => ({
      slug: item.slug || item.s || "",
      name: item.name || item.n || item.slug || item.s || "",
      fabric: item.fabric || item.f || null,
      color: item.color || item.c || null,
      dims: item.dims || item.d || {},
      qty: item.qty || item.q || 1,
      unit_amount: Number(item.u || item.unit_amount || 0)
      // minor unit (cents/satang)
    }));
  } catch {
  }
  const sessionCurrency = String(session.currency || "usd").toLowerCase();
  const totalQty = items.reduce((sum, item) => sum + (item.qty || 1), 0);
  const fallbackUnitAmount = totalQty > 0 && session.amount_total ? Math.round(session.amount_total / totalQty) : 0;
  for (const item of items) {
    const dims = item.dims || {};
    const unitAmount = item.unit_amount > 0 ? item.unit_amount : fallbackUnitAmount;
    const unitPriceMajor = unitAmount > 0 ? unitAmount / 100 : null;
    try {
      await env.DB.prepare(
        `INSERT INTO orders (
          stripe_session_id, stripe_payment_intent_id, email, customer_name, phone,
          shipping_address, product_slug, product_title_en, fabric, color,
          width_cm, length_cm, depth_cm, width_in, length_in, depth_in,
          custom_notes, price_usd, price_thb, currency, quantity, discount_code, status
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, 'confirmed')`
      ).bind(
        session.id,
        session.payment_intent || null,
        (metadata.email || session.customer_email || "").toLowerCase(),
        metadata.name || null,
        metadata.phone || null,
        metadata.address || null,
        item.slug || "",
        item.name || "",
        item.fabric || null,
        item.color || null,
        dims.w || null,
        dims.l || null,
        dims.d || null,
        null,
        null,
        null,
        null,
        sessionCurrency === "usd" ? unitPriceMajor : null,
        sessionCurrency === "thb" ? unitPriceMajor : null,
        sessionCurrency,
        item.qty || 1,
        metadata.discount_code || null
      ).run();
      if (metadata.discount_code) {
        try {
          var addrHash = metadata.address ? await sha2562(normalizeAddress2(metadata.address)) : null;
          const normalizedEmail2 = (metadata.email || session.customer_email || "").toLowerCase();
          const promoRow = await env.DB.prepare(
            "SELECT id FROM promo_codes WHERE code = ? AND is_active = 1"
          ).bind(metadata.discount_code).first();
          if (promoRow) {
            await env.DB.prepare(
              "UPDATE promo_codes SET use_count = use_count + 1 WHERE id = ?"
            ).bind(promoRow.id).run();
            await env.DB.prepare(
              "INSERT INTO promo_redemptions (promo_id, email, order_id) VALUES (?, ?, ?)"
            ).bind(promoRow.id, normalizedEmail2, null).run();
          } else {
            await env.DB.prepare(
              "UPDATE discount_claims SET status = 'used', address_hash = ?, order_id = last_insert_rowid(), claimed_at = datetime('now') WHERE code = ? AND status = 'issued'"
            ).bind(addrHash, metadata.discount_code).run();
          }
        } catch (err) {
          console.error("Discount claim failed:", err?.message || err);
        }
      }
    } catch (e) {
      console.error("Failed to save order:", e.message);
    }
  }
  const email = metadata.email || session.customer_email;
  if (email) {
    try {
      await env.DB.prepare(
        "UPDATE abandoned_carts SET recovered = 1 WHERE email = ?1 AND recovered = 0"
      ).bind(email).run();
    } catch {
    }
  }
  if (email && metadata.address) {
    try {
      const existing = await env.DB.prepare(
        "SELECT id FROM customer_addresses WHERE email = ?1 AND address = ?2 LIMIT 1"
      ).bind(email, metadata.address).first();
      if (!existing) {
        const fullName = (metadata.name || "").trim();
        const nameParts = fullName.split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        const addrParts = metadata.address.split(",").map((s) => s.trim());
        const country = addrParts[addrParts.length - 1] || "";
        const postal = addrParts.length >= 2 ? addrParts[addrParts.length - 2] : "";
        const state = addrParts.length >= 3 ? addrParts[addrParts.length - 3] : "";
        const city = addrParts.length >= 4 ? addrParts[addrParts.length - 4] : "";
        await env.DB.prepare(
          `INSERT INTO customer_addresses (email, label, first_name, last_name, phone, country, address, city, state, postal_code, is_default)
           VALUES (?1, 'Home', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)`
        ).bind(email, firstName, lastName, metadata.phone || "", country, metadata.address, city, state, postal).run();
      }
    } catch {
    }
  }
  if (email && env.RESEND_API_KEY) {
    const itemList = items.map((i) => {
      const dims = i.dims || {};
      return `- ${i.name} | ${i.fabric || "N/A"} | ${dims.w || "?"}\xD7${dims.l || "?"}${dims.d ? `\xD7${dims.d}` : ""} ${dims.unit || "cm"} | Qty: ${i.qty || 1}`;
    }).join("\n");
    const total = session.amount_total ? `${(session.amount_total / 100).toFixed(2)} ${session.currency?.toUpperCase() || "USD"}` : "N/A";
    try {
      const customerMail = await sendEmail(env, {
        to: email,
        subject: `Order Confirmed \u2014 MildMate #${session.id.slice(-8)}`,
        text: `Thank you for your order!

Order: #${session.id.slice(-8)}

Items:
${itemList}

Total: ${total}

We'll notify you when your order ships.

\u2014 MildMate`
      });
      if (!customerMail.success) {
        console.error("Customer email failed:", customerMail.error || "unknown error", "to:", email);
      }
    } catch (err) {
      console.error("Customer email exception:", err?.message || err, "to:", email);
    }
    const teamEmail = env.ORDER_NOTIFICATION_EMAIL || "orders@mildmate.com";
    try {
      const teamMail = await sendEmail(env, {
        to: teamEmail,
        subject: `New Order \u2014 MildMate #${session.id.slice(-8)}`,
        text: `New order received!

Order: #${session.id.slice(-8)}
Customer: ${metadata.name || "Guest"} (${email})
Phone: ${metadata.phone || "N/A"}
Address: ${metadata.address || "N/A"}

Items:
${itemList}

Total: ${total}`
      });
      if (!teamMail.success) {
        console.error("Team email failed:", teamMail.error || "unknown error", "to:", teamEmail);
      }
    } catch (err) {
      console.error("Team email exception:", err?.message || err, "to:", teamEmail);
    }
  }
  if (email) {
    try {
      const { results: cfgRows } = await env.DB.prepare("SELECT key, value FROM recovery_config").all();
      let discountPct = 20, sendAfterHours = 1;
      if (cfgRows) {
        const map = {};
        for (const row of cfgRows) map[row.key] = row.value;
        discountPct = Number(map.thankyou_discount) || 20;
        sendAfterHours = Number(map.thankyou_send_after_hours) || 1;
      }
      const discountCode = "THANKS-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 365 * 86400 * 1e3).toISOString().replace("T", " ").slice(0, 19);
      const sendAfter = new Date(Date.now() + sendAfterHours * 3600 * 1e3).toISOString().replace("T", " ").slice(0, 19);
      await env.DB.prepare(
        "INSERT INTO discount_claims (code, email, status, discount_pct, expires_at, source, created_at) VALUES (?, ?, 'issued', ?, ?, 'thankyou', datetime('now'))"
      ).bind(discountCode, email.toLowerCase(), discountPct, expiresAt).run();
      await env.DB.prepare(
        "INSERT INTO thankyou_queue (order_id, email, discount_code, discount_pct, send_after) VALUES (?, ?, ?, ?, ?)"
      ).bind(session.id, email.toLowerCase(), discountCode, discountPct, sendAfter).run();
      console.log(`Webhook: thankyou queued for ${email} (${discountPct}%, send after ${sendAfterHours}h)`);
    } catch (e) {
      console.error("Thankyou queue insert failed:", e.message);
    }
  }
  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleStripeWebhook, "handleStripeWebhook");
function hexToArrayBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}
__name(hexToArrayBuffer, "hexToArrayBuffer");

// ../workers/api/auth.ts
async function handleAuth(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "GET" && (path === "/api/auth/me" || path === "/api/auth/me/")) {
    const authHeader = request.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ authenticated: false }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    const result = await verifyClerkJwt(request, env);
    if (!result.valid) {
      if (result.status === 401) {
        return new Response(JSON.stringify({ authenticated: false }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status,
        headers: { "Content-Type": "application/json" }
      });
    }
    const { payload } = result;
    const headerEmail = request.headers.get("X-User-Email") || "";
    const email = payload.email || headerEmail || "";
    const name = payload.name || headerEmail.split("@")[0] || "";
    try {
      await env.DB.prepare(
        `INSERT INTO customers (email, name, auth_provider, auth_provider_id, created_at)
         VALUES (?1, ?2, 'clerk', ?3, datetime('now'))
         ON CONFLICT(email) DO UPDATE SET name = ?2, auth_provider_id = ?3`
      ).bind(email, name, payload.sub).run();
    } catch {
    }
    return new Response(JSON.stringify({
      authenticated: true,
      email,
      name,
      sub: payload.sub,
      provider: "clerk"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleAuth, "handleAuth");

// ../workers/api/customers.ts
var orderShippingSchemaReady2 = false;
var orderShippingSchemaPromise2 = null;
async function ensureOrderShippingSchema2(env) {
  if (orderShippingSchemaReady2) return;
  if (!orderShippingSchemaPromise2) {
    orderShippingSchemaPromise2 = (async () => {
      const tableInfo = await env.DB.prepare("PRAGMA table_info(orders)").all();
      const existing = new Set(
        (tableInfo.results || []).map((r) => String(r.name || "").toLowerCase())
      );
      const alters = [];
      if (!existing.has("carrier_code")) alters.push("ALTER TABLE orders ADD COLUMN carrier_code TEXT");
      if (!existing.has("tracking_number")) alters.push("ALTER TABLE orders ADD COLUMN tracking_number TEXT");
      if (!existing.has("tracking_url")) alters.push("ALTER TABLE orders ADD COLUMN tracking_url TEXT");
      if (!existing.has("shipping_status")) alters.push("ALTER TABLE orders ADD COLUMN shipping_status TEXT");
      if (!existing.has("shipped_at")) alters.push("ALTER TABLE orders ADD COLUMN shipped_at DATETIME");
      for (const sql of alters) await env.DB.prepare(sql).run();
      orderShippingSchemaReady2 = true;
    })().finally(() => {
      if (!orderShippingSchemaReady2) orderShippingSchemaPromise2 = null;
    });
  }
  await orderShippingSchemaPromise2;
}
__name(ensureOrderShippingSchema2, "ensureOrderShippingSchema");
async function getEmail(request, env) {
  const result = await verifyClerkJwt(request, env);
  if (!result.valid) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: { "Content-Type": "application/json" }
    });
  }
  const email = result.payload.email || request.headers.get("X-User-Email") || "";
  if (!email) {
    return new Response(JSON.stringify({ error: "No email in token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  return email;
}
__name(getEmail, "getEmail");
async function handleCustomers(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "GET" && (path === "/api/customers/orders" || path === "/api/customers/orders/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;
    const guestEmail = (request.headers.get("X-Order-Email") || "").trim().toLowerCase();
    const hasGuestBridge = guestEmail && guestEmail !== email.toLowerCase();
    try {
      await ensureOrderShippingSchema2(env);
      const query = `SELECT o.id, o.stripe_session_id, o.product_title_en, o.product_slug,
                o.fabric, o.color,
                o.width_cm, o.length_cm, o.depth_cm, o.width_in, o.length_in, o.depth_in,
                o.price_usd, o.price_thb, o.currency, o.quantity, o.status,
                o.created_at, o.shipping_address,
                o.carrier_code, o.tracking_number, o.tracking_url,
                o.shipping_status, o.shipped_at,
                COALESCE(
                  (
                    SELECT p1.image_url
                    FROM products p1
                    WHERE LOWER(TRIM(p1.slug, '/')) = LOWER(
                      CASE
                        WHEN LOWER(TRIM(COALESCE(o.product_slug, ''), '/')) LIKE 'product/%'
                          THEN SUBSTR(LOWER(TRIM(COALESCE(o.product_slug, ''), '/')), 9)
                        ELSE LOWER(TRIM(COALESCE(o.product_slug, ''), '/'))
                      END
                    )
                    LIMIT 1
                  ),
                  (
                    SELECT p2.image_url
                    FROM products p2
                    WHERE LOWER(TRIM(COALESCE(p2.title_en, ''))) = LOWER(TRIM(COALESCE(o.product_title_en, '')))
                    LIMIT 1
                  )
                ) AS image_url
         FROM orders o
         WHERE LOWER(o.email) IN (LOWER(?1)${hasGuestBridge ? ", LOWER(?2)" : ""})
         ORDER BY o.created_at DESC
         LIMIT 50`;
      let stmt;
      if (hasGuestBridge) {
        stmt = env.DB.prepare(query).bind(email, guestEmail);
      } else {
        stmt = env.DB.prepare(query).bind(email);
      }
      const raw = await stmt.all();
      let results = raw.results || [];
      if (hasGuestBridge && results.length > 0) {
        const seen = /* @__PURE__ */ new Set();
        results = results.filter((r) => {
          const sid = r.stripe_session_id || "";
          if (seen.has(sid)) return false;
          seen.add(sid);
          return true;
        });
      }
      return new Response(JSON.stringify({
        orders: results.map((r) => ({ ...r, image_url: r.image_url && r.image_url.startsWith("/r2/") ? `https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev${r.image_url.slice(3)}` : r.image_url })),
        merged: hasGuestBridge
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      console.error("Failed to fetch orders:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "GET" && (path === "/api/customers/cart" || path === "/api/customers/cart/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;
    try {
      const row = await env.DB.prepare(
        "SELECT cart_json FROM abandoned_carts WHERE email = ?1 AND recovered = 0 ORDER BY created_at DESC LIMIT 1"
      ).bind(email).first();
      return new Response(JSON.stringify({
        items: row ? JSON.parse(row.cart_json) : []
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "PUT" && (path === "/api/customers/cart" || path === "/api/customers/cart/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;
    try {
      const body = await request.json();
      const items = body.items || [];
      if (!Array.isArray(items)) {
        return new Response(JSON.stringify({ error: "items must be an array" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      await env.DB.prepare(
        "DELETE FROM abandoned_carts WHERE email = ?1 AND recovered = 0"
      ).bind(email).run();
      if (items.length > 0) {
        await env.DB.prepare(
          "INSERT INTO abandoned_carts (email, cart_json, created_at) VALUES (?1, ?2, datetime('now'))"
        ).bind(email, JSON.stringify(items)).run();
      }
      return new Response(JSON.stringify({ success: true, itemCount: items.length }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      console.error("Failed to save cart:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "DELETE" && (path === "/api/customers/cart" || path === "/api/customers/cart/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;
    try {
      await env.DB.prepare(
        "DELETE FROM abandoned_carts WHERE email = ?1 AND recovered = 0"
      ).bind(email).run();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      console.error("Failed to clear cart:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "GET" && (path === "/api/customers/addresses" || path === "/api/customers/addresses/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;
    try {
      const { results } = await env.DB.prepare(
        "SELECT id, label, first_name, last_name, phone, country, address, city, state, postal_code, is_default FROM customer_addresses WHERE email = ?1 ORDER BY is_default DESC, created_at ASC"
      ).bind(email).all();
      return new Response(JSON.stringify({ addresses: results }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      console.error("Failed to fetch addresses:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "POST" && (path === "/api/customers/addresses" || path === "/api/customers/addresses/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;
    try {
      const body = await request.json();
      const { label, first_name, last_name, phone, country, address, city, state, postal_code } = body;
      if (!first_name || !last_name || !phone || !country || !address || !city) {
        return new Response(JSON.stringify({ error: "Missing required fields: first_name, last_name, phone, country, address, city" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const countRow = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM customer_addresses WHERE email = ?1"
      ).bind(email).first();
      if (countRow && countRow.cnt >= 5) {
        return new Response(JSON.stringify({ error: "Maximum 5 addresses allowed" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const setDefault = body.is_default || countRow && countRow.cnt === 0;
      if (setDefault) {
        await env.DB.prepare(
          "UPDATE customer_addresses SET is_default = 0 WHERE email = ?1"
        ).bind(email).run();
      }
      const result = await env.DB.prepare(
        `INSERT INTO customer_addresses (email, label, first_name, last_name, phone, country, address, city, state, postal_code, is_default)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
      ).bind(
        email,
        label || "Home",
        first_name,
        last_name,
        phone,
        country,
        address,
        city,
        state || "",
        postal_code || "",
        setDefault ? 1 : 0
      ).run();
      return new Response(JSON.stringify({
        success: true,
        id: result.meta?.last_row_id
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      console.error("Failed to add address:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "PUT" && (path === "/api/customers/addresses" || path === "/api/customers/addresses/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;
    const addrId = url.searchParams.get("id");
    if (!addrId) {
      return new Response(JSON.stringify({ error: "Missing ?id= parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      const body = await request.json();
      const existing = await env.DB.prepare(
        "SELECT * FROM customer_addresses WHERE id = ?1 AND email = ?2"
      ).bind(addrId, email).first();
      if (!existing) {
        return new Response(JSON.stringify({ error: "Address not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      const label = body.label !== void 0 ? body.label : existing.label;
      const first_name = body.first_name !== void 0 ? body.first_name : existing.first_name;
      const last_name = body.last_name !== void 0 ? body.last_name : existing.last_name;
      const phone = body.phone !== void 0 ? body.phone : existing.phone;
      const country = body.country !== void 0 ? body.country : existing.country;
      const address = body.address !== void 0 ? body.address : existing.address;
      const city = body.city !== void 0 ? body.city : existing.city;
      const state = body.state !== void 0 ? body.state : existing.state;
      const postal_code = body.postal_code !== void 0 ? body.postal_code : existing.postal_code;
      const is_default = body.is_default !== void 0 ? body.is_default : existing.is_default;
      if (is_default) {
        await env.DB.prepare(
          "UPDATE customer_addresses SET is_default = 0 WHERE email = ?1"
        ).bind(email).run();
      }
      await env.DB.prepare(
        `UPDATE customer_addresses
         SET label = ?1, first_name = ?2, last_name = ?3, phone = ?4, country = ?5,
             address = ?6, city = ?7, state = ?8, postal_code = ?9, is_default = ?10,
             updated_at = datetime('now')
         WHERE id = ?11 AND email = ?12`
      ).bind(
        label,
        first_name,
        last_name,
        phone,
        country,
        address,
        city,
        state,
        postal_code,
        is_default ? 1 : 0,
        addrId,
        email
      ).run();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      console.error("Failed to update address:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "DELETE" && (path === "/api/customers/addresses" || path === "/api/customers/addresses/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;
    const addrId = url.searchParams.get("id");
    if (!addrId) {
      return new Response(JSON.stringify({ error: "Missing ?id= parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      const existing = await env.DB.prepare(
        "SELECT id, is_default FROM customer_addresses WHERE id = ?1 AND email = ?2"
      ).bind(addrId, email).first();
      if (!existing) {
        return new Response(JSON.stringify({ error: "Address not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      await env.DB.prepare(
        "DELETE FROM customer_addresses WHERE id = ?1 AND email = ?2"
      ).bind(addrId, email).run();
      if (existing.is_default) {
        const next = await env.DB.prepare(
          "SELECT id FROM customer_addresses WHERE email = ?1 ORDER BY created_at ASC LIMIT 1"
        ).bind(email).first();
        if (next) {
          await env.DB.prepare(
            "UPDATE customer_addresses SET is_default = 1 WHERE id = ?1"
          ).bind(next.id).run();
        }
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      console.error("Failed to delete address:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleCustomers, "handleCustomers");

// ../workers/api/order-confirmed.ts
async function getOrdersBySession(env, sessionId) {
  const { results } = await env.DB.prepare(
    `SELECT id, stripe_session_id, email, shipping_address, product_title_en, fabric, color,
            width_cm, length_cm, depth_cm, price_usd, price_thb,
            currency, quantity, status, created_at
     FROM orders
     WHERE stripe_session_id = ?1
     ORDER BY created_at DESC`
  ).bind(sessionId).all();
  return results || [];
}
__name(getOrdersBySession, "getOrdersBySession");
async function reconcilePaidSessionToOrders(sessionId, env) {
  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return false;
  const existing = await env.DB.prepare(
    "SELECT id FROM orders WHERE stripe_session_id = ?1 LIMIT 1"
  ).bind(sessionId).first();
  if (existing) return true;
  const sessionResp = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${stripeKey}` } }
  );
  if (!sessionResp.ok) return false;
  const session = await sessionResp.json();
  const isPaid = String(session.payment_status || "").toLowerCase() === "paid" || String(session.status || "").toLowerCase() === "complete";
  if (!isPaid) return false;
  const email = String(
    session?.metadata?.email || session?.customer_email || session?.customer_details?.email || ""
  ).trim().toLowerCase();
  if (!email) return false;
  let metaItems = [];
  try {
    const parsed = JSON.parse(session?.metadata?.items || "[]");
    metaItems = Array.isArray(parsed) ? parsed : [];
  } catch {
    metaItems = [];
  }
  let lineItems = [];
  const lineResp = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/line_items?limit=100`,
    { headers: { Authorization: `Bearer ${stripeKey}` } }
  );
  if (lineResp.ok) {
    const lineData = await lineResp.json();
    lineItems = Array.isArray(lineData?.data) ? lineData.data : [];
  }
  if (lineItems.length === 0 && metaItems.length === 0) return false;
  const sourceRows = lineItems.length > 0 ? lineItems : metaItems;
  const sessionCurrency = String(session.currency || "usd").toLowerCase();
  let inserted = 0;
  for (let i = 0; i < sourceRows.length; i++) {
    const li = sourceRows[i] || {};
    const mi = metaItems[i] || {};
    const dims = mi.dims || mi.d || {};
    const qty = Number(li.quantity || mi.qty || mi.q || 1) || 1;
    const unitMinor = Number(li?.price?.unit_amount || 0) || Number(mi.u || 0) || (Number(li.amount_total || 0) && qty ? Math.round(Number(li.amount_total || 0) / qty) : 0);
    const unitMajor = unitMinor > 0 ? unitMinor / 100 : null;
    const productTitle = li.description || mi.name || mi.n || mi.slug || mi.s || "Custom Order";
    const productSlug = mi.slug || mi.s || "";
    await env.DB.prepare(
      `INSERT INTO orders (
        stripe_session_id, stripe_payment_intent_id, email, customer_name, phone,
        shipping_address, product_slug, product_title_en, fabric, color,
        width_cm, length_cm, depth_cm, width_in, length_in, depth_in,
        custom_notes, price_usd, price_thb, currency, quantity, discount_code, status
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, 'confirmed')`
    ).bind(
      session.id,
      session.payment_intent || null,
      email,
      session?.metadata?.name || session?.customer_details?.name || null,
      session?.metadata?.phone || session?.customer_details?.phone || null,
      session?.metadata?.address || null,
      productSlug,
      productTitle,
      mi.fabric || mi.f || null,
      mi.color || mi.c || null,
      dims.w || null,
      dims.l || null,
      dims.d || null,
      null,
      null,
      null,
      null,
      sessionCurrency === "usd" ? unitMajor : null,
      sessionCurrency === "thb" ? unitMajor : null,
      sessionCurrency,
      qty,
      session?.metadata?.discount_code || null
    ).run();
    inserted++;
  }
  return inserted > 0;
}
__name(reconcilePaidSessionToOrders, "reconcilePaidSessionToOrders");
async function handleOrderConfirmed(request, env) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing session_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    let results = await getOrdersBySession(env, sessionId);
    if (!results || results.length === 0) {
      try {
        const reconciled = await reconcilePaidSessionToOrders(sessionId, env);
        if (reconciled) {
          results = await getOrdersBySession(env, sessionId);
        }
      } catch (reconcileErr) {
        console.error("Order reconcile failed:", reconcileErr?.message || reconcileErr);
      }
    }
    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ pending: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      orders: results,
      session_id: sessionId,
      count: results.length
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Order confirmed lookup error:", e.message);
    return new Response(JSON.stringify({ error: "Database error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleOrderConfirmed, "handleOrderConfirmed");

// api/[[path]].ts
var R2_PUBLIC_BASE7 = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";
function toR2Url5(url) {
  if (!url || typeof url !== "string") return url;
  if (!url.startsWith("/r2/")) return url;
  return `${R2_PUBLIC_BASE7}${url.slice(3)}`;
}
__name(toR2Url5, "toR2Url");
function r2Product3(p) {
  if (!p) return p;
  const imgKey = p.image_url !== void 0 ? "image_url" : "Image_url";
  const out = { ...p, [imgKey]: toR2Url5(p[imgKey]) };
  if (out.images && typeof out.images === "string") {
    try {
      let arr = [];
      try {
        arr = JSON.parse(out.images);
      } catch (e) {
        arr = JSON.parse(out.images.replace(/\\"/g, '"'));
      }
      out.images = JSON.stringify(arr.map(toR2Url5));
    } catch (_) {
    }
  }
  return out;
}
__name(r2Product3, "r2Product");
var onRequest3 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/api/health") {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (path.startsWith("/api/products")) {
    const res = await handleProducts(request, env);
    const body = await res.text();
    try {
      const json10 = JSON.parse(body);
      if (json10.product) json10.product = r2Product3(json10.product);
      if (Array.isArray(json10.products)) json10.products = json10.products.map(r2Product3);
      return new Response(JSON.stringify(json10), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (_) {
      return new Response(body, { headers: { "Content-Type": "application/json" } });
    }
  }
  if (path.startsWith("/api/pricing-params") || path.startsWith("/api/diy-prices")) {
    return handlePricingParams(request, env);
  }
  if (path.startsWith("/api/pricing")) {
    return handlePricing(request, env);
  }
  if (path === "/api/geo") {
    return handleGeo(request, env);
  }
  if (path === "/api/countries" || path === "/api/countries/") {
    return handleCountries(request, env);
  }
  if (path === "/api/subscribe" || path === "/api/subscribe/") {
    return handleSubscribe(request, env);
  }
  if (path === "/api/unsubscribe" || path === "/api/unsubscribe/") {
    return handleUnsubscribe(request, env);
  }
  if (path === "/api/contact" || path === "/api/contact/") {
    return handleContact(request, env);
  }
  if (path === "/api/quote" || path === "/api/quote/") {
    return handleQuote(request, env);
  }
  if (path === "/api/admin/upload" || path === "/api/admin/upload/") {
    return handleAdminUpload(request, env);
  }
  if (path.startsWith("/api/admin/products")) {
    return handleAdminProducts(request, env);
  }
  if (path.startsWith("/api/admin/orders")) {
    return handleAdminOrders(request, env);
  }
  if (path === "/api/admin/customers" || path === "/api/admin/customers/") {
    return handleAdminCustomers(request, env);
  }
  if (path === "/api/admin/stats" || path === "/api/admin/stats/") {
    return handleAdminStats(request, env);
  }
  if (path === "/api/admin/shipping-rates" || path === "/api/admin/shipping-rates/") {
    return handleAdminShippingRates(request, env);
  }
  if (path === "/api/admin/shipping-product-tiers" || path === "/api/admin/shipping-product-tiers/") {
    return handleAdminShippingProductTiers(request, env);
  }
  if (path === "/api/admin/shipping-add-rates" || path === "/api/admin/shipping-add-rates/") {
    return handleAdminShippingAddRates(request, env);
  }
  if (path === "/api/admin/quotes" || path === "/api/admin/quotes/") {
    return handleAdminQuotes(request, env);
  }
  if (path === "/api/admin/promo" || path === "/api/admin/promo/") {
    return handleAdminPromo(request, env);
  }
  if (path === "/api/admin/blog" || path === "/api/admin/blog/") {
    return handleAdminBlog(request, env);
  }
  if (path === "/api/blog/posts" || path === "/api/blog/posts/") {
    return handleBlogPosts(request, env);
  }
  if (path === "/api/reviews" || path === "/api/reviews/") {
    return handleReviews(request, env);
  }
  if (path === "/api/admin/reviews" || path === "/api/admin/reviews/") {
    return handleAdminReviews(request, env);
  }
  if (path === "/api/admin/recovery-test" || path === "/api/admin/recovery-test/") {
    return handleAdminRecoveryTest(request, env);
  }
  if (path === "/api/shipping/calculate" || path === "/api/shipping/calculate/") {
    return handleShippingCalculate(request, env);
  }
  if (path === "/api/favorites" || path === "/api/favorites/" || path === "/api/admin/favorites/stats" || path === "/api/admin/favorites/stats/") {
    return handleFavorites(request, env);
  }
  if (path === "/api/discount/validate" || path === "/api/discount/validate/") {
    return handleDiscountValidate(request, env);
  }
  if (path === "/api/discount/claim" || path === "/api/discount/claim/") {
    return handleDiscountClaim(request, env);
  }
  if (path.startsWith("/api/admin/contacts")) {
    return handleAdminContacts(request, env);
  }
  if (path === "/api/admin/pricing-params" || path === "/api/admin/pricing-params/") {
    return handleAdminPricingParams(request, env);
  }
  if (path === "/api/admin/diy-prices" || path === "/api/admin/diy-prices/") {
    return handleAdminDiyPrices(request, env);
  }
  if (path === "/api/admin/exchange-rates" || path === "/api/admin/exchange-rates/") {
    return handleAdminExchangeRates(request, env);
  }
  if (path === "/api/admin/subscribers" || path === "/api/admin/subscribers/") {
    const secret = request.headers.get("X-Admin-Secret");
    if (secret !== (env.ADMIN_SECRET || "admin")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    if (request.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing 'id' parameter" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      await env.DB.prepare("DELETE FROM subscribers WHERE id = ?").bind(Number(id)).run();
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }
    const fmt = url.searchParams.get("format");
    const { results } = await env.DB.prepare("SELECT id, email, source, language, created_at FROM subscribers ORDER BY created_at DESC").all();
    if (fmt === "csv") {
      const header = "id,email,source,language,created_at";
      const rows = results.map((r) => [r.id, r.email, r.source, r.language, r.created_at].join(","));
      return new Response(header + "\n" + rows.join("\n"), { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=subscribers.csv" } });
    }
    return new Response(JSON.stringify({ subscribers: results }), { headers: { "Content-Type": "application/json" } });
  }
  if (path === "/api/checkout" || path === "/api/checkout/") {
    return handleCheckout(request, env);
  }
  if (path === "/api/webhook/stripe" || path === "/api/webhook/stripe/") {
    return handleStripeWebhook(request, env);
  }
  if (path === "/api/auth/me" || path === "/api/auth/me/") {
    return handleAuth(request, env);
  }
  if (path.startsWith("/api/customers")) {
    return handleCustomers(request, env);
  }
  if (path === "/api/order-confirmed" || path === "/api/order-confirmed/") {
    return handleOrderConfirmed(request, env);
  }
  if (path.startsWith("/r2/")) {
    const key = path.substring(4);
    const bucket = env.MILDMATE_ASSETS;
    const obj = await bucket.get(key);
    if (obj) {
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
}, "onRequest");

// blogs/[[path]].ts
async function onRequest4(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/blogs/" || path === "/blogs") {
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    return buildBlogListingHTML(env, page, "en");
  }
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
__name(onRequest4, "onRequest");

// quote/[[path]].ts
var onRequest5 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  const quoteId = pathParts[1];
  if (!quoteId) {
    return new Response("Missing quote ID", { status: 400, headers: { "Content-Type": "text/plain" } });
  }
  let quote = null;
  try {
    quote = await env.DB.prepare(
      `SELECT quote_id, customer_name, product_slug, dimensions, fabric, color,
              status, quoted_price, quoted_price_usd, expires_at, created_at
       FROM custom_quotes
       WHERE quote_id = ?1`
    ).bind(quoteId).first();
  } catch (e) {
    console.error("Quote page DB error:", e.message);
  }
  let usdRate = 30;
  try {
    const rateRow = await env.DB.prepare(
      "SELECT param_value FROM pricing_params WHERE param_key = 'usd_rate'"
    ).first();
    if (rateRow) {
      const val = parseFloat(rateRow.param_value);
      if (!isNaN(val)) usdRate = val;
    }
  } catch {
  }
  let dimensions = {};
  let dimStr = "\u2014";
  if (quote) {
    try {
      dimensions = typeof quote.dimensions === "string" ? JSON.parse(quote.dimensions) : quote.dimensions;
      if (dimensions.w && dimensions.l) {
        dimStr = `${dimensions.w} \xD7 ${dimensions.l}`;
        if (dimensions.d) dimStr += ` \xD7 ${dimensions.d}`;
        dimStr += ` ${dimensions.unit || "cm"}`;
      } else if (dimensions.size_text) {
        dimStr = String(dimensions.size_text);
      }
    } catch {
      dimStr = typeof quote.dimensions === "string" ? quote.dimensions : "\u2014";
    }
  }
  const isExpired = quote?.expires_at ? /* @__PURE__ */ new Date(quote.expires_at + "Z") < /* @__PURE__ */ new Date() : false;
  const isApproved = quote?.status === "approved";
  const priceThb = quote?.quoted_price || null;
  const explicitPriceUsd = quote?.quoted_price_usd || null;
  const isUsdQuoted = explicitPriceUsd != null && explicitPriceUsd > 0;
  const priceUsd = isUsdQuoted ? explicitPriceUsd : priceThb ? Math.round(priceThb / usdRate) : null;
  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  __name(esc, "esc");
  const productTitle = quote ? quote.product_slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";
  const fabricLabel = quote?.fabric || "\u2014";
  const colorLabel = quote?.color || "\u2014";
  const cartItem = quote ? {
    id: "quote-" + quoteId + "-" + Date.now(),
    type: quote.product_slug,
    product_slug: quote.product_slug,
    title: productTitle,
    dimensions,
    fabric: quote.fabric,
    color: quote.color,
    qty: 1,
    is_quote: true,
    quote_id: quoteId,
    price_thb: priceThb,
    price_usd: priceUsd
  } : null;
  const cartItemJson = JSON.stringify(cartItem || null).replace(/</g, "\\u003c");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="MildMate Custom Quote ${esc(quoteId)} \u2014 Locked-price custom bedding.">
  <meta name="robots" content="noindex">
  <title>Quote ${esc(quoteId)} \u2014 MildMate</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --color-primary: #2c96f4;
      --color-primary-dark: #1a7fd4;
      --color-text: #1E293B;
      --color-heading: #0F172A;
      --color-bg: #ffffff;
      --color-surface: #F8FAFC;
      --color-border: #e2e8f0;
      --color-muted: #64748b;
      --color-success: #16a34a;
      --color-warning: #d97706;
      --color-error: #dc2626;
      --radius: 8px;
      --shadow: 0 1px 3px rgba(0,0,0,0.06);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
      --font-main: 'Quicksand', sans-serif;
    }
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:var(--font-main);color:var(--color-text);background:var(--color-surface);line-height:1.6;-webkit-font-smoothing:antialiased}
    a{color:var(--color-primary);text-decoration:none}
    a:hover{text-decoration:underline}
    /* Header */
    .site-header{background:var(--color-bg);border-bottom:1px solid var(--color-border);position:sticky;top:0;z-index:10}
    .header-inner{display:flex;align-items:center;justify-content:space-between;max-width:1200px;margin:0 auto;padding:12px 24px}
    .logo-link img{height:32px;width:auto}
    .header-right{display:flex;align-items:center;gap:16px;font-size:0.8125rem;font-weight:600}
    /* Main */
    main{max-width:1120px;margin:0 auto;padding:32px 24px 64px}
    h1{font-size:1.375rem;font-weight:700;color:var(--color-heading);margin-bottom:4px}
    .subtitle{font-size:0.875rem;color:var(--color-muted);margin-bottom:24px}
    .quote-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,1fr);gap:24px;align-items:start}
    /* Card */
    .card{background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius);padding:24px;box-shadow:var(--shadow)}
    .spec-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .spec-item{background:var(--color-surface);border:1px solid var(--color-border);border-radius:10px;padding:12px 14px}
    .label{font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-muted);margin-bottom:4px}
    .value{font-size:0.9875rem;color:var(--color-text);font-weight:600}
    .transaction-card{position:sticky;top:92px}
    .transaction-label{font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--color-muted)}
    .transaction-price{font-size:2rem;font-weight:700;color:var(--color-heading);line-height:1.15;margin-top:8px}
    .transaction-pending{font-size:1rem;font-weight:600;color:var(--color-muted);margin-top:8px}
    .validity-badge{margin-top:14px;display:flex;align-items:flex-start;gap:8px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;border-radius:10px;padding:10px 12px;font-size:0.8125rem;line-height:1.4}
    .validity-badge svg{flex-shrink:0;margin-top:1px}
    .transaction-note{margin-top:10px;font-size:0.8125rem;color:var(--color-muted)}
    .transaction-card .btn{margin-top:16px}
    /* Status banners */
    .banner{padding:14px 18px;border-radius:var(--radius);margin-bottom:20px;font-size:0.875rem;line-height:1.5}
    .banner-expired{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
    .banner-pending{background:#fffbeb;border:1px solid #fde68a;color:#92400e}
    .banner-success{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}
    .banner-error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
    /* Buttons */
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:var(--font-main);font-size:0.9375rem;font-weight:700;padding:14px 28px;border:none;border-radius:var(--radius);cursor:pointer;text-decoration:none;transition:background 0.15s,transform 0.1s;width:100%}
    .btn:active{transform:scale(0.98)}
    .btn-primary{background:var(--color-primary);color:#fff}
    .btn-primary:hover{background:var(--color-primary-dark);text-decoration:none}
    .btn-secondary{background:var(--color-bg);color:var(--color-text);border:1px solid var(--color-border)}
    .btn-secondary:hover{background:var(--color-surface)}
    .btn-success{background:var(--color-success);color:#fff}
    /* Toast */
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:12px 24px;border-radius:var(--radius);font-size:0.875rem;font-weight:600;opacity:0;pointer-events:none;transition:opacity 0.3s;z-index:100}
    .toast.show{opacity:1}
    /* Lang toggle */
    .lang-toggle{display:flex;align-items:center;gap:4px;font-size:0.8125rem;font-weight:600;user-select:none}
    .lang-toggle span[data-lang]{cursor:pointer;padding:0 2px;transition:color 0.15s}
    .lang-toggle span[data-lang].active{color:var(--color-primary)}
    .lang-toggle span[data-lang]:not(.active){color:var(--color-muted)}
    /* Empty state */
    .not-found{text-align:center;padding:60px 24px}
    .not-found-icon{font-size:3rem;margin-bottom:16px;color:var(--color-border)}
    @media(max-width:1024px){
      main{max-width:740px}
      .quote-layout{grid-template-columns:1fr}
      .transaction-card{position:static}
    }
    @media(max-width:640px){
      .spec-grid{grid-template-columns:1fr}
    }
    @media(max-width:480px){
      main{padding:24px 16px 48px}
      .card{padding:18px}
      .transaction-price{font-size:1.55rem}
    }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="logo-link" aria-label="MildMate Home">
        <picture><source srcset="/images/logo.webp" type="image/webp"><img src="/images/logo.png" alt="MildMate" width="180" height="50"></picture>
      </a>
      <div class="header-right">
        <div class="lang-toggle" role="group" aria-label="Language switch">
          <span data-lang="en" class="active" style="cursor:pointer" onclick="switchLang('en')">EN</span>
          <span style="color:var(--color-border)">/</span>
          <span data-lang="th" style="cursor:pointer" onclick="switchLang('th')">TH</span>
        </div>
      </div>
    </div>
  </header>
  <main>
    ${quote ? `
      <h1>Custom Quote</h1>
      <p class="subtitle">${esc(quoteId)} &middot; ${esc(productTitle)}</p>
      <div class="quote-layout">
        <section class="quote-main">
          ${isExpired ? `<div class="banner banner-expired"><strong>Quote Expired</strong><br>This quote expired on ${(/* @__PURE__ */ new Date(quote.expires_at + "Z")).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Please request a new quote.</div>` : ""}
          ${!isExpired && !isApproved ? `<div class="banner banner-pending"><strong>Quote Pending</strong><br>This quote is awaiting pricing. We will email you once your price is ready.</div>` : ""}
          ${isApproved && !isExpired ? `<div class="banner banner-success"><strong>Quote Approved</strong><br>Your custom price has been confirmed. Add to cart to complete your order.</div>` : ""}

          <div class="card">
            <div class="spec-grid">
              <div class="spec-item">
                <div class="label">Product</div>
                <div class="value">${esc(productTitle)}</div>
              </div>
              <div class="spec-item">
                <div class="label">Dimensions</div>
                <div class="value">${esc(dimStr)}</div>
              </div>
              <div class="spec-item">
                <div class="label">Fabric</div>
                <div class="value">${esc(fabricLabel)}</div>
              </div>
              <div class="spec-item">
                <div class="label">Color</div>
                <div class="value">${esc(colorLabel)}</div>
              </div>
            </div>
          </div>
        </section>

        <aside class="card transaction-card">
          <div class="transaction-label">Quote Total</div>
          ${priceThb ? isUsdQuoted ? `<div class="transaction-price">$${priceUsd.toLocaleString()} USD</div>` : `<div class="transaction-price">&#3647;${priceThb.toLocaleString()} THB</div>` : `<div class="transaction-pending">Awaiting pricing</div>`}
          ${quote.expires_at && priceThb ? `
            <div class="validity-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <span>Price valid until ${(/* @__PURE__ */ new Date(quote.expires_at + "Z")).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
          ` : ""}
          ${isApproved && !isExpired && priceThb ? `
          <button id="quote-cta" type="button" class="btn btn-primary" onclick="if(window.addQuoteToCart){window.addQuoteToCart();}else{try{var itemEl=document.getElementById('quote-cart-data');var item=itemEl?JSON.parse(itemEl.textContent||'null'):null;if(!item){return false;}var key='mildmate-cart';var cart=JSON.parse(localStorage.getItem(key)||'{&quot;items&quot;:[]}');cart.items=Array.isArray(cart.items)?cart.items:[];var ex=cart.items.find(function(i){return i.type===item.type&&i.fabric===item.fabric&&JSON.stringify(i.dimensions)===JSON.stringify(item.dimensions);});if(ex){ex.qty=(ex.qty||1)+1;}else{cart.items.push(item);}localStorage.setItem(key,JSON.stringify(cart));this.textContent='Review &amp; Pay';this.style.background='var(--color-success)';this.onclick=function(){window.location.href='/checkout/';};}catch(e){}}return false;">Add to Cart</button>
          ` : `<div class="transaction-note">${isExpired ? "This quote has expired. Please request a new quote." : "We'll send pricing confirmation once your quote is approved."}</div>`}
        </aside>
      </div>
    ` : `
      <div class="not-found">
        <div class="not-found-icon">&#128269;</div>
        <h1>Quote Not Found</h1>
        <p style="color:var(--color-muted);margin-top:8px">Quote ${esc(quoteId)} was not found. It may have been removed or the link is incorrect.</p>
        <a href="/" class="btn btn-primary" style="width:auto;margin-top:24px">Go to Homepage</a>
      </div>
    `}
  </main>
  <div class="toast" id="toast"></div>
  <script id="quote-cart-data" type="application/json">${cartItemJson}<\/script>
  <script src="/js/cart.js"><\/script>
  <script>
    var _quoteCartItem = null;
    var _quoteIsAdded = false;
    try {
      var _dataEl = document.getElementById('quote-cart-data');
      _quoteCartItem = _dataEl ? JSON.parse(_dataEl.textContent || 'null') : null;
    } catch (e) {
      _quoteCartItem = null;
    }

    window.addQuoteToCart = function addQuoteToCart() {
      if (_quoteIsAdded) return;
      if (!_quoteCartItem) { showToast('Quote not available'); return; }
      try {
        if (typeof MildMateCart !== 'undefined' && MildMateCart && typeof MildMateCart.add === 'function') {
          MildMateCart.add(_quoteCartItem);
        } else {
          var key = 'mildmate-cart';
          var raw = localStorage.getItem(key) || '{"items":[]}';
          var cart = JSON.parse(raw);
          cart.items = Array.isArray(cart.items) ? cart.items : [];
          var existing = cart.items.find(function(i) {
            return i.type === _quoteCartItem.type && i.fabric === _quoteCartItem.fabric &&
              JSON.stringify(i.dimensions) === JSON.stringify(_quoteCartItem.dimensions);
          });
          if (existing) existing.qty = (existing.qty || 1) + 1;
          else cart.items.push(_quoteCartItem);
          localStorage.setItem(key, JSON.stringify(cart));
        }
        _quoteIsAdded = true;
        showToast('Added to cart');
        var btn = document.getElementById('quote-cta');
        if (btn) {
          btn.textContent = 'Review & Pay';
          btn.style.background = 'var(--color-success)';
          btn.onclick = function() { window.location.href = '/checkout/'; };
        }
      } catch (e) {
        showToast('Could not add to cart');
      }
    };

    window.switchLang = function switchLang(lang) {
      sessionStorage.setItem('lang', lang);
      if (lang === 'th') {
        window.location.href = '/th' + window.location.pathname.replace(/^/th/, '');
      } else {
        window.location.href = window.location.pathname.replace(/^/th/, '') || '/';
      }
    };

    function showToast(msg) {
      var t = document.getElementById('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(function() { t.classList.remove('show'); }, 2500);
    }

    var _cta = document.getElementById('quote-cta');
    if (_cta) _cta.addEventListener('click', window.addQuoteToCart);

  <\/script>
</body>
</html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html;charset=utf-8",
      "Cache-Control": "no-cache"
    }
  });
}, "onRequest");

// r2/[[path]].ts
var onRequest6 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.pathname.replace("/r2/", "");
  const R2_PUBLIC_BASE8 = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";
  const publicUrl = `${R2_PUBLIC_BASE8}/${key}`;
  try {
    const obj = await env.MILDMATE_ASSETS.get(key);
    if (obj) {
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }
  } catch (_) {
  }
  return Response.redirect(publicUrl, 302);
}, "onRequest");

// account/_middleware.ts
function getClerkSessionToken2(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookieMatch = cookieHeader.match(/__session=([^;]+)/) || cookieHeader.match(/__clerk_db_jwt=([^;]+)/);
  if (cookieMatch) return cookieMatch[1];
  const url = new URL(request.url);
  const qp = url.searchParams.get("__clerk_db_jwt") || url.searchParams.get("__session");
  if (qp) return qp;
  return null;
}
__name(getClerkSessionToken2, "getClerkSessionToken");
var onRequest7 = /* @__PURE__ */ __name(async (context) => {
  const host = new URL(context.request.url).host;
  if (host.includes("pages.dev") || host.includes("localhost")) {
    return context.next();
  }
  const sessionToken = getClerkSessionToken2(context.request);
  if (!sessionToken) {
    return redirectToSignIn(context.request.url);
  }
  const modifiedRequest = new Request(context.request.url, {
    headers: new Headers({
      ...Object.fromEntries(context.request.headers.entries()),
      Authorization: `Bearer ${sessionToken}`
    })
  });
  const result = await verifyClerkJwt(modifiedRequest, context.env);
  if (!result.valid) {
    return redirectToSignIn(context.request.url);
  }
  return context.next();
}, "onRequest");
function redirectToSignIn(currentUrl) {
  const parsed = new URL(currentUrl);
  const isDev = parsed.host.includes("pages.dev") || parsed.host.includes("localhost");
  const accountsDomain = isDev ? "kind-joey-29.accounts.dev" : "accounts.mildmate.com";
  const cleanReturnUrl = parsed.origin + parsed.pathname;
  const signInUrl = new URL(`https://${accountsDomain}/sign-in`);
  signInUrl.searchParams.set("redirect_url", cleanReturnUrl);
  return Response.redirect(signInUrl.toString(), 302);
}
__name(redirectToSignIn, "redirectToSignIn");

// admin/_middleware.ts
function getClerkSessionToken3(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookieMatch = cookieHeader.match(/__session=([^;]+)/) || cookieHeader.match(/__clerk_db_jwt=([^;]+)/);
  if (cookieMatch) return cookieMatch[1];
  const url = new URL(request.url);
  const qp = url.searchParams.get("__clerk_db_jwt") || url.searchParams.get("__session");
  if (qp) return qp;
  return null;
}
__name(getClerkSessionToken3, "getClerkSessionToken");
function collectRoles13(raw) {
  if (!raw || typeof raw !== "object") return [];
  const values = [];
  const add = /* @__PURE__ */ __name((v) => {
    if (v !== void 0 && v !== null) values.push(v);
  }, "add");
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
  const out = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}
__name(collectRoles13, "collectRoles");
function hasAdminRole13(rawClaims) {
  const roles = collectRoles13(rawClaims);
  return roles.some(
    (r) => r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin")
  );
}
__name(hasAdminRole13, "hasAdminRole");
function emailAllowed13(email, env) {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
__name(emailAllowed13, "emailAllowed");
function emailBlocked(email) {
  if (!email) return false;
  const blocked = [
    "mildmateshop@gmail.com"
  ];
  return blocked.includes(email.toLowerCase());
}
__name(emailBlocked, "emailBlocked");
function getPrimaryClerkEmail2(user) {
  if (!user || typeof user !== "object") return "";
  const list = Array.isArray(user.email_addresses) ? user.email_addresses : [];
  const primaryId = user.primary_email_address_id;
  const primary = list.find((e) => e && e.id === primaryId);
  return String(primary?.email_address || list[0]?.email_address || "").trim().toLowerCase();
}
__name(getPrimaryClerkEmail2, "getPrimaryClerkEmail");
async function enrichAdminFromClerk(sub, env) {
  const clerkKey = String(env.CLERK_SECRET_KEY || "").trim();
  if (!sub || !clerkKey) return { email: "", hasAdmin: false };
  try {
    const resp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
      headers: { Authorization: "Bearer " + clerkKey }
    });
    if (!resp.ok) return { email: "", hasAdmin: false };
    const user = await resp.json();
    const email = getPrimaryClerkEmail2(user);
    const metadataRaw = {
      role: user?.public_metadata?.role,
      roles: user?.public_metadata?.roles,
      org_role: user?.public_metadata?.org_role,
      orgRole: user?.public_metadata?.orgRole,
      public_metadata: user?.public_metadata || {},
      unsafe_metadata: user?.unsafe_metadata || {},
      metadata: user?.private_metadata || {}
    };
    return { email, hasAdmin: hasAdminRole13(metadataRaw) };
  } catch {
    return { email: "", hasAdmin: false };
  }
}
__name(enrichAdminFromClerk, "enrichAdminFromClerk");
var onRequest8 = /* @__PURE__ */ __name(async (context) => {
  const host = new URL(context.request.url).host;
  if (host.includes("pages.dev") || host.includes("localhost")) {
    return context.next();
  }
  const sessionToken = getClerkSessionToken3(context.request);
  if (!sessionToken) {
    return redirectToSignIn2(context.request.url);
  }
  const modifiedRequest = new Request(context.request.url, {
    headers: new Headers({
      ...Object.fromEntries(context.request.headers.entries()),
      Authorization: `Bearer ${sessionToken}`
    })
  });
  const result = await verifyClerkJwt(modifiedRequest, context.env);
  if (!result.valid) {
    return redirectToSignIn2(context.request.url);
  }
  const raw = result.payload.raw || {};
  let email = String(result.payload.email || "").trim().toLowerCase();
  let hasAdmin = hasAdminRole13(raw);
  let allowed = emailAllowed13(email, context.env);
  if (!hasAdmin && !allowed) {
    const sub = String(result.payload.sub || "").trim();
    const enriched = await enrichAdminFromClerk(sub, context.env);
    if (enriched.email) email = enriched.email;
    hasAdmin = hasAdmin || enriched.hasAdmin;
    allowed = allowed || emailAllowed13(email, context.env);
  }
  if (emailBlocked(email)) {
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Access Denied \u2014 MildMate</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F8FAFC;color:#1E293B;text-align:center;padding:24px}h1{font-size:1.5rem;margin-bottom:8px}p{color:#64748b;font-size:0.9375rem;max-width:400px;margin:0 auto 24px}a{color:#2c96f4;text-decoration:none;font-weight:600}a:hover{text-decoration:underline}</style></head>
<body><div><h1>Access Denied</h1><p>${escHtml3(email)} does not have super-admin access.</p><a href="/">Go to Homepage</a></div></body></html>`,
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
  if (!hasAdmin && !allowed) {
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Access Denied \u2014 MildMate</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F8FAFC;color:#1E293B;text-align:center;padding:24px}h1{font-size:1.5rem;margin-bottom:8px}p{color:#64748b;font-size:0.9375rem;max-width:400px;margin:0 auto 24px}a{color:#2c96f4;text-decoration:none;font-weight:600}a:hover{text-decoration:underline}</style></head>
<body><div><h1>Access Denied</h1><p>${escHtml3(email)} does not have admin access. Contact a MildMate admin to request access.</p><a href="/">Go to Homepage</a></div></body></html>`,
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
  return context.next();
}, "onRequest");
function redirectToSignIn2(currentUrl) {
  const parsed = new URL(currentUrl);
  const isDev = parsed.host.includes("pages.dev") || parsed.host.includes("localhost");
  const accountsDomain = isDev ? "kind-joey-29.accounts.dev" : "accounts.mildmate.com";
  const cleanReturnUrl = parsed.origin + parsed.pathname;
  const signInUrl = new URL(`https://${accountsDomain}/sign-in`);
  signInUrl.searchParams.set("redirect_url", cleanReturnUrl);
  return Response.redirect(signInUrl.toString(), 302);
}
__name(redirectToSignIn2, "redirectToSignIn");
function escHtml3(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
__name(escHtml3, "escHtml");

// _middleware.ts
var CACHE_TTL = 5 * 60 * 1e3;
var _cache = { fetchedAt: 0 };
var FALLBACK_HEADER = `<header class="site-header">
    <div class="container header-inner">

      <button class="hamburger" aria-label="Open menu" aria-expanded="false">
        <span></span>
        <span></span>
        <span></span>
      </button>

      <a href="/" class="logo-link" aria-label="MildMate Home">
        <picture><source srcset="/images/logo.webp" type="image/webp"><img src="/images/logo.png" alt="MildMate" width="180" height="50"></picture>
      </a>

      <nav class="main-nav" aria-label="Main navigation">
        <ul class="nav-list">
          <li class="nav-item">
            <a href="/products/" class="nav-link">Shop</a>
          </li>
          <li class="nav-item">
            <a href="/fabric/" class="nav-link">Fabrics</a>
          </li>
          <li class="nav-item">
            <a href="/sizeguide/" class="nav-link">Size Guide</a>
          </li>
          <li class="nav-item">
            <a href="/blogs/" class="nav-link">Blog</a>
          </li>
        </ul>
      </nav>

      <div class="header-actions">
        <button class="search-btn" aria-label="Search products" aria-expanded="false">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
        <a href="/account/" class="account-btn" aria-label="My account" style="display:flex;align-items:center;gap:4px">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none" class="account-icon"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span class="sign-in-pill">Sign In</span>
        </a>
        <a href="/checkout/" class="cart-btn" aria-label="Shopping cart">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span class="cart-count">0</span>
        </a>
        <div class="lang-toggle" role="group" aria-label="Language switch">
          <span data-lang="en" class="active" style="color:var(--color-primary);border-bottom:2px solid var(--color-primary);padding-bottom:1px">EN</span>
          <span style="color:var(--color-border)">/</span>
          <span data-lang="th" style="color:var(--color-muted)">TH</span>
        </div>
      </div>
    </div>

    <div class="mobile-overlay" aria-hidden="true"></div>
    <div class="mobile-drawer" aria-label="Mobile menu">
      <div class="mobile-drawer-search">
        <form action="/products/" method="get" class="drawer-search-form">
          <input type="search" name="q" placeholder="Search bedding, fabrics, sizes..." aria-label="Search products" autocomplete="off">
          <button type="submit" aria-label="Submit search">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
        </form>
      </div>
      <ul class="mobile-nav-list">
        <li><a href="/">Home</a></li>
        <li><a href="/products/">Shop</a></li>
        <li><a href="/fabric/">Fabrics</a></li>
        <li><a href="/sizeguide/">Size Guide</a></li>
        <li class="mobile-nav-signin"><a href="/account/" class="sign-in-drawer-link" style="display:inline-block;background:var(--color-primary);color:#fff;font-weight:700;padding:8px 16px;border-radius:6px;margin-top:12px">Sign In</a></li>
      </ul>
      <div class="mobile-drawer-lang" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--color-border);display:flex;align-items:center;gap:8px">
        <span style="font-size:0.8125rem;font-weight:600;color:var(--color-muted)">Language:</span>
        <span data-lang="en" class="active" style="color:var(--color-primary);font-weight:700;font-size:0.9375rem;cursor:pointer">EN</span>
        <span style="color:var(--color-border)">/</span>
        <span data-lang="th" style="color:var(--color-muted);font-weight:600;font-size:0.9375rem;cursor:pointer" onclick="window.location.href='/th/'">TH</span>
      </div>
    </div>

    <div class="search-overlay" aria-hidden="true">
      <div class="search-overlay-inner">
        <button class="search-close" aria-label="Close search">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <form action="/products/" method="get" class="search-form">
          <input type="search" name="q" placeholder="Search bedding, fabrics, sizes..." aria-label="Search" autocomplete="off">
          <button type="submit" aria-label="Submit search">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
        </form>
      </div>
    </div>
  </header>`;
var FALLBACK_FOOTER = `<footer class="site-footer">
    <div class="container">
      <div class="footer-grid">

        <!-- Column 1: Quick Links -->
        <div class="footer-col">
          <h3>Quick Links</h3>
          <ul>
            <li><a href="/about/">About Us</a></li>
            <li><a href="/contact/">Contact Us</a></li>
            <li><a href="/reviews/">Reviews</a></li>
          </ul>
        </div>

        <!-- Column 2: Customer Service -->
        <div class="footer-col">
          <h3>Customer Service</h3>
          <ul>
            <li><a href="/faq/">FAQ</a></li>
            <li><a href="/sizeguide/">Size Guide</a></li>
            <li><a href="/blogs/">Blog</a></li>
          </ul>
        </div>

        <!-- Column 3: Shop With Us (icon only) -->
        <div class="footer-col">
          <h3>Shop With Us</h3>
          <div class="footer-icons-grid">
            <a href="https://www.etsy.com/shop/mildmate" target="_blank" rel="noopener noreferrer" aria-label="Etsy" class="footer-icon-circle">
              <img src="/images/Logo/Etsy.png" alt="" width="100" height="100" decoding="async">
            </a>
            <a href="https://www.ebay.com/str/mildmate" target="_blank" rel="noopener noreferrer" aria-label="eBay" class="footer-icon-circle">
              <img src="/images/Logo/eBay.png" alt="" width="100" height="100" decoding="async">
            </a>
            <a href="https://shopee.co.th/neededshop_bt.2n.1y" target="_blank" rel="noopener noreferrer" aria-label="Shopee" class="footer-icon-circle">
              <img src="/images/Logo/Shopee.png" alt="" width="100" height="100" decoding="async">
            </a>
            <a href="https://www.lazada.co.th/shop/needed-shop" target="_blank" rel="noopener noreferrer" aria-label="Lazada" class="footer-icon-circle">
              <img src="/images/Logo/Lazada.png" alt="" width="100" height="100" decoding="async">
            </a>
          </div>
        </div>

        <!-- Column 4: Contact -->
        <div class="footer-col">
          <h3>Contact</h3>
          <ul>
            <li>
              <a href="mailto:contact@mildmate.com">
                <svg class="footer-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                contact@mildmate.com
              </a>
            </li>
            <li>
              <a href="tel:+66872362364">
                <svg class="footer-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                +66 (0)87 236 2364
              </a>
            </li>
          </ul>
          <div class="footer-icons-grid contact-icons">
            <a href="https://wa.me/66811515995" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" class="footer-icon-circle">
              <img src="/images/Logo/WhatsAPP.png" alt="" width="100" height="100" decoding="async">
            </a>
            <a href="https://page.line.me/507abyoy" target="_blank" rel="noopener noreferrer" aria-label="LINE" class="footer-icon-circle">
              <img src="/images/Logo/LineOA.png" alt="" width="100" height="100" decoding="async">
            </a>
          </div>
        </div>
      </div>

      <!-- Social Media Center Row -->
      <div class="footer-social-center">
        <a href="https://www.facebook.com/mildmate.bedsheets" target="_blank" rel="noopener noreferrer" aria-label="Facebook" class="footer-social-icon">
          <img src="/images/Logo/Facebook.png" alt="" width="100" height="100" decoding="async">
        </a>
        <a href="https://www.instagram.com/mild_mate/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" class="footer-social-icon">
          <img src="/images/Logo/Instagram.png" alt="" width="100" height="100" decoding="async">
        </a>
        <a href="https://www.tiktok.com/@bt.mildmate" target="_blank" rel="noopener noreferrer" aria-label="TikTok" class="footer-social-icon">
          <img src="/images/Logo/TikTok.png" alt="" width="100" height="100" decoding="async">
        </a>
        <a href="https://www.pinterest.com/mildmateshop/" target="_blank" rel="noopener noreferrer" aria-label="Pinterest" class="footer-social-icon">
          <img src="/images/Logo/Pinterest.png" alt="" width="100" height="100" decoding="async">
        </a>
        <a href="https://www.youtube.com/channel/UCnxunfprych7pMss4zr6Qcw" target="_blank" rel="noopener noreferrer" aria-label="YouTube" class="footer-social-icon">
          <img src="/images/Logo/YouTube.png" alt="" width="100" height="100" decoding="async">
        </a>
      </div>

      <!-- Footer Bottom Bar -->
      <div class="footer-bottom">
        <p>&copy; MildMate 2026</p>
        <div class="footer-bottom-links">
          <a href="/policy/">Privacy Policy</a>
          <a href="/shipping/">Returns &amp; Delivery</a>
        </div>
      </div>
    </div>
  </footer>`;
var JSON_LD_ORG = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "MildMate",
  "url": "https://www.mildmate.com",
  "logo": "https://www.mildmate.com/images/logo.png",
  "description": "Custom made-to-measure bedding for marine, yacht, RV, family co-sleep, and standard mattresses. Ships worldwide from Thailand.",
  "foundingDate": "2019",
  "foundingLocation": "Thailand",
  "areaServed": "Worldwide",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+66-87-236-2364",
    "contactType": "customer service",
    "availableLanguage": ["English", "Thai"]
  },
  "sameAs": [
    "https://www.etsy.com/shop/mildmate",
    "https://www.ebay.com/str/mildmate",
    "https://shopee.co.th/neededshop_bt.2n.1y",
    "https://www.lazada.co.th/shop/needed-shop",
    "https://www.facebook.com/mildmate.bedsheets",
    "https://www.instagram.com/mild_mate/",
    "https://www.tiktok.com/@bt.mildmate",
    "https://www.pinterest.com/mildmateshop/"
  ]
}
<\/script>`;
var JSON_LD_WEBSITE = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "MildMate",
  "url": "https://www.mildmate.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://www.mildmate.com/products/?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
<\/script>`;
var JSON_LD_FAQ = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "I have a specific boat model (e.g., Beneteau Antares 11, Apreamare Cabinato 11, or SS7 Bayliner). Do you have templates or fitments for these?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We specialize in bespoke fitments for these specific hull designs. While we maintain a library of common shapes, we treat every cabin bed as a unique project to ensure a Built-In appearance. Before production, we generate a digital blueprint of your hull's geometry for your approval to confirm orientation (head vs. foot) and taper. Sheets are custom-tailored to the exact taper of the hull, featuring a heavy-duty 360-degree elastic perimeter to stay anchored during heavy seas or when lifting mattresses for storage access."
      }
    },
    {
      "@type": "Question",
      "name": "Can you create a single fitted sheet and protector for combined beds (e.g., 290 cm total width)?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. We manufacture Unified Surface conversions for any combined footprint, including massive setups up to 290 cm x 183 cm. We use a single, 100% seamless piece of fabric to eliminate the uncomfortable center ridge found in standard joined sheets. We offer a 20% discount for customers ordering two or more custom family sheets."
      }
    },
    {
      "@type": "Question",
      "name": "Can you make custom waterproof protectors for pets (e.g., 132 x 80 inches)?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. We build Asset-Shield protectors to any dimensions to preserve luxury mattress foam from pet accidents. We tailor the pocket depth (customizable up to 24 inches plus) to ensure sidewalls stay locked during the lateral force of pets jumping on the bed. Our 6-sided encasements feature top-perimeter zippers so they can be installed without fully lifting heavy mattresses."
      }
    },
    {
      "@type": "Question",
      "name": "Why do you recommend a 2-layer system instead of a single-layer sewn TPU unit for body pillows?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Frequent washing can cause TPU membranes to delaminate if sewn directly to outer fabric. Our system lets you wash the outer cover (PremaCotton or BreezePlus) while the TPU liner remains protected. Sewing TPU directly creates needle holes that can leak. A separate inner liner provides 100% spill-proof protection. Separate layers also ensure the pillow stays soft and quiet."
      }
    },
    {
      "@type": "Question",
      "name": "What makes the 3-sided zipper better for heavy duvets?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The Suitcase-Style load allows the top layer to flip back completely. You simply lay the heavy insert flat and zip it closed, cutting bed-making time by approximately 90% and eliminating heavy lifting."
      }
    },
    {
      "@type": "Question",
      "name": "What is the lead time and do you ship to Australia?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Most custom orders are prepared for shipping within 48 hours to a few days depending on complexity. We ship globally, including to Australia and the UK. Arrival times vary based on regional courier performance."
      }
    }
  ]
}
<\/script>`;
var SHARED_FOOTER_MOBILE_STYLE = `<style id="shared-footer-mobile-style">
@media (max-width: 768px) {
  .site-footer {
    padding: 40px 0 28px !important;
  }
  .site-footer .footer-grid {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 32px 20px !important;
    margin-bottom: 28px !important;
  }
  .site-footer .footer-col:nth-child(1),
  .site-footer .footer-col:nth-child(2) {
    grid-column: span 1 !important;
  }
  .site-footer .footer-col:nth-child(3),
  .site-footer .footer-col:nth-child(4) {
    grid-column: span 2 !important;
  }
  .site-footer .footer-col h3 {
    font-size: 15px !important;
    margin-bottom: 16px !important;
    letter-spacing: 0.5px !important;
  }
  .site-footer .footer-col ul li {
    margin-bottom: 12px !important;
  }
  .site-footer .footer-col ul li a {
    font-size: 15px !important;
    line-height: 1.5 !important;
    color: rgba(255, 255, 255, 0.9) !important;
  }
  .site-footer .footer-col ul li a:hover {
    color: var(--color-primary) !important;
  }
  .footer-icon-circle,
  .footer-social-icon {
    width: 36px !important;
    height: 36px !important;
    position: relative !important;
  }
  .footer-icon-circle::after,
  .footer-social-icon::after {
    content: '' !important;
    position: absolute !important;
    top: -4px !important;
    bottom: -4px !important;
    left: -4px !important;
    right: -4px !important;
  }
  .footer-icon-circle img,
  .footer-social-icon img {
    width: 20px !important;
    height: 20px !important;
  }
  .footer-social-center {
    margin: 24px 0 20px !important;
    gap: 12px !important;
    justify-content: center !important;
  }
  .footer-bottom {
    margin-top: 20px !important;
    gap: 10px !important;
  }
  .footer-bottom-links {
    margin-bottom: 4px !important;
  }
}
</style>`;
var SHARED_FAVICON_LINKS = `<link rel="icon" type="image/png" sizes="32x32" href="/images/logo.png">
<link rel="apple-touch-icon" href="/images/logo.png">`;
var LISTING_IMAGE_SYNC_SCRIPT = `<script src="/js/listing-images-sync.js"><\/script>`;
async function ensureCache(db) {
  const now = Date.now();
  if (_cache.header && _cache.footer && now - _cache.fetchedAt < CACHE_TTL) return;
  if (!db) {
    console.error("_middleware: no DB binding available");
    return;
  }
  try {
    const stmt = db.prepare(
      "SELECT template_key, template_html FROM site_templates WHERE template_key IN ('header-standard', 'footer-standard')"
    );
    const { results } = await stmt.all();
    for (const row of results) {
      if (row.template_key === "header-standard") _cache.header = row.template_html;
      if (row.template_key === "footer-standard") _cache.footer = row.template_html;
    }
    _cache.fetchedAt = now;
  } catch (e) {
    console.error("_middleware: D1 fetch failed:", e);
  }
}
__name(ensureCache, "ensureCache");
async function getChrome(db, key) {
  const fallback = key === "header" ? FALLBACK_HEADER : FALLBACK_FOOTER;
  await ensureCache(db);
  const html = _cache[key] || fallback;
  if (key !== "header") return html;
  return html.replace(/<li class="nav-item">\s*<a href="\/blogs\/" class="nav-link">Blog<\/a>\s*<\/li>/g, "").replace(/<li>\s*<a href="\/blogs\/">Blog<\/a>\s*<\/li>/g, "");
}
__name(getChrome, "getChrome");
var SKIP_PREFIXES = ["/admin/", "/super-admin/", "/api/", "/r2/", "/images/", "/css/", "/js/", "/fonts/"];
var SKIP_EXTENSIONS = [".js", ".css", ".png", ".jpg", ".webp", ".svg", ".ico", ".woff2", ".json", ".xml", ".map"];
var CANONICAL_PRODUCT_SLUGS2 = /* @__PURE__ */ new Set([
  "standard-fitted-sheet",
  "deep-pocket-fitted-sheet",
  "marine-fitted-sheet",
  "dorm-fitted-sheet",
  "rv-truck-fitted-sheet",
  "family-fitted-sheet",
  "pet-owner-fitted-sheet",
  "flat-sheet-standard",
  "flat-sheet-extra-deep-pocket",
  "3-sided-duvet",
  "pet-owner-duvet-cover",
  "duvet-cover-marine",
  "duvet-cover-rv",
  "duvet-cover-dorm",
  "duvet-insert",
  "pillowcase-envelope",
  "pillowcase-zipper",
  "pillowcase-sham",
  "mattress-protector-standard",
  "marine-mattress-protector",
  "mattress-protector-family",
  "mattress-protector-deep-pocket",
  "pet-proof-mattress-protector",
  "mattress-encasement-general",
  "rv-truck-mattress-encasement",
  "pillow-protector-general",
  "bedbridge-connector",
  "mattress-lift-helper"
]);
function hasToken2(slug, token) {
  return new RegExp(`(^|[-/])${token}($|[-/])`).test(slug);
}
__name(hasToken2, "hasToken");
function resolveLegacyProductPath(pathname) {
  if (pathname === "/product/" || pathname === "/product") return "/products/";
  if (!pathname.startsWith("/product/")) return null;
  const subpath = pathname.slice("/product/".length);
  const parts = subpath.split("/").filter(Boolean);
  const slug = (parts[0] || "").toLowerCase();
  if (!slug) return "/products/";
  if (CANONICAL_PRODUCT_SLUGS2.has(slug)) return null;
  const rawSlug = subpath.replace(/\/+$/, "").toLowerCase();
  if (rawSlug === "%e0%b9%84%e0%b8%aa%e0%b9%89%e0%b8%9c%e0%b9%89%e0%b8%b2%e0%b8%99%e0%b8%a7%e0%b8%a1") return "/product/duvet-insert/";
  if (rawSlug.startsWith("%e0%b8%9c%e0%b9%89%e0%b8%b2%e0%b8%9b%e0%b8%b9")) return "/product/family-fitted-sheet/";
  if (rawSlug.startsWith("product-boat-bedding") || rawSlug.startsWith("product-boat-top-sheet")) return "/product/marine-fitted-sheet/";
  if (rawSlug.includes("boat") && rawSlug.includes("pillow")) return "/product/pillowcase-envelope/";
  if (rawSlug.includes("dorm")) return rawSlug.includes("duvet") ? "/product/duvet-cover-dorm/" : "/product/dorm-fitted-sheet/";
  if (rawSlug.includes("rv-truck") || hasToken2(rawSlug, "rv") || rawSlug.includes("truck")) {
    if (rawSlug.includes("duvet")) return "/product/duvet-cover-rv/";
    if (rawSlug.includes("encasement")) return "/product/rv-truck-mattress-encasement/";
    return "/product/rv-truck-fitted-sheet/";
  }
  if (rawSlug.includes("marine") || rawSlug.includes("boat")) return rawSlug.includes("duvet") ? "/product/duvet-cover-marine/" : "/product/marine-fitted-sheet/";
  if (rawSlug.includes("pet")) {
    if (rawSlug.includes("duvet") || rawSlug.includes("3-sided")) return "/product/pet-owner-duvet-cover/";
    if (rawSlug.includes("protector")) return "/product/pet-proof-mattress-protector/";
    if (rawSlug.includes("pillow")) return "/product/pillowcase-zipper/";
    return "/product/pet-owner-fitted-sheet/";
  }
  if (rawSlug.includes("co-sleeping") || rawSlug.includes("family")) return "/product/family-fitted-sheet/";
  if (rawSlug.includes("duvet")) return "/product/3-sided-duvet/";
  if (rawSlug.includes("encasement") || rawSlug.includes("zippered-tpu-mattress-cover")) return "/product/mattress-encasement-general/";
  if (rawSlug.includes("sheet-protectors") || rawSlug.includes("protector") || rawSlug === "pillow-case") return "/product/mattress-protector-standard/";
  if (rawSlug.includes("pillow") || rawSlug.includes("pillowcase") || rawSlug.includes("pillow-cover") || rawSlug.includes("pillow-case")) {
    if (rawSlug.includes("sham") || rawSlug.includes("vent")) return "/product/pillowcase-sham/";
    if (rawSlug.includes("zip") || rawSlug.includes("hidden-zipper")) return "/product/pillowcase-zipper/";
    return "/product/pillowcase-envelope/";
  }
  if (rawSlug.includes("fitted") || rawSlug.includes("bed-sheet") || rawSlug.includes("bedsheet")) return "/product/standard-fitted-sheet/";
  if (rawSlug === "tbar") return "/product/bedbridge-connector/";
  if (rawSlug === "baby-blanket" || rawSlug === "animal-bedding") return "/products/";
  return "/products/";
}
__name(resolveLegacyProductPath, "resolveLegacyProductPath");
var LISTING_ROUTES = {
  "/products/": { lang: "en", mode: "all" },
  "/sheets/": { lang: "en", mode: "product_type", value: "sheets" },
  "/duvet-covers/": { lang: "en", mode: "product_type", value: "duvet-covers" },
  "/pillowcases/": { lang: "en", mode: "product_type", value: "pillowcases" },
  "/protection/": { lang: "en", mode: "product_type", value: "protection" },
  "/accessories/": { lang: "en", mode: "product_type", value: "accessories" },
  "/marine/": { lang: "en", mode: "niche", value: "marine" },
  "/family/": { lang: "en", mode: "niche", value: "family" },
  "/pets/": { lang: "en", mode: "niche", value: "pets" },
  "/deep-pocket/": { lang: "en", mode: "niche", value: "deep-pocket" },
  "/boarding-dorm/": { lang: "en", mode: "niche", value: "boarding-dorm" },
  "/rv-truck/": { lang: "en", mode: "niche", value: "rv-truck" },
  "/th/products/": { lang: "th", mode: "all" },
  "/th/sheets/": { lang: "th", mode: "product_type", value: "sheets" },
  "/th/duvet-covers/": { lang: "th", mode: "product_type", value: "duvet-covers" },
  "/th/pillowcases/": { lang: "th", mode: "product_type", value: "pillowcases" },
  "/th/protection/": { lang: "th", mode: "product_type", value: "protection" },
  "/th/accessories/": { lang: "th", mode: "product_type", value: "accessories" },
  "/th/marine/": { lang: "th", mode: "niche", value: "marine" },
  "/th/family/": { lang: "th", mode: "niche", value: "family" },
  "/th/pets/": { lang: "th", mode: "niche", value: "pets" },
  "/th/deep-pocket/": { lang: "th", mode: "niche", value: "deep-pocket" },
  "/th/boarding-dorm/": { lang: "th", mode: "niche", value: "boarding-dorm" },
  "/th/rv-truck/": { lang: "th", mode: "niche", value: "rv-truck" }
};
var PRODUCT_TYPE_LABELS_EN = {
  sheets: "SHEETS",
  "duvet-covers": "DUVET COVERS",
  pillowcases: "PILLOWCASES",
  protection: "PROTECTION",
  accessories: "ACCESSORIES"
};
var PRODUCT_TYPE_LABELS_TH = {
  sheets: "\u0E1C\u0E49\u0E32\u0E1B\u0E39\u0E17\u0E35\u0E48\u0E19\u0E2D\u0E19",
  "duvet-covers": "\u0E1B\u0E25\u0E2D\u0E01\u0E1C\u0E49\u0E32\u0E19\u0E27\u0E21",
  pillowcases: "\u0E1B\u0E25\u0E2D\u0E01\u0E2B\u0E21\u0E2D\u0E19",
  protection: "\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C\u0E1B\u0E01\u0E1B\u0E49\u0E2D\u0E07",
  accessories: "\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C\u0E40\u0E2A\u0E23\u0E34\u0E21"
};
var NICHE_LABELS_EN = {
  marine: "MARINE & YACHT",
  family: "FAMILY & CO-SLEEP",
  pets: "PET OWNER",
  "deep-pocket": "DEEP POCKET",
  "boarding-dorm": "BOARDING DORM",
  "rv-truck": "RV & TRUCK"
};
var NICHE_LABELS_TH = {
  marine: "\u0E40\u0E23\u0E37\u0E2D\u0E41\u0E25\u0E30\u0E22\u0E2D\u0E0A\u0E15\u0E4C",
  family: "\u0E04\u0E23\u0E2D\u0E1A\u0E04\u0E23\u0E31\u0E27",
  pets: "\u0E1A\u0E49\u0E32\u0E19\u0E21\u0E35\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E40\u0E25\u0E35\u0E49\u0E22\u0E07",
  "deep-pocket": "\u0E17\u0E35\u0E48\u0E19\u0E2D\u0E19\u0E2B\u0E19\u0E32\u0E1E\u0E34\u0E40\u0E28\u0E29",
  "boarding-dorm": "\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
  "rv-truck": "\u0E23\u0E16\u0E1A\u0E49\u0E32\u0E19\u0E41\u0E25\u0E30\u0E23\u0E16\u0E1A\u0E23\u0E23\u0E17\u0E38\u0E01"
};
function normalizeRoutePath(pathname) {
  if (pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}
__name(normalizeRoutePath, "normalizeRoutePath");
function escapeHtml(value) {
  const str = String(value ?? "");
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
__name(escapeHtml, "escapeHtml");
function parseCsv(raw) {
  return String(raw || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
}
__name(parseCsv, "parseCsv");
function pickPrimaryImage(imagesRaw, imageUrl) {
  try {
    const arr = typeof imagesRaw === "string" ? JSON.parse(imagesRaw) : imagesRaw;
    if (Array.isArray(arr)) {
      const first = String(arr[0] || "").trim();
      if (first) return first;
    }
  } catch {
  }
  return String(imageUrl || "").trim();
}
__name(pickPrimaryImage, "pickPrimaryImage");
function getTagHref(slug, lang) {
  const prefix = lang === "th" ? "/th" : "";
  const valid = ["sheets", "duvet-covers", "pillowcases", "protection", "accessories", "marine", "family", "pets", "deep-pocket", "boarding-dorm", "rv-truck"];
  return valid.includes(slug) ? `${prefix}/${slug}/` : `${prefix}/products/`;
}
__name(getTagHref, "getTagHref");
function buildTagHtml(productType, niches, lang) {
  const productTypeLabels = lang === "th" ? PRODUCT_TYPE_LABELS_TH : PRODUCT_TYPE_LABELS_EN;
  const nicheLabels = lang === "th" ? NICHE_LABELS_TH : NICHE_LABELS_EN;
  const tags = [];
  if (productTypeLabels[productType]) {
    tags.push(`<a href="${getTagHref(productType, lang)}" class="card-tag" style="text-decoration:none;">${escapeHtml(productTypeLabels[productType])}</a>`);
  }
  if (niches.length > 0 && nicheLabels[niches[0]]) {
    const firstNiche = niches[0];
    tags.push(`<a href="${getTagHref(firstNiche, lang)}" class="card-tag" style="text-decoration:none;">${escapeHtml(nicheLabels[firstNiche])}</a>`);
  }
  return tags.join("");
}
__name(buildTagHtml, "buildTagHtml");
function renderListingCards(rows, lang) {
  const priceNote = lang === "th" ? "\u0E44\u0E21\u0E48\u0E23\u0E27\u0E21\u0E04\u0E48\u0E32\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07 \u0E20\u0E32\u0E29\u0E35 \u0E41\u0E25\u0E30\u0E20\u0E32\u0E29\u0E35\u0E28\u0E38\u0E25\u0E01\u0E32\u0E01\u0E23" : "Excludes shipping, tax & tariff";
  const ctaCustom = lang === "th" ? "\u0E2D\u0E2D\u0E01\u0E41\u0E1A\u0E1A\u0E41\u0E25\u0E30\u0E2A\u0E31\u0E48\u0E07\u0E15\u0E31\u0E14" : "Customize This Product";
  const ctaStandard = lang === "th" ? "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E02\u0E19\u0E32\u0E14\u0E41\u0E25\u0E30\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E1C\u0E49\u0E32" : "Choose Size & Fabric";
  const fabricsCustom = lang === "th" ? "\u0E2A\u0E31\u0E48\u0E07\u0E15\u0E31\u0E14\u0E1E\u0E34\u0E40\u0E28\u0E29 \xB7 \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E1C\u0E49\u0E32\u0E44\u0E14\u0E49\u0E2B\u0E25\u0E32\u0E01\u0E2B\u0E25\u0E32\u0E22" : "Custom size \xB7 Multiple fabrics";
  const fabricsFixed = lang === "th" ? "\u0E02\u0E19\u0E32\u0E14\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49 \xB7 \u0E2A\u0E40\u0E1B\u0E01\u0E04\u0E07\u0E17\u0E35\u0E48" : "Ready size \xB7 Fixed configuration";
  return rows.map((row) => {
    const title = lang === "th" ? row.title_th || row.title_en || row.slug : row.title_en || row.slug;
    const benefit = lang === "th" ? row.card_benefit_th || row.card_benefit_en || "" : row.card_benefit_en || row.card_benefit_th || "";
    const productType = String(row.product_type || "").toLowerCase();
    const niches = parseCsv(row.niches);
    const categories = [productType, ...niches, row.is_custom ? "custom-shape" : ""].filter(Boolean).join(",");
    const dataPrice = lang === "th" ? Number(row.base_price_thb || 0) : Number(row.base_price_usd || 0);
    const usd = Math.round(Number(row.base_price_usd || 0));
    const thb = Math.round(Number(row.base_price_thb || 0));
    const priceLabel = lang === "th" ? `\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19 \u0E3F${thb.toLocaleString("en-US")}` : `From US$${usd}`;
    const image = pickPrimaryImage(row.images, row.image_url) || "/images/placeholder.jpg";
    const href = lang === "th" ? `/th/product/${row.slug}/` : `/product/${row.slug}/`;
    return `<article class="product-card" data-categories="${escapeHtml(categories)}" data-title="${escapeHtml(String(title).toLowerCase())}" data-price="${escapeHtml(dataPrice)}">
      <div class="product-image">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" width="800" height="600" loading="lazy" decoding="async">
      </div>
      <div class="product-info">
        <div class="product-tags" aria-label="Categories">${buildTagHtml(productType, niches, lang)}</div>
        <h3 class="product-title">${escapeHtml(title)}</h3>
        <div class="product-price" data-usd="${escapeHtml(usd)}" data-thb="${escapeHtml(thb)}">${escapeHtml(priceLabel)}</div>
        <div class="product-price-note">${escapeHtml(priceNote)}</div>
        <p class="product-benefit">${escapeHtml(benefit)}</p>
        <div class="product-fabrics-info">${escapeHtml(row.is_custom ? fabricsCustom : fabricsFixed)}</div>
        <a href="${escapeHtml(href)}" class="btn btn-primary" style="margin-top:auto;">${escapeHtml(row.is_custom ? ctaCustom : ctaStandard)}</a>
      </div>
    </article>`;
  }).join("\n");
}
__name(renderListingCards, "renderListingCards");
function replaceFirstProductGrid(html, cardMarkup) {
  const start = html.indexOf('<div class="product-grid');
  if (start < 0) return html;
  const openEnd = html.indexOf(">", start);
  if (openEnd < 0) return html;
  const divPattern = /<\/?div\b[^>]*>/gi;
  divPattern.lastIndex = openEnd + 1;
  let depth = 1;
  let closeStart = -1;
  let closeEnd = -1;
  let match2 = null;
  while ((match2 = divPattern.exec(html)) !== null) {
    const token = match2[0];
    if (token.startsWith("</div")) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      closeStart = match2.index;
      closeEnd = match2.index + token.length;
      break;
    }
  }
  if (closeStart < 0 || closeEnd < 0) return html;
  return `${html.slice(0, openEnd + 1)}
${cardMarkup}
${html.slice(closeStart, closeEnd)}${html.slice(closeEnd)}`;
}
__name(replaceFirstProductGrid, "replaceFirstProductGrid");
async function fetchListingProducts(db, config) {
  const baseQuery = `SELECT slug, title_en, title_th, card_benefit_en, card_benefit_th, product_type, niches, base_price_usd, base_price_thb, image_url, images, is_custom, sort_order, id
    FROM products
    WHERE is_active = 1`;
  if (config.mode === "all") {
    const result2 = await db.prepare(`${baseQuery} ORDER BY sort_order, id`).all();
    return result2?.results || [];
  }
  if (!config.value) return [];
  if (config.mode === "product_type") {
    const result2 = await db.prepare(`${baseQuery} AND LOWER(COALESCE(product_type, '')) = ? ORDER BY sort_order, id`).bind(config.value.toLowerCase()).all();
    return result2?.results || [];
  }
  const niche = config.value.toLowerCase();
  const result = await db.prepare(`${baseQuery} AND ((',' || LOWER(COALESCE(niches, '')) || ',') LIKE ? OR (',' || LOWER(COALESCE(category, '')) || ',') LIKE ?) ORDER BY sort_order, id`).bind(`%,${niche},%`, `%,${niche},%`).all();
  return result?.results || [];
}
__name(fetchListingProducts, "fetchListingProducts");
async function onRequest9(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  for (const prefix of SKIP_PREFIXES) {
    if (path.startsWith(prefix)) return context.next();
  }
  for (const ext of SKIP_EXTENSIONS) {
    if (path.endsWith(ext)) return context.next();
  }
  const legacyProductRedirect = resolveLegacyProductPath(path);
  if (legacyProductRedirect) {
    return Response.redirect(new URL(legacyProductRedirect, url.origin).toString(), 301);
  }
  const response = await context.next();
  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("text/html")) return response;
  let html = await response.text();
  const normalizedPath = normalizeRoutePath(path);
  const listingConfig = LISTING_ROUTES[normalizedPath];
  if (listingConfig && context.env?.DB) {
    try {
      const rows = await fetchListingProducts(context.env.DB, listingConfig);
      if (rows.length > 0) {
        html = replaceFirstProductGrid(html, renderListingCards(rows, listingConfig.lang));
        if (normalizedPath === "/products/") {
          html = html.replace(/id="results-count">[^<]*</, `id="results-count">${rows.length} products<`);
        } else if (normalizedPath === "/th/products/") {
          html = html.replace(/id="results-count">[^<]*</, `id="results-count">\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 ${rows.length} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23<`);
        }
      }
    } catch (e) {
      console.error("_middleware: dynamic listing render failed:", e);
    }
  }
  const header = await getChrome(context.env.DB, "header");
  const footer = await getChrome(context.env.DB, "footer");
  if (html.includes("<!-- __HEADER__ -->")) {
    html = html.replace("<!-- __HEADER__ -->", header);
  }
  if (html.includes("<!-- __FOOTER__ -->")) {
    html = html.replace("<!-- __FOOTER__ -->", footer);
  }
  const hasStandardHeader = html.includes('<header class="site-header"');
  const hasAnyHeader = /<header\b/i.test(html);
  if (!hasStandardHeader && !hasAnyHeader) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>
${header}`);
  }
  const hasStandardFooter = html.includes('<footer class="site-footer"');
  const hasAnyFooter = /<footer\b/i.test(html);
  if (!hasStandardFooter && !hasAnyFooter) {
    html = html.replace(/<\/body>/i, `${footer}
</body>`);
  }
  const isThPage = html.includes('<html lang="th"');
  const enPath = isThPage ? path.replace(/^\/th/, "") || "/" : path;
  const thPath = isThPage ? path : "/th" + (path === "/" ? "/" : path);
  html = html.replace(
    /<div class="lang-toggle"[\s\S]*?<\/div>/,
    `<div class="lang-toggle" role="group" aria-label="Language switch">
      <span data-lang="en" ${isThPage ? `style="color:var(--color-muted);cursor:pointer" onclick="window.location.href='${enPath}'"` : `class="active" style="color:var(--color-primary);border-bottom:2px solid var(--color-primary);padding-bottom:1px"`}>EN</span>
      <span style="color:var(--color-border)">/</span>
      <span data-lang="th" ${isThPage ? `class="active" style="color:var(--color-primary);border-bottom:2px solid var(--color-primary);padding-bottom:1px"` : `style="color:var(--color-muted);cursor:pointer" onclick="window.location.href='${thPath}'"`}>TH</span>
    </div>`
  );
  html = html.replace(
    /<div class="mobile-drawer-lang"[\s\S]*?<\/div>/,
    `<div class="mobile-drawer-lang" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--color-border);display:flex;align-items:center;gap:8px">
      <span style="font-size:0.8125rem;font-weight:600;color:var(--color-muted)">${isThPage ? "\u0E20\u0E32\u0E29\u0E32:" : "Language:"}</span>
      <span data-lang="en" ${isThPage ? `style="color:var(--color-muted);font-weight:600;font-size:0.9375rem;cursor:pointer" onclick="window.location.href='${enPath}'"` : `class="active" style="color:var(--color-primary);font-weight:700;font-size:0.9375rem;cursor:pointer"`}>EN</span>
      <span style="color:var(--color-border)">/</span>
      <span data-lang="th" ${isThPage ? `class="active" style="color:var(--color-primary);font-weight:700;font-size:0.9375rem;cursor:pointer"` : `style="color:var(--color-muted);font-weight:600;font-size:0.9375rem;cursor:pointer" onclick="window.location.href='${thPath}'"`}>TH</span>
    </div>`
  );
  if (isThPage) {
    html = html.replace(/"nav-link">Shop<\/a>/g, '"nav-link">\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</a>').replace(/"nav-link">Fabrics<\/a>/g, '"nav-link">\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E1C\u0E49\u0E32</a>').replace(/"nav-link">Size Guide<\/a>/g, '"nav-link">\u0E04\u0E39\u0E48\u0E21\u0E37\u0E2D\u0E02\u0E19\u0E32\u0E14</a>').replace(/"nav-link">Blog<\/a>/g, '"nav-link">\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21</a>').replace(/<a href="\/products\/?">Shop<\/a>/g, '<a href="/products/">\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</a>').replace(/<a href="\/fabric\/?">Fabrics<\/a>/g, '<a href="/fabric/">\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E1C\u0E49\u0E32</a>').replace(/<a href="\/sizeguide\/?">Size Guide<\/a>/g, '<a href="/sizeguide/">\u0E04\u0E39\u0E48\u0E21\u0E37\u0E2D\u0E02\u0E19\u0E32\u0E14</a>').replace(/<a href="\/blogs\/?">Blog<\/a>/g, '<a href="/blogs/">\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21</a>').replace(/>Sign In</g, ">\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A<").replace(/>Customer Service</g, ">\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32<").replace(/>FAQ</g, ">\u0E04\u0E33\u0E16\u0E32\u0E21\u0E17\u0E35\u0E48\u0E1E\u0E1A\u0E1A\u0E48\u0E2D\u0E22<").replace(/>Shop on Marketplaces</g, ">\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D<").replace(/>Shop With Us</g, ">\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D\u0E01\u0E31\u0E1A\u0E40\u0E23\u0E32<").replace(/>Contact</g, ">\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E40\u0E23\u0E32<").replace(/\+66 87 236 2364/g, "087 236 2364").replace(/>Privacy Policy</g, ">\u0E19\u0E42\u0E22\u0E1A\u0E32\u0E22\u0E04\u0E27\u0E32\u0E21\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27<").replace(/>Returns &amp; Delivery</g, ">\u0E01\u0E32\u0E23\u0E04\u0E37\u0E19\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07<").replace(/>About Us</g, ">\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E01\u0E31\u0E1A\u0E40\u0E23\u0E32<").replace(/>Contact Us</g, ">\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E40\u0E23\u0E32<").replace(/>QUICK LINKS</g, ">\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E14\u0E48\u0E27\u0E19<").replace(/>Quick Links</g, ">\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E14\u0E48\u0E27\u0E19<").replace(/>Home</g, ">\u0E2B\u0E19\u0E49\u0E32\u0E41\u0E23\u0E01<").replace(/>Language:</g, ">\u0E20\u0E32\u0E29\u0E32:<").replace(/>Reviews</g, ">\u0E23\u0E35\u0E27\u0E34\u0E27<").replace('placeholder="Search bedding, fabrics, sizes..."', 'placeholder="\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E19\u0E2D\u0E19 \u0E1C\u0E49\u0E32 \u0E02\u0E19\u0E32\u0E14..."').replace(/href="\/products\/?"/g, 'href="/th/products/"').replace(/href="\/about\/?"/g, 'href="/th/about/"').replace(/href="\/contact\/?"/g, 'href="/th/contact/"').replace(/href="\/faq\/?"/g, 'href="/th/faq/"').replace(/href="\/fabric\/?"/g, 'href="/th/fabric/"').replace(/href="\/sizeguide\/?"/g, 'href="/th/sizeguide/"').replace(/href="\/blogs\/?"/g, 'href="/th/blogs/"').replace(/href="\/policy\/?"/g, 'href="/th/policy/"').replace(/href="\/shipping\/?"/g, 'href="/th/shipping/"').replace(/href="\/reviews\/?"/g, 'href="/th/reviews/"').replace(/href="\/how-to-measure-mattress-size\/?"/g, 'href="/th/how-to-measure-mattress-size/"').replace(/href="\/custom-measurement\/?"/g, 'href="/th/custom-measurement/"').replace(/href="\/pillowcases\/?"/g, 'href="/th/pillowcases/"').replace(/href="\/pets\/?"/g, 'href="/th/pets/"').replace(/href="\/deep-pocket\/?"/g, 'href="/th/deep-pocket/"').replace(/href="\/family\/?"/g, 'href="/th/family/"').replace(/href="\/marine\/?"/g, 'href="/th/marine/"').replace(/href="\/accessories\/?"/g, 'href="/th/accessories/"').replace(/href="\/protection\/?"/g, 'href="/th/protection/"').replace(/href="\/duvet-covers\/?"/g, 'href="/th/duvet-covers/"').replace(/href="\/sheets\/?"/g, 'href="/th/sheets/"').replace(/href="\/boarding-dorm\/?"/g, 'href="/th/boarding-dorm/"').replace(/href="\/rv-truck\/?"/g, 'href="/th/rv-truck/"').replace(/href="\/" class="logo-link/g, 'href="/th/" class="logo-link');
  }
  if (!html.includes('id="shared-footer-mobile-style"')) {
    html = html.replace(/<\/head>/i, `${SHARED_FOOTER_MOBILE_STYLE}
</head>`);
  }
  const hasIconLink = /rel=["'](?:shortcut\s+)?icon["']/i.test(html);
  const hasAppleTouchIcon = /rel=["']apple-touch-icon["']/i.test(html);
  if (!hasIconLink || !hasAppleTouchIcon) {
    html = html.replace(/<\/head>/i, `${SHARED_FAVICON_LINKS}
</head>`);
  }
  const hasProductCards = html.includes('class="product-card"');
  if (hasProductCards && !html.includes("/js/listing-images-sync.js")) {
    html = html.replace(/<\/body>/i, `${LISTING_IMAGE_SYNC_SCRIPT}
</body>`);
  }
  if (!html.includes('id="json-ld-org"')) {
    html = html.replace(/<\/head>/i, `${JSON_LD_ORG}
${JSON_LD_WEBSITE}
</head>`);
  }
  const isFaq = path === "/faq/" || path === "/faq";
  if (isFaq && !html.includes('id="json-ld-faq"')) {
    html = html.replace(/<\/head>/i, `${JSON_LD_FAQ}
</head>`);
  }
  return new Response(html, { status: response.status, headers: response.headers });
}
__name(onRequest9, "onRequest");

// ../.wrangler/tmp/pages-wa7xfD/functionsRoutes-0.6054492674386641.mjs
var routes = [
  {
    routePath: "/th/blogs/:path*",
    mountPath: "/th/blogs",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/th/product/:path*",
    mountPath: "/th/product",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/:path*",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/blogs/:path*",
    mountPath: "/blogs",
    method: "",
    middlewares: [],
    modules: [onRequest4]
  },
  {
    routePath: "/product/:path*",
    mountPath: "/product",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/quote/:path*",
    mountPath: "/quote",
    method: "",
    middlewares: [],
    modules: [onRequest5]
  },
  {
    routePath: "/r2/:path*",
    mountPath: "/r2",
    method: "",
    middlewares: [],
    modules: [onRequest6]
  },
  {
    routePath: "/account",
    mountPath: "/account",
    method: "",
    middlewares: [onRequest7],
    modules: []
  },
  {
    routePath: "/admin",
    mountPath: "/admin",
    method: "",
    middlewares: [onRequest8],
    modules: []
  },
  {
    routePath: "/super-admin",
    mountPath: "/super-admin",
    method: "",
    middlewares: [onRequest8],
    modules: []
  },
  {
    routePath: "/",
    mountPath: "/",
    method: "",
    middlewares: [onRequest9],
    modules: []
  }
];

// ../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
