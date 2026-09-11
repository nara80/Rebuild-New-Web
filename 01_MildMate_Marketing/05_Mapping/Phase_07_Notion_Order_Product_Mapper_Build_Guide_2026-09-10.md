> **❌ OBSOLETE AS A MAPPER DESIGN (2026-09-11).** The Make.com mapper scenario described here was never built and will not be built: by approved v3 design, Make.com's existing workflow confirms mappings in Notion and the Droid CLI syncs confirmed `Mapped` records into D1. The **Worker API endpoint reference below remains valid** (`/api/v1/mapping/catalog|resolve|aliases` are live code and may serve Make.com or Phase 17). See `09_Handoffs/Phase_07_08_Reconciliation_2026-09-11.md`.

# Phase 07 — `MildMate - Notion Order Product Mapper` Build Guide

**Date:** 2026-09-10
**Scenario:** `01 — Notion Order Product Mapper` (Make.com)
**Backend support (built this phase):** D1 mapping memory (`product_mapping_aliases`, migration 043) + token-protected `/api/v1/mapping/*` endpoints.

## Purpose

Automatically resolve unmapped Notion OrderList items to canonical D1 Product_IDs **before** they reach the existing `MildMate - Notion OrderList to D1 Sales Sync` scenario (which only processes `Product_Mapping_Status = Mapped`).

```
Unmapped order → Product mapping → Mapped → Existing D1 Sales Sync
```

## Resolution ladder (must be followed in this order)

| Priority | Method | API result `method` | Confidence | Outcome |
|---|---|---|---|---|
| 1 | Exact marketplace variation (listing_id + selected variation text) | `variation_exact` | high | Mapped |
| 2 | Exact verified alias (human-corrected mapping memory) | `verified_alias` | high | Mapped |
| 3 | Listing-level mapping (only where the listing maps deterministically, incl. multi-product listings like 1038 → D1 20 + 26) | `listing` | medium | Mapped |
| 4 | Deterministic rules (only when defensible) | scenario-side | medium | Mapped |
| 5 | AI bounded fallback — choose ONLY from `/api/v1/mapping/catalog`; below confidence bar → do not write ids | scenario-side | low | Review Required |
| — | No defensible match | — | — | Review Required |

Hard rules:
- **Actual selected variation outranks parent listing title** (enforced server-side by the resolve ladder).
- **AI must never invent a Product_ID.** It may only pick from the approved catalog, and low-confidence picks go to `Review Required`, never silently written as Mapped.
- **Never overwrite already-verified mappings** — the trigger filter must exclude records already `Mapped`.
- **Never overwrite original source text** (`ProductJSON` / `Product_Info` stay untouched; write results only to `D1_Product_IDs`, `D1_Product_Map`, `Product_Mapping_Status`).

## Worker API endpoints (Bearer `SALES_SYNC_API_TOKEN`, same auth as sales sync)

Base: `https://www.mildmate.com` (canonical production origin).

### `GET /api/v1/mapping/catalog`
Approved canonical Product_ID catalog (active products: `id, slug, title_en, product_type`). Use as the ONLY allowed id space for the AI fallback prompt. Includes IDs 33 and 34.

### `POST /api/v1/mapping/resolve`
Body (all optional, at least one required):
```json
{ "source_system": "etsy", "listing_id": "1038", "variation_text": "…selected variation…", "item_text": "…raw item text…" }
```
Responses:
- Resolved: `{ "resolved": true, "method": "variation_exact|verified_alias|listing", "confidence": "high|medium", "product_ids": [3], "mapping_status_suggestion": "Mapped", "alias_id": 2, "verified": true }`
- Not resolved: `{ "resolved": false, "mapping_status_suggestion": "Review Required", "message": "…" }`

Matching is normalized (case, punctuation, whitespace — an em-dash vs hyphen difference still matches). Source-specific aliases outrank source-agnostic ones; verified outrank unverified. Every hit increments `hit_count` / `last_used_at` (usage telemetry).

### `POST /api/v1/mapping/aliases` (mapping memory — human corrections)
```json
{ "source_system": "etsy", "listing_id": "5001", "alias_text": "Marine Fitted Sheet - V-Berth Shape 03",
  "product_ids": [3], "match_scope": "variation", "verified": true, "notes": "human correction 2026-09-10" }
```
- `match_scope`: `variation` (requires `listing_id`), `listing`, or `alias` (free-text).
- `product_ids` are validated against D1 `products` (invalid id → 400 `PRODUCT_NOT_FOUND`).
- Idempotent upsert on (source_system, listing_id, normalized alias): re-posting returns `action: "updated"`.
- `verified` defaults to `true` (human corrections). Use this endpoint from the review workflow (scenario `03 — Product Mapping Review / Learning`) so corrections become reusable memory.

### `GET /api/v1/mapping/aliases`
Lists up to 500 aliases (most recently updated first) for audit/review.

## Make.com scenario blueprint

1. **Notion — Watch Data Source Items** (OrderList)
   - Filter: `Product_Mapping_Status` is empty, `Unmapped`, or `Review Required` (per approved workflow mode). **Never** re-process `Mapped` records (preserves verified mappings).
   - Production start: `Choose where to start → From now on`.
2. **Tools — Set variables**: extract `Shop` (source_system), listing id and selected variation from `ProductJSON` / `Product_Info` (read-only parse; do not write back to these fields).
3. **Iterator** over parsed line items.
4. **HTTP — POST `/api/v1/mapping/resolve`** per item with `source_system`, `listing_id`, `variation_text`, `item_text`. Header: `Authorization: Bearer {{SALES_SYNC_API_TOKEN}}` (Make connection variable; never hardcode in module notes/logs).
5. **Router:**
   - `resolved = true` → collect `product_ids` for the item.
   - `resolved = false` → optional deterministic rules; then optional **bounded AI fallback**: prompt includes only `/api/v1/mapping/catalog` entries; require the model to answer with a catalog id + confidence or `NONE`. Anything but a high-confidence catalog id → mark item unresolved.
6. **Array aggregator** → per-order rollup:
   - All items resolved → `Product_Mapping_Status = Mapped`
   - Some resolved → `Partial` (sales sync will not pick it up; appears in dashboard Partial counts)
   - Any unresolved / AI-low-confidence → `Review Required`
7. **Notion — Update Data Source Item**: write
   - `D1_Product_IDs` — e.g. `20, 26`
   - `D1_Product_Map` — e.g. `Item 1 | D1 26 | BedBridge Connector | Qty 1 | Status Mapped` (format expected by the existing Sales Sync text parser)
   - `Product_Mapping_Status`
8. Mapped orders then flow automatically through the existing `Notion OrderList to D1 Sales Sync` scenario (route filter `Product_Mapping_Status = Mapped`).

## Catalog reconciliation

- D1 canonical identity: 32 active products (1–29, 32, 33, 34; gaps 30/31 intentional — never renumber). `/api/v1/mapping/catalog` reflects D1 live, including 33/34.
- Seeded mapping memory: known ID `1038` → D1 `[20, 26]` (verified, listing scope) via migration 043.
- The 16 manually confirmed Etsy listing IDs (Google Product Master) should be loaded into mapping memory via `POST /api/v1/mapping/aliases` (one call per listing, `match_scope: "listing"` or `"variation"` as appropriate). This is an operational step in Make.com/manually — the endpoint is ready.

## Verification mapping to Phase 07 checklist

| Checklist case | How verified |
|---|---|
| Known ID 1038 → D1 20 + 26 | Local API test: resolve returned `[20,26]`, method `listing` ✅ |
| Unknown variation → Review Required | resolve returned `resolved:false`, suggestion `Review Required` ✅ |
| Ambiguous listing title with clear variation | listing alias (→ D1 1) + variation alias (→ D1 3) on same listing: variation won ✅ |
| Already-verified mapping unchanged | trigger filter excludes `Mapped`; alias upsert idempotent (`updated`, ids preserved) ✅ |
| IDs 33/34 selectable | catalog includes 33 & 34 ✅ |
| Single-item / multi-item order | end-to-end in Make.com once scenario is built (backend supports both; 1038 is the multi-product case) — operational step |

## Operational prerequisites before activation

1. Apply migration 043 to preview + production D1.
2. Deploy the updated worker bundle (ships with Phases 04–06).
3. Confirm `SALES_SYNC_API_TOKEN` connection in Make.com (already configured for the sales sync).
4. Build the scenario per blueprint; keep schedule OFF until test orders pass; start `From now on`.
