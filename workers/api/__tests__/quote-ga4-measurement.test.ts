// Phase 2 — Custom Quote GA4 Measurement suite.
// Covers the full consent-compliant quote measurement chain:
//   analytics-env.js dispatch contract (consent-gated GTM load, dataLayer shapes)
//   quote magic-link SSR (page_location sanitization, view_quote gating, tokenized dispatch)
//   product-configurator (generate_lead + quote_request, both tokenized)
//   checkout helpers (item_quote_id tokens, token cache)
//   order-confirmed purchase (value excludes shipping, transaction_shipping
//     from session_amount_total, immediate dedupe claim, tokenized items)
//   workers/api/order-confirmed.ts server contract (quote_id exposure,
//     session_amount_total evidence, reportable value math)
// All fixtures are synthetic. No network, no prod data, no D1 writes.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { handleOrderConfirmed } from "../order-confirmed";

const ROOT = "D:/00_mildmate/re-build_web";

function expectedToken(raw: string): string {
  return createHash("sha256").update("mildmate-quote:" + String(raw)).digest("hex").slice(0, 16);
}

function readText(rel: string): string {
  return readFileSync(`${ROOT}/${rel}`, "utf8");
}

// ---------------------------------------------------------------------------
// Minimal DOM/storage stubs for vm-executed page code
// ---------------------------------------------------------------------------
function makeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    _map: m,
  };
}

function toUint8(data: any): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array();
}

function makeDeterministicCrypto() {
  return {
    subtle: {
      digest: (alg: string, data: any) => {
        if (String(alg || '').toUpperCase() !== 'SHA-256') {
          return Promise.reject(new Error('Unsupported digest algorithm'));
        }
        const bytes = toUint8(data);
        const hash = createHash('sha256').update(Buffer.from(bytes)).digest();
        const view = hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
        return Promise.resolve(view);
      },
    },
  };
}
function makeSandbox(overrides: Record<string, any> = {}) {
  const storage = makeStorage();
  const session = makeStorage();
  const loadedScripts: any[] = [];
  const noscriptEl: any = { id: "gtm-noscript", innerHTML: "" };
  const sandbox: any = {
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    sessionStorage: session,
    localStorage: storage,
    dataLayer: [] as any[],
    TextEncoder,
    crypto: makeDeterministicCrypto(),
    document: {
      readyState: "complete",
      getElementById: (id: string) => (id === "gtm-noscript" ? noscriptEl : null),
      createElement: () => {
        const el: any = { async: true, src: "" };
        loadedScripts.push(el);
        return el;
      },
      head: { appendChild: () => {} },
      addEventListener: () => {},
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    location: { hostname: "www.mildmate.com", pathname: "/quote/QT-TEST-001/", href: "https://www.mildmate.com/quote/QT-TEST-001/" },
    _loadedScripts: loadedScripts,
    _noscriptEl: noscriptEl,
    ...overrides,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function runCode(code: string, sandbox: any) {
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

function extractInlineScripts(html: string): string[] {
  const out: string[] = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function sliceBetween(text: string, startMarker: string, endMarker: string): string {
  const s = text.indexOf(startMarker);
  const e = text.indexOf(endMarker, s);
  if (s < 0 || e < 0) throw new Error(`slice markers not found: ${startMarker.slice(0, 40)}`);
  return text.slice(s, e);
}

async function flushMicrotasks(times = 8) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

// ===========================================================================
// A. analytics-env.js — consent-gated load + dataLayer dispatch contract
// ===========================================================================
describe("analytics-env.js: consent-gated measurement contract", () => {
  const src = readText("public/js/analytics-env.js");

  function boot(sandboxOverrides: Record<string, any> = {}) {
    const sb = makeSandbox(sandboxOverrides);
    runCode(src, sb);
    return sb;
  }

  it("exposes __mildmateTrackEvent / __mildmateInitAnalytics on the window", () => {
    const sb = boot();
    expect(typeof sb.__mildmateTrackEvent).toBe("function");
    expect(typeof sb.__mildmateInitAnalytics).toBe("function");
  });

  it("does NOT load GTM when consent is absent (consent reject)", () => {
    const sb = boot();
    const ok = sb.__mildmateInitAnalytics({ noscriptId: "gtm-noscript" });
    expect(ok).toBe(false);
    expect(sb._loadedScripts.length).toBe(0);
    expect(sb.dataLayer.some((e: any) => e && e["gtm.start"])).toBe(false);
    expect(sb._noscriptEl.innerHTML).toBe("");
  });

  it("does NOT load GTM when consent record exists but analytics+marketing are false", () => {
    const sb = boot();
    sb.localStorage.setItem("mildmate-cookie-consent", JSON.stringify({ analytics: false, marketing: false }));
    const ok = sb.__mildmateInitAnalytics({ noscriptId: "gtm-noscript" });
    expect(ok).toBe(false);
    expect(sb._loadedScripts.length).toBe(0);
  });

  it("loads the production GTM container (GTM-KLJZZM9) and fills the noscript slot on analytics consent", () => {
    const sb = boot();
    sb.localStorage.setItem("mildmate-cookie-consent", JSON.stringify({ analytics: true, marketing: false }));
    const ok = sb.__mildmateInitAnalytics({ noscriptId: "gtm-noscript" });
    expect(ok).toBe(true);
    expect(sb._loadedScripts.length).toBe(1);
    expect(sb._loadedScripts[0].src).toContain("https://www.googletagmanager.com/gtm.js?id=GTM-KLJZZM9");
    expect(sb.dataLayer.some((e: any) => e && e["gtm.start"] && e.event === "gtm.js")).toBe(true);
    expect(sb._noscriptEl.innerHTML).toContain("https://www.googletagmanager.com/ns.html?id=GTM-KLJZZM9");
  });

  it("loads GTM on marketing consent alone (tags governed by the GTM consent template)", () => {
    const sb = boot();
    sb.localStorage.setItem("mildmate-cookie-consent", JSON.stringify({ analytics: false, marketing: true }));
    expect(sb.__mildmateInitAnalytics({ noscriptId: "gtm-noscript" })).toBe(true);
    expect(sb._loadedScripts.length).toBe(1);
  });

  it("resolves production config to canonical GTM/GA4 ids and blocks production ids off-host", () => {
    const sb = boot();
    const cfg = sb.__resolveMildMateAnalyticsConfig({ hostname: "www.mildmate.com" });
    expect(cfg.enabled).toBe(true);
    expect(cfg.gtmId).toBe("GTM-KLJZZM9");
    expect(cfg.ga4Id).toBe("G-0GWVSPJLVJ");
    const dev = sb.__resolveMildMateAnalyticsConfig({ hostname: "preview.mildmate-new.pages.dev" });
    expect(dev.enabled).toBe(false);
    expect(dev.reason).toBe("non_production_default_disabled");
  });

  it("pushes {event, eventModel} for non-ecommerce events (view_quote)", () => {
    const sb = boot();
    sb.__mildmateTrackEvent("view_quote", { quote_id: "abc123", value: 198 });
    const last = sb.dataLayer[sb.dataLayer.length - 1];
    expect(last.event).toBe("view_quote");
    expect(last.eventModel).toEqual({ quote_id: "abc123", value: 198 });
    expect(last.ecommerce).toBeUndefined();
  });

  it("adds an ecommerce object for container-routed ecommerce events (add_to_cart, begin_checkout, purchase)", () => {
    const sb = boot();
    for (const name of ["add_to_cart", "begin_checkout", "purchase"]) {
      sb.__mildmateTrackEvent(name, { value: 198, items: [] });
      const last = sb.dataLayer[sb.dataLayer.length - 1];
      expect(last.event).toBe(name);
      expect(last.ecommerce).toEqual({ value: 198, items: [] });
    }
  });

  it("view_quote / quote_request / generate_lead are NOT in ECOM_EVENTS (GTM container routes them; proposed container change noted in the report)", () => {
    const sb = boot();
    for (const name of ["view_quote", "quote_request", "generate_lead"]) {
      sb.__mildmateTrackEvent(name, { value: 198 });
      const last = sb.dataLayer[sb.dataLayer.length - 1];
      expect(last.ecommerce).toBeUndefined();
    }
  });
});

// ===========================================================================
// B. Quote magic-link SSR — functions/quote/[[path]].ts
// ===========================================================================
class QuoteD1 {
  quotes = new Map<string, any>();
  rate = 30;
  prepare(sql: string) {
    return new QuoteStmt(this, sql);
  }
}
class QuoteStmt {
  private args: any[] = [];
  constructor(private db: QuoteD1, private sql: string) {}
  bind(...a: any[]) { this.args = a; return this; }
  async first() {
    const sql = this.sql.replace(/\s+/g, " ").toLowerCase();
    if (sql.includes("from custom_quotes")) return this.db.quotes.get(String(this.args[0] || "")) || null;
    if (sql.includes("from pricing_params")) return { param_value: String(this.db.rate) };
    return null;
  }
  async all() { return { results: [] }; }
  async run() { return { success: true }; }
}

const FUTURE_ISO = "2099-01-01T00:00:00";
const PAST_ISO = "2020-01-01T00:00:00";

function baseQuote(over: Record<string, any> = {}) {
  return {
    quote_id: "QT-TEST-001",
    customer_name: "Test Customer",
    product_slug: "custom-waterproof-cushion-protector",
    dimensions: JSON.stringify({ w: 60, l: 60, d: 12, unit: "cm" }),
    fabric: "BreezePlus",
    color: "Beige",
    status: "approved",
    quoted_price: 5940,
    quoted_price_usd: 198,
    free_shipping: 0,
    expires_at: FUTURE_ISO,
    created_at: "2026-10-01T00:00:00",
    ...over,
  };
}

describe("quote magic-link SSR: consent-compliant measurement bootstrap", () => {
  it("rejects requests without a quote id", async () => {
    const mod = await import("../../../functions/quote/[[path]]");
    const resp = await (mod as any).onRequest({
      request: new Request("https://www.mildmate.com/quote/"),
      env: { DB: new QuoteD1() },
      params: {},
    });
    expect(resp.status).toBe(400);
  });

  describe("approved + priced quote (checkout-ready)", () => {
    let html: string;
    beforeEach(async () => {
      const mod = await import("../../../functions/quote/[[path]]");
      const db = new QuoteD1();
      db.quotes.set("QT-TEST-001", baseQuote());
      const resp = await (mod as any).onRequest({
        request: new Request("https://www.mildmate.com/quote/QT-TEST-001/"),
        env: { DB: db },
        params: {},
      });
      expect(resp.status).toBe(200);
      html = await resp.text();
    });

    it("bootstraps analytics-env + cookie-consent and sanitizes page_location (bearer token stripped) BEFORE any measurement", () => {
      expect(html).toContain('<script src="/js/analytics-env.js"></script>');
      expect(html).toContain('<script src="/js/cookie-consent.js"></script>');
      expect(html).toContain("page_location: 'https://www.mildmate.com/quote/'");
      expect(html).toContain("__mildmateInitAnalytics({ noscriptId: 'gtm-noscript', mobileLazy: true })");
      expect(html).toContain('<noscript id="gtm-noscript"></noscript>');
      // The sanitized override must precede the init call in the document.
      expect(html.indexOf("page_location: 'https://www.mildmate.com/quote/'"))
        .toBeLessThan(html.indexOf("__mildmateInitAnalytics"));
    });

    it("emits view_quote ONLY for checkout-ready quotes (meta non-null) and strips the raw quote id from the dispatched payload", () => {
      expect(html).toContain("var _quoteEventMeta = {");
      expect(html).toContain('"quote_id":"QT-TEST-001"');
      expect(html).toContain("quote_id: ''");
      expect(html).toContain("sendGa4EventTokenized('view_quote', payload, 'quote_id', meta.quote_id)");
      expect(html).toContain("if (_quoteEventMeta && _quoteEventMeta.quote_id) trackViewQuote(_quoteEventMeta);");
    });

    it("tokenizes add_to_cart with the shared 16-hex scheme and never puts the raw quote id in the payload literal", () => {
      expect(html).toContain("sendGa4EventTokenized('add_to_cart', payload, 'quote_id', item.quote_id)");
    });
  });

  it("pending (unpriced) quote: no view_quote meta — view_quote must not fire for unapproved/unpriced quotes", async () => {
    const mod = await import("../../../functions/quote/[[path]]");
    const db = new QuoteD1();
    db.quotes.set("QT-TEST-002", baseQuote({ quote_id: "QT-TEST-002", quoted_price: null, quoted_price_usd: null, status: "pending" }));
    const resp = await (mod as any).onRequest({
      request: new Request("https://www.mildmate.com/quote/QT-TEST-002/"),
      env: { DB: db },
      params: {},
    });
    const html = await resp.text();
    expect(html).toContain("var _quoteEventMeta = null;");
    expect(html).toContain("Awaiting pricing");
  });

  it("expired quote: no view_quote meta even when priced", async () => {
    const mod = await import("../../../functions/quote/[[path]]");
    const db = new QuoteD1();
    db.quotes.set("QT-TEST-003", baseQuote({ quote_id: "QT-TEST-003", expires_at: PAST_ISO }));
    const resp = await (mod as any).onRequest({
      request: new Request("https://www.mildmate.com/quote/QT-TEST-003/"),
      env: { DB: db },
      params: {},
    });
    const html = await resp.text();
    expect(html).toContain("var _quoteEventMeta = null;");
    expect(html).toContain("Expired");
  });

  it("unknown quote: not-found page, no measurement meta", async () => {
    const mod = await import("../../../functions/quote/[[path]]");
    const resp = await (mod as any).onRequest({
      request: new Request("https://www.mildmate.com/quote/QT-NOPE-999/"),
      env: { DB: new QuoteD1() },
      params: {},
    });
    const html = await resp.text();
    expect(html).toContain("Quote Not Found");
    expect(html).toContain("var _quoteEventMeta = null;");
  });

  describe("behavioral: rendered page script dispatches tokenized view_quote + add_to_cart exactly once", () => {
    let sb: any;

    beforeEach(async () => {
      const mod = await import("../../../functions/quote/[[path]]");
      const db = new QuoteD1();
      db.quotes.set("QT-TEST-001", baseQuote());
      const resp = await (mod as any).onRequest({
        request: new Request("https://www.mildmate.com/quote/QT-TEST-001/"),
        env: { DB: db },
        params: {},
      });
      const html = await resp.text();
      sb = makeSandbox();
      sb.__mildmateTrackEvents = [];
      sb.__mildmateTrackEvent = (name: string, payload: any) => {
        sb.__mildmateTrackEvents.push({ name, payload });
      };
      const scripts = extractInlineScripts(html);
      expect(scripts.length).toBeGreaterThanOrEqual(2);
      for (const code of scripts) runCode(code, sb);
    });

    it("view_quote fires once, quote_id is the 16-hex token, value/currency from the approved quote", async () => {
      await flushMicrotasks();
      const viewQuote = sb.__mildmateTrackEvents.filter((e: any) => e.name === "view_quote");
      expect(viewQuote.length).toBe(1);
      expect(viewQuote[0].payload.quote_id).toBe(expectedToken("QT-TEST-001"));
      expect(viewQuote[0].payload.quote_id).not.toContain("QT-TEST-001");
      expect(viewQuote[0].payload.value).toBe(198);
      expect(viewQuote[0].payload.currency).toBe("USD");
    });

    it("page_location override is the first dataLayer entry and never contains the magic-link token", async () => {
      expect(sb.dataLayer[0]).toEqual({ page_location: "https://www.mildmate.com/quote/" });
      expect(JSON.stringify(sb.dataLayer)).not.toContain("QT-TEST-001/\"");
    });

    it("re-running the page script (reload) does not duplicate view_quote (session dedupe)", async () => {
      await flushMicrotasks();
      const mod = await import("../../../functions/quote/[[path]]");
      const db = new QuoteD1();
      db.quotes.set("QT-TEST-001", baseQuote());
      const resp = await (mod as any).onRequest({
        request: new Request("https://www.mildmate.com/quote/QT-TEST-001/"),
        env: { DB: db },
        params: {},
      });
      const html = await resp.text();
      for (const code of extractInlineScripts(html)) runCode(code, sb);
      await flushMicrotasks();
      const viewQuote = sb.__mildmateTrackEvents.filter((e: any) => e.name === "view_quote");
      expect(viewQuote.length).toBe(1);
    });

    it("add_to_cart carries the tokenized quote id, USD unit price, and quantity", async () => {
      vm.runInContext(
        `trackQuoteAddToCart(${JSON.stringify({
          quote_id: "QT-TEST-001",
          quote_currency: "USD",
          price_usd: 33,
          price_thb: 990,
          product_slug: "custom-waterproof-cushion-protector",
          product_name: "Custom Waterproof Cushion Protector",
          qty: 6,
        })})`,
        sb
      );
      await flushMicrotasks();
      const atc = sb.__mildmateTrackEvents.filter((e: any) => e.name === "add_to_cart");
      expect(atc.length).toBe(1);
      expect(atc[0].payload.quote_id).toBe(expectedToken("QT-TEST-001"));
      expect(atc[0].payload.value).toBe(33);
      expect(atc[0].payload.currency).toBe("USD");
      expect(atc[0].payload.items[0]).toMatchObject({
        item_id: "custom-waterproof-cushion-protector",
        price: 33,
        quantity: 6,
      });
    });
  });
});

// ===========================================================================
// C. product-configurator — generate_lead + quote_request (tokenized)
// ===========================================================================
describe("product-configurator: lead events are dual-dispatched and tokenized", () => {
  const src = readText("public/js/product-configurator.js");
  const block = sliceBetween(src, "function sendGa4Event(name, params)", "function applyDerivedMarkupToResult");

  function boot() {
    const sb = makeSandbox();
    sb.__mildmateTrackEvents = [];
    sb.__mildmateTrackEvent = (name: string, payload: any) => {
      sb.__mildmateTrackEvents.push({ name, payload });
    };
    sb.isEN = true;
    sb.state = { fabric: "CloudSoft" };
    runCode(block, sb);
    return sb;
  }

  it("trackQuoteRequest fires BOTH quote_request and generate_lead with the tokenized quote id (never raw)", async () => {
    const sb = boot();
    vm.runInContext(
      `trackQuoteRequest(${JSON.stringify({
        quote_id: "QT-261029-003",
        price_usd: 33,
        product_name: "Custom Waterproof Cushion Protector",
        product_slug: "custom-waterproof-cushion-protector",
      })})`,
      sb
    );
    await flushMicrotasks();
    const names = sb.__mildmateTrackEvents.map((e: any) => e.name).sort();
    expect(names).toEqual(["generate_lead", "quote_request"]);
    for (const e of sb.__mildmateTrackEvents) {
      expect(e.payload.quote_id).toBe(expectedToken("QT-261029-003"));
      expect(JSON.stringify(e.payload)).not.toContain("QT-261029-003");
      expect(e.payload.value).toBe(33);
      expect(e.payload.currency).toBe("USD");
      expect(e.payload.items[0]).toMatchObject({
        item_id: "custom-waterproof-cushion-protector",
        quantity: 1,
        price: 33,
      });
    }
  });

  it("falls back to 'token-unavailable' synchronously when WebCrypto is missing (event never silently lost)", async () => {
    const sb = boot();
    sb.crypto = {};
    vm.runInContext(
      `trackQuoteRequest(${JSON.stringify({
        quote_id: "QT-261029-003",
        price_usd: 33,
        product_name: "X",
        product_slug: "y",
      })})`,
      sb
    );
    await flushMicrotasks();
    expect(sb.__mildmateTrackEvents.length).toBe(2);
    for (const e of sb.__mildmateTrackEvents) expect(e.payload.quote_id).toBe("token-unavailable");
  });

  it("sendGa4Event routes through __mildmateTrackEvent when available", () => {
    const sb = boot();
    vm.runInContext("sendGa4Event('view_cart', { value: 10 })", sb);
    expect(sb.__mildmateTrackEvents).toEqual([{ name: "view_cart", payload: { value: 10 } }]);
  });
});

// ===========================================================================
// D. checkout page — quote identity on begin_checkout / shipping / payment
// ===========================================================================
describe("checkout page: begin_checkout family carries tokenized quote identity", () => {
  const src = readText("public/checkout/index.html");
  const block = sliceBetween(src, "function sha256QuoteTokens", "function buildGa4CheckoutPayload");
  const thSrc = readText("public/th/checkout/index.html");

  function boot(cart: any) {
    const sb = makeSandbox();
    sb.cart = cart;
    sb.ga4QuoteTokenMap = {};
    let digestCalls = 0;
    sb.__digestCalls = () => digestCalls;
    const origDigest = sb.crypto.subtle.digest.bind(sb.crypto.subtle);
    sb.crypto = {
      subtle: {
        digest: (alg: string, data: any) => {
          digestCalls++;
          return origDigest(alg, data);
        },
      },
    };
    runCode(block, sb);
    return sb;
  }

  it("sha256QuoteTokens produces the shared 16-hex token for each unique quote id", async () => {
    const sb = boot({ items: [] });
    const tokens: any = await vm.runInContext(
      `new Promise(function (res) { sha256QuoteTokens(['QT-261029-003', 'QT-261029-004'], res); })`,
      sb
    );
    expect(tokens["QT-261029-003"]).toBe(expectedToken("QT-261029-003"));
    expect(tokens["QT-261029-004"]).toBe(expectedToken("QT-261029-004"));
  });

  it("empty quote list resolves immediately (no token work blocks checkout events)", async () => {
    const sb = boot({ items: [] });
    const out = await vm.runInContext(
      `new Promise(function (res) { withQuoteTokens(function () { res('ran'); }); })`,
      sb
    );
    expect(out).toBe("ran");
    expect(sb.__digestCalls()).toBe(0);
  });

  it("buildGa4Items attaches item_quote_id tokens to quote items only", async () => {
    const sb = boot({
      items: [
        { product_slug: "custom-a", product_name: "A", quote_id: "QT-261029-003", price_usd: 33, price_thb: 990, qty: 6 },
        { product_slug: "standard-b", product_name: "B", price_usd: 50, price_thb: 1500, qty: 1 },
      ],
    });
    await vm.runInContext(
      `new Promise(function (res) { withQuoteTokens(function () { res(); }); })`,
      sb
    );
    const items = vm.runInContext("buildGa4Items('USD')", sb);
    expect(items[0].item_quote_id).toBe(expectedToken("QT-261029-003"));
    expect(items[0].price).toBe(33);
    expect(items[0].quantity).toBe(6);
    expect(items[1].item_quote_id).toBeUndefined();
    expect(items[1].price).toBe(50);
  });

  it("token map is cached: a second withQuoteTokens pass performs no new hashing", async () => {
    const sb = boot({
      items: [{ product_slug: "custom-a", product_name: "A", quote_id: "QT-261029-003", price_usd: 33, qty: 1 }],
    });
    await vm.runInContext(`new Promise(function (res) { withQuoteTokens(res); })`, sb);
    const afterFirst = sb.__digestCalls();
    await vm.runInContext(`new Promise(function (res) { withQuoteTokens(res); })`, sb);
    expect(sb.__digestCalls()).toBe(afterFirst);
  });

  it("token map is NOT shared across distinct quote ids (multiple quotes in one cart)", async () => {
    const sb = boot({
      items: [
        { product_slug: "a", product_name: "A", quote_id: "QT-261029-003", price_usd: 33, qty: 1 },
        { product_slug: "b", product_name: "B", quote_id: "QT-261029-004", price_usd: 40, qty: 2 },
      ],
    });
    await vm.runInContext(`new Promise(function (res) { withQuoteTokens(res); })`, sb);
    const items = vm.runInContext("buildGa4Items('USD')", sb);
    expect(items[0].item_quote_id).toBe(expectedToken("QT-261029-003"));
    expect(items[1].item_quote_id).toBe(expectedToken("QT-261029-004"));
    expect(items[0].item_quote_id).not.toBe(items[1].item_quote_id);
  });

  it("TH checkout page carries the same token helpers (EN/TH parity)", () => {
    expect(thSrc).toContain("function sha256QuoteTokens");
    expect(thSrc).toContain("function withQuoteTokens");
    expect(thSrc).toContain("item_quote_id");
    expect(thSrc).toContain("mildmate-quote:");
  });

  it("checkout page wraps begin_checkout / add_shipping_info / add_payment_info in withQuoteTokens (event_callback semantics preserved)", () => {
    expect(src).toMatch(/withQuoteTokens\(function \(\) \{[\s\S]*?sendGa4Event\('begin_checkout', payload, onDone\)/);
    expect(src).toMatch(/withQuoteTokens\(function \(\) \{[\s\S]*?sendGa4Event\('add_shipping_info', payload\)/);
    expect(src).toMatch(/withQuoteTokens\(function \(\) \{[\s\S]*?sendGa4Event\('add_payment_info', payload\)/);
  });
});

// ===========================================================================
// E. order-confirmed page — purchase model (value excl. shipping, dedupe)
// ===========================================================================
describe("order-confirmed page: purchase is tokenized, shipping-split, and dedupe-safe", () => {
  const src = readText("public/order-confirmed/index.html");
  const thSrc = readText("public/th/order-confirmed/index.html");
  const block = sliceBetween(src, "function ensureGa4Stub", "if (!sessionId)");

  function boot() {
    const sb = makeSandbox();
    sb.__mildmateTrackEvents = [];
    sb.__mildmateTrackEvent = (name: string, payload: any) => {
      sb.__mildmateTrackEvents.push({ name, payload });
    };
    runCode(block, sb);
    return sb;
  }

  const paidData = (over: Record<string, any> = {}) => ({
    session_id: "cs_test_SESSION1",
    payment_verified: true,
    purchase_reportable: true,
    purchase_reportable_value: 198,
    session_amount_total: 28760, // $287.60 gross = $198 products + $89.60 shipping
    orders: [
      {
        product_slug: "custom-waterproof-cushion-protector",
        product_title_en: "Custom Waterproof Cushion Protector",
        quote_id: "QT-261029-003",
        price_usd: 33,
        price_thb: 990,
        quantity: 6,
        status: "confirmed",
      },
    ],
    ...over,
  });

  it("purchase: value = product revenue EXCLUDING shipping; shipping reported as transaction_shipping; items carry tokenized quote identity", async () => {
    const sb = boot();
    vm.runInContext(`trackPurchaseOnce(${JSON.stringify(paidData())}, 'USD', 287.6)`, sb);
    await flushMicrotasks();
    expect(sb.__mildmateTrackEvents.length).toBe(1);
    const ev = sb.__mildmateTrackEvents[0];
    expect(ev.name).toBe("purchase");
    expect(ev.payload.transaction_id).toBe("cs_test_SESSION1");
    expect(ev.payload.value).toBe(198);
    expect(ev.payload.transaction_shipping).toBe(89.6);
    expect(ev.payload.value + ev.payload.transaction_shipping).toBeCloseTo(287.6, 2);
    expect(ev.payload.items[0].item_quote_id).toBe(expectedToken("QT-261029-003"));
    expect(ev.payload.items[0].price).toBe(33);
    expect(ev.payload.items[0].quantity).toBe(6);
    expect(JSON.stringify(ev.payload)).not.toContain("QT-261029-003");
  });

  it("poll race: the dedupe flag is claimed synchronously — a second call in the same tick cannot double-fire", async () => {
    const sb = boot();
    const data = JSON.stringify(paidData());
    vm.runInContext(`trackPurchaseOnce(${data}, 'USD', 287.6); trackPurchaseOnce(${data}, 'USD', 287.6);`, sb);
    await flushMicrotasks();
    expect(sb.__mildmateTrackEvents.filter((e: any) => e.name === "purchase").length).toBe(1);
  });

  it("no dispatch when payment is not verified (guards preserved)", async () => {
    const sb = boot();
    vm.runInContext(`trackPurchaseOnce(${JSON.stringify(paidData({ payment_verified: false, purchase_reportable: false }))}, 'USD', 287.6)`, sb);
    await flushMicrotasks();
    expect(sb.__mildmateTrackEvents.length).toBe(0);
  });

  it("no dispatch when no order row is purchase-reportable", async () => {
    const sb = boot();
    const data = JSON.stringify(paidData({
      orders: [Object.assign({}, paidData().orders[0], { status: "pending" })],
    }));
    vm.runInContext(`trackPurchaseOnce(${data}, 'USD', 287.6)`, sb);
    await flushMicrotasks();
    expect(sb.__mildmateTrackEvents.length).toBe(0);
  });

  it("free-shipping case: no transaction_shipping key when gross equals product value", async () => {
    const sb = boot();
    vm.runInContext(`trackPurchaseOnce(${JSON.stringify(paidData({ session_amount_total: 19800 }))}, 'USD', 198)`, sb);
    await flushMicrotasks();
    expect(sb.__mildmateTrackEvents[0].payload.transaction_shipping).toBeUndefined();
  });

  it("THB purchase: unit price from price_thb and shipping still derived from session_amount_total", async () => {
    const sb = boot();
    const data = JSON.stringify(paidData({
      purchase_reportable_value: 5940,
      session_amount_total: 862800, // minor units: ฿8,628 gross = ฿5,940 products + ฿2,688 shipping
      orders: [Object.assign({}, paidData().orders[0], { price_thb: 990, price_usd: 33, quantity: 6 })],
    }));
    vm.runInContext(`trackPurchaseOnce(${data}, 'THB', 8628)`, sb);
    await flushMicrotasks();
    const ev = sb.__mildmateTrackEvents[0];
    expect(ev.name).toBe("purchase");
    expect(ev.payload.currency).toBe("THB");
    expect(ev.payload.value).toBe(5940);
    expect(ev.payload.transaction_shipping).toBe(2688);
    expect(ev.payload.items[0].price).toBe(990);
  });

  it("multiple quotes: each order row keeps its own tokenized quote identity", async () => {
    const sb = boot();
    const data = JSON.stringify(paidData({
      purchase_reportable_value: 73,
      session_amount_total: 16260,
      orders: [
        { product_slug: "a", product_title_en: "A", quote_id: "QT-261029-003", price_usd: 33, quantity: 1, status: "confirmed" },
        { product_slug: "b", product_title_en: "B", quote_id: "QT-261029-004", price_usd: 40, quantity: 1, status: "confirmed" },
      ],
    }));
    vm.runInContext(`trackPurchaseOnce(${data}, 'USD', 162.6)`, sb);
    await flushMicrotasks();
    const items = sb.__mildmateTrackEvents[0].payload.items;
    expect(items[0].item_quote_id).toBe(expectedToken("QT-261029-003"));
    expect(items[1].item_quote_id).toBe(expectedToken("QT-261029-004"));
  });

  it("TH order-confirmed page carries the same token + shipping-split model (EN/TH parity)", () => {
    expect(thSrc).toContain("function sha256QuoteToken");
    expect(thSrc).toContain("mildmate-quote:");
    expect(thSrc).toContain("item_quote_id");
    expect(thSrc).toContain("session_amount_total");
    expect(thSrc).toContain("transaction_shipping");
  });
});

// ===========================================================================
// F. workers/api/order-confirmed.ts — server evidence contract
// ===========================================================================
class OcD1 {
  orders: any[] = [];
  webhookEvents: any[] = [];
  prepare(sql: string) { return new OcStmt(this, sql); }
}
class OcStmt {
  private args: any[] = [];
  constructor(private db: OcD1, private sql: string) {}
  bind(...a: any[]) { this.args = a; return this; }
  async first() {
    const sql = this.sql.replace(/\s+/g, " ").toLowerCase();
    if (sql.includes("from orders")) {
      const sid = String(this.args[0]);
      return this.db.orders.find((o) => o.stripe_session_id === sid) || null;
    }
    if (sql.includes("from stripe_webhook_events")) return null;
    return null;
  }
  async all() {
    const sql = this.sql.replace(/\s+/g, " ").toLowerCase();
    if (sql.includes("from orders")) {
      const sid = String(this.args[0]);
      return { results: this.db.orders.filter((o) => o.stripe_session_id === sid) };
    }
    return { results: [] };
  }
  async run() { return { success: true }; }
}

function stripeSessionJson(paymentStatus: string, amountTotal: number) {
  return { payment_status: paymentStatus, amount_total: amountTotal, currency: "usd" };
}

describe("order-confirmed API: quote identity + Stripe evidence contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function makeEnv(db: OcD1, stripeKey = "sk_live_testKEY") {
    return { DB: db, STRIPE_SECRET_KEY: stripeKey };
  }

  it("exposes quote_id on order rows and passes session_amount_total (Stripe gross, minor units) through", async () => {
    const db = new OcD1();
    db.orders.push({
      stripe_session_id: "cs_A", stripe_payment_intent_id: "pi_1", email: "a@b.c",
      shipping_address: "{}", product_title_en: "Custom Protector", fabric: "BreezePlus", color: "Beige",
      width_cm: 60, length_cm: 60, depth_cm: 12, price_usd: 33, price_thb: 990,
      currency: "usd", quantity: 6, status: "confirmed", created_at: "2026-10-29", quote_id: "QT-261029-003",
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(stripeSessionJson("paid", 28760)), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const resp = await handleOrderConfirmed(new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_A"), makeEnv(db));
    const body: any = await resp.json();
    expect(body.orders[0].quote_id).toBe("QT-261029-003");
    expect(body.session_amount_total).toBe(28760);
    expect(body.payment_verified).toBe(true);
    expect(body.purchase_reportable).toBe(true);
    expect(body.purchase_reportable_value).toBe(198); // 6 × $33, shipping never a D1 product row
    expect(fetchMock.mock.calls[0][0]).toContain("https://api.stripe.com/v1/checkout/sessions/cs_A");
  });

  it("marks payment unverified when Stripe evidence says unpaid and no webhook evidence exists", async () => {
    const db = new OcD1();
    db.orders.push({
      stripe_session_id: "cs_B", stripe_payment_intent_id: "pi_2", email: "a@b.c",
      shipping_address: "{}", product_title_en: "X", fabric: null, color: null,
      width_cm: null, length_cm: null, depth_cm: null, price_usd: 10, price_thb: null,
      currency: "usd", quantity: 1, status: "confirmed", created_at: "2026-10-29", quote_id: null,
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(stripeSessionJson("unpaid", 1000)), { status: 200 })));
    const resp = await handleOrderConfirmed(new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_B"), makeEnv(db));
    const body: any = await resp.json();
    expect(body.payment_verified).toBe(false);
    expect(body.purchase_reportable).toBe(false);
  });

  it("degrades safely when Stripe evidence is unavailable (null amount, no crash)", async () => {
    const db = new OcD1();
    db.orders.push({
      stripe_session_id: "cs_C", stripe_payment_intent_id: "pi_3", email: "a@b.c",
      shipping_address: "{}", product_title_en: "X", fabric: null, color: null,
      width_cm: null, length_cm: null, depth_cm: null, price_usd: 10, price_thb: null,
      currency: "usd", quantity: 1, status: "confirmed", created_at: "2026-10-29", quote_id: "QT-X",
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const resp = await handleOrderConfirmed(new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_C"), makeEnv(db));
    const body: any = await resp.json();
    expect(body.session_amount_total).toBeNull();
    expect(body.payment_verified).toBe(false);
    expect(body.orders[0].quote_id).toBe("QT-X");
  });

  it("returns session_amount_total null when no Stripe key is configured", async () => {
    const db = new OcD1();
    db.orders.push({
      stripe_session_id: "cs_D", stripe_payment_intent_id: "pi_4", email: "a@b.c",
      shipping_address: "{}", product_title_en: "X", fabric: null, color: null,
      width_cm: null, length_cm: null, depth_cm: null, price_usd: 10, price_thb: null,
      currency: "usd", quantity: 1, status: "confirmed", created_at: "2026-10-29", quote_id: null,
    });
    const fetchMock = vi.fn(async () => { throw new Error("must not be called"); });
    vi.stubGlobal("fetch", fetchMock);
    const resp = await handleOrderConfirmed(new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_D"), makeEnv(db, ""));
    const body: any = await resp.json();
    expect(body.session_amount_total).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pending response shape is unchanged for sessions with no rows (Phase 1 poll contract)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const resp = await handleOrderConfirmed(new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_NONE"), makeEnv(new OcD1()));
    const body: any = await resp.json();
    expect(body).toEqual({ pending: true, payment_verified: false });
  });
});

