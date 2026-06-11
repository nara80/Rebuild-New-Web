// MildMate Admin API — Country shipping rates management (tiered)
// GET    /api/admin/shipping-rates
// POST   /api/admin/shipping-rates
// PUT    /api/admin/shipping-rates
// DELETE /api/admin/shipping-rates?country=TH
// GET    /api/admin/shipping-product-tiers
// PUT    /api/admin/shipping-product-tiers

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
  const host = new URL(request.url).hostname;
  if (host.includes("pages.dev") || host === "localhost" || host.startsWith("127.0.0.1")) {
    return { ok: true };
  }

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
      `SELECT country_code, country_name,
        tier1_first_thb, tier2_first_thb, tier3_first_thb,
        is_active, updated_at
       FROM shipping_rates
       ORDER BY CASE WHEN country_code = 'OTHER' THEN 1 ELSE 0 END, country_code`
    ).all();
    const rates = (rows.results || []).map((r: any) => {
      const t1f = toAmount(r.tier1_first_thb || 0);
      const t2f = toAmount(r.tier2_first_thb || 0);
      const t3f = toAmount(r.tier3_first_thb || 0);
      return {
        country_code: String(r.country_code || "").toUpperCase(),
        country_name: String(r.country_name || ""),
        tier1_first_thb: t1f, tier2_first_thb: t2f, tier3_first_thb: t3f,
        tier1_first_usd: toAmount(t1f * usdRate), tier2_first_usd: toAmount(t2f * usdRate), tier3_first_usd: toAmount(t3f * usdRate),
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

    const countryName = normalizeCountryName(body.country_name, countryCode);
    const t1f = toAmount(body.tier1_first_thb || body.tier1_first || 0);
    const t2f = toAmount(body.tier2_first_thb || body.tier2_first || 0);
    const t3f = toAmount(body.tier3_first_thb || body.tier3_first || 0);
    const isActive = body.is_active === undefined ? 1 : (Number(body.is_active) ? 1 : 0);

    await env.DB.prepare(
      `INSERT INTO shipping_rates (
        country_code, country_name,
        tier1_first_thb, tier2_first_thb, tier3_first_thb,
        is_active, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
      ON CONFLICT(country_code) DO UPDATE SET
        country_name = excluded.country_name,
        tier1_first_thb = excluded.tier1_first_thb,
        tier2_first_thb = excluded.tier2_first_thb,
        tier3_first_thb = excluded.tier3_first_thb,
        is_active = excluded.is_active,
        updated_at = datetime('now')`
    ).bind(countryCode, countryName, t1f, t2f, t3f, isActive).run();

    return json({
      success: true,
      rate: {
        country_code: countryCode,
        country_name: countryName,
        tier1_first_thb: t1f,
        tier2_first_thb: t2f,
        tier3_first_thb: t3f,
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

// ── Shipping Product Tiers ──
export async function handleAdminShippingProductTiers(request: Request, env: any): Promise<Response> {
  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Secret",
      },
    });
  }

  await ensureShippingRatesSchema(env);

  if (request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT spt.product_slug, spt.tier, p.title_en, p.category
       FROM shipping_product_tiers spt
       LEFT JOIN products p ON p.slug = spt.product_slug
       ORDER BY spt.tier, spt.product_slug`
    ).all();
    const tiers = (rows.results || []).map((r: any) => ({
      product_slug: String(r.product_slug || ""),
      product_name: String(r.title_en || r.product_slug || ""),
      category: String(r.category || ""),
      tier: Number(r.tier || 2),
    }));
    return json({ product_tiers: tiers });
  }

  if (request.method === "PUT") {
    let body: any;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const slug = String(body.product_slug || "").trim();
    const tier = Number(body.tier);
    if (!slug) return json({ error: "product_slug required" }, 400);
    if (![1, 2, 3].includes(tier)) return json({ error: "tier must be 1, 2, or 3" }, 400);

    await env.DB.prepare(
      `INSERT INTO shipping_product_tiers (product_slug, tier, updated_at)
       VALUES (?1, ?2, datetime('now'))
       ON CONFLICT(product_slug) DO UPDATE SET
         tier = excluded.tier,
         updated_at = datetime('now')`
    ).bind(slug, tier).run();

    return json({ success: true, product_slug: slug, tier });
  }

  return json({ error: "Method not allowed" }, 405);
}

// ── Shipping Global Addition Rates ──
export async function handleAdminShippingAddRates(request: Request, env: any): Promise<Response> {
  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Secret",
      },
    });
  }

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS shipping_add_rates (
      tier INTEGER PRIMARY KEY CHECK(tier IN (1,2,3)),
      add_thb INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT (datetime('now'))
    )`
  ).run();

  if (request.method === "GET") {
    const usdRate = await getUsdRatePerThb(env);
    const rows = await env.DB.prepare(
      "SELECT tier, add_thb FROM shipping_add_rates ORDER BY tier"
    ).all();
    const addRates: Record<number, { add_thb: number; add_usd: number }> = {};
    for (const r of (rows.results || []) as any[]) {
      const t = Number(r.tier);
      const thb = toAmount(r.add_thb);
      addRates[t] = { add_thb: thb, add_usd: toAmount(thb * usdRate) };
    }
    return json({ add_rates: addRates, usd_rate_per_thb: usdRate });
  }

  if (request.method === "PUT") {
    let body: any;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const tier = Number(body.tier);
    const addThb = toAmount(body.add_thb);
    if (![1, 2, 3].includes(tier)) return json({ error: "tier must be 1, 2, or 3" }, 400);

    await env.DB.prepare(
      `INSERT INTO shipping_add_rates (tier, add_thb, updated_at)
       VALUES (?1, ?2, datetime('now'))
       ON CONFLICT(tier) DO UPDATE SET
         add_thb = excluded.add_thb, updated_at = datetime('now')`
    ).bind(tier, addThb).run();

    return json({ success: true, tier, add_thb: addThb });
  }

  return json({ error: "Method not allowed" }, 405);
}
