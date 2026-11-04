#!/usr/bin/env node
/**
 * Pricing parity gate (deploy-blocking)
 *
 * Canonical reference:
 * - /api/pricing-params (live D1 pricing params)
 *
 * Compared against:
 * - /api/pricing (runtime API used by integrations)
 *
 * Scope in this script:
 * - fitted, flat, duvet, pillowcase, pillow-protector
 * (encasement/protector formulas remain out of /api/pricing scope today)
 */

const BASE_URL = process.env.MILDMATE_BASE_URL || "https://www.mildmate.com";

const CASES = [
  // fitted
  { label: "fitted-family TH 7FT cloudsoft", formula: "fitted-sheet", product: "family-fitted-sheet", fabric: "cloudsoft", width: 214, length: 198, depth: 46 },
  { label: "fitted-family TH 8FT cloudsoft", formula: "fitted-sheet", product: "family-fitted-sheet", fabric: "cloudsoft", width: 242, length: 198, depth: 46 },
  { label: "fitted-standard cloudsoft", formula: "fitted-sheet", product: "standard-fitted-sheet", fabric: "cloudsoft", width: 152, length: 203, depth: 30 },
  // flat
  { label: "flat-standard cloudsoft", formula: "flat-sheet", product: "flat-sheet-standard", fabric: "cloudsoft", width: 178, length: 229, depth: 30 },
  // duvet
  { label: "duvet 3-sided cloudsoft", formula: "duvet", product: "3-sided-duvet", fabric: "cloudsoft", width: 229, length: 254 },
  // pillowcase
  { label: "pillowcase envelope cloudsoft", formula: "pillowcase", product: "pillowcase-envelope", fabric: "cloudsoft", width: 50, length: 75 },
  // pillow protector
  { label: "pillow protector", formula: "pillow-protector", product: "pillow-protector-general", fabric: "cloudsoft", width: 50, length: 75 },
];

function get(obj, path, fallback) {
  const out = path.split(".").reduce((acc, p) => (acc && acc[p] !== undefined ? acc[p] : undefined), obj);
  return out === undefined ? fallback : out;
}

function sewingCost(area, tiers) {
  for (const t of tiers || []) {
    if (area <= Number(t.max)) return Number(t.cost);
  }
  return 500;
}

function roundThb(total) {
  return Math.ceil(total / 100) * 100;
}

function rate(pp, fabric) {
  return Number((pp.fabric_rates || {})[fabric] || (pp.fabric_rates || {}).cloudsoft || 100);
}

function calcFittedThb(c, pp) {
  const fixed = pp.fixed_costs || {};
  const margins = pp.margins || {};
  const sqcmPerYard = Number(get(fixed, "sqcm_per_yard", 23744));
  const waste = 1 + Number(get(fixed, "waste_factor_fabric", 20)) / 100;
  const packing = Number(get(fixed, "packing_cost", 100));
  const delivery = Number(get(fixed, "delivery_cost", 50));
  const op = Number(get(fixed, "ops_rate", 15)) / 100;
  const mkt = Number(get(fixed, "mkt_rate", 20)) / 100;
  const margin = c.product === "family-fitted-sheet"
    ? Number(get(margins, "family", 50)) / 100
    : Number(get(margins, "standard", 30)) / 100;
  const fabricRate = rate(pp, c.fabric);
  const area = (c.width + 2 * c.depth + 14) * (c.length + 2 * c.depth + 14);
  const fabricCost = (area * fabricRate / sqcmPerYard) * waste;
  const sew = sewingCost(area, pp.sewing_tiers);
  const accessories = fabricCost * (Number(get(fixed, "accessories_rate", 10)) / 100);
  const subtotal = fabricCost + sew + accessories + packing + delivery;
  const total = subtotal * (1 + op + mkt + margin);
  return roundThb(total);
}

function calcFlatThb(c, pp) {
  const fixed = pp.fixed_costs || {};
  const margins = pp.margins || {};
  const sqcmPerYard = Number(get(fixed, "sqcm_per_yard", 23744));
  const waste = 1 + Number(get(fixed, "waste_factor_fabric", 20)) / 100;
  const packing = Number(get(fixed, "packing_cost", 100));
  const delivery = Number(get(fixed, "delivery_cost", 50));
  const op = Number(get(fixed, "ops_rate", 15)) / 100;
  const mkt = Number(get(fixed, "mkt_rate", 20)) / 100;
  const margin = Number(get(margins, "standard", 30)) / 100;
  const flatTuck = Number(get(fixed, "flat_tuck_cm", 25));
  const flatSewing = Number(get(fixed, "flat_sewing_cost", 250));
  const fw = c.width + 2 * c.depth + 2 * flatTuck;
  const fl = c.length + 2 * c.depth + 2 * flatTuck;
  const area = fw * fl;
  const fabricCost = (area * rate(pp, c.fabric) / sqcmPerYard) * waste;
  const subtotal = fabricCost + flatSewing + packing + delivery;
  return roundThb(subtotal * (1 + op + mkt + margin));
}

function duvetSewingCost(areaRaw, tiers) {
  for (const t of tiers || []) {
    if (areaRaw <= Number(t.max)) return Number(t.cost);
  }
  return 600;
}

function calcDuvetThb(c, pp) {
  const fixed = pp.fixed_costs || {};
  const margins = pp.margins || {};
  const sqcmPerYard = Number(get(fixed, "sqcm_per_yard", 23744));
  const packing = Number(get(fixed, "packing_cost", 100));
  const delivery = Number(get(fixed, "delivery_cost", 50));
  const op = Number(get(fixed, "ops_rate", 15)) / 100;
  const mkt = Number(get(fixed, "mkt_rate", 20)) / 100;
  const margin = Number(get(margins, "duvet", 30)) / 100;
  const zipperRate = Number(get(fixed, "zipper_rate", 0.4));
  const waste = 1 + Number(get(fixed, "waste_factor_fabric", 20)) / 100;
  const rawArea = 2 * (c.width + 5) * (c.length + 5);
  const area = rawArea * waste;
  const fabricCost = area * rate(pp, c.fabric) / sqcmPerYard;
  const zipper = zipperRate * (2 * c.length + c.width);
  const sewing = duvetSewingCost(rawArea, pp.duvet_sewing_tiers);
  const subtotal = fabricCost + zipper + sewing + packing + delivery;
  return roundThb(subtotal * (1 + op + mkt + margin));
}

function calcPillowcaseThb(c, pp, sham = false, zipper = false) {
  const fixed = pp.fixed_costs || {};
  const margins = pp.margins || {};
  const sqcmPerYard = Number(get(fixed, "sqcm_per_yard", 23744));
  const packing = Number(get(fixed, "packing_cost", 100));
  const delivery = Number(get(fixed, "delivery_cost", 50));
  const op = Number(get(fixed, "ops_rate", 15)) / 100;
  const mkt = Number(get(fixed, "mkt_rate", 20)) / 100;
  const margin = Number(get(margins, "pillow", 15)) / 100;
  const waste = 1 + Number(get(fixed, "waste_factor_pillowcase", 60)) / 100;
  const pillowSewing = Number(get(fixed, "pillow_sewing_cost", 40));
  const shamSewing = Number(get(fixed, "pillow_sham_sewing_cost", 50));
  const zipperRate = Number(get(fixed, "zipper_rate", 0.4));
  let rawArea = 2 * (c.width + 5) * (c.length + 5);
  if (sham) rawArea *= 1.15;
  const area = rawArea * waste;
  const fabricCost = area * rate(pp, c.fabric) / sqcmPerYard;
  const z = zipper ? zipperRate * Math.max(c.width, c.length) : 0;
  const sew = sham ? shamSewing : pillowSewing;
  const subtotal = fabricCost + z + sew + packing + delivery;
  return roundThb(subtotal * (1 + op + mkt + margin));
}

function calcPillowProtectorThb(c, pp) {
  const fixed = pp.fixed_costs || {};
  const margins = pp.margins || {};
  const packing = Number(get(fixed, "packing_cost", 100));
  const delivery = Number(get(fixed, "delivery_cost", 50));
  const op = Number(get(fixed, "ops_rate", 15)) / 100;
  const mkt = Number(get(fixed, "mkt_rate", 20)) / 100;
  const margin = Number(get(margins, "pillow_protector", 35)) / 100;
  const waste = 1 + Number(get(fixed, "waste_factor_pillowcase", 60)) / 100;
  const pillowSewing = Number(get(fixed, "pillow_sewing_cost", 40));
  const zipperRate = Number(get(fixed, "zipper_rate", 0.4));
  const tpuRate = Number(get(pp, "fabric_rates.tpu", 120));
  const tpuSqcmPerLm = Number(get(fixed, "tpu_sqcm_per_lm", 21000));
  const rawArea = 2 * (c.width + 5) * (c.length + 5);
  const area = rawArea * waste;
  const fabricCost = tpuRate * area / tpuSqcmPerLm;
  const z = zipperRate * Math.max(c.width, c.length);
  const subtotal = fabricCost + z + pillowSewing + packing + delivery;
  return roundThb(subtotal * (1 + op + mkt + margin));
}

function expectedThb(c, pp) {
  if (c.formula === "fitted-sheet") return calcFittedThb(c, pp);
  if (c.formula === "flat-sheet") return calcFlatThb(c, pp);
  if (c.formula === "duvet") return calcDuvetThb(c, pp);
  if (c.formula === "pillowcase") return calcPillowcaseThb(c, pp, false, c.product === "pillowcase-zipper");
  if (c.formula === "pillow-protector") return calcPillowProtectorThb(c, pp);
  throw new Error(`unsupported formula ${c.formula}`);
}

async function main() {
  const ppResp = await fetch(`${BASE_URL}/api/pricing-params`);
  if (!ppResp.ok) throw new Error(`pricing-params failed: ${ppResp.status}`);
  const pp = await ppResp.json();

  const failures = [];
  for (const c of CASES) {
    const payload = {
      product: c.product,
      fabric: c.fabric,
      unit: "cm",
      width: String(c.width),
      length: String(c.length),
    };
    if (c.depth !== undefined) payload.depth = String(c.depth);
    const qs = new URLSearchParams(payload);
    const resp = await fetch(`${BASE_URL}/api/pricing?${qs.toString()}`);
    if (!resp.ok) {
      failures.push(`${c.label}: API ${resp.status}`);
      continue;
    }
    const body = await resp.json();
    const expected = expectedThb(c, pp);
    const actual = Number(body.price_thb);
    if (String(body.formula || "") !== c.formula) {
      failures.push(`${c.label}: formula mismatch expected ${c.formula}, got ${body.formula || "(none)"}`);
      continue;
    }
    if (actual !== expected) {
      failures.push(`${c.label}: expected ${expected}, got ${actual}`);
    }
  }

  if (failures.length) {
    console.error("Pricing parity check failed:");
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log(`Pricing parity check passed (${CASES.length} cases)`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
