/**
 * MildMate Marketing Decision System — Phase 17
 * Scheduled confirmed-mapping sync Worker.
 *
 * Automates the Phase 07 v3 sync so Make.com-confirmed `Mapped` OrderList
 * records reach D1 without a human running the CLI. This Worker is a thin
 * scheduling/persistence shell: ALL sync logic comes from the shared engine
 * `scripts/notion-mapper-core.mjs`, which the manual CLI also uses. The logic
 * is never forked — fix the core and both runtimes change together.
 *
 * What this Worker adds over the CLI:
 *   - cron scheduling (Pages cannot host cron triggers)
 *   - D1-backed pagination cursor  (marketing_sync_state, migration 045)
 *   - D1-backed run lock           (marketing_sync_lock, migration 045)
 *   - run telemetry                (sync_runs, source 'notion-mapping-sync')
 *   - per-record audit rows        (product_mapping_events, migration 044)
 *
 * Guardrails (inherited, must not be relaxed):
 *   - Only `Product_Mapping_Status = "Mapped"` records are ever fetched.
 *   - `D1_Last_Synced_Signature` is the only Notion field ever written, and
 *     only after a confirmed successful D1 upsert.
 *   - Nothing is auto-mapped or re-mapped. Make.com owns mapping.
 *   - Records without a TotalAmount are held, never synced with a guessed total.
 *   - Secrets come from bindings and are never logged.
 *
 * Schedules:
 *   "0 2 1,15 * *"  main run — 1st and 15th at 02:00 UTC (09:00 Bangkok).
 *                   Cron cannot express a true 14-day interval; twice-monthly
 *                   on fixed dates is deterministic and needs no extra state.
 *   "0 * * * *"     drain — no-ops unless the previous run stopped bounded
 *                   with carry-over work. Without this, a batch too large for
 *                   one invocation would wait a fortnight to finish.
 *   "0 3 * * 1"     GSC weekly collector (Monday 03:00 UTC) with overlap
 *                   window to absorb late-settling Search Console rows.
 *   "0 4 * * 1"     GA4 weekly collector (Monday 04:00 UTC) with overlap
 *                   window to absorb late-settling event rows.
 */

import {
  runSync,
  fetchCatalogIds,
  buildReportEmail,
  sendReportEmail,
  truncate,
  REPORT_EMAIL_TO_DEFAULT,
} from "../scripts/notion-mapper-core.mjs";

const STREAM = "notion-mapping-sync";
const SYNC_SOURCE = "notion-mapping-sync";
const SCENARIO = "phase17-scheduled-confirmed-mapping-sync";
const MAIN_CRON = "0 2 1,15 * *";
const DRAIN_CRON = "0 * * * *";

const GSC_STREAM = "gsc-weekly-sync";
const GSC_SYNC_SOURCE = "gsc-worker-cron";
const GSC_SCENARIO = "phase09-weekly-gsc-sync";
const GSC_WEEKLY_CRON = "0 3 * * 1"; // weekly Monday 03:00 UTC
const GSC_UPSERT_ROUTE = "/api/v1/gsc/rows/upsert";
const GSC_LOCK_TTL_MS = 20 * 60 * 1000;
const GSC_DEFAULT_OVERLAP_DAYS = 14;
const GSC_DEFAULT_LAG_DAYS = 3;
const GSC_DEFAULT_PAGE_SIZE = 25000;
const GSC_DEFAULT_CHUNK_SIZE = 1000;
const GSC_MAX_WINDOW_DAYS = 90;
const GSC_MAX_PAGES_PER_DAY = 200;
const GSC_DIMENSIONS = ["query", "page", "country", "device"];

const GA4_STREAM = "ga4-weekly-sync";
const GA4_SYNC_SOURCE = "ga4-worker-cron";
const GA4_SCENARIO = "phase10-weekly-ga4-sync";
const GA4_WEEKLY_CRON = "0 4 * * 1"; // weekly Monday 04:00 UTC
const GA4_UPSERT_ROUTE = "/api/v1/ga4/rows/upsert";
const GA4_LOCK_TTL_MS = 20 * 60 * 1000;
const GA4_DEFAULT_OVERLAP_DAYS = 14;
const GA4_DEFAULT_LAG_DAYS = 2;
const GA4_DEFAULT_PAGE_SIZE = 20000;
const GA4_DEFAULT_CHUNK_SIZE = 1000;
const GA4_MAX_WINDOW_DAYS = 90;
const GA4_MAX_PAGES_PER_REPORT = 200;
const GA4_DIMENSIONS = [
  "date",
  "landingPagePlusQueryString",
  "pagePath",
  "sessionSource",
  "sessionMedium",
  "sessionCampaignName",
  "country",
  "deviceCategory",
];
const GA4_DEFAULT_VIEW_ITEM_EVENTS = ["view_item"];
const GA4_DEFAULT_ADD_TO_CART_EVENTS = ["add_to_cart"];
const GA4_DEFAULT_BEGIN_CHECKOUT_EVENTS = ["begin_checkout"];
const GA4_DEFAULT_PURCHASE_EVENTS = ["purchase"];

// Stop and carry over via the cursor before the platform can cut the run off
// mid-record. Notion calls are throttled to ~350ms, so this is wall-clock bound.
const DEFAULT_MAX_MS = 180_000;
// Lock expiry must exceed the work budget so a slow run never loses its own
// lock, but stay short enough that a crashed run frees the schedule quickly.
const LOCK_TTL_MS = 600_000;

const nowIso = () => new Date().toISOString();
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clampInt(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function parseIsoDay(iso) {
  const s = String(iso || "");
  if (!ISO_DAY_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toIsoDay(date) {
  return date.toISOString().slice(0, 10);
}

function addDaysIso(iso, deltaDays) {
  const d = parseIsoDay(iso);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + Number(deltaDays || 0));
  return toIsoDay(d);
}

function listIsoDaysInclusive(startIso, endIso) {
  const start = parseIsoDay(startIso);
  const end = parseIsoDay(endIso);
  if (!start || !end || start > end) return [];
  const out = [];
  const cur = new Date(start.getTime());
  while (cur <= end) {
    out.push(toIsoDay(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Date scope for ongoing runs.
 *
 * Encodes the operator's stated correction cadence: month M is finalised in
 * Notion during month M+1 (e.g. August is corrected by end of September). So
 * the newest safely-syncable month is the one before last — cutoff = first day
 * of the previous month. Records newer than that are held and sync themselves
 * on a later run once their signature changes.
 *
 * Override with SYNC_BEFORE_MODE = "none" (rely only on the TotalAmount rule)
 * or SYNC_BEFORE_FIXED = "YYYY-MM-DD" (pin an explicit cutoff).
 */
function resolveBefore(env, now = new Date()) {
  if (env.SYNC_BEFORE_FIXED) return env.SYNC_BEFORE_FIXED;
  if (env.SYNC_BEFORE_MODE === "none") return null;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 10);
}

// ── Lock ───────────────────────────────────────────────────────────────────

async function acquireLock(db, runId) {
  const until = new Date(Date.now() + LOCK_TTL_MS).toISOString();
  // Single atomic statement: the WHERE clause is the mutual-exclusion test, so
  // two concurrent invocations cannot both see the lock as free.
  const res = await db
    .prepare(
      `UPDATE marketing_sync_lock
          SET locked_until = ?, run_id = ?, updated_at = ?
        WHERE name = ?
          AND (locked_until IS NULL OR locked_until < ?)`
    )
    .bind(until, runId, nowIso(), STREAM, nowIso())
    .run();
  return (res.meta?.changes ?? 0) === 1;
}

async function releaseLock(db, runId) {
  await db
    .prepare(
      `UPDATE marketing_sync_lock
          SET locked_until = NULL, run_id = NULL, updated_at = ?
        WHERE name = ? AND run_id = ?`
    )
    .bind(nowIso(), STREAM, runId)
    .run();
}

async function ensureLockRow(db, name) {
  await db
    .prepare(`INSERT OR IGNORE INTO marketing_sync_lock (name, locked_until, run_id, updated_at) VALUES (?, NULL, NULL, ?)`)
    .bind(name, nowIso())
    .run();
}

async function acquireGscLock(db, runId) {
  await ensureLockRow(db, GSC_STREAM);
  const until = new Date(Date.now() + GSC_LOCK_TTL_MS).toISOString();
  const res = await db
    .prepare(
      `UPDATE marketing_sync_lock
          SET locked_until = ?, run_id = ?, updated_at = ?
        WHERE name = ?
          AND (locked_until IS NULL OR locked_until < ?)`
    )
    .bind(until, runId, nowIso(), GSC_STREAM, nowIso())
    .run();
  return (res.meta?.changes ?? 0) === 1;
}

async function releaseGscLock(db, runId) {
  await db
    .prepare(
      `UPDATE marketing_sync_lock
          SET locked_until = NULL, run_id = NULL, updated_at = ?
        WHERE name = ? AND run_id = ?`
    )
    .bind(nowIso(), GSC_STREAM, runId)
    .run();
}

async function acquireGa4Lock(db, runId) {
  await ensureLockRow(db, GA4_STREAM);
  const until = new Date(Date.now() + GA4_LOCK_TTL_MS).toISOString();
  const res = await db
    .prepare(
      `UPDATE marketing_sync_lock
          SET locked_until = ?, run_id = ?, updated_at = ?
        WHERE name = ?
          AND (locked_until IS NULL OR locked_until < ?)`
    )
    .bind(until, runId, nowIso(), GA4_STREAM, nowIso())
    .run();
  return (res.meta?.changes ?? 0) === 1;
}

async function releaseGa4Lock(db, runId) {
  await db
    .prepare(
      `UPDATE marketing_sync_lock
          SET locked_until = NULL, run_id = NULL, updated_at = ?
        WHERE name = ? AND run_id = ?`
    )
    .bind(nowIso(), GA4_STREAM, runId)
    .run();
}

function resolveGscWindow(env, overrides = {}) {
  const lagDays = clampInt(
    toInt(overrides.lagDays ?? env.GSC_DATA_LAG_DAYS, GSC_DEFAULT_LAG_DAYS),
    0,
    10
  );
  const overlapDays = clampInt(
    toInt(overrides.overlapDays ?? env.GSC_OVERLAP_DAYS, GSC_DEFAULT_OVERLAP_DAYS),
    7,
    GSC_MAX_WINDOW_DAYS
  );
  const maxDays = clampInt(toInt(env.GSC_MAX_WINDOW_DAYS, GSC_MAX_WINDOW_DAYS), 7, 180);
  const todayIso = toIsoDay(new Date());
  const defaultEnd = addDaysIso(todayIso, -lagDays);
  const end = String(overrides.end || defaultEnd || "");
  if (!parseIsoDay(end)) throw new Error("invalid end date (YYYY-MM-DD)");

  let start = overrides.start ? String(overrides.start) : "";
  if (!start) start = addDaysIso(end, -(overlapDays - 1)) || "";
  if (!parseIsoDay(start)) throw new Error("invalid start date (YYYY-MM-DD)");
  if (start > end) throw new Error("start date must be on/before end date");

  const days = listIsoDaysInclusive(start, end);
  if (days.length < 1) throw new Error("resolved GSC window is empty");
  if (days.length > maxDays) throw new Error(`resolved GSC window exceeds max days (${maxDays})`);

  return { start, end, days, overlapDays, lagDays };
}

function resolveGa4Window(env, overrides = {}) {
  const lagDays = clampInt(
    toInt(overrides.lagDays ?? env.GA4_DATA_LAG_DAYS, GA4_DEFAULT_LAG_DAYS),
    0,
    10
  );
  const overlapDays = clampInt(
    toInt(overrides.overlapDays ?? env.GA4_OVERLAP_DAYS, GA4_DEFAULT_OVERLAP_DAYS),
    7,
    GA4_MAX_WINDOW_DAYS
  );
  const maxDays = clampInt(toInt(env.GA4_MAX_WINDOW_DAYS, GA4_MAX_WINDOW_DAYS), 7, 180);
  const todayIso = toIsoDay(new Date());
  const defaultEnd = addDaysIso(todayIso, -lagDays);
  const end = String(overrides.end || defaultEnd || "");
  if (!parseIsoDay(end)) throw new Error("invalid end date (YYYY-MM-DD)");

  let start = overrides.start ? String(overrides.start) : "";
  if (!start) start = addDaysIso(end, -(overlapDays - 1)) || "";
  if (!parseIsoDay(start)) throw new Error("invalid start date (YYYY-MM-DD)");
  if (start > end) throw new Error("start date must be on/before end date");

  const days = listIsoDaysInclusive(start, end);
  if (days.length < 1) throw new Error("resolved GA4 window is empty");
  if (days.length > maxDays) throw new Error(`resolved GA4 window exceeds max days (${maxDays})`);

  return { start, end, days, overlapDays, lagDays };
}

async function getGoogleAccessToken(env) {
  for (const key of ["GSC_CLIENT_ID", "GSC_CLIENT_SECRET", "GSC_REFRESH_TOKEN"]) {
    if (!env[key]) throw new Error(`${key} is not configured`);
  }
  const form = new URLSearchParams({
    client_id: env.GSC_CLIENT_ID,
    client_secret: env.GSC_CLIENT_SECRET,
    refresh_token: env.GSC_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`GSC OAuth refresh failed (${res.status}): ${truncate(body?.error_description || body?.error || "", 220)}`);
  }
  return String(body.access_token);
}

async function getGa4AccessToken(env) {
  for (const key of ["GA4_CLIENT_ID", "GA4_CLIENT_SECRET", "GA4_REFRESH_TOKEN"]) {
    if (!env[key]) throw new Error(`${key} is not configured`);
  }
  const form = new URLSearchParams({
    client_id: env.GA4_CLIENT_ID,
    client_secret: env.GA4_CLIENT_SECRET,
    refresh_token: env.GA4_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`GA4 OAuth refresh failed (${res.status}): ${truncate(body?.error_description || body?.error || "", 220)}`);
  }
  return String(body.access_token);
}

function ga4DateToIso(dateValue) {
  const raw = String(dateValue || "").trim();
  if (!/^\d{8}$/.test(raw)) return null;
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return parseIsoDay(iso) ? iso : null;
}

function normalizeGa4Path(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "(not set)") return "";
  let path = s;
  try {
    const u = s.startsWith("http://") || s.startsWith("https://")
      ? new URL(s)
      : new URL(s, "https://mildmate.local");
    path = u.pathname || "/";
  } catch {
    const qIdx = s.indexOf("?");
    const hIdx = s.indexOf("#");
    const cutAt = [qIdx, hIdx].filter((i) => i >= 0).sort((a, b) => a - b)[0];
    path = cutAt >= 0 ? s.slice(0, cutAt) : s;
  }
  path = path.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path.slice(0, 1000);
}

function parseGa4Row(base, metricNames, metricValues) {
  const out = { ...base };
  metricNames.forEach((name, idx) => {
    const v = Number(metricValues?.[idx]?.value || 0);
    if (name === "sessions") out.sessions = Number.isFinite(v) ? Math.round(v) : 0;
    if (name === "totalUsers") out.users = Number.isFinite(v) ? Math.round(v) : 0;
    if (name === "engagedSessions") out.engaged_sessions = Number.isFinite(v) ? Math.round(v) : 0;
    if (name === "eventCount") out.event_count = Number.isFinite(v) ? Math.round(v) : 0;
    if (name === "purchaseRevenue") out.purchase_revenue = Number.isFinite(v) ? v : 0;
  });
  return out;
}

function parseEventNameList(raw, fallback) {
  const input = String(raw || "");
  const parts = input
    .split(",")
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  const chosen = parts.length ? parts : fallback;
  return Array.from(new Set(chosen.map((s) => String(s || "").trim()).filter(Boolean)));
}

function resolveGa4EventFilters(env) {
  return [
    {
      events: parseEventNameList(env.GA4_EVENT_VIEW_ITEM_NAMES, GA4_DEFAULT_VIEW_ITEM_EVENTS),
      field: "product_views",
      includeRevenue: false,
    },
    {
      events: parseEventNameList(env.GA4_EVENT_ADD_TO_CART_NAMES, GA4_DEFAULT_ADD_TO_CART_EVENTS),
      field: "add_to_cart",
      includeRevenue: false,
    },
    {
      events: parseEventNameList(env.GA4_EVENT_BEGIN_CHECKOUT_NAMES, GA4_DEFAULT_BEGIN_CHECKOUT_EVENTS),
      field: "begin_checkout",
      includeRevenue: false,
    },
    {
      events: parseEventNameList(env.GA4_EVENT_PURCHASE_NAMES, GA4_DEFAULT_PURCHASE_EVENTS),
      field: "purchases",
      includeRevenue: true,
    },
  ];
}

async function runGa4Report(env, accessToken, startDate, endDate, metrics, dimensionFilter = null) {
  const propertyId = String(env.GA4_PROPERTY_ID || "").trim();
  if (!propertyId) throw new Error("GA4_PROPERTY_ID is not configured");

  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const pageSize = clampInt(toInt(env.GA4_ROW_PAGE_SIZE, GA4_DEFAULT_PAGE_SIZE), 1000, 250000);
  const rows = [];
  let offset = 0;
  let pages = 0;

  while (true) {
    pages += 1;
    if (pages > GA4_MAX_PAGES_PER_REPORT) {
      throw new Error(`GA4 paging exceeded ${GA4_MAX_PAGES_PER_REPORT} pages`);
    }

    const payload = {
      dateRanges: [{ startDate, endDate }],
      dimensions: GA4_DIMENSIONS.map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
      limit: String(pageSize),
      offset: String(offset),
      keepEmptyRows: false,
    };
    if (dimensionFilter) payload.dimensionFilter = dimensionFilter;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || body?.message || "unknown error";
      throw new Error(`GA4 runReport failed (${res.status}): ${truncate(msg, 240)}`);
    }

    const metricHeaders = Array.isArray(body.metricHeaders) ? body.metricHeaders.map((m) => String(m?.name || "")) : metrics;
    const batch = Array.isArray(body.rows) ? body.rows : [];
    for (const row of batch) {
      const dv = Array.isArray(row?.dimensionValues) ? row.dimensionValues : [];
      const date = ga4DateToIso(dv?.[0]?.value);
      if (!date) continue;
      rows.push(
        parseGa4Row(
          {
            date,
            landing_page_path: normalizeGa4Path(dv?.[1]?.value || ""),
            page_path: normalizeGa4Path(dv?.[2]?.value || ""),
            source: String(dv?.[3]?.value || "").trim() === "(not set)" ? "" : String(dv?.[3]?.value || "").trim().toLowerCase(),
            medium: String(dv?.[4]?.value || "").trim() === "(not set)" ? "" : String(dv?.[4]?.value || "").trim().toLowerCase(),
            campaign: String(dv?.[5]?.value || "").trim() === "(not set)" ? "" : String(dv?.[5]?.value || "").trim(),
            country: String(dv?.[6]?.value || "").trim() === "(not set)" ? "" : String(dv?.[6]?.value || "").trim(),
            device: String(dv?.[7]?.value || "").trim() === "(not set)" ? "" : String(dv?.[7]?.value || "").trim().toLowerCase(),
          },
          metricHeaders,
          row?.metricValues || []
        )
      );
    }

    if (batch.length < pageSize) break;
    offset += batch.length;
  }

  return rows;
}

async function runGa4EventNameSummary(env, accessToken, startDate, endDate, limit = 25) {
  const propertyId = String(env.GA4_PROPERTY_ID || "").trim();
  if (!propertyId) throw new Error("GA4_PROPERTY_ID is not configured");
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const payload = {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: String(clampInt(toInt(limit, 25), 1, 100)),
    keepEmptyRows: false,
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || "unknown error";
    throw new Error(`GA4 events report failed (${res.status}): ${truncate(msg, 240)}`);
  }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  return rows.map((r) => ({
    event_name: String(r?.dimensionValues?.[0]?.value || ""),
    event_count: Number(r?.metricValues?.[0]?.value || 0),
  }));
}

async function runGa4StreamEventSummary(env, accessToken, startDate, endDate, limit = 100) {
  const propertyId = String(env.GA4_PROPERTY_ID || "").trim();
  if (!propertyId) throw new Error("GA4_PROPERTY_ID is not configured");
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const payload = {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "eventName" }, { name: "streamId" }],
    metrics: [{ name: "eventCount" }],
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: String(clampInt(toInt(limit, 100), 1, 500)),
    keepEmptyRows: false,
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || "unknown error";
    throw new Error(`GA4 stream-events report failed (${res.status}): ${truncate(msg, 240)}`);
  }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  return rows.map((r) => ({
    event_name: String(r?.dimensionValues?.[0]?.value || ""),
    stream_id: String(r?.dimensionValues?.[1]?.value || ""),
    event_count: Number(r?.metricValues?.[0]?.value || 0),
  }));
}

async function runGa4RealtimeReport(env, accessToken, minutes = 30, limit = 100, dimensions = ["eventName"]) {
  const propertyId = String(env.GA4_PROPERTY_ID || "").trim();
  if (!propertyId) throw new Error("GA4_PROPERTY_ID is not configured");
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runRealtimeReport`;
  const minuteWindow = clampInt(toInt(minutes, 29), 1, 29);
  const payload = {
    minuteRanges: [{ startMinutesAgo: minuteWindow, endMinutesAgo: 0 }],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: [{ name: "eventCount" }],
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: String(clampInt(toInt(limit, 100), 1, 500)),
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || "unknown error";
    throw new Error(`GA4 realtime report failed (${res.status}): ${truncate(msg, 240)}`);
  }
  return Array.isArray(body.rows) ? body.rows : [];
}

async function runGa4RealtimeSummary(env, accessToken, minutes = 30, limit = 100) {
  const eventRows = await runGa4RealtimeReport(env, accessToken, minutes, limit, ["eventName"]);
  const topEvents = eventRows.map((r) => ({
    event_name: String(r?.dimensionValues?.[0]?.value || ""),
    event_count: Number(r?.metricValues?.[0]?.value || 0),
  }));
  return {
    top_events: topEvents,
    top_event_hosts: [],
    host_breakdown_error: "hostName dimension is not available in GA4 Realtime Data API",
  };
}

async function fetchJsonWithBearer(url, accessToken) {
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function runGa4PropertyDiagnostics(env, accessToken, measurementId = "") {
  const propertyId = String(env.GA4_PROPERTY_ID || "").trim();
  if (!propertyId) throw new Error("GA4_PROPERTY_ID is not configured");
  const out = {
    property_id: propertyId,
    requested_measurement_id: measurementId || null,
    data_api_metadata_ok: false,
    admin_property: null,
    admin_streams: [],
    matched_streams: [],
    errors: {},
  };

  {
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}/metadata`;
    const meta = await fetchJsonWithBearer(url, accessToken);
    if (meta.ok) {
      out.data_api_metadata_ok = true;
      out.data_api_metadata_summary = {
        dimensions: Array.isArray(meta.body?.dimensions) ? meta.body.dimensions.length : 0,
        metrics: Array.isArray(meta.body?.metrics) ? meta.body.metrics.length : 0,
      };
    } else {
      out.errors.data_api_metadata = {
        status: meta.status,
        message: truncate(meta.body?.error?.message || meta.body?.message || "metadata request failed", 280),
      };
    }
  }

  {
    const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}`;
    const prop = await fetchJsonWithBearer(url, accessToken);
    if (prop.ok) {
      out.admin_property = {
        name: String(prop.body?.name || ""),
        display_name: String(prop.body?.displayName || ""),
        parent: String(prop.body?.parent || ""),
        property_type: String(prop.body?.propertyType || ""),
        time_zone: String(prop.body?.timeZone || ""),
        currency_code: String(prop.body?.currencyCode || ""),
      };
    } else {
      out.errors.admin_property = {
        status: prop.status,
        message: truncate(prop.body?.error?.message || prop.body?.message || "admin property request failed", 280),
      };
    }
  }

  {
    const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}/dataStreams?pageSize=200`;
    const streams = await fetchJsonWithBearer(url, accessToken);
    if (streams.ok) {
      const rows = Array.isArray(streams.body?.dataStreams) ? streams.body.dataStreams : [];
      out.admin_streams = rows.map((s) => ({
        name: String(s?.name || ""),
        display_name: String(s?.displayName || ""),
        type: String(s?.type || ""),
        measurement_id: String(s?.webStreamData?.measurementId || ""),
        default_uri: String(s?.webStreamData?.defaultUri || ""),
      }));
    } else {
      out.errors.admin_streams = {
        status: streams.status,
        message: truncate(streams.body?.error?.message || streams.body?.message || "admin streams request failed", 280),
      };
    }
  }

  if (measurementId) {
    const target = String(measurementId).trim().toUpperCase();
    out.matched_streams = out.admin_streams.filter((s) => String(s.measurement_id || "").toUpperCase() === target);
  }

  return out;
}

async function listGa4PropertiesForAccount(accessToken, accountName) {
  const out = [];
  let pageToken = "";
  const account = String(accountName || "").trim();
  if (!/^accounts\/\d+$/.test(account)) throw new Error("invalid account name");
  while (true) {
    const qs = new URLSearchParams({
      filter: `parent:${account}`,
      pageSize: "200",
    });
    if (pageToken) qs.set("pageToken", pageToken);
    const url = `https://analyticsadmin.googleapis.com/v1beta/properties?${qs.toString()}`;
    const res = await fetchJsonWithBearer(url, accessToken);
    if (!res.ok) {
      throw new Error(`properties list failed (${res.status}): ${truncate(res.body?.error?.message || res.body?.message || "unknown", 220)}`);
    }
    const rows = Array.isArray(res.body?.properties) ? res.body.properties : [];
    rows.forEach((p) => out.push(p));
    pageToken = String(res.body?.nextPageToken || "");
    if (!pageToken) break;
  }
  return out;
}

async function listGa4StreamsForProperty(accessToken, propertyName) {
  const out = [];
  let pageToken = "";
  const prop = String(propertyName || "").trim();
  if (!/^properties\/\d+$/.test(prop)) throw new Error("invalid property name");
  while (true) {
    const qs = new URLSearchParams({ pageSize: "200" });
    if (pageToken) qs.set("pageToken", pageToken);
    const url = `https://analyticsadmin.googleapis.com/v1beta/${prop}/dataStreams?${qs.toString()}`;
    const res = await fetchJsonWithBearer(url, accessToken);
    if (!res.ok) {
      throw new Error(`streams list failed (${res.status}): ${truncate(res.body?.error?.message || res.body?.message || "unknown", 220)}`);
    }
    const rows = Array.isArray(res.body?.dataStreams) ? res.body.dataStreams : [];
    rows.forEach((s) => out.push(s));
    pageToken = String(res.body?.nextPageToken || "");
    if (!pageToken) break;
  }
  return out;
}

async function findGa4PropertyByMeasurementId(env, accessToken, measurementId) {
  const target = String(measurementId || "").trim().toUpperCase();
  if (!/^G-[A-Z0-9]+$/.test(target)) throw new Error("measurement_id must look like G-XXXXXXXXXX");

  const current = await runGa4PropertyDiagnostics(env, accessToken, "");
  const account = String(current?.admin_property?.parent || "");
  if (!account) throw new Error("could not resolve parent account from current GA4_PROPERTY_ID");

  const properties = await listGa4PropertiesForAccount(accessToken, account);
  const matches = [];
  for (const p of properties) {
    const propName = String(p?.name || "");
    if (!/^properties\/\d+$/.test(propName)) continue;
    let streams = [];
    try {
      streams = await listGa4StreamsForProperty(accessToken, propName);
    } catch (e) {
      matches.push({
        property_name: propName,
        property_display_name: String(p?.displayName || ""),
        error: truncate(e?.message || String(e), 220),
        streams: [],
      });
      continue;
    }
    const reduced = streams.map((s) => ({
      name: String(s?.name || ""),
      display_name: String(s?.displayName || ""),
      measurement_id: String(s?.webStreamData?.measurementId || ""),
      default_uri: String(s?.webStreamData?.defaultUri || ""),
      type: String(s?.type || ""),
    }));
    const found = reduced.filter((s) => String(s.measurement_id || "").toUpperCase() === target);
    if (found.length) {
      matches.push({
        property_name: propName,
        property_display_name: String(p?.displayName || ""),
        streams: found,
      });
    }
  }

  return {
    searched_account: account,
    requested_measurement_id: target,
    properties_scanned: properties.length,
    matches,
  };
}

function ga4Key(row) {
  return [
    row.date || "",
    row.landing_page_path || "",
    row.page_path || "",
    row.source || "",
    row.medium || "",
    row.campaign || "",
    row.country || "",
    row.device || "",
  ].join("||");
}

function ensureGa4AccumulatorRow(map, seed) {
  const key = ga4Key(seed);
  if (!map.has(key)) {
    map.set(key, {
      date: seed.date,
      landing_page_path: seed.landing_page_path || "",
      page_path: seed.page_path || "",
      source: seed.source || "",
      medium: seed.medium || "",
      campaign: seed.campaign || "",
      country: seed.country || "",
      device: seed.device || "",
      sessions: 0,
      users: 0,
      engaged_sessions: 0,
      product_views: 0,
      add_to_cart: 0,
      begin_checkout: 0,
      purchases: 0,
      purchase_revenue: 0,
    });
  }
  return map.get(key);
}

async function postGa4RowsChunk(env, rows, triggerTag) {
  const apiBase = String(env.GA4_API_BASE || env.MAPPER_API_BASE || "https://www.mildmate.com").replace(/\/+$/, "");
  const token = String(env.SALES_SYNC_API_TOKEN || "");
  if (!token) throw new Error("SALES_SYNC_API_TOKEN is not configured");
  const payload = {
    sync_source: GA4_SYNC_SOURCE,
    scenario: `${GA4_SCENARIO}:${triggerTag}`,
    property: env.GA4_PROPERTY_ID || "",
    rows,
  };
  const res = await fetch(apiBase + GA4_UPSERT_ROUTE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.success !== true) {
    throw new Error(`GA4 upsert failed (${res.status}) ${truncate(body?.message || body?.error_code || "unknown", 220)}`);
  }
  return body;
}

function normalizeGscRow(day, keys, row, searchType) {
  const query = String(keys?.[0] || "").trim();
  const page = String(keys?.[1] || "").trim();
  if (!query || !page) return null;
  const country = String(keys?.[2] || "").trim().toUpperCase();
  const device = String(keys?.[3] || "").trim().toUpperCase();
  return {
    date: day,
    query,
    page,
    country,
    device,
    search_type: searchType,
    search_appearance: "",
    clicks: Number(row?.clicks || 0),
    impressions: Number(row?.impressions || 0),
    ctr: typeof row?.ctr === "number" ? row.ctr : null,
    position: typeof row?.position === "number" ? row.position : null,
  };
}

async function fetchGscRowsForDay(env, accessToken, day) {
  const siteUrl = String(env.GSC_SITE_URL || "").trim();
  if (!siteUrl) throw new Error("GSC_SITE_URL is not configured");

  const searchType = String(env.GSC_SEARCH_TYPE || "web").trim().toLowerCase() || "web";
  const pageSize = clampInt(toInt(env.GSC_ROW_PAGE_SIZE, GSC_DEFAULT_PAGE_SIZE), 1000, 25000);
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const rows = [];
  let startRow = 0;
  let pages = 0;

  while (true) {
    pages += 1;
    if (pages > GSC_MAX_PAGES_PER_DAY) {
      throw new Error(`GSC paging exceeded ${GSC_MAX_PAGES_PER_DAY} pages for ${day}`);
    }

    const payload = {
      startDate: day,
      endDate: day,
      dimensions: GSC_DIMENSIONS,
      rowLimit: pageSize,
      startRow,
      type: searchType,
    };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || body?.message || "unknown error";
      throw new Error(`GSC query failed for ${day} (${res.status}): ${truncate(msg, 240)}`);
    }
    const batch = Array.isArray(body.rows) ? body.rows : [];
    for (const row of batch) {
      const normalized = normalizeGscRow(day, row?.keys || [], row, searchType);
      if (normalized) rows.push(normalized);
    }
    if (batch.length < pageSize) break;
    startRow += batch.length;
  }
  return rows;
}

function chunkRows(rows, chunkSize) {
  const out = [];
  for (let i = 0; i < rows.length; i += chunkSize) out.push(rows.slice(i, i + chunkSize));
  return out;
}

async function postGscRowsChunk(env, rows, triggerTag) {
  const apiBase = String(env.GSC_API_BASE || env.MAPPER_API_BASE || "https://www.mildmate.com").replace(/\/+$/, "");
  const token = String(env.SALES_SYNC_API_TOKEN || "");
  if (!token) throw new Error("SALES_SYNC_API_TOKEN is not configured");
  const payload = {
    sync_source: GSC_SYNC_SOURCE,
    scenario: `${GSC_SCENARIO}:${triggerTag}`,
    property: env.GSC_SITE_URL || "",
    rows,
  };
  const res = await fetch(apiBase + GSC_UPSERT_ROUTE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.success !== true) {
    throw new Error(
      `GSC upsert failed (${res.status}) ${truncate(body?.message || body?.error_code || "unknown", 220)}`
    );
  }
  return body;
}

async function executeGscSync(env, trigger, overrides = {}) {
  for (const required of ["SALES_SYNC_API_TOKEN", "GSC_SITE_URL", "GSC_CLIENT_ID", "GSC_CLIENT_SECRET", "GSC_REFRESH_TOKEN"]) {
    if (!env[required]) return { ok: false, reason: `${required} is not configured` };
  }

  const db = env.DB;
  const runId = `${GSC_STREAM}-${trigger}-${Date.now()}`;
  if (!(await acquireGscLock(db, runId))) {
    console.log("GSC-SYNC: previous run still active, skipping");
    return { ok: true, skipped: "locked" };
  }

  try {
    const window = resolveGscWindow(env, overrides);
    const accessToken = await getGoogleAccessToken(env);
    const chunkSize = clampInt(toInt(env.GSC_UPSERT_CHUNK_SIZE, GSC_DEFAULT_CHUNK_SIZE), 200, 5000);
    const totals = {
      days_in_window: window.days.length,
      fetched_rows: 0,
      sent_rows: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      rejected: 0,
      upsert_calls: 0,
      days_with_rows: 0,
    };
    const day_stats = [];

    for (const day of window.days) {
      const rows = await fetchGscRowsForDay(env, accessToken, day);
      totals.fetched_rows += rows.length;
      if (rows.length === 0) {
        day_stats.push({ day, rows: 0, chunks: 0 });
        continue;
      }
      totals.days_with_rows += 1;
      const chunks = chunkRows(rows, chunkSize);
      for (const chunk of chunks) {
        const out = await postGscRowsChunk(env, chunk, trigger);
        totals.upsert_calls += 1;
        totals.sent_rows += Number(out?.totals?.received || 0);
        totals.created += Number(out?.totals?.created || 0);
        totals.updated += Number(out?.totals?.updated || 0);
        totals.unchanged += Number(out?.totals?.unchanged || 0);
        totals.rejected += Number(out?.totals?.rejected || 0);
      }
      day_stats.push({ day, rows: rows.length, chunks: chunks.length });
    }

    console.log(
      `GSC-SYNC: ${trigger} done — days ${window.days.length}, fetched ${totals.fetched_rows}, sent ${totals.sent_rows}, ` +
      `created ${totals.created}, updated ${totals.updated}, unchanged ${totals.unchanged}, rejected ${totals.rejected}`
    );

    return {
      ok: true,
      source: GSC_SYNC_SOURCE,
      scenario: GSC_SCENARIO,
      trigger,
      window: { start: window.start, end: window.end, days: window.days.length, lag_days: window.lagDays, overlap_days: window.overlapDays },
      totals,
      day_stats,
    };
  } catch (e) {
    const msg = truncate(e?.message || String(e), 280);
    console.log(`GSC-SYNC: ${trigger} failed — ${msg}`);
    return { ok: false, reason: msg };
  } finally {
    await releaseGscLock(db, runId);
  }
}

async function executeGa4Sync(env, trigger, overrides = {}) {
  for (const required of ["SALES_SYNC_API_TOKEN", "GA4_PROPERTY_ID", "GA4_CLIENT_ID", "GA4_CLIENT_SECRET", "GA4_REFRESH_TOKEN"]) {
    if (!env[required]) return { ok: false, reason: `${required} is not configured` };
  }

  const db = env.DB;
  const runId = `${GA4_STREAM}-${trigger}-${Date.now()}`;
  if (!(await acquireGa4Lock(db, runId))) {
    console.log("GA4-SYNC: previous run still active, skipping");
    return { ok: true, skipped: "locked" };
  }

  try {
    const window = resolveGa4Window(env, overrides);
    const accessToken = await getGa4AccessToken(env);
    const chunkSize = clampInt(toInt(env.GA4_UPSERT_CHUNK_SIZE, GA4_DEFAULT_CHUNK_SIZE), 200, 5000);
    const totals = {
      days_in_window: window.days.length,
      fetched_rows: 0,
      sent_rows: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      rejected: 0,
      upsert_calls: 0,
    };

    const acc = new Map();
    const sessionRows = await runGa4Report(
      env,
      accessToken,
      window.start,
      window.end,
      ["sessions", "totalUsers", "engagedSessions"]
    );
    sessionRows.forEach((r) => {
      const row = ensureGa4AccumulatorRow(acc, r);
      row.sessions = Number(r.sessions || 0);
      row.users = Number(r.users || 0);
      row.engaged_sessions = Number(r.engaged_sessions || 0);
    });

    const eventFilters = resolveGa4EventFilters(env);

    for (const ev of eventFilters) {
      for (const eventName of ev.events) {
        const rows = await runGa4Report(
          env,
          accessToken,
          window.start,
          window.end,
          ev.includeRevenue ? ["eventCount", "purchaseRevenue"] : ["eventCount"],
          {
            filter: {
              fieldName: "eventName",
              stringFilter: { matchType: "EXACT", value: eventName },
            },
          }
        );
        rows.forEach((r) => {
          const row = ensureGa4AccumulatorRow(acc, r);
          row[ev.field] = Number(row[ev.field] || 0) + Number(r.event_count || 0);
          if (ev.includeRevenue) row.purchase_revenue = Number(row.purchase_revenue || 0) + Number(r.purchase_revenue || 0);
        });
      }
    }

    const merged = Array.from(acc.values())
      .filter((r) => parseIsoDay(r.date))
      .map((r) => ({
        date: r.date,
        landing_page_path: r.landing_page_path || "",
        page_path: r.page_path || "",
        source: r.source || "",
        medium: r.medium || "",
        campaign: r.campaign || "",
        country: r.country || "",
        device: r.device || "",
        sessions: Number(r.sessions || 0),
        users: Number(r.users || 0),
        engaged_sessions: Number(r.engaged_sessions || 0),
        product_views: Number(r.product_views || 0),
        add_to_cart: Number(r.add_to_cart || 0),
        begin_checkout: Number(r.begin_checkout || 0),
        purchases: Number(r.purchases || 0),
        purchase_revenue: Number(r.purchase_revenue || 0),
      }));

    totals.fetched_rows = merged.length;
    const chunks = chunkRows(merged, chunkSize);
    for (const chunk of chunks) {
      const out = await postGa4RowsChunk(env, chunk, trigger);
      totals.upsert_calls += 1;
      totals.sent_rows += Number(out?.totals?.received || 0);
      totals.created += Number(out?.totals?.created || 0);
      totals.updated += Number(out?.totals?.updated || 0);
      totals.unchanged += Number(out?.totals?.unchanged || 0);
      totals.rejected += Number(out?.totals?.rejected || 0);
    }

    console.log(
      `GA4-SYNC: ${trigger} done — rows ${totals.fetched_rows}, sent ${totals.sent_rows}, ` +
      `created ${totals.created}, updated ${totals.updated}, unchanged ${totals.unchanged}, rejected ${totals.rejected}`
    );

    return {
      ok: true,
      source: GA4_SYNC_SOURCE,
      scenario: GA4_SCENARIO,
      trigger,
      window: { start: window.start, end: window.end, days: window.days.length, lag_days: window.lagDays, overlap_days: window.overlapDays },
      event_filters: eventFilters,
      totals,
    };
  } catch (e) {
    const msg = truncate(e?.message || String(e), 280);
    console.log(`GA4-SYNC: ${trigger} failed — ${msg}`);
    return { ok: false, reason: msg };
  } finally {
    await releaseGa4Lock(db, runId);
  }
}

// ── State ──────────────────────────────────────────────────────────────────

async function loadState(db) {
  const row = await db
    .prepare(`SELECT cursor, last_status, consecutive_failures FROM marketing_sync_state WHERE name = ?`)
    .bind(STREAM)
    .first();
  return row || { cursor: null, last_status: null, consecutive_failures: 0 };
}

async function saveCursor(db, cursor) {
  await db
    .prepare(`UPDATE marketing_sync_state SET cursor = ?, updated_at = ? WHERE name = ?`)
    .bind(cursor, nowIso(), STREAM)
    .run();
}

async function finishState(db, { cursor, status, processed, synced, failed }) {
  await db
    .prepare(
      `UPDATE marketing_sync_state
          SET cursor = ?, last_run_at = ?, last_status = ?, last_processed = ?, last_synced = ?,
              last_success_at = CASE WHEN ? THEN ? ELSE last_success_at END,
              consecutive_failures = CASE WHEN ? THEN consecutive_failures + 1 ELSE 0 END,
              updated_at = ?
        WHERE name = ?`
    )
    .bind(cursor, nowIso(), status, processed, synced, failed ? 0 : 1, nowIso(), failed ? 1 : 0, nowIso(), STREAM)
    .run();
}

// ── Telemetry ──────────────────────────────────────────────────────────────

async function startRun(db, trigger) {
  const res = await db
    .prepare(`INSERT INTO sync_runs (source, scenario, started_at, status) VALUES (?, ?, ?, 'running')`)
    .bind(SYNC_SOURCE, `${SCENARIO}:${trigger}`, nowIso())
    .run();
  return res.meta?.last_row_id ?? null;
}

async function finishRun(db, runRowId, { status, counts, processed, errorMessage }) {
  if (!runRowId) return;
  const skipped = Object.entries(counts)
    .filter(([k]) => k.startsWith("skipped"))
    .reduce((a, [, v]) => a + v, 0);
  await db
    .prepare(
      `UPDATE sync_runs
          SET finished_at = ?, status = ?, records_received = ?, records_created = ?,
              records_updated = ?, records_unchanged = ?, records_rejected = ?, error_message = ?
        WHERE id = ?`
    )
    .bind(
      nowIso(),
      status,
      processed,
      counts.synced || 0,
      0, // created vs updated is decided inside the upsert API; counted together as synced
      counts.skipped_unchanged || 0,
      skipped - (counts.skipped_unchanged || 0),
      errorMessage ? truncate(errorMessage, 500) : null,
      runRowId
    )
    .run();
}

// Per-record audit trail. Buffered during the run and written in one batch so
// a long run does not pay a D1 round-trip per record.
function newAuditBuffer(db, dryRun) {
  const rows = [];
  return {
    collect({ rec, parsed, action }) {
      rows.push(
        db
          .prepare(
            `INSERT INTO product_mapping_events
               (notion_page_id, source_order_id, source_system, raw_product_text,
                previous_product_ids, resolved_product_ids, mapping_method, confidence,
                result_status, dry_run, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'HUMAN', 1.0, 'Mapped', ?, ?)`
          )
          .bind(
            rec.page_id,
            rec.order_number,
            rec.shop,
            truncate(rec.d1_product_map, 500),
            rec.d1_product_ids || null,
            JSON.stringify(parsed.items.map((i) => i.product_id)),
            dryRun ? 1 : 0,
            nowIso()
          )
      );
    },
    async flush() {
      if (rows.length === 0) return;
      await db.batch(rows);
      rows.length = 0;
    },
  };
}

// ── Main run ───────────────────────────────────────────────────────────────

async function executeSync(env, trigger, overrides = {}) {
  const db = env.DB;
  const runId = `${trigger}-${Date.now()}`;

  for (const required of ["NOTION_TOKEN", "NOTION_DATA_SOURCE_ID", "SALES_SYNC_API_TOKEN"]) {
    if (!env[required]) return { ok: false, reason: `${required} is not configured` };
  }

  const state = await loadState(db);

  // The hourly drain exists only to finish carry-over work; it must not start
  // a fresh scan, or it would turn a fortnightly cadence into an hourly one.
  if (trigger === "drain" && state.last_status !== "partial") {
    return { ok: true, skipped: "nothing to drain" };
  }

  if (!(await acquireLock(db, runId))) {
    console.log("MARKETING-SYNC: previous run still active, skipping");
    await db
      .prepare(`UPDATE marketing_sync_state SET last_run_at = ?, last_status = 'skipped_locked', updated_at = ? WHERE name = ?`)
      .bind(nowIso(), nowIso(), STREAM)
      .run();
    return { ok: true, skipped: "locked" };
  }

  const dryRun = Boolean(overrides.dryRun);
  const before = overrides.before !== undefined ? overrides.before : resolveBefore(env);
  const apiBase = (env.MAPPER_API_BASE || "https://www.mildmate.com").replace(/\/+$/, "");
  const runRowId = await startRun(db, trigger);
  const audit = newAuditBuffer(db, dryRun);

  // Worker-side logger: structured lines to the Workers log stream. Never logs
  // secrets; record identifiers and skip reasons only.
  const log = {
    write: (obj) => {
      if (obj.t === "error" || obj.t === "bounded_stop") console.log(`MARKETING-SYNC ${JSON.stringify(obj)}`);
    },
  };

  let result;
  let errorMessage = null;
  try {
    const catalog = await fetchCatalogIds(apiBase, env.SALES_SYNC_API_TOKEN);

    result = await runSync({
      apiBase,
      apiToken: env.SALES_SYNC_API_TOKEN,
      notionToken: env.NOTION_TOKEN,
      dataSourceId: env.NOTION_DATA_SOURCE_ID,
      dryRun,
      before,
      limit: overrides.limit ?? null,
      orderId: overrides.orderId ?? null,
      cursor: state.cursor || null,
      catalogIds: catalog.ids,
      maxMs: overrides.maxMs ?? DEFAULT_MAX_MS,
      syncSource: SYNC_SOURCE,
      scenario: SCENARIO,
      log,
      onCursor: (cursor) => saveCursor(db, cursor),
      onEvent: ({ rec, parsed, action }) => audit.collect({ rec, parsed, action }),
    });
  } catch (e) {
    errorMessage = e.message;
    console.log(`MARKETING-SYNC: run failed — ${truncate(e.message, 300)}`);
    await finishRun(db, runRowId, { status: "failed", counts: {}, processed: 0, errorMessage });
    await finishState(db, { cursor: state.cursor || null, status: "failed", processed: 0, synced: 0, failed: true });
    await releaseLock(db, runId);
    return { ok: false, reason: truncate(e.message, 300) };
  }

  const { counts, processed, report, cursor, exhausted } = result;
  const errCount = counts.errors || 0;
  // A completed pass resets the cursor so the next scheduled run rescans from
  // the top and picks up newly-corrected records anywhere in the table.
  const nextCursor = exhausted ? null : cursor;
  const status = errCount > 0 ? "partial" : exhausted ? "success" : "partial";

  try {
    await audit.flush();
  } catch (e) {
    // Audit is observability, not correctness: never fail a completed sync on it.
    console.log(`MARKETING-SYNC: audit flush failed — ${truncate(e.message, 200)}`);
  }

  await finishRun(db, runRowId, { status: errCount > 0 ? "partial" : "success", counts, processed, errorMessage: null });
  await finishState(db, {
    cursor: nextCursor,
    status,
    processed,
    synced: counts.synced || 0,
    failed: errCount > 0,
  });
  await releaseLock(db, runId);

  // Email only on a completed pass or when something needs attention. Bounded
  // mid-batch drain runs stay silent, keeping the cadence at ~2 reports/month.
  const shouldEmail = !dryRun && (exhausted || errCount > 0);
  let emailed = null;
  if (shouldEmail) {
    try {
      const mail = buildReportEmail({
        args: { dryRun, before },
        counts,
        processed,
        report,
        logFile: null,
        trigger: `scheduled Worker (${trigger})`,
      });
      const sent = await sendReportEmail({
        ...mail,
        apiKey: env.RESEND_API_KEY,
        to: env.REPORT_EMAIL_TO || REPORT_EMAIL_TO_DEFAULT,
      });
      emailed = sent.success ? sent.id || "sent" : `failed: ${sent.error}`;
    } catch (e) {
      // A report failure never fails the sync run itself.
      emailed = `failed: ${truncate(e.message, 200)}`;
    }
  }

  console.log(
    `MARKETING-SYNC: ${trigger} done — processed ${processed}, synced ${counts.synced || 0}, ` +
      `errors ${errCount}, exhausted ${exhausted}, email ${emailed || "skipped"}`
  );

  return { ok: true, counts, processed, exhausted, status, email: emailed, before, dryRun };
}

export default {
  async scheduled(event, env, ctx) {
    if (event.cron === GA4_WEEKLY_CRON) {
      ctx.waitUntil(
        executeGa4Sync(env, "scheduled-weekly").catch((e) =>
          console.log(`GA4-SYNC: unhandled — ${truncate(e.message, 300)}`)
        )
      );
      return;
    }

    if (event.cron === GSC_WEEKLY_CRON) {
      ctx.waitUntil(
        executeGscSync(env, "scheduled-weekly").catch((e) =>
          console.log(`GSC-SYNC: unhandled — ${truncate(e.message, 300)}`)
        )
      );
      return;
    }

    // 02:00 UTC on the 1st/15th is the main pass; every other hour is a drain
    // that returns immediately unless carry-over work exists.
    const trigger = event.cron === DRAIN_CRON ? "drain" : "scheduled";
    if (event.cron !== MAIN_CRON && event.cron !== DRAIN_CRON) {
      console.log(`MARKETING-SYNC: unsupported cron "${event.cron}" ignored`);
      return;
    }
    ctx.waitUntil(
      executeSync(env, trigger).catch((e) => console.log(`MARKETING-SYNC: unhandled — ${truncate(e.message, 300)}`))
    );
  },

  /**
   * Manual trigger for the controlled rollout test (run with the cron schedule
   * still OFF) and for ad-hoc operator runs. Requires the same bearer token the
   * sales API uses, so it is not publicly invokable.
   *
   *   POST /run?dry=1&limit=5[&before=YYYY-MM-DD|none]
   *   GET  /status
   *   POST /gsc/run?[start=YYYY-MM-DD&end=YYYY-MM-DD&overlap=14&lag=3]
   *   GET  /gsc/status
   *   POST /ga4/run?[start=YYYY-MM-DD&end=YYYY-MM-DD&overlap=14&lag=2]
   *   GET  /ga4/status
   *   GET  /ga4/debug-events?[start=YYYY-MM-DD&end=YYYY-MM-DD&limit=25]
   *   GET  /ga4/debug-realtime?[minutes=30&limit=100]
   *   GET  /ga4/debug-stream-events?[start=YYYY-MM-DD&end=YYYY-MM-DD&limit=100]
   *   GET  /ga4/debug-property?[measurement_id=G-XXXX]
   *   GET  /ga4/find-property-by-measurement?measurement_id=G-XXXX
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    const auth = request.headers.get("authorization") || "";
    if (!env.SALES_SYNC_API_TOKEN || auth !== `Bearer ${env.SALES_SYNC_API_TOKEN}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    if (url.pathname === "/status") {
      const state = await loadState(env.DB);
      const lock = await env.DB.prepare(`SELECT locked_until, run_id FROM marketing_sync_lock WHERE name = ?`)
        .bind(STREAM)
        .first();
      const lastRun = await env.DB.prepare(
        `SELECT id, scenario, started_at, finished_at, status, records_received, records_created, records_unchanged, records_rejected
           FROM sync_runs WHERE source = ? ORDER BY COALESCE(finished_at, started_at) DESC LIMIT 1`
      )
        .bind(SYNC_SOURCE)
        .first();
      return Response.json({
        stream: STREAM,
        state,
        lock,
        last_run: lastRun,
        resolved_before: resolveBefore(env),
      });
    }

    if (url.pathname === "/run" && request.method === "POST") {
      const beforeParam = url.searchParams.get("before");
      const overrides = {
        dryRun: url.searchParams.get("dry") === "1",
        limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : null,
        orderId: url.searchParams.get("order-id") ? Number(url.searchParams.get("order-id")) : null,
      };
      if (beforeParam !== null) overrides.before = beforeParam === "none" ? null : beforeParam;
      if (url.searchParams.get("max-ms")) overrides.maxMs = Number(url.searchParams.get("max-ms"));

      const out = await executeSync(env, "manual", overrides);
      return Response.json(out, { status: out.ok ? 200 : 500 });
    }

    if (url.pathname === "/gsc/status") {
      let freshness = null;
      try {
        freshness = await env.DB.prepare(`SELECT * FROM analysis_gsc_freshness`).first();
      } catch {
        freshness = null;
      }
      const runs = await env.DB.prepare(
        `SELECT id, source, scenario, started_at, finished_at, status,
                records_received, records_created, records_updated, records_unchanged, records_rejected, error_message
           FROM sync_runs
          WHERE source LIKE 'gsc-%'
          ORDER BY COALESCE(finished_at, started_at) DESC
          LIMIT 10`
      ).all();
      const lock = await env.DB
        .prepare(`SELECT locked_until, run_id FROM marketing_sync_lock WHERE name = ?`)
        .bind(GSC_STREAM)
        .first();
      let window = null;
      try {
        window = resolveGscWindow(env);
      } catch {
        window = null;
      }
      return Response.json({
        stream: GSC_STREAM,
        source: GSC_SYNC_SOURCE,
        scenario: GSC_SCENARIO,
        cron: GSC_WEEKLY_CRON,
        lock: lock || null,
        freshness,
        default_window: window ? { start: window.start, end: window.end, days: window.days.length } : null,
        recent_runs: runs.results || [],
      });
    }

    if (url.pathname === "/gsc/run" && request.method === "POST") {
      const overrides = {
        start: url.searchParams.get("start") || null,
        end: url.searchParams.get("end") || null,
        overlapDays: url.searchParams.get("overlap") ? Number(url.searchParams.get("overlap")) : null,
        lagDays: url.searchParams.get("lag") ? Number(url.searchParams.get("lag")) : null,
      };
      const out = await executeGscSync(env, "manual", overrides);
      return Response.json(out, { status: out.ok ? 200 : 500 });
    }

    if (url.pathname === "/ga4/status") {
      let freshness = null;
      try {
        freshness = await env.DB.prepare(`SELECT * FROM analysis_ga4_freshness`).first();
      } catch {
        freshness = null;
      }
      const runs = await env.DB.prepare(
        `SELECT id, source, scenario, started_at, finished_at, status,
                records_received, records_created, records_updated, records_unchanged, records_rejected, error_message
           FROM sync_runs
          WHERE source LIKE 'ga4-%'
          ORDER BY COALESCE(finished_at, started_at) DESC
          LIMIT 10`
      ).all();
      const lock = await env.DB
        .prepare(`SELECT locked_until, run_id FROM marketing_sync_lock WHERE name = ?`)
        .bind(GA4_STREAM)
        .first();
      let window = null;
      try {
        window = resolveGa4Window(env);
      } catch {
        window = null;
      }
      return Response.json({
        stream: GA4_STREAM,
        source: GA4_SYNC_SOURCE,
        scenario: GA4_SCENARIO,
        cron: GA4_WEEKLY_CRON,
        event_filters: resolveGa4EventFilters(env),
        lock: lock || null,
        freshness,
        default_window: window ? { start: window.start, end: window.end, days: window.days.length } : null,
        recent_runs: runs.results || [],
      });
    }

    if (url.pathname === "/ga4/debug-events") {
      const start = url.searchParams.get("start") || null;
      const end = url.searchParams.get("end") || null;
      const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 25;
      const window = resolveGa4Window(env, { start, end });
      const accessToken = await getGa4AccessToken(env);
      const events = await runGa4EventNameSummary(env, accessToken, window.start, window.end, limit);
      return Response.json({
        source: GA4_SYNC_SOURCE,
        window: { start: window.start, end: window.end, days: window.days.length },
        configured_event_filters: resolveGa4EventFilters(env),
        top_events: events,
      });
    }

    if (url.pathname === "/ga4/debug-stream-events") {
      try {
        const start = url.searchParams.get("start") || null;
        const end = url.searchParams.get("end") || null;
        const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 100;
        const window = resolveGa4Window(env, { start, end });
        const accessToken = await getGa4AccessToken(env);
        const rows = await runGa4StreamEventSummary(env, accessToken, window.start, window.end, limit);
        return Response.json({
          source: GA4_SYNC_SOURCE,
          window: { start: window.start, end: window.end, days: window.days.length },
          rows,
        });
      } catch (e) {
        return Response.json(
          {
            error: "ga4_stream_events_debug_failed",
            message: truncate(e?.message || String(e), 280),
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/ga4/debug-realtime") {
      try {
        const minutes = url.searchParams.get("minutes") ? Number(url.searchParams.get("minutes")) : 29;
        const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 100;
        const accessToken = await getGa4AccessToken(env);
        const realtime = await runGa4RealtimeSummary(env, accessToken, minutes, limit);
        return Response.json({
          source: GA4_SYNC_SOURCE,
          window_minutes: clampInt(toInt(minutes, 29), 1, 29),
          configured_event_filters: resolveGa4EventFilters(env),
          top_events: realtime.top_events,
          top_event_hosts: realtime.top_event_hosts,
          host_breakdown_error: realtime.host_breakdown_error || null,
        });
      } catch (e) {
        return Response.json(
          {
            error: "ga4_realtime_debug_failed",
            message: truncate(e?.message || String(e), 280),
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/ga4/debug-property") {
      try {
        const measurementId = String(url.searchParams.get("measurement_id") || "").trim();
        const accessToken = await getGa4AccessToken(env);
        const diag = await runGa4PropertyDiagnostics(env, accessToken, measurementId);
        return Response.json(diag);
      } catch (e) {
        return Response.json(
          {
            error: "ga4_property_debug_failed",
            message: truncate(e?.message || String(e), 280),
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/ga4/find-property-by-measurement") {
      try {
        const measurementId = String(url.searchParams.get("measurement_id") || "").trim();
        const accessToken = await getGa4AccessToken(env);
        const out = await findGa4PropertyByMeasurementId(env, accessToken, measurementId);
        return Response.json(out);
      } catch (e) {
        return Response.json(
          {
            error: "ga4_find_property_failed",
            message: truncate(e?.message || String(e), 280),
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/ga4/run" && request.method === "POST") {
      const overrides = {
        start: url.searchParams.get("start") || null,
        end: url.searchParams.get("end") || null,
        overlapDays: url.searchParams.get("overlap") ? Number(url.searchParams.get("overlap")) : null,
        lagDays: url.searchParams.get("lag") ? Number(url.searchParams.get("lag")) : null,
      };
      const out = await executeGa4Sync(env, "manual", overrides);
      return Response.json(out, { status: out.ok ? 200 : 500 });
    }

    return Response.json({ error: "not found" }, { status: 404 });
  },
};
