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
const artifactDir = path.resolve(argValue("--outdir", path.join(repoRoot, "00_Issue/phase13-growth-ui-remediation-20261101")));
const label = String(argValue("--label", "growth-phase13")).trim() || "growth-phase13";
const harnessPath = path.join(artifactDir, `${label}-harness.html`);
const expectModernUi = !args.includes("--legacy");

const longReason = [
  "Google Ads business signal is sparse, so confidence impact is neutral and not ranked.",
  "Coverage remains partial while attribution maturity and source lag are monitored.",
  "This sentence is intentionally long to validate wrapping and disclosure behavior on narrow layouts."
].join(" ");

const growthFixture = {
  success: true,
  growth_signal_contract: "v1",
  window: { current_start: "2026-09-01", current_end: "2026-10-31" },
  google_ads_policy: { business_signal: "insufficient_or_sparse" },
  signals: {
    demand: {
      status: "sufficient",
      value: {
        quote_volume_28d: 126,
        paid_orders_28d: 41,
        source_mix: {
          first_touch: { google: 39, direct: 31, etsy: 18, referral: 7, unknown: 5 },
          quote_session: { google: 45, direct: 27, etsy: 14, referral: 8, unknown: 6 }
        },
        trend_vector: [12, 14, 18, 17, 19, 21, 25]
      },
      coverage: { rows: 812, mapped_pct: 93.7, source_days: 61 },
      freshness_days: { min: 0, max: 2, weighted_avg: 0.7 },
      confidence_impact: 8,
      reason: "Demand signal has complete quote + paid-order continuity across the selected window."
    },
    momentum: {
      status: "stale_source",
      value: { units_growth_pct: null, current_units: null, previous_units: null },
      coverage: { source: "ga4", rows: 0, expected_rows: 28, stale_since_days: 13 },
      freshness_days: { ga4: 13, sales: 0, gsc: 1 },
      confidence_impact: -12,
      reason: longReason
    },
    conversion_availability: {
      status: "neutral",
      value: { available: true, exact_quote_conversion_pct: 12.5, sample_size: 64 },
      coverage: { exact_quote_rows: 64, legacy_email_match_rows: 5 },
      freshness_days: 0,
      confidence_impact: 0,
      reason: "Exact conversion metric is available and reported separately from legacy email matches."
    },
    channel_context: {
      status: "sufficient",
      value: { breadth: 7, concentration_top2_pct: 63.4, dominant_channels: ["website", "etsy"] },
      coverage: { channels_with_sales: 7, channels_total: 9 },
      freshness_days: { website: 0, etsy: 2, line: 4, shopee: 8 },
      confidence_impact: 4,
      reason: "Channel breadth is adequate for directional context."
    },
    source_freshness: {
      status: "mapping_gap",
      value: { stale_sources: ["ga4", "google_ads"], healthy_sources: ["sales", "quotes", "gsc", "etsy"] },
      coverage: { healthy_count: 4, stale_count: 2 },
      freshness_days: { sales: 0, quotes: 0, gsc: 1, etsy: 2, ga4: 13, google_ads: 11 },
      confidence_impact: -6,
      reason: "Two sources exceed freshness threshold and are down-weighted."
    },
    mapping_coverage: {
      status: "sufficient",
      value: { mapped_items_pct: 98.2, mapped_orders_pct: 96.1, unmapped_rows: 9 },
      coverage: { total_rows: 511, mapped_rows: 502 },
      freshness_days: 0,
      confidence_impact: 5,
      reason: "Mapping coverage remains within confidence tolerance."
    },
    confidence: {
      status: "sufficient",
      value: 30,
      coverage: { factors: ["freshness", "mapping", "signal_completeness"], penalties: 2 },
      freshness_days: { max: 13 },
      confidence_impact: 0,
      reason: "Composite confidence is resilient after penalties."
    },
    profitability_guardrail: {
      status: "secondary_guardrail",
      value: { modeled_margin_pct: 23.6, coverage_orders: 451, estimate_share_pct: 18.9 },
      coverage: { costed_orders: 451, total_orders: 511 },
      freshness_days: 1,
      confidence_impact: 0,
      reason: "Profitability is contextual only and does not rank opportunities in Phase 13."
    }
  }
};

function decodeHtmlEntities(input) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

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
  const optionElements = [];

  function makeElement(id) {
    return {
      id,
      innerHTML: "",
      textContent: "",
      value: "",
      style: {},
      options: [],
      classList: { toggle() {}, add() {}, remove() {} },
      setAttribute() {},
      getAttribute() { return ""; },
      addEventListener() {},
      appendChild(child) { this.options.push(child); optionElements.push(child); return child; }
    };
  }

  function ensure(id) {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  }

  const document = {
    getElementById(id) { return ensure(id); },
    querySelectorAll() { return []; },
    createElement() { return makeElement("option-" + (optionElements.length + 1)); }
  };

  ["growth-summary", "growth-signals-table", "f-start", "f-end", "f-channel", "f-product"].forEach(ensure);
  return { document, elements };
}

async function runRendererRegression(appScript) {
  const { document, elements } = createFakeDom();
  const context = {
    console,
    document,
    window: {
      location: { hostname: "localhost", pathname: "/super-admin/marketing/data-analyst/" },
      addEventListener() {},
      __SKIP_CLERK: true
    },
    localStorage: { getItem() { return ""; }, setItem() {} },
    fetch: async (url) => {
      if (String(url).includes("/growth-signals")) {
        return { ok: true, async json() { return growthFixture; } };
      }
      return { ok: true, async json() { return { success: true }; } };
    },
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    Math,
    JSON
  };

  vm.createContext(context);
  vm.runInContext(appScript, context, { filename: "data-analyst-growth-renderer.js" });
  await context.loadGrowthSignals();

  const tableHtml = elements.get("growth-signals-table").innerHTML;
  const summaryHtml = elements.get("growth-summary").innerHTML;

  assert.match(summaryHtml, /Contract:\s*v1/, "Summary should show contract v1.");
  assert.match(tableHtml, /<table>/, "Growth table should render.");
  if (expectModernUi) {
    assert.match(tableHtml, /<details class="gs-details">/g, "Details disclosure should exist.");
    assert.doesNotMatch(tableHtml, /\{"units_growth_pct":null,"current_units":null,"previous_units":null\}/, "Minified JSON blob must not be inline in a cell.");
  }

  const rowCount = (tableHtml.match(/<tr>/g) || []).length - 1; // subtract header row
  assert.equal(rowCount, 8, "All 8 growth signals must render.");

  const preMatches = [...tableHtml.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map((m) => decodeHtmlEntities(m[1]));
  if (expectModernUi) {
    assert.ok(preMatches.length >= 6, "Expected multiple structured detail blocks.");
    assert.ok(preMatches.some((p) => p.includes('"source_mix"')), "Demand JSON details must preserve nested values.");
    assert.ok(preMatches.some((p) => p.includes(longReason)), "Long reason text must remain available in full details.");
  }
}

function buildHarnessHtml(style, appScript) {
  const fixtureJson = JSON.stringify(growthFixture);
  const escapedScript = appScript;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Phase13 Growth Harness</title>
  <style>${style}</style>
</head>
<body>
  <div class="content" style="max-width:1366px;margin:0 auto;padding:16px">
    <div class="card" id="growth-card">
      <div class="card-header"><span>Sales Growth Signals (Phase 13) — Harness</span></div>
      <div class="card-body"><div id="growth-summary"></div></div>
      <div class="table-wrap"><div id="growth-signals-table"><div class="state">Loading…</div></div></div>
    </div>
    <pre id="probe-results" style="margin-top:16px;background:#0f172a;color:#f8fafc;padding:10px;border-radius:8px;white-space:pre-wrap"></pre>
  </div>

  <input type="hidden" id="f-start" value="">
  <input type="hidden" id="f-end" value="">
  <select id="f-channel" style="display:none"><option value=""></option></select>
  <select id="f-product" style="display:none"><option value=""></option></select>

  <script>
  window.__SKIP_CLERK = true;
  </script>
  <script>
  ${escapedScript}
  </script>
  <script>
  (function(){
    var fixture = ${fixtureJson};
    var probeErrors = [];
    var nativeConsoleError = console.error;
    window.addEventListener('error', function(ev){
      probeErrors.push(String(ev && ev.message || 'window.error'));
    });
    window.addEventListener('unhandledrejection', function(ev){
      probeErrors.push(String(ev && ev.reason || 'unhandledrejection'));
    });
    console.error = function(){
      probeErrors.push(String(arguments[0] || 'console.error'));
      return nativeConsoleError.apply(console, arguments);
    };
    window.fetch = async function(url){
      if (String(url).indexOf('/growth-signals') >= 0) {
        return { ok:true, json: async function(){ return fixture; } };
      }
      return { ok:true, json: async function(){ return { success:true }; } };
    };
    function overlap(a, b){
      return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    }
    function textRectsForCell(cell){
      var rects = [];
      var walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null);
      var n;
      while((n = walker.nextNode())){
        var text = (n.nodeValue || '').trim();
        if (!text) continue;
        var range = document.createRange();
        range.selectNodeContents(n);
        var parts = range.getClientRects();
        for (var i = 0; i < parts.length; i++) {
          var r = parts[i];
          if (r.width <= 0 || r.height <= 0) continue;
          rects.push({ left:r.left, right:r.right, top:r.top, bottom:r.bottom });
        }
      }
      return rects;
    }
    function probe(){
      var rows = Array.from(document.querySelectorAll('#growth-signals-table tbody tr'));
      var overlapCount = 0;
      var clippingCount = 0;
      var textOverlapCount = 0;
      var textHorizontalEscapeCount = 0;
      rows.forEach(function(row){
        var cells = Array.from(row.children || []);
        for (var i = 0; i < cells.length; i++) {
          for (var j = i + 1; j < cells.length; j++) {
            if (overlap(cells[i].getBoundingClientRect(), cells[j].getBoundingClientRect())) overlapCount++;
          }
        }
        for (var c = 0; c < cells.length; c++) {
          var cellRect = cells[c].getBoundingClientRect();
          var rects = textRectsForCell(cells[c]);
          rects.forEach(function(tr){
            var escapesHorizontally = tr.left < cellRect.left - 1.5 || tr.right > cellRect.right + 1.5;
            if (escapesHorizontally) textHorizontalEscapeCount++;
            for (var other = 0; other < cells.length; other++) {
              if (other === c) continue;
              var otherRect = cells[other].getBoundingClientRect();
              if (overlap(tr, otherRect)) {
                textOverlapCount++;
                break;
              }
            }
          });
        }
      });
      var clips = document.querySelectorAll('#growth-signals-table .gs-summary, #growth-signals-table .gs-details summary');
      clips.forEach(function(node){
        var cs = window.getComputedStyle(node);
        var clipped = (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1) &&
          (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis' || cs.whiteSpace === 'nowrap');
        if (clipped) clippingCount++;
      });
      var wrap = document.querySelector('#growth-card .table-wrap');
      var result = {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        rows: rows.length,
        overlap_count: overlapCount,
        text_overlap_count: textOverlapCount,
        text_horizontal_escape_count: textHorizontalEscapeCount,
        clipping_count: clippingCount,
        script_error_count: probeErrors.length,
        script_errors: probeErrors.slice(0, 5),
        has_disclosures: document.querySelectorAll('#growth-signals-table details.gs-details').length,
        mobile_scroll_needed: wrap ? (wrap.scrollWidth > wrap.clientWidth) : null,
        wrap_scroll_width: wrap ? wrap.scrollWidth : null,
        wrap_client_width: wrap ? wrap.clientWidth : null
      };
      var out = document.getElementById('probe-results');
      if (out) out.textContent = JSON.stringify(result, null, 2);
      document.body.setAttribute('data-probe-ready', '1');
    }
    loadGrowthSignals().then(function(){
      requestAnimationFrame(function(){ requestAnimationFrame(probe); });
    });
  })();
  </script>
</body>
</html>`;
}

async function main() {
  if (!fs.existsSync(dashboardPath)) {
    throw new Error("Dashboard source not found: " + dashboardPath);
  }
  const sourceHtml = fs.readFileSync(dashboardPath, "utf8");
  const { style, appScript } = extractDashboardAssets(sourceHtml);
  await runRendererRegression(appScript);

  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(harnessPath, buildHarnessHtml(style, appScript), "utf8");

  console.log("PASS phase13-growth-ui-regression");
  console.log("Source:", dashboardPath);
  console.log("Harness:", harnessPath);
}

main().catch((err) => {
  console.error("FAIL phase13-growth-ui-regression");
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
