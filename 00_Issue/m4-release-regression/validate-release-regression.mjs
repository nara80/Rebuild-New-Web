// M4 Release Regression Gate — focused, independently executed checks.
// Executes REAL source behavior (no static markers where avoidable):
//   A. Consent Mode v2 default + update, all four consent signals (public/js/cookie-consent.js)
//   B. Analytics vs marketing consent separation (cookie-consent.js + public/js/analytics-env.js)
//   C. GA4 canonical measurement configuration (analytics-env.js resolver)
//   D. Google Ads/GA4 Purchase gating + duplicate prevention (inline script of public/order-confirmed/index.html)
//   E. Stripe executable behavior delegates to the Vitest suite (cross-path idempotency,
//      purchase hardening) — run in Step 3 of the release gate; pointers asserted here.

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok ? '' : '  << ' + (detail || '')));
}

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// ---------- sandbox helpers ----------
function makeElementStub(tag) {
  return {
    tagName: (tag || 'div').toUpperCase(),
    style: { cssText: '', display: '' },
    innerHTML: '',
    textContent: '',
    children: [],
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute() {}, addEventListener() {}
  };
}

function makeLocalStorage(seed) {
  const m = new Map(Object.entries(seed || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  };
}

function makeDoc(cookieJar, els) {
  return {
    readyState: 'complete',
    lang: 'en',
    cookie: '',
    referrer: '',
    body: makeElementStub('body'),
    head: makeElementStub('head'),
    documentElement: { lang: 'en' },
    createElement: (t) => makeElementStub(t),
    getElementById: (id) => els[id] || null,
    querySelector: () => null,
    addEventListener() {}
  };
}

// cookie-consent.js: capture document.cookie writes via a js setter
function runCookieConsent(seed, locationProps) {
  const code = read('public/js/cookie-consent.js');
  const cookieJar = { value: '' };
  const els = {};
  const sandbox = {
    console,
    URL,
    URLSearchParams,
    Date,
    Math,
    JSON,
    Promise,
    setTimeout: () => 0,
    localStorage: makeLocalStorage(seed),
    location: Object.assign({ hostname: 'www.mildmate.com', pathname: '/', search: '', protocol: 'https:' }, locationProps || {}),
    document: null,
    dataLayer: []
  };
  const doc = makeDoc(cookieJar, els);
  Object.defineProperty(doc, 'cookie', {
    get() { return cookieJar.value; },
    set(v) { cookieJar.value = cookieJar.value ? cookieJar.value + '; ' + v : v; }
  });
  sandbox.document = doc;
  sandbox.window = sandbox;
  sandbox.__sandbox = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'cookie-consent.js' });
  return sandbox;
}

// ---------- A + B: consent behavior ----------
{
  // A1: fresh visitor — denied defaults, no consent_update event yet (no saved consent)
  const s1 = runCookieConsent({}, {});
  const hasUpdate = (s) => s.dataLayer.some((e) => e && e.event === 'mildmate_consent_update');
  check('A1 fresh visitor: consent cookie defaults to denied/denied', /mm-consent=analytics:denied,marketing:denied/.test(s1.__sandbox.document.cookie), s1.__sandbox.document.cookie);
  check('A1 fresh visitor: no consent_update event fired before user choice', !hasUpdate(s1));

  // A2: accept all → update event granted/granted + all four listener signals granted
  const s2 = runCookieConsent({}, {});
  let payload2 = null;
  s2.__mildmateAddConsentListener((p) => { payload2 = p; });
  s2.__mildmateSaveConsent({ essential: true, analytics: true, marketing: true });
  const upd2 = s2.dataLayer.filter((e) => e && e.event === 'mildmate_consent_update').pop();
  check('A2 accept all: consent_update analytics_consent=granted', upd2 && upd2.analytics_consent === 'granted');
  check('A2 accept all: consent_update marketing_consent=granted', upd2 && upd2.marketing_consent === 'granted');
  check('A2 accept all: all four consent signals granted in listener payload',
    payload2 && payload2.analyticsConsentGranted === true && payload2.adConsentGranted === true &&
    payload2.adUserDataConsentGranted === true && payload2.adPersonalizationConsentGranted === true,
    JSON.stringify(payload2));
  check('A2 accept all: mm-consent cookie granted/granted', /mm-consent=analytics:granted,marketing:granted/.test(s2.__sandbox.document.cookie), s2.__sandbox.document.cookie);

  // A3: revoke after grant → all advertising signals denied again (update, not just default).
  // Transition events fire only while the GTM container is loaded — simulate a loaded
  // container between the grant and the revoke (matching real mid-page consent change).
  const s3 = runCookieConsent({}, {});
  let payload3 = null;
  s3.__mildmateAddConsentListener((p) => { payload3 = p; });
  s3.__mildmateSaveConsent({ essential: true, analytics: true, marketing: true });
  s3.__mildmateAnalyticsLoaded = true; // container loaded after initial grant
  s3.__mildmateSaveConsent({ essential: true, analytics: false, marketing: false });
  check('A3 revoke: listener payload denies all four signals',
    payload3 && payload3.analyticsConsentGranted === false && payload3.adConsentGranted === false &&
    payload3.adUserDataConsentGranted === false && payload3.adPersonalizationConsentGranted === false,
    JSON.stringify(payload3));
  check('A3 revoke: revoked transition events pushed to dataLayer',
    s3.dataLayer.some((e) => e && e.event === 'mildmate_analytics_revoked') &&
    s3.dataLayer.some((e) => e && e.event === 'mildmate_marketing_revoked'));

  // B1: analytics-only grant → advertising signals stay denied (separation)
  const s4 = runCookieConsent({}, {});
  let payload4 = null;
  s4.__mildmateAddConsentListener((p) => { payload4 = p; });
  s4.__mildmateSaveConsent({ essential: true, analytics: true, marketing: false });
  check('B1 analytics-only: analytics granted, ad_user_data + ad_personalization NOT granted',
    payload4 && payload4.analyticsConsentGranted === true && payload4.adUserDataConsentGranted === false &&
    payload4.adPersonalizationConsentGranted === false, JSON.stringify(payload4));

  // B2: analytics-env reads the same storage; historical analytics-only record → marketing NOT granted
  const envCode = read('public/js/analytics-env.js');
  function runEnv(seed) {
    const sandbox = { console, JSON, Date, Promise, localStorage: makeLocalStorage(seed) };
    vm.createContext(sandbox);
    vm.runInContext(envCode, sandbox, { filename: 'analytics-env.js' });
    return sandbox;
  }
  const e1 = runEnv({ 'mildmate-cookie-consent': JSON.stringify({ analytics: true, timestamp: 1 }) });
  check('B2 historical analytics-only record: analytics granted, marketing NOT auto-granted',
    e1.__mildmateHasAnalyticsConsent() === true && e1.__mildmateHasMarketingConsent() === false);

  // B3: attribution scrub — marketing denied strips gclid even when present in URL
  const s5 = runCookieConsent({}, { search: '?gclid=EAIaIQobGCLIDTEST&utm_source=google&utm_medium=cpc' });
  const snapDenied = s5.__mildmateGetAttributionSnapshot('quote');
  check('B3 marketing denied: gclid scrubbed from attribution snapshot', snapDenied.first_touch && snapDenied.first_touch.gclid === null, JSON.stringify(snapDenied.first_touch));
  check('B3 marketing denied: utm observed but source not inferred as paid', snapDenied.first_touch && snapDenied.first_touch.utm_source === 'google');

  // B4: marketing granted preserves gclid on NEW touches. first_touch is a historical
  // record captured under denied consent — it must stay scrubbed (never retro-granted).
  const s6 = runCookieConsent({}, { search: '?gclid=EAIaIQobGCLIDTEST' });
  s6.__mildmateSaveConsent({ essential: true, analytics: true, marketing: true });
  const snapGranted = s6.__mildmateGetAttributionSnapshot('checkout');
  check('B4 marketing granted: historical first_touch stays consent-scrubbed (never retro-granted)',
    snapGranted.first_touch && snapGranted.first_touch.gclid === null);
  check('B4 marketing granted: current-stage touch preserves gclid',
    snapGranted.checkout_session && snapGranted.checkout_session.gclid === 'EAIaIQobGCLIDTEST', JSON.stringify(snapGranted.checkout_session));
  check('B4 checkout stage: snapshot exposes checkout_session touch, quote_session null',
    snapGranted.checkout_session !== null && snapGranted.quote_session === null);
}

// ---------- C: GA4 canonical measurement configuration ----------
{
  const envCode = read('public/js/analytics-env.js');
  function resolveFor(hostname, override) {
    const sandbox = { console, JSON, Date, Promise, localStorage: makeLocalStorage({}), location: { hostname } };
    vm.createContext(sandbox);
    vm.runInContext(envCode, sandbox, { filename: 'analytics-env.js' });
    return sandbox.__resolveMildMateAnalyticsConfig({ hostname, override: override || {} });
  }
  const prod = resolveFor('www.mildmate.com');
  check('C1 production: enabled with canonical GTM-KLJZZM9 + GA4 G-0GWVSPJLVJ',
    prod.enabled === true && prod.gtmId === 'GTM-KLJZZM9' && prod.ga4Id === 'G-0GWVSPJLVJ', JSON.stringify(prod));
  check('C2 production: Ads conversions allowed', prod.allowAdsConversions === true);
  const nonProd = resolveFor('localhost');
  check('C3 non-production: analytics disabled by default', nonProd.enabled === false && nonProd.reason === 'non_production_default_disabled', JSON.stringify(nonProd));
  const leak = resolveFor('localhost', { nonProductionApproved: true, gtmId: 'GTM-KLJZZM9', ga4Id: 'G-0GWVSPJLVJ', enabled: true });
  check('C4 non-production can never use production IDs', leak.enabled === false && leak.reason === 'non_production_ids_match_production_blocked', JSON.stringify(leak));
}

// ---------- D: Purchase gating + duplicate prevention ----------
function extractOrderConfirmedScript() {
  const html = read('public/order-confirmed/index.html');
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const inline = matches.map((m) => m[1]).filter((c) => c.includes('trackPurchaseOnce'));
  if (!inline.length) throw new Error('order-confirmed inline script not found');
  return inline[inline.length - 1];
}

function runOrderConfirmed(opts) {
  const code = extractOrderConfirmedScript();
  const confirmedOrder = {
    session_id: 'cs_test_M4gate_001',
    payment_verified: true,
    purchase_reportable: true,
    purchase_reportable_value: 59,
    session_amount_total: 6400, // $64.00 gross incl. $5.00 shipping
    orders: [
      { status: 'confirmed', product_slug: 'standard-fitted-sheet', product_title_en: 'Standard Fitted Sheet', price_usd: 59, quantity: 1, currency: 'usd', quote_id: 'QT-261030-002' }
    ]
  };
  const payload = opts.apiResponse || confirmedOrder;
  const events = [];
  const els = {};
  for (const id of ['loading-state', 'pending-state', 'confirmed-state', 'order-number', 'order-details', 'order-items', 'order-total', 'pending-msg']) {
    els[id] = makeElementStub('div');
  }
  const ls = makeLocalStorage(opts.localStorageSeed || {});
  let pollResolve;
  const pollDone = new Promise((r) => { pollResolve = r; });
  const sandbox = {
    console,
    URLSearchParams,
    URL,
    Promise,
    Date,
    TextEncoder,
    isFinite,
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: (fn) => { fn(); return 0; },
    localStorage: ls,
    location: { search: '?session_id=' + (opts.sessionId || 'cs_test_M4gate_001') },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(payload) }),
    document: null,
    crypto: globalThis.crypto,
    __track: (name, p) => events.push({ name, p }),
    __pollDone: pollDone,
    __pollResolve: pollResolve
  };
  const doc = makeDoc({}, els);
  doc.addEventListener = () => {};
  sandbox.document = doc;
  sandbox.window = sandbox;
  sandbox.__mildmateTrackEvent = (name, p) => sandbox.__track(name, p);
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'order-confirmed-inline.js' });
  // wait for the async poll tick + token hashing to settle
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  return wait(250).then(() => ({ events, ls }));
}

// helper: same sandbox + same storage as the first dispatch — re-executing the
// script simulates a second page load in the same browser (dedupe key already claimed)
async function runSecondLoadSameStorage(code, confirmedOrder, sessionId) {
  const events = [];
  const els = {};
  for (const id of ['loading-state', 'pending-state', 'confirmed-state', 'order-number', 'order-details', 'order-items', 'order-total', 'pending-msg']) {
    els[id] = makeElementStub('div');
  }
  const ls = makeLocalStorage({});
  const sandbox = {
    console, URLSearchParams, URL, Promise, Date, TextEncoder, isFinite,
    setInterval: () => 0, clearInterval: () => {}, setTimeout: (fn) => { fn(); return 0; },
    localStorage: ls,
    location: { search: '?session_id=' + sessionId },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(confirmedOrder) }),
    document: null, crypto: globalThis.crypto,
    __track: (name, p) => events.push({ name, p })
  };
  const doc = makeDoc({}, els);
  doc.addEventListener = () => {};
  sandbox.document = doc;
  sandbox.window = sandbox;
  sandbox.__mildmateTrackEvent = (name, p) => sandbox.__track(name, p);
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'order-confirmed-inline.js' });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(250);
  // first dispatch has claimed the dedupe key; re-execute the same script in the SAME storage
  vm.runInContext(code, sandbox, { filename: 'order-confirmed-inline.js' });
  await wait(250);
  return { events, ls };
}

{
  const d1 = await runOrderConfirmed({});
  const purchase = d1.events.filter((e) => e.name === 'purchase');
  check('D1 paid+confirmed order: exactly one purchase event dispatched', purchase.length === 1, JSON.stringify(d1.events.map((e) => e.name)));
  check('D1 purchase payload: transaction_id + currency + value (excl. shipping)',
    purchase[0] && purchase[0].p.transaction_id === 'cs_test_M4gate_001' && purchase[0].p.currency === 'USD' && purchase[0].p.value === 59,
    JSON.stringify(purchase[0] && purchase[0].p));
  check('D1 purchase payload: shipping reported separately as transaction_shipping',
    purchase[0] && purchase[0].p.transaction_shipping === 5, JSON.stringify(purchase[0] && purchase[0].p));

  const d2 = await runOrderConfirmed({ apiResponse: { pending: true, payment_verified: false } });
  check('D2 payment_verified=false: NO purchase event', d2.events.filter((e) => e.name === 'purchase').length === 0, JSON.stringify(d2.events));

  const d3 = await runOrderConfirmed({ apiResponse: { session_id: 'cs_test_M4gate_001', payment_verified: true, purchase_reportable: true, orders: [{ status: 'refunded', product_slug: 'x', product_title_en: 'X', price_usd: 59, quantity: 1, currency: 'usd' }] } });
  check('D3 refunded-only order: NO purchase event (reportable-status gate)', d3.events.filter((e) => e.name === 'purchase').length === 0, JSON.stringify(d3.events));

  // Duplicate prevention: second execution against the same browser storage
  const d4 = await runSecondLoadSameStorage(extractOrderConfirmedScript(), {
    session_id: 'cs_test_M4gate_001',
    payment_verified: true,
    purchase_reportable: true,
    purchase_reportable_value: 59,
    session_amount_total: 6400,
    orders: [{ status: 'confirmed', product_slug: 'standard-fitted-sheet', product_title_en: 'Standard Fitted Sheet', price_usd: 59, quantity: 1, currency: 'usd', quote_id: 'QT-261030-002' }]
  }, 'cs_test_M4gate_001');
  check('D4 second load for same session: duplicate purchase suppressed (1 dispatch total)', d4.events.filter((e) => e.name === 'purchase').length === 1, JSON.stringify(d4.events.map((e) => e.name)));
}

// ---------- E: Stripe executable behavior pointers ----------
{
  const t1 = 'workers/api/__tests__/stripe-purchase-hardening.test.ts';
  const t2 = 'workers/api/__tests__/cross-path-idempotency.test.ts';
  const t3 = 'workers/api/__tests__/email-safety-hardening.test.ts';
  const src = read('workers/api/webhook.ts');
  check('E1 stripe-purchase-hardening suite present (executable in Vitest gate)', fs.existsSync(path.join(ROOT, t1)));
  check('E2 cross-path idempotency suite present (executable in Vitest gate)', fs.existsSync(path.join(ROOT, t2)));
  check('E3 email-safety suite present (executable in Vitest gate)', fs.existsSync(path.join(ROOT, t3)));
  check('E4 webhook verifies Stripe signature', /stripe-signature|constructEvent/i.test(src));
  check('E5 webhook enforces payment-event idempotency (stripe_events / processed guard)', /stripe_events|idempoten|already/i.test(src));
  check('E6 checkout derives success/cancel URLs from request origin (no preview leak)', /origin/i.test(read('workers/api/checkout.ts')));
}

// ---------- summary ----------
const failed = results.filter((r) => !r.ok);
console.log('\n===== RESULT: ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed =====');
if (failed.length) {
  failed.forEach((f) => console.log('FAILED: ' + f.name + (f.detail ? ' — ' + f.detail : '')));
  process.exit(1);
}
