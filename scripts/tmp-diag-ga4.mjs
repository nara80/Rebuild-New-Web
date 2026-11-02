import fs from "node:fs";
import vm from "node:vm";

const ROOT = "D:/00_mildmate/re-build_web";

// --- 1. Which extracted quote-page script fails to parse? ---
// Reuse the vitest-compiled function? Simpler: check the static templates only.
// The quote function renders server-side, so replicate via the .ts import is not
// possible in plain node; instead exercise the STATIC page sources that failed.

// --- 2. product-configurator slice: what happens on trackQuoteRequest? ---
{
  const src = fs.readFileSync(`${ROOT}/public/js/product-configurator.js`, "utf8");
  const s = src.indexOf("function sendGa4Event(name, params)");
  const e = src.indexOf("function applyDerivedMarkupToResult");
  console.log("pc slice markers:", s, e);
  console.log("occurrences of 'function sendGa4Event(name, params)':", src.split("function sendGa4Event(name, params)").length - 1);
  console.log("occurrences of 'function trackQuoteRequest':", src.split("function trackQuoteRequest").length - 1);
  const block = src.slice(s, e);
  const sb = {};
  sb.window = sb;
  sb.__mildmateTrackEvents = [];
  sb.__mildmateTrackEvent = (name, payload) => sb.__mildmateTrackEvents.push({ name, payload });
  sb.isEN = true;
  sb.state = {};
  sb.crypto = globalThis.crypto;
  sb.TextEncoder = TextEncoder;
  sb.setTimeout = () => 0;
  sb.console = console;
  vm.createContext(sb);
  try { vm.runInContext(block, sb); console.log("pc block eval OK"); }
  catch (err) { console.log("pc block eval FAIL:", err.message); }
  try {
    vm.runInContext(`trackQuoteRequest(${JSON.stringify({ quote_id: "QT-261029-003", price_usd: 33, product_name: "X", product_slug: "y" })})`, sb);
    console.log("pc call OK");
  } catch (err) { console.log("pc call FAIL:", err.message); }
  await new Promise((r) => setTimeout(r, 50));
  console.log("pc events:", JSON.stringify(sb.__mildmateTrackEvents.map((e2) => e2.name)));
}

// --- 3. order-confirmed page slice ---
{
  const src = fs.readFileSync(`${ROOT}/public/order-confirmed/index.html`, "utf8");
  const first = src.indexOf("function ensureGa4Stub");
  const all = [];
  let idx = -1;
  while ((idx = src.indexOf("function ensureGa4Stub", idx + 1)) !== -1) all.push(idx);
  console.log("oc ensureGa4Stub occurrences:", all.length, all);
  const marker = src.indexOf("if (!sessionId)");
  console.log("oc 'if (!sessionId)' at:", marker);
  const block = src.slice(first, marker);
  const sb = {};
  sb.window = sb;
  sb.__mildmateTrackEvents = [];
  sb.__mildmateTrackEvent = (name, payload) => sb.__mildmateTrackEvents.push({ name, payload });
  sb.crypto = globalThis.crypto;
  sb.TextEncoder = TextEncoder;
  sb.setTimeout = () => 0;
  sb.console = console;
  const store = new Map();
  sb.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  sb.document = { getElementById: () => null };
  vm.createContext(sb);
  try { vm.runInContext(block, sb); console.log("oc block eval OK, len", block.length); }
  catch (err) { console.log("oc block eval FAIL:", err.message); }
  try {
    vm.runInContext(`trackPurchaseOnce(${JSON.stringify({
      session_id: "cs_test_SESSION1", payment_verified: true, purchase_reportable: true,
      purchase_reportable_value: 198, session_amount_total: 28760,
      orders: [{ product_slug: "a", product_title_en: "A", quote_id: "QT-261029-003", price_usd: 33, price_thb: 990, quantity: 6, status: "confirmed" }],
    })}, 'USD', 287.6)`, sb);
    console.log("oc call OK");
  } catch (err) { console.log("oc call FAIL:", err.message); }
  await new Promise((r) => setTimeout(r, 50));
  console.log("oc events:", JSON.stringify(sb.__mildmateTrackEvents.map((e2) => e2.name)));
}
