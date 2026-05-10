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

### 3. Shop by Niche (Category Cards) ✅ Done
- [x] 4 cards visible: Marine & Yacht, Family & Co-Sleep, Easy-Change Duvet, Protection
- [x] Each card shows real photo (not placeholder)
- [x] Each card is clickable and links to correct category page
- [x] Card hover effect works (lift + shadow)
- [x] **Mobile:** 2 columns then 1 column at narrow width

> **Action needed:** Provide 4 category photos → place in `public/images/categories/`
> - `category-marine.jpg` (V-Berth on boat) ✅
> - `category-family.jpg` (family bed) ✅
> - `category-duvet.jpg` (3-sided zipper duvet) ✅
> - `category-protection.jpg` (waterproof protector) ✅

---

### 4. Top Products ✅ Verified
- [x] 5 product cards visible in horizontal scroll row
- [x] Each card has: real product image + title + price + "Customize" button
- [x] Prices show in USD (or THB if you're browsing from Thailand)
- [x] "Customize" buttons link to correct product detail paths
- [x] Horizontal scroll works on mobile (swipe left/right)
- [x] **Mobile:** cards are swipeable, not squished

> **Action needed:** Download product photos from Etsy → rename to match slugs → place in `public/images/products/`
> Priority 5: 3-Sided Zipper Duvet, Family Sheet, Marine V-Berth, RV Encasement, BedBridge

---

### 5. Choose Your Solution (Router Section) ✅ Verified
- [x] Headline reads: "Built for Your Unique Space"
- [x] 4 router cards visible: Marine & Yacht, Family Beds, Duvet Covers, Specialized Protection
- [x] Each card shows real photo + title + description + CTA button
- [x] Each card links to the correct product category page
- [x] Card hover effect works (lift + shadow)
- [x] **Mobile:** cards stack vertically (1 column)

#### Measurement Blueprint Trust Block
- [x] Icon visible (ruler/blueprint)
- [x] Text reads: "Worried about measuring? Don't be..."
- [x] Block has left blue border accent
- [x] Centered below the router cards

> **Note:** Configurator removed from homepage. Each product page now has its own specific formula (Sheet: W/L/D, Duvet: W/L, Marine: Head/Bottom/Width/Depth, etc.).

---

### 6. Fabric Showcase ✅ Verified
- [x] 4 tabs: BreezePlus, CloudSoft, PremaCotton, EcoLuxe
- [x] Clicking each tab switches content panel
- [x] Each panel shows: fabric name, tagline, description, feature list, colors
- [x] Color swatches visible as circles
- [x] "Shop [Fabric]" button in each panel
- [x] **Mobile:** tabs horizontally scrollable, panel stacks vertically

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

## Footer (All Pages) ✅ Verified
- [x] 4 columns: Quick Links, Customer Service, Shop With Us, Contact
- [x] Marketplace icons (Etsy, eBay, Shopee, Lazada) in circles
- [x] Social row centered: Facebook, Instagram, TikTok, Pinterest, YouTube
- [x] Contact: email + phone + WhatsApp + LINE icons
- [x] Bottom bar: copyright + Privacy Policy + Shipping links
- [x] **Mobile:** columns stack vertically, icons left-aligned

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

## Image Checklist

| Image | Path | Status |
|---|---|---|
| Hero background | `public/images/Hero01.png` (used by CSS) | ✅ |
| Marine category | `public/images/categories/category-marine.jpg` | ✅ |
| Family category | `public/images/categories/category-family.jpg` | ✅ |
| Duvet category | `public/images/categories/category-duvet.jpg` | ✅ |
| Protection category | `public/images/categories/category-protection.jpg` | ✅ |
| 3-Sided Zipper Duvet | `public/images/products/3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets.png` | ✅ |
| Custom Family Sheet | `public/images/products/family-co-sleeping-solutions-th-size.png` | ✅ |
| Marine V-Berth | `public/images/products/product-boat-bedding-fitted-sheet-microfiber.png` | ✅ |
| RV Encasement | `public/images/products/sheet-protectors.png` | ✅ |
| BedBridge | `public/images/products/tbar.png` | ✅ |
| Router — Marine & Yacht | `public/images/router/router-marine.jpg` | ✅ |
| Router — Family Beds | `public/images/router/router-family.jpg` | ✅ |
| Router — Duvet Covers | `public/images/router/router-duvet.jpg` | ✅ |
| Router — Protection | `public/images/router/router-protection.jpg` | ✅ |
| BreezePlus fabric | `public/images/fabrics/fabric-breezeplus.png` | ✅ |
| CloudSoft fabric | `public/images/fabrics/fabric-cloudsoft.png` | ✅ |
| PremaCotton fabric | `public/images/fabrics/fabric-premacotton.png` | ✅ |
| EcoLuxe fabric | `public/images/fabrics/fabric-ecoluxe.png` | ✅ |

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
