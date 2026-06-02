// MildMate Admin API — Country shipping rates management
// GET    /api/admin/shipping-rates
// POST   /api/admin/shipping-rates
// PUT    /api/admin/shipping-rates
// DELETE /api/admin/shipping-rates?country=TH

import { verifyClerkJwt } from "./clerk-verify";
import { ensureShippingRatesSchema, normalizeCountryCode, toAmount as _toAmount } from "./shipping";

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function toAmount(v: any): number {
  return _toAmount(v);
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
  add((raw as any).unsafe_metadata?.role);
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
    if (!verified.valid) {
      // continue to secret fallback
    } else {
      const raw = verified.payload.raw || {};
      if (hasAdminRole(raw) || emailAllowed(verified.payload.email || "", env)) {
        return { ok: true };
      }
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
        } catch (e: any) {
          console.error("Clerk API lookup failed:", e?.message || e);
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
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

function normalizeCountryName(raw: any, countryCode: string): string {
  const name = String(raw || "").trim();
  if (name) return name;
  if (countryCode === "OTHER") return "Other Countries";
  return countryCode;
}

async function getUsdRatePerThb(env: any): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT rate_per_thb FROM exchange_rates WHERE currency = 'USD' LIMIT 1"
  ).first();
  const rate = Number((row as any)?.rate_per_thb);
  if (Number.isFinite(rate) && rate > 0) return rate;
  return 1 / 30;
}

export async function handleAdminShippingRates(request: Request, env: any): Promise<Response> {
  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Secret",
      },
    });
  }

  await ensureShippingRatesSchema(env);

  if (request.method === "GET") {
    const usdRate = await getUsdRatePerThb(env);
    const rows = await env.DB.prepare(
      `SELECT country_code, country_name, first_item_thb, additional_item_thb, is_active, updated_at
       FROM shipping_rates
       ORDER BY CASE WHEN country_code = 'OTHER' THEN 1 ELSE 0 END, country_code`
    ).all();
    const rates = (rows.results || []).map((r: any) => {
      const firstThb = toAmount(r.first_item_thb);
      const addThb = toAmount(r.additional_item_thb);
      return {
        country_code: String(r.country_code || "").toUpperCase(),
        country_name: String(r.country_name || ""),
        first_item_thb: firstThb,
        additional_item_thb: addThb,
        first_item_usd_preview: toAmount(firstThb * usdRate),
        additional_item_usd_preview: toAmount(addThb * usdRate),
        is_active: Number(r.is_active || 0),
        updated_at: r.updated_at,
      };
    });
    return json({ rates, usd_rate_per_thb: usdRate });
  }

  if (request.method === "POST" || request.method === "PUT") {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const countryCode = normalizeCountryCode(body.country_code || body.country || "");
    if (!countryCode) {
      return json({ error: "country_code is required (ISO-2 or OTHER)" }, 400);
    }
    if (body.first_item_thb === undefined || body.additional_item_thb === undefined) {
      return json({ error: "first_item_thb and additional_item_thb are required" }, 400);
    }

    const countryName = normalizeCountryName(body.country_name, countryCode);
    const firstThb = toAmount(body.first_item_thb);
    const additionalThb = toAmount(body.additional_item_thb);
    const usdRate = await getUsdRatePerThb(env);
    const firstUsd = toAmount(firstThb * usdRate);
    const additionalUsd = toAmount(additionalThb * usdRate);
    const isActive = body.is_active === undefined ? 1 : (Number(body.is_active) ? 1 : 0);

    await env.DB.prepare(
      `INSERT INTO shipping_rates (
        country_code, country_name, first_item_usd, additional_item_usd, first_item_thb, additional_item_thb, is_active, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
      ON CONFLICT(country_code) DO UPDATE SET
        country_name = excluded.country_name,
        first_item_usd = excluded.first_item_usd,
        additional_item_usd = excluded.additional_item_usd,
        first_item_thb = excluded.first_item_thb,
        additional_item_thb = excluded.additional_item_thb,
        is_active = excluded.is_active,
        updated_at = datetime('now')`
    ).bind(countryCode, countryName, firstUsd, additionalUsd, firstThb, additionalThb, isActive).run();

    return json({
      success: true,
      rate: {
        country_code: countryCode,
        country_name: countryName,
        first_item_thb: firstThb,
        additional_item_thb: additionalThb,
        first_item_usd_preview: firstUsd,
        additional_item_usd_preview: additionalUsd,
        is_active: isActive,
      }
    });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const countryCode = normalizeCountryCode(url.searchParams.get("country") || "");
    if (!countryCode) return json({ error: "country query param is required" }, 400);
    if (countryCode === "OTHER") return json({ error: "OTHER cannot be deleted" }, 400);

    await env.DB.prepare("DELETE FROM shipping_rates WHERE country_code = ?1").bind(countryCode).run();
    return json({ success: true, country_code: countryCode });
  }

  return json({ error: "Method not allowed" }, 405);
}
