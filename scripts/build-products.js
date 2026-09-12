// build-products.js â€” Centralized product page builder
// Reads product-content.json + products.json, applies templates, writes product pages
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const PUBLIC_DIR = path.join(ROOT, 'public', 'product');

// Load data helper with BOM stripping
function readJsonFile(filePath) {
  let str = fs.readFileSync(filePath, 'utf8');
  if (str.charCodeAt(0) === 0xFEFF) {
    str = str.slice(1);
  }
  return JSON.parse(str);
}

const products = readJsonFile(path.join(DATA_DIR, 'products.json'));
const content = readJsonFile(path.join(DATA_DIR, 'product-content.json'));

// Load templates
const customizableTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'product-customizable.html'), 'utf8');
const fixedTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'product-fixed.html'), 'utf8');
const marineTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'product-marine.html'), 'utf8');

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
  microfiber: 'Microfiber 200g/m²',
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

function normalizeMojibake(s) {
  return String(s || '')
    .replace(/\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u009d/g, '—')
    .replace(/\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u201c/g, '–')
    .replace(/\u00c3\u00a2\u00e2\u201a\u00ac\u00cb\u0153/g, '‘')
    .replace(/\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u201e\u00a2/g, '’')
    .replace(/\u00c3\u00a2\u00e2\u201a\u00ac\u00c5\u201c/g, '“')
    .replace(/\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u009d/g, '”')
    .replace(/\u00e2\u20ac\u201d/g, '—')
    .replace(/\u00e2\u20ac\u201c/g, '–')
    .replace(/\u00e2\u20ac\u02dc/g, '‘')
    .replace(/\u00e2\u20ac\u2122/g, '’')
    .replace(/\u00e2\u20ac\u0153/g, '“')
    .replace(/\u00e2\u20ac\ufffd/g, '”')
    .replace(/\u00c2\u00b2/g, '²')
    .replace(/\u00c2\u00b0/g, '°')
    .replace(/\u00c3\u2014/g, '×')
    .replace(/\u00c2\u00b7/g, '·')
    .replace(/\ufffd/g, '×');
}

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
  if (productType === 'flat-sheet') {
    return { width: 400, length: 300, depth: 60 };
  }
  if (['fitted-sheet', 'encasement', 'protector'].includes(productType)) {
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
  // Mattress protectors â€” 3-layer construction specs (checked before breezeplus/cloudsoft
  // so pet-proof shows 3-Layer not BreezePlus)
  if (p.productType === 'protector') {
    const specs = [
      { label: 'Top Layer', value: 'Cotton Quilted' },
      { label: 'Layer 2 (Core)', value: 'Polyester Filling' },
      { label: 'Layer 3 (Backing)', value: 'TPU Waterproof' },
      { label: 'Protects', value: 'Water Spills &amp; Accidents' }
    ];
    let grid = '<div class="panel-label">3-Layer Construction</div><div class="specs-grid">';
    specs.forEach(s => {
      grid += '<div class="spec-item"><div class="spec-label">' + s.label + '</div><div class="spec-value">' + s.value + '</div></div>';
    });
    grid += '</div>';
    return grid;
  }
  // BreezePlus-exclusive products â€” show fabric feature specs
  if (p.lockedFabric === 'breezeplus') {
    const specs = [
      { label: 'Fabric', value: 'BreezePlus' },
      { label: 'Surface', value: 'Pet Hair Resistant' },
      { label: 'Cooling', value: 'Cool-to-the-Touch' },
      { label: 'Blend', value: '50/50 Cotton-Microfiber' }
    ];
    let grid = '<div class="panel-label">Fabric</div><div class="specs-grid">';
    specs.forEach(s => {
      grid += '<div class="spec-item"><div class="spec-label">' + s.label + '</div><div class="spec-value">' + s.value + '</div></div>';
    });
    grid += '</div>';
    return grid;
  }
  // CloudSoft-exclusive products â€” marine/RV fabric specs
  if (p.lockedFabric === 'cloudsoft') {
    const specs = [
      { label: 'Fabric', value: 'CloudSoft' },
      { label: 'Drying', value: 'Quick-Dry' },
      { label: 'Climate', value: 'Moisture-Wicking' },
      { label: 'Material', value: '115 GSM Premium Microfiber' }
    ];
    let grid = '<div class="panel-label">Fabric</div><div class="specs-grid">';
    specs.forEach(s => {
      grid += '<div class="spec-item"><div class="spec-label">' + s.label + '</div><div class="spec-value">' + s.value + '</div></div>';
    });
    grid += '</div>';
    return grid;
  }
  // TPU encasement / pillow protector / TPU-only cushion protector â€” material specs
  if (
    p.productType === 'encasement' ||
    p.productType === 'pillow-protector' ||
    (p.productType === 'fitted-sheet' && p.lockedFabric === 'tpu')
  ) {
    const tpuSpecs = [
      { label: 'Material', value: 'TPU Waterproof Membrane' },
      { label: 'Protects', value: 'Water Spills &amp; Accidents' },
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
  // TPU-only products use a fixed white appearance (no color selector)
  if (p.lockedFabric === 'tpu' && (p.productType === 'fitted-sheet' || p.productType === 'marine' || p.productType === 'protector')) return '';

  // Only render color selector for products that have fabric choices
  const colorProductTypes = ['fitted-sheet', 'flat-sheet', 'duvet', 'pillowcase', 'marine'];
  if (!colorProductTypes.includes(p.productType)) return '';
  // Show colors if product has fabric options (all mode) or a locked fabric
  if (p.fabricMode !== 'all' && !p.lockedFabric) return '';

  // Per-fabric color data matching /fabric/ page
  const fabricColors = {
    breezeplus: [
      { hex: '#4D545B', name: 'Dark Grey' },
      { hex: '#B7BEC8', name: 'Silver' },
      { hex: '#D9D1C1', name: 'Sand' },
      { hex: '#9CCAE1', name: 'Sky' },
      { hex: '#618283', name: 'Emerald' },
      { hex: '#5A7DA2', name: 'Sea' },
      { hex: '#FFFFFF', name: 'Pure White', border: '#ccc' },
      { hex: '#E9B7BF', name: 'Baby Pink' },
      { hex: '#F1EFE1', name: 'Ivory' }
    ],
    cloudsoft: [
      { hex: '#67E4D3', name: 'Mint' },
      { hex: '#5E5E5E', name: 'Charcoal' },
      { hex: '#A5A9B4', name: 'Grey' },
      { hex: '#385E9D', name: 'Sapphire' },
      { hex: '#486C6A', name: 'Forest' },
      { hex: '#1E4477', name: 'Denim' },
      { hex: '#D48C98', name: 'RoseGold' },
      { hex: '#E1D1B1', name: 'Beige' },
      { hex: '#B99F87', name: 'Ovaltine' },
      { hex: '#FFFFFF', name: 'White' },
      { hex: '#9581B1', name: 'Lavender' },
      { hex: '#93B09D', name: 'Olive' }
    ],
    premacotton: [
      { hex: '#ffffff', name: 'Snow White', border: '#ccc' }
    ],
    ecoluxe: [
      { hex: '#f3e5ab', name: 'Vanilla Linen' }
    ]
  };

  // Determine which fabric color group to show by default
  const defaultFabric = p.lockedFabric || (p.fabrics && p.fabrics[0]) || 'cloudsoft';

  // Build each fabric color group (hidden by default except defaultFabric)
  let html = '';
  for (const [fab, colors] of Object.entries(fabricColors)) {
    const display = fab === defaultFabric ? '' : ' style="display:none"';
    html += '<div class="panel-section fabric-color-group" data-fabric="' + fab + '"' + display + '>';
    html += '<div class="panel-label">Color â€” ' + fabricNames[fab] + '</div>';
    html += '<div class="color-selector">';
    colors.forEach((c, i) => {
      const selected = (i === 0 ? ' selected' : '');
      const border = c.border ? ' border:2px solid ' + c.border + ';' : '';
      html += '<div class="color-option' + selected + '" data-color="' + c.name.toLowerCase().replace(/\s/g, '-') + '" style="background:' + c.hex + ';' + border + '" title="' + c.name + '"></div>';
    });
    html += '</div></div>';
  }
  return normalizeMojibake(html);
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
  return normalizeMojibake(html);
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
    '{{TITLE}}': p.breadcrumbName + ' â€” MildMate',
    '{{BREADCRUMB_CATEGORY_URL}}': p.breadcrumbCategoryUrl || '/',
    '{{BREADCRUMB_CATEGORY_LABEL}}': p.breadcrumbCategoryLabel || 'Products',
    '{{BREADCRUMB_NAME}}': p.breadcrumbName || '',
    '{{IMAGE_PATH}}': prod.image || '/images/products/mattress-protector-standard/main.jpg',
    '{{PRODUCT_SLUG}}': slug,
    '{{PRODUCT_NAME}}': p.breadcrumbName || '',
    '{{SHORT_TITLE}}': shortTitle ? '  -  ' + shortTitle : '',
    '{{TAGLINE}}': p.tagline || '',
    '{{RATING_COUNT}}': String(p.ratingCount || 0),
    '{{TH_REDIRECT_PATH}}': (prod.urlTh || '/th' + prod.url),
    '{{PRODUCT_TYPE}}': pt,
    '{{SIZE_LABEL}}': sizeLabels[pt] || 'Select Size',
    '{{SIZE_PLACEHOLDER}}': sizePlaceholders[pt] || 'Choose size',
    '{{NEEDS_DEPTH}}': String(p.needsDepth === true),
    '{{DIM_LABEL}}': dimLabels[pt] || 'product',
    '{{DIM_DIAGRAM_ALT}}': 'Mattress dimension diagram: Width (W), Length (L), Depth (D)',
    '{{DIM_DIAGRAM_CAPTION}}': 'Measure your mattress at its widest, longest, and deepest points',
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

  const hasPremaCotton = p.fabrics && p.fabrics.includes('premacotton');
  const hasFourFabricCollections = p.fabrics && p.fabrics.length === 4;
  replacements['{{TRUST_MOBILE_OEKO}}'] = (hasPremaCotton && !hasFourFabricCollections) ? 'OEKO-TEX*' : 'Premium Quality';
  replacements['{{TRUST_DESKTOP_OEKO}}'] = (hasPremaCotton && !hasFourFabricCollections) ? 'PremaCotton OEKO-TEX® Certified' : 'Premium Quality';

  // Build dynamic HTML parts
  replacements['{{FABRIC_HTML}}'] = buildFabricHTML(p);
  replacements['{{COLORS_HTML}}'] = buildColorsHTML(p);
  replacements['{{SHAPE_SELECTOR_HTML}}'] = buildShapeSelectorHTML(p);

  // Depth field
  if (p.needsDepth) {
    const maxDepth = dims.depth !== null ? String(dims.depth) : '60';
    replacements['{{DEPTH_FIELD_HTML}}'] = '<div class="dim-field"><label for="dim-depth">Depth (D)</label><input type="number" id="dim-depth" placeholder="e.g. 30" min="5" max="' + maxDepth + '"></div>';
  } else {
    replacements['{{DEPTH_FIELD_HTML}}'] = '';
  }
  if (p.marineShapes && p.marineShapes.length > 0) {
    replacements['{{FOOT_WIDTH_FIELD_HTML}}'] = '<div class="dim-field field-foot" id="field-foot-width"><label for="dim-foot-width">Foot Width (FW)</label><input type="number" id="dim-foot-width" placeholder="e.g. 75" min="10" max="200"></div>';
  } else {
    replacements['{{FOOT_WIDTH_FIELD_HTML}}'] = '';
  }

  // Dim diagram image: per product type
  if (slug === 'marine-fitted-sheet') {
    replacements['{{DIM_DIAGRAM_IMG}}'] = '/images/products/common/measure-VBerth-diagram.png';
    replacements['{{DIM_DIAGRAM_ALT}}'] = 'Marine mattress diagram: Head Width (HW), Length (L), Depth (D), and Foot Width (FW)';
    replacements['{{DIM_DIAGRAM_CAPTION}}'] = 'Measure your boat mattress shape and enter HW, L, D, and FW where shown';
    replacements['{{DIM_INPUTS_CLASS}}'] = ' vberth';
  } else if (pt === 'duvet') {
    replacements['{{DIM_DIAGRAM_IMG}}'] = '/images/products/common/Duvet.png';
    replacements['{{DIM_DIAGRAM_ALT}}'] = 'Duvet or blanket dimensions diagram: Width (W) and Length (L)';
    replacements['{{DIM_DIAGRAM_CAPTION}}'] = 'Measure your duvet or blanket at its widest and longest points';
    replacements['{{DIM_INPUTS_CLASS}}'] = '';
  } else if (pt === 'pillowcase' || pt === 'pillow-protector') {
    replacements['{{DIM_DIAGRAM_IMG}}'] = '/images/products/common/Pillowcase.png';
    replacements['{{DIM_DIAGRAM_ALT}}'] = 'Pillow dimensions diagram: Width (W) and Length (L)';
    replacements['{{DIM_DIAGRAM_CAPTION}}'] = 'Measure your pillow at its widest and longest points';
    replacements['{{DIM_INPUTS_CLASS}}'] = '';
  } else {
    replacements['{{DIM_DIAGRAM_IMG}}'] = '/images/products/common/measure-mattress-diagram-01.png';
    replacements['{{DIM_DIAGRAM_ALT}}'] = 'Mattress dimension diagram: Width (W), Length (L), Depth (D)';
    replacements['{{DIM_DIAGRAM_CAPTION}}'] = 'Measure your mattress at its widest, longest, and deepest points';
    replacements['{{DIM_INPUTS_CLASS}}'] = '';
  }

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  return normalizeMojibake(html);
}

// Build fixed product page
function buildFixed(slug, p, prod) {
  let html = fixedTemplate;

  const replacements = {
    '{{META_DESCRIPTION}}': p.metaDescription || '',
    '{{TITLE}}': p.breadcrumbName + ' â€” MildMate',
    '{{BREADCRUMB_CATEGORY_URL}}': p.breadcrumbCategoryUrl || '/',
    '{{BREADCRUMB_CATEGORY_LABEL}}': p.breadcrumbCategoryLabel || 'Products',
    '{{BREADCRUMB_NAME}}': p.breadcrumbName || '',
    '{{IMAGE_PATH}}': prod.image || '/images/products/mattress-protector-standard/main.jpg',
    '{{PRODUCT_NAME}}': p.breadcrumbName || '',
    '{{SHORT_TITLE_SUFFIX}}': '',
    '{{TAGLINE}}': p.tagline || '',
    '{{TH_REDIRECT_PATH}}': (prod.urlTh || '/th' + prod.url),
    '{{RELATED_PRODUCTS}}': buildRelatedHTML(p.relatedSlugs),
    '{{TAGS_HTML}}': buildTagsHTML(p.tags),
    '{{PRODUCT_SLUG}}': slug,
    '{{PRICE_DISPLAY}}': p.priceDisplay || (prod.priceUsd ? 'USD ' + prod.priceUsd.toFixed(2) : 'USD 0.00'),
  };

  // Build fixed pricing HTML
  replacements['{{FIXED_PRICING_HTML}}'] = buildFixedPricingHTML(slug, p, prod);

  // Build trust signals
  replacements['{{TRUST_DESKTOP_WRAPPER_HTML}}'] = buildTrustSignalsWrapperHTML();

  // Build fixed content HTML (specs, features, etc.)
  replacements['{{FIXED_CONTENT_HTML}}'] = buildFixedContentHTML(slug, p);

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  return normalizeMojibake(html);
}
// Build marine product page
function buildMarine(slug, p, prod) {
  let html = marineTemplate;
  const pt = p.productType;
  const shortTitle = '';
  const isMarineProtector = slug === 'marine-mattress-protector';

  // Inline shapes JSON for JS
  const defaultMarineShapes = ((content.products || {})['marine-fitted-sheet'] || {}).marineShapes || [];
  const shapesJs = JSON.stringify((p.marineShapes && p.marineShapes.length > 0) ? p.marineShapes : defaultMarineShapes);

  // Build FAQ items from care bullets
  let faqHtml = '';
  if (p.tabCareBullets && p.tabCareBullets.length > 0) {
    let careItems = p.tabCareBullets.map(b => '<li>' + b + '</li>').join('');
    faqHtml += '<details class="faq-item" open><summary>What fabric and care details should I know?</summary><ul>' + careItems + '</ul></details>';
  }
  faqHtml += '<details class="faq-item"><summary>How do I measure my boat mattress?</summary><p>Use our <a href="/sizeguide/">size guide</a> for reference. Select your shape above and enter each side length exactly as measured. Include mattress thickness for an accurate custom fit.</p></details>';
  faqHtml += '<details class="faq-item"><summary>How long does production and shipping take?</summary><p>Each ' + (isMarineProtector ? 'protector' : 'sheet') + ' is custom-made to your exact shape and dimensions. Production takes 5–7 business days. Shipping times vary by destination — you\'ll receive a tracking number once dispatched.</p></details>';
  faqHtml += '<details class="faq-item"><summary>What if my shape isn\'t listed?</summary><p>Choose the closest shape and add notes in the quote form — we manufacture to your exact template. You can also <a href="/contact/">contact us</a> directly with a drawing or photo of your mattress.</p></details>';

  const replacements = {
    '{{META_DESCRIPTION}}': p.metaDescription || '',
    '{{TITLE}}': p.breadcrumbName + ' — MildMate',
    '{{BREADCRUMB_CATEGORY_URL}}': p.breadcrumbCategoryUrl || '/',
    '{{BREADCRUMB_CATEGORY_LABEL}}': p.breadcrumbCategoryLabel || 'Products',
    '{{BREADCRUMB_NAME}}': p.breadcrumbName || '',
    '{{IMAGE_PATH}}': prod.image || '/images/products/mattress-protector-standard/main.jpg',
    '{{PRODUCT_NAME}}': p.breadcrumbName || '',
    '{{SHORT_TITLE}}': shortTitle,
    '{{TAGLINE}}': p.tagline || '',
    '{{PRICE_DISPLAY}}': p.priceDisplay || (prod.priceUsd ? 'USD ' + prod.priceUsd.toFixed(2) : 'USD 0.00'),
    '{{COLORS_HTML}}': buildColorsHTML(p),
    '{{TAB_DESCRIPTION_TITLE}}': p.tabDescriptionTitle || '',
    '{{TAB_DESCRIPTION_P}}': p.tabDescriptionP || '',
    '{{TAB_DESCRIPTION_BULLETS}}': buildBullets(p.tabDescriptionBullets),
    '{{TAB_FABRIC_TITLE}}': p.tabFabricTitle || '',
    '{{TAB_FABRIC_P}}': p.tabFabricP || '',
    '{{TAB_FABRIC_BULLETS}}': buildBullets(p.tabFabricBullets),
    '{{FAQ_ITEMS}}': faqHtml,
    '{{RELATED_PRODUCTS}}': buildRelatedHTML(p.relatedSlugs),
    '{{TAGS_HTML}}': buildTagsHTML(p.tags),
    '{{PRODUCT_SLUG}}': slug,
    '{{MARINE_SHAPES_JS}}': shapesJs,
  };

  const hasPremaCotton = p.fabrics && p.fabrics.includes('premacotton');
  const hasFourFabricCollections = p.fabrics && p.fabrics.length === 4;
  replacements['{{TRUST_MOBILE_OEKO}}'] = (hasPremaCotton && !hasFourFabricCollections) ? 'OEKO-TEX*' : 'Premium Quality';
  replacements['{{TRUST_DESKTOP_OEKO}}'] = (hasPremaCotton && !hasFourFabricCollections) ? 'PremaCotton OEKO-TEX® Certified' : 'Premium Quality';

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }
  return normalizeMojibake(html);
}

function buildShapeSelectorHTML(p) {
  if (!p.marineShapes || p.marineShapes.length === 0) return '';

  let html = '<div class="panel-section marine-shape-section">';
  html += '<div class="panel-label">Choose Your Berth Shape</div>';

  // Shape guide image â€” 005-Measure-04.png
  html += '<div class="shape-guide" style="margin-bottom:16px; border:1px solid var(--color-border); border-radius:var(--radius); overflow:hidden;">';
  html += '<img src="/images/products/marine-fitted-sheet/005-Measure-04.png" alt="Marine Berth Shape Guide â€” Shapes A through I" style="width:100%; height:auto; display:block;">';
  html += '</div>';

  // Shape selector dropdown
  html += '<select class="shape-select" id="marine-shape-select" style="width:100%; padding:12px 14px; border:2px solid var(--color-border); border-radius:var(--radius); font-family:var(--font-main); font-size:0.9375rem; color:var(--color-text); background:#fff; cursor:pointer; appearance:none; background-image:url(&quot;data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23666\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E&quot;); background-repeat:no-repeat; background-position:right 12px center;">';
  html += '<option value=""> â€” Select shape â€” </option>';
  const shapes = p.marineShapes;
  shapes.forEach(s => {
    const priceLabel = s.quoteOnly ? 'Custom Quote' : ('$' + s.priceUsd);
    html += '<option value="' + s.code + '"'
      + (s.quoteOnly ? ' data-quote-only="1"' : ' data-price="' + s.priceUsd + '"')
      + ' data-length-min="' + (s.lengthMin || '') + '"'
      + ' data-length-max="' + (s.lengthMax || '') + '"'
      + ' data-head-min="' + (s.headWidthMin || '') + '"'
      + ' data-head-max="' + (s.headWidthMax || '') + '"'
      + ' data-foot-min="' + (s.footWidthMin || '') + '"'
      + ' data-foot-max="' + (s.footWidthMax || '') + '"'
      + ' data-type="' + (s.type || '') + '"'
      + '>' + s.code + '  â€”  ' + s.name + ' (' + priceLabel + ')</option>';
  });

  html += '</select>';
  html += '<div class="shape-dims-hint" id="shape-dims-hint" style="font-size:0.8125rem; color:#888; margin-top:8px;"></div>';
  html += '</div>';

  return html;
}

function buildFixedPricingHTML(slug, p, prod) {
  let html = '<div class="pricing-panel">';

  if (slug === 'duvet-insert') {
    // Duvet insert: Thai-only standard sizes, Microfiber 200g/sq.m fixed fill
    html += '<div class="fabric-badge">Microfiber 200g/m²</div>';
    html += '<div class="panel-section"><div class="panel-label">Select Size</div><select class="size-select" id="duvet-size"><option value=""> — Choose size — </option><option value="3ft" data-thb="990">3FT, 3.5FT — 178×229cm</option><option value="5ft" data-thb="1480">5FT, 6FT — 229×254cm</option><option value="7ft" data-thb="1690">7FT — 279×254cm</option><option value="9ft" data-thb="1790">9FT, 9.5FT — 318×254cm</option></select></div>';
    html += '<div class="price-block"><div class="price-row"><span class="price-label">Price</span><span class="price-value" id="price-display">From ฿990</span></div><div class="price-sub">Thailand only · Excludes shipping</div></div>';
    html += '<button class="add-to-cart-btn" id="add-to-cart">Add to Cart</button>';
    html += '<script>(function(){var s=document.getElementById("duvet-size"),p=document.getElementById("price-display");s.addEventListener("change",function(){var o=s.selectedOptions[0];if(o&&o.value){var t=parseFloat(o.dataset.thb||"0");p.textContent="฿"+Math.round(t).toLocaleString()}else{p.textContent="From ฿990"}})})();</script>';
  } else {
    // BedBridge or Bed Lifter: simple price display
    html += '<div class="one-size-badge">One Size</div>';
    html += '<div class="price-display" id="price-display">' + (p.priceDisplay || ('USD ' + (p.priceUsd || 0).toFixed(2))) + '</div>';
    html += '<div class="price-note">Excludes shipping &amp; import tariff</div>';

    // Specs if available
    if (p.specsList && p.specsList.length > 0) {
      html += '<div class="specs-grid">';
      p.specsList.forEach(spec => {
        html += '<div class="spec-item"><div class="spec-label">' + spec.label + '</div><div class="spec-value">' + spec.value + '</div></div>';
      });
      html += '</div>';
    }

    html += '<button class="add-to-cart-btn" id="add-to-cart" onclick="if(typeof addToCart===\'function\'){addToCart({slug:\'' + slug + '\',name:\'' + (p.breadcrumbName || '') + '\',price:' + (p.priceUsd || 0) + ',priceThb:' + (prod.priceThb || 0) + ',qty:1})}">Add to Cart</button>';
  }

  html += '</div>';
  return html;
}

function buildTrustSignalsHTML() {
  return '<div class="trust-signals"><div class="trust-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Premium Quality</div><div class="trust-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg> Top-Rated Etsy Boutique</div><div class="trust-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Ships from Thailand</div><div class="trust-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> +66 (0)87 236 2364</div></div>';
}

function buildTrustSignalsWrapperHTML() {
  return '<div class="container trust-signals-desktop-wrap" style="max-width:1280px; padding:0 24px 28px;"><div class="trust-signals trust-signals-desktop"><div class="trust-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Premium Quality</div><div class="trust-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg> Top-Rated Etsy Boutique</div><div class="trust-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Ships from Thailand</div><div class="trust-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>+66 (0)87 236 2364</div></div></div>';
}


function buildFixedContentHTML(slug, p) {
  if (slug === 'duvet-insert') {
    return '<div class="container" style="max-width:1280px; padding:0 24px;">'
      + '<div class="product-tabs">'
      + '<div class="tab-list" role="tablist">'
      + '<button class="tab-btn active" role="tab" data-tab="description">Description</button>'
      + '<button class="tab-btn" role="tab" data-tab="care">Care</button>'
      + '</div>'
      + '<div class="tab-content open" id="tab-description" role="tabpanel">'
      + '<h3>Microfiber 200g/m² Filling</h3>'
      + '<p>Premium microfiber fill at 200 grams per square metre â€” the ideal weight for Thailand\'s climate. Lighter than hollow fiber but just as warm, with a smooth, even drape that stays in place inside your duvet cover. Hypoallergenic, quick-drying, and made in Thailand.</p>'
      + '<p>Available in four standard Thai duvet sizes matching our <a href="/sizeguide/" style="color:#2c96f4;">size guide</a>: 3FT/3.5FT, 5FT/6FT, 7FT, and 9FT/9.5FT.</p>'
      + '</div>'
      + '<div class="tab-content" id="tab-care" role="tabpanel">'
      + '<h3>Care Instructions</h3>'
      + '<ul>'
      + '<li>Machine wash warm (60°C / 140°F) — gentle cycle</li>'
      + '<li>Do not bleach â€” mild detergent only</li>'
      + '<li>Tumble dry low or hang dry â€” microfiber dries quickly</li>'
      + '<li>Fluff after drying to restore loft</li>'
      + '</ul>'
      + '</div>'
      + '</div></div>';
  }

  if (slug === 'bedbridge-connector') {
    let html = '';
    html += '<div class="container" style="max-width:1280px; padding:0 24px;">';
    html += '<div style="padding:32px 0;">';
    
    // Overview
    html += '<div style="margin-bottom:40px;">';
    html += '<h2 style="font-size:1.8rem; margin-bottom:12px; color:var(--color-heading);">Turn Two Mattresses Into One Smoother Joined Bed</h2>';
    html += '<p style="font-size:1.1rem; color:var(--color-muted); line-height:1.6; max-width:800px;">The MildMate BedBridge Connector is a universal T-shaped mattress gap filler designed to soften the centre join between two closely aligned mattresses. Use the same 190 × 30 × 20 cm BedBridge across many Twin, Twin XL, King split-bed, guest-room, and family co-sleep setups. For unusual joined-bed sizes, the fitted sheet is normally the part to customize — not the BedBridge.</p>';
    html += '</div>';

    // How it works
    html += '<div style="background:var(--color-surface); border-radius:var(--radius); padding:32px; margin-bottom:40px; border:1px solid var(--color-border);">';
    html += '<h3 style="margin-bottom:20px; font-size:1.4rem; color:var(--color-heading);">How It Works</h3>';
    html += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:24px;">';
    
    html += '<div style="background:#fff; padding:20px; border-radius:6px; border:1px solid var(--color-border);">';
    html += '<span style="display:inline-block; width:28px; height:28px; line-height:28px; background:var(--color-primary); color:#fff; text-align:center; border-radius:50%; font-weight:bold; margin-bottom:12px;">1</span>';
    html += '<h4 style="margin-bottom:8px; color:var(--color-heading); font-size:1.05rem;">Position the Wedge</h4>';
    html += '<p style="font-size:0.875rem; color:var(--color-muted); line-height:1.5; margin:0;">Place the T-shaped connector between the two mattresses. The 20 cm centre stem sits inside the gap while the top panel rests across both sleep surfaces.</p>';
    html += '</div>';

    html += '<div style="background:#fff; padding:20px; border-radius:6px; border:1px solid var(--color-border);">';
    html += '<span style="display:inline-block; width:28px; height:28px; line-height:28px; background:var(--color-primary); color:#fff; text-align:center; border-radius:50%; font-weight:bold; margin-bottom:12px;">2</span>';
    html += '<h4 style="margin-bottom:8px; color:var(--color-heading); font-size:1.05rem;">Push Beds Together</h4>';
    html += '<p style="font-size:0.875rem; color:var(--color-muted); line-height:1.5; margin:0;">Push the mattresses closely together. Mattress compression helps hold the centre stem in position without wraparound straps or buckles.</p>';
    html += '</div>';

    html += '<div style="background:#fff; padding:20px; border-radius:6px; border:1px solid var(--color-border);">';
    html += '<span style="display:inline-block; width:28px; height:28px; line-height:28px; background:var(--color-primary); color:#fff; text-align:center; border-radius:50%; font-weight:bold; margin-bottom:12px;">3</span>';
    html += '<h4 style="margin-bottom:8px; color:var(--color-heading); font-size:1.05rem;">Cover with a Sheet</h4>';
    html += '<p style="font-size:0.875rem; color:var(--color-muted); line-height:1.5; margin:0;">Cover both mattresses and the BedBridge with one fitted sheet. Fitted-sheet tension adds stability and helps create a smoother joined sleeping surface.</p>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    // Key Benefits / Solutions
    html += '<div style="margin-bottom:40px;">';
    html += '<h3 style="margin-bottom:24px; font-size:1.4rem; color:var(--color-heading);">Why It Works Better</h3>';
    html += '<div style="display:grid; grid-template-columns:1fr; gap:20px;">';

    const benefits = [
      {
        title: 'One Universal Size for Many Joined-Bed Setups',
        desc: '<strong style="color:var(--color-heading);">The Detail:</strong> BedBridge is supplied in one universal size: 190 cm length, 30 cm top width, and 20 cm centre depth.<br><strong style="color:var(--color-heading);">Why it matters:</strong> You normally do not need custom BedBridge sizing. For 200–203 cm mattresses, centre the BedBridge along the join; a small uncovered area near the head and foot is normal.'
      },
      {
        title: '20 cm Centre Stem Works Across Many Mattress Depths',
        desc: '<strong style="color:var(--color-heading);">The Detail:</strong> The centre stem is designed to sit inside the gap and does not need to match full mattress depth.<br><strong style="color:var(--color-heading);">Why it matters:</strong> A deeper mattress (for example 27 cm) does not require a deeper custom BedBridge.'
      },
      {
        title: 'Strap-Free Practical Setup',
        desc: '<strong style="color:var(--color-heading);">The Detail:</strong> No wraparound straps are required in normal use.<br><strong style="color:var(--color-heading);">Why it matters:</strong> Mattress compression plus fitted-sheet tension help keep the BedBridge in position while softening the centre join.'
      },
      {
        title: 'Works Best Under One Correctly Sized Fitted Sheet',
        desc: '<strong style="color:var(--color-heading);">The Detail:</strong> Cover both mattresses and the BedBridge with one fitted sheet with full-perimeter elastic and adequate pocket depth.<br><strong style="color:var(--color-heading);">Why it matters:</strong> For unusual combined sizes, customize the fitted sheet dimensions — not the BedBridge.'
      },
      {
        title: 'Family and Floor-Bed Friendly Guidance',
        desc: '<strong style="color:var(--color-heading);">The Detail:</strong> BedBridge can be used for family/co-sleep floor-bed setups when mattresses are aligned and the centre gap is about 2.5 cm (1 in) or less.<br><strong style="color:var(--color-heading);">Why it matters:</strong> If mattresses slide on smooth floors, adding a suitable non-slip underlay beneath them can improve stability.'
      }
    ];

    benefits.forEach(b => {
      html += '<div style="display:flex; gap:16px; align-items:flex-start; padding-bottom:16px; border-bottom:1px solid var(--color-border);">';
      html += '<span style="color:var(--color-primary); font-size:1.25rem; font-weight:bold; line-height:1.2;">✓</span>';
      html += '<div>';
      html += '<h4 style="margin:0 0 6px 0; color:var(--color-heading); font-size:1.1rem; font-weight:600;">' + b.title + '</h4>';
      html += '<p style="margin:0; color:var(--color-muted); font-size:0.9375rem; line-height:1.5;">' + b.desc + '</p>';
      html += '</div>';
      html += '</div>';
    });

    html += '</div>';
    html += '</div>';

    html += '<div style="margin-bottom:32px; background:#fff; border:1px solid var(--color-border); border-radius:6px; padding:16px 18px;">';
    html += '<p style="margin:0; color:var(--color-muted); font-size:0.9375rem; line-height:1.6;"><strong style="color:var(--color-heading);">Important:</strong> BedBridge helps create a smoother transition between two mattresses, but it does not permanently lock mattresses together or guarantee that the centre join will be completely undetectable.</p>';
    html += '</div>';

    // Care Instructions
    html += '<div>';
    html += '<h3 style="margin-bottom:16px; font-size:1.4rem; color:var(--color-heading);">Care Instructions</h3>';
    html += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">';
    const careItems = ['Machine wash cold — gentle cycle', 'Do not bleach', 'Tumble dry low', 'No ironing needed'];
    careItems.forEach(c => {
      html += '<div style="background:var(--color-surface); padding:16px; border-radius:6px; display:flex; gap:12px; align-items:center; border:1px solid var(--color-border);">';
      html += '<span style="color:var(--color-primary); font-size:1rem;">●</span>';
      html += '<span style="font-size:0.875rem; color:var(--color-text); font-weight:500;">' + c + '</span>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    html += '</div></div>';
    return html;
  }

  if (slug === 'mattress-lift-helper') {
    let html = '';
    html += '<div class="container" style="max-width:1280px; padding:0 24px;">';
    html += '<div style="padding:32px 0;">';
    
    // Overview
    html += '<div style="margin-bottom:40px;">';
    html += '<h2 style="font-size:1.8rem; margin-bottom:12px; color:var(--color-heading);">Make Your Bed Without the Heavy Lifting</h2>';
    html += '<p style="font-size:1.1rem; color:var(--color-muted); line-height:1.6; max-width:800px;">Lifting a heavy mattress to tuck in sheets is a daily chore that strains your back, shoulders, and wrists. The MildMate Easy Bed Maker & Mattress Lifter is the ultimate ergonomic tool designed to take the weight off your hands. It slides between the mattress and base (or box spring), keeping the mattress raised so both hands are free to make the bed.</p>';
    html += '</div>';

    // How it works
    html += '<div style="background:var(--color-surface); border-radius:var(--radius); padding:32px; margin-bottom:40px; border:1px solid var(--color-border);">';
    html += '<h3 style="margin-bottom:20px; font-size:1.4rem; color:var(--color-heading);">How It Works</h3>';
    html += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:24px;">';
    
    html += '<div style="background:#fff; padding:20px; border-radius:6px; border:1px solid var(--color-border);">';
    html += '<span style="display:inline-block; width:28px; height:28px; line-height:28px; background:var(--color-primary); color:#fff; text-align:center; border-radius:50%; font-weight:bold; margin-bottom:12px;">1</span>';
    html += '<h4 style="margin-bottom:8px; color:var(--color-heading); font-size:1.05rem;">Slide Under</h4>';
    html += '<p style="font-size:0.875rem; color:var(--color-muted); line-height:1.5; margin:0;">Insert the smooth, wedge-shaped lifter between your mattress and base. It slides in easily without catching.</p>';
    html += '</div>';

    html += '<div style="background:#fff; padding:20px; border-radius:6px; border:1px solid var(--color-border);">';
    html += '<span style="display:inline-block; width:28px; height:28px; line-height:28px; background:var(--color-primary); color:#fff; text-align:center; border-radius:50%; font-weight:bold; margin-bottom:12px;">2</span>';
    html += '<h4 style="margin-bottom:8px; color:var(--color-heading); font-size:1.05rem;">Lift & Hold</h4>';
    html += '<p style="font-size:0.875rem; color:var(--color-muted); line-height:1.5; margin:0;">Push down gently on the handle to lift the mattress. The wedge locks in place like a kickstand, keeping the mattress raised.</p>';
    html += '</div>';

    html += '<div style="background:#fff; padding:20px; border-radius:6px; border:1px solid var(--color-border);">';
    html += '<span style="display:inline-block; width:28px; height:28px; line-height:28px; background:var(--color-primary); color:#fff; text-align:center; border-radius:50%; font-weight:bold; margin-bottom:12px;">3</span>';
    html += '<h4 style="margin-bottom:8px; color:var(--color-heading); font-size:1.05rem;">Easy Tucking</h4>';
    html += '<p style="font-size:0.875rem; color:var(--color-muted); line-height:1.5; margin:0;">Use both hands to quickly tuck sheets. Use the flat edge of the lifter to tuck the sheet under for a clean, tight fit without scraping knuckles.</p>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    // Key Benefits
    html += '<div style="margin-bottom:40px;">';
    html += '<h3 style="margin-bottom:24px; font-size:1.4rem; color:var(--color-heading);">Why It Works Better</h3>';
    html += '<div style="display:grid; grid-template-columns:1fr; gap:20px;">';

    const benefits = [
      {
        title: 'Ergonomic Back-Saving Design',
        desc: '<strong style="color:var(--color-heading);">The Problem:</strong> Lifting heavy mattresses repeatedly causes back fatigue, neck strain, and sore wrists, especially for seniors, caregivers, or hotel housekeepers.<br><strong style="color:var(--color-heading);">The Solution:</strong> Our angled leverage design does the heavy lifting for you. Simply slide it in and press down to raise the bed, saving your back from strain.'
      },
      {
        title: 'Stable "Kickstand" Support',
        desc: '<strong style="color:var(--color-heading);">The Problem:</strong> Trying to hold a heavy mattress up with one hand while tucking sheets with the other is clumsy and exhausting.<br><strong style="color:var(--color-heading);">The Solution:</strong> The wedge-shaped body slides deep under the mattress and acts as a stable kickstand, keeping the mattress raised so both hands are completely free.'
      },
      {
        title: 'Protective Sheet Tucker Edge',
        desc: '<strong style="color:var(--color-heading);">The Problem:</strong> Tucking sheets under tight bed frames leads to scraped knuckles, friction burns, and ruined manicures.<br><strong style="color:var(--color-heading);">The Solution:</strong> The smooth, flat front edge of the lifter doubles as an ergonomic sheet tucker. Slide sheets under cleanly and quickly without ever putting your hands near rough surfaces.'
      },
      {
        title: 'Heavy-Duty Reinforced ABS',
        desc: '<strong style="color:var(--color-heading);">The Problem:</strong> Flimsy lifters bend, warp, or snap under the immense pressure of thick latex, hybrid, or memory foam mattresses.<br><strong style="color:var(--color-heading);">The Solution:</strong> Constructed from thick, high-density reinforced ABS plastic, this tool is built to withstand high pressure and easily lifts the heaviest King-size mattresses.'
      }
    ];

    benefits.forEach(b => {
      html += '<div style="display:flex; gap:16px; align-items:flex-start; padding-bottom:16px; border-bottom:1px solid var(--color-border);">';
      html += '<span style="color:var(--color-primary); font-size:1.25rem; font-weight:bold; line-height:1.2;">✓</span>';
      html += '<div>';
      html += '<h4 style="margin:0 0 6px 0; color:var(--color-heading); font-size:1.1rem; font-weight:600;">' + b.title + '</h4>';
      html += '<p style="margin:0; color:var(--color-muted); font-size:0.9375rem; line-height:1.5;">' + b.desc + '</p>';
      html += '</div>';
      html += '</div>';
    });

    html += '</div>';
    html += '</div>';

    // Care Instructions
    html += '<div>';
    html += '<h3 style="margin-bottom:16px; font-size:1.4rem; color:var(--color-heading);">Care & Storage</h3>';
    html += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">';
    const careItems = ['Wipe clean with a damp cloth', 'Store flat or hang by the handle slot', 'Keep away from high heat', 'Avoid chemical cleaning agents'];
    careItems.forEach(c => {
      html += '<div style="background:var(--color-surface); padding:16px; border-radius:6px; display:flex; gap:12px; align-items:center; border:1px solid var(--color-border);">';
      html += '<span style="color:var(--color-primary); font-size:1rem;">●</span>';
      html += '<span style="font-size:0.875rem; color:var(--color-text); font-weight:500;">' + c + '</span>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    html += '</div></div>';
    return html;
  }

  return '';
}

// ===== Thai variant generation =====
const TH_PUBLIC_DIR = path.join(ROOT, 'public', 'th', 'product');

// Generic Thai FAQ block for non-marine customizable products.
// 4 standard questions matching the EN template; links rewritten to /th/...
const TH_FAQ_BLOCK = `<details class="faq-item" open>
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

// Thai FAQ block for marine products (V-Berth sheets + marine mattress protector).
const TH_MARINE_FAQ_BLOCK = `<details class="faq-item" open>
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

// Marine product slugs that should receive the marine-specific FAQ block.
const MARINE_SLUGS = new Set(['marine-fitted-sheet', 'marine-top-sheet', 'marine-mattress-protector']);

// Thai chrome word substitutions (mirrors functions/_middleware.ts Thai locale pass).
// These are applied to the static HTML so the chrome is Thai even though the file is static.
const TH_CHROME_REPLACEMENTS = [
  // Desktop nav
  ['"nav-link">Shop</a>', '"nav-link">สินค้า</a>'],
  ['"nav-link">Fabrics</a>', '"nav-link">เนื้อผ้า</a>'],
  ['"nav-link">Size Guide</a>', '"nav-link">คู่มือขนาด</a>'],
  ['"nav-link">Blog</a>', '"nav-link">บทความ</a>'],
  // Mobile drawer nav (no class)
  ['<a href="/products/?">Shop</a>', '<a href="/products/">สินค้า</a>'],
  ['<a href="/fabric/?">Fabrics</a>', '<a href="/fabric/">เนื้อผ้า</a>'],
  ['<a href="/sizeguide/?">Size Guide</a>', '<a href="/sizeguide/">คู่มือขนาด</a>'],
  ['<a href="/blogs/?">Blog</a>', '<a href="/blogs/">บทความ</a>'],
  // Sign in / Cart
  ['>Sign In<', '>เข้าสู่ระบบ<'],
  // Footer headings
  ['>Quick Links</h3>', '>ลิงก์ด่วน</h3>'],
  ['>Customer Service</h3>', '>บริการลูกค้า</h3>'],
  ['>FAQ</h3>', '>คำถามที่พบบ่อย</h3>'],
  ['>Size Guide</h3>', '>คู่มือขนาด</h3>'],
  ['>Blog</h3>', '>บทความ</h3>'],
  ['>Shop With Us</h3>', '>สั่งซือกับเรา</h3>'],
  ['>Contact</h3>', '>ติดต่อเรา</h3>'],
  // Footer links
  ['>About Us</a>', '>เกี่ยอบกับเรา</a>'],
  ['>Contact Us</a>', '>ติดต่อเรา</a>'],
  ['>Reviews</a>', '>รีวิว</a>'],
  ['>FAQ</a>', '>คำถามที่พบบ่อย</a>'],
  ['>Privacy Policy</a>', '>นโยบายความเป็นส่วนตัว</a>'],
  ['>Returns &amp; Delivery</a>', '>การคืนสินค้าและการจัดส่ง</a>'],
  // Breadcrumb category labels (matches {{BREADCRUMB_CATEGORY_LABEL}} substitution)
  ['>Fitted Sheets<', '>ผ้าปูที่นอนรัดมุม<'],
  ['>Pillowcases<', '>ปลอกหมอน<'],
  ['>Protection<', '>ผลิตภัณฑ์ปกป้อง<'],
  ['>Duvet Covers<', '>ปลอกผ้าห่ม<'],
  ['>Sheets<', '>ผ้าปูที่นอน<']
];

// Pick the best Thai title for a product. Some products.json entries store
// nameTh as plain Thai text, others store double-mojibake UTF-8 bytes that need
// a Latin-1 round-trip to recover. If we can't recover readable Thai, fall back
// to the English name with a "(Thai)" suffix so the page is still distinct.
function pickThaiTitle(raw, fallbackName) {
  if (!raw) return fallbackName + ' (Thai)';
  // Heuristic: a clean Thai string should be dominated by Thai script or ASCII.
  // Anything containing classic Latin-1-of-UTF-8 markers (Ã Â â € etc.) is
  // almost certainly mojibake; recover it via Latin-1 round-trip and check
  // whether the result actually decodes to Thai script. If not, fall back.
  const looksLikeMojibake = /[\u00c2\u00c3\u00c4\u00c5\u00e2\u20ac]/.test(raw);
  if (!looksLikeMojibake && /[\u0e00-\u0e7f]/.test(raw)) {
    return normalizeMojibake(raw);
  }
  try {
    const recovered = Buffer.from(raw, 'latin1').toString('utf8');
    if (/[\u0e00-\u0e7f]/.test(recovered)) {
      return normalizeMojibake(recovered);
    }
  } catch (_) { /* fall through */ }
  // Fall back to the English name. Adding "(Thai)" suffix keeps the title
  // distinguishable from the EN page while preserving SEO routing.
  return fallbackName + ' (Thai)';
}

// Apply Thai chrome replacements and tag the document lang=th, plus add canonical hreflang.
function buildThaiFor(enHtml, slug, prod) {
  const fallbackName = prod.name || slug;
  const titleForThai = pickThaiTitle(prod.nameTh, fallbackName);

  let html = enHtml;

  // 1. Set lang="th" on html and inject Sarabun font fallback near head
  html = html
    .replace(/<html lang="en">/i, '<html lang="th">')
    .replace('<link href="/css/fonts.css?v=2" rel="stylesheet">', '<link href="/css/fonts.css?v=2" rel="stylesheet">')
    .replace(/<link href="\/css\/fonts\.css" rel="stylesheet">/i, '<link href="/css/fonts.css?v=2" rel="stylesheet">');

  // 2. Title: prefer recoverable Thai title; otherwise EN + (Thai)
  html = html.replace(
    /<title>[^<]*<\/title>/,
    '<title>' + titleForThai + ' \u2014 MildMate</title>'
  );

  // 3. Add canonical + alternate hreflang
  const canonical = '<link rel="canonical" href="https://www.mildmate.com/th/product/' + slug + '/">';
  const altEn = '<link rel="alternate" hreflang="en" href="https://www.mildmate.com/product/' + slug + '/">';
  const altTh = '<link rel="alternate" hreflang="th" href="https://www.mildmate.com/th/product/' + slug + '/">';
  // Insert canonical before </head> (only if not already present)
  if (!html.includes('rel="canonical"') && html.indexOf('</head>') !== -1) {
    html = html.replace('</head>', '  ' + canonical + '\n  ' + altEn + '\n  ' + altTh + '\n</head>');
  }

  // 4. Apply Thai chrome word substitutions
  for (const pair of TH_CHROME_REPLACEMENTS) {
    html = html.split(pair[0]).join(pair[1]);
  }

  // 5. Inject Thai FAQ block. The Pages Function will override this with D1's
  // faq_th when one is set, so this acts as the default for any product that
  // doesn't have a hand-curated Thai FAQ in D1.
  const faqBlock = MARINE_SLUGS.has(slug) ? TH_MARINE_FAQ_BLOCK : TH_FAQ_BLOCK;
  // Match the entire <div class="info-panel" id="info-panel-faq">...</div> block.
  // Captures: opening div tag (group 1), inner contents (group 2), closing div tags (group 3).
  const faqPanelRe = /(<div\s+class="info-panel"\s+id="info-panel-faq"[^>]*>)([\s\S]*?)(<\/div>\s*<\/div>)/i;
  if (faqPanelRe.test(html)) {
    html = html.replace(faqPanelRe, (_m, open, _inner, close) => open + '\n          ' + faqBlock + '\n        ' + close);
  }

  // 6. Rewrite FAQ internal links to /th/ paths for TH variant.
  // (Other internal links in nav/footer are already handled by middleware + chrome rewrites.)
  html = html
    .replace(/href="\/sizeguide\/(?![a-z])/g, 'href="/th/sizeguide/')
    .replace(/href="\/contact\/(?![a-z])/g, 'href="/th/contact/')
    .replace(/href="\/products\/(?![a-z])/g, 'href="/th/products/');

  return html;
}

// ===== MAIN BUILD =====
console.log('Building product pages...');
let builtCount = 0;
let builtThCount = 0;

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

  if (type === 'marine') {
    outHtml = buildMarine(slug, p, prod);
  } else if (type === 'fixed') {
    outHtml = buildFixed(slug, p, prod);
  } else {
    outHtml = buildCustomizable(slug, p, prod);
  }

  // Write EN output
  const outDir = path.join(PUBLIC_DIR, slug);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, 'index.html');
  fs.writeFileSync(outPath, outHtml, 'utf8');
  console.log('  BUILT: ' + slug + ' â†’ ' + outPath);
  builtCount++;

  // Write TH output (mirror dir under public/th/product/{slug}/)
  const thHtml = buildThaiFor(outHtml, slug, prod);
  const thDir = path.join(TH_PUBLIC_DIR, slug);
  if (!fs.existsSync(thDir)) {
    fs.mkdirSync(thDir, { recursive: true });
  }
  const thPath = path.join(thDir, 'index.html');
  fs.writeFileSync(thPath, thHtml, 'utf8');
  console.log('  BUILT (TH): ' + slug + ' â†’ ' + thPath);
  builtThCount++;
});

console.log('\nDone! Built ' + builtCount + ' EN product pages and ' + builtThCount + ' TH product pages.');
