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

### 1. Hero Section
- [ ] Headline reads: "Bedding Made Easy Again: Custom Sizes, Perfect Fits."
- [ ] Sub-headline visible underneath
- [ ] Two CTA buttons visible: "Shop Custom Bedding" + "Measure My Mattress"
- [ ] Hero background is CI blue gradient (placeholder — **replace with your photo**)
- [ ] Buttons are clickable and link to correct pages
- [ ] **Mobile:** Text readable, buttons stack vertically
- [ ] **Mobile:** No horizontal scroll

> **Action needed:** Provide hero lifestyle photo (1200px+ wide) → rename to `hero-bg.jpg` → place at `public/images/hero-bg.jpg`

---

### 2. Trust Bar
- [ ] 4 trust items in a row on desktop
- [ ] Icons visible (shield, wrench, star, globe)
- [ ] Labels read: OEKO-TEX Certified, Siriraj Dust-Mite Certified, 5★ Reviews on Etsy, Ships Worldwide
- [ ] **Mobile:** stacks 2×2 grid
- [ ] **Tablet:** 4 items in a row or 2×2

---

### 3. Shop by Niche (Category Cards)
- [ ] 4 cards visible: Marine & Yacht, Family & Co-Sleep, Easy-Change Duvet, Protection
- [ ] Each card shows colored placeholder (no image yet)
- [ ] Each card is clickable and links to correct category page
- [ ] Card hover effect works (lift + shadow)
- [ ] **Mobile:** 2 columns then 1 column at narrow width

> **Action needed:** Provide 4 category photos → place in `public/images/categories/`
> - `category-marine.jpg` (V-Berth on boat)
> - `category-family.jpg` (family bed)
> - `category-duvet.jpg` (3-sided zipper duvet)
> - `category-protection.jpg` (waterproof protector)

---

### 4. Top Products
- [ ] 5 product cards visible in horizontal scroll row
- [ ] Each card has: placeholder image + title + price + "Customize" button
- [ ] Prices show in USD (or THB if you're browsing from Thailand)
- [ ] "Customize" buttons link to correct product detail paths
- [ ] Horizontal scroll works on mobile (swipe left/right)
- [ ] **Mobile:** cards are swipeable, not squished

> **Action needed:** Download product photos from Etsy → rename to match slugs → place in `public/images/products/`
> Priority 5: 3-Sided Zipper Duvet, Family Sheet, Marine V-Berth, RV Encasement, BedBridge

---

### 5. Custom Configurator (Most Important — Test Thoroughly)
- [ ] Two tabs visible: "Fitted Bed Sheet" and "V-Berth Boat Sheet"
- [ ] Clicking tabs switches the active tab (blue highlight)

#### Fitted Bed Sheet Mode
- [ ] 3 inputs visible: Width, Length, Depth
- [ ] Enter numbers → price updates instantly below
- [ ] Price note visible: "Price excludes shipping & import tariff"

#### V-Berth Boat Sheet Mode
- [ ] 4 inputs visible: Head Width, Foot Width, Length, Depth
- [ ] Enter numbers → price updates instantly
- [ ] SVG diagram changes from rectangle to trapezoid when switching tabs

#### Unit Toggle
- [ ] "cm" and "inch" buttons visible top-right
- [ ] Click "inch" → all input values convert
- [ ] Click "cm" → values convert back
- [ ] Price still calculates correctly after unit switch

#### Fabric Selector
- [ ] 4 fabric chips: BreezePlus, CloudSoft, PremaCotton, EcoLuxe
- [ ] Clicking a chip changes active state (blue)
- [ ] Changing fabric updates the price

#### Add to Cart
- [ ] "Add to Cart" button visible
- [ ] Clicking it updates cart count in header (top right)
- [ ] Cart count persists after page refresh

#### Responsive
- [ ] **Mobile:** configurator stacks vertically (inputs above diagram)
- [ ] **Mobile:** tabs fit without wrapping awkwardly

> **Action needed:** Adjust placeholder prices in `configurator.js` or Admin dashboard later

---

### 6. Fabric Showcase
- [ ] 4 tabs: BreezePlus, CloudSoft, PremaCotton, EcoLuxe
- [ ] Clicking each tab switches content panel
- [ ] Each panel shows: fabric name, tagline, description, feature list, colors
- [ ] Color swatches visible as circles
- [ ] "Shop [Fabric]" button in each panel
- [ ] **Mobile:** tabs wrap to 2 rows, panel stacks vertically

---

### 7. Social Proof (Reviews)
- [ ] 2 review cards visible
- [ ] 5-star rating shown on each card
- [ ] Review text and author name visible
- [ ] Etsy badge at bottom: "5.0 out of 5 stars on Etsy"
- [ ] **Mobile:** cards stack vertically

> **Action needed:** Replace 4 placeholder reviews with real Etsy reviews on `/reviews/` page

---

### 8. Email Signup
- [ ] "Get 10% Off Your First Order" headline visible
- [ ] Email input + Subscribe button
- [ ] Section has blue gradient background
- [ ] **Mobile:** input and button stack vertically

---

## Homepage TH (`/th/`)
- [ ] Page loads at `http://127.0.0.1:8788/th/`
- [ ] All 8 sections visible with Thai text
- [ ] Configurator labels in Thai
- [ ] Fabric tabs in Thai
- [ ] All links work correctly (same URLs as EN version)
- [ ] **Mobile:** same responsive behavior as EN homepage

---

## Static Pages

### About Us (`/about/`)
- [ ] Page loads at `/about/`
- [ ] Company story text visible
- [ ] Mission statement visible
- [ ] Two certification cards: OEKO-TEX + Siriraj
- [ ] "Shop Custom Bedding" CTA at bottom
- [ ] Header and footer present

### Contact (`/contact/`)
- [ ] Page loads at `/contact/`
- [ ] Contact form: Name, Email, Subject, Message
- [ ] LINE Official card with icon
- [ ] WhatsApp card with icon
- [ ] Facebook card with icon
- [ ] Email + Phone cards
- [ ] Marketplace buttons row: Etsy, eBay, Shopee, Lazada, TikTok Shop
- [ ] Header and footer present

### Fabric Collections (`/fabric/`)
- [ ] Page loads at `/fabric/`
- [ ] 4 fabric tabs work (same as homepage but full page)
- [ ] Each panel has "Shop [Fabric]" button
- [ ] Comparison table at bottom with all 4 fabrics
- [ ] Header and footer present

### Shipping Policy (`/shipping/`)
- [ ] Page loads at `/shipping/`
- [ ] Processing time: 3-5 business days
- [ ] Shipping regions table visible
- [ ] Carriers listed: Thailand Post, DHL, FedEx
- [ ] Free shipping note for Thailand over ฿2,500
- [ ] Customs & import tariff disclaimer
- [ ] Returns policy text
- [ ] Header and footer present

### Privacy Policy (`/policy/`)
- [ ] Page loads at `/policy/`
- [ ] 10 sections visible
- [ ] Third-party services listed: Stripe, MailChannels, shipping carriers, Cloudflare
- [ ] Data retention: 7 years
- [ ] User rights section
- [ ] Header and footer present

### Reviews (`/reviews/`)
- [ ] Page loads at `/reviews/`
- [ ] 6 review cards visible
- [ ] Etsy badge at bottom
- [ ] "Write a Review on Etsy" button
- [ ] Header and footer present

> **Action needed:** Replace placeholder reviews with real ones from Etsy

---

## Product & Category Pages

### Product Listing (`/products/`)
- [ ] Page loads at `/products/`
- [ ] Filter bar visible: Category dropdown + Fabric dropdown
- [ ] 6 product cards in grid
- [ ] Each card has placeholder, title, price, "Customize" button
- [ ] Header and footer present

### Marine Category (`/marine/`)
- [ ] Page loads at `/marine/`
- [ ] "Marine & Yacht" heading visible
- [ ] Marine-related products shown

### Family Category (`/family/`)
- [ ] Page loads at `/family/`
- [ ] "Family & Co-Sleep" heading visible

### Duvet Category (`/duvet/`)
- [ ] Page loads at `/duvet/`
- [ ] "Easy-Change Duvet" heading visible

### Protection Category (`/protection/`)
- [ ] Page loads at `/protection/`
- [ ] "Protection" heading visible

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

### Bed Sheet Sizes (`/bed-sheets-size/`)
- [ ] Page loads at `/bed-sheets-size/`
- [ ] Pocket depth table: Standard / Deep / Extra-Deep
- [ ] Duvet cover size table
- [ ] CTA to configurator

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

## Footer (All Pages)
- [ ] 4 columns: Quick Links, Customer Service, Shop With Us, Contact
- [ ] Marketplace icons (Etsy, eBay, Shopee, Lazada) in circles
- [ ] Social row centered: Facebook, Instagram, TikTok, Pinterest, YouTube
- [ ] Contact: email + phone + WhatsApp + LINE icons
- [ ] Bottom bar: copyright + Privacy Policy + Shipping links
- [ ] **Mobile:** columns stack vertically, icons center-aligned

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

## Image Checklist (Your Action Items)

| Image | Path | Status |
|---|---|---|
| Hero background | `public/images/hero-bg.jpg` | ⬜ Need from you |
| Marine category | `public/images/categories/category-marine.jpg` | ⬜ Need from you |
| Family category | `public/images/categories/category-family.jpg` | ⬜ Need from you |
| Duvet category | `public/images/categories/category-duvet.jpg` | ⬜ Need from you |
| Protection category | `public/images/categories/category-protection.jpg` | ⬜ Need from you |
| 3-Sided Zipper Duvet | `public/images/products/3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets.jpg` | ⬜ Need from you |
| Custom Family Sheet | `public/images/products/family-co-sleeping-solutions-th-size.jpg` | ⬜ Need from you |
| Marine V-Berth | `public/images/products/product-boat-bedding-fitted-sheet-microfiber.jpg` | ⬜ Need from you |
| RV Encasement | `public/images/products/sheet-protectors.jpg` | ⬜ Need from you |
| BedBridge | `public/images/products/tbar.jpg` | ⬜ Need from you |

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

- All placeholder text is marked with "Placeholder" or "Visual" labels
- All placeholder prices are estimates — update via Admin dashboard in Phase 7
- If any page shows 404, confirm the folder exists in `public/` (e.g., `public/about/index.html`)
- If styles look broken, hard-refresh or check that `main.css` loaded in DevTools Network tab
