// MildMate Pricing API
//
// CURRENT: Real fitted sheet formula for Standard, Deep Pocket, Dorm (3 products).
//          Both standard sizes and custom dimensions use the formula.
//          V-Berth and other product types use placeholder formulas.
//
// FUTURE (when all 27 product formulas are ready):
//   D1 table `standard_prices` will store pre-calculated prices per product × size × fabric.
//   ┌──────────────────────────────────────────────────────────────────┐
//   │ Standard size selected → GET /api/pricing?product=...&size=...&fabric=... │
//   │   → D1 lookup in standard_prices → return stored price           │
//   │                                                                  │
//   │ Custom W×L×D entered → POST /api/pricing { w, l, d, fabric }    │
//   │   → Formula calculates → return live price                       │
//   └──────────────────────────────────────────────────────────────────┘
//   D1 Schema:
//     CREATE TABLE standard_prices (
//       id INTEGER PRIMARY KEY,
//       product_slug TEXT NOT NULL,
//       size_key TEXT NOT NULL,     -- '153x203x30'
//       fabric TEXT NOT NULL,
//       label_en TEXT,
//       price_thb INTEGER NOT NULL,
//       price_usd REAL NOT NULL,
//       UNIQUE(product_slug, size_key, fabric)
//     );
//   Admin seeds via formula initially, can override any price.

// ── Fabric bolt width (cm) ──
const BOLT_WIDTH_CM = 260;
// 1 yard = 91.44 cm → area per yard at bolt width
const SQCM_PER_YARD = 91.44 * BOLT_WIDTH_CM; // ≈ 23,774.4

// ── Fabric cost per yard (THB) ──
const FABRIC_COST_PER_YARD_THB: Record<string, number> = {
  cloudsoft: 100,
  breezeplus: 180,
  premacotton: 180,
  ecoluxe: 180,
};

// ── Sewing cost tiers (THB) by fabric area (sq.cm) ──
const SEWING_TIERS: { maxArea: number; cost: number }[] = [
  { maxArea: 51600, cost: 120 },
  { maxArea: 71000, cost: 200 },
  { maxArea: 91200, cost: 300 },
  { maxArea: 120000, cost: 400 },
  { maxArea: Infinity, cost: 500 },
];

const FLAT_SHEET_SEWING_COST = 250; // flat sheet sewing is flat-rate (no elastic)

// ── Fixed costs (THB) ──
const PACKING_COST = 100;
const DOMESTIC_DELIVERY_COST = 50;

// ── Markup rates ──
const OPERATING_RATE = 0.15;
const MARKETING_RATE = 0.20;
const MARGIN_RATE = 0.30;
const FAMILY_MARGIN_RATE = 0.50;

// ── Currency ──
const THB_TO_USD = 30;

// ── Constraints ──
const MAX_WIDTH_CM = 220; // above → Family/Co-Sleep

interface PricingInput {
  product?: string;           // "standard-fitted-sheet" | "deep-pocket-fitted-sheet" | "dorm-fitted-sheet"
  mode?: "sheet" | "vberth";
  fabric: string;
  unit: "cm" | "inch";
  width?: number;
  length?: number;
  depth?: number;
  head?: number;
  foot?: number;
}

interface PriceBreakdown {
  price_thb: number;
  price_usd: number;
  mode: string;
  fabric: string;
  unit: string;
  breakdown?: {
    fabricAreaSqCm: number;
    fabricCostThb: number;
    sewingCostThb: number;
    accessoriesThb: number;
    packingThb: number;
    deliveryThb: number;
    subtotalThb: number;
    operatingThb: number;
    marketingThb: number;
    marginThb: number;
    totalThb: number;
    roundedThb: number;
  };
}

function inchToCm(val: number): number {
  return val * 2.54;
}

function getSewingCost(areaSqCm: number): number {
  for (const tier of SEWING_TIERS) {
    if (areaSqCm <= tier.maxArea) return tier.cost;
  }
  return SEWING_TIERS[SEWING_TIERS.length - 1].cost;
}

/**
 * Fitted sheet pricing formula (Standard, Deep Pocket, Dorm)
 *
 * Fabric dimensions:
 *   W_fabric = W + 2D + 14  (7cm tuck/sewing allowance each side)
 *   L_fabric = L + 2D + 14
 *
 * Costs (all in THB):
 *   Fabric  = (area × rate_per_yard / SQCM_PER_YARD) × 1.20  (20% waste)
 *   Sewing  = tiered by fabric area
 *   Accessories = Fabric × 0.10
 *   Packing = 100
 *   Domestic delivery = 50
 *   Subtotal = Fabric + Sewing + Accessories + Packing + Delivery
 *   +15% Operating, +20% Marketing, +30% Margin
 *   Round up to nearest 100 THB
 *   USD = THB / 30
 */
function calculateFittedSheetPrice(
  wCm: number,
  lCm: number,
  dCm: number,
  fabric: string,
  marginRate: number = MARGIN_RATE,
): { priceThb: number; priceUsd: number; breakdown: PriceBreakdown["breakdown"] } {
  // Fabric dimensions
  const fabricW = wCm + 2 * dCm + 14;
  const fabricL = lCm + 2 * dCm + 14;
  const fabricArea = fabricW * fabricL;

  // Fabric cost
  const yardRate = FABRIC_COST_PER_YARD_THB[fabric] || FABRIC_COST_PER_YARD_THB.cloudsoft;
  const fabricCost = (fabricArea * yardRate / SQCM_PER_YARD) * 1.20;

  // Sewing cost
  const sewingCost = getSewingCost(fabricArea);

  // Accessories
  const accessories = fabricCost * 0.10;

  // Fixed costs
  const packing = PACKING_COST;
  const delivery = DOMESTIC_DELIVERY_COST;

  // Subtotal
  const subtotal = fabricCost + sewingCost + accessories + packing + delivery;

  // Markups
  const operating = subtotal * OPERATING_RATE;
  const marketing = subtotal * MARKETING_RATE;
  const margin = subtotal * marginRate;

  // Total
  const total = subtotal + operating + marketing + margin;

  // Round up to nearest 100 THB
  const rounded = Math.ceil(total / 100) * 100;

  // USD
  const usd = Math.round((rounded / THB_TO_USD) * 100) / 100;

  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(fabricArea * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: sewingCost,
      accessoriesThb: Math.round(accessories * 100) / 100,
      packingThb: packing,
      deliveryThb: delivery,
      subtotalThb: Math.round(subtotal * 100) / 100,
      operatingThb: Math.round(operating * 100) / 100,
      marketingThb: Math.round(marketing * 100) / 100,
      marginThb: Math.round(margin * 100) / 100,
      totalThb: Math.round(total * 100) / 100,
      roundedThb: rounded,
    },
  };
}

/**
 * Flat sheet pricing formula (Flat Sheet — Standard, Extra Deep Pocket)
 *
 * Fabric dimensions:
 *   W_fabric = W + 2D + 50  (25cm each side for underneath tuck + sewing)
 *   L_fabric = L + 2D + 50
 *
 * Costs (all in THB):
 *   Fabric  = (area × rate_per_yard / SQCM_PER_YARD) × 1.20  (20% waste)
 *   Sewing  = 250 THB flat (no elastic)
 *   Packing = 100
 *   Domestic delivery = 50
 *   Subtotal = Fabric + Sewing + Packing + Delivery
 *   +15% Operating, +20% Marketing, +30% Margin
 *   Round up to nearest 100 THB
 *   USD = THB / 30
 */
function calculateFlatSheetPrice(
  wCm: number,
  lCm: number,
  dCm: number,
  fabric: string,
): { priceThb: number; priceUsd: number; breakdown: PriceBreakdown["breakdown"] } {
  // Fabric dimensions — 25cm each side for tuck + sewing allowance
  const fabricW = wCm + 2 * dCm + 50;
  const fabricL = lCm + 2 * dCm + 50;
  const fabricArea = fabricW * fabricL;

  // Fabric cost
  const yardRate = FABRIC_COST_PER_YARD_THB[fabric] || FABRIC_COST_PER_YARD_THB.cloudsoft;
  const fabricCost = (fabricArea * yardRate / SQCM_PER_YARD) * 1.20;

  // Sewing cost — flat rate
  const sewingCost = FLAT_SHEET_SEWING_COST;

  // Fixed costs
  const packing = PACKING_COST;
  const delivery = DOMESTIC_DELIVERY_COST;

  // Subtotal (no accessories for flat sheet)
  const subtotal = fabricCost + sewingCost + packing + delivery;

  // Markups
  const operating = subtotal * OPERATING_RATE;
  const marketing = subtotal * MARKETING_RATE;
  const margin = subtotal * marginRate;

  // Total
  const total = subtotal + operating + marketing + margin;

  // Round up to nearest 100 THB
  const rounded = Math.ceil(total / 100) * 100;

  // USD
  const usd = Math.round((rounded / THB_TO_USD) * 100) / 100;

  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(fabricArea * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: sewingCost,
      accessoriesThb: 0,
      packingThb: packing,
      deliveryThb: delivery,
      subtotalThb: Math.round(subtotal * 100) / 100,
      operatingThb: Math.round(operating * 100) / 100,
      marketingThb: Math.round(marketing * 100) / 100,
      marginThb: Math.round(margin * 100) / 100,
      totalThb: Math.round(total * 100) / 100,
      roundedThb: rounded,
    },
  };
}

/**
 * Legacy simplified pricing (V-Berth placeholder — will be replaced with real formula)
 */
function calculateLegacyPrice(
  mode: string,
  w: number,
  l: number,
  head: number,
  foot: number,
  fabric: string,
  currency: "USD" | "THB",
): number {
  const FABRIC_RATES: Record<string, { usd: number; thb: number }> = {
    breezeplus: { usd: 0.0016, thb: 0.057 },
    cloudsoft: { usd: 0.0014, thb: 0.050 },
    premacotton: { usd: 0.0018, thb: 0.064 },
    ecoluxe: { usd: 0.0020, thb: 0.071 },
  };
  const BASE_PRICES: Record<string, { usd: number; thb: number }> = {
    sheet: { usd: 45, thb: 1590 },
    vberth: { usd: 55, thb: 1945 },
  };

  const rateKey = currency.toLowerCase() as "usd" | "thb";
  const fabricRate = FABRIC_RATES[fabric]?.[rateKey] || FABRIC_RATES.breezeplus[rateKey];
  const base = BASE_PRICES[mode]?.[rateKey] || BASE_PRICES.sheet[rateKey];

  let area = 0;
  if (mode === "sheet" && w > 0 && l > 0) {
    area = w * l;
  } else if (mode === "vberth" && head > 0 && foot > 0 && l > 0) {
    area = ((head + foot) / 2) * l;
  }

  const standardArea = 160 * 200;
  const extra = Math.max(0, area - standardArea) * fabricRate;
  return Math.round((base + extra) * 100) / 100;
}

/**
 * Check if a product uses the fitted sheet formula
 */
function isFittedSheetProduct(product: string): boolean {
  return [
    "standard-fitted-sheet",
    "deep-pocket-fitted-sheet",
    "dorm-fitted-sheet",
    "rv-truck-fitted-sheet",
    "pet-owner-fitted-sheet",
    "family-fitted-sheet",
  ].includes(product);
}

function isFlatSheetProduct(product: string): boolean {
  return [
    "flat-sheet-standard",
    "flat-sheet-extra-deep-pocket",
  ].includes(product);
}

export function calculatePrice(
  input: PricingInput,
  currency: "USD" | "THB" = "USD",
): { price: number; breakdown?: PriceBreakdown["breakdown"] } {
  const product = input.product || "";
  const mode = input.mode || "sheet";
  const fabric = input.fabric || "cloudsoft";

  // Flat sheet formula (2 products)
  if (isFlatSheetProduct(product)) {
    let w = input.width || 0;
    let l = input.length || 0;
    let d = input.depth || 0;

    if (input.unit === "inch") {
      w = inchToCm(w);
      l = inchToCm(l);
      d = inchToCm(d);
    }

    if (w > 0 && l > 0 && d > 0) {
      const result = calculateFlatSheetPrice(w, l, d, fabric);
      return {
        price: currency === "THB" ? result.priceThb : result.priceUsd,
        breakdown: result.breakdown,
      };
    }
    return { price: 0 };
  }

  // Fitted sheet formula (4 products + homepage configurator)
  if (isFittedSheetProduct(product) || (mode === "sheet" && !product)) {
    let w = input.width || 0;
    let l = input.length || 0;
    let d = input.depth || 0;

    if (input.unit === "inch") {
      w = inchToCm(w);
      l = inchToCm(l);
      d = inchToCm(d);
    }

    if (w > 0 && l > 0 && d > 0) {
      // Constraint: W > 220 cm → redirect to Family/Co-Sleep
      if (product !== "family-fitted-sheet" && w > MAX_WIDTH_CM) {
        const result = calculateFittedSheetPrice(w, l, d, fabric);
        return {
          price: currency === "THB" ? result.priceThb : result.priceUsd,
          breakdown: { ...result.breakdown, roundedThb: -1 }, // -1 signals "requires family sheet"
        };
      }

      const marginRate = product === "family-fitted-sheet" ? FAMILY_MARGIN_RATE : MARGIN_RATE;
      const result = calculateFittedSheetPrice(w, l, d, fabric, marginRate);
      return {
        price: currency === "THB" ? result.priceThb : result.priceUsd,
        breakdown: result.breakdown,
      };
    }
    return { price: 0 };
  }

  // Legacy placeholder for all other products
  let w = input.width || 0;
  let l = input.length || 0;
  let head = input.head || 0;
  let foot = input.foot || 0;

  if (input.unit === "inch") {
    w = inchToCm(w);
    l = inchToCm(l);
    head = inchToCm(head);
    foot = inchToCm(foot);
  }

  return { price: calculateLegacyPrice(mode, w, l, head, foot, fabric, currency) };
}

export async function handlePricing(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/pricing" || path === "/api/pricing/") {
    if (request.method !== "POST" && request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      let body: PricingInput;
      if (request.method === "POST") {
        body = await request.json();
      } else {
        const params = url.searchParams;
        body = {
          product: params.get("product") || undefined,
          mode: (params.get("mode") as "sheet" | "vberth") || "sheet",
          fabric: params.get("fabric") || "cloudsoft",
          unit: (params.get("unit") as "cm" | "inch") || "cm",
          width: parseFloat(params.get("width") || "0") || undefined,
          length: parseFloat(params.get("length") || "0") || undefined,
          depth: parseFloat(params.get("depth") || "0") || undefined,
          head: parseFloat(params.get("head") || "0") || undefined,
          foot: parseFloat(params.get("foot") || "0") || undefined,
        };
      }

      const resultUsd = calculatePrice(body, "USD");
      const resultThb = calculatePrice(body, "THB");

      let formulaType = "legacy";
      if (isFlatSheetProduct(body.product || "")) {
        formulaType = "flat-sheet";
      } else if (isFittedSheetProduct(body.product || "") || (!body.product && body.mode !== "vberth")) {
        formulaType = "fitted-sheet";
      }

      const response: any = {
        price_usd: resultUsd.price,
        price_thb: resultThb.price,
        product: body.product || null,
        mode: body.mode || "sheet",
        fabric: body.fabric || "cloudsoft",
        unit: body.unit || "cm",
        formula: formulaType,
      };

      if (resultUsd.breakdown) {
        response.breakdown = resultUsd.breakdown;
      }

      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || "Calculation error" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
