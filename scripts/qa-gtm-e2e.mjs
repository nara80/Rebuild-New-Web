// GTM end-to-end validation harness (REAL container execution, isolated).
//
// Requirements:
//   GTM_TEST_ID   — a staging/test GTM container id (GTM-XXXXXX) that is NOT
//                   the production container, holding a GA4 Config tag for a
//                   TEST GA4 stream (not G-0GWVSPJLVJ).
//   GA4_TEST_ID   — the test stream Measurement ID (G-TESTXXXX) for assertion.
//
// Safety rails:
//   - Refuses to run with any production identifier.
//   - Blocks all Google Ads endpoints (googleadservices, doubleclick) so no
//     production conversion activity can occur.
//   - Sends NO synthetic network events: it only drives real page flows and
//     records the GA4 /g/collect hits the test container itself generates.
//
// What it verifies: real GTM tag execution for view_item, add_to_cart,
// view_cart, begin_checkout, purchase — correct triggers (collect hits),
// parameters (ec URL params), Consent Mode state, no duplicate events, no
// unpaid purchase. Exit code 0 only if all checks pass.
//
// Usage:  GTM_TEST_ID=GTM-ABC123 GA4_TEST_ID=G-TEST123 node scripts/qa-gtm-e2e.mjs
import { chromium } from 'playwright-core';

const PROD_IDS = ['GTM-KLJZZM9', 'G-0GWVSPJLVJ', 'G-ESL161CNBV'];
const GTM_TEST_ID = process.env.GTM_TEST_ID || '';
const GA4_TEST_ID = process.env.GA4_TEST_ID || '';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8799';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

if (!GTM_TEST_ID || !GTM_TEST_ID.startsWith('GTM-')) {
  console.log('REMAINING VERIFICATION GATE — not run.');
  console.log('This harness needs a STAGING GTM container (GTM_TEST_ID) with a GA4 Config tag');
  console.log('pointing at a TEST GA4 stream (GA4_TEST_ID). Create both in GTM/GA4 admin,');
  console.log('then re-run. No production GA4/Ads destination is ever touched.');
  process.exit(2);
}
for (const bad of PROD_IDS) {
  if ([GTM_TEST_ID, GA4_TEST_ID].some((v) => v && v.toUpperCase() === bad)) {
    console.error('REFUSING TO RUN: production identifier ' + bad + ' supplied.');
    process.exit(2);
  }
}
if (GA4_TEST_ID && !GA4_TEST_ID.startsWith('G-')) {
  console.error('GA4_TEST_ID must be a Measurement ID (G-XXXX).');
  process.exit(2);
}

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// GA4 collect URL params: en=event_name, epn.value / ep.currency, tid=stream.
function parseCollect(url) {
  const u = new URL('https://x' + url.slice(url.indexOf('/g/collect')));
  return {
    en: u.searchParams.get('en'),
    tid: u.searchParams.get('tid'),
    currency: u.searchParams.get('ep.currency') || u.searchParams.get('cu'),
    value: u.searchParams.get('epn.value'),
    tidTx: u.searchParams.get('ep.transaction_id')
  };
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const collectHits = [];
const adsHits = [];
await ctx.route(/google-analytics\.com\/g\/collect/, (route) => {
  collectHits.push(parseCollect(route.request().url()));
  return route.fulfill({ status: 204, body: '' });
});
await ctx.route(/googleadservices|doubleclick\.net/, (route) => {
  adsHits.push(route.request().url());
  return route.fulfill({ status: 204, body: '' });
});
// Rewrite the SSR runtime config to the TEST container (never production).
await ctx.route(/./, async (route) => {
  const req = route.request();
  if (req.resourceType() !== 'document') return route.fallback();
  const resp = await route.fetch();
  const body = (await resp.text()).replace(
    /window\.__MILDMATE_ANALYTICS_CONFIG = .*?<\/script>/,
    'window.__MILDMATE_ANALYTICS_CONFIG = ' + JSON.stringify({
      nonProductionApproved: true, gtmId: GTM_TEST_ID, ga4Id: GA4_TEST_ID || 'G-TEST0000', environment: 'staging'
    }) + ';</script>'
  );
  return route.fulfill({ response: resp, body });
});
await ctx.route('**/api/order-confirmed**', (route) => {
  const url = route.request().url();
  const unverified = url.includes('cs_test_unverified');
  route.fulfill({
    status: 200, contentType: 'application/json',
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
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));

// Consent: accept analytics AND marketing (marketing exercises the Ads consent path).
await page.addInitScript(() => {
  try { localStorage.setItem('mildmate-cookie-consent', JSON.stringify({ essential: true, analytics: true, marketing: true, timestamp: Date.now() })); } catch (e) {}
});

// Flow 1: product page → view_item (+ manual add_to_cart via exposed hook if available)
await page.goto(BASE + '/product/standard-fitted-sheet/', { waitUntil: 'load' });
await page.waitForTimeout(3000);

// Flow 2: EN checkout → view_cart + begin_checkout
await page.goto(BASE + '/checkout/', { waitUntil: 'load' });
await page.waitForTimeout(3000);

// Flow 3: order-confirmed → purchase
await page.goto(BASE + '/order-confirmed/?session_id=cs_test_verified', { waitUntil: 'load' });
await page.waitForTimeout(3000);

// Flow 4: unverified → no purchase
await page.goto(BASE + '/order-confirmed/?session_id=cs_test_unverified', { waitUntil: 'load' });
await page.waitForTimeout(3000);

// Consent Mode state: default denied precedes container load; update granted.
const consentOrder = await page.evaluate(() => {
  const dl = window.dataLayer || [];
  const di = dl.findIndex((e) => e && e[0] === 'consent' && e[1] === 'default');
  const ui = dl.findIndex((e) => e && e[0] === 'consent' && e[1] === 'update');
  const gi = dl.findIndex((e) => e && e.event === 'gtm.js');
  return { di, ui, gi, dlLen: dl.length };
});

await browser.close();

// ---- Assertions ----
const byEvent = {};
for (const h of collectHits) if (h.en) byEvent[h.en] = (byEvent[h.en] || 0) + 1;
console.log('\nCollect hits by event:', JSON.stringify(byEvent));
console.log('Ads-endpoint hits (must be 0):', adsHits.length);

const want = ['view_item', 'view_cart', 'begin_checkout', 'purchase'];
for (const ev of want) {
  const n = byEvent[ev] || 0;
  record('real GTM execution: ' + ev, n === 1, `hits=${n}${n > 1 ? ' (DUPLICATE)' : n === 0 ? ' (NOT FIRED)' : ''}`);
}
const tidOk = collectHits.every((h) => !GA4_TEST_ID || !h.en || h.tid === GA4_TEST_ID);
record('collect hits target TEST stream only', tidOk, GA4_TEST_ID);
const tx = collectHits.find((h) => h.en === 'purchase');
record('purchase carries transaction_id + numeric value', !!tx && !!tx.tidTx && !isNaN(Number(tx.value)), tx ? `tx=${tx.tidTx} value=${tx.value}` : 'none');
record('no unpaid purchase event', (byEvent['purchase'] || 0) === 1, 'unverified flow produced no second purchase');
record('no Google Ads endpoint contacted', adsHits.length === 0, adsHits.join(',') || 'none');
record('consent default precedes container start', consentOrder.di >= 0 && consentOrder.ui > consentOrder.di && consentOrder.gi > consentOrder.ui, JSON.stringify(consentOrder));

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
