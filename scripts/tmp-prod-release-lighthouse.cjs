const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const outDir = path.join(ROOT, '00_Issue', 'product-image-performance-audit-20261103', 'full-catalog-20261103', 'lighthouse-prod-release');
const base = 'https://www.mildmate.com';
const runs = 2;
const pages = [
  { tag: 'customizable-en', path: '/product/standard-fitted-sheet/' },
  { tag: 'customizable-th', path: '/th/product/standard-fitted-sheet/' },
  { tag: 'marine-en', path: '/product/marine-fitted-sheet/' },
  { tag: 'marine-th', path: '/th/product/marine-fitted-sheet/' },
  { tag: 'fixed-en', path: '/product/bedbridge-connector/' },
  { tag: 'fixed-th', path: '/th/product/bedbridge-connector/' }
];

function extract(json) {
  const a = json.audits || {};
  const img = ((((a['resource-summary'] || {}).details || {}).items) || []).find((r) => r.resourceType === 'image') || {};
  return {
    score: Math.round(((json.categories || {}).performance || {}).score * 100),
    lcp_ms: Math.round((a['largest-contentful-paint'] || {}).numericValue || 0),
    cls: Number(((a['cumulative-layout-shift'] || {}).numericValue || 0).toFixed(3)),
    total_bytes: Math.round((a['total-byte-weight'] || {}).numericValue || 0),
    image_bytes: Math.round(img.transferSize || 0)
  };
}

function runLh(url, outFile) {
  const cmd = `npx --yes lighthouse "${url}" --only-categories=performance --emulated-form-factor=mobile --throttling-method=simulate --output=json --output-path="${outFile}" --quiet --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage"`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch {}
    const run = spawnSync(cmd, { shell: true, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    if (run.status === 0 && fs.existsSync(outFile)) {
      try { return extract(JSON.parse(fs.readFileSync(outFile, 'utf8'))); } catch {}
    }
    console.warn(`attempt ${attempt} failed for ${url}`);
  }
  throw new Error('lighthouse failed: ' + url);
}

fs.mkdirSync(outDir, { recursive: true });
const results = [];
for (const page of pages) {
  for (let i = 1; i <= runs; i++) {
    const outFile = path.join(outDir, `${page.tag}-run${i}.json`);
    const m = runLh(`${base}${page.path}`, outFile);
    results.push({ tag: page.tag, path: page.path, run: i, ...m });
    console.log(`[prod-lh] ${page.tag} run${i} score=${m.score} lcp=${m.lcp_ms}ms imgKB=${Math.round(m.image_bytes / 1024)}`);
  }
}
const summary = pages.map((p) => {
  const rows = results.filter((r) => r.tag === p.tag);
  const avg = (f) => Math.round(rows.reduce((s, r) => s + r[f], 0) / rows.length);
  return { tag: p.tag, path: p.path, avg_score: avg('score'), avg_lcp_ms: avg('lcp_ms'), avg_total_bytes: avg('total_bytes'), avg_image_bytes: avg('image_bytes') };
});
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ generated_at: new Date().toISOString(), base, runs, results, summary }, null, 2), 'utf8');
console.log(JSON.stringify(summary, null, 1));
