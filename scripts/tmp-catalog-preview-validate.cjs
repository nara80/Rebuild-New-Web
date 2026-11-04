const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8')).products || [];
const baseUrl = process.argv[2] || 'https://catalog-image-variants-20261.mildmate-new.pages.dev';
const outDir = path.join(ROOT, '00_Issue', 'product-image-performance-audit-20261103', 'full-catalog-20261103');
const outPath = path.join(outDir, 'catalog-preview-validate.json');

function normalizeBase(url) {
  return String(url || '').replace(/\/+$/, '');
}

function toAbsolute(base, pagePath) {
  return normalizeBase(base) + pagePath;
}

function collectPaths() {
  const set = new Set();
  products.forEach((p) => {
    if (p && p.url) set.add(p.url);
    if (p && p.urlTh) set.add(p.urlTh);
  });
  return Array.from(set).sort();
}

async function clickConsent(page) {
  const selectors = [
    '#accept-cookies',
    '#cookie-accept',
    '[data-cookie-accept]',
    'button:has-text("Accept")',
    'button:has-text("ยอมรับ")'
  ];
  for (const selector of selectors) {
    const el = page.locator(selector).first();
    if (await el.count()) {
      try {
        if (await el.isVisible({ timeout: 250 })) {
          await el.click({ timeout: 500 });
          return;
        }
      } catch (_err) {
        // continue
      }
    }
  }
}

async function validatePage(context, url, pagePath) {
  const page = await context.newPage();
  const imageFailures = [];
  const requestFailures = [];
  const consoleErrors = [];
  page.on('response', async (response) => {
    try {
      const request = response.request();
      if (request.resourceType() !== 'image') return;
      if (response.status() >= 400) {
        imageFailures.push({ url: response.url(), status: response.status() });
      }
    } catch (_err) {
      // ignore
    }
  });
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'image') {
      requestFailures.push({ url: request.url(), reason: request.failure() ? request.failure().errorText : 'unknown' });
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  let status = null;
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    status = response ? response.status() : null;
    await clickConsent(page);
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const slideImgs = Array.from(document.querySelectorAll('#carousel-track img[data-src]'));
      slideImgs.slice(0, 8).forEach((img) => {
        if (img.dataset.srcset) img.setAttribute('srcset', img.dataset.srcset);
        if (img.dataset.sizes) img.setAttribute('sizes', img.dataset.sizes);
        if (img.dataset.src) img.setAttribute('src', img.dataset.src);
      });
      const thumbImgs = Array.from(document.querySelectorAll('.carousel-thumb img[data-src]'));
      thumbImgs.slice(0, 12).forEach((img) => {
        if (img.dataset.src) img.setAttribute('src', img.dataset.src);
      });
      const related = document.querySelector('.related-section');
      if (related) related.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(1400);

    const details = await page.evaluate(() => {
      const pickSrc = (img) => (img.currentSrc || img.getAttribute('src') || '').trim();
      const thumbs = Array.from(document.querySelectorAll('.carousel-thumb img')).map(pickSrc).filter(Boolean);
      const slides = Array.from(document.querySelectorAll('#carousel-track img')).map(pickSrc).filter(Boolean);
      const related = Array.from(document.querySelectorAll('.related-card img')).map(pickSrc).filter(Boolean);
      const broken = Array.from(document.images)
        .filter((img) => {
          if (!(img.complete && img.naturalWidth === 0)) return false;
          const srcAttr = (img.getAttribute('src') || '').trim();
          if (!srcAttr) return false;
          return true;
        })
        .map((img) => img.currentSrc || img.src || '');
      const nonData = (src) => src && !src.startsWith('data:');
      const nonYoutube = (src) => src.indexOf('img.youtube.com') === -1;
      const thumbComparable = thumbs.filter((src) => nonData(src) && nonYoutube(src));
      const relatedComparable = related.filter((src) => nonData(src) && nonYoutube(src));
      const slideComparable = slides.filter((src) => nonData(src) && nonYoutube(src));
      const thumbNonVariant = thumbComparable.filter((src) => src.indexOf('/images/products/variants/thumbs/') === -1);
      const relatedNonVariant = relatedComparable.filter((src) => src.indexOf('/images/products/variants/related/') === -1);
      const slideNonVariant = slideComparable.filter((src) => src.indexOf('/images/products/variants/slides/') === -1);
      const dimDiagram = document.querySelector('.dim-diagram img');
      return {
        pageTitle: document.title || '',
        thumbsTotal: thumbs.length,
        slidesTotal: slides.length,
        relatedTotal: related.length,
        thumbNonVariant,
        relatedNonVariant,
        slideNonVariant,
        broken,
        dimDiagramSrc: dimDiagram ? (dimDiagram.currentSrc || dimDiagram.getAttribute('src') || '') : ''
      };
    });

    const pass =
      status === 200 &&
      imageFailures.length === 0 &&
      requestFailures.length === 0 &&
      details.broken.length === 0 &&
      details.thumbNonVariant.length === 0 &&
      details.relatedNonVariant.length === 0 &&
      details.slideNonVariant.length === 0;

    return {
      path: pagePath,
      url,
      pass,
      status,
      imageFailures,
      requestFailures,
      consoleErrors: consoleErrors.slice(0, 12),
      details
    };
  } catch (err) {
    return {
      path: pagePath,
      url,
      pass: false,
      status,
      imageFailures,
      requestFailures,
      consoleErrors: consoleErrors.slice(0, 12),
      error: err && err.message ? err.message : String(err)
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const paths = collectPaths();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const results = [];
  for (let i = 0; i < paths.length; i++) {
    const pagePath = paths[i];
    const url = toAbsolute(baseUrl, pagePath);
    const result = await validatePage(context, url, pagePath);
    results.push(result);
    const state = result.pass ? 'PASS' : 'FAIL';
    console.log(`[${i + 1}/${paths.length}] ${state} ${pagePath}`);
  }
  await context.close();
  await browser.close();

  const failed = results.filter((r) => !r.pass);
  const summary = {
    base_url: normalizeBase(baseUrl),
    total_pages: results.length,
    passed_pages: results.length - failed.length,
    failed_pages: failed.length,
    failed_paths: failed.map((f) => f.path)
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        summary,
        results
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('\nValidation summary:', summary);
  console.log('Wrote:', outPath);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Fatal validation error:', err && err.message ? err.message : err);
  process.exit(1);
});
