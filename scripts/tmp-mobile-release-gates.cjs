const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const base = process.argv[2];
const outPath = process.argv[3];
const host = (() => {
  try { return new URL(base).hostname.toLowerCase(); } catch { return ''; }
})();
const expectProdAnalytics = host === 'www.mildmate.com' || host === 'mildmate.com';

if (!base || !outPath) {
  console.error('Usage: node tmp-mobile-release-gates.cjs <baseUrl> <outJsonPath>');
  process.exit(1);
}

function nowTag() {
  return Date.now() + '-' + Math.floor(Math.random() * 1e6);
}

async function clickConsent(page) {
  const directIds = ['#cookie-btn-accept', '#cookie-modal-accept-all', '#cookie-btn-reject', '#cookie-modal-save'];
  for (const sel of directIds) {
    try {
      const el = page.locator(sel);
      if (await el.count()) {
        await el.first().click({ timeout: 1500 });
        return true;
      }
    } catch {}
  }
  for (const rx of [/accept all|ยอมรับทั้งหมด/i, /save preferences|บันทึกการตั้งค่า/i, /essential only|เฉพาะที่จำเป็น/i]) {
    try {
      const b = page.getByRole('button', { name: rx });
      if (await b.count()) {
        await b.first().click({ timeout: 1500 });
        return true;
      }
    } catch {}
  }
  return false;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

async function collectDataLayerEvents(page) {
  return page.evaluate(() => {
    const raw = Array.isArray(window.dataLayer) ? window.dataLayer : [];
    const names = [];
    for (const entry of raw) {
      if (!entry) continue;
      if (Array.isArray(entry) && entry[0] === 'event' && typeof entry[1] === 'string') {
        names.push(entry[1]);
      } else if (entry && typeof entry === 'object' && typeof entry.event === 'string') {
        names.push(entry.event);
      }
    }
    return names;
  });
}

async function runConsentGate(browser, pagePath) {
  const context = await browser.newContext({ viewport: { width: 390, height: 1800 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const gtmRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('request', (req) => {
    if (req.url().includes('googletagmanager.com/gtm.js')) {
      gtmRequests.push(req.url());
    }
  });

  const url = `${base}${pagePath}?gate=${nowTag()}`;
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1800);

  const before = await page.evaluate(() => ({
    analyticsLoaded: window.__mildmateAnalyticsLoaded === true,
    dataLayerLen: Array.isArray(window.dataLayer) ? window.dataLayer.length : 0
  }));
  const beforeGtmReq = gtmRequests.length;

  const clicked = await clickConsent(page);
  await page.waitForTimeout(2200);

  await page.click('body', { position: { x: 20, y: 20 } }).catch(() => {});
  await page.waitForTimeout(1200);

  const after = await page.evaluate(() => {
    const dl = Array.isArray(window.dataLayer) ? window.dataLayer : [];
    const gtmStartEvents = dl.filter((e) => e && typeof e === 'object' && e.event === 'gtm.js').length;
    return {
      analyticsLoaded: window.__mildmateAnalyticsLoaded === true,
      dataLayerLen: dl.length,
      gtmStartEvents
    };
  });
  const afterGtmReq = gtmRequests.length;

  const pass = expectProdAnalytics
    ? (beforeGtmReq === 0 && afterGtmReq === 1 && after.analyticsLoaded === true && after.gtmStartEvents === 1)
    : (beforeGtmReq === 0 && afterGtmReq === 0 && after.analyticsLoaded === false && after.gtmStartEvents === 0);

  await page.close();
  await context.close();
  return {
    gate: 'consent_basic_mode_v2',
    pagePath,
    status: resp ? resp.status() : null,
    consentClicked: clicked,
    before,
    after,
    gtmRequestsBeforeConsent: beforeGtmReq,
    gtmRequestsAfterConsent: afterGtmReq,
    consoleErrorCount: consoleErrors.length,
    consoleErrors: consoleErrors.slice(0, 10),
    expectProdAnalytics,
    pass
  };
}

async function runCushionQuoteGate(browser, pagePath) {
  const context = await browser.newContext({ viewport: { width: 390, height: 2200 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.route('**/api/quote', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, quote_id: 'QT-RELEASE-GATE-TEST' })
    });
  });

  const url = `${base}${pagePath}?gate=${nowTag()}`;
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1800);
  await clickConsent(page);
  await page.waitForTimeout(1200);

  const tabCustom = page.locator('#tab-custom');
  if (await tabCustom.count()) await tabCustom.first().click({ timeout: 3000 });
  await page.waitForTimeout(300);

  const fill = async (sel, val) => {
    const loc = page.locator(sel);
    if (!(await loc.count())) return false;
    await loc.first().fill('');
    await loc.first().type(String(val), { delay: 10 });
    return true;
  };
  const dimW = await fill('#dim-width', '60');
  const dimL = await fill('#dim-length', '120');
  const dimD = await fill('#dim-depth', '12');
  await page.waitForTimeout(700);

  const customPrice = (await page.locator('#custom-price').first().textContent().catch(() => ''))?.trim() || '';
  await page.locator('#add-to-cart').first().click({ timeout: 3000 });
  await page.waitForTimeout(500);

  const quoteOverlayOpen = await page.evaluate(() => {
    const el = document.querySelector('#quote-overlay');
    if (!el) return false;
    return el.classList.contains('open');
  });

  await fill('#qf-name', 'Release Gate');
  await fill('#qf-email', 'release-gate@example.com');

  await page.evaluate(() => {
    const form = document.querySelector('#quote-form');
    if (!form) return;
    let token = form.querySelector('input[name="cf-turnstile-response"]');
    if (!token) {
      token = document.createElement('input');
      token.type = 'hidden';
      token.name = 'cf-turnstile-response';
      form.appendChild(token);
    }
    token.value = 'release-gate-token';
  });

  await page.locator('#qf-submit').first().click({ timeout: 3000 });
  await page.waitForTimeout(1200);

  const events = uniq(await collectDataLayerEvents(page));
  const quoteEventsPresent = events.includes('quote_request') && events.includes('generate_lead');
  const viewItemPresent = events.includes('view_item');

  const imgAudit = await page.evaluate(() => {
    const thumbs = Array.from(document.querySelectorAll('#carousel-thumbs img'));
    const thumbDataSrc = thumbs.map((el) => el.getAttribute('data-src') || '').filter(Boolean);
    const thumbFallback = thumbs.map((el) => el.getAttribute('data-fallback') || '').filter(Boolean);
    const perf = performance.getEntriesByType('resource').map((r) => r.name);
    return {
      thumbCount: thumbs.length,
      thumbWebpDataSrcCount: thumbDataSrc.filter((s) => /\.webp(\?|$)/i.test(s)).length,
      thumbFallbackCount: thumbFallback.length,
      thumbRequests: perf.filter((u) => u.includes('/thumbs/') && u.includes('.webp')).length,
      mainImageSrc: (document.querySelector('#gallery-main-img') || {}).src || '',
      hasMainImage: !!document.querySelector('#gallery-main-img')
    };
  });

  const pass = !!resp && resp.status() === 200
    && dimW && dimL && dimD
    && customPrice && customPrice !== '—'
    && quoteOverlayOpen
    && quoteEventsPresent
    && viewItemPresent
    && imgAudit.thumbFallbackCount > 0
    && imgAudit.thumbRequests >= 1;

  await page.close();
  await context.close();
  return {
    gate: 'cushion_quote_gallery_webp',
    pagePath,
    status: resp ? resp.status() : null,
    customPrice,
    dimensionsFilled: { dimW, dimL, dimD },
    quoteOverlayOpen,
    events,
    quoteEventsPresent,
    viewItemPresent,
    imgAudit,
    consoleErrorCount: consoleErrors.length,
    consoleErrors: consoleErrors.slice(0, 10),
    pass
  };
}

async function runStandardCartCheckoutGate(browser, pagePath) {
  const context = await browser.newContext({ viewport: { width: 390, height: 1900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  const url = `${base}${pagePath}?gate=${nowTag()}`;
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1800);
  await clickConsent(page);
  await page.waitForTimeout(1200);

  const size = page.locator('#size-select');
  let sizeChosen = false;
  if (await size.count()) {
    const val = await size.first().evaluate((el) => {
      const opts = Array.from(el.options || []);
      const usable = opts.find((o) => o.value && o.value !== 'custom');
      return usable ? usable.value : '';
    });
    if (val) {
      await size.first().selectOption(val);
      sizeChosen = true;
    }
  }
  await page.waitForTimeout(700);

  let addClicked = false;
  const addBtn = page.locator('#add-to-cart');
  if (await addBtn.count()) {
    try {
      await addBtn.first().click({ timeout: 3000 });
      addClicked = true;
    } catch {}
  }
  await page.waitForTimeout(800);

  const events = uniq(await collectDataLayerEvents(page));
  const addToCartPresent = events.includes('add_to_cart');
  const viewItemPresent = events.includes('view_item');

  const cartInfo = await page.evaluate(() => {
    let count = 0;
    let parsed = null;
    try {
      parsed = JSON.parse(localStorage.getItem('mildmate-cart') || '{"items":[]}');
      count = Array.isArray(parsed.items) ? parsed.items.length : 0;
    } catch {}
    return { itemCount: count };
  });

  await page.goto(`${base}/checkout/?gate=${nowTag()}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1800);
  const checkoutSmoke = await page.evaluate(() => ({
    hasCheckoutShell: !!document.querySelector('.checkout-page, .checkout-wrap, #checkout-root, main'),
    hasProceedButton: !!document.querySelector('button, .btn, [type="submit"]')
  }));

  const pass = !!resp && resp.status() === 200
    && sizeChosen
    && addClicked
    && viewItemPresent
    && addToCartPresent
    && cartInfo.itemCount > 0
    && checkoutSmoke.hasCheckoutShell;

  await page.close();
  await context.close();
  return {
    gate: 'standard_add_to_cart_checkout',
    pagePath,
    status: resp ? resp.status() : null,
    sizeChosen,
    addClicked,
    events,
    viewItemPresent,
    addToCartPresent,
    cartInfo,
    checkoutSmoke,
    consoleErrorCount: consoleErrors.length,
    consoleErrors: consoleErrors.slice(0, 10),
    pass
  };
}

async function runPurchaseTrackingGate(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 1800 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.route('**/api/order-confirmed?*', async (route) => {
    const body = {
      pending: false,
      payment_verified: true,
      purchase_reportable: true,
      purchase_reportable_value: 49.99,
      session_amount_total: 5499,
      session_id: 'cs_test_release_gate',
      orders: [
        {
          status: 'confirmed',
          quote_id: 'QT-RELEASE-GATE-ORDER',
          product_slug: 'standard-fitted-sheet',
          product_title_en: 'Standard Fitted Sheet',
          quantity: 1,
          price_usd: 49.99,
          price_thb: 1700,
          email: 'release-gate@example.com'
        }
      ]
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  const url = `${base}/order-confirmed/?session_id=cs_test_release_gate&gate=${nowTag()}`;
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(3200);

  const events = uniq(await collectDataLayerEvents(page));
  const purchasePresent = events.includes('purchase');

  const pass = !!resp && resp.status() === 200 && purchasePresent;

  await page.close();
  await context.close();
  return {
    gate: 'purchase_tracking_logic_mocked',
    status: resp ? resp.status() : null,
    events,
    purchasePresent,
    consoleErrorCount: consoleErrors.length,
    consoleErrors: consoleErrors.slice(0, 10),
    pass
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    results.push(await runConsentGate(browser, '/product/standard-fitted-sheet/'));
    results.push(await runConsentGate(browser, '/th/product/standard-fitted-sheet/'));
    results.push(await runCushionQuoteGate(browser, '/product/custom-waterproof-cushion-protector/'));
    results.push(await runCushionQuoteGate(browser, '/th/product/custom-waterproof-cushion-protector/'));
    results.push(await runStandardCartCheckoutGate(browser, '/product/standard-fitted-sheet/'));
    results.push(await runStandardCartCheckoutGate(browser, '/th/product/standard-fitted-sheet/'));
    results.push(await runPurchaseTrackingGate(browser));

    const failed = results.filter((r) => !r.pass).map((r) => r.gate);
    const report = {
      generatedAt: new Date().toISOString(),
      base,
      expectProdAnalytics,
      pass: failed.length === 0,
      failedGates: failed,
      results
    };

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify({ pass: report.pass, failedGates: report.failedGates, outPath }, null, 2));
  } finally {
    await browser.close();
  }
})();
