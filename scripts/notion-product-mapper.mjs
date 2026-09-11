#!/usr/bin/env node
/**
 * MildMate — Notion Confirmed-Mapping → D1 Sync (Phase 07, revised design 2026-09-11)
 *
 * Business rule: Make.com remains the primary system that fixes and confirms
 * product mappings in Notion. This tool NEVER resolves or remaps anything.
 * It only syncs records that Make.com has already confirmed:
 *
 *   Eligible when:
 *     Product_Mapping_Status = "Mapped"
 *     AND (D1_Current_Signature != D1_Last_Synced_Signature OR last is empty)
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
 *
 * Usage:
 *   node scripts/notion-product-mapper.mjs --order-id 1038 --dry-run
 *   node scripts/notion-product-mapper.mjs --dry-run --limit 5
 *   node scripts/notion-product-mapper.mjs --limit 20            (live: D1 upsert + signature write-back)
 *   node scripts/notion-product-mapper.mjs --resume
 */

import fs from "node:fs";
import path from "node:path";

// ── Config ─────────────────────────────────────────────────────────────────

const NOTION_API = "https://api.notion.com";
const NOTION_VERSION = "2025-09-03";
const NOTION_MIN_INTERVAL_MS = 350; // ~3 req/s Notion limit
const STATE_FILE = path.join("scripts", ".notion-mapper-state.json");
const LOG_DIR = path.join("logs", "notion-mapper");

const SIGNATURE_FIELD = "D1_Last_Synced_Signature"; // the ONLY Notion field this tool ever writes

// Thai operational status → canonical sales status. Unknown values are sent as
// no status (upsert accepts null) and flagged in the log, never guessed.
const THAI_STATUS_MAP = {
  "รอดำเนินการ": "pending",
  "กำลังดำเนินการ": "processing",
  "กำลังผลิต": "processing",
  "จัดส่งสินค้า": "shipped",
  "จัดส่งแล้ว": "shipped",
  "ส่งแล้ว": "shipped",
  "สำเร็จ": "completed",
  "เสร็จสิ้น": "completed",
  "ยกเลิก": "cancelled",
  "คืนเงิน": "refunded",
};

// ── CLI args ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { dryRun: false, limit: null, resume: false, orderId: null, editedAfter: null, inputFile: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--resume") args.resume = true;
    else if (a === "--limit") args.limit = Number(argv[++i]);
    else if (a === "--order-id") args.orderId = Number(argv[++i]);
    else if (a === "--edited-after") args.editedAfter = String(argv[++i]);
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
  return args;
}

function printHelp() {
  console.log("Options: --dry-run --limit N --resume --order-id <NotionID> --edited-after ISO --input-file file.json");
}

// ── Utilities ──────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastNotionCall = 0;

async function throttledNotionFetch(url, init, attempt = 0) {
  const wait = lastNotionCall + NOTION_MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastNotionCall = Date.now();
  const res = await fetch(url, init);
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) throw new Error(`Notion API ${res.status} after ${attempt + 1} attempts`);
    const retryAfter = Number(res.headers.get("retry-after") || 0);
    const backoff = retryAfter > 0 ? retryAfter * 1000 : Math.min(2000 * 2 ** attempt, 15000);
    await sleep(backoff);
    return throttledNotionFetch(url, init, attempt + 1);
  }
  return res;
}

function notionHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" };
}

function propPlainText(prop) {
  if (!prop) return "";
  if (Array.isArray(prop.title)) return prop.title.map((t) => t.plain_text ?? "").join("");
  if (Array.isArray(prop.rich_text)) return prop.rich_text.map((t) => t.plain_text ?? "").join("");
  if (prop.select) return prop.select.name || "";
  if (prop.status) return prop.status.name || "";
  if (typeof prop.number === "number") return String(prop.number);
  if (prop.unique_id) return String(prop.unique_id.number ?? "");
  if (prop.formula) {
    if (typeof prop.formula.string === "string") return prop.formula.string;
    if (typeof prop.formula.number === "number") return String(prop.formula.number);
    if (prop.formula.date) return prop.formula.date.start || "";
  }
  if (prop.date) return prop.date.start || "";
  return "";
}

function truncate(s, n) {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n) : str;
}

// ── Confirmed D1_Product_Map parsing (two live formats) ────────────────────
//
// Format A (current): "Item 1 | D1 20 | Mattress Protector, Family & Co-Sleep | Qty 1; Item 2 | D1 26 | BedBridge Connector | Qty 1"
// Format B (older):   "Line 1 | <source title> | MildMate -> 6 | <D1 title> | Mapped" (one per line; qty not present -> 1)

export function parseConfirmedMap(mapText) {
  const text = String(mapText || "").trim();
  if (!text) return { ok: false, reason: "D1_Product_Map is empty", items: [] };

  const items = [];
  const segments = text.split(/;|\r?\n/).map((s) => s.trim()).filter(Boolean);

  for (const seg of segments) {
    let m = seg.match(/^Item\s+(\d+)\s*\|\s*D1\s+(\d+)\s*\|\s*(.*?)\s*\|\s*Qty\s+([\d.]+)/i);
    if (m) {
      items.push({ item_no: Number(m[1]), product_id: Number(m[2]), title: m[3], quantity: Number(m[4]) || 1, format: "A" });
      continue;
    }
    m = seg.match(/^Line\s+(\d+)\s*\|.*?MildMate\s*->\s*(\d+)\s*\|\s*([^|]*)/i);
    if (m) {
      items.push({ item_no: Number(m[1]), product_id: Number(m[2]), title: m[3].trim(), quantity: 1, format: "B" });
      continue;
    }
    return { ok: false, reason: `Unrecognized D1_Product_Map segment: "${truncate(seg, 120)}"`, items: [] };
  }
  if (items.length === 0) return { ok: false, reason: "No items parsed from D1_Product_Map", items: [] };
  return { ok: true, items };
}

export function parseConfirmedIds(idsText) {
  return String(idsText || "")
    .split(/[,;]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

// ── Worker API ─────────────────────────────────────────────────────────────

async function workerFetch(base, token, route, init = {}) {
  const res = await fetch(base + route, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Worker API ${route} -> ${res.status}: ${truncate(body.message || "", 200)}`);
  return body;
}

// ── Notion read / write ────────────────────────────────────────────────────

async function queryNotionPages({ token, dataSourceId, cursor, editedAfter, orderId }) {
  const body = { page_size: 50 };
  if (cursor) body.start_cursor = cursor;
  const filters = [];
  // Only Mapped records are ever fetched — everything else belongs to Make.com.
  filters.push({ property: "Product_Mapping_Status", select: { equals: "Mapped" } });
  if (orderId !== null && orderId !== undefined) filters.push({ property: "ID", unique_id: { equals: orderId } });
  if (editedAfter) filters.push({ timestamp: "last_edited_time", last_edited_time: { after: editedAfter } });
  body.filter = filters.length === 1 ? filters[0] : { and: filters };

  const res = await throttledNotionFetch(`${NOTION_API}/v1/data_sources/${dataSourceId}/query`, {
    method: "POST",
    headers: notionHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Notion query failed (${res.status}): ${truncate(err.message || "", 300)}`);
  }
  return res.json();
}

function extractRecord(page) {
  const p = page.properties || {};
  return {
    page_id: page.id,
    last_edited_time: page.last_edited_time,
    notion_id: propPlainText(p.ID),
    order_number: propPlainText(p.Order_Number),
    shop: propPlainText(p.Shop),
    op_status: propPlainText(p.Status),
    order_date: propPlainText(p.Order_Date) || propPlainText(p.Order_date01),
    total_amount: p.TotalAmount && typeof p.TotalAmount.number === "number" ? p.TotalAmount.number : null,
    mapping_status: propPlainText(p.Product_Mapping_Status),
    d1_product_ids: propPlainText(p.D1_Product_IDs),
    d1_product_map: propPlainText(p.D1_Product_Map),
    sig_current: propPlainText(p.D1_Current_Signature),
    sig_last: propPlainText(p[SIGNATURE_FIELD]),
    sig_prop_type: p[SIGNATURE_FIELD] ? p[SIGNATURE_FIELD].type : null,
  };
}

async function writeLastSyncedSignature({ token, pageId, propType, value }) {
  if (propType !== "rich_text") {
    throw new Error(`Refusing to write ${SIGNATURE_FIELD}: expected rich_text, found "${propType}"`);
  }
  const res = await throttledNotionFetch(`${NOTION_API}/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: notionHeaders(token),
    body: JSON.stringify({ properties: { [SIGNATURE_FIELD]: { rich_text: [{ text: { content: truncate(value, 1900) } }] } } }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Notion signature write failed (${res.status}): ${truncate(err.message || "", 300)}`);
  }
}

// ── State / logging ────────────────────────────────────────────────────────

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

// ── Core per-record processing ─────────────────────────────────────────────

function buildUpsertPayload(rec, items) {
  const status = THAI_STATUS_MAP[rec.op_status] || null;
  return {
    payload: {
      source_system: rec.shop,
      source_order_id: rec.order_number,
      notion_page_id: rec.page_id,
      order_date: rec.order_date || null,
      currency: "THB",
      order_total: rec.total_amount,
      ...(status ? { status } : {}),
      mapping_status: "Mapped",
      sync_source: "notion-direct-mapper",
      scenario: "phase07-confirmed-mapping-sync",
      items: items.map((it, i) => ({
        // Match the Make.com key convention exactly ({Order_Number}-{n}) so
        // both systems upsert the same rows instead of duplicating items.
        source_item_key: `${rec.order_number}-${i + 1}`,
        item_no: it.item_no,
        product_id: it.product_id,
        quantity: it.quantity,
        raw_item_text: truncate(it.title, 255),
        revenue_status: "UNALLOCATED",
      })),
    },
    statusMapped: Boolean(status),
  };
}

async function processRecord(rec, ctx) {
  const { apiBase, apiToken, notionToken, catalogIds, dryRun, log } = ctx;

  // Eligibility rule 1: Mapped only (defense in depth; query already filters).
  if (rec.mapping_status !== "Mapped") {
    log.write({ t: "skip", id: rec.notion_id, reason: "not Mapped (belongs to Make.com)" });
    return "skipped_not_mapped";
  }
  // Eligibility rule 2: signature difference (or never synced).
  if (rec.sig_last && rec.sig_last === rec.sig_current) {
    log.write({ t: "skip", id: rec.notion_id, order: rec.order_number, reason: "signature unchanged (already synced)" });
    return "skipped_unchanged";
  }

  const parsed = parseConfirmedMap(rec.d1_product_map);
  if (!parsed.ok) {
    log.write({ t: "skip", id: rec.notion_id, order: rec.order_number, reason: "map parse failed: " + parsed.reason });
    return "skipped_parse_failed";
  }

  // Cross-check parsed ids against the confirmed D1_Product_IDs field.
  const idsField = parseConfirmedIds(rec.d1_product_ids);
  const idsParsed = Array.from(new Set(parsed.items.map((i) => i.product_id)));
  const mismatch = idsField.length > 0 &&
    (idsField.length !== idsParsed.length || idsField.some((id) => !idsParsed.includes(id)));
  if (mismatch) {
    log.write({ t: "skip", id: rec.notion_id, order: rec.order_number, reason: `ids mismatch: field=[${idsField}] map=[${idsParsed}]` });
    return "skipped_ids_mismatch";
  }

  // Validate every confirmed id against the canonical D1 catalog before any write.
  const invalid = idsParsed.filter((id) => !catalogIds.has(id));
  if (invalid.length > 0) {
    log.write({ t: "skip", id: rec.notion_id, order: rec.order_number, reason: `invalid product ids: [${invalid}]` });
    return "skipped_invalid_ids";
  }

  if (!rec.order_number || !rec.shop) {
    log.write({ t: "skip", id: rec.notion_id, reason: "missing Order_Number or Shop" });
    return "skipped_incomplete";
  }

  const { payload, statusMapped } = buildUpsertPayload(rec, parsed.items);
  const needsSignatureUpdate = true; // eligibility already implies it

  log.write({
    t: "record", id: rec.notion_id, order: rec.order_number, shop: rec.shop,
    mapping_status: rec.mapping_status, sig_current: rec.sig_current, sig_last: rec.sig_last || null,
    parsed_items: parsed.items, confirmed_ids: idsField, dry_run: dryRun,
    op_status: rec.op_status, op_status_mapped: statusMapped,
    would_upsert: payload, would_update_signature: needsSignatureUpdate,
  });

  if (dryRun) return "dry_run_eligible";

  const result = await workerFetch(apiBase, apiToken, "/api/v1/sales/orders/upsert", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.success) throw new Error(`Upsert rejected: ${result.error_code || "unknown"}`);
  log.write({ t: "upsert", id: rec.notion_id, order: rec.order_number, action: result.action });

  // Only after a successful D1 upsert: mark the Notion row as synced.
  await writeLastSyncedSignature({ token: notionToken, pageId: rec.page_id, propType: rec.sig_prop_type, value: rec.sig_current });
  log.write({ t: "signature_updated", id: rec.notion_id, order: rec.order_number });

  return "synced";
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
  console.log(`Mode: ${mock ? "MOCK (input-file)" : "LIVE Notion (read" + (args.dryRun ? "-only" : "+signature write") + ")"} | dry-run: ${args.dryRun} | API: ${apiBase}`);

  const catalog = await workerFetch(apiBase, apiToken, "/api/v1/mapping/catalog");
  const catalogIds = new Set((catalog.products || []).map((p) => Number(p.id)));
  console.log(`Catalog: ${catalog.count} active products`);

  const ctx = { apiBase, apiToken, notionToken, catalogIds, dryRun: args.dryRun, log };
  const counts = {};
  const bump = (k) => { counts[k] = (counts[k] || 0) + 1; };
  let processed = 0;

  const state = loadState();
  let cursor = args.resume ? state.cursor || null : null;

  const handle = async (rec) => {
    try {
      bump(await processRecord(rec, ctx));
    } catch (e) {
      bump("errors");
      log.write({ t: "error", id: rec.notion_id, order: rec.order_number, message: truncate(e.message, 300) });
      console.error(`Error on ID ${rec.notion_id}: ${e.message}`);
    }
    processed++;
  };

  if (mock) {
    const rows = JSON.parse(fs.readFileSync(args.inputFile, "utf8").replace(/^\uFEFF/, ""));
    for (const raw of rows) {
      if (args.limit !== null && processed >= args.limit) break;
      await handle({ sig_prop_type: "rich_text", ...raw });
    }
  } else {
    let more = true;
    while (more) {
      const page = await queryNotionPages({ token: notionToken, dataSourceId, cursor, editedAfter: args.editedAfter, orderId: args.orderId });
      for (const p of page.results || []) {
        if (args.limit !== null && processed >= args.limit) { more = false; break; }
        await handle(extractRecord(p));
      }
      if (more) {
        cursor = page.next_cursor || null;
        more = Boolean(page.has_more) && cursor;
      }
      saveState({ ...state, cursor, updated_at: new Date().toISOString() });
      if (args.limit !== null && processed >= args.limit) break;
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
