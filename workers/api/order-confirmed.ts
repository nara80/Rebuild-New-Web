import {
  extractUniqueQuoteIdsFromItems,
  sanitizeAttributionPayload,
  upsertQuoteAttributionFromCheckout,
} from "./attribution";

// MildMate Order Confirmation API
// GET /api/order-confirmed?session_id=cs_xxx — returns order summary for confirmation page
async function sha256(text: string): Promise<string> {
  const d = new TextEncoder().encode(text);
  const h = await crypto.subtle.digest("SHA-256", d);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isProductionHost(request: Request): boolean {
  try {
    const host = new URL(request.url).hostname.toLowerCase();
    return host === "www.mildmate.com" || host === "mildmate.com";
  } catch {
    return false;
  }
}

function inferStripeSecretMode(secret: string): "live" | "test" | "unknown" {
  if (secret.startsWith("sk_live_")) return "live";
  if (secret.startsWith("sk_test_")) return "test";
  return "unknown";
}

function assertReconcileRuntimeSafety(request: Request, env: any): string | null {
  const stripeKey = String(env.STRIPE_SECRET_KEY || "");
  if (!stripeKey) return null;
  const prodHost = isProductionHost(request);
  const runtimeEnv = String(env.RUNTIME_ENV || env.APP_ENV || "").trim().toLowerCase();
  const d1Label = String(env.D1_ENV_LABEL || "").trim().toLowerCase();
  const stripeMode = inferStripeSecretMode(stripeKey);

  if (prodHost) {
    if (stripeMode === "test") return "Production host cannot use Stripe test secret key";
    if (runtimeEnv && runtimeEnv !== "prod" && runtimeEnv !== "production") {
      return "Production host runtime environment mismatch";
    }
    return null;
  }

  if (env.NON_PROD_STRIPE_ALLOWED !== "true") {
    return "Non-production reconcile disabled until NON_PROD_STRIPE_ALLOWED=true";
  }
  if (!runtimeEnv || runtimeEnv === "prod" || runtimeEnv === "production") {
    return "Non-production runtime requires explicit non-production RUNTIME_ENV";
  }
  if (stripeMode !== "test") {
    return "Non-production reconcile requires Stripe test secret key";
  }
  if (!d1Label || d1Label === "prod" || d1Label === "production") {
    return "Non-production runtime requires non-production D1_ENV_LABEL";
  }
  return null;
}

let fulfillmentSchemaReady = false;
let fulfillmentSchemaPromise: Promise<boolean> | null = null;
const PAID_OR_HISTORICAL_ORDER_STATUSES = ["confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];
const PURCHASE_REPORTABLE_ORDER_STATUSES = ["confirmed", "processing", "shipped", "delivered"];

async function ensureFulfillmentSchema(env: any): Promise<boolean> {
  if (fulfillmentSchemaReady) return true;
  if (!fulfillmentSchemaPromise) {
    fulfillmentSchemaPromise = (async () => {
      try {
        const row = await env.DB.prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'stripe_order_fulfillment_lines' LIMIT 1"
        ).first() as any;
        const ok = !!row?.name;
        if (!ok) {
          console.error("Missing required table stripe_order_fulfillment_lines; apply migration 057_stripe_payment_idempotency.sql");
        }
        fulfillmentSchemaReady = ok;
        return ok;
      } catch (e: any) {
        console.error("fulfillment schema init failed:", e?.message || e);
        return false;
      }
    })().finally(() => {
      if (!fulfillmentSchemaReady) fulfillmentSchemaPromise = null;
    });
  }
  return await fulfillmentSchemaPromise;
}

function toFiniteNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeDimsForKey(dimsRaw: any): any {
  const dims = dimsRaw && typeof dimsRaw === "object" ? dimsRaw : {};
  const valuesRaw = dims.values && typeof dims.values === "object" ? dims.values : {};
  const values: Record<string, number> = {};
  Object.keys(valuesRaw).sort().forEach((k) => {
    const n = toFiniteNumber(valuesRaw[k]);
    if (n !== null) values[String(k).toUpperCase()] = n;
  });
  return {
    w: toFiniteNumber(dims.w),
    l: toFiniteNumber(dims.l),
    d: toFiniteNumber(dims.d),
    unit: String(dims.unit || "cm"),
    size_text: String(dims.size_text || ""),
    shape_code: String(dims.shape_code || ""),
    shape_name: String(dims.shape_name || ""),
    boat_model_name: String(dims.boat_model_name || ""),
    boat_model_key: String(dims.boat_model_key || ""),
    area_cm2: toFiniteNumber(dims.area_cm2),
    values,
  };
}

function buildFulfillmentLineIdentity(item: any): any {
  return {
    slug: String(item?.slug || item?.s || ""),
    name: String(item?.name || item?.n || ""),
    quote_id: String(item?.quote_id || item?.qi || ""),
    fabric: String(item?.fabric || item?.f || ""),
    color: String(item?.color || item?.c || ""),
    qty: Number(item?.qty || item?.q || 1) || 1,
    unit_amount: Number(item?.u || item?.unit_amount || 0) || 0,
    dims: normalizeDimsForKey((item as any)?.dims || (item as any)?.d || {}),
  };
}

async function buildFulfillmentLineKey(sessionId: string, item: any, occurrence: number): Promise<string> {
  const payload = JSON.stringify({
    session_id: String(sessionId || ""),
    occurrence: Number(occurrence || 1),
    slug: String(item?.slug || item?.s || ""),
    name: String(item?.name || item?.n || ""),
    quote_id: String(item?.quote_id || item?.qi || ""),
    fabric: String(item?.fabric || item?.f || ""),
    color: String(item?.color || item?.c || ""),
    qty: Number(item?.qty || item?.q || 1) || 1,
    unit_amount: Number(item?.u || item?.unit_amount || 0) || 0,
    dims: normalizeDimsForKey((item as any)?.dims || (item as any)?.d || {}),
  });
  return sha256(payload);
}

async function claimFulfillmentLine(env: any, sessionId: string, lineKey: string, lineIndex: number): Promise<boolean> {
  const schemaOk = await ensureFulfillmentSchema(env);
  if (!schemaOk) return false;
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO stripe_order_fulfillment_lines
      (line_key, stripe_session_id, stripe_event_id, line_index, created_at)
     VALUES (?1, ?2, NULL, ?3, datetime('now'))`
  ).bind(lineKey, sessionId, lineIndex).run() as any;
  const changes = Number(res?.meta?.changes || 0);
  return changes > 0;
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

async function getOrdersBySession(env: any, sessionId: string): Promise<any[]> {
  const paidStatusesSql = PAID_OR_HISTORICAL_ORDER_STATUSES.map((s) => `'${s}'`).join(",");
  const { results } = await env.DB.prepare(
    `SELECT id, stripe_session_id, stripe_payment_intent_id, email, shipping_address, product_title_en, fabric, color,
            width_cm, length_cm, depth_cm, price_usd, price_thb,
            currency, quantity, status, created_at, quote_id
     FROM orders
     WHERE stripe_session_id = ?1
       AND LOWER(COALESCE(status, '')) IN (${paidStatusesSql})
     ORDER BY created_at DESC`
  ).bind(sessionId).all();
  return results || [];
}

async function fetchStripeSessionForEvidence(sessionId: string, env: any): Promise<{ paid: boolean; amountTotalMinor: number | null }> {
  const stripeKey = String(env.STRIPE_SECRET_KEY || "");
  if (!stripeKey) return { paid: false, amountTotalMinor: null };
  try {
    const resp = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } }
    );
    if (!resp.ok) return { paid: false, amountTotalMinor: null };
    const session = await resp.json() as any;
    const paid = String(session?.payment_status || "").toLowerCase() === "paid";
    const amountRaw = Number(session?.amount_total);
    return { paid, amountTotalMinor: Number.isFinite(amountRaw) ? amountRaw : null };
  } catch {
    return { paid: false, amountTotalMinor: null };
  }
}

async function hasWebhookPaidEvidence(sessionId: string, env: any): Promise<boolean> {
  try {
    const row = await env.DB.prepare(
      `SELECT event_id
       FROM stripe_webhook_events
       WHERE stripe_session_id = ?1
         AND processed_at IS NOT NULL
         AND process_result IN ('processed', 'deduped_no_new_rows')
         AND event_type IN ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
       LIMIT 1`
    ).bind(sessionId).first();
    return !!row;
  } catch {
    return false;
  }
}

function isPurchaseReportableStatus(statusRaw: any): boolean {
  const status = String(statusRaw || "").trim().toLowerCase();
  return PURCHASE_REPORTABLE_ORDER_STATUSES.includes(status);
}

async function reconcilePaidSessionToOrders(sessionId: string, env: any): Promise<boolean> {
  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return false;

  const paidStatusesSql = PAID_OR_HISTORICAL_ORDER_STATUSES.map((s) => `'${s}'`).join(",");
  const existing = await env.DB.prepare(
    `SELECT id FROM orders
     WHERE stripe_session_id = ?1
       AND LOWER(COALESCE(status, '')) IN (${paidStatusesSql})
     LIMIT 1`
  ).bind(sessionId).first();
  if (existing) return true;

  const sessionResp = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${stripeKey}` } }
  );
  if (!sessionResp.ok) return false;
  const session = await sessionResp.json() as any;

  const isPaid = String(session.payment_status || "").toLowerCase() === "paid";
  if (!isPaid) return false;

  const email = String(
    session?.metadata?.email ||
    session?.customer_email ||
    session?.customer_details?.email ||
    ""
  ).trim().toLowerCase();
  if (!email) return false;

  let metaItems: any[] = [];
  try {
    const parsed = JSON.parse(session?.metadata?.items || "[]");
    metaItems = Array.isArray(parsed) ? parsed : [];
  } catch {
    metaItems = [];
  }

  let lineItems: any[] = [];
  const lineResp = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/line_items?limit=100`,
    { headers: { Authorization: `Bearer ${stripeKey}` } }
  );
  if (lineResp.ok) {
    const lineData = await lineResp.json() as any;
    lineItems = Array.isArray(lineData?.data) ? lineData.data : [];
  }

  // Authoritative item sources — same priority as the webhook:
  //   1) D1 checkout_session_snapshots  2) session metadata  3) Stripe line_items
  // Product identity is never reconstructed from untrusted Stripe descriptions
  // when an authoritative record exists, and the Stripe shipping line is always
  // excluded so a shipping charge never becomes a product order row.
  const mapItems = (rawItems: any): any[] => (Array.isArray(rawItems) ? rawItems : []).map((item: any) => ({
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
    unit_amount: Number(item.u || item.unit_amount || 0),
  }));

  const hasUsefulDims = (dims: any): boolean => {
    if (!dims || typeof dims !== "object") return false;
    if (toFiniteNumber(dims.w) && toFiniteNumber(dims.l)) return true;
    if (String(dims.size_text || "").trim()) return true;
    if (String(dims.shape_code || dims.shape_name || "").trim()) return true;
    if (String(dims.boat_model_name || dims.boat_model_key || "").trim()) return true;
    if (dims.values && typeof dims.values === "object" && Object.keys(dims.values).length > 0) return true;
    return false;
  };

  let items: any[] = [];
  let itemsSource = "none";
  let snapshotCurrency: string | null = null;
  let checkoutAttribution = sanitizeAttributionPayload(null, "checkout");
  let quoteIdsFromSnapshot: string[] = [];
  try {
    const snap = await env.DB.prepare(
      "SELECT items_json, currency, attribution_json, quote_ids_json FROM checkout_session_snapshots WHERE stripe_session_id = ?1 LIMIT 1"
    ).bind(String(session.id)).first() as any;
    if (snap?.items_json) {
      const parsedSnap = JSON.parse(String(snap.items_json || "[]"));
      if (Array.isArray(parsedSnap) && parsedSnap.length > 0) {
        items = mapItems(parsedSnap);
        itemsSource = "d1_snapshot";
        snapshotCurrency = String(snap?.currency || "").toLowerCase() || null;
      }
    }
    if (snap?.attribution_json) {
      checkoutAttribution = sanitizeAttributionPayload(snap.attribution_json, "checkout");
    }
    if (snap?.quote_ids_json) {
      try {
        const parsedIds = JSON.parse(String(snap.quote_ids_json || "[]"));
        quoteIdsFromSnapshot = Array.isArray(parsedIds) ? parsedIds : [];
      } catch {}
    }
  } catch (e: any) {
    console.error("reconcile snapshot read failed:", e?.message || e);
  }
  if (items.length === 0 && metaItems.length > 0) {
    items = mapItems(metaItems);
    itemsSource = "metadata";
  }
  if (items.length === 0 && lineItems.length > 0) {
    items = lineItems
      .filter((li: any) => {
        const label = String(li?.description || li?.price?.product_data?.name || "");
        return !/^shipping/i.test(label.trim());
      })
      .map((li: any) => {
        const liQty = Number(li?.quantity || 1) || 1;
        const liUnitMinor = Number(li?.price?.unit_amount || 0)
          || (Number(li?.amount_total || 0) && liQty ? Math.round(Number(li.amount_total) / liQty) : 0);
        return {
          slug: "",
          name: String(li?.description || li?.price?.product_data?.name || "Custom Order"),
          quote_id: null,
          fabric: null,
          color: null,
          dims: {} as any,
          qty: liQty,
          unit_amount: liUnitMinor,
        };
      });
    itemsSource = "stripe_line_items";
  }
  if (items.length === 0) return false;
  console.log("reconcile items source:", itemsSource, "session:", session.id, "count:", items.length);
  const quoteIdsForAttribution = Array.from(new Set([
    ...extractUniqueQuoteIdsFromItems(items),
    ...quoteIdsFromSnapshot.map((id) => String(id || "").trim()).filter(Boolean),
  ]));

  const sessionCurrency = String(snapshotCurrency || session.currency || "usd").toLowerCase();
  let inserted = 0;

  // Quote lines with no useful dims are hydrated from the approved quote row
  // (same rule as the webhook) so the order keeps the approved option identity.
  for (const item of items) {
    if (item.quote_id && !hasUsefulDims(item.dims)) {
      try {
        const q = await env.DB.prepare(
          "SELECT dimensions FROM custom_quotes WHERE quote_id = ?1 LIMIT 1"
        ).bind(String(item.quote_id)).first() as any;
        if (q?.dimensions) {
          const qd = JSON.parse(String(q.dimensions || "{}"));
          if (qd && typeof qd === "object") item.dims = qd;
        }
      } catch {}
    }
  }

  const lineOccurrenceMap = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i] || {};
    const dims = item.dims || {};
    const qty = Number(item.qty || 1) || 1;
    const unitMinor = Number(item.unit_amount || 0) || 0;
    const unitMajor = unitMinor > 0 ? unitMinor / 100 : null;
    const idempotencySource = {
      slug: String(item.slug || ""),
      name: String(item.name || ""),
      quote_id: item.quote_id || null,
      fabric: item.fabric || null,
      color: item.color || null,
      dims,
      qty,
      unit_amount: unitMinor,
    };
    const lineIdentity = JSON.stringify(buildFulfillmentLineIdentity(idempotencySource));
    const lineOccurrence = (lineOccurrenceMap.get(lineIdentity) || 0) + 1;
    lineOccurrenceMap.set(lineIdentity, lineOccurrence);
    const lineKey = await buildFulfillmentLineKey(session.id, idempotencySource, lineOccurrence);
    const lineClaimed = await claimFulfillmentLine(env, session.id, lineKey, i);
    if (!lineClaimed) continue;

    const existingCount = await countExistingConfirmedOrderLines(env, {
      sessionId: session.id,
      productSlug: String(item.slug || ""),
      productTitle: String(item.name || ""),
      fabric: item.fabric || null,
      color: item.color || null,
      widthCm: dims.w || null,
      lengthCm: dims.l || null,
      depthCm: dims.d || null,
      priceUsd: sessionCurrency === "usd" ? unitMajor : null,
      priceThb: sessionCurrency === "thb" ? unitMajor : null,
      currency: sessionCurrency,
      qty,
    });
    if (existingCount >= lineOccurrence) continue;

    await env.DB.prepare(
      `INSERT INTO orders (
        stripe_session_id, stripe_payment_intent_id, email, customer_name, phone,
        shipping_address, product_slug, product_title_en, fabric, color,
        width_cm, length_cm, depth_cm, width_in, length_in, depth_in,
        custom_notes, price_usd, price_thb, currency, quantity, discount_code,
        quote_id, status
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, 'confirmed')`
    ).bind(
      session.id,
      session.payment_intent || null,
      email,
      session?.metadata?.name || session?.customer_details?.name || null,
      session?.metadata?.phone || session?.customer_details?.phone || null,
      session?.metadata?.address || null,
      String(item.slug || ""),
      String(item.name || ""),
      item.fabric || null,
      item.color || null,
      dims.w || null,
      dims.l || null,
      dims.d || null,
      null, null, null,
      null,
      sessionCurrency === "usd" ? unitMajor : null,
      sessionCurrency === "thb" ? unitMajor : null,
      sessionCurrency,
      qty,
      session?.metadata?.discount_code || null,
      item.quote_id || null
    ).run();
    inserted++;
  }

  if (inserted > 0 && quoteIdsForAttribution.length > 0) {
    try {
      await upsertQuoteAttributionFromCheckout(
        env,
        quoteIdsForAttribution,
        email,
        checkoutAttribution,
        String(session.id || "")
      );
    } catch (e: any) {
      console.error("reconcile quote attribution persist failed:", e?.message || e);
    }
  }

  return inserted > 0;
}

export async function handleOrderConfirmed(request: Request, env: any): Promise<Response> {
  const reconcileSafetyError = assertReconcileRuntimeSafety(request, env);
  if (reconcileSafetyError) {
    return new Response(JSON.stringify({ error: reconcileSafetyError }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing session_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    let results = await getOrdersBySession(env, sessionId);
    if (!results || results.length === 0) {
      try {
        const reconciled = await reconcilePaidSessionToOrders(sessionId, env);
        if (reconciled) {
          results = await getOrdersBySession(env, sessionId);
        }
      } catch (reconcileErr: any) {
        console.error("Order reconcile failed:", reconcileErr?.message || reconcileErr);
      }
    }
    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ pending: true, payment_verified: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    const stripeSessionEvidence = await fetchStripeSessionForEvidence(sessionId, env);
    const stripePaidEvidence = stripeSessionEvidence.paid || (await hasWebhookPaidEvidence(sessionId, env));
    const purchaseReportableOrders = results.filter((r: any) => isPurchaseReportableStatus(r?.status));
    const purchaseReportableValue = purchaseReportableOrders.reduce((sum: number, row: any) => {
      const qty = Number(row?.quantity || 1) || 1;
      const currency = String(row?.currency || "usd").toLowerCase();
      const unit = currency === "thb"
        ? Number(row?.price_thb || row?.price_usd || 0)
        : Number(row?.price_usd || 0);
      return sum + ((Number(unit || 0) || 0) * qty);
    }, 0);
    const responseOrders = results.map((row: any) => {
      const copy = { ...row };
      delete (copy as any).stripe_payment_intent_id;
      return copy;
    });
    return new Response(JSON.stringify({
      orders: responseOrders,
      session_id: sessionId,
      count: responseOrders.length,
      payment_verified: stripePaidEvidence,
      purchase_reportable: stripePaidEvidence && purchaseReportableOrders.length > 0,
      purchase_reportable_count: purchaseReportableOrders.length,
      purchase_reportable_value: Math.round(purchaseReportableValue * 100) / 100,
      session_amount_total: stripeSessionEvidence.amountTotalMinor,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Order confirmed lookup error:", e.message);
    return new Response(JSON.stringify({ error: "Database error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
