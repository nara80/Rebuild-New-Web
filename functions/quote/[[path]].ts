// MildMate Quote Magic Link Page
// Renders /quote/QT-XXXXX/ — shows locked custom quote with "Add to Cart" button

export const onRequest: PagesFunction<{
  DB: D1Database;
}> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // Extract quote ID from path: /quote/QT-XXXXX/ → QT-XXXXX
  const pathParts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  const quoteId = pathParts[1]; // ["quote", "QT-XXXXX"]
  if (!quoteId) {
    return new Response("Missing quote ID", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  // Fetch quote from D1
  let quote: any = null;
  try {
    quote = await env.DB.prepare(
      `SELECT quote_id, customer_name, product_slug, dimensions, fabric, color,
              status, quoted_price, quoted_price_usd, expires_at, created_at
       FROM custom_quotes
       WHERE quote_id = ?1`
    ).bind(quoteId).first();
  } catch (e: any) {
    console.error("Quote page DB error:", e.message);
  }

  // Get exchange rate
  let usdRate = 30;
  try {
    const rateRow = await env.DB.prepare(
      "SELECT param_value FROM pricing_params WHERE param_key = 'usd_rate'"
    ).first();
    if (rateRow) {
      const val = parseFloat(rateRow.param_value);
      if (!isNaN(val)) usdRate = val;
    }
  } catch {}

  // Parse dimensions
  let dimensions: any = {};
  let dimStr = "—";
  if (quote) {
    try {
      dimensions = typeof quote.dimensions === "string" ? JSON.parse(quote.dimensions) : quote.dimensions;
      if (dimensions.w && dimensions.l) {
        dimStr = `${dimensions.w} × ${dimensions.l}`;
        if (dimensions.d) dimStr += ` × ${dimensions.d}`;
        dimStr += ` ${dimensions.unit || "cm"}`;
      } else if (dimensions.size_text) {
        dimStr = String(dimensions.size_text);
      }
    } catch {
      dimStr = typeof quote.dimensions === "string" ? quote.dimensions : "—";
    }
  }

  const isExpired = quote?.expires_at ? new Date(quote.expires_at + "Z") < new Date() : false;
  const isApproved = quote?.status === "approved";
  const priceThb = quote?.quoted_price || null;
  const explicitPriceUsd = quote?.quoted_price_usd || null;
  const isUsdQuoted = explicitPriceUsd != null && explicitPriceUsd > 0;
  const priceUsd = isUsdQuoted ? explicitPriceUsd : (priceThb ? Math.round(priceThb / usdRate) : null);

  function esc(s: string) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  const productTitle = quote ? quote.product_slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "";
  const fabricLabel = quote?.fabric || "—";
  const colorLabel = quote?.color || "—";

  // Build cart item JSON for the "Add to Cart" button
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
    price_usd: priceUsd,
  } : null;

  const cartItemJson = JSON.stringify(cartItem || null).replace(/</g, "\\u003c");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="MildMate Custom Quote ${esc(quoteId)} — Locked-price custom bedding.">
  <meta name="robots" content="noindex">
  <title>Quote ${esc(quoteId)} — MildMate</title>
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
          ${isExpired ? `<div class="banner banner-expired"><strong>Quote Expired</strong><br>This quote expired on ${new Date(quote.expires_at + "Z").toLocaleDateString("en-GB", {day:"numeric",month:"long",year:"numeric"})}. Please request a new quote.</div>` : ""}
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
          ${priceThb
            ? (isUsdQuoted
                ? `<div class="transaction-price">$${priceUsd.toLocaleString()} USD</div>`
                : `<div class="transaction-price">&#3647;${priceThb.toLocaleString()} THB</div>`)
            : `<div class="transaction-pending">Awaiting pricing</div>`
          }
          ${quote.expires_at && priceThb ? `
            <div class="validity-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <span>Price valid until ${new Date(quote.expires_at + "Z").toLocaleDateString("en-GB", {day:"numeric",month:"long",year:"numeric"})}</span>
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
  <script id="quote-cart-data" type="application/json">${cartItemJson}</script>
  <script src="/js/cart.js"></script>
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
        window.location.href = '/th' + window.location.pathname.replace(/^\/th/, '');
      } else {
        window.location.href = window.location.pathname.replace(/^\/th/, '') || '/';
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

  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html;charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
};
