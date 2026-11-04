// Reconciles the variant manifest against the audit inventory and prod API refs,
// verifies variant completeness, and optionally prunes unreferenced variant files.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const variantsRoot = path.join(ROOT, 'public', 'images', 'products', 'variants');
const manifestPath = path.join(variantsRoot, 'manifest.json');
const auditCsvPath = path.join(ROOT, '00_Issue', 'product-image-performance-audit-20261103', 'IMAGE_ASSET_INVENTORY.csv');
const outPath = path.join(ROOT, '00_Issue', 'product-image-performance-audit-20261103', 'full-catalog-20261103', 'variant-reconciliation.json');
const doPrune = process.argv.includes('--prune');

function parseCsvLine(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
      continue;
    }
    if (ch === ',' && !inQuotes) { row.push(current); current = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (current !== '' || row.length) { row.push(current); rows.push(row); row = []; current = ''; }
      continue;
    }
    current += ch;
  }
  if (current !== '' || row.length) { row.push(current); rows.push(row); }
  return rows;
}

function pathnameOf(ref) {
  try {
    const u = new URL(ref, 'https://www.mildmate.com');
    return (u.pathname || '').replace(/\/+/g, '/').replace(/\/$/, '');
  } catch { return ''; }
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const entries = manifest.entries || [];
const manifestPathnames = new Set(entries.map((e) => e.pathname));
const manifestKeys = new Set(entries.map((e) => e.variant_key));

// 1) Audit CSV coverage
const csvRows = parseCsvLine(fs.readFileSync(auditCsvPath, 'utf8'));
const header = csvRows[0];
const urlIdx = header.indexOf('asset_url');
const auditUrls = Array.from(new Set(csvRows.slice(1).map((r) => (r[urlIdx] || '').trim()).filter(Boolean)));
const auditImageUrls = auditUrls.filter((u) => /\.(jpe?g|png|webp|avif)(\?|$)/i.test(u));
const auditNonImage = auditUrls.filter((u) => !/\.(jpe?g|png|webp|avif)(\?|$)/i.test(u));
const auditMissing = auditImageUrls.filter((u) => !manifestPathnames.has(pathnameOf(u)));

// 2) Prod API coverage, including co-sleeping-top-sheet detail
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8')).products || [];
const slugs = products.map((p) => p.slug).filter(Boolean);
const apiMissing = [];
const perSlug = {};
slugs.forEach((slug) => {
  const run = spawnSync('curl.exe', ['-fsSL', `https://www.mildmate.com/api/products/${slug}`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (run.status !== 0 || !run.stdout) { perSlug[slug] = { error: 'fetch-failed' }; return; }
  let product;
  try { product = JSON.parse(run.stdout); product = product.product || product; } catch { perSlug[slug] = { error: 'bad-json' }; return; }
  let imgs = product.images;
  if (typeof imgs === 'string') { try { imgs = JSON.parse(imgs); } catch { imgs = []; } }
  if (!Array.isArray(imgs)) imgs = [];
  const refs = [product.image_url, ...imgs].filter((u) => u && typeof u === 'string' && u.trim());
  const missing = refs.filter((u) => !manifestPathnames.has(pathnameOf(u)));
  perSlug[slug] = { ref_count: refs.length, missing_count: missing.length, missing };
  missing.forEach((m) => apiMissing.push({ slug, url: m }));
});

// 3) Variant file completeness per manifest entry
const incomplete = [];
entries.forEach((e) => {
  Object.entries(e.variants || {}).forEach(([profile, info]) => {
    const abs = path.join(ROOT, 'public', info.path.replace(/^\//, '').replace(/\//g, path.sep));
    if (!fs.existsSync(abs) || fs.statSync(abs).size === 0) {
      incomplete.push({ key: e.variant_key, profile, path: info.path });
    }
  });
});

// 4) Unreferenced variant files on disk
const stale = [];
['thumbs', 'slides', 'related'].forEach((dir) => {
  const dirPath = path.join(variantsRoot, dir);
  if (!fs.existsSync(dirPath)) return;
  fs.readdirSync(dirPath).forEach((f) => {
    if (!/\.webp$/i.test(f)) return;
    const key = f.replace(/(-640|-960|-480)?\.webp$/i, '');
    if (!manifestKeys.has(key)) stale.push(`${dir}/${f}`);
  });
});

let pruned = 0;
if (doPrune) {
  stale.forEach((rel) => {
    try { fs.unlinkSync(path.join(variantsRoot, rel.replace(/\//g, path.sep))); pruned++; } catch {}
  });
}

const report = {
  generated_at: new Date().toISOString(),
  manifest_source_count: entries.length,
  manifest_variant_version: manifest.variant_version || '',
  audit: {
    audit_asset_urls: auditUrls.length,
    audit_image_urls: auditImageUrls.length,
    audit_non_image_urls: auditNonImage.length,
    audit_non_image_examples: auditNonImage.slice(0, 10),
    audit_images_missing_from_manifest: auditMissing.length,
    audit_missing_examples: auditMissing.slice(0, 20)
  },
  prod_api: {
    slugs_checked: slugs.length,
    slugs_with_missing_refs: apiMissing.length,
    missing: apiMissing,
    co_sleeping_top_sheet: perSlug['co-sleeping-top-sheet'] || null,
    deep_pocket_fitted_sheet: perSlug['deep-pocket-fitted-sheet'] || null
  },
  variant_files: {
    incomplete_count: incomplete.length,
    incomplete: incomplete.slice(0, 20),
    stale_unreferenced_count: stale.length,
    stale_examples: stale.slice(0, 10),
    pruned
  }
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({
  manifest_sources: entries.length,
  audit_images_missing_from_manifest: auditMissing.length,
  api_missing_refs: apiMissing.length,
  co_sleeping: report.prod_api.co_sleeping_top_sheet,
  incomplete_variants: incomplete.length,
  stale_files: stale.length,
  pruned
}, null, 2));
console.log('Wrote:', outPath);
