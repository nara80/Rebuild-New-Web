# Phase 12 Handoff — Google Ads Analytics (2026-09-27)

## Scope completed in this pass

Implemented the **Google Ads slice** of Phase 12 (paid media) following the same architecture used for GSC, GA4, and Etsy:

1. D1 schema + analysis views
2. token-auth ingestion API (`/api/v1/google-ads/*`)
3. weekly collector in `marketing-sync-worker` with manual run/status endpoints
4. admin analysis endpoint + Data Analyst dashboard section
5. data-quality freshness integration

Meta Ads is intentionally **not implemented yet** in this pass.

---

## Files added

- `migrations/050_google_ads_analytics.sql`
- `workers/api/google-ads.ts`
- `01_MildMate_Marketing/09_Handoffs/Phase_12_Handoff_Google_Ads_Analytics_2026-09-27.md`

## Files updated

- `workers/api/index.ts`
- `functions/api/[[path]].ts`
- `functions/api/v1/[[path]].ts`
- `workers/api/admin-analysis.ts`
- `public/super-admin/marketing/data-analyst/index.html`
- `marketing-sync-worker/index.js`
- `marketing-sync-worker/wrangler.toml`
- `01_MildMate_Marketing/16_Phases/12_MildMate_Marketing_Decision_System_Phase_12_Paid_Media_Checklist.md`

---

## API + route surfaces

### Ingestion API (token auth via `SALES_SYNC_API_TOKEN`)
- `GET /api/v1/google-ads/health`
- `POST /api/v1/google-ads/rows/upsert`

### Collector worker
- `GET /google-ads/status`
- `POST /google-ads/run?start=YYYY-MM-DD&end=YYYY-MM-DD&overlap=14&lag=2`
- scheduled on shared weekly slot (`0 4 * * 1`) together with GA4 + Etsy

### Analysis API
- `GET /api/admin/analysis/google-ads?start&end&product_id`

### Dashboard
- Added **Paid Media / Google Ads** card in:
  - `/super-admin/marketing/data-analyst/`

---

## Data model summary

Migration `050_google_ads_analytics.sql` adds:

- fact table: `google_ads_campaign_daily`
- views:
  - `analysis_google_ads_daily`
  - `analysis_google_ads_campaign_daily`
  - `analysis_google_ads_product_daily`
  - `analysis_google_ads_product_28d`
  - `analysis_google_ads_freshness`

Guardrails implemented:
- campaign/ad group IDs are preserved as durable identifiers
- non-product campaigns remain unmapped unless explicit or verified alias mapping exists
- CPA/ROAS calculated from paid media facts only
- platform-attributed conversion value stays separate from canonical D1 order revenue

---

## Required worker configuration (before live rollout)

`marketing-sync-worker` now expects:

### vars
- `GOOGLE_ADS_API_BASE` (default set)
- `GOOGLE_ADS_OVERLAP_DAYS` (default set)
- `GOOGLE_ADS_DATA_LAG_DAYS` (default set)
- `GOOGLE_ADS_CUSTOMER_ID` (**must be set**)
- optional: `GOOGLE_ADS_LOGIN_CUSTOMER_ID`
- optional: `GOOGLE_ADS_ACCOUNT_CURRENCY`

### secrets
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`

---

## Remaining work to finish full Phase 12

1. Implement Meta Ads schema, ingestion API, collector, analysis endpoint, and dashboard card.
2. Set Google Ads credentials/secrets and run first live sync.
3. Reconcile sample Google Ads report rows (spend, clicks, conversions, conversion value) against source exports.
4. Confirm paid-media freshness behavior after first scheduled run.
