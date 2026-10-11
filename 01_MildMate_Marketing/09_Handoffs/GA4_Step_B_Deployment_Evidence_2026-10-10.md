# GA4 Step B — Isolated Preview Deployment Evidence — 2026-10-10

**Status: deployed + verified. Stopping here. Staging GTM NOT published; awaiting next instruction.**

## 1. Deployment URL

- Immutable: `https://0329707d.mildmate-new.pages.dev`
- Branch alias: `https://ga4-remediation-isolated.mildmate-new.pages.dev`
- Environment: **Preview** (branch `ga4/remediation-isolated`) — production untouched

## 2. Deployed source commit

- `52b8cac` (HEAD at deploy; tree includes implementation `fd4467b`, all QA commits, and docs)
- Pre-deploy checks: working tree clean; `fd4467b` verified as ancestor of HEAD; no `branch`/`production_branch` keys in wrangler.toml; toml diff vs RC `327e667` is comment lines only

## 3. Build-artifact hash

- `public/_worker.js` SHA-256: `FFC62907ABC592AD27857FA3FF4CA712E3B994FC35F69FCDFD8BBBD17D2FD74A` (914,055 bytes, generated in the isolated worktree 2026-10-10 15:11:53, deployed with `--no-bundle`)
- Pre-deploy scope check: diff vs RC touches only analytics files, QA tooling, tests, marketing-sync collector fix, and docs — no unrelated changes

## 4. Actual runtime analytics configuration (live page, not build-time evidence)

Injected `runtime-analytics-config` on the deployed preview — exact match to expected:

```
{"environment":"staging","nonProductionApproved":true,"gtmId":"GTM-M9DMRGCD","ga4Id":"G-E8W6FZE6LP","enabled":true}
```

Browser-resolved config on the live preview host (`ga4-remediation-isolated.mildmate-new.pages.dev`):

```
{ environment: "staging", isProduction: false, enabled: true,
  gtmId: "GTM-M9DMRGCD", ga4Id: "G-E8W6FZE6LP",
  allowAdsConversions: false, reason: "non_production_isolated_enabled" }
```

This is definitive production-runtime proof that `CF_PAGES_BRANCH` is available in Pages Functions and the branch guard passes (not bypassed, not simulated). The guard did NOT fail closed because the branch identity IS available and matches.

## 5. Stripe Preview comparison

`https://d497dae9.mildmate-new.pages.dev` (branch `hardening/stripe-purchase-idempotency`, deployed 3h earlier):

```
{"environment":"staging","nonProductionApproved":false}
```

**Analytics-disabled — unaffected by our deployment.** No GTM/GA4 identifiers exposed; shared Preview configuration was not changed (toml baseline values identical to RC).

## 6. Production configuration comparison

`https://www.mildmate.com/` — verified unchanged: no `runtime-analytics-config` (production deployment predates the mechanism), legacy `G-ESL161CNBV` bootstrap still live, production GA4/GTM untouched. Our deploy was preview-only.

## 7. Isolation test results (against the live preview, all Google traffic intercepted locally)

| Check | Result |
|---|---|
| Browser matrix 14/14 (consent flows EN/TH, ecommerce contract, purchase gating, prod-ID blocking) | PASS |
| GTM request target | `https://www.googletagmanager.com/gtm.js?id=GTM-M9DMRGCD` only — exactly once per page |
| Production GA4/GTM IDs in QA runtime | Absent (resolver rejects; grep-verified) |
| Google Ads conversion requests (`googleadservices.com`, `doubleclick.net`) | **Zero** |
| GA4 `/g/collect` destination | Test stream only (`tid=G-E8W6FZE6LP`); hits intercepted locally (204), no synthetic events sent upstream |
| Consent ordering (real container load) | consent default (all denied) → consent update → `gtm.js` (indices 1→2→3) |
| Stripe Sandbox / Preview D1 / email suppression | Unchanged (toml-verified) |
| Payments initiated | None |

## 8. GO/NO-GO for staging GTM configuration

**GO** — the isolated preview is live with verified staging analytics configuration and clean isolation. Next step (your action): configure `GTM-M9DMRGCD` per the plan (Google tag `G-E8W6FZE6LP` + generic GA4 ecommerce event tag, zero Ads tags) and publish or Share-Preview the container. Then Tag Assistant + `qa-gtm-e2e.mjs` + DebugView close the real-execution gate. As agreed, GA4 events will not fire until that is done — the harness currently shows exactly the expected "container empty" state with all isolation invariants passing.

Stopping here per instruction. No GTM publish, no further deploys, nothing pushed.
