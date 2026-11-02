import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = "D:/00_mildmate/re-build_web";
const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

const dashboardPath = path.resolve(argValue("--source", path.join(repoRoot, "public/super-admin/marketing/data-analyst/index.html")));
const artifactDir = path.resolve(argValue("--outdir", path.join(repoRoot, "00_Issue/data-quality-sync-runs-grouping-20261101")));
const label = String(argValue("--label", "dq-sync-runs")).trim() || "dq-sync-runs";
const harnessPath = path.join(artifactDir, `${label}-harness.html`);
const expectModernUi = !args.includes("--legacy");

const gscChunks = Array.from({ length: 14 }).map((_, i) => ({
  id: 791 + i,
  source: "gsc-worker-cron",
  scenario: "phase09-weekly-gsc-sync:scheduled-weekly",
  started_at: new Date(Date.parse("2026-10-29T01:00:58.603Z") + i * 20000).toISOString(),
  finished_at: new Date(Date.parse("2026-10-29T01:01:09.079Z") + i * 20000).toISOString(),
  status: "success",
  records_received: [47, 36, 43, 36, 40, 55, 50, 45, 45, 37, 38, 37, 54, 34][i],
  records_created: i >= 7 ? [45, 45, 37, 38, 37, 54, 34][i - 7] : 0,
  records_updated: 0,
  records_unchanged: i >= 7 ? 0 : [47, 36, 43, 36, 40, 55, 50][i],
  records_rejected: 0,
  error_message: "",
}));

const groupedFixture = [
  {
    group_id: "syncgrp-gsc-791-804",
    source: "gsc-worker-cron",
    scenario: "phase09-weekly-gsc-sync:scheduled-weekly",
    started_at: "2026-10-29T01:00:58.603Z",
    finished_at: "2026-10-29T01:04:44.516Z",
    status: "success",
    chunk_count: 14,
    records_received: 597,
    records_created: 290,
    records_updated: 0,
    records_unchanged: 307,
    records_rejected: 0,
    error_message: null,
    inferred_grouping: true,
    grouping_rule: "inferred_contiguous_chunks_v1",
    incomplete_window: false,
    chunks: gscChunks,
  },
  {
    group_id: "syncgrp-gsc-failed",
    source: "gsc-worker-cron",
    scenario: "phase09-weekly-gsc-sync:manual",
    started_at: "2026-10-29T06:00:00.000Z",
    finished_at: "2026-10-29T06:02:00.000Z",
    status: "failed",
    chunk_count: 2,
    records_received: 30,
    records_created: 0,
    records_updated: 0,
    records_unchanged: 10,
    records_rejected: 20,
    error_message: "GSC upsert failed (500)",
    inferred_grouping: true,
    grouping_rule: "inferred_contiguous_chunks_v1",
    incomplete_window: true,
    chunks: [
      {
        id: 920,
        source: "gsc-worker-cron",
        scenario: "phase09-weekly-gsc-sync:manual",
        started_at: "2026-10-29T06:00:00.000Z",
        finished_at: "2026-10-29T06:01:00.000Z",
        status: "success",
        records_received: 10,
        records_created: 0,
        records_updated: 0,
        records_unchanged: 10,
        records_rejected: 0,
        error_message: "",
      },
      {
        id: 921,
        source: "gsc-worker-cron",
        scenario: "phase09-weekly-gsc-sync:manual",
        started_at: "2026-10-29T06:01:10.000Z",
        finished_at: "2026-10-29T06:02:00.000Z",
        status: "failed",
        records_received: 20,
        records_created: 0,
        records_updated: 0,
        records_unchanged: 0,
        records_rejected: 20,
        error_message: "GSC upsert failed (500)",
      },
    ],
  },
  {
    group_id: "syncgrp-ga4-single",
    source: "ga4-worker-cron:website",
    scenario: "phase10-weekly-ga4-sync:scheduled-weekly:website",
    started_at: "2026-10-26T01:00:43.056Z",
    finished_at: "2026-10-26T01:01:10.000Z",
    status: "success",
    chunk_count: 1,
    records_received: 120,
    records_created: 8,
    records_updated: 3,
    records_unchanged: 109,
    records_rejected: 0,
    error_message: null,
    inferred_grouping: false,
    grouping_rule: "single_row",
    incomplete_window: false,
    chunks: [
      {
        id: 880,
        source: "ga4-worker-cron:website",
        scenario: "phase10-weekly-ga4-sync:scheduled-weekly:website",
        started_at: "2026-10-26T01:00:43.056Z",
        finished_at: "2026-10-26T01:01:10.000Z",
        status: "success",
        records_received: 120,
        records_created: 8,
        records_updated: 3,
        records_unchanged: 109,
        records_rejected: 0,
        error_message: "",
      },
    ],
  },
];

const rawFixture = gscChunks.slice(0, 10);
const metaFixture = {
  rows_fetched: 250,
  rows_scanned_limit: 250,
  window_truncated: true,
  groups_total: 18,
  groups_returned: 3,
  inferred_groups: 2,
  notes: [
    "GSC collector groups are inferred from contiguous source/scenario timestamps (no parent run_id in sync_runs).",
    "Oldest inferred group may be incomplete because the sync-runs fetch window is capped.",
  ],
};

function extractDashboardAssets(sourceHtml) {
  const styleMatch = sourceHtml.match(/<style>([\s\S]*?)<\/style>/i);
  const scriptMatches = [...sourceHtml.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  if (!styleMatch || scriptMatches.length < 2) {
    throw new Error("Could not extract style/script blocks from dashboard HTML.");
  }
  const style = styleMatch[1];
  const appScriptRaw = scriptMatches[scriptMatches.length - 1][1];
  const appScript = appScriptRaw.replace(/\bboot\(\);\s*$/m, "/* boot disabled for local regression */");
  return { style, appScript };
}

function createFakeDom() {
  const elements = new Map();
  function makeElement(id) {
    return {
      id,
      innerHTML: "",
      textContent: "",
      value: "",
      style: {},
      className: "",
      classList: { toggle() {}, add() {}, remove() {} },
      setAttribute() {},
      getAttribute() { return ""; },
      addEventListener() {},
    };
  }
  function ensure(id) {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  }
  const document = {
    getElementById(id) { return ensure(id); },
    querySelectorAll() { return []; },
    createElement() { return makeElement("node"); },
  };
  ["runs-table", "runs-summary-note"].forEach(ensure);
  return { document, elements };
}

async function runRendererRegression(appScript) {
  const { document, elements } = createFakeDom();
  const context = {
    console,
    document,
    window: { addEventListener() {}, location: { hostname: "localhost", pathname: "/super-admin/marketing/data-analyst/" } },
    localStorage: { getItem() { return ""; }, setItem() {} },
    fetch: async () => ({ ok: true, async json() { return { success: true }; } }),
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    Math,
    JSON,
  };
  vm.createContext(context);
  vm.runInContext(appScript, context, { filename: "data-analyst-dq-renderer.js" });
  assert.equal(typeof context.renderSyncRuns, "function", "renderSyncRuns() must exist.");
  context.renderSyncRuns(groupedFixture, metaFixture, rawFixture);

  const runsHtml = elements.get("runs-table").innerHTML;
  const noteText = elements.get("runs-summary-note").textContent || "";
  assert.match(runsHtml, /<table>/, "Sync-runs table should render.");
  assert.match(runsHtml, /gsc-worker-cron/, "Grouped source should render.");
  if (expectModernUi) {
    assert.match(runsHtml, /View chunks \(14\)/, "Chunk details disclosure should show 14 chunks.");
    assert.match(runsHtml, /inferred group/, "Inferred-group label should render.");
    assert.match(noteText, /grouped from latest/i, "Runs summary note should be updated by grouped metadata.");
  }
}

function buildHarnessHtml(style, appScript) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DQ Sync Runs Grouping Harness</title>
  <style>${style}</style>
</head>
<body>
  <div class="content" style="max-width:1366px;margin:0 auto;padding:16px">
    <div class="card">
      <div class="card-header"><span>Recent Sync Runs</span><span class="muted" id="runs-summary-note">grouped collector view</span></div>
      <div class="table-wrap"><div id="runs-table"><div class="state">Loading…</div></div></div>
    </div>
    <pre id="probe-results" style="margin-top:16px;background:#0f172a;color:#f8fafc;padding:10px;border-radius:8px;white-space:pre-wrap"></pre>
  </div>

  <script>${appScript}</script>
  <script>
  (function(){
    var grouped = ${JSON.stringify(groupedFixture)};
    var meta = ${JSON.stringify(metaFixture)};
    var rawRows = ${JSON.stringify(rawFixture)};
    function overlap(a, b){
      return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    }
    function probe(){
      var details = document.querySelectorAll('#runs-table details.sync-run-details');
      if (details[0]) details[0].open = true;
      var rows = Array.from(document.querySelectorAll('#runs-table > table > tbody > tr'));
      var overlapCount = 0;
      rows.forEach(function(row){
        var cells = Array.from(row.children || []);
        for (var i = 0; i < cells.length; i++) {
          for (var j = i + 1; j < cells.length; j++) {
            if (overlap(cells[i].getBoundingClientRect(), cells[j].getBoundingClientRect())) overlapCount++;
          }
        }
      });
      var wrap = document.querySelector('.table-wrap');
      var firstDetailsRows = document.querySelectorAll('#runs-table details.sync-run-details tbody tr').length;
      var result = {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        group_rows: rows.length,
        details_count: details.length,
        chunk_rows_visible: firstDetailsRows,
        inferred_badges: document.querySelectorAll('#runs-table .badge.badge-blue').length,
        summary_note: (document.getElementById('runs-summary-note') || {}).textContent || '',
        mobile_scroll_needed: wrap ? (wrap.scrollWidth > wrap.clientWidth) : null,
        wrap_scroll_width: wrap ? wrap.scrollWidth : null,
        wrap_client_width: wrap ? wrap.clientWidth : null,
        overlap_count: overlapCount
      };
      var out = document.getElementById('probe-results');
      if (out) out.textContent = JSON.stringify(result, null, 2);
      document.body.setAttribute('data-probe-ready', '1');
    }
    if (typeof renderSyncRuns === 'function') {
      renderSyncRuns(grouped, meta, rawRows);
      requestAnimationFrame(function(){ requestAnimationFrame(probe); });
    } else {
      var out = document.getElementById('probe-results');
      if (out) out.textContent = JSON.stringify({ error: 'renderSyncRuns missing' }, null, 2);
      document.body.setAttribute('data-probe-ready', '1');
    }
  })();
  </script>
</body>
</html>`;
}

async function main() {
  if (!fs.existsSync(dashboardPath)) throw new Error("Dashboard source not found: " + dashboardPath);
  const sourceHtml = fs.readFileSync(dashboardPath, "utf8");
  const { style, appScript } = extractDashboardAssets(sourceHtml);
  await runRendererRegression(appScript);

  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(harnessPath, buildHarnessHtml(style, appScript), "utf8");

  console.log("PASS data-quality-sync-runs-regression");
  console.log("Source:", dashboardPath);
  console.log("Harness:", harnessPath);
}

main().catch((err) => {
  console.error("FAIL data-quality-sync-runs-regression");
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
