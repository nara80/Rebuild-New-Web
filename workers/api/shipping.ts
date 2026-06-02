// MildMate Shipping API — country-based shipping quote (Option A)
// GET/POST /api/shipping/calculate

export interface ShippingQuote {
  requested_country: string;
  applied_country: string;
  country_name: string;
  currency: string;
  total_qty: number;
  first_item: number;
  additional_item: number;
  amount: number;
  first_item_thb: number;
  additional_item_thb: number;
  amount_thb: number;
  is_fallback: boolean;
}

let shippingSchemaReady = false;
let shippingSchemaPromise: Promise<void> | null = null;

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function toAmount(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function toQty(v: any): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function normalizeCountryCode(raw: any): string {
  const code = String(raw || "").trim().toUpperCase();
  if (!code) return "";
  if (code === "OTHER" || code === "INTL" || code === "INTERNATIONAL") return "OTHER";
  if (/^[A-Z]{2}$/.test(code)) return code;
  return "";
}

export function normalizeShippingCurrency(raw: any): string {
  const c = String(raw || "").trim().toUpperCase();
  if (!c) return "USD";
  return c;
}

export async function ensureShippingRatesSchema(env: any): Promise<void> {
  if (shippingSchemaReady) return;
  if (!shippingSchemaPromise) {
    shippingSchemaPromise = (async () => {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS shipping_rates (
          country_code TEXT PRIMARY KEY,
          country_name TEXT NOT NULL,
          first_item_usd REAL NOT NULL DEFAULT 0,
          additional_item_usd REAL NOT NULL DEFAULT 0,
          first_item_thb REAL NOT NULL DEFAULT 0,
          additional_item_thb REAL NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          updated_at DATETIME DEFAULT (datetime('now'))
        )`
      ).run();

      await env.DB.prepare(
        `INSERT INTO shipping_rates (
          country_code, country_name, first_item_usd, additional_item_usd, first_item_thb, additional_item_thb, is_active, updated_at
        )
        SELECT 'OTHER', 'Other Countries', 25, 10, 850, 300, 1, datetime('now')
        WHERE NOT EXISTS (SELECT 1 FROM shipping_rates WHERE country_code = 'OTHER')`
      ).run();

      shippingSchemaReady = true;
    })().finally(() => {
      if (!shippingSchemaReady) shippingSchemaPromise = null;
    });
  }
  await shippingSchemaPromise;
}

type ShippingRateRow = {
  country_code: string;
  country_name: string;
  first_item_thb: number;
  additional_item_thb: number;
  is_active: number;
};

async function getRatePerThb(env: any, targetCurrency: string): Promise<number> {
  const target = String(targetCurrency || "USD").toUpperCase();
  if (target === "THB") return 1;
  const row = await env.DB.prepare(
    "SELECT rate_per_thb FROM exchange_rates WHERE currency = ?1 LIMIT 1"
  ).bind(target).first();
  const rate = Number((row as any)?.rate_per_thb);
  if (Number.isFinite(rate) && rate > 0) return rate;
  if (target === "USD") return 1 / 30;
  return 0;
}

export async function calculateShippingQuote(
  env: any,
  input: { countryCode?: any; fallbackCountryCode?: any; currency?: any; totalQty?: any }
): Promise<ShippingQuote> {
  await ensureShippingRatesSchema(env);

  const qty = toQty(input.totalQty);
  const currency = normalizeShippingCurrency(input.currency);
  const requestedCountry = normalizeCountryCode(input.countryCode) || normalizeCountryCode(input.fallbackCountryCode) || "OTHER";

  const fetchRate = async (countryCode: string): Promise<ShippingRateRow | null> => {
    const row = await env.DB.prepare(
      `SELECT country_code, country_name, first_item_thb, additional_item_thb, is_active
       FROM shipping_rates
       WHERE country_code = ?1 AND is_active = 1
       LIMIT 1`
    ).bind(countryCode).first();
    return (row as any) || null;
  };

  let appliedCountry = requestedCountry;
  let row = await fetchRate(appliedCountry);
  let isFallback = false;

  if (!row && appliedCountry !== "OTHER") {
    row = await fetchRate("OTHER");
    if (row) {
      appliedCountry = "OTHER";
      isFallback = true;
    }
  }

  const firstItemThb = toAmount(row?.first_item_thb);
  const additionalItemThb = toAmount(row?.additional_item_thb);
  const amountThb = qty > 0 ? toAmount(firstItemThb + Math.max(0, qty - 1) * additionalItemThb) : 0;
  const ratePerThb = await getRatePerThb(env, currency);
  const firstItem = currency === "THB" ? firstItemThb : toAmount(firstItemThb * ratePerThb);
  const additionalItem = currency === "THB" ? additionalItemThb : toAmount(additionalItemThb * ratePerThb);
  const amount = currency === "THB" ? amountThb : toAmount(amountThb * ratePerThb);

  return {
    requested_country: requestedCountry,
    applied_country: appliedCountry,
    country_name: row?.country_name || (appliedCountry === "OTHER" ? "Other Countries" : appliedCountry),
    currency,
    total_qty: qty,
    first_item: firstItem,
    additional_item: additionalItem,
    amount,
    first_item_thb: firstItemThb,
    additional_item_thb: additionalItemThb,
    amount_thb: amountThb,
    is_fallback: isFallback,
  };
}

export async function handleShippingCalculate(request: Request, env: any): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Secret",
      },
    });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    let country = "";
    let qty = 0;
    let currency = "USD";
    const fallbackCountry = request.headers.get("CF-IPCountry") || "";

    if (request.method === "GET") {
      const url = new URL(request.url);
      country = url.searchParams.get("country") || "";
      qty = toQty(url.searchParams.get("qty") || 0);
      currency = url.searchParams.get("currency") || "USD";
    } else {
      const body: any = await request.json().catch(() => ({}));
      country = body.country || body.country_code || "";
      qty = toQty(body.qty || body.total_qty || 0);
      currency = body.currency || "USD";
    }

    const quote = await calculateShippingQuote(env, {
      countryCode: country,
      fallbackCountryCode: fallbackCountry,
      currency,
      totalQty: qty,
    });

    return json({ ok: true, ...quote });
  } catch (e: any) {
    return json({ error: e?.message || "Shipping quote unavailable" }, 500);
  }
}
