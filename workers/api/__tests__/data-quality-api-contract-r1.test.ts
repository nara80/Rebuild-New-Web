import { describe, expect, it, vi } from "vitest";

vi.mock("../clerk-verify", () => ({
  verifyClerkJwt: vi.fn(),
}));

import { handleAdminAnalysis } from "../admin-analysis";

function makeRequest(url: string): Request {
  return new Request(url, { headers: { "X-Admin-Secret": "test" } });
}

function makeDb() {
  return {
    prepare(sql: string) {
      const s = sql.replace(/\s+/g, " ");
      return {
        bind(..._args: any[]) {
          return this;
        },
        async first() {
          if (s.includes("SELECT * FROM analysis_data_quality")) {
            return {
              commercial_orders: 100,
              active_items: 120,
              mapped_orders: 92,
              missing_product_id_items: 5,
              exact_items: 70,
              unallocated_items: 50,
              invalid_product_refs: 0,
              itemless_orders: 0,
              orders_missing_date: 0,
              unknown_status_orders: 0,
              unknown_source_labels: 0,
              sync_errors_7d: 0,
              last_success_sync_at: "2026-10-29T01:05:00.000Z",
              last_sync_status: "success",
            };
          }
          if (s.includes("SELECT COUNT(*) AS n FROM analysis_commercial_orders")) {
            return { n: 0 };
          }
          if (s.includes("SELECT MIN(order_day) AS first_order_day")) {
            return { first_order_day: "2026-01-01", last_order_day: "2026-10-29", total_orders: 100, channels: 4 };
          }
          if (s.includes("SELECT * FROM analysis_gsc_freshness")) {
            return {
              total_rows: 2637,
              latest_report_date: "2026-10-26",
              days_since_latest_report: 3,
              last_success_sync_at: "2026-10-29T01:04:44.516Z",
              last_sync_at: "2026-10-29T01:04:44.516Z",
              last_sync_status: "success",
              sync_errors_7d: 0,
            };
          }
          return null;
        },
        async all() {
          if (s.includes("FROM sync_runs")) {
            const base = Date.parse("2026-10-29T01:00:58.603Z");
            const received = [47, 36, 43, 36, 40, 55, 50, 45, 45, 37, 38, 37, 54, 34];
            const created = [0, 0, 0, 0, 0, 0, 0, 45, 45, 37, 38, 37, 54, 34];
            return {
              results: received.map((n, i) => ({
                id: 791 + i,
                source: "gsc-worker-cron",
                scenario: "phase09-weekly-gsc-sync:scheduled-weekly",
                started_at: new Date(base + i * 20000).toISOString(),
                finished_at: new Date(base + i * 20000 + 8000).toISOString(),
                created_at: new Date(base + i * 20000 + 8000).toISOString(),
                status: "success",
                records_received: n,
                records_created: created[i],
                records_updated: 0,
                records_unchanged: n - created[i],
                records_rejected: 0,
                error_message: "",
              })),
            };
          }
          if (s.includes("FROM analysis_commercial_orders") && s.includes("GROUP BY channel_norm")) {
            return { results: [{ channel_norm: "website", last_order_day: "2026-10-29", orders: 40, days_since_last_order: 0 }] };
          }
          if (s.includes("GROUP BY COALESCE(substr(co.order_day, 1, 4), 'unknown')")) {
            return { results: [{ year: "2026", orders: 100, months_with_orders: 10, channels: 4, first_day: "2026-01-01", last_day: "2026-10-29", mapped_orders: 92 }] };
          }
          if (s.includes("FROM analysis_commercial_orders co") && s.includes("GROUP BY co.channel_norm")) {
            return { results: [{ channel_norm: "website", orders: 100, first_day: "2026-01-01", last_day: "2026-10-29", mapped_orders: 92 }] };
          }
          return { results: [] };
        },
      };
    },
  };
}

describe("data-quality API contract compatibility", () => {
  it("keeps legacy fields and adds grouped sync-run fields", async () => {
    const env = { DB: makeDb(), ADMIN_EMAILS: "admin@example.com" };
    const res = await handleAdminAnalysis(makeRequest("https://localhost/api/admin/analysis/data-quality"), env as any);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    // legacy fields must remain
    expect(body.data_quality).toBeTruthy();
    expect(Array.isArray(body.recent_runs)).toBe(true);
    expect(Array.isArray(body.channel_freshness)).toBe(true);
    expect(body.coverage).toBeTruthy();
    expect(body.thresholds).toBeTruthy();

    // new grouped fields
    expect(Array.isArray(body.recent_run_groups)).toBe(true);
    expect(body.recent_runs_window).toBeTruthy();
    const g = body.recent_run_groups[0];
    expect(g.source).toBe("gsc-worker-cron");
    expect(g.chunk_count).toBe(14);
    expect(g.records_received).toBe(597);
    expect(g.records_created).toBe(290);
    expect(g.records_unchanged).toBe(307);
    expect(g.inferred_grouping).toBe(true);
  });
});
