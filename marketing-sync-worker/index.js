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

// Stop and carry over via the cursor before the platform can cut the run off
// mid-record. Notion calls are throttled to ~350ms, so this is wall-clock bound.
const DEFAULT_MAX_MS = 180_000;
// Lock expiry must exceed the work budget so a slow run never loses its own
// lock, but stay short enough that a crashed run frees the schedule quickly.
const LOCK_TTL_MS = 600_000;

const nowIso = () => new Date().toISOString();

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
    // 02:00 UTC on the 1st/15th is the main pass; every other hour is a drain
    // that returns immediately unless carry-over work exists.
    const trigger = event.cron === "0 * * * *" ? "drain" : "scheduled";
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

    return Response.json({ error: "not found" }, { status: 404 });
  },
};
