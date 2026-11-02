# GA4 Lead Acquisition — Local Validation Report (No Deploy)

Date: 2026-11-01  
Scope: Local-only implementation + testing for Option B preparation.

## Constraints compliance
- No deployment executed.
- No commit/push executed.
- No migration executed.
- No backfill/sync trigger executed.
- No cron/schedule changes.
- No Clerk, GTM, Google Ads, checkout, Stripe, or business KPI definition changes.

## Implementation files (intended scope)
Modified:
- `marketing-sync-worker/index.js`
- `workers/api/ga4.ts`
- `workers/api/admin-analysis.ts`
- `public/super-admin/marketing/data-analyst/index.html`

Added:
- `migrations/061_ga4_lead_acquisition.sql` (proposal only, not applied)
- `workers/api/__tests__/ga4-lead-acquisition-api.test.ts`
- `workers/api/__tests__/data-analyst-seo-ga4-leads-ui.test.ts`
- `marketing-sync-worker/tests/ga4-lead-sync-config.test.mjs`

## Key behavioral outcomes
1. Collector extension (Monday GA4 flow) now has additive lead-sync path for:
   - `generate_lead`
   - `quote_request`
   by date + session source/medium + session campaign, with user metrics when available.
2. Lead section is canonical-property scoped to website property `308922589`.
3. Existing GA4 funnel endpoint and metrics remain separate.
4. Protected admin-analysis endpoint added for lead section: `/api/admin/analysis/ga4-leads`.
5. SEO tab adds a new **GA4 Lead Acquisition** card with explicit unavailable states.

## Regression test evidence
### 1) Event separation + existing purchase/quote tracking + property isolation + API security + seven-tab preservation
Command:
`npx vitest run workers/api/__tests__/quote-ga4-measurement.test.ts workers/api/__tests__/analytics-isolation.test.ts workers/api/__tests__/ga4-lead-acquisition-api.test.ts workers/api/__tests__/data-analyst-seo-ga4-leads-ui.test.ts`

Result:
- 4 test files passed
- 53 tests passed
- 0 failed

### 2) Canonical lead-property config in collector
Command:
`node --test marketing-sync-worker/tests/ga4-lead-sync-config.test.mjs`

Result:
- 2 tests passed
- 0 failed

## UI evidence artifacts
- Before snapshot: `data-analyst-before.html`
- After snapshot: `data-analyst-after.html`
- UI diff patch: `data-analyst-ui-diff.patch`
- Structural probe JSON: `ga4-lead-ui-probe.json`

Probe result summary:
- seven tabs preserved: PASS
- GA4 lead card present under SEO tab: PASS
- new loader wired in applyFilters/loadAll: PASS
- responsive table-wrap containers present: PASS
- no fabricated unique-lead label: PASS

## Deployment safety assessment
Status: **Safe for owner review only; not deploy-ready until owner approves migration + controlled preview validation path.**

Reasons:
- Additive schema migration is prepared but unapplied.
- New collector write path depends on migration rollout sequencing.
- Canonical-property lead layer is isolated from existing GA4 funnel KPIs.
- Existing auth and dashboard tab contracts are preserved by tests.
