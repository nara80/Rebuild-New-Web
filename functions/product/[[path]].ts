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
  if (slug.startsWith('product-boat-bedding') || slug.startsWith('product-boat-top-sheet')) return '/product/marine-fitted-sheet/';
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
      'SELECT image_url, images, title_en, title_th, base_price_usd, product_type, niches FROM products WHERE slug = ?'
    ).bind(slug);
    const product = await stmt.first() as any;

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

      // Replace H1 and breadcrumb name
      if (product && product.title_en) {
        html = html.replace(
          new RegExp(`<h1 class="product-title">\\s*${product.title_en.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*(.*?)\\s*</h1>`, 'i'),
          `<h1 class="product-title">${title}$1</h1>`
        );
        html = html.replace(
          new RegExp(`<span>\\s*${product.title_en.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*</span>`, 'i'),
          `<span>${title}</span>`
        );
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
