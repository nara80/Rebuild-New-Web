// MildMate Shipping API — country-based tiered shipping quote (Phase 8)
// GET/POST /api/shipping/calculate

export interface ShippingQuote {
  service_level: "standard" | "express";
  requested_country: string;
  applied_country: string;
  country_name: string;
  currency: string;
  total_qty: number;
  highest_tier: number;
  first_item: number;
  additional_item: number;
  amount: number;
  first_item_thb: number;
  additional_item_thb: number;
  amount_thb: number;
  eta_min_days: number;
  eta_max_days: number;
  eta_note: string;
  is_fallback: boolean;
}

export interface CartShippingItem {
  slug: string;
  qty: number;
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

export function normalizeServiceLevel(raw: any): "standard" | "express" {
  const s = String(raw || "").trim().toLowerCase();
  return s === "standard" ? "standard" : "express";
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
          tier1_first_thb INTEGER NOT NULL DEFAULT 0,
          tier1_add_thb INTEGER NOT NULL DEFAULT 0,
          tier2_first_thb INTEGER NOT NULL DEFAULT 0,
          tier2_add_thb INTEGER NOT NULL DEFAULT 0,
          tier3_first_thb INTEGER NOT NULL DEFAULT 0,
          tier3_add_thb INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          updated_at DATETIME DEFAULT (datetime('now'))
        )`
      ).run();

      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS shipping_service_rates (
          country_code TEXT NOT NULL,
          service_level TEXT NOT NULL CHECK(service_level IN ('standard','express')),
          country_name TEXT NOT NULL,
          tier1_first_thb INTEGER NOT NULL DEFAULT 0,
          tier2_first_thb INTEGER NOT NULL DEFAULT 0,
          tier3_first_thb INTEGER NOT NULL DEFAULT 0,
          eta_min_days INTEGER NOT NULL DEFAULT 3,
          eta_max_days INTEGER NOT NULL DEFAULT 7,
          eta_note TEXT DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1,
          updated_at DATETIME DEFAULT (datetime('now')),
          PRIMARY KEY (country_code, service_level)
        )`
      ).run();

      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS shipping_product_tiers (
          product_slug TEXT PRIMARY KEY,
          tier INTEGER NOT NULL CHECK(tier IN (1,2,3)),
          updated_at DATETIME DEFAULT (datetime('now'))
        )`
      ).run();

      // Virtual quote-only product used for shipping sample swatches.
      await env.DB.prepare(
        `INSERT OR IGNORE INTO shipping_product_tiers (product_slug, tier, updated_at)
         VALUES ('sample-fabric', 3, datetime('now'))`
      ).run();

      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS shipping_add_rates (
          tier INTEGER PRIMARY KEY CHECK(tier IN (1,2,3)),
          add_thb INTEGER NOT NULL DEFAULT 0,
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

      // Seed express from legacy country rates, then derive standard as cheaper/slower.
      await env.DB.prepare(
        `INSERT INTO shipping_service_rates (
          country_code, service_level, country_name,
          tier1_first_thb, tier2_first_thb, tier3_first_thb,
          eta_min_days, eta_max_days, eta_note, is_active, updated_at
        )
        SELECT
          country_code, 'express', country_name,
          COALESCE(tier1_first_thb, 0), COALESCE(tier2_first_thb, 0), COALESCE(tier3_first_thb, 0),
          3, 7, 'Express delivery', COALESCE(is_active, 1), datetime('now')
        FROM shipping_rates sr
        WHERE NOT EXISTS (
          SELECT 1 FROM shipping_service_rates ssr
          WHERE ssr.country_code = sr.country_code AND ssr.service_level = 'express'
        )`
      ).run();

      await env.DB.prepare(
        `INSERT INTO shipping_service_rates (
          country_code, service_level, country_name,
          tier1_first_thb, tier2_first_thb, tier3_first_thb,
          eta_min_days, eta_max_days, eta_note, is_active, updated_at
        )
        SELECT
          country_code, 'standard', country_name,
          CAST(ROUND(COALESCE(tier1_first_thb, 0) * 0.75) AS INTEGER),
          CAST(ROUND(COALESCE(tier2_first_thb, 0) * 0.75) AS INTEGER),
          CAST(ROUND(COALESCE(tier3_first_thb, 0) * 0.75) AS INTEGER),
          7, 14, 'Standard delivery', COALESCE(is_active, 1), datetime('now')
        FROM shipping_rates sr
        WHERE NOT EXISTS (
          SELECT 1 FROM shipping_service_rates ssr
          WHERE ssr.country_code = sr.country_code AND ssr.service_level = 'standard'
        )`
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
  input: { countryCode?: any; fallbackCountryCode?: any; currency?: any; serviceLevel?: any; items?: CartShippingItem[]; totalQty?: any }
): Promise<ShippingQuote & { blocked_th_only?: boolean }> {
  await ensureShippingRatesSchema(env);

  const currency = normalizeShippingCurrency(input.currency);
  const serviceLevel = normalizeServiceLevel(input.serviceLevel);
  const requestedCountry = normalizeCountryCode(input.countryCode) || normalizeCountryCode(input.fallbackCountryCode) || "OTHER";
  const items: CartShippingItem[] = input.items || [];
  const totalQty = items.reduce((sum, it) => sum + (it.qty || 0), 0) || toQty(input.totalQty || 0);

  // Check for TH-only products (Duvet Insert)
  if (items.length > 0 && requestedCountry !== "TH") {
    const thOnlySlugs = new Set(["duvet-insert"]);
    const hasThOnly = items.some((it) => thOnlySlugs.has(it.slug));
    if (hasThOnly) {
      return {
        service_level: serviceLevel,
        requested_country: requestedCountry,
        applied_country: "",
        country_name: "",
        currency,
        total_qty: totalQty,
        highest_tier: 0,
        first_item: 0, additional_item: 0, amount: 0,
        first_item_thb: 0, additional_item_thb: 0, amount_thb: 0,
        eta_min_days: 0,
        eta_max_days: 0,
        eta_note: "",
        is_fallback: false,
        blocked_th_only: true,
      };
    }
  }

  // Domestic Thailand = free shipping
  if (requestedCountry === "TH") {
    return {
      service_level: serviceLevel,
      requested_country: "TH",
      applied_country: "TH",
      country_name: "Thailand",
      currency,
      total_qty: totalQty,
      highest_tier: 0,
      first_item: 0, additional_item: 0, amount: 0,
      first_item_thb: 0, additional_item_thb: 0, amount_thb: 0,
      eta_min_days: serviceLevel === "standard" ? 2 : 1,
      eta_max_days: serviceLevel === "standard" ? 5 : 3,
      eta_note: serviceLevel === "standard" ? "Standard delivery" : "Express delivery",
      is_fallback: false,
      blocked_th_only: false,
    };
  }

  // Fetch country shipping rates
  const fetchRate = async (countryCode: string): Promise<any | null> => {
    const row = await env.DB.prepare(
      `SELECT country_code, country_name,
        tier1_first_thb, tier2_first_thb, tier3_first_thb,
        eta_min_days, eta_max_days, eta_note,
        is_active
       FROM shipping_service_rates
       WHERE country_code = ?1 AND service_level = ?2 AND is_active = 1
       LIMIT 1`
    ).bind(countryCode, serviceLevel).first();
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

  if (!row) {
    // No rates configured at all — return 0
    return {
      service_level: serviceLevel,
      requested_country: requestedCountry,
      applied_country: appliedCountry,
      country_name: appliedCountry === "OTHER" ? "Other Countries" : appliedCountry,
      currency,
      total_qty: totalQty,
      highest_tier: 0,
      first_item: 0, additional_item: 0, amount: 0,
      first_item_thb: 0, additional_item_thb: 0, amount_thb: 0,
      eta_min_days: serviceLevel === "standard" ? 7 : 3,
      eta_max_days: serviceLevel === "standard" ? 14 : 7,
      eta_note: serviceLevel === "standard" ? "Standard delivery" : "Express delivery",
      is_fallback: isFallback,
      blocked_th_only: false,
    };
  }

  // When items are not provided (GET from checkout), default to tier 2 (medium)
  const effectiveItems: CartShippingItem[] = items.length > 0 ? items : [{ slug: "_default", qty: totalQty || 1 }];

  // Tiered shipping calculation
  // Look up product tiers
  const tierMap = new Map<string, number>();
  tierMap.set("_default", 2); // Default tier for items without slug
  for (const item of effectiveItems) {
    if (tierMap.has(item.slug)) continue;
    const tRow = await env.DB.prepare(
      "SELECT tier FROM shipping_product_tiers WHERE product_slug = ?1 LIMIT 1"
    ).bind(item.slug).first();
    tierMap.set(item.slug, Number((tRow as any)?.tier || 2));
  }

  // Find highest tier
  let highestTier = 0;
  for (const item of effectiveItems) {
    const t = tierMap.get(item.slug) || 2;
    if (t > highestTier) highestTier = t;
  }

  // Tier rates: first cost from country row, add cost from global table
  const addRows = await env.DB.prepare(
    "SELECT tier, add_thb FROM shipping_add_rates ORDER BY tier"
  ).all();
  const globalAddRates: Record<number, number> = {};
  for (const ar of (addRows.results || []) as any[]) {
    globalAddRates[Number(ar.tier)] = toAmount(ar.add_thb);
  }

  const legacyFirstThb = 0;
  const legacyAddThb = 0;
  const tier1FirstThb = toAmount((row as any).tier1_first_thb || 0);
  const tier2FirstThb = toAmount((row as any).tier2_first_thb || 0);
  const tier3FirstThb = toAmount((row as any).tier3_first_thb || 0);
  const hasTierFirstRates = tier1FirstThb > 0 || tier2FirstThb > 0 || tier3FirstThb > 0;

  let firstItemThb = 0;
  let additionalThb = 0;

  // Backward-compatible fallback: if tier-first rates are not configured yet,
  // use legacy first/additional model so shipping never collapses to zero.
  if (!hasTierFirstRates && legacyFirstThb > 0) {
    highestTier = 0;
    firstItemThb = legacyFirstThb;
    additionalThb = legacyAddThb * Math.max(0, totalQty - 1);
  } else {
    if (highestTier <= 0) highestTier = 2;
    const tierFirstLookup: Record<number, number> = {
      1: tier1FirstThb,
      2: tier2FirstThb,
      3: tier3FirstThb,
    };
    firstItemThb = toAmount(tierFirstLookup[highestTier] || legacyFirstThb || 0);

    // Additional: all items except one from the highest tier, using global add rates.
    // If add rates aren't configured yet, fallback to legacy additional_item_thb.
    let highestItemDeducted = false;
    for (const item of effectiveItems) {
      const t = tierMap.get(item.slug) || 2;
      const qty = item.qty || 0;
      const addRate = toAmount(globalAddRates[t] || legacyAddThb || 0);
      if (t === highestTier && !highestItemDeducted) {
        additionalThb += addRate * Math.max(0, qty - 1);
        highestItemDeducted = true;
      } else {
        additionalThb += addRate * qty;
      }
    }
  }

  const amountThb = toAmount(firstItemThb + additionalThb);
  const ratePerThb = await getRatePerThb(env, currency);
  const firstItem = currency === "THB" ? firstItemThb : toAmount(firstItemThb * ratePerThb);
  const additionalItem = currency === "THB" ? additionalThb : toAmount(additionalThb * ratePerThb);
  const amount = currency === "THB" ? amountThb : toAmount(amountThb * ratePerThb);

  return {
    service_level: serviceLevel,
    requested_country: requestedCountry,
    applied_country: appliedCountry,
    country_name: row?.country_name || (appliedCountry === "OTHER" ? "Other Countries" : appliedCountry),
    currency,
    total_qty: totalQty,
    highest_tier: highestTier,
    first_item: firstItem,
    additional_item: additionalItem,
    amount,
    first_item_thb: firstItemThb,
    additional_item_thb: additionalThb,
    amount_thb: amountThb,
    eta_min_days: Math.max(0, Number((row as any)?.eta_min_days || 0)),
    eta_max_days: Math.max(0, Number((row as any)?.eta_max_days || 0)),
    eta_note: String((row as any)?.eta_note || (serviceLevel === "standard" ? "Standard delivery" : "Express delivery")),
    is_fallback: isFallback,
    blocked_th_only: false,
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
    let serviceLevel: any = "express";
    let items: CartShippingItem[] | undefined;
    const fallbackCountry = request.headers.get("CF-IPCountry") || "";

    if (request.method === "GET") {
      const url = new URL(request.url);
      country = url.searchParams.get("country") || "";
      qty = toQty(url.searchParams.get("qty") || 0);
      currency = url.searchParams.get("currency") || "USD";
      serviceLevel = url.searchParams.get("service_level") || "express";
    } else {
      const body: any = await request.json().catch(() => ({}));
      country = body.country || body.country_code || "";
      qty = toQty(body.qty || body.total_qty || 0);
      currency = body.currency || "USD";
      serviceLevel = body.service_level || "express";
      if (Array.isArray(body.items)) {
        items = body.items.map((it: any) => ({
          slug: String(it.slug || it.product_slug || ""),
          qty: Math.max(1, toQty(it.qty || 1)),
        })).filter((it: CartShippingItem) => it.slug && it.qty > 0);
      }
    }

    const quote = await calculateShippingQuote(env, {
      countryCode: country,
      fallbackCountryCode: fallbackCountry,
      currency,
      serviceLevel,
      totalQty: qty,
      items,
    });

    return json({ ok: true, ...quote });
  } catch (e: any) {
    return json({ error: e?.message || "Shipping quote unavailable" }, 500);
  }
}
