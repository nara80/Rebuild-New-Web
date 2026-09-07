# MildMate Marketing Decision System — Phase 01 Audit Report
## Architecture Audit & Developer Setup

**Date:** 2026-09-07
**Session:** Phase 01 — Architecture Audit & Developer Setup
**Branch:** `feature/marketing-data-analyst` (created from `master` in this session)
**Scope:** Read-only audit. No application code, schema, routes, or secrets were changed.

---

# A. VERIFIED CURRENT ARCHITECTURE

## Repository / Git

| Item | Verified value |
|---|---|
| Repo root | `D:\00_mildmate\re-build_web` |
| Remote | `https://github.com/nara80/Rebuild-New-Web.git` (origin) |
| Working branch | `master` (now branched to `feature/marketing-data-analyst`) |
| Working tree | Clean, except untracked `01_MildMate_Marketing/` (planning docs) |
| Latest commit | `d8504d7` "Reconcile marketing-system docs and add sales-sync health banner" |

**Branch topology warning:** `origin/HEAD` points to `main`, but all active work lives on `master`:
- `master` is **297 commits ahead** of local `main` (main is stale)
- `master` is **56 commits ahead** of `origin/main`
- `master` is **3 commits ahead** of `origin/master` (unpushed local commits)

→ The de-facto integration branch is `master`. The feature branch was created from `master`. Merging/pushing strategy should target `master`, not `main`, unless the user reconciles the default branch separately.

## Cloudflare configuration (`wrangler.toml`)

- Pages project: `mildmate-new`, output dir `public/`
- D1 binding: `DB` → `mildmate-db-prod` (`854f206a-…`), preview `mildmate-db` (`85ce2f41-…`)
- R2 binding: `MILDMATE_ASSETS` → `mildmate-assets`
- Secrets managed via dashboard/wrangler (never in repo)

---

# B. EXISTING SUPER ADMIN MARKETING IMPLEMENTATION

**Critical finding: `/super-admin/marketing/` is NOT a physical URL route.**

The entire Super Admin is a **single-file SPA**: `public/super-admin/index.html` (~4,111 lines, ~250 KB), vanilla JS + inline CSS. Navigation is client-side:

- Sidebar links use `data-page="…"`; `showPage(name)` swaps content into `#page-content`
- Registered pages: `['dashboard','pricing','diy','exchange','shipping','marketing','stat','blog','reviews','products','color-inventory','boat-models','orders','quotes','customers','contacts','subscribers','accounts']`
- "Marketing" is one tab, rendered by `rMarketing()` with sub-tabs: 🏷 Run a Sale (`campaigns`) · 💌 Send Offers (`offers`) · 🎟️ Promo Codes (`promo`)
- There is no router that maps `/super-admin/marketing/…` sub-paths; the URL stays `/super-admin/`

**Reusable visual language** (inline CSS in the SPA head):
- CSS vars: `--c-blue:#2c96f4; --c-dark:#1E293B; --c-surface:#F8FAFC; --c-border:#e2e8f0; --c-muted:#64748b; --c-green; --c-red; --c-amber; --radius:8px; --shadow`
- Components: `.sidebar` (dark 20% left nav), `.toolbar`, `.card`/`.card-header`/`.card-body`, `.stats-grid` + `.stat-card` (KPI cards), global `table` styles, `.btn`/`.btn-primary`/`.btn-outline`/`.btn-sm`, `.badge` variants, `toast()` feedback
- These are exactly the primitives the Data Analyst dashboard needs (KPI cards, filter forms, tables, badges)

**Already-existing sales-sync surface:** `renderSalesSyncBanner(sync)` (line ~1657) renders a HEALTHY / DELAYED (>30 min) / FAILED banner on the Orders page, fed by `/api/admin/orders`, which returns the latest `sync_runs` row (`workers/api/admin-orders.ts` line ~74). Phase 06 (Data Quality Monitor) can extend this pattern rather than invent a new one.

---

# C. AUTHENTICATION

## Server-side page gate
- `functions/super-admin/_middleware.ts` → one line: re-exports `functions/admin/_middleware.ts`
- Flow: extract Clerk `__session` cookie (or query param) → `verifyClerkJwt()` (Web Crypto + JWKS, `workers/api/clerk-verify.ts`) → require admin role claim OR email in `ADMIN_EMAILS` env → Clerk API enrichment fallback → 302 to `accounts.mildmate.com/sign-in` or 403 page
- **Dev bypass:** hosts containing `pages.dev` or `localhost` skip the middleware entirely (client-side gate only)
- Cloudflare Zero Trust Access policies additionally protect `/admin/` and `/super-admin/` in production
- Because Pages middleware covers the whole `/super-admin/*` subtree, **any new static page under `public/super-admin/marketing/data-analyst/` is automatically auth-gated with zero auth code**

## Admin API auth (the pattern to reuse for the Analysis API)
- Frontend: `getAdminAuthHeaders(includeJson)` in the SPA — gets Clerk Bearer token via `window.clerk.session.getToken({skipCache:true})`, plus optional `X-Admin-Secret` fallback header
- Backend: e.g. `workers/api/admin-stats.ts` `authorizeAdmin()` — `verifyClerkJwt` + `hasAdminRole()` + `emailAllowed(ADMIN_EMAILS)`, with `X-Admin-Secret` fallback; production-host check helper included

## Sales ingestion auth (NOT for the dashboard)
- `/api/v1/*` uses `Bearer SALES_SYNC_API_TOKEN` (`requireBearerAuth` in `workers/api/sales.ts`). This token is for Make.com only and must not be used or exposed by the Data Analyst UI.

---

# D. D1 / SALES DATA

## Verified schema (migration `039_unified_sales_analytics.sql`, mirrored by `ensureSalesSchema()` self-heal in `sales.ts`)

**`sales_orders`** — id, source_system, source_order_id, notion_page_id, order_date, channel, currency, order_total, status, destination_country, mapping_status, source_created_at, source_updated_at, created_at, updated_at. `UNIQUE(source_system, source_order_id)`. Indexes: order_date, channel, status, notion_page_id.

**`sales_order_items`** — id, sales_order_id (FK), source_item_key, item_no, product_id (FK → products.id, nullable), quantity, raw_item_text, line_revenue (nullable), revenue_status, mapping_status, item_status (default `'active'`), timestamps. `UNIQUE(sales_order_id, source_item_key)`. Indexes: product_id, sales_order_id.

**`sync_runs`** — id, source, scenario, started_at, finished_at, status, records_received/created/updated/unchanged/rejected, error_message, created_at.

**`products`** — canonical identity `products.id` (32 active: 1–29, 32, 33, 34; gaps 30/31 intentional). Full column list in AGENTS.md; analytical layer only needs `id`, `title_en`, `slug`, `product_type`, `is_active`.

## Verified value domains (enforced by `sales.ts`)
- `status`: `pending | paid | processing | shipped | completed | cancelled | refunded | archived`
- `mapping_status`: `Mapped | Partial | Review Required | Unmapped`
- `revenue_status`: `EXACT | UNALLOCATED` (UNALLOCATED ⇒ `line_revenue` MUST be NULL — API rejects otherwise: `UNALLOCATED_MUST_BE_NULL`)
- `item_status`: `active | removed` (soft delete — **analytics must filter `item_status = 'active'`**)
- `source_system` normalization map: shopee, lazada, tiktok, line, whatsapp, etsy, ebay, facebook, website (mildmate→website), manual
- Known smoke-test order to exclude from commercial KPIs: `TEST-MAKE-001`
- Timestamps are stored as text; SPA's `parseSyncTimestamp()` already treats bare `YYYY-MM-DD HH:MM:SS` as UTC — the Phase 02 metric contract must pin down date/timezone rules explicitly

## Migrations
- Latest: `041_boat_model_label.sql` → **next migration number is `042`**
- Numbering has historical duplicates (002, 003, 024, 031, 039 families) — acceptable, but new files should use a unique 042 prefix
- Never edit historical migrations; note `ensureSalesSchema()` in `sales.ts` also self-heals the three sales tables with `CREATE TABLE IF NOT EXISTS`, so analytical objects must use different names and must not alter those tables

---

# E. API PATTERNS

## Routing
- All `/api/*` traffic → `functions/api/[[path]].ts` catch-all → imports handler functions from `workers/api/*.ts` and dispatches by `path.startsWith(...)`
- `/v1/*` (non-`/api` prefix) → `functions/v1/[[path]].ts` → `handleSalesApi`
- Adding a new API area = add `workers/api/<name>.ts` exporting a `handleX(request, env)` + register one dispatch branch in `functions/api/[[path]].ts`

## Response conventions
- Plain JSON `Response` with `Content-Type: application/json` + permissive CORS headers
- Sales API: `{ success, action, error_code, message }` with machine-readable error codes (e.g. `INVALID_PRODUCT_ID`, `UNAUTHORIZED`)
- Admin APIs: `json(body, status)` helper; errors as `{ error: "..." }`

## Best reuse template for the read-only Analysis API
`workers/api/admin-stats.ts` — authenticated read-only stats endpoint with period query params (`?period=last-7-days&target_currency=USD`), `authorizeAdmin()`, and D1 aggregate queries. The Analysis API should clone this auth + shape.

---

# F. RECOMMENDED DATA ANALYST ROUTE

**Recommended:** `/super-admin/marketing/data-analyst/` as a **new physical static page**:

```text
public/super-admin/marketing/data-analyst/index.html
```

Rationale:
1. Automatically protected by the existing `functions/super-admin/_middleware.ts` (subtree coverage) + Cloudflare Access — zero new auth code
2. Matches the plan's preferred URL exactly
3. Avoids growing the already ~250 KB single-file SPA; the Data Analyst tool is analyst-focused and benefits from its own page
4. Copy the SPA's CSS variables/components so it visually matches; add a sidebar "Data Analyst" link in the SPA Marketing tab pointing to the new page (plain `<a href>`)

Note: `/super-admin/marketing/` itself will remain a virtual SPA tab; only `data-analyst/` becomes physical. This is consistent (deep-linking into the SPA was never supported anyway).

## Recommended API route prefix

Follow existing conventions (not the conceptual `/api/super-admin/...` names):

```text
GET /api/admin/analysis/summary
GET /api/admin/analysis/sales
GET /api/admin/analysis/products
GET /api/admin/analysis/product?id=26
GET /api/admin/analysis/channels
GET /api/admin/analysis/data-quality
```

Implemented in `workers/api/admin-analysis.ts` with `authorizeAdmin`-style Clerk auth, registered in `functions/api/[[path]].ts` under `path.startsWith("/api/admin/analysis")` (placed **before** any broader `/api/admin/` prefix matches if ordering matters).

---

# G. FILES LIKELY TO ADD (Phases 02–06)

| Phase | File | Purpose |
|---|---|---|
| 02 | `01_MildMate_Marketing/02_Metric_Dictionary/…` | Metric contract (docs only) |
| 03 | `migrations/042_marketing_analysis_layer.sql` | Analytical views (`analysis_sales_daily`, `analysis_product_participation`, `analysis_product_channel`, `analysis_sales_28d`, `analysis_sales_90d`, `analysis_data_quality`) |
| 04 | `workers/api/admin-analysis.ts` | Read-only Analysis API handlers |
| 05 | `public/super-admin/marketing/data-analyst/index.html` | Dashboard MVP page |
| 05 | (optional) `public/super-admin/marketing/data-analyst/app.js` | Dashboard JS if separated from HTML |

# H. FILES LIKELY TO MODIFY

| File | Change |
|---|---|
| `functions/api/[[path]].ts` | Register `/api/admin/analysis/*` dispatch |
| `public/super-admin/index.html` | Add "Data Analyst" link (sidebar and/or Marketing tab) |
| `public/_worker.js` / `public/index.js` | **MUST VERIFY (top risk, see J1):** whether production API runtime requires mirroring new endpoints into these bundles, per the AGENTS.md runtime-parity rule |

# I. FILES / SYSTEMS THAT MUST REMAIN UNCHANGED

- `workers/api/sales.ts` — production ingestion API (Make.com depends on it)
- `workers/api/webhook.ts`, `workers/api/checkout.ts` — operational order flow + snapshot durability path
- `workers/api/admin-orders.ts` — operational orders admin incl. `missing_configurable_rows` guardrail
- Operational website `orders` table and all storefront routes/`_redirects`
- All historical migrations (001–041)
- `functions/admin/_middleware.ts` auth logic (reuse, don't modify)
- Clerk configuration, `ADMIN_EMAILS`, `SALES_SYNC_API_TOKEN`, all secrets

---

# J. RISKS

1. **Runtime bundle parity (must verify before Phase 04 API work):** AGENTS.md states deployed worker artifacts must stay in sync (`workers/api/*` ↔ `public/index.js` ↔ `public/_worker.js`). If production actually serves `/api/*` from `public/_worker.js` (advanced mode), new analysis endpoints must be added there too or they will 404 in production while working locally. Resolve empirically in the Phase 04 session before writing endpoints.
2. **Branch topology:** origin default branch is `main` but work integrates on `master` (3 unpushed commits). Feature branch is based on `master`. Do not merge to `main`.
3. **Preview auth bypass:** middleware skips auth on `*.pages.dev` / localhost. The Data Analyst page will be openly reachable on preview deployments (same as the existing Super Admin). Mitigation: no PII in analysis API responses (already a phase rule); Cloudflare Access covers production.
4. **Schema self-heal collision:** `ensureSalesSchema()` re-creates sales tables if missing. Analytical layer must be purely additive views/tables with distinct `analysis_*` names.
5. **Soft-deleted items:** `sales_order_items.item_status='removed'` rows exist by design; every analytical query must filter them out or participation counts will be inflated.
6. **Timezone ambiguity:** `order_date` and sync timestamps are TEXT with mixed formats; the Phase 02 metric contract must define canonical date bucketing (recommend: treat stored timestamps as UTC, bucket `order_date` as calendar date string).
7. **D1 view performance:** start with SQL views (per plan); if 28d/90d rollups get slow with historical backfill (Phase 08), convert to summary tables in a later migration.
8. **Duplicate migration numbers historically:** use unique `042_` prefix; confirm applied-migration state on prod/preview before applying.

---

# K. PHASE 02 RECOMMENDATION (next session)

Phase 02 = **Metric Contract & Analytical Data Design** (docs only, no code):

1. Write the Metric Dictionary in `01_MildMate_Marketing/02_Metric_Dictionary/` defining, against the verified schema above: Commercial Order Count, Order Revenue, Units, AOV, Orders Containing Product, Product Quantity, Exact Product Revenue, Attach Rate, Co-Purchase, Mapped %, Exact Revenue %, Unallocated Revenue %, Last Sales Sync, data-quality warnings
2. Fix exclusion rules from the verified value domains: commercial statuses = `paid, processing, shipped, completed` (confirm with owner whether `pending` counts); exclude `cancelled, refunded, archived`, exclude `TEST-MAKE-001` (and define a general test-order rule), filter `item_status='active'`
3. Define date/time canon (UTC, `order_date` bucketing) and source/channel normalization (reuse `SOURCE_MAP`)
4. Propose exact SQL for each `analysis_*` view + test cases against known sample orders
5. Confirm next migration number `042` and view-vs-table choice per object

**Inputs for the Phase 02 session:** this report + `16_Phases/02_…Metric_Contract_Checklist.md`.

---

# Phase 01 Handoff Record

- **Files changed:** none in application code. Added this report; created branch `feature/marketing-data-analyst` from `master` (`d8504d7`).
- **Migrations/API/UI routes created or changed:** none.
- **Tests performed:** read-only inspection only; repository unchanged and buildable by definition.
- **Unresolved issues:** J1 (runtime bundle parity), commercial-status decision for `pending`, applied-migration state check on prod/preview.
- **Status:** Phase 01 complete. Ready for Phase 02 review/approval.
