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

function applyThaiProductUiLocalization(html: string, tagline: string): string {
  const safeTagline = String(tagline || '').trim();
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
    .replace(/<div class="panel-label">\s*Select Mattress Size\s*<\/div>/i, '<div class="panel-label">เลือกขนาดที่นอน</div>')
    .replace(/<strong style="font-size:0\.9375rem;">\s*Enter your exact mattress dimensions\s*<\/strong>/i, '<strong style="font-size:0.9375rem;">กรอกขนาดที่นอนจริงของคุณ</strong>')
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
    const localizedFaq = isTh
      ? String(product?.faq_th || '')
      : String(product?.faq_en || '');
    html = applyLocalizedFaqFromD1(html, localizedFaq);
    if (isTh) {
      html = applyThaiProductUiLocalization(html, String(product?.card_benefit_th || product?.title_th || ''));
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
