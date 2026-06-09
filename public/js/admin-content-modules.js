(function () {
  var BLOG_CATEGORIES = [
    "Marine & Yacht",
    "Family & Co-Sleep",
    "Pet Owners",
    "Deep Pocket",
    "RV & Truck Cab",
    "Bedding Guide",
    "Product News",
    "Other"
  ];

  var REVIEW_SEGMENTS = [
    "Marine & Yacht",
    "Family & Co-Sleep",
    "Deep Pocket",
    "Boarding Dorm",
    "Pet Owner",
    "RV & Truck Cab",
    "Sheets",
    "Pillowcases",
    "Protections",
    "Duvet Covers",
    "Accessories"
  ];

  var REVIEW_CHANNELS = [
    { key: "etsy", label: "Etsy", type: "marketplace", link: "https://www.etsy.com/shop/MildMate?ref=seller-platform-mcnav#reviews", logo: "/images/Logo/Etsy.png" },
    { key: "ebay", label: "eBay", type: "marketplace", link: "https://www.ebay.com/str/mildmate?_tab=feedback", logo: "/images/Logo/eBay.png" },
    { key: "amazon", label: "Amazon", type: "marketplace", link: "https://www.mildmate.com/", logo: "/images/Logo/Amazon.png" },
    { key: "shopee", label: "Shopee", type: "marketplace", link: "https://shopee.co.th/buyer/418731510/rating?shop_id=418711933", logo: "/images/Logo/Shopee.png" },
    { key: "lazada", label: "Lazada", type: "marketplace", link: "https://www.lazada.co.th/needed-shop/?from=wangpu&q=All-Products&rating=5", logo: "/images/Logo/Lazada.png" },
    { key: "website", label: "Website", type: "direct", logo: "/images/logo.png" },
    { key: "facebook", label: "Facebook", type: "direct", logo: "/images/Logo/Facebook.png" },
    { key: "whatsapp", label: "WhatsApp", type: "direct", logo: "/images/Logo/WhatsAPP.png" },
    { key: "line", label: "LINE", type: "direct", logo: "/images/Logo/LineOA.png" },
    { key: "instagram", label: "Instagram", type: "direct", logo: "/images/Logo/Instagram.png" }
  ];

  var REVIEW_CHANNEL_MAP = REVIEW_CHANNELS.reduce(function (acc, ch) { acc[ch.key] = ch; return acc; }, {});

  var blogFormState = { bannerFile: null, bannerPreview: "" };
  var reviewFormState = { photoFile: null, photoPreview: "" };

  function escHtml(s) {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function parseJsonArray(raw) {
    if (Array.isArray(raw)) return raw;
    try {
      var arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function normalizeAssetUrl(raw) {
    var s = String(raw || "").trim();
    if (!s) return "";
    return s.replace(/ /g, "%20");
  }

  function withVersion(url, token) {
    var u = String(url || "").trim();
    if (!u) return "";
    var t = String(token || "").trim();
    if (!t) return u;
    return u + (u.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(t);
  }

  function safeToast(msg) {
    if (typeof window.toast === "function") window.toast(msg);
  }

  async function getAuthHeaders(includeJson) {
    var h = {};
    if (typeof window.getAdminAuthHeaders === "function") {
      h = await window.getAdminAuthHeaders(includeJson);
    }
    if (includeJson) h["Content-Type"] = "application/json";
    var sec = String(h["X-Admin-Secret"] || "");
    if (!sec) {
      try { sec = localStorage.getItem("admin_secret") || ""; } catch (e) {}
    }
    if (!sec && typeof window !== "undefined" && window.location) {
      var host = String(window.location.hostname || "").toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".pages.dev")) {
        sec = "dev-bypass";
      }
    }
    if (sec) h["X-Admin-Secret"] = sec;
    return h;
  }

  function ensureModuleStyles() {
    if (document.getElementById("admin-content-module-style")) return;
    var style = document.createElement("style");
    style.id = "admin-content-module-style";
    style.textContent = ""
      + ".cm-toolbar{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 6px}"
      + ".cm-toolbar button{padding:6px 8px;border:1px solid var(--c-border);border-radius:6px;background:#fff;cursor:pointer;font-size:12px}"
      + ".cm-toolbar button:hover{border-color:var(--c-blue);color:var(--c-blue)}"
      + ".cm-editor{min-height:120px;border:1px solid var(--c-border);border-radius:8px;padding:10px 12px;background:#fff;line-height:1.55}"
      + ".cm-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}"
      + ".cm-grid .full{grid-column:1 / -1}"
      + ".cm-field label{display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--c-dark)}"
      + ".cm-field input,.cm-field select,.cm-field textarea{width:100%;padding:10px 12px;border:1px solid var(--c-border);border-radius:8px;font-size:13px;font-family:inherit}"
      + ".cm-field textarea{min-height:90px;resize:vertical}"
      + ".cm-check-grid{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:8px}"
      + ".cm-check-grid label{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--c-border);border-radius:8px;font-size:12px;background:#fff}"
      + ".cm-upload{display:flex;gap:12px;align-items:flex-start}"
      + ".cm-slot{width:140px;height:90px;border:2px dashed var(--c-border);border-radius:8px;display:flex;align-items:center;justify-content:center;background:#fff;background-size:cover;background-position:center;cursor:pointer;position:relative;overflow:hidden}"
      + ".cm-slot.square{width:120px;height:120px}"
      + ".cm-slot.drop-target{border-color:var(--c-blue);background:#eff6ff}"
      + ".cm-slot .remove{position:absolute;top:6px;right:6px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;border:none;cursor:pointer;font-size:12px;line-height:20px;text-align:center}"
      + ".cm-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}"
      + ".cm-modal{width:100%;max-width:980px;max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:12px;box-shadow:0 16px 36px rgba(0,0,0,.25)}"
      + ".cm-modal-head{padding:14px 16px;border-bottom:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between}"
      + ".cm-modal-body{padding:16px}"
      + ".cm-modal-foot{padding:14px 16px;border-top:1px solid var(--c-border);display:flex;justify-content:flex-end;gap:8px}"
      + ".cm-channel{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:600;border:1px solid #bfdbfe}"
      + ".cm-channel img{width:14px;height:14px;object-fit:contain}"
      + ".cm-thumb{width:44px;height:44px;border-radius:8px;object-fit:cover;border:1px solid var(--c-border);background:#f8fafc}"
      + ".cm-rating-stars{display:flex;gap:6px;align-items:center}"
      + ".cm-rating-star{font-size:22px;line-height:1;color:#cbd5e1;cursor:pointer;user-select:none}"
      + ".cm-rating-star.active{color:#f59e0b}";
    document.head.appendChild(style);
  }

  function ensureModalRoot() {
    var root = document.getElementById("admin-content-modal-root");
    if (root) return root;
    root = document.createElement("div");
    root.id = "admin-content-modal-root";
    document.body.appendChild(root);
    return root;
  }

  function closeContentModal() {
    ensureModalRoot().innerHTML = "";
    if (blogFormState.bannerPreview && blogFormState.bannerPreview.indexOf("blob:") === 0) URL.revokeObjectURL(blogFormState.bannerPreview);
    if (reviewFormState.photoPreview && reviewFormState.photoPreview.indexOf("blob:") === 0) URL.revokeObjectURL(reviewFormState.photoPreview);
    blogFormState = { bannerFile: null, bannerPreview: "" };
    reviewFormState = { photoFile: null, photoPreview: "" };
  }
  window.closeContentModal = closeContentModal;

  function openContentModal(title, bodyHtml, footerHtml) {
    ensureModuleStyles();
    ensureModalRoot().innerHTML =
      '<div class="cm-modal-backdrop" id="cm-backdrop"><div class="cm-modal">' +
      '<div class="cm-modal-head"><h3 style="margin:0;font-size:16px">' + escHtml(title) + '</h3><button class="btn btn-outline btn-sm" onclick="closeContentModal()">Close</button></div>' +
      '<div class="cm-modal-body">' + bodyHtml + "</div>" +
      '<div class="cm-modal-foot">' + footerHtml + "</div></div></div>";
    var bd = document.getElementById("cm-backdrop");
    bd.addEventListener("click", function (e) { if (e.target === bd) closeContentModal(); });
  }

  function slugify(raw) {
    return String(raw || "").toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
  }

  function sanitizeEditorHtml(html) {
    if (!html) return "";
    return String(html)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/\s+on\w+="[^"]*"/gi, "")
      .replace(/\s+on\w+='[^']*'/gi, "")
      .trim();
  }

  function applyEditorCommand(editorId, cmd) {
    var editor = document.getElementById(editorId);
    if (!editor) return;
    editor.focus();
    if (cmd === "bold") document.execCommand("bold", false, null);
    else if (cmd === "italic") document.execCommand("italic", false, null);
    else if (cmd === "h2") document.execCommand("formatBlock", false, "<h2>");
    else if (cmd === "bullet") document.execCommand("insertUnorderedList", false, null);
    else if (cmd === "number") document.execCommand("insertOrderedList", false, null);
  }
  window.applyContentEditorCommand = applyEditorCommand;

  function attachDropZone(zoneId, onFile) {
    var zone = document.getElementById(zoneId);
    if (!zone) return;
    zone.addEventListener("dragover", function (e) { e.preventDefault(); zone.classList.add("drop-target"); });
    zone.addEventListener("dragleave", function () { zone.classList.remove("drop-target"); });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      zone.classList.remove("drop-target");
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files[0]) return;
      onFile(e.dataTransfer.files[0]);
    });
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Image decode failed")); };
      img.src = url;
    });
  }

  async function cropAndOptimize(file, outW, outH, quality) {
    var img = await loadImage(file);
    var sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    var srcRatio = sw / sh;
    var dstRatio = outW / outH;
    if (srcRatio > dstRatio) {
      sw = Math.round(sh * dstRatio);
      sx = Math.round((img.naturalWidth - sw) / 2);
    } else if (srcRatio < dstRatio) {
      sh = Math.round(sw / dstRatio);
      sy = Math.round((img.naturalHeight - sh) / 2);
    }
    var canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/jpeg", quality || 0.86); });
    return new File([blob], (file.name || "upload").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  }

  async function uploadImageToR2(file) {
    var headers = await getAuthHeaders(false);
    var form = new FormData();
    form.append("file", file);
    var r = await fetch("/api/admin/upload", { method: "POST", headers: headers, body: form });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || !j.success) throw new Error(j.error || ("Upload failed: HTTP " + r.status));
    return j.url;
  }

  function makeChannelBadgeHtml(platform) {
    var ch = REVIEW_CHANNEL_MAP[String(platform || "").toLowerCase()];
    if (!ch) return '<span class="cm-channel">Verified</span>';
    var icon = ch.logo ? '<img src="' + escHtml(ch.logo) + '" alt="">' : "";
    if (ch.type === "marketplace") {
      return '<a class="cm-channel" href="' + escHtml(ch.link) + '" target="_blank" rel="noopener">' + icon + '<span>Verified</span></a>';
    }
    return '<span class="cm-channel">' + icon + '<span>Verified</span></span>';
  }

  // ── Blog Module ───────────────────────────────────────────────────────────
  var blogModuleState = { rows: [], search: "", category: "", selectedId: null };

  window.renderBlogManagerModule = function () {
    ensureModuleStyles();
    setTimeout(loadBlogRows, 0);
    return '<div id="blog-module-root"><p style="color:var(--c-muted)">Loading posts...</p></div>';
  };

  async function loadBlogRows() {
    var wrap = document.getElementById("blog-module-root");
    if (!wrap) return;
    try {
      var r = await fetch("/api/admin/blog", { headers: await getAuthHeaders(false) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || ("Failed to load blogs (HTTP " + r.status + ")"));
      var posts = (j.posts || []).map(function (p) {
        return { ...p, featured_image: normalizeAssetUrl(p.featured_image || "") };
      });
      blogModuleState.rows = posts;
      if (posts.length && !posts.some(function (p) { return Number(p.id) === Number(blogModuleState.selectedId); })) {
        blogModuleState.selectedId = Number(posts[0].id);
      }
      renderBlogModuleUI();
    } catch (e) {
      wrap.innerHTML = '<p style="color:var(--c-red)">Failed to load posts: ' + escHtml(e.message) + "</p>";
    }
  }

  function getBlogCategoriesForPost(post) {
    var cats = parseJsonArray(post && post.categories_json);
    if (!cats.length && post && post.category) cats = [post.category];
    return cats.filter(Boolean);
  }

  function getFilteredBlogs() {
    var rows = blogModuleState.rows || [];
    var q = String(blogModuleState.search || "").toLowerCase().trim();
    var cat = String(blogModuleState.category || "").trim();
    return rows.filter(function (p) {
      var title = String(p.title_en || "").toLowerCase();
      var slug = String(p.slug || "").toLowerCase();
      var cats = getBlogCategoriesForPost(p);
      if (q && title.indexOf(q) < 0 && slug.indexOf(q) < 0) return false;
      if (cat && cats.indexOf(cat) < 0) return false;
      return true;
    });
  }

  function renderBlogModuleUI() {
    var root = document.getElementById("blog-module-root");
    if (!root) return;
    var rows = blogModuleState.rows || [];
    var filtered = getFilteredBlogs();

    if (!filtered.some(function (p) { return Number(p.id) === Number(blogModuleState.selectedId); })) {
      blogModuleState.selectedId = filtered.length ? Number(filtered[0].id) : null;
    }

    var selected = rows.find(function (p) { return Number(p.id) === Number(blogModuleState.selectedId); }) || null;
    var categoryOptions = BLOG_CATEGORIES.slice();
    rows.forEach(function (p) {
      getBlogCategoriesForPost(p).forEach(function (c) {
        if (categoryOptions.indexOf(c) < 0) categoryOptions.push(c);
      });
    });

    var h = '<div class="editor-layout"><div class="product-list">' +
      '<div class="product-list-header">' + filtered.length + " of " + rows.length + ' Blogs</div>' +
      '<div style="padding:8px 12px;display:flex;flex-direction:column;gap:8px">' +
      '<input placeholder="Search title or slug..." value="' + escHtml(blogModuleState.search || "") + '" style="width:100%;padding:8px 12px;border:1px solid var(--c-border);border-radius:6px;font-size:0.8125rem" oninput="blogModuleSearchInput(this.value)">' +
      '<select style="width:100%;padding:8px 12px;border:1px solid var(--c-border);border-radius:6px;font-size:0.8125rem" onchange="blogModuleCategoryFilter(this.value)">' +
      '<option value="">All Categories</option>' +
      categoryOptions.map(function (c) { return '<option value="' + escHtml(c) + '"' + (blogModuleState.category === c ? " selected" : "") + '>' + escHtml(c) + "</option>"; }).join("") +
      '</select>' +
      '<button class="btn btn-primary btn-sm" onclick="openBlogManagerModal()">+ New Post</button>' +
      "</div>";

    if (!filtered.length) {
      h += '<div style="padding:24px 18px;text-align:center;color:var(--c-muted);font-size:0.8125rem">No blog posts match</div>';
    } else {
      filtered.forEach(function (p) {
        var thumbSrc = withVersion(normalizeAssetUrl(p.featured_image || ""), p.updated_at || p.created_at || p.id || "");
        var thumbHtml = thumbSrc ? '<img src="' + escHtml(thumbSrc) + '" alt="" loading="lazy">' : "📝";
        h += '<div class="product-list-item' + (Number(p.id) === Number(blogModuleState.selectedId) ? " active" : "") + '" onclick="selectBlogModulePost(' + Number(p.id) + ')"><div class="thumb">' + thumbHtml + '</div><div class="name">' + escHtml(p.title_en || "Untitled") + '</div><span class="status-dot ' + (p.status === "published" ? "active" : "inactive") + '"></span></div>';
      });
    }

    h += '</div><div class="editor-panel" id="blog-module-editor-panel">';
    if (!selected) {
      h += '<div class="editor-empty">Select a blog post from the list</div>';
    } else {
      var cats = getBlogCategoriesForPost(selected);
      var bannerSrc = withVersion(normalizeAssetUrl(selected.featured_image || ""), selected.updated_at || selected.created_at || selected.id || "");
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px"><div><h3 style="margin:0 0 4px;font-size:18px">' + escHtml(selected.title_en || "Untitled") + '</h3><div style="font-size:12px;color:var(--c-muted)">/' + escHtml(selected.slug || "") + '/</div></div><span class="badge ' + (selected.status === "published" ? "badge-shipped" : "badge-pending") + '">' + escHtml(selected.status || "draft") + "</span></div>";
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px"><div><div style="font-size:11px;color:var(--c-muted);margin-bottom:4px">Categories</div><div style="font-size:13px">' + escHtml((cats.length ? cats : ["General"]).join(", ")) + '</div></div><div><div style="font-size:11px;color:var(--c-muted);margin-bottom:4px">Author</div><div style="font-size:13px">' + escHtml(selected.author || "MildMate Team") + "</div></div></div>";
      h += '<div style="margin-bottom:14px"><div style="font-size:11px;color:var(--c-muted);margin-bottom:6px">Banner</div>' + (bannerSrc ? '<img src="' + escHtml(bannerSrc) + '" alt="" style="width:100%;max-height:220px;object-fit:cover;border:1px solid var(--c-border);border-radius:8px">' : '<div style="height:120px;border:1px dashed var(--c-border);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--c-muted);font-size:12px">No banner image</div>') + "</div>";
      h += '<div style="display:flex;gap:8px"><button class="btn btn-outline" onclick="openBlogManagerModal(' + Number(selected.id) + ')">Edit</button><button class="btn btn-outline" style="color:var(--c-red);border-color:var(--c-red)" onclick="deleteBlogManagerPost(' + Number(selected.id) + ')">Delete</button></div>';
    }
    h += "</div></div>";
    root.innerHTML = h;
  }

  window.blogModuleSearchInput = function (value) {
    blogModuleState.search = value || "";
    renderBlogModuleUI();
  };

  window.blogModuleCategoryFilter = function (value) {
    blogModuleState.category = value || "";
    renderBlogModuleUI();
  };

  window.selectBlogModulePost = function (id) {
    blogModuleState.selectedId = Number(id);
    renderBlogModuleUI();
  };

  window.openBlogManagerModal = async function (id) {
    blogFormState = { bannerFile: null, bannerPreview: "" };
    var post = {};
    if (id) {
      var r = await fetch("/api/admin/blog?id=" + Number(id), { headers: await getAuthHeaders(false) });
      var j = await r.json();
      post = j.post || {};
    }
    var selectedCats = [];
    selectedCats = parseJsonArray(post.categories_json);
    if (!Array.isArray(selectedCats) || !selectedCats.length) selectedCats = post.category ? [post.category] : [];
    var categoryChecks = BLOG_CATEGORIES.map(function (c) {
      var checked = selectedCats.indexOf(c) >= 0 ? " checked" : "";
      return '<label><input type="checkbox" class="blog-cat-cb" value="' + escHtml(c) + '"' + checked + '> ' + escHtml(c) + "</label>";
    }).join("");
    var bannerUrl = post.featured_image || "";
    var slotStyle = bannerUrl ? 'background-image:url(\'' + escHtml(bannerUrl) + '\')' : "";

    var body = ''
      + '<div class="cm-grid">'
      + '<div class="cm-field"><label>Title (EN) *</label><input id="bm-title-en" value="' + escHtml(post.title_en || "") + '"></div>'
      + '<div class="cm-field"><label>Title (TH)</label><input id="bm-title-th" value="' + escHtml(post.title_th || "") + '"></div>'
      + '<div class="cm-field"><label>Slug</label><input id="bm-slug" placeholder="Auto from EN title if blank" value="' + escHtml(post.slug || "") + '"></div>'
      + '<div class="cm-field"><label>Read Time (EN)</label><input id="bm-read-time" value="' + escHtml(post.read_time_en || "5 min read") + '"></div>'
      + '<div class="cm-field full"><label>Category Checkboxes</label><div class="cm-check-grid">' + categoryChecks + '</div></div>'
      + '<div class="cm-field full"><label>Banner Image Upload (16:9)</label>'
      + '<div class="cm-upload"><div id="bm-banner-zone" class="cm-slot" style="' + slotStyle + '" onclick="pickBlogBannerFile()"><span id="bm-banner-plus" style="' + (bannerUrl ? "display:none" : "") + 'font-size:28px;color:var(--c-muted)">+</span><button type="button" class="remove" id="bm-banner-remove" style="' + (bannerUrl ? "" : "display:none") + '" onclick="event.stopPropagation();clearBlogBannerFile()">×</button></div>'
      + '<div><input id="bm-banner-url" placeholder="/r2/products/uploads/..." value="' + escHtml(bannerUrl) + '" oninput="syncBlogBannerUrlInput(this.value)"><small style="display:block;color:var(--c-muted);font-size:11px;margin-top:6px">Product-style drag/drop supported. Auto-crop to 16:9.</small></div></div></div>'
      + '<div class="cm-field full"><label>YouTube URL (optional)</label><input id="bm-youtube" value="' + escHtml(post.youtube_url || "") + '"></div>'
      + '<div class="cm-field full"><label>Description EN</label><div class="cm-toolbar"><button type="button" onclick="applyContentEditorCommand(\'bm-body-en\',\'bold\')"><strong>B</strong></button><button type="button" onclick="applyContentEditorCommand(\'bm-body-en\',\'italic\')"><em>I</em></button><button type="button" onclick="applyContentEditorCommand(\'bm-body-en\',\'h2\')">H2</button><button type="button" onclick="applyContentEditorCommand(\'bm-body-en\',\'bullet\')">• List</button><button type="button" onclick="applyContentEditorCommand(\'bm-body-en\',\'number\')">1. List</button></div><div id="bm-body-en" class="cm-editor" contenteditable="true">' + (post.body_en || "") + '</div></div>'
      + '<div class="cm-field full"><label>Description TH</label><div class="cm-toolbar"><button type="button" onclick="applyContentEditorCommand(\'bm-body-th\',\'bold\')"><strong>B</strong></button><button type="button" onclick="applyContentEditorCommand(\'bm-body-th\',\'italic\')"><em>I</em></button><button type="button" onclick="applyContentEditorCommand(\'bm-body-th\',\'h2\')">H2</button><button type="button" onclick="applyContentEditorCommand(\'bm-body-th\',\'bullet\')">• List</button><button type="button" onclick="applyContentEditorCommand(\'bm-body-th\',\'number\')">1. List</button></div><div id="bm-body-th" class="cm-editor" contenteditable="true">' + (post.body_th || "") + '</div></div>'
      + '<div class="cm-field"><label>Status</label><select id="bm-status"><option value="draft"' + ((post.status || "draft") === "draft" ? " selected" : "") + '>Draft</option><option value="published"' + ((post.status || "draft") === "published" ? " selected" : "") + '>Published</option></select></div>'
      + '<div class="cm-field"><label>Author</label><input id="bm-author" value="' + escHtml(post.author || "MildMate Team") + '"></div>'
      + "</div>";
    var footer = '<button class="btn btn-outline" onclick="closeContentModal()">Cancel</button><button class="btn btn-primary" onclick="saveBlogManagerPost(' + (id ? Number(id) : "null") + ')">' + (id ? "Save" : "Create") + "</button>";
    openContentModal(id ? "Edit Blog Post" : "New Blog Post", body, footer);
    attachDropZone("bm-banner-zone", setBlogBannerFile);
  };

  window.pickBlogBannerFile = function () {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = function () { if (input.files && input.files[0]) setBlogBannerFile(input.files[0]); };
    input.click();
  };

  function setBlogBannerFile(file) {
    if (!file || !file.type || file.type.indexOf("image/") !== 0) return;
    if (blogFormState.bannerPreview && blogFormState.bannerPreview.indexOf("blob:") === 0) URL.revokeObjectURL(blogFormState.bannerPreview);
    blogFormState.bannerFile = file;
    blogFormState.bannerPreview = URL.createObjectURL(file);
    var zone = document.getElementById("bm-banner-zone");
    var plus = document.getElementById("bm-banner-plus");
    var rm = document.getElementById("bm-banner-remove");
    if (zone) zone.style.backgroundImage = "url('" + blogFormState.bannerPreview + "')";
    if (plus) plus.style.display = "none";
    if (rm) rm.style.display = "";
    var inp = document.getElementById("bm-banner-url");
    if (inp) inp.value = "";
  }

  window.syncBlogBannerUrlInput = function (url) {
    blogFormState.bannerFile = null;
    if (blogFormState.bannerPreview && blogFormState.bannerPreview.indexOf("blob:") === 0) URL.revokeObjectURL(blogFormState.bannerPreview);
    blogFormState.bannerPreview = "";
    var zone = document.getElementById("bm-banner-zone");
    var plus = document.getElementById("bm-banner-plus");
    var rm = document.getElementById("bm-banner-remove");
    if (zone) zone.style.backgroundImage = url ? "url('" + url + "')" : "";
    if (plus) plus.style.display = url ? "none" : "";
    if (rm) rm.style.display = url ? "" : "none";
  };

  window.clearBlogBannerFile = function () {
    blogFormState.bannerFile = null;
    if (blogFormState.bannerPreview && blogFormState.bannerPreview.indexOf("blob:") === 0) URL.revokeObjectURL(blogFormState.bannerPreview);
    blogFormState.bannerPreview = "";
    var zone = document.getElementById("bm-banner-zone");
    var plus = document.getElementById("bm-banner-plus");
    var rm = document.getElementById("bm-banner-remove");
    var inp = document.getElementById("bm-banner-url");
    if (zone) zone.style.backgroundImage = "";
    if (plus) plus.style.display = "";
    if (rm) rm.style.display = "none";
    if (inp) inp.value = "";
  };

  window.saveBlogManagerPost = async function (id) {
    try {
      var titleEn = (document.getElementById("bm-title-en").value || "").trim();
      if (!titleEn) { safeToast("Title (EN) is required"); return; }
      var slugInput = (document.getElementById("bm-slug").value || "").trim();
      var slug = slugInput || slugify(titleEn);
      if (!slug) { safeToast("Slug generation failed"); return; }
      var categories = Array.prototype.slice.call(document.querySelectorAll(".blog-cat-cb:checked")).map(function (el) { return el.value; });
      var bannerUrl = (document.getElementById("bm-banner-url").value || "").trim();
      if (blogFormState.bannerFile) {
        safeToast("Optimizing banner...");
        var cropped = await cropAndOptimize(blogFormState.bannerFile, 1600, 900, 0.86);
        safeToast("Uploading banner...");
        bannerUrl = await uploadImageToR2(cropped);
      }
      var payload = {
        slug: slug,
        title_en: titleEn,
        title_th: (document.getElementById("bm-title-th").value || "").trim(),
        body_en: sanitizeEditorHtml(document.getElementById("bm-body-en").innerHTML),
        body_th: sanitizeEditorHtml(document.getElementById("bm-body-th").innerHTML),
        featured_image: bannerUrl,
        category: categories[0] || "General",
        categories_json: categories,
        author: (document.getElementById("bm-author").value || "").trim() || "MildMate Team",
        read_time_en: (document.getElementById("bm-read-time").value || "").trim() || "5 min read",
        status: (document.getElementById("bm-status").value || "draft"),
        youtube_url: (document.getElementById("bm-youtube").value || "").trim(),
        related_products: [],
        is_featured: 0
      };
      if (id) payload.id = Number(id);
      var method = id ? "PUT" : "POST";
      var r = await fetch("/api/admin/blog", { method: method, headers: await getAuthHeaders(true), body: JSON.stringify(payload) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || ("Save failed: HTTP " + r.status));
      safeToast(id ? "Post updated" : "Post created");
      closeContentModal();
      loadBlogRows();
    } catch (e) {
      safeToast(e.message || "Blog save failed");
    }
  };

  window.deleteBlogManagerPost = async function (id) {
    if (!confirm("Delete this post?")) return;
    try {
      var r = await fetch("/api/admin/blog", {
        method: "DELETE",
        headers: await getAuthHeaders(true),
        body: JSON.stringify({ id: Number(id) })
      });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || ("Delete failed: HTTP " + r.status));
      safeToast("Post deleted");
      loadBlogRows();
    } catch (e) {
      safeToast(e.message || "Delete failed");
    }
  };

  // ── Reviews Module ────────────────────────────────────────────────────────
  var reviewModuleState = { rows: [], search: "", category: "", selectedId: null };

  window.renderReviewsManagerModule = function () {
    ensureModuleStyles();
    setTimeout(loadReviewRows, 0);
    return '<div id="reviews-module-root"><p style="color:var(--c-muted)">Loading reviews...</p></div>';
  };

  async function loadReviewRows() {
    var wrap = document.getElementById("reviews-module-root");
    if (!wrap) return;
    try {
      var r = await fetch("/api/admin/reviews", { headers: await getAuthHeaders(false) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || ("Failed to load reviews (HTTP " + r.status + ")"));
      var rows = (j.reviews || []).map(function (rv) {
        return { ...rv, review_date: toDateInputValue(rv.review_date || rv.created_at || "") };
      });
      reviewModuleState.rows = rows;
      if (rows.length && !rows.some(function (rv) { return Number(rv.id) === Number(reviewModuleState.selectedId); })) {
        reviewModuleState.selectedId = Number(rows[0].id);
      }
      renderReviewModuleUI();
    } catch (e) {
      wrap.innerHTML = '<p style="color:var(--c-red)">Failed to load reviews: ' + escHtml(e.message) + "</p>";
    }
  }

  function stripTags(text) {
    return String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  function toDateInputValue(raw) {
    var val = String(raw || "").trim();
    var m = val.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    var d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  }

  function clampRating(raw) {
    var n = parseInt(raw, 10);
    if (!isFinite(n)) n = 5;
    if (n < 1) n = 1;
    if (n > 5) n = 5;
    return n;
  }

  function getFilteredReviews() {
    var rows = reviewModuleState.rows || [];
    var q = String(reviewModuleState.search || "").toLowerCase().trim();
    var cat = String(reviewModuleState.category || "").trim();
    return rows.filter(function (rv) {
      var name = String(rv.customer_name || "").toLowerCase();
      var body = stripTags(rv.review_text || "").toLowerCase();
      var country = String(rv.customer_country || "").toLowerCase();
      if (q && name.indexOf(q) < 0 && body.indexOf(q) < 0 && country.indexOf(q) < 0) return false;
      if (cat && String(rv.product_type || "") !== cat) return false;
      return true;
    });
  }

  function renderReviewModuleUI() {
    var root = document.getElementById("reviews-module-root");
    if (!root) return;
    var rows = reviewModuleState.rows || [];
    var filtered = getFilteredReviews();

    if (!filtered.some(function (rv) { return Number(rv.id) === Number(reviewModuleState.selectedId); })) {
      reviewModuleState.selectedId = filtered.length ? Number(filtered[0].id) : null;
    }
    var selected = rows.find(function (rv) { return Number(rv.id) === Number(reviewModuleState.selectedId); }) || null;

    var h = '<div class="editor-layout"><div class="product-list">' +
      '<div class="product-list-header">' + filtered.length + " of " + rows.length + ' Reviews</div>' +
      '<div style="padding:8px 12px;display:flex;flex-direction:column;gap:8px">' +
      '<input placeholder="Search name, country, review..." value="' + escHtml(reviewModuleState.search || "") + '" style="width:100%;padding:8px 12px;border:1px solid var(--c-border);border-radius:6px;font-size:0.8125rem" oninput="reviewModuleSearchInput(this.value)">' +
      '<select style="width:100%;padding:8px 12px;border:1px solid var(--c-border);border-radius:6px;font-size:0.8125rem" onchange="reviewModuleCategoryFilter(this.value)">' +
      '<option value="">All Categories</option>' +
      REVIEW_SEGMENTS.map(function (s) { return '<option value="' + escHtml(s) + '"' + (reviewModuleState.category === s ? " selected" : "") + '>' + escHtml(s) + "</option>"; }).join("") +
      '</select>' +
      '<button class="btn btn-primary btn-sm" onclick="openReviewManagerModal()">+ Add Review</button>' +
      "</div>";

    if (!filtered.length) {
      h += '<div style="padding:24px 18px;text-align:center;color:var(--c-muted);font-size:0.8125rem">No reviews match</div>';
    } else {
      filtered.forEach(function (rv) {
        var thumbHtml = rv.image_url ? '<img src="' + escHtml(rv.image_url) + '" alt="" loading="lazy">' : "💬";
        h += '<div class="product-list-item' + (Number(rv.id) === Number(reviewModuleState.selectedId) ? " active" : "") + '" onclick="selectReviewModuleItem(' + Number(rv.id) + ')"><div class="thumb">' + thumbHtml + '</div><div class="name">' + escHtml(rv.customer_name || "Anonymous") + '</div><span class="status-dot ' + (rv.is_verified ? "active" : "inactive") + '"></span></div>';
      });
    }

    h += '</div><div class="editor-panel" id="reviews-module-editor-panel">';
    if (!selected) {
      h += '<div class="editor-empty">Select a review from the list</div>';
    } else {
      var platformKey = String(selected.platform || "").toLowerCase();
      var channel = REVIEW_CHANNEL_MAP[platformKey];
      var channelName = channel ? channel.label : (selected.platform || "Unknown");
      var txt = stripTags(selected.review_text || "");
      var stars = "★★★★★".slice(0, Math.max(1, Math.min(5, Number(selected.rating) || 5)));
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px"><div><h3 style="margin:0 0 4px;font-size:18px">' + escHtml(selected.customer_name || "Anonymous") + '</h3><div style="font-size:12px;color:var(--c-muted)">' + escHtml(selected.customer_country || "—") + '</div></div><span class="badge ' + (selected.is_verified ? "badge-shipped" : "badge-pending") + '">' + (selected.is_verified ? "verified" : "unverified") + "</span></div>";
      h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">' + makeChannelBadgeHtml(platformKey) + '<span style="font-size:12px;color:var(--c-muted)">' + escHtml(channelName) + "</span></div>";
      h += '<div style="font-size:16px;color:#f59e0b;margin-bottom:10px">' + stars + '</div>';
      h += '<div style="font-size:13px;color:var(--c-muted);margin-bottom:6px">Category: ' + escHtml(selected.product_type || "—") + "</div>";
      h += '<div style="font-size:13px;color:var(--c-muted);margin-bottom:12px">Review Date: ' + escHtml(toDateInputValue(selected.review_date || selected.created_at || "")) + "</div>";
      h += '<div style="margin-bottom:14px;padding:12px;border:1px solid var(--c-border);border-radius:8px;background:#fff;line-height:1.6;font-size:13px">' + escHtml(txt || "No review text") + "</div>";
      h += '<div style="margin-bottom:14px"><div style="font-size:11px;color:var(--c-muted);margin-bottom:6px">Photo</div>' + (selected.image_url ? '<img src="' + escHtml(selected.image_url) + '" alt="" style="width:180px;height:180px;object-fit:cover;border:1px solid var(--c-border);border-radius:8px">' : '<div style="width:180px;height:180px;border:1px dashed var(--c-border);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--c-muted);font-size:12px">No photo</div>') + "</div>";
      h += '<div style="display:flex;gap:8px"><button class="btn btn-outline" onclick="openReviewManagerModal(' + Number(selected.id) + ')">Edit</button><button class="btn btn-outline" style="color:var(--c-red);border-color:var(--c-red)" onclick="deleteReviewManager(' + Number(selected.id) + ')">Delete</button></div>';
    }
    h += "</div></div>";
    root.innerHTML = h;
  }

  window.reviewModuleSearchInput = function (value) {
    reviewModuleState.search = value || "";
    renderReviewModuleUI();
  };

  window.reviewModuleCategoryFilter = function (value) {
    reviewModuleState.category = value || "";
    renderReviewModuleUI();
  };

  window.selectReviewModuleItem = function (id) {
    reviewModuleState.selectedId = Number(id);
    renderReviewModuleUI();
  };

  window.setReviewRating = function (value) {
    var v = clampRating(value);
    var inp = document.getElementById("rm-rating");
    if (inp) inp.value = String(v);
    var stars = document.querySelectorAll(".cm-rating-star");
    Array.prototype.forEach.call(stars, function (el) {
      var n = Number(el.getAttribute("data-rating") || 0);
      if (n <= v) el.classList.add("active");
      else el.classList.remove("active");
    });
  };

  window.openReviewManagerModal = async function (id) {
    reviewFormState = { photoFile: null, photoPreview: "" };
    var rv = {};
    if (id) {
      var r = await fetch("/api/admin/reviews?id=" + Number(id), { headers: await getAuthHeaders(false) });
      var j = await r.json();
      rv = j.review || {};
    }
    var opts = REVIEW_CHANNELS.map(function (ch) {
      return '<option value="' + ch.key + '"' + ((rv.platform || "website") === ch.key ? " selected" : "") + ">" + escHtml(ch.label) + "</option>";
    }).join("");
    var segOpts = REVIEW_SEGMENTS.map(function (s) {
      return '<option value="' + escHtml(s) + '"' + ((rv.product_type || "Marine & Yacht") === s ? " selected" : "") + ">" + escHtml(s) + "</option>";
    }).join("");
    var reviewDate = toDateInputValue(rv.review_date || rv.created_at || "");
    var ratingValue = clampRating(rv.rating || 5);
    var starsHtml = [1,2,3,4,5].map(function (n) {
      return '<span class="cm-rating-star' + (n <= ratingValue ? " active" : "") + '" data-rating="' + n + '" onclick="setReviewRating(' + n + ')">★</span>';
    }).join("");
    var photoUrl = rv.image_url || "";
    var body = ''
      + '<div class="cm-grid">'
      + '<div class="cm-field"><label>Customer Name *</label><input id="rm-name" value="' + escHtml(rv.customer_name || "") + '"></div>'
      + '<div class="cm-field"><label>Customer Country</label><input id="rm-country" value="' + escHtml(rv.customer_country || "") + '"></div>'
      + '<div class="cm-field"><label>Review Date</label><input id="rm-date" type="date" value="' + escHtml(reviewDate) + '"></div>'
      + '<div class="cm-field"><label>Channel</label><select id="rm-channel">' + opts + "</select></div>"
      + '<div class="cm-field"><label>Rating</label><input id="rm-rating" type="hidden" value="' + ratingValue + '"><div class="cm-rating-stars">' + starsHtml + '</div></div>'
      + '<div class="cm-field"><label>Display Segment</label><select id="rm-segment">' + segOpts + "</select></div>"
      + '<div class="cm-field full"><label>Review Text *</label><textarea id="rm-text">' + escHtml((rv.review_text || "").replace(/<[^>]+>/g, "")) + "</textarea></div>"
      + '<div class="cm-field full"><label>Review Photo (optional, 400×400)</label><div class="cm-upload"><div id="rm-photo-zone" class="cm-slot square" style="' + (photoUrl ? 'background-image:url(\'' + escHtml(photoUrl) + '\')' : "") + '" onclick="pickReviewPhotoFile()"><span id="rm-photo-plus" style="' + (photoUrl ? "display:none" : "") + 'font-size:28px;color:var(--c-muted)">+</span><button type="button" id="rm-photo-remove" class="remove" style="' + (photoUrl ? "" : "display:none") + '" onclick="event.stopPropagation();clearReviewPhotoFile()">×</button></div><div><input id="rm-photo-url" placeholder="/r2/products/uploads/..." value="' + escHtml(photoUrl) + '" oninput="syncReviewPhotoUrlInput(this.value)"><small style="display:block;color:var(--c-muted);font-size:11px;margin-top:6px">Product-style drag/drop supported. Auto-crop to 400×400.</small></div></div></div>'
      + "</div>";
    var footer = '<button class="btn btn-outline" onclick="closeContentModal()">Cancel</button><button class="btn btn-primary" onclick="saveReviewManager(' + (id ? Number(id) : "null") + ')">' + (id ? "Save" : "Create") + "</button>";
    openContentModal(id ? "Edit Review" : "Add Review", body, footer);
    window.setReviewRating(ratingValue);
    attachDropZone("rm-photo-zone", setReviewPhotoFile);
  };

  window.pickReviewPhotoFile = function () {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = function () { if (input.files && input.files[0]) setReviewPhotoFile(input.files[0]); };
    input.click();
  };

  function setReviewPhotoFile(file) {
    if (!file || !file.type || file.type.indexOf("image/") !== 0) return;
    if (reviewFormState.photoPreview && reviewFormState.photoPreview.indexOf("blob:") === 0) URL.revokeObjectURL(reviewFormState.photoPreview);
    reviewFormState.photoFile = file;
    reviewFormState.photoPreview = URL.createObjectURL(file);
    var zone = document.getElementById("rm-photo-zone");
    var plus = document.getElementById("rm-photo-plus");
    var rm = document.getElementById("rm-photo-remove");
    if (zone) zone.style.backgroundImage = "url('" + reviewFormState.photoPreview + "')";
    if (plus) plus.style.display = "none";
    if (rm) rm.style.display = "";
    var inp = document.getElementById("rm-photo-url");
    if (inp) inp.value = "";
  }

  window.syncReviewPhotoUrlInput = function (url) {
    reviewFormState.photoFile = null;
    if (reviewFormState.photoPreview && reviewFormState.photoPreview.indexOf("blob:") === 0) URL.revokeObjectURL(reviewFormState.photoPreview);
    reviewFormState.photoPreview = "";
    var zone = document.getElementById("rm-photo-zone");
    var plus = document.getElementById("rm-photo-plus");
    var rm = document.getElementById("rm-photo-remove");
    if (zone) zone.style.backgroundImage = url ? "url('" + url + "')" : "";
    if (plus) plus.style.display = url ? "none" : "";
    if (rm) rm.style.display = url ? "" : "none";
  };

  window.clearReviewPhotoFile = function () {
    reviewFormState.photoFile = null;
    if (reviewFormState.photoPreview && reviewFormState.photoPreview.indexOf("blob:") === 0) URL.revokeObjectURL(reviewFormState.photoPreview);
    reviewFormState.photoPreview = "";
    var zone = document.getElementById("rm-photo-zone");
    var plus = document.getElementById("rm-photo-plus");
    var rm = document.getElementById("rm-photo-remove");
    var inp = document.getElementById("rm-photo-url");
    if (zone) zone.style.backgroundImage = "";
    if (plus) plus.style.display = "";
    if (rm) rm.style.display = "none";
    if (inp) inp.value = "";
  };

  window.saveReviewManager = async function (id) {
    try {
      var name = (document.getElementById("rm-name").value || "").trim();
      if (!name) { safeToast("Customer name is required"); return; }
      var reviewText = (document.getElementById("rm-text").value || "").trim();
      if (!reviewText) { safeToast("Review text is required"); return; }
      var photoUrl = (document.getElementById("rm-photo-url").value || "").trim();
      if (reviewFormState.photoFile) {
        safeToast("Optimizing review photo...");
        var cropped = await cropAndOptimize(reviewFormState.photoFile, 400, 400, 0.86);
        safeToast("Uploading review photo...");
        photoUrl = await uploadImageToR2(cropped);
      }
      var payload = {
        customer_name: name,
        customer_country: (document.getElementById("rm-country").value || "").trim(),
        review_text: reviewText,
        platform: (document.getElementById("rm-channel").value || "website"),
        image_url: photoUrl,
        is_verified: 1,
        rating: clampRating((document.getElementById("rm-rating").value || "5")),
        product_type: (document.getElementById("rm-segment").value || "Marine & Yacht"),
        review_date: (document.getElementById("rm-date").value || "").trim()
      };
      if (id) payload.id = Number(id);
      var method = id ? "PUT" : "POST";
      var r = await fetch("/api/admin/reviews", { method: method, headers: await getAuthHeaders(true), body: JSON.stringify(payload) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || ("Save failed: HTTP " + r.status));
      safeToast(id ? "Review updated" : "Review created");
      closeContentModal();
      loadReviewRows();
    } catch (e) {
      safeToast(e.message || "Review save failed");
    }
  };

  window.deleteReviewManager = async function (id) {
    if (!confirm("Delete this review?")) return;
    try {
      var r = await fetch("/api/admin/reviews", {
        method: "DELETE",
        headers: await getAuthHeaders(true),
        body: JSON.stringify({ id: Number(id) })
      });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || ("Delete failed: HTTP " + r.status));
      safeToast("Review deleted");
      loadReviewRows();
    } catch (e) {
      safeToast(e.message || "Delete failed");
    }
  };
})();
