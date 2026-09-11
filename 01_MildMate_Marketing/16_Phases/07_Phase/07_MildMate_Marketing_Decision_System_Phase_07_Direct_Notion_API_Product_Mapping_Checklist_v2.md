> **⚠️ PARTIALLY SUPERSEDED (2026-09-11).** Completed under this checklist: Notion connectivity, OrderList schema/pagination verification, credential setup, read-only inspection report, `--order-id` → unique_id `ID`, dry-run controls. **Superseded:** the resolver-based mapping flow (§5–§7) — by approved business rule, Make.com remains the only system that fixes/confirms mappings; the Droid CLI now only *syncs* `Product_Mapping_Status = "Mapped"` records into D1 gated by `D1_Current_Signature != D1_Last_Synced_Signature`, and writes back only `D1_Last_Synced_Signature`. See `09_Handoffs/Phase_07_08_Reconciliation_2026-09-11.md`.

# MildMate Marketing Decision System — Phase 07
## Direct Notion API Product Mapping Automation

**Project root:** `D:/00_Mildmate/Re-build_web/`  
**Planning / handoff folder:** `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`  
**Git branch:** `feature/marketing-data-analyst`  
**UI feature area:** `super-admin/marketing`  
**Analysis API area:** `api/analysis`  
**Database:** Existing Cloudflare D1  
**Deployment:** Existing Cloudflare Pages project  
**Order system:** Notion `OrderList`  
**Product mapping integration:** Direct Notion API  
**Ongoing sales sync:** Existing Make.com `Notion OrderList → D1 Sales Sync`

---

## Status Legend

- `[x]` Completed / verified before this phase
- `[ ]` To do in this phase
- `[!]` Guardrail / must not violate

---

# 1. Phase Goal

Automatically resolve unmapped Notion `OrderList` product lines to permanent D1 `Product_ID`s by using the **Notion API directly**, then write the mapping result back to the same Notion record.

The existing Make.com Sales Sync remains downstream:

```text
Notion OrderList
      ↓
Direct Notion API Product Mapper
      ↓
D1_Product_IDs
D1_Product_Map
Product_Mapping_Status
      ↓
Existing Make.com Sales Sync
      ↓
Worker Sales API
      ↓
D1 sales_orders + sales_order_items
```

This phase does **not** replace the existing Sales Sync workflow.

---

# 2. Architecture Decision

## Product Mapping

Use:

```text
Notion OrderList
      ↓
Notion API
      ↓
Droid-built mapping service / utility
      ↓
Canonical D1 Product Catalog + Mapping Memory
      ↓
Notion API
      ↓
Update same OrderList record
```

Do **not** use Make.com as the main product-mapping engine for the 1,000+ historical records.

## Sales Synchronization

Keep:

```text
Mapped Notion Order
      ↓
Existing Make.com Sales Sync
      ↓
POST /api/v1/sales/orders/upsert
      ↓
D1
```

This separates:

```text
Product Mapping = Code / Notion API
Sales Sync       = Existing Make.com workflow
```

---

# 3. Prerequisites / Confirmed Baseline

- [x] Existing Notion `OrderList` database exists.
- [x] Existing Notion mapping fields exist:
  - `D1_Product_Map`
  - `D1_Product_IDs`
  - `Product_Mapping_Status`
- [x] Status options include `Mapped`, `Partial`, `Review Required`, `Unmapped`.
- [x] Existing Sales Sync only processes mapped orders.
- [x] Actual selected marketplace variation outranks parent listing title.
- [x] Permanent D1 Product_ID is the canonical product identity.
- [x] D1 products include IDs 33 and 34.
- [x] Notion Developer Mode is enabled.
- [x] A Notion API token has been created for developer access.
- [x] `NOTION_TOKEN` can be stored in a local environment variable.
- [x] Replace placeholder `NOTION_DATA_SOURCE_ID` with the real OrderList data source ID. *(verified 2026-09-11: resolves to data source titled "OrderList")*
- [x] Verify a one-record read-only Notion API query. *(verified 2026-09-11: 1 record retrieved, pagination + filters confirmed)*
- [ ] Create/confirm a dedicated Notion credential suitable for **read + update** access to OrderList.

---

# 4. Credential Rule

The token named:

```text
MildMate D1 Historical Reader
```

was created for historical/read access.

Do not silently repurpose it for write access if it is intended to remain read-only.

Recommended dedicated mapping credential:

```text
MildMate OrderList Mapper
```

Purpose:

```text
Read OrderList
+
Update mapping fields in OrderList
```

Store credentials only in environment variables or secrets.

```powershell
$env:NOTION_TOKEN="PRIVATE_TOKEN"
$env:NOTION_DATA_SOURCE_ID="REAL_ORDERLIST_DATA_SOURCE_ID"
```

Never print or commit the token.

---

# 5. Product Mapping Priority

```text
1. Exact marketplace variation / actual selected option
2. Exact verified alias
3. Listing ID + variation
4. Strong deterministic rule
5. AI against approved D1 product catalog
6. Human review
```

Important:

> Actual ordered variation / selected option outranks the parent listing title.

AI may only choose from the approved D1 Product_ID catalog.

AI must never invent Product_ID.

---

# 6. Mapping Confidence

Recommended:

```text
0.95–1.00
→ auto-map when evidence is deterministic

0.80–0.94
→ auto-map only with approved deterministic evidence

Below 0.80
→ Review Required
```

Recommended mapping methods:

```text
EXACT_VARIATION
EXACT_ALIAS
LISTING_VARIATION
RULE
AI
HUMAN
```

---

# 7. Droid Implementation Architecture

Recommended logical components:

```text
Notion API Client
      ↓
OrderList Reader
      ↓
Product Mapping Resolver
      ↓
D1 Product Catalog / Alias Memory
      ↓
Mapping Result
      ↓
OrderList Updater
```

Droid must inspect the repository before choosing exact file paths.

---

# 8. Execution Modes

## Historical / Batch Mapping

For the 1,000+ backlog:

```text
Notion API pagination
      ↓
Eligible unmapped/review records
      ↓
Resolve mapping
      ↓
Update Notion
```

Recommended controls:

```text
--dry-run
--limit
--cursor / resume
--order-id
--edited-after
```

Start with 5, then 20, then 50 records.

## Ongoing Mapping

After batch mode is stable, support incremental processing.

Practical choices:

```text
1. Manual admin action
2. Scheduled Cloudflare Worker/Cron
3. Lightweight scheduled local utility
```

Recommended long term:

```text
Cloudflare Worker / Cron
```

Droid CLI itself is not a persistent background service.

---

# 9. Notion Read Rules

Read only mapping-relevant fields:

```text
Notion page ID
Order_Number
Shop
Product_Info
ProductJSON
D1_Product_Map
D1_Product_IDs
Product_Mapping_Status
last_edited_time
```

Do not retrieve unnecessary customer PII.

Preserve original `Product_Info` and `ProductJSON`.

---

# 10. Notion Write Rules

Update only:

```text
D1_Product_IDs
D1_Product_Map
Product_Mapping_Status
```

Optional future audit fields, only after approval:

```text
Mapping_Method
Mapping_Confidence
Mapping_Updated_At
Mapping_Error
```

Do not modify customer, shipping, order total, order date, notes, or operational status.

---

# 11. D1 Product Catalog

Load the current canonical D1 product catalog before mapping.

Do not use the older 30-product assumption.

Include current products including:

```text
33 — Custom Weighted Blanket Cover with 3-Sided Zipper
34 — Custom Spill-Proof Cushion Protector with 360° Elastic Fit
```

IDs 30 and 31 remain gaps and must not be reused.

---

# 12. Mapping Memory

Where available, use D1 as persistent mapping memory.

Conceptual table:

```text
source_product_aliases
```

Possible fields:

```text
source_system
external_listing_id
variation_text
normalized_alias
product_id
mapping_method
confidence
verified_by
created_at
updated_at
```

Human corrections should become reusable mapping memory.

Do not create a duplicate table if an equivalent already exists.

---

# 13. Mapping Audit History

Where practical, preserve mapping events.

Conceptual table:

```text
product_mapping_events
```

Possible fields:

```text
notion_page_id
source_order_id
raw_product_text
previous_product_ids
resolved_product_ids
mapping_method
confidence
result_status
created_at
```

Do not create this if an equivalent already exists.

---

# 14. Historical Mapping Checklist

- [ ] Verify live Notion API connectivity.
- [ ] Verify real `NOTION_DATA_SOURCE_ID`.
- [ ] Verify mapping credential can read OrderList.
- [ ] Verify mapping credential can update intended fields.
- [ ] Inspect current D1 product catalog.
- [ ] Confirm IDs 33 and 34.
- [ ] Inspect existing mapping alias/history tables.
- [ ] Build Notion API client.
- [ ] Build paginated OrderList reader.
- [ ] Build source normalization.
- [ ] Build product/variation parser.
- [ ] Implement exact variation resolver.
- [ ] Implement exact alias resolver.
- [ ] Implement listing + variation resolver.
- [ ] Implement approved deterministic rules.
- [ ] Implement bounded AI fallback only if needed.
- [ ] Implement confidence scoring.
- [ ] Implement `Review Required`.
- [ ] Implement Notion mapping-field updater.
- [ ] Preserve verified mappings.
- [ ] Add dry-run mode.
- [ ] Add batch limit.
- [ ] Add resume/cursor behavior.
- [ ] Add machine-readable logs.
- [ ] Add human-readable summary.
- [ ] Test 5-record batch.
- [ ] Test 20-record batch.
- [ ] Test 50-record batch.
- [ ] Verify Notion after each batch.
- [ ] Measure mapping coverage.
- [ ] Surface mapping coverage later in Data Analyst dashboard.

---

# 15. Ongoing Mapping Checklist

Only after historical mapping is verified:

- [ ] Decide automatic frequency.
- [ ] Query only new/changed records needing mapping.
- [ ] Use `last_edited_time` / cursor strategy.
- [ ] Prevent remapping verified records.
- [ ] Handle Notion API rate limits.
- [ ] Handle transient errors safely.
- [ ] Prevent concurrent duplicate processing.
- [ ] Add mapping run log.
- [ ] Add `Review Required` alert/report.
- [ ] Decide manual vs Cloudflare Cron execution.
- [ ] Production-test with a controlled set.

---

# 16. Interaction with Existing Make Sales Sync

Keep:

```text
MildMate - Notion OrderList to D1 Sales Sync
```

Expected flow:

```text
Direct mapper writes:
Product_Mapping_Status = Mapped
      ↓
Notion record becomes eligible
      ↓
Existing Make Sales Sync
      ↓
D1 Sales API
```

Before production automation, verify that updating the mapping fields causes the existing Notion watcher/filter behavior expected by the Sales Sync.

If not, document the issue before redesigning the architecture.

---

# 17. Verification Checklist

- [ ] Read one live OrderList record through Notion API.
- [ ] Dry-run one record without writing.
- [ ] Known OrderList ID 1038 resolves to D1 20 + 26.
- [ ] Single-item order maps correctly.
- [ ] Multi-item order maps correctly.
- [ ] Clear selected variation outranks ambiguous parent listing.
- [ ] Unknown variation becomes `Review Required`.
- [ ] Verified mapping remains unchanged.
- [ ] IDs 33/34 resolve where applicable.
- [ ] Wrong Product_ID is rejected before Notion update.
- [ ] Only approved Notion mapping fields change.
- [ ] Rerun is idempotent.
- [ ] Batch resume works.
- [ ] Notion rate-limit handling works.
- [ ] No secret appears in logs.
- [ ] No unnecessary PII appears in logs.
- [ ] Existing Make Sales Sync accepts newly mapped orders.

---

# 18. Deliverables

- [ ] Direct Notion API product mapper.
- [ ] Notion read/update client.
- [ ] Current D1 product catalog resolver.
- [ ] Mapping memory integration where available.
- [ ] Dry-run mode.
- [ ] Batch/resume mode.
- [ ] Logs/reports.
- [ ] Review Required handling.
- [ ] Historical mapping runbook.
- [ ] Ongoing mapping deployment recommendation.
- [ ] Mapping coverage metrics.
- [ ] Phase implementation summary.

---

# 19. Definition of Done

- [ ] Code can read eligible OrderList records directly via Notion API.
- [ ] Resolver uses current canonical D1 Product_ID catalog.
- [ ] Strong-evidence records auto-map safely.
- [ ] Ambiguous records become `Review Required`.
- [ ] Mapping results write back to the same Notion record.
- [ ] Verified mappings are preserved.
- [ ] Historical batches run without Make.com mapping operations.
- [ ] Existing Make Sales Sync continues downstream.
- [ ] Process is idempotent and resumable.
- [ ] Mapping coverage is measurable.
- [ ] Credentials and PII are protected.
- [ ] Ready for Phase 08 historical sales backfill.

---

# 20. Global Guardrails

- [!] Do not expose `NOTION_TOKEN`, `SALES_SYNC_API_TOKEN`, or any production secret.
- [!] Do not hard-code credentials.
- [!] Do not renumber D1 `products.id`.
- [!] Do not let AI invent Product_ID.
- [!] Do not use parent listing title when selected variation conflicts.
- [!] Do not overwrite verified mappings during normal processing.
- [!] Do not overwrite `Product_Info` or `ProductJSON`.
- [!] Do not modify unrelated OrderList properties.
- [!] Do not replace the existing operational website `orders` system.
- [!] Do not invent historical line-item revenue.
- [!] Do not equal-split multi-product totals.
- [!] Do not edit old migrations.
- [!] Do not schedule automatic production mapping before controlled verification.
- [!] Do not remove the existing Make.com Sales Sync in this phase.

---

# 21. Droid CLI Opening Prompt

**Session name:**

```text
MildMate Marketing Decision System — Phase 07 — Direct Notion Product Mapper
```

Open Droid from:

```text
D:/00_Mildmate/Re-build_web/
```

Paste:

```text
We are implementing Phase 07 of the MildMate Marketing Decision System.

PHASE:
Direct Notion API Product Mapping Automation

PROJECT ROOT:
D:/00_Mildmate/Re-build_web/

PLANNING / HANDOFF FOLDER:
D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/

GIT BRANCH:
feature/marketing-data-analyst

ARCHITECTURE DECISION

We are NOT using Make.com as the main Product Mapping engine.

We want MildMate project code to access Notion OrderList directly through the Notion API.

Product Mapping:

Notion OrderList
→ Notion API
→ Product Mapping Resolver
→ canonical D1 Product_ID / mapping memory
→ Notion API
→ update:
   D1_Product_IDs
   D1_Product_Map
   Product_Mapping_Status

Keep the EXISTING Make.com workflow:

MildMate - Notion OrderList to D1 Sales Sync

for sales synchronization.

Expected downstream flow:

Direct Notion Mapper
→ Product_Mapping_Status = Mapped
→ existing Make Sales Sync
→ existing Worker Sales API
→ D1 sales_orders + sales_order_items

Do NOT replace the Sales Sync workflow in this phase.

CURRENT NOTION SETUP

Environment variables will be provided locally:

NOTION_TOKEN
NOTION_DATA_SOURCE_ID

Never print, expose, or commit the token.

OrderList mapping fields:

D1_Product_Map
D1_Product_IDs
Product_Mapping_Status

Statuses:

Mapped
Partial
Review Required
Unmapped

PRODUCT RULES

- Permanent D1 products.id is canonical.
- Never renumber Product_ID.
- Current catalog includes IDs 33 and 34.
- IDs 30 and 31 are gaps and must not be reused.
- Actual selected marketplace variation outranks parent listing title.
- AI may only choose from the approved product catalog.
- AI must never invent Product_ID.

MAPPING PRIORITY

1. Exact selected variation / actual ordered option
2. Exact verified alias
3. Listing ID + variation
4. Strong deterministic rule
5. Bounded AI fallback against approved catalog
6. Human review

LOW CONFIDENCE

If evidence is insufficient:

Product_Mapping_Status = Review Required

Do not guess.

WORKING METHOD

FIRST perform a READ-ONLY inspection.

Do not change code yet.
Do not update Notion yet.
Do not deploy.
Do not create a cron schedule yet.

Verify:

1. Existing repository architecture relevant to Phase 07.
2. Current D1 product schema and product catalog.
3. Whether source_product_aliases or equivalent exists.
4. Whether product_mapping_events or equivalent exists.
5. Existing Notion-related code/dependencies.
6. Existing environment-variable conventions.
7. Existing API/client utility conventions.
8. Existing logging/test conventions.
9. Existing Make Sales Sync assumptions depending on mapping fields.
10. Whether mapping field updates will trigger expected Sales Sync watcher behavior.
11. Recommended Notion API client location.
12. Recommended mapping resolver location.
13. Recommended batch utility/endpoint structure.
14. Recommended dry-run, limit, cursor/resume design.
15. Recommended Notion rate-limit/retry handling.
16. Recommended strategy for historical 1,000+ records.
17. Recommended long-term execution: manual, Cloudflare Cron, or another minimal approach.
18. Security risks.
19. Blockers.

Return:

A. VERIFIED CURRENT STATE
B. NOTION API INTEGRATION PLAN
C. PRODUCT RESOLVER PLAN
D. D1 MAPPING MEMORY / AUDIT PLAN
E. NOTION UPDATE PLAN
F. HISTORICAL BATCH PLAN
G. ONGOING AUTOMATION PLAN
H. INTERACTION WITH EXISTING MAKE SALES SYNC
I. SECURITY
J. FILES TO ADD
K. FILES TO MODIFY
L. FILES/SYSTEMS TO LEAVE UNCHANGED
M. TEST PLAN
N. RISKS / BLOCKERS
O. RECOMMENDED IMPLEMENTATION STEPS

STOP after the inspection report.

Do not implement until the report has been reviewed and approved.
```

---

# 22. Phase Handoff Rule

- [ ] Record files changed.
- [ ] Record D1 tables/views used or created.
- [ ] Record Notion fields read/written.
- [ ] Record tests and results.
- [ ] Record historical mapping coverage.
- [ ] Record unresolved `Review Required` records.
- [ ] Record interaction verification with existing Make Sales Sync.
- [ ] Save summary under `D:/00_Mildmate/Re-build_web/01_MildMate_Marketing/`.
- [ ] Commit only Phase 07 scoped changes.
- [ ] Prepare the Phase 08 handoff and stop.
