// Phase: Marketing Funnel Model — read-only funnel API contract tests.
//
// These tests lock in the owner-approved guardrails for
// GET /api/admin/analysis/funnel:
//   * five stages, reported PER CHANNEL, never chained across channels
//   * no cross-channel conversion rate is ever produced
//   * canonical GA4 property only; the property-scope-only analysis_ga4_*
//     views must never be read (legacy 366290587 must not be merged)
//   * canonical revenue from analysis_sales_daily; GA4 purchases and Etsy
//     revenue are directional and never added to it
//   * Google Ads purchase attribution stays UNVERIFIED
//   * Retention is UNAVAILABLE
//   * UNALLOCATED revenue stays unknown, never zero

import { describe, expect, it, vi } from "vitest";

vi.mock("../clerk-verify", () => ({
  verifyClerkJwt: vi.fn(async () => ({ valid: false })),
}));

import { handleAdminAnalysis } from "../admin-analysis";

type AnyRow = Record<string, any>;

type DbOptions = {
  rows?: Record<string, AnyRow | null>;
  sales?: AnyRow[];
  failOn?: string[];
};

function makeDb(opts: DbOptions = {}) {
  const queries: { sql: string; binds: any[]; key: string }[] = [];
  const rows = opts.rows || {};
  const sales = opts.sales || [];
  const failOn = opts.failOn || [];

  function classify(s: string): string {
    if (s.includes("FROM ga4_funnel_daily")) return "ga4";
    if (s.includes("FROM gsc_search_daily")) return "gsc";
    if (s.includes("FROM ga4_lead_acquisition_daily")) return "leads";
    if (s.includes("FROM etsy_listing_daily")) return "etsy";
    if (s.includes("FROM google_ads_campaign_daily")) return "ads";
    if (s.includes("FROM analysis_sales_daily")) return "sales";
    if (s.includes("FROM custom_quotes q")) return "quote_exact";
    if (s.includes("FROM custom_quotes")) return "quote_base";
    if (s.includes("FROM analysis_ga4_lead_freshness")) return "fresh_leads";
    if (s.includes("FROM analysis_ga4_freshness")) return "fresh_ga4";
    if (s.includes("FROM analysis_gsc_freshness")) return "fresh_gsc";
    if (s.includes("FROM analysis_etsy_freshness")) return "fresh_etsy";
    if (s.includes("FROM analysis_google_ads_freshness")) return "fresh_ads";
    if (s.includes("FROM analysis_data_quality")) return "dq";
    return "unknown";
  }

  return {
    queries,
    prepare(sql: string) {
      const s = sql.replace(/\s+/g, " ");
      const key = classify(s);
      const entry = { sql: s, binds: [] as any[], key };
      queries.push(entry);
      return {
        bind(...args: any[]) {
          entry.binds = args;
          return this;
        },
        async first() {
          if (failOn.includes(key)) throw new Error("no such column: " + key);
          return rows[key] === undefined ? null : rows[key];
        },
        async all() {
          if (failOn.includes(key)) throw new Error("no such column: " + key);
          if (key === "sales") return { results: sales };
          return { results: [] };
        },
      };
    },
  };
}

function req(url: string, withSecret = true): Request {
  return new Request(url, { headers: withSecret ? { "X-Admin-Secret": "test" } : {} });
}

const FUNNEL_URL = "https://localhost/api/admin/analysis/funnel?start=2026-01-01&end=2026-11-07";

function happyRows(): Record<string, AnyRow> {
  return {
    ga4: {
      rows_n: 100,
      sessions: 1000,
      users: 800,
      engaged_sessions: 600,
      product_views: 400,
      add_to_cart: 50,
      begin_checkout: 20,
      purchases: 5,
      purchase_revenue: 5000,
      mapped_sessions: 300,
    },
    gsc: { rows_n: 50, clicks: 120, impressions: 4000, mapped_clicks: 40 },
    leads: {
      rows_n: 10,
      generate_lead_events: 12,
      quote_request_events: 8,
      generate_lead_users: 10,
      quote_request_users: 6,
      generate_lead_user_rows: 5,
      quote_request_user_rows: 4,
    },
    etsy: {
      rows_n: 30,
      listings: 16,
      active_listings: 16,
      visits: 200,
      views: 900,
      favorites: 40,
      orders: 12,
      transactions: 12,
      units_sold: 15,
      revenue: 30000,
      revenue_thb: 30000,
      mapped_views: 500,
    },
    ads: {
      rows_n: 20,
      impressions: 5000,
      clicks: 100,
      cost: 2500,
      conversions: 3,
      conversion_value: 6000,
      mapped_cost: 1000,
    },
    quote_base: { total_quotes: 5, approved_quotes: 4, expiring_7d: 2 },
    quote_exact: { exact_converted_quotes: 1 },
    fresh_ga4: { latest_report_date: "2026-11-05", days_since_latest_report: 2, total_rows: 1522, last_sync_status: "success" },
    fresh_gsc: { latest_report_date: "2026-11-05", days_since_latest_report: 2, total_rows: 2637, last_sync_status: "success" },
    fresh_etsy: { latest_report_date: "2026-11-03", days_since_latest_report: 4, total_rows: 1022, last_sync_status: "success" },
    fresh_ads: { latest_report_date: "2026-11-04", days_since_latest_report: 3, total_rows: 200, last_sync_status: "success" },
    fresh_leads: { latest_report_date: "2026-11-05", days_since_latest_report: 2, total_rows: 40, last_sync_status: "success" },
    dq: { last_success_sync_at: "2026-11-05T01:00:00.000Z", last_sync_status: "success", sync_errors_7d: 0 },
  };
}

const HAPPY_SALES: AnyRow[] = [
  { channel_norm: "website", currency: "THB", orders: 3, order_revenue: 9000, units: 5, mapped_orders: 3, exact_items: 0, unallocated_items: 5 },
  { channel_norm: "etsy", currency: "THB", orders: 2, order_revenue: 4000, units: 3, mapped_orders: 2, exact_items: 1, unallocated_items: 2 },
  { channel_norm: "shopee", currency: "THB", orders: 4, order_revenue: 8000, units: 6, mapped_orders: 4, exact_items: 0, unallocated_items: 6 },
  { channel_norm: "line", currency: "THB", orders: 1, order_revenue: 1000, units: 1, mapped_orders: 1, exact_items: 0, unallocated_items: 1 },
  { channel_norm: "randomshop", currency: "THB", orders: 1, order_revenue: 500, units: 1, mapped_orders: 1, exact_items: 0, unallocated_items: 1 },
];

async function run(url = FUNNEL_URL, dbOpts: DbOptions = { rows: happyRows(), sales: HAPPY_SALES }) {
  const db = makeDb(dbOpts);
  const env = { DB: db, ADMIN_EMAILS: "admin@example.com" };
  const res = await handleAdminAnalysis(req(url), env as any);
  const body = await res.json();
  return { res, body, db };
}

function channelOf(body: any, id: string): any {
  return (body.channels || []).find((c: any) => c.id === id);
}

function metricKeys(stage: any): string[] {
  return (stage && stage.metrics ? stage.metrics : []).map((m: any) => String(m.key));
}

describe("marketing funnel API — structure", () => {
  it("returns the five approved stages in order", async () => {
    const { res, body } = await run();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.model).toBe("marketing-funnel-v1");
    expect(body.stages.map((s: any) => s.id)).toEqual(["awareness", "engagement", "lead_quote", "conversion", "retention"]);
    expect(body.stages.map((s: any) => s.name)).toEqual([
      "Awareness",
      "Engagement",
      "Lead & Quote",
      "Conversion",
      "Retention",
    ]);
  });

  it("reports Website, Etsy, Paid Search and Marketplace separately", async () => {
    const { body } = await run();
    const ids = body.channels.map((c: any) => c.id);
    expect(ids).toContain("website");
    expect(ids).toContain("etsy");
    expect(ids).toContain("paid_search");
    expect(ids).toContain("marketplace");
  });

  it("defaults to a 28-day window when no dates are supplied", async () => {
    const { body } = await run("https://localhost/api/admin/analysis/funnel");
    expect(body.window.days).toBe(28);
    expect(body.window.timezone).toBe("UTC");
    expect(body.filters.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("marketing funnel API — guardrails", () => {
  it("never produces a cross-channel conversion rate", async () => {
    const { body } = await run();
    expect(body.guardrails.cross_channel_rates).toBe(false);
    expect(body.guardrails.channels_summed).toBe(false);
    const serialized = JSON.stringify(body.channels);
    expect(serialized).not.toMatch(/cross_channel/i);
    expect(serialized).not.toMatch(/"funnel_conversion/i);
    expect(serialized).not.toMatch(/"overall_conversion/i);
  });

  it("keeps Retention UNAVAILABLE for every channel", async () => {
    const { body } = await run();
    expect(body.guardrails.retention).toBe("UNAVAILABLE");
    for (const ch of body.channels) {
      expect(ch.stages.retention.status).toBe("UNAVAILABLE");
      expect(ch.stages.retention.metrics).toEqual([]);
    }
  });

  it("keeps Google Ads purchase attribution UNVERIFIED", async () => {
    const { body } = await run();
    const paid = channelOf(body, "paid_search");
    expect(paid.stages.conversion.status).toBe("UNVERIFIED");
    expect(body.guardrails.google_ads_purchase_attribution).toBe("UNVERIFIED");
    const conv = paid.stages.conversion.metrics.find((m: any) => m.key === "conversions");
    expect(conv.directional).toBe(true);
  });

  it("queries the canonical GA4 property and never reads the property-scope-only views", async () => {
    const { db } = await run();
    const ga4Query = db.queries.find((q) => q.key === "ga4");
    expect(ga4Query).toBeTruthy();
    expect(ga4Query!.sql).toContain("property_id = ?1");
    expect(ga4Query!.sql).toContain("property_scope = 'website'");
    expect(ga4Query!.binds[0]).toBe("308922589");

    // I1 guardrail: the analysis_ga4_* views filter property_scope but not
    // property_id, so they could merge legacy property 366290587. Never read them.
    for (const q of db.queries) {
      expect(q.sql).not.toContain("analysis_ga4_daily");
      expect(q.sql).not.toContain("analysis_ga4_page_daily");
      expect(q.sql).not.toContain("analysis_ga4_product_daily");
      expect(q.sql).not.toContain("analysis_ga4_product_28d");
    }
    expect(db.queries.some((q) => q.sql.includes("366290587"))).toBe(false);
  });

  it("keeps GA4 purchases and Etsy revenue directional and out of canonical revenue", async () => {
    const { body } = await run();
    const website = channelOf(body, "website");
    const ga4Purchases = website.stages.conversion.metrics.find((m: any) => m.key === "ga4_purchases");
    expect(ga4Purchases.directional).toBe(true);

    const etsy = channelOf(body, "etsy");
    const etsyRevenue = etsy.stages.conversion.metrics.find((m: any) => m.key === "etsy_revenue_thb");
    expect(etsyRevenue.directional).toBe(true);

    expect(body.guardrails.canonical_revenue_source).toBe("analysis_sales_daily.order_revenue");
    expect(body.guardrails.directional_revenue_sources).toContain("ga4_funnel_daily.purchase_revenue");
    expect(body.guardrails.directional_revenue_sources).toContain("etsy_listing_daily.revenue_thb");
  });

  it("keeps UNALLOCATED revenue unknown rather than zero", async () => {
    const { body } = await run();
    const website = channelOf(body, "website");
    const coverage = website.stages.conversion.metrics.find((m: any) => m.key === "website_exact_revenue_coverage_pct");
    // 0 EXACT items of 5 -> 0% coverage, and the note explains the gap.
    expect(coverage.value).toBe(0);
    expect(coverage.note).toMatch(/UNALLOCATED/i);
    // Order revenue is still reported from the canonical order total.
    const revenue = website.stages.conversion.metrics.find((m: any) => m.key === "website_order_revenue");
    expect(revenue.value).toBe(9000);
  });
});

describe("marketing funnel API — revenue integrity", () => {
  it("counts each canonical sales row exactly once across channel buckets", async () => {
    const { body } = await run();
    const sum = (id: string) => {
      const ch = channelOf(body, id);
      const rev = ch.stages.conversion.metrics.find((m: any) => m.key.endsWith("_order_revenue"));
      return Number(rev.value || 0);
    };
    const totalOrders = (id: string) => {
      const ch = channelOf(body, id);
      const o = ch.stages.conversion.metrics.find((m: any) => m.key.endsWith("_orders"));
      return Number(o.value || 0);
    };

    const expectedOrders = HAPPY_SALES.reduce((s, r) => s + r.orders, 0);
    const expectedRevenue = HAPPY_SALES.reduce((s, r) => s + r.order_revenue, 0);

    const gotOrders = ["website", "etsy", "marketplace", "other"].reduce((s, id) => s + totalOrders(id), 0);
    const gotRevenue = ["website", "etsy", "marketplace", "other"].reduce((s, id) => s + sum(id), 0);

    expect(gotOrders).toBe(expectedOrders);
    expect(gotRevenue).toBe(expectedRevenue);
    expect(gotRevenue).toBe(22500);
  });

  it("routes unrecognised source_system values into an Other bucket instead of dropping them", async () => {    const { body } = await run();
    const other = channelOf(body, "other");
    expect(other).toBeTruthy();
    expect(other.channels_included).toContain("randomshop");
    const orders = other.stages.conversion.metrics.find((m: any) => m.key === "other_orders");
    expect(orders.value).toBe(1);
    expect(body.notes.join(" ")).toMatch(/unrecognised source_system/i);
  });

  it("reports canonical and Etsy-native revenue separately without summing them", async () => {
    const { body } = await run();
    const etsy = channelOf(body, "etsy");
    const canonical = etsy.stages.conversion.metrics.find((m: any) => m.key === "etsy_order_revenue");
    const native = etsy.stages.conversion.metrics.find((m: any) => m.key === "etsy_revenue_thb");

    expect(canonical).toBeTruthy();
    expect(canonical.source).toBe("analysis_sales_daily.order_revenue");
    expect(canonical.value).toBe(4000); // canonical orders for channel=etsy

    expect(native).toBeTruthy();
    expect(native.directional).toBe(true);
    expect(native.value).toBe(30000); // Etsy listing revenue, reported separately
  });

  it("withholds revenue instead of mixing currencies", async () => {
    const sales = [
      { channel_norm: "website", currency: "THB", orders: 1, order_revenue: 1000, units: 1, mapped_orders: 1, exact_items: 1, unallocated_items: 0 },
      { channel_norm: "website", currency: "USD", orders: 1, order_revenue: 50, units: 1, mapped_orders: 1, exact_items: 1, unallocated_items: 0 },
    ];
    const { body } = await run(FUNNEL_URL, { rows: happyRows(), sales });
    const website = channelOf(body, "website");
    const revenue = website.stages.conversion.metrics.find((m: any) => m.key === "website_order_revenue");
    expect(revenue.value).toBe(null);
    expect(revenue.note).toMatch(/Multiple currencies/i);
  });
});

describe("marketing funnel API — availability and authorization", () => {
  it("degrades a single metric when a column is missing instead of failing the response", async () => {
    const { res, body } = await run(FUNNEL_URL, { rows: happyRows(), sales: HAPPY_SALES, failOn: ["quote_exact"] });
    expect(res.status).toBe(200);
    expect(body.schema_unavailable).toContain("orders.quote_id");
    const website = channelOf(body, "website");
    const exact = website.stages.lead_quote.metrics.find((m: any) => m.key === "exact_converted_quotes");
    expect(exact.value).toBe(null);
    expect(exact.note).toMatch(/unavailable/i);
    // The rest of the funnel still resolves.
    expect(body.stages.length).toBe(5);
    expect(channelOf(body, "etsy").stages.awareness.status).not.toBe("UNAVAILABLE");
  });

  it("marks stages INSUFFICIENT when a source has no rows in the window", async () => {
    const rows = happyRows();
    rows.ga4 = { ...rows.ga4, rows_n: 0, sessions: 0, users: 0, engaged_sessions: 0, product_views: 0, add_to_cart: 0, begin_checkout: 0, purchases: 0, purchase_revenue: 0, mapped_sessions: 0 };
    rows.gsc = { ...rows.gsc, rows_n: 0, clicks: 0, impressions: 0, mapped_clicks: 0 };
    const { body } = await run(FUNNEL_URL, { rows, sales: HAPPY_SALES });
    const website = channelOf(body, "website");
    expect(website.stages.awareness.status).toBe("INSUFFICIENT");
  });

  it("requires admin authorization", async () => {
    const db = makeDb({ rows: happyRows(), sales: HAPPY_SALES });
    const env = { DB: db, ADMIN_EMAILS: "admin@example.com" };
    const res = await handleAdminAnalysis(req(FUNNEL_URL, false), env as any);
    expect(res.status).toBe(401);
  });
});

describe("marketing funnel API — metric grounding", () => {
  it("maps each stage to real source columns", async () => {
    const { body } = await run();
    const website = channelOf(body, "website");
    const sources = [
      ...website.stages.awareness.metrics,
      ...website.stages.engagement.metrics,
      ...website.stages.lead_quote.metrics,
      ...website.stages.conversion.metrics,
    ].map((m: any) => m.source);

    expect(sources).toContain("ga4_funnel_daily.sessions");
    expect(sources).toContain("gsc_search_daily.impressions");
    expect(sources).toContain("ga4_lead_acquisition_daily");
    expect(sources).toContain("custom_quotes");
    expect(sources).toContain("orders.quote_id");
    expect(sources).toContain("analysis_sales_daily.order_revenue");
    expect(sources).toContain("analysis_order_mapping");
    expect(sources).toContain("analysis_active_items");
  });

  it("carries unit, grain, coverage and freshness metadata", async () => {
    const { body } = await run();
    const website = channelOf(body, "website");
    const sessions = website.stages.awareness.metrics.find((m: any) => m.key === "sessions");
    expect(sessions.unit).toBe("sessions");
    expect(sessions.grain).toContain("report_date");
    expect(sessions.coverage_pct).toBe(30); // 300 mapped of 1000 sessions

    expect(body.data_confidence.sources.ga4_website.status).toBe("ok");
    expect(body.data_confidence.sources.ga4_website.warning_threshold_days).toBe(3);
    expect(body.data_confidence.sources.etsy.warning_threshold_days).toBe(7);
    expect(body.data_confidence.thresholds_days.gsc).toBe(4);
  });

  it("reports Etsy lead and quote stages as unavailable", async () => {
    const { body } = await run();
    const etsy = channelOf(body, "etsy");
    expect(etsy.stages.lead_quote.status).toBe("UNAVAILABLE");
    const mp = channelOf(body, "marketplace");
    expect(mp.stages.awareness.status).toBe("UNAVAILABLE");
    expect(mp.stages.engagement.status).toBe("UNAVAILABLE");
  });

  it("exposes the marketplace bucket's included channels for auditability", async () => {
    const { body } = await run();
    const mp = channelOf(body, "marketplace");
    expect(mp.channels_included).toContain("shopee");
    expect(mp.channels_included).toContain("lazada");
    expect(mp.channels_included).toContain("tiktok");
    expect(mp.channels_included).toContain("ebay");
  });

  it("keeps lead-stage metric keys stable for the dashboard", async () => {
    const { body } = await run();
    const website = channelOf(body, "website");
    const keys = metricKeys(website.stages.lead_quote);
    expect(keys).toContain("generate_lead_events");
    expect(keys).toContain("quote_request_events");
    expect(keys).toContain("total_quotes");
    expect(keys).toContain("exact_conversion_pct");
  });
});
