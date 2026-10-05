// MildMate Marketing Decision System — Phase 14 Opportunity Engine (shared core)
//
// Single source of scoring truth for BOTH runtimes:
//   - marketing-sync-worker weekly cron (Monday 05:00 UTC)
//   - Pages API manual recompute (dashboard button, POST /api/admin/analysis/opportunity/recompute)
//
// Owner-approved v1 model (2026-10-02, amended 2026-10-02):
//   weights: momentum 30, profitability 30, channel_fit 20, demand 15,
//            strategic 5 (NULL until the owner defines the rule), conversion 0.
//   Demand sub-weights: GA4 80 / GSC 20 (owner amendment: GSC currently too
//   thin for 40%; raise via a new model version once GSC coverage improves).
//   GA4 demand is website-property scoped (migration 055: the Etsy GA4
//   property feeds Etsy channel rows only — properties are never summed).
//   A NULL/insufficient component is NEVER counted as zero: the score is
//   normalized by the available component weight, and every row stores
//   available_weight + missing-component flags + a Data Confidence score.
//   Profitability is MODELED (Phase 13 formula-derived at the approved
//   reference size), labeled ESTIMATED — never realized per-product margin.
//   No order revenue is ever allocated to products; no equal-splitting.
//   Deterministic + idempotent: same inputs → same score; same-day rerun
//   replaces that day's snapshot (UNIQUE score_date+model+product+channel).

export const DEFAULT_MODEL_VERSION = "v1";
export const DEFAULT_WEIGHTS = { momentum: 30, profitability: 30, channel_fit: 20, demand: 15, strategic: 5, conversion: 0, demand_ga4: 80, demand_gsc: 20 };

// Confidence deduction constants (documented in the model registry notes):
const CONF_MODEL = {
  modeled_margin_basis: 15,      // flat: profitability is modeled, not realized
  demand_mapping_max: 10,        // × (1 − mapped share) per demand source actually used
  ga4_stale_after_days: 10,      // −5 if GA4 latest data older than this and GA4 was used
  gsc_stale_after_days: 14,      // −5 if GSC latest data older than this and GSC was used
  product_stale_block: 30,       // −5 per 30d since product's last order (cap 15)
  low_volume_orders: 5,          // all-time orders-containing < 5 → −10; < 2 → −15
  profitability_missing: 10,     // modeled margin not derivable → −10 (never zero)
};
const TIER = { high: 70, medium: 45, low: 25 };

function round1(v) { return Math.round(v * 10) / 10; }

// Rank-based percentile with averaged ties: p = (below + equal/2) / n × 100.
// Returns Map rawValue → percentile (0-100). Single-element pools → 50.
function percentileMap(values) {
  const n = values.length;
  const map = new Map();
  if (!n) return map;
  const sorted = [...values].sort((a, b) => a - b);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && sorted[j] === sorted[i]) j++;
    const below = i;
    const equal = j - i;
    map.set(sorted[i], round1(((below + equal / 2) / n) * 100));
    i = j;
  }
  return map;
}

function today() { return new Date().toISOString().slice(0, 10); }

// ── Input fetch (all from existing D1 views/tables; read-only) ─────────────

async function fetchInputs(env) {
  const q = async (sql) => (await env.DB.prepare(sql).all()).results || [];

  const products = await q(
    "SELECT id, slug, title_en FROM products WHERE is_active = 1 ORDER BY id"
  );

  // Latest cost row per product (verified outranks formula on same date).
  const costRows = await q(
    "SELECT product_id, production_cost_thb, modeled_price_thb, cost_source, is_estimate, effective_from " +
    "FROM cost_model_products ORDER BY product_id, effective_from DESC, " +
    "CASE WHEN cost_source = 'verified' THEN 1 ELSE 0 END DESC, id DESC"
  );
  const costByProduct = new Map();
  for (const r of costRows) {
    if (!costByProduct.has(r.product_id)) costByProduct.set(r.product_id, r);
  }

  // Sales per product (overall): 90d / previous-90d / all-time windows.
  const salesByProduct = await q(
    "SELECT product_id, " +
    "COUNT(DISTINCT CASE WHEN order_day >= date('now','-90 day') THEN sales_order_id END) AS cur90_orders, " +
    "SUM(CASE WHEN order_day >= date('now','-90 day') THEN quantity ELSE 0 END) AS cur90_units, " +
    "COUNT(DISTINCT CASE WHEN order_day < date('now','-90 day') AND order_day >= date('now','-180 day') THEN sales_order_id END) AS prev90_orders, " +
    "SUM(CASE WHEN order_day < date('now','-90 day') AND order_day >= date('now','-180 day') THEN quantity ELSE 0 END) AS prev90_units, " +
    "COUNT(DISTINCT sales_order_id) AS all_orders, " +
    "SUM(quantity) AS all_units, " +
    "MAX(order_day) AS last_order_day " +
    "FROM analysis_active_items WHERE product_id IS NOT NULL GROUP BY product_id"
  );

  // Sales per product × channel.
  const salesByChannel = await q(
    "SELECT product_id, channel_norm AS channel, " +
    "SUM(CASE WHEN order_day >= date('now','-90 day') THEN quantity ELSE 0 END) AS cur90_units, " +
    "SUM(CASE WHEN order_day < date('now','-90 day') AND order_day >= date('now','-180 day') THEN quantity ELSE 0 END) AS prev90_units, " +
    "SUM(quantity) AS all_units " +
    "FROM analysis_active_items WHERE product_id IS NOT NULL GROUP BY product_id, channel_norm"
  );

  // Channel-level trend (all products).
  const channelTrend = await q(
    "SELECT channel_norm AS channel, " +
    "COUNT(DISTINCT CASE WHEN order_day >= date('now','-90 day') THEN id END) AS cur90_orders, " +
    "COUNT(DISTINCT CASE WHEN order_day < date('now','-90 day') AND order_day >= date('now','-180 day') THEN id END) AS prev90_orders " +
    "FROM analysis_commercial_orders GROUP BY channel_norm"
  );

  // GA4 + GSC product demand (28d, mapped rows only) and source health.
  // GA4 demand is website-property scoped (migration 055: website and Etsy
  // properties stay logically separate — never summed across properties).
  const ga4ByProduct = await q(
    "SELECT product_id, SUM(sessions) AS sessions FROM ga4_funnel_daily " +
    "WHERE property_scope = 'website' AND product_id IS NOT NULL AND report_date >= date('now','-28 day') GROUP BY product_id"
  );
  const ga4Health = (await q(
    "SELECT MAX(report_date) AS max_date, SUM(sessions) AS total_sessions, " +
    "SUM(CASE WHEN product_id IS NOT NULL THEN sessions ELSE 0 END) AS mapped_sessions FROM ga4_funnel_daily " +
    "WHERE property_scope = 'website'"
  ))[0] || {};
  // Etsy-scope GA4 (property 533944293): per-product demand via the
  // human-confirmed listing→product master mapping, plus channel health.
  // Unmapped listings contribute no per-product demand (NULL, never zero).
  const ga4EtsyByProduct = await q(
    "SELECT m.product_id AS product_id, SUM(g.sessions) AS sessions " +
    "FROM ga4_funnel_daily g JOIN etsy_listing_master m ON m.listing_id = g.listing_id " +
    "WHERE g.property_scope = 'etsy' AND m.product_id IS NOT NULL " +
    "AND g.report_date >= date('now','-28 day') GROUP BY m.product_id"
  );
  const ga4EtsyHealth = (await q(
    "SELECT MAX(g.report_date) AS max_date, SUM(g.sessions) AS total_sessions, " +
    "SUM(CASE WHEN m.product_id IS NOT NULL THEN g.sessions ELSE 0 END) AS mapped_sessions " +
    "FROM ga4_funnel_daily g LEFT JOIN etsy_listing_master m ON m.listing_id = g.listing_id " +
    "WHERE g.property_scope = 'etsy'"
  ))[0] || {};
  const gscByProduct = await q(
    "SELECT product_id, SUM(clicks) AS clicks, SUM(impressions) AS impressions FROM gsc_search_daily " +
    "WHERE product_id IS NOT NULL AND report_date >= date('now','-28 day') GROUP BY product_id"
  );
  const gscHealth = (await q(
    "SELECT MAX(report_date) AS max_date, SUM(clicks) AS total_clicks, " +
    "SUM(CASE WHEN product_id IS NOT NULL THEN clicks ELSE 0 END) AS mapped_clicks FROM gsc_search_daily"
  ))[0] || {};

  // Latest effective channel fee + shipping rows.
  const feeRows = await q(
    "SELECT channel, marketplace_fee_pct, payment_fee_pct, payment_fee_fixed_thb, other_fee_thb_per_order, effective_from " +
    "FROM cost_model_channel_fees ORDER BY channel, effective_from DESC, id DESC"
  );
  const shipRows = await q(
    "SELECT channel, avg_shipping_cost_thb, effective_from " +
    "FROM cost_model_shipping ORDER BY channel, effective_from DESC, id DESC"
  );
  const feeByChannel = new Map();
  for (const r of feeRows) if (!feeByChannel.has(r.channel)) feeByChannel.set(r.channel, r);
  const shipByChannel = new Map();
  for (const r of shipRows) if (!shipByChannel.has(r.channel)) shipByChannel.set(r.channel, r);

  return {
    products, costByProduct, salesByProduct, salesByChannel, channelTrend,
    ga4ByProduct: new Map(ga4ByProduct.map((r) => [r.product_id, r.sessions || 0])),
    ga4EtsyByProduct: new Map(ga4EtsyByProduct.map((r) => [r.product_id, r.sessions || 0])),
    gscByProduct: new Map(gscByProduct.map((r) => [r.product_id, r.clicks || 0])),
    ga4Health, ga4EtsyHealth, gscHealth, feeByChannel, shipByChannel,
  };
}

function daysSince(dateStr, now) {
  if (!dateStr) return null;
  const d = Math.floor((Date.parse(now + "T00:00:00Z") - Date.parse(dateStr + "T00:00:00Z")) / 86400000);
  return Number.isFinite(d) ? d : null;
}

// ── Scoring ────────────────────────────────────────────────────────────────

function buildReasons(row, scope) {
  const parts = [];
  const c = row.components_json;
  if (row.score !== null && row.score !== undefined) {
    parts.push(`Score ${round1(row.score)}/100 (rank ${row.rank} in scope ${scope}, available weight ${row.available_weight} of 100)`);
  } else {
    parts.push("INSUFFICIENT_DATA — no score issued");
  }
  if (c.momentum && c.momentum.raw !== null && c.momentum.raw !== undefined) {
    parts.push(`momentum ${c.momentum.raw >= 0 ? "+" : ""}${round1(c.momentum.raw * 100)}% 90d units (w${c.momentum.weight}, p${c.momentum.normalized})`);
  }
  if (c.profitability && c.profitability.raw !== null && c.profitability.raw !== undefined) {
    parts.push(`MODELED margin ${round1(c.profitability.raw)}% ESTIMATED (w${c.profitability.weight}, p${c.profitability.normalized})`);
  }
  if (c.channel_fit && c.channel_fit.raw !== null && c.channel_fit.raw !== undefined) {
    parts.push(`channel fit ${c.channel_fit.raw_desc || c.channel_fit.raw} (w${c.channel_fit.weight}, p${c.channel_fit.normalized})`);
  }
  if (c.demand && c.demand.raw !== null && c.demand.raw !== undefined) {
    parts.push(`demand p${c.demand.normalized} ${c.demand.sources || ""} (w${c.demand.weight})`);
  }
  if (row.missing_components) parts.push(`missing: ${row.missing_components} (weight redistributed, never zero)`);
  parts.push(`confidence ${round1(row.confidence)} (${row.tier})`);
  return parts.join("; ");
}

function confidenceScore(opts) {
  // opts: { usedGa4, usedGsc, usedGa4Etsy, ga4MappedShare, gscMappedShare, ga4AgeDays, gscAgeDays,
  //         ga4EtsyMappedShare, ga4EtsyAgeDays,
  //         lastOrderDay, now, allOrders, hasProfitability }
  let c = 100;
  const notes = [];
  c -= CONF_MODEL.modeled_margin_basis;
  notes.push("modeled margin basis -15");
  if (opts.usedGa4 && Number.isFinite(opts.ga4MappedShare)) {
    const d = round1(CONF_MODEL.demand_mapping_max * (1 - opts.ga4MappedShare));
    if (d > 0) { c -= d; notes.push(`GA4 unmapped -${d}`); }
  }
  if (opts.usedGsc && Number.isFinite(opts.gscMappedShare)) {
    const d = round1(CONF_MODEL.demand_mapping_max * (1 - opts.gscMappedShare));
    if (d > 0) { c -= d; notes.push(`GSC unmapped -${d}`); }
  }
  if (opts.usedGa4Etsy && Number.isFinite(opts.ga4EtsyMappedShare)) {
    const d = round1(CONF_MODEL.demand_mapping_max * (1 - opts.ga4EtsyMappedShare));
    if (d > 0) { c -= d; notes.push(`GA4 Etsy unmapped -${d}`); }
  }
  if (opts.usedGa4 && opts.ga4AgeDays !== null && opts.ga4AgeDays > CONF_MODEL.ga4_stale_after_days) {
    c -= 5; notes.push(`GA4 stale ${opts.ga4AgeDays}d -5`);
  }
  if (opts.usedGa4Etsy && opts.ga4EtsyAgeDays !== null && opts.ga4EtsyAgeDays > CONF_MODEL.ga4_stale_after_days) {
    c -= 5; notes.push(`GA4 Etsy stale ${opts.ga4EtsyAgeDays}d -5`);
  }
  if (opts.usedGsc && opts.gscAgeDays !== null && opts.gscAgeDays > CONF_MODEL.gsc_stale_after_days) {
    c -= 5; notes.push(`GSC stale ${opts.gscAgeDays}d -5`);
  }
  const staleDays = daysSince(opts.lastOrderDay, opts.now);
  if (staleDays !== null && staleDays > CONF_MODEL.product_stale_block) {
    const d = Math.min(15, Math.floor(staleDays / CONF_MODEL.product_stale_block) * 5);
    if (d > 0) { c -= d; notes.push(`last order ${staleDays}d ago -${d}`); }
  }
  const ao = Number(opts.allOrders) || 0;
  if (ao < 2) { c -= 15; notes.push("volume <2 orders -15"); }
  else if (ao < CONF_MODEL.low_volume_orders) { c -= 10; notes.push(`volume ${ao} orders -10`); }
  if (!opts.hasProfitability) { c -= CONF_MODEL.profitability_missing; notes.push("no modeled margin -10"); }
  return { confidence: Math.max(0, Math.min(100, round1(c))), notes: notes.join(", ") };
}

// Demand sub-weights inside the Demand component (owner amendment
// 2026-10-02: GSC currently too thin for 40% — GA4 80 / GSC 20 by default,
// stored in the versioned model registry so changes require a new version).
function demandSubWeights(weights) {
  const ga4 = Math.max(0, Math.min(1, (Number(weights?.demand_ga4) || 80) / 100));
  const gscDefault = 100 - ga4 * 100;
  const gsc = Math.max(0, Math.min(1, (Number(weights?.demand_gsc ?? gscDefault)) / 100));
  return { ga4, gsc };
}

function scoreRows(inputs, weights, now) {
  const W = weights;
  // Demand sub-weights (owner amendment 2026-10-02: GSC too thin for 40%).
  // Read from the versioned model registry; default GA4 80 / GSC 20.
  const DW = demandSubWeights(W);
  const ga4MappedShare = (Number(inputs.ga4Health.mapped_sessions) || 0) /
    Math.max(1, Number(inputs.ga4Health.total_sessions) || 1);
  const gscMappedShare = (Number(inputs.gscHealth.mapped_clicks) || 0) /
    Math.max(1, Number(inputs.gscHealth.total_clicks) || 1);
  const ga4AgeDays = daysSince((inputs.ga4Health.max_date || "").slice(0, 10), now);
  const gscAgeDays = daysSince((inputs.gscHealth.max_date || "").slice(0, 10), now);
  // Etsy-property health (separate from website GA4 — never summed).
  const ga4EtsyMappedShare = (Number(inputs.ga4EtsyHealth.mapped_sessions) || 0) /
    Math.max(1, Number(inputs.ga4EtsyHealth.total_sessions) || 1);
  const ga4EtsyAgeDays = daysSince((inputs.ga4EtsyHealth.max_date || "").slice(0, 10), now);

  const rows = [];
  for (const p of inputs.products) {
    const sales = (inputs.salesByProduct.find((r) => r.product_id === p.id)) || null;
    const cost = inputs.costByProduct.get(p.id) || null;
    const allUnits = Number(sales?.all_units) || 0;

    // Channels this product has sold in (for the product × channel rows).
    const channels = inputs.salesByChannel.filter((r) => r.product_id === p.id && (Number(r.all_units) || 0) > 0);

    // ── Raw component values (product overall) ──
    const cur90 = Number(sales?.cur90_units) || 0;
    const prev90 = Number(sales?.prev90_units) || 0;
    let momentumRaw = null, momentumFlag = null;
    if (prev90 > 0) momentumRaw = (cur90 - prev90) / prev90;
    else if (cur90 > 0) momentumFlag = "insufficient_history";
    else momentumFlag = "no_recent_sales";

    let profitRaw = null;
    const unitCost = Number(cost?.production_cost_thb) || 0;
    const modeledPrice = Number(cost?.modeled_price_thb) || 0;
    if (unitCost > 0 && modeledPrice > 0) profitRaw = ((modeledPrice - unitCost) / modeledPrice) * 100;

    const channelCount = channels.length;
    const channelFitRaw = channelCount > 0 ? channelCount : null;

    const ga4Sessions = inputs.ga4ByProduct.get(p.id) || 0;
    const gscClicks = inputs.gscByProduct.get(p.id) || 0;
    const usedGa4 = ga4Sessions > 0;
    const usedGsc = gscClicks > 0;

    rows.push({
      product_id: p.id, slug: p.slug, title: p.title_en, channel: "",
      _raw: {
        momentum: momentumRaw, momentumFlag,
        profitability: profitRaw,
        channel_fit: channelFitRaw, channel_fit_desc: `${channelCount} channel(s)`,
        demand_ga4: usedGa4 ? ga4Sessions : null,
        demand_gsc: usedGsc ? gscClicks : null,
        usedGa4, usedGsc,
      },
      _meta: {
        all_orders: Number(sales?.all_orders) || 0,
        last_order_day: sales?.last_order_day || null,
        has_profitability: profitRaw !== null,
        cur90, prev90,
      },
    });

    // ── Product × channel rows ──
    for (const ch of channels) {
      const cCur = Number(ch.cur90_units) || 0;
      const cPrev = Number(ch.prev90_units) || 0;
      let chMomentum = null, chMomentumFlag = null;
      if (cPrev > 0) chMomentum = (cCur - cPrev) / cPrev;
      else if (cCur > 0) chMomentumFlag = "insufficient_history";
      else chMomentumFlag = "no_recent_sales";

      // Modeled contribution after channel fees + approved shipping rule.
      let chProfit = null, chProfitFlag = null;
      if (unitCost > 0 && modeledPrice > 0) {
        const fee = inputs.feeByChannel.get(ch.channel);
        const ship = inputs.shipByChannel.get(ch.channel);
        if (fee && ship) {
          const feesAbs = modeledPrice * ((Number(fee.marketplace_fee_pct) || 0) + (Number(fee.payment_fee_pct) || 0)) / 100
            + (Number(fee.payment_fee_fixed_thb) || 0) + (Number(fee.other_fee_thb_per_order) || 0);
          // Per-unit model assumes a 1-unit order (documented; shipping is a per-order average).
          chProfit = ((modeledPrice - unitCost - feesAbs - Number(ship.avg_shipping_cost_thb)) / modeledPrice) * 100;
        } else {
          chProfitFlag = !fee ? "channel_fees_missing" : "channel_shipping_missing";
        }
      }

      // Channel-level demand: website rows use website-property GA4 sessions;
      // etsy rows use Etsy-property GA4 sessions via the human-confirmed
      // listing→product mapping (unmapped → NULL + explicit flag, never zero).
      const etsySessions = inputs.ga4EtsyByProduct.get(p.id) || 0;
      let chDemand = null;
      let chDemandFlag = null;
      let chUsedGa4Etsy = false;
      if (ch.channel === "website") {
        chDemand = usedGa4 ? ga4Sessions : null;
      } else if (ch.channel === "etsy") {
        if (etsySessions > 0) {
          chDemand = etsySessions;
          chUsedGa4Etsy = true;
        } else {
          chDemandFlag = "demand_etsy_unmapped";
        }
      } else {
        chDemandFlag = "demand_not_tracked";
      }

      rows.push({
        product_id: p.id, slug: p.slug, title: p.title_en, channel: ch.channel,
        _raw: {
          momentum: chMomentum, momentumFlag: chMomentumFlag,
          profitability: chProfit, profitabilityFlag: chProfitFlag,
          channel_fit: cCur > 0 ? cCur : null, channel_fit_desc: `${cCur} units 90d in ${ch.channel}`,
          demand_ga4: chDemand, demand_gsc: null,
          usedGa4: ch.channel === "website" && chDemand !== null,
          usedGa4Etsy: chUsedGa4Etsy,
          usedGsc: false,
          demandFlag: chDemandFlag,
        },
        _meta: {
          all_orders: Number(sales?.all_orders) || 0,
          last_order_day: sales?.last_order_day || null,
          has_profitability: chProfit !== null,
          cur90: cCur, prev90: cPrev,
        },
      });
    }
  }

  // ── Percentile pools per component, per scope ──
  const pctPool = (scopeFilter, getVal) => percentileMap(
    rows.filter((r) => scopeFilter(r) && getVal(r) !== null && getVal(r) !== undefined).map(getVal)
  );

  const pools = {};
  for (const scope of ["overall", ...new Set(rows.map((r) => r.channel))]) {
    const inScope = (r) => scope === "overall" ? r.channel === "" : r.channel === scope;
    pools[scope] = {
      momentum: pctPool(inScope, (r) => r._raw.momentum),
      profitability: pctPool(inScope, (r) => r._raw.profitability),
      channel_fit: pctPool(inScope, (r) => r._raw.channel_fit),
      demand_ga4: pctPool(inScope, (r) => r._raw.demand_ga4),
      demand_gsc: pctPool(inScope, (r) => r._raw.demand_gsc),
    };
  }

  // ── Assemble scored rows ──
  const scored = [];
  for (const r of rows) {
    const scope = r.channel === "" ? "overall" : r.channel;
    const P = pools[scope];
    const components = {};
    const missing = [];
    let availableWeight = 0;
    let weighted = 0;

    const addComponent = (name, raw, normalized, flags) => {
      components[name] = { raw: raw === null ? null : round1(raw), normalized, weight: W[name], flags: flags || null };
      if (normalized === null || normalized === undefined) {
        missing.push(flags ? `${name}:${flags}` : name);
      } else {
        availableWeight += W[name];
        weighted += W[name] * normalized;
      }
    };

    // Momentum
    if (r._raw.momentum !== null) {
      addComponent("momentum", r._raw.momentum, P.momentum.get(r._raw.momentum) ?? null, null);
    } else {
      addComponent("momentum", null, null, r._raw.momentumFlag || "insufficient_data");
    }

    // Profitability (MODELED margin — never realized)
    if (r._raw.profitability !== null) {
      addComponent("profitability", r._raw.profitability, P.profitability.get(r._raw.profitability) ?? null, null);
    } else {
      addComponent("profitability", null, null, r._raw.profitabilityFlag || "not_derivable");
    }

    // Channel fit
    if (r._raw.channel_fit !== null) {
      const norm = P.channel_fit.get(r._raw.channel_fit) ?? null;
      components.channel_fit = { raw: r._raw.channel_fit, raw_desc: r._raw.channel_fit_desc, normalized: norm, weight: W.channel_fit, flags: null };
      if (norm === null) missing.push("channel_fit"); else { availableWeight += W.channel_fit; weighted += W.channel_fit * norm; }
    } else {
      components.channel_fit = { raw: null, normalized: null, weight: W.channel_fit, flags: "no_channel_data" };
      missing.push("channel_fit:no_channel_data");
    }

    // Demand (GA4/GSC sub-weights from the versioned registry, v1 = 80/20;
    // NULL when neither source has a signal for this row)
    const demandParts = [];
    let demandNorm = null;
    if (r._raw.demand_ga4 !== null) {
      const n = P.demand_ga4.get(r._raw.demand_ga4) ?? null;
      if (n !== null) demandParts.push({ n, w: DW.ga4, src: r._raw.usedGa4Etsy ? "GA4_Etsy" : "GA4" });
    }
    if (r._raw.demand_gsc !== null && r.channel === "") {
      const n = P.demand_gsc.get(r._raw.demand_gsc) ?? null;
      if (n !== null) demandParts.push({ n, w: DW.gsc, src: "GSC" });
    }
    if (demandParts.length) {
      const wsum = demandParts.reduce((s, x) => s + x.w, 0);
      demandNorm = round1(demandParts.reduce((s, x) => s + x.n * x.w, 0) / wsum);
      components.demand = {
        raw: null, normalized: demandNorm, weight: W.demand,
        sources: demandParts.map((x) => x.src).join("+"), flags: null,
      };
      availableWeight += W.demand;
      weighted += W.demand * demandNorm;
    } else {
      components.demand = { raw: null, normalized: null, weight: W.demand, flags: r._raw.demandFlag || "no_demand_signal" };
      missing.push(`demand:${r._raw.demandFlag || "no_demand_signal"}`);
    }

    // Strategic: NULL until the owner defines the rule — never invented.
    components.strategic = { raw: null, normalized: null, weight: W.strategic, flags: "strategic_undefined" };
    missing.push("strategic:strategic_undefined");

    // Conversion: weight is 0 in v1 until GA4 funnel events populate.
    components.conversion = { raw: null, normalized: null, weight: W.conversion, flags: "conversion_weight_zero" };
    if (W.conversion > 0) missing.push("conversion:not_tracked_v1");

    const conf = confidenceScore({
      usedGa4: r._raw.usedGa4, usedGsc: r._raw.usedGsc,
      usedGa4Etsy: r._raw.usedGa4Etsy,
      ga4MappedShare, gscMappedShare, ga4AgeDays, gscAgeDays,
      ga4EtsyMappedShare, ga4EtsyAgeDays,
      lastOrderDay: r._meta.last_order_day, now,
      allOrders: r._meta.all_orders,
      hasProfitability: r._meta.has_profitability,
    });

    let score = null, tier = "INSUFFICIENT_DATA";
    if (availableWeight > 0) {
      score = round1(weighted / availableWeight);
      if (conf.confidence < TIER.low) {
        // Confidence gate: below LOW confidence the score is not trustworthy
        // enough to publish — no score issued (never a forced low score).
        score = null; tier = "INSUFFICIENT_DATA";
      } else if (score >= TIER.high) tier = "HIGH";
      else if (score >= TIER.medium) tier = "MEDIUM";
      else tier = "LOW";
    }

    scored.push({
      product_id: r.product_id, slug: r.slug, title: r.title, channel: r.channel,
      score, tier, confidence: conf.confidence, confidence_notes: conf.notes,
      components_json: components, available_weight: availableWeight,
      missing_components: missing.join(","), scope,
      _meta: r._meta,
    });
  }

  // ── Ranks per scope (score DESC, NULLs last) ──
  for (const scope of new Set(scored.map((r) => r.scope))) {
    const inScope = scored.filter((r) => r.scope === scope)
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.product_id - b.product_id);
    inScope.forEach((r, i) => { r.rank = r.score !== null ? i + 1 : null; });
  }

  return scored;
}

// ── Persistence + orchestration ─────────────────────────────────────────────

async function persistRow(env, row, scoreDate, modelVersion, computedAt) {
  const compJson = JSON.stringify(row.components_json);
  await env.DB.prepare(
    "INSERT INTO opportunity_scores (score_date, score_model_version, product_id, channel, score, rank, tier, confidence, " +
    "components_json, available_weight, missing_components, reasons, computed_at) " +
    "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13) " +
    "ON CONFLICT(score_date, score_model_version, product_id, channel) DO UPDATE SET " +
    "score = ?5, rank = ?6, tier = ?7, confidence = ?8, components_json = ?9, " +
    "available_weight = ?10, missing_components = ?11, reasons = ?12, computed_at = ?13, updated_at = CURRENT_TIMESTAMP"
  ).bind(
    scoreDate, modelVersion, row.product_id, row.channel,
    row.score, row.rank, row.tier, row.confidence,
    compJson, row.available_weight, row.missing_components, row.reasons, computedAt
  ).run();
}

export async function loadModel(env) {
  const row = await env.DB.prepare(
    "SELECT model_version, weights_json FROM opportunity_score_models ORDER BY created_at DESC, model_version DESC"
  ).first();
  if (row) {
    try {
      return { model_version: row.model_version, weights: { ...DEFAULT_WEIGHTS, ...JSON.parse(row.weights_json) } };
    } catch { /* fall through to defaults */ }
  }
  return { model_version: DEFAULT_MODEL_VERSION, weights: DEFAULT_WEIGHTS };
}

export async function recomputeOpportunityScores(env, opts = {}) {
  const dryRun = !!opts.dryRun;
  const now = today();
  const computedAt = new Date().toISOString();
  const model = await loadModel(env);
  const inputs = await fetchInputs(env);
  const scored = scoreRows(inputs, model.weights, now);

  for (const r of scored) {
    r.reasons = buildReasons(r, r.scope === "overall" ? "product overall" : r.scope);
  }

  if (!dryRun) {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS opportunity_scores (id INTEGER PRIMARY KEY AUTOINCREMENT, " +
      "score_date TEXT NOT NULL, score_model_version TEXT NOT NULL, product_id INTEGER NOT NULL, " +
      "channel TEXT NOT NULL DEFAULT '', score REAL, rank INTEGER, tier TEXT NOT NULL, confidence REAL, " +
      "components_json TEXT NOT NULL DEFAULT '{}', available_weight REAL NOT NULL DEFAULT 0, " +
      "missing_components TEXT NOT NULL DEFAULT '', reasons TEXT NOT NULL DEFAULT '', computed_at TEXT NOT NULL, " +
      "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
      "UNIQUE(score_date, score_model_version, product_id, channel))"
    ).run();
    for (const r of scored) await persistRow(env, r, now, model.model_version, computedAt);
  }

  const overall = scored.filter((r) => r.channel === "");
  return {
    ok: true,
    dry_run: dryRun,
    score_date: now,
    computed_at: computedAt,
    model_version: model.model_version,
    weights: model.weights,
    rows_total: scored.length,
    overall_rows: overall.length,
    channel_rows: scored.length - overall.length,
    scored_count: scored.filter((r) => r.score !== null).length,
    insufficient_count: scored.filter((r) => r.score === null).length,
    source_health: {
      ga4: { scope: "website", mapped_share: inputs.ga4Health.total_sessions ? Math.round((inputs.ga4Health.mapped_sessions / inputs.ga4Health.total_sessions) * 1000) / 10 : null, latest: inputs.ga4Health.max_date },
      ga4_etsy: { scope: "etsy", mapped_share: inputs.ga4EtsyHealth.total_sessions ? Math.round((inputs.ga4EtsyHealth.mapped_sessions / inputs.ga4EtsyHealth.total_sessions) * 1000) / 10 : null, latest: inputs.ga4EtsyHealth.max_date },
      gsc: { mapped_share: inputs.gscHealth.total_clicks ? Math.round((inputs.gscHealth.mapped_clicks / inputs.gscHealth.total_clicks) * 1000) / 10 : null, latest: inputs.gscHealth.max_date },
    },
    demand_sub_weights: {
      ga4: Math.round(demandSubWeights(model.weights).ga4 * 100),
      gsc: Math.round(demandSubWeights(model.weights).gsc * 100),
    },
    preview: dryRun ? scored : undefined,
  };
}
