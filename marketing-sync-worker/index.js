/**
 * MildMate Marketing Decision System â€” Phase 17
 * Scheduled confirmed-mapping sync Worker.
 *
 * Automates the Phase 07 v3 sync so Make.com-confirmed `Mapped` OrderList
 * records reach D1 without a human running the CLI. This Worker is a thin
 * scheduling/persistence shell: ALL sync logic comes from the shared engine
 * `scripts/notion-mapper-core.mjs`, which the manual CLI also uses. The logic
 * is never forked â€” fix the core and both runtimes change together.
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
 *   "0 2 1,15 * *"  main run â€” 1st and 15th at 02:00 UTC (09:00 Bangkok).
 *                   Cron cannot express a true 14-day interval; twice-monthly
 *                   on fixed dates is deterministic and needs no extra state.
 *   "0 * * * *"     drain â€” no-ops unless the previous run stopped bounded
 *                   with carry-over work. Without this, a batch too large for
 *                   one invocation would wait a fortnight to finish.
 *   "0 3 * * 1"     GSC weekly collector (Monday 03:00 UTC) with overlap
 *                   window to absorb late-settling Search Console rows.
 *   "0 4 * * 1"     GA4 + Etsy + Google Ads weekly collectors (Monday
 *                   04:00 UTC) with overlap windows to absorb late-settling
 *                   rows.
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
// Session-scoped metrics must not be dimensioned by pagePath: GA4 counts a
// session once per page it touched, so page-dimensioned session sums inflate.
// Landing page is unique per session, so these sums stay exact.
const GA4_TRAFFIC_DIMENSIONS = GA4_DIMENSIONS.filter((name) => name !== "pagePath");
const GA4_DEFAULT_VIEW_ITEM_EVENTS = ["view_item"];
const GA4_DEFAULT_ADD_TO_CART_EVENTS = ["add_to_cart"];
const GA4_DEFAULT_BEGIN_CHECKOUT_EVENTS = ["begin_checkout"];
const GA4_DEFAULT_PURCHASE_EVENTS = ["purchase"];

const ETSY_STREAM = "etsy-weekly-sync";
const ETSY_SYNC_SOURCE = "etsy-worker-cron";
const ETSY_SCENARIO = "phase11-weekly-etsy-sync";
const ETSY_WEEKLY_CRON = "0 4 * * 1"; // shared weekly Monday 04:00 UTC run
const ETSY_UPSERT_ROUTE = "/api/v1/etsy/rows/upsert";
const ETSY_LOCK_TTL_MS = 20 * 60 * 1000;
const ETSY_DEFAULT_OVERLAP_DAYS = 14;
const ETSY_DEFAULT_LAG_DAYS = 1;
const ETSY_DEFAULT_LISTING_PAGE_SIZE = 100;
const ETSY_DEFAULT_RECEIPT_PAGE_SIZE = 100;
const ETSY_DEFAULT_CHUNK_SIZE = 1000;
const ETSY_MAX_WINDOW_DAYS = 120;
const ETSY_STATES = ["active", "inactive", "sold_out", "draft", "removed", "expired"];

const GOOGLE_ADS_STREAM = "google-ads-weekly-sync";
const GOOGLE_ADS_SYNC_SOURCE = "google-ads-worker-cron";
const GOOGLE_ADS_SCENARIO = "phase12-weekly-google-ads-sync";
const GOOGLE_ADS_WEEKLY_CRON = "0 4 * * 1"; // shared weekly Monday 04:00 UTC run
const GOOGLE_ADS_UPSERT_ROUTE = "/api/v1/google-ads/rows/upsert";
const GOOGLE_ADS_LOCK_TTL_MS = 20 * 60 * 1000;
const GOOGLE_ADS_DEFAULT_OVERLAP_DAYS = 14;
const GOOGLE_ADS_DEFAULT_LAG_DAYS = 2;
const GOOGLE_ADS_DEFAULT_CHUNK_SIZE = 1000;
const GOOGLE_ADS_MAX_WINDOW_DAYS = 90;

// Stop and carry over via the cursor before the platform can cut the run off
// mid-record. Notion calls are throttled to ~350ms, so this is wall-clock bound.
const DEFAULT_MAX_MS = 180_000;
// Workers also cap subrequests per invocation (50 on the free plan, shared by
// Notion calls, upsert POSTs, and D1 statements). Budget the core's outbound
// HTTP calls well under that so the run bounded-stops instead of dying with
// "Too many subrequests" (run 565, 2026-10-01). Headroom is left for the
// worker's own D1 state/lock/cursor writes.
const DEFAULT_MAX_SUBREQUESTS = 20;
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
 * the newest safely-syncable month is the one before last â€” cutoff = first day
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

// â”€â”€ Lock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

async function acquireEtsyLock(db, runId) {
  await ensureLockRow(db, ETSY_STREAM);
  const until = new Date(Date.now() + ETSY_LOCK_TTL_MS).toISOString();
  const res = await db
    .prepare(
      `UPDATE marketing_sync_lock
          SET locked_until = ?, run_id = ?, updated_at = ?
        WHERE name = ?
          AND (locked_until IS NULL OR locked_until < ?)`
    )
    .bind(until, runId, nowIso(), ETSY_STREAM, nowIso())
    .run();
  return (res.meta?.changes ?? 0) === 1;
}

async function releaseEtsyLock(db, runId) {
  await db
    .prepare(
      `UPDATE marketing_sync_lock
          SET locked_until = NULL, run_id = NULL, updated_at = ?
        WHERE name = ? AND run_id = ?`
    )
    .bind(nowIso(), ETSY_STREAM, runId)
    .run();
}

async function acquireGoogleAdsLock(db, runId) {
  await ensureLockRow(db, GOOGLE_ADS_STREAM);
  const until = new Date(Date.now() + GOOGLE_ADS_LOCK_TTL_MS).toISOString();
  const res = await db
    .prepare(
      `UPDATE marketing_sync_lock
          SET locked_until = ?, run_id = ?, updated_at = ?
        WHERE name = ?
          AND (locked_until IS NULL OR locked_until < ?)`
    )
    .bind(until, runId, nowIso(), GOOGLE_ADS_STREAM, nowIso())
    .run();
  return (res.meta?.changes ?? 0) === 1;
}

async function releaseGoogleAdsLock(db, runId) {
  await db
    .prepare(
      `UPDATE marketing_sync_lock
          SET locked_until = NULL, run_id = NULL, updated_at = ?
        WHERE name = ? AND run_id = ?`
    )
    .bind(nowIso(), GOOGLE_ADS_STREAM, runId)
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

function resolveEtsyWindow(env, overrides = {}) {
  const lagDays = clampInt(
    toInt(overrides.lagDays ?? env.ETSY_DATA_LAG_DAYS, ETSY_DEFAULT_LAG_DAYS),
    0,
    10
  );
  const overlapDays = clampInt(
    toInt(overrides.overlapDays ?? env.ETSY_OVERLAP_DAYS, ETSY_DEFAULT_OVERLAP_DAYS),
    7,
    ETSY_MAX_WINDOW_DAYS
  );
  const maxDays = clampInt(toInt(env.ETSY_MAX_WINDOW_DAYS, ETSY_MAX_WINDOW_DAYS), 7, 180);
  const todayIso = toIsoDay(new Date());
  const defaultEnd = addDaysIso(todayIso, -lagDays);
  const end = String(overrides.end || defaultEnd || "");
  if (!parseIsoDay(end)) throw new Error("invalid end date (YYYY-MM-DD)");

  let start = overrides.start ? String(overrides.start) : "";
  if (!start) start = addDaysIso(end, -(overlapDays - 1)) || "";
  if (!parseIsoDay(start)) throw new Error("invalid start date (YYYY-MM-DD)");
  if (start > end) throw new Error("start date must be on/before end date");

  const days = listIsoDaysInclusive(start, end);
  if (days.length < 1) throw new Error("resolved Etsy window is empty");
  if (days.length > maxDays) throw new Error(`resolved Etsy window exceeds max days (${maxDays})`);

  return { start, end, days, overlapDays, lagDays };
}

function resolveGoogleAdsWindow(env, overrides = {}) {
  const lagDays = clampInt(
    toInt(overrides.lagDays ?? env.GOOGLE_ADS_DATA_LAG_DAYS, GOOGLE_ADS_DEFAULT_LAG_DAYS),
    0,
    10
  );
  const overlapDays = clampInt(
    toInt(overrides.overlapDays ?? env.GOOGLE_ADS_OVERLAP_DAYS, GOOGLE_ADS_DEFAULT_OVERLAP_DAYS),
    7,
    GOOGLE_ADS_MAX_WINDOW_DAYS
  );
  const maxDays = clampInt(
    toInt(env.GOOGLE_ADS_MAX_WINDOW_DAYS, GOOGLE_ADS_MAX_WINDOW_DAYS),
    7,
    180
  );
  const todayIso = toIsoDay(new Date());
  const defaultEnd = addDaysIso(todayIso, -lagDays);
  const end = String(overrides.end || defaultEnd || "");
  if (!parseIsoDay(end)) throw new Error("invalid end date (YYYY-MM-DD)");

  let start = overrides.start ? String(overrides.start) : "";
  if (!start) start = addDaysIso(end, -(overlapDays - 1)) || "";
  if (!parseIsoDay(start)) throw new Error("invalid start date (YYYY-MM-DD)");
  if (start > end) throw new Error("start date must be on/before end date");

  const days = listIsoDaysInclusive(start, end);
  if (days.length < 1) throw new Error("resolved Google Ads window is empty");
  if (days.length > maxDays) throw new Error(`resolved Google Ads window exceeds max days (${maxDays})`);

  return { start, end, days, overlapDays, lagDays };
}

function etsyApiBase(env) {
  return String(env.ETSY_API_BASE || "https://openapi.etsy.com").replace(/\/+$/, "");
}

function etsyAuthHeaders(env, accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "x-api-key": `${env.ETSY_CLIENT_ID}:${env.ETSY_CLIENT_SECRET}`,
    "Content-Type": "application/json",
  };
}

function toUnixStartOfDay(isoDay) {
  const d = parseIsoDay(isoDay);
  if (!d) return null;
  return Math.floor(d.getTime() / 1000);
}

function toUnixEndOfDay(isoDay) {
  const d = parseIsoDay(isoDay);
  if (!d) return null;
  d.setUTCHours(23, 59, 59, 0);
  return Math.floor(d.getTime() / 1000);
}

function parseEtsyAmount(v) {
  if (!v || typeof v !== "object") return 0;
  const amount = Number(v.amount || 0);
  const divisor = Number(v.divisor || 1);
  if (!Number.isFinite(amount) || !Number.isFinite(divisor) || divisor === 0) return 0;
  return amount / divisor;
}

function normalizeEtsyState(v) {
  const s = String(v || "").trim().toLowerCase();
  return s || "active";
}

function etsyStateIsActive(state) {
  return state === "active";
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

async function getGoogleAdsAccessToken(env) {
  for (const key of ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN"]) {
    if (!env[key]) throw new Error(`${key} is not configured`);
  }
  const form = new URLSearchParams({
    client_id: env.GOOGLE_ADS_CLIENT_ID,
    client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(
      `Google Ads OAuth refresh failed (${res.status}): ${truncate(body?.error_description || body?.error || "", 220)}`
    );
  }
  return String(body.access_token);
}

function etsyBase64ToBytes(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function etsyBytesToBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function getEtsyTokenEncryptionKey(env) {
  if (!env.ETSY_TOKEN_ENCRYPTION_KEY) {
    throw new Error("ETSY_TOKEN_ENCRYPTION_KEY is not configured");
  }

  const rawKey = etsyBase64ToBytes(
    String(env.ETSY_TOKEN_ENCRYPTION_KEY).trim()
  );

  if (rawKey.byteLength !== 32) {
    throw new Error(
      "ETSY_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes"
    );
  }

  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptEtsyRefreshToken(env, refreshToken) {
  const key = await getEtsyTokenEncryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(String(refreshToken));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  return {
    ciphertext: etsyBytesToBase64(new Uint8Array(encrypted)),
    iv: etsyBytesToBase64(iv),
  };
}

async function decryptEtsyRefreshToken(env, ciphertext, ivBase64) {
  const key = await getEtsyTokenEncryptionKey(env);
  const iv = etsyBase64ToBytes(ivBase64);
  const encrypted = etsyBase64ToBytes(ciphertext);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(plaintext);
}

async function loadEtsyRefreshToken(env) {
  const row = await env.DB
    .prepare(
      `SELECT refresh_token_ciphertext, refresh_token_iv
         FROM oauth_token_state
        WHERE provider = ?
        LIMIT 1`
    )
    .bind("etsy")
    .first();

  if (row?.refresh_token_ciphertext && row?.refresh_token_iv) {
    return decryptEtsyRefreshToken(
      env,
      row.refresh_token_ciphertext,
      row.refresh_token_iv
    );
  }

  const fallback = String(env.ETSY_REFRESH_TOKEN || "").trim();

  if (!fallback) {
    throw new Error(
      "No Etsy refresh token is available in D1 or ETSY_REFRESH_TOKEN"
    );
  }

  return fallback;
}

async function saveEtsyRefreshToken(env, refreshToken) {
  const encrypted = await encryptEtsyRefreshToken(env, refreshToken);

  await env.DB
    .prepare(
      `INSERT INTO oauth_token_state
         (provider, refresh_token_ciphertext, refresh_token_iv, token_version, updated_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(provider) DO UPDATE SET
         refresh_token_ciphertext = excluded.refresh_token_ciphertext,
         refresh_token_iv = excluded.refresh_token_iv,
         token_version = excluded.token_version,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind("etsy", encrypted.ciphertext, encrypted.iv)
    .run();
}

async function getEtsyAccessToken(env) {
  for (const key of [
    "ETSY_CLIENT_ID",
    "ETSY_CLIENT_SECRET",
    "ETSY_TOKEN_ENCRYPTION_KEY",
  ]) {
    if (!env[key]) throw new Error(`${key} is not configured`);
  }

  const refreshToken = await loadEtsyRefreshToken(env);

  const form = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.ETSY_CLIENT_ID,
    client_secret: env.ETSY_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const res = await fetch(
    "https://openapi.etsy.com/v3/public/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );

  const body = await res.json().catch(() => ({}));

  if (!res.ok || !body.access_token) {
    throw new Error(
      `Etsy OAuth refresh failed (${res.status}): ${truncate(
        body?.error_description || body?.error || "",
        220
      )}`
    );
  }

  const nextRefreshToken = String(body?.refresh_token || "").trim();

  if (nextRefreshToken) {
    await saveEtsyRefreshToken(env, nextRefreshToken);
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

async function runGa4Report(env, accessToken, startDate, endDate, metrics, dimensionFilter = null, dimensions = GA4_DIMENSIONS) {
  const propertyId = String(env.GA4_PROPERTY_ID || "").trim();
  if (!propertyId) throw new Error("GA4_PROPERTY_ID is not configured");

  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const pageSize = clampInt(toInt(env.GA4_ROW_PAGE_SIZE, GA4_DEFAULT_PAGE_SIZE), 1000, 250000);
  const dimIndex = {};
  dimensions.forEach((name, i) => {
    dimIndex[name] = i;
  });
  const dimValue = (dv, name) => {
    const i = dimIndex[name];
    return i === undefined ? "" : String(dv?.[i]?.value || "");
  };
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
      dimensions: dimensions.map((name) => ({ name })),
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
      const date = ga4DateToIso(dimValue(dv, "date"));
      if (!date) continue;
      const cleanDim = (name, lower = false) => {
        const v = dimValue(dv, name).trim();
        if (v === "(not set)") return "";
        return lower ? v.toLowerCase() : v;
      };
      rows.push(
        parseGa4Row(
          {
            date,
            landing_page_path: normalizeGa4Path(dimValue(dv, "landingPagePlusQueryString")),
            page_path: normalizeGa4Path(dimValue(dv, "pagePath")),
            source: cleanDim("sessionSource", true),
            medium: cleanDim("sessionMedium", true),
            campaign: cleanDim("sessionCampaignName"),
            country: cleanDim("country"),
            device: cleanDim("deviceCategory", true),
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

async function fetchEtsyListingsByState(env, accessToken, shopId, state) {
  const apiBase = etsyApiBase(env);
  const limit = clampInt(toInt(env.ETSY_LISTING_PAGE_SIZE, ETSY_DEFAULT_LISTING_PAGE_SIZE), 1, 100);
  const rows = [];
  let offset = 0;
  let pages = 0;

  while (true) {
    pages += 1;
    if (pages > 500) throw new Error(`Etsy listing paging exceeded 500 pages for state=${state}`);
    const qs = new URLSearchParams({
      state: state,
      limit: String(limit),
      offset: String(offset),
      sort_on: "updated",
      sort_order: "desc",
    });
    const url = `${apiBase}/v3/application/shops/${encodeURIComponent(shopId)}/listings?${qs.toString()}`;
    const res = await fetch(url, { headers: etsyAuthHeaders(env, accessToken) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error || body?.message || "unknown error";
      throw new Error(`Etsy listings fetch failed (${res.status}) state=${state}: ${truncate(String(msg), 240)}`);
    }
    const batch = Array.isArray(body?.results) ? body.results : [];
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += batch.length;
  }

  return rows;
}

function normalizeEtsyListingRecord(raw, fallbackState) {
  const state = normalizeEtsyState(raw?.state || fallbackState);
  const listingId = String(raw?.listing_id || "").trim();
  if (!listingId) return null;
  return {
    listing_id: listingId,
    listing_title: String(raw?.title || "").trim(),
    listing_state: state,
    is_active: etsyStateIsActive(state) ? 1 : 0,
    listing_url: String(raw?.url || "").trim(),
    currency: String(raw?.price?.currency_code || "").trim().toUpperCase() || "USD",
    price: parseEtsyAmount(raw?.price),
    quantity_available: Number.isFinite(Number(raw?.quantity)) ? Number(raw.quantity) : null,
    views_total: Number.isFinite(Number(raw?.views)) ? Number(raw.views) : 0,
    favorites_total: Number.isFinite(Number(raw?.num_favorers)) ? Number(raw.num_favorers) : 0,
    shop_id: String(raw?.shop_id || "").trim(),
  };
}

async function fetchAllEtsyListings(env, accessToken, shopId) {
  const byListing = new Map();
  for (const state of ETSY_STATES) {
    const rows = await fetchEtsyListingsByState(env, accessToken, shopId, state);
    for (const raw of rows) {
      const normalized = normalizeEtsyListingRecord(raw, state);
      if (!normalized) continue;
      const existing = byListing.get(normalized.listing_id);
      if (!existing) {
        byListing.set(normalized.listing_id, normalized);
        continue;
      }
      if (existing.is_active !== 1 && normalized.is_active === 1) {
        byListing.set(normalized.listing_id, normalized);
      }
    }
  }
  return Array.from(byListing.values());
}

async function fetchEtsyReceiptsForWindow(env, accessToken, shopId, startIso, endIso) {
  const minCreated = toUnixStartOfDay(startIso);
  const maxCreated = toUnixEndOfDay(endIso);
  if (!Number.isInteger(minCreated) || !Number.isInteger(maxCreated)) throw new Error("invalid Etsy receipt date window");

  const apiBase = etsyApiBase(env);
  const limit = clampInt(toInt(env.ETSY_RECEIPT_PAGE_SIZE, ETSY_DEFAULT_RECEIPT_PAGE_SIZE), 1, 100);
  const rows = [];
  let offset = 0;
  let pages = 0;

  while (true) {
    pages += 1;
    if (pages > 500) throw new Error("Etsy receipt paging exceeded 500 pages");
    const qs = new URLSearchParams({
      min_created: String(minCreated),
      max_created: String(maxCreated),
      was_paid: "true",
      limit: String(limit),
      offset: String(offset),
      sort_on: "created",
      sort_order: "asc",
    });
    const url = `${apiBase}/v3/application/shops/${encodeURIComponent(shopId)}/receipts?${qs.toString()}`;
    const res = await fetch(url, { headers: etsyAuthHeaders(env, accessToken) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error || body?.message || "unknown error";
      throw new Error(`Etsy receipts fetch failed (${res.status}): ${truncate(String(msg), 240)}`);
    }
    const batch = Array.isArray(body?.results) ? body.results : [];
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += batch.length;
  }

  return rows;
}

function buildEtsyOrderRows(receipts, windowDaySet) {
  const rowMap = new Map();
  const orderKeySet = new Set();

  for (const receipt of receipts) {
    const ts = Number(receipt?.created_timestamp || receipt?.create_timestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const day = toIsoDay(new Date(ts * 1000));
    if (!windowDaySet.has(day)) continue;
    const txns = Array.isArray(receipt?.transactions) ? receipt.transactions : [];
    for (const tx of txns) {
      const listingId = String(tx?.listing_id || "").trim();
      if (!listingId) continue;
      const currency = String(tx?.price?.currency_code || receipt?.grandtotal?.currency_code || "USD").trim().toUpperCase() || "USD";
      const key = `${day}||${listingId}||${currency}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          date: day,
          listing_id: listingId,
          currency,
          listing_title: String(tx?.title || "").trim(),
          orders: 0,
          transactions: 0,
          units_sold: 0,
          revenue: 0,
        });
      }
      const row = rowMap.get(key);
      const qty = Number.isFinite(Number(tx?.quantity)) ? Number(tx.quantity) : 0;
      const unitPrice = parseEtsyAmount(tx?.price);
      row.transactions += 1;
      row.units_sold += qty;
      row.revenue += unitPrice * qty;
      const receiptId = String(receipt?.receipt_id || "").trim();
      if (receiptId) {
        const orderKey = `${key}||${receiptId}`;
        if (!orderKeySet.has(orderKey)) {
          orderKeySet.add(orderKey);
          row.orders += 1;
        }
      }
    }
  }

  return Array.from(rowMap.values()).map((row) => ({
    ...row,
    revenue: Math.round(Number(row.revenue || 0) * 100) / 100,
  }));
}

async function loadEtsyReferenceMaps(db, endDate) {
  const masterRows = await db
    .prepare(`SELECT listing_id, views_total, favorites_total FROM etsy_listing_master`)
    .all();
  const endRows = await db
    .prepare(
      `SELECT listing_id, currency, views, favorites, visits
         FROM etsy_listing_daily
        WHERE report_date = ?`
    )
    .bind(endDate)
    .all();

  const masterMap = new Map();
  (masterRows.results || []).forEach((r) => {
    masterMap.set(String(r.listing_id || ""), {
      views_total: Number(r.views_total || 0),
      favorites_total: Number(r.favorites_total || 0),
    });
  });
  const dayMap = new Map();
  (endRows.results || []).forEach((r) => {
    const key = `${String(r.listing_id || "")}||${String(r.currency || "").toUpperCase() || "USD"}`;
    dayMap.set(key, {
      views: Number(r.views || 0),
      favorites: Number(r.favorites || 0),
      visits: Number(r.visits || 0),
    });
  });
  return { masterMap, dayMap };
}

async function postEtsyRowsChunk(env, rows, triggerTag) {
  const apiBase = String(env.MAPPER_API_BASE || "https://www.mildmate.com").replace(/\/+$/, "");
  const token = String(env.SALES_SYNC_API_TOKEN || "");
  if (!token) throw new Error("SALES_SYNC_API_TOKEN is not configured");
  const payload = {
    sync_source: ETSY_SYNC_SOURCE,
    scenario: `${ETSY_SCENARIO}:${triggerTag}`,
    rows,
  };
  const res = await fetch(apiBase + ETSY_UPSERT_ROUTE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.success !== true) {
    throw new Error(`Etsy upsert failed (${res.status}) ${truncate(body?.message || body?.error_code || "unknown", 220)}`);
  }
  return body;
}

async function resolveEtsyShopId(env, accessToken) {
  const userId = String(accessToken || "").split(".")[0].trim();

  if (!/^\d+$/.test(userId)) {
    throw new Error("Unable to resolve Etsy user_id from access token");
  }

  const res = await fetch(
    `${etsyApiBase(env)}/v3/application/users/${userId}/shops`,
    {
      headers: etsyAuthHeaders(env, accessToken),
    }
  );

  const body = await res.json().catch(() => ({}));

  if (!res.ok || !body?.shop_id) {
    const msg = body?.error || body?.message || "unknown error";
    throw new Error(
      `Etsy shop lookup failed (${res.status}): ${truncate(String(msg), 220)}`
    );
  }

  return String(body.shop_id);
}

function normalizeGoogleAdsEnum(v) {
  const raw = String(v || "").trim();
  if (!raw) return "";
  return raw.toLowerCase();
}

function toGoogleAdsNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeGoogleAdsResultRow(row, currencyFallback) {
  const date = String(row?.segments?.date || "").trim();
  if (!parseIsoDay(date)) return null;
  const campaignId = String(row?.campaign?.id || "").trim();
  if (!campaignId) return null;
  const customerId = String(row?.customer?.id || "").trim();
  if (!customerId) return null;
  const adGroupId = String(row?.adGroup?.id || "").trim();
  const costMicros = toGoogleAdsNumber(row?.metrics?.costMicros);

  return {
    date,
    customer_id: customerId,
    customer_name: String(row?.customer?.descriptiveName || "").trim(),
    campaign_id: campaignId,
    campaign_name: String(row?.campaign?.name || "").trim(),
    ad_group_id: adGroupId,
    ad_group_name: String(row?.adGroup?.name || "").trim(),
    channel_type: normalizeGoogleAdsEnum(row?.campaign?.advertisingChannelType),
    network: normalizeGoogleAdsEnum(row?.segments?.adNetworkType),
    device: normalizeGoogleAdsEnum(row?.segments?.device),
    currency: String(currencyFallback || "THB").trim().toUpperCase() || "THB",
    impressions: Math.max(0, Math.round(toGoogleAdsNumber(row?.metrics?.impressions))),
    clicks: Math.max(0, Math.round(toGoogleAdsNumber(row?.metrics?.clicks))),
    cost_micros: Math.max(0, Math.round(costMicros)),
    cost: Math.round((Math.max(0, costMicros) / 1000000) * 1000000) / 1000000,
    conversions: Math.max(0, toGoogleAdsNumber(row?.metrics?.conversions)),
    conversion_value: Math.max(0, toGoogleAdsNumber(row?.metrics?.conversionsValue)),
    all_conversions: Math.max(0, toGoogleAdsNumber(row?.metrics?.allConversions)),
    all_conversions_value: Math.max(0, toGoogleAdsNumber(row?.metrics?.allConversionsValue)),
  };
}

async function fetchGoogleAdsRowsForWindow(env, accessToken, startIso, endIso) {
  const customerId = String(env.GOOGLE_ADS_CUSTOMER_ID || "").trim();
  const loginCustomerId = String(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").trim();
  if (!customerId) throw new Error("GOOGLE_ADS_CUSTOMER_ID is not configured");
  if (!loginCustomerId) throw new Error("GOOGLE_ADS_LOGIN_CUSTOMER_ID is not configured");

  const apiBase = String(env.GOOGLE_ADS_API_BASE || "https://googleads.googleapis.com").replace(/\/+$/, "");
  const endpoint = `${apiBase}/v25/customers/${encodeURIComponent(customerId)}/googleAds:searchStream`;
  const currency = String(env.GOOGLE_ADS_ACCOUNT_CURRENCY || "THB").trim().toUpperCase() || "THB";
  const query = `
    SELECT
      segments.date,
      customer.id,
      customer.descriptive_name,
      campaign.id,
      campaign.name,
      campaign.advertising_channel_type,
      ad_group.id,
      ad_group.name,
      segments.device,
      segments.ad_network_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.all_conversions,
      metrics.all_conversions_value
    FROM ad_group
    WHERE segments.date >= '${startIso}'
      AND segments.date <= '${endIso}'
  `.trim();

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "login-customer-id": loginCustomerId,
    "Content-Type": "application/json",
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  const rawBody = await res.text();
  let body = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    const msg =
      body?.error?.message ||
      body?.error?.details?.[0]?.errors?.[0]?.message ||
      body?.message ||
      rawBody ||
      "unknown error";
    throw new Error(`Google Ads searchStream failed (${res.status}): ${truncate(String(msg), 4000)}`);
  }

  const batches = Array.isArray(body) ? body : [body];
  const rows = [];
  for (const batch of batches) {
    const results = Array.isArray(batch?.results) ? batch.results : [];
    for (const raw of results) {
      const row = normalizeGoogleAdsResultRow(raw, currency);
      if (row) rows.push(row);
    }
  }
  return rows;
}

async function postGoogleAdsRowsChunk(env, rows, triggerTag) {
  const apiBase = String(env.MAPPER_API_BASE || "https://www.mildmate.com").replace(/\/+$/, "");
  const token = String(env.SALES_SYNC_API_TOKEN || "");
  if (!token) throw new Error("SALES_SYNC_API_TOKEN is not configured");
  const payload = {
    sync_source: GOOGLE_ADS_SYNC_SOURCE,
    scenario: `${GOOGLE_ADS_SCENARIO}:${triggerTag}`,
    rows,
  };
  const res = await fetch(apiBase + GOOGLE_ADS_UPSERT_ROUTE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.success !== true) {
    throw new Error(`Google Ads upsert failed (${res.status}) ${truncate(body?.message || body?.error_code || "unknown", 220)}`);
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
      `GSC-SYNC: ${trigger} done â€” days ${window.days.length}, fetched ${totals.fetched_rows}, sent ${totals.sent_rows}, ` +
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
    console.log(`GSC-SYNC: ${trigger} failed â€” ${msg}`);
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
      ["sessions", "totalUsers", "engagedSessions"],
      null,
      GA4_TRAFFIC_DIMENSIONS
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
      `GA4-SYNC: ${trigger} done â€” rows ${totals.fetched_rows}, sent ${totals.sent_rows}, ` +
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
    console.log(`GA4-SYNC: ${trigger} failed â€” ${msg}`);
    return { ok: false, reason: msg };
  } finally {
    await releaseGa4Lock(db, runId);
  }
}

async function executeEtsySync(env, trigger, overrides = {}) {
  for (const required of ["SALES_SYNC_API_TOKEN", "ETSY_CLIENT_ID", "ETSY_CLIENT_SECRET", "ETSY_REFRESH_TOKEN"]) {
    if (!env[required]) return { ok: false, reason: `${required} is not configured` };
  }

  const db = env.DB;
  const runId = `${ETSY_STREAM}-${trigger}-${Date.now()}`;
  if (!(await acquireEtsyLock(db, runId))) {
    console.log("ETSY-SYNC: previous run still active, skipping");
    return { ok: true, skipped: "locked" };
  }

  try {
    const window = resolveEtsyWindow(env, overrides);
    const accessToken = await getEtsyAccessToken(env);
    const shopId = await resolveEtsyShopId(env, accessToken);
    const chunkSize = clampInt(toInt(env.ETSY_UPSERT_CHUNK_SIZE, ETSY_DEFAULT_CHUNK_SIZE), 200, 5000);
    const fxToThb = Number(env.ETSY_FX_TO_THB || 0);
    const hasFx = Number.isFinite(fxToThb) && fxToThb > 0;

    const listings = await fetchAllEtsyListings(env, accessToken, shopId);
    const receipts = await fetchEtsyReceiptsForWindow(env, accessToken, shopId, window.start, window.end);
    const orderRows = buildEtsyOrderRows(receipts, new Set(window.days));
    const { masterMap, dayMap } = await loadEtsyReferenceMaps(db, window.end);

    const byKey = new Map();
    for (const orderRow of orderRows) {
      const key = `${orderRow.date}||${orderRow.listing_id}||${orderRow.currency}`;
      byKey.set(key, {
        date: orderRow.date,
        listing_id: orderRow.listing_id,
        listing_title: orderRow.listing_title || "",
        listing_state: "unknown",
        is_active: 0,
        currency: orderRow.currency || "USD",
        visits: 0,
        views: 0,
        favorites: 0,
        orders: Number(orderRow.orders || 0),
        transactions: Number(orderRow.transactions || 0),
        units_sold: Number(orderRow.units_sold || 0),
        revenue: Math.round(Number(orderRow.revenue || 0) * 100) / 100,
        shop_id: shopId,
      });
    }

    for (const listing of listings) {
      const currency = String(listing.currency || "USD").toUpperCase();
      const key = `${window.end}||${listing.listing_id}||${currency}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          date: window.end,
          listing_id: listing.listing_id,
          listing_title: listing.listing_title || "",
          listing_state: listing.listing_state || "unknown",
          is_active: Number(listing.is_active || 0),
          currency,
          visits: 0,
          views: 0,
          favorites: 0,
          orders: 0,
          transactions: 0,
          units_sold: 0,
          revenue: 0,
          shop_id: listing.shop_id || shopId,
        });
      }
      const row = byKey.get(key);
      row.listing_title = listing.listing_title || row.listing_title || "";
      row.listing_state = listing.listing_state || row.listing_state || "unknown";
      row.is_active = Number(listing.is_active || row.is_active || 0);
      row.listing_url = listing.listing_url || row.listing_url || "";
      row.shop_id = listing.shop_id || row.shop_id || shopId;
      row.price = Number.isFinite(Number(listing.price)) ? Number(listing.price) : row.price;
      row.quantity_available = Number.isFinite(Number(listing.quantity_available)) ? Number(listing.quantity_available) : row.quantity_available;
      row.views_total = Number.isFinite(Number(listing.views_total)) ? Number(listing.views_total) : 0;
      row.favorites_total = Number.isFinite(Number(listing.favorites_total)) ? Number(listing.favorites_total) : 0;

      const prevTotals = masterMap.get(listing.listing_id) || { views_total: 0, favorites_total: 0 };
      const priorDay = dayMap.get(`${listing.listing_id}||${currency}`) || { views: 0, favorites: 0, visits: 0 };
      const deltaViews = Math.max(0, Number(row.views_total || 0) - Number(prevTotals.views_total || 0));
      const deltaFavorites = Math.max(0, Number(row.favorites_total || 0) - Number(prevTotals.favorites_total || 0));
      row.views = Number(priorDay.views || 0) + deltaViews;
      row.favorites = Number(priorDay.favorites || 0) + deltaFavorites;
      row.visits = Number(priorDay.visits || 0);
    }

    const rows = Array.from(byKey.values()).map((row) => {
      const out = {
        date: row.date,
        listing_id: row.listing_id,
        listing_title: row.listing_title || "",
        listing_state: row.listing_state || "unknown",
        is_active: Number(row.is_active || 0) === 1,
        listing_url: row.listing_url || "",
        shop_id: row.shop_id || shopId,
        currency: row.currency || "USD",
        visits: Math.max(0, Math.round(Number(row.visits || 0))),
        views: Math.max(0, Math.round(Number(row.views || 0))),
        favorites: Math.max(0, Math.round(Number(row.favorites || 0))),
        orders: Math.max(0, Math.round(Number(row.orders || 0))),
        transactions: Math.max(0, Math.round(Number(row.transactions || 0))),
        units_sold: Math.max(0, Math.round(Number(row.units_sold || 0))),
        revenue: Math.round(Number(row.revenue || 0) * 100) / 100,
        price: Number.isFinite(Number(row.price)) ? Number(row.price) : null,
        quantity_available: Number.isFinite(Number(row.quantity_available)) ? Math.max(0, Math.round(Number(row.quantity_available))) : null,
        views_total: Number.isFinite(Number(row.views_total)) ? Math.max(0, Math.round(Number(row.views_total))) : 0,
        favorites_total: Number.isFinite(Number(row.favorites_total)) ? Math.max(0, Math.round(Number(row.favorites_total))) : 0,
      };
      if (out.currency === "THB") out.revenue_thb = out.revenue;
      else if (hasFx && out.revenue > 0) out.fx_rate_to_thb = fxToThb;
      return out;
    });

    const totals = {
      days_in_window: window.days.length,
      listings_seen: listings.length,
      receipts_seen: receipts.length,
      fetched_rows: rows.length,
      sent_rows: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      rejected: 0,
      upsert_calls: 0,
    };

    const chunks = chunkRows(rows, chunkSize);
    for (const chunk of chunks) {
      const out = await postEtsyRowsChunk(env, chunk, trigger);
      totals.upsert_calls += 1;
      totals.sent_rows += Number(out?.totals?.received || 0);
      totals.created += Number(out?.totals?.created || 0);
      totals.updated += Number(out?.totals?.updated || 0);
      totals.unchanged += Number(out?.totals?.unchanged || 0);
      totals.rejected += Number(out?.totals?.rejected || 0);
    }

    console.log(
      `ETSY-SYNC: ${trigger} done â€” listings ${totals.listings_seen}, receipts ${totals.receipts_seen}, rows ${totals.fetched_rows}, sent ${totals.sent_rows}, ` +
      `created ${totals.created}, updated ${totals.updated}, unchanged ${totals.unchanged}, rejected ${totals.rejected}`
    );

    return {
      ok: true,
      source: ETSY_SYNC_SOURCE,
      scenario: ETSY_SCENARIO,
      trigger,
      window: { start: window.start, end: window.end, days: window.days.length, lag_days: window.lagDays, overlap_days: window.overlapDays },
      totals,
    };
  } catch (e) {
    const msg = truncate(e?.message || String(e), 280);
    console.log(`ETSY-SYNC: ${trigger} failed â€” ${msg}`);
    return { ok: false, reason: msg };
  } finally {
    await releaseEtsyLock(db, runId);
  }
}

async function executeGoogleAdsSync(env, trigger, overrides = {}) {
  for (const required of [
    "SALES_SYNC_API_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
  ]) {
    if (!env[required]) return { ok: false, reason: `${required} is not configured` };
  }

  const db = env.DB;
  const runId = `${GOOGLE_ADS_STREAM}-${trigger}-${Date.now()}`;
  if (!(await acquireGoogleAdsLock(db, runId))) {
    console.log("GOOGLE-ADS-SYNC: previous run still active, skipping");
    return { ok: true, skipped: "locked" };
  }

  try {
    const window = resolveGoogleAdsWindow(env, overrides);
    const accessToken = await getGoogleAdsAccessToken(env);
    const chunkSize = clampInt(
      toInt(env.GOOGLE_ADS_UPSERT_CHUNK_SIZE, GOOGLE_ADS_DEFAULT_CHUNK_SIZE),
      200,
      5000
    );
    const rows = await fetchGoogleAdsRowsForWindow(env, accessToken, window.start, window.end);
    const totals = {
      days_in_window: window.days.length,
      fetched_rows: rows.length,
      sent_rows: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      rejected: 0,
      upsert_calls: 0,
    };

    const chunks = chunkRows(rows, chunkSize);
    for (const chunk of chunks) {
      const out = await postGoogleAdsRowsChunk(env, chunk, trigger);
      totals.upsert_calls += 1;
      totals.sent_rows += Number(out?.totals?.received || 0);
      totals.created += Number(out?.totals?.created || 0);
      totals.updated += Number(out?.totals?.updated || 0);
      totals.unchanged += Number(out?.totals?.unchanged || 0);
      totals.rejected += Number(out?.totals?.rejected || 0);
    }

    console.log(
      `GOOGLE-ADS-SYNC: ${trigger} done â€” rows ${totals.fetched_rows}, sent ${totals.sent_rows}, ` +
      `created ${totals.created}, updated ${totals.updated}, unchanged ${totals.unchanged}, rejected ${totals.rejected}`
    );

    return {
      ok: true,
      source: GOOGLE_ADS_SYNC_SOURCE,
      scenario: GOOGLE_ADS_SCENARIO,
      trigger,
      window: {
        start: window.start,
        end: window.end,
        days: window.days.length,
        lag_days: window.lagDays,
        overlap_days: window.overlapDays,
      },
      totals,
    };
  } catch (e) {
    const msg = truncate(e?.message || String(e), 280);
    console.log(`GOOGLE-ADS-SYNC: ${trigger} failed â€” ${msg}`);
    return { ok: false, reason: msg };
  } finally {
    await releaseGoogleAdsLock(db, runId);
  }
}

// â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Telemetry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Main run â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // Track the cursor as it is persisted mid-run so a hard failure does not
  // overwrite carried-over progress with the stale pre-run value.
  let lastSavedCursor = state.cursor || null;

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
      maxSubrequests:
        overrides.maxSubrequests ??
        clampInt(toInt(env.SYNC_MAX_SUBREQUESTS, DEFAULT_MAX_SUBREQUESTS), 5, 500),
      syncSource: SYNC_SOURCE,
      scenario: SCENARIO,
      log,
      onCursor: (cursor) => {
        lastSavedCursor = cursor;
        return saveCursor(db, cursor);
      },
      onEvent: ({ rec, parsed, action }) => audit.collect({ rec, parsed, action }),
    });
  } catch (e) {
    errorMessage = e.message;
    console.log(`MARKETING-SYNC: run failed â€” ${truncate(e.message, 300)}`);
    await finishRun(db, runRowId, { status: "failed", counts: {}, processed: 0, errorMessage });
    await finishState(db, { cursor: lastSavedCursor, status: "failed", processed: 0, synced: 0, failed: true });
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
    console.log(`MARKETING-SYNC: audit flush failed â€” ${truncate(e.message, 200)}`);
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
    `MARKETING-SYNC: ${trigger} done â€” processed ${processed}, synced ${counts.synced || 0}, ` +
      `errors ${errCount}, exhausted ${exhausted}, email ${emailed || "skipped"}`
  );

  return { ok: true, counts, processed, exhausted, status, email: emailed, before, dryRun };
}

export default {
  async scheduled(event, env, ctx) {
    if (event.cron === GA4_WEEKLY_CRON) {
      ctx.waitUntil((async () => {
        try {
          await executeGa4Sync(env, "scheduled-weekly");
        } catch (e) {
          console.log(`GA4-SYNC: unhandled â€” ${truncate(e.message, 300)}`);
        }
        try {
          await executeEtsySync(env, "scheduled-weekly");
        } catch (e) {
          console.log(`ETSY-SYNC: unhandled â€” ${truncate(e.message, 300)}`);
        }
        try {
          await executeGoogleAdsSync(env, "scheduled-weekly");
        } catch (e) {
          console.log(`GOOGLE-ADS-SYNC: unhandled â€” ${truncate(e.message, 300)}`);
        }
      })());
      return;
    }

    if (event.cron === GSC_WEEKLY_CRON) {
      ctx.waitUntil(
        executeGscSync(env, "scheduled-weekly").catch((e) =>
          console.log(`GSC-SYNC: unhandled â€” ${truncate(e.message, 300)}`)
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
      executeSync(env, trigger).catch((e) => console.log(`MARKETING-SYNC: unhandled â€” ${truncate(e.message, 300)}`))
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
   *   POST /etsy/run?[start=YYYY-MM-DD&end=YYYY-MM-DD&overlap=14&lag=1]
   *   GET  /etsy/status
   *   POST /google-ads/run?[start=YYYY-MM-DD&end=YYYY-MM-DD&overlap=14&lag=2]
   *   GET  /google-ads/status
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
      if (url.searchParams.get("max-subrequests")) {
        overrides.maxSubrequests = clampInt(toInt(url.searchParams.get("max-subrequests"), DEFAULT_MAX_SUBREQUESTS), 5, 500);
      }

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

    if (url.pathname === "/etsy/status") {
      let freshness = null;
      try {
        freshness = await env.DB.prepare(`SELECT * FROM analysis_etsy_freshness`).first();
      } catch {
        freshness = null;
      }
      const runs = await env.DB.prepare(
        `SELECT id, source, scenario, started_at, finished_at, status,
                records_received, records_created, records_updated, records_unchanged, records_rejected, error_message
           FROM sync_runs
          WHERE source LIKE 'etsy-%'
          ORDER BY COALESCE(finished_at, started_at) DESC
          LIMIT 10`
      ).all();
      const lock = await env.DB
        .prepare(`SELECT locked_until, run_id FROM marketing_sync_lock WHERE name = ?`)
        .bind(ETSY_STREAM)
        .first();
      let window = null;
      try {
        window = resolveEtsyWindow(env);
      } catch {
        window = null;
      }
      return Response.json({
        stream: ETSY_STREAM,
        source: ETSY_SYNC_SOURCE,
        scenario: ETSY_SCENARIO,
        cron: ETSY_WEEKLY_CRON,
        lock: lock || null,
        freshness,
        default_window: window ? { start: window.start, end: window.end, days: window.days.length } : null,
        recent_runs: runs.results || [],
      });
    }

    if (url.pathname === "/etsy/run" && request.method === "POST") {
      const overrides = {
        start: url.searchParams.get("start") || null,
        end: url.searchParams.get("end") || null,
        overlapDays: url.searchParams.get("overlap") ? Number(url.searchParams.get("overlap")) : null,
        lagDays: url.searchParams.get("lag") ? Number(url.searchParams.get("lag")) : null,
      };
      const out = await executeEtsySync(env, "manual", overrides);
      return Response.json(out, { status: out.ok ? 200 : 500 });
    }

    if (url.pathname === "/google-ads/status") {
      let freshness = null;
      try {
        freshness = await env.DB.prepare(`SELECT * FROM analysis_google_ads_freshness`).first();
      } catch {
        freshness = null;
      }
      const runs = await env.DB.prepare(
        `SELECT id, source, scenario, started_at, finished_at, status,
                records_received, records_created, records_updated, records_unchanged, records_rejected, error_message
           FROM sync_runs
          WHERE source LIKE 'google-ads-%'
          ORDER BY COALESCE(finished_at, started_at) DESC
          LIMIT 10`
      ).all();
      const lock = await env.DB
        .prepare(`SELECT locked_until, run_id FROM marketing_sync_lock WHERE name = ?`)
        .bind(GOOGLE_ADS_STREAM)
        .first();
      let window = null;
      try {
        window = resolveGoogleAdsWindow(env);
      } catch {
        window = null;
      }
      return Response.json({
        stream: GOOGLE_ADS_STREAM,
        source: GOOGLE_ADS_SYNC_SOURCE,
        scenario: GOOGLE_ADS_SCENARIO,
        cron: GOOGLE_ADS_WEEKLY_CRON,
        lock: lock || null,
        freshness,
        default_window: window ? { start: window.start, end: window.end, days: window.days.length } : null,
        recent_runs: runs.results || [],
      });
    }

    if (url.pathname === "/google-ads/run" && request.method === "POST") {
      const overrides = {
        start: url.searchParams.get("start") || null,
        end: url.searchParams.get("end") || null,
        overlapDays: url.searchParams.get("overlap") ? Number(url.searchParams.get("overlap")) : null,
        lagDays: url.searchParams.get("lag") ? Number(url.searchParams.get("lag")) : null,
      };
      const out = await executeGoogleAdsSync(env, "manual", overrides);
      return Response.json(out, { status: out.ok ? 200 : 500 });
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


