import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const sourcePath = path.resolve("D:/00_mildmate/re-build_web/marketing-sync-worker/index.js");
const bundlePath = path.join(os.tmpdir(), `ga4-lead-config-bundle-${Date.now()}.mjs`);
await build({
  entryPoints: [sourcePath],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundlePath,
  logLevel: "silent",
});
const workerMod = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);
const { __ga4LeadTest } = workerMod;

test("ga4 lead sync defaults to canonical website property 308922589", () => {
  const propertyId = __ga4LeadTest.resolveGa4LeadPropertyId({});
  assert.equal(propertyId, "308922589");
});

test("ga4 lead sync accepts explicit lead-event overrides without empty output", () => {
  const events = __ga4LeadTest.resolveGa4LeadEventNames({
    GA4_LEAD_EVENT_NAMES: "generate_lead, quote_request, generate_lead",
  });
  assert.deepEqual(events, ["generate_lead", "quote_request"]);
});
