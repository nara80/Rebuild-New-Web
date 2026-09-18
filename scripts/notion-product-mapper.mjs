#!/usr/bin/env node
/**
 * MildMate — Notion Confirmed-Mapping → D1 Sync CLI (Phase 07, revised 2026-09-11)
 *
 * This file is the **Node CLI shell** only. All sync logic lives in the shared
 * runtime-agnostic engine `scripts/notion-mapper-core.mjs`, which is also used
 * by the Phase 17 Cloudflare Worker cron (`marketing-sync-worker/`). Never
 * duplicate engine logic here — edit the core so both runtimes stay identical.
 *
 * This shell supplies the Node-specific pieces the core does not have:
 *   - CLI argument parsing
 *   - JSONL run logs on disk (logs/notion-mapper/)
 *   - pagination cursor state file (scripts/.notion-mapper-state.json)
 *   - process.env credential wiring
 *   - offline mock mode (--input-file)
 *
 * Business rule: Make.com remains the primary system that fixes and confirms
 * product mappings in Notion. This tool NEVER resolves or remaps anything.
 * It only syncs records that Make.com has already confirmed:
 *
 *   Eligible when:
 *     Product_Mapping_Status = "Mapped"
 *     AND (D1_Current_Signature != D1_Last_Synced_Signature OR last is empty)
 *     AND TotalAmount exists in Notion (> 0)   [2026-09-12 rule: revenue data
 *         must be corrected first; records without a total are held and will
 *         sync automatically once the total is filled — signature changes]
 *     AND (with --before) Order_Date is before the given ISO date and
 *         parseable — used to hold back months still being corrected (e.g.
 *         --before 2026-08-01 = July 2026 and earlier)
 *
 *   Sync: parse the CONFIRMED D1_Product_Map / D1_Product_IDs from Notion,
 *   upsert the order into D1 via POST /api/v1/sales/orders/upsert, then (live
 *   mode only) write D1_Last_Synced_Signature = D1_Current_Signature back to
 *   the SAME Notion record. No other Notion field is ever written.
 *
 * Records with empty / Unmapped / Review Required / Partial status are always
 * skipped — they belong to Make.com.
 *
 * Environment variables (never committed, never printed):
 *   NOTION_TOKEN, NOTION_DATA_SOURCE_ID, SALES_SYNC_API_TOKEN,
 *   MAPPER_API_BASE (default https://www.mildmate.com; http://localhost:8788 for tests)
 *   RESEND_API_KEY — sends the run report email
 *   REPORT_EMAIL_TO — report recipient (default contact@mildmate.com)
 *
 * Run report (2026-09-12 rule): EVERY non-dry-run LIVE-Notion run emails its
 * outcome summary to contact@mildmate.com — synced count, skips by reason,
 * errors, and the synced order list. **Dry runs never email** (preview only —
 * not an outcome; saves Resend quota). Mock (--input-file) runs never email.
 * A report failure never fails the sync run itself.
 *
 * Usage:
 *   node scripts/notion-product-mapper.mjs --order-id 1038 --dry-run
 *   node scripts/notion-product-mapper.mjs --dry-run --limit 5
 *   node scripts/notion-product-mapper.mjs --limit 20            (live: D1 upsert + signature write-back)
 *   node scripts/notion-product-mapper.mjs --before 2026-08-01 --limit 50   (July-and-earlier scope)
 *   node scripts/notion-product-mapper.mjs --resume
 */

import fs from "node:fs";
import path from "node:path";

import {
  runSync,
  fetchCatalogIds,
  buildReportEmail,
  sendReportEmail,
  truncate,
  REPORT_EMAIL_TO_DEFAULT,
} from "./notion-mapper-core.mjs";

// Re-exported so existing tooling that imported the parser from this path keeps
// working; the implementations now live in the shared core.
export { parseConfirmedMap, parseConfirmedIds } from "./notion-mapper-core.mjs";

const STATE_FILE = path.join("scripts", ".notion-mapper-state.json");
const LOG_DIR = path.join("logs", "notion-mapper");

// ── CLI args ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { dryRun: false, limit: null, resume: false, orderId: null, editedAfter: null, before: null, inputFile: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--resume") args.resume = true;
    else if (a === "--limit") args.limit = Number(argv[++i]);
    else if (a === "--order-id") args.orderId = Number(argv[++i]);
    else if (a === "--edited-after") args.editedAfter = String(argv[++i]);
    else if (a === "--before") args.before = String(argv[++i]);
    else if (a === "--input-file") args.inputFile = String(argv[++i]);
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
    else { console.error(`Unknown argument: ${a}`); printHelp(); process.exit(1); }
  }
  if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit <= 0)) {
    console.error("--limit must be a positive integer"); process.exit(1);
  }
  if (args.orderId !== null && (!Number.isInteger(args.orderId) || args.orderId <= 0)) {
    console.error("--order-id must be the numeric Notion ID (unique_id), e.g. 1038"); process.exit(1);
  }
  if (args.editedAfter && Number.isNaN(Date.parse(args.editedAfter))) {
    console.error("--edited-after must be an ISO datetime"); process.exit(1);
  }
  if (args.before !== null && (args.before === undefined || Number.isNaN(Date.parse(args.before)))) {
    console.error("--before must be an ISO date, e.g. 2026-08-01"); process.exit(1);
  }
  return args;
}

function printHelp() {
  console.log("Options: --dry-run --limit N --resume --order-id <NotionID> --edited-after ISO --before ISO-date --input-file file.json");
}

// ── State / logging (Node-specific) ────────────────────────────────────────

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return {}; }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
function openLog() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const file = path.join(LOG_DIR, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
  const stream = fs.createWriteStream(file, { flags: "a" });
  return { file, write: (obj) => stream.write(JSON.stringify(obj) + "\n"), close: () => stream.end() };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const mock = Boolean(args.inputFile);

  const apiBase = (process.env.MAPPER_API_BASE || "https://www.mildmate.com").replace(/\/+$/, "");
  const apiToken = process.env.SALES_SYNC_API_TOKEN;
  const notionToken = process.env.NOTION_TOKEN;
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;

  if (!apiToken) { console.error("SALES_SYNC_API_TOKEN is not set."); process.exit(1); }
  if (!mock && (!notionToken || !dataSourceId)) {
    console.error("NOTION_TOKEN and NOTION_DATA_SOURCE_ID are required (or use --input-file for offline mode).");
    process.exit(1);
  }

  const log = openLog();
  console.log(`Log: ${log.file}`);
  console.log(`Mode: ${mock ? "MOCK (input-file)" : "LIVE Notion (read" + (args.dryRun ? "-only" : "+signature write") + ")"} | dry-run: ${args.dryRun} | API: ${apiBase}${args.before ? ` | scope: Order_Date before ${args.before}` : ""}`);

  const catalog = await fetchCatalogIds(apiBase, apiToken);
  console.log(`Catalog: ${catalog.count} active products`);

  const state = loadState();
  const rows = mock
    ? JSON.parse(fs.readFileSync(args.inputFile, "utf8").replace(/^\uFEFF/, ""))
    : null;

  const { counts, processed, report } = await runSync({
    apiBase, apiToken, notionToken, dataSourceId,
    dryRun: args.dryRun,
    before: args.before,
    limit: args.limit,
    orderId: args.orderId,
    editedAfter: args.editedAfter,
    cursor: args.resume ? state.cursor || null : null,
    rows,
    catalogIds: catalog.ids,
    log,
    onCursor: (cursor) => { saveState({ ...state, cursor, updated_at: new Date().toISOString() }); },
  });

  for (const rec of report.errors) console.error(`Error on ID ${rec.id}: ${rec.message}`);

  // Run report email (2026-09-12 rule): every non-dry-run LIVE-Notion run
  // reports its outcome to contact@mildmate.com. Dry runs and mock
  // (--input-file) runs never email (preview only; saves Resend quota).
  // A report failure never fails the sync run itself.
  if (mock) {
    // no email
  } else if (args.dryRun) {
    console.log("Report email skipped (dry-run does not consume Resend quota)");
    log.write({ t: "email_report", status: "skipped_dry_run" });
  } else {
    try {
      const email = buildReportEmail({ args, counts, processed, report, logFile: log.file, trigger: "manual CLI" });
      const sent = await sendReportEmail({
        ...email,
        apiKey: process.env.RESEND_API_KEY,
        to: process.env.REPORT_EMAIL_TO || REPORT_EMAIL_TO_DEFAULT,
      });
      if (sent.success) {
        console.log(`Report email sent to ${process.env.REPORT_EMAIL_TO || REPORT_EMAIL_TO_DEFAULT}${sent.id ? ` (Resend id ${sent.id})` : ""}`);
        log.write({ t: "email_report", status: "sent", id: sent.id || null });
      } else {
        console.warn(`Report email NOT sent: ${sent.error}`);
        log.write({ t: "email_report", status: "failed", error: truncate(sent.error, 200) });
      }
    } catch (e) {
      console.warn(`Report email failed: ${e.message}`);
      log.write({ t: "email_report", status: "failed", error: truncate(e.message, 200) });
    }
  }

  log.close();
  console.log("\n=== Confirmed-mapping sync summary ===");
  for (const [k, v] of Object.entries(counts)) console.log(`${k}: ${v}`);
  console.log(`Processed: ${processed}`);
  if (counts.errors > 0) process.exitCode = 2;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isDirectRun) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
