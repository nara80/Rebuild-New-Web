// Phase 1 â€” Custom Quote Cart & Order Integrity regression suite
// Covers the two authorized defects:
//   A) Cart item identity (quote_id-based dedupe, trusted quote pricing at checkout)
//   B) Client-polling reconciliation (snapshot-first, quote_id retention,
//      shipping-line exclusion, duplicate-poll protection)
// All fixtures are synthetic; no network, no production data.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { handleCheckout } from "../checkout";
import { handleOrderConfirmed } from "../order-confirmed";

vi.mock("../shipping", () => ({
  calculateShippingQuote: vi.fn(async () => ({
    amount: 10,
    country_name: "United States",
    applied_country: "US",
    requested_country: "US",
    service_level: "express",
    first_item: 10,
    additional_item: 5,
  })),
}));

const ROOT = path.resolve(process.cwd());
const PAID_STATUSES = new Set(["confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]);

// ---------------------------------------------------------------------------
// Synthetic fixtures
// ---------------------------------------------------------------------------

function quoteItem(quoteId: string, priceUsd: number, priceThb: number, qty = 1, dims: any = { w: 88.9, l: 94, d: 17.8, unit: "cm" }) {
  return {
    id: `quote-${quoteId}-1`,
    type: "custom_quote",
    product_slug: "custom-waterproof-cushion-protector",
    product_name: "Custom Waterproof Cushion Protector",
    dimensions: dims,
    fabric: "tpu",
    color: null,
    qty,
    is_quote: true,
    quote_id: quoteId,
    free_shipping: false,
    quote_currency: "USD",
    price_usd: priceUsd,
    price_thb: priceThb,
  };
}

function productItem(sku: string, priceUsd: number, dims: any) {
  return {
    id: `prod-${sku}`,
    type: "product",
    product_slug: sku,
    product_name: sku,
    dimensions: dims,
    fabric: "cloudsoft",
    color: "White",
    qty: 1,
    price_usd: priceUsd,
    price_thb: priceUsd * 30,
  };
}

// ---------------------------------------------------------------------------
// Defect A â€” cart identity (public/js/cart.js executed in a vm sandbox)
// ---------------------------------------------------------------------------

function makeCartSandbox(seed: any = { items: [] }) {
  const store = new Map<string, string>([["mildmate-cart", JSON.stringify(seed)]]);
  const sandbox: any = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
    },
    fetch: async () => { throw new Error("no fetch in cart sandbox"); },
    setTimeout: () => {},
    clearTimeout: () => {},
    addEventListener: () => {},
    console,
    JSON, Date, Math, Array, Object, String, Number, RegExp, Promise, Map, Set, URLSearchParams, isNaN, parseInt, parseFloat,
  };
  sandbox.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    updateCartCount: () => {},
    MildMateCart: undefined as any,
    dataLayer: [] as any[],
  };
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.window.fetch = sandbox.fetch;
  sandbox.window.setTimeout = sandbox.setTimeout;
  const src = readFileSync(path.join(ROOT, "public/js/cart.js"), "utf8");
  vm.runInNewContext(src, sandbox, { filename: "cart.js" });
  return { cart: sandbox.window.MildMateCart as any, store };
}

function readCart(store: Map<string, string>) {
  return JSON.parse(store.get("mildmate-cart") || '{"items":[]}');
}

describe("Defect A â€” cart identity and quantity handling (cart.js)", () => {
  it("two different quote_ids with IDENTICAL dimensions and different prices never merge", () => {
    const { cart, store } = makeCartSandbox();
    cart.add(quoteItem("QT-261029-002", 27, 810, 1, { w: 35, l: 37, d: 7, unit: "cm" }));
    cart.add(quoteItem("QT-261029-003", 33, 990, 1, { w: 35, l: 37, d: 7, unit: "cm" }));
    const c = readCart(store);
    expect(c.items).toHaveLength(2);
    const q2 = c.items.find((i: any) => i.quote_id === "QT-261029-002");
    const q3 = c.items.find((i: any) => i.quote_id === "QT-261029-003");
    expect(q2.price_usd).toBe(27);
    expect(q3.price_usd).toBe(33);
    expect(q2.qty).toBe(1);
    expect(q3.qty).toBe(1);
  });

  it("explicit repeated Add to Cart of the SAME approved option combines quantity", () => {
    const { cart, store } = makeCartSandbox();
    const a = quoteItem("QT-261029-003", 33, 990, 1);
    cart.add(a);
    cart.add({ ...a, id: "quote-QT-261029-003-2" }); // fresh render, explicit second add
    const c = readCart(store);
    expect(c.items).toHaveLength(1);
    expect(c.items[0].qty).toBe(2);
    expect(c.items[0].price_usd).toBe(33);
  });

  it("re-adding a re-priced quote refreshes the line to the latest approved render", () => {
    const { cart, store } = makeCartSandbox();
    cart.add(quoteItem("QT-100", 33, 990));
    cart.add(quoteItem("QT-100", 30, 900)); // admin re-priced before second explicit add
    const c = readCart(store);
    expect(c.items).toHaveLength(1);
    expect(c.items[0].qty).toBe(2);
    expect(c.items[0].price_usd).toBe(30);
    expect(c.items[0].price_thb).toBe(900);
  });

  it("quantity updates and removals affect only the intended line", () => {
    const { cart, store } = makeCartSandbox();
    cart.add(quoteItem("QT-A", 27, 810));
    cart.add(quoteItem("QT-B", 33, 990));
    const c1 = readCart(store);
    cart.updateQty(c1.items[0].id, 6);
    const c2 = readCart(store);
    expect(c2.items.find((i: any) => i.quote_id === "QT-A").qty).toBe(6);
    expect(c2.items.find((i: any) => i.quote_id === "QT-B").qty).toBe(1);
    cart.remove(c2.items.find((i: any) => i.quote_id === "QT-B").id);
    const c3 = readCart(store);
    expect(c3.items).toHaveLength(1);
    expect(c3.items[0].quote_id).toBe("QT-A");
    expect(c3.items[0].qty).toBe(6);
  });

  it("non-quote product behavior is preserved (same identity combines, different dims do not)", () => {
    const { cart, store } = makeCartSandbox();
    cart.add(productItem("standard-fitted-sheet", 50, { w: 100, l: 200, d: 25, unit: "cm" }));
    cart.add(productItem("standard-fitted-sheet", 50, { w: 100, l: 200, d: 25, unit: "cm" }));
    cart.add(productItem("standard-fitted-sheet", 60, { w: 120, l: 200, d: 25, unit: "cm" }));
    const c = readCart(store);
    expect(c.items).toHaveLength(2);
    expect(c.items.find((i: any) => i.dimensions.w === 100).qty).toBe(2);
    expect(c.items.find((i: any) => i.dimensions.w === 120).qty).toBe(1);
  });

  it("a quote item and a non-quote item with the same dims/fabric/color stay separate", () => {
    const { cart, store } = makeCartSandbox();
    const dims = { w: 88.9, l: 94, d: 17.8, unit: "cm" };
    cart.add(quoteItem("QT-261029-003", 33, 990, 1, dims));
    cart.add({ ...productItem("custom-waterproof-cushion-protector", 40, dims), fabric: "tpu", color: null });
    const c = readCart(store);
    expect(c.items).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Defect A â€” magic-link page fallback contract (functions/quote/[[path]].ts)
// ---------------------------------------------------------------------------

describe("Defect A â€” magic-link add-to-cart fallback contract", () => {
  const pageSrc = readFileSync(path.join(ROOT, "functions/quote/[[path]].ts"), "utf8");

  it("prefers MildMateCart.add and keeps the per-page-load double-add guard", () => {
    expect(pageSrc).toContain("MildMateCart.add(_quoteCartItem)");
    expect(pageSrc).toContain("if (_quoteIsAdded) return;");
  });

  it("fallback identity is quote_id only (legacy dimension-merge clause removed)", () => {
    expect(pageSrc).not.toContain("i.quote_id === _quoteCartItem.quote_id ||");
    expect(pageSrc).toContain("String(i.quote_id || '') === String(_quoteCartItem.quote_id)");
  });

  it("fallback refreshes the line with the latest approved render", () => {
    expect(pageSrc).toContain("existing.price_usd = _quoteCartItem.price_usd;");
    expect(pageSrc).toContain("existing.quote_currency = _quoteCartItem.quote_currency;");
  });

  // ── Residual A-1: the inline onclick attribute fallback must follow the
  // same identity + refresh rules (Phase 1 Condition 1 correction).
  const quoteCtaMatch = pageSrc.match(/id="quote-cta"[^>]*onclick="([^"]*)"/);
  const inlineOnclickJs = quoteCtaMatch ? quoteCtaMatch[1].replace(/&quot;/g, '"') : "";

  it("inline onclick fallback exists and contains no legacy dimension-merge clause", () => {
    expect(quoteCtaMatch).toBeTruthy();
    expect(inlineOnclickJs).toContain("else{try{");
    expect(inlineOnclickJs).not.toContain("JSON.stringify(i.dimensions)===");
    expect(inlineOnclickJs).not.toContain("i.quote_id===item.quote_id||");
  });

  it("inline onclick fallback identity is quote_id only and refreshes the line on combine", () => {
    expect(inlineOnclickJs).toContain("String(i.quote_id||'')===String(item.quote_id||'')");
    expect(inlineOnclickJs).toContain("ex.price_usd=item.price_usd;");
    expect(inlineOnclickJs).toContain("ex.free_shipping=item.free_shipping;");
  });

  function runInlineFallback(clickItem: any, existingCartItems: any[]) {
    const store = new Map<string, string>([
      ["mildmate-cart", JSON.stringify({ items: existingCartItems })],
    ]);
    const fakeButton: any = { textContent: "", style: {}, disabled: false };
    const sandbox: any = {
      window: { location: { href: "" } },
      document: {
        getElementById: (id: string) =>
          id === "quote-cart-data" ? { textContent: JSON.stringify(clickItem) } : null,
      },
      localStorage: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => store.set(k, String(v)),
      },
    };
    const handler = vm.runInNewContext(`(function(){ ${inlineOnclickJs} })`, sandbox);
    handler.call(fakeButton);
    return {
      cart: JSON.parse(store.get("mildmate-cart")!),
      redirected: sandbox.window.location.href === "/checkout/",
      button: fakeButton,
    };
  }

  it("inline onclick fallback: different quote_ids with identical dims never merge (behavioral)", () => {
    const dims = { w: 35, l: 37, d: 7, unit: "cm" };
    const qtB = { ...quoteItem("QT-261029-002", 27, 810, 1, dims) };
    const qtA = { ...quoteItem("QT-261029-001", 33, 990, 1, dims) };
    const { cart, redirected } = runInlineFallback(qtA, [qtB]);
    expect(redirected).toBe(true);
    expect(cart.items).toHaveLength(2);
    expect(cart.items.find((i: any) => i.quote_id === "QT-261029-001").price_usd).toBe(33);
    expect(cart.items.find((i: any) => i.quote_id === "QT-261029-002").price_usd).toBe(27);
  });

  it("inline onclick fallback: explicit re-add of the same quote combines qty and refreshes the line (behavioral)", () => {
    const stale = { ...quoteItem("QT-261029-003", 33, 990, 1), price_usd: 30, quote_currency: "USD", free_shipping: false };
    const fresh = { ...quoteItem("QT-261029-003", 35, 1050, 1, { w: 90, l: 95, d: 18, unit: "cm" }), free_shipping: true };
    const { cart } = runInlineFallback(fresh, [stale]);
    expect(cart.items).toHaveLength(1);
    const line = cart.items[0];
    expect(line.qty).toBe(2);
    expect(line.price_usd).toBe(35);
    expect(line.price_thb).toBe(1050);
    expect(line.dimensions).toEqual({ w: 90, l: 95, d: 18, unit: "cm" });
    expect(line.free_shipping).toBe(true);
  });

  it("inline onclick fallback adds a new quote line when the cart is empty (behavioral)", () => {
    const qt = quoteItem("QT-261029-003", 33, 990, 1);
    const { cart, redirected, button } = runInlineFallback(qt, []);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quote_id).toBe("QT-261029-003");
    expect(redirected).toBe(true);
    expect(button.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Shared fake D1
// ---------------------------------------------------------------------------

class LiteD1 {
  quotes = new Map<string, any>();
  snapshots = new Map<string, { items_json: string; currency: string }>();
  orders: any[] = [];
  claims = new Map<string, boolean>();
  nextOrderId = 1;

  prepare(sql: string) {
    return new LiteStmt(this, sql);
  }
}

function norm(sql: string) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

class LiteStmt {
  private args: any[] = [];
  constructor(private db: LiteD1, private sqlRaw: string) {}
  bind(...args: any[]) { this.args = args; return this; }
  async first() { return execLite(this.db, norm(this.sqlRaw), this.args, "first"); }
  async all() { return execLite(this.db, norm(this.sqlRaw), this.args, "all"); }
  async run() { return execLite(this.db, norm(this.sqlRaw), this.args, "run"); }
  catch() { return this as any; }
}

async function execLite(db: LiteD1, sql: string, args: any[], mode: string): Promise<any> {
  if (sql.startsWith("pragma table_info(orders)")) {
    return { results: [{ name: "quote_id" }, { name: "customer_note_type" }, { name: "customer_note" }] };
  }
  if (sql.startsWith("create table if not exists") || sql.startsWith("create index if not exists") || sql.startsWith("create unique index if not exists")) {
    return { success: true, meta: { changes: 1 } };
  }
  if (sql.includes("from sqlite_master") && sql.includes("stripe_order_fulfillment_lines")) {
    return { name: "stripe_order_fulfillment_lines" };
  }
  if (sql.includes("from marketing_campaigns")) {
    return { results: [] };
  }
  if (sql.includes("from pricing_params") && sql.includes("usd_rate")) {
    return { param_value: "30" };
  }
  if (sql.includes("from custom_quotes where quote_id = ?1") && sql.includes("status, quoted_price")) {
    return db.quotes.get(String(args[0])) || null;
  }
  if (sql.startsWith("select dimensions from custom_quotes")) {
    return { dimensions: db.quotes.get(String(args[0]))?.dimensions || null };
  }
  if (sql.startsWith("insert or replace into checkout_session_snapshots")) {
    db.snapshots.set(String(args[0]), { items_json: String(args[3]), currency: String(args[2]) });
    return { success: true, meta: { changes: 1 } };
  }
  if (sql.startsWith("select items_json, currency from checkout_session_snapshots")) {
    const row = db.snapshots.get(String(args[0]));
    return row ? { items_json: row.items_json, currency: row.currency } : null;
  }
  if (sql.startsWith("select items_json, currency, attribution_json, quote_ids_json from checkout_session_snapshots")) {
    const row = db.snapshots.get(String(args[0]));
    return row ? { items_json: row.items_json, currency: row.currency, attribution_json: null, quote_ids_json: null } : null;
  }
  if (sql.startsWith("insert into quote_acquisition_attribution")) {
    return { success: true, meta: { changes: 1 } };
  }
  if (sql.includes("from abandoned_carts") && sql.startsWith("select")) {
    return null;
  }
  if (sql.startsWith("insert into abandoned_carts") || sql.startsWith("update abandoned_carts")) {
    return { success: true, meta: { changes: 1 } };
  }
  if (sql.startsWith("insert or ignore into stripe_order_fulfillment_lines")) {
    const key = String(args[0]);
    if (db.claims.has(key)) return { success: true, meta: { changes: 0 } };
    db.claims.set(key, true);
    return { success: true, meta: { changes: 1 } };
  }
  if (sql.startsWith("select count(*)") && sql.includes("from orders")) {
    const [sessionId, slug, title, , , , , , , , currency, qty] = args;
    const c = db.orders.filter((o: any) =>
      o.stripe_session_id === sessionId &&
      String(o.product_slug || "") === String(slug || "") &&
      String(o.product_title_en || "") === String(title || "") &&
      String(o.currency || "") === String(currency || "") &&
      Number(o.quantity) === Number(qty)
    ).length;
    return { c };
  }
  if (sql.startsWith("select id, stripe_session_id, stripe_payment_intent_id")) {
    const rows = db.orders.filter((o: any) => o.stripe_session_id === String(args[0]));
    return { results: rows.map((o: any) => ({ ...o })) };
  }
  if (sql.startsWith("select id from orders where stripe_session_id = ?1")) {
    const row = db.orders.find((o: any) => o.stripe_session_id === String(args[0]));
    return row ? { id: row.id } : null;
  }
  if (sql.startsWith("insert into orders (")) {
    const a = args;
    db.orders.push({
      id: db.nextOrderId++,
      stripe_session_id: a[0],
      stripe_payment_intent_id: a[1],
      email: a[2],
      customer_name: a[3],
      phone: a[4],
      shipping_address: a[5],
      product_slug: a[6],
      product_title_en: a[7],
      fabric: a[8],
      color: a[9],
      width_cm: a[10],
      length_cm: a[11],
      depth_cm: a[12],
      width_in: a[13],
      length_in: a[14],
      depth_in: a[15],
      custom_notes: a[16],
      price_usd: a[17],
      price_thb: a[18],
      currency: a[19],
      quantity: a[20],
      discount_code: a[21],
      quote_id: a[22],
      status: "confirmed",
      created_at: new Date().toISOString(),
    });
    return { success: true, meta: { changes: 1 } };
  }
  if (sql.startsWith("select event_id from stripe_webhook_events")) {
    return null;
  }
  throw new Error(`Unhandled SQL in LiteD1 (${mode}): ${sql}`);
}

// ---------------------------------------------------------------------------
// Defect A â€” checkout charges the D1-approved quote price, never client values
// ---------------------------------------------------------------------------

function stripeCaptureFetch(captured: { url: string; body: string }[]) {
  return vi.fn(async (url: any, init: any) => {
    const s = String(url);
    if (s.startsWith("https://api.stripe.com/v1/checkout/sessions") && (init?.method || "").toUpperCase() === "POST") {
      captured.push({ url: s, body: String(init.body || "") });
      return new Response(JSON.stringify({ id: "cs_test_capture", url: "https://checkout.stripe.com/test" }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  }) as any;
}

function parseStripeLineItems(body: string) {
  const params = new URLSearchParams(body);
  const items: { unit: number; qty: number; name: string }[] = [];
  for (let i = 0; ; i++) {
    const unit = params.get(`line_items[${i}][price_data][unit_amount]`);
    if (unit === null) break;
    items.push({
      unit: Number(unit),
      qty: Number(params.get(`line_items[${i}][quantity]`) || 1),
      name: String(params.get(`line_items[${i}][price_data][product_data][name]`) || ""),
    });
  }
  return items;
}

describe("Defect A â€” checkout charges D1-approved quote prices", () => {
  let captured: { url: string; body: string }[];
  let db: LiteD1;

  beforeEach(() => {
    captured = [];
    db = new LiteD1();
    db.quotes.set("QT-261029-003", {
      status: "approved", quoted_price: 990, quoted_price_usd: 33, free_shipping: 0,
      dimensions: JSON.stringify({ w: 88.9, l: 94, d: 17.8, unit: "cm" }),
    });
    db.quotes.set("QT-261029-002", {
      status: "approved", quoted_price: 810, quoted_price_usd: 27, free_shipping: 0,
      dimensions: JSON.stringify({ w: 35, l: 37, d: 7, unit: "cm" }),
    });
    db.quotes.set("QT-PENDING", { status: "pending", quoted_price: 100, quoted_price_usd: 3, free_shipping: 0 });
  });

  it("a tampered client price is ignored â€” Stripe charges the approved $33 for 6 units", async () => {
    vi.stubGlobal("fetch", stripeCaptureFetch(captured));
    const tampered = { ...quoteItem("QT-261029-003", 1, 30, 6) }; // client claims $1/unit
    const req = new Request("https://www.mildmate.com/api/checkout", {
      method: "POST",
      body: JSON.stringify({ items: [tampered], email: "buyer@example.com", shipping_country: "US" }),
    });
    const resp = await handleCheckout(req, { DB: db, STRIPE_SECRET_KEY: "sk_live_xxx", RUNTIME_ENV: "production", D1_ENV_LABEL: "prod" });
    expect(resp.status).toBe(200);
    const items = parseStripeLineItems(captured[0].body).filter((i) => !/^shipping/i.test(i.name));
    expect(items).toHaveLength(1);
    expect(items[0].unit).toBe(3300);
    expect(items[0].qty).toBe(6);
    // Snapshot records the authorized price too
    const snap = db.snapshots.get("cs_test_capture");
    const snapItems = JSON.parse(snap!.items_json);
    expect(snapItems[0].u).toBe(3300);
    expect(snapItems[0].quote_id).toBe("QT-261029-003");
    expect(snapItems[0].qty).toBe(6);
  });

  it("two approved options with identical dims stay two lines at their own approved prices", async () => {
    vi.stubGlobal("fetch", stripeCaptureFetch(captured));
    const dims = { w: 35, l: 37, d: 7, unit: "cm" };
    const req = new Request("https://www.mildmate.com/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        items: [quoteItem("QT-261029-002", 27, 810, 1, dims), quoteItem("QT-261029-003", 33, 990, 3, dims)],
        email: "buyer@example.com",
        shipping_country: "US",
      }),
    });
    const resp = await handleCheckout(req, { DB: db, STRIPE_SECRET_KEY: "sk_live_xxx", RUNTIME_ENV: "production", D1_ENV_LABEL: "prod" });
    expect(resp.status).toBe(200);
    const items = parseStripeLineItems(captured[0].body).filter((i) => !/^shipping/i.test(i.name));
    expect(items).toHaveLength(2);
    const byUnit = items.map((i) => i.unit).sort((a, b) => a - b);
    expect(byUnit).toEqual([2700, 3300]);
    expect(items.find((i) => i.unit === 3300)!.qty).toBe(3);
  });

  it("THB session charges the approved THB price (satang), TH/EN parity for quote pricing", async () => {
    vi.stubGlobal("fetch", stripeCaptureFetch(captured));
    const req = new Request("https://www.mildmate.com/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        items: [quoteItem("QT-261029-003", 33, 990, 2)],
        email: "buyer@example.com",
        shipping_country: "TH",
      }),
    });
    const resp = await handleCheckout(req, { DB: db, STRIPE_SECRET_KEY: "sk_live_xxx", RUNTIME_ENV: "production", D1_ENV_LABEL: "prod" });
    expect(resp.status).toBe(200);
    const items = parseStripeLineItems(captured[0].body).filter((i) => !/^shipping/i.test(i.name));
    expect(items[0].unit).toBe(99000); // 990 THB in satang
    expect(items[0].qty).toBe(2);
  });

  it("unapproved quotes still block checkout (existing gate preserved)", async () => {
    vi.stubGlobal("fetch", stripeCaptureFetch(captured));
    const req = new Request("https://www.mildmate.com/api/checkout", {
      method: "POST",
      body: JSON.stringify({ items: [quoteItem("QT-PENDING", 3, 100, 1)], email: "buyer@example.com", shipping_country: "US" }),
    });
    const resp = await handleCheckout(req, { DB: db, STRIPE_SECRET_KEY: "sk_live_xxx", RUNTIME_ENV: "production", D1_ENV_LABEL: "prod" });
    expect(resp.status).toBe(400);
    expect(captured).toHaveLength(0);
  });

  it("non-quote products still use client-supplied original prices (regression guard)", async () => {
    vi.stubGlobal("fetch", stripeCaptureFetch(captured));
    const req = new Request("https://www.mildmate.com/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        items: [{ ...productItem("standard-fitted-sheet", 50, { w: 100, l: 200, d: 25, unit: "cm" }), original_price_usd: 60 }],
        email: "buyer@example.com",
        shipping_country: "US",
      }),
    });
    const resp = await handleCheckout(req, { DB: db, STRIPE_SECRET_KEY: "sk_live_xxx", RUNTIME_ENV: "production", D1_ENV_LABEL: "prod" });
    expect(resp.status).toBe(200);
    const items = parseStripeLineItems(captured[0].body).filter((i) => !/^shipping/i.test(i.name));
    expect(items[0].unit).toBe(6000);
  });
});

// ---------------------------------------------------------------------------
// Defect B â€” client-polling reconciliation
// ---------------------------------------------------------------------------

function reconcileFetch(session: any, lineItems: any[]) {
  return vi.fn(async (url: any) => {
    const s = String(url);
    if (s.includes("/v1/checkout/sessions/") && !s.includes("/line_items")) {
      return new Response(JSON.stringify(session), { status: 200 });
    }
    if (s.includes("/line_items")) {
      return new Response(JSON.stringify({ data: lineItems }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  }) as any;
}

function prodEnv(db: LiteD1) {
  return { DB: db, STRIPE_SECRET_KEY: "sk_live_xxx", RUNTIME_ENV: "production", D1_ENV_LABEL: "prod" };
}

const PAID_SESSION = {
  id: "cs_live_paid_1",
  payment_intent: "pi_live_1",
  payment_status: "paid",
  status: "complete",
  currency: "usd",
  metadata: { email: "buyer@example.com", name: "Test Buyer" },
};

describe("Defect B â€” reconcile source priority, quote_id retention, shipping exclusion", () => {
  let db: LiteD1;
  beforeEach(() => { db = new LiteD1(); });

  it("snapshot wins over Stripe line_items: quote_ids retained, shipping line never becomes an order row", async () => {
    db.snapshots.set("cs_live_paid_1", {
      currency: "usd",
      items_json: JSON.stringify([
        { slug: "custom-waterproof-cushion-protector", name: "Custom Waterproof Cushion Protector", quote_id: "QT-261029-003", fabric: "tpu", color: null, dims: { w: 88.9, l: 94, d: 17.8, unit: "cm" }, qty: 6, u: 3300 },
        { slug: "custom-waterproof-cushion-protector", name: "Custom Waterproof Cushion Protector", quote_id: "QT-261029-002", fabric: "tpu", color: null, dims: { w: 35, l: 37, d: 7, unit: "cm" }, qty: 1, u: 2700 },
      ]),
    });
    const shippingLine = { description: "Shipping (United States)", quantity: 1, amount_total: 8960, price: { unit_amount: 8960, product_data: { name: "Shipping (United States)" } } };
    vi.stubGlobal("fetch", reconcileFetch(PAID_SESSION, [shippingLine]));

    const req = new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_live_paid_1");
    const resp = await handleOrderConfirmed(req, prodEnv(db));
    const data = await resp.json() as any;
    expect(data.payment_verified).toBe(true);
    expect(data.orders).toHaveLength(2);
    // Stripe description was never used: names come from the snapshot
    expect(data.orders.every((o: any) => o.product_title_en === "Custom Waterproof Cushion Protector")).toBe(true);
    expect(data.orders.some((o: any) => o.quote_id === "QT-261029-003")).toBe(true);
    expect(data.orders.some((o: any) => o.quote_id === "QT-261029-002")).toBe(true);
    expect(data.orders.some((o: any) => o.quote_id === null)).toBe(false);
    // Shipping excluded from product revenue: 6*33 + 1*27 = 225
    expect(data.purchase_reportable_value).toBe(225);
    const q3 = db.orders.find((o: any) => o.quote_id === "QT-261029-003");
    expect(q3.quantity).toBe(6);
    expect(q3.price_usd).toBe(33);
    expect(q3.width_cm).toBe(88.9);
  });

  it("metadata fallback retains quote_id when no snapshot exists", async () => {
    const session = {
      ...PAID_SESSION,
      metadata: {
        email: "buyer@example.com",
        items: JSON.stringify([{ slug: "cwcp", name: "Cushion Protector", quote_id: "QT-261029-003", qi: undefined, fabric: "tpu", color: null, dims: { w: 88.9, l: 94, d: 17.8, unit: "cm" }, qty: 6, u: 3300 }]),
      },
    };
    vi.stubGlobal("fetch", reconcileFetch(session, []));
    const req = new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_live_paid_1");
    const resp = await handleOrderConfirmed(req, prodEnv(db));
    const data = await resp.json() as any;
    expect(data.orders).toHaveLength(1);
    expect(db.orders[0].quote_id).toBe("QT-261029-003");
    expect(db.orders[0].quantity).toBe(6);
  });

  it("last-resort Stripe line_items path excludes the shipping line and keeps no quote_id guessing", async () => {
    const productLine = { description: "Standard Fitted Sheet | Fabric: CloudSoft", quantity: 2, amount_total: 10000, price: { unit_amount: 5000, product_data: { name: "Standard Fitted Sheet" } } };
    const shippingLine = { description: "Shipping (United States)", quantity: 1, amount_total: 8960, price: { unit_amount: 8960, product_data: { name: "Shipping (United States)" } } };
    vi.stubGlobal("fetch", reconcileFetch({ ...PAID_SESSION, metadata: { email: "buyer@example.com" } }, [productLine, shippingLine]));
    const req = new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_live_paid_1");
    const resp = await handleOrderConfirmed(req, prodEnv(db));
    const data = await resp.json() as any;
    expect(data.orders).toHaveLength(1);
    expect(db.orders[0].product_title_en).toBe("Standard Fitted Sheet | Fabric: CloudSoft");
    expect(db.orders[0].quantity).toBe(2);
    expect(db.orders[0].quote_id).toBeNull();
  });

  it("duplicate client polling inserts no additional rows", async () => {
    db.snapshots.set("cs_live_paid_1", {
      currency: "usd",
      items_json: JSON.stringify([
        { slug: "cwcp", name: "Cushion Protector", quote_id: "QT-261029-003", fabric: "tpu", color: null, dims: { w: 88.9, l: 94, d: 17.8, unit: "cm" }, qty: 6, u: 3300 },
      ]),
    });
    vi.stubGlobal("fetch", reconcileFetch(PAID_SESSION, []));
    const req = new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_live_paid_1");
    await handleOrderConfirmed(req, prodEnv(db));
    await handleOrderConfirmed(req, prodEnv(db));
    await handleOrderConfirmed(req, prodEnv(db));
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].quote_id).toBe("QT-261029-003");
  });

  it("unpaid sessions never create rows (existing payment-verification gate preserved)", async () => {
    vi.stubGlobal("fetch", reconcileFetch({ ...PAID_SESSION, payment_status: "unpaid" }, []));
    const req = new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_live_paid_1");
    const resp = await handleOrderConfirmed(req, prodEnv(db));
    const data = await resp.json() as any;
    expect(data.pending).toBe(true);
    expect(db.orders).toHaveLength(0);
  });

  it("quote line with missing dims is hydrated from the approved quote row", async () => {
    db.quotes.set("QT-261029-003", {
      status: "approved", quoted_price: 990, quoted_price_usd: 33, free_shipping: 0,
      dimensions: JSON.stringify({ w: 88.9, l: 94, d: 17.8, unit: "cm" }),
    });
    db.snapshots.set("cs_live_paid_1", {
      currency: "usd",
      items_json: JSON.stringify([
        { slug: "cwcp", name: "Cushion Protector", quote_id: "QT-261029-003", fabric: "tpu", color: null, qty: 1, u: 3300 },
      ]),
    });
    vi.stubGlobal("fetch", reconcileFetch(PAID_SESSION, []));
    const req = new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_live_paid_1");
    await handleOrderConfirmed(req, prodEnv(db));
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].width_cm).toBe(88.9);
    expect(db.orders[0].length_cm).toBe(94);
    expect(db.orders[0].depth_cm).toBe(17.8);
    expect(db.orders[0].quote_id).toBe("QT-261029-003");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
