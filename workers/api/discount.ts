// MildMate Discount API
// POST /api/discount/validate — validate a discount code at checkout
// Called by checkout page before creating Stripe session
// Checks promo_codes FIRST (admin-created), then discount_claims (welcome codes)
// Mutual exclusivity: only one type can be applied per checkout

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function normalizeAddress(addr: any): string {
  if (!addr || typeof addr !== "object") return "";
  return [
    (addr.street || "").trim().toLowerCase(),
    (addr.city || "").trim().toLowerCase(),
    (addr.province || addr.state || "").trim().toLowerCase(),
    (addr.postal || addr.zip || "").trim().toLowerCase(),
    (addr.country || "").trim().toLowerCase(),
  ].join("|");
}

export async function handleDiscountValidate(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ valid: false, error: "Method not allowed" }), { status: 405, headers });
  }

  let body: { code: string; email?: string; address?: any; cart_total_thb?: number; cart_total_usd?: number };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ valid: false, error: "Invalid JSON" }), { status: 400, headers });
  }

  const code = (body.code || "").trim().toUpperCase();
  const email = (body.email || "").trim().toLowerCase();
  if (!code) {
    return new Response(JSON.stringify({ valid: false, error: "Please enter a discount code" }), { status: 400, headers });
  }
  if (!email || !email.includes("@")) {
    return new Response(JSON.stringify({ valid: false, error: "Please enter your checkout email first" }), { status: 400, headers });
  }

  const db = env.DB;

  // ── 1. Check promo_codes FIRST (admin-created, mutual exclusivity) ──
  const promo = await db.prepare(
    "SELECT id, code, discount_pct, order_minimum_usd, max_uses, use_count, per_email_limit, is_active, expires_at FROM promo_codes WHERE code = ?"
  ).bind(code).first() as any;

  if (promo) {
    if (!promo.is_active) {
      return new Response(JSON.stringify({ valid: false, error: "This promo code has been revoked" }), { headers });
    }
    if (promo.expires_at && promo.expires_at < new Date().toISOString()) {
      return new Response(JSON.stringify({ valid: false, error: "This promo code has expired" }), { headers });
    }
    if (promo.max_uses !== null && promo.use_count >= promo.max_uses) {
      return new Response(JSON.stringify({ valid: false, error: "This promo code has reached its usage limit" }), { headers });
    }
    const minUsd = promo.order_minimum_usd ?? 0;
    if (minUsd > 0 && (body.cart_total_usd || 0) < minUsd) {
      return new Response(JSON.stringify({
        valid: false,
        error: `Minimum order of $${minUsd} USD required for this code (your cart: $${Math.round(body.cart_total_usd || 0)} USD)`,
      }), { headers });
    }
    if (promo.per_email_limit > 0) {
      const redeemed = await db.prepare(
        "SELECT id FROM promo_redemptions WHERE promo_id = ? AND email = ?"
      ).bind(promo.id, email).first();
      if (redeemed) {
        return new Response(JSON.stringify({ valid: false, error: "You have already used this promo code" }), { headers });
      }
    }
    return new Response(JSON.stringify({
      valid: true,
      code: promo.code,
      discount_percent: promo.discount_pct,
      discount_type: "promo",
      expires_at: promo.expires_at,
      source: "promo",
    }), { headers });
  }

  // ── 2. Fall back to discount_claims (welcome/discount code) ──
  const claim = await db.prepare(
    "SELECT id, email, code, status, expires_at, discount_pct, address_hash, order_id, source FROM discount_claims WHERE code = ?"
  ).bind(code).first() as any;

  if (!claim) {
    return new Response(JSON.stringify({ valid: false, error: "Invalid discount code" }), { status: 404, headers });
  }
  if ((claim.email || "").toLowerCase() !== email) {
    return new Response(JSON.stringify({
      valid: false,
      error: "This welcome code is linked to a different email account.",
    }), { headers });
  }

  if (claim.status === "used") {
    return new Response(JSON.stringify({ valid: false, error: "This code has already been used" }), { headers });
  }
  if (claim.status === "expired" || (claim.expires_at && claim.expires_at < new Date().toISOString())) {
    if (claim.status !== "expired") {
      await db.prepare("UPDATE discount_claims SET status = 'expired' WHERE id = ?").bind(claim.id).run();
    }
    return new Response(JSON.stringify({ valid: false, error: "This code has expired" }), { headers });
  }

  if (body.address) {
    const addrHash = await sha256(normalizeAddress(body.address));
    const usedByAddress = await db.prepare(
      "SELECT id, code, status FROM discount_claims WHERE address_hash = ? LIMIT 1"
    ).bind(addrHash).first() as any;
    if (usedByAddress) {
      return new Response(JSON.stringify({
        valid: false,
        error: "A discount has already been claimed for this shipping address. One discount per household.",
      }), { headers });
    }
  }

  return new Response(JSON.stringify({
    valid: true,
    code: claim.code,
    discount_percent: claim.discount_pct || 15,
    discount_type: "welcome",
    expires_at: claim.expires_at,
    source: claim.source || 'subscribe',
  }), { headers });
}

export async function handleDiscountClaim(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let body: { code: string; address: any; order_id?: number };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  const code = (body.code || "").trim().toUpperCase();
  const db = env.DB;

  const claim = await db.prepare(
    "SELECT id, status FROM discount_claims WHERE code = ? AND status = 'issued'"
  ).bind(code).first() as any;

  if (!claim) {
    return new Response(JSON.stringify({ error: "Code not found or already used" }), { status: 400, headers });
  }

  const addrHash = body.address ? await sha256(normalizeAddress(body.address)) : null;

  await db.prepare(
    "UPDATE discount_claims SET status = 'used', address_hash = ?, order_id = ?, claimed_at = datetime('now') WHERE id = ?"
  ).bind(addrHash || null, body.order_id || null, claim.id).run();

  return new Response(JSON.stringify({ success: true }), { headers });
}
