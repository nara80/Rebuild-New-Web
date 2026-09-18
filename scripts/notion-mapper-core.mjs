/**
 * MildMate — Notion confirmed-mapping sync ENGINE (runtime-agnostic core).
 *
 * This module is the single implementation of the Phase 07 v3 confirmed-mapping
 * sync. It is imported by BOTH runtimes and must never be forked:
 *
 *   - scripts/notion-product-mapper.mjs   Node CLI (manual/ad-hoc runs)
 *   - marketing-sync-worker/index.ts      Cloudflare Worker cron (Phase 17)
 *
 * It therefore uses only platform-neutral APIs (fetch, JSON, Date) and takes
 * all I/O as injected dependencies: no node:fs, no node:path, no process.*.
 * Logging and cursor persistence are supplied by the caller.
 *
 * Design invariants inherited from Phase 07 v3 (do not relax):
 *   - Eligibility: Product_Mapping_Status = "Mapped" AND signature differs.
 *   - D1_Last_Synced_Signature is the ONLY Notion field ever written, and only
 *     after a confirmed successful D1 upsert.
 *   - Nothing is ever auto-mapped or re-mapped; Make.com owns mapping.
 *   - source_item_key = {Order_Number}-{n}, matching Make.com exactly.
 *   - Exact order totals; line revenue stays UNALLOCATED (never invented,
 *     never equal-split).
 *   - Thai statuses map explicitly; unknown statuses are sent without a status
 *     and flagged, never guessed.
 *   - Every parsed product id is validated against the canonical catalog
 *     before any write; mismatches are skipped and logged.
 */

// ── Config ─────────────────────────────────────────────────────────────────

export const NOTION_API = "https://api.notion.com";
export const NOTION_VERSION = "2025-09-03";
export const NOTION_MIN_INTERVAL_MS = 350; // ~3 req/s Notion limit

export const SIGNATURE_FIELD = "D1_Last_Synced_Signature"; // the ONLY field this tool writes

// Thai operational status → canonical sales status. Unknown values are sent as
// no status (upsert accepts null) and flagged in the log, never guessed.
export const THAI_STATUS_MAP = {
  "รอดำเนินการ": "pending",
  "กำลังดำเนินการ": "processing",
  "กำลังผลิต": "processing",
  "กำลังเย็บ": "processing",
  "จัดส่งสินค้า": "shipped",
  "จัดส่งแล้ว": "shipped",
  "ส่งแล้ว": "shipped",
  "สำเร็จ": "completed",
  "เสร็จสิ้น": "completed",
  "ยกเลิก": "cancelled",
  "คืนเงิน": "refunded",
};

export const REPORT_EMAIL_TO_DEFAULT = "contact@mildmate.com";
export const REPORT_FROM = "MildMate <noreply@mildmate.com>";

export const SKIP_LABELS = {
  skipped_not_mapped: "not Mapped (belongs to Make.com)",
  skipped_unchanged: "already synced (signature unchanged)",
  skipped_no_order_date: "no/invalid Order_Date (cannot apply date scope)",
  skipped_after_cutoff: "Order_Date after cutoff (month held back)",
  skipped_no_total: "no TotalAmount in Notion (held until corrected)",
  skipped_parse_failed: "D1_Product_Map parse failed",
  skipped_ids_mismatch: "D1_Product_IDs vs map mismatch",
  skipped_invalid_ids: "invalid product ids",
  skipped_incomplete: "missing Order_Number or Shop",
};

// ── Utilities ──────────────────────────────────────────────────────────────

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastNotionCall = 0;

export async function throttledNotionFetch(url, init, attempt = 0) {
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

export function notionHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" };
}

export function propPlainText(prop) {
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

export function truncate(s, n) {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n) : str;
}

// ── Confirmed D1_Product_Map parsing (three live formats) ────────────────────
//
// Format A (current): "Item 1 | D1 20 | Mattress Protector, Family & Co-Sleep | Qty 1; Item 2 | D1 26 | BedBridge Connector | Qty 1"
// Format B (older):   "Line 1 | <source title> | MildMate -> 6 | <D1 title> | Mapped" (one per line; qty not present -> 1)
// Format C (2026-09-12): "Line 1 | <source title> -> 20 | <D1 title> | Mapped" — the arrow+id sits at the END
//   of any pipe piece (often a Thai description piece), not in a standalone "MildMate -> id" piece.
//
// Regression suite: scripts/notion-mapper-parser.test.mjs (27 real-world cases).

export function parseConfirmedMap(mapText) {
  const text = String(mapText || "").trim();
  if (!text) return { ok: false, reason: "D1_Product_Map is empty", items: [] };

  const items = [];
  const segments = text.split(/;|\r?\n/).map((s) => s.trim()).filter(Boolean);

  for (const seg of segments) {
    // Stray status fragment on its own line (e.g. after a manual map edit):
    // "| Mapped", "Status Mapped", "Mapped" — carries no data, skip it.
    if (/^\|?\s*(?:status\s+)?mapped$/i.test(seg)) continue;

    // Format A: "Item 1 | D1 20 | <D1 title> [| extra pieces] [| Qty 1] [| Status Mapped]"
    let m = seg.match(/^Item\s+(\d+)\s*\|\s*D1\s+(\d+)\s*\|(.*)$/i);
    if (m) {
      const restPieces = m[3].split("|").map((p) => p.trim());
      const qtyM = seg.match(/Qty\s+([\d.]+)/i);
      items.push({ item_no: Number(m[1]), product_id: Number(m[2]), title: restPieces[0] || "", quantity: qtyM ? Number(qtyM[1]) || 1 : 1, format: "A" });
      continue;
    }
    // Format B/C: "Line N | ... <piece ending with [MildMate] -> <id>> | <D1 title> [| Mapped]"
    m = seg.match(/^Line\s+(\d+)\s*\|(.*)$/i);
    if (m) {
      const item_no = Number(m[1]);
      const pieces = m[2].split("|").map((p) => p.trim());
      // The D1 id is introduced by an arrow at the END of a pipe piece:
      //   "... -> 26"  or  "MildMate -> 6"  (case-insensitive)
      const arrowRe = /(?:MildMate\s*)?->\s*(\d+(?:\s*[,&+]\s*\d+)*)\s*$/i;
      let arrowIdx = -1;
      let idText = null;
      for (let i = 0; i < pieces.length; i++) {
        const am = pieces[i].match(arrowRe);
        if (am) { arrowIdx = i; idText = am[1]; break; }
      }
      if (arrowIdx >= 0) {
        if (/[,&+]/.test(idText)) {
          return { ok: false, reason: `Multi-id line needs manual handling: "${truncate(seg, 120)}"`, items: [] };
        }
        const qtyM = seg.match(/Qty\s+([\d.]+)/i);
        const next = pieces[arrowIdx + 1] || "";
        const title = (next && !/^Mapped$/i.test(next))
          ? next
          : pieces[0].replace(arrowRe, "").trim();
        items.push({ item_no, product_id: Number(idText), title, quantity: qtyM ? Number(qtyM[1]) || 1 : 1, format: "B" });
        continue;
      }
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

export async function workerFetch(base, token, route, init = {}) {
  const res = await fetch(base + route, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Worker API ${route} -> ${res.status}: ${truncate(body.message || "", 200)}`);
  return body;
}

export async function fetchCatalogIds(apiBase, apiToken) {
  const catalog = await workerFetch(apiBase, apiToken, "/api/v1/mapping/catalog");
  return { ids: new Set((catalog.products || []).map((p) => Number(p.id))), count: catalog.count };
}

// ── Notion read / write ────────────────────────────────────────────────────

export async function queryNotionPages({ token, dataSourceId, cursor, editedAfter, orderId, before }) {
  const body = { page_size: 50 };
  if (cursor) body.start_cursor = cursor;
  const filters = [];
  // Only Mapped records are ever fetched — everything else belongs to Make.com.
  filters.push({ property: "Product_Mapping_Status", select: { equals: "Mapped" } });
  if (orderId !== null && orderId !== undefined) filters.push({ property: "ID", unique_id: { equals: orderId } });
  if (editedAfter) filters.push({ timestamp: "last_edited_time", last_edited_time: { after: editedAfter } });
  // Server-side date scope so a record limit counts in-scope records only (the
  // client-side check in processRecord remains as defense in depth). Records
  // store the order date in either Order_Date or Order_date01.
  if (before) {
    filters.push({
      or: [
        { property: "Order_Date", date: { before } },
        { property: "Order_date01", date: { before } },
      ],
    });
  }
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

export function extractRecord(page) {
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

export async function writeLastSyncedSignature({ token, pageId, propType, value }) {
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

// ── Run report ─────────────────────────────────────────────────────────────

export function newReportCollector() {
  return { synced: [], skips: {}, errors: [] };
}

export function recordSkip(report, category, rec) {
  (report.skips[category] = report.skips[category] || []).push(rec.order_number || `ID ${rec.notion_id}`);
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildReportEmail({ args, counts, processed, report, logFile, trigger }) {
  const ranAt = new Date();
  const dry = Boolean(args.dryRun);
  const syncedCount = counts.synced || 0;
  const eligibleCount = counts.dry_run_eligible || 0;
  const errCount = counts.errors || 0;
  const skipEntries = Object.entries(counts).filter(([k]) => k.startsWith("skipped"));
  const skippedTotal = skipEntries.reduce((a, [, v]) => a + v, 0);
  const headline = `${dry ? eligibleCount : syncedCount} ${dry ? "eligible" : "synced"}, ${skippedTotal} skipped, ${errCount} error${errCount === 1 ? "" : "s"}`;
  const subject = `MildMate Sales Sync${dry ? " (DRY RUN)" : ""} — ${headline} — ${ranAt.toISOString().slice(0, 16).replace("T", " ")}Z`;

  const mode = dry ? "DRY RUN (no writes)" : "LIVE (D1 upsert + signature write-back)";
  const info = [
    `Run: ${ranAt.toISOString()}`,
    `Mode: ${mode}`,
    ...(trigger ? [`Trigger: ${trigger}`] : []),
    ...(args.before ? [`Scope: Order_Date before ${args.before}`] : []),
    ...(args.orderId ? [`Single record: Notion ID ${args.orderId}`] : []),
    ...(logFile ? [`Log: ${logFile}`] : []),
    `Processed: ${processed}`,
  ];

  const lines = ["MildMate — Notion confirmed-mapping sync report", "", ...info, "", "=== Summary ==="];
  for (const [k, v] of Object.entries(counts)) lines.push(`- ${k}: ${v}`);

  if (report.synced.length > 0) {
    lines.push("", `=== ${dry ? "Eligible (would sync)" : "Synced orders"} (${report.synced.length}) ===`);
    for (const r of report.synced) {
      lines.push(`- [${r.shop}] ${r.order} — THB ${r.total} — ${r.items.length} item(s): ${r.items.map((i) => `${i.product_id}x${i.quantity}`).join(", ")}`);
    }
  }
  if (skipEntries.length > 0) {
    lines.push("", `=== Skipped (${skippedTotal}) ===`);
    for (const [k, v] of skipEntries) {
      const orders = report.skips[k] || [];
      const shown = orders.slice(0, 12);
      const more = orders.length - shown.length;
      lines.push(`- ${SKIP_LABELS[k] || k} (${v}): ${shown.join(", ")}${more > 0 ? ` … +${more} more` : ""}`);
    }
  }
  if (report.errors.length > 0) {
    lines.push("", `=== Errors (${report.errors.length}) ===`);
    for (const e of report.errors) lines.push(`- ${e.order || `ID ${e.id}`}: ${e.message}`);
  }
  const text = lines.join("\n");

  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#1E293B;max-width:640px">`,
    `<h2 style="color:#0F172A;margin-bottom:4px">MildMate Sales Sync Report</h2>`,
    `<p style="color:#64748b;font-size:13px;margin:0 0 16px">${esc(mode)}${trigger ? ` &middot; ${esc(trigger)}` : ""}${args.before ? ` &middot; Order_Date before ${esc(args.before)}` : ""} &middot; ${ranAt.toISOString().slice(0, 16).replace("T", " ")}Z</p>`,
    `<table style="border-collapse:collapse;font-size:13px;margin-bottom:16px">`,
    ...Object.entries(counts).map(([k, v]) =>
      `<tr><td style="padding:2px 12px 2px 0;color:#64748b">${esc(k)}</td><td style="padding:2px 0;font-weight:bold">${v}</td></tr>`),
    `</table>`,
  ];
  if (report.synced.length > 0) {
    html.push(`<h3 style="color:#0F172A;font-size:14px">${dry ? "Eligible (would sync)" : "Synced orders"} (${report.synced.length})</h3>`,
      `<table style="border-collapse:collapse;font-size:13px;margin-bottom:16px">`,
      `<tr style="color:#64748b;text-align:left"><th style="padding:2px 12px 2px 0">Shop</th><th style="padding:2px 12px 2px 0">Order</th><th style="padding:2px 12px 2px 0">Total (THB)</th><th style="padding:2px 12px 2px 0">Items</th></tr>`,
      ...report.synced.map((r) => `<tr><td style="padding:2px 12px 2px 0">${esc(r.shop)}</td><td style="padding:2px 12px 2px 0">${esc(r.order)}</td><td style="padding:2px 12px 2px 0">${r.total}</td><td style="padding:2px 12px 2px 0">${esc(r.items.map((i) => `${i.product_id}x${i.quantity}`).join(", "))}</td></tr>`),
      `</table>`);
  }
  if (skipEntries.length > 0) {
    html.push(`<h3 style="color:#0F172A;font-size:14px">Skipped (${skippedTotal})</h3><ul style="font-size:13px;margin:0 0 16px;padding-left:20px">`);
    for (const [k, v] of skipEntries) {
      const orders = (report.skips[k] || []).slice(0, 12);
      const more = (report.skips[k] || []).length - orders.length;
      html.push(`<li style="margin-bottom:4px">${esc(SKIP_LABELS[k] || k)} <b>(${v})</b>: ${esc(orders.join(", "))}${more > 0 ? ` … +${more} more` : ""}</li>`);
    }
    html.push(`</ul>`);
  }
  if (report.errors.length > 0) {
    html.push(`<h3 style="color:#B91C1C;font-size:14px">Errors (${report.errors.length})</h3><ul style="font-size:13px;color:#B91C1C;padding-left:20px">`,
      ...report.errors.map((e) => `<li style="margin-bottom:4px">${esc(e.order || `ID ${e.id}`)}: ${esc(e.message)}</li>`),
      `</ul>`);
  }
  html.push(`<p style="color:#64748b;font-size:12px;margin-top:24px">${logFile ? `Full JSONL log: ${esc(logFile)}` : "Per-record audit rows: product_mapping_events"}</p></div>`);
  return { subject, text, html: html.join("\n") };
}

export async function sendReportEmail({ subject, text, html, apiKey, to }) {
  if (!apiKey) return { success: false, error: "RESEND_API_KEY not set (report skipped)" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: REPORT_FROM, to: [to || REPORT_EMAIL_TO_DEFAULT], subject, text, html }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: `Resend ${res.status}: ${truncate(body.message || "", 200)}` };
  return { success: true, id: body.id };
}

// ── Core per-record processing ─────────────────────────────────────────────

export function buildUpsertPayload(rec, items, syncSource = "notion-direct-mapper", scenario = "phase07-confirmed-mapping-sync") {
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
      sync_source: syncSource,
      scenario,
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

export async function processRecord(rec, ctx) {
  const { apiBase, apiToken, notionToken, catalogIds, dryRun, log, before, report, syncSource, scenario, onEvent } = ctx;

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
  // Eligibility rule 3 (date scope, optional): with a `before` cutoff, hold back
  // records from months still being corrected in Notion (e.g. before
  // 2026-08-01 = July 2026 and earlier). Unparseable dates cannot be scoped
  // safely, so they are held too and show in the log for review.
  if (before) {
    const ts = Date.parse(rec.order_date || "");
    if (Number.isNaN(ts)) {
      log.write({ t: "skip", id: rec.notion_id, order: rec.order_number, reason: `no/invalid Order_Date (cannot apply before ${before}): "${rec.order_date}"` });
      return "skipped_no_order_date";
    }
    if (ts >= Date.parse(before)) {
      log.write({ t: "skip", id: rec.notion_id, order: rec.order_number, reason: `Order_Date ${rec.order_date} not before ${before} (month held back for correction)` });
      return "skipped_after_cutoff";
    }
  }
  // Eligibility rule 4 (data quality, permanent rule 2026-09-12): only sync
  // records whose TotalAmount exists in Notion. Revenue data is corrected
  // monthly; a missing total means the record is not yet final. Held records
  // re-sync automatically once the total is filled (signature changes).
  if (rec.total_amount === null || rec.total_amount <= 0) {
    log.write({ t: "skip", id: rec.notion_id, order: rec.order_number, reason: "no TotalAmount in Notion (held until total is corrected)" });
    return "skipped_no_total";
  }

  const parsed = parseConfirmedMap(rec.d1_product_map);
  if (!parsed.ok) {
    log.write({ t: "skip", id: rec.notion_id, order: rec.order_number, reason: "map parse failed: " + parsed.reason });
    return "skipped_parse_failed";
  }

  // Cross-check parsed ids against the confirmed D1_Product_IDs field.
  const idsField = parseConfirmedIds(rec.d1_product_ids);
  const idsParsed = Array.from(new Set(parsed.items.map((i) => i.product_id)));
  // Live data mixes conventions: some records list one id per map line (duplicates,
  // e.g. "6, 6, 26"), others list unique ids ("6, 26"). Compare as unique sets on
  // both sides so both conventions pass while a genuinely missing/extra id fails.
  const idsFieldUnique = Array.from(new Set(idsField));
  const mismatch = idsFieldUnique.length > 0 &&
    (idsFieldUnique.length !== idsParsed.length || idsFieldUnique.some((id) => !idsParsed.includes(id)));
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

  const { payload, statusMapped } = buildUpsertPayload(rec, parsed.items, syncSource, scenario);
  const needsSignatureUpdate = true; // eligibility already implies it

  log.write({
    t: "record", id: rec.notion_id, order: rec.order_number, shop: rec.shop,
    mapping_status: rec.mapping_status, sig_current: rec.sig_current, sig_last: rec.sig_last || null,
    parsed_items: parsed.items, confirmed_ids: idsField, dry_run: dryRun,
    op_status: rec.op_status, op_status_mapped: statusMapped,
    would_upsert: payload, would_update_signature: needsSignatureUpdate,
  });

  const syncedEntry = {
    id: rec.notion_id, order: rec.order_number, shop: rec.shop, total: rec.total_amount,
    items: parsed.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
  };

  if (dryRun) {
    report.synced.push(syncedEntry);
    if (onEvent) await onEvent({ rec, parsed, dryRun: true, action: "would_upsert" });
    return "dry_run_eligible";
  }

  const result = await workerFetch(apiBase, apiToken, "/api/v1/sales/orders/upsert", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.success) throw new Error(`Upsert rejected: ${result.error_code || "unknown"}`);
  log.write({ t: "upsert", id: rec.notion_id, order: rec.order_number, action: result.action });

  // Only after a successful D1 upsert: mark the Notion row as synced.
  await writeLastSyncedSignature({ token: notionToken, pageId: rec.page_id, propType: rec.sig_prop_type, value: rec.sig_current });
  log.write({ t: "signature_updated", id: rec.notion_id, order: rec.order_number });
  report.synced.push(syncedEntry);
  if (onEvent) await onEvent({ rec, parsed, dryRun: false, action: result.action });

  return "synced";
}

// ── Shared run orchestration ───────────────────────────────────────────────
//
// Both runtimes call this. The caller injects:
//   log      { write(obj) }            required
//   onCursor async (cursor) => void    optional, persist pagination cursor
//   onEvent  async ({...}) => void     optional, per-record audit hook
//   rows     array                     optional, offline/mock mode (no Notion)
//   maxMs    number                    optional, stop early and carry over
//
// Returns { counts, processed, report, cursor, exhausted }.

export async function runSync(options) {
  const {
    apiBase, apiToken, notionToken, dataSourceId,
    dryRun = false, before = null, limit = null, orderId = null, editedAfter = null,
    cursor: startCursor = null, rows = null,
    log, onCursor, onEvent, maxMs = null,
    syncSource = "notion-direct-mapper", scenario = "phase07-confirmed-mapping-sync",
    catalogIds: providedCatalogIds = null,
  } = options;

  const startedMs = Date.now();
  const catalogIds = providedCatalogIds || (await fetchCatalogIds(apiBase, apiToken)).ids;

  const report = newReportCollector();
  const ctx = { apiBase, apiToken, notionToken, catalogIds, dryRun, before, report, log, syncSource, scenario, onEvent };
  const counts = {};
  const bump = (k) => { counts[k] = (counts[k] || 0) + 1; };
  let processed = 0;
  let cursor = startCursor;
  let exhausted = true;

  const outOfTime = () => maxMs !== null && Date.now() - startedMs >= maxMs;

  const handle = async (rec) => {
    try {
      const result = await processRecord(rec, ctx);
      bump(result);
      if (result.startsWith("skipped")) recordSkip(report, result, rec);
    } catch (e) {
      bump("errors");
      report.errors.push({ order: rec.order_number || "", id: rec.notion_id, message: truncate(e.message, 300) });
      log.write({ t: "error", id: rec.notion_id, order: rec.order_number, message: truncate(e.message, 300) });
    }
    processed++;
  };

  if (rows) {
    for (const raw of rows) {
      if (limit !== null && processed >= limit) break;
      await handle({ sig_prop_type: "rich_text", ...raw });
    }
  } else {
    let more = true;
    let hitLimit = false;
    while (more) {
      const page = await queryNotionPages({ token: notionToken, dataSourceId, cursor, editedAfter, orderId, before });
      for (const p of page.results || []) {
        if (limit !== null && processed >= limit) { more = false; hitLimit = true; break; }
        await handle(extractRecord(p));
      }
      if (more) {
        cursor = page.next_cursor || null;
        more = Boolean(page.has_more) && Boolean(cursor);
      }
      if (onCursor) await onCursor(cursor);
      // A record limit stops the scan without proving the table is drained, so
      // the caller must keep the cursor and resume rather than restart.
      if (limit !== null && processed >= limit) { hitLimit = true; break; }
      // Bounded invocation: stop cleanly and carry over via the cursor so the
      // next run resumes exactly where this one stopped.
      if (more && outOfTime()) {
        log.write({ t: "bounded_stop", processed, reason: `time budget ${maxMs}ms reached; carrying over cursor` });
        exhausted = false;
        break;
      }
    }
    if (hitLimit) exhausted = false;
  }

  return { counts, processed, report, cursor, exhausted };
}
