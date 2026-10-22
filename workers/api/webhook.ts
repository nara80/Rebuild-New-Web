// MildMate Stripe Webhook Handler
// POST /api/webhook/stripe — receives payment confirmations from Stripe
// Saves order to D1 + sends confirmation emails via Resend
// Requires STRIPE_WEBHOOK_SECRET set as Cloudflare secret

import { sendEmail } from "./email";

async function sha256(text: string): Promise<string> {
  const d = new TextEncoder().encode(text);
  const h = await crypto.subtle.digest("SHA-256", d);
  return Array.from(new Uint8Array(h)).map(function(b){return b.toString(16).padStart(2,"0");}).join("");
}

function normalizeAddress(raw: any): string {
  var addr = raw;
  if (typeof raw === "string") try { addr = JSON.parse(raw); } catch(e) { return (raw||"").toLowerCase().trim(); }
  if (typeof addr !== "object" || !addr) return "";
  return [(addr.street||addr.address||"").trim().toLowerCase(), (addr.city||"").trim().toLowerCase(), (addr.state||addr.province||"").trim().toLowerCase(), (addr.postal_code||addr.zip||addr.postal||"").trim().toLowerCase(), (addr.country||"").trim().toLowerCase()].join("|");
}

function isProductionHost(request: Request): boolean {
  try {
    const host = new URL(request.url).hostname.toLowerCase();
    return host === "www.mildmate.com" || host === "mildmate.com";
  } catch {
    return false;
  }
}

function assertWebhookRuntimeSafety(request: Request, env: any): string | null {
  const prodHost = isProductionHost(request);
  const runtimeEnv = String(env.RUNTIME_ENV || env.APP_ENV || "").trim().toLowerCase();
  const d1Label = String(env.D1_ENV_LABEL || "").trim().toLowerCase();
  const stripeEnvMode = String(env.STRIPE_ENV_MODE || "").trim().toLowerCase();

  if (prodHost) {
    if (runtimeEnv && runtimeEnv !== "prod" && runtimeEnv !== "production") {
      return "Production host runtime environment mismatch";
    }
    if (stripeEnvMode && stripeEnvMode !== "live") {
      return "Production host requires STRIPE_ENV_MODE=live";
    }
    return null;
  }

  if (env.NON_PROD_STRIPE_ALLOWED !== "true") {
    return "Non-production webhook disabled until NON_PROD_STRIPE_ALLOWED=true";
  }
  if (!runtimeEnv || runtimeEnv === "prod" || runtimeEnv === "production") {
    return "Non-production runtime requires explicit non-production RUNTIME_ENV";
  }
  if (stripeEnvMode !== "test") {
    return "Non-production webhook requires STRIPE_ENV_MODE=test";
  }
  if (!d1Label || d1Label === "prod" || d1Label === "production") {
    return "Non-production runtime requires non-production D1_ENV_LABEL";
  }
  return null;
}

let orderCustomerNoteSchemaReady = false;
let orderCustomerNoteSchemaPromise: Promise<boolean> | null = null;
let checkoutSnapshotSchemaReady = false;
let checkoutSnapshotSchemaPromise: Promise<boolean> | null = null;
let stripeWebhookEventsSchemaReady = false;
let stripeWebhookEventsSchemaPromise: Promise<boolean> | null = null;
let stripeFulfillmentSchemaReady = false;
let stripeFulfillmentSchemaPromise: Promise<boolean> | null = null;
const PAID_OR_HISTORICAL_ORDER_STATUSES = ["confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];

async function ensureOrderCustomerNoteSchema(env: any): Promise<boolean> {
  if (orderCustomerNoteSchemaReady) return true;
  if (!orderCustomerNoteSchemaPromise) {
    orderCustomerNoteSchemaPromise = (async () => {
      try {
        const tableInfo = await env.DB.prepare("PRAGMA table_info(orders)").all();
        const existing = new Set(
          (tableInfo.results || []).map((r: any) => String(r.name || "").toLowerCase())
        );
        const alters: string[] = [];
        if (!existing.has("customer_note_type")) alters.push("ALTER TABLE orders ADD COLUMN customer_note_type TEXT");
        if (!existing.has("customer_note")) alters.push("ALTER TABLE orders ADD COLUMN customer_note TEXT");
        for (const sql of alters) await env.DB.prepare(sql).run();
        orderCustomerNoteSchemaReady = true;
        return true;
      } catch (e: any) {
        console.error("orders note schema init failed:", e?.message || e);
        return false;
      }
    })().finally(() => {
      if (!orderCustomerNoteSchemaReady) orderCustomerNoteSchemaPromise = null;
    });
  }
  return await orderCustomerNoteSchemaPromise;
}

async function ensureCheckoutSnapshotSchema(env: any): Promise<boolean> {
  if (checkoutSnapshotSchemaReady) return true;
  if (!checkoutSnapshotSchemaPromise) {
    checkoutSnapshotSchemaPromise = (async () => {
      try {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS checkout_session_snapshots (
             stripe_session_id TEXT PRIMARY KEY,
             email TEXT,
             currency TEXT,
             items_json TEXT NOT NULL,
             created_at DATETIME DEFAULT (datetime('now'))
           )`
        ).run();
        checkoutSnapshotSchemaReady = true;
        return true;
      } catch (e: any) {
        console.error("checkout snapshot schema init failed:", e?.message || e);
        return false;
      }
    })().finally(() => {
      if (!checkoutSnapshotSchemaReady) checkoutSnapshotSchemaPromise = null;
    });
  }
  return await checkoutSnapshotSchemaPromise;
}

async function ensureStripeWebhookEventsSchema(env: any): Promise<boolean> {
  if (stripeWebhookEventsSchemaReady) return true;
  if (!stripeWebhookEventsSchemaPromise) {
    stripeWebhookEventsSchemaPromise = (async () => {
      try {
        const row = await env.DB.prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'stripe_webhook_events' LIMIT 1"
        ).first() as any;
        const ok = !!row?.name;
        if (!ok) {
          console.error("Missing required table stripe_webhook_events; apply migration 057_stripe_payment_idempotency.sql");
        }
        stripeWebhookEventsSchemaReady = ok;
        return ok;
      } catch (e: any) {
        console.error("stripe webhook events schema init failed:", e?.message || e);
        return false;
      }
    })().finally(() => {
      if (!stripeWebhookEventsSchemaReady) stripeWebhookEventsSchemaPromise = null;
    });
  }
  return await stripeWebhookEventsSchemaPromise;
}

async function ensureStripeFulfillmentSchema(env: any): Promise<boolean> {
  if (stripeFulfillmentSchemaReady) return true;
  if (!stripeFulfillmentSchemaPromise) {
    stripeFulfillmentSchemaPromise = (async () => {
      try {
        const row = await env.DB.prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'stripe_order_fulfillment_lines' LIMIT 1"
        ).first() as any;
        const ok = !!row?.name;
        if (!ok) {
          console.error("Missing required table stripe_order_fulfillment_lines; apply migration 057_stripe_payment_idempotency.sql");
        }
        stripeFulfillmentSchemaReady = ok;
        return ok;
      } catch (e: any) {
        console.error("stripe fulfillment schema init failed:", e?.message || e);
        return false;
      }
    })().finally(() => {
      if (!stripeFulfillmentSchemaReady) stripeFulfillmentSchemaPromise = null;
    });
  }
  return await stripeFulfillmentSchemaPromise;
}

function isStripeSessionPaid(session: any): boolean {
  return String(session?.payment_status || "").toLowerCase() === "paid";
}

function toFiniteNumberOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeDimsForKey(dimsRaw: any): any {
  const dims = dimsRaw && typeof dimsRaw === "object" ? dimsRaw : {};
  const valuesRaw = dims.values && typeof dims.values === "object" ? dims.values : {};
  const values: Record<string, number> = {};
  Object.keys(valuesRaw).sort().forEach((k) => {
    const n = toFiniteNumberOrNull(valuesRaw[k]);
    if (n !== null) values[String(k).toUpperCase()] = n;
  });
  return {
    w: toFiniteNumberOrNull(dims.w),
    l: toFiniteNumberOrNull(dims.l),
    d: toFiniteNumberOrNull(dims.d),
    unit: String(dims.unit || "cm"),
    size_text: String(dims.size_text || ""),
    shape_code: String(dims.shape_code || ""),
    shape_name: String(dims.shape_name || ""),
    boat_model_name: String(dims.boat_model_name || ""),
    boat_model_key: String(dims.boat_model_key || ""),
    area_cm2: toFiniteNumberOrNull(dims.area_cm2),
    values,
  };
}

function buildFulfillmentLineIdentity(item: any): any {
  return {
    slug: String(item?.slug || ""),
    name: String(item?.name || ""),
    quote_id: String(item?.quote_id || ""),
    fabric: String(item?.fabric || ""),
    color: String(item?.color || ""),
    qty: Number(item?.qty || 1) || 1,
    unit_amount: Number(item?.unit_amount || 0) || 0,
    dims: normalizeDimsForKey(item?.dims || {}),
  };
}

async function buildFulfillmentLineKey(sessionId: string, item: any, occurrence: number): Promise<string> {
  const payload = JSON.stringify({
    session_id: String(sessionId || ""),
    occurrence: Number(occurrence || 1),
    slug: String(item?.slug || ""),
    name: String(item?.name || ""),
    quote_id: String(item?.quote_id || ""),
    fabric: String(item?.fabric || ""),
    color: String(item?.color || ""),
    qty: Number(item?.qty || 1) || 1,
    unit_amount: Number(item?.unit_amount || 0) || 0,
    dims: normalizeDimsForKey(item?.dims || {}),
  });
  return sha256(payload);
}

async function claimFulfillmentLine(env: any, sessionId: string, eventId: string, lineKey: string, lineIndex: number): Promise<boolean> {
  const schemaOk = await ensureStripeFulfillmentSchema(env);
  if (!schemaOk) throw new Error("Missing required fulfillment schema (migration 057)");
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO stripe_order_fulfillment_lines
      (line_key, stripe_session_id, stripe_event_id, line_index, created_at)
     VALUES (?1, ?2, ?3, ?4, datetime('now'))`
  ).bind(lineKey, sessionId, eventId || null, lineIndex).run() as any;
  return Number(res?.meta?.changes || 0) > 0;
}

async function countExistingConfirmedOrderLines(
  env: any,
  line: {
    sessionId: string;
    productSlug: string;
    productTitle: string;
    fabric: string | null;
    color: string | null;
    widthCm: number | null;
    lengthCm: number | null;
    depthCm: number | null;
    priceUsd: number | null;
    priceThb: number | null;
    currency: string;
    qty: number;
  }
): Promise<number> {
  const paidStatusesSql = PAID_OR_HISTORICAL_ORDER_STATUSES.map((s) => `'${s}'`).join(",");
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM orders
     WHERE stripe_session_id = ?1
       AND LOWER(COALESCE(status, '')) IN (${paidStatusesSql})
       AND COALESCE(product_slug, '') = COALESCE(?2, '')
       AND COALESCE(product_title_en, '') = COALESCE(?3, '')
       AND COALESCE(fabric, '') = COALESCE(?4, '')
       AND COALESCE(color, '') = COALESCE(?5, '')
       AND ((width_cm IS NULL AND ?6 IS NULL) OR width_cm = ?6)
       AND ((length_cm IS NULL AND ?7 IS NULL) OR length_cm = ?7)
       AND ((depth_cm IS NULL AND ?8 IS NULL) OR depth_cm = ?8)
       AND ((price_usd IS NULL AND ?9 IS NULL) OR price_usd = ?9)
       AND ((price_thb IS NULL AND ?10 IS NULL) OR price_thb = ?10)
       AND COALESCE(currency, '') = COALESCE(?11, '')
       AND quantity = ?12`
  ).bind(
    line.sessionId,
    line.productSlug || "",
    line.productTitle || "",
    line.fabric || "",
    line.color || "",
    line.widthCm,
    line.lengthCm,
    line.depthCm,
    line.priceUsd,
    line.priceThb,
    line.currency || "",
    line.qty
  ).first();
  return Number((row as any)?.c || 0);
}

async function releaseFulfillmentLine(env: any, lineKey: string): Promise<void> {
  try {
    await env.DB.prepare("DELETE FROM stripe_order_fulfillment_lines WHERE line_key = ?1").bind(lineKey).run();
  } catch {}
}

async function claimStripeWebhookEvent(env: any, event: any): Promise<{ status: "claimed" | "already_processed" | "in_progress" | "error"; token?: string }> {
  const schemaOk = await ensureStripeWebhookEventsSchema(env);
  if (!schemaOk) return { status: "error" };
  const eventId = String(event?.id || "").trim();
  const eventType = String(event?.type || "").trim();
  const stripeSessionId = String(event?.data?.object?.id || "").trim() || null;
  if (!eventId) return { status: "error" };

  await env.DB.prepare(
    `INSERT OR IGNORE INTO stripe_webhook_events
      (event_id, event_type, stripe_session_id, processing_token, processed_at, process_result, last_error, created_at, updated_at)
     VALUES (?1, ?2, ?3, NULL, NULL, NULL, NULL, datetime('now'), datetime('now'))`
  ).bind(eventId, eventType, stripeSessionId).run();

  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const claimRes = await env.DB.prepare(
    `UPDATE stripe_webhook_events
     SET processing_token = ?2, updated_at = datetime('now')
     WHERE event_id = ?1
       AND processed_at IS NULL
       AND (processing_token IS NULL OR updated_at < datetime('now', '-10 minutes'))`
  ).bind(eventId, token).run() as any;

  if (Number(claimRes?.meta?.changes || 0) > 0) {
    return { status: "claimed", token };
  }

  const row = await env.DB.prepare(
    "SELECT processed_at FROM stripe_webhook_events WHERE event_id = ?1 LIMIT 1"
  ).bind(eventId).first() as any;
  if (row?.processed_at) return { status: "already_processed" };
  return { status: "in_progress" };
}

async function markStripeWebhookEventProcessed(env: any, eventId: string, token: string, processResult: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE stripe_webhook_events
     SET processed_at = datetime('now'),
         process_result = ?3,
         processing_token = NULL,
         last_error = NULL,
         updated_at = datetime('now')
     WHERE event_id = ?1 AND processing_token = ?2`
  ).bind(eventId, token, processResult).run();
}

async function markStripeWebhookEventFailed(env: any, eventId: string, token: string, err: any): Promise<void> {
  await env.DB.prepare(
    `UPDATE stripe_webhook_events
     SET last_error = ?3,
         processing_token = NULL,
         updated_at = datetime('now')
     WHERE event_id = ?1 AND processing_token = ?2`
  ).bind(eventId, token, String(err?.message || err || "unknown")).run();
}

export async function handleStripeWebhook(request: Request, env: any): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  const webhookSafetyError = assertWebhookRuntimeSafety(request, env);
  if (webhookSafetyError) {
    return new Response(JSON.stringify({ error: webhookSafetyError }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await request.text();

  // Verify Stripe signature
  let event: any;
  try {
    // Manual HMAC-SHA256 verification compatible with Workers
    const parts = signature.split(",");
    const timestampPart = parts.find((p: string) => p.startsWith("t="));
    const sigPart = parts.find((p: string) => p.startsWith("v1="));
    if (!timestampPart || !sigPart) {
      throw new Error("Invalid signature format");
    }
    const timestamp = timestampPart.substring(2);
    const signedPayload = `${timestamp}.${rawBody}`;

    // Use Web Crypto API for HMAC verification
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = hexToArrayBuffer(sigPart.substring(3));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(signedPayload)
    );

    if (!valid) {
      throw new Error("Invalid signature");
    }

    event = JSON.parse(rawBody);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Handle charge.refunded — send team alert ──
  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const amount = (charge.amount || 0) / 100;
    const currency = String(charge.currency || "usd").toUpperCase();
    const chargeId = String(charge.id || "");
    const receiptUrl = String(charge.receipt_url || "");
    const reason = String(charge.refunds?.data?.[0]?.reason || "unknown");
    const billingName = String(charge.billing_details?.name || "");
    const billingEmail = String(charge.billing_details?.email || charge.receipt_email || "");
    const paymentMethod = String(charge.payment_method_details?.card?.brand || "")
      + " •••• " + String(charge.payment_method_details?.card?.last4 || "????");

    const teamEmail = env.ORDER_NOTIFICATION_EMAIL || "orders@mildmate.com";
    try {
      const emailBody = [
        `REFUND ISSUED`,
        ``,
        `Charge: ${chargeId}`,
        `Amount: ${amount.toFixed(2)} ${currency}`,
        `Reason: ${reason}`,
        `Payment: ${paymentMethod}`,
        ``,
        billingName ? `Customer: ${billingName}` : "",
        billingEmail ? `Email: ${billingEmail}` : "",
        receiptUrl ? `Receipt: ${receiptUrl}` : "",
        ``,
        `\u2014 MildMate Stripe Webhook`,
      ].filter(Boolean).join("\n");

      const teamMail = await sendEmail(env, {
        to: teamEmail,
        subject: `\u26A0\uFE0F Refund \u2014 ${amount.toFixed(2)} ${currency} \u2014 MildMate`,
        text: emailBody,
      });
      if (!teamMail.success) {
        console.error("Refund alert email failed:", teamMail.error || "unknown error");
      }
    } catch (err: any) {
      console.error("Refund alert exception:", err?.message || err);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Handle charge.dispute.created — send team alert ──
  if (event.type === "charge.dispute.created" || event.type === "customer.dispute.created") {
    const dispute = event.data.object;
    const chargeId = String(dispute.charge || "");
    const amount = (dispute.amount || 0) / 100;
    const currency = String(dispute.currency || "usd").toUpperCase();
    const reason = String(dispute.reason || "unknown");
    const status = String(dispute.status || "needs_response");
    const evidenceDueBy = String(dispute.evidence_details?.due_by || "N/A");

    const teamEmail = env.ORDER_NOTIFICATION_EMAIL || "orders@mildmate.com";
    try {
      const emailBody = [
        `DISPUTE / CHARGEBACK FILED`,
        ``,
        `Charge: ${chargeId}`,
        `Amount: ${amount.toFixed(2)} ${currency}`,
        `Reason: ${reason}`,
        `Status: ${status}`,
        `Evidence Due By: ${evidenceDueBy}`,
        ``,
        `Action required: respond in Stripe Dashboard before the evidence deadline.`,
        ``,
        `\u2014 MildMate Stripe Webhook`,
      ].join("\n");

      const teamMail = await sendEmail(env, {
        to: teamEmail,
        subject: `\uD83D\uDEA8 Dispute \u2014 ${amount.toFixed(2)} ${currency} \u2014 MildMate`,
        text: emailBody,
      });
      if (!teamMail.success) {
        console.error("Dispute alert email failed:", teamMail.error || "unknown error");
      }
    } catch (err: any) {
      console.error("Dispute alert exception:", err?.message || err);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Only handle checkout-session payment events for order processing
  const stripeOrderEventTypes = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
  ]);
  if (!stripeOrderEventTypes.has(String(event?.type || ""))) {
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventId = String(event?.id || "").trim();
  const claim = await claimStripeWebhookEvent(env, event);
  if (claim.status === "already_processed" || claim.status === "in_progress") {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  if (claim.status !== "claimed" || !claim.token) {
    return new Response(JSON.stringify({ error: "Webhook idempotency unavailable" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = event.data.object;
  if (event.type === "checkout.session.async_payment_failed") {
    await markStripeWebhookEventProcessed(env, eventId, claim.token, "ignored_async_payment_failed");
    return new Response(JSON.stringify({ received: true, ignored: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isStripeSessionPaid(session)) {
    await markStripeWebhookEventProcessed(env, eventId, claim.token, "ignored_unpaid");
    return new Response(JSON.stringify({ received: true, ignored: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const metadata = session.metadata || {};
    const customerNoteType = String(metadata.customer_note_type || "").trim().slice(0, 64) || null;
    const customerNote = String(metadata.customer_note || "").trim().slice(0, 450) || null;
    const shippingServiceLevelRaw = String(metadata.shipping_service_level || "").trim().toLowerCase();
    const shippingServiceType = shippingServiceLevelRaw === "standard"
      ? "Standard"
      : shippingServiceLevelRaw === "express"
        ? "Express"
        : "N/A";
    const hasOrderCustomerNoteColumns = await ensureOrderCustomerNoteSchema(env);

    const mapItems = (rawItems: any): any[] => {
      return (Array.isArray(rawItems) ? rawItems : []).map((item: any) => ({
        slug: item.slug || item.s || "",
        name: item.name || item.n || item.slug || item.s || "",
        quote_id: item.quote_id || item.qi || null,
        fabric: item.fabric || item.f || null,
        color: item.color || item.c || null,
        dims: (typeof item.dims === "object" && item.dims)
          || (typeof item.d === "object" && item.d)
          || ((typeof item.d === "string" || typeof item.dt === "string")
            ? { size_text: (typeof item.d === "string" ? item.d : item.dt) }
            : {}),
        qty: item.qty || item.q || 1,
        unit_amount: Number(item.u || item.unit_amount || 0), // minor unit (cents/satang)
      }));
    };

    let items: any[] = [];
    let itemsSource = "metadata";
    try {
      const schemaOk = await ensureCheckoutSnapshotSchema(env);
      if (schemaOk && session.id) {
        const snapshot = await env.DB.prepare(
          "SELECT items_json FROM checkout_session_snapshots WHERE stripe_session_id = ?1 LIMIT 1"
        ).bind(String(session.id)).first() as any;
        if (snapshot?.items_json) {
          const rawSnapshotItems = JSON.parse(String(snapshot.items_json || "[]"));
          const mapped = mapItems(rawSnapshotItems);
          if (mapped.length > 0) {
            items = mapped;
            itemsSource = "d1_snapshot";
          }
        }
      }
    } catch (e: any) {
      console.error("checkout snapshot read failed:", e?.message || e);
    }
    if (items.length === 0) {
      try {
        const rawItems = JSON.parse(metadata.items || "[]");
        items = mapItems(rawItems);
        itemsSource = "metadata";
      } catch {
        // continue without items
      }
    }
    console.log("order items source:", itemsSource, "session:", session.id, "count:", items.length);

    const sessionCurrency = String(session.currency || "usd").toLowerCase();
    const totalQty = items.reduce((sum: number, item: any) => sum + (item.qty || 1), 0);
    const fallbackUnitAmount = totalQty > 0 && session.amount_total
      ? Math.round(session.amount_total / totalQty)
      : 0;
    const toFiniteNumber = (v: any): number | undefined => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const parseDimsFromSizeText = (sizeText: any): { w?: number; l?: number; d?: number; unit?: string } => {
      const clean = String(sizeText || "").replace(/^dimensions:\s*/i, "").trim();
      const m = clean.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?\s*(cm|inch|in)?/i);
      if (!m) return {};
      const unitRaw = String(m[4] || "").toLowerCase();
      return {
        w: toFiniteNumber(m[1]),
        l: toFiniteNumber(m[2]),
        d: toFiniteNumber(m[3]),
        unit: (unitRaw === "inch" || unitRaw === "in") ? "inch" : "cm",
      };
    };
    const hasUsefulDims = (dims: any): boolean => {
      if (!dims || typeof dims !== "object") return false;
      if (toFiniteNumber(dims.w) && toFiniteNumber(dims.l)) return true;
      if (String(dims.size_text || "").trim()) return true;
      if (String(dims.boat_model_name || dims.boat_model_key || "").trim()) return true;
      if (String(dims.shape_code || dims.shape_name || "").trim()) return true;
      if (dims.values && typeof dims.values === "object" && Object.keys(dims.values).length > 0) return true;
      return false;
    };
    const formatDimsForEmail = (dims: any): string => {
      const unit = String(dims?.unit || "cm");
      const boatModelName = String(dims?.boat_model_name || "").trim();
      if (boatModelName) {
        const modelKey = String(dims?.boat_model_key || "").trim();
        return modelKey ? `Model: ${boatModelName} (${modelKey})` : `Model: ${boatModelName}`;
      }
      const shapeCode = String(dims?.shape_code || "").trim();
      const shapeName = String(dims?.shape_name || "").trim();
      const valuesObj = (dims?.values && typeof dims.values === "object" && !Array.isArray(dims.values))
        ? dims.values
        : null;
      if (shapeCode || shapeName || valuesObj) {
        const shapeLabel = [shapeCode ? `Shape ${shapeCode}` : "", shapeName].filter(Boolean).join(" — ");
        const order = ["A", "B", "C", "D", "E", "F", "G", "H", "W", "L", "T"];
        const valuePairs = valuesObj
          ? Object.keys(valuesObj)
              .sort((a, b) => {
                const ai = order.indexOf(String(a).toUpperCase());
                const bi = order.indexOf(String(b).toUpperCase());
                if (ai === -1 && bi === -1) return String(a).localeCompare(String(b));
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
              })
              .map((k) => {
                const n = toFiniteNumber(valuesObj[k]);
                return n ? `${String(k).toUpperCase()}:${n}` : null;
              })
              .filter(Boolean)
          : [];
        const areaCm2 = toFiniteNumber(dims?.area_cm2);
        const extra = [
          valuePairs.length ? `${valuePairs.join(", ")} ${unit}` : "",
          areaCm2 ? `Area:${Math.round(areaCm2).toLocaleString()} cm²` : "",
        ].filter(Boolean).join(" | ");
        return [shapeLabel, extra].filter(Boolean).join(" | ") || `?×? ${unit}`;
      }
      const w = toFiniteNumber(dims?.w);
      const l = toFiniteNumber(dims?.l);
      const d = toFiniteNumber(dims?.d);
      if (w && l) return `${w}×${l}${d ? `×${d}` : ""} ${unit}`;
      const sizeText = String(dims?.size_text || "").trim();
      if (sizeText) return sizeText.replace(/^dimensions:\s*/i, "").trim();
      return `?×? ${unit}`;
    };

    let insertedOrderRows = 0;
    const lineOccurrenceMap = new Map<string, number>();
    for (let lineIndex = 0; lineIndex < items.length; lineIndex++) {
      const item = items[lineIndex];
      let dims = item.dims || {};
      if (!hasUsefulDims(dims) && item.quote_id) {
        try {
          const quoteRow = await env.DB.prepare(
            "SELECT dimensions FROM custom_quotes WHERE quote_id = ?1 LIMIT 1"
          ).bind(String(item.quote_id)).first() as any;
          if (quoteRow?.dimensions) {
            const fromQuote = typeof quoteRow.dimensions === "string"
              ? JSON.parse(quoteRow.dimensions)
              : quoteRow.dimensions;
            if (fromQuote && typeof fromQuote === "object") {
              dims = fromQuote;
              item.dims = dims;
            }
          }
        } catch (e: any) {
          console.error("quote dims hydrate failed:", item.quote_id, e?.message || e);
        }
      }
      const parsedDims = parseDimsFromSizeText(dims?.size_text);
      const widthCm = toFiniteNumber(dims.w) ?? parsedDims.w ?? null;
      const lengthCm = toFiniteNumber(dims.l) ?? parsedDims.l ?? null;
      const depthCm = toFiniteNumber(dims.d) ?? parsedDims.d ?? null;
      const unitAmount = item.unit_amount > 0 ? item.unit_amount : fallbackUnitAmount;
      const unitPriceMajor = unitAmount > 0 ? unitAmount / 100 : null;

      const linePayload = {
        slug: item.slug || "",
        name: item.name || "",
        quote_id: item.quote_id || "",
        fabric: item.fabric || "",
        color: item.color || "",
        dims,
        qty: item.qty || 1,
        unit_amount: unitAmount,
      };
      const lineIdentity = JSON.stringify(buildFulfillmentLineIdentity(linePayload));
      const lineOccurrence = (lineOccurrenceMap.get(lineIdentity) || 0) + 1;
      lineOccurrenceMap.set(lineIdentity, lineOccurrence);
      const lineKey = await buildFulfillmentLineKey(session.id, linePayload, lineOccurrence);

      const lineClaimed = await claimFulfillmentLine(env, String(session.id || ""), eventId, lineKey, lineIndex);
      if (!lineClaimed) continue;

      try {
        const priceUsd = sessionCurrency === "usd" ? unitPriceMajor : null;
        const priceThb = sessionCurrency === "thb" ? unitPriceMajor : null;
        const existingCount = await countExistingConfirmedOrderLines(env, {
          sessionId: session.id,
          productSlug: String(item.slug || ""),
          productTitle: String(item.name || ""),
          fabric: item.fabric || null,
          color: item.color || null,
          widthCm,
          lengthCm,
          depthCm,
          priceUsd,
          priceThb,
          currency: sessionCurrency,
          qty: Number(item.qty || 1) || 1,
        });
        if (existingCount >= lineOccurrence) continue;

        if (hasOrderCustomerNoteColumns) {
          await env.DB.prepare(
            `INSERT INTO orders (
              stripe_session_id, stripe_payment_intent_id, email, customer_name, phone,
              shipping_address, product_slug, product_title_en, fabric, color,
              width_cm, length_cm, depth_cm, width_in, length_in, depth_in,
              custom_notes, price_usd, price_thb, currency, quantity, discount_code,
              customer_note_type, customer_note, status
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, 'confirmed')`
          ).bind(
            session.id,
            session.payment_intent || null,
            (metadata.email || session.customer_email || "").toLowerCase(),
            metadata.name || null,
            metadata.phone || null,
            metadata.address || null,
            item.slug || "",
            item.name || "",
            item.fabric || null,
            item.color || null,
            widthCm,
            lengthCm,
            depthCm,
            null, null, null,
            null,
            priceUsd,
            priceThb,
            sessionCurrency,
            item.qty || 1,
            metadata.discount_code || null,
            customerNoteType,
            customerNote
          ).run();
        } else {
          await env.DB.prepare(
            `INSERT INTO orders (
              stripe_session_id, stripe_payment_intent_id, email, customer_name, phone,
              shipping_address, product_slug, product_title_en, fabric, color,
              width_cm, length_cm, depth_cm, width_in, length_in, depth_in,
              custom_notes, price_usd, price_thb, currency, quantity, discount_code, status
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, 'confirmed')`
          ).bind(
            session.id,
            session.payment_intent || null,
            (metadata.email || session.customer_email || "").toLowerCase(),
            metadata.name || null,
            metadata.phone || null,
            metadata.address || null,
            item.slug || "",
            item.name || "",
            item.fabric || null,
            item.color || null,
            widthCm,
            lengthCm,
            depthCm,
            null, null, null,
            null,
            priceUsd,
            priceThb,
            sessionCurrency,
            item.qty || 1,
            metadata.discount_code || null
          ).run();
        }
        insertedOrderRows++;
      } catch (e: any) {
        await releaseFulfillmentLine(env, lineKey);
        throw e;
      }
    }

    if (insertedOrderRows > 0 && metadata.discount_code) {
      try {
        var addrHash = metadata.address ? await sha256(normalizeAddress(metadata.address)) : null;
        const normalizedEmail2 = (metadata.email || session.customer_email || "").toLowerCase();
        const promoRow = await env.DB.prepare(
          "SELECT id FROM promo_codes WHERE code = ? AND is_active = 1"
        ).bind(metadata.discount_code).first();
        if (promoRow) {
          await env.DB.prepare(
            "UPDATE promo_codes SET use_count = use_count + 1 WHERE id = ?"
          ).bind((promoRow as any).id).run();
          await env.DB.prepare(
            "INSERT INTO promo_redemptions (promo_id, email, order_id) VALUES (?, ?, ?)"
          ).bind((promoRow as any).id, normalizedEmail2, null).run();
        } else {
          await env.DB.prepare(
            "UPDATE discount_claims SET status = 'used', address_hash = ?, order_id = last_insert_rowid(), claimed_at = datetime('now') WHERE code = ? AND status = 'issued'"
          ).bind(addrHash, metadata.discount_code).run();
        }
      } catch (err) {
        console.error("Discount claim failed:", (err as any)?.message || err);
      }
    }

    const email = metadata.email || session.customer_email;
    if (insertedOrderRows > 0 && email) {
      try {
        await env.DB.prepare(
          "UPDATE abandoned_carts SET recovered = 1 WHERE email = ?1 AND recovered = 0"
        ).bind(email).run();
      } catch {}

      if (metadata.address) {
        try {
          const existing = await env.DB.prepare(
            "SELECT id FROM customer_addresses WHERE email = ?1 AND address = ?2 LIMIT 1"
          ).bind(email, metadata.address).first();
          if (!existing) {
            const fullName = (metadata.name || "").trim();
            const nameParts = fullName.split(/\s+/);
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";
            const addrParts = metadata.address.split(",").map((s: string) => s.trim());
            const country = addrParts[addrParts.length - 1] || "";
            const postal = addrParts.length >= 2 ? addrParts[addrParts.length - 2] : "";
            const state = addrParts.length >= 3 ? addrParts[addrParts.length - 3] : "";
            const city = addrParts.length >= 4 ? addrParts[addrParts.length - 4] : "";
            await env.DB.prepare(
              `INSERT INTO customer_addresses (email, label, first_name, last_name, phone, country, address, city, state, postal_code, is_default)
               VALUES (?1, 'Home', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)`
            ).bind(email, firstName, lastName, metadata.phone || "", country, metadata.address, city, state, postal).run();
          }
        } catch {}
      }

      if (env.RESEND_API_KEY) {
        const itemList = items.map((i: any) => {
          const dims = i.dims || {};
          return `- ${i.name} | ${i.fabric || "N/A"} | ${i.color || "N/A"} | ${formatDimsForEmail(dims)} | Qty: ${i.qty || 1}`;
        }).join("\n");
        const total = session.amount_total
          ? `${(session.amount_total / 100).toFixed(2)} ${session.currency?.toUpperCase() || "USD"}`
          : "N/A";
        const shippingCountryCode = String(
          metadata.shipping_country_applied || metadata.shipping_country_requested || ""
        ).trim().toUpperCase();
        const dutyTaxNotice = (shippingCountryCode === "US" || shippingCountryCode === "CA")
          ? "Import duties and taxes are included (DDP) for this shipment."
          : (shippingCountryCode === "TH" ? "" : "Import duties, VAT, and local taxes are not included and may be collected on delivery.");
        const dutyTaxLine = dutyTaxNotice ? `\n\nDuty/Tax: ${dutyTaxNotice}` : "";
        const dutyTaxTeamLine = dutyTaxNotice ? `\nDuty/Tax: ${dutyTaxNotice}` : "";
        try {
          const customerMail = await sendEmail(env, {
            to: email,
            subject: `Order Confirmed \u2014 MildMate #${session.id.slice(-8)}`,
            text: `Thank you for your order!\n\nOrder: #${session.id.slice(-8)}\n\nItems:\n${itemList}\n\nTotal: ${total}${dutyTaxLine}\n\nWe'll notify you when your order ships.\n\n\u2014 MildMate`,
          });
          if (!customerMail.success) console.error("Customer email failed:", customerMail.error || "unknown error", "to:", email);
        } catch (err: any) {
          console.error("Customer email exception:", err?.message || err, "to:", email);
        }

        const teamEmail = env.ORDER_NOTIFICATION_EMAIL || "orders@mildmate.com";
        try {
          const customerNoteText = customerNote
            ? `\nMessage Type: ${customerNoteType || "other"}\nCustomer Message: ${customerNote}`
            : "";
          const teamMail = await sendEmail(env, {
            to: teamEmail,
            subject: `New Order \u2014 MildMate #${session.id.slice(-8)}`,
            text: `New order received!\n\nOrder: #${session.id.slice(-8)}\nCustomer: ${metadata.name || "Guest"} (${email})\nPhone: ${metadata.phone || "N/A"}\nAddress: ${metadata.address || "N/A"}\nShipping Type: ${shippingServiceType}${customerNoteText}\n\nItems:\n${itemList}\n\nTotal: ${total}${dutyTaxTeamLine}`,
          });
          if (!teamMail.success) console.error("Team email failed:", teamMail.error || "unknown error", "to:", teamEmail);
        } catch (err: any) {
          console.error("Team email exception:", err?.message || err, "to:", teamEmail);
        }
      }

      try {
        const { results: cfgRows } = await env.DB.prepare("SELECT key, value FROM recovery_config").all();
        let discountPct = 20, sendAfterHours = 1;
        if (cfgRows) {
          const map: Record<string, string> = {};
          for (const row of cfgRows as any[]) map[row.key] = row.value;
          discountPct = Number(map.thankyou_discount) || 20;
          sendAfterHours = Number(map.thankyou_send_after_hours) || 1;
        }
        const normalizedEmail = email.toLowerCase();
        const existingForOrder = await env.DB.prepare(
          "SELECT id FROM thankyou_queue WHERE order_id = ?1 LIMIT 1"
        ).bind(session.id).first();
        if (!existingForOrder) {
          const activeClaim = await env.DB.prepare(
            "SELECT code, expires_at FROM discount_claims WHERE email = ?1 AND source = 'thankyou' AND status = 'issued' AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
          ).bind(normalizedEmail).first() as any;
          if (!activeClaim) {
            const discountCode = "THANKS-" + Math.random().toString(36).substring(2, 8).toUpperCase();
            const expiresAt = new Date(Date.now() + 365 * 86400 * 1000).toISOString().replace("T", " ").slice(0, 19);
            const sendAfter = new Date(Date.now() + sendAfterHours * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);
            await env.DB.prepare(
              "INSERT INTO discount_claims (code, email, status, discount_pct, expires_at, source, created_at) VALUES (?, ?, 'issued', ?, ?, 'thankyou', datetime('now'))"
            ).bind(discountCode, normalizedEmail, discountPct, expiresAt).run();
            await env.DB.prepare(
              "INSERT INTO thankyou_queue (order_id, email, discount_code, discount_pct, send_after) VALUES (?, ?, ?, ?, ?)"
            ).bind(session.id, normalizedEmail, discountCode, discountPct, sendAfter).run();
            console.log(`Webhook: thankyou queued for ${email} (${discountPct}%, send after ${sendAfterHours}h)`);
          }
        } else {
          console.log(`Webhook: thankyou skip (already queued for order ${session.id})`);
        }
      } catch (e: any) {
        console.error("Thankyou queue insert failed:", e.message);
      }
    }

    await markStripeWebhookEventProcessed(
      env,
      eventId,
      claim.token,
      insertedOrderRows > 0 ? "processed" : "deduped_no_new_rows"
    );
    return new Response(JSON.stringify({ received: true, inserted_order_rows: insertedOrderRows }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    await markStripeWebhookEventFailed(env, eventId, claim.token, e);
    console.error("Stripe webhook order processing failed:", e?.message || e);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}
