// MildMate Admin API — Profitability Cost Model (Phase 13)
//
// Controlled cost inputs for the profitability layer (migration 053):
//   GET    /api/admin/cost-model                → products + fees + shipping + coverage
//   PUT    /api/admin/cost-model/product        → upsert owner-verified product cost row
//   PUT    /api/admin/cost-model/fees           → upsert channel fee row (effective-dated)
//   PUT    /api/admin/cost-model/shipping       → upsert channel shipping estimate row
//   POST   /api/admin/cost-model/recalculate    → regenerate formula-derived cost rows
//   DELETE /api/admin/cost-model/row?table=&id= → delete a single cost row
//
// Design (owner decisions 2026-10-02, discovery-first):
//   Production cost reuses the EXISTING verified formula families and live D1
//   `pricing_params` — the same truth the storefront configurator prices from
//   (via /api/pricing-params). We compute the pre-markup SUBTOTAL only
//   (fabric + sewing + zipper/accessories + packing + delivery); selling-price
//   markup layers (ops/mkt/margin) are NEVER counted as cost.
//   cost_source='formula' rows are ESTIMATED (is_estimate=1): typical cost at
//   the owner-approved reference size per product.
//   cost_source='verified' rows are EXACT/VERIFIED (is_estimate=0): owner
//   actuals, outrank formula rows on the same effective_from.
//   Recalculate NEVER touches verified rows. Missing cost is never written
//   or read as zero — products without a cost stay UNKNOWN (NULL margins).
//
//   Shipping: cost_model_shipping rows are ESTIMATED_SHIPPING_COST derived
//   from the existing D1 shipping charge ÷ 1.05 (owner: pass-through + 5%
//   buffer). Seeded by migration 053; owner can replace with verified
//   courier actuals via PUT /shipping.

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

function err(code: string, message: string, status = 400): Response {
  return json({ success: false, error_code: code, message }, status);
}

// ── Auth (same pattern as admin-analysis.ts) ──────────────────────────────

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
      const raw = (verified.payload as any).raw || {};
      if (hasAdminRole(raw) || emailAllowed((verified.payload as any).email || "", env)) {
        return { ok: true };
      }
      const sub = (verified.payload as any).sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey },
          });
          if (clerkResp.ok) {
            const user: any = await clerkResp.json();
            const email = user.email_addresses?.find(function (e: any) { return e.id === user.primary_email_address_id; })?.email_address || "";
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

// ── Validation helpers ────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CHANNEL_RE = /^[a-z0-9-]{1,30}$/;
const FORMULA_EFFECTIVE_FROM = "2023-01-01"; // covers full historical backfill span

function parseDateOrToday(raw: any): string | null {
  const v = String(raw || "").trim();
  if (!v) return new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(v)) return null;
  return v;
}

function parseMoney(raw: any, min: number, max: number): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 100) / 100;
}

async function ensureTables(env: any): Promise<void> {
  // Defensive self-heal (project convention): preview DBs may lag migrations.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS cost_model_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL,
    production_cost_thb REAL NOT NULL, cost_source TEXT NOT NULL DEFAULT 'formula',
    is_estimate INTEGER NOT NULL DEFAULT 1, effective_from TEXT NOT NULL DEFAULT (date('now')),
    note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, effective_from, cost_source))`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS cost_model_channel_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL,
    marketplace_fee_pct REAL NOT NULL DEFAULT 0, payment_fee_pct REAL NOT NULL DEFAULT 0,
    payment_fee_fixed_thb REAL NOT NULL DEFAULT 0, other_fee_thb_per_order REAL NOT NULL DEFAULT 0,
    is_estimate INTEGER NOT NULL DEFAULT 1, effective_from TEXT NOT NULL DEFAULT (date('now')),
    note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel, effective_from))`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS cost_model_shipping (
    id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL,
    avg_shipping_cost_thb REAL NOT NULL, is_estimate INTEGER NOT NULL DEFAULT 1,
    effective_from TEXT NOT NULL DEFAULT (date('now')), note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel, effective_from))`).run();
}

// ── Live D1 pricing parameters (source of truth) ───────────────────────────
// Mirrors the reshape logic of /api/pricing-params (pricing-params.ts) so
// costs are derived from exactly the values the storefront prices from.

interface CostParams {
  fabricRate: Record<string, number>;   // 'cloudsoft' | 'breezeplus' | ... → THB/yd
  sewingTiers: Array<{ max: number; cost: number }>;
  duvetSewingTiers: Array<{ max: number; cost: number }>;
  fixed: Record<string, number>;       // every other pricing_params key → value
}

async function loadCostParams(env: any): Promise<CostParams> {
  const { results } = await env.DB.prepare(
    "SELECT key, value FROM pricing_params"
  ).all();
  const rows = (results || []) as any[];

  const p: CostParams = { fabricRate: {}, sewingTiers: [], duvetSewingTiers: [], fixed: {} };

  for (const row of rows) {
    const k = String(row.key || "");
    const v = Number(row.value);
    if (!k || !Number.isFinite(v)) continue;
    if (k.startsWith("fabric_rate_")) {
      p.fabricRate[k.replace("fabric_rate_", "")] = v;
    } else if (k.startsWith("sewing_tier") && k.endsWith("_cost")) {
      const m = k.match(/sewing_tier(\d+)_cost/);
      const maxKey = m ? "sewing_tier" + m[1] + "_max" : null;
      const maxRow = maxKey ? rows.find((r: any) => r.key === maxKey) : null;
      p.sewingTiers.push({ max: maxRow ? Number(maxRow.value) : Infinity, cost: v });
    } else if (k.startsWith("duvet_sewing_tier") && k.endsWith("_cost")) {
      const m = k.match(/duvet_sewing_tier(\d+)_cost/);
      const maxKey = m ? "duvet_sewing_tier" + m[1] + "_max" : null;
      const maxRow = maxKey ? rows.find((r: any) => r.key === maxKey) : null;
      p.duvetSewingTiers.push({ max: maxRow ? Number(maxRow.value) : Infinity, cost: v });
    } else {
      p.fixed[k] = v;
    }
  }
  p.sewingTiers.sort((a, b) => a.max - b.max);
  p.duvetSewingTiers.sort((a, b) => a.max - b.max);
  return p;
}

// Controlled constants NOT stored in D1 pricing_params — the same hardcoded
// values the live storefront configurator uses (public/js/product-configurator.js).
// If they are ever added to pricing_params, the fixed map below wins.
const CLIENT_CONSTANTS: Record<string, number> = {
  sqcm_per_yard: 23744,        // configurator fallback (matches live pricing behavior)
  waste_factor_pillowcase: 60,
  protector_fabric_tier1_max: 3200,  protector_fabric_tier1_cost: 550,
  protector_fabric_tier2_max: 6620,  protector_fabric_tier2_cost: 670,
  protector_fabric_tier3_max: 8000,  protector_fabric_tier3_cost: 920,
  protector_fabric_tier4_max: 9000,  protector_fabric_tier4_cost: 980,
  protector_fabric_tier5_max: 10300, protector_fabric_tier5_cost: 1100,
  protector_fabric_tier6_max: 11300, protector_fabric_tier6_cost: 1200,
  protector_fabric_tier7_cost: 1300,
  protector_depth_tier1_min: 0,  protector_depth_tier1_cost: 0,
  protector_depth_tier2_min: 30, protector_depth_tier2_cost: 200,
  protector_depth_tier3_min: 52, protector_depth_tier3_cost: 400,
  protector_depth_tier4_min: 57, protector_depth_tier4_cost: 600,
};

function param(p: CostParams, key: string, fallback: number): number {
  const v = p.fixed[key];
  if (Number.isFinite(v)) return v;
  const c = CLIENT_CONSTANTS[key];
  if (Number.isFinite(c)) return c;
  return fallback;
}

// ── Cost subtotal formulas (pre-markup production cost ONLY) ───────────────
// Ported 1:1 from the live configurator formula families. These compute the
// SAME subtotal the storefront computes before applying selling-price
// markups (ops/mkt/margin) — markups are never part of cost.

function tierCost(tiers: Array<{ max: number; cost: number }>, area: number): number {
  for (const t of tiers) {
    if (area <= t.max) return t.cost;
  }
  return tiers.length ? tiers[tiers.length - 1].cost : 0;
}

function fabricCostPerArea(p: CostParams, areaSqCm: number, fabric: string): number {
  const rate = p.fabricRate[fabric] !== undefined ? p.fabricRate[fabric] : param(p, "fabric_rate_" + fabric, 100);
  const sqcmPerYard = param(p, "sqcm_per_yard", 23744);
  const waste = 1 + param(p, "waste_factor_fabric", 20) / 100;
  return (areaSqCm * rate / sqcmPerYard) * waste;
}

function protectorFabricTierCost(p: CostParams, areaSqInch: number): number {
  for (let i = 1; i <= 6; i++) {
    const max = param(p, "protector_fabric_tier" + i + "_max", Infinity);
    if (areaSqInch <= max) return param(p, "protector_fabric_tier" + i + "_cost", 0);
  }
  return param(p, "protector_fabric_tier7_cost", 1300);
}

function protectorDepthCost(p: CostParams, depthCm: number): number {
  let cost = 0;
  for (let i = 1; i <= 4; i++) {
    if (depthCm >= param(p, "protector_depth_tier" + i + "_min", 0)) {
      cost = param(p, "protector_depth_tier" + i + "_cost", 0);
    }
  }
  return cost;
}

function packingDelivery(p: CostParams, protectorClass: boolean): number {
  return protectorClass
    ? param(p, "protector_packing", 200) + param(p, "protector_delivery", 80)
    : param(p, "packing_cost", 100) + param(p, "delivery_cost", 70);
}

// Fitted sheet: fw=W+2D+14, fl=L+2D+14; fabric + tiered sewing + accessories 10%
function fittedSubtotal(p: CostParams, w: number, l: number, d: number, fabric: string): number {
  const fw = w + 2 * d + param(p, "sewing_allowance_cm", 14);
  const fl = l + 2 * d + param(p, "sewing_allowance_cm", 14);
  const area = fw * fl;
  const fabricCost = fabricCostPerArea(p, area, fabric);
  const sewing = tierCost(p.sewingTiers, area);
  const accessories = fabricCost * param(p, "accessories_rate", 10) / 100;
  return fabricCost + sewing + accessories + packingDelivery(p, false);
}

// Flat sheet: fw=W+2D+2×tuck, fl=L+2D+2×tuck; fabric + flat sewing (no accessories)
function flatSubtotal(p: CostParams, w: number, l: number, d: number, fabric: string): number {
  const tuck = param(p, "flat_tuck_cm", 25);
  const fw = w + 2 * d + 2 * tuck;
  const fl = l + 2 * d + 2 * tuck;
  const area = fw * fl;
  const fabricCost = fabricCostPerArea(p, area, fabric);
  const sewing = param(p, "flat_sewing_cost", 250);
  return fabricCost + sewing + packingDelivery(p, false);
}

// Duvet cover: 2 pieces (W+5)(L+5) +20% waste; zipper 2L+W; tiered sewing
function duvetSubtotal(p: CostParams, w: number, l: number, fabric: string): number {
  const rawArea = 2 * (w + 5) * (l + 5);
  const waste = 1 + param(p, "waste_factor_fabric", 20) / 100;
  const rate = p.fabricRate[fabric] !== undefined ? p.fabricRate[fabric] : param(p, "fabric_rate_" + fabric, 100);
  const sqcmPerYard = param(p, "sqcm_per_yard", 23744);
  const fabricCost = rawArea * waste * rate / sqcmPerYard;
  const zipper = param(p, "zipper_rate", 0.4) * (2 * l + w);
  const sewing = tierCost(p.duvetSewingTiers, rawArea);
  return fabricCost + zipper + sewing + packingDelivery(p, false);
}

// Pillowcase: 2 pieces (W+5)(L+5) +60% waste (sham ×1.15 fabric); variant sewing
function pillowcaseSubtotal(p: CostParams, w: number, l: number, fabric: string, variant: string): number {
  let rawArea = 2 * (w + 5) * (l + 5);
  if (variant === "sham") rawArea *= 1.15;
  const waste = 1 + param(p, "waste_factor_pillowcase", 60) / 100;
  const rate = p.fabricRate[fabric] !== undefined ? p.fabricRate[fabric] : param(p, "fabric_rate_" + fabric, 100);
  const sqcmPerYard = param(p, "sqcm_per_yard", 23744);
  const fabricCost = rawArea * waste * rate / sqcmPerYard;
  const zipper = variant === "zipper" ? param(p, "zipper_rate", 0.4) * Math.max(w, l) : 0;
  const sewing = variant === "sham" ? param(p, "pillow_sham_sewing_cost", 50) : param(p, "pillow_sewing_cost", 40);
  return fabricCost + zipper + sewing + packingDelivery(p, false);
}

// Pillow protector (TPU): same geometry as zipper pillowcase, TPU fabric
function pillowProtectorSubtotal(p: CostParams, w: number, l: number): number {
  const rawArea = 2 * (w + 5) * (l + 5);
  const waste = 1 + param(p, "waste_factor_pillowcase", 60) / 100;
  const area = rawArea * waste;
  const tpuRate = param(p, "fabric_rate_tpu", 120);
  const tpuSqcmPerLm = param(p, "tpu_sqcm_per_lm", 21000);
  const fabricCost = area * (tpuRate / tpuSqcmPerLm);
  const zipper = param(p, "zipper_rate", 0.4) * Math.max(w, l);
  const sewing = param(p, "pillow_sewing_cost", 40);
  return fabricCost + zipper + sewing + packingDelivery(p, false);
}

// Encasement (TPU): 6-sided area 2(WL+WD+LD) +20% waste; sewing flat; zipper 2L+W
function encasementSubtotal(p: CostParams, w: number, l: number, d: number): number {
  const area = 2 * (w * l + w * d + l * d);
  const tpuRate = param(p, "fabric_rate_tpu", 120);
  const tpuBolt = param(p, "tpu_bolt_width_cm", 210);
  const tpuSqcmPerLm = 100 * tpuBolt;
  const waste = 1 + param(p, "waste_factor_fabric", 20) / 100;
  const fabricCost = (tpuRate * area / tpuSqcmPerLm) * waste;
  const sewing = param(p, "encasement_sewing_cost", 300);
  const zipper = param(p, "zipper_rate", 0.4) * (2 * l + w);
  return fabricCost + sewing + zipper + packingDelivery(p, false);
}

// Mattress protector: area-tier fabric cost + depth surcharge + protector packing/delivery
function protectorSubtotal(p: CostParams, w: number, l: number, d: number): number {
  const areaSqInch = (w * l) / 6.4516;
  const fabricTier = protectorFabricTierCost(p, areaSqInch);
  const depthCost = protectorDepthCost(p, d);
  return fabricTier + depthCost + packingDelivery(p, true);
}

// V-berth fitted (marine): width=max(HW,FW)+2D+14 — same cost structure as fitted
function vberthSubtotal(p: CostParams, hw: number, fw: number, l: number, d: number, fabric: string): number {
  return fittedSubtotal(p, Math.max(hw, fw), l, d, fabric);
}

// Marine top sheet: width=max(HW,FW)+2(D+tuck), length=L+2(D+tuck); flat sewing
function marineTopSubtotal(p: CostParams, hw: number, fw: number, l: number, d: number, fabric: string): number {
  const tuck = param(p, "flat_tuck_cm", 25);
  const side = d + tuck;
  const w = Math.max(hw, fw) + 2 * side;
  const fl = l + 2 * side;
  const area = w * fl;
  const fabricCost = fabricCostPerArea(p, area, fabric);
  const sewing = param(p, "flat_sewing_cost", 250);
  return fabricCost + sewing + packingDelivery(p, false);
}

// ── Owner-approved reference configuration per product (2026-10-02) ───────
// Sizes come from MildMate's own size lists (first/"starting from" option per
// populateSizeSelect) unless marked CONTROLLED ASSUMPTION.

type Family =
  | "fitted" | "flat" | "duvet" | "pillowcase" | "pillow_protector"
  | "encasement" | "protector" | "vberth" | "marine_top";

interface RefConfig {
  family: Family;
  dims: { w?: number; l: number; d?: number; hw?: number; fw?: number };
  fabric?: string;     // reference fabric (default cloudsoft = code fallback)
  variant?: string;     // pillowcase variant
  sizeNote: string;    // provenance of the reference size
}

const REFERENCE_CONFIG: Record<string, RefConfig> = {
  "standard-fitted-sheet":        { family: "fitted", dims: { w: 99, l: 191, d: 30 }, sizeNote: "US Twin — first option of MildMate fitted-sheet size list" },
  "deep-pocket-fitted-sheet":     { family: "fitted", dims: { w: 99, l: 191, d: 51 }, sizeNote: "US Twin — deep-pocket 51cm override (configurator)" },
  "dorm-fitted-sheet":            { family: "fitted", dims: { w: 99, l: 191, d: 30 }, sizeNote: "US Twin — first option of fitted-sheet size list" },
  "pet-owner-fitted-sheet":       { family: "fitted", dims: { w: 99, l: 191, d: 30 }, fabric: "breezeplus", sizeNote: "US Twin — first option; fabric BreezePlus (configurator default for Pet Owner)" },
  "family-fitted-sheet":          { family: "fitted", dims: { w: 198, l: 203, d: 30 }, sizeNote: "2× Twin XL — first option of family size list" },
  "rv-truck-fitted-sheet":        { family: "fitted", dims: { w: 81, l: 203, d: 30 }, sizeNote: "32×80 Narrow — first option of truck-fitted-sheet size list" },
  "flat-sheet-standard":          { family: "flat", dims: { w: 99, l: 191, d: 30 }, sizeNote: "US Twin — first option of fitted-sheet size list (flat sheets share it)" },
  "flat-sheet-extra-deep-pocket": { family: "flat", dims: { w: 99, l: 191, d: 51 }, sizeNote: "US Twin — deep-pocket 51cm override (configurator)" },
  "co-sleeping-top-sheet":        { family: "flat", dims: { w: 198, l: 203, d: 30 }, sizeNote: "2× Twin XL — first option of family size list (co-sleeping uses it)" },
  "3-sided-duvet":                { family: "duvet", dims: { w: 173, l: 218 }, sizeNote: "US Twin duvet — first option of duvet size list" },
  "pet-owner-duvet-cover":        { family: "duvet", dims: { w: 173, l: 218 }, fabric: "breezeplus", sizeNote: "US Twin duvet; fabric BreezePlus (configurator default for Pet Owner)" },
  "duvet-cover-marine":           { family: "duvet", dims: { w: 173, l: 218 }, sizeNote: "US Twin duvet — first option of duvet size list" },
  "duvet-cover-rv":               { family: "duvet", dims: { w: 173, l: 218 }, sizeNote: "US Twin duvet — first option of duvet size list" },
  "duvet-cover-dorm":             { family: "duvet", dims: { w: 173, l: 218 }, sizeNote: "US Twin duvet — first option of duvet size list" },
  "weighted-duvet-cover":         { family: "duvet", dims: { w: 173, l: 218 }, sizeNote: "US Twin duvet — first option of duvet size list (derived markup is selling-side only)" },
  "pillowcase-envelope":          { family: "pillowcase", dims: { w: 51, l: 66 }, variant: "envelope", sizeNote: "US Standard — first option of pillow size list" },
  "pillowcase-zipper":            { family: "pillowcase", dims: { w: 51, l: 66 }, variant: "zipper", sizeNote: "US Standard — first option of pillow size list" },
  "pillowcase-sham":              { family: "pillowcase", dims: { w: 51, l: 66 }, variant: "sham", sizeNote: "US Standard — first option of pillow size list" },
  "pillow-protector-general":     { family: "pillow_protector", dims: { w: 51, l: 66 }, sizeNote: "US Standard — first option of pillow size list" },
  "mattress-protector-standard":  { family: "protector", dims: { w: 99, l: 191, d: 30 }, sizeNote: "US Twin — protector pages use the fitted-sheet size list" },
  "mattress-protector-deep-pocket":{ family: "protector", dims: { w: 99, l: 191, d: 51 }, sizeNote: "US Twin — deep-pocket 51cm override (configurator)" },
  "pet-proof-mattress-protector": { family: "protector", dims: { w: 99, l: 191, d: 30 }, sizeNote: "US Twin — protector pages use the fitted-sheet size list; TPU class" },
  "mattress-protector-family":    { family: "protector", dims: { w: 198, l: 203, d: 30 }, sizeNote: "2× Twin XL — first option of family size list" },
  "custom-waterproof-cushion-protector": { family: "protector", dims: { w: 60, l: 60, d: 15 }, sizeNote: "CONTROLLED ASSUMPTION 60×60×15 — cushion has no size list (owner-approved 2026-10-02)" },
  "mattress-encasement-general":  { family: "encasement", dims: { w: 99, l: 191, d: 30 }, sizeNote: "US Twin — encasement pages use the fitted-sheet size list" },
  "rv-truck-mattress-encasement": { family: "encasement", dims: { w: 99, l: 191, d: 30 }, sizeNote: "US Twin — code gives encasement pages the fitted-sheet size list (flagged)" },
  "marine-fitted-sheet":          { family: "vberth", dims: { hw: 175, fw: 100, l: 190, d: 20 }, sizeNote: "CONTROLLED ASSUMPTION HW175×FW100×L190×D20 — no stored marine geometry (owner-approved 2026-10-02)" },
  "marine-mattress-protector":    { family: "vberth", dims: { hw: 175, fw: 100, l: 190, d: 20 }, sizeNote: "CONTROLLED ASSUMPTION HW175×FW100×L190×D20 — marine template V-berth path (owner-approved 2026-10-02)" },
  "marine-top-sheet":              { family: "marine_top", dims: { hw: 175, fw: 100, l: 190, d: 20 }, sizeNote: "CONTROLLED ASSUMPTION HW175×FW100×L190×D20 — no stored marine geometry (owner-approved 2026-10-02)" },
};

function deriveFormulaCost(p: CostParams, slug: string): { cost: number; family: string; dimsText: string; note: string } | null {
  const cfg = REFERENCE_CONFIG[slug];
  if (!cfg) return null;
  const fabric = cfg.fabric || "cloudsoft";
  let cost: number;
  switch (cfg.family) {
    case "fitted":
      cost = fittedSubtotal(p, cfg.dims.w!, cfg.dims.l, cfg.dims.d || 0, fabric); break;
    case "flat":
      cost = flatSubtotal(p, cfg.dims.w!, cfg.dims.l, cfg.dims.d || 0, fabric); break;
    case "duvet":
      cost = duvetSubtotal(p, cfg.dims.w!, cfg.dims.l, fabric); break;
    case "pillowcase":
      cost = pillowcaseSubtotal(p, cfg.dims.w!, cfg.dims.l, fabric, cfg.variant || "envelope"); break;
    case "pillow_protector":
      cost = pillowProtectorSubtotal(p, cfg.dims.w!, cfg.dims.l); break;
    case "encasement":
      cost = encasementSubtotal(p, cfg.dims.w!, cfg.dims.l, cfg.dims.d || 0); break;
    case "protector":
      cost = protectorSubtotal(p, cfg.dims.w!, cfg.dims.l, cfg.dims.d || 0); break;
    case "vberth":
      cost = vberthSubtotal(p, cfg.dims.hw!, cfg.dims.fw!, cfg.dims.l, cfg.dims.d || 0, fabric); break;
    case "marine_top":
      cost = marineTopSubtotal(p, cfg.dims.hw!, cfg.dims.fw!, cfg.dims.l, cfg.dims.d || 0, fabric); break;
    default:
      return null;
  }
  if (!Number.isFinite(cost) || cost <= 0) return null;

  const dimsText = cfg.dims.hw !== undefined
    ? `HW${cfg.dims.hw}xFW${cfg.dims.fw}xL${cfg.dims.l}xD${cfg.dims.d || 0}`
    : cfg.dims.d !== undefined && cfg.family !== "duvet" && cfg.family !== "pillowcase" && cfg.family !== "pillow_protector"
      ? `${cfg.dims.w}x${cfg.dims.l}x${cfg.dims.d}`
      : `${cfg.dims.w}x${cfg.dims.l}`;

  return {
    cost: Math.round(cost * 100) / 100,
    family: cfg.family,
    dimsText,
    note: `ESTIMATED: formula pre-markup subtotal (fabric+sewing+zipper/accessories+packing+delivery) from live D1 pricing_params at reference size ${dimsText} cm. ${cfg.sizeNote}.`,
  };
}

// ── Handlers ──────────────────────────────────────────────────────────────

async function getCostModel(env: any): Promise<Response> {
  await ensureTables(env);
  const today = new Date().toISOString().slice(0, 10);

  const products = await env.DB.prepare(`
    SELECT p.id AS product_id, p.slug, p.title_en, p.base_price_thb, p.is_active,
           c.production_cost_thb, c.cost_source, c.is_estimate, c.effective_from, c.note
    FROM products p
    LEFT JOIN cost_model_products c ON c.id = (
      SELECT c2.id FROM cost_model_products c2
      WHERE c2.product_id = p.id AND c2.effective_from <= ?1
      ORDER BY c2.effective_from DESC,
               CASE WHEN c2.cost_source = 'verified' THEN 1 ELSE 0 END DESC,
               c2.id DESC
      LIMIT 1
    )
    WHERE p.is_active = 1
    ORDER BY p.id
  `).bind(today).all();

  const costRows = await env.DB.prepare(
    "SELECT * FROM cost_model_products ORDER BY product_id, effective_from DESC"
  ).all();
  const fees = await env.DB.prepare(
    "SELECT * FROM cost_model_channel_fees ORDER BY channel, effective_from DESC"
  ).all();
  const shipping = await env.DB.prepare(
    "SELECT * FROM cost_model_shipping ORDER BY channel, effective_from DESC"
  ).all();

  let coverage: any = null;
  try {
    coverage = await env.DB.prepare("SELECT * FROM analysis_profit_coverage").first();
  } catch {
    // view missing (migration 053 not applied) — coverage stays null
  }

  return json({
    success: true,
    products: products.results || [],
    cost_rows: costRows.results || [],
    fees: fees.results || [],
    shipping: shipping.results || [],
    coverage,
  });
}

async function putProductCost(env: any, body: any): Promise<Response> {
  await ensureTables(env);
  const productId = Number(body?.product_id);
  if (!Number.isInteger(productId) || productId < 1) return err("INVALID_PRODUCT_ID", "product_id must be a positive integer.");
  const cost = parseMoney(body?.production_cost_thb, 0.01, 1000000);
  if (cost === null) return err("INVALID_COST", "production_cost_thb must be a positive THB amount.");
  const effectiveFrom = parseDateOrToday(body?.effective_from);
  if (!effectiveFrom) return err("INVALID_EFFECTIVE_FROM", "effective_from must be YYYY-MM-DD.");
  const note = String(body?.note || "").trim().slice(0, 500) || null;
  const isEstimate = body?.is_estimate === undefined ? 0 : (body.is_estimate ? 1 : 0);

  const product = await env.DB.prepare("SELECT id, slug FROM products WHERE id = ?1").bind(productId).first();
  if (!product) return err("UNKNOWN_PRODUCT", "No product with id " + productId, 404);

  await env.DB.prepare(`
    INSERT INTO cost_model_products (product_id, production_cost_thb, cost_source, is_estimate, effective_from, note)
    VALUES (?1, ?2, 'verified', ?3, ?4, ?5)
    ON CONFLICT(product_id, effective_from, cost_source)
    DO UPDATE SET production_cost_thb = ?2, is_estimate = ?3, note = ?5, updated_at = CURRENT_TIMESTAMP
  `).bind(productId, cost, isEstimate, effectiveFrom, note).run();

  return json({ success: true, product_id: productId, slug: (product as any).slug, production_cost_thb: cost, effective_from: effectiveFrom, cost_source: "verified", is_estimate: isEstimate });
}

async function putChannelFees(env: any, body: any): Promise<Response> {
  await ensureTables(env);
  const channel = String(body?.channel || "").trim().toLowerCase();
  if (!CHANNEL_RE.test(channel)) return err("INVALID_CHANNEL", "channel must be lowercase letters, digits, or hyphens.");
  const marketplacePct = parseMoney(body?.marketplace_fee_pct ?? 0, 0, 50);
  const paymentPct = parseMoney(body?.payment_fee_pct ?? 0, 0, 50);
  const paymentFixed = parseMoney(body?.payment_fee_fixed_thb ?? 0, 0, 10000);
  const otherFee = parseMoney(body?.other_fee_thb_per_order ?? 0, 0, 10000);
  if (marketplacePct === null || paymentPct === null) return err("INVALID_FEE_PCT", "Fee percentages must be between 0 and 50.");
  if (paymentFixed === null || otherFee === null) return err("INVALID_FEE_THB", "Fixed fees must be between 0 and 10000 THB.");
  const effectiveFrom = parseDateOrToday(body?.effective_from);
  if (!effectiveFrom) return err("INVALID_EFFECTIVE_FROM", "effective_from must be YYYY-MM-DD.");
  const note = String(body?.note || "").trim().slice(0, 500) || null;
  const isEstimate = body?.is_estimate === undefined ? 1 : (body.is_estimate ? 1 : 0);

  await env.DB.prepare(`
    INSERT INTO cost_model_channel_fees
      (channel, marketplace_fee_pct, payment_fee_pct, payment_fee_fixed_thb, other_fee_thb_per_order, is_estimate, effective_from, note)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    ON CONFLICT(channel, effective_from)
    DO UPDATE SET marketplace_fee_pct = ?2, payment_fee_pct = ?3, payment_fee_fixed_thb = ?4,
                  other_fee_thb_per_order = ?5, is_estimate = ?6, note = ?8, updated_at = CURRENT_TIMESTAMP
  `).bind(channel, marketplacePct, paymentPct, paymentFixed, otherFee, isEstimate, effectiveFrom, note).run();

  return json({ success: true, channel, effective_from: effectiveFrom });
}

async function putShipping(env: any, body: any): Promise<Response> {
  await ensureTables(env);
  const channel = String(body?.channel || "").trim().toLowerCase();
  if (!CHANNEL_RE.test(channel)) return err("INVALID_CHANNEL", "channel must be lowercase letters, digits, or hyphens.");
  const cost = parseMoney(body?.avg_shipping_cost_thb, 0, 100000);
  if (cost === null) return err("INVALID_SHIPPING_COST", "avg_shipping_cost_thb must be between 0 and 100000 THB.");
  const effectiveFrom = parseDateOrToday(body?.effective_from);
  if (!effectiveFrom) return err("INVALID_EFFECTIVE_FROM", "effective_from must be YYYY-MM-DD.");
  const note = String(body?.note || "").trim().slice(0, 500) || null;
  const isEstimate = body?.is_estimate === undefined ? 1 : (body.is_estimate ? 1 : 0);

  await env.DB.prepare(`
    INSERT INTO cost_model_shipping (channel, avg_shipping_cost_thb, is_estimate, effective_from, note)
    VALUES (?1, ?2, ?3, ?4, ?5)
    ON CONFLICT(channel, effective_from)
    DO UPDATE SET avg_shipping_cost_thb = ?2, is_estimate = ?3, note = ?5, updated_at = CURRENT_TIMESTAMP
  `).bind(channel, cost, isEstimate, effectiveFrom, note).run();

  return json({ success: true, channel, avg_shipping_cost_thb: cost, effective_from: effectiveFrom });
}

async function recalculateFormulaCosts(env: any): Promise<Response> {
  await ensureTables(env);
  const params = await loadCostParams(env);
  const products = await env.DB.prepare(
    "SELECT id, slug FROM products WHERE is_active = 1 ORDER BY id"
  ).all();

  const updated: any[] = [];
  const skipped: any[] = [];

  for (const p of ((products.results || []) as any[])) {
    const slug = String(p.slug || "");
    const derived = deriveFormulaCost(params, slug);
    if (!derived) {
      skipped.push({ product_id: p.id, slug: p.slug, reason: "no cost formula — requires owner-verified cost (UNKNOWN otherwise, never zero)" });
      continue;
    }
    await env.DB.prepare(`
      INSERT INTO cost_model_products (product_id, production_cost_thb, cost_source, is_estimate, effective_from, note)
      VALUES (?1, ?2, 'formula', 1, ?3, ?4)
      ON CONFLICT(product_id, effective_from, cost_source)
      DO UPDATE SET production_cost_thb = ?2, note = ?4, updated_at = CURRENT_TIMESTAMP
    `).bind(p.id, derived.cost, FORMULA_EFFECTIVE_FROM, derived.note).run();
    updated.push({
      product_id: p.id,
      slug: p.slug,
      family: derived.family,
      reference_size: derived.dimsText,
      production_cost_thb: derived.cost,
    });
  }

  return json({
    success: true,
    effective_from: FORMULA_EFFECTIVE_FROM,
    params_source: "live D1 pricing_params (+ configurator constants where D1 lacks the key)",
    updated_count: updated.length,
    skipped_count: skipped.length,
    updated,
    skipped,
  });
}

async function deleteRow(env: any, url: URL): Promise<Response> {
  await ensureTables(env);
  const table = String(url.searchParams.get("table") || "").trim();
  const id = Number(url.searchParams.get("id") || "");
  const tables: Record<string, string> = {
    products: "cost_model_products",
    fees: "cost_model_channel_fees",
    shipping: "cost_model_shipping",
  };
  if (!tables[table]) return err("INVALID_TABLE", "table must be products, fees, or shipping.");
  if (!Number.isInteger(id) || id < 1) return err("INVALID_ID", "id must be a positive integer.");
  const result = await env.DB.prepare("DELETE FROM " + tables[table] + " WHERE id = ?1").bind(id).run();
  return json({ success: true, table: tables[table], id, deleted: (result as any)?.meta?.changes ?? null });
}

// ── Router ───────────────────────────────────────────────────────────────

export async function handleAdminCostModel(request: Request, env: any): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
      },
    });
  }

  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return err("UNAUTHORIZED", auth.error, auth.status);

  const url = new URL(request.url);
  const sub = url.pathname.replace(/\/+$/, "").replace(/^\/api\/admin\/cost-model/, "") || "/";

  let body: any = null;
  if (request.method === "PUT" || request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      return err("INVALID_JSON", "Request body must be valid JSON.");
    }
  }

  if (request.method === "GET" && sub === "/") return getCostModel(env);
  if (request.method === "PUT" && sub === "/product") return putProductCost(env, body);
  if (request.method === "PUT" && sub === "/fees") return putChannelFees(env, body);
  if (request.method === "PUT" && sub === "/shipping") return putShipping(env, body);
  if (request.method === "POST" && sub === "/recalculate") return recalculateFormulaCosts(env);
  if (request.method === "DELETE" && sub === "/row") return deleteRow(env, url);

  return err("ROUTE_NOT_FOUND", "Unknown cost-model route: " + request.method + " " + sub, 404);
}
