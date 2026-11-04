const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const outDir = path.join(ROOT, '00_Issue', 'product-image-performance-audit-20261103', 'full-catalog-20261103', 'lighthouse-bench');
const previewBase = process.argv[2] || 'https://catalog-image-variants-20261.mildmate-new.pages.dev';
const runsPerPage = Number(process.argv[3] || 3);
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const environments = [
  { key: 'before_prod', base: 'https://www.mildmate.com' },
  { key: 'after_preview', base: previewBase.replace(/\/+$/, '') }
];

const pages = [
  { family: 'customizable', lang: 'en', path: '/product/standard-fitted-sheet/' },
  { family: 'customizable', lang: 'th', path: '/th/product/standard-fitted-sheet/' },
  { family: 'marine', lang: 'en', path: '/product/marine-fitted-sheet/' },
  { family: 'marine', lang: 'th', path: '/th/product/marine-fitted-sheet/' },
  { family: 'fixed', lang: 'en', path: '/product/bedbridge-connector/' },
  { family: 'fixed', lang: 'th', path: '/th/product/bedbridge-connector/' }
];

function ms(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

function extractMetrics(json) {
  const audits = json.audits || {};
  const resourceSummary = (((audits['resource-summary'] || {}).details || {}).items || []);
  const imageRow = resourceSummary.find((row) => row && row.resourceType === 'image') || {};
  const reqDetails = ((audits['network-requests'] || {}).details || {}).items || [];
  return {
    score: Math.round(((json.categories || {}).performance || {}).score * 100),
    lcp_ms: ms((audits['largest-contentful-paint'] || {}).numericValue),
    cls: Number(((audits['cumulative-layout-shift'] || {}).numericValue || 0).toFixed(3)),
    total_bytes: Math.round((audits['total-byte-weight'] || {}).numericValue || 0),
    request_count: reqDetails.length || null,
    image_bytes: Math.round(imageRow.transferSize || 0),
    image_request_count: imageRow.requestCount || 0
  };
}

function average(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const p = Math.pow(10, digits);
  return Math.round(value * p) / p;
}

function readExistingRun(outFile) {
  try {
    if (!fs.existsSync(outFile)) return null;
    const json = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    const metrics = extractMetrics(json);
    if (!Number.isFinite(metrics.score)) return null;
    return metrics;
  } catch {
    return null;
  }
}

function runLighthouse(url, outFile) {
  // spawnSync on npx.cmd without a shell throws EINVAL on recent Node; use a single shell command string.
  const cmd = `npx --yes lighthouse "${url}" --only-categories=performance --emulated-form-factor=mobile --throttling-method=simulate --output=json --output-path="${outFile}" --quiet --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage"`;
  const maxAttempts = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch {}
    const run = spawnSync(cmd, { shell: true, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    if (run.status === 0 && fs.existsSync(outFile)) {
      try {
        const json = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        return extractMetrics(json);
      } catch (err) {
        lastError = err;
      }
    } else {
      lastError = new Error((run.stderr || run.stdout || 'unknown lighthouse failure').slice(0, 500));
    }
    console.warn(`[lighthouse] attempt ${attempt}/${maxAttempts} failed for ${url}: ${String(lastError.message || lastError).slice(0, 200)}`);
  }
  throw new Error(`Lighthouse failed for ${url} after ${maxAttempts} attempts: ${String(lastError && lastError.message)}`);
}

function metricDelta(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  return after - before;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const runs = [];
  for (const env of environments) {
    for (const page of pages) {
      const pageTag = `${page.family}-${page.lang}`.replace(/[^a-z0-9-]/gi, '-');
      for (let run = 1; run <= runsPerPage; run++) {
        const url = `${env.base}${page.path}`;
        const outFile = path.join(outDir, `${env.key}-${pageTag}-run${run}.json`);
        let metrics = readExistingRun(outFile);
        if (metrics) {
          console.log(`[lighthouse] reuse ${env.key} ${page.path} run ${run}/${runsPerPage} score=${metrics.score} lcp=${metrics.lcp_ms}ms`);
        } else {
          metrics = runLighthouse(url, outFile);
        }
        runs.push({
          env: env.key,
          base: env.base,
          family: page.family,
          lang: page.lang,
          path: page.path,
          run,
          url,
          out_file: outFile,
          metrics
        });
        console.log(`[lighthouse] done ${env.key} ${page.path} run ${run}/${runsPerPage} score=${metrics.score} lcp=${metrics.lcp_ms}ms`);
      }
    }
  }

  const groups = {};
  runs.forEach((item) => {
    const key = `${item.family}|${item.lang}|${item.path}`;
    if (!groups[key]) groups[key] = { family: item.family, lang: item.lang, path: item.path, before_prod: [], after_preview: [] };
    groups[key][item.env].push(item.metrics);
  });

  const summaryRows = Object.values(groups).map((group) => {
    const before = group.before_prod;
    const after = group.after_preview;
    const avg = (arr, field) => round(average(arr.map((m) => m[field])), field === 'cls' ? 3 : 1);
    const beforeAvg = {
      score: avg(before, 'score'),
      lcp_ms: avg(before, 'lcp_ms'),
      cls: avg(before, 'cls'),
      total_bytes: avg(before, 'total_bytes'),
      request_count: avg(before, 'request_count'),
      image_bytes: avg(before, 'image_bytes'),
      image_request_count: avg(before, 'image_request_count')
    };
    const afterAvg = {
      score: avg(after, 'score'),
      lcp_ms: avg(after, 'lcp_ms'),
      cls: avg(after, 'cls'),
      total_bytes: avg(after, 'total_bytes'),
      request_count: avg(after, 'request_count'),
      image_bytes: avg(after, 'image_bytes'),
      image_request_count: avg(after, 'image_request_count')
    };
    return {
      family: group.family,
      lang: group.lang,
      path: group.path,
      before_prod_avg: beforeAvg,
      after_preview_avg: afterAvg,
      delta: {
        score: round(metricDelta(beforeAvg.score, afterAvg.score), 1),
        lcp_ms: round(metricDelta(beforeAvg.lcp_ms, afterAvg.lcp_ms), 1),
        cls: round(metricDelta(beforeAvg.cls, afterAvg.cls), 3),
        total_bytes: round(metricDelta(beforeAvg.total_bytes, afterAvg.total_bytes), 1),
        request_count: round(metricDelta(beforeAvg.request_count, afterAvg.request_count), 1),
        image_bytes: round(metricDelta(beforeAvg.image_bytes, afterAvg.image_bytes), 1),
        image_request_count: round(metricDelta(beforeAvg.image_request_count, afterAvg.image_request_count), 1)
      }
    };
  });

  const report = {
    generated_at: new Date().toISOString(),
    preview_base: previewBase,
    runs_per_page: runsPerPage,
    pages,
    runs,
    summary: summaryRows
  };
  const outPath = path.join(outDir, 'summary.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('\nWrote lighthouse summary:', outPath);
}

main();
