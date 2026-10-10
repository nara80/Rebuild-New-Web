// QA browser integration matrix (local-only; never touches production GA4/Ads).
// Drives the wrangler pages dev server on 127.0.0.1:8799 with system Edge.
// GTM network calls are intercepted (staging IDs) and never reach Google.
import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:8799';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const STAGE = { nonProductionApproved: true, gtmId: 'GTM-LOCALTEST', ga4Id: 'G-LOCALTEST', environment: 'staging' };

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function newPage(browser, { config = STAGE, consent = null, viewport = { width: 1280, height: 800 } } = {}) {
  const ctx = await browser.newContext({ viewport });
  const gtmRequests = [];
  // Rewrite the SSR-injected runtime analytics config (registered first -> lowest precedence)
  // so local documents resolve to the staging config instead of the safe preview default.
  await ctx.route(/./, async (route) => {
    const req = route.request();
    if (req.resourceType() !== 'document') return route.fallback();
    const resp = await route.fetch();
    const body = (await resp.text()).replace(
      /window\.__MILDMATE_ANALYTICS_CONFIG = .*?<\/script>/,
      'window.__MILDMATE_ANALYTICS_CONFIG = ' + JSON.stringify(config) + ';</script>'
    );
    return route.fulfill({ response: resp, body });
  });
  await ctx.route(/googletagmanager\.com\//, (route) => {
    gtmRequests.push(route.request().url());
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* intercepted */' });
  });
  await ctx.route(/\/api\/order-confirmed/, (route) => {
    const url = route.request().url();
    const unverified = url.includes('cs_test_unverified');
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(unverified ? {
        pending: false, payment_verified: false, purchase_reportable: false,
        session_id: 'cs_test_unverified', orders: [{ status: 'confirmed', product_title_en: 'X', price_usd: 10, quantity: 1 }]
      } : {
        pending: false, payment_verified: true, purchase_reportable: true,
        session_id: 'cs_test_verified', purchase_reportable_value: 100,
        orders: [{ status: 'confirmed', product_title_en: 'X', price_usd: 100, quantity: 1 }]
      })
    });
  });
  const page = await ctx.newPage();
  await page.addInitScript(({ config, consent }) => {
    if (config) window.__MILDMATE_ANALYTICS_CONFIG = config;
    if (consent) {
      try { localStorage.setItem('mildmate-cookie-consent', JSON.stringify(consent)); } catch (e) {}
    }
  }, { config, consent });
  return { ctx, page, gtmRequests };
}

async function dataLayerEvents(page) {
  return page.evaluate(() => (window.dataLayer || [])
    .filter((e) => e && typeof e === 'object' && e.event)
    .map((e) => e.event));
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
try {
  // 1. Consent granted (pre-set) on EN homepage -> GTM loads with staging ID exactly once.
  {
    const { ctx, page, gtmRequests } = await newPage(browser, {
      consent: { essential: true, analytics: true, timestamp: Date.now() }
    });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const evts = await dataLayerEvents(page);
    record('granted: GTM script requested', gtmRequests.length === 1 && gtmRequests[0].includes('GTM-LOCALTEST'), gtmRequests.join(',') || 'none');
    record('granted: gtm.js in dataLayer', evts.includes('gtm.js'), evts.join(','));
    record('granted: no consent banner', !(await page.locator('#cookie-banner').isVisible().catch(() => false)));
    await ctx.close();
  }

  // 2. Consent denied via banner click -> no GTM request at all.
  {
    const { ctx, page, gtmRequests } = await newPage(browser, {});
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#cookie-banner', { timeout: 8000 });
    record('denied: banner visible', await page.locator('#cookie-banner').isVisible());
    await page.click('#cookie-btn-reject');
    await page.waitForTimeout(1500);
    const evts = await dataLayerEvents(page);
    record('denied: zero GTM requests', gtmRequests.length === 0, gtmRequests.join(',') || 'none');
    record('denied: consent_update pushed, no gtm.js', evts.includes('mildmate_consent_update') && !evts.includes('gtm.js'), evts.join(','));
    await ctx.close();
  }

  // 3. Accept via banner on TH homepage, mobile viewport -> GTM loads, banner hides.
  {
    const { ctx, page, gtmRequests } = await newPage(browser, { viewport: { width: 390, height: 844 } });
    await page.goto(BASE + '/th/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#cookie-banner', { timeout: 8000 });
    await page.click('#cookie-btn-accept');
    await page.waitForTimeout(1500);
    const evts = await dataLayerEvents(page);
    record('th-mobile accept: GTM requested once with staging ID', gtmRequests.length === 1 && gtmRequests[0].includes('GTM-LOCALTEST'), gtmRequests.join(',') || 'none');
    record('th-mobile accept: banner hidden', !(await page.locator('#cookie-banner').isVisible().catch(() => false)));
    record('th-mobile accept: consent_update + gtm.js', evts.includes('mildmate_consent_update') && evts.includes('gtm.js'), evts.join(','));
    await ctx.close();
  }

  // 4. Product page with consent pre-granted -> view_item contract push present.
  {
    const { ctx, page, gtmRequests } = await newPage(browser, {
      consent: { essential: true, analytics: true, timestamp: Date.now() }
    });
    await page.goto(BASE + '/product/standard-fitted-sheet/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const events = await page.evaluate(() => (window.dataLayer || []).filter((e) => e && e.event === 'view_item'));
    const ok = events.length === 1
      && events[0].eventModel && Array.isArray(events[0].eventModel.items)
      && events[0].ecommerce === events[0].eventModel;
    record('product: view_item eventModel+ecommerce contract', ok, JSON.stringify(events[0] || null).slice(0, 200));
    await ctx.close();
  }

  // 5. Order-confirmed: verified+reportable mock -> purchase pushed with transaction_id.
  {
    const { ctx, page } = await newPage(browser, {
      consent: { essential: true, analytics: true, timestamp: Date.now() }
    });
    await page.goto(BASE + '/order-confirmed/?session_id=cs_test_verified', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const purchase = await page.evaluate(() => (window.dataLayer || []).find((e) => e && e.event === 'purchase'));
    record('order-confirmed: purchase pushed', !!purchase, JSON.stringify(purchase || null).slice(0, 220));
    record('order-confirmed: transaction_id + numeric value', !!purchase && purchase.eventModel.transaction_id === 'cs_test_verified' && typeof purchase.eventModel.value === 'number' && purchase.eventModel.value > 0,
      purchase ? `value=${purchase.eventModel.value}` : '');
    await ctx.close();
  }

  // 6. Order-confirmed: unverified payment -> NO purchase push.
  {
    const { ctx, page } = await newPage(browser, {
      consent: { essential: true, analytics: true, timestamp: Date.now() }
    });
    await page.goto(BASE + '/order-confirmed/?session_id=cs_test_unverified', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const purchase = await page.evaluate(() => (window.dataLayer || []).find((e) => e && e.event === 'purchase'));
    record('order-confirmed: unverified purchase suppressed', !purchase, purchase ? 'LEAKED' : 'no purchase event');
    await ctx.close();
  }

  // 7. Isolation: non-production host + production IDs in override -> blocked, no GTM.
  {
    const { ctx, page, gtmRequests } = await newPage(browser, {
      config: { nonProductionApproved: true, gtmId: 'GTM-KLJZZM9', ga4Id: 'G-0GWVSPJLVJ' },
      consent: { essential: true, analytics: true, timestamp: Date.now() }
    });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const evts = await dataLayerEvents(page);
    record('isolation: prod IDs blocked on localhost', gtmRequests.length === 0 && !evts.includes('gtm.js'), gtmRequests.join(',') || 'none');
    await ctx.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
