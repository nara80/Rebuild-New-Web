// MildMate Admin API — Marketing Analysis (read-only)
// Phase 04 of the Marketing Decision System.
//
// GET /api/admin/analysis/summary       ?start&end&channel
// GET /api/admin/analysis/sales         ?start&end&channel&product_id&status&revenue_status&limit&offset
// GET /api/admin/analysis/products      ?start&end&channel
// GET /api/admin/analysis/product/:id
// GET /api/admin/analysis/channels      ?start&end
// GET /api/admin/analysis/data-quality
// GET /api/admin/analysis/gsc           ?start&end&product_id
// GET /api/admin/analysis/ga4           ?start&end&product_id
// GET /api/admin/analysis/ga4-leads     ?start&end
// GET /api/admin/analysis/order-acquisition ?start&end
//   └ paid-order first-touch attribution from checkout_session_snapshots
//     (PII-free channel aggregates; Unavailable ≠ Direct; test sessions out)
// GET /api/admin/analysis/etsy          ?start&end&product_id
// GET /api/admin/analysis/google-ads    ?start&end&product_id
// GET /api/admin/analysis/quotes        ?start&end
//   └ Phase 5 additive block `phase5`: acquisition channels (first-touch +
//     quote-session, separate), unique customers (PII-free aggregates),
//     quote→order detail (exact quote_id), paid product revenue (unit×qty,
//     per currency, ex-shipping), Google Ads cost/efficiency (paid-click-id
//     attribution only; N/A at zero denominator). Test quotes excluded.
// GET /api/admin/analysis/growth-signals?start&end&channel&product_id
// GET /api/admin/analysis/profitability ?start&end&channel
// GET /api/admin/analysis/funnel        ?start&end
//   └ Owner-approved five-stage Marketing Funnel Model (Awareness,
//     Engagement, Lead & Quote, Conversion, Retention) reported PER CHANNEL.
//     No cross-channel rate is ever produced; GA4 canonical property only;
//     GA4 purchases / Etsy revenue are directional and never added to
//     canonical order revenue; Ads purchase attribution stays UNVERIFIED;
//     Retention is UNAVAILABLE (no customer identity on sales_orders).
// GET  /api/admin/analysis/opportunity            — Phase 14 latest score snapshot (read-only)
// POST /api/admin/analysis/opportunity/recompute  — Phase 14 recompute (dashboard button; cron uses the same core)
//
// Reads analysis_* views (plus selected supporting tables/products for titles).
// Metric semantics: 01_MildMate_Marketing/02_Metric_Dictionary/Phase_02_Metric_Contract_2026-09-07.md
// No PII: the unified sales tables carry no customer fields.

import { verifyClerkJwt } from "./clerk-verify";
import { getOpportunity, recomputeOpportunityHandler } from "./admin-opportunity";

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function err(code: string, message: string, status = 400): Response {
  return json({ success: false, error_code: code, message }, status);
}

function isSchemaMissingError(message: string): boolean {
  const msg = String(message || "").toLowerCase();
  return msg.includes("no such table") || msg.includes("no such view") || msg.includes("no such column");
}

// ── Auth (same pattern as admin-stats.ts) ─────────────────────────────────

function isProductionHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}

function collectRoles(raw: any): string[] {
  if (!raw || typeof raw !== "object") return [];
  const values: any[] = [];
  const add = (v: any) => { if (v !== undefined && v !== null) values.push(v); };
  add((raw as any).role);
  add((raw as any).roles);
  add((raw as any).org_role);
  add((raw as any).orgRole);
  add((raw as any).public_metadata?.role);
  add((raw as any).public_metadata?.roles);
  add((raw as any).unsafe_metadata?.role);
  add((raw as any).unsafe_metadata?.roles);
  add((raw as any).metadata?.role);
  add((raw as any).metadata?.roles);
  add((raw as any)["https://mildmate.com/role"]);
  add((raw as any)["https://mildmate.com/roles"]);
  const out: string[] = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}

function hasAdminRole(rawClaims: any): boolean {
  const roles = collectRoles(rawClaims);
  return roles.some((r) =>
    r === "admin" ||
    r === "super-admin" ||
    r === "super_admin" ||
    r === "superadmin" ||
    r.endsWith(":admin") ||
    r.endsWith("/admin")
  );
}

function emailAllowed(email: string, env: any): boolean {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

async function authorizeAdmin(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");

  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (!verified.valid) {
      // continue to secret fallback
    } else {
      const raw = (verified.payload as any).raw || {};
      if (hasAdminRole(raw) || emailAllowed((verified.payload as any).email || "", env)) {
        return { ok: true };
      }
      const sub = (verified.payload as any).sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey },
          });
          if (clerkResp.ok) {
            const user: any = await clerkResp.json();
            const email = user.email_addresses?.find(function (e: any) { return e.id === user.primary_email_address_id; })?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed(email, env)) return { ok: true };
            if (hasAdminRole(metadata)) return { ok: true };
          }
        } catch (e: any) {
          console.error("Clerk API lookup failed:", e?.message || e);
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
  }

  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }

  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

// ── Parameter validation ──────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CHANNEL_RE = /^[a-z0-9-]{1,30}$/;
const COMMERCIAL_STATUSES = new Set(["paid", "processing", "shipped", "completed"]);
const REVENUE_STATUSES = new Set(["EXACT", "UNALLOCATED"]);
const MAPPING_STATUSES = new Set(["Mapped", "Partial", "Unmapped", "Itemless"]);
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const GA4_WEBSITE_CANONICAL_PROPERTY_ID = "308922589";
const GA4_LEAD_CANONICAL_PROPERTY_ID = "308922589";

type Filters = {
  start: string | null;
  end: string | null;
  channel: string | null;
  productId: number | null;
  status: string | null;
  revenueStatus: string | null;
  mapping: string | null;
  limit: number;
  offset: number;
};

type SyncRunRow = {
  id: number | null;
  source: string;
  scenario: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  status: string | null;
  records_received: number;
  records_created: number;
  records_updated: number;
  records_unchanged: number;
  records_rejected: number;
  error_message: string | null;
};

type SyncRunGroupChunk = SyncRunRow;

type SyncRunGroup = {
  group_id: string;
  source: string;
  scenario: string | null;
  started_at: string | null;
  finished_at: string | null;
  status: string;
  chunk_count: number;
  records_received: number;
  records_created: number;
  records_updated: number;
  records_unchanged: number;
  records_rejected: number;
  error_message: string | null;
  inferred_grouping: boolean;
  grouping_rule: string;
  incomplete_window: boolean;
  chunks: SyncRunGroupChunk[];
};

type SyncRunGroupingMeta = {
  rows_fetched: number;
  rows_scanned_limit: number;
  window_truncated: boolean;
  groups_total: number;
  groups_returned: number;
  inferred_groups: number;
  notes: string[];
};

type SyncRunGroupingResult = {
  groups: SyncRunGroup[];
  meta: SyncRunGroupingMeta;
};

const SYNC_RUN_GROUP_WINDOW_MAX_ROWS = 250;
const SYNC_RUN_GROUP_MAX_GROUPS = 40;
const SYNC_RUN_GROUP_GAP_MS = 90 * 1000; // conservative: contiguous chunks should be near-immediate
const SYNC_RUN_GROUP_MAX_SPAN_MS = 20 * 60 * 1000; // hard cap to avoid merging unrelated passes

function parseIsoishMs(raw: any): number | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const direct = new Date(s);
  if (!isNaN(direct.getTime())) return direct.getTime();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    const d = new Date(s.replace(" ", "T") + "Z");
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return null;
}

function toSyncRunRow(raw: any): SyncRunRow {
  return {
    id: raw?.id === null || raw?.id === undefined ? null : Number(raw.id),
    source: String(raw?.source || "").trim(),
    scenario: raw?.scenario === null || raw?.scenario === undefined || String(raw.scenario).trim() === ""
      ? null
      : String(raw.scenario).trim(),
    started_at: raw?.started_at ? String(raw.started_at) : null,
    finished_at: raw?.finished_at ? String(raw.finished_at) : null,
    created_at: raw?.created_at ? String(raw.created_at) : null,
    status: raw?.status ? String(raw.status) : null,
    records_received: Number(raw?.records_received || 0),
    records_created: Number(raw?.records_created || 0),
    records_updated: Number(raw?.records_updated || 0),
    records_unchanged: Number(raw?.records_unchanged || 0),
    records_rejected: Number(raw?.records_rejected || 0),
    error_message: raw?.error_message ? String(raw.error_message) : null,
  };
}

function shouldInferChunkGrouping(run: SyncRunRow): boolean {
  if (run.source !== "gsc-worker-cron") return false;
  return /^phase09-weekly-gsc-sync:/.test(String(run.scenario || ""));
}

function summarizeGroupStatus(chunks: SyncRunGroupChunk[]): string {
  const statuses = chunks.map((c) => String(c.status || "").toLowerCase());
  if (statuses.some((s) => s === "failed" || s === "error")) return "failed";
  if (statuses.some((s) => s === "partial")) return "partial";
  if (statuses.every((s) => s === "success")) return "success";
  if (statuses.every((s) => s === statuses[0])) return statuses[0] || "unknown";
  return "mixed";
}

function finalizeRunGroup(
  chunksDescByTime: Array<SyncRunGroupChunk & { __started_ms: number | null; __finished_ms: number | null; __sort_ms: number | null }>,
  inferred: boolean,
  oldestWindowSortMs: number | null,
  windowTruncated: boolean,
): SyncRunGroup {
  const chunksAscByStart = chunksDescByTime
    .slice()
    .sort((a, b) => {
      const am = a.__started_ms ?? a.__sort_ms ?? 0;
      const bm = b.__started_ms ?? b.__sort_ms ?? 0;
      return am - bm;
    })
    .map((c) => ({
      id: c.id,
      source: c.source,
      scenario: c.scenario,
      started_at: c.started_at,
      finished_at: c.finished_at,
      created_at: c.created_at,
      status: c.status,
      records_received: c.records_received,
      records_created: c.records_created,
      records_updated: c.records_updated,
      records_unchanged: c.records_unchanged,
      records_rejected: c.records_rejected,
      error_message: c.error_message,
    }));

  const startedMs = chunksDescByTime
    .map((c) => c.__started_ms)
    .filter((v): v is number => v !== null);
  const finishedMs = chunksDescByTime
    .map((c) => c.__finished_ms)
    .filter((v): v is number => v !== null);
  const sortMs = chunksDescByTime
    .map((c) => c.__sort_ms)
    .filter((v): v is number => v !== null);

  const startAt = startedMs.length
    ? new Date(Math.min(...startedMs)).toISOString()
    : (chunksAscByStart[0]?.started_at || null);
  const endAt = finishedMs.length
    ? new Date(Math.max(...finishedMs)).toISOString()
    : (chunksAscByStart[chunksAscByStart.length - 1]?.finished_at || null);

  const totals = chunksAscByStart.reduce(
    (acc, c) => {
      acc.received += Number(c.records_received || 0);
      acc.created += Number(c.records_created || 0);
      acc.updated += Number(c.records_updated || 0);
      acc.unchanged += Number(c.records_unchanged || 0);
      acc.rejected += Number(c.records_rejected || 0);
      if (c.error_message) acc.errors.push(c.error_message);
      return acc;
    },
    { received: 0, created: 0, updated: 0, unchanged: 0, rejected: 0, errors: [] as string[] },
  );

  const groupSortOldest = sortMs.length ? Math.min(...sortMs) : null;
  const touchesOldestWindowRow = oldestWindowSortMs !== null && groupSortOldest !== null && groupSortOldest === oldestWindowSortMs;
  const incompleteWindow = Boolean(inferred && windowTruncated && touchesOldestWindowRow);

  const firstId = chunksAscByStart[0]?.id ?? "x";
  const lastId = chunksAscByStart[chunksAscByStart.length - 1]?.id ?? "x";

  return {
    group_id: `syncgrp-${String(chunksAscByStart[0]?.source || "unknown")}-${String(firstId)}-${String(lastId)}`,
    source: chunksAscByStart[0]?.source || "",
    scenario: chunksAscByStart[0]?.scenario || null,
    started_at: startAt,
    finished_at: endAt,
    status: summarizeGroupStatus(chunksAscByStart),
    chunk_count: chunksAscByStart.length,
    records_received: totals.received,
    records_created: totals.created,
    records_updated: totals.updated,
    records_unchanged: totals.unchanged,
    records_rejected: totals.rejected,
    error_message: totals.errors.length ? totals.errors.slice(0, 3).join(" | ") : null,
    inferred_grouping: inferred,
    grouping_rule: inferred ? "inferred_contiguous_chunks_v1" : "single_row",
    incomplete_window: incompleteWindow,
    chunks: chunksAscByStart,
  };
}

export function groupRecentSyncRunsForDashboard(rows: any[], opts?: { maxRows?: number; maxGroups?: number }): SyncRunGroupingResult {
  const maxRows = Math.max(10, Number(opts?.maxRows || SYNC_RUN_GROUP_WINDOW_MAX_ROWS));
  const maxGroups = Math.max(5, Number(opts?.maxGroups || SYNC_RUN_GROUP_MAX_GROUPS));

  const normalized = (Array.isArray(rows) ? rows : [])
    .map(toSyncRunRow)
    .map((r) => {
      const startedMs = parseIsoishMs(r.started_at);
      const finishedMs = parseIsoishMs(r.finished_at);
      const createdMs = parseIsoishMs(r.created_at);
      const sortMs = finishedMs ?? startedMs ?? createdMs;
      return { ...r, __started_ms: startedMs, __finished_ms: finishedMs, __sort_ms: sortMs };
    })
    .sort((a, b) => {
      const am = a.__sort_ms ?? 0;
      const bm = b.__sort_ms ?? 0;
      if (bm !== am) return bm - am;
      return Number(b.id || 0) - Number(a.id || 0);
    });

  const windowTruncated = normalized.length >= maxRows;
  const oldestWindowSortMs = normalized.length ? (normalized[normalized.length - 1].__sort_ms ?? null) : null;

  const groupsRaw: SyncRunGroup[] = [];
  let currentChunks: Array<SyncRunGroupChunk & { __started_ms: number | null; __finished_ms: number | null; __sort_ms: number | null }> = [];
  let currentInfer = false;

  const flush = () => {
    if (!currentChunks.length) return;
    groupsRaw.push(finalizeRunGroup(currentChunks, currentInfer, oldestWindowSortMs, windowTruncated));
    currentChunks = [];
    currentInfer = false;
  };

  normalized.forEach((run) => {
    const infer = shouldInferChunkGrouping(run);
    if (!currentChunks.length) {
      currentChunks.push(run);
      currentInfer = infer;
      return;
    }

    const prev = currentChunks[currentChunks.length - 1];
    if (!currentInfer || !infer) {
      flush();
      currentChunks.push(run);
      currentInfer = infer;
      return;
    }

    const sameSourceScenario = run.source === prev.source && (run.scenario || null) === (prev.scenario || null);
    const prevStart = prev.__started_ms;
    const runStart = run.__started_ms;
    const gapMs = prevStart !== null && runStart !== null ? prevStart - runStart : Number.POSITIVE_INFINITY;
    const groupNewestStart = currentChunks[0].__started_ms;
    const spanMs =
      groupNewestStart !== null && runStart !== null ? groupNewestStart - runStart : Number.POSITIVE_INFINITY;

    const contiguous = sameSourceScenario && gapMs >= 0 && gapMs <= SYNC_RUN_GROUP_GAP_MS && spanMs <= SYNC_RUN_GROUP_MAX_SPAN_MS;
    if (contiguous) {
      currentChunks.push(run);
      return;
    }

    flush();
    currentChunks.push(run);
    currentInfer = infer;
  });
  flush();

  const groups = groupsRaw.slice(0, maxGroups);
  const inferredGroups = groups.filter((g) => g.inferred_grouping).length;
  const notes: string[] = [];
  if (inferredGroups > 0) {
    notes.push("GSC collector groups are inferred from contiguous source/scenario timestamps (no parent run_id in sync_runs).");
  }
  if (groups.some((g) => g.incomplete_window)) {
    notes.push("Oldest inferred group may be incomplete because the sync-runs fetch window is capped.");
  }
  if (groupsRaw.length > maxGroups) {
    notes.push("Grouped output is truncated to keep the dashboard responsive.");
  }

  return {
    groups,
    meta: {
      rows_fetched: normalized.length,
      rows_scanned_limit: maxRows,
      window_truncated: windowTruncated,
      groups_total: groupsRaw.length,
      groups_returned: groups.length,
      inferred_groups: inferredGroups,
      notes,
    },
  };
}

function parseFilters(url: URL): { ok: true; f: Filters } | { ok: false; res: Response } {
  const bad = (code: string, msg: string) => ({ ok: false as const, res: err(code, msg) });

  const start = (url.searchParams.get("start") || "").trim() || null;
  if (start && !DATE_RE.test(start)) return bad("INVALID_START_DATE", "start must be YYYY-MM-DD.");
  const end = (url.searchParams.get("end") || "").trim() || null;
  if (end && !DATE_RE.test(end)) return bad("INVALID_END_DATE", "end must be YYYY-MM-DD.");
  if (start && end && start > end) return bad("INVALID_DATE_RANGE", "start must be on or before end.");

  const channelRaw = (url.searchParams.get("channel") || "").trim().toLowerCase() || null;
  if (channelRaw && !CHANNEL_RE.test(channelRaw)) return bad("INVALID_CHANNEL", "channel must be lowercase letters, digits, or hyphens.");

  const pidRaw = (url.searchParams.get("product_id") || "").trim();
  let productId: number | null = null;
  if (pidRaw) {
    if (!/^\d{1,9}$/.test(pidRaw)) return bad("INVALID_PRODUCT_ID", "product_id must be a positive integer.");
    productId = Number(pidRaw);
  }

  const statusRaw = (url.searchParams.get("status") || "").trim().toLowerCase() || null;
  if (statusRaw && !COMMERCIAL_STATUSES.has(statusRaw)) {
    return bad("INVALID_STATUS", "status must be one of: paid, processing, shipped, completed (analysis covers commercial orders only).");
  }

  const revRaw = (url.searchParams.get("revenue_status") || "").trim().toUpperCase() || null;
  if (revRaw && !REVENUE_STATUSES.has(revRaw)) return bad("INVALID_REVENUE_STATUS", "revenue_status must be EXACT or UNALLOCATED.");

  const mapRaw0 = (url.searchParams.get("mapping") || "").trim();
  const mapRaw = mapRaw0 ? mapRaw0.charAt(0).toUpperCase() + mapRaw0.slice(1).toLowerCase() : null;
  if (mapRaw && !MAPPING_STATUSES.has(mapRaw)) return bad("INVALID_MAPPING_STATUS", "mapping must be Mapped, Partial, Unmapped, or Itemless.");

  const limitRaw = (url.searchParams.get("limit") || "").trim();
  let limit = DEFAULT_LIMIT;
  if (limitRaw) {
    if (!/^\d{1,4}$/.test(limitRaw) || Number(limitRaw) < 1) return bad("INVALID_LIMIT", "limit must be a positive integer.");
    limit = Math.min(Number(limitRaw), MAX_LIMIT);
  }
  const offsetRaw = (url.searchParams.get("offset") || "").trim();
  let offset = 0;
  if (offsetRaw) {
    if (!/^\d{1,9}$/.test(offsetRaw)) return bad("INVALID_OFFSET", "offset must be a non-negative integer.");
    offset = Number(offsetRaw);
  }

  return {
    ok: true,
    f: { start, end, channel: channelRaw, productId, status: statusRaw, revenueStatus: revRaw, mapping: mapRaw, limit, offset },
  };
}

function dayRangeWhere(f: Filters, col = "order_day"): { sql: string; binds: any[] } {
  const parts: string[] = [];
  const binds: any[] = [];
  if (f.start) { parts.push(`${col} >= ?`); binds.push(f.start); }
  if (f.end) { parts.push(`${col} <= ?`); binds.push(f.end); }
  return { sql: parts.length ? " AND " + parts.join(" AND ") : "", binds };
}

function createdRangeWhere(f: Filters, col = "created_at"): { sql: string; binds: any[] } {
  const parts: string[] = [];
  const binds: any[] = [];
  if (f.start) { parts.push(`substr(COALESCE(${col}, datetime('now')), 1, 10) >= ?`); binds.push(f.start); }
  if (f.end) { parts.push(`substr(COALESCE(${col}, datetime('now')), 1, 10) <= ?`); binds.push(f.end); }
  return { sql: parts.length ? " AND " + parts.join(" AND ") : "", binds };
}

function shiftIsoDate(isoDay: string, deltaDays: number): string | null {
  if (!DATE_RE.test(isoDay)) return null;
  const d = new Date(isoDay + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function ga4LeadLabel(v: any): string {
  const s = String(v || "").trim();
  if (!s) return "(unavailable)";
  if (s.toLowerCase() === "(not set)") return "(unavailable)";
  return s;
}

function ga4LeadSourceMediumLabel(source: any, medium: any): string {
  return ga4LeadLabel(source).toLowerCase() + " / " + ga4LeadLabel(medium).toLowerCase();
}

// ── Endpoints ─────────────────────────────────────────────────────────────

async function getSummary(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f);
  const binds: any[] = [...range.binds];
  let channelSql = "";
  if (f.channel) { channelSql = " AND channel_norm = ?"; binds.push(f.channel); }

  const row: any = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(orders), 0)            AS orders,
       SUM(order_revenue)                  AS order_revenue,
       COALESCE(SUM(units), 0)             AS units,
       COALESCE(SUM(mapped_orders), 0)     AS mapped_orders,
       COALESCE(SUM(exact_items), 0)       AS exact_items,
       COALESCE(SUM(unallocated_items), 0) AS unallocated_items
     FROM analysis_sales_daily
     WHERE 1=1${range.sql}${channelSql}`
  ).bind(...binds).first();

  const orders = Number(row?.orders || 0);
  const revenue = row?.order_revenue === null || row?.order_revenue === undefined ? null : Number(row.order_revenue);
  const items = Number(row?.exact_items || 0) + Number(row?.unallocated_items || 0);

  return json({
    success: true,
    filters: { start: f.start, end: f.end, channel: f.channel },
    summary: {
      orders,
      order_revenue: revenue,
      currency: "THB",
      units: Number(row?.units || 0),
      aov: orders > 0 && revenue !== null ? Math.round((revenue / orders) * 100) / 100 : null,
      mapped_orders: Number(row?.mapped_orders || 0),
      mapped_order_pct: orders > 0 ? Math.round((Number(row?.mapped_orders || 0) / orders) * 1000) / 10 : null,
      exact_items: Number(row?.exact_items || 0),
      unallocated_items: Number(row?.unallocated_items || 0),
      exact_item_pct: items > 0 ? Math.round((Number(row?.exact_items || 0) / items) * 1000) / 10 : null,
      unallocated_item_pct: items > 0 ? Math.round((Number(row?.unallocated_items || 0) / items) * 1000) / 10 : null,
    },
  });
}

async function getSales(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f, "ai.order_day");
  const conds: string[] = [];
  const binds: any[] = [...range.binds];
  if (f.channel) { conds.push("ai.channel_norm = ?"); binds.push(f.channel); }
  if (f.productId !== null) { conds.push("ai.product_id = ?"); binds.push(f.productId); }
  if (f.revenueStatus) { conds.push("ai.revenue_status = ?"); binds.push(f.revenueStatus); }
  if (f.status) { conds.push("co.status = ?"); binds.push(f.status); }
  if (f.mapping) { conds.push("om.derived_mapping_status = ?"); binds.push(f.mapping); }
  const extra = conds.length ? " AND " + conds.join(" AND ") : "";

  const base =
    `FROM analysis_active_items ai
     JOIN analysis_commercial_orders co ON co.id = ai.sales_order_id
     LEFT JOIN analysis_order_mapping om ON om.sales_order_id = ai.sales_order_id
     LEFT JOIN products p ON p.id = ai.product_id
     WHERE 1=1${range.sql}${extra}`;

  const countRow: any = await env.DB.prepare(`SELECT COUNT(*) AS n ${base}`).bind(...binds).first();
  const total = Number(countRow?.n || 0);

  const rows = await env.DB.prepare(
    `SELECT
       ai.order_day, ai.channel_norm, co.source_system, co.source_order_id, co.status,
       co.order_total, co.currency,
       ai.product_id, COALESCE(p.title_en, '(unmapped)') AS product_title,
       ai.quantity, ai.raw_item_text,
       ai.line_revenue, ai.revenue_status,
       om.derived_mapping_status
     ${base}
     ORDER BY ai.order_day DESC, ai.sales_order_id DESC, ai.id
     LIMIT ? OFFSET ?`
  ).bind(...binds, f.limit, f.offset).all();

  return json({
    success: true,
    filters: {
      start: f.start, end: f.end, channel: f.channel, product_id: f.productId,
      status: f.status, revenue_status: f.revenueStatus, mapping: f.mapping,
    },
    pagination: { total, limit: f.limit, offset: f.offset },
    rows: rows.results || [],
  });
}

async function getProducts(env: any, f: Filters): Promise<Response> {
  // Date/channel-filtered participation is aggregated from the base item view
  // (the all-time participation view cannot be parameterized).
  const range = dayRangeWhere(f, "ai.order_day");
  const binds: any[] = [...range.binds];
  let channelSql = "";
  if (f.channel) { channelSql = " AND ai.channel_norm = ?"; binds.push(f.channel); }

  const rows = await env.DB.prepare(
    `SELECT
       ai.product_id,
       COALESCE(p.title_en, '(unmapped)') AS product_title,
       p.slug AS product_slug,
       COUNT(DISTINCT ai.sales_order_id) AS orders_containing_product,
       SUM(ai.quantity) AS quantity,
       SUM(CASE WHEN ai.revenue_status = 'EXACT' THEN ai.line_revenue END) AS exact_revenue,
       SUM(ai.revenue_status = 'EXACT') AS exact_items,
       COUNT(*) AS total_items,
       COUNT(DISTINCT ai.channel_norm) AS channel_count
     FROM analysis_active_items ai
     LEFT JOIN products p ON p.id = ai.product_id
     WHERE 1=1${range.sql}${channelSql}
     GROUP BY ai.product_id, p.title_en, p.slug
     ORDER BY orders_containing_product DESC, quantity DESC, ai.product_id`
  ).bind(...binds).all();

  const trend = await env.DB.prepare(
    `SELECT product_id, orders_28d, orders_prev_28d, growth_vs_previous FROM analysis_sales_28d`
  ).all();
  const trendMap: Record<string, any> = {};
  (trend.results || []).forEach((t: any) => { trendMap[String(t.product_id)] = t; });

  const topChannel = await env.DB.prepare(
    `SELECT product_id, channel_norm, orders, units
     FROM analysis_product_channel
     ORDER BY orders DESC, units DESC, channel_norm`
  ).all();
  const topMap: Record<string, string> = {};
  (topChannel.results || []).forEach((t: any) => {
    const k = String(t.product_id);
    if (!(k in topMap)) topMap[k] = t.channel_norm;
  });

  const out = (rows.results || []).map((r: any) => {
    const k = String(r.product_id);
    return {
      ...r,
      revenue_coverage_pct: Number(r.total_items || 0) > 0
        ? Math.round((Number(r.exact_items || 0) / Number(r.total_items)) * 1000) / 10
        : null,
      top_channel: topMap[k] || null,
      orders_28d: trendMap[k]?.orders_28d ?? 0,
      growth_vs_previous_28d: trendMap[k]?.growth_vs_previous ?? null,
    };
  });

  return json({
    success: true,
    filters: { start: f.start, end: f.end, channel: f.channel },
    products: out,
  });
}

async function getProductDetail(env: any, idRaw: string): Promise<Response> {
  if (!/^\d{1,9}$/.test(idRaw)) return err("INVALID_PRODUCT_ID", "product id must be a positive integer.");
  const pid = Number(idRaw);

  const product: any = await env.DB.prepare(
    `SELECT id, slug, title_en, product_type, is_active FROM products WHERE id = ?`
  ).bind(pid).first();
  if (!product) return err("PRODUCT_NOT_FOUND", "No product with id " + pid + ".", 404);

  const participation: any = await env.DB.prepare(
    `SELECT orders_containing_product, quantity, exact_revenue, exact_items, total_items, channel_count
     FROM analysis_product_participation WHERE product_id = ?`
  ).bind(pid).first();

  const channels = await env.DB.prepare(
    `SELECT channel_norm, orders, units, exact_revenue
     FROM analysis_product_channel WHERE product_id = ? ORDER BY orders DESC, units DESC`
  ).bind(pid).all();

  const w28: any = await env.DB.prepare(`SELECT * FROM analysis_sales_28d WHERE product_id = ?`).bind(pid).first();
  const w90: any = await env.DB.prepare(`SELECT * FROM analysis_sales_90d WHERE product_id = ?`).bind(pid).first();

  const anchorOrders = Number(participation?.orders_containing_product || 0);
  const pairs = await env.DB.prepare(
    `SELECT
       CASE WHEN cp.product_a = ?1 THEN cp.product_b ELSE cp.product_a END AS partner_product_id,
       COALESCE(p.title_en, '(unknown)') AS partner_title,
       cp.co_orders
     FROM analysis_product_copurchase cp
     LEFT JOIN products p ON p.id = CASE WHEN cp.product_a = ?1 THEN cp.product_b ELSE cp.product_a END
     WHERE cp.product_a = ?1 OR cp.product_b = ?1
     ORDER BY cp.co_orders DESC`
  ).bind(pid).all();

  const coPurchase = (pairs.results || []).map((r: any) => ({
    ...r,
    attach_rate_pct: anchorOrders > 0 ? Math.round((Number(r.co_orders) / anchorOrders) * 1000) / 10 : null,
  }));

  return json({
    success: true,
    product,
    participation: participation || {
      orders_containing_product: 0, quantity: 0, exact_revenue: null,
      exact_items: 0, total_items: 0, channel_count: 0,
    },
    channels: channels.results || [],
    window_28d: w28 || null,
    window_90d: w90 || null,
    co_purchase: coPurchase,
  });
}

async function getChannels(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f);
  const rows = await env.DB.prepare(
    `SELECT
       channel_norm,
       SUM(orders) AS orders,
       SUM(order_revenue) AS order_revenue,
       SUM(units) AS units,
       CASE WHEN SUM(orders) > 0 THEN ROUND(SUM(order_revenue) * 1.0 / SUM(orders), 2) END AS aov,
       SUM(mapped_orders) AS mapped_orders,
       CASE WHEN SUM(orders) > 0 THEN ROUND(SUM(mapped_orders) * 100.0 / SUM(orders), 1) END AS mapped_pct
     FROM analysis_sales_daily
     WHERE 1=1${range.sql}
     GROUP BY channel_norm
     ORDER BY orders DESC, order_revenue DESC`
  ).bind(...range.binds).all();

  return json({
    success: true,
    filters: { start: f.start, end: f.end },
    channels: rows.results || [],
  });
}

async function getQuotes(env: any, f: Filters): Promise<Response> {
  const range = createdRangeWhere(f, "q.created_at");
  const baseSql = `FROM custom_quotes q WHERE 1=1${range.sql}`;
  try {
    const summaryRow: any = await env.DB.prepare(
      `SELECT
         COUNT(*) AS total_quotes,
         SUM(CASE WHEN q.created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS new_quotes_7d,
         SUM(CASE WHEN q.created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS new_quotes_30d,
         SUM(CASE WHEN LOWER(COALESCE(q.status, 'pending')) != 'archived'
                   AND (q.expires_at IS NULL OR q.expires_at > datetime('now'))
                  THEN 1 ELSE 0 END) AS active_quotes,
         SUM(CASE WHEN LOWER(COALESCE(q.status, 'pending')) = 'approved' THEN 1 ELSE 0 END) AS approved_quotes,
         SUM(CASE WHEN q.expires_at IS NOT NULL AND q.expires_at <= datetime('now')
                   AND LOWER(COALESCE(q.status, 'pending')) != 'archived'
                  THEN 1 ELSE 0 END) AS expired_quotes,
         SUM(CASE WHEN LOWER(COALESCE(q.status, 'pending')) = 'approved'
                   AND q.expires_at IS NOT NULL
                   AND q.expires_at > datetime('now')
                   AND q.expires_at <= datetime('now', '+7 days')
                  THEN 1 ELSE 0 END) AS expiring_7d,
         SUM(CASE WHEN LOWER(COALESCE(q.status, 'pending')) = 'approved'
                   AND NOT EXISTS (
                     SELECT 1 FROM orders o
                     WHERE o.quote_id = q.quote_id
                   )
                  THEN 1 ELSE 0 END) AS approved_unconverted
       ${baseSql}`
    ).bind(...range.binds).first();

    const exactRow: any = await env.DB.prepare(
      `SELECT COUNT(DISTINCT q.quote_id) AS exact_converted
       ${baseSql}
         AND EXISTS (
           SELECT 1 FROM orders o
           WHERE o.quote_id = q.quote_id
         )`
    ).bind(...range.binds).first();

    const legacyRow: any = await env.DB.prepare(
      `SELECT COUNT(DISTINCT q.quote_id) AS legacy_email_matched
       ${baseSql}
         AND NOT EXISTS (
           SELECT 1 FROM orders o
           WHERE o.quote_id = q.quote_id
         )
         AND EXISTS (
           SELECT 1 FROM orders o2
           WHERE LOWER(COALESCE(o2.email, '')) = LOWER(COALESCE(q.email, ''))
         )`
    ).bind(...range.binds).first();

    const topProducts = await env.DB.prepare(
      `SELECT
         q.product_slug,
         COUNT(*) AS quote_count,
         SUM(CASE WHEN EXISTS (SELECT 1 FROM orders o WHERE o.quote_id = q.quote_id) THEN 1 ELSE 0 END) AS exact_converted
       ${baseSql}
       GROUP BY q.product_slug
       ORDER BY quote_count DESC, exact_converted DESC, q.product_slug
       LIMIT 12`
    ).bind(...range.binds).all();

    const atRisk = await env.DB.prepare(
      `SELECT
         q.quote_id,
         q.product_slug,
         q.created_at,
         q.expires_at,
         q.quoted_price_usd,
         q.quoted_price
       ${baseSql}
         AND LOWER(COALESCE(q.status, 'pending')) = 'approved'
         AND q.expires_at IS NOT NULL
         AND q.expires_at > datetime('now')
         AND q.expires_at <= datetime('now', '+7 days')
         AND NOT EXISTS (
           SELECT 1 FROM orders o
           WHERE o.quote_id = q.quote_id
         )
       ORDER BY q.expires_at ASC, q.created_at ASC
       LIMIT 25`
    ).bind(...range.binds).all();

    const approvedQuotes = Number(summaryRow?.approved_quotes || 0);
    const exactConverted = Number(exactRow?.exact_converted || 0);

    // ── Phase 5 — Custom Quote Funnel extension (additive-only) ──────────────
    // Contract (00_Issue/MildMate_Phase5_Quote_Funnel_Dashboard_Audit_2026-10-30.md):
    // - The legacy summary/conversion/top_products/at_risk blocks above keep their
    //   original definitions unchanged (they still include test quotes).
    // - The new `phase5` blocks exclude test quotes and NEVER emit PII (emails are
    //   aggregated server-side into distinct counts only).
    // - First-touch and quote-session channels are reported separately, never merged.
    // - Missing attribution is labelled "unavailable", never Direct.
    // - Revenue = orders line totals (unit price × quantity) for paid statuses only
    //   (confirmed/processing/shipped/delivered). Shipping lines are never written
    //   to orders (webhook/reconcile exclude them). quoted_price is never revenue.
    // - Google Ads: a quote is Ads-attributable ONLY when a paid click id
    //   (gclid/gbraid/wbraid) is recorded in its attribution JSON. Direct/Unknown
    //   quotes are never assigned to Ads. Cost per quote is null (N/A) when the
    //   attributable denominator is zero. Cost scope + freshness are explicit.
    const phase5 = await buildPhase5QuoteFunnel(env, f, baseSql, range.binds);
    return json({
      success: true,
      available: true,
      filters: { start: f.start, end: f.end },
      phase5,
      summary: {
        total_quotes: Number(summaryRow?.total_quotes || 0),
        new_quotes_7d: Number(summaryRow?.new_quotes_7d || 0),
        new_quotes_30d: Number(summaryRow?.new_quotes_30d || 0),
        active_quotes: Number(summaryRow?.active_quotes || 0),
        approved_quotes: approvedQuotes,
        approved_unconverted: Number(summaryRow?.approved_unconverted || 0),
        expiring_7d: Number(summaryRow?.expiring_7d || 0),
        expired_quotes: Number(summaryRow?.expired_quotes || 0),
      },
      conversion: {
        exact_converted_quotes: exactConverted,
        exact_conversion_pct: approvedQuotes > 0 ? Math.round((exactConverted / approvedQuotes) * 1000) / 10 : null,
        legacy_email_matched_quotes: Number(legacyRow?.legacy_email_matched || 0),
      },
      top_products: (topProducts.results || []).map((r: any) => ({
        product_slug: r.product_slug || "(unknown)",
        quote_count: Number(r.quote_count || 0),
        exact_converted: Number(r.exact_converted || 0),
        exact_conversion_pct: Number(r.quote_count || 0) > 0
          ? Math.round((Number(r.exact_converted || 0) / Number(r.quote_count || 0)) * 1000) / 10
          : null,
      })),
      at_risk: (atRisk.results || []).map((r: any) => ({
        quote_id: r.quote_id,
        product_slug: r.product_slug,
        created_at: r.created_at,
        expires_at: r.expires_at,
        quoted_price_usd: r.quoted_price_usd,
        quoted_price_thb: r.quoted_price,
      })),
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (isSchemaMissingError(msg)) {
      return json({
        success: true,
        available: false,
        error_code: "QUOTES_SCHEMA_UNAVAILABLE",
        message:
          "Quote funnel schema is not available in this environment yet. Apply migrations 059_quote_tier1_pipeline.sql and 060_quote_acquisition_attribution.sql.",
        filters: { start: f.start, end: f.end },
        phase5: {
          available: false,
          error_code: "PHASE5_FUNNEL_UNAVAILABLE",
          message: "Quote attribution schema is unavailable in this environment.",
        },
        summary: null,
        conversion: null,
        top_products: [],
        at_risk: [],
      });
    }
    throw e;
  }
}

// ── Phase 5 — Quote funnel extension builder (additive, PII-free) ────────

const PHASE5_ATTRIBUTION_COVERAGE_START = "2026-10-30";
const PHASE5_TEST_QUOTE_DENYLIST = ["QT-261030-001", "QT-261030-002"];
const PHASE5_PAID_ORDER_STATUSES = new Set(["confirmed", "processing", "shipped", "delivered"]);
const PHASE5_PAID_CLICK_FIELDS = ["gclid", "gbraid", "wbraid"] as const;

function phase5IsTestQuoteId(quoteId: string): boolean {
  const id = String(quoteId || "").trim();
  if (!id) return false;
  if (PHASE5_TEST_QUOTE_DENYLIST.includes(id)) return true;
  // Established test-ID pattern (TEST-MAKE-001 convention): TEST- prefix,
  // case-insensitive.
  return /^test-/i.test(id);
}

function phase5ParseAttributionJson(raw: any): any | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

// Channel key is the verbatim source/medium pair captured at the touch.
// A quote whose attribution row exists but whose JSON is missing/unparseable
// counts as "unavailable" (null), never as Direct.
function phase5ChannelOf(obj: any): string | null {
  if (!obj) return null;
  const src = String(obj.source || obj.utm_source || "").trim() || "(none)";
  const med = String(obj.medium || obj.utm_medium || "").trim() || "(none)";
  return src + "/" + med;
}

function phase5HasPaidClick(obj: any): boolean {
  if (!obj) return false;
  return PHASE5_PAID_CLICK_FIELDS.some((f) => {
    const v = obj[f];
    return typeof v === "string" && v.trim().length > 0;
  });
}

interface Phase5ChannelBucket {
  channel: string;
  quotes: Set<string>;
  customers: Set<string>;
  approved: number;
  paid_click_quotes: number;
}

function phase5Bucket(
  map: Map<string, Phase5ChannelBucket>,
  channel: string,
  quoteId: string,
  customerKey: string,
  approved: boolean,
  paidClick: boolean,
): void {
  let b = map.get(channel);
  if (!b) {
    b = { channel, quotes: new Set(), customers: new Set(), approved: 0, paid_click_quotes: 0 };
    map.set(channel, b);
  }
  b.quotes.add(quoteId);
  if (customerKey) b.customers.add(customerKey);
  if (approved) b.approved += 1;
  if (paidClick) b.paid_click_quotes += 1;
}

function phase5ChannelRows(map: Map<string, Phase5ChannelBucket>): any[] {
  return [...map.values()]
    .map((b) => ({
      channel: b.channel,
      quotes: b.quotes.size,
      unique_customers: b.customers.size,
      approved: b.approved,
      paid_click_quotes: b.paid_click_quotes,
    }))
    .sort((a, b) => b.quotes - a.quotes || a.channel.localeCompare(b.channel));
}

async function buildPhase5QuoteFunnel(env: any, f: Filters, baseSql: string, rangeBinds: any[]): Promise<any> {
  try {
    // In-range quote rows (email is aggregated server-side only — never output).
    const quoteRows = await env.DB.prepare(
      `SELECT q.quote_id,
              LOWER(TRIM(COALESCE(q.email, ''))) AS email_key,
              LOWER(COALESCE(q.status, 'pending')) AS status,
              q.product_slug, q.fabric, q.color
       ${baseSql}`
    ).bind(...rangeBinds).all();
    const quotes: any[] = (quoteRows.results || []).filter((r: any) => !phase5IsTestQuoteId(r.quote_id));

    // Attribution rows (table is small; filter to in-range quote ids in JS).
    const attrRows = await env.DB.prepare(
      `SELECT a.quote_id, a.first_touch_json, a.quote_session_json FROM quote_acquisition_attribution a`
    ).all();
    const quoteIdSet = new Set(quotes.map((q: any) => String(q.quote_id)));
    const attrById = new Map<string, any>();
    for (const r of attrRows.results || []) {
      const id = String(r.quote_id || "");
      if (quoteIdSet.has(id) && !attrById.has(id)) attrById.set(id, r);
    }

    // Order rows for in-range quote ids (exact quote_id attribution only;
    // email-matching is deliberately NOT used for the new detail blocks).
    const orderRows = await env.DB.prepare(
      `SELECT o.quote_id, o.stripe_session_id, o.product_slug, o.product_title_en,
              o.quantity, o.price_usd, o.price_thb, o.currency, o.status, o.created_at
       FROM orders o
       WHERE o.quote_id IS NOT NULL AND COALESCE(o.is_archived, 0) = 0`
    ).all();
    const ordersByQuote = new Map<string, any[]>();
    for (const r of orderRows.results || []) {
      const id = String(r.quote_id || "");
      if (!quoteIdSet.has(id)) continue;
      if (!ordersByQuote.has(id)) ordersByQuote.set(id, []);
      ordersByQuote.get(id)!.push(r);
    }

    // Google Ads daily cost + freshness (report_date window follows the filters).
    let adsCostRows: any[] = [];
    let adsFreshRow: any = null;
    try {
      const adsRange = dayRangeWhere(f, "report_date");
      const ads = await env.DB.prepare(
        `SELECT COALESCE(currency, '') AS currency,
                SUM(cost) AS cost,
                MAX(report_date) AS latest_report_date
         FROM google_ads_campaign_daily
         WHERE 1=1${adsRange.sql}
         GROUP BY COALESCE(currency, '')`
      ).bind(...adsRange.binds).all();
      adsCostRows = ads.results || [];
      adsFreshRow = await env.DB.prepare(
        `SELECT MAX(report_date) AS latest_report_date, COUNT(*) AS total_rows FROM google_ads_campaign_daily`
      ).first();
    } catch {
      adsCostRows = [];
      adsFreshRow = null;
    }

    // ── Aggregation (JS-side; no PII leaves this function) ──
    const ftMap = new Map<string, Phase5ChannelBucket>();
    const qsMap = new Map<string, Phase5ChannelBucket>();
    const customersAll = new Set<string>();
    const customersWithAttr = new Set<string>();
    const customersPaid = new Set<string>();
    let approvedCount = 0;
    let paidQuotes = 0;
    let ftUnavailable = 0;
    let qsUnavailable = 0;
    const adsAttributableQuoteIds = new Set<string>();

    for (const q of quotes) {
      const id = String(q.quote_id);
      const custKey = String(q.email_key || "");
      const isApproved = String(q.status) === "approved";
      if (isApproved) approvedCount += 1;
      if (custKey) customersAll.add(custKey);

      const attr = attrById.get(id) || null;
      const ft = attr ? phase5ParseAttributionJson(attr.first_touch_json) : null;
      const qs = attr ? phase5ParseAttributionJson(attr.quote_session_json) : null;
      if (ft) customersWithAttr.add(custKey);

      const ftChannel = phase5ChannelOf(ft);
      const qsChannel = phase5ChannelOf(qs);
      if (!ftChannel) ftUnavailable += 1;
      if (!qsChannel) qsUnavailable += 1;
      const ftPaid = phase5HasPaidClick(ft);
      const qsPaid = phase5HasPaidClick(qs);
      if (ftChannel) phase5Bucket(ftMap, ftChannel, id, custKey, isApproved, ftPaid);
      if (qsChannel) phase5Bucket(qsMap, qsChannel, id, custKey, isApproved, qsPaid);
      if (ftPaid || qsPaid) adsAttributableQuoteIds.add(id);

      const rows = ordersByQuote.get(id) || [];
      const hasPaidOrder = rows.some((r: any) => PHASE5_PAID_ORDER_STATUSES.has(String(r.status || "").toLowerCase()));
      if (hasPaidOrder) {
        paidQuotes += 1;
        if (custKey) customersPaid.add(custKey);
      }
    }

    // Order detail per quote (PII-free: product/qty/price only).
    const byQuote = quotes
      .filter((q: any) => (ordersByQuote.get(String(q.quote_id)) || []).length > 0)
      .map((q: any) => {
        const id = String(q.quote_id);
        const rows = ordersByQuote.get(id) || [];
        const orderIds = [...new Set(rows.map((r: any) => String(r.stripe_session_id || "")))];
        return {
          quote_id: id,
          quote_status: q.status,
          order_count: orderIds.length,
          order_ids: orderIds,
          paid: rows.some((r: any) => PHASE5_PAID_ORDER_STATUSES.has(String(r.status || "").toLowerCase())),
          statuses: [...new Set(rows.map((r: any) => String(r.status || "").toLowerCase()))],
          items: rows.map((r: any) => {
            const qty = Number(r.quantity || 1) || 1;
            const cur = String(r.currency || "").toUpperCase();
            const unitPrice = cur === "USD" ? Number(r.price_usd || 0) : cur === "THB" ? Number(r.price_thb || 0) : 0;
            return {
              product_slug: r.product_slug || "(unknown)",
              product_title: r.product_title_en || r.product_slug || "(unknown)",
              quantity: qty,
              currency: cur || null,
              unit_price: unitPrice,
              line_revenue: Math.round(unitPrice * qty * 100) / 100,
              status: String(r.status || "").toLowerCase(),
            };
          }),
        };
      })
      .sort((a, b) => String(b.quote_id).localeCompare(String(a.quote_id)));

    // Paid product revenue (ex-shipping; orders rows never contain shipping
    // lines). Prices are UNIT amounts — multiply by quantity. Currencies are
    // never blended. cancelled/refunded/pending rows are excluded and counted.
    const revenueByCur: Record<string, { line_revenue: number; orders: any; items: number; quantity: number }> = {};
    let excludedNonPaidRows = 0;
    for (const q of quotes) {
      for (const r of ordersByQuote.get(String(q.quote_id)) || []) {
        const st = String(r.status || "").toLowerCase();
        if (!PHASE5_PAID_ORDER_STATUSES.has(st)) {
          excludedNonPaidRows += 1;
          continue;
        }
        const cur = String(r.currency || "").toUpperCase();
        if (cur !== "THB" && cur !== "USD") continue; // unknown currency never blended
        if (!revenueByCur[cur]) {
          revenueByCur[cur] = { line_revenue: 0, orders: new Set(), items: 0, quantity: 0 };
        }
        const qty = Number(r.quantity || 1) || 1;
        const unit = cur === "USD" ? Number(r.price_usd || 0) : Number(r.price_thb || 0);
        revenueByCur[cur].line_revenue = Math.round((revenueByCur[cur].line_revenue + unit * qty) * 100) / 100;
        revenueByCur[cur].orders.add(String(r.stripe_session_id || ""));
        revenueByCur[cur].items += 1;
        revenueByCur[cur].quantity += qty;
      }
    }
    for (const cur of Object.keys(revenueByCur)) {
      revenueByCur[cur].orders = revenueByCur[cur].orders.size;
    }

    // Ads cost + freshness.
    const nowMs = Date.now();
    let adsDaysSince: number | null = null;
    if (adsFreshRow && adsFreshRow.latest_report_date) {
      const t = Date.parse(String(adsFreshRow.latest_report_date) + "T00:00:00Z");
      if (!isNaN(t)) adsDaysSince = Math.floor((nowMs - t) / 86400000);
    }
    const adsCost = adsCostRows.map((r: any) => ({
      currency: r.currency || null,
      cost: Number(r.cost || 0),
      latest_report_date: r.latest_report_date || null,
    }));
    const adsAttributable = adsAttributableQuoteIds.size;
    let costPerQuote: any = null;
    if (adsAttributable > 0 && adsCost.length > 0) {
      costPerQuote = adsCost.map((c) => ({
        currency: c.currency,
        cost_per_attributable_quote: Math.round((c.cost / adsAttributable) * 100) / 100,
      }));
    }

    return {
      coverage_start: PHASE5_ATTRIBUTION_COVERAGE_START,
      exclusions: {
        denylist: [...PHASE5_TEST_QUOTE_DENYLIST],
        patterns: ["TEST-*"],
        excluded_note: "Legacy summary/conversion/top_products/at_risk blocks above are computed without exclusions and keep their original definitions.",
      },
      status_funnel: {
        submitted: quotes.length,
        approved: approvedCount,
        paid: paidQuotes,
        unpaid: quotes.length - paidQuotes,
      },
      customers: {
        unique_customers_total: customersAll.size,
        unique_customers_with_attribution: customersWithAttr.size,
        unique_customers_paid: customersPaid.size,
        pii_note: "Unique counts are computed server-side; no customer identifiers are returned.",
      },
      acquisition: {
        first_touch: phase5ChannelRows(ftMap),
        quote_session: phase5ChannelRows(qsMap),
        unavailable: {
          first_touch_quotes: ftUnavailable,
          quote_session_quotes: qsUnavailable,
          note:
            "Quotes submitted before " + PHASE5_ATTRIBUTION_COVERAGE_START +
            " (Phase 3 deploy) have no attribution capture; they are counted as unavailable, never as Direct.",
        },
        paid_click_evidence: "paid_click_quotes = quotes whose captured attribution JSON contains gclid/gbraid/wbraid; observed values only, never inferred from spend.",
      },
      orders: {
        by_quote: byQuote,
        note: "Orders bind to quotes via exact orders.quote_id. Line grain: unit price × quantity; shipping lines are never stored on order rows.",
      },
      revenue: {
        basis:
          "orders rows with paid status (confirmed/processing/shipped/delivered), COALESCE(is_archived,0)=0; line revenue = unit price × quantity; per-currency, never blended; quoted_price is never used.",
        thb: revenueByCur["THB"] ? { line_revenue: revenueByCur["THB"].line_revenue, orders: revenueByCur["THB"].orders, items: revenueByCur["THB"].items, quantity: revenueByCur["THB"].quantity } : { line_revenue: 0, orders: 0, items: 0, quantity: 0 },
        usd: revenueByCur["USD"] ? { line_revenue: revenueByCur["USD"].line_revenue, orders: revenueByCur["USD"].orders, items: revenueByCur["USD"].items, quantity: revenueByCur["USD"].quantity } : { line_revenue: 0, orders: 0, items: 0, quantity: 0 },
        excluded_non_paid_rows: excludedNonPaidRows,
      },
      google_ads: {
        ads_attributable_quotes: adsAttributable,
        attribution_basis: "exact recorded paid click id (gclid/gbraid/wbraid) in quote attribution JSON; Direct/Unknown quotes are never assigned to Ads.",
        cost_scope: "google_ads_campaign_daily cost summed over the report_date filter window, per source currency; platform-attributed and directional only.",
        cost: adsCost,
        cost_per_attributable_quote: costPerQuote,
        na_reason: adsAttributable === 0 ? "N/A — no Ads-attributable quotes (no recorded paid click ids) in the selected window." : null,
        freshness: {
          latest_report_date: adsFreshRow?.latest_report_date || null,
          total_rows: Number(adsFreshRow?.total_rows || 0),
          days_since_latest_report: adsDaysSince,
          status: !adsFreshRow || Number(adsFreshRow.total_rows || 0) === 0
            ? "empty"
            : (adsDaysSince !== null && adsDaysSince > 4 ? "warning" : "ok"),
        },
      },
    };
  } catch (e: any) {
    // Phase 5 blocks are additive — a failure must never break the legacy
    // /quotes response.
    return {
      available: false,
      error_code: "PHASE5_FUNNEL_UNAVAILABLE",
      message: String(e?.message || e).slice(0, 300),
    };
  }
}

// ── Order acquisition (first-touch) — PII-free aggregation over
// checkout_session_snapshots.attribution_json joined to orders. ────────
// mirrors the Phase 5 quote funnel rules:
// - Channel = verbatim captured source/medium at the touch; missing/unparseable
//   attribution is "unavailable", never Direct.
// - Revenue = paid statuses only (confirmed/processing/shipped/delivered),
//   unit price × quantity, per currency, never blended; archived rows excluded.
// - Test sessions (TEST- prefix convention) are excluded from all blocks.
// - No customer identifiers (email/name/phone) leave this function.
// checkout_session_snapshots.attribution_json nests first_touch /
// checkout_session as OBJECTS (unlike the quote table's JSON-string columns).
// Accept both: object passthrough, or parse when stringified.
function oaTouchOf(attr: any, key: string): any | null {
  if (!attr || typeof attr !== "object") return null;
  const v = (attr as any)[key];
  if (!v) return null;
  if (typeof v === "object") return v;
  if (typeof v === "string") return phase5ParseAttributionJson(v);
  return null;
}

async function getOrderAcquisition(env: any, f: Filters): Promise<Response> {
  try {
    const range = createdRangeWhere(f, "o.created_at");
    const orderRows = await env.DB.prepare(
      `SELECT o.stripe_session_id, o.email, o.product_slug, o.product_title_en,
              o.quantity, o.price_usd, o.price_thb, o.currency, o.status, o.created_at,
              s.attribution_json
       FROM orders o
       LEFT JOIN checkout_session_snapshots s ON s.stripe_session_id = o.stripe_session_id
       WHERE COALESCE(o.is_archived, 0) = 0${range.sql}
       ORDER BY o.created_at DESC`
    ).bind(...range.binds).all();

    interface OrderSessionAgg {
      sessionId: string;
      customers: Set<string>;
      paid: boolean;
      rows: number;
      createdAt: string;
      revenue: Record<string, number>;
      ftChannel: string | null;
      csChannel: string | null;
      landingPath: string | null;
      paidClick: boolean;
    }

    const sessions = new Map<string, OrderSessionAgg>();
    let orderRowsTotal = 0;
    let paidOrderRows = 0;
    let excludedTestRows = 0;

    for (const r of orderRows.results || []) {
      const sessionId = String(r.stripe_session_id || "");
      // Test sessions (TEST- prefix convention) are excluded from ALL summary
      // blocks, including the raw row counters.
      if (/^test-/i.test(sessionId)) { excludedTestRows += 1; continue; }
      orderRowsTotal += 1;
      const status = String(r.status || "").toLowerCase();
      const paid = PHASE5_PAID_ORDER_STATUSES.has(status);
      if (paid) paidOrderRows += 1;
      const emailKey = String(r.email || "").toLowerCase().trim();

      let agg = sessions.get(sessionId);
      if (!agg) {
        const attr = phase5ParseAttributionJson(r.attribution_json);
        const ft = oaTouchOf(attr, "first_touch");
        const cs = oaTouchOf(attr, "checkout_session");
        agg = {
          sessionId,
          customers: new Set(),
          paid: false,
          rows: 0,
          createdAt: String(r.created_at || ""),
          revenue: {},
          ftChannel: ft ? phase5ChannelOf(ft) : null,
          csChannel: cs ? phase5ChannelOf(cs) : null,
          landingPath: ft ? String(ft.landing_path || "").trim() || null : null,
          paidClick: phase5HasPaidClick(ft) || phase5HasPaidClick(cs),
        };
        sessions.set(sessionId, agg);
      }
      agg.rows += 1;
      if (paid) agg.paid = true;
      if (emailKey) agg.customers.add(emailKey);
      if (paid) {
        const cur = String(r.currency || "").toUpperCase();
        if (cur === "USD" || cur === "THB") {
          const qty = Number(r.quantity || 1) || 1;
          const unit = cur === "USD" ? Number(r.price_usd || 0) : Number(r.price_thb || 0);
          agg.revenue[cur] = Math.round(((agg.revenue[cur] || 0) + unit * qty) * 100) / 100;
        }
      }
      // keep the earliest created_at per session
      if (r.created_at && String(r.created_at) < agg.createdAt) agg.createdAt = String(r.created_at);
    }

    const customerSet = new Set<string>();
    for (const s of sessions.values()) {
      for (const c of s.customers) customerSet.add(c);
    }

    interface OrderChannelBucket {
      channel: string;
      sessions: Set<string>;
      paidSessions: number;
      customers: Set<string>;
      revenue: Record<string, number>;
      paidClickSessions: number;
    }
    const mkBucket = (): OrderChannelBucket => ({ channel: "", sessions: new Set(), paidSessions: 0, customers: new Set(), revenue: {}, paidClickSessions: 0 });
    const ftMap = new Map<string, OrderChannelBucket>();
    const csMap = new Map<string, OrderChannelBucket>();
    const landingMap = new Map<string, { sessions: Set<string>; paidSessions: number }>();
    let ftUnavailable = 0;

    for (const s of sessions.values()) {
      if (s.ftChannel) {
        let b = ftMap.get(s.ftChannel);
        if (!b) { b = mkBucket(); b.channel = s.ftChannel; ftMap.set(s.ftChannel, b); }
        b.sessions.add(s.sessionId);
        if (s.paid) b.paidSessions += 1;
        for (const c of s.customers) b.customers.add(c);
        for (const cur of Object.keys(s.revenue)) b.revenue[cur] = Math.round(((b.revenue[cur] || 0) + s.revenue[cur]) * 100) / 100;
        if (s.paidClick) b.paidClickSessions += 1;
      } else {
        ftUnavailable += 1;
      }
      if (s.csChannel) {
        let b = csMap.get(s.csChannel);
        if (!b) { b = mkBucket(); b.channel = s.csChannel; csMap.set(s.csChannel, b); }
        b.sessions.add(s.sessionId);
        if (s.paid) b.paidSessions += 1;
        for (const c of s.customers) b.customers.add(c);
        for (const cur of Object.keys(s.revenue)) b.revenue[cur] = Math.round(((b.revenue[cur] || 0) + s.revenue[cur]) * 100) / 100;
        if (s.paidClick) b.paidClickSessions += 1;
      }
      if (s.landingPath) {
        let l = landingMap.get(s.landingPath);
        if (!l) { l = { sessions: new Set(), paidSessions: 0 }; landingMap.set(s.landingPath, l); }
        l.sessions.add(s.sessionId);
        if (s.paid) l.paidSessions += 1;
      }
    }

    const channelRows = (map: Map<string, OrderChannelBucket>) =>
      [...map.values()]
        .map((b) => ({
          channel: b.channel,
          orders: b.sessions.size,
          paid_orders: b.paidSessions,
          unique_customers: b.customers.size,
          revenue_usd: b.revenue["USD"] || 0,
          revenue_thb: b.revenue["THB"] || 0,
          paid_click_orders: b.paidClickSessions,
        }))
        .sort((a, b) => b.orders - a.orders || a.channel.localeCompare(b.channel));

    const recentPaid = [...sessions.values()]
      .filter((s) => s.paid)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 10)
      .map((s) => {
        const row = (orderRows.results || []).find((r: any) => String(r.stripe_session_id || "") === s.sessionId);
        return {
          created_at: s.createdAt,
          order_session: s.sessionId ? s.sessionId.slice(0, 14) + "…" : "(unknown)",
          product: row ? (row.product_title_en || row.product_slug || "(unknown)") : "(see order)",
          currency_amounts: Object.keys(s.revenue).length > 0
            ? Object.keys(s.revenue).map((cur) => ({ currency: cur, amount: s.revenue[cur] }))
            : [],
          first_touch_channel: s.ftChannel,
          checkout_channel: s.csChannel,
          landing_path: s.landingPath,
          paid_click: s.paidClick,
        };
      });

    const paidSessions = [...sessions.values()].filter((s) => s.paid).length;
    const withFt = [...sessions.values()].filter((s) => s.ftChannel).length;

    return json({
      success: true,
      available: true,
      filters: { start: f.start, end: f.end },
      coverage_start: PHASE5_ATTRIBUTION_COVERAGE_START,
      summary: {
        order_rows: orderRowsTotal,
        sessions: sessions.size,
        paid_order_rows: paidOrderRows,
        paid_sessions: paidSessions,
        unique_customers: customerSet.size,
        sessions_with_first_touch: withFt,
        first_touch_unavailable: ftUnavailable,
      },
      first_touch_channels: channelRows(ftMap),
      checkout_channels: channelRows(csMap),
      landing_paths: [...landingMap.entries()]
        .map(([path, l]) => ({ landing_path: path, orders: l.sessions.size, paid_orders: l.paidSessions }))
        .sort((a, b) => b.orders - a.orders || a.landing_path.localeCompare(b.landing_path))
        .slice(0, 10),
      recent_paid_orders: recentPaid,
      notes: {
        pii: "No customer identifiers (email/name/phone) are returned; customers are aggregated server-side into distinct counts only.",
        attribution_basis: "First-touch = verbatim captured source/medium at first observed touch (checkout_session_snapshots.attribution_json); missing/unparseable attribution counts as Unavailable, never Direct.",
        paid_click_evidence: "paid_click counts only sessions whose captured attribution JSON contains gclid/gbraid/wbraid; observed values only, never inferred from spend.",
        exclusions: "Archived order rows excluded; test sessions (TEST- prefix convention) excluded: " + excludedTestRows + " row(s) in window.",
      },
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("no such table")) {
      return json({
        success: true,
        available: false,
        message: "Order acquisition requires checkout_session_snapshots and orders tables.",
        filters: { start: f.start, end: f.end },
      });
    }
    return json({ success: false, error: "order-acquisition failed: " + msg.slice(0, 200) }, 500);
  }
}

async function getGsc(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f, "g.report_date");
  const binds: any[] = [...range.binds];
  let productSql = "";
  if (f.productId !== null) {
    productSql = " AND g.product_id = ?";
    binds.push(f.productId);
  }

  try {
    const summary: any = await env.DB.prepare(
      `SELECT
         COUNT(DISTINCT g.query_norm) AS queries,
         COUNT(DISTINCT g.page_path) AS pages,
         COALESCE(SUM(g.clicks), 0) AS clicks,
         COALESCE(SUM(g.impressions), 0) AS impressions,
         CASE WHEN SUM(g.impressions) > 0
              THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2)
         END AS ctr_pct,
         CASE WHEN SUM(g.impressions) > 0
              THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2)
         END AS avg_position,
         COALESCE(SUM(CASE WHEN g.product_id IS NOT NULL THEN g.clicks ELSE 0 END), 0) AS mapped_clicks,
         COALESCE(SUM(CASE WHEN g.product_id IS NOT NULL THEN g.impressions ELSE 0 END), 0) AS mapped_impressions
       FROM gsc_search_daily g
       WHERE 1=1${range.sql}${productSql}`
    ).bind(...binds).first();

    const topPages = await env.DB.prepare(
      `SELECT
         g.page_path,
         g.product_id,
         COALESCE(p.title_en, '(non-product)') AS product_title,
         COUNT(DISTINCT g.query_norm) AS queries,
         SUM(g.clicks) AS clicks,
         SUM(g.impressions) AS impressions,
         CASE WHEN SUM(g.impressions) > 0
              THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2)
         END AS ctr_pct,
         CASE WHEN SUM(g.impressions) > 0
              THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2)
         END AS avg_position
       FROM gsc_search_daily g
       LEFT JOIN products p ON p.id = g.product_id
       WHERE 1=1${range.sql}${productSql}
       GROUP BY g.page_path, g.product_id, p.title_en
       ORDER BY SUM(g.clicks) DESC, SUM(g.impressions) DESC, g.page_path
       LIMIT 15`
    ).bind(...binds).all();

    const topQueries = await env.DB.prepare(
      `SELECT
         MIN(g.query_text) AS query_text,
         COUNT(DISTINCT g.page_path) AS pages,
         SUM(g.clicks) AS clicks,
         SUM(g.impressions) AS impressions,
         CASE WHEN SUM(g.impressions) > 0
              THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2)
         END AS ctr_pct,
         CASE WHEN SUM(g.impressions) > 0
              THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2)
         END AS avg_position
       FROM gsc_search_daily g
       WHERE 1=1${range.sql}${productSql}
       GROUP BY g.query_norm
       ORDER BY SUM(g.clicks) DESC, SUM(g.impressions) DESC, MIN(g.query_text)
       LIMIT 20`
    ).bind(...binds).all();

    const fresh: any = await env.DB.prepare(`SELECT * FROM analysis_gsc_freshness`).first();
    const latestReportDate = fresh?.latest_report_date || null;
    const anchorDate = f.end || latestReportDate || null;

    let trend: any = {
      anchor_date: anchorDate,
      current_start: null,
      previous_start: null,
      previous_end: null,
      clicks_28d: 0,
      impressions_28d: 0,
      ctr_28d: null,
      avg_position_28d: null,
      clicks_prev_28d: 0,
      impressions_prev_28d: 0,
      ctr_prev_28d: null,
      avg_position_prev_28d: null,
      clicks_growth_pct: null,
      impressions_growth_pct: null,
    };

    if (anchorDate) {
      const currentStart = shiftIsoDate(anchorDate, -27);
      const previousEnd = shiftIsoDate(anchorDate, -28);
      const previousStart = shiftIsoDate(anchorDate, -55);
      if (currentStart && previousEnd && previousStart) {
        let productTrendSql = "";
        const curBinds: any[] = [currentStart, anchorDate];
        const prevBinds: any[] = [previousStart, previousEnd];
        if (f.productId !== null) {
          productTrendSql = " AND g.product_id = ?";
          curBinds.push(f.productId);
          prevBinds.push(f.productId);
        }
        const cur: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(g.clicks), 0) AS clicks,
             COALESCE(SUM(g.impressions), 0) AS impressions,
             CASE WHEN SUM(g.impressions) > 0
                  THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2)
             END AS ctr_pct,
             CASE WHEN SUM(g.impressions) > 0
                  THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2)
             END AS avg_position
           FROM gsc_search_daily g
           WHERE g.report_date >= ? AND g.report_date <= ?${productTrendSql}`
        ).bind(...curBinds).first();

        const prev: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(g.clicks), 0) AS clicks,
             COALESCE(SUM(g.impressions), 0) AS impressions,
             CASE WHEN SUM(g.impressions) > 0
                  THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2)
             END AS ctr_pct,
             CASE WHEN SUM(g.impressions) > 0
                  THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2)
             END AS avg_position
           FROM gsc_search_daily g
           WHERE g.report_date >= ? AND g.report_date <= ?${productTrendSql}`
        ).bind(...prevBinds).first();

        const prevClicks = Number(prev?.clicks || 0);
        const prevImpr = Number(prev?.impressions || 0);
        const curClicks = Number(cur?.clicks || 0);
        const curImpr = Number(cur?.impressions || 0);

        trend = {
          anchor_date: anchorDate,
          current_start: currentStart,
          previous_start: previousStart,
          previous_end: previousEnd,
          clicks_28d: curClicks,
          impressions_28d: curImpr,
          ctr_28d: cur?.ctr_pct === null || cur?.ctr_pct === undefined ? null : Number(cur.ctr_pct),
          avg_position_28d: cur?.avg_position === null || cur?.avg_position === undefined ? null : Number(cur.avg_position),
          clicks_prev_28d: prevClicks,
          impressions_prev_28d: prevImpr,
          ctr_prev_28d: prev?.ctr_pct === null || prev?.ctr_pct === undefined ? null : Number(prev.ctr_pct),
          avg_position_prev_28d: prev?.avg_position === null || prev?.avg_position === undefined ? null : Number(prev.avg_position),
          clicks_growth_pct: prevClicks > 0 ? Math.round(((curClicks - prevClicks) * 10000) / prevClicks) / 100 : null,
          impressions_growth_pct: prevImpr > 0 ? Math.round(((curImpr - prevImpr) * 10000) / prevImpr) / 100 : null,
        };
      }
    }

    const rowsTotal = Number(fresh?.total_rows || 0);
    const gscDays = fresh?.days_since_latest_report === null || fresh?.days_since_latest_report === undefined
      ? null
      : Number(fresh.days_since_latest_report);
    const latestSyncStatus = String(fresh?.last_sync_status || "").toLowerCase() || null;
    const latestSyncAt = fresh?.last_sync_at || null;
    let freshnessStatus: "ok" | "warning" | "empty" = "empty";
    if (rowsTotal > 0) {
      freshnessStatus = "ok";
      if (gscDays !== null && gscDays > 4) freshnessStatus = "warning";
      if (latestSyncStatus && ["failed", "partial", "error"].includes(latestSyncStatus)) freshnessStatus = "warning";
    }

    return json({
      success: true,
      available: true,
      filters: { start: f.start, end: f.end, product_id: f.productId },
      summary: {
        queries: Number(summary?.queries || 0),
        pages: Number(summary?.pages || 0),
        clicks: Number(summary?.clicks || 0),
        impressions: Number(summary?.impressions || 0),
        ctr_pct: summary?.ctr_pct === null || summary?.ctr_pct === undefined ? null : Number(summary.ctr_pct),
        avg_position: summary?.avg_position === null || summary?.avg_position === undefined ? null : Number(summary.avg_position),
        mapped_clicks: Number(summary?.mapped_clicks || 0),
        mapped_impressions: Number(summary?.mapped_impressions || 0),
      },
      trend_28d: trend,
      freshness: {
        total_rows: rowsTotal,
        latest_report_date: latestReportDate,
        days_since_latest_report: gscDays,
        last_success_sync_at: fresh?.last_success_sync_at || null,
        last_sync_at: latestSyncAt,
        last_sync_status: latestSyncStatus,
        sync_errors_7d: Number(fresh?.sync_errors_7d || 0),
        status: freshnessStatus,
        caveat: "GSC data is typically delayed by 1–2 days; freshness warning threshold = 4 days.",
      },
      top_pages: topPages.results || [],
      top_queries: topQueries.results || [],
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("no such table: gsc_search_daily") || msg.includes("no such table: analysis_gsc_freshness")) {
      return json({
        success: true,
        available: false,
        message: "GSC schema is not available in this environment yet. Apply migration 046_gsc_analytics.sql.",
        filters: { start: f.start, end: f.end, product_id: f.productId },
      });
    }
    return err("GSC_QUERY_FAILED", msg, 500);
  }
}

async function getGa4(env: any, f: Filters): Promise<Response> {
  const GA4_SCOPE_WHERE = ` AND g.property_scope = 'website' AND g.property_id = '${GA4_WEBSITE_CANONICAL_PROPERTY_ID}' AND g.landing_page_path NOT LIKE '%/listing/%'`;
  const range = dayRangeWhere(f, "g.report_date");
  const binds: any[] = [...range.binds];
  let productSql = "";
  if (f.productId !== null) {
    productSql = " AND g.product_id = ?";
    binds.push(f.productId);
  }

  try {
    const summary: any = await env.DB.prepare(
      `SELECT
         COUNT(DISTINCT g.landing_page_path) AS landing_pages,
         COUNT(DISTINCT g.page_path) AS page_paths,
         COALESCE(SUM(g.sessions), 0) AS sessions,
         COALESCE(SUM(g.users), 0) AS users,
         COALESCE(SUM(g.engaged_sessions), 0) AS engaged_sessions,
         COALESCE(SUM(g.product_views), 0) AS product_views,
         COALESCE(SUM(g.add_to_cart), 0) AS add_to_cart,
         COALESCE(SUM(g.begin_checkout), 0) AS begin_checkout,
         COALESCE(SUM(g.purchases), 0) AS purchases,
         COALESCE(SUM(COALESCE(g.purchase_revenue, 0)), 0) AS purchase_revenue,
         CASE WHEN SUM(g.sessions) > 0
              THEN ROUND(SUM(g.engaged_sessions) * 100.0 / SUM(g.sessions), 2)
         END AS engagement_rate_pct,
         CASE WHEN SUM(g.sessions) > 0
              THEN ROUND(SUM(g.add_to_cart) * 100.0 / SUM(g.sessions), 2)
         END AS add_to_cart_rate_pct,
         CASE WHEN SUM(g.sessions) > 0
              THEN ROUND(SUM(g.begin_checkout) * 100.0 / SUM(g.sessions), 2)
         END AS checkout_rate_pct,
         CASE WHEN SUM(g.sessions) > 0
              THEN ROUND(SUM(g.purchases) * 100.0 / SUM(g.sessions), 2)
         END AS purchase_rate_pct,
         COALESCE(SUM(CASE WHEN g.product_id IS NOT NULL THEN g.sessions ELSE 0 END), 0) AS mapped_sessions
       FROM ga4_funnel_daily g
       WHERE 1=1${GA4_SCOPE_WHERE}${range.sql}${productSql}`
    )
      .bind(...binds)
      .first();

    const topPages = await env.DB.prepare(
      `SELECT
         g.landing_page_path,
         g.page_path,
         g.product_id,
         COALESCE(p.title_en, '(non-product)') AS product_title,
         SUM(g.sessions) AS sessions,
         SUM(g.users) AS users,
         SUM(g.product_views) AS product_views,
         SUM(g.add_to_cart) AS add_to_cart,
         SUM(g.begin_checkout) AS begin_checkout,
         SUM(g.purchases) AS purchases,
         SUM(COALESCE(g.purchase_revenue, 0)) AS purchase_revenue,
         CASE WHEN SUM(g.sessions) > 0
              THEN ROUND(SUM(g.purchases) * 100.0 / SUM(g.sessions), 2)
         END AS purchase_rate_pct
       FROM ga4_funnel_daily g
       LEFT JOIN products p ON p.id = g.product_id
       WHERE 1=1${GA4_SCOPE_WHERE}${range.sql}${productSql}
       GROUP BY g.landing_page_path, g.page_path, g.product_id, p.title_en
       ORDER BY SUM(g.sessions) DESC, SUM(g.purchases) DESC
       LIMIT 15`
    )
      .bind(...binds)
      .all();

    const bySource = await env.DB.prepare(
      `SELECT
         CASE
           WHEN length(trim(g.source)) = 0 THEN '(direct)'
           WHEN length(trim(g.medium)) = 0 THEN lower(g.source)
           ELSE lower(g.source) || ' / ' || lower(g.medium)
         END AS source_medium,
         SUM(g.sessions) AS sessions,
         SUM(g.purchases) AS purchases,
         SUM(COALESCE(g.purchase_revenue, 0)) AS purchase_revenue
       FROM ga4_funnel_daily g
       WHERE 1=1${GA4_SCOPE_WHERE}${range.sql}${productSql}
       GROUP BY source_medium
       ORDER BY SUM(g.sessions) DESC, SUM(g.purchases) DESC
       LIMIT 12`
    )
      .bind(...binds)
      .all();

    const fresh: any = await env.DB.prepare(`SELECT * FROM analysis_ga4_freshness`).first();
    const latestReportDate = fresh?.latest_report_date || null;
    const anchorDate = f.end || latestReportDate || null;

    let trend: any = {
      anchor_date: anchorDate,
      current_start: null,
      previous_start: null,
      previous_end: null,
      sessions_28d: 0,
      product_views_28d: 0,
      add_to_cart_28d: 0,
      begin_checkout_28d: 0,
      purchases_28d: 0,
      purchase_revenue_28d: 0,
      sessions_prev_28d: 0,
      product_views_prev_28d: 0,
      add_to_cart_prev_28d: 0,
      begin_checkout_prev_28d: 0,
      purchases_prev_28d: 0,
      purchase_revenue_prev_28d: 0,
      sessions_growth_pct: null,
      purchases_growth_pct: null,
      purchase_revenue_growth_pct: null,
    };

    if (anchorDate) {
      const currentStart = shiftIsoDate(anchorDate, -27);
      const previousEnd = shiftIsoDate(anchorDate, -28);
      const previousStart = shiftIsoDate(anchorDate, -55);
      if (currentStart && previousEnd && previousStart) {
        let productTrendSql = "";
        const curBinds: any[] = [currentStart, anchorDate];
        const prevBinds: any[] = [previousStart, previousEnd];
        if (f.productId !== null) {
          productTrendSql = " AND g.product_id = ?";
          curBinds.push(f.productId);
          prevBinds.push(f.productId);
        }

        const cur: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(g.sessions), 0) AS sessions,
             COALESCE(SUM(g.product_views), 0) AS product_views,
             COALESCE(SUM(g.add_to_cart), 0) AS add_to_cart,
             COALESCE(SUM(g.begin_checkout), 0) AS begin_checkout,
             COALESCE(SUM(g.purchases), 0) AS purchases,
             COALESCE(SUM(COALESCE(g.purchase_revenue, 0)), 0) AS purchase_revenue
           FROM ga4_funnel_daily g
           WHERE g.report_date >= ? AND g.report_date <= ?${GA4_SCOPE_WHERE}${productTrendSql}`
        )
          .bind(...curBinds)
          .first();

        const prev: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(g.sessions), 0) AS sessions,
             COALESCE(SUM(g.product_views), 0) AS product_views,
             COALESCE(SUM(g.add_to_cart), 0) AS add_to_cart,
             COALESCE(SUM(g.begin_checkout), 0) AS begin_checkout,
             COALESCE(SUM(g.purchases), 0) AS purchases,
             COALESCE(SUM(COALESCE(g.purchase_revenue, 0)), 0) AS purchase_revenue
           FROM ga4_funnel_daily g
           WHERE g.report_date >= ? AND g.report_date <= ?${GA4_SCOPE_WHERE}${productTrendSql}`
        )
          .bind(...prevBinds)
          .first();

        const prevSessions = Number(prev?.sessions || 0);
        const prevPurchases = Number(prev?.purchases || 0);
        const prevRevenue = Number(prev?.purchase_revenue || 0);
        const curSessions = Number(cur?.sessions || 0);
        const curPurchases = Number(cur?.purchases || 0);
        const curRevenue = Number(cur?.purchase_revenue || 0);

        trend = {
          anchor_date: anchorDate,
          current_start: currentStart,
          previous_start: previousStart,
          previous_end: previousEnd,
          sessions_28d: curSessions,
          product_views_28d: Number(cur?.product_views || 0),
          add_to_cart_28d: Number(cur?.add_to_cart || 0),
          begin_checkout_28d: Number(cur?.begin_checkout || 0),
          purchases_28d: curPurchases,
          purchase_revenue_28d: curRevenue,
          sessions_prev_28d: prevSessions,
          product_views_prev_28d: Number(prev?.product_views || 0),
          add_to_cart_prev_28d: Number(prev?.add_to_cart || 0),
          begin_checkout_prev_28d: Number(prev?.begin_checkout || 0),
          purchases_prev_28d: prevPurchases,
          purchase_revenue_prev_28d: prevRevenue,
          sessions_growth_pct: prevSessions > 0 ? Math.round(((curSessions - prevSessions) * 10000) / prevSessions) / 100 : null,
          purchases_growth_pct: prevPurchases > 0 ? Math.round(((curPurchases - prevPurchases) * 10000) / prevPurchases) / 100 : null,
          purchase_revenue_growth_pct: prevRevenue > 0 ? Math.round(((curRevenue - prevRevenue) * 10000) / prevRevenue) / 100 : null,
        };
      }
    }

    const rowsTotal = Number(fresh?.total_rows || 0);
    const ga4Days =
      fresh?.days_since_latest_report === null || fresh?.days_since_latest_report === undefined
        ? null
        : Number(fresh.days_since_latest_report);
    const latestSyncStatus = String(fresh?.last_sync_status || "").toLowerCase() || null;
    let freshnessStatus: "ok" | "warning" | "empty" = "empty";
    if (rowsTotal > 0) {
      freshnessStatus = "ok";
      if (ga4Days !== null && ga4Days > 3) freshnessStatus = "warning";
      if (latestSyncStatus && ["failed", "partial", "error"].includes(latestSyncStatus)) freshnessStatus = "warning";
    }

    return json({
      success: true,
      available: true,
      filters: { start: f.start, end: f.end, product_id: f.productId },
      summary: {
        landing_pages: Number(summary?.landing_pages || 0),
        page_paths: Number(summary?.page_paths || 0),
        sessions: Number(summary?.sessions || 0),
        users: Number(summary?.users || 0),
        engaged_sessions: Number(summary?.engaged_sessions || 0),
        product_views: Number(summary?.product_views || 0),
        add_to_cart: Number(summary?.add_to_cart || 0),
        begin_checkout: Number(summary?.begin_checkout || 0),
        purchases: Number(summary?.purchases || 0),
        purchase_revenue: Number(summary?.purchase_revenue || 0),
        engagement_rate_pct:
          summary?.engagement_rate_pct === null || summary?.engagement_rate_pct === undefined
            ? null
            : Number(summary.engagement_rate_pct),
        add_to_cart_rate_pct:
          summary?.add_to_cart_rate_pct === null || summary?.add_to_cart_rate_pct === undefined
            ? null
            : Number(summary.add_to_cart_rate_pct),
        checkout_rate_pct:
          summary?.checkout_rate_pct === null || summary?.checkout_rate_pct === undefined
            ? null
            : Number(summary.checkout_rate_pct),
        purchase_rate_pct:
          summary?.purchase_rate_pct === null || summary?.purchase_rate_pct === undefined
            ? null
            : Number(summary.purchase_rate_pct),
        mapped_sessions: Number(summary?.mapped_sessions || 0),
      },
      trend_28d: trend,
      freshness: {
        total_rows: rowsTotal,
        latest_report_date: latestReportDate,
        days_since_latest_report: ga4Days,
        last_success_sync_at: fresh?.last_success_sync_at || null,
        last_sync_at: fresh?.last_sync_at || null,
        last_sync_status: latestSyncStatus,
        sync_errors_7d: Number(fresh?.sync_errors_7d || 0),
        status: freshnessStatus,
        caveat: "GA4 event data may finalize with delay; freshness warning threshold = 3 days.",
      },
      top_pages: topPages.results || [],
      top_sources: bySource.results || [],
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (
      msg.includes("no such table: ga4_funnel_daily") ||
      msg.includes("no such table: analysis_ga4_freshness") ||
      msg.includes("no such column: g.property_scope")
    ) {
      return json({
        success: true,
        available: false,
        message: "GA4 schema is not available in this environment yet. Apply migrations 048_ga4_analytics.sql and 055_ga4_multi_property.sql.",
        filters: { start: f.start, end: f.end, product_id: f.productId },
      });
    }
    return err("GA4_QUERY_FAILED", msg, 500);
  }
}

async function getGa4Leads(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f, "g.report_date");
  const binds: any[] = [...range.binds];

  try {
    const summary: any = await env.DB.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN g.event_name = 'generate_lead' THEN g.event_count ELSE 0 END), 0) AS generate_lead_events,
         COALESCE(SUM(CASE WHEN g.event_name = 'quote_request' THEN g.event_count ELSE 0 END), 0) AS quote_request_events,
         COALESCE(SUM(CASE WHEN g.event_name = 'generate_lead' AND g.users_available = 1 THEN COALESCE(g.event_users, 0) ELSE 0 END), 0) AS generate_lead_users_sum,
         COALESCE(SUM(CASE WHEN g.event_name = 'quote_request' AND g.users_available = 1 THEN COALESCE(g.event_users, 0) ELSE 0 END), 0) AS quote_request_users_sum,
         COALESCE(MIN(CASE WHEN g.event_name = 'generate_lead' THEN g.users_available ELSE 1 END), 1) AS generate_lead_users_available,
         COALESCE(MIN(CASE WHEN g.event_name = 'quote_request' THEN g.users_available ELSE 1 END), 1) AS quote_request_users_available,
         COUNT(*) AS rows_count
       FROM ga4_lead_acquisition_daily g
      WHERE g.property_id = ?${range.sql}`
    ).bind(GA4_LEAD_CANONICAL_PROPERTY_ID, ...binds).first();

    const trendRows = await env.DB.prepare(
      `SELECT
         g.report_date,
         g.event_name,
         SUM(g.event_count) AS event_count,
         SUM(CASE WHEN g.users_available = 1 THEN COALESCE(g.event_users, 0) ELSE 0 END) AS event_users_sum,
         MIN(g.users_available) AS users_available
       FROM ga4_lead_acquisition_daily g
      WHERE g.property_id = ?${range.sql}
      GROUP BY g.report_date, g.event_name
      ORDER BY g.report_date DESC, g.event_name ASC
      LIMIT 120`
    ).bind(GA4_LEAD_CANONICAL_PROPERTY_ID, ...binds).all();

    const sourceRows = await env.DB.prepare(
      `SELECT
         g.session_source,
         g.session_medium,
         g.event_name,
         SUM(g.event_count) AS event_count,
         SUM(CASE WHEN g.users_available = 1 THEN COALESCE(g.event_users, 0) ELSE 0 END) AS event_users_sum,
         MIN(g.users_available) AS users_available
       FROM ga4_lead_acquisition_daily g
      WHERE g.property_id = ?${range.sql}
      GROUP BY g.session_source, g.session_medium, g.event_name
      ORDER BY SUM(g.event_count) DESC, g.session_source ASC, g.session_medium ASC
      LIMIT 120`
    ).bind(GA4_LEAD_CANONICAL_PROPERTY_ID, ...binds).all();

    const campaignRows = await env.DB.prepare(
      `SELECT
         g.session_campaign,
         g.event_name,
         SUM(g.event_count) AS event_count,
         SUM(CASE WHEN g.users_available = 1 THEN COALESCE(g.event_users, 0) ELSE 0 END) AS event_users_sum,
         MIN(g.users_available) AS users_available
       FROM ga4_lead_acquisition_daily g
      WHERE g.property_id = ?${range.sql}
      GROUP BY g.session_campaign, g.event_name
      ORDER BY SUM(g.event_count) DESC, g.session_campaign ASC
      LIMIT 120`
    ).bind(GA4_LEAD_CANONICAL_PROPERTY_ID, ...binds).all();

    let freshness: any = null;
    try {
      freshness = await env.DB.prepare(`SELECT * FROM analysis_ga4_lead_freshness`).first();
    } catch {
      freshness = null;
    }

    const overlapRow: any = await env.DB.prepare(
      `SELECT
         COUNT(*) AS overlap_days,
         MIN(report_date) AS overlap_start,
         MAX(report_date) AS overlap_end
       FROM (
         SELECT report_date
           FROM ga4_funnel_daily
          WHERE property_scope = 'website'
          GROUP BY report_date
         HAVING COUNT(DISTINCT property_id) > 1
       ) t`
    ).first();
    const websitePropertyRow: any = await env.DB.prepare(
      `SELECT GROUP_CONCAT(DISTINCT property_id) AS property_ids
         FROM ga4_funnel_daily
        WHERE property_scope = 'website'`
    ).first();
    const coverage: any = await env.DB.prepare(
      `SELECT MIN(report_date) AS min_report_date, MAX(report_date) AS max_report_date, COUNT(*) AS rows_n
         FROM ga4_lead_acquisition_daily
        WHERE property_id = ?`
    ).bind(GA4_LEAD_CANONICAL_PROPERTY_ID).first();

    const trendMap = new Map<string, any>();
    for (const r of trendRows.results || []) {
      const day = String(r.report_date || "");
      if (!day) continue;
      if (!trendMap.has(day)) {
        trendMap.set(day, {
          report_date: day,
          generate_lead_events: 0,
          generate_lead_users: null,
          generate_lead_users_available: false,
          quote_request_events: 0,
          quote_request_users: null,
          quote_request_users_available: false,
        });
      }
      const t = trendMap.get(day);
      const usersAvailable = Number(r.users_available || 0) === 1;
      if (String(r.event_name || "") === "generate_lead") {
        t.generate_lead_events = Number(r.event_count || 0);
        t.generate_lead_users_available = usersAvailable;
        t.generate_lead_users = usersAvailable ? Number(r.event_users_sum || 0) : null;
      } else if (String(r.event_name || "") === "quote_request") {
        t.quote_request_events = Number(r.event_count || 0);
        t.quote_request_users_available = usersAvailable;
        t.quote_request_users = usersAvailable ? Number(r.event_users_sum || 0) : null;
      }
    }
    const trend = [...trendMap.values()].sort((a, b) => String(b.report_date).localeCompare(String(a.report_date)));

    const sourceMap = new Map<string, any>();
    for (const r of sourceRows.results || []) {
      const sourceKey = ga4LeadSourceMediumLabel(r.session_source, r.session_medium);
      if (!sourceMap.has(sourceKey)) {
        sourceMap.set(sourceKey, {
          source_medium: sourceKey,
          generate_lead_events: 0,
          generate_lead_users: null,
          generate_lead_users_available: false,
          quote_request_events: 0,
          quote_request_users: null,
          quote_request_users_available: false,
        });
      }
      const s = sourceMap.get(sourceKey);
      const usersAvailable = Number(r.users_available || 0) === 1;
      if (String(r.event_name || "") === "generate_lead") {
        s.generate_lead_events = Number(r.event_count || 0);
        s.generate_lead_users_available = usersAvailable;
        s.generate_lead_users = usersAvailable ? Number(r.event_users_sum || 0) : null;
      } else if (String(r.event_name || "") === "quote_request") {
        s.quote_request_events = Number(r.event_count || 0);
        s.quote_request_users_available = usersAvailable;
        s.quote_request_users = usersAvailable ? Number(r.event_users_sum || 0) : null;
      }
    }
    const sources = [...sourceMap.values()]
      .sort((a, b) => (b.generate_lead_events + b.quote_request_events) - (a.generate_lead_events + a.quote_request_events))
      .slice(0, 20);

    const campaignMap = new Map<string, any>();
    for (const r of campaignRows.results || []) {
      const campaignKey = ga4LeadLabel(r.session_campaign);
      if (!campaignMap.has(campaignKey)) {
        campaignMap.set(campaignKey, {
          campaign: campaignKey,
          generate_lead_events: 0,
          generate_lead_users: null,
          generate_lead_users_available: false,
          quote_request_events: 0,
          quote_request_users: null,
          quote_request_users_available: false,
        });
      }
      const c = campaignMap.get(campaignKey);
      const usersAvailable = Number(r.users_available || 0) === 1;
      if (String(r.event_name || "") === "generate_lead") {
        c.generate_lead_events = Number(r.event_count || 0);
        c.generate_lead_users_available = usersAvailable;
        c.generate_lead_users = usersAvailable ? Number(r.event_users_sum || 0) : null;
      } else if (String(r.event_name || "") === "quote_request") {
        c.quote_request_events = Number(r.event_count || 0);
        c.quote_request_users_available = usersAvailable;
        c.quote_request_users = usersAvailable ? Number(r.event_users_sum || 0) : null;
      }
    }
    const campaigns = [...campaignMap.values()]
      .sort((a, b) => (b.generate_lead_events + b.quote_request_events) - (a.generate_lead_events + a.quote_request_events))
      .slice(0, 20);

    const rowsTotal = Number(summary?.rows_count || 0);
    const freshDays =
      freshness?.days_since_latest_report === null || freshness?.days_since_latest_report === undefined
        ? null
        : Number(freshness.days_since_latest_report);
    const latestSyncStatus = String(freshness?.last_sync_status || "").toLowerCase() || null;
    let freshnessStatus: "ok" | "warning" | "empty" = "empty";
    if (rowsTotal > 0) {
      freshnessStatus = "ok";
      if (freshDays !== null && freshDays > 10) freshnessStatus = "warning";
      if (latestSyncStatus && ["failed", "partial", "error"].includes(latestSyncStatus)) freshnessStatus = "warning";
    }

    const overlapDays = Number(overlapRow?.overlap_days || 0);
    const limitations: string[] = [
      "Canonical property only: GA4 Lead Acquisition uses property 308922589 and does not merge legacy website property 366290587.",
      "Events are reported separately (`generate_lead`, `quote_request`) and are never merged into a fabricated unique-lead total.",
      "GA4 channel attribution is directional analytics context and does not imply paid-click proof for Google Ads.",
    ];
    if (overlapDays > 0) {
      limitations.push(
        `Historical website GA4 overlap detected in ga4_funnel_daily across multiple property IDs for ${overlapDays} day(s) (${overlapRow?.overlap_start || "?"} → ${overlapRow?.overlap_end || "?"}); this lead section avoids blending by using canonical property 308922589 only.`
      );
    }
    if (!coverage?.min_report_date) {
      limitations.push("No lead-acquisition rows are currently stored for the canonical property in this environment.");
    } else {
      limitations.push(
        `Stored lead-acquisition coverage in this environment is ${coverage.min_report_date} → ${coverage.max_report_date}; dates outside this window require future sync/backfill approval.`
      );
    }

    return json({
      success: true,
      available: true,
      filters: { start: f.start, end: f.end },
      property: {
        canonical_property_id: GA4_LEAD_CANONICAL_PROPERTY_ID,
        website_property_ids_seen: String(websitePropertyRow?.property_ids || "").split(",").filter(Boolean),
        overlap_days: overlapDays,
        overlap_start: overlapRow?.overlap_start || null,
        overlap_end: overlapRow?.overlap_end || null,
      },
      summary: {
        generate_lead_events: Number(summary?.generate_lead_events || 0),
        generate_lead_users: Number(summary?.generate_lead_users_available || 0) === 1 ? Number(summary?.generate_lead_users_sum || 0) : null,
        generate_lead_users_available: Number(summary?.generate_lead_users_available || 0) === 1,
        quote_request_events: Number(summary?.quote_request_events || 0),
        quote_request_users: Number(summary?.quote_request_users_available || 0) === 1 ? Number(summary?.quote_request_users_sum || 0) : null,
        quote_request_users_available: Number(summary?.quote_request_users_available || 0) === 1,
      },
      trend_daily: trend,
      top_sources: sources,
      top_campaigns: campaigns,
      freshness: {
        total_rows: Number(freshness?.total_rows || rowsTotal),
        latest_report_date: freshness?.latest_report_date || coverage?.max_report_date || null,
        days_since_latest_report: freshDays,
        last_success_sync_at: freshness?.last_success_sync_at || null,
        last_sync_at: freshness?.last_sync_at || null,
        last_sync_status: latestSyncStatus,
        sync_errors_7d: Number(freshness?.sync_errors_7d || 0),
        status: freshnessStatus,
      },
      coverage: {
        min_report_date: coverage?.min_report_date || null,
        max_report_date: coverage?.max_report_date || null,
        rows_n: Number(coverage?.rows_n || 0),
      },
      limitations,
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (
      msg.includes("no such table: ga4_lead_acquisition_daily") ||
      msg.includes("no such table: analysis_ga4_lead_freshness")
    ) {
      return json({
        success: true,
        available: false,
        message: "GA4 lead-acquisition schema is not available in this environment yet. Apply migration 061_ga4_lead_acquisition.sql.",
        filters: { start: f.start, end: f.end },
      });
    }
    return err("GA4_LEADS_QUERY_FAILED", msg, 500);
  }
}

async function getEtsy(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f, "e.report_date");
  const binds: any[] = [...range.binds];
  let productSql = "";
  if (f.productId !== null) {
    productSql = " AND e.product_id = ?";
    binds.push(f.productId);
  }

  try {
    const summary: any = await env.DB.prepare(
      `SELECT
         COUNT(DISTINCT e.listing_id) AS listings,
         COUNT(DISTINCT CASE WHEN e.is_active = 1 THEN e.listing_id END) AS active_listings,
         COALESCE(SUM(e.visits), 0) AS visits,
         COALESCE(SUM(e.views), 0) AS views,
         COALESCE(SUM(e.favorites), 0) AS favorites,
         COALESCE(SUM(e.orders), 0) AS orders,
         COALESCE(SUM(e.transactions), 0) AS transactions,
         COALESCE(SUM(e.units_sold), 0) AS units_sold,
         COALESCE(SUM(COALESCE(e.revenue, 0)), 0) AS revenue,
         COALESCE(SUM(COALESCE(e.revenue_thb, 0)), 0) AS revenue_thb,
         COALESCE(SUM(CASE WHEN e.product_id IS NOT NULL THEN e.views ELSE 0 END), 0) AS mapped_views,
         COALESCE(SUM(CASE WHEN e.product_id IS NOT NULL THEN e.orders ELSE 0 END), 0) AS mapped_orders
       FROM etsy_listing_daily e
       WHERE 1=1${range.sql}${productSql}`
    )
      .bind(...binds)
      .first();

    const topListings = await env.DB.prepare(
      `SELECT
         e.listing_id,
         MIN(e.listing_title) AS listing_title,
         MIN(e.listing_state) AS listing_state,
         MAX(e.is_active) AS is_active,
         MIN(e.currency) AS currency,
         e.product_id,
         COALESCE(p.title_en, '(unmapped)') AS product_title,
         SUM(e.visits) AS visits,
         SUM(e.views) AS views,
         SUM(e.favorites) AS favorites,
         SUM(e.orders) AS orders,
         SUM(e.transactions) AS transactions,
         SUM(e.units_sold) AS units_sold,
         SUM(COALESCE(e.revenue_thb, 0)) AS revenue_thb
       FROM etsy_listing_daily e
       LEFT JOIN products p ON p.id = e.product_id
       WHERE 1=1${range.sql}${productSql}
       GROUP BY e.listing_id, e.product_id, p.title_en
       ORDER BY SUM(e.views) DESC, SUM(e.orders) DESC, e.listing_id
       LIMIT 20`
    )
      .bind(...binds)
      .all();

    const topProducts = await env.DB.prepare(
      `SELECT
         e.product_id,
         p.slug AS product_slug,
         p.title_en AS product_title,
         COUNT(DISTINCT e.listing_id) AS listing_count,
         SUM(e.visits) AS visits,
         SUM(e.views) AS views,
         SUM(e.favorites) AS favorites,
         SUM(e.orders) AS orders,
         SUM(e.transactions) AS transactions,
         SUM(e.units_sold) AS units_sold,
         SUM(COALESCE(e.revenue_thb, 0)) AS revenue_thb
       FROM etsy_listing_daily e
       JOIN products p ON p.id = e.product_id
       WHERE e.product_id IS NOT NULL${range.sql}${productSql}
       GROUP BY e.product_id, p.slug, p.title_en
       ORDER BY SUM(e.views) DESC, SUM(e.orders) DESC, e.product_id
       LIMIT 15`
    )
      .bind(...binds)
      .all();

    const fresh: any = await env.DB.prepare(`SELECT * FROM analysis_etsy_freshness`).first();
    const statusRow: any = await env.DB.prepare(`SELECT * FROM analysis_etsy_listing_status`).first();
    const byState = await env.DB.prepare(
      `SELECT
         listing_state,
         is_active,
         COUNT(*) AS listings,
         SUM(CASE WHEN product_id IS NOT NULL THEN 1 ELSE 0 END) AS mapped_listings
       FROM etsy_listing_master
       GROUP BY listing_state, is_active
       ORDER BY listings DESC, listing_state`
    ).all();

    const latestReportDate = fresh?.latest_report_date || null;
    const anchorDate = f.end || latestReportDate || null;

    let trend: any = {
      anchor_date: anchorDate,
      current_start: null,
      previous_start: null,
      previous_end: null,
      views_28d: 0,
      favorites_28d: 0,
      orders_28d: 0,
      transactions_28d: 0,
      units_sold_28d: 0,
      revenue_thb_28d: 0,
      views_prev_28d: 0,
      favorites_prev_28d: 0,
      orders_prev_28d: 0,
      transactions_prev_28d: 0,
      units_sold_prev_28d: 0,
      revenue_thb_prev_28d: 0,
      views_growth_pct: null,
      orders_growth_pct: null,
      revenue_growth_pct: null,
    };

    if (anchorDate) {
      const currentStart = shiftIsoDate(anchorDate, -27);
      const previousEnd = shiftIsoDate(anchorDate, -28);
      const previousStart = shiftIsoDate(anchorDate, -55);
      if (currentStart && previousEnd && previousStart) {
        let productTrendSql = "";
        const curBinds: any[] = [currentStart, anchorDate];
        const prevBinds: any[] = [previousStart, previousEnd];
        if (f.productId !== null) {
          productTrendSql = " AND e.product_id = ?";
          curBinds.push(f.productId);
          prevBinds.push(f.productId);
        }

        const cur: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(e.views), 0) AS views,
             COALESCE(SUM(e.favorites), 0) AS favorites,
             COALESCE(SUM(e.orders), 0) AS orders,
             COALESCE(SUM(e.transactions), 0) AS transactions,
             COALESCE(SUM(e.units_sold), 0) AS units_sold,
             COALESCE(SUM(COALESCE(e.revenue_thb, 0)), 0) AS revenue_thb
           FROM etsy_listing_daily e
           WHERE e.report_date >= ? AND e.report_date <= ?${productTrendSql}`
        )
          .bind(...curBinds)
          .first();

        const prev: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(e.views), 0) AS views,
             COALESCE(SUM(e.favorites), 0) AS favorites,
             COALESCE(SUM(e.orders), 0) AS orders,
             COALESCE(SUM(e.transactions), 0) AS transactions,
             COALESCE(SUM(e.units_sold), 0) AS units_sold,
             COALESCE(SUM(COALESCE(e.revenue_thb, 0)), 0) AS revenue_thb
           FROM etsy_listing_daily e
           WHERE e.report_date >= ? AND e.report_date <= ?${productTrendSql}`
        )
          .bind(...prevBinds)
          .first();

        const prevViews = Number(prev?.views || 0);
        const prevOrders = Number(prev?.orders || 0);
        const prevRevenue = Number(prev?.revenue_thb || 0);
        const curViews = Number(cur?.views || 0);
        const curOrders = Number(cur?.orders || 0);
        const curRevenue = Number(cur?.revenue_thb || 0);

        trend = {
          anchor_date: anchorDate,
          current_start: currentStart,
          previous_start: previousStart,
          previous_end: previousEnd,
          views_28d: curViews,
          favorites_28d: Number(cur?.favorites || 0),
          orders_28d: curOrders,
          transactions_28d: Number(cur?.transactions || 0),
          units_sold_28d: Number(cur?.units_sold || 0),
          revenue_thb_28d: curRevenue,
          views_prev_28d: prevViews,
          favorites_prev_28d: Number(prev?.favorites || 0),
          orders_prev_28d: prevOrders,
          transactions_prev_28d: Number(prev?.transactions || 0),
          units_sold_prev_28d: Number(prev?.units_sold || 0),
          revenue_thb_prev_28d: prevRevenue,
          views_growth_pct: prevViews > 0 ? Math.round(((curViews - prevViews) * 10000) / prevViews) / 100 : null,
          orders_growth_pct: prevOrders > 0 ? Math.round(((curOrders - prevOrders) * 10000) / prevOrders) / 100 : null,
          revenue_growth_pct: prevRevenue > 0 ? Math.round(((curRevenue - prevRevenue) * 10000) / prevRevenue) / 100 : null,
        };
      }
    }

    const rowsTotal = Number(fresh?.total_rows || 0);
    const etsyDays =
      fresh?.days_since_latest_report === null || fresh?.days_since_latest_report === undefined
        ? null
        : Number(fresh.days_since_latest_report);
    const latestSyncStatus = String(fresh?.last_sync_status || "").toLowerCase() || null;
    let freshnessStatus: "ok" | "warning" | "empty" = "empty";
    if (rowsTotal > 0) {
      freshnessStatus = "ok";
      if (etsyDays !== null && etsyDays > 7) freshnessStatus = "warning";
      if (latestSyncStatus && ["failed", "partial", "error"].includes(latestSyncStatus)) freshnessStatus = "warning";
    }

    return json({
      success: true,
      available: true,
      filters: { start: f.start, end: f.end, product_id: f.productId },
      summary: {
        listings: Number(summary?.listings || 0),
        active_listings: Number(summary?.active_listings || 0),
        visits: Number(summary?.visits || 0),
        views: Number(summary?.views || 0),
        favorites: Number(summary?.favorites || 0),
        orders: Number(summary?.orders || 0),
        transactions: Number(summary?.transactions || 0),
        units_sold: Number(summary?.units_sold || 0),
        revenue: Number(summary?.revenue || 0),
        revenue_thb: Number(summary?.revenue_thb || 0),
        mapped_views: Number(summary?.mapped_views || 0),
        mapped_orders: Number(summary?.mapped_orders || 0),
      },
      trend_28d: trend,
      freshness: {
        total_rows: rowsTotal,
        latest_report_date: latestReportDate,
        days_since_latest_report: etsyDays,
        last_success_sync_at: fresh?.last_success_sync_at || null,
        last_sync_at: fresh?.last_sync_at || null,
        last_sync_status: latestSyncStatus,
        sync_errors_7d: Number(fresh?.sync_errors_7d || 0),
        status: freshnessStatus,
        caveat: "Etsy metrics depend on source exports/API windows; freshness warning threshold = 7 days.",
      },
      listing_status: {
        total_listings: Number(statusRow?.total_listings || 0),
        active_listings: Number(statusRow?.active_listings || 0),
        inactive_listings: Number(statusRow?.inactive_listings || 0),
        mapped_listings: Number(statusRow?.mapped_listings || 0),
        unmapped_listings: Number(statusRow?.unmapped_listings || 0),
        last_listing_sync_at: statusRow?.last_listing_sync_at || null,
        by_state: byState.results || [],
      },
      top_listings: topListings.results || [],
      top_products: topProducts.results || [],
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (
      msg.includes("no such table: etsy_listing_daily") ||
      msg.includes("no such table: etsy_listing_master") ||
      msg.includes("no such table: analysis_etsy_freshness")
    ) {
      return json({
        success: true,
        available: false,
        message: "Etsy schema is not available in this environment yet. Apply migration 049_etsy_analytics.sql.",
        filters: { start: f.start, end: f.end, product_id: f.productId },
      });
    }
    return err("ETSY_QUERY_FAILED", msg, 500);
  }
}

async function getGoogleAds(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f, "a.report_date");
  const binds: any[] = [...range.binds];
  let productSql = "";
  if (f.productId !== null) {
    productSql = " AND a.product_id = ?";
    binds.push(f.productId);
  }

  try {
    const summary: any = await env.DB.prepare(
      `SELECT
         COUNT(DISTINCT a.campaign_id) AS campaigns,
         COUNT(DISTINCT CASE WHEN length(trim(a.ad_group_id)) > 0 THEN a.ad_group_id END) AS ad_groups,
         COALESCE(SUM(a.impressions), 0) AS impressions,
         COALESCE(SUM(a.clicks), 0) AS clicks,
         COALESCE(SUM(a.cost), 0) AS cost,
         COALESCE(SUM(a.conversions), 0) AS conversions,
         COALESCE(SUM(a.conversion_value), 0) AS conversion_value,
         COALESCE(SUM(COALESCE(a.all_conversions, 0)), 0) AS all_conversions,
         COALESCE(SUM(COALESCE(a.all_conversions_value, 0)), 0) AS all_conversions_value,
         CASE WHEN SUM(a.impressions) > 0
              THEN ROUND(SUM(a.clicks) * 100.0 / SUM(a.impressions), 2)
         END AS ctr_pct,
         CASE WHEN SUM(a.clicks) > 0
              THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2)
         END AS cpc,
         CASE WHEN SUM(a.conversions) > 0
              THEN ROUND(SUM(a.cost) / SUM(a.conversions), 2)
         END AS cpa,
         CASE WHEN SUM(a.cost) > 0
              THEN ROUND(SUM(a.conversion_value) / SUM(a.cost), 2)
         END AS roas,
         COALESCE(SUM(CASE WHEN a.product_id IS NOT NULL THEN a.cost ELSE 0 END), 0) AS mapped_cost
       FROM google_ads_campaign_daily a
       WHERE 1=1${range.sql}${productSql}`
    )
      .bind(...binds)
      .first();

    const topCampaigns = await env.DB.prepare(
      `SELECT
         a.campaign_id,
         MIN(a.campaign_name) AS campaign_name,
         a.ad_group_id,
         MIN(a.ad_group_name) AS ad_group_name,
         MIN(a.channel_type) AS channel_type,
         MIN(a.network) AS network,
         MIN(a.device) AS device,
         a.product_id,
         COALESCE(p.title_en, '(unmapped)') AS product_title,
         SUM(a.impressions) AS impressions,
         SUM(a.clicks) AS clicks,
         SUM(a.cost) AS cost,
         SUM(a.conversions) AS conversions,
         SUM(a.conversion_value) AS conversion_value,
         CASE WHEN SUM(a.impressions) > 0
              THEN ROUND(SUM(a.clicks) * 100.0 / SUM(a.impressions), 2)
         END AS ctr_pct,
         CASE WHEN SUM(a.clicks) > 0
              THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2)
         END AS cpc,
         CASE WHEN SUM(a.conversions) > 0
              THEN ROUND(SUM(a.cost) / SUM(a.conversions), 2)
         END AS cpa,
         CASE WHEN SUM(a.cost) > 0
              THEN ROUND(SUM(a.conversion_value) / SUM(a.cost), 2)
         END AS roas
       FROM google_ads_campaign_daily a
       LEFT JOIN products p ON p.id = a.product_id
       WHERE 1=1${range.sql}${productSql}
       GROUP BY a.campaign_id, a.ad_group_id, a.product_id, p.title_en
       ORDER BY SUM(a.cost) DESC, SUM(a.conversions) DESC, a.campaign_id
       LIMIT 20`
    )
      .bind(...binds)
      .all();

    const topProducts = await env.DB.prepare(
      `SELECT
         a.product_id,
         p.slug AS product_slug,
         p.title_en AS product_title,
         COUNT(DISTINCT a.campaign_id) AS campaign_count,
         COUNT(DISTINCT CASE WHEN length(trim(a.ad_group_id)) > 0 THEN a.ad_group_id END) AS ad_group_count,
         SUM(a.impressions) AS impressions,
         SUM(a.clicks) AS clicks,
         SUM(a.cost) AS cost,
         SUM(a.conversions) AS conversions,
         SUM(a.conversion_value) AS conversion_value,
         CASE WHEN SUM(a.impressions) > 0
              THEN ROUND(SUM(a.clicks) * 100.0 / SUM(a.impressions), 2)
         END AS ctr_pct,
         CASE WHEN SUM(a.clicks) > 0
              THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2)
         END AS cpc,
         CASE WHEN SUM(a.conversions) > 0
              THEN ROUND(SUM(a.cost) / SUM(a.conversions), 2)
         END AS cpa,
         CASE WHEN SUM(a.cost) > 0
              THEN ROUND(SUM(a.conversion_value) / SUM(a.cost), 2)
         END AS roas
       FROM google_ads_campaign_daily a
       JOIN products p ON p.id = a.product_id
       WHERE a.product_id IS NOT NULL${range.sql}${productSql}
       GROUP BY a.product_id, p.slug, p.title_en
       ORDER BY SUM(a.cost) DESC, SUM(a.conversions) DESC, a.product_id
       LIMIT 15`
    )
      .bind(...binds)
      .all();

    const fresh: any = await env.DB.prepare(`SELECT * FROM analysis_google_ads_freshness`).first();
    const latestReportDate = fresh?.latest_report_date || null;
    const anchorDate = f.end || latestReportDate || null;

    let trend: any = {
      anchor_date: anchorDate,
      current_start: null,
      previous_start: null,
      previous_end: null,
      cost_28d: 0,
      clicks_28d: 0,
      impressions_28d: 0,
      conversions_28d: 0,
      conversion_value_28d: 0,
      cpa_28d: null,
      roas_28d: null,
      cost_prev_28d: 0,
      clicks_prev_28d: 0,
      impressions_prev_28d: 0,
      conversions_prev_28d: 0,
      conversion_value_prev_28d: 0,
      cpa_prev_28d: null,
      roas_prev_28d: null,
      cost_growth_pct: null,
      conversions_growth_pct: null,
      conversion_value_growth_pct: null,
    };

    if (anchorDate) {
      const currentStart = shiftIsoDate(anchorDate, -27);
      const previousEnd = shiftIsoDate(anchorDate, -28);
      const previousStart = shiftIsoDate(anchorDate, -55);
      if (currentStart && previousEnd && previousStart) {
        let productTrendSql = "";
        const curBinds: any[] = [currentStart, anchorDate];
        const prevBinds: any[] = [previousStart, previousEnd];
        if (f.productId !== null) {
          productTrendSql = " AND a.product_id = ?";
          curBinds.push(f.productId);
          prevBinds.push(f.productId);
        }

        const cur: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(a.cost), 0) AS cost,
             COALESCE(SUM(a.clicks), 0) AS clicks,
             COALESCE(SUM(a.impressions), 0) AS impressions,
             COALESCE(SUM(a.conversions), 0) AS conversions,
             COALESCE(SUM(a.conversion_value), 0) AS conversion_value
           FROM google_ads_campaign_daily a
           WHERE a.report_date >= ? AND a.report_date <= ?${productTrendSql}`
        )
          .bind(...curBinds)
          .first();

        const prev: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(a.cost), 0) AS cost,
             COALESCE(SUM(a.clicks), 0) AS clicks,
             COALESCE(SUM(a.impressions), 0) AS impressions,
             COALESCE(SUM(a.conversions), 0) AS conversions,
             COALESCE(SUM(a.conversion_value), 0) AS conversion_value
           FROM google_ads_campaign_daily a
           WHERE a.report_date >= ? AND a.report_date <= ?${productTrendSql}`
        )
          .bind(...prevBinds)
          .first();

        const prevCost = Number(prev?.cost || 0);
        const prevConversions = Number(prev?.conversions || 0);
        const prevConversionValue = Number(prev?.conversion_value || 0);
        const curCost = Number(cur?.cost || 0);
        const curConversions = Number(cur?.conversions || 0);
        const curConversionValue = Number(cur?.conversion_value || 0);

        trend = {
          anchor_date: anchorDate,
          current_start: currentStart,
          previous_start: previousStart,
          previous_end: previousEnd,
          cost_28d: curCost,
          clicks_28d: Number(cur?.clicks || 0),
          impressions_28d: Number(cur?.impressions || 0),
          conversions_28d: curConversions,
          conversion_value_28d: curConversionValue,
          cpa_28d: curConversions > 0 ? Math.round((curCost / curConversions) * 100) / 100 : null,
          roas_28d: curCost > 0 ? Math.round((curConversionValue / curCost) * 100) / 100 : null,
          cost_prev_28d: prevCost,
          clicks_prev_28d: Number(prev?.clicks || 0),
          impressions_prev_28d: Number(prev?.impressions || 0),
          conversions_prev_28d: prevConversions,
          conversion_value_prev_28d: prevConversionValue,
          cpa_prev_28d: prevConversions > 0 ? Math.round((prevCost / prevConversions) * 100) / 100 : null,
          roas_prev_28d: prevCost > 0 ? Math.round((prevConversionValue / prevCost) * 100) / 100 : null,
          cost_growth_pct: prevCost > 0 ? Math.round(((curCost - prevCost) * 10000) / prevCost) / 100 : null,
          conversions_growth_pct:
            prevConversions > 0 ? Math.round(((curConversions - prevConversions) * 10000) / prevConversions) / 100 : null,
          conversion_value_growth_pct:
            prevConversionValue > 0
              ? Math.round(((curConversionValue - prevConversionValue) * 10000) / prevConversionValue) / 100
              : null,
        };
      }
    }

    const rowsTotal = Number(fresh?.total_rows || 0);
    const googleAdsDays =
      fresh?.days_since_latest_report === null || fresh?.days_since_latest_report === undefined
        ? null
        : Number(fresh.days_since_latest_report);
    const latestSyncStatus = String(fresh?.last_sync_status || "").toLowerCase() || null;
    let freshnessStatus: "ok" | "warning" | "empty" = "empty";
    if (rowsTotal > 0) {
      freshnessStatus = "ok";
      if (googleAdsDays !== null && googleAdsDays > 4) freshnessStatus = "warning";
      if (latestSyncStatus && ["failed", "partial", "error"].includes(latestSyncStatus)) freshnessStatus = "warning";
    }

    return json({
      success: true,
      available: true,
      filters: { start: f.start, end: f.end, product_id: f.productId },
      summary: {
        campaigns: Number(summary?.campaigns || 0),
        ad_groups: Number(summary?.ad_groups || 0),
        impressions: Number(summary?.impressions || 0),
        clicks: Number(summary?.clicks || 0),
        cost: Number(summary?.cost || 0),
        conversions: Number(summary?.conversions || 0),
        conversion_value: Number(summary?.conversion_value || 0),
        all_conversions: Number(summary?.all_conversions || 0),
        all_conversions_value: Number(summary?.all_conversions_value || 0),
        ctr_pct: summary?.ctr_pct === null || summary?.ctr_pct === undefined ? null : Number(summary.ctr_pct),
        cpc: summary?.cpc === null || summary?.cpc === undefined ? null : Number(summary.cpc),
        cpa: summary?.cpa === null || summary?.cpa === undefined ? null : Number(summary.cpa),
        roas: summary?.roas === null || summary?.roas === undefined ? null : Number(summary.roas),
        mapped_cost: Number(summary?.mapped_cost || 0),
      },
      trend_28d: trend,
      freshness: {
        total_rows: rowsTotal,
        latest_report_date: latestReportDate,
        days_since_latest_report: googleAdsDays,
        last_success_sync_at: fresh?.last_success_sync_at || null,
        last_sync_at: fresh?.last_sync_at || null,
        last_sync_status: latestSyncStatus,
        sync_errors_7d: Number(fresh?.sync_errors_7d || 0),
        status: freshnessStatus,
        caveat:
          "Google Ads conversion value is platform-attributed and directional only; keep separate from canonical D1 order revenue.",
      },
      top_campaigns: topCampaigns.results || [],
      top_products: topProducts.results || [],
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (
      msg.includes("no such table: google_ads_campaign_daily") ||
      msg.includes("no such table: analysis_google_ads_freshness")
    ) {
      return json({
        success: true,
        available: false,
        message: "Google Ads schema is not available in this environment yet. Apply migration 050_google_ads_analytics.sql.",
        filters: { start: f.start, end: f.end, product_id: f.productId },
      });
    }
    return err("GOOGLE_ADS_QUERY_FAILED", msg, 500);
  }
}

// ── Growth signals (Phase 13) ────────────────────────────────────────────
// Signal-only layer. No opportunity scoring/ranking is computed here.
// Phase 14 remains the owner of model weights, scoring, and recommendations.

async function getGrowthSignals(env: any, f: Filters): Promise<Response> {
  const now = new Date().toISOString().slice(0, 10);
  const anchorDate = f.end || now;
  const currentStart = shiftIsoDate(anchorDate, -27) || anchorDate;
  const previousEnd = shiftIsoDate(anchorDate, -28) || anchorDate;
  const previousStart = shiftIsoDate(anchorDate, -55) || anchorDate;

  const pct = (num: any, den: any): number | null => {
    const n = Number(num);
    const d = Number(den);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
    return Math.round((n / d) * 1000) / 10;
  };

  const n = (v: any) => (v === null || v === undefined ? 0 : Number(v) || 0);
  const days = (v: any): number | null => (v === null || v === undefined ? null : Number(v));
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const firstOrNull = async (sql: string, binds: any[] = []): Promise<any | null> => {
    try {
      return await env.DB.prepare(sql).bind(...binds).first();
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("no such table") || msg.includes("no such view")) return null;
      throw e;
    }
  };

  const allOrNull = async (sql: string, binds: any[] = []): Promise<any[] | null> => {
    try {
      const out = await env.DB.prepare(sql).bind(...binds).all();
      return out.results || [];
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("no such table") || msg.includes("no such view")) return null;
      throw e;
    }
  };

  // Optional filters that are valid for sales-based sources.
  const productSql = f.productId !== null ? " AND product_id = ?" : "";
  const productBind = f.productId !== null ? [f.productId] : [];
  const salesChannelSql = f.channel ? " AND channel_norm = ?" : "";
  const salesChannelBind = f.channel ? [f.channel] : [];

  // GA4 (website scope) demand + conversion inputs.
  const ga4Cur = await firstOrNull(
    `SELECT
       COALESCE(SUM(sessions), 0) AS sessions,
       COALESCE(SUM(add_to_cart), 0) AS add_to_cart,
       COALESCE(SUM(begin_checkout), 0) AS begin_checkout,
       COALESCE(SUM(purchases), 0) AS purchases
     FROM ga4_funnel_daily
     WHERE property_scope = 'website'
       AND property_id = '${GA4_WEBSITE_CANONICAL_PROPERTY_ID}'
       AND report_date >= ? AND report_date <= ?${productSql}`,
    [currentStart, anchorDate, ...productBind]
  );
  const ga4Prev = await firstOrNull(
    `SELECT COALESCE(SUM(sessions), 0) AS sessions
     FROM ga4_funnel_daily
     WHERE property_scope = 'website'
       AND property_id = '${GA4_WEBSITE_CANONICAL_PROPERTY_ID}'
       AND report_date >= ? AND report_date <= ?${productSql}`,
    [previousStart, previousEnd, ...productBind]
  );
  const ga4Cov = await firstOrNull(
    `SELECT
       COALESCE(SUM(sessions), 0) AS total_sessions,
       COALESCE(SUM(CASE WHEN product_id IS NOT NULL THEN sessions ELSE 0 END), 0) AS mapped_sessions
     FROM ga4_funnel_daily
     WHERE property_scope = 'website'
       AND property_id = '${GA4_WEBSITE_CANONICAL_PROPERTY_ID}'
       AND report_date >= ? AND report_date <= ?`,
    [currentStart, anchorDate]
  );
  const ga4Fresh = await firstOrNull("SELECT latest_report_date, days_since_latest_report, total_rows FROM analysis_ga4_freshness");

  // GSC demand inputs.
  const gscCur = await firstOrNull(
    `SELECT COALESCE(SUM(clicks), 0) AS clicks
     FROM gsc_search_daily
     WHERE report_date >= ? AND report_date <= ?${productSql}`,
    [currentStart, anchorDate, ...productBind]
  );
  const gscPrev = await firstOrNull(
    `SELECT COALESCE(SUM(clicks), 0) AS clicks
     FROM gsc_search_daily
     WHERE report_date >= ? AND report_date <= ?${productSql}`,
    [previousStart, previousEnd, ...productBind]
  );
  const gscCov = await firstOrNull(
    `SELECT
       COALESCE(SUM(clicks), 0) AS total_clicks,
       COALESCE(SUM(CASE WHEN product_id IS NOT NULL THEN clicks ELSE 0 END), 0) AS mapped_clicks
     FROM gsc_search_daily
     WHERE report_date >= ? AND report_date <= ?`,
    [currentStart, anchorDate]
  );
  const gscFresh = await firstOrNull("SELECT latest_report_date, days_since_latest_report, total_rows FROM analysis_gsc_freshness");

  // Etsy demand inputs (listing-id based; mapped by master table).
  const etsyProductSql = f.productId !== null ? " AND m.product_id = ?" : "";
  const etsyCur = await firstOrNull(
    `SELECT
       COALESCE(SUM(e.views), 0) AS views,
       COALESCE(SUM(e.orders), 0) AS orders,
       COALESCE(SUM(CASE WHEN m.product_id IS NOT NULL THEN e.views ELSE 0 END), 0) AS mapped_views
     FROM etsy_listing_daily e
     LEFT JOIN etsy_listing_master m ON m.listing_id = e.listing_id
     WHERE e.report_date >= ? AND e.report_date <= ?${etsyProductSql}`,
    [currentStart, anchorDate, ...(f.productId !== null ? [f.productId] : [])]
  );
  const etsyPrev = await firstOrNull(
    `SELECT COALESCE(SUM(e.views), 0) AS views
     FROM etsy_listing_daily e
     LEFT JOIN etsy_listing_master m ON m.listing_id = e.listing_id
     WHERE e.report_date >= ? AND e.report_date <= ?${etsyProductSql}`,
    [previousStart, previousEnd, ...(f.productId !== null ? [f.productId] : [])]
  );
  const etsyCov = await firstOrNull(
    `SELECT
       COALESCE(SUM(e.views), 0) AS total_views,
       COALESCE(SUM(CASE WHEN m.product_id IS NOT NULL THEN e.views ELSE 0 END), 0) AS mapped_views
     FROM etsy_listing_daily e
     LEFT JOIN etsy_listing_master m ON m.listing_id = e.listing_id
     WHERE e.report_date >= ? AND e.report_date <= ?`,
    [currentStart, anchorDate]
  );
  const etsyFresh = await firstOrNull("SELECT latest_report_date, days_since_latest_report, total_rows FROM analysis_etsy_freshness");

  // Google Ads metadata only for Phase 13 (neutral if sparse/zero signal).
  const adsCur = await firstOrNull(
    `SELECT
       COUNT(*) AS rows_n,
       COALESCE(SUM(cost), 0) AS cost,
       COALESCE(SUM(conversions), 0) AS conversions,
       COALESCE(SUM(CASE WHEN product_id IS NOT NULL THEN cost ELSE 0 END), 0) AS mapped_cost
     FROM google_ads_campaign_daily
     WHERE report_date >= ? AND report_date <= ?${productSql}`,
    [currentStart, anchorDate, ...productBind]
  );
  const adsFresh = await firstOrNull("SELECT latest_report_date, days_since_latest_report, total_rows FROM analysis_google_ads_freshness");

  // Sales-based momentum + channel context.
  const salesCur = await firstOrNull(
    `SELECT
       COUNT(DISTINCT sales_order_id) AS orders,
       COALESCE(SUM(quantity), 0) AS units
     FROM analysis_active_items
     WHERE order_day >= ? AND order_day <= ?${productSql}${salesChannelSql}`,
    [currentStart, anchorDate, ...productBind, ...salesChannelBind]
  );
  const salesPrev = await firstOrNull(
    `SELECT
       COUNT(DISTINCT sales_order_id) AS orders,
       COALESCE(SUM(quantity), 0) AS units
     FROM analysis_active_items
     WHERE order_day >= ? AND order_day <= ?${productSql}${salesChannelSql}`,
    [previousStart, previousEnd, ...productBind, ...salesChannelBind]
  );
  const channelRows = await allOrNull(
    `SELECT channel_norm, COUNT(DISTINCT sales_order_id) AS orders, COALESCE(SUM(quantity), 0) AS units
     FROM analysis_active_items
     WHERE order_day >= ? AND order_day <= ?${productSql}${salesChannelSql}
     GROUP BY channel_norm
     ORDER BY units DESC, orders DESC`,
    [currentStart, anchorDate, ...productBind, ...salesChannelBind]
  );
  const orderCov = await firstOrNull(
    `SELECT COALESCE(SUM(mapped_orders), 0) AS mapped_orders, COALESCE(SUM(orders), 0) AS orders
     FROM analysis_sales_daily
     WHERE order_day >= ? AND order_day <= ?${f.channel ? " AND channel_norm = ?" : ""}`,
    [currentStart, anchorDate, ...(f.channel ? [f.channel] : [])]
  );

  // Secondary profitability guardrail coverage (no ranking ownership here).
  const profitCov = await firstOrNull("SELECT * FROM analysis_profit_coverage");

  const ga4Sessions = n(ga4Cur?.sessions);
  const ga4PrevSessions = n(ga4Prev?.sessions);
  const gscClicks = n(gscCur?.clicks);
  const gscPrevClicks = n(gscPrev?.clicks);
  const etsyViews = n(etsyCur?.views);
  const etsyPrevViews = n(etsyPrev?.views);

  const ga4MappedPct = pct(ga4Cov?.mapped_sessions, ga4Cov?.total_sessions);
  const gscMappedPct = pct(gscCov?.mapped_clicks, gscCov?.total_clicks);
  const etsyMappedPct = pct(etsyCov?.mapped_views, etsyCov?.total_views);
  const adsMappedPct = pct(adsCur?.mapped_cost, adsCur?.cost);
  const orderMappedPct = pct(orderCov?.mapped_orders, orderCov?.orders);

  const ga4Days = days(ga4Fresh?.days_since_latest_report);
  const gscDays = days(gscFresh?.days_since_latest_report);
  const etsyDays = days(etsyFresh?.days_since_latest_report);
  const adsDays = days(adsFresh?.days_since_latest_report);

  const signals: any = {};
  const impacts: number[] = [];

  // Demand
  const ga4Growth = ga4PrevSessions > 0 ? Math.round(((ga4Sessions - ga4PrevSessions) * 1000) / ga4PrevSessions) / 10 : null;
  const gscGrowth = gscPrevClicks > 0 ? Math.round(((gscClicks - gscPrevClicks) * 1000) / gscPrevClicks) / 10 : null;
  const etsyGrowth = etsyPrevViews > 0 ? Math.round(((etsyViews - etsyPrevViews) * 1000) / etsyPrevViews) / 10 : null;
  const growthPool = [ga4Growth, gscGrowth, etsyGrowth].filter((v) => v !== null) as number[];
  const blendedGrowth = growthPool.length ? Math.round((growthPool.reduce((s, v) => s + v, 0) / growthPool.length) * 10) / 10 : null;

  let demandStatus = "sufficient";
  let demandImpact = 0;
  const staleDemandSources: string[] = [];
  if (ga4Sessions > 0 && ga4Days !== null && ga4Days > 10) staleDemandSources.push("ga4");
  if (gscClicks > 0 && gscDays !== null && gscDays > 14) staleDemandSources.push("gsc");
  if (etsyViews > 0 && etsyDays !== null && etsyDays > 7) staleDemandSources.push("etsy");
  const hasDemandSignal = ga4Sessions > 0 || gscClicks > 0 || etsyViews > 0;
  if (!hasDemandSignal) {
    demandStatus = "insufficient_signal";
    demandImpact -= 25;
  } else if (staleDemandSources.length) {
    demandStatus = "stale_source";
    demandImpact -= 10;
  } else if (
    (ga4MappedPct !== null && ga4MappedPct < 50) ||
    (gscMappedPct !== null && gscMappedPct < 50) ||
    (etsyMappedPct !== null && etsyMappedPct < 50)
  ) {
    demandStatus = "mapping_gap";
    demandImpact -= 10;
  }
  impacts.push(demandImpact);
  signals.demand = {
    value: {
      ga4_sessions_28d: ga4Sessions,
      gsc_clicks_28d: gscClicks,
      etsy_views_28d: etsyViews,
      blended_growth_pct: blendedGrowth,
      ga4_growth_pct: ga4Growth,
      gsc_growth_pct: gscGrowth,
      etsy_growth_pct: etsyGrowth,
    },
    status: demandStatus,
    coverage: {
      ga4_mapped_session_pct: ga4MappedPct,
      gsc_mapped_click_pct: gscMappedPct,
      etsy_mapped_view_pct: etsyMappedPct,
    },
    freshness_days: { ga4: ga4Days, gsc: gscDays, etsy: etsyDays },
    confidence_impact: demandImpact,
    reason: !hasDemandSignal
      ? "No measurable 28-day demand signal from GA4 website scope, GSC, or Etsy in the selected window."
      : staleDemandSources.length
        ? `Demand sources stale: ${staleDemandSources.join(", ")}.`
        : demandStatus === "mapping_gap"
          ? "Demand exists but mapped coverage is thin for at least one active source."
          : "Demand signal is present and mapped coverage/freshness are acceptable.",
  };

  // Momentum
  const curUnits = n(salesCur?.units);
  const prevUnits = n(salesPrev?.units);
  const curOrders = n(salesCur?.orders);
  const prevOrders = n(salesPrev?.orders);
  const unitGrowthPct = prevUnits > 0 ? Math.round(((curUnits - prevUnits) * 1000) / prevUnits) / 10 : null;
  let momentumStatus = "sufficient";
  let momentumImpact = 0;
  if (curUnits + prevUnits <= 0) {
    momentumStatus = "insufficient_signal";
    momentumImpact -= 20;
  } else if (prevUnits <= 0 && curUnits > 0) {
    momentumStatus = "insufficient_signal";
    momentumImpact -= 8;
  }
  impacts.push(momentumImpact);
  signals.momentum = {
    value: {
      units_28d: curUnits,
      units_prev_28d: prevUnits,
      orders_28d: curOrders,
      orders_prev_28d: prevOrders,
      units_growth_pct: unitGrowthPct,
    },
    status: momentumStatus,
    coverage: {
      mapped_order_pct: orderMappedPct,
      window_start: currentStart,
      window_end: anchorDate,
    },
    freshness_days: null,
    confidence_impact: momentumImpact,
    reason:
      curUnits + prevUnits <= 0
        ? "No unit activity in current and previous windows."
        : prevUnits <= 0
          ? "Current activity exists but previous baseline is zero, so growth direction is weakly anchored."
          : "Momentum uses comparable 28-day windows over mapped active items.",
  };

  // Conversion availability (availability only, not decision score logic).
  const ga4Atc = n(ga4Cur?.add_to_cart);
  const ga4Checkout = n(ga4Cur?.begin_checkout);
  const ga4Purchases = n(ga4Cur?.purchases);
  const ga4PurchaseRate = ga4Sessions > 0 ? Math.round((ga4Purchases * 1000) / ga4Sessions) / 10 : null;
  let conversionStatus = "sufficient";
  let conversionImpact = 0;
  if (ga4Sessions <= 0) {
    conversionStatus = "insufficient_signal";
    conversionImpact -= 15;
  } else if (ga4Atc + ga4Checkout + ga4Purchases <= 0) {
    conversionStatus = "insufficient_signal";
    conversionImpact -= 10;
  } else if (ga4MappedPct !== null && ga4MappedPct < 50) {
    conversionStatus = "mapping_gap";
    conversionImpact -= 5;
  }
  impacts.push(conversionImpact);
  signals.conversion_availability = {
    value: {
      sessions_28d: ga4Sessions,
      add_to_cart_28d: ga4Atc,
      begin_checkout_28d: ga4Checkout,
      purchases_28d: ga4Purchases,
      purchase_rate_pct: ga4PurchaseRate,
    },
    status: conversionStatus,
    coverage: { ga4_mapped_session_pct: ga4MappedPct },
    freshness_days: ga4Days,
    confidence_impact: conversionImpact,
    reason:
      ga4Sessions <= 0
        ? "No GA4 website sessions in the selected window."
        : ga4Atc + ga4Checkout + ga4Purchases <= 0
          ? "GA4 traffic exists but funnel events are sparse/absent."
          : conversionStatus === "mapping_gap"
            ? "Conversion events exist but product mapping coverage is limited."
            : "GA4 funnel events are available for growth diagnostics.",
  };

  // Channel context
  const channels = channelRows || [];
  const totalChannelUnits = channels.reduce((s: number, r: any) => s + n(r.units), 0);
  const topChannel = channels.length ? String(channels[0].channel_norm || "") : null;
  const topChannelShare = totalChannelUnits > 0 ? Math.round((n(channels[0]?.units) * 1000) / totalChannelUnits) / 10 : null;
  let channelStatus = "sufficient";
  let channelImpact = 0;
  if (!channels.length) {
    channelStatus = "insufficient_signal";
    channelImpact -= 10;
  } else if (channels.length === 1) {
    channelStatus = "neutral";
    channelImpact -= 3;
  }
  impacts.push(channelImpact);
  signals.channel_context = {
    value: {
      active_channels_28d: channels.length,
      top_channel: topChannel,
      top_channel_units_share_pct: topChannelShare,
      channel_rows: channels.slice(0, 6),
    },
    status: channelStatus,
    coverage: { channel_filter: f.channel || null },
    freshness_days: null,
    confidence_impact: channelImpact,
    reason:
      !channels.length
        ? "No channel-level unit activity in the selected window."
        : channels.length === 1
          ? "Activity is concentrated in one channel; breadth signal is limited."
          : "Multiple channels are active, enabling channel-opportunity comparisons.",
  };

  // Source freshness (cross-source observability).
  const hasGa4Data = n(ga4Fresh?.total_rows) > 0 || ga4Sessions > 0;
  const hasGscData = n(gscFresh?.total_rows) > 0 || gscClicks > 0;
  const hasEtsyData = n(etsyFresh?.total_rows) > 0 || etsyViews > 0;
  const hasAdsData = n(adsFresh?.total_rows) > 0 || n(adsCur?.rows_n) > 0 || n(adsCur?.cost) > 0;
  const staleSources: string[] = [];
  if (hasGa4Data && ga4Days !== null && ga4Days > 10) staleSources.push("ga4");
  if (hasGscData && gscDays !== null && gscDays > 14) staleSources.push("gsc");
  if (hasEtsyData && etsyDays !== null && etsyDays > 7) staleSources.push("etsy");
  if (hasAdsData && adsDays !== null && adsDays > 4) staleSources.push("google_ads");
  let freshnessStatus = "sufficient";
  let freshnessImpact = 0;
  if (!hasGa4Data && !hasGscData && !hasEtsyData) {
    freshnessStatus = "insufficient_signal";
    freshnessImpact -= 20;
  } else if (staleSources.length) {
    freshnessStatus = "stale_source";
    freshnessImpact -= 10;
  }
  impacts.push(freshnessImpact);
  const adsNeutral = !hasAdsData || n(adsCur?.cost) <= 0 || n(adsCur?.conversions) <= 0;
  signals.source_freshness = {
    value: {
      ga4_days_since_latest: ga4Days,
      gsc_days_since_latest: gscDays,
      etsy_days_since_latest: etsyDays,
      google_ads_days_since_latest: adsDays,
    },
    status: freshnessStatus,
    coverage: {
      ga4_available: hasGa4Data,
      gsc_available: hasGscData,
      etsy_available: hasEtsyData,
      google_ads_available: hasAdsData,
    },
    freshness_days: { ga4: ga4Days, gsc: gscDays, etsy: etsyDays, google_ads: adsDays },
    confidence_impact: freshnessImpact,
    reason: !hasGa4Data && !hasGscData && !hasEtsyData
      ? "Primary growth sources have no reported data rows yet."
      : staleSources.length
        ? `Source freshness warning: ${staleSources.join(", ")}.`
        : adsNeutral
          ? "Primary growth sources are fresh. Google Ads is operational but currently treated as neutral due to sparse/zero business signal."
          : "Primary growth sources are fresh.",
  };

  // Mapping coverage (cross-source).
  const coveragePool = [ga4MappedPct, gscMappedPct, etsyMappedPct].filter((v) => v !== null) as number[];
  const mappedAvg = coveragePool.length ? Math.round((coveragePool.reduce((s, v) => s + v, 0) / coveragePool.length) * 10) / 10 : null;
  let mappingStatus = "sufficient";
  let mappingImpact = 0;
  if (!coveragePool.length) {
    mappingStatus = "insufficient_signal";
    mappingImpact -= 15;
  } else if (mappedAvg !== null && mappedAvg < 50) {
    mappingStatus = "mapping_gap";
    mappingImpact -= 15;
  } else if (mappedAvg !== null && mappedAvg < 75) {
    mappingStatus = "mapping_gap";
    mappingImpact -= 8;
  }
  impacts.push(mappingImpact);
  signals.mapping_coverage = {
    value: { mapped_avg_pct: mappedAvg, order_mapped_pct_28d: orderMappedPct },
    status: mappingStatus,
    coverage: {
      ga4_mapped_session_pct: ga4MappedPct,
      gsc_mapped_click_pct: gscMappedPct,
      etsy_mapped_view_pct: etsyMappedPct,
      google_ads_mapped_cost_pct: adsMappedPct,
    },
    freshness_days: null,
    confidence_impact: mappingImpact,
    reason:
      !coveragePool.length
        ? "No mapped coverage baseline available from active growth sources in the current window."
        : mappingStatus === "mapping_gap"
          ? "Mapped coverage is below target for at least one growth source."
          : "Mapped coverage is healthy for active growth sources.",
  };

  // Profitability guardrail (secondary only).
  const grossCovPct = pct(profitCov?.gross_covered_revenue, profitCov?.total_revenue);
  const contribCovPct = pct(profitCov?.contribution_covered_revenue, profitCov?.total_revenue);
  const fullCostOrderPct = pct(profitCov?.full_cost_orders, profitCov?.commercial_orders);
  let guardrailImpact = 0;
  let guardrailStatus = "secondary_guardrail";
  if (grossCovPct !== null && grossCovPct < 50) guardrailImpact -= 5;
  impacts.push(guardrailImpact);
  if (!profitCov) guardrailStatus = "insufficient_signal";
  signals.profitability_guardrail = {
    value: {
      gross_covered_revenue_pct: grossCovPct,
      contribution_covered_revenue_pct: contribCovPct,
      full_cost_order_pct: fullCostOrderPct,
      products_with_cost: profitCov ? n(profitCov.products_with_cost) : null,
      active_products: profitCov ? n(profitCov.active_products) : null,
    },
    status: guardrailStatus,
    coverage: profitCov
      ? {
          products_with_cost: n(profitCov.products_with_cost),
          active_products: n(profitCov.active_products),
          channels_with_fees: n(profitCov.channels_with_fees),
          channels_with_shipping: n(profitCov.channels_with_shipping),
        }
      : null,
    freshness_days: null,
    confidence_impact: guardrailImpact,
    reason: !profitCov
      ? "Profitability coverage view unavailable in this environment."
      : "Profitability is a secondary guardrail in Phase 13 and does not control opportunity ranking here.",
  };

  // Final confidence (metadata only).
  const confidenceValue = clamp(Math.round((100 + impacts.reduce((s, v) => s + v, 0)) * 10) / 10, 0, 100);
  signals.confidence = {
    value: confidenceValue,
    status: confidenceValue >= 75 ? "sufficient" : confidenceValue >= 50 ? "neutral" : "insufficient_signal",
    coverage: {
      signal_count: 7,
      total_impact: impacts.reduce((s, v) => s + v, 0),
    },
    freshness_days: null,
    confidence_impact: 0,
    reason:
      "Confidence summarizes signal quality/coverage and source freshness; missing or immature sources reduce confidence without forcing synthetic zero values.",
  };

  return json({
    success: true,
    growth_signal_contract: "v1",
    objective:
      "Build a sales-growth analytical layer that identifies demand, momentum, conversion, and channel opportunities across MildMate products and listings, while using profitability as a secondary guardrail.",
    filters: { start: f.start, end: f.end, channel: f.channel, product_id: f.productId },
    window: {
      anchor_date: anchorDate,
      current_start: currentStart,
      current_end: anchorDate,
      previous_start: previousStart,
      previous_end: previousEnd,
    },
    google_ads_policy: {
      infrastructure: "available",
      business_signal: adsNeutral ? "insufficient_or_sparse" : "present",
      scoring_effect: "neutral_in_phase13",
      reason:
        "Phase 13 treats Google Ads sparse/zero business signal as neutral and surfaces it via coverage/freshness/confidence metadata.",
    },
    signals,
  });
}

async function getDataQuality(env: any): Promise<Response> {
  const dq: any = await env.DB.prepare(`SELECT * FROM analysis_data_quality`).first();
  if (!dq) return err("DATA_QUALITY_UNAVAILABLE", "analysis_data_quality returned no row.", 500);

  // Phase 06 additions computed live (the 042 view is frozen; no migration needed for counts)
  const zeroRow: any = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM analysis_commercial_orders WHERE order_total IS NULL OR order_total <= 0`
  ).first();
  const zeroTotalOrders = Number(zeroRow?.n || 0);

  const runsWindow = await env.DB.prepare(
    `SELECT id, source, scenario, started_at, finished_at, status,
            records_received, records_created, records_updated, records_unchanged, records_rejected,
            created_at,
            substr(COALESCE(error_message, ''), 1, 300) AS error_message
     FROM sync_runs
     ORDER BY COALESCE(finished_at, started_at, created_at) DESC
     LIMIT ?`
  ).bind(SYNC_RUN_GROUP_WINDOW_MAX_ROWS).all();

  const groupedRuns = groupRecentSyncRunsForDashboard(runsWindow.results || [], {
    maxRows: SYNC_RUN_GROUP_WINDOW_MAX_ROWS,
    maxGroups: SYNC_RUN_GROUP_MAX_GROUPS,
  });

  // Backward-compatible raw slice for existing consumers expecting the old
  // "last 10 rows" behavior.
  const recentRunsLegacy = (runsWindow.results || []).slice(0, 10);

  const freshness = await env.DB.prepare(
    `SELECT channel_norm,
            MAX(order_day) AS last_order_day,
            COUNT(*) AS orders,
            CAST(julianday('now') - julianday(MAX(order_day)) AS INTEGER) AS days_since_last_order
     FROM analysis_commercial_orders
     GROUP BY channel_norm
     ORDER BY last_order_day DESC`
  ).all();

  // Phase 08 addition: historical coverage (the 042 view is frozen; computed live)
  const spanRow: any = await env.DB.prepare(
    `SELECT MIN(order_day) AS first_order_day,
            MAX(order_day) AS last_order_day,
            COUNT(*) AS total_orders,
            COUNT(DISTINCT channel_norm) AS channels
     FROM analysis_commercial_orders`
  ).first();

  const coverageYear = await env.DB.prepare(
    `SELECT COALESCE(substr(co.order_day, 1, 4), 'unknown') AS year,
            COUNT(*) AS orders,
            COUNT(DISTINCT substr(co.order_day, 1, 7)) AS months_with_orders,
            COUNT(DISTINCT co.channel_norm) AS channels,
            MIN(co.order_day) AS first_day,
            MAX(co.order_day) AS last_day,
            SUM(CASE WHEN om.derived_mapping_status = 'Mapped' THEN 1 ELSE 0 END) AS mapped_orders
     FROM analysis_commercial_orders co
     LEFT JOIN analysis_order_mapping om ON om.sales_order_id = co.id
     GROUP BY COALESCE(substr(co.order_day, 1, 4), 'unknown')
     ORDER BY year`
  ).all();

  const coverageChannel = await env.DB.prepare(
    `SELECT co.channel_norm,
            COUNT(*) AS orders,
            MIN(co.order_day) AS first_day,
            MAX(co.order_day) AS last_day,
            SUM(CASE WHEN om.derived_mapping_status = 'Mapped' THEN 1 ELSE 0 END) AS mapped_orders
     FROM analysis_commercial_orders co
     LEFT JOIN analysis_order_mapping om ON om.sales_order_id = co.id
     GROUP BY co.channel_norm
     ORDER BY orders DESC, co.channel_norm`
  ).all();

  let gscFreshness: any = null;
  try {
    gscFreshness = await env.DB.prepare(`SELECT * FROM analysis_gsc_freshness`).first();
  } catch {
    // Migration 046 may not exist yet in a given environment.
    gscFreshness = null;
  }

  let ga4Freshness: any = null;
  try {
    ga4Freshness = await env.DB.prepare(`SELECT * FROM analysis_ga4_freshness`).first();
  } catch {
    // Migration 048 may not exist yet in a given environment.
    ga4Freshness = null;
  }

  let etsyFreshness: any = null;
  try {
    etsyFreshness = await env.DB.prepare(`SELECT * FROM analysis_etsy_freshness`).first();
  } catch {
    // Migration 049 may not exist yet in a given environment.
    etsyFreshness = null;
  }

  let googleAdsFreshness: any = null;
  try {
    googleAdsFreshness = await env.DB.prepare(`SELECT * FROM analysis_google_ads_freshness`).first();
  } catch {
    // Migration 050 may not exist yet in a given environment.
    googleAdsFreshness = null;
  }

  // M22 freshness + M30 roll-up (contract: computed in code, not SQL)
  let freshnessMinutes: number | null = null;
  const rawTs = String(dq.last_success_sync_at || "").trim();
  if (rawTs) {
    let d = new Date(rawTs);
    if (isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(rawTs)) {
      d = new Date(rawTs.replace(" ", "T") + "Z");
    }
    if (!isNaN(d.getTime())) {
      freshnessMinutes = Math.round((Date.now() - d.getTime()) / 60000);
    }
  }

  const warnings: string[] = [];
  let level: "ok" | "warning" | "critical" = "ok";
  const lastStatus = String(dq.last_sync_status || "").toLowerCase();

  if (!rawTs) { level = "critical"; warnings.push("No successful sales sync recorded."); }
  if (["failed", "partial", "error"].includes(lastStatus)) { level = "critical"; warnings.push("Latest sync run status: " + lastStatus + "."); }
  if (Number(dq.invalid_product_refs || 0) > 0) { level = "critical"; warnings.push(dq.invalid_product_refs + " item(s) reference a non-existent product id."); }

  const warn = (msg: string) => { if (level !== "critical") level = "warning"; warnings.push(msg); };
  if (freshnessMinutes !== null && freshnessMinutes > 30) warn("Last successful sync was " + freshnessMinutes + " minutes ago (threshold 30).");
  if (Number(dq.sync_errors_7d || 0) > 0) warn(dq.sync_errors_7d + " sync error(s) in the last 7 days.");
  if (Number(dq.missing_product_id_items || 0) > 0) warn(dq.missing_product_id_items + " active item(s) have no Product_ID.");
  if (Number(dq.itemless_orders || 0) > 0) warn(dq.itemless_orders + " commercial order(s) have no items.");
  if (Number(dq.orders_missing_date || 0) > 0) warn(dq.orders_missing_date + " commercial order(s) have a missing/malformed order date.");
  if (Number(dq.unknown_status_orders || 0) > 0) warn(dq.unknown_status_orders + " order(s) have an unknown status value.");
  if (Number(dq.unknown_source_labels || 0) > 0) warn(dq.unknown_source_labels + " unknown source label(s) present.");
  if (zeroTotalOrders > 0) warn(zeroTotalOrders + " commercial order(s) have a null/zero order total (business rules require a positive total).");

  const gscRows = Number(gscFreshness?.total_rows || 0);
  const gscDays = gscFreshness?.days_since_latest_report === null || gscFreshness?.days_since_latest_report === undefined
    ? null
    : Number(gscFreshness.days_since_latest_report);
  const gscLastStatus = String(gscFreshness?.last_sync_status || "").toLowerCase();
  if (gscRows > 0) {
    if (gscDays !== null && gscDays > 4) warn("GSC freshness is " + gscDays + " days old (threshold 4).");
    if (["failed", "partial", "error"].includes(gscLastStatus)) warn("Latest GSC sync run status: " + gscLastStatus + ".");
  }

  const ga4Rows = Number(ga4Freshness?.total_rows || 0);
  const ga4Days =
    ga4Freshness?.days_since_latest_report === null || ga4Freshness?.days_since_latest_report === undefined
      ? null
      : Number(ga4Freshness.days_since_latest_report);
  const ga4LastStatus = String(ga4Freshness?.last_sync_status || "").toLowerCase();
  if (ga4Rows > 0) {
    if (ga4Days !== null && ga4Days > 3) warn("GA4 freshness is " + ga4Days + " days old (threshold 3).");
    if (["failed", "partial", "error"].includes(ga4LastStatus)) warn("Latest GA4 sync run status: " + ga4LastStatus + ".");
  }

  const etsyRows = Number(etsyFreshness?.total_rows || 0);
  const etsyDays =
    etsyFreshness?.days_since_latest_report === null || etsyFreshness?.days_since_latest_report === undefined
      ? null
      : Number(etsyFreshness.days_since_latest_report);
  const etsyLastStatus = String(etsyFreshness?.last_sync_status || "").toLowerCase();
  if (etsyRows > 0) {
    if (etsyDays !== null && etsyDays > 7) warn("Etsy freshness is " + etsyDays + " days old (threshold 7).");
    if (["failed", "partial", "error"].includes(etsyLastStatus)) warn("Latest Etsy sync run status: " + etsyLastStatus + ".");
  }

  const googleAdsRows = Number(googleAdsFreshness?.total_rows || 0);
  const googleAdsDays =
    googleAdsFreshness?.days_since_latest_report === null || googleAdsFreshness?.days_since_latest_report === undefined
      ? null
      : Number(googleAdsFreshness.days_since_latest_report);
  const googleAdsLastStatus = String(googleAdsFreshness?.last_sync_status || "").toLowerCase();
  if (googleAdsRows > 0) {
    if (googleAdsDays !== null && googleAdsDays > 4) {
      warn("Google Ads freshness is " + googleAdsDays + " days old (threshold 4).");
    }
    if (["failed", "partial", "error"].includes(googleAdsLastStatus)) {
      warn("Latest Google Ads sync run status: " + googleAdsLastStatus + ".");
    }
  }

  const commercialOrders = Number(dq.commercial_orders || 0);
  const activeItems = Number(dq.active_items || 0);

  return json({
    success: true,
    data_quality: {
      ...dq,
      freshness_minutes: freshnessMinutes,
      mapped_order_pct: commercialOrders > 0 ? Math.round((Number(dq.mapped_orders || 0) / commercialOrders) * 1000) / 10 : null,
      mapped_item_pct: activeItems > 0 ? Math.round(((activeItems - Number(dq.missing_product_id_items || 0)) / activeItems) * 1000) / 10 : null,
      exact_item_pct: activeItems > 0 ? Math.round((Number(dq.exact_items || 0) / activeItems) * 1000) / 10 : null,
      unallocated_item_pct: activeItems > 0 ? Math.round((Number(dq.unallocated_items || 0) / activeItems) * 1000) / 10 : null,
      zero_total_orders: zeroTotalOrders,
      status: level,
      warnings,
    },
    thresholds: {
      freshness_warning_minutes: 30,
      note: "warning: sync older than 30 min (expected Make.com cadence 15 min); critical: no successful sync, failed last run, or invalid product refs",
    },
    recent_runs: recentRunsLegacy,
    recent_run_groups: groupedRuns.groups,
    recent_runs_window: groupedRuns.meta,
    channel_freshness: freshness.results || [],
    gsc_freshness: {
      available: !!gscFreshness,
      total_rows: gscRows,
      latest_report_date: gscFreshness?.latest_report_date || null,
      days_since_latest_report: gscDays,
      last_success_sync_at: gscFreshness?.last_success_sync_at || null,
      last_sync_at: gscFreshness?.last_sync_at || null,
      last_sync_status: gscLastStatus || null,
      sync_errors_7d: Number(gscFreshness?.sync_errors_7d || 0),
      status: gscRows === 0
        ? "empty"
        : ((gscDays !== null && gscDays > 4) || ["failed", "partial", "error"].includes(gscLastStatus) ? "warning" : "ok"),
      caveat: "GSC data is typically delayed by 1–2 days; freshness warning threshold = 4 days.",
    },
    ga4_freshness: {
      available: !!ga4Freshness,
      total_rows: ga4Rows,
      latest_report_date: ga4Freshness?.latest_report_date || null,
      days_since_latest_report: ga4Days,
      last_success_sync_at: ga4Freshness?.last_success_sync_at || null,
      last_sync_at: ga4Freshness?.last_sync_at || null,
      last_sync_status: ga4LastStatus || null,
      sync_errors_7d: Number(ga4Freshness?.sync_errors_7d || 0),
      status: ga4Rows === 0
        ? "empty"
        : ((ga4Days !== null && ga4Days > 3) || ["failed", "partial", "error"].includes(ga4LastStatus) ? "warning" : "ok"),
      caveat: "GA4 event data may finalize with delay; freshness warning threshold = 3 days.",
    },
    etsy_freshness: {
      available: !!etsyFreshness,
      total_rows: etsyRows,
      latest_report_date: etsyFreshness?.latest_report_date || null,
      days_since_latest_report: etsyDays,
      last_success_sync_at: etsyFreshness?.last_success_sync_at || null,
      last_sync_at: etsyFreshness?.last_sync_at || null,
      last_sync_status: etsyLastStatus || null,
      sync_errors_7d: Number(etsyFreshness?.sync_errors_7d || 0),
      total_master_listings: Number(etsyFreshness?.total_master_listings || 0),
      active_master_listings: Number(etsyFreshness?.active_master_listings || 0),
      inactive_master_listings: Number(etsyFreshness?.inactive_master_listings || 0),
      status: etsyRows === 0
        ? "empty"
        : ((etsyDays !== null && etsyDays > 7) || ["failed", "partial", "error"].includes(etsyLastStatus) ? "warning" : "ok"),
      caveat: "Etsy metrics depend on source exports/API windows; freshness warning threshold = 7 days.",
    },
    google_ads_freshness: {
      available: !!googleAdsFreshness,
      total_rows: googleAdsRows,
      latest_report_date: googleAdsFreshness?.latest_report_date || null,
      days_since_latest_report: googleAdsDays,
      last_success_sync_at: googleAdsFreshness?.last_success_sync_at || null,
      last_sync_at: googleAdsFreshness?.last_sync_at || null,
      last_sync_status: googleAdsLastStatus || null,
      sync_errors_7d: Number(googleAdsFreshness?.sync_errors_7d || 0),
      status: googleAdsRows === 0
        ? "empty"
        : ((googleAdsDays !== null && googleAdsDays > 4) || ["failed", "partial", "error"].includes(googleAdsLastStatus) ? "warning" : "ok"),
      caveat:
        "Google Ads conversion value is platform-attributed and directional only; keep separate from canonical D1 order revenue.",
    },
    coverage: {
      first_order_day: spanRow?.first_order_day ?? null,
      last_order_day: spanRow?.last_order_day ?? null,
      total_orders: Number(spanRow?.total_orders || 0),
      channels: Number(spanRow?.channels || 0),
      by_year: coverageYear.results || [],
      by_channel: coverageChannel.results || [],
    },
  });
}

// ── Data-quality exception drill-downs (Phase 06, PII-free) ───────────────

const EXCEPTION_TYPES: Record<string, { sql: string; description: string }> = {
  missing_product_id: {
    description: "Active items on commercial orders without a Product_ID",
    sql: `SELECT ai.order_day, ai.channel_norm, co.source_system, co.source_order_id, co.status,
                 ai.raw_item_text, ai.quantity, ai.revenue_status
          FROM analysis_active_items ai
          JOIN analysis_commercial_orders co ON co.id = ai.sales_order_id
          WHERE ai.product_id IS NULL
          ORDER BY ai.order_day DESC, ai.id`,
  },
  unmapped_orders: {
    description: "Commercial orders where no item has a Product_ID",
    sql: `SELECT co.order_day, co.channel_norm, co.source_system, co.source_order_id, co.status, co.order_total, co.currency
          FROM analysis_commercial_orders co
          JOIN analysis_order_mapping om ON om.sales_order_id = co.id
          WHERE om.derived_mapping_status = 'Unmapped'
          ORDER BY co.order_day DESC, co.id`,
  },
  itemless_orders: {
    description: "Commercial orders with no active items",
    sql: `SELECT co.order_day, co.channel_norm, co.source_system, co.source_order_id, co.status, co.order_total, co.currency
          FROM analysis_commercial_orders co
          JOIN analysis_order_mapping om ON om.sales_order_id = co.id
          WHERE om.derived_mapping_status = 'Itemless'
          ORDER BY co.order_day DESC, co.id`,
  },
  zero_totals: {
    description: "Commercial orders with a null/zero order total",
    sql: `SELECT order_day, channel_norm, source_system, source_order_id, status, order_total, currency
          FROM analysis_commercial_orders
          WHERE order_total IS NULL OR order_total <= 0
          ORDER BY order_day DESC, id`,
  },
  invalid_product_refs: {
    description: "Active items referencing a non-existent product id",
    sql: `SELECT ai.order_day, ai.channel_norm, ai.product_id, co.source_system, co.source_order_id,
                 ai.raw_item_text, ai.quantity
          FROM analysis_active_items ai
          JOIN analysis_commercial_orders co ON co.id = ai.sales_order_id
          LEFT JOIN products p ON p.id = ai.product_id
          WHERE ai.product_id IS NOT NULL AND p.id IS NULL
          ORDER BY ai.order_day DESC, ai.id`,
  },
  unknown_sources: {
    description: "Source labels outside the known channel list",
    sql: `SELECT source_system, COUNT(*) AS orders, MIN(substr(order_date, 1, 10)) AS first_order_day,
                 MAX(substr(order_date, 1, 10)) AS last_order_day
          FROM sales_orders
          WHERE lower(trim(source_system)) NOT IN
            ('shopee', 'lazada', 'tiktok', 'line', 'whatsapp', 'etsy', 'ebay', 'facebook', 'website', 'manual')
          GROUP BY source_system
          ORDER BY orders DESC`,
  },
  unknown_status: {
    description: "Orders whose status is outside the known status taxonomy",
    sql: `SELECT substr(order_date, 1, 10) AS order_day, source_system, source_order_id, status, order_total, currency
          FROM sales_orders
          WHERE status IS NULL OR lower(status) NOT IN
            ('pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'refunded', 'archived')
          ORDER BY order_date DESC, id`,
  },
  sync_errors: {
    description: "Sync runs with a failed/partial/error status in the last 7 days",
    sql: `SELECT id, source, scenario, started_at, finished_at, status,
                 records_received, records_rejected, substr(COALESCE(error_message, ''), 1, 300) AS error_message
          FROM sync_runs
          WHERE status IN ('failed', 'partial', 'error')
            AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')
          ORDER BY COALESCE(finished_at, created_at) DESC`,
  },
};

async function getExceptions(env: any, url: URL): Promise<Response> {
  const type = (url.searchParams.get("type") || "").trim();
  const def = EXCEPTION_TYPES[type];
  if (!def) {
    return err("INVALID_EXCEPTION_TYPE", "type must be one of: " + Object.keys(EXCEPTION_TYPES).join(", "));
  }
  const rows = await env.DB.prepare(def.sql + " LIMIT 100").all();
  return json({
    success: true,
    type,
    description: def.description,
    count: (rows.results || []).length,
    truncated: (rows.results || []).length === 100,
    rows: rows.results || [],
  });
}

// ── Profitability (Phase 13) ──────────────────────────────────────────────
// Reads the migration-053 views. All amounts THB. Margins are NULL (never 0)
// when cost/fee/shipping inputs are missing; every aggregate carries its own
// covered-revenue base so percentages stay honest. Ad spend only appears in
// the month-level after_ads block (aggregate, never per order).

async function getProfitability(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f);
  const binds: any[] = [...range.binds];
  let channelSql = "";
  if (f.channel) { channelSql = " AND channel_norm = ?"; binds.push(f.channel); }

  try {
    const summary: any = await env.DB.prepare(
      `SELECT
         COUNT(*)                                                   AS orders,
         SUM(order_total)                                           AS revenue,
         SUM(cost_coverage = 'FULL')                                AS full_cost_orders,
         SUM(cost_coverage = 'PARTIAL')                             AS partial_cost_orders,
         SUM(cost_coverage = 'NONE')                                AS no_cost_orders,
         SUM(cost_coverage = 'ITEMLESS')                            AS itemless_orders,
         SUM(CASE WHEN gross_margin_thb IS NOT NULL THEN order_total END) AS gross_covered_revenue,
         SUM(CASE WHEN gross_margin_thb IS NOT NULL THEN production_cost_thb END) AS production_cost_thb,
         SUM(gross_margin_thb)                                      AS gross_margin_thb,
         SUM(CASE WHEN contribution_before_shipping_thb IS NOT NULL THEN fees_thb END) AS fees_thb,
         SUM(CASE WHEN contribution_before_shipping_thb IS NOT NULL THEN order_total END) AS contrib_bs_covered_revenue,
         SUM(contribution_before_shipping_thb)                      AS contribution_before_shipping_thb,
         SUM(CASE WHEN contribution_margin_thb IS NOT NULL THEN shipping_cost_thb END) AS shipping_cost_thb,
         SUM(CASE WHEN contribution_margin_thb IS NOT NULL THEN order_total END) AS contrib_covered_revenue,
         SUM(contribution_margin_thb)                               AS contribution_margin_thb,
         MAX(CASE WHEN estimate_cost_items > 0 OR fees_are_estimate = 1 OR shipping_is_estimate = 1 THEN 1 ELSE 0 END) AS contains_estimates
       FROM analysis_profit_orders
       WHERE 1=1${range.sql}${channelSql}`
    ).bind(...binds).first();

    const channels = await env.DB.prepare(
      `SELECT
         channel_norm,
         COUNT(*)                        AS orders,
         SUM(order_total)                AS revenue,
         SUM(cost_coverage = 'FULL')     AS full_cost_orders,
         SUM(CASE WHEN gross_margin_thb IS NOT NULL THEN order_total END) AS gross_covered_revenue,
         SUM(gross_margin_thb)           AS gross_margin_thb,
         SUM(CASE WHEN contribution_before_shipping_thb IS NOT NULL THEN order_total END) AS contrib_bs_covered_revenue,
         SUM(contribution_before_shipping_thb) AS contribution_before_shipping_thb,
         SUM(contribution_margin_thb)    AS contribution_margin_thb,
         MAX(CASE WHEN shipping_cost_thb IS NULL THEN 1 ELSE 0 END) AS shipping_missing
       FROM analysis_profit_orders
       WHERE 1=1${range.sql}${channelSql}
       GROUP BY channel_norm
       ORDER BY revenue DESC`
    ).bind(...binds).all();

    const monthBinds: any[] = [];
    let monthWhere = "";
    if (f.start) { monthWhere += " AND month >= ?"; monthBinds.push(f.start.slice(0, 7)); }
    if (f.end) { monthWhere += " AND month <= ?"; monthBinds.push(f.end.slice(0, 7)); }
    let monthChannelSql = "";
    if (f.channel) { monthChannelSql = " AND channel_norm = ?"; monthBinds.push(f.channel); }

    const monthly = await env.DB.prepare(
      `SELECT month,
              SUM(orders) AS orders,
              SUM(revenue) AS revenue,
              SUM(gross_covered_revenue) AS gross_covered_revenue,
              SUM(gross_margin_thb) AS gross_margin_thb,
              SUM(contrib_bs_covered_revenue) AS contrib_bs_covered_revenue,
              SUM(contribution_before_shipping_thb) AS contribution_before_shipping_thb,
              SUM(contribution_margin_thb) AS contribution_margin_thb,
              MAX(contains_estimates) AS contains_estimates
       FROM analysis_profit_monthly
       WHERE 1=1${monthWhere}${monthChannelSql}
       GROUP BY month
       ORDER BY month DESC
       LIMIT 24`
    ).bind(...monthBinds).all();

    const prodBinds: any[] = [...range.binds];
    let prodChannelSql = "";
    if (f.channel) { prodChannelSql = " AND pi.channel_norm = ?"; prodBinds.push(f.channel); }

    const products = await env.DB.prepare(
      `SELECT
         pi.product_id,
         COALESCE(p.title_en, '(unmapped)') AS product_title,
         p.slug AS product_slug,
         COUNT(*) AS items,
         SUM(pi.quantity) AS units,
         SUM(CASE WHEN pi.revenue_status = 'EXACT' THEN pi.line_revenue END) AS exact_revenue,
         SUM(pi.cost_status = 'COSTED') AS costed_items,
         SUM(CASE WHEN pi.cost_status = 'COSTED' THEN pi.item_production_cost_thb END) AS production_cost_thb,
         SUM(CASE WHEN pi.revenue_status = 'EXACT' AND pi.cost_status = 'COSTED'
                  THEN pi.line_revenue - pi.item_production_cost_thb END) AS line_margin_before_fees_thb,
         SUM(CASE WHEN pi.revenue_status = 'EXACT' AND pi.cost_status = 'COSTED'
                  THEN pi.line_revenue END) AS line_margin_covered_revenue,
         MAX(pi.cost_is_estimate) AS cost_is_estimate
       FROM analysis_profit_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       WHERE 1=1${range.sql.replace(/order_day/g, "pi.order_day")}${prodChannelSql}
       GROUP BY pi.product_id, p.title_en, p.slug
       ORDER BY line_margin_before_fees_thb DESC NULLS LAST`
    ).bind(...prodBinds).all();

    const afterAds = await env.DB.prepare(
      `SELECT month, orders, revenue, contribution_before_shipping_thb,
              contrib_bs_covered_revenue, ads_cost_thb, contribution_after_ads_thb
       FROM analysis_profit_after_ads_monthly
       WHERE 1=1${monthWhere}
       ORDER BY month DESC
       LIMIT 24`
    ).bind(...monthBinds.slice(0, monthWhere.split("?").length - 1)).all();

    const coverage: any = await env.DB.prepare("SELECT * FROM analysis_profit_coverage").first();

    const pct = (num: any, base: any) => {
      const n = Number(num), b = Number(base);
      if (!Number.isFinite(n) || !Number.isFinite(b) || b <= 0) return null;
      return Math.round((n / b) * 1000) / 10;
    };

    return json({
      success: true,
      available: true,
      filters: { start: f.start, end: f.end, channel: f.channel },
      currency: "THB",
      note: "Margins are computed only over covered orders; percentages use each metric's own covered-revenue base. Estimates are labelled. Ad spend is month-aggregate only (never per order).",
      summary: {
        ...summary,
        gross_margin_pct: pct(summary?.gross_margin_thb, summary?.gross_covered_revenue),
        contribution_before_shipping_pct: pct(summary?.contribution_before_shipping_thb, summary?.contrib_bs_covered_revenue),
        contribution_margin_pct: pct(summary?.contribution_margin_thb, summary?.contrib_covered_revenue),
      },
      channels: channels.results || [],
      monthly: monthly.results || [],
      products: products.results || [],
      after_ads: afterAds.results || [],
      coverage,
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (isSchemaMissingError(msg)) {
      return json({
        success: true,
        available: false,
        error_code: "PROFIT_VIEWS_MISSING",
        message: "Profitability views are not available in this environment yet. Apply migration 053_profitability_layer.sql.",
        filters: { start: f.start, end: f.end, channel: f.channel },
        currency: "THB",
        summary: null,
        channels: [],
        monthly: [],
        products: [],
        after_ads: [],
        coverage: null,
      });
    }
    throw e;
  }
}

// ── Router ────────────────────────────────────────────────────────────────

// ── Marketing Funnel Model (read-only; owner-approved 2026-11-07) ─────────
//
// GET /api/admin/analysis/funnel ?start&end
//
// Reconciles the approved five-stage funnel (Awareness, Engagement,
// Lead & Quote, Conversion, Retention) against metrics that already exist in
// Phases 10-16. Additive only: no metric definition, weight, or guardrail is
// changed here.
//
// Hard guardrails - do not weaken:
//  * No cross-channel conversion rate is produced. Each channel keeps its own
//    unit, window, and freshness and is never summed with another channel.
//  * Website metrics use canonical GA4 property 308922589 only. Legacy
//    property 366290587 is never merged. The analysis_ga4_* views carry no
//    property_id filter, so this handler queries ga4_funnel_daily directly.
//  * Canonical revenue is order revenue from analysis_sales_daily. GA4
//    purchases and Etsy listing revenue are reported separately, are marked
//    directional, and are never added to canonical revenue.
//  * Google Ads purchase attribution stays UNVERIFIED.
//  * Retention is UNAVAILABLE: sales_orders carries no customer identity.
//  * UNALLOCATED item revenue stays unknown, never zero.

const FUNNEL_MODEL_VERSION = "marketing-funnel-v1";
const FUNNEL_MARKETPLACE_CHANNELS = ["shopee", "lazada", "tiktok", "ebay"];
const FUNNEL_DIRECT_CHANNELS = ["line", "whatsapp", "facebook", "manual"];

const FUNNEL_STAGES = [
  { id: "awareness", name: "Awareness", definition: "Potential customers reached by a channel before any interaction." },
  { id: "engagement", name: "Engagement", definition: "Reached users who showed interest (viewed, clicked, engaged, saved)." },
  { id: "lead_quote", name: "Lead & Quote", definition: "Identified demand: lead events and custom-quote requests." },
  { id: "conversion", name: "Conversion", definition: "Commercial orders and revenue." },
  { id: "retention", name: "Retention", definition: "Repeat purchase / customer return behavior." },
];

const FUNNEL_FRESHNESS_THRESHOLDS = { ga4: 3, gsc: 4, etsy: 7, google_ads: 4, ga4_leads: 10 };

function funnelFreshness(fresh: any, warnDays: number): any {
  if (!fresh) {
    return {
      latest_report_date: null,
      days_since_latest_report: null,
      total_rows: null,
      last_success_sync_at: null,
      last_sync_status: null,
      warning_threshold_days: warnDays,
      status: "unavailable",
    };
  }
  const latest = fresh.latest_report_date === undefined ? null : fresh.latest_report_date;
  const rawDays = fresh.days_since_latest_report;
  const days = rawDays === null || rawDays === undefined ? null : Number(rawDays);
  const rawRows = fresh.total_rows;
  const rows = rawRows === null || rawRows === undefined ? null : Number(rawRows);
  const lastStatus = String(fresh.last_sync_status || "").toLowerCase();
  let status = "ok";
  if (rows === null) status = "unavailable";
  else if (rows === 0) status = "empty";
  else if (days !== null && days > warnDays) status = "warning";
  else if (lastStatus === "failed" || lastStatus === "partial" || lastStatus === "error") status = "warning";
  return {
    latest_report_date: latest,
    days_since_latest_report: days,
    total_rows: rows,
    last_success_sync_at: fresh.last_success_sync_at === undefined ? null : fresh.last_success_sync_at,
    last_sync_status: fresh.last_sync_status === undefined ? null : fresh.last_sync_status,
    warning_threshold_days: warnDays,
    status,
  };
}

function funnelMetric(key: string, label: string, value: any, unit: string | null, source: string, opts?: any): any {
  const o = opts || {};
  return {
    key,
    label,
    value: value === undefined ? null : value,
    unit: unit || null,
    source,
    grain: o.grain || null,
    coverage_pct: o.coverage === undefined ? null : o.coverage,
    directional: !!o.directional,
    note: o.note || null,
  };
}

function funnelStage(status: string, unit: string | null, metrics: any[], limitations: string[]): any {
  return { status, unit: unit || null, metrics: metrics || [], limitations: limitations || [] };
}

async function getFunnel(env: any, f: Filters): Promise<Response> {
  // Window: honour ?start/?end; otherwise last 28 days inclusive (matches the
  // Marketing Command Center default filter).
  const endDay: string = f.end || new Date().toISOString().slice(0, 10);
  let startDay: string = f.start || "";
  if (!startDay) {
    const d = new Date(endDay + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 27);
    startDay = d.toISOString().slice(0, 10);
  }
  const windowDays = Math.round((Date.parse(endDay + "T00:00:00Z") - Date.parse(startDay + "T00:00:00Z")) / 86400000) + 1;

  const db = env.DB;
  const schemaUnavailable: string[] = [];
  async function src<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (e: any) {
      const m = String(e && e.message ? e.message : e);
      if (isSchemaMissingError(m)) {
        schemaUnavailable.push(name);
        return null;
      }
      throw e;
    }
  }
  const num0 = (v: any): number => (v === null || v === undefined ? 0 : Number(v));
  const covPct = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

  // ---- Canonical website traffic (GA4 canonical property only) ----
  const ga4: any = await src("ga4_funnel_daily", () =>
    db.prepare(
      `SELECT COUNT(*) AS rows_n,
              COALESCE(SUM(g.sessions),0) AS sessions,
              COALESCE(SUM(g.users),0) AS users,
              COALESCE(SUM(g.engaged_sessions),0) AS engaged_sessions,
              COALESCE(SUM(g.product_views),0) AS product_views,
              COALESCE(SUM(g.add_to_cart),0) AS add_to_cart,
              COALESCE(SUM(g.begin_checkout),0) AS begin_checkout,
              COALESCE(SUM(g.purchases),0) AS purchases,
              COALESCE(SUM(g.purchase_revenue),0) AS purchase_revenue,
              COALESCE(SUM(CASE WHEN g.product_id IS NOT NULL THEN g.sessions ELSE 0 END),0) AS mapped_sessions
         FROM ga4_funnel_daily g
        WHERE g.property_scope = 'website'
          AND g.property_id = ?1
          AND g.landing_page_path NOT LIKE '%/listing/%'
          AND g.report_date >= ?2 AND g.report_date <= ?3`
    ).bind(GA4_WEBSITE_CANONICAL_PROPERTY_ID, startDay, endDay).first()
  );

  // ---- Search visibility (GSC) ----
  const gsc: any = await src("gsc_search_daily", () =>
    db.prepare(
      `SELECT COUNT(*) AS rows_n,
              COALESCE(SUM(clicks),0) AS clicks,
              COALESCE(SUM(impressions),0) AS impressions,
              COALESCE(SUM(CASE WHEN product_id IS NOT NULL THEN clicks ELSE 0 END),0) AS mapped_clicks
         FROM gsc_search_daily
        WHERE report_date >= ?1 AND report_date <= ?2`
    ).bind(startDay, endDay).first()
  );

  // ---- Lead events (canonical property only) ----
  const leads: any = await src("ga4_lead_acquisition_daily", () =>
    db.prepare(
      `SELECT COUNT(*) AS rows_n,
              COALESCE(SUM(CASE WHEN event_name = 'generate_lead' THEN event_count ELSE 0 END),0) AS generate_lead_events,
              COALESCE(SUM(CASE WHEN event_name = 'quote_request' THEN event_count ELSE 0 END),0) AS quote_request_events,
              COALESCE(SUM(CASE WHEN event_name = 'generate_lead' AND users_available = 1 THEN event_users ELSE 0 END),0) AS generate_lead_users,
              COALESCE(SUM(CASE WHEN event_name = 'quote_request' AND users_available = 1 THEN event_users ELSE 0 END),0) AS quote_request_users,
              SUM(CASE WHEN event_name = 'generate_lead' AND users_available = 1 THEN 1 ELSE 0 END) AS generate_lead_user_rows,
              SUM(CASE WHEN event_name = 'quote_request' AND users_available = 1 THEN 1 ELSE 0 END) AS quote_request_user_rows
         FROM ga4_lead_acquisition_daily
        WHERE property_id = ?1 AND report_date >= ?2 AND report_date <= ?3`
    ).bind(GA4_LEAD_CANONICAL_PROPERTY_ID, startDay, endDay).first()
  );

  // ---- Etsy listing funnel (Etsy-native units) ----
  const etsy: any = await src("etsy_listing_daily", () =>
    db.prepare(
      `SELECT COUNT(*) AS rows_n,
              COUNT(DISTINCT listing_id) AS listings,
              COUNT(DISTINCT CASE WHEN is_active = 1 THEN listing_id END) AS active_listings,
              COALESCE(SUM(visits),0) AS visits,
              COALESCE(SUM(views),0) AS views,
              COALESCE(SUM(favorites),0) AS favorites,
              COALESCE(SUM(orders),0) AS orders,
              COALESCE(SUM(transactions),0) AS transactions,
              COALESCE(SUM(units_sold),0) AS units_sold,
              COALESCE(SUM(revenue),0) AS revenue,
              COALESCE(SUM(revenue_thb),0) AS revenue_thb,
              COALESCE(SUM(CASE WHEN product_id IS NOT NULL THEN views ELSE 0 END),0) AS mapped_views
         FROM etsy_listing_daily
        WHERE report_date >= ?1 AND report_date <= ?2`
    ).bind(startDay, endDay).first()
  );

  // ---- Paid search (Google Ads) ----
  const ads: any = await src("google_ads_campaign_daily", () =>
    db.prepare(
      `SELECT COUNT(*) AS rows_n,
              COALESCE(SUM(impressions),0) AS impressions,
              COALESCE(SUM(clicks),0) AS clicks,
              COALESCE(SUM(cost),0) AS cost,
              COALESCE(SUM(conversions),0) AS conversions,
              COALESCE(SUM(conversion_value),0) AS conversion_value,
              COALESCE(SUM(CASE WHEN product_id IS NOT NULL THEN cost ELSE 0 END),0) AS mapped_cost
         FROM google_ads_campaign_daily
        WHERE report_date >= ?1 AND report_date <= ?2`
    ).bind(startDay, endDay).first()
  );

  // ---- Canonical sales (order revenue is the only revenue authority) ----
  const salesRes: any = await src("analysis_sales_daily", () =>
    db.prepare(
      `SELECT channel_norm, currency,
              SUM(orders) AS orders, SUM(order_revenue) AS order_revenue, SUM(units) AS units,
              SUM(mapped_orders) AS mapped_orders, SUM(exact_items) AS exact_items,
              SUM(unallocated_items) AS unallocated_items
         FROM analysis_sales_daily
        WHERE order_day >= ?1 AND order_day <= ?2
        GROUP BY channel_norm, currency`
    ).bind(startDay, endDay).all()
  );

  // ---- Quote demand (Tier 1) ----
  const quoteBase: any = await src("custom_quotes", () =>
    db.prepare(
      `SELECT COUNT(*) AS total_quotes,
              SUM(CASE WHEN LOWER(COALESCE(status,'pending')) = 'approved' THEN 1 ELSE 0 END) AS approved_quotes,
              SUM(CASE WHEN LOWER(COALESCE(status,'pending')) = 'approved' AND expires_at IS NOT NULL
                        AND expires_at > datetime('now') AND expires_at <= datetime('now','+7 days')
                   THEN 1 ELSE 0 END) AS expiring_7d
         FROM custom_quotes
        WHERE substr(COALESCE(created_at, datetime('now')),1,10) >= ?1
          AND substr(COALESCE(created_at, datetime('now')),1,10) <= ?2`
    ).bind(startDay, endDay).first()
  );

  // Exact quote->order attribution needs orders.quote_id (migration 059).
  // Isolated so a missing column degrades only this one metric.
  const quoteExact: any = await src("orders.quote_id", () =>
    db.prepare(
      `SELECT COUNT(DISTINCT q.quote_id) AS exact_converted_quotes
         FROM custom_quotes q
        WHERE LOWER(COALESCE(q.status,'pending')) = 'approved'
          AND substr(COALESCE(q.created_at, datetime('now')),1,10) >= ?1
          AND substr(COALESCE(q.created_at, datetime('now')),1,10) <= ?2
          AND EXISTS (SELECT 1 FROM orders o WHERE o.quote_id = q.quote_id)`
    ).bind(startDay, endDay).first()
  );

  // ---- Freshness ----
  const freshGa4: any = await src("analysis_ga4_freshness", () => db.prepare("SELECT * FROM analysis_ga4_freshness").first());
  const freshGsc: any = await src("analysis_gsc_freshness", () => db.prepare("SELECT * FROM analysis_gsc_freshness").first());
  const freshEtsy: any = await src("analysis_etsy_freshness", () => db.prepare("SELECT * FROM analysis_etsy_freshness").first());
  const freshAds: any = await src("analysis_google_ads_freshness", () => db.prepare("SELECT * FROM analysis_google_ads_freshness").first());
  const freshLeads: any = await src("analysis_ga4_lead_freshness", () => db.prepare("SELECT * FROM analysis_ga4_lead_freshness").first());
  const dq: any = await src("analysis_data_quality", () =>
    db.prepare("SELECT last_success_sync_at, last_sync_status, sync_errors_7d FROM analysis_data_quality").first()
  );

  // ---- Aggregate canonical sales into channel buckets ----
  const salesAgg: Record<string, any> = {};
  for (const r of (salesRes && salesRes.results) || []) {
    const ch = String(r.channel_norm || "(unknown)");
    if (!salesAgg[ch]) {
      salesAgg[ch] = { orders: 0, revenue: 0, units: 0, mapped_orders: 0, exact_items: 0, unallocated_items: 0, currencies: [] as string[] };
    }
    const a = salesAgg[ch];
    a.orders += num0(r.orders);
    a.revenue += num0(r.order_revenue);
    a.units += num0(r.units);
    a.mapped_orders += num0(r.mapped_orders);
    a.exact_items += num0(r.exact_items);
    a.unallocated_items += num0(r.unallocated_items);
    if (r.currency && a.currencies.indexOf(String(r.currency)) < 0) a.currencies.push(String(r.currency));
  }
  function salesBucket(names: string[]): any {
    const out = { orders: 0, revenue: 0, units: 0, mapped_orders: 0, exact_items: 0, unallocated_items: 0, currencies: [] as string[] };
    for (const n of names) {
      const a = salesAgg[n];
      if (!a) continue;
      out.orders += a.orders;
      out.revenue += a.revenue;
      out.units += a.units;
      out.mapped_orders += a.mapped_orders;
      out.exact_items += a.exact_items;
      out.unallocated_items += a.unallocated_items;
      for (const c of a.currencies) if (out.currencies.indexOf(c) < 0) out.currencies.push(c);
    }
    return out;
  }
  const knownChannels = ["website", "etsy"].concat(FUNNEL_MARKETPLACE_CHANNELS, FUNNEL_DIRECT_CHANNELS);
  const unknownChannels = Object.keys(salesAgg).filter((c) => c !== "(unknown)" && knownChannels.indexOf(c) < 0);
  const websiteSales = salesBucket(["website"]);
  const etsySales = salesBucket(["etsy"]);
  const mpSales = salesBucket(FUNNEL_MARKETPLACE_CHANNELS.concat(FUNNEL_DIRECT_CHANNELS));
  const otherSales = salesBucket(unknownChannels.concat(salesAgg["(unknown)"] ? ["(unknown)"] : []));

  // A single-currency revenue figure is safe; a mixed set is reported as null.
  function revOf(s: any): number | null {
    return s.currencies.length > 1 ? null : s.revenue;
  }
  function currencyOf(s: any): string | null {
    return s.currencies.length === 1 ? s.currencies[0] : null;
  }
  function salesMetrics(s: any, prefix: string): any[] {
    const mixed = s.currencies.length > 1;
    const currency = currencyOf(s) || "THB";
    const out = [
      funnelMetric(prefix + "_orders", "Orders (canonical)", s.orders, "orders", "analysis_sales_daily", {
        grain: "order_day x channel",
        coverage: covPct(s.mapped_orders, s.orders),
      }),
      funnelMetric(prefix + "_order_revenue", "Order revenue", revOf(s), currency, "analysis_sales_daily.order_revenue", {
        grain: "order_day x channel",
        note: mixed ? "Multiple currencies present; revenue withheld rather than mixed." : null,
      }),
      funnelMetric(prefix + "_units", "Units", s.units, "units", "analysis_sales_daily", { grain: "order_day x channel" }),
      funnelMetric(prefix + "_mapped_order_pct", "Mapped order %", covPct(s.mapped_orders, s.orders), "%", "analysis_order_mapping", {
        note: "Mapping is derived from items, never from order-level mapping_status.",
      }),
      funnelMetric(prefix + "_exact_revenue_coverage_pct", "Exact line-revenue coverage", covPct(s.exact_items, s.exact_items + s.unallocated_items), "%", "analysis_active_items", {
        note: s.exact_items === 0 && s.unallocated_items > 0 ? "No exact revenue data; UNALLOCATED stays unknown, not zero." : null,
      }),
    ];
    return out;
  }

  // ---- Status helpers ----
  const ga4Fresh = funnelFreshness(freshGa4, FUNNEL_FRESHNESS_THRESHOLDS.ga4);
  const gscFresh = funnelFreshness(freshGsc, FUNNEL_FRESHNESS_THRESHOLDS.gsc);
  const etsyFresh = funnelFreshness(freshEtsy, FUNNEL_FRESHNESS_THRESHOLDS.etsy);
  const adsFresh = funnelFreshness(freshAds, FUNNEL_FRESHNESS_THRESHOLDS.google_ads);
  const leadsFresh = funnelFreshness(freshLeads, FUNNEL_FRESHNESS_THRESHOLDS.ga4_leads);

  const trafficRows = num0(ga4 && ga4.rows_n) + num0(gsc && gsc.rows_n);
  const websiteTrafficStatus = !ga4 && !gsc ? "UNAVAILABLE" : trafficRows === 0 ? "INSUFFICIENT" : "PARTIAL";
  const websiteLeadsRows = num0(leads && leads.rows_n) + num0(quoteBase && quoteBase.total_quotes);
  const websiteLeadStatus = !leads && !quoteBase ? "UNAVAILABLE" : websiteLeadsRows === 0 ? "INSUFFICIENT" : "AVAILABLE";
  const websiteConvRows = websiteSales.orders;
  const websiteConvStatus = salesRes === null ? "UNAVAILABLE" : websiteConvRows === 0 ? "INSUFFICIENT" : "AVAILABLE";
  const etsyStatus = !etsy ? "UNAVAILABLE" : num0(etsy.rows_n) === 0 ? "INSUFFICIENT" : "AVAILABLE";
  const adsStatus = !ads ? "UNAVAILABLE" : num0(ads.rows_n) === 0 ? "INSUFFICIENT" : "PARTIAL";
  const mpStatus = salesRes === null ? "UNAVAILABLE" : mpSales.orders === 0 ? "INSUFFICIENT" : "AVAILABLE";

  const leadUsersAvailable = num0(leads && leads.generate_lead_user_rows) > 0 || num0(leads && leads.quote_request_user_rows) > 0;

  const channels: any[] = [
    {
      id: "website",
      label: "Website",
      kind: "owned",
      sources: ["ga4_funnel_daily", "gsc_search_daily", "ga4_lead_acquisition_daily", "custom_quotes", "analysis_sales_daily"],
      freshness: { ga4: ga4Fresh, gsc: gscFresh, ga4_leads: leadsFresh, sales: { last_success_sync_at: dq ? dq.last_success_sync_at : null, status: dq ? "ok" : "unavailable" } },
      stages: {
        awareness: funnelStage(websiteTrafficStatus, "sessions / impressions", [
          funnelMetric("sessions", "Sessions", ga4 ? num0(ga4.sessions) : null, "sessions", "ga4_funnel_daily.sessions", {
            grain: "report_date x page x source x medium x campaign x country x device",
            coverage: ga4 ? covPct(num0(ga4.mapped_sessions), num0(ga4.sessions)) : null,
            note: "Canonical property 308922589 only; legacy 366290587 excluded.",
          }),
          funnelMetric("users", "Users", ga4 ? num0(ga4.users) : null, "users", "ga4_funnel_daily.users", {}),
          funnelMetric("gsc_impressions", "Search impressions", gsc ? num0(gsc.impressions) : null, "impressions", "gsc_search_daily.impressions", {}),
        ], [
          "All website traffic, not only new users; no first-touch dedupe across sources.",
          "GSC impressions are query-level and can repeat a page across queries.",
        ]),
        engagement: funnelStage(websiteTrafficStatus, "views / sessions / clicks", [
          funnelMetric("product_views", "Product views", ga4 ? num0(ga4.product_views) : null, "views", "ga4_funnel_daily.product_views", {}),
          funnelMetric("engaged_sessions", "Engaged sessions", ga4 ? num0(ga4.engaged_sessions) : null, "sessions", "ga4_funnel_daily.engaged_sessions", {}),
          funnelMetric("add_to_cart", "Add to cart", ga4 ? num0(ga4.add_to_cart) : null, "events", "ga4_funnel_daily.add_to_cart", {}),
          funnelMetric("add_to_cart_rate_pct", "Add-to-cart rate", ga4 ? covPct(num0(ga4.add_to_cart), num0(ga4.sessions)) : null, "%", "derived: add_to_cart / sessions", {
            directional: true,
            note: "Directional only; GA4 event data finalizes with delay.",
          }),
          funnelMetric("gsc_clicks", "Search clicks", gsc ? num0(gsc.clicks) : null, "clicks", "gsc_search_daily.clicks", {}),
          funnelMetric("gsc_ctr_pct", "Search CTR", gsc ? covPct(num0(gsc.clicks), num0(gsc.impressions)) : null, "%", "derived: clicks / impressions", {}),
        ], ["Engagement rates use sessions as the denominator and are directional."]),
        lead_quote: funnelStage(websiteLeadStatus, "lead events / quotes", [
          funnelMetric("generate_lead_events", "Generate-lead events", leads ? num0(leads.generate_lead_events) : null, "events", "ga4_lead_acquisition_daily", { note: "Canonical property 308922589 only." }),
          funnelMetric("quote_request_events", "Quote-request events", leads ? num0(leads.quote_request_events) : null, "events", "ga4_lead_acquisition_daily", {}),
          funnelMetric("generate_lead_users", "Generate-lead users", leads && leadUsersAvailable ? num0(leads.generate_lead_users) : null, "users", "ga4_lead_acquisition_daily.event_users", {
            note: leadUsersAvailable ? null : "Users unavailable for this period (users_available flag not set).",
          }),
          funnelMetric("total_quotes", "Quotes submitted", quoteBase ? num0(quoteBase.total_quotes) : null, "quotes", "custom_quotes", {}),
          funnelMetric("approved_quotes", "Quotes approved", quoteBase ? num0(quoteBase.approved_quotes) : null, "quotes", "custom_quotes.status", {}),
          funnelMetric("expiring_7d", "Approved quotes expiring <=7d", quoteBase ? num0(quoteBase.expiring_7d) : null, "quotes", "custom_quotes.expires_at", {}),
          funnelMetric("exact_converted_quotes", "Exact converted quotes", quoteExact ? num0(quoteExact.exact_converted_quotes) : null, "quotes", "orders.quote_id", {
            note: quoteExact ? null : "Exact quote->order attribution unavailable (orders.quote_id not present).",
          }),
          funnelMetric("exact_conversion_pct", "Exact quote conversion", quoteExact && quoteBase && num0(quoteBase.approved_quotes) > 0 ? covPct(num0(quoteExact.exact_converted_quotes), num0(quoteBase.approved_quotes)) : null, "%", "derived: exact converted / approved", {
            note: "Legacy email-matched conversions are reported separately and never added here.",
          }),
        ], ["Lead capture exists on the website only; Etsy and marketplace channels have none.", "The lead layer carries no product_id (not product-attributable)."]),
        conversion: funnelStage(websiteConvStatus, "orders / THB", salesMetrics(websiteSales, "website").concat([
          funnelMetric("ga4_purchases", "GA4 purchases (directional)", ga4 ? num0(ga4.purchases) : null, "purchases", "ga4_funnel_daily.purchases", {
            directional: true,
            note: "Directional only; never added to canonical order revenue.",
          }),
          funnelMetric("ga4_purchase_revenue", "GA4 purchase revenue (directional)", ga4 ? num0(ga4.purchase_revenue) : null, "currency", "ga4_funnel_daily.purchase_revenue", {
            directional: true,
            note: "Never added to canonical order revenue.",
          }),
        ]), ["Canonical revenue is order revenue from analysis_sales_daily; GA4 purchases are directional."]),
        retention: funnelStage("UNAVAILABLE", null, [], ["sales_orders carries no customer identity, so repeat purchase cannot be measured."]),
      },
    },
    {
      id: "etsy",
      label: "Etsy",
      kind: "marketplace",
      sources: ["etsy_listing_daily", "etsy_listing_master"],
      freshness: { etsy: etsyFresh },
      stages: {
        awareness: funnelStage(etsyStatus, "views / visits", [
          funnelMetric("listings", "Listings", etsy ? num0(etsy.listings) : null, "listings", "etsy_listing_daily", {}),
          funnelMetric("active_listings", "Active listings", etsy ? num0(etsy.active_listings) : null, "listings", "etsy_listing_daily.is_active", {}),
          funnelMetric("views", "Views", etsy ? num0(etsy.views) : null, "views", "etsy_listing_daily.views", {
            coverage: etsy ? covPct(num0(etsy.mapped_views), num0(etsy.views)) : null,
          }),
          funnelMetric("visits", "Visits", etsy ? num0(etsy.visits) : null, "visits", "etsy_listing_daily.visits", {}),
        ], ["Etsy views and visits are Etsy-native definitions; do not conflate with GA4 sessions."]),
        engagement: funnelStage(etsyStatus, "views / favorites", [
          funnelMetric("views", "Views", etsy ? num0(etsy.views) : null, "views", "etsy_listing_daily.views", {}),
          funnelMetric("favorites", "Favorites", etsy ? num0(etsy.favorites) : null, "favorites", "etsy_listing_daily.favorites", {
            note: "Intent proxy with no website equivalent.",
          }),
        ], ["Etsy favorites is a weak intent proxy."]),
        lead_quote: funnelStage("UNAVAILABLE", null, [], ["No lead or quote capture exists on Etsy."]),
        conversion: funnelStage(etsyStatus, "orders / THB", salesMetrics(etsySales, "etsy").concat([
          funnelMetric("etsy_listing_orders", "Etsy listing orders (directional)", etsy ? num0(etsy.orders) : null, "orders", "etsy_listing_daily.orders", { directional: true }),
          funnelMetric("etsy_transactions", "Etsy transactions (directional)", etsy ? num0(etsy.transactions) : null, "transactions", "etsy_listing_daily.transactions", { directional: true }),
          funnelMetric("etsy_units_sold", "Units sold (Etsy listing)", etsy ? num0(etsy.units_sold) : null, "units", "etsy_listing_daily.units_sold", {}),
          funnelMetric("etsy_revenue_thb", "Etsy revenue (THB)", etsy ? num0(etsy.revenue_thb) : null, "THB", "etsy_listing_daily.revenue_thb", {
            directional: true,
            note: "Etsy-native listing revenue; never added to canonical order revenue.",
          }),
        ]), [
          "Canonical Etsy order revenue (analysis_sales_daily, channel = etsy) and Etsy listing revenue are reported separately and are never summed.",
          "Etsy listing revenue is Etsy-reported and is not canonical D1 order revenue.",
        ]),
        retention: funnelStage("UNAVAILABLE", null, [], ["No customer identity is captured for Etsy sales."]),
      },
    },
    {
      id: "paid_search",
      label: "Paid Search (Google Ads)",
      kind: "paid",
      sources: ["google_ads_campaign_daily"],
      freshness: { google_ads: adsFresh },
      stages: {
        awareness: funnelStage(adsStatus, "impressions / clicks", [
          funnelMetric("impressions", "Impressions", ads ? num0(ads.impressions) : null, "impressions", "google_ads_campaign_daily.impressions", {}),
          funnelMetric("clicks", "Clicks", ads ? num0(ads.clicks) : null, "clicks", "google_ads_campaign_daily.clicks", {}),
          funnelMetric("cost", "Cost", ads ? num0(ads.cost) : null, "currency", "google_ads_campaign_daily.cost", {
            note: "Platform-reported spend.",
          }),
        ], ["Paid reach has no shared identity with website or Etsy traffic."]),
        engagement: funnelStage(adsStatus, "clicks", [
          funnelMetric("ctr_pct", "CTR", ads ? covPct(num0(ads.clicks), num0(ads.impressions)) : null, "%", "derived: clicks / impressions", {}),
          funnelMetric("cpc", "CPC", ads && num0(ads.clicks) > 0 ? Math.round((num0(ads.cost) / num0(ads.clicks)) * 100) / 100 : null, "currency", "derived: cost / clicks", {}),
        ], []),
        lead_quote: funnelStage("UNAVAILABLE", null, [], ["No lead or quote capture is attributed to paid search."]),
        conversion: funnelStage("UNVERIFIED", "platform-attributed", [
          funnelMetric("conversions", "Conversions (unverified)", ads ? num0(ads.conversions) : null, "conversions", "google_ads_campaign_daily.conversions", {
            directional: true,
            note: "Paid-purchase attribution has not been validated; monitoring data only.",
          }),
          funnelMetric("conversion_value", "Conversion value (unverified)", ads ? num0(ads.conversion_value) : null, "currency", "google_ads_campaign_daily.conversion_value", {
            directional: true,
          }),
          funnelMetric("roas", "ROAS (unverified)", ads && num0(ads.cost) > 0 ? Math.round((num0(ads.conversion_value) / num0(ads.cost)) * 100) / 100 : null, "ratio", "derived: conversion_value / cost", {
            directional: true,
          }),
        ], ["Google Ads purchase attribution is UNVERIFIED (Phase 12 open); conversions must not be treated as funnel conversion."]),
        retention: funnelStage("UNAVAILABLE", null, [], ["No customer identity is available for paid channels."]),
      },
    },
    {
      id: "marketplace",
      label: "Marketplace & Direct",
      kind: "marketplace",
      sources: ["analysis_sales_daily"],
      channels_included: FUNNEL_MARKETPLACE_CHANNELS.concat(FUNNEL_DIRECT_CHANNELS),
      freshness: { sales: { last_success_sync_at: dq ? dq.last_success_sync_at : null, status: dq ? "ok" : "unavailable" } },
      stages: {
        awareness: funnelStage("UNAVAILABLE", null, [], ["No reach or impression data exists for these channels."]),
        engagement: funnelStage("UNAVAILABLE", null, [], ["No engagement data exists for these channels."]),
        lead_quote: funnelStage("UNAVAILABLE", null, [], ["No lead or quote capture exists for these channels."]),
        conversion: funnelStage(mpStatus, "orders / THB", salesMetrics(mpSales, "mp"), [
          "Orders enter analytics through manual Notion entry, so freshness follows the human entry cadence.",
        ]),
        retention: funnelStage("UNAVAILABLE", null, [], ["No customer identity is captured for these channels."]),
      },
    },
  ];

  if (unknownChannels.length || salesAgg["(unknown)"]) {
    channels.push({
      id: "other",
      label: "Other / Unrecognised source",
      kind: "other",
      sources: ["analysis_sales_daily"],
      channels_included: unknownChannels.concat(salesAgg["(unknown)"] ? ["(unknown)"] : []),
      freshness: { sales: { last_success_sync_at: dq ? dq.last_success_sync_at : null, status: dq ? "ok" : "unavailable" } },
      stages: {
        awareness: funnelStage("UNAVAILABLE", null, [], []),
        engagement: funnelStage("UNAVAILABLE", null, [], []),
        lead_quote: funnelStage("UNAVAILABLE", null, [], []),
        conversion: funnelStage(otherSales.orders > 0 ? "PARTIAL" : "INSUFFICIENT", "orders / THB", salesMetrics(otherSales, "other"), [
          "source_system is outside the known channel list; flagged in Data Quality as unknown_source_labels.",
        ]),
        retention: funnelStage("UNAVAILABLE", null, [], []),
      },
    });
  }

  const notes: string[] = [
    "Funnel stages are reported per channel and are never chained across channels.",
    "Website traffic uses canonical GA4 property 308922589 only; legacy property 366290587 is excluded.",
    "GA4 purchases and Etsy revenue are directional and are never added to canonical order revenue.",
    "Retention is UNAVAILABLE: sales_orders carries no customer identity.",
  ];
  if (schemaUnavailable.length) notes.push("Schema unavailable in this environment: " + schemaUnavailable.join(", ") + ".");
  if (unknownChannels.length) notes.push("Sales rows with unrecognised source_system: " + unknownChannels.join(", ") + " (reported under Other).");

  return json({
    success: true,
    available: true,
    model: FUNNEL_MODEL_VERSION,
    generated_at: new Date().toISOString(),
    filters: { start: startDay, end: endDay },
    window: { start: startDay, end: endDay, days: windowDays, timezone: "UTC", basis: "source-reported report_date / analytics order_day" },
    stages: FUNNEL_STAGES,
    channels,
    data_confidence: {
      sources: {
        ga4_website: ga4Fresh,
        gsc: gscFresh,
        etsy: etsyFresh,
        google_ads: adsFresh,
        ga4_leads: leadsFresh,
        sales: {
          last_success_sync_at: dq ? dq.last_success_sync_at : null,
          last_sync_status: dq ? dq.last_sync_status : null,
          sync_errors_7d: dq ? num0(dq.sync_errors_7d) : null,
          warning_threshold_days: 3,
          status: dq ? "ok" : "unavailable",
        },
      },
      thresholds_days: FUNNEL_FRESHNESS_THRESHOLDS,
    },
    guardrails: {
      cross_channel_rates: false,
      channels_summed: false,
      canonical_ga4_property: GA4_WEBSITE_CANONICAL_PROPERTY_ID,
      legacy_ga4_property_merged: false,
      canonical_revenue_source: "analysis_sales_daily.order_revenue",
      directional_revenue_sources: ["ga4_funnel_daily.purchase_revenue", "etsy_listing_daily.revenue_thb"],
      google_ads_purchase_attribution: "UNVERIFIED",
      retention: "UNAVAILABLE",
      unallocated_revenue: "unknown_not_zero",
    },
    schema_unavailable: schemaUnavailable,
    notes,
  });
}

export async function handleAdminAnalysis(request: Request, env: any): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
      },
    });
  }
  const url = new URL(request.url);
  const isRecompute = request.method === "POST" && url.pathname.replace(/\/+$/, "").endsWith("/opportunity/recompute");
  if (request.method !== "GET" && !isRecompute) {
    return err("METHOD_NOT_ALLOWED", "Only GET is supported (POST only on /opportunity/recompute).", 405);
  }

  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return err("UNAUTHORIZED", auth.error, auth.status);

  const sub = url.pathname.replace(/\/+$/, "").replace(/^\/api\/admin\/analysis/, "") || "/";

  const productMatch = sub.match(/^\/product\/(\d+)$/);
  if (productMatch) return getProductDetail(env, productMatch[1]);

  if (sub === "/data-quality") return getDataQuality(env);
  if (sub === "/data-quality/exceptions") return getExceptions(env, url);
  if (sub === "/opportunity") return getOpportunity(env);
  if (sub === "/opportunity/recompute") return recomputeOpportunityHandler(request, env);

  const parsed = parseFilters(url);
  if (!parsed.ok) return parsed.res;
  const f = parsed.f;

  if (sub === "/gsc") return getGsc(env, f);
  if (sub === "/ga4") return getGa4(env, f);
  if (sub === "/ga4-leads") return getGa4Leads(env, f);
  if (sub === "/order-acquisition") return getOrderAcquisition(env, f);
  if (sub === "/etsy") return getEtsy(env, f);
  if (sub === "/google-ads") return getGoogleAds(env, f);
  if (sub === "/quotes") return getQuotes(env, f);
  if (sub === "/growth-signals") return getGrowthSignals(env, f);
  if (sub === "/profitability") return getProfitability(env, f);
  if (sub === "/funnel") return getFunnel(env, f);
  if (sub === "/" || sub === "/summary") return getSummary(env, f);
  if (sub === "/sales") return getSales(env, f);
  if (sub === "/products") return getProducts(env, f);
  if (sub === "/channels") return getChannels(env, f);

  return err("ROUTE_NOT_FOUND", "Unknown analysis route: " + sub, 404);
}
