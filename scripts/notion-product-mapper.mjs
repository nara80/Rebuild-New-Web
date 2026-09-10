#!/usr/bin/env node
/**
 * MildMate — Direct Notion API Product Mapper (Phase 07 v2)
 *
 * Resolves unmapped Notion OrderList product lines to canonical D1 Product_IDs
 * via the token-protected Worker mapping endpoints, then writes results back to
 * the SAME Notion record (only D1_Product_IDs, D1_Product_Map, Product_Mapping_Status).
 *
 * Environment variables (never committed, never printed):
 *   NOTION_TOKEN            Notion integration token (dedicated "MildMate OrderList Mapper")
 *   NOTION_DATA_SOURCE_ID   OrderList data source id
 *   SALES_SYNC_API_TOKEN    Bearer token for the Worker mapping endpoints
 *   MAPPER_API_BASE         Worker origin (default https://www.mildmate.com; use http://localhost:8788 for tests)
 *
 * Usage:
 *   node scripts/notion-product-mapper.mjs --dry-run --limit 5
 *   node scripts/notion-product-mapper.mjs --order-id 1038 --dry-run
 *   node scripts/notion-product-mapper.mjs --edited-after 2026-09-01T00:00:00Z --limit 20
 *   node scripts/notion-product-mapper.mjs --resume            (continue from saved cursor)
 *   node scripts/notion-product-mapper.mjs --input-file sample.json --dry-run   (offline mock mode, no Notion access)
 *
 * Safety:
 *   - Records already `Mapped` are never re-processed (verified mappings preserved).
 *   - Product ids are validated by the Worker against D1 `products` before any Notion write.
 *   - Only the three mapping fields are ever written; Product_Info/ProductJSON are never modified.
 *   - Logs contain no tokens and no customer PII (only order/product metadata).
 */

import fs from "node:fs";
import path from "node:path";

// ── Config ─────────────────────────────────────────────────────────────────

const NOTION_API = "https://api.notion.com";
const NOTION_VERSION = "2025-09-03";
const NOTION_MIN_INTERVAL_MS = 350; // ~3 req/s Notion limit
const STATE_FILE = path.join("scripts", ".notion-mapper-state.json");
const LOG_DIR = path.join("logs", "notion-mapper");

const MAPPING_FIELDS = ["D1_Product_IDs", "D1_Product_Map", "Product_Mapping_Status"];
const READ_FIELDS = ["Order_Number", "Shop", "Product_Info", "ProductJSON", ...MAPPING_FIELDS];
const ELIGIBLE_STATUSES = ["Unmapped", "Review Required", ""]; // "" = empty status

const METHOD_MAP = {
  variation_exact: { method: "EXACT_VARIATION", confidence: 1.0 },
  verified_alias: { method: "EXACT_ALIAS", confidence: 0.97 },
  listing: { method: "LISTING_VARIATION", confidence: 0.9 },
};

// ── CLI args ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { dryRun: false, limit: null, resume: false, orderId: null, editedAfter: null, inputFile: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--resume") args.resume = true;
    else if (a === "--limit") args.limit = Number(argv[++i]);
    else if (a === "--order-id") args.orderId = String(argv[++i]);
    else if (a === "--edited-after") args.editedAfter = String(argv[++i]);
    else if (a === "--input-file") args.inputFile = String(argv[++i]);
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
    else { console.error(`Unknown argument: ${a}`); printHelp(); process.exit(1); }
  }
  if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit <= 0)) {
    console.error("--limit must be a positive integer"); process.exit(1);
  }
  if (args.editedAfter && Number.isNaN(Date.parse(args.editedAfter))) {
    console.error("--edited-after must be an ISO datetime"); process.exit(1);
  }
  return args;
}

function printHelp() {
  console.log("Options: --dry-run --limit N --resume --order-id X --edited-after ISO --input-file file.json");
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
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function propPlainText(prop) {
  if (!prop) return "";
  if (Array.isArray(prop.title)) return prop.title.map((t) => t.plain_text ?? "").join("");
  if (Array.isArray(prop.rich_text)) return prop.rich_text.map((t) => t.plain_text ?? "").join("");
  if (prop.select) return prop.select.name || "";
  if (prop.status) return prop.status.name || "";
  if (typeof prop.number === "number") return String(prop.number);
  if (typeof prop.formula?.string === "string") return prop.formula.string;
  if (typeof prop.formula?.number === "number") return String(prop.formula.number);
  return "";
}

function truncate(s, n) {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n) : str;
}

// ── Item parsing (best-effort; unparseable -> Review Required) ─────────────

function pick(obj, keys) {
  for (const k of keys) {
    for (const cand of [k, k.toLowerCase(), k.toUpperCase()]) {
      if (obj[cand] !== undefined && obj[cand] !== null && obj[cand] !== "") return obj[cand];
    }
  }
  return null;
}

export function parseItems(productJson, productInfo) {
  // 1) Structured ProductJSON preferred
  if (productJson && String(productJson).trim()) {
    try {
      let data = JSON.parse(productJson);
      if (data && !Array.isArray(data) && Array.isArray(data.items)) data = data.items;
      if (Array.isArray(data) && data.length > 0) {
        return data.map((raw, i) => {
          const obj = typeof raw === "object" && raw !== null ? raw : { title: String(raw) };
          const variation = pick(obj, ["variation", "variations", "selected_variation", "selectedVariation", "options", "option"]);
          const title = pick(obj, ["title", "name", "product", "product_name", "listing_title"]);
          return {
            item_no: i + 1,
            listing_id: pick(obj, ["listing_id", "listingId", "listing", "external_listing_id"]) != null
              ? String(pick(obj, ["listing_id", "listingId", "listing", "external_listing_id"])) : null,
            variation_text: variation != null ? (typeof variation === "string" ? variation : JSON.stringify(variation)) : null,
            item_text: title != null ? String(title) : truncate(JSON.stringify(obj), 300),
            quantity: Number(pick(obj, ["quantity", "qty", "count"])) > 0 ? Number(pick(obj, ["quantity", "qty", "count"])) : 1,
          };
        });
      }
    } catch {
      /* fall through to Product_Info */
    }
  }
  // 2) Fallback: plain-text Product_Info, one item per non-empty line
  const lines = String(productInfo || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line, i) => {
    const qtyMatch = line.match(/(?:qty|quantity)\s*[:=]?\s*(\d+)/i) || line.match(/\bx\s*(\d+)\b/i);
    return {
      item_no: i + 1,
      listing_id: null,
      variation_text: null,
      item_text: line,
      quantity: qtyMatch ? Number(qtyMatch[1]) : 1,
    };
  });
}

// ── Worker mapping API ─────────────────────────────────────────────────────

function workerHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function workerFetch(base, token, route, init = {}) {
  const res = await fetch(base + route, { ...init, headers: { ...workerHeaders(token), ...(init.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 404) {
    throw new Error(`Worker API ${route} -> ${res.status}: ${truncate(body.message || "", 200)}`);
  }
  return body;
}

// ── Notion read / write ────────────────────────────────────────────────────

async function queryNotionPages({ token, dataSourceId, cursor, editedAfter }) {
  const body = { page_size: 50 };
  if (cursor) body.start_cursor = cursor;
  if (editedAfter) body.filter = { timestamp: "last_edited_time", last_edited_time: { after: editedAfter } };
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
  const byName = (name) => p[name];
  return {
    page_id: page.id,
    last_edited_time: page.last_edited_time,
    order_number: propPlainText(byName("Order_Number")),
    shop: propPlainText(byName("Shop")),
    product_info: propPlainText(byName("Product_Info")),
    product_json: propPlainText(byName("ProductJSON")),
    d1_product_ids: propPlainText(byName("D1_Product_IDs")),
    d1_product_map: propPlainText(byName("D1_Product_Map")),
    mapping_status: propPlainText(byName("Product_Mapping_Status")),
    // property types needed to build a correct PATCH payload
    prop_types: Object.fromEntries(
      MAPPING_FIELDS.map((f) => [f, byName(f) ? byName(f).type : null])
    ),
  };
}

function buildWriteProperty(type, value) {
  if (type === "rich_text") return { rich_text: [{ text: { content: truncate(value, 1900) } }] };
  if (type === "title") return { title: [{ text: { content: truncate(value, 1900) } }] };
  if (type === "select") return { select: { name: value } };
  if (type === "status") return { status: { name: value } };
  if (type === "number") return { number: Number(value) };
  return null;
}

async function updateNotionPage({ token, pageId, propTypes, values }) {
  const properties = {};
  for (const field of MAPPING_FIELDS) {
    if (values[field] === undefined) continue;
    const type = propTypes[field];
    const built = buildWriteProperty(type, values[field]);
    if (!built) throw new Error(`Cannot write field ${field}: unsupported/unknown property type "${type}"`);
    properties[field] = built;
  }
  const res = await throttledNotionFetch(`${NOTION_API}/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: notionHeaders(token),
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Notion page update failed (${res.status}): ${truncate(err.message || "", 300)}`);
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

async function processRecord(rec, ctx) {
  const { apiBase, apiToken, catalogTitles, dryRun, log } = ctx;
  const sourceSystem = rec.shop || null;

  // Preserve verified mappings: never re-process Mapped records.
  if (rec.mapping_status === "Mapped") {
    log.write({ t: "skip", order: rec.order_number, reason: "already Mapped" });
    return { outcome: "skipped_mapped" };
  }

  const items = parseItems(rec.product_json, rec.product_info);
  if (items.length === 0) {
    log.write({ t: "record", order: rec.order_number, result: "Review Required", reason: "no parseable items" });
    return await finishRecord(rec, ctx, { status: "Review Required", lines: [], allIds: [], method: null, confidence: null, reason: "no parseable items" });
  }

  const lines = [];
  const allIds = [];
  let resolvedCount = 0;
  let worstConfidence = 1;
  let firstMethod = null;

  for (const item of items) {
    const body = {
      source_system: sourceSystem,
      listing_id: item.listing_id,
      variation_text: item.variation_text,
      item_text: item.item_text,
    };
    const r = await workerFetch(apiBase, apiToken, "/api/v1/mapping/resolve", { method: "POST", body: JSON.stringify(body) });
    if (r.resolved) {
      const meta = METHOD_MAP[r.method] || { method: "RULE", confidence: 0.85 };
      resolvedCount++;
      worstConfidence = Math.min(worstConfidence, meta.confidence);
      if (!firstMethod) firstMethod = meta.method;
      for (const pid of r.product_ids) {
        allIds.push(pid);
        lines.push(`Item ${lines.length + 1} | D1 ${pid} | ${catalogTitles.get(pid) || "Product " + pid} | Qty ${item.quantity} | Status Mapped`);
      }
      log.write({ t: "item", order: rec.order_number, item_no: item.item_no, resolved: true, method: r.method, product_ids: r.product_ids });
    } else {
      log.write({ t: "item", order: rec.order_number, item_no: item.item_no, resolved: false, item_text: truncate(item.item_text, 200) });
    }
  }

  let status;
  if (resolvedCount === items.length) status = "Mapped";
  else if (resolvedCount > 0) status = "Partial";
  else status = "Review Required";

  return await finishRecord(rec, ctx, {
    status,
    lines,
    allIds: Array.from(new Set(allIds)),
    method: firstMethod,
    confidence: resolvedCount > 0 ? worstConfidence : null,
    reason: null,
  });
}

async function finishRecord(rec, ctx, result) {
  const { apiBase, apiToken, notionToken, dryRun, log, mock } = ctx;
  const values = {};
  if (result.status === "Mapped" || result.status === "Partial") {
    values.D1_Product_IDs = result.allIds.join(", ");
    values.D1_Product_Map = result.lines.join("\n");
  }
  values.Product_Mapping_Status = result.status;

  log.write({
    t: "record", order: rec.order_number, page: rec.page_id, result: result.status,
    product_ids: result.allIds, method: result.method, confidence: result.confidence,
    dry_run: dryRun, would_write: values,
  });

  if (!dryRun && !mock) {
    await updateNotionPage({ token: notionToken, pageId: rec.page_id, propTypes: rec.prop_types, values });
  }

  // Audit event (recorded for dry runs too, flagged accordingly)
  try {
    await workerFetch(apiBase, apiToken, "/api/v1/mapping/events", {
      method: "POST",
      body: JSON.stringify({
        notion_page_id: rec.page_id,
        source_order_id: rec.order_number || null,
        source_system: rec.shop || null,
        raw_product_text: truncate(rec.product_json || rec.product_info || "", 1000),
        previous_product_ids: rec.d1_product_ids || null,
        resolved_product_ids: result.allIds,
        mapping_method: result.method,
        confidence: result.confidence,
        result_status: result.status,
        dry_run: dryRun,
      }),
    });
  } catch (e) {
    log.write({ t: "warn", order: rec.order_number, message: "audit event failed: " + truncate(e.message, 200) });
  }

  return { outcome: result.status };
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
  console.log(`Mode: ${mock ? "MOCK (input-file)" : "LIVE Notion"} | dry-run: ${args.dryRun} | API: ${apiBase}`);

  // Load catalog once (titles for D1_Product_Map lines + sanity check).
  const catalog = await workerFetch(apiBase, apiToken, "/api/v1/mapping/catalog");
  if (!catalog.success) { console.error("Could not load product catalog."); process.exit(1); }
  const catalogTitles = new Map((catalog.products || []).map((p) => [Number(p.id), p.title_en]));
  console.log(`Catalog: ${catalog.count} active products`);

  const ctx = { apiBase, apiToken, notionToken, catalogTitles, dryRun: args.dryRun, log, mock };
  const counts = { Mapped: 0, Partial: 0, "Review Required": 0, skipped_mapped: 0, skipped_filter: 0, errors: 0 };
  let processed = 0;

  const state = loadState();
  let cursor = args.resume ? state.cursor || null : null;

  const handle = async (rec) => {
    if (args.orderId && String(rec.order_number) !== String(args.orderId)) { counts.skipped_filter++; return; }
    if (rec.mapping_status && !ELIGIBLE_STATUSES.includes(rec.mapping_status)) {
      counts[rec.mapping_status === "Mapped" ? "skipped_mapped" : "skipped_filter"]++;
      return;
    }
    try {
      const r = await processRecord(rec, ctx);
      counts[r.outcome] = (counts[r.outcome] || 0) + 1;
      processed++;
    } catch (e) {
      counts.errors++;
      log.write({ t: "error", order: rec.order_number, message: truncate(e.message, 300) });
      console.error(`Error on ${rec.order_number}: ${e.message}`);
    }
  };

  if (mock) {
    const rows = JSON.parse(fs.readFileSync(args.inputFile, "utf8").replace(/^\uFEFF/, ""));
    for (const raw of rows) {
      if (args.limit !== null && processed >= args.limit) break;
      await handle({
        page_id: raw.page_id || "mock-page",
        order_number: String(raw.order_number ?? ""),
        shop: raw.shop || null,
        product_info: raw.product_info || "",
        product_json: raw.product_json || "",
        d1_product_ids: raw.d1_product_ids || "",
        d1_product_map: raw.d1_product_map || "",
        mapping_status: raw.mapping_status || "",
        prop_types: {},
      });
    }
  } else {
    let more = true;
    while (more) {
      const page = await queryNotionPages({ token: notionToken, dataSourceId, cursor, editedAfter: args.editedAfter });
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
  console.log("\n=== Mapping run summary ===");
  for (const [k, v] of Object.entries(counts)) console.log(`${k}: ${v}`);
  console.log(`Processed: ${processed}`);
  if (counts.errors > 0) process.exitCode = 2;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isDirectRun) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
