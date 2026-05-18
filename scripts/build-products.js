/**
 * MildMate Product Catalog Builder
 * 
 * Reads data/products.json and generates:
 *   - public/products/index.html        (EN shop page)
 *   - public/th/products/index.html    (TH shop page)
 *   - public/<niche>/index.html         (EN niche pages)
 *   - public/th/<niche>/index.html       (TH niche pages)
 *   - public/<type>/index.html           (EN type pages)
 *   - public/th/<type>/index.html        (TH type pages)
 * 
 * Usage: node scripts/build-products.js
 * 
 * TAG RULES (derived from data-categories):
 *   - Primary type tag first (SHEETS, DUVET-COVERS, PILLOWCASES, PROTECTION, ACCESSORIES)
 *   - Then niche tags (MARINE, FAMILY, PETS, DEEP-POCKET, BOARDING-DORM, RV-TRUCK)
 *   - No DUVET tag on Pillowcase-only cards
 *   - Niche pages only show products that have that niche in their categories
 */

const fs = require('fs');
const path = require('path');

// ─── Load catalog ───────────────────────────────────────────────
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/products.json'), 'utf8'));

// ─── Helpers ──────────────────────────────────────────────────────
const TYPES = catalog.types;
const NICHES = catalog.niches;

function getPrimaryType(categories) {
  for (const type of Object.keys(TYPES)) {
    if (categories.includes(type)) return type;
  }
  return null;
}

function getNiches(categories) {
  return categories.filter(c => NICHES[c]);
}

function buildDataCategories(categories) {
  return categories.join(',');
}

function buildCardTags(product) {
  const cats = product.categories;
  const primaryType = getPrimaryType(cats);
  const niches = getNiches(cats);
  const tags = [];
  if (primaryType) tags.push(TYPES[primaryType].tag);
  for (const n of niches) {
    tags.push(NICHES[n].tag);
  }
  return tags;
}

// ─── Generate EN product card HTML ───────────────────────────────
function buildEnCard(product) {
  const tags = buildCardTags(product);
  const tagHtml = tags.map(t => `<span class="card-tag">${t}</span>`).join('');
  const priceNote = 'Excludes shipping, tax &amp; tariff';
  return `          <article class="product-card" data-categories="${buildDataCategories(product.categories)}">
            <div class="product-image">
              <img src="${product.image}" alt="${product.name}" width="800" height="600" loading="lazy" decoding="async">
            </div>
            <div class="product-info">
              <div class="product-tags" aria-label="Categories">${tagHtml ? `<span class="card-tag">${tags[0]}</span>` : ''}${tags.slice(1).map(t => `<span class="card-tag">${t}</span>`).join('')}</div>
              <h3 class="product-title">${product.name}</h3>
              <div class="product-price" data-usd="${product.priceUsd}" data-thb="${product.priceThb}">From $${product.priceUsd.toFixed(2)}</div>
              <div class="product-price-note">${priceNote}</div>
              <a href="${product.url}" class="btn btn-primary">View Options</a>
            </div>
          </article>`;
}

// ─── Generate TH product card HTML ───────────────────────────────
function buildThCard(product) {
  const tags = buildCardTags(product);
  const priceNote = 'ไม่รวมค่าจัดส่งและภาษีนำเข้า';
  return `          <article class="product-card" data-categories="${buildDataCategories(product.categories)}">
            <div class="product-image">
              <img src="${product.image}" alt="${product.nameTh}" width="800" height="600" loading="lazy" decoding="async">
            </div>
            <div class="product-info">
              <div class="product-tags" aria-label="Categories">${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div>
              <h3 class="product-title">${product.nameTh}</h3>
              <div class="product-price" data-usd="${product.priceUsd}" data-thb="${product.priceThb}">฿${product.priceThb}</div>
              <div class="product-price-note">${priceNote}</div>
              <a href="${product.urlTh}" class="btn btn-primary">ดูตัวเลือก</a>
            </div>
          </article>`;
}

// ─── Generate EN niche listing card ─────────────────────────────
function buildEnNicheCard(product) {
  const tags = buildCardTags(product);
  const priceNote = 'Excludes shipping, tax &amp; tariff';
  return `              <article class="listing-card"><div class="card-image"><img src="${product.image}" alt="${product.name}" width="800" height="600" loading="lazy" decoding="async"></div><div class="card-body"><div class="card-tags">${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div><h3 class="card-title">${product.name}</h3><div class="card-price">From $${product.priceUsd.toFixed(2)}</div><div class="card-price-note">${priceNote}</div><div class="card-cta"><a href="${product.url}" class="btn btn-primary">View Options</a></div></div></article>`;
}

// ─── Generate TH niche listing card ─────────────────────────────
function buildThNicheCard(product) {
  const tags = buildCardTags(product);
  const priceNote = 'ไม่รวมค่าจัดส่งและภาษีนำเข้า';
  return `              <article class="listing-card"><div class="card-image"><img src="${product.image}" alt="${product.nameTh}" width="800" height="600" loading="lazy" decoding="async"></div><div class="card-body"><div class="card-tags">${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div><h3 class="card-title">${product.nameTh}</h3><div class="card-price">฿${product.priceThb}</div><div class="card-price-note">${priceNote}</div><div class="card-cta"><a href="${product.urlTh}" class="btn btn-primary">ดูตัวเลือก</a></div></div></article>`;
}

// ─── Generate EN type page listing card ────────────────────────
function buildEnTypeCard(product) {
  const tags = buildCardTags(product);
  const priceNote = 'Excludes shipping, tax &amp; tariff';
  return `          <article class="listing-card" data-categories="${buildDataCategories(product.categories)}">
            <div class="card-image">
              <img src="${product.image}" alt="${product.name}" width="800" height="600" loading="lazy" decoding="async">
            </div>
            <div class="card-body">
              <div class="card-tags">${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div>
              <h3 class="card-title">${product.name}</h3>
              <div class="card-price">From $${product.priceUsd.toFixed(2)}</div>
              <div class="card-price-note">${priceNote}</div>
              <div class="card-cta"><a href="${product.url}" class="btn btn-primary">View Options</a></div>
            </div>
          </article>`;
}

// ─── Generate TH type page listing card ────────────────────────
function buildThTypeCard(product) {
  const tags = buildCardTags(product);
  const priceNote = 'ไม่รวมค่าจัดส่งและภาษีนำเข้า';
  return `          <article class="listing-card" data-categories="${buildDataCategories(product.categories)}">
            <div class="card-image">
              <img src="${product.image}" alt="${product.nameTh}" width="800" height="600" loading="lazy" decoding="async">
            </div>
            <div class="card-body">
              <div class="card-tags">${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div>
              <h3 class="card-title">${product.nameTh}</h3>
              <div class="card-price">฿${product.priceThb}</div>
              <div class="card-price-note">${priceNote}</div>
              <div class="card-cta"><a href="${product.urlTh}" class="btn btn-primary">ดูตัวเลือก</a></div>
            </div>
          </article>`;
}

// ─── Build /products/ EN page ────────────────────────────────────
function buildProductsEn() {
  const sections = {};
  const typeOrder = ['sheets', 'duvet-covers', 'pillowcases', 'protection', 'accessories'];
  for (const type of typeOrder) {
    const products = catalog.products.filter(p => p.categories.includes(type));
    if (products.length === 0) continue;
    const sectionLabel = `=== ${TYPES[type].name.toUpperCase()} ===`;
    const cards = products.map(p => buildEnCard(p)).join('\n');
    sections[type] = `${sectionLabel}\n${cards}`;
  }
  return catalog.products_en_template.replace('{{PRODUCT_CARDS}}', Object.values(sections).join('\n\n'));
}

// ─── Build /products/ TH page ───────────────────────────────────
function buildProductsTh() {
  const sections = {};
  const typeOrder = ['sheets', 'duvet-covers', 'pillowcases', 'protection', 'accessories'];
  for (const type of typeOrder) {
    const products = catalog.products.filter(p => p.categories.includes(type));
    if (products.length === 0) continue;
    const sectionLabel = `=== ${TYPES[type].name.toUpperCase()} ===`;
    const cards = products.map(p => buildThCard(p)).join('\n');
    sections[type] = `${sectionLabel}\n${cards}`;
  }
  return catalog.products_th_template.replace('{{PRODUCT_CARDS}}', Object.values(sections).join('\n\n'));
}

// ─── Build niche EN page ─────────────────────────────────────────
function buildNicheEn(nicheSlug) {
  const niche = NICHES[nicheSlug];
  const products = catalog.products.filter(p => p.categories.includes(nicheSlug));
  const cards = products.map(p => buildEnNicheCard(p)).join('\n    ');
  return catalog.niche_en_template
    .replace(/{{NICHE_NAME}}/g, niche.name)
    .replace(/{{NICHE_SLUG}}/g, nicheSlug)
    .replace('{{PRODUCT_CARDS}}', cards);
}

// ─── Build niche TH page ─────────────────────────────────────────
function buildNicheTh(nicheSlug) {
  const niche = NICHES[nicheSlug];
  const products = catalog.products.filter(p => p.categories.includes(nicheSlug));
  const cards = products.map(p => buildThNicheCard(p)).join('\n    ');
  return catalog.niche_th_template
    .replace(/{{NICHE_NAME}}/g, niche.name)
    .replace(/{{NICHE_SLUG}}/g, nicheSlug)
    .replace('{{PRODUCT_CARDS}}', cards);
}

// ─── Build type EN page ─────────────────────────────────────────
function buildTypeEn(typeSlug) {
  const type = TYPES[typeSlug];
  const products = catalog.products.filter(p => p.categories.includes(typeSlug));
  const cards = products.map(p => buildEnTypeCard(p)).join('\n\n');
  return catalog.type_en_template
    .replace(/{{TYPE_NAME}}/g, type.name)
    .replace(/{{TYPE_SLUG}}/g, typeSlug)
    .replace('{{PRODUCT_CARDS}}', cards);
}

// ─── Build type TH page ─────────────────────────────────────────
function buildTypeTh(typeSlug) {
  const type = TYPES[typeSlug];
  const products = catalog.products.filter(p => p.categories.includes(typeSlug));
  const cards = products.map(p => buildThTypeCard(p)).join('\n\n');
  return catalog.type_th_template
    .replace(/{{TYPE_NAME}}/g, type.name)
    .replace(/{{TYPE_SLUG}}/g, typeSlug)
    .replace('{{PRODUCT_CARDS}}', cards);
}

// ─── Load templates (stored at top of this file via heredoc) ─────
const templates = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/templates.json'), 'utf8'));
Object.assign(catalog, templates);

// ─── Run ──────────────────────────────────────────────────────────
const outDir = path.join(__dirname, '../public');
const outThDir = path.join(__dirname, '../public/th');

// EN products
fs.writeFileSync(path.join(outDir, 'products/index.html'), buildProductsEn(), 'utf8');
console.log('Generated: public/products/index.html');

// TH products
fs.writeFileSync(path.join(outThDir, 'products/index.html'), buildProductsTh(), 'utf8');
console.log('Generated: public/th/products/index.html');

// Niche pages
for (const nicheSlug of Object.keys(NICHES)) {
  fs.writeFileSync(path.join(outDir, `${nicheSlug}/index.html`), buildNicheEn(nicheSlug), 'utf8');
  console.log(`Generated: public/${nicheSlug}/index.html`);
  fs.writeFileSync(path.join(outThDir, `${nicheSlug}/index.html`), buildNicheTh(nicheSlug), 'utf8');
  console.log(`Generated: public/th/${nicheSlug}/index.html`);
}

// Type pages
for (const typeSlug of Object.keys(TYPES)) {
  fs.writeFileSync(path.join(outDir, `${typeSlug}/index.html`), buildTypeEn(typeSlug), 'utf8');
  console.log(`Generated: public/${typeSlug}/index.html`);
  fs.writeFileSync(path.join(outThDir, `${typeSlug}/index.html`), buildTypeTh(typeSlug), 'utf8');
  console.log(`Generated: public/th/${typeSlug}/index.html`);
}

console.log('\nAll pages generated successfully!');
