// Marketing Funnel Model — Command Center rendering tests (P2).
//
// The funnel section is rendered by functions in the inline script of the
// static Command Center page. This suite extracts the real shipped functions
// and exercises them, rather than asserting on substrings alone, so the
// displayed guardrails cannot silently drift from the API contract.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const commandCenterHtml = fs.readFileSync(
  path.resolve(process.cwd(), "public/super-admin/marketing/index.html"),
  "utf8"
);

function extractFunction(src: string, name: string): string {
  const start = src.indexOf("function " + name + "(");
  if (start === -1) throw new Error("function not found in page: " + name);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("unbalanced braces for function: " + name);
}

function loadFunnelHelpers() {
  const parts = [
    extractFunction(commandCenterHtml, "esc"),
    extractFunction(commandCenterHtml, "lower"),
    extractFunction(commandCenterHtml, "fmtNum"),
    extractFunction(commandCenterHtml, "fmtPct"),
    extractFunction(commandCenterHtml, "fmtDate"),
    extractFunction(commandCenterHtml, "fmtMoneyThb"),
    extractFunction(commandCenterHtml, "funnelStatusClass"),
    extractFunction(commandCenterHtml, "funnelPill"),
    extractFunction(commandCenterHtml, "funnelValue"),
    extractFunction(commandCenterHtml, "renderFunnel"),
  ];
  const els: Record<string, any> = {
    "funnel-grid": { innerHTML: "" },
    "funnel-guardrails": { innerHTML: "" },
  };
  const doc = { getElementById: (id: string) => els[id] || null };
  const factory = new Function(
    "document",
    parts.join("\n") +
      "\nreturn { funnelStatusClass, funnelPill, funnelValue, renderFunnel };"
  );
  const api = factory(doc);
  return { ...api, els };
}

const helpers = loadFunnelHelpers();

function sampleFunnel(overrides: any = {}) {
  const stages = [
    { id: "awareness", name: "Awareness", definition: "reach" },
    { id: "engagement", name: "Engagement", definition: "interest" },
    { id: "lead_quote", name: "Lead & Quote", definition: "demand" },
    { id: "conversion", name: "Conversion", definition: "orders" },
    { id: "retention", name: "Retention", definition: "repeat" },
  ];
  const emptyStages = () => ({
    awareness: { status: "UNAVAILABLE", unit: null, metrics: [], limitations: [] },
    engagement: { status: "UNAVAILABLE", unit: null, metrics: [], limitations: [] },
    lead_quote: { status: "UNAVAILABLE", unit: null, metrics: [], limitations: [] },
    conversion: { status: "INSUFFICIENT", unit: "orders / THB", metrics: [], limitations: [] },
    retention: { status: "UNAVAILABLE", unit: null, metrics: [], limitations: ["no customer identity"] },
  });
  return {
    success: true,
    available: true,
    model: "marketing-funnel-v1",
    window: { start: "2026-01-01", end: "2026-11-07", days: 311, timezone: "UTC" },
    stages,
    channels: [
      {
        id: "website",
        label: "Website",
        freshness: { ga4: { status: "ok", days_since_latest_report: 2 } },
        stages: {
          ...emptyStages(),
          awareness: {
            status: "PARTIAL",
            unit: "sessions / impressions",
            metrics: [
              { key: "sessions", label: "Sessions", value: 1000, unit: "sessions", source: "ga4_funnel_daily.sessions", directional: false },
              { key: "users", label: "Users", value: null, unit: "users", source: "ga4_funnel_daily.users", directional: false },
            ],
            limitations: ["all website traffic, not only new users"],
          },
          conversion: {
            status: "AVAILABLE",
            unit: "orders / THB",
            metrics: [
              { key: "website_order_revenue", label: "Order revenue", value: 9000, unit: "THB", source: "analysis_sales_daily.order_revenue", directional: false },
              { key: "ga4_purchases", label: "GA4 purchases (directional)", value: 5, unit: "purchases", source: "ga4_funnel_daily.purchases", directional: true },
            ],
            limitations: [],
          },
        },
      },
      {
        id: "paid_search",
        label: "Paid Search (Google Ads)",
        freshness: { google_ads: { status: "ok", days_since_latest_report: 3 } },
        stages: {
          ...emptyStages(),
          conversion: {
            status: "UNVERIFIED",
            unit: "platform-attributed",
            metrics: [{ key: "conversions", label: "Conversions (unverified)", value: 3, unit: "conversions", source: "google_ads_campaign_daily.conversions", directional: true }],
            limitations: ["Google Ads purchase attribution is UNVERIFIED"],
          },
        },
      },
    ],
    notes: ["Funnel stages are reported per channel and are never chained across channels."],
    schema_unavailable: [],
    guardrails: { cross_channel_rates: false, channels_summed: false },
    ...overrides,
  };
}

describe("funnel render helpers", () => {
  it("maps funnel statuses onto existing pill classes", () => {
    expect(helpers.funnelStatusClass("AVAILABLE")).toBe("ok");
    expect(helpers.funnelStatusClass("PARTIAL")).toBe("warning");
    expect(helpers.funnelStatusClass("UNVERIFIED")).toBe("insufficient");
    expect(helpers.funnelStatusClass("INSUFFICIENT")).toBe("insufficient");
    expect(helpers.funnelStatusClass("UNAVAILABLE")).toBe("unavailable");
  });

  it("renders an explicit Unavailable for null values", () => {
    const html = helpers.funnelValue({ value: null, unit: "users", directional: false });
    expect(html).toContain("Unavailable");
  });

  it("formats THB and percentage units", () => {
    expect(helpers.funnelValue({ value: 9000, unit: "THB" })).toContain("฿");
    expect(helpers.funnelValue({ value: 12.5, unit: "%" })).toContain("12.5%");
  });

  it("marks directional metrics inline", () => {
    const html = helpers.funnelValue({ value: 5, unit: "purchases", directional: true });
    expect(html).toContain("directional");
  });
});

describe("funnel section rendering", () => {
  it("renders every channel with all five stages", () => {
    helpers.renderFunnel({ funnel: sampleFunnel() });
    const grid = helpers.els["funnel-grid"].innerHTML;
    expect(grid).toContain("Website");
    expect(grid).toContain("Paid Search (Google Ads)");
    for (const name of ["Awareness", "Engagement", "Lead &amp; Quote", "Conversion", "Retention"]) {
      expect(grid).toContain(name);
    }
  });

  it("shows Retention as UNAVAILABLE", () => {
    helpers.renderFunnel({ funnel: sampleFunnel() });
    const grid = helpers.els["funnel-grid"].innerHTML;
    expect(grid).toContain("UNAVAILABLE");
    expect(grid).toContain("no customer identity");
  });

  it("shows the Ads conversion stage as UNVERIFIED", () => {
    helpers.renderFunnel({ funnel: sampleFunnel() });
    expect(helpers.els["funnel-grid"].innerHTML).toContain("UNVERIFIED");
  });

  it("advertises the guardrails in the section header", () => {
    helpers.renderFunnel({ funnel: sampleFunnel() });
    const guard = helpers.els["funnel-guardrails"].innerHTML;
    expect(guard).toContain("no cross-channel rates");
    expect(guard).toContain("canonical GA4 property only");
    expect(guard).toContain("Ads attribution unverified");
    expect(guard).toContain("retention unavailable");
    expect(guard).toContain("marketing-funnel-v1");
  });

  it("surfaces notes and schema unavailability", () => {
    helpers.renderFunnel({ funnel: sampleFunnel({ schema_unavailable: ["orders.quote_id"] }) });
    const guard = helpers.els["funnel-guardrails"].innerHTML;
    expect(guard).toContain("never chained across channels");
    expect(guard).toContain("orders.quote_id");
  });

  it("renders an explicit unavailable state when the API is unavailable", () => {
    helpers.renderFunnel({ funnel: { success: true, available: false, message: "schema missing" } });
    expect(helpers.els["funnel-guardrails"].innerHTML).toContain("Funnel unavailable");
    expect(helpers.els["funnel-grid"].innerHTML).toBe("");
  });

  it("escapes untrusted text instead of injecting markup", () => {
    const f = sampleFunnel();
    f.notes = ["<img src=x onerror=alert(1)>"];
    helpers.renderFunnel({ funnel: f });
    const guard = helpers.els["funnel-guardrails"].innerHTML;
    expect(guard).not.toContain("<img src=x");
    expect(guard).toContain("&lt;img");
  });
});

describe("command center wiring regressions", () => {
  it("loads the funnel endpoint in the command center boot sequence", () => {
    expect(commandCenterHtml).toContain("funnel: await apiSafe('/funnel' + qs)");
    expect(commandCenterHtml).toContain("renderFunnel(data)");
    expect(commandCenterHtml).toContain('id="funnel-grid"');
    expect(commandCenterHtml).toContain('id="funnel-guardrails"');
  });

  it("keeps the Phase 16 human approval workflow intact", () => {
    // The funnel work must not disturb the AI Analyst panel or its handlers.
    expect(commandCenterHtml).toContain('id="ai-actions-table"');
    expect(commandCenterHtml).toContain('id="ai-recommend-btn"');
    expect(commandCenterHtml).toContain("renderAiActions");
    expect(commandCenterHtml).toContain("loadAiActions");
    expect(commandCenterHtml).toContain("result_class");
  });

  it("keeps the existing channel summary and KPI sections intact", () => {
    expect(commandCenterHtml).toContain('id="channel-grid"');
    expect(commandCenterHtml).toContain('id="kpi-grid"');
    expect(commandCenterHtml).toContain("renderChannelSummary(data)");
    expect(commandCenterHtml).toContain("renderKpis(data.summary");
  });
});
