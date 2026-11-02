import { describe, expect, it } from "vitest";
import fs from "node:fs";

const html = fs.readFileSync("D:/00_mildmate/re-build_web/public/super-admin/marketing/data-analyst/index.html", "utf8");

describe("Data Analyst dashboard tab contract + GA4 lead card wiring", () => {
  it("preserves the seven-tab contract", () => {
    const tabMatches = [...html.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
    const unique = Array.from(new Set(tabMatches));
    expect(unique).toEqual(["overview", "sales", "seo", "etsy", "google-ads", "growth", "data-quality"]);
  });

  it("adds GA4 Lead Acquisition card under SEO tab", () => {
    expect(html).toContain('id="ga4-lead-card"');
    expect(html).toContain('id="ga4-lead-summary"');
    expect(html).toContain('id="ga4-lead-trend-table"');
    expect(html).toContain('id="ga4-lead-sources-table"');
    expect(html).toContain('id="ga4-lead-campaigns-table"');
    expect(html).toContain('data-tab-group="seo"');
  });

  it("keeps lead tables wrapped for responsive horizontal scrolling", () => {
    const requiredWrappers = [
      "ga4-lead-trend-table",
      "ga4-lead-sources-table",
      "ga4-lead-campaigns-table",
    ];
    for (const id of requiredWrappers) {
      expect(html).toMatch(new RegExp(`<div class="table-wrap"><div id="${id}">`, "i"));
    }
  });
});
