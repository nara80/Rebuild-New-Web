// MildMate Discount API
// POST /api/discount/validate — validate a discount code at checkout
// Called by checkout page before creating Stripe session

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

  let body: { code: string; email?: string; address?: any };
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

  // 1. Look up code
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

  // 2. Check status
  if (claim.status === "used") {
    return new Response(JSON.stringify({ valid: false, error: "This code has already been used" }), { headers });
  }
  if (claim.status === "expired" || (claim.expires_at && claim.expires_at < new Date().toISOString())) {
    // Auto-expire if past date
    if (claim.status !== "expired") {
      await db.prepare("UPDATE discount_claims SET status = 'expired' WHERE id = ?").bind(claim.id).run();
    }
    return new Response(JSON.stringify({ valid: false, error: "This code has expired" }), { headers });
  }

  // 3. Check address (one discount per household ever)
  if (body.address) {
    const addrHash = await sha256(normalizeAddress(body.address));
    
    // Check if this address has ever been used for any discount
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
    discount_type: "percent",
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
