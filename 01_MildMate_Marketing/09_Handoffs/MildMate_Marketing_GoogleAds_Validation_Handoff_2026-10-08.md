# MildMate Marketing Decision System + Google Ads Validation
## Crucial Chat Handoff — 2026-10-08

### Purpose
Use this file to continue in a new chat without re-explaining the current MildMate Marketing Decision System, Google Ads campaign, GTM conversion setup, advertiser verification, and Phase 12 validation issue.

---

# 1. Current Business / System Context

MildMate is building a **Marketing Decision System**, not just a reporting dashboard.

Core decision flow:

```text
Raw sales + marketing data
        ↓
Cloudflare D1 canonical facts
        ↓
Analytical views / metrics
        ↓
Read-only Analysis API
        ↓
Data Analyst Dashboard
        ↓
Sales Growth Signals
        ↓
Opportunity / Decision Engine
        ↓
Marketing Command Center
        ↓
AI Analyst + Human Approval
        ↓
Action
        ↓
Result Measurement / Feedback Loop
```

Key current architecture:
- Project root: `D:/00_mildmate/Re-build_web/`
- Marketing planning/handoff folder: `D:/00_mildmate/Re-build_web/01_MildMate_Marketing/`
- Super Admin area: `/super-admin/marketing/`
- Analysis API area: `api/analysis`
- Canonical database: Cloudflare D1
- Production D1 DB ID: `854f206a-b240-491c-bb91-7e064736d487`
- Cloudflare Worker: `mildmate-marketing-sync`
- Worker URL: `https://mildmate-marketing-sync.nara19080.workers.dev`
- Make.com is **fully retired**.
- Channel orders are entered in Notion manually by humans.
- Notion→D1 confirmed-mapping sync runs via deployed Cloudflare Worker.
- AI must never become source of truth for canonical facts.

---

# 2. 17-Phase Marketing Decision System

The user supplied 17 phase checklist files.

Important active interpretation:

1. Phase 01 — Architecture Audit & Developer Setup
2. Phase 02 — Metric Contract
3. Phase 03 — D1 Analytical Layer
4. Phase 04 — Authenticated Read-Only Analysis API
5. Phase 05 — Data Analyst Dashboard MVP
6. Phase 06 — Data Quality & Sync Monitor
7. Phase 07 — Product Mapping Automation / reconciled superseded design
8. Phase 08 — Historical Sales Backfill
9. Phase 09 — Google Search Console
10. Phase 10 — GA4
11. Phase 11 — Etsy Performance
12. Phase 12 — Paid Media / Google Ads
13. Phase 13 — Sales Growth Layer
14. Phase 14 — Opportunity & Decision Engine
15. Phase 15 — Marketing Command Center
16. Phase 16 — AI Analyst & Marketing Action Feedback Loop
17. Phase 17 — Ongoing Confirmed-Mapping Sync Automation

Important current strategic revision:
- **Primary goal = Sales Growth**
- **Secondary = Growth Efficiency**
- **Profitability = Guardrail**
- Phase 13 owns **signals / coverage / freshness / confidence**
- Phase 14 owns **weights / scoring / ranking / recommendation logic**
- Do not move Phase 14 decision logic into Phase 13.

Phase 13 intended contract:
`growth_signal_contract: "v1"`

Phase 13 should expose:
- demand
- momentum
- conversion availability
- channel context
- source freshness
- mapping coverage
- confidence
- profitability only as secondary guardrail
- immature Google Ads signal = neutral / `INSUFFICIENT_SIGNAL`

---

# 3. Droid’s Separate Broader Roadmap

Droid later reported a broader MildMate website/project roadmap numbered 0–17:

```text
0 — Mockup                         Complete
1 — Foundation                     Complete
2 — SEO URLs                       Complete
3 — Design System                  Complete
4 — Homepage + Products            Complete
5 — Checkout + Stripe + Auth       Complete
6 — Abandoned Cart                 Complete
7 — Admin Dashboard                Complete
8 — Launch                         Complete
9 — Testing (Vitest)               Out of scope
10 — GA4 Collector                 Complete
11 — Etsy Collector                Complete
12 — Google Ads Collector          In progress
13 — Sales Growth Layer            Partial
14 — Opportunity Decision Engine   Pending
15 — Roadmap phase                 Pending
16 — Roadmap phase                 Pending
17 — Notion→D1 Sync Worker         Complete
```

Do **not** confuse this numbering with the 17 Marketing Decision System checklist files above.

Operationally, the current focus is Phase 12 validation + Phase 13 closure before Phase 14.

---

# 4. Google Ads Account / Campaign Context

Google Ads account:
- Gmail: `nara19080@gmail.com`
- MildMate advertiser/customer ID: `524-268-1268`
- Manager ID: `457-287-7507`

Worker Google Ads config previously used:
- `GOOGLE_ADS_CUSTOMER_ID=5242681268`
- login customer ID `4572877507`

Current live campaign:
`US_Search_CushionProtector_PetsKids_202610`

This campaign is intentionally a **5-country demand-discovery test**:
- United States
- Canada
- Mexico
- Panama
- Colombia

This is **not** an accidental geo configuration.

Early screenshot snapshot:
- ~168 impressions
- 3 clicks
- CTR ~1.8%
- spend ~THB 184.94
- avg CPC ~THB 61.65
- 0 conversions
- daily budget ~THB 180
- status: Eligible (Limited)

Early click-driving keywords:
- `"sofa cushion protector"` — 78 impressions, 2 clicks
- `"couch cushion protector"` — 50 impressions, 1 click

Several more-specific custom/pet terms showed Low search volume.

Canada generated 2 of the first 3 clicks, but **3 clicks is far too little to judge geography**.

Agreed campaign policy:
- Keep all 5 countries together for now.
- Do not split US/CA yet.
- Keep budget unchanged for now.
- Monitor country + search terms + CPC + funnel behavior.
- Reassess geo structure after:
  - about **20–30 meaningful clicks overall**, OR
  - the **first real conversion**, whichever happens first.
- Only add negative keywords when search terms are clearly irrelevant.

Owner qualitative business context:
- Weighted Duvet Cover and Custom Waterproof Cushion Protector receive many direct customer inquiries.
- Competition appears limited.
- Direct inquiries/custom quote requests are high-intent demand signals not fully captured by GA4/GSC.
- Do not choose products only by historical website sales.

---

# 5. Google Ads + GTM Workstream Status

Droid reported:

```text
1. Setup / Implementation
   ✅ Complete

2. CSP Hardening
   ✅ Complete

3. Live Traffic Collection
   🟡 In progress

4. Real Purchase Conversion Verification
   🟡 In progress

5. Post-validation Decision
   Secondary → Primary for Purchase tag
   ⏳ Pending

6. Geo Restructure / Scaling Decision
   ⏳ Pending
```

Implementation already completed:
- GTM tags/triggers/variables
- Google Ads Purchase conversion tag
- Google base tag
- Conversion Linker
- dataLayer trigger/variables
- CSP updates for GTM / Preview / GA4 / Ads / Conversion Linker
- GTM Version 16 published live

Conversion state:
- `Purchase` = Secondary
- `Purchase - GTM` = Primary was later changed by user in Google Ads UI, but earlier implementation guidance said keep GTM purchase Secondary until real validation.
- Current important rule: **do not trust/scale based on Purchase - GTM until first genuine order is reconciled end-to-end**.
- No fake Stripe payment should be made.

First genuine Stripe purchase validation must prove:

```text
Real customer completes Stripe payment
        ↓
Website emits purchase exactly once
        ↓
transaction_id present
value correct
currency correct
        ↓
GTM CE - purchase triggers
        ↓
Purchase - GTM fires exactly once
        ↓
Google Ads receives conversion
        ↓
D1 collector eventually reflects it
```

---

# 6. Advertiser Verification Status

Google Ads advertiser verification was completed/submitted.

Correct profile:
- Name: Nara Ratnarathon
- Country: Thailand
- Type: Individual

Important history:
- Agency-document flow failed with payment permission error:
  `OR_NPCS_01`
- Correct path was client verification using existing Thailand Individual payments profile.
- User reached final screen:
  “Thanks for starting verification!”
- Google said decision usually within 3–5 business days.

Do not create a US payments profile.
Do not upload identity documents into ChatGPT; only upload directly to Google.

---

# 7. Cloudflare Cron Architecture

Cloudflare Free cron limit caused an earlier deployment issue:
- error 10072
- account hit 5-cron-trigger limit

Solution chosen:
**ONE daily cron**

```text
0 1 * * *
```

Meaning:
- 01:00 UTC
- 08:00 Thailand

Dispatcher design:
- Monday → GA4 weekly
- Tuesday → Etsy
- Wednesday → Google Ads
- Thursday → GSC weekly
- Friday → approved existing weekly task / reconciliation / possible no-op
- Saturday → no-op
- Sunday → no-op

Cloudflare UI was previously verified to show exactly one active cron trigger.

Latest known worker deployment previously noted:
`573ec494-7273-4135-8daf-b792aebc706b`
created `2026-10-06T06:47:11.454Z`

This must be re-verified if needed; do not assume current deployment version without checking.

---

# 8. Important Phase 12 Validation Result

User asked Droid to perform a read-only live Google Ads collector validation.

Droid returned:

## Production D1 freshness
From `analysis_google_ads_freshness`:

```text
latest_report_date: null
total_rows: 0
last_success_sync_at: null
last_sync_status: null
last_sync_at: null
sync_errors_7d: 0
```

## Worker status endpoint
From authenticated:
`GET /google-ads/status`

```text
recent_runs: []
freshness.total_rows: 0
```

No successful or failed run records were present.

## Source vs D1
- Source totals: 0
- D1 totals: 0
- Numerically consistent only because **nothing has been ingested**
- This is **not successful reconciliation**

## Data Analyst
- `/api/admin/analysis/google-ads` returned 401 when called directly because it is auth-gated.
- Backing D1 view `analysis_google_ads_daily` is empty.

## Duplicate check
No duplicates, but only because table is empty.

## Zero conversion integrity
Cannot call 0 conversions a real business signal because **there is no ingested reporting date at all**.

## Mapping
Cannot assess mapping because Google Ads table has 0 rows.

## Droid PASS/FAIL

```text
Collector freshness with recent successful run: FAIL
Source vs D1 live reconciliation:              FAIL
D1 vs Analyst reconciliation:                  PARTIAL
Duplicate integrity:                           PASS structurally
Zero-conversion integrity:                     FAIL
Mapping defensibility:                         FAIL
```

## Closure decision
**DO NOT CLOSE PHASE 12**

Reason:
Production has no Google Ads rows and no collector run telemetry.

This is now considered a **collector/scheduler execution problem**, not a campaign-performance problem.

---

# 9. Current Critical Next Step

Do **not** manually trigger `/google-ads/run` yet.

Reason:
A manual run could populate D1 and hide whether the scheduled Wednesday execution path is broken.

The current priority is to audit:

```text
Cloudflare Cron
      ↓
scheduled() handler
      ↓
weekday dispatcher
      ↓
Wednesday → Google Ads
      ↓
Google Ads collector
      ↓
Google Ads API
      ↓
D1 ingestion
      ↓
sync/run telemetry
```

The expected Wednesday execution to inspect is:

`2026-10-07 01:00 UTC`

Because the cron is `0 1 * * *`.

---

# 10. Exact Droid Prompt Recommended Next

```text
We have confirmed that the live Google Ads campaign now has real
impressions/clicks, but production D1 still has:

- google_ads rows = 0
- recent_runs = []
- latest_report_date = null
- last_success_sync_at = null

Therefore this is no longer explainable by "no active campaign".

Perform a READ-ONLY audit of the production Google Ads scheduler/dispatcher path.

IMPORTANT
- Do not manually run the collector yet.
- Do not modify code.
- Do not modify D1.
- Do not deploy.
- Do not change Cloudflare configuration.
- Do not change Google Ads.
- Do not reveal secrets.

BACKGROUND

Production uses ONE Cloudflare cron:

0 1 * * *

Expected dispatcher behavior:
- Monday → GA4
- Tuesday → Etsy
- Wednesday → Google Ads
- Thursday → GSC
- Friday → approved weekly task/no-op
- Saturday/Sunday → no-op

The current live Google Ads campaign already has real traffic.

Audit the following:

1. Confirm the currently deployed production Worker version.

2. Confirm production has exactly the intended active cron trigger:
   0 1 * * *

3. Inspect the deployed scheduled() handler / cron entry point.

4. Verify the dispatcher weekday calculation:
   - timezone/date basis used
   - whether 2026-10-07 01:00 UTC was interpreted as Wednesday
   - expected branch selected for that timestamp

5. Trace the Wednesday branch end-to-end:
   scheduled event
   → dispatcher
   → Google Ads collector function
   → Google Ads API request
   → D1 ingestion
   → sync/run telemetry

6. Check whether the Google Ads scheduled branch is actually wired to
   the same implementation used by the authenticated manual
   /google-ads/run endpoint.

7. Check for any early-return / guard condition that could skip the
   Google Ads run silently.

8. Check whether required production environment variables/secrets
   exist by NAME/PRESENCE ONLY.
   Do not reveal values.

9. Check whether scheduled Google Ads execution records failures in
   sync telemetry.
   Determine why recent_runs is completely empty if a scheduled
   attempt occurred.

10. Verify whether the latest deployment happened before or after the
    expected Wednesday 2026-10-07 01:00 UTC cron execution.

11. Determine whether this is most likely:
    A. cron never fired
    B. dispatcher did not route to Google Ads
    C. Google Ads branch returned early
    D. collector attempted and failed before telemetry
    E. telemetry/status query is broken
    F. another verified cause

Return:

A. DEPLOYED VERSION
B. CRON TRIGGER STATE
C. SCHEDULED HANDLER PATH
D. WEEKDAY/DISPATCHER RESULT FOR 2026-10-07 01:00 UTC
E. GOOGLE ADS BRANCH TRACE
F. REQUIRED ENV/SECRET PRESENCE
G. TELEMETRY PATH
H. VERIFIED ROOT CAUSE OR NARROWED SUSPECTS
I. PASS/FAIL FOR EACH LAYER
J. SAFEST NEXT ACTION

Stop after the report.
Do not make changes and do not manually trigger the collector.
```

---

# 11. Decision Tree After Droid Audit

If scheduler / dispatcher bug is found:

```text
Identify exact defect
→ narrow fix only
→ verify tests
→ deploy
→ controlled manual Google Ads run
→ reconcile Google Ads → D1 → Data Analyst
→ keep Phase 12 open
→ verify next automatic Wednesday run
```

If scheduler path is actually healthy and the first scheduled opportunity was missed:

```text
Controlled manual Google Ads run
→ reconcile live data
→ keep Phase 12 open
→ verify next Wednesday automatic run
```

Do not close Phase 12 until:
- real live Google Ads rows exist in production
- collector freshness is valid
- Google Ads source ↔ D1 reconciles
- D1 ↔ Data Analyst reconciles
- zero conversions can be distinguished from missing data
- campaign/product mapping is defensible

---

# 12. Phase 13 / 14 Gating

Do **not** start Phase 14 yet.

Recommended sequence:

```text
Fix / validate Phase 12 pipeline
        ↓
Complete live Google Ads reconciliation
        ↓
Validate first genuine purchase conversion
        ↓
Formally close Phase 12
        ↓
Run Phase 13 closure audit
        ↓
Confirm growth_signal_contract v1
        ↓
Close Phase 13
        ↓
Start Phase 14 Opportunity Decision Engine
```

Phase 13 must remain signal-only:
- no score weighting changes
- no ranking changes
- no recommendation logic changes
- sparse Google Ads data must remain neutral

---

# 13. Etsy / GA4 Relevant Existing State

Important historical verified items:
- GA4 collector deployed and production-verified.
- Etsy collector deployed and production-verified.
- Etsy GA4 sync previously succeeded with:
  - 317 fetched/sent/created
  - 338 sessions
  - 20 listing IDs
- 17 Etsy listing mappings were applied with guarded write.
- 3 unresolved Etsy listing IDs remain:
  - `1799670854`
  - `4327779249`
  - `4467922807`
- A migration 057 concept was proposed to make Etsy GA4 freshness `mapped_sessions` use `etsy_listing_master`; do not assume it has been applied unless verified.

---

# 14. Working Style / Safety Rules for New Chat

User prefers:
- exact verification
- clear PASS / FAIL
- sequential steps
- few steps at a time
- do not jump ahead
- preserve production safety
- read-only audit before writes
- explicit deployment / migration gates
- do not expose secrets or tokens
- do not perform fake Stripe payment
- do not manually trigger systems when doing so could hide a scheduler defect

When giving Droid instructions:
- specify READ-ONLY vs WRITE
- explicitly prohibit unrelated changes
- demand exact evidence
- stop after the requested report
- separate diagnosis from remediation

---

# 15. Immediate Starting Point for New Chat

Start from this state:

> The live Google Ads campaign has real traffic, but production D1 has 0 Google Ads rows and `/google-ads/status` shows no run telemetry. Phase 12 must remain open. The next task is a read-only audit of the production one-cron weekday dispatcher for the expected Wednesday `2026-10-07 01:00 UTC` Google Ads execution. Do not manually run the collector until the scheduler path is understood.
