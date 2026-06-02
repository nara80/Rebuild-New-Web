// MildMate Admin API — Customers management
// GET  /api/admin/customers         — list distinct customers (grouped by email from orders)
// GET  /api/admin/customers?email=x — single customer's order history
//
// Auth: same strategy as admin-orders (Clerk Bearer token or X-Admin-Secret fallback)

import { verifyClerkJwt } from "./clerk-verify";

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function isProductionHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}

function collectRoles(raw: any): string[] {
  if (!raw || typeof raw !== "object") return [];
  const values: any[] = [];
  const add = (v: any) => { if (v !== undefined && v !== null) values.push(v); };

  add((raw as any).role);
  add((raw as any).roles);
  add((raw as any).org_role);
  add((raw as any).orgRole);
  add((raw as any).public_metadata?.role);
  add((raw as any).public_metadata?.roles);
  add((raw as any).unsafe_metadata?.roles);
  add((raw as any).metadata?.role);
  add((raw as any).metadata?.roles);
  add((raw as any)["https://mildmate.com/role"]);
  add((raw as any)["https://mildmate.com/roles"]);

  const out: string[] = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}

function hasAdminRole(rawClaims: any): boolean {
  const roles = collectRoles(rawClaims);
  return roles.some((r) =>
    r === "admin" ||
    r === "super-admin" ||
    r === "super_admin" ||
    r === "superadmin" ||
    r.endsWith(":admin") ||
    r.endsWith("/admin")
  );
}

function emailAllowed(email: string, env: any): boolean {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

async function authorizeAdmin(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");

  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole(raw) || emailAllowed(verified.payload.email || "", env)) {
        return { ok: true };
      }
      // JWT lacks email/metadata — look up user via Clerk Backend API
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find(function(e: any) { return e.id === user.primary_email_address_id; })?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed(email, env)) return { ok: true };
            if (hasAdminRole(metadata)) return { ok: true };
          }
        } catch(e: any) {
          console.error("Clerk API lookup failed:", e?.message || e);
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
    // fall through to secret fallback
  }

  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }

  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

export async function handleAdminCustomers(request: Request, env: any): Promise<Response> {
  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const url = new URL(request.url);
  const method = request.method;

  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret, Authorization",
      },
    });
  }

  if (method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const db = env.DB;

  // ?email=xxx — orders for a specific customer
  const emailFilter = (url.searchParams.get("email") || "").trim().toLowerCase();
  if (emailFilter) {
    const result = await db.prepare(
      `SELECT id, stripe_session_id,
              email, customer_name, phone, shipping_address,
              product_slug, product_title_en, fabric, color,
              width_cm, length_cm, depth_cm,
              width_in, length_in, depth_in,
              price_usd, price_thb, currency,
              status, created_at
       FROM orders
       WHERE LOWER(email) = ?
       ORDER BY created_at DESC`
    ).bind(emailFilter).all();

    return json({ orders: result.results });
  }

  // default: distinct customers grouped by email
  const result = await db.prepare(
    `SELECT
       LOWER(email) as email,
       (
         SELECT o2.customer_name
         FROM orders o2
         WHERE LOWER(o2.email) = LOWER(o1.email)
         ORDER BY datetime(o2.created_at) DESC, o2.id DESC
         LIMIT 1
       ) as customer_name,
       (
         SELECT o2.phone
         FROM orders o2
         WHERE LOWER(o2.email) = LOWER(o1.email)
         ORDER BY datetime(o2.created_at) DESC, o2.id DESC
         LIMIT 1
       ) as phone,
       (
         SELECT o2.shipping_address
         FROM orders o2
         WHERE LOWER(o2.email) = LOWER(o1.email)
         ORDER BY datetime(o2.created_at) DESC, o2.id DESC
         LIMIT 1
       ) as shipping_address,
       COUNT(*) as order_count,
       SUM(COALESCE(price_thb, 0)) as total_thb,
       SUM(COALESCE(price_usd, 0)) as total_usd,
       (
         SELECT o2.currency
         FROM orders o2
         WHERE LOWER(o2.email) = LOWER(o1.email)
         ORDER BY datetime(o2.created_at) DESC, o2.id DESC
         LIMIT 1
       ) as last_currency,
       MAX(created_at) as last_order,
       MIN(created_at) as first_order
     FROM orders o1
     GROUP BY LOWER(email)
     ORDER BY last_order DESC`
  ).all();

  return json({ customers: result.results });
}
