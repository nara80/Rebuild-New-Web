// P0 Marketing Worker source recovery — reconciliation regression tests.
// Verifies the release candidate built from COMMITTED source preserves:
//   - weekday dispatcher routing (Mon ga4 / Tue etsy / Wed google_ads / Thu gsc / Fri opportunity)
//   - GA4 canonical website property 308922589 + separate Etsy property 533944293
//   - Phase 12 direct-client Google Ads authorization (no login-customer-id header)
//   - single daily dispatcher cron (0 1 * * *) in wrangler.toml
// All imports resolve inside this worktree only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const workerPath = fileURLToPath(new URL("../index.js", import.meta.url));
const workerMod = await import(`${new URL("../index.js", import.meta.url).href}?t=${Date.now()}`);
const { resolveScheduledDispatcherJob, __googleAdsDiagTest } = workerMod;

const THAILAND_OFFSET_MS = 7 * 60 * 60 * 1000;

// Wednesday 2026-10-14 01:00 UTC = 08:00 ICT Wednesday.
function utcMsForThaiWeekday(weekday, hourUtc = 1) {
  // Scan forward from 2026-10-12 (Monday) for the requested Thailand weekday.
  let ms = Date.UTC(2026, 9, 12, hourUtc, 0, 0);
  for (let i = 0; i < 8; i++) {
    const thaiWeekday = new Date(ms + THAILAND_OFFSET_MS).getUTCDay();
    if (thaiWeekday === weekday) return ms;
    ms += 24 * 60 * 60 * 1000;
  }
  throw new Error(`weekday ${weekday} not found`);
}

test("weekday dispatcher: Mon=ga4, Tue=etsy, Wed=google_ads, Thu=gsc, Fri=opportunity, weekend=noop", () => {
  const expected = [
    [1, "ga4"],
    [2, "etsy"],
    [3, "google_ads"],
    [4, "gsc"],
    [5, "opportunity"],
    [6, "noop"],
    [0, "noop"],
  ];
  for (const [weekday, job] of expected) {
    const route = resolveScheduledDispatcherJob(utcMsForThaiWeekday(weekday));
    assert.equal(route.selected_job, job, `weekday ${weekday} must select ${job}`);
    assert.equal(route.is_noop_day, job === "noop");
    assert.equal(route.timezone, "Asia/Bangkok");
  }
  // Wednesday dispatch sanity: business date/timezone derivation stays deterministic.
  const wed = resolveScheduledDispatcherJob(utcMsForThaiWeekday(3));
  assert.equal(wed.business_weekday_name, "Wednesday");
});

test("GA4 property config: canonical website 308922589 + separate Etsy 533944293", async () => {
  const src = readFileSync(workerPath, "utf8");
  assert.match(src, /property_id: "308922589", scope: "website"/);
  assert.match(src, /property_id: "533944293", scope: "etsy"/);
  assert.doesNotMatch(src, /property_id: "366290587"/, "legacy property must not be the active default");
  // Source documents the legacy property as retired/preserved (provenance kept).
  assert.match(src, /366290587/);
  assert.match(src, /Supersedes legacy website property/);
});

test("wrangler.toml: single daily dispatcher cron only; canonical GA4 vars; prod D1 binding", () => {
  const toml = readFileSync(fileURLToPath(new URL("../wrangler.toml", import.meta.url)), "utf8");
  const cronLine = toml.match(/^crons\s*=\s*\[(.*)\]$/m);
  assert.ok(cronLine, "crons entry must exist");
  const crons = cronLine[1].match(/"[^"]+"/g) || [];
  assert.deepEqual(crons, ['"0 1 * * *"'], "exactly the single daily dispatcher cron is configured");
  assert.match(toml, /GA4_PROPERTIES_JSON = "\[\{\\"property_id\\":\\"308922589\\"/);
  assert.match(toml, /GA4_PROPERTY_ID = "308922589"/);
  assert.doesNotMatch(toml, /"0 2 1,15 \* \*"|"0 3 \* \* 1"|"0 4 \* \* 1"|"0 5 \* \* 1"/, "incompatible five-cron set must not return");
  assert.match(toml, /database_id = "854f206a-b240-491c-bb91-7e064736d487"/, "production D1 binding unchanged");
});

test("Phase 12 direct-client authorization: SearchStream request carries no login-customer-id header", async () => {
  const seen = { headers: null, url: null };
  const fakeToken = "test-access-token";
  const env = {
    SALES_SYNC_API_TOKEN: "token",
    GOOGLE_ADS_CUSTOMER_ID: "5242681268",
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: "4572877507", // present but must NOT be sent as a header
    GOOGLE_ADS_CLIENT_ID: "client-id",
    GOOGLE_ADS_CLIENT_SECRET: "secret",
    GOOGLE_ADS_REFRESH_TOKEN: "refresh",
  };
  // fetchGoogleAdsRowsForWindow uses the global fetch — mock it for the duration.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    seen.url = String(url);
    seen.headers = opts?.headers || {};
    return {
      ok: true,
      status: 200,
      headers: new Map([["x-goog-request-id", "req-1"]]),
      text: async () => JSON.stringify([{ results: [] }]),
    };
  };
  try {
    const rows = await __googleAdsDiagTest.fetchGoogleAdsRowsForWindow(env, fakeToken, "2026-10-07", "2026-10-10");
    assert.deepEqual(rows, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.ok(seen.url && seen.url.includes("googleads.googleapis.com"), "SearchStream endpoint must be called");
  assert.ok(seen.url.includes("customers/5242681268/"), "direct-client SearchStream targets the client account");
  assert.equal(seen.headers["login-customer-id"], undefined, "no manager login-customer-id header may be sent");
  assert.equal(seen.headers["Authorization"], `Bearer ${fakeToken}`);
  assert.equal(seen.headers["Content-Type"], "application/json");
});

test("accessibility diagnostic: manager reported inaccessible, client accessible (direct-client basis)", async () => {
  const env = {
    GOOGLE_ADS_CUSTOMER_ID: "5242681268",
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: "4572877507",
  };
  const fakeFetch = async (url, opts) => {
    if (String(url).includes("listAccessibleCustomers")) {
      return {
        ok: true,
        status: 200,
        headers: new Map([["x-goog-request-id", "req-2"]]),
        text: async () => JSON.stringify({ resourceNames: ["customers/5242681268"] }),
      };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: "t" }) };
  };
  const diag = await __googleAdsDiagTest.getGoogleAdsAccessibleCustomersDiagnostic(env, {
    getGoogleAdsAccessToken: async () => "t",
    fetchImpl: fakeFetch,
  });
  assert.equal(diag.ok, true);
  assert.equal(diag.client_directly_accessible, true);
  assert.equal(diag.manager_directly_accessible, false);
  assert.equal(diag.total_directly_accessible_accounts, 1);
});

test("failure isolation: Google Ads API failure returns structured diagnostic, not a thrown crash", async () => {
  const env = { GOOGLE_ADS_CUSTOMER_ID: "5242681268", GOOGLE_ADS_LOGIN_CUSTOMER_ID: "4572877507" };
  const fakeFetch = async (url) => {
    if (String(url).includes("listAccessibleCustomers")) {
      return {
        ok: false,
        status: 403,
        headers: new Map(),
        text: async () => JSON.stringify({ error: { code: 403, message: "The caller does not have permission", status: "PERMISSION_DENIED" } }),
      };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: "t" }) };
  };
  const diag = await __googleAdsDiagTest.getGoogleAdsAccessibleCustomersDiagnostic(env, {
    getGoogleAdsAccessToken: async () => "t",
    fetchImpl: fakeFetch,
  });
  assert.equal(diag.ok, false);
  assert.equal(diag.api_http_status, 403);
  assert.equal(diag.client_directly_accessible, false);
  assert.equal(diag.manager_directly_accessible, false);
  assert.ok(diag.error_message.length > 0 && diag.error_message.length <= 260);
});

test("Phase 14 boundary: opportunity recompute wiring untouched by this patch", () => {
  const src = readFileSync(workerPath, "utf8");
  assert.match(src, /recomputeOpportunityScores/);
  assert.match(src, /opportunity-weekly-recompute/);
  // Friday routing preserved (covered functionally above), weights live in scripts/opportunity-core.mjs — not in the worker.
  assert.doesNotMatch(src, /"momentum":\s*30/, "scoring weights must not move into the worker source");
});

// ── Notion scheduler restore (2026-10-12) ──────────────────────────────────
// The historical 1st/15th main + hourly-drain design needed five cron
// triggers, which the Cloudflare schedules cap rejected. The restore dispatches
// Notion from the single daily cron instead, without touching weekday routing.

// 01:00 UTC trigger → +7h = 08:00 ICT same calendar date.
function utcMsForThaiDate(y, m, d) {
  return Date.UTC(y, m - 1, d, 1, 0, 0);
}

test("notion scheduling flags: main on 1st/15th, drain on Saturday, weekday routing untouched", () => {
  // 2026-10-15 Thursday → main, and weekday collector (gsc) still selected.
  const thu15 = resolveScheduledDispatcherJob(utcMsForThaiDate(2026, 10, 15));
  assert.equal(thu15.business_date, "2026-10-15");
  assert.equal(thu15.selected_job, "gsc", "Thursday collector must stay selected on a main day");
  assert.equal(thu15.notion_main, true);
  assert.equal(thu15.notion_drain, false);

  // 2026-11-01 Sunday → main.
  const sun1 = resolveScheduledDispatcherJob(utcMsForThaiDate(2026, 11, 1));
  assert.equal(sun1.selected_job, "noop");
  assert.equal(sun1.notion_main, true);
  assert.equal(sun1.notion_drain, false);

  // 2026-10-17 Saturday → drain only.
  const sat17 = resolveScheduledDispatcherJob(utcMsForThaiDate(2026, 10, 17));
  assert.equal(sat17.selected_job, "noop");
  assert.equal(sat17.notion_main, false);
  assert.equal(sat17.notion_drain, true);

  // 2026-10-14 Wednesday (Ads verification day) → neither flag; collector only.
  const wed14 = resolveScheduledDispatcherJob(utcMsForThaiDate(2026, 10, 14));
  assert.equal(wed14.selected_job, "google_ads");
  assert.equal(wed14.notion_main, false);
  assert.equal(wed14.notion_drain, false);

  // A plain weekday mid-fortnight: 2026-10-20 Tuesday → neither flag.
  const tue20 = resolveScheduledDispatcherJob(utcMsForThaiDate(2026, 10, 20));
  assert.equal(tue20.selected_job, "etsy");
  assert.equal(tue20.notion_main, false);
  assert.equal(tue20.notion_drain, false);

  // 2026-11-15 Sunday → main; 2026-12-01 Tuesday → main + weekday collector.
  assert.equal(resolveScheduledDispatcherJob(utcMsForThaiDate(2026, 11, 15)).notion_main, true);
  const dec1 = resolveScheduledDispatcherJob(utcMsForThaiDate(2026, 12, 1));
  assert.equal(dec1.selected_job, "etsy");
  assert.equal(dec1.notion_main, true);
});

test("notion scheduling: scheduled() wires main (guarded) + drain triggers; drain guard intact", () => {
  const src = readFileSync(workerPath, "utf8");
  // Main pass uses the scheduled-main trigger and skips when the stream state
  // already shows an exhausted scan on this Thailand date.
  assert.match(src, /executeSync\(env, "scheduled-main", \{\}\)/);
  assert.match(src, /hasExhaustedNotionRunOnThailandDate/);
  assert.match(src, /skip Notion main \(already exhausted/);
  // Drain keeps the historical trigger name whose guard refuses to start a
  // fresh scan (drain only continues a partial pass).
  assert.match(src, /executeSync\(env, "drain", \{\}\)/);
  assert.match(src, /trigger === "drain" && state\.last_status !== "partial"/);
  // Guard queries the stream state, not sync_runs, so a bounded partial pass
  // is never mistaken for a completed backlog.
  assert.match(src, /FROM marketing_sync_state[\s\S]*?last_status = 'success'/);
});

test("notion scheduling: rolling-prev-month cutoff untouched; wrangler.toml still single cron", () => {
  const src = readFileSync(workerPath, "utf8");
  assert.match(src, /SYNC_BEFORE_MODE/, "rolling-prev-month policy must remain configurable and default");
  assert.match(src, /getUTCFullYear\(\), now\.getUTCMonth\(\) - 1, 1/, "cutoff = first day of previous month");
  const toml = readFileSync(fileURLToPath(new URL("../wrangler.toml", import.meta.url)), "utf8");
  const cronLine = toml.match(/^crons\s*=\s*\[(.*)\]$/m);
  assert.deepEqual(cronLine[1].match(/"[^"]+"/g), ['"0 1 * * *"'], "no new cron triggers added");
});
