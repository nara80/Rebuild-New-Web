// Phase 1 Final Release Safety Gate — Gate B: cross-path Stripe idempotency
// Proves webhook→poll AND poll→webhook execution orders (plus repeated and
// near-concurrent attempts) produce exactly one set of order rows, with
// quote_id retention, approved prices/quantities, no shipping rows,
// product revenue excluding shipping, and no paid rows for unpaid sessions.
// The fake D1 below supports the UNION of SQL issued by workers/api/webhook.ts
// (migration 057 idempotency flow) and workers/api/order-confirmed.ts
// (client-poll reconcile). All fixtures are synthetic; no network, no prod data.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleStripeWebhook } from "../webhook";
import { handleOrderConfirmed } from "../order-confirmed";
import { sendEmail } from "../email";

vi.mock("../email", () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
}));

const PAID_OR_HISTORICAL_STATUSES = new Set([
  "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded",
]);

class CombinedD1 {
  orders: any[] = [];
  webhookEvents = new Map<string, any>();
  fulfillmentLines = new Map<string, any>();
  snapshots = new Map<string, { items_json: string; currency: string; attribution_json?: string | null; quote_ids_json?: string | null }>();
  customQuotes = new Map<string, { dimensions: string }>();
  customerAddresses = new Set<string>();
  thankyouByOrder = new Map<string, any>();
  nextOrderId = 1;

  prepare(sql: string) {
    return new CombinedStmt(this, sql);
  }
}

class CombinedStmt {
  private args: any[] = [];
  constructor(private db: CombinedD1, private sql: string) {}
  bind(...args: any[]) {
    this.args = args;
    return this;
  }
  async first() {
    return exec(this.db, this.sql, this.args);
  }
  async all() {
    const out = await exec(this.db, this.sql, this.args);
    if (out && Array.isArray(out.results)) return out;
    if (out && out !== null && typeof out === "object" && !out.results) return { results: [out] };
    return { results: [] };
  }
  async run() {
    return exec(this.db, this.sql, this.args);
  }
}

function norm(sql: string) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

async function exec(db: CombinedD1, sqlRaw: string, args: any[]): Promise<any> {
  const sql = norm(sqlRaw);

  // ── shared schema ensures ──
  if (sql.startsWith("pragma table_info(orders)")) {
    return { results: [{ name: "quote_id" }, { name: "customer_note_type" }, { name: "customer_note" }] };
  }
  if (sql.startsWith("pragma table_info(quote_acquisition_attribution)")) {
    return {
      results: [
        { name: "quote_id" }, { name: "email" }, { name: "schema_version" }, { name: "first_touch_json" },
        { name: "quote_session_json" }, { name: "checkout_session_json" }, { name: "consent_state_json" },
        { name: "quote_session_captured_at" }, { name: "checkout_session_captured_at" }, { name: "checkout_stripe_session_id" },
        { name: "created_at" }, { name: "updated_at" },
      ],
    };
  }
  if (sql.includes("from sqlite_master") && sql.includes("stripe_webhook_events")) return { name: "stripe_webhook_events" };
  if (sql.includes("from sqlite_master") && sql.includes("stripe_order_fulfillment_lines")) return { name: "stripe_order_fulfillment_lines" };
  if (sql.startsWith("create table if not exists") || sql.startsWith("create index if not exists")) {
    return { success: true, meta: { changes: 0 } };
  }
  if (sql.startsWith("alter table orders add column")) {
    return { success: true, meta: { changes: 1 } };
  }

  // ── checkout_session_snapshots (webhook selects without currency; reconcile with) ──
  if (sql.includes("select items_json, currency from checkout_session_snapshots")) {
    const snap = db.snapshots.get(String(args[0] || ""));
    return snap ? { items_json: snap.items_json, currency: snap.currency } : null;
  }
  if (sql.includes("select items_json, currency, attribution_json, quote_ids_json from checkout_session_snapshots")) {
    const snap = db.snapshots.get(String(args[0] || ""));
    return snap
      ? { items_json: snap.items_json, currency: snap.currency, attribution_json: snap.attribution_json || null, quote_ids_json: snap.quote_ids_json || null }
      : null;
  }
  if (sql.includes("select items_json, attribution_json, quote_ids_json from checkout_session_snapshots")) {
    const snap = db.snapshots.get(String(args[0] || ""));
    return snap
      ? { items_json: snap.items_json, attribution_json: snap.attribution_json || null, quote_ids_json: snap.quote_ids_json || null }
      : null;
  }
  if (sql.includes("select items_json from checkout_session_snapshots")) {
    const snap = db.snapshots.get(String(args[0] || ""));
    return snap ? { items_json: snap.items_json } : null;
  }

  // ── stripe_webhook_events idempotency (webhook only; evidence read is shared) ──
  if (sql.startsWith("insert or ignore into stripe_webhook_events")) {
    const [eventId, eventType, sessionId] = args;
    if (!db.webhookEvents.has(String(eventId))) {
      db.webhookEvents.set(String(eventId), {
        event_id: String(eventId),
        event_type: eventType,
        stripe_session_id: sessionId,
        processing_token: null,
        processed_at: null,
        process_result: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      });
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 0 } };
  }
  if (sql.startsWith("update stripe_webhook_events set processing_token")) {
    const [eventId, token] = args;
    const row = db.webhookEvents.get(String(eventId));
    const isStale =
      !!row?.updated_at &&
      Date.now() - new Date(String(row.updated_at)).getTime() > 10 * 60 * 1000;
    if (row && !row.processed_at && (!row.processing_token || isStale)) {
      row.processing_token = token;
      row.updated_at = new Date().toISOString();
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 0 } };
  }
  if (sql.startsWith("select processed_at from stripe_webhook_events")) {
    const row = db.webhookEvents.get(String(args[0]));
    return row ? { processed_at: row.processed_at } : null;
  }
  if (sql.includes("from stripe_webhook_events") && sql.includes("where stripe_session_id = ?1")) {
    // hasWebhookPaidEvidence — read by BOTH the poll and the webhook
    const sessionId = String(args[0]);
    const row = Array.from(db.webhookEvents.values()).find((r: any) =>
      String(r.stripe_session_id || "") === sessionId &&
      !!r.processed_at &&
      (r.process_result === "processed" || r.process_result === "deduped_no_new_rows") &&
      (r.event_type === "checkout.session.completed" || r.event_type === "checkout.session.async_payment_succeeded")
    );
    return row ? { event_id: row.event_id } : null;
  }
  if (sql.startsWith("update stripe_webhook_events set processed_at")) {
    const [eventId, token, processResult] = args;
    const row = db.webhookEvents.get(String(eventId));
    if (row && row.processing_token === token) {
      row.processed_at = new Date().toISOString();
      row.processing_token = null;
      row.process_result = processResult;
      row.last_error = null;
      row.updated_at = new Date().toISOString();
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 0 } };
  }
  if (sql.startsWith("update stripe_webhook_events set last_error")) {
    const [eventId, token, err] = args;
    const row = db.webhookEvents.get(String(eventId));
    if (row && row.processing_token === token) {
      row.last_error = String(err);
      row.processing_token = null;
      row.updated_at = new Date().toISOString();
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 0 } };
  }

  // ── shared fulfillment-line claim space (INSERT OR IGNORE on line_key) ──
  if (sql.startsWith("insert or ignore into stripe_order_fulfillment_lines")) {
    const [lineKey, sessionId, eventId, lineIndex] = args;
    if (db.fulfillmentLines.has(String(lineKey))) {
      return { success: true, meta: { changes: 0 } };
    }
    db.fulfillmentLines.set(String(lineKey), {
      line_key: String(lineKey),
      stripe_session_id: String(sessionId),
      stripe_event_id: eventId ? String(eventId) : null,
      line_index: Number(lineIndex || 0),
    });
    return { success: true, meta: { changes: 1 } };
  }
  if (sql.startsWith("delete from stripe_order_fulfillment_lines where line_key")) {
    db.fulfillmentLines.delete(String(args[0]));
    return { success: true, meta: { changes: 1 } };
  }

  // ── quote dimension hydration (shared by both paths) ──
  if (sql.startsWith("select dimensions from custom_quotes")) {
    const q = db.customQuotes.get(String(args[0]));
    return q ? { dimensions: q.dimensions } : null;
  }

  // ── orders reads ──
  // count of existing confirmed lines for a session (shared by both paths)
  if (sql.includes("from orders") && sql.includes("coalesce(product_slug")) {
    const [sessionId, productSlug, productTitle, fabric, color, widthCm, lengthCm, depthCm, priceUsd, priceThb, currency, qty] = args;
    const matching = db.orders.filter((o) =>
      o.stripe_session_id === sessionId &&
      PAID_OR_HISTORICAL_STATUSES.has(String(o.status || "").toLowerCase()) &&
      String(o.product_slug || "") === String(productSlug || "") &&
      String(o.product_title_en || "") === String(productTitle || "") &&
      String(o.fabric || "") === String(fabric || "") &&
      String(o.color || "") === String(color || "") &&
      ((o.width_cm == null && widthCm == null) || Number(o.width_cm) === Number(widthCm)) &&
      ((o.length_cm == null && lengthCm == null) || Number(o.length_cm) === Number(lengthCm)) &&
      ((o.depth_cm == null && depthCm == null) || Number(o.depth_cm) === Number(depthCm)) &&
      ((o.price_usd == null && priceUsd == null) || Number(o.price_usd) === Number(priceUsd)) &&
      ((o.price_thb == null && priceThb == null) || Number(o.price_thb) === Number(priceThb)) &&
      String(o.currency || "") === String(currency || "") &&
      Number(o.quantity || 0) === Number(qty || 0)
    );
    return { c: matching.length };
  }
  // single paid row for session (reconcile existing check)
  if (sql.includes("from orders") && sql.includes("where stripe_session_id = ?1") && sql.includes("limit 1") && sql.includes("lower(coalesce(status")) {
    return db.orders.find((o) =>
      o.stripe_session_id === args[0] &&
      PAID_OR_HISTORICAL_STATUSES.has(String(o.status || "").toLowerCase())
    ) || null;
  }
  // all paid rows for session (getOrdersBySession)
  if (
    sql.includes("from orders") &&
    sql.includes("where stripe_session_id = ?1") &&
    sql.includes("lower(coalesce(status") &&
    sql.includes("order by created_at desc")
  ) {
    const rows = db.orders
      .filter((o) =>
        o.stripe_session_id === args[0] &&
        PAID_OR_HISTORICAL_STATUSES.has(String(o.status || "").toLowerCase())
      )
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return { results: rows };
  }

  // ── orders inserts: webhook 25-arg variant (note columns) and reconcile 23-arg variant ──
  if (sql.startsWith("insert into orders")) {
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
      quote_id: a[22] ?? null,
      customer_note_type: a[23] ?? null,
      customer_note: a[24] ?? null,
      status: "confirmed",
      created_at: new Date(Date.now() + db.nextOrderId).toISOString(),
    });
    return { success: true, meta: { changes: 1 } };
  }

  // ── side-effect SQL from the webhook's promo/thank-you/email flow ──
  if (sql.includes("from custom_quotes where quote_id")) return null;
  if (sql.includes("select id from promo_codes")) return null;
  if (sql.startsWith("update promo_codes")) return { success: true, meta: { changes: 0 } };
  if (sql.startsWith("insert into promo_redemptions")) return { success: true, meta: { changes: 1 } };
  if (sql.startsWith("update discount_claims set status")) return { success: true, meta: { changes: 1 } };
  if (sql.startsWith("update abandoned_carts")) return { success: true, meta: { changes: 0 } };
  if (sql.includes("select id from customer_addresses where email")) {
    const key = `${args[0]}|${args[1]}`;
    return db.customerAddresses.has(key) ? { id: 1 } : null;
  }
  if (sql.startsWith("insert into customer_addresses")) {
    db.customerAddresses.add(`${args[0]}|${args[5]}`);
    return { success: true, meta: { changes: 1 } };
  }
  if (sql.startsWith("select key, value from recovery_config")) return { results: [] };
  if (sql.includes("select id from thankyou_queue where order_id")) {
    return db.thankyouByOrder.get(String(args[0])) ? { id: 1 } : null;
  }
  if (sql.includes("select code, expires_at from discount_claims")) return null;
  if (sql.startsWith("insert into discount_claims")) return { success: true, meta: { changes: 1 } };
  if (sql.startsWith("insert into thankyou_queue")) {
    db.thankyouByOrder.set(String(args[0]), { email: args[1] });
    return { success: true, meta: { changes: 1 } };
  }
  if (sql.startsWith("insert into quote_acquisition_attribution")) {
    return { success: true, meta: { changes: 1 } };
  }

  throw new Error(`Unhandled SQL in cross-path fake D1: ${sqlRaw}`);
}

// ── fixtures ──
const SNAPSHOT_ITEMS = [
  { slug: "custom-waterproof-cushion-protector", name: "Custom Waterproof Cushion Protector", quote_id: "QT-261029-003", fabric: "tpu", color: null, dims: { w: 88.9, l: 94, d: 17.8, unit: "cm" }, qty: 6, u: 3300 },
  { slug: "custom-waterproof-cushion-protector", name: "Custom Waterproof Cushion Protector", quote_id: "QT-261029-002", fabric: "tpu", color: null, dims: { w: 35, l: 37, d: 7, unit: "cm" }, qty: 1, u: 2700 },
];
const STRIPE_LINE_ITEMS = [
  { description: "Custom Waterproof Cushion Protector", quantity: 6, amount_total: 19800, price: { unit_amount: 3300, product_data: { name: "Custom Waterproof Cushion Protector" } } },
  { description: "Custom Waterproof Cushion Protector", quantity: 1, amount_total: 2700, price: { unit_amount: 2700, product_data: { name: "Custom Waterproof Cushion Protector" } } },
  { description: "Shipping (United States)", quantity: 1, amount_total: 8960, price: { unit_amount: 8960, product_data: { name: "Shipping (United States)" } } },
];

function quoteSession(overrides: Record<string, any> = {}) {
  return {
    id: "cs_gate_b_1",
    payment_intent: "pi_gate_b_1",
    payment_status: "paid",
    status: "complete",
    currency: "usd",
    // gross Stripe total: 198.00 products + 27.00 product + 89.60 shipping = 314.60
    amount_total: 31460,
    metadata: {
      email: "buyer@example.com",
      name: "Gate B Buyer",
      phone: "+66 2 000 0000",
      address: "1 Test Rd, Bangkok, TH",
      items: JSON.stringify(SNAPSHOT_ITEMS),
    },
    ...overrides,
  };
}

async function signStripePayload(payload: string, secret: string) {
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const content = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${hex}`;
}

async function callWebhook(db: CombinedD1, session: any, eventId: string, eventType = "checkout.session.completed") {
  const event = { id: eventId, type: eventType, data: { object: session } };
  const body = JSON.stringify(event);
  const signature = await signStripePayload(body, "whsec_test");
  const req = new Request("https://www.mildmate.com/api/webhook/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature, "content-type": "application/json" },
    body,
  });
  return handleStripeWebhook(req, {
    DB: db,
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    RESEND_API_KEY: "",
    STRIPE_ENV_MODE: "live",
  });
}

function pollRequest(sessionId: string) {
  return new Request(`https://www.mildmate.com/api/order-confirmed?session_id=${encodeURIComponent(sessionId)}`);
}

function prodEnv(db: CombinedD1) {
  return {
    DB: db,
    STRIPE_SECRET_KEY: "sk_live_xxx",
    RUNTIME_ENV: "production",
    D1_ENV_LABEL: "prod",
  };
}

function stubStripeFetch(session: any, lineItems: any[]) {
  vi.stubGlobal("fetch", vi.fn(async (input: any) => {
    const url = String(typeof input === "string" ? input : input?.url || "");
    if (url.includes("/line_items")) {
      return new Response(JSON.stringify({ object: "list", data: lineItems }), { status: 200 });
    }
    return new Response(JSON.stringify(session), { status: 200 });
  }));
}

function seedSnapshot(db: CombinedD1, sessionId: string, items = SNAPSHOT_ITEMS, currency = "usd") {
  db.snapshots.set(sessionId, { items_json: JSON.stringify(items), currency });
}

function assertSingleCorrectRowSet(db: CombinedD1) {
  const rows = db.orders;
  expect(rows).toHaveLength(2);
  const q3 = rows.find((o) => o.quote_id === "QT-261029-003");
  const q2 = rows.find((o) => o.quote_id === "QT-261029-002");
  expect(q3).toBeTruthy();
  expect(q2).toBeTruthy();
  expect(q3.quantity).toBe(6);
  expect(q3.price_usd).toBe(33);
  expect(q3.price_thb).toBeNull();
  expect(q3.width_cm).toBe(88.9);
  expect(q3.length_cm).toBe(94);
  expect(q3.depth_cm).toBe(17.8);
  expect(q3.currency).toBe("usd");
  expect(q3.status).toBe("confirmed");
  expect(q2.quantity).toBe(1);
  expect(q2.price_usd).toBe(27);
  expect(q2.width_cm).toBe(35);
  expect(q2.length_cm).toBe(37);
  expect(q2.depth_cm).toBe(7);
  // shipping never becomes an order row
  expect(rows.some((o) => /shipping/i.test(String(o.product_title_en || "")))).toBe(false);
  expect(rows.some((o) => Number(o.price_usd) === 89.6)).toBe(false);
  // no rows without quote attribution on this synthetic quote session
  expect(rows.some((o) => !o.quote_id)).toBe(false);
}

describe("Gate B — cross-path Stripe idempotency (webhook ↔ client-poll reconcile)", () => {
  let db: CombinedD1;

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    db = new CombinedD1();
  });

  it("Scenario 1: webhook first → client poll afterward inserts nothing and reports the same single row set", async () => {
    seedSnapshot(db, "cs_gate_b_1");
    const session = quoteSession();
    stubStripeFetch(session, STRIPE_LINE_ITEMS);

    const w = await callWebhook(db, session, "evt_gate_b_webhook_first");
    expect(w.status).toBe(200);
    assertSingleCorrectRowSet(db);
    const rowsAfterWebhook = db.orders.length;

    const resp = await handleOrderConfirmed(pollRequest("cs_gate_b_1"), prodEnv(db));
    const data = await resp.json() as any;
    expect(data.orders).toHaveLength(2);
    expect(db.orders.length).toBe(rowsAfterWebhook); // poll inserted nothing
    // product revenue excludes shipping: 6*33 + 1*27 = 225
    expect(data.purchase_reportable_value).toBe(225);
    expect(data.purchase_reportable).toBe(true);
    expect(data.payment_verified).toBe(true);
    // gross Stripe total = products (22500 minor) + shipping (8960 minor)
    const productMinor = db.orders.reduce((s, o) => s + Math.round(Number(o.price_usd) * 100) * Number(o.quantity), 0);
    expect(productMinor + 8960).toBe(session.amount_total);
  });

  it("Scenario 2: client poll first → webhook afterward claims no lines and inserts nothing", async () => {
    seedSnapshot(db, "cs_gate_b_1");
    const session = quoteSession();
    stubStripeFetch(session, STRIPE_LINE_ITEMS);

    const resp = await handleOrderConfirmed(pollRequest("cs_gate_b_1"), prodEnv(db));
    const data = await resp.json() as any;
    expect(data.orders).toHaveLength(2);
    assertSingleCorrectRowSet(db);
    const rowsAfterPoll = db.orders.length;
    const claimsAfterPoll = db.fulfillmentLines.size;

    const w = await callWebhook(db, session, "evt_gate_b_poll_first");
    expect(w.status).toBe(200);
    expect(db.orders.length).toBe(rowsAfterPoll); // webhook inserted nothing
    expect(db.fulfillmentLines.size).toBe(claimsAfterPoll); // no new claims
    assertSingleCorrectRowSet(db);
  });

  it("Scenario 3: near-concurrent webhook + client poll yields exactly one row set", async () => {
    seedSnapshot(db, "cs_gate_b_1");
    const session = quoteSession();
    stubStripeFetch(session, STRIPE_LINE_ITEMS);

    const [w, poll] = await Promise.all([
      callWebhook(db, session, "evt_gate_b_concurrent"),
      handleOrderConfirmed(pollRequest("cs_gate_b_1"), prodEnv(db)),
    ]);
    expect(w.status).toBe(200);
    const data = await poll.json() as any;
    expect(data.orders).toHaveLength(2);
    assertSingleCorrectRowSet(db);
    expect(db.fulfillmentLines.size).toBe(2); // each product line claimed exactly once
  });

  it("Scenario 4: repeated polls + repeated webhook events (retry and second event type) still yield one row set", async () => {
    seedSnapshot(db, "cs_gate_b_1");
    const session = quoteSession();
    stubStripeFetch(session, STRIPE_LINE_ITEMS);

    await handleOrderConfirmed(pollRequest("cs_gate_b_1"), prodEnv(db));
    await handleOrderConfirmed(pollRequest("cs_gate_b_1"), prodEnv(db));
    await handleOrderConfirmed(pollRequest("cs_gate_b_1"), prodEnv(db));
    expect(db.orders).toHaveLength(2);

    await callWebhook(db, session, "evt_gate_b_repeat_1");
    await callWebhook(db, session, "evt_gate_b_repeat_1"); // retry of the same event id
    await callWebhook(db, session, "evt_gate_b_repeat_2", "checkout.session.async_payment_succeeded");
    assertSingleCorrectRowSet(db);
    expect(db.fulfillmentLines.size).toBe(2);
  });

  it("Scenario 5: unpaid sessions create no rows on either path, then a single paid delivery creates them once", async () => {
    seedSnapshot(db, "cs_gate_b_1");
    const unpaidSession = quoteSession({ payment_status: "unpaid" });
    stubStripeFetch(unpaidSession, STRIPE_LINE_ITEMS);

    const wUnpaid = await callWebhook(db, unpaidSession, "evt_gate_b_unpaid");
    expect(wUnpaid.status).toBe(200);
    expect(db.orders).toHaveLength(0);

    const pollUnpaid = await handleOrderConfirmed(pollRequest("cs_gate_b_1"), prodEnv(db));
    const pendingData = await pollUnpaid.json() as any;
    expect(pendingData.pending).toBe(true);
    expect(pendingData.payment_verified).toBe(false);
    expect(db.orders).toHaveLength(0);

    const paidSession = quoteSession();
    stubStripeFetch(paidSession, STRIPE_LINE_ITEMS);
    await callWebhook(db, paidSession, "evt_gate_b_paid_late");
    assertSingleCorrectRowSet(db);

    const pollAfter = await handleOrderConfirmed(pollRequest("cs_gate_b_1"), prodEnv(db));
    const data = await pollAfter.json() as any;
    expect(data.orders).toHaveLength(2);
    expect(data.payment_verified).toBe(true);
    expect(db.orders).toHaveLength(2);
  });

  it("Scenario 6: THB session retains approved THB pricing across both paths", async () => {
    const items = [
      { slug: "custom-waterproof-cushion-protector", name: "Custom Waterproof Cushion Protector", quote_id: "QT-261030-THB", fabric: "tpu", color: null, dims: { w: 100, l: 200, d: 30, unit: "cm" }, qty: 1, u: 99000 },
    ];
    seedSnapshot(db, "cs_gate_b_thb", items, "thb");
    const session = quoteSession({
      id: "cs_gate_b_thb",
      payment_intent: "pi_gate_b_thb",
      currency: "thb",
      amount_total: 99000 + 35000, // 990 THB product + 350 THB shipping
      metadata: { email: "buyer@example.com", name: "TH Buyer", items: JSON.stringify(items) },
    });
    stubStripeFetch(session, [
      { description: "Custom Waterproof Cushion Protector", quantity: 1, amount_total: 99000, price: { unit_amount: 99000, product_data: { name: "Custom Waterproof Cushion Protector" } } },
      { description: "Shipping (Thailand)", quantity: 1, amount_total: 35000, price: { unit_amount: 35000, product_data: { name: "Shipping (Thailand)" } } },
    ]);

    await callWebhook(db, session, "evt_gate_b_thb");
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].price_thb).toBe(990);
    expect(db.orders[0].price_usd).toBeNull();
    expect(db.orders[0].currency).toBe("thb");
    expect(db.orders[0].quote_id).toBe("QT-261030-THB");

    const poll = await handleOrderConfirmed(pollRequest("cs_gate_b_thb"), prodEnv(db));
    const data = await poll.json() as any;
    expect(data.orders).toHaveLength(1);
    expect(data.purchase_reportable_value).toBe(990);
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].price_thb).toBe(990);
  });

  it("Scenario 7: quote lines without dims hydrate identically on both paths (shared claim keys survive hydration)", async () => {
    const items = [
      { slug: "custom-waterproof-cushion-protector", name: "Custom Waterproof Cushion Protector", quote_id: "QT-261030-HYD", fabric: "tpu", color: null, qty: 2, u: 5000 },
    ];
    seedSnapshot(db, "cs_gate_b_hyd", items, "usd");
    db.customQuotes.set("QT-261030-HYD", { dimensions: JSON.stringify({ w: 120, l: 190, d: 25, unit: "cm" }) });
    const session = quoteSession({
      id: "cs_gate_b_hyd",
      payment_intent: "pi_gate_b_hyd",
      amount_total: 10000 + 3000,
      metadata: { email: "buyer@example.com", name: "Hyd Buyer", items: JSON.stringify(items) },
    });
    stubStripeFetch(session, [
      { description: "Custom Waterproof Cushion Protector", quantity: 2, amount_total: 10000, price: { unit_amount: 5000, product_data: { name: "Custom Waterproof Cushion Protector" } } },
      { description: "Shipping (United States)", quantity: 1, amount_total: 3000, price: { unit_amount: 3000, product_data: { name: "Shipping (United States)" } } },
    ]);

    // poll first (reconcile hydrates from custom_quotes and inserts)
    await handleOrderConfirmed(pollRequest("cs_gate_b_hyd"), prodEnv(db));
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].width_cm).toBe(120);
    expect(db.orders[0].length_cm).toBe(190);
    expect(db.orders[0].depth_cm).toBe(25);
    expect(db.orders[0].quote_id).toBe("QT-261030-HYD");
    expect(db.orders[0].quantity).toBe(2);

    // webhook second (webhook hydrates the same way; claims must collide → no second row)
    const w = await callWebhook(db, session, "evt_gate_b_hyd");
    expect(w.status).toBe(200);
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].width_cm).toBe(120);
    expect(db.fulfillmentLines.size).toBe(1);
  });
});
