/**
 * MildMate Product Catalog Regenerator
 * 
 * HOW IT WORKS:
 *   1. Reads data/products.json (the SINGLE SOURCE OF TRUTH)
 *   2. For each product, derives:
 *      - data-categories  (from categories array)
 *      - card tags        (primary type FIRST, then niche tags)
 *      - which pages the card appears on (type page + each niche page)
 *   3. Replaces ONLY the <!-- GENERATED_PRODUCTS --> markers in existing pages
 *   4. Leaves all other page content (hero, descriptions, forms, footer) untouched
 * 
 * TAG RULES:
 *   - Primary type tag FIRST: SHEETS, DUVET-COVERS, PILLOWCASES, PROTECTION, ACCESSORIES
 *   - Then niche tags: MARINE, FAMILY, PETS, DEEP-POCKET, BOARDING-DORM, RV-TRUCK
 *   - No DUVET tag on Pillowcase cards (niche pages show PILLOWCASES + niche tag)
 *   - /pillowcases/ page: only PILLOWCASES tag (no niche tags, no DUVET)
 * 
 * TO ADD A NEW PRODUCT:
 *   1. Add entry to data/products.json
 *   2. Add image to public/images/products/<slug>/main.jpg
 *   3. Run: node scripts/regenerate-products.js
 *   4. All pages auto-update — cards, tags, data-categories, filter dropdown
 * 
 * USAGE: node scripts/regenerate-products.js
 */

const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────
const CATALOG_PATH = path.join(__dirname, '../data/products.json');
const PUBLIC_DIR = path.join(__dirname, '../public');
const TH_DIR = path.join(__dirname, '../public/th');

// ─── Type + Niche metadata ────────────────────────────────────────
const TYPES = {
  sheets:       { tag: 'SHEETS',       label: 'Sheets',       dropdownValue: 'sheets' },
  'duvet-covers':{ tag: 'DUVET-COVERS', label: 'Duvet Covers',  dropdownValue: 'duvet-covers' },
  pillowcases:  { tag: 'PILLOWCASES', label: 'Pillowcases',  dropdownValue: 'pillowcases' },
  protection:   { tag: 'PROTECTION',   label: 'Protection',   dropdownValue: 'protection' },
  accessories:  { tag: 'ACCESSORIES',  label: 'Accessories',  dropdownValue: 'accessories' },
};

const NICHES = {
  marine:        { tag: 'MARINE',        label: 'Marine & Yacht' },
  family:        { tag: 'FAMILY',       label: 'Family & Co-Sleep' },
  pets:          { tag: 'PETS',          label: 'Pet Owner' },
  'deep-pocket': { tag: 'DEEP-POCKET',   label: 'Deep Pocket' },
  'boarding-dorm':{ tag: 'BOARDING-DORM', label: 'Boarding Dorm' },
  'rv-truck':    { tag: 'RV-TRUCK',      label: 'RV & Truck Cab' },
};

// ─── Load catalog ─────────────────────────────────────────────────
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

// ─── Helpers ──────────────────────────────────────────────────────
function getPrimaryType(categories) {
  return categories.find(c => TYPES[c]) || null;
}

function getNiches(categories) {
  return categories.filter(c => NICHES[c]);
}

function buildDataCategories(categories) {
  return categories.join(',');
}

function buildCardTags(categories) {
  const primary = getPrimaryType(categories);
  const nicheList = getNiches(categories);
  const tags = [];
  if (primary) tags.push(TYPES[primary].tag);
  nicheList.forEach(n => tags.push(NICHES[n].tag));
  return tags;
}

function tagHtml(tags) {
  return tags.map(t => `<span class="card-tag">${t}</span>`).join('');
}

// ─── Build EN product-card HTML (for /products/) ─────────────────
function buildEnProductCard(product) {
  const tags = buildCardTags(product.categories);
  const dataCats = buildDataCategories(product.categories);
  return `          <article class="product-card" data-categories="${dataCats}">
            <div class="product-image">
              <img src="${product.image}" alt="${product.name}" width="800" height="600" loading="lazy" decoding="async">
            </div>
            <div class="product-info">
              <div class="product-tags" aria-label="Categories">${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div>
              <h3 class="product-title">${product.name}</h3>
              <div class="product-price" data-usd="${product.priceUsd}" data-thb="${product.priceThb}">From $${product.priceUsd.toFixed(2)}</div>
              <div class="product-price-note">Excludes shipping, tax &amp; tariff</div>
              <a href="${product.url}" class="btn btn-primary">View Options</a>
            </div>
          </article>`;
}

// ─── Build TH product-card HTML (for /th/products/) ──────────────
function buildThProductCard(product) {
  const tags = buildCardTags(product.categories);
  const dataCats = buildDataCategories(product.categories);
  return `          <article class="product-card" data-categories="${dataCats}">
            <div class="product-image">
              <img src="${product.image}" alt="${product.nameTh}" width="800" height="600" loading="lazy" decoding="async">
            </div>
            <div class="product-info">
              <div class="product-tags" aria-label="Categories">${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div>
              <h3 class="product-title">${product.nameTh}</h3>
              <div class="product-price" data-usd="${product.priceUsd}" data-thb="${product.priceThb}">฿${product.priceThb}</div>
              <div class="product-price-note">ไม่รวมค่าจัดส่งและภาษีนำเข้า</div>
              <a href="${product.urlTh}" class="btn btn-primary">ดูตัวเลือก</a>
            </div>
          </article>`;
}

// ─── Build EN niche listing card (niche pages only) ─────────────
function buildEnListingCard(product, nicheSlug) {
  const primaryType = getPrimaryType(product.categories);
  const tags = [];
  if (primaryType) tags.push(TYPES[primaryType].tag);
  tags.push(NICHES[nicheSlug].tag);
  return `              <article class="listing-card"><div class="card-image"><img src="${product.image}" alt="${product.name}" width="800" height="600" loading="lazy" decoding="async"></div><div class="card-body"><div class="card-tags">${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div><h3 class="card-title">${product.name}</h3><div class="card-price">From $${product.priceUsd.toFixed(2)}</div><div class="card-price-note">Excludes shipping, tax &amp; tariff</div><div class="card-cta"><a href="${product.url}" class="btn btn-primary">View Options</a></div></div></article>`;
}

// ─── Build TH niche listing card (niche pages only) ─────────────
function buildThListingCard(product, nicheSlug) {
  const primaryType = getPrimaryType(product.categories);
  const tags = [];
  if (primaryType) tags.push(TYPES[primaryType].tag);
  tags.push(NICHES[nicheSlug].tag);
  return `              <article class="listing-card"><div class="card-image"><img src="${product.image}" alt="${product.nameTh}" width="800" height="600" loading="lazy" decoding="async"></div><div class="card-body"><div class="card-tags">${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div><h3 class="card-title">${product.nameTh}</h3><div class="card-price">฿${product.priceThb}</div><div class="card-price-note">ไม่รวมค่าจัดส่งและภาษีนำเข้า</div><div class="card-cta"><a href="${product.urlTh}" class="btn btn-primary">ดูตัวเลือก</a></div></div></article>`;
}

// ─── Build EN type page listing-card HTML ──────────────────────
function buildEnTypeCard(product, pageType) {
  const tags = buildCardTags(product.categories);
  const dataCats = buildDataCategories(product.categories);
  // For /pillowcases/ page: only show PILLOWCASES tag (no niche tags, no DUVET)
  const displayTags = (pageType === 'type-page-pillowcases')
    ? [TYPES.pillowcases.tag]
    : tags;
  return `          <article class="listing-card" data-categories="${dataCats}">
            <div class="card-image">
              <img src="${product.image}" alt="${product.name}" width="800" height="600" loading="lazy" decoding="async">
            </div>
            <div class="card-body">
              <div class="card-tags">${displayTags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div>
              <h3 class="card-title">${product.name}</h3>
              <div class="card-price">From $${product.priceUsd.toFixed(2)}</div>
              <div class="card-price-note">Excludes shipping, tax &amp; tariff</div>
              <div class="card-cta"><a href="${product.url}" class="btn btn-primary">View Options</a></div>
            </div>
          </article>`;
}

// ─── Build TH type page listing-card HTML ──────────────────────
function buildThTypeCard(product, pageType) {
  const tags = buildCardTags(product.categories);
  const dataCats = buildDataCategories(product.categories);
  // For /th/pillowcases/ page: only show PILLOWCASES tag (no niche tags, no DUVET)
  const displayTags = (pageType === 'type-page-pillowcases')
    ? [TYPES.pillowcases.tag]
    : tags;
  return `          <article class="listing-card" data-categories="${dataCats}">
            <div class="card-image">
              <img src="${product.image}" alt="${product.nameTh}" width="800" height="600" loading="lazy" decoding="async">
            </div>
            <div class="card-body">
              <div class="card-tags">${displayTags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div>
              <h3 class="card-title">${product.nameTh}</h3>
              <div class="card-price">฿${product.priceThb}</div>
              <div class="card-price-note">ไม่รวมค่าจัดส่งและภาษีนำเข้า</div>
              <div class="card-cta"><a href="${product.urlTh}" class="btn btn-primary">ดูตัวเลือก</a></div>
            </div>
          </article>`;
}

// ─── Inject into page file ────────────────────────────────────────
// Finds the product/listing grid div and replaces its content
// Works for both /products/ (product-grid) and niche/type pages (listing-grid)
function injectCards(filePath, newContent) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Try to find the grid opening tag (various forms)
  let gridStart = -1;
  let patterns = [
    '<div class="product-grid"',
    '<div class="listing-grid"',
  ];
  
  for (const p of patterns) {
    const idx = content.indexOf(p);
    if (idx !== -1) { gridStart = idx; break; }
  }
  
  if (gridStart === -1) {
    console.log(`  ✗ NO GRID FOUND: ${filePath}`);
    return false;
  }
  
  // Count opening and closing divs from grid start
  // When openDivs returns to 0, we've found the grid's closing </div>
  const afterOpen = content.substring(gridStart);
  let openDivs = 0;
  let endIdx = 0;
  
  for (let i = 0; i < afterOpen.length; i++) {
    const c = afterOpen[i];
    if (c === '<') {
      if (afterOpen.substring(i).startsWith('<div') && !afterOpen.substring(i + 4).trim().startsWith('>')) {
        // Only count opening divs that are complete (<div ...>)
        const rest = afterOpen.substring(i);
        if (/^<div[^>]*>/.test(rest)) {
          openDivs++;
        }
      } else if (afterOpen.substring(i).startsWith('</div')) {
        openDivs--;
      }
    }
    if (openDivs === 0 && endIdx === 0 && afterOpen.substring(i).startsWith('</div>')) {
      endIdx = i + 6;
      break;
    }
  }
  
  if (endIdx === 0) {
    console.log(`  ✗ COULD NOT FIND GRID END: ${filePath}`);
    return false;
  }
  
  const fullEnd = gridStart + endIdx;
  content = content.substring(0, gridStart) + newContent + content.substring(fullEnd);
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

// ─── Generate and inject all pages ──────────────────────────────
const generated = [];

function genAndWrite(targetFile, lang, pageType, pageKey) {
  // Skip non-existent files
  if (!fs.existsSync(targetFile)) {
    console.log(`  ○ SKIP (not found): ${path.relative(PUBLIC_DIR, targetFile)}`);
    return;
  }

  let filteredProducts;
  
  if (pageType === 'products') {
    filteredProducts = catalog.products;
  } else if (pageType === 'type-page-pillowcases') {
    filteredProducts = catalog.products.filter(p => p.categories.includes('pillowcases'));
  } else if (pageType === 'type-page') {
    filteredProducts = catalog.products.filter(p => p.categories.includes(pageKey));
  } else if (pageType === 'niche-page') {
    filteredProducts = catalog.products.filter(p => p.categories.includes(pageKey));
  } else {
    filteredProducts = catalog.products;
  }

  if (filteredProducts.length === 0) {
    console.log(`  (no products for ${pageKey})`);
    return;
  }

  const cards = filteredProducts.map(p => {
    if (lang === 'en') {
      if (pageType === 'products') return buildEnProductCard(p);
      if (pageType === 'type-page-pillowcases') return buildEnTypeCard(p, pageType);
      if (pageType === 'type-page') return buildEnTypeCard(p, pageType);
      return buildEnListingCard(p, pageKey);  // pageKey = nicheSlug for niche pages
    } else {
      if (pageType === 'products') return buildThProductCard(p);
      if (pageType === 'type-page-pillowcases') return buildThTypeCard(p, pageType);
      if (pageType === 'type-page') return buildThTypeCard(p, pageType);
      return buildThListingCard(p, pageKey);  // pageKey = nicheSlug for niche pages
    }
  });

  const gridOpen = (pageType === 'products' || pageType === 'type-page' || pageType === 'type-page-pillowcases')
    ? `<div class="product-grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:24px;">`
    : `<div class="listing-grid">`;
  const gridClose = `        </div>`;
  const block = '\n' + gridOpen + '\n' + cards.join('\n\n') + '\n' + gridClose + '\n      ';

  const success = injectCards(targetFile, block);
  if (success) {
    generated.push({ file: targetFile, count: filteredProducts.length });
    console.log(`  ✓ ${path.relative(PUBLIC_DIR, targetFile)} (${filteredProducts.length} cards)`);
  } else {
    console.log(`  ✗ FAILED: ${targetFile}`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────
console.log('\n🔧 MildMate Product Catalog Regenerator');
console.log('='.repeat(50));
console.log(`📦 Catalog: ${catalog.products.length} products\n`);

// EN products/
genAndWrite(path.join(PUBLIC_DIR, 'products/index.html'), 'en', 'products');

// TH products/
genAndWrite(path.join(TH_DIR, 'products/index.html'), 'th', 'products');

// Niche pages
for (const nicheSlug of Object.keys(NICHES)) {
  genAndWrite(path.join(PUBLIC_DIR, `${nicheSlug}/index.html`), 'en', 'niche-page', nicheSlug);
  genAndWrite(path.join(TH_DIR, `${nicheSlug}/index.html`), 'th', 'niche-page', nicheSlug);
}

// Type pages (pillowcases is special: only PILLOWCASES tag, no niche tags)
genAndWrite(path.join(PUBLIC_DIR, 'pillowcases/index.html'), 'en', 'type-page-pillowcases', 'pillowcases');
genAndWrite(path.join(TH_DIR, 'pillowcases/index.html'), 'th', 'type-page-pillowcases', 'pillowcases');

for (const typeSlug of ['sheets', 'duvet-covers', 'protection', 'accessories']) {
  genAndWrite(path.join(PUBLIC_DIR, `${typeSlug}/index.html`), 'en', 'type-page', typeSlug);
  genAndWrite(path.join(TH_DIR, `${typeSlug}/index.html`), 'th', 'type-page', typeSlug);
}

// ─── Summary ───────────────────────────────────────────────────────
const total = generated.reduce((sum, f) => sum + f.count, 0);
console.log(`\n✅ ${generated.length} pages updated, ${total} cards generated`);

// ─── Verify data-categories in /products/ ─────────────────────────
console.log('\n🔍 Filter consistency check:');
const filterMap = {
  sheets: catalog.products.filter(p => p.categories.includes('sheets')).length,
  'duvet-covers': catalog.products.filter(p => p.categories.includes('duvet-covers')).length,
  pillowcases: catalog.products.filter(p => p.categories.includes('pillowcases')).length,
  protection: catalog.products.filter(p => p.categories.includes('protection')).length,
  accessories: catalog.products.filter(p => p.categories.includes('accessories')).length,
  marine: catalog.products.filter(p => p.categories.includes('marine')).length,
  family: catalog.products.filter(p => p.categories.includes('family')).length,
  pets: catalog.products.filter(p => p.categories.includes('pets')).length,
  'deep-pocket': catalog.products.filter(p => p.categories.includes('deep-pocket')).length,
  'boarding-dorm': catalog.products.filter(p => p.categories.includes('boarding-dorm')).length,
  'rv-truck': catalog.products.filter(p => p.categories.includes('rv-truck')).length,
};

for (const [filter, count] of Object.entries(filterMap)) {
  console.log(`  ${filter.padEnd(14)} → ${count} products`);
}
