// build-products.js — Centralized product page builder
// Reads product-content.json + products.json, applies templates, writes product pages
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const PUBLIC_DIR = path.join(ROOT, 'public', 'product');

// Load data
const products = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'products.json'), 'utf8'));
const content = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'product-content.json'), 'utf8'));

// Load templates
const customizableTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'product-customizable.html'), 'utf8');
const fixedTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'product-fixed.html'), 'utf8');

// Fabric display names
const fabricNames = {
  cloudsoft: 'CloudSoft',
  breezeplus: 'BreezePlus',
  premacotton: 'PremaCotton',
  ecoluxe: 'EcoLuxe',
  cloudflex: 'CloudFlex',
  bamboo: 'Bamboo',
  tpu: 'TPU Waterproof',
  polyester: 'Polyester Hollow Fiber',
  microfiber: 'High-Density Microfiber',
  abs: 'ABS Plastic'
};

// Size label by product type
const sizeLabels = {
  'fitted-sheet': 'Select Mattress Size',
  'flat-sheet': 'Select Mattress Size',
  'encasement': 'Select Mattress Size',
  'protector': 'Select Mattress Size',
  'duvet': 'Select Duvet Size',
  'pillowcase': 'Pillow Size',
  'pillow-protector': 'Pillow Size'
};

const sizePlaceholders = {
  'fitted-sheet': 'Choose size',
  'flat-sheet': 'Choose size',
  'encasement': 'Choose size',
  'protector': 'Choose size',
  'duvet': 'Choose duvet size',
  'pillowcase': 'Choose pillow size',
  'pillow-protector': 'Choose pillow size'
};

const dimLabels = {
  'fitted-sheet': 'mattress',
  'flat-sheet': 'mattress',
  'encasement': 'mattress',
  'protector': 'mattress',
  'duvet': 'duvet',
  'pillowcase': 'pillow',
  'pillow-protector': 'pillow'
};

// Max dimensions by product type
function getMaxDims(productType) {
  if (['fitted-sheet', 'flat-sheet', 'encasement', 'protector'].includes(productType)) {
    return { width: 300, length: 300, depth: 60 };
  }
  return { width: 120, length: 120, depth: null };
}

function getProd(slug) {
  return products.products.find(p => p.slug === slug);
}

function getContent(slug) {
  return content.products[slug] || null;
}

// Generate fabric HTML
function buildFabricHTML(p) {
  // TPU products — show material specs grid (like bedbridge-connector)
  if (p.productType === 'encasement' || p.productType === 'pillow-protector') {
    const tpuSpecs = [
      { label: 'Material', value: 'TPU Waterproof Membrane' },
      { label: 'Certification', value: 'OEKO-TEX Certified' },
      { label: 'Protection', value: '100% Fluid Barrier' },
      { label: 'Breathability', value: 'Moisture-Vapor Permeable' }
    ];
    let grid = '<div class="panel-label">Material</div><div class="specs-grid">';
    tpuSpecs.forEach(s => {
      grid += '<div class="spec-item"><div class="spec-label">' + s.label + '</div><div class="spec-value">' + s.value + '</div></div>';
    });
    grid += '</div>';
    return grid;
  }
  if (p.fabricMode === 'badge') {
    const fabricName = fabricNames[p.lockedFabric] || p.lockedFabric;
    return '<div class="panel-section"><div class="panel-label">Fabric</div><div class="fabric-badge">' + fabricName + '</div></div>';
  }
  if (p.fabricMode === 'all' && p.fabrics && p.fabrics.length > 0) {
    let options = '';
    p.fabrics.forEach(f => {
      const name = fabricNames[f] || f;
      options += '<option value="' + f + '">' + name + '</option>';
    });
    return '<div class="panel-section"><div class="panel-label">Fabric</div><select class="fabric-select" id="fabric-select" style="width:100%; padding:12px 14px; border:2px solid var(--color-border); border-radius:var(--radius); font-family:var(--font-main); font-size:0.9375rem; color:var(--color-text); background:#fff; cursor:pointer; appearance:none; background-image:url(&quot;data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23666\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E&quot;); background-repeat:no-repeat; background-position:right 12px center;">' + options + '</select></div>';
  }
  return '<!-- No fabric selector -->';
}

// Generate colors HTML (empty for now)
function buildColorsHTML(p) {
  // Only render color selector for fitted-sheet and flat-sheet types with "all" fabric mode
  if (['fitted-sheet', 'flat-sheet'].includes(p.productType) && p.fabricMode === 'all') {
    return '<div class="panel-section"><div class="panel-label">Color — CloudSoft</div><div class="color-selector" id="color-selector"><div class="color-option selected" data-color="pure-white" style="background:#fff; border:2px solid #ddd;" title="Pure White"></div><div class="color-option" data-color="sand" style="background:#D9D1C1;" title="Sand"></div><div class="color-option" data-color="sky" style="background:#9CCAE1;" title="Sky"></div><div class="color-option" data-color="sea" style="background:#5A7DA2;" title="Sea"></div><div class="color-option" data-color="emerald" style="background:#618283;" title="Emerald"></div><div class="color-option" data-color="dark-grey" style="background:#4D545B;" title="Dark Grey"></div><div class="color-option" data-color="silver" style="background:#B7BEC8;" title="Silver"></div><div class="color-option" data-color="baby-pink" style="background:#E9B7BF;" title="Baby Pink"></div><div class="color-option" data-color="ivory" style="background:#F1EFE1;" title="Ivory"></div></div></div>';
  }
  return '';
}

// Generate bullets HTML
function buildBullets(bullets) {
  if (!bullets || bullets.length === 0) return '';
  return bullets.map(b => '<li>' + b + '</li>').join('');
}

// Generate tags HTML
function buildTagsHTML(tags) {
  if (!tags || tags.length === 0) return '';
  return tags.map(t => '<a href="' + t.url + '" class="tag-pill">' + t.label + '</a>').join('');
}

// Generate related products HTML
function buildRelatedHTML(relatedSlugs) {
  if (!relatedSlugs || relatedSlugs.length === 0) return '';
  let html = '';
  relatedSlugs.forEach(slug => {
    const prod = getProd(slug);
    const c = getContent(slug);
    if (!prod) return;
    const priceStr = c && c.priceDisplay ? 'From ' + c.priceDisplay : (prod.priceUsd ? 'From USD ' + prod.priceUsd + '.00' : '');
    const note = c && c.lockedFabric ? fabricNames[c.lockedFabric] || '' : (c && c.fabrics && c.fabrics.length > 0 ? fabricNames[c.fabrics[0]] || '' : '');
    html += '<a href="' + prod.url + '" class="related-card"><div class="card-image"><img src="' + prod.image + '" alt="' + prod.name + '" width="400" height="300" loading="lazy"></div><div class="card-body"><div class="card-title">' + prod.name + '</div><div class="card-price">' + priceStr + '</div><div class="card-price-note">' + note + '</div></div></a>';
  });
  return html;
}

// Build customizable page
function buildCustomizable(slug, p, prod) {
  let html = customizableTemplate;
  const pt = p.productType;
  const dims = getMaxDims(pt);
  const shortTitle = p.breadcrumbName === 'Standard Fitted Sheet' ? '12 inch Deep Pocket' : '';

  // Simple replacements
  const replacements = {
    '{{META_DESCRIPTION}}': p.metaDescription || '',
    '{{TITLE}}': p.breadcrumbName + ' — MildMate',
    '{{BREADCRUMB_CATEGORY_URL}}': p.breadcrumbCategoryUrl || '/',
    '{{BREADCRUMB_CATEGORY_LABEL}}': p.breadcrumbCategoryLabel || 'Products',
    '{{BREADCRUMB_NAME}}': p.breadcrumbName || '',
    '{{IMAGE_PATH}}': prod.image || '/images/placeholder.jpg',
    '{{PRODUCT_NAME}}': p.breadcrumbName || '',
    '{{SHORT_TITLE}}': shortTitle,
    '{{TAGLINE}}': p.tagline || '',
    '{{RATING_COUNT}}': String(p.ratingCount || 0),
    '{{TH_REDIRECT_PATH}}': (prod.urlTh || '/th' + prod.url),
    '{{PRODUCT_TYPE}}': pt,
    '{{SIZE_LABEL}}': sizeLabels[pt] || 'Select Size',
    '{{SIZE_PLACEHOLDER}}': sizePlaceholders[pt] || 'Choose size',
    '{{NEEDS_DEPTH}}': String(p.needsDepth === true),
    '{{DIM_LABEL}}': dimLabels[pt] || 'product',
    '{{MAX_WIDTH}}': String(dims.width),
    '{{MAX_LENGTH}}': String(dims.length),
    '{{MAX_DEPTH}}': dims.depth !== null ? String(dims.depth) : '0',
    '{{PRICE_DISPLAY}}': p.priceDisplay || (prod.priceUsd ? 'USD ' + prod.priceUsd.toFixed(2) : 'USD 0.00'),
    '{{TAB_DESCRIPTION_TITLE}}': p.tabDescriptionTitle || '',
    '{{TAB_DESCRIPTION_P}}': p.tabDescriptionP || '',
    '{{TAB_DESCRIPTION_BULLETS}}': buildBullets(p.tabDescriptionBullets),
    '{{TAB_FABRIC_TITLE}}': p.tabFabricTitle || '',
    '{{TAB_FABRIC_P}}': p.tabFabricP || '',
    '{{TAB_FABRIC_BULLETS}}': buildBullets(p.tabFabricBullets),
    '{{TAB_CARE_BULLETS}}': buildBullets(p.tabCareBullets),
    '{{REVIEW1_HTML}}': p.review1Html || '',
    '{{REVIEW2_HTML}}': p.review2Html || '',
    '{{RELATED_PRODUCTS}}': buildRelatedHTML(p.relatedSlugs),
    '{{TAGS_HTML}}': buildTagsHTML(p.tags)
  };

  // Build dynamic HTML parts
  replacements['{{FABRIC_HTML}}'] = buildFabricHTML(p);
  replacements['{{COLORS_HTML}}'] = buildColorsHTML(p);

  // Depth field
  if (p.needsDepth) {
    const maxDepth = dims.depth !== null ? String(dims.depth) : '60';
    replacements['{{DEPTH_FIELD_HTML}}'] = '<div class="dim-field"><label for="dim-depth">Depth (D)</label><input type="number" id="dim-depth" placeholder="e.g. 30" min="5" max="' + maxDepth + '"></div>';
  } else {
    replacements['{{DEPTH_FIELD_HTML}}'] = '';
  }

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  return html;
}

// Build fixed product page
function buildFixed(slug, p, prod) {
  let html = fixedTemplate;

  const replacements = {
    '{{META_DESCRIPTION}}': p.metaDescription || '',
    '{{TITLE}}': p.breadcrumbName + ' — MildMate',
    '{{BREADCRUMB_CATEGORY_URL}}': p.breadcrumbCategoryUrl || '/',
    '{{BREADCRUMB_CATEGORY_LABEL}}': p.breadcrumbCategoryLabel || 'Products',
    '{{BREADCRUMB_NAME}}': p.breadcrumbName || '',
    '{{IMAGE_PATH}}': prod.image || '/images/placeholder.jpg',
    '{{PRODUCT_NAME}}': p.breadcrumbName || '',
    '{{SHORT_TITLE_SUFFIX}}': '',
    '{{TAGLINE}}': p.tagline || '',
    '{{TH_REDIRECT_PATH}}': (prod.urlTh || '/th' + prod.url),
    '{{RELATED_PRODUCTS}}': buildRelatedHTML(p.relatedSlugs),
    '{{TAGS_HTML}}': buildTagsHTML(p.tags)
  };

  // Build fixed pricing HTML
  replacements['{{FIXED_PRICING_HTML}}'] = buildFixedPricingHTML(slug, p, prod);

  // Build trust signals
  replacements['{{TRUST_SIGNALS_HTML}}'] = buildTrustSignalsHTML();

  // Build fixed content HTML (specs, features, etc.)
  replacements['{{FIXED_CONTENT_HTML}}'] = buildFixedContentHTML(slug, p);

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  return html;
}

function buildFixedPricingHTML(slug, p, prod) {
  let html = '<div class="pricing-panel">';

  if (slug === 'duvet-insert') {
    // Duvet insert: size selector + fill weight + price calculation
    const fabricName = fabricNames[p.lockedFabric] || p.lockedFabric;
    html += '<div class="fabric-badge">' + fabricName + '</div>';
    html += '<div class="panel-section"><div class="panel-label">Select Size</div><select class="size-select" id="duvet-size"><option value=""> — Choose size — </option><option value="single" data-thb="1290" data-usd="18">Single — 150×200cm</option><option value="queen" data-thb="1490" data-usd="22">Queen — 200×230cm</option><option value="king" data-thb="1690" data-usd="26">King — 230×250cm</option></select></div>';
    html += '<div class="panel-section"><div class="panel-label">Fill Weight</div><select class="size-select" id="fill-weight"><option value=""> — Choose fill weight — </option><option value="light" data-mult="1.0">Light</option><option value="medium" data-mult="1.15" selected>Medium</option><option value="heavy" data-mult="1.3">Heavy</option></select></div>';
    html += '<div class="price-block"><div class="price-row"><span class="price-label">Price</span><span class="price-value" id="price-display">From ฿1,290</span></div><div class="price-sub">Thailand only · Excludes shipping</div></div>';
    html += '<button class="add-to-cart-btn" id="add-to-cart">Add to Cart</button>';
    html += '<script>(function(){var s=document.getElementById("duvet-size"),f=document.getElementById("fill-weight"),p=document.getElementById("price-display"),b=document.getElementById("add-to-cart");function u(){var sv=s.selectedOptions[0],fv=f.selectedOptions[0];if(sv&&fv&&sv.value){var t=parseFloat(sv.dataset.thb||"0")*parseFloat(fv.dataset.mult||"1");p.textContent="฿"+Math.round(t).toLocaleString()}else{p.textContent="From ฿1,290"}}s.addEventListener("change",u);f.addEventListener("change",u)})();</script>';
  } else {
    // BedBridge or Bed Lifter: simple price display
    html += '<div class="one-size-badge">One Size</div>';
    html += '<div class="price-display">' + (p.priceDisplay || ('USD ' + (p.priceUsd || 0).toFixed(2))) + '</div>';
    html += '<div class="price-note">Excludes shipping &amp; import tariff</div>';

    // Specs if available
    if (p.specsList && p.specsList.length > 0) {
      html += '<div class="specs-grid">';
      p.specsList.forEach(spec => {
        html += '<div class="spec-item"><div class="spec-label">' + spec.label + '</div><div class="spec-value">' + spec.value + '</div></div>';
      });
      html += '</div>';
    }

    html += '<button class="add-to-cart-btn" id="add-to-cart" onclick="if(typeof addToCart===\'function\'){addToCart({slug:\'' + slug + '\',name:\'' + (p.breadcrumbName || '') + '\',price:' + (p.priceUsd || 0) + ',qty:1})}">Add to Cart</button>';
  }

  html += '</div>';
  return html;
}

function buildTrustSignalsHTML() {
  return '<div class="trust-signals"><div class="trust-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> OEKO-TEX Certified</div><div class="trust-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg> Top-Rated Etsy Boutique</div><div class="trust-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Ships from Thailand</div><div class="trust-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> +66 (0)87 236 2364</div></div>';
}

function buildFixedContentHTML(slug, p) {
  if (slug === 'duvet-insert') {
    // Duvet insert has simple tabs below the product layout
    return '<div class="container" style="max-width:1280px; padding:0 24px;"><div style="padding:32px 0;"><h2 style="margin-bottom:16px;">Polyester Hollow Fiber Filling</h2><p style="color:#555; line-height:1.7;">Hypoallergenic polyester hollow fiber filling stays fluffy wash after wash. The hollow core traps air for warmth without weight, and dries quickly after washing. Made in Thailand.</p><h3 style="margin-top:24px; margin-bottom:12px;">Care Instructions</h3><ul style="padding-left:20px; margin-bottom:16px;"><li style="margin-bottom:6px; color:#555;">Machine wash warm (40°C / 104°F) — gentle cycle</li><li style="margin-bottom:6px; color:#555;">Do not bleach — mild detergent only</li><li style="margin-bottom:6px; color:#555;">Tumble dry low or hang dry — hollow fiber dries quickly</li><li style="margin-bottom:6px; color:#555;">Fluff after drying to restore loft</li></ul></div></div>';
  }

  if (slug === 'bedbridge-connector') {
    let html = '';
    html += '<div class="container" style="max-width:1280px; padding:0 24px;">';
    html += '<div style="padding:32px 0;">';
    // How it works
    html += '<div style="background:var(--color-surface); border-radius:var(--radius); padding:24px; margin-bottom:24px;"><h3 style="margin-bottom:12px;">How It Works</h3><ol style="padding-left:20px;"><li style="margin-bottom:8px; color:#555;"><strong style="color:var(--color-text);">Place the T-shaped wedge</strong> between two mattresses — the crossbar of the T goes under both mattresses, the stem fills the gap.</li><li style="margin-bottom:8px; color:#555;"><strong style="color:var(--color-text);">Push mattresses together</strong> — the high-density microfiber compresses slightly to create a firm bridge.</li><li style="margin-bottom:8px; color:#555;"><strong style="color:var(--color-text);">Cover with a fitted sheet</strong> — a family-size fitted sheet covers both mattresses and the BedBridge as one seamless surface.</li></ol></div>';
    // Features
    html += '<h3 style="margin-bottom:12px;">Features</h3><div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px;">';
    const features = ['Fills gaps up to 2.5 cm wide','High-density microfiber — durable and washable','No straps needed — friction-based design','Creates one seamless sleeping surface','Works with Twin XL to King setups','Machine washable'];
    features.forEach(f => { html += '<div style="display:flex; align-items:flex-start; gap:8px; font-size:0.9375rem; color:#555;"><span style="color:var(--color-primary);">✓</span>' + f + '</div>'; });
    html += '</div>';
    // Care
    html += '<h3 style="margin-bottom:12px;">Care</h3><div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">';
    const careItems = ['Machine wash cold — gentle cycle','Do not bleach','Tumble dry low','No ironing needed'];
    careItems.forEach(c => { html += '<div style="background:var(--color-surface); padding:12px; border-radius:6px; display:flex; gap:10px; align-items:center;"><span style="color:var(--color-primary);">●</span><span style="font-size:0.875rem; color:#555;">' + c + '</span></div>'; });
    html += '</div></div></div>';
    return html;
  }

  if (slug === 'mattress-lift-helper') {
    let html = '';
    html += '<div class="container" style="max-width:1280px; padding:0 24px;">';
    html += '<div style="padding:32px 0;">';
    html += '<h3 style="margin-bottom:12px;">Features</h3><div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px;">';
    const features = ['38cm height — lifts mattress easily','Ergonomic ABS design — no back strain','Ideal for elderly, seniors, and caregivers','High-quality ABS plastic — lightweight and strong','Simple one-handed operation'];
    features.forEach(f => { html += '<div style="display:flex; align-items:flex-start; gap:8px; font-size:0.9375rem; color:#555;"><span style="color:var(--color-primary);">✓</span>' + f + '</div>'; });
    html += '</div>';
    html += '<p style="color:#555; line-height:1.7;">The Bed Lifter makes changing fitted sheets effortless. Simply slide it under the mattress corner, lift, and tuck — no more struggling with heavy mattresses. Perfect for elderly users, caregivers, and anyone who wants to make bed changes easier.</p>';
    html += '</div></div>';
    return html;
  }

  return '';
}

// ===== MAIN BUILD =====
console.log('Building product pages...');
let builtCount = 0;

// Process all products from products.json
products.products.forEach(prod => {
  const slug = prod.slug;
  const p = getContent(slug);

  if (!p) {
    console.log('  SKIP (no content): ' + slug);
    return;
  }

  let outHtml = '';
  const type = p.productType;

  if (type === 'fixed') {
    outHtml = buildFixed(slug, p, prod);
  } else {
    outHtml = buildCustomizable(slug, p, prod);
  }

  // Write output
  const outDir = path.join(PUBLIC_DIR, slug);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, 'index.html');
  fs.writeFileSync(outPath, outHtml, 'utf8');
  console.log('  BUILT: ' + slug + ' → ' + outPath);
  builtCount++;
});

console.log('\nDone! Built ' + builtCount + ' product pages.');
