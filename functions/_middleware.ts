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

// ─── JSON-LD: Organization (all pages) ───────────────────────────────────
const JSON_LD_ORG = `<script type="application/ld+json">
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
</script>`;

// ─── JSON-LD: WebSite + SearchAction (all pages) ─────────────────────────
const JSON_LD_WEBSITE = `<script type="application/ld+json">
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
</script>`;

// ─── JSON-LD: FAQPage (/faq/ only) ────────────────────────────────────
const JSON_LD_FAQ = `<script type="application/ld+json">
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
</script>`;

const SHARED_FOOTER_MOBILE_STYLE = `<style id="shared-footer-mobile-style">
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

  const subpath = pathname.slice('/product/'.length);
  const parts = subpath.split('/').filter(Boolean);
  const slug = (parts[0] || '').toLowerCase();
  if (!slug) return '/products/';

  if (CANONICAL_PRODUCT_SLUGS.has(slug)) return null;

  const rawSlug = subpath.replace(/\/+$/, '').toLowerCase();
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

  // 3) Process language toggles dynamically for both EN and TH pages.
  const isThPage = html.includes('<html lang="th"');
  const enPath = isThPage ? path.replace(/^\/th/, '') || '/' : path;
  const thPath = isThPage ? path : ('/th' + (path === '/' ? '/' : path));

  // Replace desktop lang-toggle
  html = html.replace(
    /<div class="lang-toggle"[\s\S]*?<\/div>/,
    `<div class="lang-toggle" role="group" aria-label="Language switch">
      <span data-lang="en" ${isThPage ? `style="color:var(--color-muted);cursor:pointer" onclick="window.location.href='${enPath}'"` : `class="active" style="color:var(--color-primary);border-bottom:2px solid var(--color-primary);padding-bottom:1px"`}>EN</span>
      <span style="color:var(--color-border)">/</span>
      <span data-lang="th" ${isThPage ? `class="active" style="color:var(--color-primary);border-bottom:2px solid var(--color-primary);padding-bottom:1px"` : `style="color:var(--color-muted);cursor:pointer" onclick="window.location.href='${thPath}'"`}>TH</span>
    </div>`
  );

  // Replace mobile-drawer-lang
  html = html.replace(
    /<div class="mobile-drawer-lang"[\s\S]*?<\/div>/,
    `<div class="mobile-drawer-lang" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--color-border);display:flex;align-items:center;gap:8px">
      <span style="font-size:0.8125rem;font-weight:600;color:var(--color-muted)">${isThPage ? 'ภาษา:' : 'Language:'}</span>
      <span data-lang="en" ${isThPage ? `style="color:var(--color-muted);font-weight:600;font-size:0.9375rem;cursor:pointer" onclick="window.location.href='${enPath}'"` : `class="active" style="color:var(--color-primary);font-weight:700;font-size:0.9375rem;cursor:pointer"`}>EN</span>
      <span style="color:var(--color-border)">/</span>
      <span data-lang="th" ${isThPage ? `class="active" style="color:var(--color-primary);font-weight:700;font-size:0.9375rem;cursor:pointer"` : `style="color:var(--color-muted);font-weight:600;font-size:0.9375rem;cursor:pointer" onclick="window.location.href='${thPath}'"`}>TH</span>
    </div>`
  );

  // 4) Rewrite links and text for Thai pages.
  // Run AFTER chrome injection so injected header/footer links are localized too.
  if (isThPage) {
    html = html
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
      .replace(/>Shop on Marketplaces</g, '>ช่องทางสั่งซื้อ<')
      .replace(/>Shop With Us</g, '>สั่งซื้อกับเรา<')
      .replace(/>Contact</g, '>ติดต่อเรา<')
      .replace(/\+66 87 236 2364/g, '087 236 2364')
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
      .replace(/href="\/products\/?"/g, 'href="/th/products/"')
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
      .replace(/href="\/pillowcases\/?"/g, 'href="/th/pillowcases/"')
      .replace(/href="\/pets\/?"/g, 'href="/th/pets/"')
      .replace(/href="\/deep-pocket\/?"/g, 'href="/th/deep-pocket/"')
      .replace(/href="\/family\/?"/g, 'href="/th/family/"')
      .replace(/href="\/marine\/?"/g, 'href="/th/marine/"')
      .replace(/href="\/accessories\/?"/g, 'href="/th/accessories/"')
      .replace(/href="\/protection\/?"/g, 'href="/th/protection/"')
      .replace(/href="\/duvet-covers\/?"/g, 'href="/th/duvet-covers/"')
      .replace(/href="\/sheets\/?"/g, 'href="/th/sheets/"')
      .replace(/href="\/boarding-dorm\/?"/g, 'href="/th/boarding-dorm/"')
      .replace(/href="\/rv-truck\/?"/g, 'href="/th/rv-truck/"')
      // Homepage logo — land on TH homepage
      .replace(/href="\/" class="logo-link/g, 'href="/th/" class="logo-link');
  }

  if (!html.includes('id="shared-footer-mobile-style"')) {
    html = html.replace(/<\/head>/i, `${SHARED_FOOTER_MOBILE_STYLE}\n</head>`);
  }

  // ── JSON-LD injection ──────────────────────────────────────────────
  // Organization + WebSite: every page
  if (!html.includes('id="json-ld-org"')) {
    html = html.replace(/<\/head>/i, `${JSON_LD_ORG}\n${JSON_LD_WEBSITE}\n</head>`);
  }
  // FAQPage: FAQ route only
  const isFaq = path === '/faq/' || path === '/faq';
  if (isFaq && !html.includes('id="json-ld-faq"')) {
    html = html.replace(/<\/head>/i, `${JSON_LD_FAQ}\n</head>`);
  }

  return new Response(html, { status: response.status, headers: response.headers });
}
