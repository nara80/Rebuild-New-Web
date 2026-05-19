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

### 3. Shop by Product (Primary Navigation) ✅ Restructured 2026-05-16
- [x] 5 cards visible: Sheets, Duvet Covers, Pillowcases, Protection, Accessories
- [x] Each card has brand-colored placeholder image
- [x] Section has warm cream background (`#fdfbf7`)
- [x] Each card is clickable and links to correct product-type category page
- [x] Card hover effect works (lift + shadow)
- [x] **Mobile:** 2 columns then 1 column at narrow width

> **NEW:** 5 primary product-type categories — Fitted + Flat Sheets merged to `/sheets/`, Protectors renamed to `/protection/`, Accessories added at `/accessories/`
> - `category-sheets.jpg` ✅
> - `category-duvet-covers.jpg` ✅
> - `category-pillowcases.jpg` ✅
> - `category-protection.jpg` ✅
> - `category-accessories.jpg` ✅

---

### 4. Shop by Niche (Category Cards) ✅ Done
- [x] 6 cards visible: Marine & Yacht, Family & Co-Sleep, Pet Owner, Deep Pocket, Boarding Dorm, RV & Truck Cab
- [x] Each card shows real photo or placeholder
- [x] Each card is clickable and links to correct niche/SEO landing page
- [x] Card hover effect works (lift + shadow)
- [x] **Mobile:** 2 columns then 1 column at narrow width

> **Action needed:** Provide 7 niche category photos → place in `public/images/categories/`
> **NEW:** 6 SEO landing pages (`/marine/`, `/family/`, `/pets/`, `/deep-pocket/`, `/boarding-dorm/`, `/rv-truck/`)
> **NEW:** Pet Owner landing page (`/pets/`) added for BreezePlus anti-fur market
> - `category-marine.jpg` (V-Berth on boat) ✅
> - `category-family.jpg` (family bed) ✅
> - `category-deep-pocket.jpg` (deep pocket pillow-top) ✅
> - `category-protection.jpg` (waterproof protector) ✅
> - `category-pets.jpg` (pet on bed) ✅
> - `category-rv-truck.jpg` (RV/camper interior) ✅
> - `category-boarding-dorm.jpg` (student bedroom) ✅

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

## URL Structure & Redirects (2026-05-14, updated 2026-05-16)

### `_redirects` — WordPress old URL → new bilingual pages

| Old URL | New URL | Type | Status |
|---|---|---|---|
| `/bed-sheets-size/*` | `/sizeguide/` | 301 | ✅ Active |
| `/mattress-size/*` | `/sizeguide/` | 301 | ✅ Active |
| `/mattress-size-th/*` | `/sizeguide/th/` | 301 | ✅ Active |

### `_redirects` — Shop by Product Restructure (2026-05-16)

| Old URL | New URL | Type | Status |
|---|---|---|---|
| `/fitted-sheets/*` | `/sheets/` | 301 | ✅ Active |
| `/flat-sheets/*` | `/sheets/` | 301 | ✅ Active |
| `/mattress-protectors/` (exact) | `/protection/` | 301 | ✅ Active |
| `/mattress-protectors/*` | `/protection/` | 301 | ✅ Active |
| `/protection/*` (Easy-Change Duvet) | `/boarding-dorm/` | 301 | ✅ Active |
| `/duvet/*` (Easy-Change Duvet) | `/deep-pocket/` | 301 | ✅ Active |
| `/th/fitted-sheets/*` | `/th/sheets/` | 301 | ✅ Active |
| `/th/flat-sheets/*` | `/th/sheets/` | 301 | ✅ Active |
| `/th/mattress-protectors/` (exact) | `/th/protection/` | 301 | ✅ Active |
| `/th/mattress-protectors/*` | `/th/protection/` | 301 | ✅ Active |
| `/th/protection/*` | `/th/boarding-dorm/` | 301 | ✅ Active |
| `/th/duvet/*` | `/th/deep-pocket/` | 301 | ✅ Active |

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
- [x] Page loads at `/products/`
- [x] Filter bar visible: Category dropdown + Fabric dropdown
- [x] 6 product cards in grid
- [x] Each card has placeholder, title, price, "Customize" button
- [x] Header and footer present

### Primary Product-Type Categories (restructured 2026-05-16)

#### Sheets (`/sheets/`) ✅ New — merged fitted + flat
- [x] Page loads at `/sheets/`
- [x] "Fitted Sheets" and "Flat Sheets" sub-section headings
- [x] Marine, Family, Pet Owner, Adjustable (Fitted) + Standard, Extra Deep Pocket (Flat) products shown

#### Duvet Covers (`/duvet-covers/`)
- [x] Page loads at `/duvet-covers/`

#### Pillowcases (`/pillowcases/`)
- [x] Page loads at `/pillowcases/`

#### Protection (`/protection/`) ✅ New — renamed from mattress-protectors
- [x] Page loads at `/protection/`
- [x] Mattress Protectors + Pillow Protectors combined (8 products)

#### Accessories (`/accessories/`) ✅ New — added
- [x] Page loads at `/accessories/`
- [x] BedBridge Connector listed

#### Duvet Covers (`/duvet-covers/`)
- [x] Page loads at `/duvet-covers/`
- [x] "Custom Duvet Covers" heading visible
- [x] 3-Sided Zipper and Pet Owner products shown

#### Pillowcases (`/pillowcases/`)
- [x] Page loads at `/pillowcases/`
- [x] "Custom Pillowcases" heading visible
- [x] Envelope, Zipper, Sham products shown

#### Mattress Protectors (`/mattress-protectors/`)
- [x] Page loads at `/mattress-protectors/`
- [x] "Mattress & Pillow Protectors" heading visible

### SEO Landing Pages (Use Case)

#### Marine Category (`/marine/`)
- [x] Page loads at `/marine/`
- [x] "Marine & Yacht" heading visible
- [x] Cross-links to `/fitted-sheets/` for Marine Fitted Sheet

#### Family Category (`/family/`)
- [x] Page loads at `/family/`
- [x] "Family & Co-Sleep" heading visible
- [x] Cross-links to `/fitted-sheets/` for Family Fitted Sheet

#### Pet Owner (`/pets/`)
- [x] Page loads at `/pets/`
- [x] "Pet Owner Bedding" heading visible
- [x] BreezePlus anti-fur explanation
- [x] Cross-links to `/fitted-sheets/` and `/duvet-covers/`

#### Deep Pocket (`/deep-pocket/`)
- [x] Page loads at `/deep-pocket/`
- [x] "Deep Pocket" heading visible
- [x] Deep Pocket + Adjustable Base explanation
- [x] Cross-links to `/fitted-sheets/` and `/flat-sheets/`

#### Boarding Dorm (`/boarding-dorm/`)
- [x] Page loads at `/boarding-dorm/`
- [x] "Boarding Dorm" heading visible
- [x] Student/student-parent angle
- [x] Cross-links to `/duvet-covers/` for 3-Sided Zipper Duvet

#### RV & Truck Cab (`/rv-truck/`)
- [x] Page loads at `/rv-truck/`
- [x] "RV & Truck Cab Bedding" heading visible
- [x] Problem section: tight spaces, built-in platforms, odd mattress shapes
- [x] CloudSoft quick-dry explanation
- [x] Cross-links to `/fitted-sheets/` for Marine Fitted Sheet
- [x] Cross-links to `/mattress-protectors/` for 6-Sided Encasement

---

## Size Guide SEO Hub

### Size Guide Landing (`/sizeguide/`)
- [x] Page loads at `/sizeguide/`
- [x] 4 cards visible linking to specific guides
- [x] Header and footer present

### Thai Size Guide (`/mattress-size-th/`)
- [x] Page loads at `/mattress-size-th/`
- [x] Thai heading: "ตารางขนาดที่นอน"
- [x] Thai size table: 3.5ฟุต through 7ฟุต
- [x] International sizes included
- [x] CTA button in Thai linking to configurator

### International Size Guide (`/mattress-size/`)
- [x] Page loads at `/mattress-size/`
- [x] EN heading: "Mattress Size Guide"
- [x] Size comparison table with TH/US/UK/EU/AU/JP
- [x] CTA to measurement guide

### How to Measure (`/how-to-measure-mattress-size/`)
- [x] Page loads at `/how-to-measure-mattress-size/`
- [x] Credit card method steps visible
- [x] SVG diagram showing card placement
- [x] Note: "Every standard credit card is exactly 85.60 mm (3.375 in) long"
- [x] **Footer restored (2026-05-14):** Full 4-col global footer (was stripped to copyright bar)

### Bed Sheet Sizes (`/bed-sheets-size/`)
- [x] Page loads at `/bed-sheets-size/`
- [x] Pocket depth table: Standard / Deep / Extra-Deep
- [x] Duvet cover size table
- [x] CTA to configurator

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

### All Product & Category Images — Complete (updated 2026-05-16)

> **Placeholder images generated:** `scripts/generate-placeholders.js` uses `sharp` to convert SVG text-to-image with brand palette colors. All generated images are 800×600px JPEG. Replace with real product photos before launch.

**Category images:**
| Image | Path | Status |
|---|---|---|
| Marine & Yacht | `public/images/categories/category-marine.jpg` | ✅ Placeholder |
| Family Co-Sleep | `public/images/categories/category-family.jpg` | ✅ Placeholder |
| Pet Owner | `public/images/categories/category-pets.jpg` | ✅ Placeholder |
| Deep Pocket | `public/images/categories/category-deep-pocket.jpg` | ✅ Placeholder |
| Boarding Dorm | `public/images/categories/category-boarding-dorm.jpg` | ✅ Placeholder |
| RV & Truck Cab | `public/images/categories/category-rv-truck.jpg` | ✅ Placeholder |
| Sheets | `public/images/categories/category-sheets.jpg` | ✅ Placeholder |
| Duvet Covers | `public/images/categories/category-duvet-covers.jpg` | ✅ Placeholder |
| Pillowcases | `public/images/categories/category-pillowcases.jpg` | ✅ Placeholder |
| Protection | `public/images/categories/category-protection.jpg` | ✅ Placeholder |
| Accessories | `public/images/categories/category-accessories.jpg` | ✅ Placeholder |

**Product images (22 listings):**
| Product | Path | Status |
|---|---|---|
| 3-Sided Zipper Duvet Cover | `public/images/products/3-sided-duvet.jpg` | ✅ Placeholder |
| Pet Owner Duvet Cover | `public/images/products/pet-owner-duvet-cover.jpg` | ✅ Placeholder |
| RV & Truck Duvet Cover | `public/images/products/rv-truck-duvet.jpg` | ✅ Placeholder |
| Custom Family Fitted Sheet | `public/images/products/family-co-sleeping-solutions-th-size.jpg` | ✅ Real photo |
| Pet Owner Fitted Sheet | `public/images/products/pet-owner-fitted-sheet.jpg` | ✅ Real photo |
| Marine Fitted Sheet (V-Berth) | `public/images/products/marine-fitted-sheet.jpg` | ✅ Real photo |
| RV & Truck Fitted Sheet | `public/images/products/rv-truck-fitted-sheet.jpg` | ✅ Placeholder |
| Adjustable Fitted Sheet | `public/images/products/adjustable-mattress-fitted-sheet.jpg` | ✅ Real photo |
| Flat Sheet — Standard | `public/images/products/flat-sheet-standard.jpg` | ✅ Real photo |
| Flat Sheet — Extra Deep Pocket | `public/images/products/flat-sheet-extra-deep-pocket.jpg` | ✅ Real photo |
| Envelope Pillowcase | `public/images/products/pillowcase-envelope.jpg` | ✅ Real photo |
| Zipper Pillowcase | `public/images/products/pillowcase-zipper.jpg` | ✅ Real photo |
| Sham Pillowcase | `public/images/products/pillowcase-sham.jpg` | ✅ Real photo |
| Pet Owner Pillowcase | `public/images/products/pet-owner-pillowcase.jpg` | ✅ Placeholder |
| RV & Truck Pillowcase | `public/images/products/rv-truck-pillowcase.jpg` | ✅ Placeholder |
| Waterproof Mattress Protector — Standard | `public/images/products/mattress-protector-standard.jpg` | ✅ Placeholder |
| Waterproof Mattress Protector — Family | `public/images/products/mattress-protector-family.jpg` | ✅ Placeholder |
| Waterproof Mattress Protector — Pet Owner | `public/images/products/mattress-protector-pet.jpg` | ✅ Real photo |
| Waterproof Mattress Protector — Dorm | `public/images/products/mattress-protector-dorm.jpg` | ✅ Placeholder |
| 6-Sided Mattress Encasement | `public/images/products/mattress-encasement-general.jpg` | ✅ Real photo |
| RV & Truck Mattress Encasement | `public/images/products/rv-truck-mattress-encasement.jpg` | ✅ Placeholder |
| Pillow Protector | `public/images/products/pillow-protector-general.jpg` | ✅ Placeholder |
| RV & Truck Pillow Protector | `public/images/products/rv-truck-pillow-protector.jpg` | ✅ Placeholder |
| BedBridge Connector | `public/images/products/bedbridge-connector.jpg` | ✅ Real photo |
| Custom Pet-Proof Mattress Protector | `public/images/products/custom-pet-proof-mattress-protector.jpg` | ✅ Placeholder |
| BedBridge Connector (TH) | `public/images/products/bedbridge-connector-th.jpg` | ✅ Placeholder |

**Deleted (replaced by new slugs):**
- `category-duvet.jpg` → deleted (old Easy-Change Duvet segment)
- `category-fitted-sheets.jpg` → deleted (merged into /sheets/)
- `category-flat-sheets.jpg` → deleted (merged into /sheets/)
- `category-mattress-protectors.jpg` → deleted (renamed to /protection/)
- `3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets.jpg` → delete after cleaner slug `3-sided-duvet.jpg` live
- `product-boat-bedding-fitted-sheet-microfiber.jpg` → delete after cleaner slug `marine-fitted-sheet.jpg` live
- `sheet-protectors.jpg` → delete after cleaner slug `mattress-encasement-general.jpg` live
- `tbar.jpg` → delete after cleaner slug `bedbridge-connector.jpg` live
- `pet-proof-mattress-protector.jpg` → delete after cleaner slug `mattress-protector-pet.jpg` live
- `family-co-sleeping-solutions-th-size.jpg` → **KEEP** (still used on TH product page)
- `adjustable-mattress-fitted-sheet.jpg` → **KEEP** (still used on EN product page)

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
| Blog Index | `/blogs/` | ✅ Blog index + pagination page + real blog post built 2026-05-16 |

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

## Phase 4 Completion Status ✅ (2026-05-19)

All build steps completed. Phase 4 is done.

| Category | Items | Status |
|---|---|---|
| Homepage EN + TH | 8 sections each | ✅ Complete |
| Static Pages EN | About, Contact, Fabric, Shipping, Policy, Reviews, Unsubscribe | ✅ Complete |
| Static Pages TH | 22 pages total (6 static + 16 product/category) | ✅ Complete |
| Blog | Index + pagination page 2 + template + 1 real post (17 posts) | ✅ Complete |
| Product/Category Pages | 12 pages (5 primary + 6 SEO landing + 1 listing) | ✅ Complete |
| Product Inventory Verified | 27 products across 5 categories (9/6/3/7/2) | ✅ Verified |
| Size Guide Pages | 4 pages with comprehensive tables | ✅ Complete |
| Header/Nav | EN + TH with search overlay + mobile drawer | ✅ Complete |
| Global Footer | 4-col restored on all pages | ✅ Complete |
| Workers API | products, pricing (real fitted sheet formula), geo-currency, subscribe, unsubscribe, quote (popup form + MailChannels), contact | ✅ Complete |
| Cookie Consent | GDPR banner with modal, GA4 conditional load | ✅ Complete |
| Font System | Quicksand (EN) + Sarabun (TH) bilingual | ✅ Complete |
| Image Compression | 92.5% size reduction | ✅ Complete |
| Bilingual URL Architecture | All EN/TH pages with language toggle | ✅ Complete |
| Product Detail Pages | All with configurator, tabs, related products | ✅ Complete |
| Fabric Pages | 4-tab showcase with comparison table | ✅ Complete |
| Redirects | `_redirects` file with WordPress 301s | ✅ Complete |
| Product Catalog System | `data/products.json` + `scripts/regenerate-products.js` | ✅ Complete |
| Fitted Sheet Pricing Formula | Real formula in `pricing.ts` + `product-configurator.js` (3 products) | ✅ Implemented |
| D1 standard_prices Design | Hybrid pricing architecture documented (future) | ✅ Designed |
| Custom Quote Popup | Modal form (Name/Email/Address/Phone) → `/api/quote` → D1 + MailChannels | ✅ Implemented |
| Custom Quotes D1 Table | Migration 003: `custom_quotes` (10 fields, quote_id, dimensions JSON) | ✅ Created |
| USD-only Pricing (EN) | EN pages show `$XX.XX` only; TH pages THB-only | ✅ Implemented |
