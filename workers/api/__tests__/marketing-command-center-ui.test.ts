import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const commandCenterHtml = fs.readFileSync(
  path.resolve(process.cwd(), "public/super-admin/marketing/index.html"),
  "utf8"
);

const superAdminHtml = fs.readFileSync(
  path.resolve(process.cwd(), "public/super-admin/index.html"),
  "utf8"
);

const dataAnalystHtml = fs.readFileSync(
  path.resolve(process.cwd(), "public/super-admin/marketing/data-analyst/index.html"),
  "utf8"
);

describe("Phase 15 Marketing Command Center UI contract", () => {
  it("renders executive command-center sections under /super-admin/marketing/", () => {
    expect(commandCenterHtml).toContain("Marketing Command Center");
    expect(commandCenterHtml).toContain('/js/clerk.js');
    expect(commandCenterHtml).toContain('/css/main.min.css');
    expect(commandCenterHtml).not.toContain('/css/main.css');
    expect(commandCenterHtml).toContain('id="kpi-grid"');
    expect(commandCenterHtml).toContain('id="opp-overall"');
    expect(commandCenterHtml).toContain('id="opp-channel"');
    expect(commandCenterHtml).toContain('id="risk-list"');
    expect(commandCenterHtml).toContain('id="channel-grid"');
    expect(commandCenterHtml).toContain('id="actions-table"');
  });

  it("wires command-center API dependencies to existing admin-analysis routes", () => {
    const required = [
      "/summary",
      "/opportunity",
      "/growth-signals",
      "/data-quality",
      "/gsc",
      "/ga4",
      "/ga4-leads",
      "/etsy",
      "/google-ads",
      "/profitability",
      "/quotes",
    ];
    for (const route of required) {
      expect(commandCenterHtml).toContain(`apiSafe('${route}`);
    }
  });

  it("includes human review controls for approval, action status, and result-review date", () => {
    expect(commandCenterHtml).toContain("Pending review");
    expect(commandCenterHtml).toContain("Not started");
    expect(commandCenterHtml).toContain("review_date");
    expect(commandCenterHtml).toContain("mm_phase15_command_center_review_v1");
  });

  it("provides direct command-center sign-in wiring", () => {
    expect(commandCenterHtml).toContain("id=\"gate-signin\"");
    expect(commandCenterHtml).toContain("signInWithClerk(window.location.href)");
  });

  it("maps executive KPIs directly from existing Data Analyst source fields", () => {
    expect(commandCenterHtml).toContain("summary.orders");
    expect(commandCenterHtml).toContain("summary.order_revenue");
    expect(commandCenterHtml).toContain("opp && opp.row_counts ? opp.row_counts.scored");
    expect(commandCenterHtml).toContain("q.new_quotes_30d");
    expect(commandCenterHtml).toContain("growth.signals.confidence");
  });

  it("distinguishes unavailable profitability/quotes and opportunity states", () => {
    expect(commandCenterHtml).toContain("opp && opp.available === false");
    expect(commandCenterHtml).toContain("prof && prof.available === false");
    expect(commandCenterHtml).toContain("quotes && quotes.available === false");
  });

  it("adds super-admin marketing navigation link to command center", () => {
    expect(superAdminHtml).toContain("/super-admin/marketing/");
    expect(superAdminHtml).toContain("🧭 Command Center");
  });

  it("supports Data Analyst deep-link tab query parameter", () => {
    expect(dataAnalystHtml).toContain("new URLSearchParams(window.location.search).get('tab')");
  });
});
