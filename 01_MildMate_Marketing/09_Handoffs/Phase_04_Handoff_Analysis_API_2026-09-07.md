# Phase 04 Handoff — Read-Only Marketing Analysis API

**Date:** 2026-09-07 · **Branch:** `feature/marketing-data-analyst` · **Status:** ✅ Built + tested locally. ⏳ Goes live on next Pages deploy (user-triggered).

## Runtime parity question RESOLVED (was top risk from Phases 01–03)

- Production runs Cloudflare Pages **advanced mode**: `public/_worker.js` is the live runtime; the `functions/` tree is the SOURCE that gets bundled.
- The bundle is produced by `npx wrangler pages functions build` (esbuild output `index.js`), then copied to BOTH `public/_worker.js` and `public/index.js` (kept byte-identical).
- **Rule for all future phases:** any change under `functions/` or `workers/api/` requires rebuilding and syncing both bundle files before deploy:
  `npx wrangler pages functions build --outdir <tmp>` → copy `<tmp>/index.js` over `public/index.js` AND `public/_worker.js`.

## Files changed

| File | Change |
|---|---|
| `workers/api/admin-analysis.ts` | NEW — read-only analysis API handler (auth clone of admin-stats pattern) |
| `functions/api/[[path]].ts` | + import + dispatch branch for `/api/admin/analysis*` |
| `public/_worker.js`, `public/index.js` | Rebuilt bundles (591,795 → 612,675 bytes, identical hashes) |
| `01_MildMate_Marketing/04_API/Phase_04_Analysis_API_Reference_2026-09-07.md` | NEW — endpoint contracts, params, error schema, examples |

## API routes created (GET only, admin-authenticated)

```
/api/admin/analysis/summary        ?start&end&channel
/api/admin/analysis/sales          ?start&end&channel&product_id&status&revenue_status&limit&offset
/api/admin/analysis/products       ?start&end&channel
/api/admin/analysis/product/:id
/api/admin/analysis/channels       ?start&end
/api/admin/analysis/data-quality
```

Reads only `analysis_*` views (migration 042, already applied to prod D1) + `products` for titles. Machine-readable errors (`{success:false, error_code, message}`). Pagination capped at 200. No PII in any response. M22 freshness + M30 ok/warning/critical roll-up computed in the data-quality endpoint.

## Tests performed (local `wrangler pages dev public`, local D1 fixtures)

All passed: 401 unauthenticated · 400 invalid date/range · 404 unknown route/product · summary all-time + filtered · sales pagination with stable totals · product_id / revenue_status filters · products list (coverage %, top channel, 28d trend) · product/26 drill-down with EXACT ฿500 aggregation · empty period returns zeros with null aov/pcts (never fake values) · no PII fields.

Compile validation: `wrangler pages functions build` → "Compiled Worker successfully". (Repo has no TS typecheck step; eslint config covers `public/js` + `scripts` only.)

## Notes / risks

1. Local dev D1 contained older fixture noise ("Test Product 6") — harmless, local-only; endpoints reflected DB state consistently.
2. `X-Admin-Secret` fallback is blocked on production hosts (unless `ADMIN_SECRET_ALLOW_PROD=true`) — production dashboard must send the Clerk Bearer token via the existing `getAdminAuthHeaders()` helper.
3. `/api/admin/analysis/products` aggregates live from `analysis_active_items` when date/channel filters are applied (views cannot take parameters); logic mirrors the participation view exactly.

## Phase 05 instructions

Build `/super-admin/marketing/data-analyst/` (physical page `public/super-admin/marketing/data-analyst/index.html`) consuming these 6 endpoints via `getAdminAuthHeaders()`-style Clerk Bearer auth. Reuse the Super Admin SPA design tokens (`--c-blue #2c96f4`, `.card`, `.stats-grid`, `.stat-card`, table styles). Add a "Data Analyst" link in the SPA Marketing tab. KPI cards, filters, 3 tables (Sales Detail, Product Participation, Channel Analysis), loading/empty/error states, freshness indicator. Auth gate is automatic via `functions/super-admin/_middleware.ts`.
