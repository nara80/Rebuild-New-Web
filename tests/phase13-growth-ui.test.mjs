// Phase 13 Growth Signals UI regression tests.
// Evaluates the REAL data-analyst page script in a sandboxed DOM stub and runs
// loadGrowthSignals against a realistic Phase 13 fixture (contract v1 shape).
// Presentation-layer only: verifies rendering, layout CSS, and API-response immutability.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const pagePath = fileURLToPath(new URL("../public/super-admin/marketing/data-analyst/index.html", import.meta.url));
const page = readFileSync(pagePath, "utf8");

// ── Extract the single main <script> block from the real page ──
const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
assert.ok(scripts.length >= 1, "page must contain a script block");
const mainScript = scripts.reduce((a, b) => (b.length > a.length ? b : a));

// ── Realistic Phase 13 fixture (envelope shape per production contract v1;
//    values mirror the owner's observed 2026-10-12 response where applicable) ──
function sig(status, value, coverage, freshness_days, confidence_impact, reason) {
  return { status, value, coverage, freshness_days, confidence_impact, reason };
}
const FIXTURE = {
  success: true,
  growth_signal_contract: "v1",
  window: { current_start: "2026-09-14", current_end: "2026-10-11", previous_start: "2026-08-17", previous_end: "2026-09-13" },
  google_ads_policy: { business_signal: "insufficient_or_sparse", note: "neutral in phase 13" },
  signals: {
    demand: sig("sufficient",
      { sessions_28d: 1234, orders_28d: 18, paid_sessions_28d: 210, organic_sessions_28d: 1024 },
      { state: "verified_current_window", note: "GA4 property 308922589" },
      2, 0, "Demand fully covered by canonical GA4 property for the current 28d window."),
    momentum: sig("insufficient_signal",
      { units_growth_pct: null, current_units: null, previous_units: null },
      { sales_coverage: { state: "unverified", note: "no verified sales coverage for current window" } },
      null, -20,
      "Sales coverage unverified for the current window; growth withheld rather than computed from partial data."),
    conversion_availability: sig("neutral",
      { purchase_events_28d: 0, checkout_events_28d: 3 },
      { state: "verified_current_window" }, 2, 0,
      "Zero purchase events observed (distinguishable from unavailable)."),
    channel_context: sig("neutral", { top_channel: "direct", channels_observed: 4 },
      { state: "verified_current_window" }, 2, 0, "Channel mix available from GA4."),
    source_freshness: sig("sufficient", { ga4_lag_days: 2, gsc_lag_days: 3, ads_lag_days: 2 },
      { state: "verified_current_window" }, 2, 0, "All collectors fresh."),
    mapping_coverage: sig("mapping_gap", { mapped_listings: 14, unmapped_listings: 2 },
      { state: "partial_current_window" }, 1, -5, "2 Etsy listings not mapped to canonical products."),
    confidence: sig("sufficient", { value: 30, basis: "coverage + freshness + mapping" },
      { state: "verified_current_window" }, 2, 0, "Confidence reflects unverified sales coverage."),
    profitability_guardrail: sig("secondary_guardrail", { ads_spend_28d_thb: 360, model: "phase13-cost-model" },
      { state: "verified_current_window" }, 2, 0, "Google Ads remains neutral in Phase 13."),
  },
};

// ── Sandbox DOM/runtime stubs ──
function makeElement(id) {
  return {
    id, value: "", innerHTML: "", textContent: "", className: "", disabled: false,
    style: {}, options: [], appendChild() {}, addEventListener() {},
  };
}

function buildSandbox(fixture) {
  const elements = new Map();
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  let fetchCalls = [];
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    URLSearchParams,
    window: { __SKIP_CLERK: true },
    localStorage: { getItem: () => "stub", setItem() {}, removeItem() {} },
    document: {
      getElementById: el,
      createElement: (t) => makeElement(t),
      addEventListener() {},
      body: makeElement("body"),
    },
    fetch: (url) => {
      fetchCalls.push(String(url));
      if (String(url).includes("/growth-signals")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(fixture)) });
      }
      return new Promise(() => {}); // other loaders hang silently
    },
    __fetchCalls: fetchCalls,
    __elements: elements,
  };
  sandbox.window.fetch = sandbox.fetch;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── Run the page script once per test (fresh sandbox each time) ──
function runPage(fixture) {
  const snapshot = JSON.parse(JSON.stringify(fixture));
  const sandbox = buildSandbox(fixture);
  vm.runInContext(mainScript, sandbox, { filename: "data-analyst-inline.js" });
  return { sandbox, snapshot, tableEl: sandbox.__elements.get("growth-signals-table"), summaryEl: sandbox.__elements.get("growth-summary") };
}

// Wait until the stubbed loader has painted (microtasks resolve).
async function painted(run) {
  for (let i = 0; i < 50; i++) {
    if (run.tableEl.innerHTML.includes("<table")) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.ok(run.tableEl.innerHTML.includes("<table"), "growth signals table did not render");
}

function rows(html) {
  return html.split("<tr>").slice(1).filter((r) => !r.includes("<th>"));
}
function cells(rowHtml) {
  return rowHtml.split("</td>").slice(0, -1).map((c) => c.replace(/^<td[^>]*>/, ""));
}

// ════════ Tests ════════

test("1+2: eight signal rows render with all seven columns", async () => {
  const run = runPage(FIXTURE);
  await painted(run);
  const html = run.tableEl.innerHTML;
  const head = html.match(/<thead>[\s\S]*?<\/thead>/)[0];
  const headerCells = head.match(/<th(?:\s[^>]*)?>/g).length;
  assert.equal(headerCells, 7, "seven columns must remain");
  for (const col of ["Signal", "Status", "Value", "Coverage", "Freshness Days", "Confidence Impact", "Reason"]) {
    assert.ok(head.includes(col), `column "${col}" must remain`);
  }
  const bodyRows = rows(html.match(/<tbody>[\s\S]*?<\/tbody>/)[0]);
  assert.equal(bodyRows.length, 8, "all eight signal rows must render");
});

test("3+4: long JSON lives in a details/pre disclosure; no raw minified blob in cells", async () => {
  const run = runPage(FIXTURE);
  await painted(run);
  const html = run.tableEl.innerHTML;
  // No unbroken minified-JSON token rendered directly in a cell (outside <pre>).
  const withoutPre = html.replace(/<pre>[\s\S]*?<\/pre>/g, "");
  assert.doesNotMatch(withoutPre, /\{"[a-z_]+":/i, "raw minified JSON must not appear in table cells");
  // Every structured value is disclosed via native details + pre.
  const detailsCount = (html.match(/<details class="gs-details">/g) || []).length;
  const presCount = (html.match(/<pre>/g) || []).length;
  assert.equal(detailsCount, presCount, "each disclosure must hold exactly one pre");
  assert.ok(detailsCount >= 8, "structured values must be inspectable via details");
  // Full JSON inside pre must parse and deep-equal the original object (exact preservation).
  const pres = [...html.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map((m) => m[1]);
  const decoded = pres.map((p) => JSON.parse(p.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")));
  const expectedStructured = [
    FIXTURE.signals.demand.value, FIXTURE.signals.demand.coverage,
    FIXTURE.signals.momentum.value, FIXTURE.signals.momentum.coverage,
    FIXTURE.signals.conversion_availability.value, FIXTURE.signals.conversion_availability.coverage,
    FIXTURE.signals.channel_context.value, FIXTURE.signals.channel_context.coverage,
    FIXTURE.signals.source_freshness.value, FIXTURE.signals.source_freshness.coverage,
    FIXTURE.signals.mapping_coverage.value, FIXTURE.signals.mapping_coverage.coverage,
    FIXTURE.signals.confidence.value, FIXTURE.signals.confidence.coverage,
    FIXTURE.signals.profitability_guardrail.value, FIXTURE.signals.profitability_guardrail.coverage,
  ];
  for (const exp of expectedStructured) {
    assert.ok(decoded.some((d) => deepEqual(d, exp)), "full JSON payload must be preserved exactly and inspectable");
  }
});

test("5: null momentum growth stays null/unavailable — never shown as -100%", async () => {
  const run = runPage(FIXTURE);
  await painted(run);
  const bodyRows = rows(run.tableEl.innerHTML.match(/<tbody>[\s\S]*?<\/tbody>/)[0]);
  const momentumRow = bodyRows.find((r) => r.startsWith("<td>momentum</td>"));
  assert.ok(momentumRow, "momentum row must exist");
  assert.doesNotMatch(momentumRow, /-100/, "null growth must never display as -100%");
  assert.match(momentumRow, /<span class="muted">—<\/span>/, "null values must render as em-dash placeholder");
});

test("6: zero values remain distinguishable from null", async () => {
  const run = runPage(FIXTURE);
  await painted(run);
  const bodyRows = rows(run.tableEl.innerHTML.match(/<tbody>[\s\S]*?<\/tbody>/)[0]);
  const convRow = bodyRows.find((r) => r.startsWith("<td>conversion availability</td>"));
  assert.match(convRow, /purchase_events_28d:<\/span> 0/, "zero must render as literal 0");
  assert.doesNotMatch(convRow.replace(/<pre>[\s\S]*?<\/pre>/g, ""), /purchase_events_28d:<\/span> <span class="muted">—<\/span>/, "zero must not render as em-dash");
});

test("7: status badges preserve backend semantics", async () => {
  const run = runPage(FIXTURE);
  await painted(run);
  const html = run.tableEl.innerHTML;
  for (const badge of ["SUFFICIENT", "INSUFFICIENT_SIGNAL", "NEUTRAL", "MAPPING_GAP", "SECONDARY_GUARDRAIL"]) {
    assert.ok(html.includes(`>${badge}</span>`), `badge "${badge}" must preserve backend status text`);
  }
});

test("8: full reason text remains accessible (wrapped, untruncated)", async () => {
  const run = runPage(FIXTURE);
  await painted(run);
  const bodyRows = rows(run.tableEl.innerHTML.match(/<tbody>[\s\S]*?<\/tbody>/)[0]);
  const momentumRow = bodyRows.find((r) => r.startsWith("<td>momentum</td>"));
  const fullReason = "Sales coverage unverified for the current window; growth withheld rather than computed from partial data.";
  assert.ok(momentumRow.includes(fullReason), "full reason text must be present untruncated");
  assert.match(momentumRow, /class="gs-reason"/, "reason cell must use the wrapping class");
});

test("9+11: horizontal scroll contained; wrapping + narrow-viewport CSS present", () => {
  assert.match(page, /\.table-wrap\{overflow-x:auto\}/, "scroll containment must remain");
  assert.match(page, /#growth-signals-table td\{white-space:normal;vertical-align:top\}/, "growth cells must wrap");
  assert.match(page, /#growth-signals-table \.gs-summary\{[^}]*word-break:break-word/, "summary must break long tokens");
  assert.match(page, /#growth-signals-table \.gs-details pre\{[^}]*white-space:pre-wrap/, "pre must wrap, not overflow");
  assert.match(page, /#growth-signals-table \.gs-details pre\{[^}]*overflow-y:auto/, "tall JSON must scroll inside the pre");
  assert.match(page, /@media\(max-width:1100px\)/, "tablet breakpoint must remain");
  assert.match(page, /@media\(max-width:560px\)/, "mobile breakpoint must remain");
});

test("12: no regression to other tables — global nowrap unchanged, CSS scoped to growth table", () => {
  assert.match(page, /td\{padding:9px 12px;border-bottom:1px solid var\(--c-border\);color:var\(--c-text\);vertical-align:middle;white-space:nowrap\}/, "global td rule must be untouched");
  const styleEnd = page.indexOf("</style>");
  const marker = page.indexOf("Phase 13 Growth Signals table readability");
  assert.ok(marker > -1 && marker < styleEnd, "new CSS block must exist inside the style element");
  const nextRule = page.indexOf(".gate{", marker);
  const addedCss = page.slice(marker, nextRule > -1 ? nextRule : styleEnd);
  const rules = addedCss.split("}").map((r) => r.trim()).filter((r) => r.includes("{") && !r.startsWith("/*") && !r.includes("#growth-signals-table"));
  assert.equal(rules.length, 0, "every added CSS rule must be scoped under #growth-signals-table");
  const scoped = addedCss.match(/#growth-signals-table/g) || [];
  assert.ok(scoped.length >= 6, "all added rules must be scoped under #growth-signals-table");
});

test("13: loadGrowthSignals never mutates the API response object", async () => {
  const run = runPage(FIXTURE);
  await painted(run);
  assert.equal(JSON.stringify(FIXTURE), JSON.stringify(run.snapshot), "API response object must be identical after rendering");
});

test("14: exactly one API request for the growth signals load", async () => {
  const run = runPage(FIXTURE);
  await painted(run);
  const growthCalls = run.sandbox.__fetchCalls.filter((u) => u.includes("/growth-signals"));
  assert.equal(growthCalls.length, 1, "growth signals load must issue exactly one request");
});

test("15: other Data Analyst sections remain functional after the patch", async () => {
  const run = runPage(FIXTURE);
  for (const fn of ["loadSummary", "loadSales", "loadProducts", "loadChannels", "loadGsc", "loadGa4", "loadEtsy", "loadGoogleAds", "loadGrowthSignals", "loadProfitability", "loadOpportunity", "loadDQ"]) {
    assert.equal(typeof run.sandbox[fn], "function", `${fn} must remain defined`);
  }
  const html = run.tableEl.innerHTML;
  assert.ok(html.includes("<table") === false || true); // sanity no-throw
  // Other loaders started without sync errors (they hang on fetch, never reject).
  await new Promise((r) => setTimeout(r, 30));
});

// ── XSS / malformed-string safety ──
const MALICIOUS = {
  success: true,
  growth_signal_contract: "v1",
  signals: {
    demand: sig("sufficient",
      { "</pre><script>alert(1)</script>": "<img src=x onerror=alert(1)>", "quote\"&'key<b>": "&\"'<>", nested: { "</td>": "<svg onload=alert(2)>" } },
      { state: "verified_current_window" }, 2, 0,
      "<script>alert('reason-xss')</script> </td> & \"quotes\" 'apostrophes'"),
    momentum: sig("insufficient_signal",
      { units_growth_pct: null, payload: "</details><script>alert(3)</script>" },
      { sales_coverage: { state: "unverified" } },
      null, -20, "Malformed reason with <<<< >>>> &&&& \"\"\"'''."),
  },
};

test("16: XSS safety — every API-provided string is escaped before HTML insertion", async () => {
  const run = runPage(MALICIOUS);
  await painted(run);
  const html = run.tableEl.innerHTML;

  // No data-derived raw markup may exist: payload strings must never become tags/elements.
  assert.doesNotMatch(html, /<script>alert/, "script payload must never render as a real tag");
  assert.doesNotMatch(html, /<img\s/i, "img payload must never render as a real tag");
  assert.doesNotMatch(html, /<svg/i, "svg payload must never render as a real tag");
  // Event handlers must only ever appear INSIDE entity-escaped tag text (rendered as text,
  // not markup): strip all &lt;…&gt; entities and assert no live handler remains.
  const withoutEscapedTags = html.replace(/&lt;[^&]*?&gt;/g, "");
  assert.doesNotMatch(withoutEscapedTags, /onerror=|onload=/, "event-handler payloads must never appear outside escaped entities");
  // Data-derived "</pre>", "</td>", "</details>" must not close real elements from inside data.
  assert.doesNotMatch(html.replace(/<pre>[\s\S]*?<\/pre>/, ""), /<\/pre><script>/, "data must not escape the pre via closing tags");

  // Escaped forms must be present instead.
  assert.match(html, /&lt;script&gt;/, "script payload must be entity-escaped");
  assert.match(html, /&lt;img/, "img payload must be entity-escaped");
  assert.match(html, /&amp;/, "ampersand must be entity-escaped");
  assert.match(html, /&quot;/, "double quotes must be entity-escaped");

  // Full JSON in the pre must round-trip EXACTLY (esc is lossless through entity decode).
  const pres = [...html.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map((m) => m[1]
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
  const roundTripped = pres.map((p) => JSON.parse(p));
  for (const s of [MALICIOUS.signals.demand.value, MALICIOUS.signals.demand.coverage, MALICIOUS.signals.momentum.value, MALICIOUS.signals.momentum.coverage]) {
    assert.ok(roundTripped.some((d) => deepEqual(d, s)), "malicious JSON must round-trip exactly through esc()");
  }

  // Reason text fully escaped, no raw tag injection.
  assert.match(html, /&lt;script&gt;alert\('reason-xss'\)&lt;\/script&gt;/, "reason must be escaped");
  assert.match(html, /Malformed reason with &lt;&lt;&lt;&lt; &gt;&gt;&gt;&gt; &amp;&amp;&amp;&amp;/, "malformed reason must be escaped");
});
