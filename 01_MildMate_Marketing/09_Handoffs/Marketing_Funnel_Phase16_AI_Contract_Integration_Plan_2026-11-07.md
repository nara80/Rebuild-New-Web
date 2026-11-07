# Marketing Funnel → Phase 16 AI Analyst — Input Contract Integration Plan

**Status:** PLANNING ONLY. Nothing in this document is implemented.
**Date:** 2026-11-07
**Companion to:** `Marketing_Funnel_Model_Phases10-16_Reconciliation_DRAFT_2026-11-07.md`
**Scope:** How verified funnel metrics could later enter the Phase 16 AI Analyst input contract. No AI adapter, no recommendation generation, and no change to the human approval workflow is part of this task.

---

## 1. Why this is separate from the funnel layer

The funnel API (`GET /api/admin/analysis/funnel`) is **read-only reporting**. The Phase 16 AI Analyst consumes a structured **input contract** (`buildAiInputContract`) and produces advisory recommendations that a human must approve. Feeding the funnel into that contract changes what the AI can reason about, so it is treated as a distinct, later decision.

Two constraints from the owner remain in force:

- No AI adapter and no AI credentials are configured in this task (`AI_API_KEY` unset → `ai_available: false`).
- The human approval workflow (`proposed → approved | rejected → reviewed`) is unchanged.

---

## 2. Current contract shape (unchanged)

`buildAiInputContract(env)` currently emits:

| Key | Content |
|---|---|
| `generated_at` | ISO timestamp |
| `canonical_products` | `products.id, slug, title_en` where `is_active = 1` |
| `opportunities` | Latest `opportunity_scores` snapshot, top 20 scored rows |
| `opportunity_snapshot` | `{ score_date, model_version }` when a snapshot exists |
| `data_confidence` | Per-source `{ status, last_run_at, last_status, age_days }` for `ga4`, `gsc`, `etsy`, `google-ads`, `notion`; roll-up `high / medium / low` |
| `unverified_signals` | `google_ads_purchase_attribution` (UNVERIFIED) |
| `past_outcomes` | Reviewed `marketing_actions` (last 20) |
| `schema_unavailable` | Names of sources that could not be read |

`validateRecommendations` rejects invented `product_id`, missing `action`, missing `why`, and non-numeric `confidence`; it appends cautions when data confidence is not `high` and for any Ads-related recommendation.

---

## 3. Proposed addition (not implemented)

Add a single additive key, `funnel_context`, derived from the same canonical sources the funnel API already reads. It must be **context only** — it must not change scoring, and it must not introduce a cross-channel rate.

```jsonc
"funnel_context": {
  "model": "marketing-funnel-v1",
  "window": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "days": 28, "timezone": "UTC" },
  "channels": [
    {
      "id": "website",
      "stages": {
        "awareness":  { "status": "PARTIAL",  "headline": { "sessions": 0, "gsc_impressions": 0 } },
        "engagement": { "status": "PARTIAL",  "headline": { "product_views": 0, "add_to_cart": 0 } },
        "lead_quote": { "status": "AVAILABLE","headline": { "generate_lead_events": 0, "total_quotes": 0 } },
        "conversion": { "status": "AVAILABLE","headline": { "orders": 0, "order_revenue": 0 } },
        "retention":  { "status": "UNAVAILABLE" }
      },
      "freshness": { "ga4": "ok", "gsc": "ok" }
    }
    // etsy, paid_search, marketplace ...
  ],
  "guardrails": {
    "cross_channel_rates": false,
    "retention": "UNAVAILABLE",
    "google_ads_purchase_attribution": "UNVERIFIED",
    "canonical_ga4_property": "308922589"
  }
}
```

### Design rules for the addition

1. **Context, not input to scoring.** `funnel_context` must not be read by `opportunity-core.mjs`. Changing Phase 14 weights requires a new `score_model_version`, not a context addition.
2. **Headlines only.** Send a small set of already-computed values per stage, not the full metric list, to keep the prompt bounded and stable.
3. **Carry the guardrails verbatim.** The AI must be told that no cross-channel rate exists, that Retention is unavailable, and that Ads attribution is unverified — otherwise it will invent a funnel conversion rate.
4. **Carry `status` per stage.** Recommendations must be able to say "act on Lead & Quote" or "not measurable yet", which requires the status vocabulary (`AVAILABLE / PARTIAL / UNVERIFIED / INSUFFICIENT / UNAVAILABLE`).
5. **No PII.** The funnel layer is already PII-free; the context must stay so.
6. **Degrade gracefully.** If the funnel source is unavailable, omit `funnel_context` and record it in `schema_unavailable`; never substitute zeros.

---

## 4. Prompt-rule additions that would be required

If `funnel_context` is added, `buildAiPrompt` would need these rules (drafted, not implemented):

- "Funnel stages are per channel. Never combine two channels into one conversion rate."
- "`retention` is UNAVAILABLE — do not propose retention actions as measurable outcomes."
- "Google Ads conversions are UNVERIFIED monitoring data; do not treat them as funnel conversion."
- "`INSUFFICIENT` means no data in the window, not zero performance."
- "Cite the stage a recommendation acts on, and the channel it applies to."

These mirror the existing Ads-caution rule already applied in `validateRecommendations`.

---

## 5. Validation additions that would be required

Extend `validateRecommendations` so a recommendation that references funnel context is rejected or cautioned when:

- it names a cross-channel conversion rate or an overall funnel rate;
- it claims a Retention outcome;
- it treats Ads `conversions` as validated conversion;
- it targets a channel whose stage status is `UNAVAILABLE`.

Rejection reasons would be additive to the existing four, so the current contract tests keep passing.

---

## 6. Preconditions before this is implemented

| # | Precondition | State |
|---|---|---|
| 1 | Funnel API delivered and owner-accepted | In progress (this release) |
| 2 | Funnel metric definitions stable for one review cycle | Pending |
| 3 | Owner decision: is funnel context allowed to influence recommendations at all? | Pending |
| 4 | AI provider configured (`AI_API_KEY`) | Not configured |
| 5 | Anthropic Messages adapter (if Anthropic is chosen) | Not built |
| 6 | Owner decision on whether funnel components ever enter Phase 14 scoring as a new `model_version` | Pending |

---

## 7. Explicitly out of scope for this task

- No AI adapter, no provider configuration, no credentials.
- No change to `buildAiInputContract`, `buildAiPrompt`, or `validateRecommendations`.
- No change to `marketing_actions` statuses, transitions, or the approval/review workflow.
- No Phase 14 weight change and no production score recompute.

---

**End of plan.** No implementation was performed.
