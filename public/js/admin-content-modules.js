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

  function safeToast(msg) {
    if (typeof window.toast === "function") window.toast(msg);
  }

  async function getAuthHeaders(includeJson) {
    if (typeof window.getAdminAuthHeaders === "function") return window.getAdminAuthHeaders(includeJson);
    var h = {};
    if (includeJson) h["Content-Type"] = "application/json";
    var sec = "";
    try { sec = localStorage.getItem("admin_secret") || ""; } catch (e) {}
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
      + ".cm-thumb{width:44px;height:44px;border-radius:8px;object-fit:cover;border:1px solid var(--c-border);background:#f8fafc}";
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
  window.renderBlogManagerModule = function () {
    ensureModuleStyles();
    setTimeout(loadBlogRows, 0);
    return '<div class="card"><div class="card-header"><span>Blog</span><button class="btn btn-primary btn-sm" onclick="openBlogManagerModal()">+ New Post</button></div><div class="card-body"><div id="blog-module-table-wrap"><p style="color:var(--c-muted)">Loading posts...</p></div></div></div>';
  };

  async function loadBlogRows() {
    var wrap = document.getElementById("blog-module-table-wrap");
    if (!wrap) return;
    try {
      var r = await fetch("/api/admin/blog", { headers: await getAuthHeaders(false) });
      var j = await r.json();
      var posts = j.posts || [];
      if (!posts.length) {
        wrap.innerHTML = '<p style="color:var(--c-muted);text-align:center;padding:24px">No blog posts yet.</p>';
        return;
      }
      var h = '<div style="overflow:auto"><table><thead><tr><th>Title EN</th><th>Categories</th><th>Banner</th><th>Status</th><th></th></tr></thead><tbody>';
      posts.forEach(function (p) {
        var cats = parseJsonArray(p.categories_json);
        if (!Array.isArray(cats) || !cats.length) cats = [p.category || "General"];
        var img = p.featured_image ? '<img class="cm-thumb" src="' + escHtml(p.featured_image) + '" alt="">' : '<div class="cm-thumb"></div>';
        h += '<tr><td><strong>' + escHtml(p.title_en || "Untitled") + '</strong><div style="font-size:11px;color:var(--c-muted)">' + escHtml(p.slug || "") + '</div></td>';
        h += '<td style="font-size:12px;color:var(--c-muted)">' + escHtml(cats.join(", ")) + '</td>';
        h += '<td>' + img + '</td>';
        h += '<td><span class="badge ' + (p.status === "published" ? "badge-shipped" : "badge-pending") + '">' + escHtml(p.status || "draft") + '</span></td>';
        h += '<td><button class="btn btn-outline btn-sm" onclick="openBlogManagerModal(' + Number(p.id) + ')">Edit</button> <button class="btn btn-outline btn-sm" style="color:var(--c-red);border-color:var(--c-red)" onclick="deleteBlogManagerPost(' + Number(p.id) + ')">Delete</button></td></tr>';
      });
      h += "</tbody></table></div>";
      wrap.innerHTML = h;
    } catch (e) {
      wrap.innerHTML = '<p style="color:var(--c-red)">Failed to load posts: ' + escHtml(e.message) + "</p>";
    }
  }

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
  window.renderReviewsManagerModule = function () {
    ensureModuleStyles();
    setTimeout(loadReviewRows, 0);
    return '<div class="card"><div class="card-header"><span>Reviews</span><button class="btn btn-primary btn-sm" onclick="openReviewManagerModal()">+ Add Review</button></div><div class="card-body"><div id="reviews-module-table-wrap"><p style="color:var(--c-muted)">Loading reviews...</p></div></div></div>';
  };

  async function loadReviewRows() {
    var wrap = document.getElementById("reviews-module-table-wrap");
    if (!wrap) return;
    try {
      var r = await fetch("/api/admin/reviews", { headers: await getAuthHeaders(false) });
      var j = await r.json();
      var rows = j.reviews || [];
      if (!rows.length) {
        wrap.innerHTML = '<p style="color:var(--c-muted);text-align:center;padding:24px">No reviews yet.</p>';
        return;
      }
      var h = '<div style="overflow:auto"><table><thead><tr><th>Customer</th><th>Channel</th><th>Review</th><th>Photo</th><th></th></tr></thead><tbody>';
      rows.forEach(function (rv) {
        var ch = makeChannelBadgeHtml(rv.platform);
        var txt = escHtml((rv.review_text || "").replace(/<[^>]+>/g, " ").trim()).slice(0, 120);
        var img = rv.image_url ? '<img class="cm-thumb" src="' + escHtml(rv.image_url) + '" alt="">' : '<div class="cm-thumb"></div>';
        h += '<tr><td><strong>' + escHtml(rv.customer_name || "—") + '</strong><div style="font-size:11px;color:var(--c-muted)">' + escHtml(rv.customer_country || "") + '</div></td><td>' + ch + '</td><td style="font-size:12px;color:var(--c-muted)">' + txt + (txt.length >= 120 ? "…" : "") + '</td><td>' + img + '</td><td><button class="btn btn-outline btn-sm" onclick="openReviewManagerModal(' + Number(rv.id) + ')">Edit</button> <button class="btn btn-outline btn-sm" style="color:var(--c-red);border-color:var(--c-red)" onclick="deleteReviewManager(' + Number(rv.id) + ')">Delete</button></td></tr>';
      });
      h += "</tbody></table></div>";
      wrap.innerHTML = h;
    } catch (e) {
      wrap.innerHTML = '<p style="color:var(--c-red)">Failed to load reviews: ' + escHtml(e.message) + "</p>";
    }
  }

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
    var photoUrl = rv.image_url || "";
    var body = ''
      + '<div class="cm-grid">'
      + '<div class="cm-field"><label>Customer Name *</label><input id="rm-name" value="' + escHtml(rv.customer_name || "") + '"></div>'
      + '<div class="cm-field"><label>Customer Country</label><input id="rm-country" value="' + escHtml(rv.customer_country || "") + '"></div>'
      + '<div class="cm-field"><label>Channel</label><select id="rm-channel">' + opts + "</select></div>"
      + '<div class="cm-field"><label>Display Segment</label><select id="rm-segment">' + segOpts + "</select></div>"
      + '<div class="cm-field full"><label>Review Text *</label><textarea id="rm-text">' + escHtml((rv.review_text || "").replace(/<[^>]+>/g, "")) + "</textarea></div>"
      + '<div class="cm-field full"><label>Review Photo (optional, 400×400)</label><div class="cm-upload"><div id="rm-photo-zone" class="cm-slot square" style="' + (photoUrl ? 'background-image:url(\'' + escHtml(photoUrl) + '\')' : "") + '" onclick="pickReviewPhotoFile()"><span id="rm-photo-plus" style="' + (photoUrl ? "display:none" : "") + 'font-size:28px;color:var(--c-muted)">+</span><button type="button" id="rm-photo-remove" class="remove" style="' + (photoUrl ? "" : "display:none") + '" onclick="event.stopPropagation();clearReviewPhotoFile()">×</button></div><div><input id="rm-photo-url" placeholder="/r2/products/uploads/..." value="' + escHtml(photoUrl) + '" oninput="syncReviewPhotoUrlInput(this.value)"><small style="display:block;color:var(--c-muted);font-size:11px;margin-top:6px">Product-style drag/drop supported. Auto-crop to 400×400.</small></div></div></div>'
      + "</div>";
    var footer = '<button class="btn btn-outline" onclick="closeContentModal()">Cancel</button><button class="btn btn-primary" onclick="saveReviewManager(' + (id ? Number(id) : "null") + ')">' + (id ? "Save" : "Create") + "</button>";
    openContentModal(id ? "Edit Review" : "Add Review", body, footer);
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
        rating: 5,
        product_type: (document.getElementById("rm-segment").value || "Marine & Yacht")
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
