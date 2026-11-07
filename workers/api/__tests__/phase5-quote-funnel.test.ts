// Phase 5 — Custom Quote Funnel Dashboard extension (Milestone 1)
// Focused tests for the additive `phase5` block on GET /api/admin/analysis/quotes.
// Contract: 00_Issue/MildMate_Phase5_Quote_Funnel_Dashboard_Audit_2026-10-30.md
//
// Covers: attribution channel grouping (first-touch vs quote-session kept
// separate), duplicate-customer dedupe, multi-line orders, exact quote→order
// matching, test-quote exclusions (denylist + TEST- prefix), missing
// attribution labelled unavailable (never Direct), currency isolation,
// refunded/cancelled exclusion, PII-free responses, stale Ads cost freshness,
// and zero-denominator Ads N/A. Legacy response fields must stay unchanged.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../clerk-verify", () => ({
  verifyClerkJwt: vi.fn(),
}));

import { handleAdminAnalysis } from "../admin-analysis";

// ── Fake D1 ────────────────────────────────────────────────────────────────

type Row = Record<string, any>;

interface FakeTables {
  custom_quotes: Row[];
  quote_acquisition_attribution: Row[];
  orders: Row[];
  google_ads_campaign_daily: Row[];
  fail_on?: string[]; // SQL fragments that should throw (e.g. missing table)
}

function makeFakeDb(tables: FakeTables) {
  return {
    prepare(sql: string) {
      const s = sql.replace(/\s+/g, " ");
      const thrower = () => {
        if (tables.fail_on && tables.fail_on.some((f) => s.includes(f))) {
          throw new Error("no such table: simulated");
        }
      };
      return {
        bind(..._args: any[]) {
          return this;
        },
        async first(): Promise<Row | null> {
          thrower();
          if (s.includes("FROM custom_quotes q") && s.includes("COUNT(*) AS total_quotes")) {
            // legacy summary — computed over ALL quotes (legacy definition)
            const all = tables.custom_quotes;
            const approved = all.filter((q) => String(q.status).toLowerCase() === "approved").length;
            return {
              total_quotes: all.length,
              new_quotes_7d: 0, new_quotes_30d: 0,
              active_quotes: all.length, approved_quotes: approved,
              approved_unconverted: 0, expiring_7d: 0, expired_quotes: 0,
            };
          }
          if (s.includes("COUNT(DISTINCT q.quote_id) AS exact_converted")) {
            const converted = new Set(
              tables.custom_quotes
                .filter((q) => tables.orders.some((o) => o.quote_id === q.quote_id))
                .map((q) => q.quote_id)
            );
            return { exact_converted: converted.size };
          }
          if (s.includes("COUNT(DISTINCT q.quote_id) AS legacy_email_matched")) {
            return { legacy_email_matched: 0 };
          }
          if (s.includes("MAX(report_date) AS latest_report_date, COUNT(*) AS total_rows")) {
            if (!tables.google_ads_campaign_daily.length) return { latest_report_date: null, total_rows: 0 };
            const dates = tables.google_ads_campaign_daily.map((r) => r.report_date).sort();
            return { latest_report_date: dates[dates.length - 1], total_rows: tables.google_ads_campaign_daily.length };
          }
          return null;
        },
        async all(): Promise<{ results: Row[] }> {
          thrower();
          if (s.includes("q.quote_id,") && s.includes("LOWER(TRIM(COALESCE(q.email, ''))) AS email_key")) {
            return {
              results: tables.custom_quotes.map((q) => ({
                ...q,
                // D1 computes this alias server-side; the fake mirrors it.
                email_key: String(q.email || "").trim().toLowerCase(),
              })),
            };
          }
          if (s.includes("FROM quote_acquisition_attribution a")) {
            return { results: tables.quote_acquisition_attribution.map((r) => ({ ...r })) };
          }
          if (s.includes("FROM orders o") && s.includes("o.quote_id IS NOT NULL")) {
            return { results: tables.orders.map((r) => ({ ...r })) };
          }
          if (s.includes("FROM google_ads_campaign_daily") && s.includes("GROUP BY COALESCE(currency, '')")) {
            const byCur: Record<string, Row> = {};
            for (const r of tables.google_ads_campaign_daily) {
              const cur = r.currency || "";
              byCur[cur] = byCur[cur] || { currency: cur, cost: 0, latest_report_date: null };
              byCur[cur].cost += Number(r.cost || 0);
              if (!byCur[cur].latest_report_date || String(r.report_date) > String(byCur[cur].latest_report_date)) {
                byCur[cur].latest_report_date = r.report_date;
              }
            }
            return { results: Object.values(byCur) };
          }
          if (s.includes("FROM custom_quotes q") && s.includes("GROUP BY q.product_slug")) {
            return { results: [] };
          }
          if (s.includes("FROM custom_quotes q")) {
            return { results: [] }; // at-risk (legacy)
          }
          return { results: [] };
        },
      };
    },
  };
}

function makeEnv(tables: FakeTables) {
  return { DB: makeFakeDb(tables), ADMIN_EMAILS: "admin@example.com" };
}

function makeRequest(url: string): Request {
  // Non-production host + X-Admin-Secret with no configured secret → auth passes.
  return new Request(url, { headers: { "X-Admin-Secret": "test" } });
}

async function getPhase5(env: any, query = ""): Promise<any> {
  const res = await handleAdminAnalysis(makeRequest("https://localhost/api/admin/analysis/quotes" + query), env);
  expect(res.status).toBe(200);
  const body = await res.json();
  return body;
}

// ── Fixture builders ───────────────────────────────────────────────────────

const REAL_QUOTE = {
  quote_id: "QT-261101-001",
  email: "Customer@Example.com ", // case/whitespace dupes the second row
  status: "approved",
  product_slug: "deep-pocket-fitted-sheet",
  fabric: "ecoluxe",
  color: "vanilla-linen",
};

const REAL_QUOTE_2 = {
  quote_id: "QT-261101-002",
  email: "customer@example.com", // duplicate of REAL_QUOTE after LOWER/TRIM
  status: "pending",
  product_slug: "deep-pocket-fitted-sheet",
  fabric: "cloudsoft",
  color: "white",
};

const PAID_CLICK_ATTR = {
  source: "google", medium: "cpc", utm_source: "google", utm_medium: "cpc",
  gclid: "GCLSID-ABC-123", gbraid: null, wbraid: null,
};

const DIRECT_ATTR = {
  source: "(direct)", medium: "(none)", utm_source: "(direct)", utm_medium: "(none)",
  gclid: null, gbraid: null, wbraid: null,
};

/**
 * UTC calendar date N days before today (YYYY-MM-DD).
 *
 * The application computes Ads freshness against the CURRENT date
 * (`days_since_latest_report > 4` → "warning"), so any hard-coded report
 * date makes the fixture go stale as time passes. Keeping the fixture
 * date-relative preserves the test intent (fresh vs stale Ads data) without
 * changing application behaviour.
 */
function utcDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function baseTables(): FakeTables {
  return {
    custom_quotes: [
      { ...REAL_QUOTE, created_at: "2026-11-01 10:00:00" },
      { ...REAL_QUOTE_2, created_at: "2026-11-02 10:00:00" },
    ],
    quote_acquisition_attribution: [
      {
        quote_id: "QT-261101-001",
        first_touch_json: JSON.stringify(PAID_CLICK_ATTR),
        quote_session_json: JSON.stringify(DIRECT_ATTR),
      },
      {
        quote_id: "QT-261101-002",
        first_touch_json: JSON.stringify(DIRECT_ATTR),
        quote_session_json: null, // session JSON missing → unavailable
      },
    ],
    orders: [
      // Multi-line order for QT-261101-001: 2 different products, qty 2 + 1
      { quote_id: "QT-261101-001", stripe_session_id: "cs_paid_1", product_slug: "deep-pocket-fitted-sheet", product_title_en: "Deep Pocket Fitted Sheet", quantity: 2, price_usd: null, price_thb: 2600, currency: "THB", status: "shipped", is_archived: 0, created_at: "2026-11-03 08:00:00" },
      { quote_id: "QT-261101-001", stripe_session_id: "cs_paid_1", product_slug: "pillowcase-envelope", product_title_en: "Envelope Pillowcase", quantity: 1, price_usd: null, price_thb: 900, currency: "THB", status: "shipped", is_archived: 0, created_at: "2026-11-03 08:00:00" },
      // Refunded line on the same quote — must be excluded from revenue
      { quote_id: "QT-261101-001", stripe_session_id: "cs_paid_1", product_slug: "bedbridge-connector", product_title_en: "BedBridge Connector", quantity: 1, price_usd: null, price_thb: 5000, currency: "THB", status: "refunded", is_archived: 0, created_at: "2026-11-03 08:00:00" },
    ],
    google_ads_campaign_daily: [
      // Ads freshness is computed against the CURRENT date by the application
      // (`days_since_latest_report > 4` → "warning"), so the fixture dates are
      // relative to today (UTC) instead of hard-coded — a fixed date turns
      // this fixture stale over time. The application rule is NOT changed.
      { report_date: utcDaysAgo(1), currency: "THB", cost: 120.5 },
      { report_date: utcDaysAgo(0), currency: "THB", cost: 79.5 },
    ],
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Phase 5 — quote funnel extension (phase5 block)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("groups first-touch and quote-session channels separately; paid click evidences Ads attribution", async () => {
    const body = await getPhase5(makeEnv(baseTables()));
    const p5 = body.phase5;
    expect(p5.available).not.toBe(false);

    // first_touch: quote 1 = google/cpc (paid), quote 2 = (direct)/(none)
    const ft = p5.acquisition.first_touch;
    expect(ft.find((r: any) => r.channel === "google/cpc").quotes).toBe(1);
    expect(ft.find((r: any) => r.channel === "(direct)/(none)").quotes).toBe(1);
    expect(ft.find((r: any) => r.channel === "google/cpc").paid_click_quotes).toBe(1);
    expect(ft.find((r: any) => r.channel === "(direct)/(none)").paid_click_quotes).toBe(0);

    // quote_session: quote 1 = (direct)/(none), quote 2 = unavailable
    const qs = p5.acquisition.quote_session;
    expect(qs.find((r: any) => r.channel === "(direct)/(none)").quotes).toBe(1);
    expect(p5.acquisition.unavailable.quote_session_quotes).toBe(1);
    expect(p5.acquisition.unavailable.first_touch_quotes).toBe(0);
    // Direct is never reassigned: (direct)/(none) rows have zero paid-click credit
    expect(qs.find((r: any) => r.channel === "(direct)/(none)").paid_click_quotes).toBe(0);
  });

  it("dedupes repeated customers case/whitespace-insensitively without counting items as customers", async () => {
    const body = await getPhase5(makeEnv(baseTables()));
    const p5 = body.phase5;
    // 2 quotes, same customer after LOWER/TRIM → 1 unique customer
    expect(p5.customers.unique_customers_total).toBe(1);
    // QT-261101-002 has no first-touch JSON → not counted with attribution
    expect(p5.customers.unique_customers_with_attribution).toBe(1);
    // paid customer set also dedupes
    expect(p5.customers.unique_customers_paid).toBe(1);
    // two quotes remain two quotes (items ≠ customers)
    expect(p5.status_funnel.submitted).toBe(2);
  });

  it("reports multi-line orders and exact quote→order matching with quantities", async () => {
    const body = await getPhase5(makeEnv(baseTables()));
    const byQuote = body.phase5.orders.by_quote;
    expect(byQuote.length).toBe(1);
    const row = byQuote[0];
    expect(row.quote_id).toBe("QT-261101-001");
    expect(row.order_count).toBe(1);
    expect(row.order_ids).toEqual(["cs_paid_1"]);
    expect(row.paid).toBe(true);
    expect(row.items.length).toBe(3);
    const sheet = row.items.find((i: any) => i.product_slug === "deep-pocket-fitted-sheet");
    expect(sheet.quantity).toBe(2);
    expect(sheet.unit_price).toBe(2600); // unit amount, not line total
    expect(sheet.line_revenue).toBe(5200); // unit × qty
  });

  it("computes paid revenue per currency excluding refunded/cancelled/unpaid rows and never uses quoted_price", async () => {
    const tables = baseTables();
    tables.custom_quotes[0].quoted_price = 99999;
    // Add a pending (unpaid) order row — excluded from revenue
    tables.orders.push({ quote_id: "QT-261101-002", stripe_session_id: "cs_pending_1", product_slug: "duvet-insert", product_title_en: "Duvet Insert", quantity: 1, price_usd: null, price_thb: 700, currency: "THB", status: "pending", is_archived: 0, created_at: "2026-11-04 08:00:00" });
    // Add a USD order on quote 2 — isolated from THB
    tables.orders.push({ quote_id: "QT-261101-002", stripe_session_id: "cs_usd_1", product_slug: "duvet-insert", product_title_en: "Duvet Insert", quantity: 2, price_usd: 30, price_thb: null, currency: "USD", status: "delivered", is_archived: 0, created_at: "2026-11-04 09:00:00" });

    const body = await getPhase5(makeEnv(tables));
    const rev = body.phase5.revenue;
    expect(rev.thb.line_revenue).toBe(5200 + 900); // refunded 5000 row excluded
    expect(rev.thb.orders).toBe(1);
    expect(rev.thb.items).toBe(2);
    expect(rev.usd.line_revenue).toBe(60); // 30 × 2, separate currency
    expect(rev.usd.orders).toBe(1);
    expect(rev.excluded_non_paid_rows).toBe(2); // refunded + pending
    expect(rev.basis).toContain("unit price × quantity");
    expect(rev.basis).toContain("quoted_price is never used");
    // JSON serialization: no raw quoted_price anywhere in the revenue block
    expect(JSON.stringify(rev)).not.toContain("99999");
  });

  it("excludes denylist and TEST- prefix quotes from phase5 metrics while legacy summary keeps its definition", async () => {
    const tables = baseTables();
    tables.custom_quotes.push(
      { quote_id: "QT-261030-001", email: "test001@test.com", status: "approved", product_slug: "x", fabric: null, color: null, created_at: "2026-10-30 06:28:06" },
      { quote_id: "QT-261030-002", email: "test002@test.com", status: "pending", product_slug: "x", fabric: null, color: null, created_at: "2026-10-30 09:08:44" },
      { quote_id: "TEST-MAKE-001", email: "make@test.com", status: "approved", product_slug: "x", fabric: null, color: null, created_at: "2026-11-05 08:00:00" },
    );
    tables.orders.push({ quote_id: "TEST-MAKE-001", stripe_session_id: "cs_test_1", product_slug: "x", product_title_en: "X", quantity: 1, price_usd: null, price_thb: 10000, currency: "THB", status: "confirmed", is_archived: 0, created_at: "2026-11-05 09:00:00" });

    const body = await getPhase5(makeEnv(tables));
    const p5 = body.phase5;
    // phase5: only the 2 real quotes
    expect(p5.status_funnel.submitted).toBe(2);
    expect(p5.status_funnel.paid).toBe(1);
    // test order revenue (10000) must not appear in phase5 revenue
    expect(p5.revenue.thb.line_revenue).toBe(5200 + 900);
    // legacy summary keeps its original definition (all 5 quotes)
    expect(body.summary.total_quotes).toBe(5);
    expect(body.summary.approved_quotes).toBe(3);
  });

  it("labels pre-coverage quotes without attribution as unavailable, never Direct", async () => {
    const tables = baseTables();
    tables.custom_quotes.push(
      { quote_id: "QT-261015-009", email: "pre-deploy@example.com", status: "approved", product_slug: "x", fabric: null, color: null, created_at: "2026-10-15 08:00:00" },
    );
    // no attribution row for QT-261015-009

    const body = await getPhase5(makeEnv(tables));
    const p5 = body.phase5;
    expect(p5.status_funnel.submitted).toBe(3);
    expect(p5.acquisition.unavailable.first_touch_quotes).toBe(1);
    // The unavailable quote contributes to no channel bucket
    const ftDirect = p5.acquisition.first_touch.find((r: any) => r.channel === "(direct)/(none)");
    expect(ftDirect.quotes).toBe(1); // only QT-261101-002
    expect(p5.coverage_start).toBe("2026-10-30");
    expect(p5.acquisition.unavailable.note).toContain("never as Direct");
  });

  it("handles consent-related attribution gaps (consent denied → no row) as unavailable", async () => {
    const tables = baseTables();
    // Quote 2 withdraws consent → row exists but JSON bodies are null
    tables.quote_acquisition_attribution[1].first_touch_json = null;
    tables.quote_acquisition_attribution[1].quote_session_json = null;

    const body = await getPhase5(makeEnv(tables));
    expect(body.phase5.acquisition.unavailable.first_touch_quotes).toBe(1);
    expect(body.phase5.acquisition.unavailable.quote_session_quotes).toBe(1);
  });

  it("returns Ads N/A at zero denominator and does not fabricate cost-per-quote", async () => {
    const tables = baseTables();
    // No paid click ids anywhere in attribution
    tables.quote_acquisition_attribution = tables.quote_acquisition_attribution.map((r) => ({
      ...r,
      first_touch_json: r.first_touch_json
        ? JSON.stringify({ ...DIRECT_ATTR })
        : null,
      quote_session_json: r.quote_session_json ? JSON.stringify({ ...DIRECT_ATTR }) : null,
    }));
    const body = await getPhase5(makeEnv(tables));
    const ads = body.phase5.google_ads;
    expect(ads.ads_attributable_quotes).toBe(0);
    expect(ads.cost_per_attributable_quote).toBeNull();
    expect(ads.na_reason).toContain("no Ads-attributable quotes");
    // Cost data still reported with explicit scope + freshness
    expect(ads.cost.length).toBe(1);
    expect(ads.cost[0].currency).toBe("THB");
    expect(ads.cost[0].cost).toBe(200);
    expect(ads.freshness.status).toBe("ok");
  });

  it("computes cost-per-quote only from the Ads-attributable denominator and exposes stale freshness", async () => {
    const tables = baseTables();
    tables.google_ads_campaign_daily = [
      { report_date: utcDaysAgo(30), currency: "THB", cost: 400 },
    ];
    const body = await getPhase5(makeEnv(tables));
    const ads = body.phase5.google_ads;
    expect(ads.ads_attributable_quotes).toBe(1); // quote 1 first-touch gclid
    expect(ads.cost_per_attributable_quote).toEqual([{ currency: "THB", cost_per_attributable_quote: 400 }]);
    expect(ads.freshness.days_since_latest_report).toBeGreaterThan(4);
    expect(ads.freshness.status).toBe("warning");
  });

  it("never leaks PII in phase5 blocks (emails, names, click ids, addresses)", async () => {
    const tables = baseTables();
    tables.orders.push({ quote_id: "QT-261101-001", stripe_session_id: "cs_pii", product_slug: "x", product_title_en: "X", quantity: 1, price_usd: 10, price_thb: null, currency: "USD", status: "confirmed", is_archived: 0, created_at: "2026-11-06 08:00:00" });
    const body = await getPhase5(makeEnv(tables));
    const serialized = JSON.stringify(body.phase5);
    expect(serialized).not.toContain("customer@example.com");
    expect(serialized).not.toContain("GCLSID-ABC-123");
    expect(serialized).not.toContain("email");
    // order ids are Stripe session ids (operational identifiers), quote ids are internal — both allowed
  });

  it("keeps every legacy response field present and unchanged in shape", async () => {
    const body = await getPhase5(makeEnv(baseTables()));
    expect(body.success).toBe(true);
    for (const key of ["filters", "summary", "conversion", "top_products", "at_risk"]) {
      expect(body[key]).toBeDefined();
    }
    expect(body.summary).toHaveProperty("total_quotes");
    expect(body.summary).toHaveProperty("approved_unconverted");
    expect(body.conversion).toHaveProperty("exact_converted_quotes");
    expect(body.conversion).toHaveProperty("legacy_email_matched_quotes");
    expect(Array.isArray(body.top_products)).toBe(true);
    expect(Array.isArray(body.at_risk)).toBe(true);
  });

  it("degrades gracefully (legacy response intact) when the attribution table is missing", async () => {
    const tables = baseTables();
    tables.fail_on = ["quote_acquisition_attribution"];
    const body = await getPhase5(makeEnv(tables));
    expect(body.success).toBe(true);
    expect(body.summary).toBeDefined();
    expect(body.phase5.available).toBe(false);
    expect(body.phase5.error_code).toBe("PHASE5_FUNNEL_UNAVAILABLE");
  });

  it("handles zero Ads cost data (empty table) as empty freshness, not zero-cost fabrication", async () => {
    const tables = baseTables();
    tables.google_ads_campaign_daily = [];
    const body = await getPhase5(makeEnv(tables));
    const ads = body.phase5.google_ads;
    expect(ads.cost).toEqual([]);
    expect(ads.cost_per_attributable_quote).toBeNull();
    expect(ads.freshness.status).toBe("empty");
    expect(ads.freshness.latest_report_date).toBeNull();
  });
});
