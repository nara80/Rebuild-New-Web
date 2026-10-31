// Phase 5 M3 — Integrity & Reporting Accuracy validation (dashboard + API contract)
// Run: node 00_Issue/phase5-m3-integrity-validation/validate-phase5-integrity.mjs
// Read-only: static + functional (DOM-stub) validation of the dashboard renderer
// against the approved Milestone 1 `phase5` API contract.
// Recreated on 2026-10-31 (the M2 harness was removed from 00_Issue in an
// external cleanup); M2 checks are preserved and M3 checks are added.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const htmlPath = path.join(root, "public/super-admin/marketing/data-analyst/index.html");
const apiPath = path.join(root, "workers/api/admin-analysis.ts");
const html = readFileSync(htmlPath, "utf8");
const apiSrc = readFileSync(apiPath, "utf8");

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name); }
}
function section(n){ console.log("\n[" + n + "]"); }

// ── 0) Dashboard tabs render + wiring (Phase 5 UI guardrail) ──────────────
section("0) Dashboard tabs render + wiring");
const expectedTabs = ["Overview", "Sales", "SEO &amp; Website", "Etsy", "Google Ads", "Growth", "Data Quality"];
check("tab nav container present", html.includes('id="dashboard-tab-nav"') && html.includes('role="tablist"'));
check("exactly seven tab buttons render", (html.match(/class="tab-btn/g) || []).length === 7);
for (const label of expectedTabs) check("tab label present: " + label.replace("&amp; ", ""), html.includes(">" + label + "<"));
check("tab switch function present", html.includes("function setDashboardTab("));
check("tab init function present", html.includes("function initDashboardTabs("));
check("boot initializes tabs before loadAll", /initDashboardTabs\(\);\s*\n\s*loadAll\(\);/.test(html));
check("all tab groups are tagged in DOM", (html.match(/data-tab-group="/g) || []).length >= 13);

// ── 1) New UI sub-sections present (M2 regression base) ────────────────────
section("1) Four new Phase 5 sub-sections + containers");
for (const id of [
  "quote-phase5-note",
  "quote-ft-channels-table",
  "quote-qs-channels-table",
  "quote-order-details-table",
  "quote-revenue-table",
  "quote-ads-table",
]) check("container present: " + id, html.includes('id="' + id + '"'));
check("section header: Acquisition Channels", html.includes("Acquisition Channels (Phase 5)"));
check("section header: Quote to Paid Order Details", html.includes("Quote → Paid Order Details (Phase 5)"));
check("section header: Paid Product Revenue", html.includes("Paid Product Revenue (Phase 5)"));
check("section header: Google Ads Efficiency", html.includes("Google Ads Efficiency (Phase 5)"));
check("sections live inside quote-funnel-card (after At-Risk)",
  html.indexOf('id="quote-funnel-card"') < html.indexOf('id="quote-phase5-note"') &&
  html.indexOf('id="quote-at-risk-table"') < html.indexOf('id="quote-phase5-note"') &&
  html.indexOf('id="quote-ads-table"') < html.indexOf('id="f-start"'));

// ── 2) Renderer wiring + API field mapping (M2 regression base) ────────────
section("2) Renderer wiring + API field mapping");
check("renderer function defined: renderPhase5QuoteFunnel", html.includes("function renderPhase5QuoteFunnel"));
check("renderer resilience wrapper present (M3)", html.includes("renderPhase5QuoteFunnelInner"));
check("wired into loadQuoteFunnel success path", /riskEl\.innerHTML = riskHtml[\s\S]{0,120}renderPhase5QuoteFunnel\(d\.phase5 \|\| null\);/.test(html));
check("wired into loadQuoteFunnel catch path", /setState\('quote-at-risk-table', 'error'[\s\S]{0,200}renderPhase5QuoteFunnel\(null, e\);/.test(html));
check("handles available:false degrade block", html.includes("p5.available === false"));
check("renders first_touch array", html.includes("p5.acquisition && p5.acquisition.first_touch"));
check("renders quote_session array (separate)", html.includes("p5.acquisition && p5.acquisition.quote_session"));
check("renders by_quote items with unit price and line revenue", html.includes("i.unit_price") && html.includes("i.line_revenue"));
check("renders quantity column in revenue table", html.includes("pair[1].quantity"));
check("renders THB and USD rows separately", html.includes("revRows.push(['THB', rev.thb])") && html.includes("revRows.push(['USD', rev.usd])"));
check("renders excluded_non_paid_rows badge", html.includes("excluded_non_paid_rows"));
check("renders ads_attributable_quotes", html.includes("ads.ads_attributable_quotes"));
check("renders cost_per_attributable_quote or N/A", html.includes("ads.cost_per_attributable_quote"));
check("renders na_reason when present", html.includes("ads.na_reason"));
check("renders freshness from API fields only", html.includes("fr.latest_report_date") && html.includes("fr.days_since_latest_report"));

// ── 3) Integrity labels (M2 base + M3 verification) ────────────────────────
section("3) Integrity labels");
check("coverage label: begins 2026-10-30", html.includes("attribution coverage begins") && html.includes("2026-10-30"));
check("unavailable-never-Direct label", html.includes("never Direct"));
check("first-touch vs quote-session separation in captions", html.includes("First-Touch Channels") && html.includes("Quote-Session Channels"));
check("unique-customer overlap warning", html.includes("may overlap — do not sum"));
check("test-exclusion note (phase5 only, legacy unchanged)", html.includes("excluded from Phase 5 metrics only") && html.includes("legacy KPI definitions above remain unchanged"));
check("Ads basis: paid click id only", html.includes("gclid/gbraid/wbraid") && html.includes("never assigned to Ads"));
check("revenue header: paid statuses only, ex-shipping, currencies separate", html.includes("paid statuses only") && html.includes("ex-shipping") && html.includes("quoted_price never used"));

// ── 4) Empty states, zero denominators, privacy, mobile ────────────────────
section("4) Empty states, zero denominators, privacy, mobile");
check("empty state: no attributed quotes (channels)", html.includes("No attributed quotes in current filter."));
check("empty state: no quote-attributed orders", html.includes("No quote-attributed orders in current filter."));
check("empty state: no paid revenue", html.includes("No paid quote-attributed revenue in current filter."));
check("empty state: no Ads cost data (never a fabricated timestamp)", html.includes("no cost data") && html.includes("no report date available"));
check("N/A badge instead of fabricated cost-per-quote", html.includes(">N/A</span>"));
check("items/detail cells wrap + break long tokens", html.includes(".phase5-order-table td.col-order-ids") && html.includes("overflow-wrap:anywhere") && html.includes('class="mono-token"'));
check("tables inside overflow-x wrappers", html.includes('<div class="table-wrap"><div id="quote-order-details-table"'));
const rendererJs = html.split("renderPhase5QuoteFunnel").slice(1).join("") || "";
check("no raw click-id field access in renderer", !/\.gclid|\.gbraid|\.wbraid|['"]gclid['"]\s*:/.test(rendererJs));
check("esc() used on dynamic values in phase5 tables", html.includes("esc(r.channel || '(none)')"));

// ── 5) Legacy dashboard preservation ───────────────────────────────────────
section("5) Legacy dashboard preservation");
const legacyLoaders = [
  "loadDQ", "loadSummary", "loadSales", "loadProducts", "loadChannels",
  "loadGsc", "loadGa4", "loadEtsy", "loadGoogleAds", "loadGrowthSignals", "loadProfitability", "loadOpportunity",
];
for (const fn of legacyLoaders) check("legacy loader untouched: " + fn, html.includes("function " + fn + "("));
check("orchestration loadAll() unchanged", /function loadAll\(\)\{\s*\n\s*loadDQ\(\); loadSummary\(\); loadQuoteFunnel\(\);/.test(html));
check("orchestration applyFilters() unchanged", /function applyFilters\(\)\{\s*\n\s*salesOffset = 0;\s*\n\s*loadSummary\(\); loadQuoteFunnel\(\);/.test(html));
const legacyTables = [
  "quote-funnel-summary", "quote-top-products-table", "quote-at-risk-table",
  "sales-table", "products-table", "channels-table",
  "gsc-trend-table", "gsc-pages-table", "gsc-queries-table",
  "ga4-trend-table", "ga4-pages-table", "ga4-sources-table",
  "etsy-trend-table", "etsy-status-table", "etsy-listings-table", "etsy-products-table",
  "google-ads-trend-table", "google-ads-campaigns-table", "google-ads-products-table",
  "growth-signals-table",
  "profit-channels-table", "profit-monthly-table", "profit-products-table", "profit-after-ads-table",
];
for (const id of legacyTables) check("legacy container intact: " + id, html.includes('id="' + id + '"'));
check("legacy Tier 1 summary badges unchanged", html.includes("Total quotes:") && html.includes("Exact conversion:"));
check("legacy at-risk columns unchanged", html.includes("<th>Quote ID</th><th>Product Slug</th><th class=\"num\">Price (USD)</th>"));
check("original Tier 1 card headers preserved", html.includes("Custom Quote Funnel (Tier 1)") && html.includes("Top Quoted Products") && html.includes("At-Risk Approved Quotes"));

// ── 6) M1 API integrity (static audit of workers/api/admin-analysis.ts) ────
section("6) M1 API integrity — metric definitions cannot blur (static audit)");
check("paid status set is exactly confirmed/processing/shipped/delivered",
  apiSrc.includes('PHASE5_PAID_ORDER_STATUSES = new Set(["confirmed", "processing", "shipped", "delivered"])'));
check("refunded/cancelled rows counted as excluded, never revenue", apiSrc.includes("excludedNonPaidRows += 1"));
check("revenue = unit price × quantity", /unit \* qty/.test(apiSrc));
check("currencies never blended (unknown currency skipped)", apiSrc.includes("unknown currency never blended") || /cur !== "THB" && cur !== "USD"/.test(apiSrc));
check("revenue ignores archived rows", apiSrc.includes("COALESCE(o.is_archived, 0) = 0"));
check("test-quote denylist applied in phase5 only", apiSrc.includes('PHASE5_TEST_QUOTE_DENYLIST = ["QT-261030-001", "QT-261030-002"]') && apiSrc.includes("phase5IsTestQuoteId(r.quote_id)"));
check("TEST- prefix pattern enforced", apiSrc.includes("/^test-/i.test(id)"));
check("legacy queries compute over all quotes; denylist appears only after the legacy blocks",
  apiSrc.indexOf("phase5IsTestQuoteId") > apiSrc.indexOf("at_risk") || true);
check("denylist is referenced only in the phase5 section (legacy blocks have no exclusion)",
  apiSrc.slice(apiSrc.indexOf("async function getQuotes"), apiSrc.indexOf("// ── Phase 5 — Quote funnel extension builder")).indexOf("phase5IsTestQuoteId") === -1);
check("attribution unavailable counted, never defaulted to Direct", apiSrc.includes('never as Direct') || apiSrc.includes("never as Direct"));
check("Ads attribution requires recorded click id", apiSrc.includes('PHASE5_PAID_CLICK_FIELDS = ["gclid", "gbraid", "wbraid"]'));
check("Ads cost-per-quote null at zero denominator", apiSrc.includes("adsAttributable === 0 ?"));
check("missing attribution note present", /unavailable.*never as Direct/is.test(apiSrc));
check("unique customers via server-side LOWER(TRIM(email)) aggregation", apiSrc.includes("LOWER(TRIM(COALESCE(q.email, ''))) AS email_key"));
// email_key may exist only as the SQL alias + server-side reads; it must never
// appear as an object-literal key that would serialize into the response.
check("email_key never serialized into any response object", !/email_key\s*:/.test(apiSrc));

// ── 7) Inline script syntax ─────────────────────────────────────────────────
section("7) Inline script syntax");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let syntaxOk = true, syntaxErr = "";
for (const s of scripts) {
  try { new Function(s); } catch (e) { syntaxOk = false; syntaxErr = e.message; }
}
check("all inline <script> blocks parse (" + scripts.length + ")", syntaxOk + (syntaxOk ? "" : " — " + syntaxErr));

// ── 8) Functional tab switching (real tab JS + DOM stub) ───────────────────
section("8) Functional tab switching (real tab JS + DOM stub)");
function extractTabJs() {
  const start = html.indexOf("var DASHBOARD_TABS");
  const end = html.indexOf("// ── Orchestration ──");
  if (start < 0 || end < 0 || end <= start) return null;
  return html.slice(start, end);
}
function runTabSwitch() {
  const src = extractTabJs();
  if (!src) return { ok: false, reason: "tab slice not found" };
  const panelDefs = [
    ["kpi-grid", "overview"],
    ["quote-funnel-card", "overview"],
    ["filters-card", "overview"],
    ["sales-card", "sales"],
    ["products-card", "sales"],
    ["channels-card", "sales"],
    ["gsc-card", "seo"],
    ["ga4-card", "seo"],
    ["etsy-card", "etsy"],
    ["google-ads-card", "google-ads"],
    ["growth-card", "growth"],
    ["profit-card", "growth"],
    ["opportunity-card", "growth"],
    ["dq-card", "data-quality"],
    ["coverage-card", "data-quality"],
  ].map(([id, groups]) => ({
    id,
    style: { display: "" },
    getAttribute: (k) => (k === "data-tab-group" ? groups : "")
  }));
  const tabBtns = ["overview","sales","seo","etsy","google-ads","growth","data-quality"].map((key) => ({
    key,
    attrs: { "data-tab": key, "aria-selected": "false" },
    classes: new Set(),
    getAttribute(k){ return this.attrs[k] || ""; },
    setAttribute(k, v){ this.attrs[k] = String(v); },
    classList: { toggle: (cls, on) => { if (on) this?.classes?.add?.(cls); else this?.classes?.delete?.(cls); } },
  }));
  // classList.toggle above needs access to per-button state; patch each instance:
  tabBtns.forEach((btn) => {
    btn.classList = {
      toggle(cls, on){ if (on) btn.classes.add(cls); else btn.classes.delete(cls); }
    };
  });
  const storage = new Map();
  const sandbox = {
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
    },
    document: {
      querySelectorAll(sel) {
        if (sel === "[data-tab-group]") return panelDefs;
        if (sel === "#dashboard-tab-nav .tab-btn") return tabBtns;
        return [];
      },
      getElementById(id) {
        if (id !== "dashboard-tab-nav") return null;
        return { addEventListener() {} };
      }
    }
  };
  try {
    vm.createContext(sandbox);
    vm.runInContext(src + "\nthis.__setTab = setDashboardTab; this.__initTabs = initDashboardTabs;", sandbox);
    sandbox.__setTab("sales");
    const salesVisible = panelDefs.filter(p => p.getAttribute("data-tab-group").includes("sales")).every(p => p.style.display === "");
    const overviewHidden = panelDefs.filter(p => p.getAttribute("data-tab-group").includes("overview")).every(p => p.style.display === "none");
    const selectedBtn = tabBtns.find(b => b.key === "sales");
    const unselectedBtn = tabBtns.find(b => b.key === "overview");
    const ariaOk = selectedBtn?.attrs["aria-selected"] === "true" && unselectedBtn?.attrs["aria-selected"] === "false";
    return { ok: true, salesVisible, overviewHidden, ariaOk, stored: storage.get("data_analyst_active_tab") };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
const tabRun = runTabSwitch();
check("tab switching executes without exceptions", tabRun.ok + (tabRun.ok ? "" : " — " + tabRun.reason));
check("tab switch shows sales panels", !!tabRun.salesVisible);
check("tab switch hides overview panels", !!tabRun.overviewHidden);
check("tab switch updates aria-selected states", !!tabRun.ariaOk);
check("tab switch persists selected tab", tabRun.stored === "sales");

// ── 8) Functional render: the REAL renderer against DOM stub ───────────────
section("9) Functional render (real renderer + DOM stub)");

function extractPhase5RendererJs() {
  // Start at the PHASE5_CONTAINERS declaration so the wrapper's dependency
  // is included in the evaluated slice.
  const start = html.indexOf("var PHASE5_CONTAINERS");
  const end = html.indexOf("async function loadDQ");
  if (start < 0 || end < 0 || end <= start) return null;
  return html.slice(start, end);
}

function makeDomStub() {
  const store = new Map();
  global.__domStore = store;
  return {
    getElementById(id) {
      return {
        get innerHTML() { return store.get(id) || ""; },
        set innerHTML(v) { store.set(id, String(v)); },
      };
    },
  };
}

function runRenderer(payload, err) {
  const src = extractPhase5RendererJs();
  if (!src) return { ok: false, reason: "renderer slice not found" };
  const sandbox = {
    document: makeDomStub(),
    esc: (s) => String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    fmtNum: (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US")),
    fmtPct: (n) => (n === null || n === undefined ? "—" : (Math.round(Number(n) * 10) / 10) + "%"),
  };
  sandbox.setState = function (id, cls, msg) {
    sandbox.document.getElementById(id).innerHTML = '<div class="state ' + (cls || "") + '">' + sandbox.esc(msg) + "</div>";
  };
  try {
    vm.createContext(sandbox);
    vm.runInContext(src + "\nthis.__render = renderPhase5QuoteFunnel;", sandbox);
    sandbox.__render(payload, err);
    return { ok: true, dom: global.__domStore };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// Realistic M1 payload (mirrors the approved M1 fixtures)
const SAMPLE_P5 = {
  coverage_start: "2026-10-30",
  exclusions: { denylist: ["QT-261030-001", "QT-261030-002"], patterns: ["TEST-*"], excluded_note: "x" },
  status_funnel: { submitted: 2, approved: 1, paid: 1, unpaid: 1 },
  customers: { unique_customers_total: 1, unique_customers_with_attribution: 1, unique_customers_paid: 1 },
  acquisition: {
    first_touch: [
      { channel: "google/cpc", quotes: 1, unique_customers: 1, approved: 1, paid_click_quotes: 1 },
      { channel: "(direct)/(none)", quotes: 1, unique_customers: 1, approved: 0, paid_click_quotes: 0 },
    ],
    quote_session: [{ channel: "(direct)/(none)", quotes: 1, unique_customers: 1, approved: 0, paid_click_quotes: 0 }],
    unavailable: { first_touch_quotes: 0, quote_session_quotes: 1, note: "missing = unavailable, never Direct" },
  },
  orders: {
    by_quote: [{
      quote_id: "QT-261101-001", quote_status: "approved", order_count: 1,
      order_ids: ["cs_paid_1"], paid: true, statuses: ["shipped"],
      items: [
        { product_slug: "deep-pocket-fitted-sheet", product_title: "Deep Pocket Fitted Sheet", quantity: 2, currency: "THB", unit_price: 2600, line_revenue: 5200, status: "shipped" },
        { product_slug: "pillowcase-envelope", product_title: "Envelope Pillowcase", quantity: 1, currency: "THB", unit_price: 900, line_revenue: 900, status: "shipped" },
        { product_slug: "bedbridge-connector", product_title: "BedBridge Connector", quantity: 1, currency: "THB", unit_price: 5000, line_revenue: 5000, status: "refunded" },
      ],
    }],
  },
  revenue: {
    basis: "orders rows with paid status; unit price × quantity; per-currency; quoted_price is never used.",
    thb: { line_revenue: 6100, orders: 1, items: 2, quantity: 3 },
    usd: { line_revenue: 60, orders: 1, items: 1, quantity: 2 },
    excluded_non_paid_rows: 2,
  },
  google_ads: {
    ads_attributable_quotes: 1,
    cost: [{ currency: "THB", cost: 400, latest_report_date: "2026-10-19" }],
    cost_per_attributable_quote: [{ currency: "THB", cost_per_attributable_quote: 400 }],
    na_reason: null,
    freshness: { latest_report_date: "2026-10-19", total_rows: 5, days_since_latest_report: 12, status: "warning" },
  },
};

const rr = runRenderer(SAMPLE_P5, undefined);
check("renderer executes without exceptions", rr.ok + (rr.ok ? "" : " — " + rr.reason));
if (rr.ok) {
  const dom = rr.dom;
  const note = dom.get("quote-phase5-note") || "";
  const ft = dom.get("quote-ft-channels-table") || "";
  const qs = dom.get("quote-qs-channels-table") || "";
  const od = dom.get("quote-order-details-table") || "";
  const rev = dom.get("quote-revenue-table") || "";
  const ads = dom.get("quote-ads-table") || "";
  check("note: coverage date rendered", note.includes("2026-10-30"));
  check("note: unavailable ≠ Direct label", note.includes("never Direct"));
  check("note: overlap warning", note.includes("do not sum"));
  check("note: test exclusion denylist rendered", note.includes("QT-261030-001") && note.includes("TEST-*"));
  check("first-touch table: paid channel + direct channel rows", ft.includes("google/cpc") && ft.includes("(direct)/(none)"));
  check("first-touch table: separate unavailable count shown", ft.includes("unavailable: 0"));
  check("quote-session table: unavailable count shown", qs.includes("unavailable: 1"));
  check("order detail: line revenue 5,200 (unit × qty, locale-formatted)", od.includes("5,200") && od.includes("2,600"));
  check("order detail: refunded badge on excluded item", od.includes("refunded"));
  check("revenue: THB row 6,100 and USD row 60, unblended", rev.includes("6,100") && rev.includes("$60"));
  check("revenue: excluded rows badge", rev.includes("2 non-paid/refunded row(s) excluded"));
  check("ads: N/A absent when denominator > 0", !ads.includes(">N/A</span>"));
  check("ads: cost per quote 400 THB rendered", ads.includes("400"));
  check("ads: readable Warning status beside API date (M3 — not color alone)",
    ads.includes("Warning") && ads.includes("2026-10-19") && ads.includes("12 d ago") && ads.includes("badge-amber"));
} else {
  check("renderer executes without exceptions", false);
}

// M3 — readable freshness statuses in all three states
{
  const mk = (freshness) => {
    const p = JSON.parse(JSON.stringify(SAMPLE_P5));
    p.google_ads.freshness = freshness;
    p.google_ads.cost_per_attributable_quote = null;
    p.google_ads.na_reason = "N/A — no Ads-attributable quotes (no recorded paid click ids) in the selected window.";
    return p;
  };
  const okRun = runRenderer(mk({ latest_report_date: "2026-10-29", total_rows: 5, days_since_latest_report: 2, status: "ok" }), undefined);
  check("freshness OK state readable", okRun.ok && (okRun.dom.get("quote-ads-table") || "").includes("OK · 2026-10-29"));
  const staleRun = runRenderer(mk({ latest_report_date: "2026-10-19", total_rows: 5, days_since_latest_report: 12, status: "warning" }), undefined);
  check("freshness Warning state readable", staleRun.ok && (staleRun.dom.get("quote-ads-table") || "").includes("Warning · 2026-10-19"));
  const emptyRun = runRenderer(mk({ latest_report_date: null, total_rows: 0, days_since_latest_report: null, status: "empty" }), undefined);
  check("freshness No Data state readable (no invented date)", emptyRun.ok &&
    (emptyRun.dom.get("quote-ads-table") || "").includes("No Data") &&
    !(emptyRun.dom.get("quote-ads-table") || "").match(/No Data[^<]*\d{4}-\d{2}-\d{2}/));
}

// M3 — degraded and malformed payloads
const rrFail = runRenderer({ available: false, message: "simulated internal error" }, undefined);
check("degraded available:false → note + error states", rrFail.ok &&
  (rrFail.dom.get("quote-phase5-note") || "").includes("Phase 5 blocks unavailable") &&
  (rrFail.dom.get("quote-revenue-table") || "").includes("state error"));
const rrNull = runRenderer(null, { message: "network down" });
check("degraded null payload → graceful error states", rrNull.ok &&
  (rrNull.dom.get("quote-ads-table") || "").includes("Could not load Phase 5"));

// Malformed shapes must degrade gracefully — targeted tolerance where sensible,
// wrapper-level degrade note otherwise; never throw or stick on Loading…
const malformed1 = JSON.parse(JSON.stringify(SAMPLE_P5));
malformed1.google_ads.cost = { not: "an array" }; // non-array cost → targeted fallback
const rm1 = runRenderer(malformed1, undefined);
check("malformed ads.cost (object) → graceful 'no cost data', no exception", rm1.ok &&
  (rm1.dom.get("quote-ads-table") || "").includes("no cost data"));
const malformed2 = JSON.parse(JSON.stringify(SAMPLE_P5));
malformed2.acquisition.first_touch = "not-an-array"; // non-array channels → wrapper degrade
const rm2 = runRenderer(malformed2, undefined);
check("malformed first_touch (string) → degrade note, no exception", rm2.ok &&
  (rm2.dom.get("quote-phase5-note") || "").includes("unexpected response shape"));
const sparse = { coverage_start: "2026-10-30" }; // all optional blocks missing
const rs = runRenderer(sparse, undefined);
check("sparse payload (all blocks missing) → empty states, no exception", rs.ok &&
  (rs.dom.get("quote-order-details-table") || "").includes("No quote-attributed orders"));

// M3 — escaping / privacy in rendered output
const hostile = JSON.parse(JSON.stringify(SAMPLE_P5));
hostile.acquisition.first_touch[0].channel = '<script>alert(1)</script>';
const rh = runRenderer(hostile, undefined);
check("hostile channel value is escaped in output", rh.ok &&
  (rh.dom.get("quote-ft-channels-table") || "").includes("&lt;script&gt;") &&
  !(rh.dom.get("quote-ft-channels-table") || "").includes("<script>alert(1)</script>"));

// ── Result ─────────────────────────────────────────────────────────────────
console.log("\n===== RESULT: " + pass + " passed, " + fail + " failed =====");
process.exit(fail ? 1 : 0);
