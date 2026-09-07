# MildMate Marketing Decision System
## Data Analyst Dashboard — Phased Implementation Checklist & Droid CLI Build Guide

**Prepared:** 2026-09-07  
**Project:** MildMate Marketing Decision System  
**Existing super-admin area:** `https://www.mildmate.com/super-admin/marketing/`  
**Repository:** existing MildMate `Re-build_web` project  
**Planning folder:** `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`  
**Git strategy:** new feature branch  
**Internal feature area:** `super-admin/marketing` + `api/analysis`  
**Deployment:** existing Cloudflare Pages project  
**Canonical database:** existing Cloudflare D1  
**Implementation style:** same codebase, separate feature area, separate Droid CLI sessions by phase

---

# 1. Clarified Product / UI Architecture

## Confirmed Implementation Decisions

```text
Project root:
D:/00_Mildmate/Re-build_web/

Planning / handoff folder:
D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/

Git:
New feature branch = feature/marketing-data-analyst

UI feature area:
super-admin/marketing

Analysis API feature area:
api/analysis

Database:
Same Cloudflare D1

Deployment:
Same Cloudflare Pages project

Repository:
Same Re-build_web repository
```

These decisions should not be redesigned during normal implementation unless a verified technical blocker is found.


MildMate already has a Super Admin marketing area:

```text
https://www.mildmate.com/super-admin/marketing/
```

Do **not** create a second unrelated admin application.

Use the existing Super Admin system as the parent shell.

Recommended hierarchy:

```text
/super-admin/
    ↓
/super-admin/marketing/
    ↓
Marketing Command Center
    ├── Executive
    ├── Data Analyst
    ├── Products
    ├── Channels
    ├── Opportunities
    ├── Recommendations
    └── Data Quality
```

Recommended Data Analyst route:

```text
https://www.mildmate.com/super-admin/marketing/data-analyst/
```

Alternative acceptable route if it better matches the existing router:

```text
/super-admin/marketing/analytics/
```

The existing project structure and router should determine the final route after Droid performs a read-only inspection.

---

# 2. Difference Between Super Admin Marketing and Data Analyst Dashboard

## Super Admin Marketing

Purpose:

> Give the business owner a concise decision view.

Should eventually answer:

```text
What should we push?
Where?
Why?
How much?
What next?
Did it work?
```

Typical content:

- executive KPIs
- top opportunities
- alerts
- recommendations
- strategic priorities
- approved marketing actions

---

## Data Analyst Dashboard

Purpose:

> Let an analyst inspect, validate, filter, compare, and explain the underlying data used by the Marketing Decision System.

It should prioritize:

- detailed sales tables
- product participation
- channel comparison
- trend analysis
- exact vs unallocated revenue
- mapping coverage
- source freshness
- sync health
- data-quality exceptions
- drill-down by Product_ID
- drill-down by source order
- auditable metric definitions

It should **not** primarily be an executive dashboard.

---

# 3. Technical Architecture

```text
Notion OrderList
      ↓
Make.com
      ↓
Cloudflare Worker API
      ↓
Cloudflare D1
      ↓
Raw canonical facts
      ↓
D1 Analytical Layer
      ↓
Read-only Analysis API
      ↓
Super Admin — Data Analyst Dashboard
      ↓
Decision Engine
      ↓
Marketing Command Center / AI Analyst
```

---

# 4. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Database | Cloudflare D1 | Canonical products, sales, marketing facts, analytical views/tables |
| API | Cloudflare Workers / Pages Functions | Controlled authenticated data access |
| Automation | Make.com | Ingestion, normalization, reconciliation |
| Operational orders | Notion OrderList | Human operations + mapping workflow |
| Admin UI | Existing MildMate Super Admin | Data Analyst + Marketing Command Center |
| Frontend hosting | Cloudflare Pages | Existing production deployment |
| Development | Droid CLI | Implementation agent |
| Local development | VS Code / PowerShell | Inspect, test, Git |
| Version control | GitHub | Feature branches, review, deployment source |
| Product mirror | Google Sheets | Product admin/review mirror |
| Future marketing sources | GSC, GA4, Etsy, Google Ads, Meta Ads | Performance inputs |
| AI | ChatGPT / Gemini | Interpretation and recommendation support, never canonical facts |

---

# 5. Confirmed Repository / Project Strategy

The following decisions are **fixed for this implementation**.

## Project Root

```text
D:/00_Mildmate/Re-build_web/
```

Use the **same existing MildMate website repository**.

Do not create a separate repository or a separate Cloudflare project.

## Planning / Handoff Folder

Keep all Marketing Decision System plans, checklists, Droid handoffs, metric definitions, and implementation notes under:

```text
D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/
```

Recommended contents:

```text
01_MildMate_Marketing/
│
├── 00_Architecture/
├── 01_Data_Analyst/
├── 02_Metric_Dictionary/
├── 03_D1_Analysis/
├── 04_API/
├── 05_Dashboard/
├── 06_Data_Quality/
├── 07_Product_Mapping/
├── 08_Marketing_Collectors/
└── 09_Handoffs/
```

Do not move live application code into this planning folder.

The folder is for:

- plans
- task checklists
- architecture notes
- Droid handoffs
- test notes
- reconciliation reports
- implementation summaries

## Internal Feature Area

Confirmed logical feature areas:

```text
super-admin/marketing
api/analysis
```

The exact physical file paths must follow the existing repository conventions discovered during Phase 0.

Conceptually:

```text
Re-build_web/
│
├── public/
│   └── super-admin/
│       └── marketing/
│           ├── ...
│           └── data-analyst/
│
├── workers/
│   └── api/
│       └── analysis/
│
├── migrations/
│
└── 01_MildMate_Marketing/
```

Important spelling:

```text
super-admin
```

not:

```text
super-addmin
```

## Infrastructure Decisions

```text
Same D1:                    YES
Same Cloudflare Pages:      YES
Same website repository:    YES
Separate repository:        NO
Separate Cloudflare app:    NO
```

---

# 6. Confirmed Git / Droid Working Strategy

Create a new Git feature branch before implementation.

Recommended branch:

```text
feature/marketing-data-analyst
```

Working pattern:

```text
master
   ↓
feature/marketing-data-analyst
   ↓
Phase-by-phase development
   ↓
local / staging verification
   ↓
review
   ↓
merge to master
   ↓
production deployment
```

Use:

```text
Same repository
+
Same D1
+
Same Cloudflare Pages project
+
New Git branch
+
Separate Droid session for each major phase
+
Small commits per phase
```

Do not use one giant Droid session for the entire system.

Each Droid session should work from:

```text
D:/00_Mildmate/Re-build_web/
```

and should save planning/handoff documentation under:

```text
D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/
```

---

# 7. Status Legend

```text
[x] COMPLETED / VERIFIED
[ ] CURRENT / TO BUILD
[ ] FUTURE
[!] DO NOT CHANGE WITHOUT REVIEW
```

---

# PHASE 0 — READ-ONLY ARCHITECTURE AUDIT

## Goal

Understand the existing Super Admin marketing implementation before creating code.

## Checklist

- [ ] Open the existing `Re-build_web` project.
- [ ] Confirm current Git branch and clean/dirty working tree.
- [ ] Inspect current Super Admin authentication.
- [ ] Inspect routing for:
  - `/super-admin/`
  - `/super-admin/marketing/`
- [ ] Inspect the existing marketing page layout and navigation.
- [ ] Identify shared Super Admin:
  - header
  - sidebar
  - navigation
  - cards
  - tables
  - forms
  - JavaScript utilities
  - CSS
- [ ] Inspect current Worker / Pages Functions routing.
- [ ] Inspect current D1 bindings.
- [ ] Inspect existing Sales API implementation.
- [ ] Inspect production tables:
  - `products`
  - `sales_orders`
  - `sales_order_items`
  - `sync_runs`
- [ ] Inspect existing migrations; do not modify them.
- [ ] Confirm current latest migration number.
- [ ] Identify existing API authentication patterns suitable for Super Admin read APIs.
- [ ] Determine best route:
  - `/super-admin/marketing/data-analyst/`
  - or existing-router equivalent.
- [ ] Produce an audit report before making changes.

## Definition of Done

Droid reports:

```text
Existing UI structure
Existing auth
Existing routing
Existing API structure
Existing D1 structure
Recommended files to add/change
Risks
Exact implementation plan for Phase 1
```

No files changed.

---

# PHASE 1 — METRIC CONTRACT & ANALYTICAL DATA DESIGN

## Goal

Define exactly what each analytical metric means before building the dashboard.

## Checklist

- [ ] Create a Marketing Analytics Metric Dictionary.
- [ ] Define:
  - Order Count
  - Order Revenue
  - Units
  - AOV
  - Orders Containing Product
  - Product Quantity
  - Exact Product Revenue
  - Attach Rate
  - Co-purchase rate
  - Mapping %
  - Exact Revenue %
  - Unallocated Revenue %
- [ ] Explicitly separate:
  - order metrics
  - product participation metrics
  - exact product revenue metrics
- [ ] Define valid commercial order statuses.
- [ ] Define test-order exclusion rules.
- [ ] Define cancelled-order exclusion rules.
- [ ] Define canonical date/time handling.
- [ ] Define Product_ID as the main analytical product key.
- [ ] Define source/channel normalization.
- [ ] Review the design against existing `sales_orders` and `sales_order_items`.

## Required Rule

Never fabricate item-level revenue.

```text
EXACT → real line amount
UNALLOCATED → line_revenue = NULL
```

## Definition of Done

A developer-readable metric contract exists and every dashboard KPI has an explicit definition.

---

# PHASE 2 — D1 SALES ANALYTICAL LAYER

## Goal

Create reusable database-level analytical structures so the UI does not repeatedly reconstruct business logic.

## First analytical objects

Recommended:

```text
analysis_sales_daily
analysis_product_participation
analysis_product_channel
analysis_sales_28d
analysis_sales_90d
analysis_data_quality
```

Droid must first decide whether each should be:

```text
SQL VIEW
or
summary table
```

based on D1 performance and existing query volume.

Start with SQL views where practical.

## Checklist

- [ ] Create a new migration; never edit old production migrations.
- [ ] Implement daily sales summary.
- [ ] Implement product participation.
- [ ] Implement product × channel summary.
- [ ] Implement 28-day product analysis.
- [ ] Implement 90-day product analysis.
- [ ] Implement data-quality analysis.
- [ ] Exclude known test data from commercial metrics.
- [ ] Respect cancelled/non-commercial states.
- [ ] Count unique orders correctly.
- [ ] Do not confuse order rows with item rows.
- [ ] Keep UNALLOCATED revenue out of exact product revenue.
- [ ] Validate all Product_ID joins.
- [ ] Test against known sample orders.

## Definition of Done

Droid can query D1 and return consistent answers for:

1. total commercial orders
2. total commercial revenue
3. orders by channel
4. top products by participation
5. exact vs unallocated item counts
6. mapping coverage
7. recent sync health

---

# PHASE 3 — READ-ONLY ANALYSIS API

## Goal

Give the Super Admin dashboard stable read endpoints rather than direct browser access to D1.

## Suggested endpoints

Final names should follow existing API conventions.

Conceptually:

```text
GET /api/super-admin/marketing/analysis/summary
GET /api/super-admin/marketing/analysis/sales
GET /api/super-admin/marketing/analysis/products
GET /api/super-admin/marketing/analysis/product/:id
GET /api/super-admin/marketing/analysis/channels
GET /api/super-admin/marketing/analysis/data-quality
```

## Checklist

- [ ] Reuse existing Super Admin authentication.
- [ ] Read from analytical views/tables.
- [ ] Add date filters.
- [ ] Add channel filter.
- [ ] Add Product_ID filter.
- [ ] Add status filter where useful.
- [ ] Validate query parameters.
- [ ] Use bounded result sets / pagination.
- [ ] Return machine-readable errors.
- [ ] Do not expose D1 credentials.
- [ ] Do not expose private Make.com or Worker secrets.
- [ ] Do not return customer PII unless a specific operational need is approved.
- [ ] Test unauthorized requests.
- [ ] Test authenticated requests.
- [ ] Test empty-data states.

## Definition of Done

The dashboard can retrieve all MVP analytics through authenticated read-only APIs.

---

# PHASE 4 — DATA ANALYST DASHBOARD MVP

## Goal

Build a user-friendly page that eliminates the need to ask Droid CLI for normal D1 sales inspection.

## Recommended route

```text
/super-admin/marketing/data-analyst/
```

## MVP Header KPIs

Show:

```text
Commercial Orders
Order Revenue
Units
Average Order Value
Mapped %
Unallocated Revenue %
Last Sales Sync
Data Quality Status
```

## MVP Filters

```text
Date range
Channel
Product
Order status
Mapping status
Revenue status
```

## MVP Tables

### Sales Detail

Columns:

```text
Date
Channel
Source Order ID
Status
Order Total
Product
Product_ID
Quantity
Mapping Status
Revenue Status
```

### Product Participation

Columns:

```text
Product_ID
Product
Orders Containing Product
Units
Top Channel
28d Trend
Exact Revenue
Revenue Coverage
```

### Channel Analysis

Columns:

```text
Channel
Orders
Revenue
Units
AOV
Mapped %
```

## Checklist

- [ ] Reuse existing Super Admin shell.
- [ ] Add navigation entry: Data Analyst.
- [ ] Build responsive KPI cards.
- [ ] Build filters.
- [ ] Build sales table.
- [ ] Build product participation table.
- [ ] Build channel table.
- [ ] Add loading state.
- [ ] Add empty state.
- [ ] Add API-error state.
- [ ] Add data freshness indicator.
- [ ] Ensure mobile/tablet usability where practical.
- [ ] Do not expose raw customer PII.
- [ ] Match existing MildMate Super Admin visual language.

## Definition of Done

A user can answer the core D1 sales questions without SQL or Droid CLI.

---

# PHASE 5 — DATA QUALITY & SYNC MONITOR

## Goal

Make data reliability visible before the Decision Engine is allowed to make strong recommendations.

## Dashboard metrics

```text
Last successful sales sync
Mapped order %
Unmapped order count
Exact revenue %
Unallocated revenue %
Missing Product_ID count
Sync error count
Source freshness
Orders received by channel
```

## Checklist

- [ ] Surface `sync_runs`.
- [ ] Detect stale sales sync.
- [ ] Detect missing Product_ID.
- [ ] Detect unexpected source labels.
- [ ] Detect duplicate-risk anomalies.
- [ ] Detect orders with no items.
- [ ] Detect suspicious zero/null totals where inappropriate.
- [ ] Add severity:
  - OK
  - Warning
  - Critical
- [ ] Add human-readable explanations.
- [ ] Add links/drill-down to affected records where safe.

## Definition of Done

The analyst can tell whether the data is trustworthy before using it for decisions.

---

# PHASE 6 — PRODUCT MAPPING AUTOMATION COMPLETION

## Goal

Increase the percentage of orders that can participate in product-level analysis.

## System

```text
Unmapped Notion order
      ↓
Product Mapping Resolver
      ↓
D1 Product_ID
      ↓
D1_Product_Map
      ↓
Product_Mapping_Status = Mapped
      ↓
Existing Sales Sync
```

## Checklist

- [ ] Build/finish `MildMate - Notion Order Product Mapper`.
- [ ] Preserve already verified mappings.
- [ ] Use selected marketplace variation above parent listing title.
- [ ] Add Review Required handling.
- [ ] Save human corrections as reusable mapping memory where implemented.
- [ ] Verify ID 33 and ID 34 are part of the approved product catalog.
- [ ] Update mapping documentation from earlier 30-product assumptions.
- [ ] Measure mapping coverage.
- [ ] Surface mapping coverage in Data Analyst dashboard.

---

# PHASE 7 — HISTORICAL SALES BACKFILL & RECONCILIATION

## Goal

Create enough historical sales data to support meaningful trends.

## Checklist

- [ ] Map historical OrderList orders in controlled batches.
- [ ] Do not replay history through the live watcher accidentally.
- [ ] Use stable `(source_system, source_order_id)` identity.
- [ ] Preserve idempotency.
- [ ] Preserve exact order totals.
- [ ] Keep unknown line revenue UNALLOCATED.
- [ ] Re-run corrected mappings safely.
- [ ] Reconcile historical counts against Notion.
- [ ] Reconcile channel totals.
- [ ] Document remaining data gaps.

## Definition of Done

Historical coverage is sufficient for:

```text
28-day trend
90-day trend
product participation
channel comparison
co-purchase analysis
```

---

# PHASE 8 — GSC ANALYTICS

## Goal

Add organic search demand.

## Collect

```text
date
query
page
clicks
impressions
ctr
position
```

## Checklist

- [ ] Design D1 GSC fact table.
- [ ] Build Make.com collector.
- [ ] Create authenticated ingestion endpoint.
- [ ] Preserve query + page source identity.
- [ ] Map product landing pages to Product_ID where defensible.
- [ ] Build analytical GSC views.
- [ ] Add Data Analyst GSC section.
- [ ] Add freshness monitoring.

---

# PHASE 9 — GA4 ANALYTICS

## Goal

Add website behavior and conversion funnel data.

## Collect

```text
sessions
landing page
product views
add-to-cart
checkout
purchase
conversion
```

## Checklist

- [ ] Define GA4 dimensions/metrics.
- [ ] Build Make collector.
- [ ] Build D1 fact table.
- [ ] Map product pages to Product_ID.
- [ ] Reconcile GA4 purchase counts with canonical sales without double counting revenue.
- [ ] Add Data Analyst website funnel section.
- [ ] Add source freshness checks.

---

# PHASE 10 — ETSY PERFORMANCE

## Goal

Connect Etsy listing performance to canonical MildMate products.

## Identity rule

```text
Etsy Listing ID → D1 Product_ID
```

## Checklist

- [ ] Reconcile current Etsy listing mappings.
- [ ] Support multiple Etsy listings per Product_ID when needed.
- [ ] Preserve inactive listing identity.
- [ ] Collect Etsy performance.
- [ ] Create D1 Etsy fact table.
- [ ] Build Etsy analytical views.
- [ ] Add Etsy Data Analyst section.

---

# PHASE 11 — GOOGLE ADS / META ADS

## Goal

Measure paid acquisition.

## Metrics

```text
spend
clicks
impressions
conversions
CPA
ROAS
```

## Checklist

- [ ] Google Ads ingestion.
- [ ] Meta Ads ingestion.
- [ ] Campaign/ad identity preservation.
- [ ] Product/channel mapping where defensible.
- [ ] Cost attribution rules.
- [ ] Paid media dashboard.
- [ ] Data freshness monitoring.

---

# PHASE 12 — PROFITABILITY LAYER

## Goal

Move from revenue decisions to profitable-growth decisions.

## Suggested controlled fields

```text
product_id
estimated_unit_cost
average_shipping_cost
marketplace_fee_rate
payment_fee_rate
gross_margin_target
```

## Calculate

```text
Revenue
- Production Cost
- Shipping
- Marketplace Fees
- Payment Fees
- Advertising
= Contribution Profit
```

## Checklist

- [ ] Agree business cost definitions.
- [ ] Decide source of cost truth.
- [ ] Add effective-date handling if costs change.
- [ ] Calculate contribution margin.
- [ ] Expose profitability in Data Analyst dashboard.
- [ ] Do not use estimates without labeling them.

---

# PHASE 13 — OPPORTUNITY ENGINE

## Goal

Rank product/channel opportunities consistently.

## Conceptual score

```text
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

## Checklist

- [ ] Define score formulas.
- [ ] Normalize metric ranges.
- [ ] Add minimum data thresholds.
- [ ] Add confidence penalties for missing/unallocated data.
- [ ] Store score history.
- [ ] Explain every score.
- [ ] Never let AI invent score inputs.

---

# PHASE 14 — MARKETING COMMAND CENTER

## Goal

Upgrade `/super-admin/marketing/` from data display into business decision support.

## Recommended sections

```text
Executive
Data Analyst
Products
Channels
SEO
Etsy
Paid Ads
Opportunities
Recommendations
Actions
Results
Data Quality
```

## Checklist

- [ ] Executive summary.
- [ ] Opportunity ranking.
- [ ] Product drill-down.
- [ ] Channel drill-down.
- [ ] Data Analyst links.
- [ ] Recommendation cards.
- [ ] Human approval workflow.
- [ ] Action status.
- [ ] Results measurement.

---

# PHASE 15 — AI ANALYST

## Goal

Convert trusted analytical outputs into practical marketing recommendations.

AI receives:

```text
Canonical product data
Analytical metrics
Opportunity scores
Data confidence
Historical action results
```

AI can:

```text
Interpret
Explain
Prioritize
Draft recommendations
Draft action plans
Review outcomes
```

AI must not:

- invent Product_ID
- invent revenue
- invent missing cost
- overwrite canonical facts
- hide poor data quality

---

# PHASE 16 — MARKETING ACTION FEEDBACK LOOP

## Goal

Answer:

> Did it work?

Recommended table:

```text
marketing_actions
```

Suggested fields:

```text
id
product_id
channel
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

## Checklist

- [ ] Save approved action.
- [ ] Capture baseline.
- [ ] Capture budget.
- [ ] Schedule review date.
- [ ] Capture post-action metrics.
- [ ] Calculate result.
- [ ] Record learnings.
- [ ] Feed history into future recommendations.

---

# PHASE 17 — SECURITY, PERFORMANCE & PRODUCTION HARDENING

## Checklist

- [ ] Confirm Super Admin auth protects all Data Analyst routes.
- [ ] Confirm read APIs require appropriate auth.
- [ ] No public D1 analytics endpoints.
- [ ] No secrets in frontend JavaScript.
- [ ] No unnecessary customer PII.
- [ ] Add pagination.
- [ ] Add indexes if justified by query plans.
- [ ] Test large historical datasets.
- [ ] Add API error logging.
- [ ] Add migration rollback/forward plan where practical.
- [ ] Verify production deployment.
- [ ] Verify no regression to public storefront.
- [ ] Verify no regression to operational Orders admin.
- [ ] Update architecture documentation.

---

# 8. Recommended Immediate Build Sequence

Do these first:

```text
Phase 0  Read-only architecture audit
Phase 1  Metric contract
Phase 2  D1 analytical layer
Phase 3  Read-only analysis API
Phase 4  Data Analyst Dashboard MVP
Phase 5  Data Quality & Sync Monitor
```

Then stop and use the system.

Only after the Sales/Data Analyst foundation is verified proceed with:

```text
Phase 6  Product Mapping completion
Phase 7  Historical backfill
Phase 8  GSC
Phase 9  GA4
Phase 10 Etsy
...
```

This prevents MildMate from accumulating more raw data before the existing data is actually usable.

---

# 9. First Milestone Definition of Done

The first Data Analyst milestone is complete when a logged-in Super Admin user can open:

```text
/super-admin/marketing/data-analyst/
```

and answer without Droid CLI or SQL:

1. How many real commercial orders are in D1?
2. What is sales revenue for a selected date range?
3. Which channels generated the sales?
4. Which Product_IDs appear most frequently?
5. Which products are commonly purchased together?
6. What percentage of orders/items are mapped?
7. What proportion of revenue data is EXACT vs UNALLOCATED?
8. When did the sales pipeline last sync?
9. Are there data-quality or sync problems?
10. Can data be filtered by date, channel, product, and status?

---

# 10. Droid CLI — Recommended Session Strategy

Use a **new Droid session per major phase** but keep the same repository and feature branch.

Examples:

```text
Session 01 — Marketing Data Analyst Audit
Session 02 — Marketing Metrics & D1 Views
Session 03 — Marketing Analysis API
Session 04 — Data Analyst Dashboard MVP
Session 05 — Data Quality Monitor
```

Each session should receive the handoff/output from the previous session.

---

# 11. Droid CLI — Opening Prompt for Phase 0

Copy/paste this into a **new Droid CLI session** from the root of the existing MildMate repository.

```text
We are implementing the MildMate Marketing Decision System inside the existing MildMate Re-build_web project.

IMPORTANT CURRENT ARCHITECTURE

- Existing Super Admin marketing area:
  https://www.mildmate.com/super-admin/marketing/

- We want to add a Data Analyst Dashboard inside the existing Super Admin marketing system.
- Preferred route:
  /super-admin/marketing/data-analyst/
  but you must inspect the existing router/project conventions before finalizing the route.

CONFIRMED PROJECT DECISIONS

- Project root:
  D:/00_Mildmate/Re-build_web/

- Keep all Marketing Decision System planning/handoff documents in:
  D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/

- Use a NEW Git feature branch:
  feature/marketing-data-analyst

- Internal feature areas:
  super-admin/marketing
  api/analysis

- Use the SAME Cloudflare D1 database.
- Use the SAME Cloudflare Pages project.
- Do NOT create a separate repository.
- Do NOT create a separate Cloudflare application.

- Cloudflare D1 remains the canonical database.
- Existing production unified sales tables already exist:
  sales_orders
  sales_order_items
  sync_runs

- Existing production Sales API and Notion → Make.com → D1 sales workflow already work.
- Existing operational website orders must remain untouched.
- The Data Analyst system is a read/analysis layer over canonical D1 analytics data.
- Do not create a second database.
- Do not create a separate app/repository.
- Reuse the existing Super Admin authentication and visual shell where possible.

WORKING METHOD

This session is PHASE 0 ONLY: READ-ONLY ARCHITECTURE AUDIT.

Do NOT modify code.
Do NOT create migrations.
Do NOT deploy.
Do NOT change production D1.
Do NOT change Cloudflare secrets.
Do NOT change existing routes.
Do NOT refactor unrelated code.

Please inspect the repository and report:

1. Current Git branch and working-tree state.
2. Existing /super-admin/ architecture.
3. Exact files/routes implementing:
   /super-admin/marketing/
4. Existing Super Admin authentication and authorization flow.
5. Existing navigation/sidebar/header components or patterns.
6. Existing CSS/design system used by Super Admin.
7. Existing JavaScript/frontend architecture for Super Admin.
8. Existing Worker / Pages Functions routing.
9. Existing D1 binding configuration.
10. Existing Sales API files/routes.
11. Current schema for:
    - products
    - sales_orders
    - sales_order_items
    - sync_runs
12. Current latest migration number.
13. Existing API response/error conventions.
14. Existing read-only admin API patterns we should reuse.
15. Recommended exact route and files for the Data Analyst Dashboard.
16. Recommended exact files for a future analysis API.
17. Any security, routing, D1, or deployment risks.
18. Which existing code should NOT be touched.
19. A concise implementation proposal for PHASE 1 only.

Return a structured report with:

A. VERIFIED CURRENT ARCHITECTURE
B. EXISTING SUPER ADMIN MARKETING IMPLEMENTATION
C. AUTHENTICATION
D. D1 / SALES DATA
E. API PATTERNS
F. RECOMMENDED DATA ANALYST ROUTE
G. FILES LIKELY TO ADD
H. FILES LIKELY TO MODIFY
I. FILES / SYSTEMS TO LEAVE UNCHANGED
J. RISKS
K. PHASE 1 RECOMMENDATION

Stop after the report.

Do not make any changes in this session.
```

---

# 12. Droid CLI — Phase 1 Prompt Template

Use only after Phase 0 has been reviewed and approved.

```text
Continue the MildMate Marketing Decision System implementation.

This session is PHASE 1: METRIC CONTRACT & ANALYTICAL DATA DESIGN.

Use the verified Phase 0 architecture report as authoritative project context.

Do not build the UI yet.
Do not deploy.
Do not modify production data.
Do not change existing operational website order tables.

Your job is to define the analytical contract for the existing:
- products
- sales_orders
- sales_order_items
- sync_runs

Define exact SQL/business logic for:

1. Commercial Order Count
2. Order Revenue
3. Units
4. Average Order Value
5. Orders Containing Product
6. Product Quantity
7. Exact Product Revenue
8. Product Attach Rate
9. Product Co-Purchase
10. Mapped %
11. Exact Revenue %
12. Unallocated Revenue %
13. Last Sales Sync
14. Data-quality warnings

Important:
- UNIQUE order identity is source_system + source_order_id.
- Product identity is products.id.
- EXACT revenue may be aggregated to product revenue.
- UNALLOCATED line revenue is unknown, not zero.
- Never equal-split or estimate missing historical item revenue.
- Test/cancelled/non-commercial data must not affect commercial KPIs.
- Existing operational website orders must not be added to unified sales analytics.

Inspect actual status values and schema before defining exclusions.

Deliver:

A. Metric Dictionary
B. Exact formulas / SQL approach
C. Status/exclusion rules
D. Date/time rules
E. Source normalization assumptions
F. Recommended analytical SQL views/tables
G. Proposed next migration number
H. Test cases
I. Risks / unresolved questions

Do not implement Phase 2 yet.
Stop after the design report.
```

---

# 13. Droid CLI — Phase 2 Prompt Template

Use only after the metric contract is approved.

```text
Implement PHASE 2 of the MildMate Marketing Decision System:
D1 SALES ANALYTICAL LAYER.

Use the approved metric contract exactly.

Requirements:

- Create a NEW migration only.
- Never edit historical migrations.
- Do not modify the operational website orders system.
- Do not change canonical sales ingestion behavior.
- Do not expose customer PII.
- Prefer SQL views initially unless a summary table is clearly justified.

Implement the approved analytical objects, expected to include:

analysis_sales_daily
analysis_product_participation
analysis_product_channel
analysis_sales_28d
analysis_sales_90d
analysis_data_quality

Before writing:
1. confirm current latest migration number;
2. show the proposed migration filename;
3. show which existing tables are read;
4. confirm no destructive statements are required.

Then implement and test locally/staging.

Test:
- unique order counting
- multi-item order handling
- EXACT revenue
- UNALLOCATED revenue
- test-order exclusion
- cancelled/non-commercial exclusion
- Product_ID joins
- empty periods
- multiple channels

After implementation, report:
- files changed
- SQL objects created
- tests performed
- sample results
- build/lint status
- remaining risks

Do not deploy to production until explicitly approved.
```

---

# 14. Droid CLI — Phase 3 Prompt Template

```text
Implement PHASE 3:
READ-ONLY MARKETING ANALYSIS API.

Reuse existing Super Admin authentication and API conventions verified in Phase 0.

The API must read from the approved D1 analytical layer only.

Conceptual endpoints:

summary
sales
products
product/:id
channels
data-quality

Use the existing route naming style instead of inventing a conflicting convention.

Requirements:
- authenticated Super Admin only
- read-only
- no customer PII
- date filters
- channel filters
- Product_ID filters
- pagination for detailed sales
- bounded date ranges where needed
- parameter validation
- machine-readable errors
- no secrets exposed
- no direct browser D1 access

Test:
- authorized
- unauthorized
- invalid params
- empty result
- normal result
- pagination

Do not build the dashboard UI in this session.

Return implementation summary and stop.
```

---

# 15. Droid CLI — Phase 4 Prompt Template

```text
Implement PHASE 4:
MILD MATE DATA ANALYST DASHBOARD MVP.

Use the existing Super Admin marketing shell and authentication.

Preferred URL:
  /super-admin/marketing/data-analyst/

If Phase 0 verified another route that better matches existing routing, use the verified route.

The dashboard should consume the Phase 3 read-only Analysis API.

MVP:

KPI cards:
- Commercial Orders
- Order Revenue
- Units
- Average Order Value
- Mapped %
- Unallocated Revenue %
- Last Sales Sync
- Data Quality Status

Filters:
- date range
- channel
- product
- order status
- mapping status
- revenue status

Tables:
1. Sales Detail
2. Product Participation
3. Channel Analysis

UX requirements:
- reuse existing Super Admin styling
- responsive
- clear loading state
- clear empty state
- clear error state
- show data freshness
- no customer PII
- Product_ID visible where useful
- readable without technical SQL knowledge

Do not implement Opportunity Score or AI recommendations yet.

Test locally.
Report:
- routes/files changed
- screenshots or visual verification method
- API calls used
- mobile/desktop behavior
- build/lint results
- remaining issues

Do not deploy production until explicitly approved.
```

---

# 16. Guardrails for Every Droid Session

Always include:

```text
Do not expose SALES_SYNC_API_TOKEN.
Do not modify unrelated production systems.
Do not edit historical migrations.
Do not renumber Product_ID.
Do not invent historical line revenue.
Do not mix operational website order rows into unified analytics totals.
Do not duplicate sales ingestion paths.
Do not expose customer PII in the marketing dashboard.
Do not deploy production without explicit approval.
```

---

# 17. Practical Recommendation

Start now with:

```text
PHASE 0
Read-only architecture audit
```

Do **not** ask Droid to build the dashboard immediately.

The audit will tell us exactly how the existing:

```text
/super-admin/marketing/
```

is structured.

Then we can make Phase 1 and later implementation instructions fit the actual MildMate codebase rather than guessing file paths or architecture.
