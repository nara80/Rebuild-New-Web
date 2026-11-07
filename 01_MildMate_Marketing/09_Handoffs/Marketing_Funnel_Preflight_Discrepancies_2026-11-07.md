# Marketing Funnel Preflight — Discrepancy Register

**Status:** DOCUMENTATION ONLY. Every item below is **unimplemented**. No production migration, collector change, or schema change was made.
**Date:** 2026-11-07
**Context:** Discovered during the read-only preflight for the Marketing Funnel Model preview implementation.

Production reads in this pass were performed with `wrangler d1 execute mildmate-db-prod --remote` (read-only SELECTs). The earlier `7403 not authorized` response was transient; the same credentials subsequently read production successfully.

---

## D1 — GA4 views are not property-scoped (CONFIRMED ON PRODUCTION)

**Finding.** Seven production views filter `property_scope` but never `property_id`:

`analysis_ga4_daily`, `analysis_ga4_page_daily`, `analysis_ga4_product_daily`, `analysis_ga4_product_28d`, `analysis_ga4_etsy_daily`, `analysis_ga4_etsy_listing_28d`, `analysis_ga4_freshness_etsy`.

Only `analysis_ga4_freshness` and `analysis_ga4_lead_freshness` are property-scoped.

**Why it matters.** Production `ga4_funnel_daily` holds **two** website properties:

| property_scope | property_id | rows | first | last |
|---|---|---|---|---|
| website | `308922589` (canonical) | 1522 | 2026-09-27 | 2026-11-03 |
| website | `366290587` (legacy) | 1589 | 2026-07-02 | 2026-10-19 |
| etsy | `533944293` | 1022 | 2026-09-20 | 2026-10-31 |

A consumer that reads those seven views directly can therefore merge legacy property `366290587` into canonical website numbers. The existing API routes are safe because they filter `property_id = '308922589'` themselves; the new funnel handler is also safe because it queries `ga4_funnel_daily` directly with the canonical property filter, and a regression test asserts the property-scope-only views are never read.

**Recommended fix (not implemented).** An additive migration that redefines those seven views with `AND property_id = '308922589'` for website scope. This is a production migration, so it is out of scope for the preview release.

---

## D2 — Preview `analysis_gsc_freshness` is stale; production is correct

**Finding.** Production `analysis_gsc_freshness` uses `source LIKE 'gsc-%'` (post-migration `047`), matching the live collector source `gsc-worker-cron`. The **preview** database still carries the pre-`047` definition `source = 'gsc-make-collector'`, a source that no longer exists.

**Impact.** On preview, GSC freshness would mis-report (`last_sync_status` null, `sync_errors_7d` 0) even though the collector is healthy. Production is unaffected. The funnel's GSC freshness indicator is therefore unreliable **on preview only**.

**Recommended fix (not implemented).** Apply `047_gsc_freshness_sources.sql` to the preview database. No production change needed.

---

## D3 — Preview database is behind production schema

Production exposes **57** analytical objects; preview exposes **50**. Missing on preview:

- `orders.quote_id` (migration `059`) — verified absent via `pragma_table_info`
- `quote_followup_events` (migration `059`)
- `ga4_lead_acquisition_daily` + `analysis_ga4_lead_freshness` (migration `061`)
- `quote_acquisition_attribution` (migration `060`)
- `marketing_actions` (migration `063`)

**Impact.** On preview the funnel's exact quote-conversion metric degrades to `Unavailable` (by design, via per-metric schema isolation), and the GA4 lead stage cannot report. The Phase 16 AI Analyst cannot be exercised against real data on preview.

**Recommended fix (not implemented).** Apply migrations `059`, `060`, `061`, `063` to the preview database if preview parity is wanted.

---

## D4 — Product identity differs between preview and production

| Database | Active products | IDs |
|---|---|---|
| production | 32 | `1–29, 32, 33, 34` |
| preview | 30 | `1–28, 30, 31` |

Preview does not match the canonical Marketing Decision System product set (which is 32 active products; gaps `30`/`31` are intentional and must not be renumbered). Any product-attributed funnel work validated on preview is therefore validated against a **different product set**.

**Recommended fix (not implemented).** Owner decision on whether preview should be re-seeded to match canonical product identity.

---

## D5 — Preview holds no external analytics data

Row counts on preview: `ga4_funnel_daily` 0, `gsc_search_daily` 0, `etsy_listing_daily` 0, `google_ads_campaign_daily` 0, `opportunity_scores` 0. Only `sales_orders` / `sales_order_items` (14 rows) and `products` (30) carry data.

**Impact.** On preview, the funnel's Website/Etsy/Paid Search stages render `INSUFFICIENT` and the Opportunity Engine renders empty. This is correct, honest behaviour, not a defect — but it means the preview cannot demonstrate live external funnel numbers. Owner acceptance should focus on structure, labelling, and the guardrails, plus the canonical Sales/Marketplace conversion numbers (10 commercial orders / ฿22,722 on preview).

---

## D6 — Freshness thresholds are tighter than the collector cadence

**Finding.** Production freshness as of this audit:

| Source | Latest report date | Age | Threshold | Verdict |
|---|---|---|---|---|
| GA4 website | 2026-11-03 | 4 d | 3 d | **warning** |
| GSC | 2026-11-02 | 5 d | 4 d | **warning** |
| Etsy | 2026-11-02 | 5 d | 7 d | ok |
| Google Ads | 2026-11-02 | 5 d | 4 d | **warning** |

The collector runs a single daily cron (`0 1 * * *` UTC) with **weekday dispatch** (Mon GA4 / Tue Etsy / Wed Google Ads / Thu GSC), so each source is refreshed roughly weekly. A weekly refresh against a 3–4 day threshold will report `warning` most of the week even when the pipeline is healthy.

**Impact.** The funnel will show `warning` freshness for GA4/GSC/Ads on production most days. This is a threshold-vs-cadence mismatch, not a pipeline failure.

**Recommended fix (not implemented).** Owner decision: either relax the freshness warning thresholds to match the weekly-per-source cadence, or accept `warning` as the normal steady state and label it as such in the UI.

---

## D7 — Production unified-sales freshness is stale

`notion-mapping-sync` last success was **2026-10-19**, 19 days before this audit. Unified sales therefore lag manual Notion entry. This is a known, owner-accepted dependency (documented in `AGENTS.md`), recorded here because it directly affects the funnel's Conversion stage freshness.

Production canonical totals at audit time: **578 commercial orders, ฿1,793,821.80**.

---

## D8 — Preview contains an unrecognised sales channel

Preview `sales_orders` includes `source_system = 'randomshop'`, which is outside the known channel list and would be counted by Data Quality as an unknown source label. Production currently has **no** unknown source labels. The funnel handles this by reporting such rows under an explicit "Other / Unrecognised source" channel rather than dropping them.

---

**End of register.** No item above has been implemented.
