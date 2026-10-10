# MildMate Marketing Decision System — Phase 13
## Growth Signal Contract v1 (Frozen)

Date: 2026-10-09  
Scope: Contract freeze and semantics only (no scoring/ranking changes)

## 1) Contract Envelope

- `growth_signal_contract: "v1"`
- `signals` object contains exactly:
  - `demand`
  - `momentum`
  - `conversion_availability`
  - `channel_context`
  - `source_freshness`
  - `mapping_coverage`
  - `confidence`
  - `profitability_guardrail`

Each signal envelope uses:
- `value`
- `status`
- `coverage`
- `freshness_days`
- `confidence_impact`
- `reason`

Top-level Google Ads neutrality metadata:
- `google_ads_policy.infrastructure`
- `google_ads_policy.business_signal`
- `google_ads_policy.scoring_effect`
- `google_ads_policy.reason`

## 2) Signal Definitions

### 2.1 demand
- **Sources:** `ga4_funnel_daily` (website scope), `gsc_search_daily`, `etsy_listing_daily` (+ master mapping)
- **Value:** 28-day demand levels + blended growth percentages
- **Units:** sessions, clicks, views, %
- **Status semantics:**
  - `sufficient`: usable demand signal
  - `stale_source`: source freshness stale while signal exists
  - `mapping_gap`: signal exists but mapped share weak
  - `insufficient_signal`: no measurable demand signal
- **Coverage:** mapped shares for GA4/GSC/Etsy
- **Freshness:** days-since-latest per source
- **Confidence impact:** negative penalties for stale/mapping gap/insufficient
- **Missing behavior:** missing source rows degrade to `insufficient_signal`; no fabricated positive demand

### 2.2 momentum
- **Sources:** `analysis_active_items`, `analysis_sales_daily`
- **Value:** 28d units/orders vs previous 28d + growth %
- **Units:** units, orders, %
- **Status semantics:**
  - `sufficient`: current and previous windows comparable
  - `insufficient_signal`: missing baseline or no activity
- **Coverage:** mapped order %
- **Freshness:** null (derived from sales window data)
- **Confidence impact:** negative when baseline absent
- **Missing behavior:** missing activity represented as insufficient, not as positive trend

### 2.3 conversion_availability
- **Sources:** `ga4_funnel_daily` (website scope)
- **Value:** sessions, add_to_cart, begin_checkout, purchases, purchase rate
- **Units:** counts, %
- **Status semantics:** `sufficient` / `mapping_gap` / `insufficient_signal`
- **Coverage:** GA4 mapped sessions %
- **Freshness:** GA4 freshness days
- **Confidence impact:** negative when traffic/events absent or mapping weak
- **Missing behavior:** insufficient status, no synthetic conversion success

### 2.4 channel_context
- **Sources:** `analysis_active_items` grouped by `channel_norm`
- **Value:** active channel count, top-channel share, channel rows
- **Units:** counts, %
- **Status semantics:** `sufficient` / `neutral` / `insufficient_signal`
- **Coverage:** applied channel filter context
- **Freshness:** null
- **Confidence impact:** small penalties for low breadth/no channel activity
- **Missing behavior:** no activity -> insufficient, not inferred participation

### 2.5 source_freshness
- **Sources:** `analysis_ga4_freshness`, `analysis_gsc_freshness`, `analysis_etsy_freshness`, `analysis_google_ads_freshness`
- **Value:** days since latest report by source
- **Units:** days
- **Status semantics:** `sufficient` / `stale_source` / `insufficient_signal`
- **Coverage:** per-source availability flags
- **Freshness:** explicit per-source day counts
- **Confidence impact:** stale or unavailable primary sources reduce confidence
- **Missing behavior:** primary-source absence -> insufficient

### 2.6 mapping_coverage
- **Sources:** GA4/GSC/Etsy/Ads mapped-vs-total aggregates + sales mapped orders
- **Value:** average mapped % + mapped order %
- **Units:** %
- **Status semantics:** `sufficient` / `mapping_gap` / `insufficient_signal`
- **Coverage:** per-source mapped percentages
- **Freshness:** null
- **Confidence impact:** penalties when mapped coverage is weak/absent
- **Missing behavior:** no coverage baseline -> insufficient (never silently “good”)

### 2.7 confidence
- **Sources:** aggregate of signal confidence impacts
- **Value:** 0–100 confidence score
- **Units:** score
- **Status semantics:** `sufficient` / `neutral` / `insufficient_signal`
- **Coverage:** `signal_count`, `total_impact`
- **Freshness:** null
- **Confidence impact:** always `0` (this is the summary signal)
- **Missing behavior:** missing/immature signals reduce confidence via penalties

### 2.8 profitability_guardrail
- **Sources:** `analysis_profit_coverage`
- **Value:** gross/contribution coverage %, full-cost order %, cost coverage counts
- **Units:** %, counts
- **Status semantics:** `secondary_guardrail` (or `insufficient_signal` if unavailable)
- **Coverage:** products/channels cost coverage
- **Freshness:** null
- **Confidence impact:** small guardrail penalty when gross coverage is weak
- **Missing behavior:** unavailable guardrail explicitly marked as insufficient

## 3) Google Ads Neutrality Policy (Phase 12 still open)

Policy in contract v1:
- `infrastructure: "available"`
- `business_signal: "insufficient_or_sparse"` when Ads data is sparse/zero
- `scoring_effect: "neutral_in_phase13"`

Rules:
- Missing/sparse Google Ads rows do **not** become “zero demand reward/penalty.”
- Contract remains forward-compatible: when Ads data matures, the same v1 envelope carries non-sparse status without redesign.

## 4) Status Vocabulary (v1)

- `sufficient`
- `neutral`
- `mapping_gap`
- `stale_source`
- `insufficient_signal`
- `secondary_guardrail`

No new status tokens are introduced in this freeze.

## 5) Freshness-threshold semantics (intentional split)

Two threshold families intentionally coexist:

1. **Operational data-quality warnings** (Data Analyst monitor)
   - GA4 warning threshold: `> 3 days`
   - GSC warning threshold: `> 4 days`

2. **Phase 13 analytical signal tolerance** (`source_freshness` signal)
   - GA4 stale threshold: `> 10 days`
   - GSC stale threshold: `> 14 days`

Interpretation rule:
- An operational warning can coexist with a still-usable analytical signal.
- This is not a contract conflict; it reflects stricter monitoring guardrails versus broader analytical tolerance.
