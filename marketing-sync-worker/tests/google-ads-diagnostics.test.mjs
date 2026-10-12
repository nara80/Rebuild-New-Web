import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

// Self-contained RC: import the committed worker source directly (no esbuild).
const workerPath = fileURLToPath(new URL("../index.js", import.meta.url));
const workerMod = await import(`${new URL("../index.js", import.meta.url).href}?t=${Date.now()}`);
const { __googleAdsDiagTest, resolveScheduledDispatcherJob } = workerMod;
const worker = workerMod.default;
const fixturePath = fileURLToPath(new URL("./fixtures/google-ads-error-fixtures.json", import.meta.url));
const fixtures = JSON.parse(readFileSync(fixturePath, "utf8"));

function makeEnv() {
  return {
    DB: {},
    SALES_SYNC_API_TOKEN: "token",
    GOOGLE_ADS_CUSTOMER_ID: "5242681268",
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: "4572877507",
    GOOGLE_ADS_CLIENT_ID: "client-id.apps.googleusercontent.com",
    GOOGLE_ADS_CLIENT_SECRET: "secret",
    GOOGLE_ADS_REFRESH_TOKEN: "refresh",
    GOOGLE_ADS_UPSERT_CHUNK_SIZE: "1000",
  };
}

test("successful collector execution records one collector run and preserves ingestion totals", async () => {
  const env = makeEnv();
  const calls = { start: 0, finish: 0, chunks: 0 };
  let finishPayload = null;

  const out = await __googleAdsDiagTest.executeGoogleAdsSync(env, "manual", {}, {
    acquireGoogleAdsLock: async () => true,
    releaseGoogleAdsLock: async () => {},
    startGoogleAdsCollectorRun: async () => {
      calls.start += 1;
      return 101;
    },
    finishGoogleAdsCollectorRun: async (_db, _id, data) => {
      calls.finish += 1;
      finishPayload = data;
    },
    getGoogleAdsAccessToken: async () => "access-token",
    fetchGoogleAdsRowsForWindow: async () => [{ id: 1 }, { id: 2 }],
    chunkRows: () => [[{ id: 1 }, { id: 2 }]],
    postGoogleAdsRowsChunk: async () => {
      calls.chunks += 1;
      return { totals: { received: 2, created: 1, updated: 1, unchanged: 0, rejected: 0 } };
    },
  });

  assert.equal(out.ok, true);
  assert.equal(calls.start, 1);
  assert.equal(calls.finish, 1);
  assert.equal(calls.chunks, 1);
  assert.equal(finishPayload.status, "success");
  assert.equal(finishPayload.records_received, 2);
  assert.equal(finishPayload.records_created, 1);
  assert.equal(finishPayload.records_updated, 1);
});

test("google ads 403 path stores structured diagnostics and does not call ingestion", async () => {
  const env = makeEnv();
  let finishPayload = null;
  let postCalls = 0;
  const resLike = {
    status: 403,
    headers: { get: (k) => (k.toLowerCase() === "request-id" ? "req-123" : null) },
  };
  const body = {
    error: {
      message: "The caller does not have permission",
      details: [
        {
          errors: [{ errorCode: { authorizationError: "CUSTOMER_NOT_ENABLED" } }],
        },
      ],
    },
  };
  const diag = __googleAdsDiagTest.extractGoogleAdsErrorDetails(resLike, body, JSON.stringify(body));
  const err = new Error("Google Ads searchStream failed (403): The caller does not have permission");
  err.googleAdsDiag = diag;

  const out = await __googleAdsDiagTest.executeGoogleAdsSync(env, "manual", {}, {
    acquireGoogleAdsLock: async () => true,
    releaseGoogleAdsLock: async () => {},
    startGoogleAdsCollectorRun: async () => 202,
    finishGoogleAdsCollectorRun: async (_db, _id, data) => {
      finishPayload = data;
    },
    getGoogleAdsAccessToken: async () => "access-token",
    fetchGoogleAdsRowsForWindow: async () => {
      throw err;
    },
    postGoogleAdsRowsChunk: async () => {
      postCalls += 1;
      return { totals: { received: 0, created: 0, updated: 0, unchanged: 0, rejected: 0 } };
    },
  });

  assert.equal(out.ok, false);
  assert.equal(postCalls, 0);
  assert.equal(out.diagnostic.http_status, 403);
  assert.equal(out.diagnostic.error_subtype, "authorizationError.CUSTOMER_NOT_ENABLED");
  assert.equal(out.diagnostic.request_id, "req-123");
  assert.equal(finishPayload.status, "failed");
  const summary = String(finishPayload.error_message || "");
  assert.match(summary, /"http_status":403/);
  assert.match(summary, /authorizationError\.CUSTOMER_NOT_ENABLED/);
  assert.doesNotMatch(summary, /access-token/i);
});

test("extracts subtype from object-root envelope fixture", () => {
  const fx = fixtures.object_root_with_subtype;
  const resLike = {
    status: 403,
    headers: { get: (k) => (k.toLowerCase() === "request-id" ? fx.header_request_id : null) },
  };
  const diag = __googleAdsDiagTest.extractGoogleAdsErrorDetails(resLike, fx.body, JSON.stringify(fx.body));
  assert.equal(diag.error_subtype, fx.expected_subtype);
  assert.equal(diag.request_id, fx.header_request_id);
  assert.match(diag.message, new RegExp(fx.expected_message_fragment));
});

test("extracts subtype from array-wrapped envelope fixture", () => {
  const fx = fixtures.array_wrapped_with_subtype;
  const resLike = {
    status: 403,
    headers: { get: (k) => (k.toLowerCase() === "request-id" ? fx.header_request_id : null) },
  };
  const diag = __googleAdsDiagTest.extractGoogleAdsErrorDetails(resLike, fx.body, JSON.stringify(fx.body));
  assert.equal(diag.error_subtype, fx.expected_subtype);
  assert.equal(diag.request_id, fx.header_request_id);
  assert.match(diag.message, new RegExp(fx.expected_message_fragment));
});

test("generic permission denied without subtype stays null", () => {
  const fx = fixtures.generic_permission_denied_no_subtype;
  const resLike = {
    status: 403,
    headers: { get: () => null },
  };
  const diag = __googleAdsDiagTest.extractGoogleAdsErrorDetails(resLike, fx.body, JSON.stringify(fx.body));
  assert.equal(diag.error_subtype, fx.expected_subtype);
  assert.equal(diag.request_id, null);
  assert.match(diag.message, new RegExp(fx.expected_message_fragment));
});

test("missing request id remains null when absent from headers/body", () => {
  const fx = fixtures.missing_request_id;
  const resLike = {
    status: 403,
    headers: { get: () => null },
  };
  const diag = __googleAdsDiagTest.extractGoogleAdsErrorDetails(resLike, fx.body, JSON.stringify(fx.body));
  assert.equal(diag.error_subtype, fx.expected_subtype);
  assert.equal(diag.request_id, fx.expected_request_id);
});

test("multiple nested details returns first available subtype across details", () => {
  const fx = fixtures.multiple_nested_details;
  const resLike = {
    status: 403,
    headers: { get: () => null },
  };
  const diag = __googleAdsDiagTest.extractGoogleAdsErrorDetails(resLike, fx.body, JSON.stringify(fx.body));
  assert.equal(diag.error_subtype, fx.expected_subtype);
  assert.match(diag.message, new RegExp(fx.expected_message_fragment));
});

test("oauth refresh failure is captured before ingestion with one collector run record", async () => {
  const env = makeEnv();
  let startCount = 0;
  let finishCount = 0;
  let finishPayload = null;

  const out = await __googleAdsDiagTest.executeGoogleAdsSync(env, "manual", {}, {
    acquireGoogleAdsLock: async () => true,
    releaseGoogleAdsLock: async () => {},
    startGoogleAdsCollectorRun: async () => {
      startCount += 1;
      return 303;
    },
    finishGoogleAdsCollectorRun: async (_db, _id, data) => {
      finishCount += 1;
      finishPayload = data;
    },
    getGoogleAdsAccessToken: async () => {
      throw new Error("Google Ads OAuth refresh failed (401): access_token=abc refresh_token=xyz");
    },
  });

  assert.equal(out.ok, false);
  assert.equal(startCount, 1);
  assert.equal(finishCount, 1);
  assert.equal(finishPayload.status, "failed");
  assert.doesNotMatch(String(out.reason), /access_token=abc/);
  assert.doesNotMatch(String(finishPayload.error_message), /refresh_token=xyz/);
});

test("partial ingestion failure keeps first-chunk totals and marks collector run partial", async () => {
  const env = makeEnv();
  let finishPayload = null;
  let chunkIndex = 0;

  const out = await __googleAdsDiagTest.executeGoogleAdsSync(env, "manual", {}, {
    acquireGoogleAdsLock: async () => true,
    releaseGoogleAdsLock: async () => {},
    startGoogleAdsCollectorRun: async () => 404,
    finishGoogleAdsCollectorRun: async (_db, _id, data) => {
      finishPayload = data;
    },
    getGoogleAdsAccessToken: async () => "access-token",
    fetchGoogleAdsRowsForWindow: async () => [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
    chunkRows: () => [[{ id: 1 }, { id: 2 }], [{ id: 3 }, { id: 4 }]],
    postGoogleAdsRowsChunk: async () => {
      chunkIndex += 1;
      if (chunkIndex === 1) {
        return { totals: { received: 2, created: 1, updated: 1, unchanged: 0, rejected: 0 } };
      }
      throw new Error("Google Ads upsert failed (500) downstream");
    },
  });

  assert.equal(out.ok, false);
  assert.equal(finishPayload.status, "partial");
  assert.equal(finishPayload.records_created, 1);
  assert.equal(finishPayload.records_updated, 1);
  assert.equal(finishPayload.records_received, 4);
});

test("locked collector run prevents duplicate collector run record creation", async () => {
  const env = makeEnv();
  let startCount = 0;
  let finishCount = 0;

  const out = await __googleAdsDiagTest.executeGoogleAdsSync(env, "manual", {}, {
    acquireGoogleAdsLock: async () => false,
    releaseGoogleAdsLock: async () => {},
    startGoogleAdsCollectorRun: async () => {
      startCount += 1;
      return 999;
    },
    finishGoogleAdsCollectorRun: async () => {
      finishCount += 1;
    },
  });

  assert.equal(out.ok, true);
  assert.equal(out.skipped, "locked");
  assert.equal(startCount, 0);
  assert.equal(finishCount, 0);
});

test("diagnostic helpers sanitize sensitive tokens", () => {
  const msg = __googleAdsDiagTest.sanitizeGoogleAdsMessage(
    "Authorization: Bearer aaa.bbb.ccc access_token=abc refresh_token=xyz client_secret=qwe",
    280
  );
  assert.doesNotMatch(msg, /aaa\.bbb\.ccc/);
  assert.doesNotMatch(msg, /access_token=abc/);
  assert.doesNotMatch(msg, /refresh_token=xyz/);
  assert.doesNotMatch(msg, /client_secret=qwe/);
});

test("collector source naming avoids freshness contamination by google-ads-% predicate", () => {
  assert.equal(/^google-ads-/.test(__googleAdsDiagTest.GOOGLE_ADS_COLLECTOR_SYNC_SOURCE), false);
  assert.equal(/^google-ads-/.test(__googleAdsDiagTest.GOOGLE_ADS_SYNC_SOURCE), true);
});

test("status split separates collector and ingestion runs", () => {
  const rows = [
    { source: __googleAdsDiagTest.GOOGLE_ADS_COLLECTOR_SYNC_SOURCE, id: 1 },
    { source: __googleAdsDiagTest.GOOGLE_ADS_SYNC_SOURCE, id: 2 },
    { source: "google-ads-worker-cron", id: 3 },
  ];
  const out = __googleAdsDiagTest.splitGoogleAdsRunRows(rows);
  assert.equal(out.recent_runs.length, 3);
  assert.equal(out.recent_collector_runs.length, 1);
  assert.equal(out.recent_ingestion_runs.length, 2);
});

test("cron weekday dispatcher keeps existing daily architecture behavior", () => {
  const mon = resolveScheduledDispatcherJob(Date.parse("2026-10-05T01:00:00.000Z"));
  const tue = resolveScheduledDispatcherJob(Date.parse("2026-10-06T01:00:00.000Z"));
  const wed = resolveScheduledDispatcherJob(Date.parse("2026-10-07T01:00:00.000Z"));
  const thu = resolveScheduledDispatcherJob(Date.parse("2026-10-08T01:00:00.000Z"));
  const fri = resolveScheduledDispatcherJob(Date.parse("2026-10-09T01:00:00.000Z"));
  const sat = resolveScheduledDispatcherJob(Date.parse("2026-10-10T01:00:00.000Z"));
  const sun = resolveScheduledDispatcherJob(Date.parse("2026-10-11T01:00:00.000Z"));
  assert.equal(mon.selected_job, "ga4");
  assert.equal(tue.selected_job, "etsy");
  assert.equal(wed.selected_job, "google_ads");
  assert.equal(thu.selected_job, "gsc");
  assert.equal(fri.selected_job, "opportunity");
  assert.equal(sat.selected_job, "noop");
  assert.equal(sun.selected_job, "noop");
});

test("accessible-customers diagnostic marks manager and client present when both are directly accessible", async () => {
  const env = makeEnv();
  const out = await __googleAdsDiagTest.getGoogleAdsAccessibleCustomersDiagnostic(env, {
    getGoogleAdsAccessToken: async () => "access-token",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          resourceNames: ["customers/4572877507", "customers/5242681268", "customers/1234567890"],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json", "request-id": "rid-1" },
        }
      ),
  });
  assert.equal(out.ok, true);
  assert.equal(out.api_http_status, 200);
  assert.equal(out.request_id, "rid-1");
  assert.equal(out.total_directly_accessible_accounts, 3);
  assert.equal(out.manager_directly_accessible, true);
  assert.equal(out.client_directly_accessible, true);
});

test("accessible-customers diagnostic shows manager absent", async () => {
  const env = makeEnv();
  const out = await __googleAdsDiagTest.getGoogleAdsAccessibleCustomersDiagnostic(env, {
    getGoogleAdsAccessToken: async () => "access-token",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          resourceNames: ["customers/5242681268"],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      ),
  });
  assert.equal(out.ok, true);
  assert.equal(out.total_directly_accessible_accounts, 1);
  assert.equal(out.manager_directly_accessible, false);
  assert.equal(out.client_directly_accessible, true);
});

test("accessible-customers diagnostic keeps client false when manager true but client not direct", async () => {
  const env = makeEnv();
  const out = await __googleAdsDiagTest.getGoogleAdsAccessibleCustomersDiagnostic(env, {
    getGoogleAdsAccessToken: async () => "access-token",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          resourceNames: ["customers/4572877507"],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      ),
  });
  assert.equal(out.ok, true);
  assert.equal(out.total_directly_accessible_accounts, 1);
  assert.equal(out.manager_directly_accessible, true);
  assert.equal(out.client_directly_accessible, false);
});

test("accessible-customers diagnostic handles empty result", async () => {
  const env = makeEnv();
  const out = await __googleAdsDiagTest.getGoogleAdsAccessibleCustomersDiagnostic(env, {
    getGoogleAdsAccessToken: async () => "access-token",
    fetchImpl: async () => new Response(JSON.stringify({ resourceNames: [] }), { status: 200 }),
  });
  assert.equal(out.ok, true);
  assert.equal(out.total_directly_accessible_accounts, 0);
  assert.equal(out.manager_directly_accessible, false);
  assert.equal(out.client_directly_accessible, false);
});

test("accessible-customers diagnostic returns sanitized subtype/message on api 403", async () => {
  const env = makeEnv();
  const body = {
    error: {
      message: "The caller does not have permission",
      details: [{ errors: [{ errorCode: { authorizationError: "USER_PERMISSION_DENIED" } }] }],
    },
  };
  const out = await __googleAdsDiagTest.getGoogleAdsAccessibleCustomersDiagnostic(env, {
    getGoogleAdsAccessToken: async () => "access-token",
    fetchImpl: async () =>
      new Response(JSON.stringify(body), {
        status: 403,
        headers: { "content-type": "application/json", "request-id": "rid-403" },
      }),
  });
  assert.equal(out.ok, false);
  assert.equal(out.api_http_status, 403);
  assert.equal(out.request_id, "rid-403");
  assert.equal(out.error_subtype, "authorizationError.USER_PERMISSION_DENIED");
  assert.match(String(out.error_message), /does not have permission/i);
});

test("accessible-customers diagnostic sanitizes token refresh failure", async () => {
  const env = makeEnv();
  const out = await __googleAdsDiagTest.getGoogleAdsAccessibleCustomersDiagnostic(env, {
    getGoogleAdsAccessToken: async () => {
      throw new Error("Google Ads OAuth refresh failed (401): access_token=abc refresh_token=xyz client_secret=qwe");
    },
    fetchImpl: async () => new Response("{}", { status: 200 }),
  });
  assert.equal(out.ok, false);
  assert.equal(out.api_http_status, null);
  assert.equal(out.error_subtype, null);
  assert.doesNotMatch(String(out.error_message), /access_token=abc/);
  assert.doesNotMatch(String(out.error_message), /refresh_token=xyz/);
  assert.doesNotMatch(String(out.error_message), /client_secret=qwe/);
});

test("accessible-customers endpoint enforces bearer authentication", async () => {
  const env = makeEnv();
  const req = new Request("https://example.com/google-ads/accessible-customers", { method: "GET" });
  const res = await worker.fetch(req, env);
  assert.equal(res.status, 401);
});

test("accessible-customers diagnostic is read-only and does not touch DB", async () => {
  const env = makeEnv();
  env.DB = {
    prepare() {
      throw new Error("DB should not be touched by accessible-customers diagnostic");
    },
  };
  const out = await __googleAdsDiagTest.getGoogleAdsAccessibleCustomersDiagnostic(env, {
    getGoogleAdsAccessToken: async () => "access-token",
    fetchImpl: async () => new Response(JSON.stringify({ resourceNames: ["customers/4572877507"] }), { status: 200 }),
  });
  assert.equal(out.ok, true);
  assert.equal(out.manager_directly_accessible, true);
});

test("direct-client SearchStream omits login-customer-id and keeps customer in URL", async () => {
  const env = makeEnv();
  let capturedUrl = "";
  let capturedOptions = null;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedUrl = String(url);
    capturedOptions = options || {};
    return new Response(JSON.stringify([{ results: [] }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await __googleAdsDiagTest.fetchGoogleAdsRowsForWindow(env, "access-token", "2026-10-01", "2026-10-02");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(capturedUrl, /\/v25\/customers\/5242681268\/googleAds:searchStream$/);
  const headers = capturedOptions?.headers || {};
  assert.equal(headers.Authorization, "Bearer access-token");
  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(Object.prototype.hasOwnProperty.call(headers, "login-customer-id"), false);
});

test("Google Ads OAuth token acquisition payload remains unchanged", async () => {
  const env = makeEnv();
  let seenForm = "";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    seenForm = String(options?.body || "");
    return new Response(JSON.stringify({ access_token: "token-123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const token = await __googleAdsDiagTest.getGoogleAdsAccessToken(env);
    assert.equal(token, "token-123");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(seenForm, /grant_type=refresh_token/);
  assert.match(seenForm, /client_id=client-id\.apps\.googleusercontent\.com/);
  assert.match(seenForm, /client_secret=secret/);
  assert.match(seenForm, /refresh_token=refresh/);
});

test("executeGoogleAdsSync no longer requires GOOGLE_ADS_LOGIN_CUSTOMER_ID for direct-client mode", async () => {
  const env = makeEnv();
  delete env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

  const out = await __googleAdsDiagTest.executeGoogleAdsSync(env, "manual", {}, {
    acquireGoogleAdsLock: async () => true,
    releaseGoogleAdsLock: async () => {},
    startGoogleAdsCollectorRun: async () => 123,
    finishGoogleAdsCollectorRun: async () => {},
    getGoogleAdsAccessToken: async () => "access-token",
    fetchGoogleAdsRowsForWindow: async () => [],
    chunkRows: () => [],
    postGoogleAdsRowsChunk: async () => ({ totals: { received: 0, created: 0, updated: 0, unchanged: 0, rejected: 0 } }),
  });

  assert.equal(out.ok, true);
});

