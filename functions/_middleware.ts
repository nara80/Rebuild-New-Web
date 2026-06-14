// ─── Global Middleware ──────────────────────────────────────────────────────
// Intercepts all HTML responses and injects centralized header/footer from D1.
// Fallback header/footer are embedded so pages work before D1 is seeded.

const CACHE_TTL = 5 * 60 * 1000; // 5 min
let _cache: { header?: string; footer?: string; fetchedAt: number } = { fetchedAt: 0 };

const FALLBACK_HEADER = `<header class="site-header">
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

const FALLBACK_FOOTER = `<footer class="site-footer">
    <div class="container">
      <div class="footer-grid">

        <div class="footer-col">
          <h3>Quick Links</h3>
          <ul>
            <li><a href="/about/">About Us</a></li>
            <li><a href="/contact/">Contact Us</a></li>
            <li><a href="/reviews/">Reviews</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h3>Customer Service</h3>
          <ul>
            <li><a href="/faq/">FAQ</a></li>
            <li><a href="/sizeguide/">Size Guide</a></li>
            <li><a href="/blogs/">Blog</a></li>
          </ul>
        </div>

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

      <div class="footer-bottom">
        <p>&copy; MildMate 2026</p>
        <div class="footer-bottom-links">
          <a href="/policy/">Privacy Policy</a>
          <a href="/shipping/">Returns &amp; Delivery</a>
        </div>
      </div>
    </div>
  </footer>`;

async function ensureCache(db: any): Promise<void> {
  const now = Date.now();
  if (_cache.header && _cache.footer && (now - _cache.fetchedAt) < CACHE_TTL) return;

  if (!db) {
    console.error('_middleware: no DB binding available');
    return;
  }

  try {
    const stmt = db.prepare(
      "SELECT template_key, template_html FROM site_templates WHERE template_key IN ('header-standard', 'footer-standard')"
    );
    const { results } = await stmt.all();
    for (const row of results) {
      if (row.template_key === 'header-standard') _cache.header = row.template_html;
      if (row.template_key === 'footer-standard') _cache.footer = row.template_html;
    }
    _cache.fetchedAt = now;
  } catch (e) {
    console.error('_middleware: D1 fetch failed:', e);
  }
}

async function getChrome(db: any, key: 'header' | 'footer'): Promise<string | null> {
  const fallback = key === 'header' ? FALLBACK_HEADER : FALLBACK_FOOTER;
  await ensureCache(db);
  const html = _cache[key] || fallback; // D1 first, fallback second
  if (key !== 'header') return html;
  // Enforce "no Blog menu in header/drawer" even if D1 still has old template content.
  return html
    .replace(/<li class="nav-item">\s*<a href="\/blogs\/" class="nav-link">Blog<\/a>\s*<\/li>/g, '')
    .replace(/<li>\s*<a href="\/blogs\/">Blog<\/a>\s*<\/li>/g, '');
}

const SKIP_PREFIXES = ['/admin/', '/super-admin/', '/api/', '/r2/', '/images/', '/css/', '/js/', '/fonts/'];
const SKIP_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.webp', '.svg', '.ico', '.woff2', '.json', '.xml', '.map'];
const CANONICAL_PRODUCT_SLUGS = new Set([
  'standard-fitted-sheet',
  'deep-pocket-fitted-sheet',
  'marine-fitted-sheet',
  'dorm-fitted-sheet',
  'rv-truck-fitted-sheet',
  'family-fitted-sheet',
  'pet-owner-fitted-sheet',
  'flat-sheet-standard',
  'flat-sheet-extra-deep-pocket',
  '3-sided-duvet',
  'pet-owner-duvet-cover',
  'duvet-cover-marine',
  'duvet-cover-rv',
  'duvet-cover-dorm',
  'duvet-insert',
  'pillowcase-envelope',
  'pillowcase-zipper',
  'pillowcase-sham',
  'mattress-protector-standard',
  'mattress-protector-family',
  'mattress-protector-deep-pocket',
  'pet-proof-mattress-protector',
  'mattress-encasement-general',
  'rv-truck-mattress-encasement',
  'pillow-protector-general',
  'bedbridge-connector',
  'mattress-lift-helper'
]);

function hasToken(slug: string, token: string): boolean {
  return new RegExp(`(^|[-/])${token}($|[-/])`).test(slug);
}

function resolveLegacyProductPath(pathname: string): string | null {
  if (pathname === '/product/' || pathname === '/product') return '/products/';
  if (!pathname.startsWith('/product/')) return null;
  const rawSlug = pathname.slice('/product/'.length).replace(/\/+$/, '').toLowerCase();
  if (!rawSlug) return '/products/';
  if (CANONICAL_PRODUCT_SLUGS.has(rawSlug)) return null;

  if (rawSlug === '%e0%b9%84%e0%b8%aa%e0%b9%89%e0%b8%9c%e0%b9%89%e0%b8%b2%e0%b8%99%e0%b8%a7%e0%b8%a1') return '/product/duvet-insert/';
  if (rawSlug.startsWith('%e0%b8%9c%e0%b9%89%e0%b8%b2%e0%b8%9b%e0%b8%b9')) return '/product/family-fitted-sheet/';
  if (rawSlug.startsWith('product-boat-bedding') || rawSlug.startsWith('product-boat-top-sheet')) return '/product/marine-fitted-sheet/';
  if (rawSlug.includes('boat') && rawSlug.includes('pillow')) return '/product/pillowcase-envelope/';

  if (rawSlug.includes('dorm')) return rawSlug.includes('duvet') ? '/product/duvet-cover-dorm/' : '/product/dorm-fitted-sheet/';
  if (rawSlug.includes('rv-truck') || hasToken(rawSlug, 'rv') || rawSlug.includes('truck')) {
    if (rawSlug.includes('duvet')) return '/product/duvet-cover-rv/';
    if (rawSlug.includes('encasement')) return '/product/rv-truck-mattress-encasement/';
    return '/product/rv-truck-fitted-sheet/';
  }
  if (rawSlug.includes('marine') || rawSlug.includes('boat')) return rawSlug.includes('duvet') ? '/product/duvet-cover-marine/' : '/product/marine-fitted-sheet/';

  if (rawSlug.includes('pet')) {
    if (rawSlug.includes('duvet') || rawSlug.includes('3-sided')) return '/product/pet-owner-duvet-cover/';
    if (rawSlug.includes('protector')) return '/product/pet-proof-mattress-protector/';
    if (rawSlug.includes('pillow')) return '/product/pillowcase-zipper/';
    return '/product/pet-owner-fitted-sheet/';
  }

  if (rawSlug.includes('co-sleeping') || rawSlug.includes('family')) return '/product/family-fitted-sheet/';
  if (rawSlug.includes('duvet')) return '/product/3-sided-duvet/';
  if (rawSlug.includes('encasement') || rawSlug.includes('zippered-tpu-mattress-cover')) return '/product/mattress-encasement-general/';
  if (rawSlug.includes('sheet-protectors') || rawSlug.includes('protector') || rawSlug === 'pillow-case') return '/product/mattress-protector-standard/';

  if (rawSlug.includes('pillow') || rawSlug.includes('pillowcase') || rawSlug.includes('pillow-cover') || rawSlug.includes('pillow-case')) {
    if (rawSlug.includes('sham') || rawSlug.includes('vent')) return '/product/pillowcase-sham/';
    if (rawSlug.includes('zip') || rawSlug.includes('hidden-zipper')) return '/product/pillowcase-zipper/';
    return '/product/pillowcase-envelope/';
  }

  if (rawSlug.includes('fitted') || rawSlug.includes('bed-sheet') || rawSlug.includes('bedsheet')) return '/product/standard-fitted-sheet/';
  if (rawSlug === 'tbar') return '/product/bedbridge-connector/';
  if (rawSlug === 'mattress-lift-helper') return '/product/mattress-lift-helper/';
  if (rawSlug === 'baby-blanket' || rawSlug === 'animal-bedding') return '/products/';

  return '/products/';
}

export async function onRequest(context: any): Promise<Response> {
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

  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();

  const header = await getChrome(context.env.DB, 'header');
  const footer = await getChrome(context.env.DB, 'footer');

  // 1) Preferred: explicit markers (if preserved)
  if (html.includes('<!-- __HEADER__ -->')) {
    html = html.replace('<!-- __HEADER__ -->', header);
  }
  if (html.includes('<!-- __FOOTER__ -->')) {
    html = html.replace('<!-- __FOOTER__ -->', footer);
  }

  // 2) Fallback: some pipelines strip HTML comments, so markers disappear.
  // Inject by structure when standard chrome is missing.
  const hasStandardHeader = html.includes('<header class="site-header"');
  const hasAnyHeader = /<header\b/i.test(html);
  if (!hasStandardHeader && !hasAnyHeader) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${header}`);
  }

  const hasStandardFooter = html.includes('<footer class="site-footer"');
  const hasAnyFooter = /<footer\b/i.test(html);
  if (!hasStandardFooter && !hasAnyFooter) {
    html = html.replace(/<\/body>/i, `${footer}\n</body>`);
  }

  // 3) Flip language toggle + rewrite links for Thai pages.
  // Run AFTER chrome injection so injected header/footer links are localized too.
  if (html.includes('<html lang="th"')) {
    html = html
      // Toggle appearance
      .replace(
        /<span data-lang="en"[^>]*class="active"[^>]*>EN<\/span>/,
        '<span data-lang="en" style="color:var(--color-muted)">EN</span>'
      )
      .replace(
        /<span data-lang="th"[^>]*>TH<\/span>/,
        '<span data-lang="th" class="active" style="color:var(--color-primary);border-bottom:2px solid var(--color-primary);padding-bottom:1px">TH</span>'
      )
      // Desktop nav links
      .replace(/"nav-link">Shop<\/a>/g, '"nav-link">สินค้า</a>')
      .replace(/"nav-link">Fabrics<\/a>/g, '"nav-link">เนื้อผ้า</a>')
      .replace(/"nav-link">Size Guide<\/a>/g, '"nav-link">คู่มือขนาด</a>')
      .replace(/"nav-link">Blog<\/a>/g, '"nav-link">บทความ</a>')
      // Mobile drawer nav links (no class)
      .replace(/<a href="\/products\/?">Shop<\/a>/g, '<a href="/products/">สินค้า</a>')
      .replace(/<a href="\/fabric\/?">Fabrics<\/a>/g, '<a href="/fabric/">เนื้อผ้า</a>')
      .replace(/<a href="\/sizeguide\/?">Size Guide<\/a>/g, '<a href="/sizeguide/">คู่มือขนาด</a>')
      .replace(/<a href="\/blogs\/?">Blog<\/a>/g, '<a href="/blogs/">บทความ</a>')
      // Sign In text
      .replace(/>Sign In</g, '>เข้าสู่ระบบ<')
      // Footer section headings
      .replace(/>Customer Service</g, '>บริการลูกค้า<')
      .replace(/>FAQ</g, '>คำถามที่พบบ่อย<')
      .replace(/>Shop With Us</g, '>ช่องทางสั่งซื้อ<')
      .replace(/>Contact</g, '>ติดต่อเรา<')
      // Footer bottom links
      .replace(/>Privacy Policy</g, '>นโยบายความเป็นส่วนตัว<')
      .replace(/>Returns &amp; Delivery</g, '>การคืนสินค้าและการจัดส่ง<')
      // Footer About Us / Contact Us links
      .replace(/>About Us</g, '>เกี่ยวกับเรา<')
      .replace(/>Contact Us</g, '>ติดต่อเรา<')
      // Footer quick links heading
      .replace(/>QUICK LINKS</g, '>ลิงก์ด่วน<')
      .replace(/>Quick Links</g, '>ลิงก์ด่วน<')
      // Mobile drawer
      .replace(/>Home</g, '>หน้าแรก<')
      .replace(/>Language:</g, '>ภาษา:<')
      // Reviews nav link
      .replace(/>Reviews</g, '>รีวิว<')
      // Search placeholder
      .replace('placeholder="Search bedding, fabrics, sizes..."', 'placeholder="ค้นหาเครื่องนอน ผ้า ขนาด..."')
      // Rewrite hrefs to /th/ for pages that have Thai versions
      .replace(/href="\/about\/?"/g, 'href="/th/about/"')
      .replace(/href="\/contact\/?"/g, 'href="/th/contact/"')
      .replace(/href="\/faq\/?"/g, 'href="/th/faq/"')
      .replace(/href="\/fabric\/?"/g, 'href="/th/fabric/"')
      .replace(/href="\/sizeguide\/?"/g, 'href="/th/sizeguide/"')
      .replace(/href="\/blogs\/?"/g, 'href="/th/blogs/"')
      .replace(/href="\/policy\/?"/g, 'href="/th/policy/"')
      .replace(/href="\/shipping\/?"/g, 'href="/th/shipping/"')
      .replace(/href="\/reviews\/?"/g, 'href="/th/reviews/"')
      .replace(/href="\/how-to-measure-mattress-size\/?"/g, 'href="/th/how-to-measure-mattress-size/"')
      .replace(/href="\/custom-measurement\/?"/g, 'href="/th/custom-measurement/"')
      // Homepage logo — land on TH homepage
      .replace(/href="\/" class="logo-link/g, 'href="/th/" class="logo-link');
  }

  return new Response(html, { status: response.status, headers: response.headers });
}
