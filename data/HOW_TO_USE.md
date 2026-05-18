# MildMate Product Catalog System

## Overview

This system uses **data/products.json** as the single source of truth. When you add a product to the JSON, running the regenerator automatically updates all pages with correct tags, data-categories, and dropdown values.

---

## How It Works

```
data/products.json
       │
       ▼
scripts/regenerate-products.js
       │
       ├──► public/products/index.html        (EN shop page)
       ├──► public/th/products/index.html     (TH shop page)
       ├──► public/sheets/index.html          (EN type page)
       ├──► public/pillowcases/index.html      (EN type page)
       ├──► public/marine/index.html           (EN niche page)
       ├──► public/family/index.html           (EN niche page)
       └──► ...all 12 type + niche pages
```

---

## The Three Components Stay Consistent

| Component | Source |
|---|---|
| Card tags on niche pages | Derived from `categories[]` in JSON |
| Dropdown filter options | Generated from `types` + `niches` in JSON |
| `data-categories` on `/products/` cards | Taken directly from `categories[]` in JSON |

---

## Adding a New Product

**Step 1:** Add to `data/products.json`

```json
{
  "slug": "my-new-product",
  "name": "My New Product",
  "nameTh": "สินค้าใหม่ของฉัน",
  "categories": ["sheets", "marine", "family"],
  "priceUsd": 48,
  "priceThb": 1695,
  "image": "/images/products/my-new-product/main.jpg",
  "url": "/product/my-new-product/",
  "urlTh": "/th/product/my-new-product/",
  "displayOrder": 10
}
```

**Step 2:** Create image at `public/images/products/my-new-product/main.jpg`

**Step 3:** Run the regenerator

```bash
node scripts/regenerate-products.js
```

**Result:** All pages update automatically:
- `/products/` → card with `data-categories="sheets,marine,family"` + tags `SHEETS` `MARINE` `FAMILY`
- `/marine/` → card with tags `SHEETS` `MARINE`
- `/family/` → card with tags `SHEETS` `FAMILY`
- `/sheets/` → card with tags `SHEETS` `MARINE` `FAMILY`

---

## Tag Rule

| Product Type | Primary Tag | Niche Tags |
|---|---|---|
| Fitted sheets with niche | `SHEETS` | `MARINE` / `FAMILY` / `PETS` etc. |
| Duvet Covers with niche | `DUVET-COVERS` | niche tag |
| Pillowcases (type page) | `PILLOWCASES` | none on `/pillowcases/` |
| Pillowcases (niche page) | `PILLOWCASES` | niche tag |
| Protection products | `PROTECTION` | niche tag |
| Accessories | `ACCESSORIES` | niche tag |

**No DUVET tag** on Pillowcase cards anywhere. DUVET tag only appears on Duvet Cover products.

---

## Category Reference

**Product Types** (Shop by Product dropdown):
- `sheets` → "Sheets" → `SHEETS` tag
- `duvet-covers` → "Duvet Covers" → `DUVET-COVERS` tag
- `pillowcases` → "Pillowcases" → `PILLOWCASES` tag
- `protection` → "Protection" → `PROTECTION` tag
- `accessories` → "Accessories" → `ACCESSORIES` tag

**Niches** (Shop by Niche dropdown):
- `marine` → "Marine & Yacht" → `MARINE` tag
- `family` → "Family & Co-Sleep" → `FAMILY` tag
- `pets` → "Pet Owner" → `PETS` tag
- `deep-pocket` → "Deep Pocket" → `DEEP-POCKET` tag
- `boarding-dorm` → "Boarding Dorm" → `BOARDING-DORM` tag
- `rv-truck` → "RV & Truck Cab" → `RV-TRUCK` tag

---

## Files Reference

| File | Purpose |
|---|---|
| `data/products.json` | **MASTER DATA** — Add/remove products here |
| `data/templates.json` | HTML structure templates |
| `scripts/build-products.js` | Full page generator (replaces entire files) |
| `scripts/regenerate-products.js` | Incremental updater (injects into existing pages) |

---

## Running the Regenerator

```bash
# From project root
node scripts/regenerate-products.js

# Output example:
# ✅ 16 pages updated, 27 cards generated
# 🔍 Filter consistency check:
#   sheets         → 9 products
#   duvet-covers   → 6 products
#   pillowcases   → 3 products
#   protection     → 8 products
#   accessories    → 2 products
#   ...
```

---

## Template Marker Syntax

Pages must contain this marker for the regenerator to work:

```html
<!-- GENERATED_PRODUCTS START -->

<!-- GENERATED_PRODUCTS END -->
```

The regenerator replaces everything between these markers.

---

## When to Use Which Script

| Situation | Script |
|---|---|
| Add/edit products in JSON | `regenerate-products.js` |
| First-time build from JSON | `build-products.js` |
| Add new page template | Update `data/templates.json` |

---

## Notes

- All 27 products are currently in `data/products.json`
- The script automatically filters products per page based on their `categories` array
- Pillowcase cards on `/pillowcases/` show ONLY `PILLOWCASES` tag (no niche tags, no DUVET)
- On niche pages (marine/family/etc.), pillowcase cards show `PILLOWCASES` + niche tag
- The filter dropdown in `/products/` reads values directly from the JSON `types` + `niches` keys
