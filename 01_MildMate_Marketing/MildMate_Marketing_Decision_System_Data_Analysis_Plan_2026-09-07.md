# MildMate Marketing Decision System — Data Analysis & Marketing Decision Plan

> **⚠️ AUTOMATION LAYER SUPERSEDED (2026-10-01).** This plan assigned integration/ETL to Make.com. As built, all automation runs on Cloudflare Worker crons (`mildmate-marketing-sync`) and channel orders are entered into Notion manually by humans. Make.com is fully retired. Read Make.com references below as historical planning. See `09_Handoffs/Make_com_Retirement_Systematic_Reconciliation_2026-10-01.md`.

> **➕ CUSTOM QUOTE CONVERSION PIPELINE ADDED (2026-10-28).** A Tier 0/1/2 plan converting custom-quote demand into measurable conversion is now part of this decision system — Tier 0 (manual follow-up ritual) complete, Tier 1 (funnel KPIs + exact quote→order attribution + pre-expiry follow-up automation) deployed 2026-10-28, Tier 2 (opportunity-engine input) pending. See `# 23. Custom Quote Conversion Pipeline — Tier Plan (2026-10-28)` at the end of this document.

**Prepared:** 2026-09-07  
**Purpose:** Practical implementation plan to turn MildMate's existing data infrastructure into a usable marketing analysis and decision system.

---

# Reconciliation Update (2026-11-01)

This file is retained as the master planning narrative, but execution status is now governed by reconciled production evidence.

Canonical current-state references:

- `AGENTS.md`
- `Framework.md`
- `01_MildMate_Marketing/09_Handoffs/Phase_Documentation_Systematic_Reconciliation_2026-11-01.md`
- `01_MildMate_Marketing/09_Handoffs/Phase_01-17_Systematic_Reconciliation_2026-09-19.md`
- `01_MildMate_Marketing/09_Handoffs/Make_com_Retirement_Systematic_Reconciliation_2026-10-01.md`

Status summary:

- **Implemented/deployed:** Phases 01–11, 13, 14, 17
- **Open:** Phase 12 (Google Ads attribution closure)
- **Pending:** Phases 15–16

Additional release (2026-11-01, later pass) — **GA4 Lead Acquisition deployed to production**: migration `061_ga4_lead_acquisition.sql` applied to prod D1 (`ga4_lead_acquisition_daily` + `analysis_ga4_lead_freshness` view); Pages deployment `c023f9fd-7617-475c-8534-76742ac5e738`; collector version `9a093445-2457-4849-9a3b-79454b260307`. New `POST /api/v1/ga4/leads/upsert` (bearer), `GET /api/admin/analysis/ga4-leads` (admin), and a Data Analyst SEO-tab "GA4 Lead Acquisition" card. Lead events `generate_lead` + `quote_request` from canonical website property `308922589` only, inside the existing Monday GA4 dispatch — cron unchanged, no manual sync or backfill. First lead data lands with the next scheduled GA4 run; closure pending owner's authenticated browser acceptance. Evidence: `00_Issue/ga4-lead-acquisition-20261101/` and `09_Handoffs/Phase_Documentation_Systematic_Reconciliation_2026-11-01.md` (Pass 2). This extends Phase 10 (GA4) only; no other phase status changed.

---

# 1. Business Objective

The system should answer one operating question:

> **What should MildMate do next to increase profitable sales?**

The final system should help answer:

1. **WHAT** product or niche should MildMate push?
2. **WHERE** should it be promoted?
3. **WHY** does the data support that action?
4. **HOW MUCH** should MildMate spend or test?
5. **WHAT NEXT** should the team do?
6. **DID IT WORK** after implementation?

The system should prioritize actionable business decisions rather than simply display data.

---

# 2. Current Architecture

Current working sales architecture:

```text
Sales / Order Sources
        ↓
Notion OrderList
        ↓
Human-controlled Notion updates + mapping confirmation
        ↓
Cloudflare Worker cron pipeline (`mildmate-marketing-sync` + source collectors)
        ↓
Cloudflare D1
        ↓
sales_orders + sales_order_items
```

Current product identity architecture:

```text
Website Product Admin
        ↓
Cloudflare D1
        ↓
Canonical products.id
        ↓
Google Product Master
(Admin / Review Mirror)
```

Core rule:

> **Cloudflare D1 remains the source of truth.**

Google Sheets, Notion, dashboards, and AI should not become competing databases.

---

# 3. Target Marketing Decision Architecture

The next evolution should be:

```text
RAW DATA
Products
Sales
Search
Website Traffic
Marketplace Performance
Ads
        ↓
NORMALIZED D1 FACT TABLES
        ↓
ANALYTICAL LAYER
        ↓
BUSINESS METRICS
        ↓
OPPORTUNITY / CONFIDENCE SCORING
        ↓
MARKETING COMMAND CENTER
        ↓
AI ANALYST
        ↓
RECOMMENDED ACTION
        ↓
HUMAN APPROVAL
        ↓
EXECUTION
        ↓
RESULT MEASUREMENT
```

The most important new layer is:

> **Analytical Layer between raw D1 data and business decisions.**

---

# 4. Core Technology Stack

| Layer | Recommended Tool / Stack | Role |
|---|---|---|
| Canonical database | **Cloudflare D1** | Product identity, sales facts, marketing facts, analytical tables, history |
| API layer | **Cloudflare Workers / Pages Functions** | Controlled authenticated read/write access to D1 |
| Integration / ETL | **Cloudflare Worker crons** | Source collection, normalization, scheduling, synchronization |
| Operational order system | **Notion OrderList** | Human-friendly sales operations and product mapping workflow |
| Product admin mirror | **Google Sheets — MildMate Product Master** | Human review / controlled product overview |
| Product website | **MildMate website + D1 product database** | Canonical product source |
| Development | **Droid CLI + VS Code + GitHub** | Backend, SQL, Worker API, dashboard development |
| Hosting | **Cloudflare Pages** | Marketing Command Center / admin application |
| Analytics dashboard | **Custom web app** | Human-readable analysis and decision UI |
| AI interpretation | **Gemini / ChatGPT / AI analyst layer** | Explanation, opportunity interpretation, recommended actions |
| Automation alerts | **Worker cron telemetry + Slack/Email/Notion if needed** | Exceptions, sync errors, important opportunities |
| Marketing sources | **GSC, GA4, Etsy, Google Ads, Meta Ads, marketplace reports** | Performance data |

---

# 5. Data Model Strategy

## 5.1 Canonical Product Identity

Use:

```text
products.id
```

as the permanent Product_ID.

Every defensible product-level fact should map to this ID.

Do not use product title, URL slug, marketplace title, or SKU text as the main analytical key.

Example:

```text
Product_ID 26
BedBridge Connector
        ├── Website
        ├── Etsy
        ├── Shopee
        ├── Sales
        ├── GSC
        ├── GA4
        └── Ads
```

---

## 5.2 Raw Sales Tables

Existing production tables:

```text
sales_orders
sales_order_items
sync_runs
```

These remain the canonical normalized sales facts.

Important revenue rule:

```text
EXACT
UNALLOCATED
```

### EXACT

Use only when the source provides the real item-level amount.

### UNALLOCATED

Use when order total is known but the exact item split is not known.

Never:

- equal-split historical order totals
- estimate line revenue
- ask AI to invent line revenue
- infer historical item price from current product prices

---

# 6. Build an Analytical Layer in D1

Do not make dashboards repeatedly calculate everything from raw tables.

Create reusable analytical views or summary tables.

> **Delivered status (2026-10-28):** the first-set views are live in production D1 (migration `042_marketing_analysis_layer.sql`, 10 views) and consumed by the Data Analyst dashboard. GSC/GA4/Etsy/Google Ads analytical tables are also live (migrations 046–050, 055–056). The custom quote funnel (Tier 1, 2026-10-28) is served on demand via `GET /api/admin/analysis/quotes` from `custom_quotes` + `orders.quote_id` rather than a materialized view.

Recommended first set:

```text
analysis_sales_daily
analysis_product_participation
analysis_product_channel
analysis_sales_28d
analysis_sales_90d
analysis_data_quality
```

Later:

```text
analysis_gsc_product_daily
analysis_ga4_product_daily
analysis_etsy_product_daily
analysis_ads_product_daily
analysis_product_opportunity
analysis_marketing_action_results
```

---

# 7. Recommended Analytical Tables

## 7.1 `analysis_sales_daily`

Purpose:

Daily business-level and channel-level sales summary.

Suggested fields:

```text
date
channel
orders
units
order_revenue
average_order_value
mapped_orders
unmapped_orders
exact_revenue_items
unallocated_revenue_items
```

---

## 7.2 `analysis_product_participation`

Purpose:

Measure product demand even when exact item revenue is unavailable.

Suggested fields:

```text
product_id
period_start
period_end
orders_containing_product
quantity
channel_count
co_purchase_count
attach_rate
```

Example:

```text
100 Family Fitted Sheet orders
32 also include BedBridge

BedBridge attach rate = 32%
```

---

## 7.3 `analysis_product_channel`

Purpose:

Compare each product across sales channels.

Suggested fields:

```text
product_id
channel
period
orders
units
exact_revenue
order_participation
average_order_value
growth_28d
growth_90d
```

Later add:

```text
traffic
clicks
conversion_rate
ad_spend
CPA
ROAS
```

---

## 7.4 `analysis_sales_28d`

Purpose:

Fast decision-ready product performance summary.

Suggested fields:

```text
product_id
orders_28d
units_28d
exact_revenue_28d
order_participation_28d
growth_vs_previous_28d
top_channel
```

---

## 7.5 `analysis_data_quality`

Purpose:

Ensure recommendations are based on trustworthy data.

Suggested fields:

```text
last_sales_sync_at
mapped_order_pct
unmapped_order_count
exact_revenue_pct
unallocated_revenue_pct
missing_product_id_count
sync_error_count
source_freshness
```

The system should expose data confidence before giving strong recommendations.

---

# 8. Standard Marketing Metric Dictionary

Create one documented definition for every KPI.

## Sales

```text
Order Count
Revenue
Units
Average Order Value
Orders by Channel
Revenue by Channel
```

## Product

```text
Orders Containing Product
Quantity Sold
Attach Rate
Co-Purchase Frequency
Exact Product Revenue
Product Growth 28d
Product Growth 90d
```

## SEO / GSC

```text
Impressions
Clicks
CTR
Average Position
Query Growth
Landing Page Growth
```

## Website / GA4

```text
Sessions
Product Views
Add to Cart
Checkout
Purchase
Conversion Rate
```

## Marketplace

```text
Views
Visits
Favorites
Orders
Revenue
Conversion
```

## Paid Ads

```text
Spend
Clicks
Conversions
CPA
ROAS
Contribution Profit
```

## Data Quality

```text
Mapped %
Exact Revenue %
Unallocated Revenue %
Last Sync
Collector Freshness
API Error Count
```

---

# 9. Profitability Layer

Revenue alone is not enough for marketing budget decisions.

Eventually add controlled cost fields such as:

```text
product_id
estimated_unit_cost
average_shipping_cost
marketplace_fee_rate
payment_fee_rate
gross_margin_target
```

Then calculate:

```text
Contribution Revenue
- Production Cost
- Shipping
- Marketplace / Payment Fees
- Advertising
= Contribution Profit
```

This should become the basis for budget allocation rather than revenue alone.

---

# 10. Human-Friendly Monitoring Layer

Before the full Marketing Command Center, create a simple read-only Sales Monitor.

Recommended page:

```text
Marketing
└── Sales Monitor
```

Show:

```text
Orders in D1
Items in D1
Revenue
Mapped %
Unallocated Revenue %
Last Sync
API Errors
```

Recommended table:

| Date | Channel | Order | Total | Product | Qty | Mapping | Revenue Status |
|---|---|---|---:|---|---:|---|---|

Recommended filters:

```text
Date
Channel
Product
Order Status
Mapping Status
Revenue Status
```

Technology:

```text
Cloudflare Pages
+
Worker API
+
D1 read-only queries
+
existing MildMate admin/web app
```

---

# 11. Marketing Command Center

After the analytical layer is stable, build the main dashboard.

Recommended views:

## 11.1 Executive

Show:

```text
Orders
Revenue
AOV
Top Products
Top Channels
28-Day Trend
Major Alerts
```

## 11.2 Product Opportunities

Example:

| Product | Demand | Sales | Conversion | Trend | Recommendation |
|---|---:|---:|---:|---:|---|
| Marine Fitted Sheet | High | High | Good | ↑ | Push |
| BedBridge | Medium | Strong attach | Good | ↑ | Bundle |
| Pet Fitted Sheet | High traffic | Low | Weak | → | Fix conversion |

## 11.3 Channel Performance

Compare:

```text
Website
Etsy
Shopee
Lazada
TikTok
Line
WhatsApp
Facebook
```

## 11.4 Data Quality

Show:

```text
Last Sync
Mapped %
Unmapped Orders
UNALLOCATED Revenue %
Collector Freshness
API Errors
Missing Product_ID
```

---

# 12. Decision Engine

Only build automated scoring after the analytical layer is stable.

Recommended conceptual score:

```text
Opportunity Score

Demand             25%
Sales Momentum     20%
Conversion         15%
Profitability      20%
Channel Fit        10%
Strategic Fit      10%
```

Also calculate:

```text
Data Confidence Score
```

Example:

```text
Opportunity Score = 84
Confidence = High
```

or:

```text
Opportunity Score = 84
Confidence = Low

Reason:
- 45% orders unmapped
- 60% product revenue unallocated
```

The Decision Engine should never hide weak data quality.

---

# 13. Recommendation Output Format

The system should produce recommendations in a consistent structure.

Example:

```text
PRODUCT:
Marine Fitted Sheet

ACTION:
Push

CHANNEL:
Etsy + Google Search

WHY:
Search impressions +31% over 28 days
Etsy orders +18%
Conversion remains above product median

BUDGET:
฿3,000 test

TEST PERIOD:
14 days

SUCCESS TARGET:
≥15% order growth
CPA ≤ ฿450

CONFIDENCE:
High

NEXT REVIEW:
After 14 days
```

---

# 14. Marketing Action History / Feedback Loop

Create a table such as:

```text
marketing_actions
```

Suggested fields:

```text
id
product_id
channel
recommendation_type
recommendation
reason
baseline_metrics_json
budget
start_date
end_date
status
result_metrics_json
result
confidence
created_at
reviewed_at
```

Purpose:

Answer:

> **Did the recommendation work?**

Without a feedback loop, AI recommendations cannot improve systematically.

---

# 15. Recommended Source Collection Order

Do not add every source at once.

Recommended sequence:

```text
1. Sales analytical layer
2. Sales / Data Quality Monitor
3. Product Mapping completion
4. Historical sales backfill
5. GSC
6. GA4
7. Etsy performance
8. Google Ads
9. Meta Ads
10. Shopee/Lazada structured enrichment
```

Reason:

Sales should be stable first because product demand and actual purchases are core decision inputs.

---

# 16. Make.com Scenario Strategy

Keep scenarios separate by responsibility.

Recommended structure:

```text
01 — Notion Order Product Mapper
02 — Notion OrderList → D1 Sales Sync
03 — Product Mapping Review / Learning
04 — GSC → D1
05 — GA4 → D1
06 — Etsy Performance → D1
07 — Google Ads → D1
08 — Meta Ads → D1
09 — D1 Product Master → Google Product Master
10 — Daily Data Quality / Reconciliation
```

Avoid one giant Make scenario.

---

# 17. Worker API Strategy

Make.com should not receive unrestricted SQL access.

Use controlled endpoints such as:

```text
POST /api/v1/sales/orders/upsert
GET  /api/v1/sales/orders/...
GET  /api/v1/health
```

Future routes can include:

```text
GET  /api/v1/analysis/sales-summary
GET  /api/v1/analysis/products
GET  /api/v1/analysis/product/{id}
GET  /api/v1/analysis/data-quality

POST /api/v1/marketing/gsc/upsert
POST /api/v1/marketing/ga4/upsert
POST /api/v1/marketing/etsy/upsert
POST /api/v1/marketing/ads/upsert
```

All write endpoints should remain:

- authenticated
- idempotent
- validated
- auditable

---

# 18. AI Role

AI should not own facts.

AI should consume:

```text
Canonical product data
+
Analytical metrics
+
Opportunity scores
+
Data confidence
+
Historical recommendation results
```

AI should perform:

```text
Interpretation
Explanation
Prioritization
Recommendation drafting
Action planning
Post-action analysis
```

AI should NOT:

- invent Product_ID
- invent revenue
- silently estimate missing financial data
- overwrite canonical facts
- make strong recommendations when data confidence is poor

---

# 19. Recommended Implementation Sequence

## Step 1 — Production Sales Visibility

Build:

```text
analysis_sales_daily
analysis_product_participation
analysis_product_channel
analysis_sales_28d
analysis_data_quality
```

Then create a simple Sales Monitor.

**Technology:**

```text
Cloudflare D1
Cloudflare Worker
Cloudflare Pages
Droid CLI
VS Code
GitHub
```

---

## Step 2 — Complete Product Mapping Automation

Build / finish:

```text
MildMate - Notion Order Product Mapper
```

Then connect:

```text
Unmapped order
        ↓
Product mapping
        ↓
Mapped
        ↓
Existing D1 Sales Sync
```

**Technology:**

```text
Notion
Make.com
Cloudflare Worker
Cloudflare D1
```

---

## Step 3 — Historical Sales Backfill

Process historical orders in controlled batches.

Rules:

- preserve verified mappings
- no duplicate source order
- no invented revenue split
- store unmapped/review-required items safely

---

## Step 4 — GSC Collector

Collect:

```text
date
query
page
clicks
impressions
ctr
position
```

Map landing pages to Product_ID where defensible.

**Technology:**

```text
Google Search Console
Make.com
Worker API
D1
```

---

## Step 5 — GA4 Collector

Collect:

```text
date
landing page
sessions
product views
add-to-cart
checkout
purchase
```

Map page/product identity to Product_ID.

**Technology:**

```text
GA4
Make.com
Worker API
D1
```

---

## Step 6 — Etsy Performance

Use stable Etsy Listing ID.

Map:

```text
Etsy Listing ID
        ↓
D1 Product_ID
```

Collect:

```text
views
visits
favorites
orders
revenue
conversion
```

---

## Step 7 — Paid Marketing

Add:

```text
Google Ads
Meta Ads
```

Collect:

```text
spend
clicks
conversions
revenue
CPA
ROAS
```

Then add profitability.

---

## Step 8 — Opportunity Engine

Build:

```text
analysis_product_opportunity
```

Inputs:

```text
sales momentum
search demand
website conversion
marketplace performance
profitability
channel fit
strategic fit
data confidence
```

---

## Step 9 — Full Marketing Command Center

Build web interface for:

```text
Executive
Products
Channels
Opportunities
Data Quality
Recommendations
Marketing Actions
Results
```

---

## Step 10 — AI Analyst + Feedback Loop

AI generates:

```text
WHAT
WHERE
WHY
HOW MUCH
WHAT NEXT
DID IT WORK
```

Store approved actions and result history in D1.

---

# 20. Immediate Priority

The immediate next technical milestone should be:

```text
Existing D1 Sales Data
        ↓
Analytical Sales Layer
        ↓
Readable Sales / Data Quality Monitor
```

This is more valuable now than adding another raw data source.

The system should move from:

```text
Data ingestion
```

to:

```text
Data ingestion
        ↓
Data analysis
        ↓
Business metrics
        ↓
Decision support
```

before expanding aggressively into additional collectors.

---

# 21. Definition of Done for the First Analysis Milestone

The first milestone is complete when MildMate can open a normal web page and answer, without Droid CLI or SQL:

1. How many real orders are in D1?
2. What is total sales for the selected period?
3. Which channels generated the orders?
4. Which Product_IDs appeared most frequently?
5. Which products are commonly purchased together?
6. What percentage of orders are mapped?
7. What percentage of item revenue is EXACT vs UNALLOCATED?
8. When did the sales pipeline last sync?
9. Are there any sync/data-quality problems?
10. Can the result be filtered by date, product, channel, and order status?

Once this is working reliably, MildMate is ready to add GSC, GA4, Etsy performance, and ad data into the same analytical framework.

---

# 22. Guiding Principle

> **Do not build a dashboard to show data. Build an analytical system that converts trusted data into a clear next action.**

---

# 23. Custom Quote Conversion Pipeline — Tier Plan (2026-10-28)

**Status legend:** ✅ complete/verified · 🟡 deployed but gated open · ⬜ pending

### Why this exists

Read-only prod D1 analysis (2026-10-27): custom-quote demand is growing while conversion is weak — 94 quotes from 64 unique emails since June 2026 (26 in October alone); top quoted product `custom-waterproof-cushion-protector` (28 quotes — not in the web catalog); only ~8 of 64 quote emails converted to orders (~12%); status taxonomy is effectively approved (48) vs archived (46) with few explicit rejects. This pipeline turns that demand into measurable, improvable conversion within the existing analytical-layer architecture (D1 stays source of truth; no new external systems).

### Tier 0 — Manual Follow-up Ritual (✅ Complete, 2026-10-27)

- Worklist generated from prod D1: 38 approved-unconverted quotes (5 still active, 33 expired) → `00_Issue/Quote_Followup_Worklist_2026-10-27.md` (generator: `scripts/build-quote-worklist.mjs`).
- Manual outreach email templates A + B; twice-weekly follow-up ritual. Human-operated only — no automation, no new email risk.

### Tier 1 — Funnel KPIs + Exact Attribution + One Pre-Expiry Reminder (✅ Deployed 2026-10-28)

Commit `9e8e87f`; Pages production deployment `4aa4a327`; cron Worker `mildmate-cron` version `5baf2a7e`; migration `059_quote_tier1_pipeline.sql` applied to prod D1.

- **1A — Funnel KPIs (analytical layer):** `GET /api/admin/analysis/quotes` returns summary counts (total / new-7d / new-30d / active / approved / approved-unconverted / expiring-7d / expired), conversion (exact quote_id-attributed % reported separately from legacy email-matched count — never mixed), top quoted products with exact conversion, and at-risk approved quotes expiring ≤7d (no PII). Rendered as the "Custom Quote Funnel (Tier 1)" card on the Data Analyst dashboard, wired into global date filters. Computed on demand from `custom_quotes` + `orders` (not materialized as `analysis_*` views).
- **1B — Pre-expiry follow-up automation:** one stage in `mildmate-cron`. Ships DISABLED (`quote_followup_enabled=false` in prod `recovery_config`). Guardrails honor the data-quality principle of this plan — the system must never over-email: exact quote_id conversion check (skip converted quotes), per-quote idempotency (`UNIQUE(quote_id, stage)` claim in `quote_followup_events`), per-email cooldown (default 24h), daily cap (default 20), minimum quote age (default 72h). Single gentle reminder with the quote magic link — no discount, no pressure copy. Configurable in Super Admin → Send Offers → Quote Follow-up card.
- **1C — Exact attribution:** `orders.quote_id` (+ index) persisted by the webhook on every order row (snapshot + metadata paths, schema self-heal). Checkout already forwarded quote refs via Stripe metadata + `checkout_session_snapshots`; Tier 1 closes the loop on the order row. Historical orders attribute via email matching only — reported separately.
- **Rollout:** verify the funnel card ~24h → enable follow-up at cap 10/day → raise to 20/day once first sends look clean in `quote_followup_events`.

### Tier 2 — Opportunity Engine Input (⬜ Pending)

Feed quote-demand metrics (quote volume by product, exact conversion rate, at-risk expiring value) into the Phase 14 opportunity model as a demand/momentum signal. Blocked until Tier 1 data matures (quote_id-attributed order rows need time to accumulate).

### Fit with this plan's rules

- D1 remains the single source of truth; attribution facts live on `orders` rows, config in `recovery_config`, audit trail in `quote_followup_events`.
- Revenue rules respected: quote conversion counts orders, never invents line revenue.
- The funnel endpoint exposes its own data confidence implicitly (exact vs legacy conversion reported separately), consistent with "never hide weak data quality."
