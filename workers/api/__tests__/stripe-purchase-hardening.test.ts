import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { handleStripeWebhook } from "../webhook";
import { handleOrderConfirmed } from "../order-confirmed";
import { sendEmail } from "../email";

vi.mock("../email", () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
}));

class FakeD1 {
  orders: any[] = [];
  webhookEvents = new Map<string, any>();
  fulfillmentLines = new Map<string, any>();
  snapshots = new Map<string, string>();
  customerAddresses = new Set<string>();
  thankyouByOrder = new Map<string, any>();
  nextOrderId = 1;
  hasIdempotencyTables = true;
  failNextOrderInsert = false;

  prepare(sql: string) {
    return new FakeStmt(this, sql);
  }
}

const PAID_OR_HISTORICAL_STATUSES = new Set(["confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]);

class FakeStmt {
  private args: any[] = [];
  constructor(private db: FakeD1, private sql: string) {}
  bind(...args: any[]) {
    this.args = args;
    return this;
  }
  async first() {
    return exec(this.db, this.sql, this.args, "first");
  }
  async all() {
    return exec(this.db, this.sql, this.args, "all");
  }
  async run() {
    return exec(this.db, this.sql, this.args, "run");
  }
}

function norm(sql: string) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

async function exec(db: FakeD1, sqlRaw: string, args: any[], mode: "first" | "all" | "run"): Promise<any> {
  const sql = norm(sqlRaw);

  if (sql.startsWith("pragma table_info(orders)")) {
    return { results: [{ name: "customer_note_type" }, { name: "customer_note" }] };
  }
  if (sql.includes("from sqlite_master") && sql.includes("stripe_webhook_events")) {
    return db.hasIdempotencyTables ? { name: "stripe_webhook_events" } : null;
  }
  if (sql.includes("from sqlite_master") && sql.includes("stripe_order_fulfillment_lines")) {
    return db.hasIdempotencyTables ? { name: "stripe_order_fulfillment_lines" } : null;
  }
  if (sql.startsWith("create table if not exists") || sql.startsWith("create index if not exists")) {
    return { success: true, meta: { changes: 0 } };
  }
  if (sql.includes("select items_json from checkout_session_snapshots")) {
    const row = db.snapshots.get(String(args[0] || ""));
    return row ? { items_json: row } : null;
  }
  if (sql.startsWith("insert or ignore into stripe_webhook_events")) {
    const [eventId, eventType, sessionId] = args;
    if (!db.webhookEvents.has(eventId)) {
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
      (Date.now() - new Date(String(row.updated_at)).getTime()) > 10 * 60 * 1000;
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
  if (sql.startsWith("insert into orders")) {
    if (db.failNextOrderInsert) {
      db.failNextOrderInsert = false;
      throw new Error("Simulated order insert failure");
    }
    const row: any = {
      id: db.nextOrderId++,
      stripe_session_id: args[0],
      stripe_payment_intent_id: args[1],
      email: args[2],
      customer_name: args[3],
      phone: args[4],
      shipping_address: args[5],
      product_slug: args[6],
      product_title_en: args[7],
      fabric: args[8],
      color: args[9],
      width_cm: args[10],
      length_cm: args[11],
      depth_cm: args[12],
      price_usd: args[17],
      price_thb: args[18],
      currency: args[19],
      quantity: args[20],
      discount_code: args[21],
      status: "confirmed",
      created_at: new Date(Date.now() + db.nextOrderId).toISOString(),
    };
    db.orders.push(row);
    return { success: true, meta: { changes: 1 } };
  }
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
  if (sql.includes("from orders") && sql.includes("where stripe_session_id = ?1") && sql.includes("limit 1") && sql.includes("lower(coalesce(status")) {
    return db.orders.find((o) => o.stripe_session_id === args[0] && PAID_OR_HISTORICAL_STATUSES.has(String(o.status || "").toLowerCase())) || null;
  }
  if (
    sql.includes("from orders") &&
    sql.includes("where stripe_session_id = ?1") &&
    sql.includes("lower(coalesce(status") &&
    sql.includes("order by created_at desc")
  ) {
    const rows = db.orders
      .filter((o) => o.stripe_session_id === args[0] && PAID_OR_HISTORICAL_STATUSES.has(String(o.status || "").toLowerCase()))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return { results: rows };
  }
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

  throw new Error(`Unhandled SQL in test fake DB (${mode}): ${sqlRaw}`);
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

function baseSession(partial: Record<string, any> = {}) {
  return {
    id: "cs_test_123",
    payment_intent: "pi_test_123",
    payment_status: "paid",
    status: "complete",
    currency: "usd",
    amount_total: 12000,
    metadata: {
      email: "buyer@example.com",
      name: "Buyer Test",
      phone: "123",
      address: "Test St, City, Country",
      items: JSON.stringify([
        { s: "standard-fitted-sheet", n: "Standard Fitted Sheet", f: "cloudsoft", c: "white", d: "150x200x30 cm", q: 1, u: 12000 },
      ]),
    },
    ...partial,
  };
}

async function callWebhook(db: FakeD1, event: any) {
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

async function callWebhookNonProd(db: FakeD1, event: any) {
  const body = JSON.stringify(event);
  const signature = await signStripePayload(body, "whsec_test");
  const req = new Request("https://preview.mildmate-new.pages.dev/api/webhook/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature, "content-type": "application/json" },
    body,
  });
  return handleStripeWebhook(req, {
    DB: db,
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    STRIPE_SECRET_KEY: "sk_test_xxx",
    STRIPE_ENV_MODE: "test",
    NON_PROD_STRIPE_ALLOWED: "true",
    NON_PROD_EMAIL_ALLOWED: "false",
    RUNTIME_ENV: "staging",
    D1_ENV_LABEL: "staging",
    RESEND_API_KEY: "re_test_123",
  });
}

describe("stripe purchase hardening", () => {
  let db: FakeD1;

  beforeEach(() => {
    vi.unstubAllGlobals();
    db = new FakeD1();
    vi.restoreAllMocks();
  });

  it("processes paid checkout.session.completed once across retry", async () => {
    const event = { id: "evt_paid_1", type: "checkout.session.completed", data: { object: baseSession() } };
    const r1 = await callWebhook(db, event);
    const r2 = await callWebhook(db, event);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(db.orders).toHaveLength(1);
  });

  it("processes paid staging test webhook while email delivery is suppressed", async () => {
    const event = { id: "evt_paid_stage_1", type: "checkout.session.completed", data: { object: baseSession({ id: "cs_stage_paid_1" }) } };
    const mockedSend = vi.mocked(sendEmail);
    mockedSend.mockClear();
    mockedSend.mockResolvedValue({ success: false, error: "EMAIL_SUPPRESSED:non_prod_email_explicitly_blocked" });
    const resp = await callWebhookNonProd(db, event);
    const body = await resp.json() as any;
    expect(resp.status).toBe(200);
    expect(body.received).toBe(true);
    expect(db.orders.filter((o) => o.stripe_session_id === "cs_stage_paid_1")).toHaveLength(1);
    expect(mockedSend).toHaveBeenCalled();
  });

  it("processes only one order row for concurrent deliveries of same event", async () => {
    const event = { id: "evt_paid_concurrent", type: "checkout.session.completed", data: { object: baseSession({ id: "cs_concurrent_1" }) } };
    const [a, b] = await Promise.all([callWebhook(db, event), callWebhook(db, event)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(db.orders.filter((o) => o.stripe_session_id === "cs_concurrent_1")).toHaveLength(1);
  });

  it("ignores completed session when payment is not paid", async () => {
    const event = {
      id: "evt_unpaid_1",
      type: "checkout.session.completed",
      data: { object: baseSession({ payment_status: "unpaid", status: "complete" }) },
    };
    const resp = await callWebhook(db, event);
    expect(resp.status).toBe(200);
    expect(db.orders).toHaveLength(0);
  });

  it("fulfills only after async payment success", async () => {
    const sessionId = "cs_async_1";
    const unpaidEvent = {
      id: "evt_async_pre",
      type: "checkout.session.completed",
      data: { object: baseSession({ id: sessionId, payment_status: "unpaid" }) },
    };
    const successEvent = {
      id: "evt_async_ok",
      type: "checkout.session.async_payment_succeeded",
      data: { object: baseSession({ id: sessionId, payment_status: "paid" }) },
    };
    await callWebhook(db, unpaidEvent);
    await callWebhook(db, successEvent);
    expect(db.orders).toHaveLength(1);
  });

  it("ignores checkout.session.async_payment_failed", async () => {
    const failedEvent = {
      id: "evt_async_failed",
      type: "checkout.session.async_payment_failed",
      data: { object: baseSession({ id: "cs_async_fail_1", payment_status: "unpaid" }) },
    };
    const resp = await callWebhook(db, failedEvent);
    const data = await resp.json() as any;
    expect(resp.status).toBe(200);
    expect(data.ignored).toBe(true);
    expect(db.orders).toHaveLength(0);
  });

  it("prevents duplicate logical orders across different events for same session", async () => {
    const sessionId = "cs_same_session";
    const completed = {
      id: "evt_same_1",
      type: "checkout.session.completed",
      data: { object: baseSession({ id: sessionId }) },
    };
    const asyncSuccess = {
      id: "evt_same_2",
      type: "checkout.session.async_payment_succeeded",
      data: { object: baseSession({ id: sessionId }) },
    };
    await Promise.all([callWebhook(db, completed), callWebhook(db, asyncSuccess)]);
    expect(db.orders).toHaveLength(1);
  });

  it("does not duplicate historical paid session when idempotency tables start empty", async () => {
    db.orders.push({
      id: 1001,
      stripe_session_id: "cs_hist_1",
      status: "confirmed",
      product_slug: "standard-fitted-sheet",
      product_title_en: "Standard Fitted Sheet",
      fabric: "cloudsoft",
      color: "white",
      width_cm: 150,
      length_cm: 200,
      depth_cm: 30,
      price_usd: 120,
      price_thb: null,
      currency: "usd",
      quantity: 1,
      created_at: new Date().toISOString(),
    });
    const replayEvent = {
      id: "evt_hist_replay",
      type: "checkout.session.completed",
      data: { object: baseSession({ id: "cs_hist_1", amount_total: 12000 }) },
    };
    await callWebhook(db, replayEvent);
    const rows = db.orders.filter((o) => o.stripe_session_id === "cs_hist_1");
    expect(rows).toHaveLength(1);
  });

  it("does not duplicate historically shipped session on webhook replay", async () => {
    db.orders.push({
      id: 1101,
      stripe_session_id: "cs_hist_shipped",
      status: "shipped",
      product_slug: "standard-fitted-sheet",
      product_title_en: "Standard Fitted Sheet",
      fabric: "cloudsoft",
      color: "white",
      width_cm: 150,
      length_cm: 200,
      depth_cm: 30,
      price_usd: 120,
      price_thb: null,
      currency: "usd",
      quantity: 1,
      created_at: new Date().toISOString(),
    });
    const replayEvent = {
      id: "evt_hist_ship_replay",
      type: "checkout.session.completed",
      data: { object: baseSession({ id: "cs_hist_shipped", amount_total: 12000 }) },
    };
    await callWebhook(db, replayEvent);
    expect(db.orders.filter((o) => o.stripe_session_id === "cs_hist_shipped")).toHaveLength(1);
  });

  it("does not recreate cancelled order rows on replay", async () => {
    db.orders.push({
      id: 1201,
      stripe_session_id: "cs_hist_cancelled",
      status: "cancelled",
      product_slug: "standard-fitted-sheet",
      product_title_en: "Standard Fitted Sheet",
      fabric: "cloudsoft",
      color: "white",
      width_cm: 150,
      length_cm: 200,
      depth_cm: 30,
      price_usd: 120,
      price_thb: null,
      currency: "usd",
      quantity: 1,
      created_at: new Date().toISOString(),
    });
    const replayEvent = {
      id: "evt_hist_cancel_replay",
      type: "checkout.session.completed",
      data: { object: baseSession({ id: "cs_hist_cancelled", amount_total: 12000 }) },
    };
    await callWebhook(db, replayEvent);
    expect(db.orders.filter((o) => o.stripe_session_id === "cs_hist_cancelled")).toHaveLength(1);
  });

  it("recovers after failure post-claim on webhook retry", async () => {
    const event = { id: "evt_retry_recover", type: "checkout.session.completed", data: { object: baseSession({ id: "cs_retry_recover" }) } };
    db.failNextOrderInsert = true;
    const failResp = await callWebhook(db, event);
    expect(failResp.status).toBe(500);
    expect(db.orders.filter((o) => o.stripe_session_id === "cs_retry_recover")).toHaveLength(0);

    const retryResp = await callWebhook(db, event);
    expect(retryResp.status).toBe(200);
    expect(db.orders.filter((o) => o.stripe_session_id === "cs_retry_recover")).toHaveLength(1);
  });

  it("takes over stale in-progress claim and processes on retry delivery", async () => {
    const eventId = "evt_stale_claim";
    db.webhookEvents.set(eventId, {
      event_id: eventId,
      event_type: "checkout.session.completed",
      stripe_session_id: "cs_stale_claim",
      processing_token: "stuck-token",
      processed_at: null,
      process_result: null,
      last_error: null,
      updated_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    });
    const event = { id: eventId, type: "checkout.session.completed", data: { object: baseSession({ id: "cs_stale_claim" }) } };
    const resp = await callWebhook(db, event);
    expect(resp.status).toBe(200);
    expect(db.orders.filter((o) => o.stripe_session_id === "cs_stale_claim")).toHaveLength(1);
  });

  it("keeps fulfillment idempotent when line items are reordered", async () => {
    const sessionId = "cs_reorder_1";
    const e1 = {
      id: "evt_reorder_1",
      type: "checkout.session.completed",
      data: {
        object: baseSession({
          id: sessionId,
          amount_total: 30000,
          metadata: {
            ...baseSession().metadata,
            items: JSON.stringify([
              { s: "a", n: "A", f: "cloudsoft", c: "white", q: 1, u: 10000 },
              { s: "b", n: "B", f: "breezeplus", c: "gray", q: 1, u: 20000 },
            ]),
          },
        }),
      },
    };
    const e2 = {
      id: "evt_reorder_2",
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: baseSession({
          id: sessionId,
          amount_total: 30000,
          metadata: {
            ...baseSession().metadata,
            items: JSON.stringify([
              { s: "b", n: "B", f: "breezeplus", c: "gray", q: 1, u: 20000 },
              { s: "a", n: "A", f: "cloudsoft", c: "white", q: 1, u: 10000 },
            ]),
          },
        }),
      },
    };
    await callWebhook(db, e1);
    await callWebhook(db, e2);
    const rows = db.orders.filter((o) => o.stripe_session_id === sessionId);
    expect(rows).toHaveLength(2);
  });

  it("returns 500 when migration 057 tables are missing (no runtime auto-create fallback)", async () => {
    db.hasIdempotencyTables = false;
    const event = { id: "evt_missing_schema", type: "checkout.session.completed", data: { object: baseSession({ id: "cs_missing_schema" }) } };
    vi.resetModules();
    const fresh = await import("../webhook");
    const body = JSON.stringify(event);
    const signature = await signStripePayload(body, "whsec_test");
    const req = new Request("https://www.mildmate.com/api/webhook/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      body,
    });
    const resp = await fresh.handleStripeWebhook(req, {
      DB: db,
      STRIPE_WEBHOOK_SECRET: "whsec_test",
      RESEND_API_KEY: "",
    });
    expect(resp.status).toBe(500);
    expect(db.orders.filter((o) => o.stripe_session_id === "cs_missing_schema")).toHaveLength(0);
  });

  it("returns pending for completed-but-unpaid reconcile path", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: any) => {
      const s = String(url);
      if (s.includes("/v1/checkout/sessions/") && !s.includes("/line_items")) {
        return new Response(JSON.stringify(baseSession({ id: "cs_reconcile_1", payment_status: "unpaid", status: "complete" })), { status: 200 });
      }
      if (s.includes("/line_items")) {
        return new Response(JSON.stringify({ data: [{ quantity: 1, amount_total: 12000, description: "Item A", price: { unit_amount: 12000 } }] }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as any);

    const req = new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_reconcile_1");
    const resp = await handleOrderConfirmed(req, { DB: db, STRIPE_SECRET_KEY: "sk_live_xxx", RUNTIME_ENV: "production", D1_ENV_LABEL: "prod" });
    const data = await resp.json() as any;
    expect(data.pending).toBe(true);
    expect(data.payment_verified).toBe(false);
    expect(db.orders).toHaveLength(0);
  });

  it("returns confirmed response only when payment is verified paid", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: any) => {
      const s = String(url);
      if (s.includes("/v1/checkout/sessions/") && !s.includes("/line_items")) {
        return new Response(JSON.stringify(baseSession({ id: "cs_reconcile_paid", payment_status: "paid", status: "complete" })), { status: 200 });
      }
      if (s.includes("/line_items")) {
        return new Response(JSON.stringify({ data: [{ quantity: 1, amount_total: 12000, description: "Item A", price: { unit_amount: 12000 } }] }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as any);

    const req = new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_reconcile_paid");
    const resp = await handleOrderConfirmed(req, { DB: db, STRIPE_SECRET_KEY: "sk_live_xxx", RUNTIME_ENV: "production", D1_ENV_LABEL: "prod" });
    const data = await resp.json() as any;
    expect(data.payment_verified).toBe(true);
    expect(Array.isArray(data.orders)).toBe(true);
    expect(data.orders.length).toBe(1);
  });

  it("returns payment-verified orders for shipped historical rows without reconciliation duplicates", async () => {
    db.webhookEvents.set("evt_hist_paid_ship", {
      event_id: "evt_hist_paid_ship",
      event_type: "checkout.session.completed",
      stripe_session_id: "cs_shipped_confirm",
      processing_token: null,
      processed_at: new Date().toISOString(),
      process_result: "processed",
      last_error: null,
      updated_at: new Date().toISOString(),
    });
    db.orders.push({
      id: 1301,
      stripe_session_id: "cs_shipped_confirm",
      stripe_payment_intent_id: "pi_hist_shipped",
      status: "shipped",
      product_slug: "standard-fitted-sheet",
      product_title_en: "Standard Fitted Sheet",
      fabric: "cloudsoft",
      color: "white",
      width_cm: 150,
      length_cm: 200,
      depth_cm: 30,
      price_usd: 120,
      price_thb: null,
      currency: "usd",
      quantity: 1,
      created_at: new Date().toISOString(),
    });
    const req = new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_shipped_confirm");
    const resp = await handleOrderConfirmed(req, { DB: db, STRIPE_SECRET_KEY: "sk_live_xxx", RUNTIME_ENV: "production", D1_ENV_LABEL: "prod" });
    const data = await resp.json() as any;
    expect(resp.status).toBe(200);
    expect(data.payment_verified).toBe(true);
    expect(data.purchase_reportable).toBe(true);
    expect(Array.isArray(data.orders)).toBe(true);
    expect(data.orders.length).toBe(1);
    expect(db.orders.filter((o) => o.stripe_session_id === "cs_shipped_confirm")).toHaveLength(1);
  });

  it("marks cancelled/refunded historical session as payment-verified but not purchase-reportable", async () => {
    db.webhookEvents.set("evt_hist_paid_cancel", {
      event_id: "evt_hist_paid_cancel",
      event_type: "checkout.session.completed",
      stripe_session_id: "cs_cancel_refund_hist",
      processing_token: null,
      processed_at: new Date().toISOString(),
      process_result: "processed",
      last_error: null,
      updated_at: new Date().toISOString(),
    });
    db.orders.push({
      id: 1401,
      stripe_session_id: "cs_cancel_refund_hist",
      stripe_payment_intent_id: "pi_hist_cancel",
      status: "cancelled",
      product_slug: "standard-fitted-sheet",
      product_title_en: "Standard Fitted Sheet",
      fabric: "cloudsoft",
      color: "white",
      width_cm: 150,
      length_cm: 200,
      depth_cm: 30,
      price_usd: 120,
      price_thb: null,
      currency: "usd",
      quantity: 1,
      created_at: new Date().toISOString(),
    });
    db.orders.push({
      id: 1402,
      stripe_session_id: "cs_cancel_refund_hist",
      stripe_payment_intent_id: "pi_hist_cancel",
      status: "refunded",
      product_slug: "standard-fitted-sheet",
      product_title_en: "Standard Fitted Sheet",
      fabric: "cloudsoft",
      color: "white",
      width_cm: 150,
      length_cm: 200,
      depth_cm: 30,
      price_usd: 120,
      price_thb: null,
      currency: "usd",
      quantity: 1,
      created_at: new Date(Date.now() + 1000).toISOString(),
    });
    const req = new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_cancel_refund_hist");
    const resp = await handleOrderConfirmed(req, { DB: db, STRIPE_SECRET_KEY: "sk_live_xxx", RUNTIME_ENV: "production", D1_ENV_LABEL: "prod" });
    const data = await resp.json() as any;
    expect(resp.status).toBe(200);
    expect(data.payment_verified).toBe(true);
    expect(data.purchase_reportable).toBe(false);
    expect(data.purchase_reportable_count).toBe(0);
    expect(data.purchase_reportable_value).toBe(0);
  });

  it("reports purchase value from active shipped lines when session has mixed shipped/cancelled rows", async () => {
    db.webhookEvents.set("evt_hist_paid_mixed", {
      event_id: "evt_hist_paid_mixed",
      event_type: "checkout.session.completed",
      stripe_session_id: "cs_mixed_status",
      processing_token: null,
      processed_at: new Date().toISOString(),
      process_result: "processed",
      last_error: null,
      updated_at: new Date().toISOString(),
    });
    db.orders.push({
      id: 1501,
      stripe_session_id: "cs_mixed_status",
      stripe_payment_intent_id: "pi_mixed_status",
      status: "shipped",
      product_slug: "sheet-a",
      product_title_en: "Sheet A",
      fabric: "cloudsoft",
      color: "white",
      width_cm: 100,
      length_cm: 100,
      depth_cm: 20,
      price_usd: 90,
      price_thb: null,
      currency: "usd",
      quantity: 1,
      created_at: new Date().toISOString(),
    });
    db.orders.push({
      id: 1502,
      stripe_session_id: "cs_mixed_status",
      stripe_payment_intent_id: "pi_mixed_status",
      status: "cancelled",
      product_slug: "sheet-b",
      product_title_en: "Sheet B",
      fabric: "cloudsoft",
      color: "gray",
      width_cm: 120,
      length_cm: 120,
      depth_cm: 25,
      price_usd: 70,
      price_thb: null,
      currency: "usd",
      quantity: 1,
      created_at: new Date(Date.now() + 500).toISOString(),
    });
    const req = new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_mixed_status");
    const resp = await handleOrderConfirmed(req, { DB: db, STRIPE_SECRET_KEY: "sk_live_xxx", RUNTIME_ENV: "production", D1_ENV_LABEL: "prod" });
    const data = await resp.json() as any;
    expect(resp.status).toBe(200);
    expect(data.payment_verified).toBe(true);
    expect(data.purchase_reportable).toBe(true);
    expect(data.purchase_reportable_count).toBe(1);
    expect(data.purchase_reportable_value).toBe(90);
  });

  it("keeps pending-only rows from being purchase eligible", async () => {
    db.orders.push({
      id: 900,
      stripe_session_id: "cs_pending_only",
      status: "pending",
      created_at: new Date().toISOString(),
    });
    const req = new Request("https://www.mildmate.com/api/order-confirmed?session_id=cs_pending_only");
    const resp = await handleOrderConfirmed(req, { DB: db, STRIPE_SECRET_KEY: "" });
    const data = await resp.json() as any;
    expect(data.pending).toBe(true);
    expect(data.payment_verified).toBe(false);
  });

  it("blocks non-production webhook when stripe safety configuration is missing", async () => {
    const event = { id: "evt_nonprod_block", type: "checkout.session.completed", data: { object: baseSession({ id: "cs_nonprod_block" }) } };
    const body = JSON.stringify(event);
    const signature = await signStripePayload(body, "whsec_test");
    const req = new Request("https://preview.mildmate-new.pages.dev/api/webhook/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      body,
    });
    const resp = await handleStripeWebhook(req, {
      DB: db,
      STRIPE_WEBHOOK_SECRET: "whsec_test",
      STRIPE_ENV_MODE: "live",
      RESEND_API_KEY: "",
    });
    expect(resp.status).toBe(503);
  });

  it("blocks non-production order-confirmed reconcile when runtime safety is missing", async () => {
    const req = new Request("https://preview.mildmate-new.pages.dev/api/order-confirmed?session_id=cs_nonprod_confirm");
    const resp = await handleOrderConfirmed(req, {
      DB: db,
      STRIPE_SECRET_KEY: "sk_live_xxx",
      RUNTIME_ENV: "",
      D1_ENV_LABEL: "",
      NON_PROD_STRIPE_ALLOWED: "false",
    });
    expect(resp.status).toBe(503);
  });

  it("gates purchase tracking in order-confirmed page by payment_verified", () => {
    const html = readFileSync("D:\\00_mildmate\\re-build_web\\public\\order-confirmed\\index.html", "utf8");
    expect(html.includes("data.payment_verified === true && data.orders && data.orders.length > 0")).toBe(true);
    expect(html.includes("if (data && data.payment_verified === true && data.purchase_reportable === true)")).toBe(true);
    expect(html.includes("data.purchase_reportable_value || totalValue || 0")).toBe(true);
    expect(html.includes("transaction_id: data.session_id")).toBe(true);
    expect(html.includes("localStorage.getItem(dedupeKey) === '1'")).toBe(true);
    expect(html.includes("localStorage.setItem(dedupeKey, '1')")).toBe(true);
  });

  it("keeps mobile delayed GTM initialization guardrails", () => {
    const html = readFileSync("D:\\00_mildmate\\re-build_web\\public\\order-confirmed\\index.html", "utf8");
    expect(html.includes("window.addEventListener('pointerdown', startOnce")).toBe(true);
    expect(html.includes("window.addEventListener('touchstart', startOnce")).toBe(true);
    expect(html.includes("setTimeout(startOnce, 6000)")).toBe(true);
  });
});
