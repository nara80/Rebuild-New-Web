import { describe, expect, it } from "vitest";
import { groupRecentSyncRunsForDashboard } from "../admin-analysis";

function mkRun(input: Partial<any> & { id: number; started_at: string }) {
  return {
    id: input.id,
    source: input.source || "gsc-worker-cron",
    scenario: input.scenario || "phase09-weekly-gsc-sync:scheduled-weekly",
    started_at: input.started_at,
    finished_at: input.finished_at || input.started_at,
    created_at: input.created_at || input.started_at,
    status: input.status || "success",
    records_received: input.records_received ?? 1,
    records_created: input.records_created ?? 0,
    records_updated: input.records_updated ?? 0,
    records_unchanged: input.records_unchanged ?? 1,
    records_rejected: input.records_rejected ?? 0,
    error_message: input.error_message || "",
  };
}

describe("data quality sync-run grouping", () => {
  it("groups October-like GSC chunk rows into one inferred collector run", () => {
    const base = Date.parse("2026-10-29T01:00:00.000Z");
    const received = [47, 36, 43, 36, 40, 55, 50, 45, 45, 37, 38, 37, 54, 34];
    const created = [0, 0, 0, 0, 0, 0, 0, 45, 45, 37, 38, 37, 54, 34];
    const rows = Array.from({ length: 14 }).map((_, i) =>
      mkRun({
        id: 791 + i,
        started_at: new Date(base + i * 20000).toISOString(),
        finished_at: new Date(base + i * 20000 + 8000).toISOString(),
        records_received: received[i],
        records_created: created[i],
        records_unchanged: received[i] - created[i],
      }),
    );

    const out = groupRecentSyncRunsForDashboard(rows, { maxRows: 250, maxGroups: 40 });
    expect(out.groups.length).toBe(1);
    expect(out.groups[0].inferred_grouping).toBe(true);
    expect(out.groups[0].chunk_count).toBe(14);
    expect(out.groups[0].records_received).toBe(597);
    expect(out.groups[0].records_created).toBe(290);
    expect(out.groups[0].records_unchanged).toBe(307);
    expect(out.groups[0].status).toBe("success");
  });

  it("does not merge separate nearby executions when the gap exceeds the safety threshold", () => {
    const rows = [
      mkRun({ id: 1001, started_at: "2026-10-29T01:05:00.000Z" }),
      mkRun({ id: 1000, started_at: "2026-10-29T01:04:20.000Z" }),
      mkRun({ id: 999, started_at: "2026-10-29T01:03:40.000Z" }),
      mkRun({ id: 998, started_at: "2026-10-29T00:59:00.000Z" }),
      mkRun({ id: 997, started_at: "2026-10-29T00:58:20.000Z" }),
      mkRun({ id: 996, started_at: "2026-10-29T00:57:40.000Z" }),
    ];

    const out = groupRecentSyncRunsForDashboard(rows, { maxRows: 250, maxGroups: 40 });
    expect(out.groups.length).toBe(2);
    expect(out.groups[0].chunk_count).toBe(3);
    expect(out.groups[1].chunk_count).toBe(3);
  });

  it("escalates grouped status when any chunk fails and preserves error context", () => {
    const rows = [
      mkRun({ id: 1201, started_at: "2026-10-29T01:01:00.000Z", records_received: 20 }),
      mkRun({
        id: 1200,
        started_at: "2026-10-29T01:00:40.000Z",
        status: "failed",
        records_received: 20,
        records_rejected: 20,
        error_message: "GSC upsert failed (500)",
      }),
      mkRun({ id: 1199, started_at: "2026-10-29T01:00:20.000Z", records_received: 20 }),
    ];

    const out = groupRecentSyncRunsForDashboard(rows, { maxRows: 250, maxGroups: 40 });
    expect(out.groups.length).toBe(1);
    expect(out.groups[0].status).toBe("failed");
    expect(out.groups[0].records_rejected).toBe(20);
    expect(String(out.groups[0].error_message || "")).toContain("GSC upsert failed");
  });

  it("marks inferred edge groups as incomplete when the fetch window is capped", () => {
    const base = Date.parse("2026-10-29T01:00:00.000Z");
    const rows = Array.from({ length: 10 }).map((_, i) =>
      mkRun({
        id: 1300 + i,
        started_at: new Date(base + i * 20000).toISOString(),
      }),
    );

    const out = groupRecentSyncRunsForDashboard(rows, { maxRows: 10, maxGroups: 40 });
    expect(out.meta.window_truncated).toBe(true);
    expect(out.groups.length).toBe(1);
    expect(out.groups[0].incomplete_window).toBe(true);
    expect(out.meta.notes.some((n) => n.toLowerCase().includes("incomplete"))).toBe(true);
  });

  it("leaves non-GSC sources as single rows (no inferred merge)", () => {
    const rows = [
      mkRun({ id: 1401, source: "ga4-worker-cron:website", scenario: "phase10-weekly-ga4-sync:scheduled-weekly", started_at: "2026-10-26T01:00:00.000Z" }),
      mkRun({ id: 1400, source: "ga4-worker-cron:website", scenario: "phase10-weekly-ga4-sync:scheduled-weekly", started_at: "2026-10-26T01:00:20.000Z" }),
    ];

    const out = groupRecentSyncRunsForDashboard(rows, { maxRows: 250, maxGroups: 40 });
    expect(out.groups.length).toBe(2);
    expect(out.groups[0].chunk_count).toBe(1);
    expect(out.groups[0].inferred_grouping).toBe(false);
    expect(out.groups[1].chunk_count).toBe(1);
  });
});
