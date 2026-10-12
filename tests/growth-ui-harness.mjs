// Generates a self-contained visual-test harness from the REAL patched page.
// The full page script runs unmodified; only auth (skipped) and fetch (fixture)
// are stubbed, so what renders is exactly what production would render.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const pagePath = fileURLToPath(new URL("../public/super-admin/marketing/data-analyst/index.html", import.meta.url));
const page = readFileSync(pagePath, "utf8");

function sig(status, value, coverage, freshness_days, confidence_impact, reason) {
  return { status, value, coverage, freshness_days, confidence_impact, reason };
}
const FIXTURE = {
  success: true,
  growth_signal_contract: "v1",
  window: { current_start: "2026-09-14", current_end: "2026-10-11" },
  google_ads_policy: { business_signal: "insufficient_or_sparse" },
  signals: {
    demand: sig("sufficient",
      { sessions_28d: 1234, orders_28d: 18, paid_sessions_28d: 210, organic_sessions_28d: 1024, revenue_28d_thb: 84210 },
      { state: "verified_current_window", note: "GA4 property 308922589" },
      2, 0, "Demand fully covered by canonical GA4 property for the current 28d window."),
    momentum: sig("insufficient_signal",
      { units_growth_pct: null, current_units: null, previous_units: null },
      { sales_coverage: { state: "unverified", note: "no verified sales coverage for current window" } },
      null, -20,
      "Sales coverage unverified for the current window; growth withheld rather than computed from partial data. Recheck after the next verified sales sync settles the rolling-prev-month window."),
    conversion_availability: sig("neutral",
      { purchase_events_28d: 0, checkout_events_28d: 3, view_item_events_28d: 2841 },
      { state: "verified_current_window" }, 2, 0, "Zero purchase events observed (distinguishable from unavailable)."),
    channel_context: sig("neutral", { top_channel: "direct", channels_observed: 4 },
      { state: "verified_current_window" }, 2, 0, "Channel mix available from GA4."),
    source_freshness: sig("sufficient", { ga4_lag_days: 2, gsc_lag_days: 3, ads_lag_days: 2 },
      { state: "verified_current_window" }, 2, 0, "All collectors fresh."),
    mapping_coverage: sig("mapping_gap", { mapped_listings: 14, unmapped_listings: 2 },
      { state: "partial_current_window" }, 1, -5, "2 Etsy listings not mapped to canonical products."),
    confidence: sig("sufficient", 30,
      { state: "verified_current_window" }, 2, 0, "Confidence reflects unverified sales coverage."),
    profitability_guardrail: sig("secondary_guardrail", { ads_spend_28d_thb: 360, model: "phase13-cost-model" },
      { state: "verified_current_window" }, 2, 0, "Google Ads remains neutral in Phase 13."),
  },
};

const stub = `
<script>
window.__SKIP_CLERK = true;
try { localStorage.setItem('admin_secret', 'harness'); } catch (e) {}
window.fetch = function (url) {
  if (String(url).indexOf('/growth-signals') > -1) {
    return Promise.resolve(new Response(JSON.stringify(${JSON.stringify(FIXTURE)}), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  return new Promise(function () {}); // all other sections stay in Loading state
};
</script>
`;

const harness = page.replace("<script>", stub + "\n<script>");
assert(harness !== page, "injection point must exist");
mkdirSync(fileURLToPath(new URL("./fixtures", import.meta.url)), { recursive: true });
writeFileSync(fileURLToPath(new URL("./fixtures/growth-harness.html", import.meta.url)), harness);
console.log("harness written");
