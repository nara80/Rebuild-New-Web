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

// ── Duvet sewing cost tiers (different from fitted sheet) ──
const DUVET_SEWING_TIERS: { maxArea: number; cost: number }[] = [
  { maxArea: 139200, cost: 300 },
  { maxArea: 170400, cost: 400 },
  { maxArea: Infinity, cost: 600 },
];

const FLAT_SHEET_SEWING_COST = 250; // flat sheet sewing is flat-rate (no elastic)

// ── Pillow constants ──
const PILLOW_WASTE = 1.60;        // 60% waste
const PILLOW_SEWING_COST = 40;    // THB per piece
const PILLOW_SHAM_SEWING_COST = 50;
const PILLOW_SHAM_FABRIC_EXTRA = 0.15; // 15% more fabric than envelope
const MAX_PILLOW_CM = 120;        // max W or L

// ── Fixed costs (THB) ──
const PACKING_COST = 100;
const DOMESTIC_DELIVERY_COST = 50;

// ── Markup rates ──
const OPERATING_RATE = 0.15;
const MARKETING_RATE = 0.20;
const MARGIN_RATE = 0.30;
const FAMILY_MARGIN_RATE = 0.50;
const CUSHION_PROTECTOR_MARGIN_RATE = 0.30;
const PILLOW_PROTECTOR_MARGIN_RATE = 0.35;
const PILLOWCASE_MARGIN_RATE = 0.15;      // pillowcases: 15/25/15%

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

interface RuntimePricingParams {
  sqcmPerYard: number;
  wasteFactorFabric: number;
  wasteFactorPillowcase: number;
  packingCost: number;
  deliveryCost: number;
  operatingRate: number;
  marketingRate: number;
  marginStandard: number;
  marginFamily: number;
  marginDuvet: number;
  marginPillow: number;
  marginPillowProtector: number;
  marginCushionProtector: number;
  maxWidthCm: number;
  flatTuckCm: number;
  flatSewingCost: number;
  zipperRate: number;
  pillowSewingCost: number;
  pillowShamSewingCost: number;
  tpuRate: number;
  tpuSqcmPerLm: number;
  sewingTiers: { maxArea: number; cost: number }[];
  duvetSewingTiers: { maxArea: number; cost: number }[];
  fabricRates: Record<string, number>;
  version: string;
}

const DERIVED_MARKUP_KEY_PREFIX = "derived_markup_";
const DEFAULT_DERIVED_MARKUPS: Record<string, number> = {
  "weighted-duvet-cover": 10,
};

function toNumberOr(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildPricingVersionFromRows(rows: Array<{ key: string; value: number }>): string {
  const base = rows
    .map((r) => `${String(r.key)}=${String(r.value)}`)
    .sort()
    .join("|");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `pp-${h.toString(16)}`;
}

async function loadRuntimePricingParams(env: any): Promise<RuntimePricingParams> {
  const defaults: RuntimePricingParams = {
    sqcmPerYard: SQCM_PER_YARD,
    wasteFactorFabric: 1.20,
    wasteFactorPillowcase: PILLOW_WASTE,
    packingCost: PACKING_COST,
    deliveryCost: DOMESTIC_DELIVERY_COST,
    operatingRate: OPERATING_RATE,
    marketingRate: MARKETING_RATE,
    marginStandard: MARGIN_RATE,
    marginFamily: FAMILY_MARGIN_RATE,
    marginDuvet: MARGIN_RATE,
    marginPillow: PILLOWCASE_MARGIN_RATE,
    marginPillowProtector: PILLOW_PROTECTOR_MARGIN_RATE,
    marginCushionProtector: CUSHION_PROTECTOR_MARGIN_RATE,
    maxWidthCm: MAX_WIDTH_CM,
    flatTuckCm: 25,
    flatSewingCost: FLAT_SHEET_SEWING_COST,
    zipperRate: 0.4,
    pillowSewingCost: PILLOW_SEWING_COST,
    pillowShamSewingCost: PILLOW_SHAM_SEWING_COST,
    tpuRate: 120,
    tpuSqcmPerLm: 21000,
    sewingTiers: [...SEWING_TIERS],
    duvetSewingTiers: [...DUVET_SEWING_TIERS],
    fabricRates: { ...FABRIC_COST_PER_YARD_THB },
    version: "pp-default",
  };

  try {
    const { results } = await env.DB.prepare("SELECT key, value FROM pricing_params").all();
    const rows = ((results || []) as any[]).map((r) => ({
      key: String(r.key || ""),
      value: Number(r.value),
    })).filter((r) => r.key);
    if (!rows.length) return defaults;

    const map = new Map<string, number>();
    for (const r of rows) map.set(r.key, Number(r.value));
    const get = (k: string, fallback: number) => toNumberOr(map.get(k), fallback);

    const tiers: { maxArea: number; cost: number }[] = [];
    for (let i = 1; i <= 12; i++) {
      const maxKey = `sewing_tier${i}_max`;
      const costKey = `sewing_tier${i}_cost`;
      if (!map.has(maxKey) || !map.has(costKey)) continue;
      tiers.push({
        maxArea: get(maxKey, Infinity),
        cost: get(costKey, 0),
      });
    }

    const duvetTiers: { maxArea: number; cost: number }[] = [];
    for (let i = 1; i <= 12; i++) {
      const maxKey = `duvet_sewing_tier${i}_max`;
      const costKey = `duvet_sewing_tier${i}_cost`;
      if (!map.has(maxKey) || !map.has(costKey)) continue;
      duvetTiers.push({
        maxArea: get(maxKey, Infinity),
        cost: get(costKey, 0),
      });
    }

    return {
      sqcmPerYard: get("sqcm_per_yard", defaults.sqcmPerYard),
      wasteFactorFabric: 1 + get("waste_factor_fabric", 20) / 100,
      wasteFactorPillowcase: 1 + get("waste_factor_pillowcase", 60) / 100,
      packingCost: get("packing_cost", defaults.packingCost),
      deliveryCost: get("delivery_cost", defaults.deliveryCost),
      operatingRate: get("ops_rate", defaults.operatingRate * 100) / 100,
      marketingRate: get("mkt_rate", defaults.marketingRate * 100) / 100,
      marginStandard: get("margin_rate_standard", defaults.marginStandard * 100) / 100,
      marginFamily: get("margin_rate_family", defaults.marginFamily * 100) / 100,
      marginDuvet: get("margin_rate_duvet", defaults.marginDuvet * 100) / 100,
      marginPillow: get("margin_rate_pillow", defaults.marginPillow * 100) / 100,
      marginPillowProtector: get("margin_rate_pillow_protector", defaults.marginPillowProtector * 100) / 100,
      marginCushionProtector: get("margin_rate_cushion_protector", defaults.marginCushionProtector * 100) / 100,
      maxWidthCm: get("max_width_cm", defaults.maxWidthCm),
      flatTuckCm: get("flat_tuck_cm", defaults.flatTuckCm),
      flatSewingCost: get("flat_sewing_cost", defaults.flatSewingCost),
      zipperRate: get("zipper_rate", defaults.zipperRate),
      pillowSewingCost: get("pillow_sewing_cost", defaults.pillowSewingCost),
      pillowShamSewingCost: get("pillow_sham_sewing_cost", defaults.pillowShamSewingCost),
      tpuRate: get("fabric_rate_tpu", defaults.tpuRate),
      tpuSqcmPerLm: get("tpu_sqcm_per_lm", defaults.tpuSqcmPerLm),
      sewingTiers: tiers.length
        ? tiers.sort((a, b) => a.maxArea - b.maxArea)
        : defaults.sewingTiers,
      duvetSewingTiers: duvetTiers.length
        ? duvetTiers.sort((a, b) => a.maxArea - b.maxArea)
        : defaults.duvetSewingTiers,
      fabricRates: {
        cloudsoft: get("fabric_rate_cloudsoft", defaults.fabricRates.cloudsoft),
        breezeplus: get("fabric_rate_breezeplus", defaults.fabricRates.breezeplus),
        premacotton: get("fabric_rate_premacotton", defaults.fabricRates.premacotton),
        ecoluxe: get("fabric_rate_ecoluxe", defaults.fabricRates.ecoluxe),
      },
      version: buildPricingVersionFromRows(rows),
    };
  } catch {
    return defaults;
  }
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

function getDuvetSewingCost(areaSqCm: number): number {
  for (const tier of DUVET_SEWING_TIERS) {
    if (areaSqCm <= tier.maxArea) return tier.cost;
  }
  return DUVET_SEWING_TIERS[DUVET_SEWING_TIERS.length - 1].cost;
}

function getRuntimeSewingCost(areaSqCm: number, tiers: { maxArea: number; cost: number }[]): number {
  for (const tier of tiers) {
    if (areaSqCm <= tier.maxArea) return tier.cost;
  }
  return tiers.length ? tiers[tiers.length - 1].cost : 500;
}

function getRuntimeDuvetSewingCost(areaSqCm: number, tiers: { maxArea: number; cost: number }[]): number {
  for (const tier of tiers) {
    if (areaSqCm <= tier.maxArea) return tier.cost;
  }
  return tiers.length ? tiers[tiers.length - 1].cost : 600;
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

function calculateFittedSheetPriceRuntime(
  wCm: number,
  lCm: number,
  dCm: number,
  fabric: string,
  marginRate: number,
  cfg: RuntimeFittedPricingParams,
): { priceThb: number; priceUsd: number; breakdown: PriceBreakdown["breakdown"] } {
  const fabricW = wCm + 2 * dCm + 14;
  const fabricL = lCm + 2 * dCm + 14;
  const fabricArea = fabricW * fabricL;

  const yardRate = cfg.fabricRates[fabric] || cfg.fabricRates.cloudsoft || 100;
  const fabricCost = (fabricArea * yardRate / cfg.sqcmPerYard) * cfg.wasteFactorFabric;
  const sewingCost = getRuntimeSewingCost(fabricArea, cfg.sewingTiers);
  const accessories = fabricCost * 0.10;
  const subtotal = fabricCost + sewingCost + accessories + cfg.packingCost + cfg.deliveryCost;
  const operating = subtotal * cfg.operatingRate;
  const marketing = subtotal * cfg.marketingRate;
  const margin = subtotal * marginRate;
  const total = subtotal + operating + marketing + margin;
  const rounded = Math.ceil(total / 100) * 100;
  const usd = Math.round((rounded / THB_TO_USD) * 100) / 100;

  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(fabricArea * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: sewingCost,
      accessoriesThb: Math.round(accessories * 100) / 100,
      packingThb: cfg.packingCost,
      deliveryThb: cfg.deliveryCost,
      subtotalThb: Math.round(subtotal * 100) / 100,
      operatingThb: Math.round(operating * 100) / 100,
      marketingThb: Math.round(marketing * 100) / 100,
      marginThb: Math.round(margin * 100) / 100,
      totalThb: Math.round(total * 100) / 100,
      roundedThb: rounded,
    },
  };
}

function calculateFlatSheetPriceRuntime(
  wCm: number,
  lCm: number,
  dCm: number,
  fabric: string,
  cfg: RuntimePricingParams,
): { priceThb: number; priceUsd: number; breakdown: PriceBreakdown["breakdown"] } {
  const fabricW = wCm + 2 * dCm + (cfg.flatTuckCm * 2);
  const fabricL = lCm + 2 * dCm + (cfg.flatTuckCm * 2);
  const fabricArea = fabricW * fabricL;
  const yardRate = cfg.fabricRates[fabric] || cfg.fabricRates.cloudsoft || 100;
  const fabricCost = (fabricArea * yardRate / cfg.sqcmPerYard) * cfg.wasteFactorFabric;
  const subtotal = fabricCost + cfg.flatSewingCost + cfg.packingCost + cfg.deliveryCost;
  const operating = subtotal * cfg.operatingRate;
  const marketing = subtotal * cfg.marketingRate;
  const margin = subtotal * cfg.marginStandard;
  const total = subtotal + operating + marketing + margin;
  const rounded = Math.ceil(total / 100) * 100;
  const usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(fabricArea * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: cfg.flatSewingCost,
      accessoriesThb: 0,
      packingThb: cfg.packingCost,
      deliveryThb: cfg.deliveryCost,
      subtotalThb: Math.round(subtotal * 100) / 100,
      operatingThb: Math.round(operating * 100) / 100,
      marketingThb: Math.round(marketing * 100) / 100,
      marginThb: Math.round(margin * 100) / 100,
      totalThb: Math.round(total * 100) / 100,
      roundedThb: rounded,
    },
  };
}

function calculateDuvetPriceRuntime(
  wCm: number,
  lCm: number,
  fabric: string,
  cfg: RuntimePricingParams,
): { priceThb: number; priceUsd: number; breakdown: PriceBreakdown["breakdown"] } {
  const rawArea = 2 * (wCm + 5) * (lCm + 5);
  const floorArea = rawArea * cfg.wasteFactorFabric;
  const yardRate = cfg.fabricRates[fabric] || cfg.fabricRates.cloudsoft || 100;
  const fabricCost = (floorArea * yardRate / cfg.sqcmPerYard);
  const zipperCost = cfg.zipperRate * (2 * lCm + wCm);
  const sewingCost = getRuntimeDuvetSewingCost(rawArea, cfg.duvetSewingTiers);
  const subtotal = fabricCost + zipperCost + sewingCost + cfg.packingCost + cfg.deliveryCost;
  const operating = subtotal * cfg.operatingRate;
  const marketing = subtotal * cfg.marketingRate;
  const margin = subtotal * cfg.marginDuvet;
  const total = subtotal + operating + marketing + margin;
  const rounded = Math.ceil(total / 100) * 100;
  const usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(floorArea * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: sewingCost,
      accessoriesThb: Math.round(zipperCost * 100) / 100,
      packingThb: cfg.packingCost,
      deliveryThb: cfg.deliveryCost,
      subtotalThb: Math.round(subtotal * 100) / 100,
      operatingThb: Math.round(operating * 100) / 100,
      marketingThb: Math.round(marketing * 100) / 100,
      marginThb: Math.round(margin * 100) / 100,
      totalThb: Math.round(total * 100) / 100,
      roundedThb: rounded,
    },
  };
}

function calculatePillowcasePriceRuntime(
  wCm: number,
  lCm: number,
  fabric: string,
  variant: "envelope" | "zipper" | "sham",
  cfg: RuntimePricingParams,
): { priceThb: number; priceUsd: number; breakdown: PriceBreakdown["breakdown"] } {
  let rawArea = 2 * (wCm + 5) * (lCm + 5);
  if (variant === "sham") rawArea *= (1 + PILLOW_SHAM_FABRIC_EXTRA);
  const area = rawArea * cfg.wasteFactorPillowcase;
  const yardRate = cfg.fabricRates[fabric] || cfg.fabricRates.cloudsoft || 100;
  const fabricCost = (area * yardRate / cfg.sqcmPerYard);
  const zipperCost = variant === "zipper" ? cfg.zipperRate * Math.max(wCm, lCm) : 0;
  const sewingCost = variant === "sham" ? cfg.pillowShamSewingCost : cfg.pillowSewingCost;
  const subtotal = fabricCost + zipperCost + sewingCost + cfg.packingCost + cfg.deliveryCost;
  const operating = subtotal * cfg.operatingRate;
  const marketing = subtotal * cfg.marketingRate;
  const margin = subtotal * cfg.marginPillow;
  const total = subtotal + operating + marketing + margin;
  const rounded = Math.ceil(total / 100) * 100;
  const usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(area * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: sewingCost,
      accessoriesThb: Math.round(zipperCost * 100) / 100,
      packingThb: cfg.packingCost,
      deliveryThb: cfg.deliveryCost,
      subtotalThb: Math.round(subtotal * 100) / 100,
      operatingThb: Math.round(operating * 100) / 100,
      marketingThb: Math.round(marketing * 100) / 100,
      marginThb: Math.round(margin * 100) / 100,
      totalThb: Math.round(total * 100) / 100,
      roundedThb: rounded,
    },
  };
}

function calculatePillowProtectorPriceRuntime(
  wCm: number,
  lCm: number,
  cfg: RuntimePricingParams,
): { priceThb: number; priceUsd: number; breakdown: PriceBreakdown["breakdown"] } {
  const rawArea = 2 * (wCm + 5) * (lCm + 5);
  const area = rawArea * cfg.wasteFactorPillowcase;
  const fabricCost = (cfg.tpuRate * area / cfg.tpuSqcmPerLm);
  const zipperCost = cfg.zipperRate * Math.max(wCm, lCm);
  const subtotal = fabricCost + zipperCost + cfg.pillowSewingCost + cfg.packingCost + cfg.deliveryCost;
  const operating = subtotal * cfg.operatingRate;
  const marketing = subtotal * cfg.marketingRate;
  const margin = subtotal * cfg.marginPillowProtector;
  const total = subtotal + operating + marketing + margin;
  const rounded = Math.ceil(total / 100) * 100;
  const usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(area * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: cfg.pillowSewingCost,
      accessoriesThb: Math.round(zipperCost * 100) / 100,
      packingThb: cfg.packingCost,
      deliveryThb: cfg.deliveryCost,
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
  const margin = subtotal * MARGIN_RATE;

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
 * Duvet cover pricing formula (3-Sided Zipper, Pet Owner, Marine, RV, Dorm)
 *
 * Fabric dimensions (2 pieces — top + bottom, 5cm sewing allowance each):
 *   floorArea = 2 × (W + 5) × (L + 5)
 *
 * Costs (all in THB):
 *   Fabric  = (area × rate_per_yard / SQCM_PER_YARD) × 1.20  (20% waste)
 *   Zipper  = 0.4 × (2L + W)
 *   Sewing  = tiered by fabric area (duvet-specific tiers)
 *   Packing = 100
 *   Domestic delivery = 50
 *   Subtotal = Fabric + Zipper + Sewing + Packing + Delivery
 *   +15% Operating, +20% Marketing, +30% Margin
 *   Round up to nearest 100 THB
 *   USD = THB / 30
 */
function calculateDuvetPrice(
  wCm: number,
  lCm: number,
  fabric: string,
): { priceThb: number; priceUsd: number; breakdown: PriceBreakdown["breakdown"] } {
  // 2 pieces × (W+5) × (L+5) — 5cm sewing allowance on each edge, +20% waste
  const rawArea = 2 * (wCm + 5) * (lCm + 5);
  const floorArea = rawArea * 1.20;

  // Fabric cost
  const yardRate = FABRIC_COST_PER_YARD_THB[fabric] || FABRIC_COST_PER_YARD_THB.cloudsoft;
  const fabricCost = (floorArea * yardRate / SQCM_PER_YARD);

  // Zipper cost: 0.4 THB/cm × (2L + W)
  const zipperCost = 0.4 * (2 * lCm + wCm);

  // Sewing cost (duvet-specific tiers, based on raw area)
  const sewingCost = getDuvetSewingCost(rawArea);

  // Fixed costs
  const packing = PACKING_COST;
  const delivery = DOMESTIC_DELIVERY_COST;

  // Subtotal
  const subtotal = fabricCost + zipperCost + sewingCost + packing + delivery;

  // Markups
  const operating = subtotal * OPERATING_RATE;
  const marketing = subtotal * MARKETING_RATE;
  const margin = subtotal * MARGIN_RATE;

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
      fabricAreaSqCm: Math.round(floorArea * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: sewingCost,
      accessoriesThb: Math.round(zipperCost * 100) / 100, // zipper stored in accessories slot
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
 * Pillow Protector pricing formula (TPU waterproof + zipper)
 *
 * Same geometry as pillowcase-zipper but TPU fabric + 35% margin.
 *
 * Fabric: 2 pieces × (W+5) × (L+5) + 60% waste
 * TPU fabric cost: 120 THB/lm, 210cm bolt = 120/21,000 THB/cm²
 * Zipper: 0.4 THB/cm × max(W, L) — one side
 * Sewing: 40 THB flat
 * Packing: 100, Delivery: 50
 * +15% Op, +25% Mkt, +35% Margin (1.75)
 * Max W, L: 120cm each
 * Round 100 THB, USD = THB/30
 */
function calculatePillowProtectorPrice(
  wCm: number,
  lCm: number,
): { priceThb: number; priceUsd: number; breakdown: PriceBreakdown["breakdown"] } {
  const TPU_SQCM_PER_LM = 100 * 210; // 21,000
  const rawArea = 2 * (wCm + 5) * (lCm + 5);
  const area = rawArea * PILLOW_WASTE;

  // TPU fabric cost
  const fabricCost = (120 * area / TPU_SQCM_PER_LM);

  // Zipper: 0.4 THB/cm on longest side
  const zipperLength = Math.max(wCm, lCm);
  const zipperCost = 0.4 * zipperLength;

  // Sewing
  const sewingCost = PILLOW_SEWING_COST;

  const packing = PACKING_COST;
  const delivery = DOMESTIC_DELIVERY_COST;

  const subtotal = fabricCost + zipperCost + sewingCost + packing + delivery;

  const operating = subtotal * OPERATING_RATE;
  const marketing = subtotal * MARKETING_RATE;
  const margin = subtotal * PILLOW_PROTECTOR_MARGIN_RATE;

  const total = subtotal + operating + marketing + margin;
  const rounded = Math.ceil(total / 100) * 100;
  const usd = Math.round((rounded / THB_TO_USD) * 100) / 100;

  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(area * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: sewingCost,
      accessoriesThb: Math.round(zipperCost * 100) / 100,
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
 * Pillowcase pricing formula (Envelope, Zipper, Sham)
 *
 * Fabric: 2 pieces × (W+5) × (L+5) + 60% waste
 * Sham: +15% fabric (×1.15 on area)
 * Sewing: 40 THB flat (50 for sham)
 * Zipper: 0.4 THB/cm × max(W, L) — only for zipper variant
 * Packing: 100, Delivery: 50
 * +15% Op, +25% Mkt, +15% Margin (1.55)
 * Max W, L: 120cm each
 * Round 100 THB, USD = THB/30
 */
function calculatePillowcasePrice(
  wCm: number,
  lCm: number,
  fabric: string,
  variant: "envelope" | "zipper" | "sham",
): { priceThb: number; priceUsd: number; breakdown: PriceBreakdown["breakdown"] } {
  let rawArea = 2 * (wCm + 5) * (lCm + 5);
  if (variant === "sham") rawArea *= (1 + PILLOW_SHAM_FABRIC_EXTRA);
  const area = rawArea * PILLOW_WASTE;

  const yardRate = FABRIC_COST_PER_YARD_THB[fabric] || FABRIC_COST_PER_YARD_THB.cloudsoft;
  const fabricCost = (area * yardRate / SQCM_PER_YARD);

  const zipperCost = variant === "zipper" ? 0.4 * Math.max(wCm, lCm) : 0;

  const sewingCost = variant === "sham" ? PILLOW_SHAM_SEWING_COST : PILLOW_SEWING_COST;

  const packing = PACKING_COST;
  const delivery = DOMESTIC_DELIVERY_COST;

  const subtotal = fabricCost + zipperCost + sewingCost + packing + delivery;

  const operating = subtotal * OPERATING_RATE;
  const marketing = subtotal * MARKETING_RATE;
  const margin = subtotal * PILLOWCASE_MARGIN_RATE;

  const total = subtotal + operating + marketing + margin;
  const rounded = Math.ceil(total / 100) * 100;
  const usd = Math.round((rounded / THB_TO_USD) * 100) / 100;

  return {
    priceThb: rounded,
    priceUsd: usd,
    breakdown: {
      fabricAreaSqCm: Math.round(area * 100) / 100,
      fabricCostThb: Math.round(fabricCost * 100) / 100,
      sewingCostThb: sewingCost,
      accessoriesThb: Math.round(zipperCost * 100) / 100,
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
    "custom-waterproof-cushion-protector",
  ].includes(product);
}

function isFlatSheetProduct(product: string): boolean {
  return [
    "flat-sheet-standard",
    "flat-sheet-extra-deep-pocket",
  ].includes(product);
}

function isDuvetProduct(product: string): boolean {
  return [
    "3-sided-duvet",
    "duvet-cover-dorm",
    "duvet-cover-rv",
    "duvet-cover-marine",
    "pet-owner-duvet-cover",
    "weighted-duvet-cover",
  ].includes(product);
}

function isPillowProtectorProduct(product: string): boolean {
  return ["pillow-protector-general"].includes(product);
}

function isPillowcaseProduct(product: string): { isPillowcase: boolean; variant?: "envelope" | "zipper" | "sham" } {
  if (product === "pillowcase-envelope") return { isPillowcase: true, variant: "envelope" };
  if (product === "pillowcase-zipper") return { isPillowcase: true, variant: "zipper" };
  if (product === "pillowcase-sham") return { isPillowcase: true, variant: "sham" };
  return { isPillowcase: false };
}

export function calculatePrice(
  input: PricingInput,
  currency: "USD" | "THB" = "USD",
  derivedMarkups: Record<string, number> = {},
  runtimeParams?: RuntimePricingParams,
): { price: number; breakdown?: PriceBreakdown["breakdown"] } {
  const product = input.product || "";
  const mode = input.mode || "sheet";
  const fabric = input.fabric || "cloudsoft";
  const resolveMarkupPct = (): number => {
    if (!product) return 0;
    if (derivedMarkups[product] !== undefined) return Number(derivedMarkups[product]) || 0;
    return DEFAULT_DERIVED_MARKUPS[product] || 0;
  };
  const applyDerivedMarkup = (basePrice: number): number => {
    const pct = resolveMarkupPct();
    if (!pct || !Number.isFinite(basePrice) || basePrice <= 0) return basePrice;
    const marked = basePrice * (1 + (pct / 100));
    return currency === "THB"
      ? Math.ceil(marked / 100) * 100
      : Math.round(marked * 100) / 100;
  };

  // Pillowcase formula (envelope, zipper, sham) — regular fabric
  const pillowcase = isPillowcaseProduct(product);
  if (pillowcase.isPillowcase) {
    let w = input.width || 0;
    let l = input.length || 0;

    if (input.unit === "inch") {
      w = inchToCm(w);
      l = inchToCm(l);
    }

    if (w > MAX_PILLOW_CM || l > MAX_PILLOW_CM) {
      return { price: 0 };
    }

    if (w > 0 && l > 0) {
      const result = runtimeParams
        ? calculatePillowcasePriceRuntime(w, l, fabric, pillowcase.variant!, runtimeParams)
        : calculatePillowcasePrice(w, l, fabric, pillowcase.variant!);
      return {
        price: applyDerivedMarkup(currency === "THB" ? result.priceThb : result.priceUsd),
        breakdown: result.breakdown,
      };
    }
    return { price: 0 };
  }

  // Pillow protector — TPU fabric, 35% margin, zipper
  if (isPillowProtectorProduct(product)) {
    let w = input.width || 0;
    let l = input.length || 0;

    if (input.unit === "inch") {
      w = inchToCm(w);
      l = inchToCm(l);
    }

    if (w > MAX_PILLOW_CM || l > MAX_PILLOW_CM) {
      return { price: 0 }; // exceeds pillow max
    }

    if (w > 0 && l > 0) {
      const result = runtimeParams
        ? calculatePillowProtectorPriceRuntime(w, l, runtimeParams)
        : calculatePillowProtectorPrice(w, l);
      return {
        price: applyDerivedMarkup(currency === "THB" ? result.priceThb : result.priceUsd),
        breakdown: result.breakdown,
      };
    }
    return { price: 0 };
  }

  // Duvet cover formula (5 products) — W×L only, no depth
  if (isDuvetProduct(product)) {
    let w = input.width || 0;
    let l = input.length || 0;

    if (input.unit === "inch") {
      w = inchToCm(w);
      l = inchToCm(l);
    }

    if (w > 0 && l > 0) {
      const result = runtimeParams
        ? calculateDuvetPriceRuntime(w, l, fabric, runtimeParams)
        : calculateDuvetPrice(w, l, fabric);
      return {
        price: applyDerivedMarkup(currency === "THB" ? result.priceThb : result.priceUsd),
        breakdown: result.breakdown,
      };
    }
    return { price: 0 };
  }

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
      const result = runtimeParams
        ? calculateFlatSheetPriceRuntime(w, l, d, fabric, runtimeParams)
        : calculateFlatSheetPrice(w, l, d, fabric);
      return {
        price: applyDerivedMarkup(currency === "THB" ? result.priceThb : result.priceUsd),
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
      const maxWidth = runtimeParams ? runtimeParams.maxWidthCm : MAX_WIDTH_CM;
      if (product !== "family-fitted-sheet" && w > maxWidth) {
        const result = runtimeParams
          ? calculateFittedSheetPriceRuntime(w, l, d, fabric, runtimeParams.marginStandard, runtimeParams)
          : calculateFittedSheetPrice(w, l, d, fabric);
        return {
          price: applyDerivedMarkup(currency === "THB" ? result.priceThb : result.priceUsd),
          breakdown: { ...result.breakdown!, roundedThb: -1 }, // -1 signals "requires family sheet"
        };
      }

      const marginRate = runtimeParams
        ? (
          product === "family-fitted-sheet"
            ? runtimeParams.marginFamily
            : product === "custom-waterproof-cushion-protector"
              ? runtimeParams.marginCushionProtector
              : runtimeParams.marginStandard
        )
        : (
          product === "family-fitted-sheet"
            ? FAMILY_MARGIN_RATE
            : product === "custom-waterproof-cushion-protector"
              ? CUSHION_PROTECTOR_MARGIN_RATE
              : MARGIN_RATE
        );
      const result = runtimeParams
        ? calculateFittedSheetPriceRuntime(w, l, d, fabric, marginRate, runtimeParams)
        : calculateFittedSheetPrice(w, l, d, fabric, marginRate);
      return {
        price: applyDerivedMarkup(currency === "THB" ? result.priceThb : result.priceUsd),
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

  return { price: applyDerivedMarkup(calculateLegacyPrice(mode, w, l, head, foot, fabric, currency)) };
}

async function loadDerivedMarkupMap(env: any): Promise<Record<string, number>> {
  const out: Record<string, number> = { ...DEFAULT_DERIVED_MARKUPS };
  try {
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM pricing_params WHERE key LIKE ?1"
    ).bind(`${DERIVED_MARKUP_KEY_PREFIX}%`).all();
    for (const row of ((results || []) as any[])) {
      const key = String(row.key || "");
      if (!key.startsWith(DERIVED_MARKUP_KEY_PREFIX)) continue;
      const slug = key.slice(DERIVED_MARKUP_KEY_PREFIX.length).trim();
      const pct = Number(row.value);
      if (!slug || !Number.isFinite(pct)) continue;
      out[slug] = pct;
    }
  } catch {}
  return out;
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

      const derivedMarkupMap = await loadDerivedMarkupMap(env);
      const runtimeParams = await loadRuntimePricingParams(env);
      const resultUsd = calculatePrice(body, "USD", derivedMarkupMap, runtimeParams);
      const resultThb = calculatePrice(body, "THB", derivedMarkupMap, runtimeParams);

      let formulaType = "legacy";
      const pc = isPillowcaseProduct(body.product || "");
      if (pc.isPillowcase) {
        formulaType = "pillowcase";
      } else if (isPillowProtectorProduct(body.product || "")) {
        formulaType = "pillow-protector";
      } else if (isDuvetProduct(body.product || "")) {
        formulaType = "duvet";
      } else if (isFlatSheetProduct(body.product || "")) {
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
        derived_markup_pct: body.product ? (derivedMarkupMap[body.product] || 0) : 0,
        pricing_version: runtimeParams.version,
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
