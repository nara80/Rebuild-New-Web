# AGENTS.md — MildMate Web Rebuild Project Memory

This file is read by Droid at the start of every session. It contains all critical project context so any Droid instance can continue work without re-asking questions.

---

## Project Overview

- **Business:** MildMate — custom bedding manufacturer in Thailand
- **Current site:** WordPress on `www.mildmate.com` (Flatsome theme)
- **Goal:** Rebuild to Vanilla HTML + Cloudflare Workers with e-commerce features
- **Dev URL:** `mildmate-new.pages.dev` (production: `www.mildmate.com` at 100% completion)
- **Phase 2 deferred:** Will be done at pre-launch (after Phase 8 is complete — redirect-first approach, all URLs through `_redirects`)

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
| Auth | Clerk (Google, Facebook, Email) |
| Deploy | Cloudflare Pages |

---

## Cloudflare Account

- **Account:** `- **D1 Database:** `mildmate-db` (ID: `85ce2f41-463a-43fa-8485-181e983b8fd4`)
- **R2 Bucket:** `mildmate-assets`
- **Pages Project:** `mildmate-new`
- **Wrangler login:** Use `
---

## GitHub

- **Account:** `nara80` (email: `- **Repo:** `Rebuild-New-Web` (private)
- **Repo URL:** `https://github.com/nara80/Rebuild-New-Web`
- **Auth method:** HTTPS with Personal Access Token (credential helper cached 1 year)

---

## Brand Design Tokens

```css
--color-primary: #2c96f4;
--color-primary-dark: #1a7fd4;
--color-text: #1E293B;
--color-heading: #0F172A;
--color-bg: #ffffff;
--color-surface: #F8FAFC;
--color-border: #e2e8f0;
--color-muted: #64748b;
--font-main: 'Quicksand', sans-serif;
--radius: 8px;
--shadow: 0 1px 3px rgba(0,0,0,0.06);
--shadow-md: 0 4px 12px rgba(0,0,0,0.06);
```

**Color usage rules:** #2c96f4 restricted to interactive elements (links, buttons, active states, hover borders). Headings use #0F172A. Section backgrounds use #F8FAFC. Body text #1E293B.

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
| 0 — Mockup | ✅ Approved | Design reference in `mockup.html` — not in project root |
| 1 — Foundation | ✅ Complete | Scaffold, D1 migrations 001–023 (plus 026_product_type_niches applied directly), local server tested, placeholder index.html |
| 2 — SEO URLs | ⏸️ Deferred | **Runs pre-launch after Phase 8 is complete** — redirect-first approach, all URLs through `_redirects` |
| 3 — Design System | ✅ Complete | Header, footer, CSS, nav.js, search overlay, mobile drawer left |
| 4 — Homepage + Products | ✅ Complete | **Everything built and deployed** — all static pages, 27 product pages, 12 category pages, **blog system** (D1-backed, admin CMS at `/admin/blog.html`, public listing at `/blogs/`, SSR post pages at `/blogs/{slug}/` via Pages Function), configurator, Workers API (products, pricing, geo, subscribe, unsubscribe, quote, contact, email, blog posts), cookie consent, Resend email, R2 uploader, admin dashboard (Phase 7 precursor), image compression, full 4-col footer, bilingual EN/TH. Language-driven currency (EN→USD, TH→THB). Shipping rates Option A (THB source, geo-country, OTHER fallback). D1-backed country master list (95 countries). **D1-backed dynamic product reviews** on all 27 product pages (GET `/api/products/:slug/reviews` with 4-tier sort, LIMIT 10). **product_type + niches columns** added to D1 products table (migration 026, applied directly). **Homepage "Choose Your Application"** updated: Deep Pocket + Pet Owner replaced Specialized Protection + Duvet Covers. Full details in Phase4.md completion summary. **Thai localization:** Homepage TH (`/th/`) built with full marketing audit copy; `/th/about/`, `/th/contact/` pages built with Thai marketing audits applied; Thai nav link routing fixed (middleware rewrite order + client-side nav.js safeguard for 12+ bilingual routes). |
| 5 — Checkout + Stripe + Auth | ✅ Built | Stripe Checkout Sessions (redirect flow), PromptPay for TH, webhook saves orders to D1 + Resend emails, 3-step checkout UI, order-confirmed page. **Auth: Clerk multi-provider** (Google / Facebook / Email) hosted-page redirect, JWT verified in Workers via Web Crypto + JWKS. Cart→server sync via PUT/DELETE `/api/customers/cart`. Quote magic link at `/quote/QT-XXXXX/`. Default-address pre-fill on checkout. **Sequential add-to-cart validation:** Country/Region chip highlighted first, then Size, Fabric, Color — each required before proceeding; US/CA auto-selected on load. Cart duplicate fix: case-insensitive + trim on color when checking for existing cart items (`cart.js` add() and `workers/api/customers.ts` loadFromServer). **Account portal `/account/`**: 4-tab (Dashboard/Orders/Favorites/Addresses), 25/75 desktop layout, saved addresses CRUD (D1, migration 009), favorites wishlist (migration 013). **Workers `/api/customers/addresses`**: GET/POST/PUT/DELETE. **Option A order tracking**: carrier code + tracking number entered by admin on shipped, URL auto-generated from templates, inline in `/account` Orders panel. Workers API defensive schema self-heal on all endpoints. Country-specific tariff/tax notes in Payment step (EU/UK/OTHER → note; TH/US/CA/AU → hidden). Order thumbnail dual-match resolution (slug normalization + title fallback). Centralized shipping-quote engine (`workers/api/shipping.ts`) with THB rates and exchange-rate conversion. D1 country master list (`workers/api/countries.ts`, 95 countries + OTHER) consumed by checkout, /account, and super-admin. **Thank-you discount emails:** webhook inserts into `thankyou_queue` (migrations 017–020), `functions/cron.ts` sends 1-year discount code post-purchase. **Pending:** Option 3 production-auth hardening (Clerk production instance); wrangler.toml `[triggers]` cron schedule. |
| 6 — Abandoned Cart | ✅ Built | `abandoned_carts` table (migration 001), webhook marks `recovered=1` on payment (`workers/api/webhook.ts` ✅), cart email capture via `PUT /api/customers/cart` ✅ (Phase 5). **`functions/cron.ts`**: multi-stage recovery (Stage 1: 24h gentle reminder; Stage 2: 72h discount offer for carts ≥$150; Stage 3: 7d last-chance) — configurable via D1 `recovery_config` table (migration 018), D1 `recovery_stages` table (migration 017). `buildThankyouEmail` sends 1-year discount code post-purchase via `thankyou_queue` (migration 020). Cron trigger in Cloudflare Dashboard. **Pending:** wrangler.toml `[triggers]` cron schedule. |
| 7 — Admin Dashboard | ✅ Built | Admin at `/admin/` (moved from `/admin/sandbox/`, 301 redirect in place). Two dashboards: `super-admin.html` + `admin.html` with full products CRUD, orders table (D1 live + Option A shipping tracking: carrier_code + tracking_number + tracking_url), R2 drag-drop upload, CSV export, customers (D1-grouped by email), subscribers, pricing params, DIY prices, exchange rates, **Shipping Rates** (THB-only with USD preview, D1 country master dropdown), **Marketing** (abandoned cart config, thankyou config, recovery stages management, admin accounts). **Blog CMS:** dedicated `/admin/blog.html` with WYSIWYG editor, YouTube URL field, category dropdown (9 options), featured image preview, write/preview toggle. Public `/blogs/` SSR listing reads D1 directly (server-side), `/blogs/{slug}/` SSR individual post from D1 via Pages Function (YouTube embed hero, featured image fallback, gradient fallback). `functions/admin/_middleware.ts` — Clerk admin-role gate for `/admin/*`. `functions/account/_middleware.ts` protects `/account/*`. All workers protected via `authorizeAdmin()`. **Setup complete:** Clerk admin roles assigned (super-admin: nara19080@gmail.com + sriprasit9@gmail.com, admin: mildmateshop@gmail.com ✅), `ADMIN_EMAILS` secret ✅, `QUOTE_FROM_EMAIL` + `QUOTE_REPLY_TO` ✅, admin-stats wiring verified ✅. **Planned (Option B):** Cloudflare Access zero-trust for defense-in-depth. |
| 8 — Launch | ⏸️ Pending | DNS cutover, testing, sitemap; Part A: OG tags ⏸, GTM tags ⏸, sitemap.xml ⏸, mobile QA ⏸, Lighthouse audit ⏸; Part B: Stripe live mode ⏸, DNS cutover ⏸; Step 8.1 handoff prompt already in Phase8.md |
| 9 — Testing (Vitest) | ⏸️ Pending | Unit tests for Worker API: pricing (V-Berth/fitted), cart, geo-currency, subscribers, quote, products, webhook — `@cloudflare/vitest-pool-workers` |

---

## Key Decisions Already Made

| Decision | Value |
|---|---|
| Payment gateway | Stripe (PromptPay for TH, cards for global) |
| Email service | Resend (free tier: 100/day, `RESEND_API_KEY` secret) |
| Auth | Clerk multi-provider (Google, Facebook, Email) |
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
## Phase 5 — Infrastructure Status

| Component | Status | Detail |
|---|---|---|
| Stripe Secret Key | ✅ Set | `STRIPE_SECRET_KEY` stored as Cloudflare Pages secret |
| Stripe Webhook Secret | ✅ Set | `STRIPE_WEBHOOK_SECRET` stored as Cloudflare Pages secret |
| Stripe Webhook | ✅ Live | `mildmate-new.pages.dev/api/webhook/stripe` |

---

### Clerk Auth Architecture

**Public paths (no login required):**
- `/checkout/` — Guest checkout is the default flow; page has optional Google sign-in banner
- `/api/auth/*` — Auth detection API must return JSON (not redirect) for frontend JS to parse; Worker handles gracefully: returns `{authenticated: false}` when no JWT present
- `/api/checkout` — Anyone can create a Stripe checkout session (even guests)
- `/api/webhook/stripe` — Stripe must POST payment confirmations unobstructed

**Protected paths (Google login required):**
- `/account/*` — User dashboard with order history
- `/api/customers/*` — Order history and saved cart data (sensitive)

**How auth flows:**
1. Guest checkout: no login needed; checkout page calls `/api/auth/me` → receives `{authenticated: false}` → shows Clerk sign-in banner (optional)
2. Optional login: user clicks Sign in → Clerk hosted-page redirect → returns to `/checkout/` with `__session` cookie → `/api/auth/me` returns profile → form pre-fills, cart syncs
3. Protected pages: `/account/` and `/api/customers/*` are behind Clerk → Clerk session token sent as `Authorization: Bearer` header → Worker verifies Clerk JWT via Web Crypto + JWKS

**Long-term Option 3 (confirmed for launch hardening):**
- Migrate auth from Clerk Development instance to Clerk Production instance before DNS cutover
- Use custom Clerk domain (same-site with production app) and explicit allowlist for production/staging redirect URLs
- Keep guest checkout default, but centralize bearer-token auth for `/api/auth/me` and `/api/customers/*` on all frontend calls
- Keep explicit sign-out CTA visible on checkout/account flows (do not rely on hidden user menu only)
- Add `functions/account/_middleware.ts` for server-side `/account/*` protection (verify Clerk `__session` cookie, redirect unauthenticated users to sign-in — replaces current client-side-only gate)


| Search | Overlay triggered by magnifying glass icon |

---

## Phase 5 — Guest Checkout + Auth Flow (UAT Test Script)

**Flow:** Guest browses → adds to cart → prompted to sign in at checkout → authenticates via Clerk (Google / Facebook / Email) → cart restored → completes Stripe payment → lands in `/account/` dashboard.

### What Must Be Built (Pre-Requisites)

| # | Component | Files | Status |
|---|---|---|---|
| 1 | Checkout page | `public/checkout/index.html` — 3-step (Cart Review → Shipping → Payment), floating labels, CI colors, 61-country list | ✅ Built |
| 2 | Customer login | Clerk multi-provider (Google / Facebook / Email) hosted-page redirect | ✅ Built |
| 3 | User dashboard | `public/account/index.html` — order history, saved addresses, settings | ✅ Built |
| 4 | Checkout API | `workers/api/checkout.ts` — Stripe Checkout Session (redirect flow), PromptPay for TH | ✅ Built |
| 5 | Stripe webhook | `workers/api/webhook.ts` — checkout.session.completed → D1 + Resend emails | ✅ Built |
| 6 | Cart→server sync | `public/js/cart.js` — push localStorage to D1 on login, clear on logout | ✅ Built |
| 7 | Auth API | `workers/api/auth.ts` — Clerk JWT verification, /api/auth/me | ✅ Built |
| 8 | Customers API | `workers/api/customers.ts` — order history, profile | ✅ Built |

### UAT Checklist

**Phase A — Guest Browse + Add to Cart**
| Step | Expected |
|------|----------|
| A1 | Guest opens any product page, configurator works |
| A2 | Select size/fabric/color → live price, [Add to Cart] enabled |
| A3 | Click [Add to Cart] → cart count badge increments |
| A4 | Click cart icon → `/checkout/` shows item with correct details |
| A5 | Add second product → cart shows 2 items |
| A6 | Remove item via cart UI → count updates |

**Phase B — Login Gate at Checkout**
| Step | Expected |
|------|----------|
| B1 | Guest clicks "Proceed to Checkout" → prompted "Sign in to continue" |
| B2 | "Continue as Guest" alternative → email-only + proceed to Stripe |
| B3 | "Sign in" → Clerk hosted-page redirect |
| B4 | After sign-in → returns to checkout, cart items intact |
| B5 | Login with empty cart → dashboard shows "No orders yet" |

**Phase C — Checkout + Payment**
| Step | Expected |
|------|----------|
| C1 | Checkout shows cart summary (product, size, fabric, color, qty, total) |
| C2 | Enter shipping address → validated |
| C3 | Click "Pay with Card" → Stripe Payment Element loads |
| C4 | Test card `4242 4242 4242 4242` → success → order confirmed page |
| C5 | Order confirmation shows order number, items, total |

**Phase D — User Dashboard**
| Step | Expected |
|------|----------|
| D1 | "My Account" → `/account/` dashboard |
| D2 | "Recent Orders" shows order, status "Confirmed" |
| D3 | Click order → expands detail (items, dimensions, fabric, price) |
| D4 | "Order History" → all past orders, newest first |
| D5 | "Account Settings" → email, name (from Google), saved addresses |
| D6 | Sign out → homepage, cart cleared |

**Phase E — Edge Cases**
| Step | Expected |
|------|----------|
| E1 | Custom-quote product in cart → "Quote Pending", cannot proceed to Stripe |
| E2 | Multiple tabs → cart syncs across tabs (storage event) |
| E3 | Expired checkout session → "Session expired", cart restored |
| E4 | Declined card `4000 0000 0000 0002` → error, cart preserved, retry enabled |

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

## Product Category Structure

### Primary Navigation — Product Type (SEO discoverability)
| Category | URL | Products | Count |
|---|---|---|---|
| Sheets | `/sheets/` | Standard Fitted Sheet, Deep Pocket Fitted Sheet, Marine Fitted Sheet, Dorm Fitted Sheet, RV & Truck Fitted Sheet, Family Fitted Sheet, Pet Owner Fitted Sheet, Flat Sheet — Standard, Flat Sheet — Extra Deep Pocket | 9 |
| Duvet Covers | `/duvet-covers/` | 3-Sided Zipper Duvet Cover, Pet Owner Duvet Cover, Duvet Cover — Marine, Duvet Cover — RV, Duvet Cover — Dorm, Duvet Insert | 6 |
| Pillowcases | `/pillowcases/` | Envelope Pillowcase, Zipper Pillowcase, Sham Pillowcase | 3 |
| Protection | `/protection/` | Mattress Protector — Standard, Mattress Protector — Family, Mattress Protector — Deep Pocket, Pet-Proof Mattress Protector, 6-Sided Mattress Encasement, RV & Truck Mattress Encasement, Pillow Protector | 7 |
| Accessories | `/accessories/` | BedBridge Connector, Bed Lifter (38 cm) | 2 |

### SEO Landing Pages — Niche / Use-Case (high-conversion)
| Niche | URL | Products Covered |
|---|---|---|
| Marine & Yacht | `/marine/` | Marine Fitted Sheet, Duvet Cover — Marine, 6-Sided Mattress Encasement, Envelope/Zipper/Sham Pillowcase, Pillow Protector |
| Family & Co-Sleep | `/family/` | Family Fitted Sheet, 3-Sided Zipper Duvet Cover, Mattress Protector — Family, BedBridge Connector, Envelope/Zipper/Sham Pillowcase, Pillow Protector |
| Deep Pocket | `/deep-pocket/` | Deep Pocket Fitted Sheet, Flat Sheet — Extra Deep Pocket, Mattress Protector — Deep Pocket, Envelope/Zipper/Sham Pillowcase, Pillow Protector |
| Boarding Dorm | `/boarding-dorm/` | Dorm Fitted Sheet, Duvet Cover — Dorm, 6-Sided Mattress Encasement, Envelope/Zipper/Sham Pillowcase, Pillow Protector |
| Pet Owner Bedding | `/pets/` | Pet Owner Fitted Sheet, Pet Owner Duvet Cover, Pet-Proof Mattress Protector, Envelope/Zipper/Sham Pillowcase, Pillow Protector |
| RV & Truck Cab | `/rv-truck/` | RV & Truck Fitted Sheet, Duvet Cover — RV, 6-Sided Mattress Encasement, RV & Truck Mattress Encasement, Envelope/Zipper/Sham Pillowcase, Pillow Protector |

### Complete Product Catalog (27 products)

| # | Product | URL | Product Type | Niche / Use-Case |
|---|---|---|---|---|
| 1 | Standard Fitted Sheet | `/product/standard-fitted-sheet/` | Sheets | — |
| 2 | Deep Pocket Fitted Sheet | `/product/deep-pocket-fitted-sheet/` | Sheets | Deep Pocket |
| 3 | Marine Fitted Sheet | `/product/marine-fitted-sheet/` | Sheets | Marine & Yacht |
| 4 | Dorm Fitted Sheet | `/product/dorm-fitted-sheet/` | Sheets | Boarding Dorm |
| 5 | RV & Truck Fitted Sheet | `/product/rv-truck-fitted-sheet/` | Sheets | RV & Truck Cab |
| 6 | Family Fitted Sheet | `/product/family-fitted-sheet/` | Sheets | Family & Co-Sleep |
| 7 | Pet Owner Fitted Sheet | `/product/pet-owner-fitted-sheet/` | Sheets | Pet Owner |
| 8 | Flat Sheet — Standard | `/product/flat-sheet-standard/` | Sheets | — |
| 9 | Flat Sheet — Extra Deep Pocket | `/product/flat-sheet-extra-deep-pocket/` | Sheets | Deep Pocket |
| 10 | 3-Sided Zipper Duvet Cover | `/product/3-sided-duvet/` | Duvet Covers | Family & Co-Sleep |
| 11 | Pet Owner Duvet Cover | `/product/pet-owner-duvet-cover/` | Duvet Covers | Pet Owner |
| 12 | Duvet Cover — Marine | `/product/duvet-cover-marine/` | Duvet Covers | Marine & Yacht |
| 13 | Duvet Cover — RV | `/product/duvet-cover-rv/` | Duvet Covers | RV & Truck Cab |
| 14 | Duvet Cover — Dorm | `/product/duvet-cover-dorm/` | Duvet Covers | Boarding Dorm |
| 15 | Duvet Insert | `/product/duvet-insert/` | Duvet Covers | — |
| 16 | Envelope Pillowcase | `/product/pillowcase-envelope/` | Pillowcases | Marine, Family, Pets, Deep Pocket, Boarding Dorm, RV & Truck |
| 17 | Zipper Pillowcase | `/product/pillowcase-zipper/` | Pillowcases | Marine, Family, Pets, Deep Pocket, Boarding Dorm, RV & Truck |
| 18 | Sham Pillowcase | `/product/pillowcase-sham/` | Pillowcases | Marine, Family, Pets, Deep Pocket, Boarding Dorm, RV & Truck |
| 19 | Mattress Protector — Standard | `/product/mattress-protector-standard/` | Protection | — |
| 20 | Mattress Protector — Family | `/product/mattress-protector-family/` | Protection | Family & Co-Sleep |
| 21 | Mattress Protector — Deep Pocket | `/product/mattress-protector-deep-pocket/` | Protection | Deep Pocket |
| 22 | Pet-Proof Mattress Protector | `/product/pet-proof-mattress-protector/` | Protection | Pet Owner |
| 23 | 6-Sided Mattress Encasement | `/product/mattress-encasement-general/` | Protection | Marine & Yacht, RV & Truck Cab |
| 24 | RV & Truck Mattress Encasement | `/product/rv-truck-mattress-encasement/` | Protection | RV & Truck Cab |
| 25 | Pillow Protector | `/product/pillow-protector-general/` | Protection | Marine, Family, Pets, Deep Pocket, Boarding Dorm, RV & Truck |
| 26 | BedBridge Connector | `/product/bedbridge-connector/` | Accessories | Family & Co-Sleep |
| 27 | Bed Lifter (38 cm) | `/product/mattress-lift-helper/` | Accessories | — |

---

## Configurator Pricing Status

**24 of 27 products** have live pricing formulas (all requiring a configurator). **3 products** are fixed-price and need no configurator (see section below).

All product detail pages use the shared `public/js/product-configurator.js` which auto-detects the product type from the URL path and applies the correct pricing formula. The full workflow is: [Custom Size] → enter dimensions → live price → [Custom Quote] → popup form (Name/Email) → POST `/api/quote` → Resend email to contact@mildmate.com.

Size dropdowns on all product pages are auto-populated from `public/js/product-sizes.js` (174 entries across 8 regions). To update sizes across all pages, edit `/sizeguide/` then sync `product-sizes.js`.

USD prices displayed as whole dollars (no decimals).

### Products with Live Pricing Formula (24 of 27)

| Product | Formula | Server Function | Markup |
|---|---|---|---|
| Standard Fitted Sheet | Fitted sheet | `calculateFittedSheetPrice()` | 15/20/30% |
| Deep Pocket Fitted Sheet | Fitted sheet | `calculateFittedSheetPrice()` | 15/20/30% |
| Dorm Fitted Sheet | Fitted sheet | `calculateFittedSheetPrice()` | 15/20/30% |
| RV & Truck Fitted Sheet | Fitted sheet | `calculateFittedSheetPrice()` | 15/20/45% |
| Pet Owner Fitted Sheet | Fitted sheet | `calculateFittedSheetPrice()` | 15/20/30% |
| Family Fitted Sheet | Fitted sheet | `calculateFittedSheetPrice()` | 15/20/50% |
| Marine Fitted Sheet | V-Berth formula | `calcVBerthFitted()` | 680% margin |
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

**V-Berth fitted sheet formula:** width=max(HW,FW)+2D+14, length=L+2D+14; fabric/accessories/packing/delivery same as fitted sheet; CloudSoft fabric only; VERTH_MARKUP=8.15 (1+0.15+0.20+6.80). Shape selector shows discounted fixed prices (A-H), custom dimensions use live formula. 4-field layout: HW, FW, Centerline L (tooltip), D. Mobile responsive 4→2→1.

**Flat sheet formula:** W_fabric=W+2D+50, L_fabric=L+2D+50; flat sewing 250 THB (no elastic, no accessories). Fabric cost same as fitted.

**Encasement formula:** Area = 2(W×L + W×D + L×D); TPU fabric (120 THB/linear metre, 210cm bolt) ×1.20 waste; sewing 300 THB flat; zipper 0.4 THB/cm × (2L+W); packing 100; delivery 50; markup 15/25/50%. Round to nearest 100 THB, USD = THB/30.

**Duvet cover formula:** floorArea = 2×(W+5)×(L+5)×1.20 (2 pieces, 5cm seam, 20% waste); zipper 0.4×(2L+W); tiered sewing (≤139,200→300, ≤170,400→400, >170,400→600); packing 100; delivery 50; markup 15/20/30%. No depth input.

**Pillowcase formula:** area = 2×(W+5)×(L+5)×1.60 (60% waste); Sham +15% fabric; sewing 40 THB (50 for Sham); Zipper: 0.4×max(W,L); packing 100; delivery 50; markup 15/25/15%. Max W,L=120cm. No depth input.

**Pillow protector formula:** Same geometry as pillowcase-zipper but TPU fabric (120 THB/lm ÷ 21,000 cm²/lm); markup 15/25/35%. No depth input.

**Mattress protector formula:** Area-based fabric tier (W×L in sq.inch → 550-1,300 THB via tiered lookup) + depth surcharge (<30cm:0, ≥30:200, ≥52:400, >56:600 THB) + packing 200 + delivery 80, × markup (ops 15% + mkt 20% + margin 15-50%). Max W/L=210cm for non-family; over 210 redirects to Family Protector.

### Products NOT Requiring Configurator (3)

| Product | Reason |
|---|---|
| BedBridge Connector | Fixed-price accessory, no custom dimensions |
| Bed Lifter (38 cm) | Fixed-price accessory, no custom dimensions |
| Duvet Insert | Thailand-only, fixed Thai duvet sizes (Microfiber 200g/m²) |

### Marine Fitted Sheet — V-Berth Configurator (Live)

Marine Fitted Sheet uses a **V-Berth-specific configurator** with hybrid pricing:
- **Choose Your Berth Shape** dropdown (8 shapes A-H + custom quote I) with discounted fixed prices
- **4-field custom dimension layout**: Head Width (HW), Foot Width (FW), Centerline Length (L) with tooltip, Mattress Depth (D)
- **V-Berth formula** (`calcVBerthFitted()`): `width = max(HW,FW) + 2D + 14`, `length = L + 2D + 14`, CloudSoft fabric, same sewing tiers as fitted sheet, **680% margin** (VERTH_MARKUP = 8.15)
- "Select Mattress Size" dropdown hidden — replaced by shape selector
- Shape prices discounted 30% from original: A=$94, B=$111, C=$125, D=$125, E=$138, F=$110, G=$108, H=$132
- Responsive: desktop 4-col, tablet 2×2, mobile 1-col stack

All 27 products now have live pricing formulas or don't require configurators.

---

## Database Schema (13 tables, 12 active)

- `products` — product catalog (slug, title_en/th, category, product_type, niches, fabric_options, base_price_usd/thb, image_url, images JSON, youtube_url, tags, is_custom, is_active, sort_order)
- `orders` — customer orders (stripe_session/payment IDs, email, dimensions W/L/D in cm+inch, fabric, color, price, status)
- `custom_quotes` — quote requests (quote_id, name, email, address, telephone, dimensions JSON, fabric, color, status, quoted_price, expires_at)
- `abandoned_carts` — email + cart JSON for recovery (recovered flag, recovery_stage, recovery_sent_at, discount_code)
- `subscribers` — email signup list (dedup: quote form also inserts here, language field)
- `rate_limits` — IP-based rate limiting for anti-spam (quote: 3/hr, subscribe: 5/hr)
- `customer_addresses` — saved shipping addresses per customer (migration 009)
- `discount_claims` — discount code usage tracking (migration 002_discount_claims)
- `favorites` — authenticated user wishlist (user_id, product_id, created_at)
- `recovery_stages` — abandoned cart stage timestamps per cart (migration 017)
- `recovery_config` — email config: Stage 2 discount pct/enabled, Stage 3 discount pct/enabled, basket threshold USD, expiry days (migration 018)
- `thankyou_queue` — post-purchase discount emails pending delivery (id, order_id, email, discount_code, discount_pct, send_after, sent) (migration 020)
- `promo_codes` — admin-created custom promo codes: code, discount_pct, order_minimum_usd, duration_days, max_uses, use_count, per_email_limit, is_active, expires_at (migration 021)
- `promo_redemptions` — per-email usage tracking for promo codes (migration 021)
- `blog_posts` — CMS-backed blog articles with bilingual EN/TH support. Columns: id, slug, title_en/th, meta_description_en/th, body_en/th, featured_image, featured_image_alt_en/th, category, author, read_time_en/th, status, is_featured, th_redirect_path, related_products_json, youtube_url, created_at, updated_at (migration 023)

Active migrations (in order): 001_initial, 002_add_tags, 002_discount_claims, 003_custom_quotes, 003_seed_products, 004_rate_limits, 005_pricing_params, 006_product_editor, 007_seed_products, 008_seed_image_urls, 009_customer_addresses, 010_discount_expiry, 011_orders_discount_code, 012_contacts, 013_favorites, 014_order_shipping_tracking, 015_shipping_rates, 016_countries_master, 017_recovery_stages, 018_recovery_config, 019_discount_pct, 020_thankyou_queue, 021_promo_codes, 022_promo_min_usd, 023_blog_posts, 026_product_type_niches (applied directly via ALTER TABLE)

---

## File Structure

```
D:\00_MildMate\Re-Build_Web\
├── AGENTS.md                          ← This file
├── mockup.html                        ← Design reference only (not in project root)
├── wrangler.toml                      ← Cloudflare config
├── package.json                       ← Node dependencies
├── public/                            ← Cloudflare Pages static files
│   ├── index.html                     ← Homepage EN
│   ├── th/                            ← Thai static pages
│   │   ├── index.html                 ← Homepage TH (✅ Built with full Thai localization)
│   │   ├── about/index.html           ← About Us TH (✅ Built)
│   │   ├── contact/index.html         ← Contact TH (✅ Built)
│   │   ├── fabric/index.html          ← Fabric TH (✅ Built — SSR via middleware rewrite)
│   │   ├── sizeguide/index.html       ← Size Guide TH (✅ Built)
│   │   ├── policy/index.html          ← Privacy Policy TH (✅ Built)
│   │   ├── shipping/index.html        ← Shipping TH (✅ Built)
│   │   ├── reviews/index.html         ← Reviews TH (✅ Built)
│   │   ├── faq/index.html             ← FAQ TH (✅ Built)
│   │   ├── custom-measurement/index.html  ← Custom Measurement TH (✅ Built)
│   │   ├── how-to-measure-mattress-size/index.html  ← How to Measure TH (✅ Built)
│   ├── admin/
│   │   ├── index.html                 ← Admin hub (role cards)
│   │   ├── super-admin.html           ← Full admin (products CRUD, orders, R2 upload, pricing)
│   │   ├── admin.html                 ← Admin (orders, products, subscribers, customers)
│   │   └── blog.html                  ← Blog CMS (WYSIWYG editor, add/edit/delete posts)
│   ├── css/main.css                   ← All public styles (bilingual)
│   ├── js/
│   │   ├── nav.js                    ← Header/nav/mobile drawer + auth-aware account btn
│   │   ├── cart.js                   ← localStorage cart
│   │   ├── geo.js                    ← Currency toggle
│   │   ├── product-configurator.js   ← All 27 product configurators (auto-detects type)
│   │   ├── product-sizes.js          ← Centralized size data (174 entries, 8 regions)
│   │   ├── reviews-carousel.js       ← Review + related-products carousels (homepage + product pages)
│   │   ├── clerk.js                  ← Clerk auth (sign-in/out, JWT decode)
│   │   └── cookie-consent.js         ← GDPR banner + GA4 conditional load
│   ├── images/                        ← Products, categories, fabrics, hero, router
│   ├── _redirects                    ← 301 redirects (WordPress era + Phase 2 SEO URLs)
│   ├── _headers                      ← Security headers (CSP, HSTS)
│   ├── product/                      ← 27 EN product detail pages (static HTML)
│   ├── th/product/                    ← 27 TH product detail pages (≨️ Pending — not yet generated from templates)
│   ├── sheets/duvet-covers/pillowcases/protection/accessories/  ← EN+TH category listings
│   ├── marine/family/deep-pocket/boarding-dorm/pets/rv-truck/  ← EN+TH SEO landing pages
│   ├── blogs/                         ← Blog index + pagination + posts
│   ├── th/blogs/                      ← TH blog posts
│   ├── quote/                         ← Magic link: /quote/QT-XXXXX/ (functions/quote/[[path]].ts)
│   └── products/index.html            ← Full catalog listing
├── functions/                          ← Pages Functions (local dev bridge → Workers)
│   ├── account/
│   │   └── _middleware.ts            ← Clerk auth gate for /account/*
│   ├── admin/
│   │   └── _middleware.ts            ← Clerk admin-role gate for /admin/*
│   ├── api/
│   │   └── [[path]].ts               ← Pages Function: routes /api/* → Workers handlers
│   ├── account/
│   │   └── _middleware.ts            ← Clerk auth gate for /account/*
│   ├── admin/
│   │   └── _middleware.ts            ← Clerk admin-role gate for /admin/*
│   ├── blogs/
│   │   └── [[path]].ts               ← Blog: /blogs/ SSR listing + /blogs/{slug}/ SSR post (D1)
│   ├── quote/
│   │   └── [[path]].ts               ← Magic quote link: /quote/QT-XXXXX/
│   ├── r2/
│   │   └── [[path]].ts               ← R2 file serving (CDN URLs)
│   └── cron.ts                        ← Abandoned cart + thankyou_queue cron job
├── workers/api/
│   ├── index.ts                       ← Main Worker entry (routes all /api/*)
│   ├── products.ts                   ← Public products catalog API
│   ├── pricing.ts                   ← All pricing formulas (fitted/V-Berth/flat/encasement/duvet/pillowcase/mattress-protector)
│   ├── pricing-params.ts             ← Public read for admin-set pricing params
│   ├── geo-currency.ts               ← Country → THB/USD
│   ├── subscribe.ts                  ← Email → D1 subscribers
│   ├── unsubscribe.ts               ← Email removal from D1
│   ├── quote.ts                     ← Custom quote → D1 + Resend email
│   ├── contact.ts                   ← Contact form → D1 + Resend email
│   ├── email.ts                     ← Shared Resend helper
│   ├── checkout.ts                  ← Stripe Checkout Sessions + PromptPay
│   ├── webhook.ts                   ← checkout.session.completed → D1 + Resend
│   ├── auth.ts                      ← Clerk JWT decode, /api/auth/me
│   ├── customers.ts                 ← Order history (dual-match thumbnail) + saved-cart sync + addresses CRUD
│   ├── shipping.ts                  ← Centralized shipping-quote engine (THB rates, geo-country, OTHER fallback)
│   ├── countries.ts                 ← Centralized country master list (D1 countries_master, 95 countries + OTHER)
│   ├── order-confirmed.ts           ← Lookup order by stripe_session_id
│   ├── clerk-verify.ts              ← Clerk JWT verification
│   ├── favorites.ts                 ← Authenticated wishlist (user+email matching, duplicate guard, schema auto-heal)
│   ├── blog-posts.ts               ← Public blog: list published posts (all fields + youtube_url)
│   ├── admin-blog.ts               ← Admin blog CRUD (GET/POST/PUT/DELETE, youtube_url)
│   ├── admin-promo.ts               ← Admin: promo codes CRUD (promo_codes, promo_redemptions)
│   ├── admin-recovery-test.ts        ← Admin: test abandoned cart recovery email sequences
│   ├── admin-products.ts            ← Admin: GET/PUT products (X-Admin-Secret)
│   ├── admin-upload.ts              ← Admin: R2 image upload → CDN URL
│   ├── admin-pricing.ts             ← Admin: GET/PUT pricing params
│   ├── admin-shipping.ts            ← Admin: shipping rates CRUD (THB-only, OTHER protected)
│   ├── admin-stats.ts                ← Admin: dashboard statistics
│   ├── admin-orders.ts              ← Admin: GET/PUT orders (status + Option A shipping tracking)
│   ├── admin-customers.ts           ← Admin: customers grouped by email from D1
│   ├── admin-diy.ts                  ← Admin: GET/PUT DIY prices
│   ├── admin-exchange.ts             ← Admin: GET/PUT exchange rates
│   ├── admin-quotes.ts              ← Admin: custom quotes management (status, price, expiry)
│   └── admin-contacts.ts             ← Admin: contacts management
├── templates/
│   ├── product-customizable.html   ← Template for 24 configurable products
│   ├── product-fixed.html           ← Template for 3 non-configurable (BedBridge/BedLifter/DuvetInsert)
│   └── blog-post.html               ← Template for blog posts (has global header + footer)
├── scripts/
│   ├── build-products.js            ← Generates all 27 product pages from templates
│   └── build-blogs.js               ← Generates blog posts from templates
├── data/
│   ├── products.json                ← Source of truth for product catalog
│   ├── product-content.json         ← Tab content, reviews, tags per product
│   └── blog-posts.json              ← Blog post content
├── migrations/                       ← 24 migration files: 001–023 + 026 (applied directly)
│   ├── 001_initial.sql             ← products/orders/abandoned_carts/subscribers/rate_limits
│   ├── 002_add_tags.sql             ← tags column on products
│   ├── 002_discount_claims.sql       ← discount_claims table
│   ├── 003_custom_quotes.sql         ← custom_quotes table
│   ├── 003_quote_fields.sql          ← additional fields on custom_quotes
│   ├── 003_seed_products.sql        ← 15 products seeded
│   ├── 004_rate_limits.sql          ← rate_limits table
│   ├── 005_pricing_params.sql        ← standard_prices + pricing_params tables
│   ├── 006_product_editor.sql        ← youtube_url + images columns on products
│   ├── 007_seed_products.sql        ← 27 products (full seed)
│   ├── 008_seed_image_urls.sql        ← image_url seeded for all 27 products
│   ├── 009_customer_addresses.sql    ← customer_addresses table
│   ├── 010_discount_expiry.sql        ← expires_at + source on discount_claims
│   ├── 011_orders_discount_code.sql  ← discount_code on orders
│   ├── 012_contacts.sql              ← contacts table (unified)
│   ├── 013_favorites.sql             ← favorites table (authenticated wishlist)
│   ├── 014_order_shipping_tracking.sql  ← carrier_code + tracking_number + tracking_url + shipping_status + shipped_at on orders
│   ├── 015_shipping_rates.sql       ← shipping_rates table (country_code, first_item_thb, additional_item_thb) + seed TH/US/OTHER
│   ├── 016_countries_master.sql    ← countries_master table (95 countries + OTHER, phone codes)
│   ├── 017_recovery_stages.sql    ← recovery_stages table (per-cart stage timestamps)
│   ├── 018_recovery_config.sql     ← recovery_config table (Stage 2/3 discount, basket threshold)
│   ├── 019_discount_pct.sql        ← discount_pct column on thankyou_queue
│   ├── 020_thankyou_queue.sql      ← thankyou_queue table (post-purchase discount emails)
│   ├── 021_promo_codes.sql         ← promo_codes + promo_redemptions tables (admin-created custom promo)
│   ├── 022_promo_min_usd.sql        ← order_minimum_thb → order_minimum_usd on promo_codes
│   ├── 023_blog_posts.sql         ← blog_posts table (bilingual EN/TH CMS)
│   └── 026_product_type_niches.sql ← product_type + niches columns on products (applied directly via ALTER TABLE, not migration tracker)
└── MildMateDataBase/ExistingWeb/    ← WordPress URL source data
```

 |
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
- Admin pages are in `/admin/` path, protected by `functions/admin/_middleware.ts` (Clerk JWT + admin role/email check; dev bypass on pages.dev/localhost). `/admin/sandbox/` URLs 301-redirect to `/admin/`.
- All customer-facing pages go in `public/`
- **Phase 2 (SEO URLs) is intentionally deferred** — it will run pre-launch after Phase 8 is complete. Do not start Phase 2 early.
- **Global auth scripts:** Every page with the header (`.site-header`) must load both `<script src="/js/nav.js"></script>` and `<script src="/js/clerk.js"></script>`. nav.js injects the auth-aware account button (Sign In text vs person icon). The three templates (`templates/blog-post.html`, `templates/product-customizable.html`, `templates/product-fixed.html`) are the canonical sources — always add clerk.js to templates, not individual generated pages.
- **D1-backed Product Reviews:** GET `/api/products/:slug/reviews` returns up to 10 reviews sorted by: Tier 0 (niche match w/photo), Tier 1 (product match w/photo), Tier 2 (marketplace), Tier 3 (other) — newest first within each tier. Both product templates (`templates/product-customizable.html`, `templates/product-fixed.html`) include a dynamic reviews carousel container (`#product-reviews-track` + arrows + dots). `public/js/reviews-carousel.js` contains `loadProductPageReviews(slug)` which auto-detects `/product/{slug}/` from URL, fetches reviews, renders cards with conditional photo (1:1 square) and "Show more" toggle (only shown if text > 280 chars), updates summary text ("1,000+ verified buyers"), and initializes carousel. Rebuild all 27 product pages via `node scripts/build-products.js` after template changes.
- **product_type + niches columns:** Added to the `products` D1 table. `product_type` is a single value (sheets, duvet-covers, pillowcases, protection, accessories). `niches` is a comma-separated list of niche slugs (marine, family, pets, deep-pocket, boarding-dorm, rv-truck). Auto-populated from existing `category` CSV column (first value = product_type, rest = niches). The API lists products at `/api/products` now supports `?product_type=` and `?niche=` query params alongside the legacy `?category=` filter.
- **Homepage "Choose Your Application":** Updated to 4 niche cards: Marine & Yacht, Family & Co-Sleep, Deep Pocket (images/Categories/category-deep-pocket.webp), Pet Owner (images/Categories/category-pets.webp). Replaced old Specialized Protection and Duvet Covers cards.
