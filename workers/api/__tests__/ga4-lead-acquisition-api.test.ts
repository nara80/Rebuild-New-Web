import { describe, expect, it } from "vitest";
import { handleAdminAnalysis } from "../admin-analysis";

function req(path: string, withSecret = true): Request {
  const headers = withSecret ? { "X-Admin-Secret": "test" } : {};
  return new Request(`https://localhost${path}`, { headers });
}

function makeDb() {
  return {
    prepare(sql: string) {
      const s = sql.replace(/\s+/g, " ");
      const state: { args: any[] } = { args: [] };
      return {
        bind(...args: any[]) {
          state.args = args;
          return this;
        },
        async first() {
          if (s.includes("FROM ga4_lead_acquisition_daily g") && s.includes("rows_count")) {
            expect(state.args[0]).toBe("308922589");
            return {
              generate_lead_events: 5,
              quote_request_events: 7,
              generate_lead_users_sum: 4,
              quote_request_users_sum: 0,
              generate_lead_users_available: 1,
              quote_request_users_available: 0,
              rows_count: 9,
            };
          }
          if (s.includes("SELECT * FROM analysis_ga4_lead_freshness")) {
            return {
              latest_report_date: "2026-10-31",
              days_since_latest_report: 1,
              total_rows: 9,
              last_success_sync_at: "2026-11-01T01:03:00.000Z",
              last_sync_at: "2026-11-01T01:03:00.000Z",
              last_sync_status: "success",
              sync_errors_7d: 0,
            };
          }
          if (s.includes("COUNT(*) AS overlap_days")) {
            return { overlap_days: 2, overlap_start: "2026-10-09", overlap_end: "2026-10-10" };
          }
          if (s.includes("GROUP_CONCAT(DISTINCT property_id) AS property_ids")) {
            return { property_ids: "366290587,308922589" };
          }
          if (s.includes("MIN(report_date) AS min_report_date")) {
            return { min_report_date: "2026-10-30", max_report_date: "2026-10-31", rows_n: 9 };
          }
          return null;
        },
        async all() {
          if (s.includes("GROUP BY g.report_date, g.event_name")) {
            return {
              results: [
                { report_date: "2026-10-31", event_name: "generate_lead", event_count: 2, event_users_sum: 2, users_available: 1 },
                { report_date: "2026-10-31", event_name: "quote_request", event_count: 3, event_users_sum: 0, users_available: 0 },
                { report_date: "2026-10-30", event_name: "generate_lead", event_count: 3, event_users_sum: 2, users_available: 1 },
                { report_date: "2026-10-30", event_name: "quote_request", event_count: 4, event_users_sum: 0, users_available: 0 },
              ],
            };
          }
          if (s.includes("GROUP BY g.session_source, g.session_medium, g.event_name")) {
            return {
              results: [
                { session_source: "google", session_medium: "cpc", event_name: "generate_lead", event_count: 2, event_users_sum: 2, users_available: 1 },
                { session_source: "", session_medium: "", event_name: "quote_request", event_count: 2, event_users_sum: 0, users_available: 0 },
              ],
            };
          }
          if (s.includes("GROUP BY g.session_campaign, g.event_name")) {
            return {
              results: [
                { session_campaign: "brand", event_name: "generate_lead", event_count: 2, event_users_sum: 2, users_available: 1 },
                { session_campaign: "", event_name: "quote_request", event_count: 2, event_users_sum: 0, users_available: 0 },
              ],
            };
          }
          return { results: [] };
        },
      };
    },
  };
}

describe("GA4 lead acquisition analysis endpoint", () => {
  it("requires admin auth", async () => {
    const res = await handleAdminAnalysis(req("/api/admin/analysis/ga4-leads", false), { DB: makeDb() } as any);
    expect(res.status).toBe(401);
  });

  it("returns canonical-property scoped lead metrics with explicit unavailable users", async () => {
    const env = { DB: makeDb(), ADMIN_SECRET: "test" };
    const res = await handleAdminAnalysis(req("/api/admin/analysis/ga4-leads?start=2026-10-30&end=2026-10-31"), env as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.available).toBe(true);
    expect(body.property.canonical_property_id).toBe("308922589");
    expect(body.summary.generate_lead_events).toBe(5);
    expect(body.summary.quote_request_events).toBe(7);
    expect(body.summary.generate_lead_users).toBe(4);
    expect(body.summary.quote_request_users).toBeNull();
    expect(body.summary.quote_request_users_available).toBe(false);
    expect(body.top_sources.some((r: any) => r.source_medium === "(unavailable) / (unavailable)")).toBe(true);
    expect(Array.isArray(body.limitations)).toBe(true);
    expect(body.limitations.join(" ")).toMatch(/canonical property/i);
  });
});
