# Phase 07 Handoff — Product Mapping Automation Completion

**Date:** 2026-09-10
**Branch:** `feature/marketing-data-analyst`
**Status:** Backend built + locally tested. Make.com scenario build is an operational step (guide delivered). Not deployed.

## Goal

Automatically resolve unmapped Notion order items to canonical D1 Product_IDs before sales analysis, with reusable D1 mapping memory and a strict no-guessing policy.

## Files changed

| File | Change |
|---|---|
| `migrations/043_product_mapping_aliases.sql` | New additive table `product_mapping_aliases` (D1 mapping memory) + unique key on (source, listing, normalized alias) + seed: known ID `1038` → D1 `[20, 26]` (verified) |
| `workers/api/sales.ts` | Schema self-heal for the new table; `normalizeAliasKey`; 4 new Bearer-token routes under `/v1/mapping/*` and `/api/v1/mapping/*` |
| `public/_worker.js`, `public/index.js` | Rebuilt runtime bundles (629,254 bytes, identical) — runtime-parity rule |
| `01_MildMate_Marketing/05_Mapping/Phase_07_Notion_Order_Product_Mapper_Build_Guide_2026-09-10.md` | Module-by-module Make.com blueprint, endpoint reference, resolution ladder, AI guardrails, activation prerequisites |

## API routes created (auth: Bearer `SALES_SYNC_API_TOKEN`, same as sales sync)

| Route | Purpose |
|---|---|
| `GET /api/v1/mapping/catalog` | Approved canonical Product_ID catalog (active products incl. IDs 33/34); the only id space allowed for AI fallback |
| `POST /api/v1/mapping/resolve` | Deterministic resolution ladder: variation-exact → verified alias → listing-level; unresolved → `Review Required` suggestion (never guesses) |
| `POST /api/v1/mapping/aliases` | Idempotent upsert of human corrections as reusable mapping memory (product_ids validated against D1 `products`) |
| `GET /api/v1/mapping/aliases` | Audit/review list (500 most recent) |

Design points:
- Selected variation outranks parent listing title (ladder order, verified locally).
- Normalized matching (case/punctuation/whitespace; em-dash vs hyphen still matches).
- Multi-product listings supported (`product_ids` is a JSON array — the 1038 → 20+26 case).
- Source-specific aliases outrank source-agnostic; verified outrank unverified; `hit_count`/`last_used_at` telemetry on every hit.
- No PII anywhere; token never appears in responses or docs.

## Mapping coverage on dashboard

Already surfaced by Phases 05–06 (no new UI needed this phase): Mapped Orders % KPI, mapping filter (Mapped/Partial/Unmapped/Itemless), DQ chips with drill-downs (`missing_product_id`, `unmapped_orders`), per-channel `mapped_pct` in Channel Analysis.

## Tests performed (local `wrangler pages dev` + local D1, migration 043 applied locally)

| Test | Result |
|---|---|
| Catalog returns active products incl. IDs 33 and 34 | ✅ (35 active in local DB) |
| Known ID 1038 resolves to `[20, 26]`, method `listing`, suggestion `Mapped` | ✅ |
| Unknown listing/variation → `resolved: false`, `Review Required` | ✅ |
| Variation alias upsert (human correction) → `created` | ✅ |
| Re-resolve with em-dash variant of stored hyphen text → `variation_exact`, `[3]` | ✅ |
| Listing-level alias (→ D1 1) added to same listing: variation still wins (→ D1 3) | ✅ |
| Verified alias text resolves without listing_id → `verified_alias` | ✅ |
| Invalid product id in alias upsert → 400 | ✅ |
| Unauthenticated → 401 | ✅ |
| Alias upsert idempotent (re-post → `updated`, same alias_id) | ✅ |

Test aliases were removed from local D1 afterwards; only the 1038 seed remains.
Note: a local-only `SALES_SYNC_API_TOKEN` was added to `.dev.vars` (gitignored) for these tests.

## Unresolved issues / risks

- **Make.com scenario `MildMate - Notion Order Product Mapper` is not yet built** — the build guide covers modules, filters, Notion writes (`D1_Product_IDs`, `D1_Product_Map`, `Product_Mapping_Status`) and AI-fallback guardrails. Single-/multi-item order end-to-end tests happen there.
- The 16 confirmed Etsy listing mappings (Google Product Master) still need to be loaded into mapping memory via `POST /api/v1/mapping/aliases` (endpoint ready).
- Migration 043 must be applied to preview + production D1 before the scenario goes live.
- The `1038` seed is source-agnostic (applies to any source_system); tighten to `etsy` via alias upsert if desired.

## Deploy / operational steps (user-triggered)

```powershell
npx wrangler d1 execute mildmate-db --remote --file migrations/043_product_mapping_aliases.sql        # preview
npx wrangler d1 execute mildmate-db-prod --remote --file migrations/043_product_mapping_aliases.sql   # production
git push origin feature/marketing-data-analyst
npx wrangler pages deploy public --project-name=mildmate-new                                          # ships Phases 04-07
```

## Phase 08 readiness

Mapped orders can flow into the already-built Sales Sync unchanged; ambiguous items are never silently guessed; human corrections accumulate as reusable D1 memory. Backend contract for the mapper scenario is stable and documented.
