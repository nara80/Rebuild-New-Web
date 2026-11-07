// Phase 16 — AI Analyst metrics rendering (UI cleanup, 2026-11-07).
//
// Covers the two display defects corrected in the Command Center AI Analyst
// panel:
//   A. baseline metrics rendered as a raw escaped JSON blob
//   B. a reviewed action without post-action metrics showing `Post: "null"`
//
// The rendering helpers live in the inline script of the static Command Center
// page, so this suite extracts them from the shipped HTML and exercises the
// real functions rather than asserting on substrings alone.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const commandCenterHtml = fs.readFileSync(
  path.resolve(process.cwd(), "public/super-admin/marketing/index.html"),
  "utf8"
);

const METRICS_MAX_FIELDS = 12;

// ── Extract the real functions from the shipped page ────────────────────────

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

function loadPanelHelpers() {
  const begin = commandCenterHtml.indexOf("// ── METRICS_RENDER_BEGIN");
  const renderStart = commandCenterHtml.indexOf("function renderAiActions(");
  if (begin === -1 || renderStart === -1 || renderStart < begin) {
    throw new Error("metrics render block markers not found in the Command Center page");
  }
  // Metrics helpers + aiActionRow (aiActionRow sits between the markers and renderAiActions).
  const metricsAndRow = commandCenterHtml.slice(begin, renderStart);

  const parts = [
    extractFunction(commandCenterHtml, "esc"),
    extractFunction(commandCenterHtml, "lower"),
    extractFunction(commandCenterHtml, "fmtNum"),
    extractFunction(commandCenterHtml, "fmtDate"),
    extractFunction(commandCenterHtml, "fmtMoneyThb"),
    extractFunction(commandCenterHtml, "aiStatusPill"),
    metricsAndRow,
  ];

  const factory = new Function(
    parts.join("\n") +
      "\nreturn { parseMetrics, humanizeKey, fmtMetricScalar, flattenMetrics, metricsBlock, aiActionRow, aiStatusPill };"
  );
  return factory() as {
    parseMetrics: (raw: any) => { ok: boolean; value?: any; malformed?: boolean };
    humanizeKey: (k: any) => string;
    fmtMetricScalar: (v: any) => string;
    flattenMetrics: (v: any, prefix: string, out: any[], depth: number) => void;
    metricsBlock: (label: string, raw: any, emptyText: string, malformedText?: string) => string;
    aiActionRow: (a: any) => string;
    aiStatusPill: (s: any) => string;
  };
}

const panel = loadPanelHelpers();

// ── A. Baseline metrics readability ────────────────────────────────────────

describe("Phase 16 UI — baseline metrics readability", () => {
  const baseline = JSON.stringify({
    snapshot_at: "2026-11-07T02:14:00.000Z",
    recommendation: { product_id: 3, action: "content", confidence: 70 },
    opportunity_at_approval: { score: 82, tier: "HIGH" },
  });

  it("renders structured, humanized field/value rows instead of a raw JSON blob", () => {
    const html = panel.metricsBlock("Baseline metrics", baseline, "No baseline snapshot recorded");
    expect(html).toContain("Baseline metrics");
    expect(html).toContain("Snapshot at");
    expect(html).toContain("2026-11-07T02:14:00.000Z");
    expect(html).toContain("Recommendation · Product id");
    expect(html).toContain("Recommendation · Confidence");
    expect(html).toContain("Opportunity at approval · Score");
    expect(html).toContain("Opportunity at approval · Tier");
    expect(html).toContain("82");
    expect(html).toContain("HIGH");
  });

  it("no longer emits raw JSON braces or escaped JSON quotes", () => {
    const html = panel.metricsBlock("Baseline metrics", baseline, "No baseline snapshot recorded");
    expect(html).not.toContain("{");
    expect(html).not.toContain("}");
    expect(html).not.toContain("&quot;");
    expect(html).not.toContain("\\");
  });

  it("humanizes snake_case, kebab-case and camelCase keys", () => {
    expect(panel.humanizeKey("snapshot_at")).toBe("Snapshot at");
    expect(panel.humanizeKey("opportunity_at_approval")).toBe("Opportunity at approval");
    expect(panel.humanizeKey("sessions-30d")).toBe("Sessions 30d");
    expect(panel.humanizeKey("sessions30d")).toBe("Sessions30d");
    expect(panel.humanizeKey("score")).toBe("Score");
  });

  it("summarizes arrays instead of dumping them", () => {
    const html = panel.metricsBlock("Baseline metrics", JSON.stringify({ channels: ["seo", "etsy", "ga4"] }), "none");
    expect(html).toContain("Channels");
    expect(html).toContain("3 item(s)");
    expect(html).not.toContain("etsy");
  });

  it("caps the number of rendered fields on very large records", () => {
    const big: Record<string, number> = {};
    for (let i = 0; i < 40; i++) big["metric_" + i] = i;
    const html = panel.metricsBlock("Baseline metrics", JSON.stringify(big), "none");
    const labelSpans = html.match(/<span class="muted">/g) || [];
    expect(labelSpans).toHaveLength(METRICS_MAX_FIELDS);
  });
});

// ── B. Missing / malformed metric data ─────────────────────────────────────

describe("Phase 16 UI — missing and malformed metric data", () => {
  it("treats null, undefined, empty string, the literal 'null' and empty objects as absent", () => {
    for (const raw of [null, undefined, "", "   ", "null", "undefined", "{}", "[]"]) {
      expect(panel.parseMetrics(raw).ok).toBe(false);
    }
  });

  it("parses a real record and never mutates the stored value", () => {
    const raw = JSON.stringify({ sessions: 120 });
    const parsed = panel.parseMetrics(raw);
    expect(parsed.ok).toBe(true);
    expect(parsed.value).toEqual({ sessions: 120 });
    expect(raw).toBe(JSON.stringify({ sessions: 120 })); // untouched
  });

  it("handles malformed JSON safely with a distinct, honest message", () => {
    const malformed = panel.parseMetrics("{oops not json");
    expect(malformed.ok).toBe(false);
    expect(malformed.malformed).toBe(true);

    let html = "";
    expect(() => {
      html = panel.metricsBlock("Post-action metrics", "{oops not json", "No post-action metrics recorded", "Post-action record unreadable");
    }).not.toThrow();
    expect(html).toContain("Post-action record unreadable");
    expect(html).not.toContain("No post-action metrics recorded");
  });

  it("falls back to the empty text when a malformed record has no dedicated message", () => {
    const html = panel.metricsBlock("Post-action metrics", "<<broken>>", "No post-action metrics recorded");
    expect(html).toContain("No post-action metrics recorded");
  });

  it("shows the empty text for a missing record", () => {
    const html = panel.metricsBlock("Post-action metrics", null, "No post-action metrics recorded", "Post-action record unreadable");
    expect(html).toContain("Post-action metrics");
    expect(html).toContain("No post-action metrics recorded");
  });
});

// ── HTML escaping (injection safety) ───────────────────────────────────────

describe("Phase 16 UI — HTML escaping of untrusted metric content", () => {
  it("escapes HTML in metric values", () => {
    const raw = JSON.stringify({ note: '<img src=x onerror="alert(1)">', tag: "<script>alert(1)</script>" });
    const html = panel.metricsBlock("Post-action metrics", raw, "none");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onerror=\"alert(1)\"");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in metric field names", () => {
    const raw = JSON.stringify({ "<b>bold</b>": 1 });
    const html = panel.metricsBlock("Post-action metrics", raw, "none");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("escapes HTML in the block label", () => {
    const html = panel.metricsBlock("<script>x</script>", JSON.stringify({ a: 1 }), "none");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes the lessons-learned text on a reviewed row", () => {
    const html = panel.aiActionRow({
      id: 16,
      status: "reviewed",
      source: "human",
      result_class: "positive",
      post_metrics_json: null,
      lessons: '<img src=x onerror="alert(1)">',
      channel: "",
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

// ── B (cont.) Reviewed rows without post-action metrics ────────────────────

describe("Phase 16 UI — reviewed action without post-action metrics", () => {
  // Mirrors the owner-accepted fixture #16 after review: the API stores
  // JSON.stringify(null) === the 4-character string "null".
  const reviewedNoMetrics = {
    id: 16,
    action_date: "2026-11-07",
    source: "human",
    ai_model: "TEST-DEMO-FIXTURE",
    status: "reviewed",
    product_id: 3,
    channel: "",
    action_type: "content",
    title: "[TEST/DEMO] Marine Fitted Sheet content update (owner post-action review test)",
    result_class: "positive",
    post_metrics_json: "null",
    lessons: "Content refresh held engagement steady.",
    approved_budget: 3000,
    confidence: 70,
    review_date: "2026-12-14",
  };

  it("shows the empty state instead of Post: \"null\"", () => {
    const html = panel.aiActionRow(reviewedNoMetrics);
    expect(html).toContain("No post-action metrics recorded");
    expect(html).not.toContain("&quot;null&quot;");
    expect(html).not.toContain("Post: ");
  });

  it("preserves the saved result classification and lessons learned", () => {
    const html = panel.aiActionRow(reviewedNoMetrics);
    expect(html).toContain("positive");
    expect(html).toContain("Content refresh held engagement steady.");
    expect(html).toContain("Lessons learned");
  });

  it("distinguishes a manually selected result from a metrics-backed one", () => {
    const manual = panel.aiActionRow(reviewedNoMetrics);
    expect(manual).toContain("Manually selected result (no metrics recorded)");

    const backed = panel.aiActionRow({
      ...reviewedNoMetrics,
      post_metrics_json: JSON.stringify({ sessions: 120, orders: 2 }),
    });
    expect(backed).toContain("Result backed by recorded metrics");
    expect(backed).toContain("Post-action metrics");
    expect(backed).toContain("Sessions");
    expect(backed).toContain("120");
    expect(backed).not.toContain("No post-action metrics recorded");
  });

  it("does not invent performance numbers when metrics are absent", () => {
    const html = panel.aiActionRow(reviewedNoMetrics);
    // Only the seeded approved budget and confidence are numeric facts.
    expect(html).toContain("฿3,000");
    expect(html).toContain("70");
    expect(html).not.toMatch(/estimated|assumed|approx/i);
  });
});

// ── Approved rows: readable baseline snapshot ──────────────────────────────

describe("Phase 16 UI — approved action baseline snapshot", () => {
  it("renders the approval-time baseline snapshot readably", () => {
    const html = panel.aiActionRow({
      id: 14,
      status: "approved",
      source: "human",
      title: "[TEST/DEMO] Refresh Standard Fitted Sheet product copy",
      product_id: 1,
      channel: "seo",
      confidence: 80,
      approved_budget: null,
      baseline_metrics_json: JSON.stringify({
        snapshot_at: "2026-11-07T09:00:00.000Z",
        recommendation: { confidence: 80 },
        opportunity_at_approval: { score: 82, tier: "HIGH" },
      }),
    });
    expect(html).toContain("Baseline metrics");
    expect(html).toContain("Snapshot at");
    expect(html).toContain("Opportunity at approval · Score");
    expect(html).not.toContain("Baseline: &quot;");
    expect(html).not.toContain("{");
  });

  it("shows an explicit empty state when no baseline snapshot exists", () => {
    const html = panel.aiActionRow({
      id: 99,
      status: "approved",
      source: "human",
      title: "x",
      channel: "",
      baseline_metrics_json: null,
    });
    expect(html).toContain("No baseline snapshot recorded");
  });
});

// ── Source-level regression guards ─────────────────────────────────────────

describe("Phase 16 UI — renderer regression guards", () => {
  it("removes the raw-JSON renderer entirely", () => {
    expect(commandCenterHtml).not.toContain("escJson");
    expect(commandCenterHtml).not.toContain("Post: ");
    expect(commandCenterHtml).not.toContain("Baseline: ");
  });

  it("keeps the metrics render block self-contained and labeled", () => {
    expect(commandCenterHtml).toContain("// ── METRICS_RENDER_BEGIN");
    expect(commandCenterHtml).toContain("// ── METRICS_RENDER_END");
    expect(commandCenterHtml).toContain("No post-action metrics recorded");
    expect(commandCenterHtml).toContain("Manually selected result (no metrics recorded)");
  });

  it("leaves unrelated Command Center components untouched", () => {
    expect(commandCenterHtml).toContain('id="kpi-grid"');
    expect(commandCenterHtml).toContain('id="opp-overall"');
    expect(commandCenterHtml).toContain('id="risk-list"');
    expect(commandCenterHtml).toContain('id="channel-grid"');
    expect(commandCenterHtml).toContain('id="actions-table"');
  });
});
