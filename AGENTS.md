# AGENTS.md — MildMate Web Rebuild Project Memory

This file is read by Droid at the start of every session. It contains all critical project context so any Droid instance can continue work without re-asking questions.

---

## Project Overview

- **Business:** MildMate — custom bedding manufacturer in Thailand
- **Current site:** WordPress on `www.mildmate.com` (Flatsome theme)
- **Goal:** Rebuild to Vanilla HTML + Cloudflare Workers with e-commerce features
- **Dev URL:** `mildmate-new.pages.dev` (production: `www.mildmate.com` at 100% completion)
- **Phase 2 deferred:** Will be done at pre-launch (after Phase 7)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML + CSS + minimal JS |
| Backend | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (`mildmate-db`) |
| Storage | Cloudflare R2 (`mildmate-assets`) |
| Email | Resend (free tier: 100/day, `RESEND_API_KEY` secret) |
| Payments | Stripe (USD + PromptPay THB) |
| Admin Auth | Cloudflare Access (Google login) |
| Deploy | Cloudflare Pages |

---

## Cloudflare Account

- **Account:** `nara19080@gmail.com` (old account — existing resources)
- **D1 Database:** `mildmate-db` (ID: `85ce2f41-463a-43fa-8485-181e983b8fd4`)
- **R2 Bucket:** `mildmate-assets`
- **Pages Project:** `mildmate-new`
- **Wrangler login:** Use `nara19080@gmail.com`

---

## GitHub

- **Account:** `nara80` (email: `nara19080@gmail.com`)
- **Repo:** `Rebuild-New-Web` (private)
- **Repo URL:** `https://github.com/nara80/Rebuild-New-Web`
- **Auth method:** HTTPS with Personal Access Token (credential helper cached 1 year)

---

## Brand Design Tokens

```css
--color-primary: #2c96f4;
--color-primary-dark: #1a7fd4;
--color-text: #333333;
--color-bg: #ffffff;
--color-surface: #f8f9fa;
--color-border: #e5e7eb;
--font-main: 'Quicksand', sans-serif;
--radius: 8px;
--shadow: 0 2px 12px rgba(0,0,0,0.08);
```

### Font System (Bilingual EN/TH)
| Language | Font | Source |
|---|---|---|
| English | Quicksand (400, 600, 700) | Google Fonts |
| Thai | Sarabun (400, 600, 700) | Google Fonts |

**Implementation:**
- Both fonts loaded via single Google Fonts URL: `family=Quicksand:wght@400;600;700&family=Sarabun:wght@400;600;700&display=swap`
- CSS `:lang(th) { font-family: 'Sarabun', sans-serif; }` in `main.css` overrides Quicksand for Thai text
- All 26+ HTML files updated with dual font URL

---

## Phase Status

| Phase | Status | Notes |
|---|---|---|
| 0 — Mockup | ✅ Approved | `mockup.html` created |
| 1 — Foundation | ✅ Complete | Scaffold, D1 migration, local server tested, placeholder index.html |
| 2 — SEO URLs | ⏸️ Deferred | **Intentionally deferred — runs pre-launch AFTER Phase 7 complete** |
| 3 — Design System | ✅ Complete | Header, footer, CSS, nav.js, search overlay, mobile drawer left |
| 4 — Homepage + Products | ✅ Complete | Homepage EN+TH (AJAX email signup, 15% off), configurator, cart.js, geo.js, all static pages (about→Engineering Authority 5-section rebuild with real images, contact, fabric, shipping→Returns&Delivery, policy, reviews), size guides, product/category skeletons, workers (products, pricing, geo, subscribe, unsubscribe, quote, contact, email), image compression (92.5% saved), `discount_claims` migration ready, cookie consent banner (GDPR, GA4 G-0GWVSPJLVJ), real Etsy reviews (8 with mapped names/countries), 14-section privacy policy, unsubscribe page + API, header consistency (about/reviews/contact/fabric all blue-gradient hero), full global footer restored on how-to-measure-mattress-size + custom-measurement, Sarabun Thai font added to all 26+ HTML files, comprehensive size guide revision across all 8 regions, all footers full 4-col global. All 12 EN+TH product/category pages complete with brand-hero + real photos. Blog index + post template + sample post. Product inventory verified at 27 products (9/6/3/7/2). **23 of 27 products have live configurator pricing formulas** — see Configurator Status below. **Centralized product template system** (2 templates, build script, content data — all 27 pages regenerated from source). **Fabric specs grids** replace dropdowns for locked-fabric products (BreezePlus, CloudSoft, TPU, 3-layer protectors). **Fabric color selector** updates per-fabric (4 color sets matching /fabric/), 6-col grid with visible borders. **Responsive carousel dots** on reviews + related products (desktop/tablet/mobile). **UI simplifications**: region grid removed, Apple Pay removed, star ratings removed, size dropdown region-aware (US imperial, others metric). **USD whole-dollar pricing** on EN pages, THB-only on TH pages. **Centralized size system** (`product-sizes.js`, 174 entries, 8 regions) auto-populates all product page size dropdowns — synced from `/sizeguide/`. **Custom quote popup**: "Custom Quote" button → modal form (Name*, Email*, Address, Telephone) → POST `/api/quote` → D1 `custom_quotes` + `subscribers` dedup → **Resend** email to contact@mildmate.com → confirmation popup (dimensions, fabric, quote ID). **Anti-spam**: honeypot field + IP rate limit (D1 `rate_limits` table) on quote (3/hr) and subscribe (5/hr). Future: D1 `standard_prices` table for admin-controlled standard-size prices (API lookup); custom dimensions use live formula |
| 5 — Checkout + Stripe + Social Login | ⏸️ Pending | Guest checkout, Stripe (PromptPay/cards), social login (Google/FB/LINE/Apple), My Account |
| 6 — Abandoned Cart | ⏸️ Pending | Cron trigger, recovery emails |
| 7 — Admin Dashboard | ⏸️ Pending | Orders, products, upload, subscribers |
| 8 — Launch | ⏸️ Pending | DNS cutover, testing, sitemap |
| 9 — Testing (Vitest) | ⏸️ Pending | Unit tests for Worker API: pricing (V-Berth/fitted), cart, geo-currency, subscribers, quote, products, webhook — `@cloudflare/vitest-pool-workers` |

---

## Key Decisions Already Made

| Decision | Value |
|---|---|
| Payment gateway | Stripe (PromptPay for TH, cards for global) |
| Email service | Resend (free tier: 100/day, `RESEND_API_KEY` secret) |
| Admin access | Cloudflare Access (Google login) |
| Dev domain | `mildmate-new.pages.dev` |
| Cutover trigger | 100% completion, not before |
| Language | Bilingual Thai/English, EN primary |
| Font | Quicksand (EN) + Sarabun (TH) — bilingual font pairing |
| Header desktop | Logo left, nav center, actions right |
| Header mobile | Hamburger left, logo center, actions right |
| Mobile drawer | Slides in from left |
| Footer style | Minimal, icon-only marketplace/social, no logo block |
| LINE sticky bar | Removed (international positioning) |
| Checkout | Guest checkout default, social login optional |
| Search | Overlay triggered by magnifying glass icon |

---

## Existing WordPress URLs (258 total)

- 125 pages
- 50 posts
- 83 products

Source files in `MildMateDataBase/ExistingWeb/`:
- `MildMate_Pages.md`
- `MildMate_Posts.md`
- `MildMate_Products.md`

---

## Product Category Structure (Revised 2026-05-14)

### Primary Navigation — Product Type (SEO discoverability)
| Category | URL | Products |
|---|---|---|
| Sheets | `/sheets/` | Standard, Deep Pocket, Marine, Dorm, RV & Truck, Family, Pet Owner (Fitted) + Standard, Extra Deep Pocket (Flat) — 9 products |
| Duvet Covers | `/duvet-covers/` | 3-Sided Zipper, Pet Owner, Marine, RV, Dorm, Duvet Insert — 6 products |
| Pillowcases | `/pillowcases/` | Envelope, Zipper, Sham — 3 products |
| Protection | `/protection/` | Standard, Family, Deep Pocket, Pet-Proof, 6-Sided Encasement, RV & Truck Encasement, Pillow Protector — 7 products |
| Accessories | `/accessories/` | BedBridge Connector, Bed Lifter — 2 products |

### SEO Landing Pages — Use Case (high-conversion)
| Category | URL | Cross-links to Product Type |
|---|---|---|
| Marine & Yacht | `/marine/` | `/sheets/` — Marine Fitted Sheet; `/duvet-covers/` — Marine Duvet Cover |
| Family & Co-Sleep | `/family/` | `/sheets/` — Family Fitted Sheet; `/accessories/` — BedBridge Connector |
| Deep Pocket | `/deep-pocket/` | `/sheets/` — Deep Pocket Fitted Sheet, Extra Deep Pocket Flat; `/protection/` — Deep Pocket Protector |
| Boarding Dorm | `/boarding-dorm/` | `/sheets/` — Dorm Fitted Sheet; `/duvet-covers/` — 3-Sided Zipper, Dorm Duvet Cover |
| Pet Owner Bedding | `/pets/` | `/sheets/` — Pet Owner Fitted Sheet; `/duvet-covers/` — Pet Owner Duvet Cover; `/protection/` — Pet-Proof Protector |
| RV & Truck Cab | `/rv-truck/` | `/sheets/` — RV & Truck Fitted Sheet; `/protection/` — RV & Truck Encasement |

### Product Detail Pages (27 product listings with clean slugs)
| Product | URL | Category |
|---|---|---|
| Standard Fitted Sheet | `/product/standard-fitted-sheet/` | Sheets |
| Deep Pocket Fitted Sheet | `/product/deep-pocket-fitted-sheet/` | Sheets, Deep Pocket |
| Marine Fitted Sheet | `/product/marine-fitted-sheet/` | Sheets, Marine |
| Dorm Fitted Sheet | `/product/dorm-fitted-sheet/` | Sheets, Boarding Dorm |
| RV & Truck Fitted Sheet | `/product/rv-truck-fitted-sheet/` | Sheets, RV-Truck |
| Family Fitted Sheet | `/product/family-fitted-sheet/` | Sheets, Family |
| Pet Owner Fitted Sheet | `/product/pet-owner-fitted-sheet/` | Sheets, Pets |
| Flat Sheet — Standard | `/product/flat-sheet-standard/` | Sheets |
| Flat Sheet — Extra Deep Pocket | `/product/flat-sheet-extra-deep-pocket/` | Sheets, Deep Pocket |
| 3-Sided Zipper Duvet Cover | `/product/3-sided-duvet/` | Duvet Covers, Boarding Dorm |
| Pet Owner Duvet Cover | `/product/pet-owner-duvet-cover/` | Duvet Covers, Pets |
| Duvet Cover — Marine | `/product/duvet-cover-marine/` | Duvet Covers, Marine |
| Duvet Cover — RV | `/product/duvet-cover-rv/` | Duvet Covers, RV-Truck |
| Duvet Cover — Dorm | `/product/duvet-cover-dorm/` | Duvet Covers, Boarding Dorm |
| Duvet Insert | `/product/duvet-insert/` | Duvet Covers |
| Envelope Pillowcase | `/product/pillowcase-envelope/` | Pillowcases |
| Zipper Pillowcase | `/product/pillowcase-zipper/` | Pillowcases |
| Sham Pillowcase | `/product/pillowcase-sham/` | Pillowcases |
| Mattress Protector — Standard | `/product/mattress-protector-standard/` | Protection |
| Mattress Protector — Family | `/product/mattress-protector-family/` | Protection, Family |
| Mattress Protector — Deep Pocket | `/product/mattress-protector-deep-pocket/` | Protection, Deep Pocket |
| Pet-Proof Mattress Protector | `/product/pet-proof-mattress-protector/` | Protection, Pets |
| 6-Sided Mattress Encasement | `/product/mattress-encasement-general/` | Protection, Marine, RV-Truck, Boarding Dorm |
| RV & Truck Mattress Encasement | `/product/rv-truck-mattress-encasement/` | Protection, RV-Truck |
| Pillow Protector | `/product/pillow-protector-general/` | Protection |
| BedBridge Connector | `/product/bedbridge-connector/` | Accessories, Family |
| Bed Lifter (38 cm) | `/product/mattress-lift-helper/` | Accessories |

---

## Configurator Pricing Status (23 of 27 products verified)

All product detail pages use the shared `public/js/product-configurator.js` which auto-detects the product type from the URL path and applies the correct pricing formula. The full workflow is: [Custom Size] → enter dimensions → live price → [Custom Quote] → popup form (Name/Email) → POST `/api/quote` → Resend email to contact@mildmate.com.

Size dropdowns on all product pages are auto-populated from `public/js/product-sizes.js` (174 entries across 8 regions). To update sizes across all pages, edit `/sizeguide/` then sync `product-sizes.js`.

USD prices displayed as whole dollars (no decimals).

### Products with Live Pricing Formula (19)

| Product | Formula | Server Function | Markup |
|---|---|---|---|
| Standard Fitted Sheet | Fitted sheet | `calculateFittedSheetPrice()` | 15/20/30% |
| Deep Pocket Fitted Sheet | Fitted sheet | `calculateFittedSheetPrice()` | 15/20/30% |
| Dorm Fitted Sheet | Fitted sheet | `calculateFittedSheetPrice()` | 15/20/30% |
| RV & Truck Fitted Sheet | Fitted sheet | `calculateFittedSheetPrice()` | 15/20/45% |
| Pet Owner Fitted Sheet | Fitted sheet | `calculateFittedSheetPrice()` | 15/20/30% |
| Family Fitted Sheet | Fitted sheet | `calculateFittedSheetPrice()` | 15/20/50% |
| Flat Sheet — Standard | Flat sheet | `calculateFlatSheetPrice()` | 15/20/30% |
| Flat Sheet — Extra Deep Pocket | Flat sheet | `calculateFlatSheetPrice()` | 15/20/30% |
| 6-Sided Mattress Encasement | Encasement (TPU) | `calculateEncasementPrice()` | 15/25/50% |
| RV & Truck Mattress Encasement | Encasement (TPU) | `calculateEncasementPrice()` | 15/25/50% |
| 3-Sided Zipper Duvet Cover | Duvet cover | `calculateDuvetPrice()` | 15/20/30% |
| Duvet Cover — Dorm | Duvet cover | `calculateDuvetPrice()` | 15/20/30% |
| Duvet Cover — RV | Duvet cover | `calculateDuvetPrice()` | 15/20/30% |
| Duvet Cover — Marine | Duvet cover | `calculateDuvetPrice()` | 15/20/30% |
| Pet Owner Duvet Cover | Duvet cover | `calculateDuvetPrice()` | 15/20/30% |
| Envelope Pillowcase | Pillowcase | `calculatePillowcasePrice()` | 15/25/15% |
| Zipper Pillowcase | Pillowcase | `calculatePillowcasePrice()` | 15/25/15% |
| Sham Pillowcase | Pillowcase | `calculatePillowcasePrice()` | 15/25/15% |
| Pillow Protector | Pillow protector (TPU) | `calculatePillowProtectorPrice()` | 15/25/35% |
| Mattress Protector — Standard | Protector (3-layer) | `calcMattressProtector()` | 15/15/20/15% |
| Mattress Protector — Deep Pocket | Protector (3-layer) | `calcMattressProtector()` | 15/15/20/25% |
| Mattress Protector — Family | Protector (3-layer) | `calcMattressProtector()` | 15/15/20/50% |
| Pet-Proof Mattress Protector | Protector (3-layer) | `calcMattressProtector()` | 15/15/20/15% |

**Fitted sheet formula:** W_fabric=W+2D+14, L_fabric=L+2D+14; tiered sewing (120–500 THB); accessories = fabric×0.10. Fabric cost: (area×rate/23,744)×1.20.

**Flat sheet formula:** W_fabric=W+2D+50, L_fabric=L+2D+50; flat sewing 250 THB (no elastic, no accessories). Fabric cost same as fitted.

**Encasement formula:** Area = 2(W×L + W×D + L×D); TPU fabric (120 THB/linear metre, 210cm bolt) ×1.20 waste; sewing 300 THB flat; zipper 0.4 THB/cm × (2L+W); packing 100; delivery 50; markup 15/25/50%. Round to nearest 100 THB, USD = THB/30.

**Duvet cover formula:** floorArea = 2×(W+5)×(L+5)×1.20 (2 pieces, 5cm seam, 20% waste); zipper 0.4×(2L+W); tiered sewing (≤139,200→300, ≤170,400→400, >170,400→600); packing 100; delivery 50; markup 15/20/30%. No depth input.

**Pillowcase formula:** area = 2×(W+5)×(L+5)×1.60 (60% waste); Sham +15% fabric; sewing 40 THB (50 for Sham); Zipper: 0.4×max(W,L); packing 100; delivery 50; markup 15/25/15%. Max W,L=120cm. No depth input.

**Pillow protector formula:** Same geometry as pillowcase-zipper but TPU fabric (120 THB/lm ÷ 21,000 cm²/lm); markup 15/25/35%. No depth input.

**Mattress protector formula:** Area-based fabric tier (W×L in sq.inch → 550-1,300 THB via tiered lookup) + depth surcharge (<30cm:0, ≥30:200, ≥52:400, >56:600 THB) + packing 200 + delivery 80, × markup (ops 15% + mkt 20% + margin 15-50%). Max W/L=210cm for non-family; over 210 redirects to Family Protector.

### Products NOT Requiring Configurator (2)

| Product | Reason |
|---|---|
| BedBridge Connector | Fixed-price accessory, no custom dimensions |
| Bed Lifter (38 cm) | Fixed-price accessory, no custom dimensions |

### Products Awaiting Configurator (2)

| Product | Category |
|---|---|
| Marine Fitted Sheet | Sheets, Marine |
| Duvet Insert | Duvet Covers |

---

## Database Schema (7 tables, 6 active)

- `products` — product catalog
- `orders` — customer orders with custom dimensions
- `custom_quotes` — quote requests (name, email, dimensions, fabric, status)
- `abandoned_carts` — email + cart JSON for recovery
- `subscribers` — email signup list (dedup: quote form also inserts here)
- `rate_limits` — IP-based rate limiting for anti-spam (quote: 3/hr, subscribe: 5/hr)
- `standard_prices` (planned) — pre-calculated prices per product × size × fabric for admin-controlled standard-size pricing

See `migrations/001_initial.sql` through `migrations/004_rate_limits.sql` for current schema.

---

## File Structure

```
D:\00_MildMate\Re-Bulit_Web\
├── AGENTS.md                          ← This file
├── mockup.html                        ← Design reference (Phase 0)
├── wrangler.toml                      ← Cloudflare config
├── package.json                       ← Node dependencies
├── public\                            ← Static site files
│   ├── css\                           ← Stylesheets
│   ├── js\                            ← Client scripts
│   ├── images\                       ← Logo, product photos
│   ├── _redirects                     ← SEO redirects (Phase 2)
│   └── _headers                       ← Security headers
├── functions\                         ← Pages Functions (local dev)
│   └── api\
│       └── [[path]].ts                 ← API catch-all router
├── workers\                           ← Cloudflare Workers
│   ├── api\                          ← Public API endpoints
│   │   ├── email.ts                  ← Shared Resend email helper
│   │   └── ...
│   └── admin\                        ← Admin dashboard API
├── templates\                        ← Product page master templates
│   ├── product-customizable.html      ← Template for 24 configurable products
│   ├── product-fixed.html             ← Template for 3 non-customizable products
│   └── blog-post.html                 ← Template for blog post pages
├── scripts\                           ← Build & utility scripts
│   ├── build-products.js              ← Node.js script — generates all 27 product pages
│   └── build-blogs.js                 ← Node.js script — generates blog post pages
├── data\                              ← Data files (single source of truth)
│   ├── products.json                  ← Product catalog (names, prices, URLs)
│   ├── product-content.json           ← Tab content, reviews, tags (1667 lines)
│   └── blog-posts.json                ← Blog post content (articles, authors, related products)
├── admin\                            ← Admin dashboard HTML
├── migrations\                       ← Database migrations
│   ├── 001_initial.sql
│   ├── 003_quote_fields.sql
│   └── 004_rate_limits.sql
└── MildMateDataBase\                  ← Knowledge base files
    └── ExistingWeb\
```

---

## Deployment Protocol

**The user controls all deployments manually. Droid NEVER deploys automatically.**

| Rule | Instruction |
|---|---|
| **Never auto-deploy** | Do NOT run `wrangler pages deploy`, `wrangler deploy`, `git push`, or any command that modifies the live site or remote repository without explicit user instruction. |
| **User-triggered only** | Only deploy when the user explicitly says: "Deploy now", "Push to GitHub", "Deploy to Cloudflare", or a similar direct command. |
| **Default phrase** | When work is complete and ready for deployment, say: **"Deploy when you're ready."** Provide the exact manual command the user should run. |
| **GitHub push blocked** | If Droid-Shield blocks `git push` due to false positives (e.g., base64 images in markdown), inform the user and offer 3 options: (1) push manually outside Droid, (2) disable Droid-Shield in settings, (3) replace the flagged content. |
| **No deploy-on-commit** | Local `git commit` is fine. Remote push and Cloudflare deploy are user-controlled only. |

---

## Notes for Future Droid Sessions

- **ALWAYS read `Framework.md` at the start of every session** — it contains the full site blueprint, page layouts, design system, database schema, and build phases. AGENTS.md is summary memory; Framework.md is the complete specification.
- **Centralized Product Template System:** All 27 product pages are generated from two templates (`templates/product-customizable.html` and `templates/product-fixed.html`) via `scripts/build-products.js`. Data sources: `data/products.json` + `data/product-content.json`. To update product page UI: edit the template and rerun `node scripts/build-products.js`. To update product content (tab text, reviews, tags): edit `data/product-content.json` and rebuild. Never edit individual product pages directly — always use the template system.
- **Fabric Specs Grids (replacing dropdowns):** Products with locked/exclusive fabrics show a material specs grid instead of a fabric dropdown. TPU products (encasements, pillow protector): TPU Waterproof Membrane + Water Spills & Accidents. 3-layer protectors: Cotton Quilted + Polyester Filling + TPU Waterproof. BreezePlus-only (pet products): Pet Hair Resistant + 3-5°C Cooler + 50/50 Blend. CloudSoft-only (marine/RV): Quick-Dry + Moisture-Wicking + 100% Cotton.
- **Fabric Color Selector:** Products with fabric choices show per-fabric color swatches in a 6-column CSS grid. Each fabric has its own color set matching `/fabric/` data (BreezePlus: 9, CloudSoft: 12, PremaCotton: 1, EcoLuxe: 1). Label updates and swatches swap when fabric selection changes. White/light colors are visible via border + inset shadow.
- **Centralized Blog Template System:** Blog posts are generated from `templates/blog-post.html` via `scripts/build-blogs.js`. Data source: `data/blog-posts.json`. To add a new blog post: add a JSON entry + run `node scripts/build-blogs.js`. To update blog UI: edit the template and rebuild. The blog post template uses the same 4-col footer as product pages.
- Always check `wrangler.toml` before running `npx wrangler` commands
- Database ID is hardcoded in `wrangler.toml` — do not change without confirming
- R2 bucket name is `mildmate-assets` — consistent everywhere
- Admin pages are in `/admin/` path, protected by Cloudflare Access
- All customer-facing pages go in `public/`
- **Phase 2 (SEO URLs) is intentionally deferred** — it will run pre-launch after Phase 7 is complete. Do not start Phase 2 early.
