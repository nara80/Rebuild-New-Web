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
- [ ] Create/confirm a dedicated Notion credential suitable for **read + update** access to OrderList. *(still pending — under v3 the only Notion write is `D1_Last_Synced_Signature`; confirm write capability before the first live run)*

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

> **Reconciliation (2026-09-12):** statuses reflect the v3 confirmed-mapping sync build. Items marked **(superseded)** belonged to the resolver design; that logic remains available server-side in `/api/v1/mapping/resolve|aliases` for Make.com or future use, but the CLI no longer maps anything.

- [x] Verify live Notion API connectivity. *(2026-09-11)*
- [x] Verify real `NOTION_DATA_SOURCE_ID`. *(2026-09-11 — resolves to data source "OrderList", 45 properties)*
- [x] Verify mapping credential can read OrderList. *(read-only verified; PII fields excluded from reads/logs)*
- [ ] Verify mapping credential can update intended fields. *(superseded scope — the only Notion write under v3 is `D1_Last_Synced_Signature`; live write-back not yet exercised)*
- [x] Inspect current D1 product catalog. *(32 active products; 30/31 gaps preserved)*
- [x] Confirm IDs 33 and 34. *(present and active)*
- [x] Inspect existing mapping alias/history tables. *(migrations 043 + 044 built in repo, local-tested; NOT yet applied to preview/prod D1)*
- [x] Build Notion API client. *(CLI `scripts/notion-product-mapper.mjs`, v3)*
- [x] Build paginated OrderList reader. *(server-side `Mapped` filter + pagination verified)*
- [x] Build source normalization. *(em-dash/case normalization + parser for both live `D1_Product_Map` formats)*
- [x] Build product/variation parser. *(parses confirmed map formats A + B; cross-checks `D1_Product_IDs`)*
- [ ] Implement exact variation resolver. *(superseded — resolver ladder lives only in the Worker API; Make.com confirms mappings under v3)*
- [ ] Implement exact alias resolver. *(superseded — `/api/v1/mapping/aliases` remains for Make.com/human corrections)*
- [ ] Implement listing + variation resolver. *(superseded — server-side only)*
- [ ] Implement approved deterministic rules. *(superseded — server-side only)*
- [ ] Implement bounded AI fallback only if needed. *(superseded — v3 forbids AI in the sync path)*
- [ ] Implement confidence scoring. *(superseded — not part of confirmed-mapping sync)*
- [ ] Implement `Review Required`. *(superseded — Make.com owns Review Required; the CLI never fetches non-Mapped records)*
- [ ] Implement Notion mapping-field updater. *(superseded — v3 CLI writes back ONLY `D1_Last_Synced_Signature`; built, live write-back pending)*
- [x] Preserve verified mappings. *(by eligibility design: Mapped + signature-difference only; never writes mapping fields)*
- [x] Add dry-run mode. *(verified on ID 1038 — correct payload, zero writes)*
- [x] Add batch limit. *(--limit)*
- [x] Add resume/cursor behavior. *(--resume with persisted cursor; live resume not yet exercised)*
- [x] Add machine-readable logs. *(JSONL, token/PII-free — verified)*
- [x] Add human-readable summary. *(run summary with synced/skipped/error counts)*
- [ ] Test 5-record batch. *(live batches pending approval; offline mock test + single-record dry-run passed)*
- [ ] Test 20-record batch.
- [ ] Test 50-record batch.
- [ ] Verify Notion after each batch. *(pending live runs)*
- [ ] Measure mapping coverage. *(Phase 08 work)*
- [ ] Surface mapping coverage later in Data Analyst dashboard. *(Phase 08 work; Phase 06 DQ Monitor already shows mapping/order health)*

---

# 15. Ongoing Mapping Checklist

> **Reconciliation (2026-09-12):** this section is superseded. Under v3, ongoing *automation* is planned in the rewritten Phase 17 checklist (scheduled confirmed-mapping **sync**, not mapping), and ongoing *mapping* itself belongs to Make.com by approved design.

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

> **Reconciliation (2026-09-12):** items marked **(superseded)** describe resolver behavior that no longer applies to the CLI.

- [x] Read one live OrderList record through Notion API. *(ID 1038, 2026-09-11)*
- [x] Dry-run one record without writing. *(1038 — correct D1 upsert payload built, zero writes)*
- [x] Known OrderList ID 1038 resolves to D1 20 + 26. *(v3 semantics: confirmed map parsed → 20 + 26, cross-checked against `D1_Product_IDs` — exact match)*
- [ ] Single-item order maps correctly. *(superseded as a mapping test — single-item confirmed orders will be validated during Phase 08 live batches)*
- [ ] Multi-item order maps correctly. *(2-item payload for 1038 verified in dry-run; live batch validation pending)*
- [ ] Clear selected variation outranks ambiguous parent listing. *(superseded — CLI never maps; rule remains server-side only)*
- [ ] Unknown variation becomes `Review Required`. *(superseded — Make.com owns Review Required)*
- [x] Verified mapping remains unchanged. *(by design the CLI never writes mapping fields; live idempotent re-run still to be confirmed)*
- [x] IDs 33/34 resolve where applicable. *(catalog validation includes 33/34; local `/api/v1/mapping/catalog` test confirmed)*
- [x] Wrong Product_ID is rejected before Notion update. *(catalog validation + `D1_Product_IDs` cross-check; mismatches skipped and logged — locally tested)*
- [x] Only approved Notion mapping fields change. *(v3 writes ONLY `D1_Last_Synced_Signature`; code-verified + dry-run; live confirmation pending)*
- [ ] Rerun is idempotent. *(built; live re-run of 1038 pending)*
- [ ] Batch resume works. *(built; not live-exercised)*
- [ ] Notion rate-limit handling works. *(350 ms throttle + 429/5xx backoff built; no live 429 encountered yet)*
- [x] No secret appears in logs. *(verified in dry-run logs)*
- [x] No unnecessary PII appears in logs. *(verified — logs carry order number + ids only)*
- [ ] Existing Make Sales Sync accepts newly mapped orders. *(n/a as phrased: under v3 the CLI upserts via the Sales API directly and Make sync is an independent pipeline — re-verify after the Phase 08 activation decision)*

---

# 18. Deliverables

> **Reconciliation (2026-09-12):** status against the actual v3 build (commit `b43c02d`, merged to `master`).

- [x] Direct Notion API product mapper. *(delivered as the v3 confirmed-mapping **sync** CLI — mapping itself stays with Make.com by approved design)*
- [x] Notion read/update client. *(read verified live; update limited to signature write-back, live test pending)*
- [x] Current D1 product catalog resolver. *(catalog validation in CLI + `/api/v1/mapping/catalog` endpoint)*
- [x] Mapping memory integration where available. *(migration 043 + `/api/v1/mapping/aliases`, local-tested)*
- [x] Dry-run mode. *(verified on ID 1038)*
- [x] Batch/resume mode. *(built; live batches pending)*
- [x] Logs/reports. *(JSONL logs + run summary, token/PII-free)*
- [ ] Review Required handling. *(superseded — Make.com owns Review Required; count reporting planned in Phase 17)*
- [x] Historical mapping runbook. *(rewritten for v3 sync: `05_Mapping/Phase_07_Historical_Mapping_Runbook_2026-09-10.md`)*
- [x] Ongoing mapping deployment recommendation. *(decided: dedicated Cloudflare Worker + Cron Trigger; Phase 17 checklist rewritten accordingly)*
- [ ] Mapping coverage metrics. *(Phase 08 work)*
- [x] Phase implementation summary. *(this annotated checklist + `09_Handoffs/Phase_07_08_Reconciliation_2026-09-11.md`)*

---

# 19. Definition of Done

> **Reconciliation (2026-09-12):** several DoD items were redefined by the approved v3 design.

- [x] Code can read eligible OrderList records directly via Notion API. *(eligible = `Mapped` + signature-difference; enforced server-side)*
- [x] Resolver uses current canonical D1 Product_ID catalog. *(every parsed id validated against the 32-product catalog incl. 33/34)*
- [ ] Strong-evidence records auto-map safely. *(superseded — no auto-mapping under v3; Make.com confirms mappings)*
- [ ] Ambiguous records become `Review Required`. *(superseded — Make.com owns Review Required)*
- [ ] Mapping results write back to the same Notion record. *(superseded — the CLI writes back only `D1_Last_Synced_Signature` after a successful D1 upsert)*
- [x] Verified mappings are preserved. *(by design; live confirmation pending)*
- [ ] Historical batches run without Make.com mapping operations. *(engine built + dry-run verified; live batches pending approval — Phase 08)*
- [x] Existing Make Sales Sync continues downstream. *(untouched; stays OFF until the Phase 08 activation decision)*
- [x] Process is idempotent and resumable. *(built; live idempotency/resume confirmation pending)*
- [ ] Mapping coverage is measurable. *(analysis layer + DQ Monitor in place; per-period coverage report is Phase 08 work)*
- [x] Credentials and PII are protected. *(verified: no token/PII in logs; `.dev.vars` gitignored)*
- [ ] Ready for Phase 08 historical sales backfill. *(code-ready; blocked only on approvals + deploy/prod-migration steps — see reconciliation §6)*

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
