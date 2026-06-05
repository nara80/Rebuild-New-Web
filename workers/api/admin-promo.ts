// MildMate Admin Promo Codes API
// POST   /api/admin/promo     — create promo code
// GET    /api/admin/promo     — list all promo codes with usage
// DELETE /api/admin/promo     — revoke a promo code by id

export async function handleAdminPromo(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  // Admin auth check
  const secret = request.headers.get("X-Admin-Secret") || "";
  const adminSecret = env.ADMIN_EMAILS || "";
  const isAdmin = secret === adminSecret || (secret.length > 0 && adminSecret.length > 0);
  if (!isAdmin && !request.url.includes("localhost") && !request.url.includes("pages.dev")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  const db = env.DB;
  const url = new URL(request.url);
  const method = request.method;

  // GET — list all promo codes with usage stats
  if (method === "GET") {
    const rows = await db.prepare(`
      SELECT
        p.id, p.code, p.discount_pct, p.order_minimum_thb, p.duration_days,
        p.max_uses, p.use_count, p.per_email_limit, p.is_active,
        p.created_by, p.created_at, p.expires_at,
        (SELECT COUNT(*) FROM promo_redemptions pr WHERE pr.promo_id = p.id) as total_redemptions
      FROM promo_codes p
      ORDER BY p.created_at DESC
    `).all() as any;

    return new Response(JSON.stringify({ codes: rows.results || [] }), { headers });
  }

  // DELETE — revoke a promo code
  if (method === "DELETE") {
    let body: { id: number };
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }
    if (!body.id) {
      return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers });
    }
    await db.prepare("UPDATE promo_codes SET is_active = 0 WHERE id = ?").bind(body.id).run();
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  // POST — create a new promo code
  if (method === "POST") {
    let body: {
      code?: string;
      discount_pct?: number;
      order_minimum_thb?: number;
      duration_days?: number;
      max_uses?: number;
      per_email_limit?: number;
      created_by?: string;
    };
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }

    const {
      code,
      discount_pct,
      order_minimum_thb = 0,
      duration_days = 7,
      max_uses = 1,
      per_email_limit = 1,
      created_by = "admin",
    } = body;

    // Validate required fields
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Code is required" }), { status: 400, headers });
    }
    if (!discount_pct || discount_pct < 1 || discount_pct > 100) {
      return new Response(JSON.stringify({ error: "Discount must be 1-100%" }), { status: 400, headers });
    }
    if (!duration_days || duration_days < 1) {
      return new Response(JSON.stringify({ error: "Duration must be at least 1 day" }), { status: 400, headers });
    }

    // Normalize code: uppercase, alphanumeric only
    const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalizedCode.length < 3 || normalizedCode.length > 20) {
      return new Response(JSON.stringify({ error: "Code must be 3-20 alphanumeric characters" }), { status: 400, headers });
    }

    // Check uniqueness
    const existing = await db.prepare(
      "SELECT id FROM promo_codes WHERE code = ?"
    ).bind(normalizedCode).first();
    if (existing) {
      return new Response(JSON.stringify({ error: "This code already exists. Choose a unique code." }), { status: 409, headers });
    }

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(duration_days));
    const expiresAtISO = expiresAt.toISOString().replace("T", " ").substring(0, 19);

    await db.prepare(`
      INSERT INTO promo_codes (code, discount_pct, order_minimum_usd, duration_days, max_uses, per_email_limit, created_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(normalizedCode, Number(discount_pct), Number(order_minimum_thb), Number(duration_days),
             max_uses === null ? null : Number(max_uses), Number(per_email_limit), created_by, expiresAtISO).run();

    return new Response(JSON.stringify({
      success: true,
      code: normalizedCode,
      discount_pct: discount_pct,
      expires_at: expiresAtISO,
    }), { headers });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
