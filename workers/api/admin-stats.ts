// MildMate Admin API — Listing performance stats
// GET /api/admin/stats?period=last-7-days&target_currency=USD

import { verifyClerkJwt } from "./clerk-verify";

type Bounds = { start: string | null; end: string | null; normalized: string };

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

function isoAtUtcDayStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  return d.toISOString();
}

function addUtcDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function normalizePeriod(raw: string): string {
  const p = String(raw || "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    today: "today",
    yesterday: "yesterday",
    "last-7-days": "last-7-days",
    "last7": "last-7-days",
    "7d": "last-7-days",
    "last-30-days": "last-30-days",
    "last30": "last-30-days",
    "30d": "last-30-days",
    "last-60-days": "last-60-days",
    "last60": "last-60-days",
    "60d": "last-60-days",
    "last-90-days": "last-90-days",
    "last90": "last-90-days",
    "90d": "last-90-days",
    "all-time": "all-time",
    all: "all-time",
  };
  return aliases[p] || "last-30-days";
}

function getPeriodBounds(rawPeriod: string): Bounds {
  const normalized = normalizePeriod(rawPeriod);
  const now = new Date();
  const todayStart = isoAtUtcDayStart(now);

  if (normalized === "all-time") return { normalized, start: null, end: null };
  if (normalized === "today") return { normalized, start: todayStart, end: addUtcDays(todayStart, 1) };
  if (normalized === "yesterday") return { normalized, start: addUtcDays(todayStart, -1), end: todayStart };

  const daysMap: Record<string, number> = {
    "last-7-days": 7,
    "last-30-days": 30,
    "last-60-days": 60,
    "last-90-days": 90,
  };
  const days = daysMap[normalized] || 30;
  return { normalized, start: addUtcDays(todayStart, -(days - 1)), end: addUtcDays(todayStart, 1) };
}

function getDisplayImage(imageUrl: any, imagesRaw: any): string {
  const direct = String(imageUrl || "").trim();
  if (direct) return direct;
  try {
    const arr = JSON.parse(String(imagesRaw || "[]"));
    if (Array.isArray(arr)) {
      const first = arr.find((x: any) => String(x || "").trim());
      if (first) return String(first).trim();
    }
  } catch {
    // ignore parse errors
  }
  return "";
}

function toNumber(v: any): number {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function convertRevenue(revenueThb: number, revenueUsd: number, targetCurrency: string, usdRatePerThb: number, targetRatePerThb: number): number {
  const target = String(targetCurrency || "USD").toUpperCase();
  if (target === "USD") return revenueUsd + (revenueThb * usdRatePerThb);
  if (target === "THB") return revenueThb + (usdRatePerThb > 0 ? (revenueUsd / usdRatePerThb) : 0);
  const totalThb = revenueThb + (usdRatePerThb > 0 ? (revenueUsd / usdRatePerThb) : 0);
  return totalThb * targetRatePerThb;
}

function currencySymbol(currency: string, ratesMap: Record<string, { symbol: string }>): string {
  const c = String(currency || "USD").toUpperCase();
  if (c === "USD") return "$";
  if (c === "THB") return "฿";
  return ratesMap[c]?.symbol || c;
}

export async function handleAdminStats(request: Request, env: any): Promise<Response> {
  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret, Authorization",
      },
    });
  }

  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const targetCurrency = String(url.searchParams.get("target_currency") || "USD").trim().toUpperCase();
  const bounds = getPeriodBounds(url.searchParams.get("period") || "last-30-days");

  try {
    const db = env.DB;

    const ratesRes = await db.prepare(
      `SELECT currency, rate_per_thb, label, symbol
       FROM exchange_rates
       ORDER BY currency ASC`
    ).all();
    const ratesRows = (ratesRes.results || []) as any[];
    const ratesMap: Record<string, { rate_per_thb: number; label: string; symbol: string }> = {};
    ratesRows.forEach((r: any) => {
      const c = String(r.currency || "").toUpperCase();
      if (!c) return;
      ratesMap[c] = {
        rate_per_thb: toNumber(r.rate_per_thb),
        label: String(r.label || c),
        symbol: String(r.symbol || ""),
      };
    });

    const usdRatePerThb = ratesMap.USD?.rate_per_thb || 0.033;
    const targetRatePerThb = targetCurrency === "USD"
      ? usdRatePerThb
      : targetCurrency === "THB"
      ? 1
      : (ratesMap[targetCurrency]?.rate_per_thb || 0);

    if (targetCurrency !== "USD" && targetCurrency !== "THB" && !targetRatePerThb) {
      return json({ error: "Unknown target_currency. Configure it in exchange_rates first." }, 400);
    }

    const listRes = await db.prepare(
      `SELECT
         p.id AS product_id,
         p.slug,
         p.title_en,
         p.image_url,
         p.images,
         COALESCE((
           SELECT COUNT(*)
           FROM favorites f
           WHERE f.product_id = p.id
             AND (?1 IS NULL OR datetime(f.created_at) >= datetime(?1))
             AND (?2 IS NULL OR datetime(f.created_at) < datetime(?2))
         ), 0) AS favorites_count,
         COALESCE((
           SELECT COUNT(*)
           FROM orders o
           WHERE o.product_slug = p.slug
             AND LOWER(COALESCE(o.status, '')) != 'cancelled'
             AND (?1 IS NULL OR datetime(o.created_at) >= datetime(?1))
             AND (?2 IS NULL OR datetime(o.created_at) < datetime(?2))
         ), 0) AS orders_count,
         COALESCE((
           SELECT SUM(COALESCE(o.quantity, 1))
           FROM orders o
           WHERE o.product_slug = p.slug
             AND LOWER(COALESCE(o.status, '')) != 'cancelled'
             AND (?1 IS NULL OR datetime(o.created_at) >= datetime(?1))
             AND (?2 IS NULL OR datetime(o.created_at) < datetime(?2))
         ), 0) AS qty_sold,
         COALESCE((
           SELECT SUM(COALESCE(o.price_thb, 0) * COALESCE(o.quantity, 1))
           FROM orders o
           WHERE o.product_slug = p.slug
             AND LOWER(COALESCE(o.status, '')) != 'cancelled'
             AND (?1 IS NULL OR datetime(o.created_at) >= datetime(?1))
             AND (?2 IS NULL OR datetime(o.created_at) < datetime(?2))
         ), 0) AS revenue_thb,
         COALESCE((
           SELECT SUM(COALESCE(o.price_usd, 0) * COALESCE(o.quantity, 1))
           FROM orders o
           WHERE o.product_slug = p.slug
             AND LOWER(COALESCE(o.status, '')) != 'cancelled'
             AND (?1 IS NULL OR datetime(o.created_at) >= datetime(?1))
             AND (?2 IS NULL OR datetime(o.created_at) < datetime(?2))
         ), 0) AS revenue_usd
       FROM products p
       WHERE COALESCE(p.is_active, 1) = 1
       ORDER BY COALESCE(p.sort_order, 9999) ASC, p.id ASC`
    ).bind(bounds.start, bounds.end).all();

    const rows = (listRes.results || []) as any[];
    const listings = rows.map((r: any) => {
      const revenueThb = toNumber(r.revenue_thb);
      const revenueUsd = toNumber(r.revenue_usd);
      const revenueTarget = convertRevenue(revenueThb, revenueUsd, targetCurrency, usdRatePerThb, targetRatePerThb);
      return {
        product_id: Number(r.product_id || 0),
        slug: String(r.slug || ""),
        title_en: String(r.title_en || r.slug || "Product"),
        image_url: getDisplayImage(r.image_url, r.images),
        favorites_count: toNumber(r.favorites_count),
        orders_count: toNumber(r.orders_count),
        qty_sold: toNumber(r.qty_sold),
        revenue_thb: revenueThb,
        revenue_usd: revenueUsd,
        revenue_target: revenueTarget,
      };
    }).sort((a: any, b: any) =>
      (b.orders_count - a.orders_count) ||
      (b.favorites_count - a.favorites_count) ||
      (b.revenue_target - a.revenue_target)
    );

    const totals = listings.reduce((acc: any, row: any) => {
      acc.favorites += row.favorites_count;
      acc.orders += row.orders_count;
      acc.qty_sold += row.qty_sold;
      acc.revenue_thb += row.revenue_thb;
      acc.revenue_usd += row.revenue_usd;
      acc.revenue_target += row.revenue_target;
      return acc;
    }, { favorites: 0, orders: 0, qty_sold: 0, revenue_thb: 0, revenue_usd: 0, revenue_target: 0 });

    return json({
      period: bounds.normalized,
      start: bounds.start,
      end: bounds.end,
      target_currency: targetCurrency,
      target_symbol: currencySymbol(targetCurrency, ratesMap),
      usd_rate_per_thb: usdRatePerThb,
      target_rate_per_thb: targetRatePerThb,
      available_currencies: ratesRows.map((r: any) => ({
        currency: String(r.currency || "").toUpperCase(),
        label: String(r.label || r.currency || ""),
        symbol: String(r.symbol || ""),
        rate_per_thb: toNumber(r.rate_per_thb),
      })),
      totals,
      listings,
    });
  } catch (e: any) {
    console.error("Admin stats failed:", e?.message || e);
    return json({ error: "Failed to compute stats" }, 500);
  }
}
