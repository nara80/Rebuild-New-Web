const CANONICAL_PRODUCT_SLUGS = new Set([
  'standard-fitted-sheet',
  'deep-pocket-fitted-sheet',
  'marine-fitted-sheet',
  'marine-top-sheet',
  'dorm-fitted-sheet',
  'rv-truck-fitted-sheet',
  'family-fitted-sheet',
  'pet-owner-fitted-sheet',
  'flat-sheet-standard',
  'flat-sheet-extra-deep-pocket',
  'co-sleeping-top-sheet',
  '3-sided-duvet',
  'weighted-duvet-cover',
  'pet-owner-duvet-cover',
  'duvet-cover-marine',
  'duvet-cover-rv',
  'duvet-cover-dorm',
  'duvet-insert',
  'pillowcase-envelope',
  'pillowcase-zipper',
  'pillowcase-sham',
  'mattress-protector-standard',
  'marine-mattress-protector',
  'mattress-protector-family',
  'mattress-protector-deep-pocket',
  'pet-proof-mattress-protector',
  'custom-waterproof-cushion-protector',
  'mattress-encasement-general',
  'rv-truck-mattress-encasement',
  'pillow-protector-general',
  'bedbridge-connector',
  'mattress-lift-helper'
]);

const PRODUCT_TYPE_DISPLAY: Record<string, string> = {
  'sheets': 'Sheets',
  'duvet-covers': 'Duvet Covers',
  'pillowcases': 'Pillowcases',
  'protection': 'Protections',
  'accessories': 'Accessories'
};

const NICHE_DISPLAY: Record<string, string> = {
  'marine': 'Marine & Yacht',
  'family': 'Family & Co-Sleep',
  'pets': 'Pet Owner',
  'deep-pocket': 'Deep Pocket',
  'boarding-dorm': 'Boarding Dorm',
  'rv-truck': 'RV & Truck Cab'
};

function hasToken(slug: string, token: string): boolean {
  return new RegExp(`(^|[-/])${token}($|[-/])`).test(slug);
}

function resolveLegacyProduct(slug: string): string {
  if (slug === '%e0%b9%84%e0%b8%aa%e0%b9%89%e0%b8%9c%e0%b9%89%e0%b8%b2%e0%b8%99%e0%b8%a7%e0%b8%a1') return '/product/duvet-insert/';
  if (slug.startsWith('%e0%b8%9c%e0%b9%89%e0%b8%b2%e0%b8%9b%e0%b8%b9')) return '/product/family-fitted-sheet/';
  if (slug.startsWith('product-boat-top-sheet')) return '/product/marine-top-sheet/';
  if (slug.startsWith('product-boat-bedding')) return '/product/marine-fitted-sheet/';
  if (slug.includes('boat') && slug.includes('pillow')) return '/product/pillowcase-envelope/';

  if (slug.includes('dorm')) return slug.includes('duvet') ? '/product/duvet-cover-dorm/' : '/product/dorm-fitted-sheet/';
  if (slug.includes('rv-truck') || hasToken(slug, 'rv') || slug.includes('truck')) {
    if (slug.includes('duvet')) return '/product/duvet-cover-rv/';
    if (slug.includes('encasement')) return '/product/rv-truck-mattress-encasement/';
    return '/product/rv-truck-fitted-sheet/';
  }
  if (slug.includes('marine') || slug.includes('boat')) return slug.includes('duvet') ? '/product/duvet-cover-marine/' : '/product/marine-fitted-sheet/';

  if (slug.includes('pet')) {
    if (slug.includes('duvet') || slug.includes('3-sided')) return '/product/pet-owner-duvet-cover/';
    if (slug.includes('protector')) return '/product/pet-proof-mattress-protector/';
    if (slug.includes('pillow')) return '/product/pillowcase-zipper/';
    return '/product/pet-owner-fitted-sheet/';
  }

  if (slug.includes('co-sleeping') || slug.includes('family')) return '/product/family-fitted-sheet/';
  if (slug.includes('duvet')) return '/product/3-sided-duvet/';
  if (slug.includes('encasement') || slug.includes('zippered-tpu-mattress-cover')) return '/product/mattress-encasement-general/';
  if (slug.includes('sheet-protectors') || slug.includes('protector') || slug === 'pillow-case') return '/product/mattress-protector-standard/';

  if (slug.includes('pillow') || slug.includes('pillowcase') || slug.includes('pillow-cover') || slug.includes('pillow-case')) {
    if (slug.includes('sham') || slug.includes('vent')) return '/product/pillowcase-sham/';
    if (slug.includes('zip') || slug.includes('hidden-zipper')) return '/product/pillowcase-zipper/';
    return '/product/pillowcase-envelope/';
  }

  if (slug.includes('fitted') || slug.includes('bed-sheet') || slug.includes('bedsheet')) return '/product/standard-fitted-sheet/';
  if (slug === 'tbar') return '/product/bedbridge-connector/';
  if (slug === 'mattress-lift-helper') return '/product/mattress-lift-helper/';
  if (slug === 'baby-blanket' || slug === 'animal-bedding') return '/products/';
  return '/products/';
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value: string): string {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateForMeta(value: string, max = 160): string {
  const text = String(value || '').trim();
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

function buildDescriptionHtml(description: string): string {
  const text = String(description || '').trim();
  if (!text) return '';
  if (looksLikeHtml(text)) return text;
  return `<p>${escapeHtml(text)}</p>`;
}

function applyLocalizedDescriptionFromD1(html: string, description: string, isTh: boolean): string {
  const text = String(description || '').trim();
  if (!text) return html;

  const metaDescription = escapeHtml(truncateForMeta(stripHtml(text), 160));
  const descriptionHtml = buildDescriptionHtml(text);

  html = html
    .replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${metaDescription}">`)
    .replace(/<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${metaDescription}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/i, `<meta name="twitter:description" content="${metaDescription}">`);

  if (isTh) {
    html = html
      .replace(/data-info-tab="description">[\s\S]*?<\/button>/i, 'data-info-tab="description">รายละเอียด</button>')
      .replace(/data-info-tab="faq">[\s\S]*?<\/button>/i, 'data-info-tab="faq">คำถามที่พบบ่อย</button>');
  }

  html = html.replace(
    /(<div[^>]*id="info-panel-description"[^>]*>)[\s\S]*?(<\/div>\s*<div[^>]*id="info-panel-faq")/i,
    (_m, start, end) => `${start}${descriptionHtml}\n        ${end}`
  );
  return html;
}

function applyLocalizedFaqFromD1(html: string, faq: string): string {
  const text = String(faq || '').trim();
  if (!text) return html;
  const faqHtml = looksLikeHtml(text) ? text : `<p>${escapeHtml(text)}</p>`;
  return html.replace(
    /(<div[^>]*id="info-panel-faq"[^>]*>)[\s\S]*?(<\/div>\s*<\/div>\s*<\/div>)/i,
    (_m, start, end) => `${start}${faqHtml}\n        ${end}`
  );
}

// Generic Thai FAQ block used as a fallback for products that don't have a
// hand-curated faq_th in D1. Mirrors the four standard questions in the EN
// customizable template, with internal links rewritten to /th/... paths.
const TH_GENERIC_FAQ_INNER = `<details class="faq-item" open>
            <summary>จะเลือกขนาดที่นอนได้อย่างไร?</summary>
            <p>ดู<a href="/th/sizeguide/">คู่มือขนาด</a>ของเราสำหรับขนาดมาตรฐาน หรือกรอกขนาดจริงของคุณในแบบฟอร์มสั่งตัดตามออเดอร์</p>
          </details>
          <details class="faq-item">
            <summary>สามารถสั่งตัดตามขนาดพิเศษได้หรือไม่?</summary>
            <p>ได้ คลิก <strong>ขนาดที่นอนแบบกำหนดเอง</strong> กรอกขนาดของคุณ แล้วส่งคำขอใบเสนอราคาสั่งตัด</p>
          </details>
          <details class="faq-item">
            <summary>ควรทราบรายละเอียดเกี่ยวกับเนื้อผ้าและการดูแลรักษาอย่างไร?</summary>
            <p>ผ้าทุกชนิดของ MildMate ซักเครื่องได้ที่อุณหภูมิปานกลาง (40°C / 104°F) ห้ามใช้น้ำยาฟอกขาว แนะนำให้ตากแห้งในที่ร่มเพื่อรักษาคุณภาพเส้นใยระยะยาว</p>
          </details>
          <details class="faq-item">
            <summary>ใช้เวลาจัดส่งนานเท่าไหร่?</summary>
            <p>ผลิตแบบสั่งตัดตามออเดอร์ที่โรงงานในประเทศไทย ระยะเวลาจัดส่งขึ้นอยู่กับปลายทางและจะแจ้งให้ทราบในอีเมลใบเสนอราคาหรือคำสั่งซื้อของคุณ</p>
          </details>`;

// Marine-specific Thai FAQ block (V-Berth sheets + marine mattress protector).
const TH_MARINE_FAQ_INNER = `<details class="faq-item" open>
            <summary>ควรทราบรายละเอียดเกี่ยวกับเนื้อผ้าและการดูแลรักษาอย่างไร?</summary>
            <p>ผ้า CloudSoft ของเราซักเครื่องได้ แห้งเร็ว ทนทานต่อสภาพแวดล้อมทางทะเล ห้ามใช้น้ำยาฟอกขาว แนะนำให้ตากแห้งในที่ร่มเพื่อรักษาคุณภาพเส้นใยระยะยาว</p>
          </details>
          <details class="faq-item">
            <summary>วัดขนาดที่นอนเรืออย่างไร?</summary>
            <p>ใช้<a href="/th/sizeguide/">คู่มือขนาด</a>ของเราเป็นข้อมูลอ้างอิง เลือกรูปทรงเตียงเรือของคุณด้านบน แล้วกรอกความยาวของแต่ละด้านให้ตรงตามที่วัดได้จริง ระบุความหนาของที่นอนเพื่อให้ตัดเย็บพอดีแบบกำหนดเอง</p>
          </details>
          <details class="faq-item">
            <summary>ใช้เวลาผลิตและจัดส่งนานเท่าไหร่?</summary>
            <p>ผลิตแบบสั่งตัดตามออเดอร์ตามรูปทรงและขนาดจริงของคุณ ใช้เวลาผลิต 5–7 วันทำการ ระยะเวลาจัดส่งขึ้นอยู่กับปลายทาง คุณจะได้รับหมายเลขพัสดุเมื่อจัดส่งแล้ว</p>
          </details>
          <details class="faq-item">
            <summary>ถ้ารูปทรงไม่อยู่ในลิสต์ล่ะ?</summary>
            <p>เลือกรูปทรงที่ใกล้เคียงที่สุดและเพิ่มหมายเหตุในแบบฟอร์มขอใบเสนอราคา — เราผลิตตามแบบจริงของคุณ หรือ<a href="/th/contact/">ติดต่อเรา</a>โดยตรงพร้อมแนบภาพวาดหรือรูปถ่ายที่นอนเรือของคุณ</p>
          </details>`;

const MARINE_FAQ_SLUGS = new Set(['marine-fitted-sheet', 'marine-top-sheet', 'marine-mattress-protector']);

// TH labels for the breadcrumb category link text. Mirrors the EN labels that
// ship in the static product templates' breadcrumb ("Fitted Sheets",
// "Duvet Covers", etc). Indexed by URL path so the Pages Function can swap the
// EN label for its TH counterpart regardless of which EN static file was loaded.
const TH_BREADCRUMB_CATEGORY_LABELS: Record<string, string> = {
  '/sheets/': 'ผ้าปูที่นอน',
  '/duvet-covers/': 'ปลอกผ้าห่ม',
  '/pillowcases/': 'ปลอกหมอน',
  '/protection/': 'ผลิตภัณฑ์ปกป้อง',
  '/accessories/': 'อุปกรณ์เสริม',
};

// Marine shape selector strings (templates/product-marine.html). These appear
// in static HTML so they need to be patched by the Pages Function (TH static
// files are never served — Pages Function loads EN static and patches fields).
const TH_MARINE_SHAPE_LABELS: Array<[RegExp, string]> = [
  [/Choose Your Boat Mattress Shape/g, 'เลือกรูปทรงที่นอนเรือของคุณ'],
  [/— Select a shape —/g, '— เลือกรูปทรง —'],
  [/Select a shape above to see the measurement diagram/g, 'เลือกรูปทรงด้านบนเพื่อดูแผนภาพการวัด'],
];

// Static HTML customer-facing strings to translate on TH product pages.
// Each entry targets a specific HTML anchor (label, header, badge) to avoid
// false matches elsewhere in the document. Applied by the Pages Function
// when isTh=true (the TH static files at /th/product/* are never served).
const TH_STATIC_HTML_REPLACEMENTS: Array<[RegExp, string]> = [
  // Configurator dimension labels
  [/<label for="dim-width">Width \(W\)<\/label>/g, '<label for="dim-width">ความกว้าง (W)</label>'],
  [/<label for="dim-length">Length \(L\)<\/label>/g, '<label for="dim-length">ความยาว (L)</label>'],
  [/<label for="dim-depth">Depth \(D\)<\/label>/g, '<label for="dim-depth">ความลึก (D)</label>'],
  // Price label
  [/<span class="price-label">Estimated price<\/span>/g, '<span class="price-label">ราคาประมาณการ</span>'],
  // Trust badges (mobile, customizable template)
  [/<\/svg>Custom Fit<\/div>/g, '</svg>ตัดเย็บตามขนาด</div>'],
  [/<\/svg>Human Safe<\/div>/g, '</svg>ปลอดภัยต่อการใช้งาน</div>'],
  [/<\/svg>Pet Resist<\/div>/g, '</svg>เหมาะกับบ้านที่มีสัตว์เลี้ยง</div>'],
  // Trust badges (desktop, all templates)
  [/<\/svg> Top-Rated Etsy Boutique/g, '</svg> ร้าน Etsy ที่ได้รับคะแนนสูง'],
  [/<\/svg> Ships from Thailand/g, '</svg> จัดส่งจากประเทศไทย'],
  // Reviews section
  [/<div class="reviews-header"><h2>Customer Reviews<\/h2><\/div>/g, '<div class="reviews-header"><h2>รีวิวจากลูกค้า</h2></div>'],
  [/id="product-review-count">Loading reviews\.\.\.</g, 'id="product-review-count">กำลังโหลดรีวิว...'],
  [/<h2>You might also like<\/h2>/g, '<h2>สินค้าที่คุณอาจสนใจ</h2>'],
  // Tags label (anchored on class context to avoid false matches)
  [/text-transform:uppercase; letter-spacing:0\.08em; margin-right:4px;">Tags:<\/span>/g, 'text-transform:uppercase; letter-spacing:0.08em; margin-right:4px;">หมวดหมู่:</span>'],
  // Marine template — fabric spec label + boat model prompt
  [/<div class="spec-label">Fabric<\/div>/g, '<div class="spec-label">เนื้อผ้า</div>'],
  // Configurator inline JS — single-fabric Fabric badge label
  [/<div class="panel-label">Fabric<\/div>/g, '<div class="panel-label">เนื้อผ้า</div>'],
  [/Know your boat model\? Choose fixed-price option/g, 'ทราบรุ่นเรือของคุณ? เลือกตัวเลือกราคาคงที่'],
  // Unit warning (configurator) — preserves <strong> markup
  [/Default: <strong>cm<\/strong>\. Using inches\? Switch to <strong>inch<\/strong> first\./g, 'หน่วยเริ่มต้น: <strong>ซม.</strong> ต้องการใช้หน่วยนิ้ว? เปลี่ยนเป็น <strong>นิ้ว</strong> ก่อน'],
];

function applyThaiProductUiLocalization(html: string, tagline: string, slug: string): string {
  const safeTagline = String(tagline || '').trim();
  const isWeightedDuvet = slug === 'weighted-duvet-cover';
  const sizeLabel = isWeightedDuvet ? 'เลือกขนาดผ้าห่มถ่วงน้ำหนัก' : 'เลือกขนาดที่นอน';
  const customPrompt = isWeightedDuvet
    ? 'กรอกขนาดผ้าห่มถ่วงน้ำหนักจริงของคุณ'
    : 'กรอกขนาดที่นอนจริงของคุณ';
  const sizeHintText = isWeightedDuvet ? 'ดูวิธีวัดขนาดผ้าห่ม' : 'ดูคู่มือขนาด';
  const customTabNote = isWeightedDuvet
    ? 'วัดจากผ้าห่มถ่วงน้ำหนักจริง (กว้าง × ยาว) ไม่ใช่ขนาดที่นอน'
    : 'วัดจากขนาดที่นอนจริงของคุณ';
  const localized = html
    .replace(
      /<button class="config-tab active" data-tab="standard">[\s\S]*?<\/button>/i,
      '<button class="config-tab active" data-tab="standard">ขนาดมาตรฐาน</button>'
    )
    .replace(
      /<button class="config-tab" data-tab="custom">[\s\S]*?<\/button>/i,
      '<button class="config-tab" data-tab="custom">ขนาดสั่งทำ</button>'
    )
    .replace(/id="price-top-sub">[\s\S]*?<\/span>/i, 'id="price-top-sub">ราคาเริ่มต้น</span>')
    .replace(/<div class="panel-label">\s*Select Mattress Size\s*<\/div>/i, `<div class="panel-label">${sizeLabel}</div>`)
    .replace(/<div class="panel-label">\s*Select Duvet Size\s*<\/div>/i, `<div class="panel-label">${sizeLabel}</div>`)
    .replace(/<strong style="font-size:0\.9375rem;">\s*Enter your exact mattress dimensions\s*<\/strong>/i, `<strong style="font-size:0.9375rem;">${customPrompt}</strong>`)
    .replace(/<strong style="font-size:0\.9375rem;">\s*Enter your exact duvet dimensions\s*<\/strong>/i, `<strong style="font-size:0.9375rem;">${customPrompt}</strong>`)
    .replace(/<div class="size-hint"><a href="\/sizeguide\/">[\s\S]*?<\/a><\/div>/i, `<div class="size-hint"><a href="/th/sizeguide/">${sizeHintText}</a></div>`)
    .replace(/<p class="dim-diagram-caption">[\s\S]*?<\/p>/i, `<p class="dim-diagram-caption">${customTabNote}</p>`)
    .replace(/(<button[^>]*id="add-to-cart"[^>]*>[\s\S]*?<\/svg>)\s*Add to Cart/i, '$1 เพิ่มลงตะกร้า')
    .replace(/(<button[^>]*id="mobile-add-to-cart"[^>]*>[\s\S]*?<\/svg>)\s*Add to Cart/i, '$1 เพิ่มลงตะกร้า')
    .replace(/<button class="info-tab active" type="button" data-info-tab="description">[\s\S]*?<\/button>/i, '<button class="info-tab active" type="button" data-info-tab="description">รายละเอียด</button>')
    .replace(/<button class="info-tab" type="button" data-info-tab="faq">[\s\S]*?<\/button>/i, '<button class="info-tab" type="button" data-info-tab="faq">คำถามที่พบบ่อย</button>')
    .replace(/>\s*Premium Quality\s*<\/span>/i, '>คุณภาพพรีเมียม</span>')
    .replace(/>\s*Custom Fit\s*<\/div>/i, '>ตัดเย็บตามขนาด</div>')
    .replace(/>\s*Human Safe\s*<\/div>/i, '>ปลอดภัยต่อการใช้งาน</div>')
    .replace(/>\s*Pet Resist\s*<\/div>/i, '>เหมาะกับบ้านที่มีสัตว์เลี้ยง</div>');
  if (!safeTagline) return localized;
  return localized.replace(/<p class="product-tagline">[\s\S]*?<\/p>/i, `<p class="product-tagline">${safeTagline}</p>`);
}

function applyFlatSheetExtraDeepPocketGuardrails(html: string, isTh: boolean): string {
  if (isTh) return html;
  return html
    .replace(
      /<p class="product-tagline">[\s\S]*?<\/p>/i,
      '<p class="product-tagline">Loose, non-elastic deep pocket top sheet for extra-deep mattresses with 20 in / 51 cm default depth and ~10 in / 25 cm tuck allowance.</p>'
    )
    .replace(/Full-perimeter elastic\.?/gi, 'Loose non-elastic top sheet');
}

export async function onRequest(context: any): Promise<Response> {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  if (pathname === '/product' || pathname === '/product/') {
    return Response.redirect(new URL('/products/', url.origin).toString(), 301);
  }
  if (pathname === '/th/product' || pathname === '/th/product/') {
    return Response.redirect(new URL('/th/products/', url.origin).toString(), 301);
  }

  const parts = pathname.split('/').filter(Boolean);
  const isTh = parts[0] === 'th';
  const startIdx = isTh ? 1 : 0;

  if (parts[startIdx] !== 'product') return context.next();

  // If the path contains more segments (e.g., /product/slug/index.html),
  // let the static asset server handle it directly by calling context.next()
  if (parts.length > startIdx + 2) return context.next();

  const slug = (parts[startIdx + 1] || '').toLowerCase();
  if (!slug) {
    return Response.redirect(new URL(isTh ? '/th/products/' : '/products/', url.origin).toString(), 301);
  }

  // Legacy slug → redirect
  if (!CANONICAL_PRODUCT_SLUGS.has(slug)) {
    const target = resolveLegacyProduct(slug);
    const redirectTarget = isTh ? `/th${target}` : target;
    return Response.redirect(new URL(redirectTarget, url.origin).toString(), 301);
  }

  // Canonical slug → serve static HTML with D1 image overrides
  try {
    // 1. Fetch static HTML from assets binding directly (bypasses routing/redirects)
    const staticUrl = `${url.origin}/product/${slug}/index.html`;
    const staticRes = await context.env.ASSETS.fetch(new Request(staticUrl));
    if (!staticRes.ok) return context.next();
    let html = await staticRes.text();

    if (isTh) {
      html = html.replace('<html lang="en">', '<html lang="th">');
    }

    // 2. Query D1 for this product's image, title, pricing, and category data
    const stmt = context.env.DB.prepare(
      'SELECT image_url, images, title_en, title_th, description_en, description_th, faq_en, faq_th, card_benefit_en, card_benefit_th, base_price_usd, product_type, niches FROM products WHERE slug = ?'
    ).bind(slug);
    const product = await stmt.first() as any;

    const localizedDescription = isTh
      ? String(product?.description_th || product?.card_benefit_th || product?.description_en || product?.card_benefit_en || '')
      : String(product?.description_en || product?.card_benefit_en || product?.description_th || product?.card_benefit_th || '');
    html = applyLocalizedDescriptionFromD1(html, localizedDescription, isTh);
    const thFaqFallback = MARINE_FAQ_SLUGS.has(slug) ? TH_MARINE_FAQ_INNER : TH_GENERIC_FAQ_INNER;
    const localizedFaq = isTh
      ? String(product?.faq_th || thFaqFallback)
      : String(product?.faq_en || '');
    html = applyLocalizedFaqFromD1(html, localizedFaq);
    if (isTh) {
      html = applyThaiProductUiLocalization(html, String(product?.card_benefit_th || product?.title_th || ''), slug);
    }
    if (slug === 'flat-sheet-extra-deep-pocket') {
      html = applyFlatSheetExtraDeepPocketGuardrails(html, isTh);
    }

    // Extract mainImage BEFORE the if block so it's in scope for JSON-LD
    let images: string[] = [];
    if (product && product.images) {
      try {
        images = JSON.parse(product.images as string);
      } catch (e) {
        try {
          images = JSON.parse((product.images as string).replace(/\\"/g, '"'));
        } catch (err) {
          console.error('Failed to parse product.images:', err);
        }
      }
    }
    const mainImage = (product && (product.image_url as string)) || images[0] || '';

    // Handle localized title translation for Thai pages
    const title = isTh && product && product.title_th ? product.title_th : (product && product.title_en);
    if (title) {
      // Replace browser title
      html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title} — MildMate<\/title>`);
      html = html.replace(/<meta property="og:title" content="[^"]*"/g, `<meta property="og:title" content="${title} — MildMate"`);
      html = html.replace(/<meta name="twitter:title" content="[^"]*"/g, `<meta name="twitter:title" content="${title} — MildMate"`);

      // Keep visible product title blocks consistent with D1 title (EN/TH)
      html = html.replace(
        /<h1 class="product-title">[\s\S]*?<\/h1>/i,
        `<h1 class="product-title">${title}</h1>`
      );
      html = html.replace(
        /(<nav class="product-breadcrumb"[\s\S]*?<span>)[\s\S]*?(<\/span>)/i,
        `$1${title}$2`
      );
    }

    // For TH pages, also swap the breadcrumb category link text to its TH
    // counterpart. The EN static templates ship EN labels (e.g. "Fitted Sheets",
    // "Duvet Covers"); TH_CHROME_REPLACEMENTS in build-products.js only fixes
    // the TH static files, which the Pages Function doesn't serve — so we
    // patch here too. Look up by category URL.
    if (isTh) {
      html = html.replace(
        /<nav class="product-breadcrumb"[\s\S]*?<\/nav>/i,
        (navBlock) => {
          let patched = navBlock;
          for (const [catUrl, thLabel] of Object.entries(TH_BREADCRUMB_CATEGORY_LABELS)) {
            // Replace only the link text inside <a href="{catUrl}">...</a>
            const re = new RegExp(
              '(<a href="' + catUrl.replace(/\//g, '\\/') + '"[^>]*>)([\\s\\S]*?)(<\\/a>)',
              'g'
            );
            patched = patched.replace(re, (_m, open, _text, close) => `${open}${thLabel}${close}`);
          }
          // Also swap the home link text "Home" → "หน้าแรก"
          patched = patched.replace(
            /(<a href="\/"[^>]*>)Home(<\/a>)/,
            '$1หน้าแรก$2'
          );
          return patched;
        }
      );

      // Marine shape selector strings (templates/product-marine.html). These
      // are static HTML labels inside the configurator panel; we replace them
      // for TH pages.
      for (const [re, thLabel] of TH_MARINE_SHAPE_LABELS) {
        html = html.replace(re, thLabel);
      }

      // Static HTML customer-facing strings (dimensions, estimated price,
      // trust badges, reviews header, recommendations, tags, unit warning).
      // Each pattern is anchored to specific HTML context to avoid false matches.
      for (const [re, thLabel] of TH_STATIC_HTML_REPLACEMENTS) {
        html = html.replace(re, thLabel);
      }
    }

    // Inject canonical + hreflang alternates for bilingual product URLs.
    // EN canonical points to /product/{slug}/; TH canonical points to /th/product/{slug}/.
    // Both hreflang alternates link the EN and TH counterparts.
    // Inject right after <meta charset="UTF-8"> so it sits at the top of <head>
    // regardless of any subsequent middleware or in-page insertions before </head>.
    {
      const enPath = `/product/${slug}/`;
      const thPath = `/th/product/${slug}/`;
      const canonicalHref = isTh
        ? `https://www.mildmate.com${thPath}`
        : `https://www.mildmate.com${enPath}`;
      const enHref = `https://www.mildmate.com${enPath}`;
      const thHref = `https://www.mildmate.com${thPath}`;
      const seoTags =
        `<link rel="canonical" href="${canonicalHref}">\n` +
        `  <link rel="alternate" hreflang="en" href="${enHref}">\n` +
        `  <link rel="alternate" hreflang="th" href="${thHref}">`;
      const anchor = '<meta charset="UTF-8">';
      if (html.includes(anchor) && !html.includes('rel="canonical"')) {
        html = html.replace(anchor, anchor + '\n  ' + seoTags);
      }
    }

    if (product && (product.image_url || product.images)) {
      // Build gallery HTML: main image + up to 6 thumbnails
      const THUMB_COUNT = 6;
      const thumbs = images.slice(0, THUMB_COUNT);

      // Replace <meta name="product-image" content="...">
      if (mainImage) {
        html = html.replace(
          /<meta name="product-image" content="[^"]*"/,
          `<meta name="product-image" content="${mainImage}"`
        );
      }

      // Replace gallery-main-img src (supports id before or after src)
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

      // Replace <meta name="product-images" content="..."> for carousel
      if (thumbs.length > 0) {
        const imagesJson = JSON.stringify(thumbs.filter(Boolean));
        html = html.replace(
          /<meta name="product-images" content="[^"]*"/,
          `<meta name="product-images" content='${imagesJson}'>`
        );
      }
    }

    // Product JSON-LD
    const baseUrl = url.origin;
    const mainImageUrl = mainImage
      ? (mainImage.startsWith('http') ? mainImage : `${baseUrl}${mainImage.startsWith('/') ? '' : '/'}${mainImage}`)
      : '';
    const productTitle = (isTh && product?.title_th) || product?.title_en || slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const productUrl = `${baseUrl}${isTh ? '/th' : ''}/product/${slug}/`;
    const rawPrice = Number(product?.base_price_usd);
    const hasPrice = Number.isFinite(rawPrice) && rawPrice > 0;

    let aggregateRating: any = undefined;
    try {
      const productTypeSlug = String(product?.product_type || '').trim().toLowerCase();
      const ptDisplay = PRODUCT_TYPE_DISPLAY[productTypeSlug] || productTypeSlug;
      const nicheDisplayNames: string[] = String(product?.niches || '')
        .split(',')
        .map((n: string) => n.trim().toLowerCase())
        .filter(Boolean)
        .map((n: string) => NICHE_DISPLAY[n])
        .filter(Boolean);
      const matchTypes = [ptDisplay, ...nicheDisplayNames].filter(Boolean);

      if (matchTypes.length > 0) {
        const placeholders = matchTypes.map(() => '?').join(',');
        const ratingSql = `SELECT COUNT(*) AS review_count, AVG(rating) AS rating_value FROM reviews WHERE product_type IN (${placeholders})`;
        const ratingRow = await context.env.DB.prepare(ratingSql).bind(...matchTypes).first() as any;
        const reviewCount = Number(ratingRow?.review_count || 0);
        const ratingValueNum = Number(ratingRow?.rating_value || 0);
        if (reviewCount > 0 && Number.isFinite(ratingValueNum) && ratingValueNum > 0) {
          aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: ratingValueNum.toFixed(1),
            reviewCount
          };
        }
      }
    } catch (e) {
      console.error('Product JSON-LD rating query failed:', e);
    }

    const productSchema: any = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: productTitle,
      image: mainImageUrl || undefined,
      description: 'Custom made-to-measure bedding. Any size. Any shape. Made to fit.',
      brand: { '@type': 'Brand', name: 'MildMate' },
      url: productUrl
    };
    if (hasPrice) {
      productSchema.offers = {
        '@type': 'Offer',
        price: rawPrice.toFixed(2),
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        seller: { '@type': 'Organization', name: 'MildMate' }
      };
    }
    if (aggregateRating) {
      productSchema.aggregateRating = aggregateRating;
    }

    const productJsonLd = `<script type="application/ld+json" id="json-ld-product">${JSON.stringify(productSchema)}</script>`;
    if (!html.includes('id="json-ld-product"')) {
      html = html.replace(/<\/head>/i, `${productJsonLd}\n</head>`);
    }

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    console.error('Product SSR error:', err);
    // Fallback: serve static HTML
    return context.next();
  }
}
