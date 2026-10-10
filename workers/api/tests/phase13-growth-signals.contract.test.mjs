import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const bundlePath = process.env.PHASE13_ADMIN_ANALYSIS_BUNDLE_PATH;
if (!bundlePath) {
  throw new Error("PHASE13_ADMIN_ANALYSIS_BUNDLE_PATH is required");
}

const mod = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);
const { handleAdminAnalysis } = mod;

function mkDb(overrides = {}) {
  const queries = [];
  const defaults = {
    ga4Cur: { sessions: 120, add_to_cart: 18, begin_checkout: 10, purchases: 4 },
    ga4Prev: { sessions: 100 },
    ga4Cov: { total_sessions: 120, mapped_sessions: 90 },
    ga4Fresh: { latest_report_date: "2026-10-08", days_since_latest_report: 2, total_rows: 1000 },
    gscCur: { clicks: 60 },
    gscPrev: { clicks: 50 },
    gscCov: { total_clicks: 60, mapped_clicks: 45 },
    gscFresh: { latest_report_date: "2026-10-08", days_since_latest_report: 2, total_rows: 800 },
    etsyCur: { views: 200, orders: 6, mapped_views: 150 },
    etsyPrev: { views: 180 },
    etsyCov: { total_views: 200, mapped_views: 150 },
    etsyFresh: { latest_report_date: "2026-10-08", days_since_latest_report: 1, total_rows: 500 },
    adsCur: { rows_n: 0, cost: 0, conversions: 0, mapped_cost: 0 },
    adsFresh: { latest_report_date: null, days_since_latest_report: null, total_rows: 0 },
    salesCur: { orders: 40, units: 70 },
    salesPrev: { orders: 30, units: 50 },
    salesObserved: { observed_latest_order_day: "2026-10-08", observed_distinct_orders: 70 },
    salesSyncLatest: {
      id: 999,
      source: "notion-mapping-sync",
      scenario: "phase17-scheduled-confirmed-mapping-sync",
      status: "success",
      started_at: "2026-10-08T08:00:00.000Z",
      finished_at: "2026-10-08T08:05:00.000Z",
      records_received: 120,
      records_created: 0,
      records_updated: 0,
      records_unchanged: 120,
      records_rejected: 0,
      error_message: null,
    },
    salesSyncState: {
      name: "notion-mapping-sync",
      cursor: null,
      last_run_at: "2026-10-08T08:05:00.000Z",
      last_success_at: "2026-10-08T08:05:00.000Z",
      last_status: "success",
      last_processed: 120,
      last_synced: 0,
      consecutive_failures: 0,
    },
    salesCoverageWatermark: {
      coverage_through_day: "2026-10-08",
      watermark_source: "mock-sales-coverage-view",
      reliability: "reliable",
    },
    channelRows: [
      { channel_norm: "etsy", orders: 22, units: 38 },
      { channel_norm: "website", orders: 18, units: 32 },
    ],
    orderCov: { mapped_orders: 35, orders: 40 },
    profitCov: {
      gross_covered_revenue: 120000,
      contribution_covered_revenue: 90000,
      total_revenue: 150000,
      full_cost_orders: 30,
      commercial_orders: 40,
      products_with_cost: 28,
      active_products: 32,
      channels_with_fees: 4,
      channels_with_shipping: 4,
    },
  };
  const d = { ...defaults, ...overrides };

  function maybeThrow(sql) {
    if (overrides.missingSources) {
      if (
        sql.includes("ga4_funnel_daily") ||
        sql.includes("gsc_search_daily") ||
        sql.includes("etsy_listing_daily") ||
        sql.includes("google_ads_campaign_daily") ||
        sql.includes("analysis_ga4_freshness") ||
        sql.includes("analysis_gsc_freshness") ||
        sql.includes("analysis_etsy_freshness") ||
        sql.includes("analysis_google_ads_freshness")
      ) {
        throw new Error("no such table: mocked_source");
      }
    }
  }

  function firstResult(sql) {
    maybeThrow(sql);
    if (sql.includes("FROM ga4_funnel_daily") && sql.includes("add_to_cart")) return d.ga4Cur;
    if (sql.includes("FROM ga4_funnel_daily") && sql.includes("SUM(sessions)") && !sql.includes("add_to_cart")) {
      const seen = queries.filter((q) => q.mode === "first" && q.sql.includes("FROM ga4_funnel_daily") && q.sql.includes("SUM(sessions)") && !q.sql.includes("add_to_cart")).length;
      return seen === 1 ? d.ga4Cur : d.ga4Prev;
    }
    if (sql.includes("total_sessions") && sql.includes("mapped_sessions")) return d.ga4Cov;
    if (sql.includes("analysis_ga4_freshness")) return d.ga4Fresh;

    if (sql.includes("FROM gsc_search_daily") && sql.includes("SUM(clicks)") && !sql.includes("mapped_clicks")) {
      const seen = queries.filter((q) => q.mode === "first" && q.sql.includes("FROM gsc_search_daily") && q.sql.includes("SUM(clicks)") && !q.sql.includes("mapped_clicks")).length;
      return seen === 1 ? d.gscCur : d.gscPrev;
    }
    if (sql.includes("total_clicks") && sql.includes("mapped_clicks")) return d.gscCov;
    if (sql.includes("analysis_gsc_freshness")) return d.gscFresh;

    if (sql.includes("FROM etsy_listing_daily") && sql.includes("mapped_views")) return d.etsyCur;
    if (sql.includes("FROM etsy_listing_daily") && sql.includes("SUM(e.views)") && !sql.includes("mapped_views")) {
      const seen = queries.filter((q) => q.mode === "first" && q.sql.includes("FROM etsy_listing_daily") && q.sql.includes("SUM(e.views)") && !q.sql.includes("mapped_views")).length;
      return seen === 1 ? d.etsyCur : d.etsyPrev;
    }
    if (sql.includes("total_views") && sql.includes("mapped_views")) return d.etsyCov;
    if (sql.includes("analysis_etsy_freshness")) return d.etsyFresh;

    if (sql.includes("FROM google_ads_campaign_daily") && sql.includes("mapped_cost")) return d.adsCur;
    if (sql.includes("analysis_google_ads_freshness")) return d.adsFresh;

    if (sql.includes("FROM analysis_active_items") && sql.includes("observed_distinct_orders")) return d.salesObserved;
    if (sql.includes("FROM analysis_active_items") && sql.includes("COUNT(DISTINCT sales_order_id) AS orders") && sql.includes("COALESCE(SUM(quantity), 0) AS units")) {
      const seenMomentum = queries.filter(
        (q) =>
          q.mode === "first" &&
          q.sql.includes("FROM analysis_active_items") &&
          q.sql.includes("COUNT(DISTINCT sales_order_id) AS orders") &&
          q.sql.includes("COALESCE(SUM(quantity), 0) AS units")
      ).length;
      return seenMomentum === 1 ? d.salesCur : d.salesPrev;
    }
    if (sql.includes("FROM analysis_sales_daily")) return d.orderCov;
    if (sql.includes("FROM sync_runs") && sql.includes("source = 'notion-mapping-sync'")) return d.salesSyncLatest;
    if (sql.includes("FROM marketing_sync_state") && sql.includes("notion-mapping-sync")) return d.salesSyncState;
    if (sql.includes("FROM analysis_sales_coverage_watermark")) {
      if (d.salesCoverageWatermark === undefined) throw new Error("no such table: analysis_sales_coverage_watermark");
      return d.salesCoverageWatermark;
    }
    if (sql.includes("analysis_profit_coverage")) return d.profitCov;
    return null;
  }

  function allResult(sql) {
    maybeThrow(sql);
    if (sql.includes("FROM analysis_active_items") && sql.includes("GROUP BY channel_norm")) return d.channelRows;
    return [];
  }

  return {
    queries,
    prepare(sql) {
      return {
        _sql: String(sql),
        _binds: [],
        bind(...args) {
          this._binds = args;
          return this;
        },
        async first() {
          queries.push({ sql: this._sql, binds: this._binds, mode: "first" });
          return firstResult(this._sql);
        },
        async all() {
          queries.push({ sql: this._sql, binds: this._binds, mode: "all" });
          return { results: allResult(this._sql) };
        },
      };
    },
  };
}

function mkEnv(db) {
  return {
    DB: db,
    ADMIN_SECRET: "**************",
    ADMIN_EMAILS: "",
  };
}

async function callGrowthSignals(env, withSecret = true) {
  const headers = withSecret ? { "X-Admin-Secret": "**************" } : {};
  const req = new Request("https://mildmate-new.pages.dev/api/admin/analysis/growth-signals?end=2026-10-08", {
    method: "GET",
    headers,
  });
  return handleAdminAnalysis(req, env);
}

test("growth-signals v1 contract returns all eight envelopes and neutral sparse Google Ads policy", async () => {
  const db = mkDb();
  const env = mkEnv(db);
  const res = await callGrowthSignals(env, true);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.success, true);
  assert.equal(body.growth_signal_contract, "v1");
  assert.equal(body.google_ads_policy.business_signal, "insufficient_or_sparse");
  assert.equal(body.google_ads_policy.scoring_effect, "neutral_in_phase13");

  const s = body.signals || {};
  const keys = [
    "demand",
    "momentum",
    "conversion_availability",
    "channel_context",
    "source_freshness",
    "mapping_coverage",
    "confidence",
    "profitability_guardrail",
  ];
  keys.forEach((k) => assert.ok(s[k], `missing signal envelope: ${k}`));
});

test("growth-signals marks stale source freshness when freshness thresholds are exceeded", async () => {
  const db = mkDb({
    ga4Fresh: { latest_report_date: "2026-09-20", days_since_latest_report: 18, total_rows: 1000 },
  });
  const env = mkEnv(db);
  const res = await callGrowthSignals(env, true);
  const body = await res.json();
  assert.equal(body.signals.source_freshness.status, "stale_source");
});

test("growth-signals marks mapping gap with low mapped coverage", async () => {
  const db = mkDb({
    ga4Cov: { total_sessions: 120, mapped_sessions: 20 },
    gscCov: { total_clicks: 60, mapped_clicks: 10 },
    etsyCov: { total_views: 200, mapped_views: 20 },
  });
  const env = mkEnv(db);
  const res = await callGrowthSignals(env, true);
  const body = await res.json();
  assert.equal(body.signals.mapping_coverage.status, "mapping_gap");
  assert.match(String(body.signals.mapping_coverage.reason), /below target|mapping/i);
});

test("missing sources return insufficient signal semantics instead of fake positive status", async () => {
  const db = mkDb({ missingSources: true, channelRows: [] });
  const env = mkEnv(db);
  const res = await callGrowthSignals(env, true);
  const body = await res.json();
  assert.equal(body.signals.demand.status, "insufficient_signal");
  assert.equal(body.signals.conversion_availability.status, "insufficient_signal");
  assert.equal(body.signals.source_freshness.status, "insufficient_signal");
  assert.match(String(body.signals.demand.reason), /No measurable|no reported data/i);
});

test("growth-signals endpoint enforces authentication", async () => {
  const db = mkDb();
  const env = mkEnv(db);
  const res = await callGrowthSignals(env, false);
  assert.equal(res.status, 401);
});

test("zero Google Ads rows remain insufficient/sparse and neutral without injecting reward or penalty", async () => {
  const envZeroAds = mkEnv(
    mkDb({
      adsCur: { rows_n: 0, cost: 0, conversions: 0, mapped_cost: 0 },
      adsFresh: { latest_report_date: null, days_since_latest_report: null, total_rows: 0 },
    })
  );
  const envWithAds = mkEnv(
    mkDb({
      adsCur: { rows_n: 3, cost: 120, conversions: 2, mapped_cost: 40 },
      adsFresh: { latest_report_date: "2026-10-08", days_since_latest_report: 1, total_rows: 3 },
    })
  );

  const resZero = await callGrowthSignals(envZeroAds, true);
  const bodyZero = await resZero.json();
  const resWith = await callGrowthSignals(envWithAds, true);
  const bodyWith = await resWith.json();

  assert.equal(bodyZero.growth_signal_contract, "v1");
  assert.equal(bodyZero.google_ads_policy.business_signal, "insufficient_or_sparse");
  assert.equal(bodyZero.google_ads_policy.scoring_effect, "neutral_in_phase13");

  assert.equal(bodyZero.signals.demand.status, "sufficient");
  assert.ok(Number(bodyZero.signals.demand.value.ga4_sessions_28d) > 0);
  assert.ok(Number(bodyZero.signals.demand.value.gsc_clicks_28d) > 0);
  assert.ok(Number(bodyZero.signals.demand.value.etsy_views_28d) > 0);

  assert.equal(bodyZero.signals.source_freshness.confidence_impact, bodyWith.signals.source_freshness.confidence_impact);
  assert.equal(bodyZero.signals.confidence.value, bodyWith.signals.confidence.value);
});

test("complete source coverage plus genuine zero orders keeps valid -100 momentum interpretation", async () => {
  const db = mkDb({
    salesCur: { orders: 0, units: 0 },
    salesPrev: { orders: 43, units: 78 },
    orderCov: { mapped_orders: 0, orders: 0 },
    salesCoverageWatermark: {
      coverage_through_day: "2026-10-08",
      watermark_source: "mock-sales-coverage-view",
      reliability: "reliable",
    },
  });
  const res = await callGrowthSignals(mkEnv(db), true);
  const body = await res.json();
  assert.equal(body.signals.momentum.status, "sufficient");
  assert.equal(body.signals.momentum.value.units_growth_pct, -100);
  assert.equal(body.signals.momentum.coverage.mapped_order_pct, null);
  assert.equal(body.signals.momentum.coverage.sales_coverage.state, "verified_current_window");
});

test("zero units in both windows under complete coverage returns insufficient_signal, never -100", async () => {
  const db = mkDb({
    salesCur: { orders: 0, units: 0 },
    salesPrev: { orders: 0, units: 0 },
    orderCov: { mapped_orders: 0, orders: 0 },
    salesCoverageWatermark: {
      coverage_through_day: "2026-10-08",
      watermark_source: "mock-sales-coverage-view",
      reliability: "reliable",
    },
  });
  const res = await callGrowthSignals(mkEnv(db), true);
  const body = await res.json();
  assert.equal(body.signals.momentum.status, "insufficient_signal");
  assert.equal(body.signals.momentum.value.units_growth_pct, null);
  assert.notEqual(body.signals.momentum.value.units_growth_pct, -100);
  assert.equal(body.signals.momentum.coverage.sales_coverage.state, "verified_current_window");
  assert.match(body.signals.momentum.reason, /No unit activity/);
  // Confidence reconciles: 100 + (-20 momentum) + other envelope impacts, clamped 0-100.
  const impacts = Object.values(body.signals)
    .filter((s) => s && typeof s === "object" && "confidence_impact" in s)
    .reduce((sum, s) => sum + s.confidence_impact, 0);
  assert.equal(body.signals.confidence.value, Math.max(0, Math.min(100, 100 + impacts)));
});

test("coverage ending before current window returns stale_source with null momentum growth", async () => {
  const db = mkDb({
    salesCur: { orders: 0, units: 0 },
    salesPrev: { orders: 43, units: 78 },
    salesCoverageWatermark: {
      coverage_through_day: "2026-09-10",
      watermark_source: "mock-sales-coverage-view",
      reliability: "reliable",
    },
  });
  const res = await callGrowthSignals(mkEnv(db), true);
  const body = await res.json();
  assert.equal(body.signals.momentum.status, "stale_source");
  assert.equal(body.signals.momentum.value.units_growth_pct, null);
  assert.equal(body.signals.momentum.coverage.sales_coverage.state, "stale_before_window");
});

test("partial current-window coverage returns stale_source with null momentum growth", async () => {
  const db = mkDb({
    salesCoverageWatermark: {
      coverage_through_day: "2026-09-20",
      watermark_source: "mock-sales-coverage-view",
      reliability: "reliable",
    },
  });
  const res = await callGrowthSignals(mkEnv(db), true);
  const body = await res.json();
  assert.equal(body.signals.momentum.status, "stale_source");
  assert.equal(body.signals.momentum.value.units_growth_pct, null);
  assert.equal(body.signals.momentum.coverage.sales_coverage.state, "partial_current_window");
});

test("missing coverage metadata returns insufficient_signal and null momentum growth", async () => {
  const db = mkDb({
    salesCur: { orders: 0, units: 0 },
    salesPrev: { orders: 43, units: 78 },
    salesCoverageWatermark: undefined,
  });
  const res = await callGrowthSignals(mkEnv(db), true);
  const body = await res.json();
  assert.equal(body.signals.momentum.status, "insufficient_signal");
  assert.equal(body.signals.momentum.value.units_growth_pct, null);
  assert.equal(body.signals.momentum.coverage.sales_coverage.coverage_watermark_reliable, false);
  assert.equal(body.signals.momentum.coverage.sales_coverage.state, "unverified");
});

test("missing watermark stays unverified even when max order day and sync success look healthy", async () => {
  const db = mkDb({
    salesCur: { orders: 0, units: 0 },
    salesPrev: { orders: 43, units: 78 },
    salesObserved: { observed_latest_order_day: "2026-10-08", observed_distinct_orders: 120 },
    salesSyncLatest: {
      id: 1200,
      source: "notion-mapping-sync",
      scenario: "phase17-scheduled-confirmed-mapping-sync",
      status: "success",
      started_at: "2026-10-08T10:00:00.000Z",
      finished_at: "2026-10-08T10:02:00.000Z",
      records_received: 999,
      records_created: 0,
      records_updated: 0,
      records_unchanged: 999,
      records_rejected: 0,
      error_message: null,
    },
    salesCoverageWatermark: undefined,
  });
  const res = await callGrowthSignals(mkEnv(db), true);
  const body = await res.json();
  assert.equal(body.signals.momentum.status, "insufficient_signal");
  assert.equal(body.signals.momentum.value.units_growth_pct, null);
  assert.equal(body.signals.momentum.coverage.sales_coverage.state, "unverified");
});

test("complete current and previous windows produce valid momentum growth", async () => {
  const db = mkDb({
    salesCur: { orders: 60, units: 90 },
    salesPrev: { orders: 30, units: 45 },
  });
  const res = await callGrowthSignals(mkEnv(db), true);
  const body = await res.json();
  assert.equal(body.signals.momentum.status, "sufficient");
  assert.equal(body.signals.momentum.value.units_growth_pct, 100);
});

test("null mapped-order denominator is preserved without fake fallback", async () => {
  const db = mkDb({
    orderCov: { mapped_orders: 0, orders: 0 },
  });
  const res = await callGrowthSignals(mkEnv(db), true);
  const body = await res.json();
  assert.equal(body.signals.momentum.coverage.mapped_order_pct, null);
  assert.equal(body.signals.mapping_coverage.value.order_mapped_pct_28d, null);
});

test("contract v1 remains compatible with momentum coverage metadata", async () => {
  const db = mkDb();
  const res = await callGrowthSignals(mkEnv(db), true);
  const body = await res.json();
  assert.equal(body.growth_signal_contract, "v1");
  assert.ok(body.signals.momentum.coverage.sales_coverage);
  assert.equal(body.signals.momentum.coverage.sales_coverage.source, "notion-mapping-sync");
});

test("data-analyst UI explicitly surfaces momentum coverage state and null-safe rendering", async () => {
  const uiPath = "D:\\00_mildmate\\re-build_web_phase13_closeout\\public\\super-admin\\marketing\\data-analyst\\index.html";
  const html = readFileSync(uiPath, "utf8");
  assert.match(html, /function momentumCoverageBadge\(momentum\)/);
  assert.match(html, /Momentum coverage: unverified/);
  assert.match(html, /if \(v === null \|\| v === undefined\) return '<span class="muted">—<\/span>';/);
});

test("real sqlite-backed D1-like env without watermark view stays HTTP 200 and marks momentum unverified", async () => {
  const sdb = new DatabaseSync(":memory:");
  sdb.exec(`
    CREATE TABLE ga4_funnel_daily (
      report_date TEXT, property_scope TEXT, product_id INTEGER,
      sessions REAL, add_to_cart REAL, begin_checkout REAL, purchases REAL
    );
    CREATE TABLE gsc_search_daily (
      report_date TEXT, product_id INTEGER, clicks REAL
    );
    CREATE TABLE etsy_listing_master (
      listing_id TEXT, product_id INTEGER
    );
    CREATE TABLE etsy_listing_daily (
      report_date TEXT, listing_id TEXT, views REAL, orders REAL
    );
    CREATE TABLE google_ads_campaign_daily (
      report_date TEXT, product_id INTEGER, cost REAL, conversions REAL
    );
    CREATE TABLE analysis_ga4_freshness (
      latest_report_date TEXT, days_since_latest_report INTEGER, total_rows INTEGER
    );
    CREATE TABLE analysis_gsc_freshness (
      latest_report_date TEXT, days_since_latest_report INTEGER, total_rows INTEGER
    );
    CREATE TABLE analysis_etsy_freshness (
      latest_report_date TEXT, days_since_latest_report INTEGER, total_rows INTEGER
    );
    CREATE TABLE analysis_google_ads_freshness (
      latest_report_date TEXT, days_since_latest_report INTEGER, total_rows INTEGER
    );
    CREATE TABLE analysis_active_items (
      sales_order_id INTEGER, order_day TEXT, channel_norm TEXT, quantity REAL
    );
    CREATE TABLE analysis_sales_daily (
      order_day TEXT, channel_norm TEXT, orders REAL, mapped_orders REAL, units REAL
    );
    CREATE TABLE analysis_profit_coverage (
      gross_covered_revenue REAL, contribution_covered_revenue REAL, total_revenue REAL,
      full_cost_orders REAL, commercial_orders REAL, products_with_cost REAL, active_products REAL,
      channels_with_fees REAL, channels_with_shipping REAL
    );
    CREATE TABLE sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT, scenario TEXT, status TEXT, started_at TEXT, finished_at TEXT,
      records_received INTEGER, records_created INTEGER, records_updated INTEGER,
      records_unchanged INTEGER, records_rejected INTEGER, error_message TEXT, created_at TEXT
    );
    CREATE TABLE marketing_sync_state (
      name TEXT PRIMARY KEY, cursor TEXT, last_run_at TEXT, last_success_at TEXT, last_status TEXT,
      last_processed INTEGER, last_synced INTEGER, consecutive_failures INTEGER
    );
  `);

  sdb.exec(`
    INSERT INTO ga4_funnel_daily VALUES ('2026-09-15','website',NULL,120,18,10,4),('2026-08-20','website',NULL,100,0,0,0);
    INSERT INTO gsc_search_daily VALUES ('2026-09-18',NULL,60),('2026-08-22',NULL,50);
    INSERT INTO etsy_listing_master VALUES ('L1',101);
    INSERT INTO etsy_listing_daily VALUES ('2026-09-16','L1',200,6),('2026-08-21','L1',180,0);
    INSERT INTO analysis_ga4_freshness VALUES ('2026-10-08',2,1000);
    INSERT INTO analysis_gsc_freshness VALUES ('2026-10-08',2,800);
    INSERT INTO analysis_etsy_freshness VALUES ('2026-10-08',1,500);
    INSERT INTO analysis_google_ads_freshness VALUES (NULL,NULL,0);
    INSERT INTO analysis_active_items VALUES
      (1,'2026-09-10','shopee',2),(2,'2026-09-09','shopee',3),(3,'2026-08-20','website',45);
    INSERT INTO analysis_sales_daily VALUES
      ('2026-09-10','shopee',1,1,2),('2026-09-09','shopee',1,1,3),('2026-08-20','website',1,1,45);
    INSERT INTO analysis_profit_coverage VALUES (120000,90000,150000,30,40,28,32,4,4);
    INSERT INTO sync_runs (source,scenario,status,started_at,finished_at,records_received,records_created,records_updated,records_unchanged,records_rejected,error_message,created_at)
    VALUES ('notion-mapping-sync','phase17','success','2026-10-01T15:08:33.752Z','2026-10-01T15:08:36.668Z',133,0,0,133,0,NULL,'2026-10-01T15:08:36.668Z');
    INSERT INTO marketing_sync_state VALUES ('notion-mapping-sync',NULL,'2026-10-01T15:08:36.778Z','2026-10-01T15:08:36.778Z','success',133,0,0);
  `);

  const d1Like = {
    prepare(sql) {
      return {
        _sql: String(sql),
        _binds: [],
        bind(...args) {
          this._binds = args;
          return this;
        },
        async first() {
          const stmt = sdb.prepare(this._sql);
          const row = stmt.get(...this._binds);
          return row ?? null;
        },
        async all() {
          const stmt = sdb.prepare(this._sql);
          const rows = stmt.all(...this._binds);
          return { results: rows || [] };
        },
      };
    },
  };

  const env = {
    DB: d1Like,
    ADMIN_SECRET: "**************",
    ADMIN_EMAILS: "",
  };
  const req = new Request("https://mildmate-new.pages.dev/api/admin/analysis/growth-signals?end=2026-10-08", {
    method: "GET",
    headers: { "X-Admin-Secret": "**************" },
  });
  const res = await handleAdminAnalysis(req, env);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.success, true);
  assert.equal(body.growth_signal_contract, "v1");
  assert.equal(body.signals.momentum.status, "insufficient_signal");
  assert.equal(body.signals.momentum.value.units_growth_pct, null);
  assert.equal(body.signals.momentum.coverage.sales_coverage.state, "unverified");
  assert.ok(body.signals.demand);
  assert.ok(body.signals.conversion_availability);
  assert.ok(body.signals.channel_context);
  assert.ok(body.signals.source_freshness);
  assert.ok(body.signals.mapping_coverage);
  assert.ok(body.signals.confidence);
  assert.ok(body.signals.profitability_guardrail);
  assert.equal(body.google_ads_policy.scoring_effect, "neutral_in_phase13");
  assert.equal(typeof body.error_code, "undefined");
  assert.doesNotMatch(JSON.stringify(body), /no such table|SQLITE|analysis_sales_coverage_watermark/i);
});
