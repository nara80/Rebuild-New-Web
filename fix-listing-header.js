const fs = require('fs');
const path = 'D:/00_MildMate/Re-Build_Web/functions/blogs/[[path]].ts';
let c = fs.readFileSync(path, 'utf8');

// Find the blog-index-page body section within the buildBlogListingHTML HTML template
// Look for the exact header HTML we need to replace
const marker = "body class=\"blog-index-page\">";
const idx = c.indexOf(marker);
console.log('Marker found at:', idx);
if (idx === -1) { console.log('NOT FOUND'); process.exit(1); }

// Extract substring from marker to the end of the old header
const headerEndMarker = '</header>';
const headerEndIdx = c.indexOf(headerEndMarker, idx);
console.log('Header end at:', headerEndIdx);

// The old header HTML (minified in the JS string)
const oldHeaderSnippet = c.substring(idx, headerEndIdx + headerEndMarker.length);
console.log('Old header snippet (first 200):', oldHeaderSnippet.substring(0, 200));

// New full header
const newHeader = `body class="blog-index-page">
<header class="site-header">
  <div class="container header-inner">
    <button class="hamburger" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
    <a href="/" class="logo-link" aria-label="MildMate Home"><picture><source srcset="/images/logo.webp" type="image/webp"><img src="/images/logo.png" alt="MildMate" width="180" height="50"></picture></a>
    <nav class="main-nav" aria-label="Main navigation"><ul class="nav-list"><li class="nav-item"><a href="/products/" class="nav-link">Shop</a></li><li class="nav-item"><a href="/fabric/" class="nav-link">Fabrics</a></li><li class="nav-item"><a href="/sizeguide/" class="nav-link">Size Guide</a></li><li class="nav-item"><a href="/blogs/" class="nav-link">Blog</a></li></ul></nav>
    <div class="header-actions">
      <button class="search-btn" aria-label="Search products" aria-expanded="false"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>
      <a href="/account/" class="account-btn" aria-label="My account" style="display:flex;align-items:center;gap:4px"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none" class="account-icon"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span class="sign-in-pill">Sign In</span></a>
      <a href="/checkout/" class="cart-btn" aria-label="Shopping cart"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><span class="cart-count">0</span></a>
      <div class="lang-toggle" role="group" aria-label="Language switch"><span data-lang="en" class="active" style="color:var(--color-primary);border-bottom:2px solid var(--color-primary);padding-bottom:1px">EN</span><span style="color:var(--color-border)">/</span><span data-lang="th" style="color:var(--color-muted)">TH</span></div>
    </div>
  </div>
  <div class="mobile-overlay" aria-hidden="true"></div>
  <div class="mobile-drawer" aria-label="Mobile menu"><div class="mobile-drawer-search"><form action="/products/" method="get" class="drawer-search-form"><input type="search" name="q" placeholder="Search bedding..." aria-label="Search" autocomplete="off"><button type="submit" aria-label="Submit search"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button></form></div><ul class="mobile-nav-list"><li><a href="/">Home</a></li><li><a href="/products/">Shop</a></li><li><a href="/fabric/">Fabrics</a></li><li><a href="/sizeguide/">Size Guide</a></li><li><a href="/blogs/">Blog</a></li><li class="mobile-nav-signin"><a href="/account/" class="sign-in-drawer-link" style="display:inline-block;background:var(--color-primary);color:#fff;font-weight:700;padding:8px 16px;border-radius:6px;margin-top:12px">Sign In</a></li></ul><div class="mobile-drawer-lang" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--color-border);display:flex;align-items:center;gap:8px"><span style="font-size:0.8125rem;font-weight:600;color:var(--color-muted)">Language:</span><span data-lang="en" class="active" style="color:var(--color-primary);font-weight:700;font-size:0.9375rem;cursor:pointer">EN</span><span style="color:var(--color-border)">/</span><span data-lang="th" style="color:var(--color-muted);font-weight:600;font-size:0.9375rem;cursor:pointer" onclick="window.location.href='/th/'">TH</span></div></div>
  <div class="search-overlay" aria-hidden="true"><div class="search-overlay-inner"><button class="search-close" aria-label="Close search"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button><form action="/products/" method="get" class="search-form"><input type="search" name="q" placeholder="Search bedding..." aria-label="Search" autocomplete="off"><button type="submit" aria-label="Submit search"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button></form></div></div>
</header>`;

// In the template string, newlines are literal \n in a JS single-quoted string
// The HTML template uses actual newlines. Let me check
console.log('\n--- Checking line endings ---');
const lineEndingIdx = c.indexOf('\n', idx);
console.log('First newline after marker at:', lineEndingIdx);
console.log('Chars around first newline:', JSON.stringify(c.substring(idx, idx+50)));

// Actually the template uses actual newlines, let me search for the right section
const bodyMarker = 'body class="blog-index-page">\n<header class="site-header">\n  <div class="header-inner">\n    <a href="/" class="logo-link"><img src="/images/logo.png" alt="MildMate" height="52" onerror="this.style.display=\'none\'"></a>\n    <div class="header-actions">\n      <a href="/checkout/" aria-label="Cart" style="display:flex;align-items:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></a>\n    </div>\n  </div>\n</header>';
const bodyMarkerIdx = c.indexOf(bodyMarker);
console.log('bodyMarkerIdx:', bodyMarkerIdx);
