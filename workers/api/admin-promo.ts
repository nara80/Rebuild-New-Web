// MildMate Admin Promo Codes API
// POST   /api/admin/promo     — create promo code
// GET    /api/admin/promo     — list all promo codes with usage
// DELETE /api/admin/promo     — revoke a promo code by id

import { verifyClerkJwt } from "./clerk-verify";

function isProductionHost(hostname: string): boolean {
  const h = String(hostname || "").toLowerCase();
  return h === "www.mildmate.com" || h === "mildmate.com" || h.endsWith(".mildmate.com");
}

function hasAdminRole(raw: any): boolean {
  if (!raw) return false;
  const candidates: any[] = [];
  if (raw.role) candidates.push(raw.role);
  if (raw.roles) candidates.push(raw.roles);
  if (raw.public_metadata?.role) candidates.push(raw.public_metadata.role);
  if (raw.publicMetadata?.role) candidates.push(raw.publicMetadata.role);
  if (raw.metadata?.role) candidates.push(raw.metadata.role);
  if (raw.organization_role) candidates.push(raw.organization_role);
  if (raw.org_role) candidates.push(raw.org_role);
  const flat: string[] = [];
  for (const c of candidates) {
    if (Array.isArray(c)) flat.push(...c.map(String));
    else if (typeof c === "string") flat.push(c);
  }
  return flat.some((v) => {
    const r = String(v).toLowerCase();
    return r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin");
  });
}

function emailAllowed(email: string, env: any): boolean {
  const allow = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!email && allow.includes(email.toLowerCase());
}

async function authorizeAdmin(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const hostname = request.headers.get("Host") || "";
  if (!isProductionHost(hostname)) return { ok: true };

  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const verified = await verifyClerkJwt(request, env);
    if (!verified.valid) return { ok: false, status: verified.status, error: verified.error };
    const raw = (verified as any).payload?.raw || {};
    if (hasAdminRole(raw)) return { ok: true };
    const jwtEmail = String(raw.email || (verified as any).payload?.email || "").trim().toLowerCase();
    if (emailAllowed(jwtEmail, env)) return { ok: true };
    const sub = String((verified as any).payload?.sub || "").trim();
    const clerkKey = String(env.CLERK_SECRET_KEY || "").trim();
    if (sub && clerkKey) {
      try {
        const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
          headers: { Authorization: "Bearer " + clerkKey }
        });
        if (clerkResp.ok) {
          const user = await clerkResp.json() as any;
          const email = user.email_addresses?.find((e: any) => e.id === user.primary_email_address_id)?.email_address || "";
          const metadata = user.public_metadata || {};
          if (emailAllowed(email, env) || hasAdminRole(metadata)) return { ok: true };
        }
      } catch {}
    }
    return { ok: false, status: 403, error: "Forbidden: admin role required" };
  }

  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const expectedSecret = String(env.ADMIN_SECRET || "").trim();
  if (providedSecret && expectedSecret && providedSecret === expectedSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

export async function handleAdminPromo(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret, Authorization",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  // Admin auth check
  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers });
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
