// MildMate Order Confirmation API
// GET /api/order-confirmed?session_id=cs_xxx — returns order summary for confirmation page
async function getOrdersBySession(env: any, sessionId: string): Promise<any[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, stripe_session_id, email, shipping_address, product_title_en, fabric, color,
            width_cm, length_cm, depth_cm, price_usd, price_thb,
            currency, quantity, status, created_at
     FROM orders
     WHERE stripe_session_id = ?1
     ORDER BY created_at DESC`
  ).bind(sessionId).all();
  return results || [];
}

async function reconcilePaidSessionToOrders(sessionId: string, env: any): Promise<boolean> {
  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return false;

  const existing = await env.DB.prepare(
    "SELECT id FROM orders WHERE stripe_session_id = ?1 LIMIT 1"
  ).bind(sessionId).first();
  if (existing) return true;

  const sessionResp = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${stripeKey}` } }
  );
  if (!sessionResp.ok) return false;
  const session = await sessionResp.json() as any;

  const isPaid = String(session.payment_status || "").toLowerCase() === "paid" ||
    String(session.status || "").toLowerCase() === "complete";
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

  if (lineItems.length === 0 && metaItems.length === 0) return false;

  const sourceRows = lineItems.length > 0 ? lineItems : metaItems;
  const sessionCurrency = String(session.currency || "usd").toLowerCase();
  let inserted = 0;

  for (let i = 0; i < sourceRows.length; i++) {
    const li = sourceRows[i] || {};
    const mi = metaItems[i] || {};
    const dims = mi.dims || mi.d || {};
    const qty = Number(li.quantity || mi.qty || mi.q || 1) || 1;
    const unitMinor =
      Number(li?.price?.unit_amount || 0) ||
      Number(mi.u || 0) ||
      (Number(li.amount_total || 0) && qty ? Math.round(Number(li.amount_total || 0) / qty) : 0);
    const unitMajor = unitMinor > 0 ? unitMinor / 100 : null;
    const productTitle = li.description || mi.name || mi.n || mi.slug || mi.s || "Custom Order";
    const productSlug = mi.slug || mi.s || "";

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
      email,
      session?.metadata?.name || session?.customer_details?.name || null,
      session?.metadata?.phone || session?.customer_details?.phone || null,
      session?.metadata?.address || null,
      productSlug,
      productTitle,
      mi.fabric || mi.f || null,
      mi.color || mi.c || null,
      dims.w || null,
      dims.l || null,
      dims.d || null,
      null, null, null,
      null,
      sessionCurrency === "usd" ? unitMajor : null,
      sessionCurrency === "thb" ? unitMajor : null,
      sessionCurrency,
      qty,
      session?.metadata?.discount_code || null
    ).run();
    inserted++;
  }

  return inserted > 0;
}

export async function handleOrderConfirmed(request: Request, env: any): Promise<Response> {
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
      return new Response(JSON.stringify({ pending: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      orders: results,
      session_id: sessionId,
      count: results.length,
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
