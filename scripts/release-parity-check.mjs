#!/usr/bin/env node
// Release parity check — guards against previously deployed security
// functionality or features silently disappearing when a new Pages runtime
// bundle is built from an older snapshot.
//
// Compares the CANDIDATE public/_worker.js against the CURRENT PRODUCTION
// payload's public/_worker.js using a marker matrix:
//   - Every security/feature marker present in production must still be
//     present in the candidate, unless explicitly allow-listed as removed.
//   - Expected additions (the release's declared change set) must be present
//     in the candidate.
//
// Usage:
//   node scripts/release-parity-check.mjs \
//     --production .release-order-acquisition/public \
//     --candidate  .release-clerk-hardening/public \
//     [--allow-removal marker1,marker2] \
//     [--expect-addition marker1,marker2]
//
// Exit codes: 0 = parity OK, 1 = parity failure, 2 = usage error.

import { readFileSync } from "node:fs";
import { join } from "node:path";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

const productionDir = arg("production");
const candidateDir = arg("candidate");
if (!productionDir || !candidateDir) {
  console.error("Usage: node scripts/release-parity-check.mjs --production <dir> --candidate <dir> [--allow-removal a,b] [--expect-addition a,b]");
  process.exit(2);
}

// Security/feature markers that, once deployed, must never silently vanish.
const REQUIRED_MARKERS = [
  "api/admin/templates",      // Template Administration route
  "order-acquisition",        // Order Acquisition card endpoint
  "ga4-lead",                 // GA4 Lead Acquisition endpoint
  "recent_run_groups",        // Data Quality sync-runs grouping
  "webhook/stripe",           // Stripe webhook route
  "__clerk_handshake",        // Clerk handshake handling
  "ADMIN_EMAILS",             // admin allowlist gate
];

const allowRemovals = new Set((arg("allow-removal") || "").split(",").map((s) => s.trim()).filter(Boolean));
const expectAdditions = (arg("expect-addition") || "").split(",").map((s) => s.trim()).filter(Boolean);

function readWorker(dir) {
  return readFileSync(join(dir, "_worker.js"), "utf8");
}

let prod, cand;
try {
  prod = readWorker(productionDir);
} catch (e) {
  console.error(`FAIL: cannot read production bundle: ${productionDir}/_worker.js (${e.message})`);
  process.exit(1);
}
try {
  cand = readWorker(candidateDir);
} catch (e) {
  console.error(`FAIL: cannot read candidate bundle: ${candidateDir}/_worker.js (${e.message})`);
  process.exit(1);
}

let failures = 0;
console.log("== Release parity check ==");
console.log(`production: ${productionDir}/_worker.js (${prod.length} chars)`);
console.log(`candidate:  ${candidateDir}/_worker.js (${cand.length} chars)`);

for (const marker of REQUIRED_MARKERS) {
  const inProd = prod.includes(marker);
  const inCand = cand.includes(marker);
  if (inProd && !inCand) {
    if (allowRemovals.has(marker)) {
      console.log(`  REMOVED (allow-listed): ${marker}`);
    } else {
      console.log(`  FAIL lost marker: ${marker}`);
      failures++;
    }
  } else if (inProd && inCand) {
    console.log(`  OK preserved: ${marker}`);
  } else if (!inProd && inCand) {
    console.log(`  OK added: ${marker}`);
  } else {
    console.log(`  -- absent in both: ${marker}`);
  }
}

for (const marker of expectAdditions) {
  if (cand.includes(marker)) {
    console.log(`  OK expected-addition present: ${marker}`);
  } else {
    console.log(`  FAIL expected addition missing: ${marker}`);
    failures++;
  }
}

// Lightweight sanity: report the size delta so reviewers can spot surprises.
const delta = cand.length - prod.length;
console.log(`bundle size delta: ${delta >= 0 ? "+" : ""}${delta} chars`);

if (failures > 0) {
  console.log(`== PARITY CHECK FAILED (${failures}) ==`);
  process.exit(1);
}
console.log("== PARITY CHECK PASSED ==");
