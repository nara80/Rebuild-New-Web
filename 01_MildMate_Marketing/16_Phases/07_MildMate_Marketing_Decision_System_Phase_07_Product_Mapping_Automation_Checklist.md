> **⚠️ SUPERSEDED (2026-09-11).** This v1 plan (Make.com as the mapping engine) was replaced twice: first by the Direct Notion API v2 checklist (`07_Phase/`), then by the approved v3 **confirmed-mapping sync** design (Make.com = mapping authority; Droid syncs only `Mapped` + signature-changed records into D1). The Worker `/api/v1/mapping/*` endpoints and migration 043 built under this checklist remain valid. See `09_Handoffs/Phase_07_08_Reconciliation_2026-09-11.md`.

# MildMate Marketing Decision System — Phase 07
## Product Mapping Automation Completion

**Project root:** `D:/00_Mildmate/Re-build_web/`  
**Planning / handoff folder:** `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`  
**Git branch:** `feature/marketing-data-analyst`  
**UI feature area:** `super-admin/marketing`  
**Analysis API area:** `api/analysis`  
**Database:** Existing Cloudflare D1  
**Deployment:** Existing Cloudflare Pages project  

## Status Legend

- `[x]` Completed / verified before this phase
- `[ ]` To do in this phase
- `[!]` Guardrail / must not violate


## Phase Goal

Automatically resolve unmapped Notion order items to canonical D1 Product_IDs before sales analysis.

## Prerequisites / Confirmed Baseline

- [x] Existing Notion mapping fields exist.
- [x] Existing Sales Sync only processes mapped orders.
- [x] Actual selected variation outranks parent listing title.
- [x] D1 products now include IDs 33 and 34.

## Task Checklist

- [x] Reconcile the product-mapping catalog with all current products, including IDs 33 and 34.
- [ ] Build/finish `MildMate - Notion Order Product Mapper` in Make.com. *(superseded — see Reconciliation Note)*
- [ ] Retrieve only eligible unmapped/review records according to approved workflow mode. *(superseded — see Reconciliation Note)*
- [x] Preserve already verified mappings.
- [x] Parse `ProductJSON` / `Product_Info` without overwriting original source text.
- [ ] Resolve exact marketplace variation first. *(superseded — see Reconciliation Note)*
- [ ] Resolve exact verified alias second. *(superseded — see Reconciliation Note)*
- [ ] Use listing + variation mapping where needed. *(superseded — see Reconciliation Note)*
- [ ] Use deterministic rules only when defensible. *(superseded — see Reconciliation Note)*
- [ ] Use AI only as bounded fallback against approved Product_ID catalog. *(superseded — see Reconciliation Note)*
- [x] Never allow AI to invent Product_ID.
- [ ] Set low-confidence records to `Review Required`. *(superseded — see Reconciliation Note)*
- [ ] Write `D1_Product_IDs`. *(superseded — see Reconciliation Note)*
- [ ] Write `D1_Product_Map`. *(superseded — see Reconciliation Note)*
- [ ] Write `Product_Mapping_Status`. *(superseded — see Reconciliation Note)*
- [ ] Where implemented, store human corrections as reusable D1 mapping memory. *(superseded — see Reconciliation Note)*
- [x] Measure mapping coverage.
- [x] Surface mapping coverage in Data Analyst dashboard.

## Deliverables

- [x] Production-ready product mapping scenario.
- [x] Updated mapping catalog.
- [x] Review-required path.
- [x] Mapping coverage metrics.

## Verification / Test Checklist

- [ ] Known ID 1038 maps to D1 20 + 26. *(superseded — see Reconciliation Note)*
- [x] Single-item order.
- [x] Multi-item order.
- [ ] Ambiguous listing title with clear variation. *(superseded — see Reconciliation Note)*
- [ ] Unknown variation → Review Required. *(superseded — see Reconciliation Note)*
- [x] Already-verified mapping remains unchanged.
- [x] IDs 33/34 can be selected/resolved where applicable.

## Definition of Done

- [ ] New eligible orders can reach `Mapped` status automatically when evidence is strong. *(superseded — see Reconciliation Note)*
- [x] Ambiguous items are never silently guessed.
- [x] Mapped orders can flow into the already-built Sales Sync.

## Global Guardrails

- [!] Do not expose `SALES_SYNC_API_TOKEN` or any production secret.
- [!] Do not renumber permanent D1 `products.id`.
- [!] Do not modify or replace the existing operational website `orders` system unless explicitly approved.
- [!] Do not count operational website `orders` together with unified `sales_orders`.
- [!] Do not invent historical line-item revenue.
- [!] `UNALLOCATED` revenue means unknown, not zero.
- [!] Do not equal-split multi-item order totals.
- [!] Do not expose unnecessary customer PII in marketing analytics.
- [!] Do not edit old production migrations; add a new migration when schema changes are required.
- [!] Do not deploy to production until the phase has been reviewed and explicitly approved.
- [!] Keep implementation scoped to this phase; do not build future phases early.


## Phase Handoff Rule

- [x] Record files changed.
- [x] Record migrations/API routes/UI routes created or changed.
- [x] Record tests performed and results.
- [x] Record unresolved issues and risks.
- [x] Save implementation summary under `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`.
- [x] Commit only phase-scoped changes with a clear Git commit message.
- [x] Prepare a concise handoff for Phase 8 and stop.

## Recommended Droid Session Name

`MildMate Marketing Decision System — Phase 07 — Product Mapping Automation Completion`

## Droid Working Instruction

> Work on **Phase 07 only**. Inspect existing code before changing it. Reuse existing MildMate conventions. Do not build later phases early. Stop after this phase is implemented, tested, documented, and ready for review.
---

## Reconciliation Note (2026-09-19)

**The Phase 07 approach pivoted.** The Make.com auto-mapper scenario planned above (v1: variation/alias/AI resolution writing `D1_Product_IDs`/`D1_Product_Map`/`Product_Mapping_Status`) was **not built**. It was superseded by the **v2/v3 direct Notion mapper** (`09_Handoffs/Phase_07v2_Handoff_Direct_Notion_Mapper_Offline_Build_2026-09-10.md`): humans (assisted by Make.com order import) confirm mappings in Notion, and the mapper syncs **only `Product_Mapping_Status = Mapped`** records into D1 — it never maps or guesses. Items marked *(superseded)* above describe the abandoned v1 auto-resolution design and remain unchecked deliberately.

What was actually built and verified (2026-09-19):
- `scripts/notion-product-mapper.mjs` (CLI shell) + `scripts/notion-mapper-core.mjs` (shared runtime-agnostic engine, extracted for Phase 17) + `scripts/notion-mapper-parser.test.mjs` (27-case regression suite, 27/27 PASS).
- Production-verified: **490 `notion-direct-mapper` runs** in prod `sync_runs` (latest 2026-09-14); 493 orders / 737 items synced into `sales_orders`/`sales_order_items`.
- Never-guess guarantees hold structurally: parser accepts only explicit `Item N = ID xxx …` map lines; ids/map mismatch, missing total, and parse failures are **held** and reported, not guessed; already-synced records are idempotent (`skipped_unchanged`); the only Notion write-back is the `Last_Synced_Signature` field.
- Review-required path exists in v2 form: held-record report (18 held during backfill, all resolved by human correction by 2026-09-14).
- Mapping catalog reconciled to 32 active products incl. IDs 33/34; catalog validation rejects unknown IDs.
- Coverage surfaced: `analysis_data_quality` → Data Analyst dashboard Data Quality section (0 unmapped items across 493 orders).
- Mapping memory: `migrations/043_product_mapping_aliases.sql` table exists in production with the seeded `1038 -> [20, 26]` verified alias row (migration 043), but no automation consumes it yet.
- Handoffs: `Phase_07_Handoff_Product_Mapping_Automation_2026-09-10.md`, `Phase_07v2_Handoff_Direct_Notion_Mapper_Offline_Build_2026-09-10.md`, `Phase_07_08_Reconciliation_2026-09-11.md`.
