# Phase 4 — Verification Checklist

Use this checklist to review every page and section built in Phase 4.
Check off items one-by-one as you verify them in your browser at `http://127.0.0.1:8788/`.

---

## Before You Start

- [ ] Run local server: `npx wrangler pages dev public --port 8788`
- [ ] Open `http://127.0.0.1:8788/` in browser
- [ ] Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- [ ] Open browser DevTools (F12) → Console — confirm no red errors on load

---

## Homepage EN (`/`) — Section by Section

### 1. Hero Section ✅ Verified
- [x] Headline reads: "Bedding Made Easy Again: Custom Sizes, Perfect Fits."
- [x] Sub-headline visible underneath
- [x] Two CTA buttons visible: "Shop Custom Bedding" + "Measure My Mattress"
- [x] Hero background is CI blue gradient (placeholder — **replace with your photo**)
- [x] Buttons are clickable and link to correct pages
- [x] **Mobile:** Text readable, buttons stack vertically
- [x] **Mobile:** No horizontal scroll

> **Action needed:** Provide hero lifestyle photo (1200px+ wide) → rename to `hero-bg.jpg` → place at `public/images/hero-bg.jpg`

---

### 2. Trust Bar ✅ Verified
- [x] 4 trust items in a row on desktop
- [x] Icons visible (compass, plane, award, leaf)
- [x] Labels read: Precision Fit Guarantee, Global Express Delivery, Top-Rated Etsy Boutique, Sensitive Skin Friendly
- [x] **Mobile:** stacks 2×2 grid
- [x] **Tablet:** 4 items in a row or 2×2

---

### 3. Shop by Product (Primary Navigation) ✅ Done
- [x] 5 cards visible: Fitted Sheets, Flat Sheets, Duvet Covers, Pillowcases, Protectors
- [x] Each card has warm brand-colored placeholder (Ivory, Beige, Baby Pink, Sand, Vanilla)
- [x] Section has warm cream background (`#fdfbf7`)
- [x] Each card is clickable and links to correct product-type category page
- [x] Card hover effect works (lift + shadow)
- [x] **Mobile:** 2 columns then 1 column at narrow width

> **Action needed:** Provide 5 product-type category photos → place in `public/images/categories/`
> **NEW:** 5 primary product-type categories (`/fitted-sheets/`, `/flat-sheets/`, `/duvet-covers/`, `/pillowcases/`, `/mattress-protectors/`) added for SEO discoverability

---

### 4. Shop by Niche (Category Cards) ✅ Done
- [x] 6 cards visible: Marine & Yacht, Family & Co-Sleep, Pet Owner, Easy-Change Duvet, Protection, RV & Truck Cab
- [x] Each card shows real photo or placeholder
- [x] Each card is clickable and links to correct niche/SEO landing page
- [x] Card hover effect works (lift + shadow)
- [x] **Mobile:** 2 columns then 1 column at narrow width

> **Action needed:** Provide 7 niche category photos → place in `public/images/categories/`
> **NEW:** 6 SEO landing pages (`/marine/`, `/family/`, `/pets/`, `/duvet/`, `/protection/`, `/rv-truck/`)
> **NEW:** Pet Owner landing page (`/pets/`) added for BreezePlus anti-fur market
> - `category-marine.jpg` (V-Berth on boat) ✅
> - `category-family.jpg` (family bed) ✅
> - `category-duvet.jpg` (3-sided zipper duvet) ✅
> - `category-protection.jpg` (waterproof protector) ✅

---

### 4. Fabric Showcase ✅ Verified
- [x] 4 tabs: BreezePlus, CloudSoft, PremaCotton, EcoLuxe
- [x] Clicking each tab switches content panel
- [x] Each panel shows: fabric name, tagline, description, feature list, colors
- [x] Color swatches visible as circles
- [x] "Shop [Fabric]" button in each panel
- [x] **Mobile:** tabs horizontally scrollable, panel stacks vertically

---

### 5. Most Popular ✅ Verified
- [x] 5 product cards visible in horizontal scroll row
- [x] Headline reads: "Most Popular" (reframed from "Top Products")
- [x] Subtitle: "These are the styles our customers love most..."
- [x] Each card has: real product image + title + price + "Customize" button
- [x] Prices show in USD (or THB if you're browsing from Thailand)
- [x] "Customize" buttons link to correct product detail paths
- [x] Horizontal scroll works on mobile (swipe left/right)
- [x] **Mobile:** cards are swipeable, not squished

> **Action needed:** Download product photos from Etsy → rename to match slugs → place in `public/images/products/`
> Priority 5: 3-Sided Zipper Duvet, Family Sheet, Marine V-Berth, 6-Sided Encasement, BedBridge

---

### 6. Social Proof (Reviews) ✅ Verified
- [x] 2 review cards visible
- [x] 5-star rating shown on each card
- [x] Review text and author name visible
- [x] Etsy badge at bottom: "5.0 out of 5 stars on Etsy"
- [x] **Mobile:** cards stack vertically

> ~~Action needed: Replace 4 placeholder reviews with real Etsy reviews on `/reviews/` page~~ ✅ Done — 8 real Etsy reviews injected via `scripts/build-reviews.js`

---

### 7. Email Signup ✅ Verified
- [x] "Get 15% Off Your First Order" headline visible
- [x] Email input + Subscribe button with AJAX (no page reload)
- [x] Section has blue gradient background
- [x] Inline success/error message feedback
- [x] **Mobile:** input and button stack vertically

---

## Homepage TH (`/th/`) ✅ Verified
- [x] Page loads at `http://127.0.0.1:8788/th/`
- [x] All 7 sections visible with Thai text
- [x] Fabric tabs in Thai
- [x] All links work correctly (same URLs as EN version)
- [x] **Mobile:** same responsive behavior as EN homepage
- [x] Email signup AJAX works with Thai UI text (loading: "กำลังสมัคร…")

---

## Static Pages ✅ Verified

### About Us (`/about/`) ✅ Rebuilt — Engineering Authority Framework
- [x] Page loads at `/about/`
- [x] **Section 1 — Technical Hero:** H1 "Precision Bedding. Engineered for Every Shape of Sleep." + Blueprint Grid overlay + Tech Specs overlay (Tolerance ±1–2cm, OEKO-TEX®)
- [x] **Section 2 — Engineering Genesis:** "Solving the Mattress Gap Paradox" with bold pull quotes (geometric failure, unified family sleep surface) + genesis image
- [x] **Section 3 — Authority Timeline:** 4 milestones (2019 Founding, 2022 OEKO-TEX, 2024 Etsy+eBay Global, 2026 Engineering Lab) + EngineeringLab.jpg
- [x] **Section 4 — Material Standards:** 4 fabric cards (PremaCotton/BreezePlus/CloudSoft/EcoLuxe) with spec tags, swatch images, "Explore the Fabric Collections" CTA
- [x] **Section 5 — Video:** "The MildMate Standard" heading + YouTube Short embed
- [x] **Section 6 — Global Reach:** 3-column city grid (11+ cities across 3 regions)
- [x] All 8 real images loaded (hero, genesis, 4 swatches, EngineeringLab)
- [x] Header and footer present
- [x] **Hero updated (2026-05-14):** Blue-gradient CI Blue centered hero (`linear-gradient(135deg, #2c96f4 0%, #1a7fd4 100%)` + blueprint grid overlay) — matching `/contact/` style

### Contact (`/contact/`) ✅
- [x] Page loads at `/contact/`
- [x] Contact form: Name, Email, Subject, Message
- [x] LINE Official card with icon
- [x] WhatsApp card with icon
- [x] Facebook card with icon
- [x] Email + Phone cards
- [x] Marketplace buttons row: Etsy, eBay, Shopee, Lazada, TikTok Shop
- [x] Header and footer present
- [x] **Hero (2026-05-14):** Blue-gradient CI Blue centered hero — reference page for header consistency standard

### Fabric Collections (`/fabric/`) ✅
- [x] Page loads at `/fabric/`
- [x] 4 fabric tabs work (same as homepage but full page)
- [x] Each panel has "Shop [Fabric]" button
- [x] Comparison table at bottom with all 4 fabrics
- [x] Header and footer present
- [x] **Hero updated (2026-05-14):** Blue-gradient CI Blue centered hero — matching `/contact/` style

### Returns & Delivery (`/shipping/`) ✅
- [x] Page loads at `/shipping/` (URL kept for SEO continuity)
- [x] Title: "Returns & Delivery"
- [x] Returns section at top: 30-day returns, buyer pays return shipping, original condition required
- [x] Processing time: 3-5 business days
- [x] Shipping regions table visible
- [x] Carriers listed: Thailand Post, DHL, FedEx
- [x] Free shipping note for Thailand over ฿2,500
- [x] Customs & import tariff disclaimer
- [x] Header and footer present

### Privacy Policy (`/policy/`) ✅
- [x] Page loads at `/policy/`
- [x] 14 sections: Introduction, Data Collection, Usage, Marketing & Communications, Third Parties, Cookies & Tracking, Data Retention, Your Rights, California CCPA, Security, Children's Privacy, Data Breach Notification, Account Deletion, International Transfers, Changes, Contact
- [x] Cookie inventory table: Essential / Analytics (GA4) / Advertising (disabled until Pixel added)
- [x] Unsubscribe mechanism linked: `/unsubscribe/` page + API endpoint
- [x] Third-party services listed: Stripe, MailChannels, shipping carriers, Cloudflare, Google Analytics 4, Meta (placeholder)
- [x] Data retention: 7 years for orders, 14 months for analytics, 30 days for abandoned carts
- [x] CCPA section for California buyers
- [x] 72-hour data breach notification commitment
- [x] Header and footer present

### Reviews (`/reviews/`) ✅
- [x] Page loads at `/reviews/`
- [x] 6 review cards visible
- [x] Etsy badge at bottom
- [x] "Write a Review on Etsy" button
- [x] Header and footer present
- [x] **Hero updated (2026-05-14):** Blue-gradient CI Blue centered hero — matching `/contact/` style

> ~~Action needed: Replace placeholder reviews with real ones from Etsy~~ ✅ Done — 8 real Etsy reviews mapped with buyer names/countries via `scripts/build-reviews.js`

---

## URL Structure & Redirects (2026-05-14, updated 2026-05-15)

### `_redirects` — WordPress old URL → new bilingual pages

All old WordPress URLs (blog posts, pages, sub-paths) are handled by wildcard `/*` rules:

| Old URL | New URL | Type | Status |
|---|---|---|---|
| `/bed-sheets-size/*` | `/sizeguide/` | 301 | ✅ Active — catches all sub-paths |
| `/mattress-size/*` | `/sizeguide/` | 301 | ✅ Active — catches all sub-paths |
| `/mattress-size-th/*` | `/sizeguide/th/` | 301 | ✅ Active — catches all sub-paths |
| `/pillow-protectors/*` | `/mattress-protectors/` | 301 | ✅ Active — catches all sub-paths |

**No separate TH pages needed** — the wildcard `/*` handles ALL old WordPress content automatically.

### Language Toggle — `/th/` Versions Required

| Page | EN | TH | Status |
|---|---|---|---|
| Homepage | `/` | `/th/` | ✅ Existing |
| Size Guide Hub | `/sizeguide/` | `/sizeguide/th/` | ✅ Existing |
| How to Measure | `/how-to-measure-mattress-size/` | `/th/how-to-measure-mattress-size/` | ✅ Existing |
| Contact | `/contact/` | `/th/contact/` | ✅ Existing |
| About Us | `/about/` | `/th/about/` | ✅ Built (2026-05-14) |
| Fabric Collections | `/fabric/` | `/th/fabric/` | ✅ Built (2026-05-14) |
| Reviews | `/reviews/` | `/th/reviews/` | ✅ Built (2026-05-14) |

**Language toggle rule:** Header TH button → `/th/` prefix. Header EN button → remove `/th/` prefix.

---

## Product & Category Pages

### Product Listing (`/products/`)
- [ ] Page loads at `/products/`
- [ ] Filter bar visible: Category dropdown + Fabric dropdown
- [ ] 6 product cards in grid
- [ ] Each card has placeholder, title, price, "Customize" button
- [ ] Header and footer present

### Primary Product-Type Categories

#### Fitted Sheets (`/fitted-sheets/`)
- [ ] Page loads at `/fitted-sheets/`
- [ ] "Custom Fitted Sheets" heading visible
- [ ] Marine, Family, Pet Owner, Adjustable products shown

#### Flat Sheets (`/flat-sheets/`)
- [ ] Page loads at `/flat-sheets/`
- [ ] "Custom Flat Sheets" heading visible
- [ ] Standard and Extra Deep Pocket products shown

#### Duvet Covers (`/duvet-covers/`)
- [ ] Page loads at `/duvet-covers/`
- [ ] "Custom Duvet Covers" heading visible
- [ ] 3-Sided Zipper and Pet Owner products shown

#### Pillowcases (`/pillowcases/`)
- [ ] Page loads at `/pillowcases/`
- [ ] "Custom Pillowcases" heading visible
- [ ] Envelope, Zipper, Sham products shown

#### Mattress Protectors (`/mattress-protectors/`)
- [ ] Page loads at `/mattress-protectors/`
- [ ] "Mattress & Pillow Protectors" heading visible

### SEO Landing Pages (Use Case)

#### Marine Category (`/marine/`)
- [ ] Page loads at `/marine/`
- [ ] "Marine & Yacht" heading visible
- [ ] Cross-links to `/fitted-sheets/` for Marine Fitted Sheet

#### Family Category (`/family/`)
- [ ] Page loads at `/family/`
- [ ] "Family & Co-Sleep" heading visible
- [ ] Cross-links to `/fitted-sheets/` for Family Fitted Sheet

#### Pet Owner (`/pets/`)
- [ ] Page loads at `/pets/`
- [ ] "Pet Owner Bedding" heading visible
- [ ] BreezePlus anti-fur explanation
- [ ] Cross-links to `/fitted-sheets/` and `/duvet-covers/`

#### Duvet Category (`/duvet/`)
- [ ] Page loads at `/duvet/`
- [ ] "Easy-Change Duvet" heading visible
- [ ] Cross-links to `/duvet-covers/`

#### Protection Category (`/protection/`)
- [ ] Page loads at `/protection/`
- [ ] "Protection" heading visible
- [ ] Cross-links to `/mattress-protectors/`

#### RV & Truck Cab (`/rv-truck/`)
- [ ] Page loads at `/rv-truck/`
- [ ] "RV & Truck Cab Bedding" heading visible
- [ ] Problem section: tight spaces, built-in platforms, odd mattress shapes
- [ ] 6-Sided Encasement card visible
- [ ] Marine Fitted Sheet card visible
- [ ] CTA block: "Have an odd-shaped mattress? We measure, you sleep."

---

## Size Guide SEO Hub

### Size Guide Landing (`/sizeguide/`)
- [ ] Page loads at `/sizeguide/`
- [ ] 4 cards visible linking to specific guides
- [ ] Header and footer present

### Thai Size Guide (`/mattress-size-th/`)
- [ ] Page loads at `/mattress-size-th/`
- [ ] Thai heading: "ตารางขนาดที่นอน"
- [ ] Thai size table: 3.5ฟุต through 7ฟุต
- [ ] International sizes included
- [ ] CTA button in Thai linking to configurator

### International Size Guide (`/mattress-size/`)
- [ ] Page loads at `/mattress-size/`
- [ ] EN heading: "Mattress Size Guide"
- [ ] Size comparison table with TH/US/UK/EU/AU/JP
- [ ] CTA to measurement guide

### How to Measure (`/how-to-measure-mattress-size/`)
- [ ] Page loads at `/how-to-measure-mattress-size/`
- [ ] Credit card method steps visible
- [ ] SVG diagram showing card placement
- [ ] Note: "Every standard credit card is exactly 85.60 mm (3.375 in) long"
- [x] **Footer restored (2026-05-14):** Full 4-col global footer (was stripped to copyright bar)

### Bed Sheet Sizes (`/bed-sheets-size/`)
- [ ] Page loads at `/bed-sheets-size/`
- [ ] Pocket depth table: Standard / Deep / Extra-Deep
- [ ] Duvet cover size table
- [ ] CTA to configurator

### Size Guide Post-Build Revision (2026-05-14) ✅
All 8 regional size guide pages updated with JS-based interactive tables:
- [x] **US/Canada:** Family/Co-Sleep expanded (2xTwinXL through 2xKing — 6 sizes); Duvet corrected (68in widths, Twin XL added, Full/Queen/King/CalKing corrected); Pillow added Dakimakura (43x120cm) + Half (43x60cm)
- [x] **UK:** Family/Co-Sleep expanded (2xSmallDouble through 2xSuperKing — 4 sizes); EU-style brackets removed from standard mattress names; Pillow added Dakimakura + Half
- [x] **EU:** Standard mattress names cleaned (no brackets); Family/Co-Sleep expanded (6 combos: 2xDouble through 2xKing); Duvet corrected (Single 140x200, King 240x220, Super King 260x220); Pillow added Dakimakura + Half
- [x] **Australia:** Family/Co-Sleep expanded (7 combos including 2xDouble); Pillow added Dakimakura + Half
- [x] **Thailand:** 3FT added to Standard Mattress (90x198cm); Family/Co-Sleep expanded (8 sizes: 7FT–12FT with combined widths); Duvet column headers renamed (Bed Size / Duvet Cover Size); Duvet sizes corrected; No Dakimakura (per user request); Unified Directory kickers removed
- [x] **Malaysia/SG:** Standard added Single (91x190cm) alongside Super Single; Family/Co-Sleep expanded (6 combos); Duvet corrected (Single 150x210, Super King 260x230); Pillow added Dakimakura + Half
- [x] **India:** Standard Queen/King corrected to 60x75/72x75in; Family/Co-Sleep expanded (4 combos); Duvet corrected (150x200, 200x200, 240x220); Pillow added Dakimakura + Half
- [x] **Japan:** Family/Co-Sleep expanded (7 combos: 2xSemiDouble through 2xKing); Pillow added Dakimakura + Half

---

## Header & Navigation (All Pages)

- [ ] Logo visible top-left on desktop
- [ ] Navigation links: Home, Shop, Fabrics, Size Guide
- [ ] Search icon (magnifying glass) opens overlay
- [ ] Search overlay: input + close button + Escape key closes
- [ ] Account icon links to `/account/`
- [ ] Cart icon shows count badge
- [ ] EN/TH language toggle visible
- [ ] **Scroll down:** header shrinks smoothly

### Mobile Header
- [ ] Hamburger icon visible top-left
- [ ] Logo centered
- [ ] Action icons (search, account, cart, lang) visible top-right
- [ ] Tap hamburger → drawer slides in from **left**
- [ ] Tap overlay or swipe → drawer closes
- [ ] Drawer links: Home, Shop, Fabrics, Size Guide

---

## Footer (All Pages) ✅ Verified
- [x] 4 columns: Quick Links, Customer Service, Shop With Us, Contact
- [x] Marketplace icons (Etsy, eBay, Shopee, Lazada) in circles
- [x] Social row centered: Facebook, Instagram, TikTok, Pinterest, YouTube
- [x] Contact: email + phone + WhatsApp + LINE icons
- [x] Bottom bar: copyright + Privacy Policy + Returns & Delivery links
- [x] **Mobile:** columns stack vertically, icons left-aligned
- [x] `/how-to-measure-mattress-size/` — full 4-col global footer restored (2026-05-14, was copyright bar only)
- [x] `/custom-measurement/` — full 4-col global footer restored (2026-05-14, was copyright bar only)

---

## New Features Added (Post-Initial Build)

### Cookie Consent Banner ✅
- [x] GDPR-compliant banner slides up from bottom on first visit
- [x] Three buttons: Settings, Reject All, Accept All Cookies
- [x] Settings modal with toggle switches: Essential (locked), Analytics (GA4)
- [x] Advertising category disabled until Facebook Pixel is added
- [x] Conditionally loads Google Analytics 4 script (ID: G-0GWVSPJLVJ) only after consent
- [x] localStorage persistence: `mildmate-cookie-consent` key
- [x] Batch-injected into all 19 HTML pages via script tag

### Unsubscribe Page (`/unsubscribe/`) ✅
- [x] Standalone page with email form
- [x] Pre-fills email from URL query parameter (`?email=`)
- [x] AJAX submission to `/api/unsubscribe`
- [x] Deletes email from D1 `subscribers` table
- [x] Privacy-safe: always returns success, never reveals subscriber status
- [x] Linked from privacy policy Section 3A and subscribe API success messages

---

---

## Cart & Configurator JS

- [ ] Add item from configurator → cart count increases in header
- [ ] Refresh page → cart count still shows (localStorage)
- [ ] Open cart page `/checkout/` (Phase 5) — items should be listed
- [ ] Console shows no errors from `configurator.js`, `cart.js`, or `geo.js`

---

## Backend Workers (API)

- [ ] `http://127.0.0.1:8788/api/health` returns `{"status":"ok"}`
- [ ] `/api/products` returns JSON product list (from D1 — may be empty until seeded)
- [ ] `/api/pricing?mode=sheet&fabric=breezeplus&unit=cm&width=160&length=200&depth=30` returns a price
- [ ] `/api/geo` returns `{"currency":"THB"}` if you're in Thailand, `"USD"` otherwise

---

## Image Checklist (Updated 2026-05-14)

### Real Photos (from Etsy / existing assets)
| Image | Path | Status |
|---|---|---|
| Hero background | `public/images/Hero01.jpg` | ✅ |
| Marine category | `public/images/categories/category-marine.jpg` | ✅ Real photo |
| Family category | `public/images/categories/category-family.jpg` | ✅ Real photo |
| Duvet category | `public/images/categories/category-duvet.jpg` | ✅ Real photo |
| Protection category | `public/images/categories/category-protection.jpg` | ✅ Real photo |
| 3-Sided Zipper Duvet | `public/images/products/3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets.jpg` | ✅ Real photo |
| Custom Family Sheet | `public/images/products/family-co-sleeping-solutions-th-size.jpg` | ✅ Real photo |
| Marine V-Berth | `public/images/products/product-boat-bedding-fitted-sheet-microfiber.jpg` | ✅ Real photo |
| 6-Sided Encasement | `public/images/products/sheet-protectors.jpg` | ✅ Real photo |
| BedBridge Connector | `public/images/products/tbar.jpg` | ✅ Real photo |
| Router — Marine & Yacht | `public/images/router/router-marine.jpg` | ✅ Real photo |
| Router — Family Beds | `public/images/router/router-family.jpg` | ✅ Real photo |
| Router — Duvet Covers | `public/images/router/router-duvet.jpg` | ✅ Real photo |
| Router — Protection | `public/images/router/router-protection.jpg` | ✅ Real photo |
| BreezePlus fabric | `public/images/fabrics/fabric-breezeplus.jpg` | ✅ Real photo |
| CloudSoft fabric | `public/images/fabrics/fabric-cloudsoft.jpg` | ✅ Real photo |
| PremaCotton fabric | `public/images/fabrics/fabric-premacotton.jpg` | ✅ Real photo |
| EcoLuxe fabric | `public/images/fabrics/fabric-ecoluxe.jpg` | ✅ Real photo |

### All Product & Category Images — Complete (replaced with real photos)
| Image | Path | Status | Replace Priority |
|---|---|---|
| Fitted Sheets category | `public/images/categories/category-fitted-sheets.jpg` | ✅ Real photo | — |
| Flat Sheets category | `public/images/categories/category-flat-sheets.jpg` | ✅ Real photo | — |
| Duvet Covers category | `public/images/categories/category-duvet-covers.jpg` | ✅ Real photo | — |
| Pillowcases category | `public/images/categories/category-pillowcases.jpg` | ✅ Real photo | — |
| Mattress Protectors category | `public/images/categories/category-mattress-protectors.jpg` | ✅ Real photo | — |
| Pet Owner category | `public/images/categories/category-pets.jpg` | ✅ Real photo | — |
| RV & Truck Cab category | `public/images/categories/category-rv-truck.jpg` | ✅ Real photo | — |
| Pet Owner Fitted Sheet | `public/images/products/pet-owner-fitted-sheet.jpg` | ✅ Real photo | — |
| Pet Owner Duvet Cover | `public/images/products/pet-owner-duvet-cover.jpg` | ✅ Real photo | — |
| Adjustable Mattress Fitted Sheet | `public/images/products/adjustable-mattress-fitted-sheet.jpg` | ✅ Real photo | — |
| Flat Sheet — Standard | `public/images/products/flat-sheet-standard.jpg` | ✅ Real photo | — |
| Flat Sheet — Extra Deep Pocket | `public/images/products/flat-sheet-extra-deep-pocket.jpg` | ✅ Real photo | — |
| Envelope Pillowcase | `public/images/products/pillowcase-envelope.jpg` | ✅ Real photo | — |
| Zipper Pillowcase | `public/images/products/pillowcase-zipper.jpg` | ✅ Real photo | — |
| Sham Pillowcase | `public/images/products/pillowcase-sham.jpg` | ✅ Real photo | — |
| Pet-Proof Mattress Protector | `public/images/products/pet-proof-mattress-protector.jpg` | ✅ Real photo | — |
| Pillow Protector | `public/images/products/pillow-protector.jpg` | ✅ Real photo | — |

> **How placeholders were generated:** `scripts/generate-placeholders.js` uses `sharp` to convert SVG text-to-image with brand palette colors. All generated images are 800×600px JPEG. Replace with real product photos from your photographer or Etsy listings before launch.
>
> **All images replaced with real photos (2026-05-15).** Product detail + category card images are complete.

---

## Thai Version — Missing Pages (2026-05-15)

**5 EN pages missing TH equivalents — no separate TH page needed (handled by redirects):**
| Page | EN URL | What happens |
|---|---|---|
| ~~Bed Sheet Size Guide~~ | ~~`/bed-sheets-size/`~~ | **`301 → /sizeguide/`** — wildcard `/*` catches all paths; no separate TH page |
| ~~Mattress Size (EN)~~ | ~~`/mattress-size/`~~ | **`301 → /sizeguide/`** — wildcard `/*` catches all paths; no separate TH page |
| ~~Thai Mattress Sizes~~ | ~~`/mattress-size-th/`~~ | **`301 → /sizeguide/th/`** — wildcard `/*` catches all paths; no separate TH page |
| ~~Pillow Protectors~~ | ~~`/pillow-protectors/`~~ | **`301 → /mattress-protectors/`** — wildcard `/*` catches all paths; no separate TH page |
| ~~Unsubscribe~~ | ~~`/unsubscribe/`~~ | **EN version sufficient** — email-based, language-agnostic |

**4 EN pages intentionally not built in TH (Phase 5+ or user-specific):**
| Page | EN URL | Reason |
|---|---|---|
| My Account | `/account/` | Phase 5 gated; redirect logged-out users |
| Checkout | `/checkout/` | Phase 5 payment flow; not SEO-critical |
| Order Confirmed | `/order-confirmed/` | Phase 5 post-payment page |
| Blog Index | `/blogs/` | ✅ Blog index + post template built 2026-05-16 |

**All WordPress old URLs:** `_redirects` wildcard `/*` rules catch every old blog post and page slug automatically. No separate TH pages needed for any WordPress legacy content.

**nav.js BILINGUAL_PAGES (updated 2026-05-15):** `/shipping/` and `/policy/` added so lang toggle routes correctly between EN and TH versions.

**Internal links fixed (2026-05-15):** 18 TH pages updated — all nav/footer/hero links changed from EN paths to TH-prefixed paths. From any TH page, clicking nav stays in TH until user toggles language.

---

## How to Use This Checklist

1. Pick one unchecked item above (e.g., "Hero Section")
2. Open the relevant page in your browser
3. Verify every sub-bullet for that item
4. Check the box when satisfied
5. If something is wrong, tell Droid exactly which item and what you see
6. Move to the next item

---

## Priority Order (Recommended)

1. **Hero image** — highest visual impact, easiest win
2. **Category images** — 4 photos make the homepage pop
3. **Product images** — download from Etsy, rename, drop in folder
4. **Configurator pricing** — verify prices match your actual Etsy listings
5. **Real reviews** — copy from Etsy dashboard, paste into `/reviews/` page
6. **Mobile check** — resize browser to 375px width, verify all sections

---

## Notes

- All placeholder prices are estimates — update via Admin dashboard in Phase 7
- EcoLuxe fabric is Calico / Greige (natural unbleached cotton), NOT GOTS-certified organic
- BreezePlus color palette (9 swatches): Dark Grey #4D545B, Silver #B7BEC8, Sand #D9D1C1, Sky #9CCAE1, Emerald #618283, Sea #5A7DA2, Pure White #FFFFFF, Baby Pink #E9B7BF, Ivory #F1EFE1
- If any page shows 404, confirm the folder exists in `public/` (e.g., `public/about/index.html`)
- If styles look broken, hard-refresh or check that `main.css` loaded in DevTools Network tab
