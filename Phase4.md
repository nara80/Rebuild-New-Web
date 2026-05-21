# Phase 4 — Homepage + Product Pages
**Goal:** Build all real content pages — the homepage with every section filled, the product listing grid, individual product detail pages, and the size guide SEO hub pages.

**End Result:** A fully functional shopping experience. Visitors can land on the homepage, browse products by category, enter their mattress dimensions, and see a live price update — all before Phase 5 adds the actual payment step.

**Status (2026-05-21): ✅ COMPLETE — Homepage redesigned per Brand CI, all 27 product configurators live (including Marine V-Berth formula). See AGENTS.md for full details.**

---

## Initial Requirements — What You Must Provide

Collect all of the following before telling Droid to build. Phase 4 has the most content decisions of any phase — take time to prepare each requirement carefully before starting.

---

### Requirement 1 — Confirm Phase 3 Is Complete

Phase 4 builds real content into pages that already have the header and footer from Phase 3. If Phase 3 is not complete, the pages will have no navigation.

**Confirm before starting:**
- [ ] `public/css/main.css` exists and has content
- [ ] `public/js/nav.js` exists
- [ ] Opening `http://localhost:8788` shows a styled header with logo and navigation


**If any item is missing:** Go back and complete Phase 3 before continuing.

---

### Requirement 2 — Hero Section Content

The homepage hero is the first thing visitors see. You need one decision: the background image.

**Option A — Use your own lifestyle photo (recommended):**
- Must be at least 1200px wide, landscape orientation
- Best subject: boat interior with V-Berth sheet, or family bed with co-sleep sheet
- Rename to `hero-bg.jpg` and place at:
  ```
  D:\00_MildMate\Re-Bulit_Web\public\images\hero-bg.jpg
  ```

**Option B — Use auto-generated placeholder:**
- Tell Droid: "Use a CI blue placeholder for the hero background."
- Droid creates a solid `#2c96f4` background with white text overlay — professional and swappable later

**Hero text is already decided (from your knowledge base):**
- Headline EN: "Bedding Made Easy Again: Custom Sizes, Perfect Fits."
- Headline TH: "ผ้านอนที่พอดี สั่งตัดตามขนาดของคุณ"
- CTA Button 1: "Shop Custom Bedding" → `/products/`
- CTA Button 2: "Measure My Mattress" → `/how-to-measure-mattress-size/`

**Write down:** Option A (file ready) or Option B (use placeholder).

---

### Requirement 3 — Category Section Images

The "Shop by Niche" section has 4 cards. Each needs one photo.

**Prepare and place these images:**

| Card | File Name | Place At | What It Should Show |
|---|---|---|---|
| Marine & Yacht | `category-marine.jpg` | `public/images/categories/` | V-Berth mattress on a boat |
| Family & Co-Sleep | `category-family.jpg` | `public/images/categories/` | Family bed, parents + child |
| Easy-Change Duvet | `category-duvet.jpg` | `public/images/categories/` | 3-sided zipper duvet open |
| Boarding Dorm | `category-ibs.jpg` | `public/images/categories/` | Student with duvet at dorm abroad |

**For each image, write:** Ready / Missing (Droid will use a colored placeholder for missing ones).

---

### Requirement 4 — Product Images (Top 10 Priority)

You have 83 products. You do not need all 83 images before Phase 4 starts. Start with these 10 — prioritized by your Etsy performance data.

**Priority order:**

| Priority | Product Slug | Etsy Performance | Image Status |
|---|---|---|---|
| 1 | `3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets` | 667 views / $400 | Ready / Missing |
| 2 | `family-co-sleeping-solutions-th-size` | 388 views | Ready / Missing |
| 3 | `product-boat-bedding-fitted-sheet-microfiber` | 305 views / $149 | Ready / Missing |
| 4 | `sheet-protectors` | 325 views | Ready / Missing |
| 5 | `tbar` | 264 views / $72 | Ready / Missing |
| 6 | `breezeplus-fitted-sheets-standard-size-in-thailand` | High TH traffic | Ready / Missing |
| 7 | `cloudsoft-fitted-sheets-standard-size-in-thailand` | High TH traffic | Ready / Missing |
| 8 | `pillow-case` | Siriraj certified — high trust | Ready / Missing |
| 9 | `breezeplus-duvet-standard-size-in-thailand` | Standard product | Ready / Missing |
| 10 | `baby-blanket` | Gift/niche market | Ready / Missing |

**How to prepare:**
1. Download photos from your Etsy listings
2. Rename each photo to exactly match the slug in the table above (e.g., `tbar.jpg`)
3. Place all photos in: `D:\00_MildMate\Re-Bulit_Web\public\images\products\`

**Tell Droid which slugs have photos and which are missing** — it will use a branded MildMate placeholder for missing ones.

---

### Requirement 5 — Pricing Table

The Custom Configurator calculates live prices based on the dimensions a customer enters. You must provide base prices for each product category.

**Fill in this table with your actual prices:**

| Product Category | Base Price USD | Base Price THB | Sizing |
|---|---|---|---|
| Standard Fitted Sheet | $__ | ฿____ | Fixed |
| Custom Fitted Sheet (rectangular) | $__ | ฿____ | Base + per cm² |
| Custom Fitted Sheet (V-Berth / odd shape) | $__ | ฿____ | Base + shape surcharge |
| Duvet Cover (standard size) | $__ | ฿____ | Fixed |
| Custom Duvet Cover | $__ | ฿____ | Base + per cm² |
| Pillow Cover (each) | $__ | ฿____ | Fixed |
| Pillow Protector (each) | $__ | ฿____ | Fixed |
| Mattress Encasement | $__ | ฿____ | Base + per cm² |
| BedBridge Connector | $__ | ฿____ | Fixed |

**Reference:** Your Etsy AOV is ~$195 USD / ~฿6,900 THB. Use your current Etsy listing prices as the starting point.

**Price-per-cm² formula example:**
If a standard fitted sheet is 160×200cm and you charge $45 base, then for a custom 200×220cm sheet you might add $0.0015 per extra cm² = $0.0015 × (200×220 - 160×200) = $0.0015 × 12,000 = $18 extra → total $63.

> **Do not worry about getting this perfect.** You can change all prices from the Admin dashboard in Phase 7 without touching any code.

---

### Requirement 6 — Customer Review Text

The Social Proof section needs 2–3 real reviews from your Etsy customers.

**How to collect:**
1. Go to your Etsy shop → **Reviews** tab
2. Copy 2–3 of your best reviews (ones that mention custom sizing, fit, fabric quality, or the blueprint process)
3. Note the reviewer's first name and country

**Format to give Droid:**
```
Review 1:
"[Review text]"
— [First Name], [Country] ★★★★★

Review 2:
"[Review text]"
— [First Name], [Country] ★★★★★
```

**Minimum:** 2 reviews. Ideal: 3 reviews.

---

### Requirement 7 — Fabric Tab Content

The Fabric Showcase section has 4 tabs, one per fabric. Each tab shows the fabric name, key benefit, best-for description, and color options. This is already in your knowledge base (`01_Fabric_Intelligence_Guide_V2.md`) — confirm Droid can read it directly.

**Confirm:**
- [ ] `MildMateDataBase/01_Fabric_Intelligence_Guide_V2.md` exists
- [ ] You are happy for Droid to use this file as the source for the fabric tabs content

**If you want to change any fabric description:** Write the updated text and give it to Droid.

---

### Requirement 8 — Size Guide Table Data (Country-First Architecture)

The size guide now uses a **country-first progressive disclosure** model. Instead of one massive table, customers select their country first, then see only 4–6 relevant sizes.

**Countries supported (mapped to your GA4 top markets):**

| Country/Region | Sizes Available | Unit | Example "King" W×L |
|---|---|---|---|
| 🇺🇸 US / 🇨🇦 Canada | Twin, Full, Queen, King, Cal King | inch primary | 193 × 203 cm / 76 × 80 in |
| 🇬🇧 UK | Single, Double, King, Super King | cm | 150 × 200 cm / 59 × 79 in |
| 🇪🇺 EU / 🇮🇹 Italy / 🇫🇷 France / 🇳🇱 Netherlands / 🇩🇰 Denmark | 90×200, 140×200, 160×200, 180×200 | cm | 180 × 200 cm / 71 × 79 in |
| 🇦🇺 Australia | Single, King Single, Double, Queen, King | cm | 183 × 203 cm / 72 × 80 in |
| 🇹🇭 Thailand | 3.5ft, 5ft, 6ft, 6.5ft, 7ft | ft + cm | 180 × 200 cm / 6 × 6.5 ft |
| 🇲🇾/🇸🇬 Malaysia / Singapore | Super Single, Queen, King | cm + inch | 183 × 191 cm / 72 × 75 in |
| 🇮🇳 India | Single, Double, Queen, King | inch | 183 × 198 cm / 72 × 78 in |
| 🇯🇵 Japan | Semi-Single, Single, Semi-Double, Double, Queen, King | cm | 180 × 195 cm / 71 × 77 in |

**Unit display rule:** Every size label shows **BOTH** `cm` and `inch` simultaneously — no toggle needed on the reference tables. The cm/inch toggle is used only for the custom configurator input fields.

**Confirm:** "Country-first architecture confirmed" — OR — provide size corrections per country.

---

### Requirement 9 — Product Purchase Paths & Configurator Modes

Every product detail page supports **two distinct purchase paths**:

**Path A — Standard Size (Instant Add to Cart)**
- Country selector filters available sizes to that region's standards
- Size dropdown shows 4–6 options with BOTH cm + inch labels
- Fabric + color selector
- Live price from `products` table
- One-click "Add to Cart"

**Path B — Custom Size (Quote Required)**
- Configurator tabs for different custom bed types
- Customer enters dimensions → gets live ESTIMATE price
- "Submit for Custom Quote" → stored in `custom_quotes` table
- Admin approves → magic link emailed → customer adds locked price to cart

**Configurator tabs (Custom Path):**

| Tab | Inputs | Shape | Use Case |
|---|---|---|---|
| 🛏 Fitted Bed Sheet | W × L × D | Rectangle | Standard custom rectangle |
| ⚓ V-Berth Boat | Head × Foot × L × D | Trapezoid | Marine mattresses |
| 🚛 Truck Cab | W × L × D | Rectangle | Truck sleeper cabs |
| 👨‍👩‍👧 Family / Co-Sleep | W × L × D | Rectangle | Mega-beds, combined mattresses |
| 🚐 RV / Camper | W × L × D | Rectangle | RV mattresses |

**Pricing formula for V-Berth:** `((Head + Foot) / 2) × Length` = trapezoid area × fabric rate per cm²

**Shared features for both paths:**
- Unit toggle: **cm / inch** (geo-defaulted, `localStorage` persisted, converts in place)
- Fabric selector: BreezePlus | CloudSoft | PremaCotton | EcoLuxe
- Color selector
- SVG measurement diagram (switches per tab)
- Live price updates
- Price note: *"Price excludes shipping & import tariff"*

**Confirm:** "Both paths and all configurator tabs confirmed" — OR — list changes.

---

### Requirement 10 — New Static Pages Content

Phase 4 builds several new static pages beyond the homepage. Prepare content for each before asking Droid to build.

**10A — About Us (`/about/`)**
Write and provide:
- [ ] Company founding story (2–3 paragraphs)
- [ ] Mission statement (1–2 sentences)
- [ ] Key certifications to highlight (OEKO-TEX, Siriraj)
- [ ] Team introduction (optional — can be "MildMate team" without photos)

**10B — Contact Page (`/contact/`)**
Provide your channel URLs:
- [ ] LINE Official link: `https://lin.ee/[your-id]`
- [ ] WhatsApp link: `https://wa.me/[your-number]` (include country code, e.g. `66812345678`)
- [ ] Facebook page URL
- [ ] Etsy shop URL
- [ ] eBay store URL
- [ ] Shopee shop URL
- [ ] Lazada shop URL
- [ ] TikTok shop URL
- [ ] Contact form email destination: `[email to receive form submissions]`

**10C — Fabric Collections (`/fabric/`)**
- [ ] Confirm Droid can use `MildMateDataBase/01_Fabric_Intelligence_Guide_V2.md` as source
- [ ] Provide color list for each fabric (or confirm Droid uses defaults from knowledge base)

**10D — Shipping Policy (`/shipping/`)**
Write and provide:
- [ ] Regions you ship to (e.g., Thailand, worldwide, specific countries)
- [ ] Estimated processing time (e.g., "5–7 business days to produce")
- [ ] Shipping carriers used (e.g., Thailand Post, DHL, FedEx)
- [ ] Estimated transit times by region
- [ ] Shipping cost structure (free over X, or flat rate per region)
- [ ] Note that product prices exclude shipping and import tariffs

**10E — Customer Reviews (`/reviews/`)** ✅ Done
Supplement your Phase 4 Requirement 6 (Etsy reviews) with:
- [x] 6–10 total reviews (more than the 2–3 on the homepage) — **8 real Etsy reviews**
- [x] At least 1 review mentioning V-Berth / boat bedding — Review from Tariq (order #3826057194)
- [x] At least 1 review mentioning the 3-sided zipper duvet — Review from amymccreedy (order #3427586586)
- [x] Overall rating and total review count from Etsy — **5.0 ★★★★★** badge displayed

---

### Requirement 11 — Blog Template Setup

Blog posts are static HTML files written manually. Droid builds the **templates and index structure** — you fill in content later.

**What was built (2026-05-16):**
- Blog index page (`/blogs/index.html`) — featured post + 6-post grid, filter tabs, newsletter CTA
- Blog post template (`/blogs/template/index.html`) — hero image, article body, author box, social share, related products section

**To create a new blog post:** Copy `/blogs/template/index.html` to `/blogs/[post-slug]/index.html`, update the content, and add a card to the blog index.

**What YOU provide (for the 3 sample posts Droid pre-fills):**
| Field | Sample Post 1 | Sample Post 2 | Sample Post 3 |
|---|---|---|---|
| Title | [provide] | [provide] | [provide] |
| Category | [Marine/Family/etc.] | [Marine/Family/etc.] | [Marine/Family/etc.] |
| Excerpt | [1–2 sentences] | [1–2 sentences] | [1–2 sentences] |
| Thumbnail | Droid uses placeholder | Droid uses placeholder | Droid uses placeholder |
| Body | [200+ word draft] | [200+ word draft] | [200+ word draft] |

> **Image specs reminder:** Thumbnails = 800×534 px · Hero banners = 1200×500 px · Inline images = 1200×675 px

---

## What Phase 4 Builds

### Static Content Pages (new)
| Page / File | What It Is |
|---|---|
| `public/index.html` | Homepage (EN) — 8 sections with revised configurator |
| `public/th/index.html` | Homepage (TH) — Thai language version |
| `public/about/index.html` | About Us — company story, certifications, team |
| `public/contact/index.html` | Contact — form + LINE/WhatsApp/Facebook + marketplace icons |
| `public/fabric/index.html` | Fabric Collections — 4-tab deep-dive with comparison table |
| `public/shipping/index.html` | Returns & Delivery — 30-day returns, shipping regions, carriers, customs |
| `public/policy/index.html` | Privacy Policy — 14-section GDPR/CCPA-compliant with cookie inventory |
| `public/reviews/index.html` | Customer Reviews — 8 real Etsy reviews with mapped buyer names/countries |
| `public/unsubscribe/index.html` | Unsubscribe — email form + D1 deletion + privacy-safe API |
| `public/js/cookie-consent.js` | GDPR Cookie Consent Banner — Essential + Analytics toggles, GA4 conditional load |

### Blog Pages (static HTML templates)
| Page / File | What It Is |
|---|---|
| `public/blogs/index.html` | Blog index — featured post + 11-card grid + filter tabs + pagination (12/page) + newsletter CTA |
| `public/blogs/page/2/index.html` | Blog pagination page 2 — 5 posts (posts 13–17) |
| `public/blogs/template/index.html` | Blog post template — hero image, rich body, author box, social share, related products |
| `public/blogs/v-berth-sheets-vs-standard/index.html` | First real blog post — "5 Reasons V-Berth Sheets Beat Standard Sheets" |

### Product & SEO Pages
| Page / File | What It Is |
|---|---|
| `public/products/index.html` | Full product listing with filter bar (from `data/products.json`) |
| `public/sheets/index.html` | **NEW** Primary: Fitted Sheets + Flat Sheets (from `data/products.json`) |
| `public/duvet-covers/index.html` | **NEW** Primary: 3-Sided Zipper + Pet Owner duvet covers (from `data/products.json`) |
| `public/pillowcases/index.html` | **NEW** Envelope, Zipper, Sham pillowcases (from `data/products.json`) |
| `public/protection/index.html` | **NEW** Mattress Protectors + Pillow Protectors (from `data/products.json`) |
| `public/marine/index.html` | SEO Landing: Marine & Yacht category page (from `data/products.json`) |
| `public/family/index.html` | SEO Landing: Family & Co-Sleep category page (from `data/products.json`) |
| `public/duvet/index.html` | SEO Landing: Easy-Change Duvet category page (from `data/products.json`) |
| `public/pets/index.html` | SEO Landing: Pet Owner Bedding (BreezePlus anti-fur) |
| `public/rv-truck/index.html` | SEO Landing: RV & Truck Cab bedding |
| `public/product/[slug]/index.html` | 83 individual product detail pages |
| `public/mattress-size-th/index.html` | #1 SEO page — fully built with size tables |
| `public/mattress-size/index.html` | EN size guide page |
| `public/how-to-measure-mattress-size/index.html` | Measurement guide with credit card diagram |
| `public/bed-sheets-size/index.html` | Bed sheet size guide |

### Backend Workers
| File | What It Is |
|---|---|
| `workers/api/products.ts` | Serves product data from D1 (Phase 5+ runtime use — storefront uses `data/products.json`) |
| `workers/api/pricing.ts` | Calculates price for Fitted Bed Sheet AND V-Berth modes |
| `workers/api/geo-currency.ts` | Detects Thai visitors, returns THB prices |
| `workers/api/subscribe.ts` | Email signup: validation + D1 INSERT OR IGNORE + localized messages |
| `workers/api/unsubscribe.ts` | Email removal: D1 DELETE + privacy-safe response (always 200) |
| `public/js/configurator.js` | Frontend: two-mode live price calculator (Bed Sheet + V-Berth) |
| `public/js/cart.js` | Frontend: add to cart, localStorage (stores sheet_type + dimensions) |
| `public/js/cookie-consent.js` | Frontend: consent banner + modal + conditional GA4 load |
| `public/js/geo.js` | Frontend: currency display toggle |

---

## Homepage Sections (What You Will See)

Phase 4 builds the homepage in 8 sections from top to bottom:

```
1. HERO           — Big headline + CTA buttons + lifestyle background image
2. TRUST BAR      — 4 certification/trust icons in a row
3a. SHOP BY PRODUCT TYPE  — 5 category cards (Primary navigation)
3b. SHOP BY NICHE  — 5 category cards with images (SEO landing pages)
4. TOP PRODUCTS   — 5 product cards from your Etsy top performers
5. CONFIGURATOR   — Two-mode live price calculator (see Configurator Requirement below)
6. FABRIC TABS    — 4-tab showcase of BreezePlus, CloudSoft, PremaCotton, EcoLuxe
7. SOCIAL PROOF   — Customer reviews + 5-star rating
8. EMAIL SIGNUP   — "Get 10% off" footer email capture
```

---

## Step-by-Step Instructions

### Step 4.1 — Prepare Your Product Images

Product images are the most important visual element. Droid will use placeholders for missing images, but real photos make a huge difference in conversion.

**What to do:**

1. Go to your Etsy shop and download your product listing photos
2. Rename each image to match its product slug. Examples:

| Image File Name | Product |
|---|---|
| `product-boat-bedding-fitted-sheet-microfiber.jpg` | Marine fitted sheet |
| `3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets.jpg` | Pet duvet cover |
| `breezeplus-fitted-sheets-standard-size-in-thailand.jpg` | BreezePlus fitted sheet TH |
| `tbar.jpg` | BedBridge connector |
| `family-co-sleeping-solutions-th-size.jpg` | Family co-sleep sheet |

3. Place all images in this folder:
   ```
   D:\00_MildMate\Re-Bulit_Web\public\images\products\
   ```

> **You do NOT need all 83 images on day one.** Start with your top 10 most important products. Droid will use a branded placeholder image for the rest.

**Priority images to get first (your Etsy top 5):**

| Priority | Product | Etsy Performance |
|---|---|---|
| 1 | 3-Sided Zipper Duvet Cover (BreezePlus) | 667 views, $400 revenue |
| 2 | Custom Family Fitted Sheet (BreezePlus) | 388 views |
| 3 | Marine Fitted Sheet V-Berth | 305 views, $149 revenue |
| 4 | Custom RV & Van Mattress Encasement | 325 views |
| 5 | MildMate BedBridge Connector | 264 views, $72 revenue |

---

### Step 4.2 — Prepare Your Hero Section Image

The homepage hero needs one large lifestyle image (a photo of your product being used in a real setting).

**Best options from your product range:**
- A boat interior with your V-Berth fitted sheet on the mattress
- A family bed with parents and children using your co-sleep sheet
- A neatly made bed showing the 3-sided zipper duvet cover

**What to do:**
1. Choose one high-quality photo (at least 1200px wide)
2. Rename it to: `hero-bg.jpg`
3. Place it in: `D:\00_MildMate\Re-Bulit_Web\public\images\hero-bg.jpg`

> **Don't have a suitable photo yet?** Tell Droid "Use a placeholder hero image for now." Droid will use a solid CI blue background with text overlay — looks professional and can be swapped later.

---

### Step 4.3 — Prepare Your Pricing Table

The Custom Configurator needs a base price per product category to calculate live prices. This is the most important decision in Phase 4.

**Fill in this table with your actual prices:**

| Product Category | Base Price USD | Base Price THB | Price Logic |
|---|---|---|---|
| Standard Fitted Sheet | $__ | ฿____ | Fixed size — base price only |
| Custom Fitted Sheet (rectangular) | $__ | ฿____ | Base + extra per cm² over standard |
| Custom Fitted Sheet (V-Berth/odd shape) | $__ | ฿____ | Base + shape surcharge |
| Duvet Cover (standard) | $__ | ฿____ | Fixed size — base price only |
| Custom Duvet Cover | $__ | ฿____ | Base + extra per cm² |
| Pillow Cover (each) | $__ | ฿____ | Fixed — base price only |
| Pillow Protector (each) | $__ | ฿____ | Fixed — base price only |
| Mattress Encasement | $__ | ฿____ | Base + extra per cm² |
| BedBridge Connector | $__ | ฿____ | Fixed — no custom sizing |

**How to fill this in:**
Look at your existing Etsy listings for reference prices. Your average order value is ~$195 USD / ~฿6,900 THB.

**Tell Droid the completed table when you are ready.**

> You can always change prices later from the Admin dashboard (Phase 7) without touching any code.

---

### Step 4.4 — Prepare Your Etsy Review Text

The Social Proof section needs 2–3 real customer reviews.

**What to do:**
1. Go to your Etsy shop → Reviews section
2. Copy 2–3 of your best reviews. Ideal reviews mention: custom sizing, perfect fit, quality fabric, or fast shipping.
3. Write down the reviewer's first name and country (e.g., "Sarah, United States")

**Example of what to give Droid:**
```
Review 1:
"Absolutely perfect fit for our V-Berth! I was worried about the odd shape 
but the blueprint process made it so easy. Best sheets we've ever had on the boat."
— Wanda, United States ★★★★★

Review 2:
"The 3-sided zipper is a game changer. My elderly mother can change the duvet 
cover by herself now. Fabric quality is excellent."
— Sarah, Australia ★★★★★
```

---

### Step 4.5 — Prepare Your Category Section Images

The "Shop by Niche" section has 4 cards, each needing an image.

**What to do:**
1. Prepare one photo for each category:

| Card | Image File Name | What It Should Show |
|---|---|---|
| Marine & Yacht | `category-marine.jpg` | V-Berth bed on a boat |
| Family & Co-Sleep | `category-family.jpg` | Family bed with parents + child |
| Easy-Change Duvet | `category-duvet.jpg` | 3-sided zipper duvet being opened |
| Protection | `category-protection.jpg` | TPU mattress protector or pet on bed |

2. Place them in: `D:\00_MildMate\Re-Bulit_Web\public\images\categories\`

> **Missing category images?** Tell Droid which ones are missing — it will use a colored placeholder with the category name.

---

### Step 4.6 — Tell Droid to Build Phase 4

Once all 8 requirements are ready, hand off to Droid.

**Tell Droid:**
> "Phase 3 is complete. Please build Phase 4.
>
> **Requirement 1:** Phase 3 confirmed complete — header/footer visible on all pages.
>
> **Requirement 2 — Hero image:** [hero-bg.jpg is ready at public/images/ / use CI blue placeholder]
>
> **Requirement 3 — Category images:**
> - Marine: [ready / missing]
> - Family: [ready / missing]
> - Duvet: [ready / missing]
> - Protection: [ready / missing]
>
> **Requirement 4 — Product images ready (slugs):** [list which slugs have photos; Droid uses placeholder for the rest]
>
> **Requirement 5 — Pricing table:**
> - Standard Fitted Sheet: $[X] / ฿[X]
> - Custom Fitted Sheet: $[X] base / ฿[X] base
> - V-Berth/Odd Shape: $[X] base / ฿[X] base + shape surcharge
> - Duvet Cover standard: $[X] / ฿[X]
> - Custom Duvet Cover: $[X] base / ฿[X] base
> - Pillow Cover: $[X] / ฿[X]
> - Pillow Protector: $[X] / ฿[X]
> - Mattress Encasement: $[X] base / ฿[X] base
> - BedBridge Connector: $[X] / ฿[X]
>
> **Requirement 6 — Reviews:**
> [paste your review text here — 2–3 reviews]
>
> **Requirement 7 — Fabric content:** Use MildMateDataBase/01_Fabric_Intelligence_Guide_V2.md as the source.
>
> **Requirement 8 — Size table:** Standard sizes confirmed correct [OR: corrections listed here].
>
> **Requirement 9 — Configurator:** Both modes confirmed (Fitted Bed Sheet: W×L×D; V-Berth: Head×Foot×L×D). Unit toggle cm/inch required. Price note "Excludes shipping & import tariff" on all price displays.
>
> **Requirement 10 — New static pages:**
> - About Us content: [paste story]
> - Contact channels: LINE [URL] | WhatsApp [URL] | Facebook [URL] | Etsy [URL] | eBay [URL] | Shopee [URL] | Lazada [URL] | TikTok [URL] | Form email: [email]
> - Fabric Collections: Use MildMateDataBase/01_Fabric_Intelligence_Guide_V2.md
> - Shipping Policy: [paste your regions, rates, transit times]
> - Customer Reviews: [paste 6–10 reviews]
>
> **Requirement 11 — Blog:** Build blog index with 3 sample posts. Sample post 1: [title/category/excerpt/body]. Post 2: [same]. Post 3: [same].
>
> Build the homepage (EN + TH), all new static pages (About, Contact, Fabric Collections, Shipping Policy, Privacy Policy, Customer Reviews), blog index + 3 sample posts, product listing + 11 category pages (5 primary product-type + 6 SEO landing), all product detail pages (15+ expandable to 83), the 4 size guide pages, and all backend Workers (products API, pricing API with both modes, geo-currency API)."

---

### Step 4.7 — Review the Homepage Section by Section

After Droid finishes, open `http://localhost:8788` and review each section top to bottom.

**Section 1 — Hero**

| Check | Expected |
|---|---|
| Headline visible | "Bedding Made Easy Again: Custom Sizes, Perfect Fits." |
| Two CTA buttons | "Shop Custom Bedding" (blue, filled) + "Measure My Mattress" (blue, outline) |
| Background image | Your hero photo or CI blue placeholder |
| Mobile view | Text is readable, buttons stack vertically |

**Section 2 — Trust Bar**

| Check | Expected |
|---|---|
| 4 icons in a row | OEKO-TEX, Siriraj, 5★, Ships Worldwide |
| Icons have labels | Text below each icon |
| Mobile | Icons stack to 2×2 grid |

**Section 3 — Shop by Niche**

| Check | Expected |
|---|---|
| 6 cards visible | Marine, Family, Pets, Duvet, International Boarding School, RV & Truck |
| Each card has image | Photo or colored placeholder |
| Each card links somewhere | Clicking goes to the category listing |
| Mobile | Cards stack to 2 columns |

**Section 4 — Top Products**

| Check | Expected |
|---|---|
| 5 product cards | Your Etsy top 5 products shown |
| Each card has image, title, price | All 3 visible |
| Price shows correct currency | THB if you are in Thailand |
| "Customize" button | Blue button on each card |
| Mobile | Horizontal scroll row |

**Section 5 — Custom Configurator**

| Check | Expected |
|---|---|
| Two mode tabs visible | "🛏 Fitted Bed Sheet" and "⚓ V-Berth Boat Sheet" |
| Unit toggle visible | cm / inch switch in top-right of configurator |
| Bed Sheet tab — inputs | Width, Length, Depth (3 inputs) |
| V-Berth tab — inputs | Head Width (Bow), Foot Width (Cabin), Length, Depth (4 inputs) |
| Diagram beside inputs | Labeled SVG diagram switches when tab switches |
| Fabric selector | 4 fabric buttons (BreezePlus, CloudSoft, PremaCotton, EcoLuxe) |
| Unit toggle | Clicking "inch" converts all input values instantly |
| Enter numbers and change fabric | Price updates immediately without page reload |
| Price note | "Price excludes shipping & import tariff" visible below price |
| Currency | Shows THB for Thai visitors, USD for others |
| "Add to Cart" button | Visible and clickable after dimensions are entered |

> **This is the most important section to test.** Test BOTH modes (bed sheet and V-Berth) and the unit toggle. The configurator is your main conversion tool.

**Section 6 — Fabric Tabs**

| Check | Expected |
|---|---|
| 4 tab buttons | BreezePlus, CloudSoft, PremaCotton, EcoLuxe |
| Clicking a tab | Shows that fabric's info panel |
| Active tab | Highlighted in brand blue |
| Each panel | Shows fabric name, key benefit, best-for list, available colors |

**Section 7 — Social Proof**

| Check | Expected |
|---|---|
| 2–3 reviews visible | Your review text and reviewer names |
| Star ratings | 5 gold stars shown |
| Overall rating | "5.0 ★★★★★" badge |

**Section 8 — Email Signup**

| Check | Expected |
|---|---|
| Email input box | Visible with placeholder text |
| Subscribe button | Blue button |
| Incentive text | "Get 10% off your first order" or similar |

---

### Step 4.8 — Review the Product Listing Page

Go to `http://localhost:8788/products/`

| Check | Expected |
|---|---|
| Filter bar at top | Category, Fabric, Size Region dropdowns |
| Product grid | 3 columns on desktop, 2 on mobile |
| Each card | Image, product title, price, "Customize" button |
| Selecting a filter | Grid updates to show only matching products |
| Currency | Correct for your location (THB/USD) |

---

### Step 4.9 — Review a Product Detail Page

Go to `http://localhost:8788/product/product-boat-bedding-fitted-sheet-microfiber/`

| Check | Expected |
|---|---|
| Product image | Shows at left (or top on mobile) |
| Product title | "Boat Bedding: CloudSoft Marine Fitted Sheet" |
| Fabric badge | "CloudSoft" badge visible |
| Configurator | Width, Length, Depth fields + fabric swatches + live price |
| cm/inch toggle | Clicking switches between centimetres and inches |
| "Measure My Mattress" link | Collapses/expands the credit card diagram below |
| Tabs at bottom | Description, Fabric Details, Size Guide, Care — all clickable |
| "Add to Cart" button | Blue, appears after dimensions are entered |

---

### Step 4.10 — Review the Size Guide Pages (SEO Hub)

Go to `http://localhost:8788/mattress-size-th/`

| Check | Expected |
|---|---|
| Page title in browser tab | `[เช็คขนาด] ที่นอน 6ฟุต 5ฟุต 3.5ฟุต ทุกแบรนด์...` |
| Size comparison table | Thai mattress sizes in cm and feet |
| International comparison | TH / US / UK / EU / AU / JP columns |
| Credit card measurement section | Diagram showing how to use card as ruler |
| CTA at bottom | "Measure your mattress → Get instant price" button linking to configurator |

---

### Step 4.11 — Test the Cart

Add a product to the cart and verify it saves correctly.

**How to test:**
1. Go to any product detail page
2. Enter dimensions (e.g., Width: 160, Length: 200, Depth: 25)
3. Select a fabric (e.g., BreezePlus)
4. Click "Add to Cart"
5. Check the cart icon in the header — the count should increase from 0 to 1
6. Click the cart icon — a mini drawer should open showing the item
7. Close the browser and reopen `http://localhost:8788`
8. Click the cart icon again — the item should still be there (saved in localStorage)

> **Why does it persist after closing?** The cart is saved in your browser's localStorage — it stays until you clear it or complete checkout.

---

### Step 4.12 — Test the Geo-Currency Toggle

**How to test Thai pricing:**
1. In your browser go to `http://localhost:8788`
2. Open Developer Tools (`F12`) → click **Network** tab → click **Throttling** dropdown → find "Custom..."
3. This is complex to simulate locally — instead, tell Droid: "Please add a manual currency toggle button to the header for testing so I can switch between THB and USD."
4. Use that toggle to switch and confirm prices change on product pages

---

## How You Know Phase 4 Is Complete

Go through this checklist before moving to Phase 5:

**Initial Requirements:**
- [x] Phase 3 confirmed complete (header/footer visible on all pages)
- [x] Hero image ready at `public/images/hero-bg.jpg` OR placeholder option decided — CI blue gradient hero built
- [x] Category images placed — real photos in `public/images/categories/`
- [x] Top 10 priority product images placed in `public/images/products/`
- [x] Pricing table filled in for all 9 product categories — placeholder prices set ($45–65 USD base)
- [x] 2–3 customer reviews copied from Etsy with reviewer name + country
- [x] Fabric content source confirmed — `MildMateDataBase/01_Fabric_Intelligence_Guide_V2.md` used
- [x] Mattress size table confirmed (standard sizes — all 8 regions built)
- [x] Configurator spec confirmed (both modes: Fitted Sheet + V-Berth, cm/inch toggle, localStorage persistence)
- [x] Contact page channel URLs collected — all marketplace + social URLs in place
- [x] About Us story written — Engineering Authority 5-section rebuild with real images
- [x] Shipping Policy content written (regions, rates, transit times)
- [x] Customer Reviews content prepared (6–10 reviews) — 8 real Etsy reviews with mapped names/countries
- [x] Blog content for 3 sample posts prepared — 17 posts built (1 featured + 11 grid + 5 pagination), first real post written

**Build Steps:**
- [x] Homepage loads with all 8 sections visible and correctly styled
- [x] Hero headline reads: "Bedding Made Easy Again: Custom Sizes, Perfect Fits."
- [x] Trust bar shows all 4 icons
- [x] 5 product-type category cards visible (Fitted Sheets, Flat Sheets, Duvet Covers, Pillowcases, Protectors)
- [x] 6 niche category cards visible with images (Marine, Family, Pets, Duvet, Boarding Dorm, RV & Truck)
- [x] Top 5 products show with prices
- [x] Configurator shows two tabs: "🛏 Fitted Bed Sheet" and "⚓ V-Berth Boat Sheet"
- [x] Fitted Bed Sheet tab shows Width / Length / Depth inputs
- [x] V-Berth tab shows Head Width / Foot Width / Length / Depth inputs
- [x] cm/inch unit toggle converts all values
- [x] Measurement diagram switches when tab is changed
- [x] Price updates instantly when dimensions are entered
- [x] Price note "Excludes shipping & import tariff" visible
- [x] Fabric tabs all work (click each — panel changes)
- [x] At least 2 customer reviews visible in Social Proof section — 8 real reviews shown
- [x] Email signup form visible in section 8
- [x] About Us page (`/about/`) loads with company story
- [x] Contact page (`/contact/`) shows form + LINE/WhatsApp/Facebook links + marketplace icons
- [x] Fabric Collections page (`/fabric/`) shows 4 fabric tabs
- [x] Shipping Policy page (`/shipping/`) loads with content
- [x] Customer Reviews page (`/reviews/`) shows review grid — 8 real Etsy reviews
- [x] Blog index (`/blogs/`) shows 17 posts across 2 pages with pagination + featured post
- [x] Product listing page (`/products/`) shows product grid
- [x] Primary category pages (`/sheets/`, `/duvet-covers/`, `/pillowcases/`, `/protection/`) show product grids
- [x] SEO landing pages (`/marine/`, `/family/`, `/pets/`, `/duvet/`, `/protection/`, `/rv-truck/`) show filtered grids with cross-links to primary categories
- [x] Product detail pages show two-mode configurator with live price update
- [x] "Measure My Mattress" collapsible section opens and closes
- [x] Product detail tabs work (Description, Fabric Details, Size Guide, Care)
- [x] "Add to Cart" saves item (with sheet_type + all dimensions) and updates header icon count
- [x] Cart persists after browser refresh (localStorage)
- [x] All pages have header and footer from Phase 3
- [x] Pages look correct on mobile (resize browser to narrow)
- [x] Product catalog system verified: `data/products.json` exists with all 27 products
- [x] `node scripts/regenerate-products.js` runs successfully (23 pages, 189 cards)
- [x] Filter consistency check matches: sheets=9, duvet-covers=6, pillowcases=3, protection=7, accessories=2, marine=7, family=8, pets=8, deep-pocket=7, boarding-dorm=6, rv-truck=8
- [x] `/pillowcases/` shows only `PILLOWCASES` tag on all cards (no niche tags, no DUVET)
- [x] Niche pages show `PILLOWCASES` + niche tag on pillowcase cards

---

## Troubleshooting Common Problems

| Problem | Solution |
|---|---|
| Phase 3 header/footer missing | Go back and complete Phase 3 — run `npx wrangler pages dev public` and check `http://localhost:8788` for the styled header. |
| Hero image not showing | Confirm the file is named exactly `hero-bg.jpg` (lowercase) and is in `public/images/`. Tell Droid if you want a placeholder instead. |
| Category image missing or wrong | Tell Droid: "The [Marine/Family/Duvet/Protection] category image is missing — use a placeholder." |
| Product image not showing | Confirm the image file name exactly matches the product slug (all lowercase, hyphens not underscores). |
| Pricing table left blank | Use your current Etsy listing prices as a starting point. Tell Droid: "Use placeholder prices of $45 USD / ฿1,500 THB for all categories until I update them later." |
| Fabric guide file missing | Tell Droid: "The file MildMateDataBase/01_Fabric_Intelligence_Guide_V2.md is missing — use this fabric summary instead: [paste fabric names and short descriptions]." |
| Configurator price doesn't update | Tell Droid: "The configurator price is not updating when I enter dimensions." |
| Product listing page is empty | Tell Droid: "The /products/ page shows no products." — usually means the Worker API is not running. |
| Cart count not updating | Tell Droid: "The cart icon count does not update after clicking Add to Cart." |
| Cart lost after browser refresh | Tell Droid: "Cart items disappear after page refresh — localStorage is not saving correctly." |
| Size guide page shows wrong title | Tell Droid: "The /mattress-size-th/ page title should say [correct title]." |
| Fabric tabs not switching | Tell Droid: "Clicking a fabric tab is not switching the content panel." |
| Mobile layout broken | Tell Droid: "The [section name] section looks broken on mobile — [describe what you see]." |
| Product catalog out of sync | Run `node scripts/regenerate-products.js` to rebuild all 23 pages from `data/products.json` |
| Add/edit product | Edit `data/products.json`, then run `node scripts/regenerate-products.js` |
| Pillowcase shows wrong niche tag | The pillowcase cards on niche pages use `buildEnListingCard(nicheSlug)` — confirm JSON `categories` array is correct for that product | |

---

## Content You Can Update Later

These items do not need to be perfect in Phase 4. You can update them via the Admin dashboard in Phase 7:

| Content | Where to Update Later |
|---|---|
| Product titles and descriptions | Admin → Products → Edit |
| Product prices | Admin → Products → Edit |
| Product images | Admin → Image Uploader |
| Hero headline text | Tell Droid to change it any time |
| Review text | Tell Droid to update it any time |

---

## What Happens Next

Once Phase 4 is complete and the shopping experience works end-to-end (browse → configure → add to cart), move to **Phase 5 — Checkout + Stripe Payments**.

Phase 5 connects the cart to Stripe so customers can actually complete a purchase. Thai visitors will see a PromptPay QR code. International visitors will see card/Apple Pay/Google Pay.

**Tell Droid:** "Phase 4 is complete. All checklist items are done. Please start Phase 5."

---

## Phase 4 Completion Summary (2026-05-09)

### Built & Delivered

| Item | Status | Notes |
|---|---|---|
| Homepage EN (`/`) | ✅ | 8 sections: Hero, Trust, Categories, Top Products, Configurator, Fabric Tabs, Reviews, Email Signup |
| Homepage TH (`/th/`) | ✅ | Full Thai translation of all 8 sections |
| About Us (`/about/`) | ✅ | Engineering Authority 5-section rebuild: Technical Hero + Blueprint Grid, Engineering Genesis (2019 Mattress Gap Paradox), Authority Timeline (2019/2022/2024/2026), Material Standards (PremaCotton/BreezePlus/CloudSoft/EcoLuxe with spec tags), YouTube video, Global Reach 3-column city grid. 8 real images deployed. |
| Contact (`/contact/`) | ✅ | Form + LINE/WhatsApp/Facebook + marketplace icons |
| Fabric Collections (`/fabric/`) | ✅ | 4-tab showcase + comparison table, content from `01_Fabric_Intelligence_Guide_V2.md` |
| Returns & Delivery (`/shipping/`) | ✅ | 30-day returns policy, shipping regions, carriers, customs note |
| Privacy Policy (`/policy/`) | ✅ | 14-section GDPR/CCPA-compliant with cookie inventory, breach notification, account deletion |
| Customer Reviews (`/reviews/`) | ✅ | 8 real Etsy reviews with mapped buyer names/countries + Etsy 5-star badge |
| Unsubscribe (`/unsubscribe/`) | ✅ | Email form + D1 deletion API + privacy-safe responses |
| Cookie Consent Banner | ✅ | GDPR banner + settings modal, conditional GA4 load (ID: G-0GWVSPJLVJ) |
| Size Guide Landing (`/sizeguide/`) | ✅ | 4-card landing page linking to specific guides |
| Thai Size Guide (`/mattress-size-th/`) | ✅ | #1 SEO page — Thai + international size tables |
| EN Size Guide (`/mattress-size/`) | ✅ | International size comparison tables |
| How to Measure (`/how-to-measure-mattress-size/`) | ✅ | Credit-card method with SVG diagram |
| Bed Sheet Sizes (`/bed-sheets-size/`) | ✅ | Pocket depth + duvet cover sizing |
| Product Listing (`/products/`) | ✅ | Filter bar + 6 product cards with placeholders |
| Primary category pages (`/sheets/`, `/duvet-covers/`, `/pillowcases/`, `/protection/`) | ✅ | Product-type grids |
| SEO landing pages (`/marine/`, `/family/`, `/pets/`, `/duvet/`, `/protection/`, `/rv-truck/`) | ✅ | Use-case landing pages with cross-links |
| Configurator JS (`/js/configurator.js`) | ✅ | Two-mode (Sheet + V-Berth), unit toggle cm/inch, live price, fabric selector |
| Cart JS (`/js/cart.js`) | ✅ | localStorage-based cart with add/remove/updateQty/clear |
| Geo JS (`/js/geo.js`) | ✅ | Detects location via `/api/geo`, updates price display |
| Products API Worker (`workers/api/products.ts`) | ✅ | D1 product listing + category filtering + search |
| Pricing API Worker (`workers/api/pricing.ts`) | ✅ | Calculates price for Sheet and V-Berth modes, USD + THB |
| Geo API Worker (`workers/api/geo-currency.ts`) | ✅ | CF-IPCountry detection, returns THB for Thailand |
| CSS updates (`main.css`) | ✅ | All homepage section styles, responsive rules, cards, tables |

### Placeholder Content (To Be Replaced Later)

| Item | Current State | How to Update |
|---|---|---|
| Hero background image | `Hero01.png` in use | Replace with `hero-bg.jpg` in `public/images/` if desired |
| Category images | ✅ Real photos placed | Done |
| Product photos | ✅ Top 5 real photos placed | Add more to `public/images/products/` matching slugs |
| Fabric images | ✅ 4 real fabric photos placed | Done |
| Pricing | Placeholder prices (base $45-65 USD) | Adjust in Admin dashboard (Phase 7) or edit `configurator.js` rates |
| Customer reviews | 2 real Etsy reviews + 4 placeholders | Replace placeholder text with real Etsy reviews |
| Blog | ✅ Blog index (`/blogs/`) + pagination page 2 (`/blogs/page/2/`) + post template + first real post (`/blogs/v-berth-sheets-vs-standard/`) — 17 posts across 2 pages — implemented 2026-05-16 | Done — use template to create new posts |

**BreezePlus Color Palette (9 swatches):**
| Color | Hex |
|---|---|
| Dark Grey | #4D545B |
| Silver | #B7BEC8 |
| Sand | #D9D1C1 |
| Sky | #9CCAE1 |
| Emerald | #618283 |
| Sea | #5A7DA2 |
| Pure White | #FFFFFF |
| Baby Pink | #E9B7BF |
| Ivory | #F1EFE1 |

**EcoLuxe Correction:** EcoLuxe is Calico / Greige cotton (natural unbleached, minimal processing). It is NOT GOTS-certified organic cotton.

### Additional Updates (2026-05-11 Session)

| Item | Status | Notes |
|---|---|---|
| `/api/subscribe` endpoint | ✅ Built | `workers/api/subscribe.ts` — email validation, D1 insert with `INSERT OR IGNORE` |
| Homepage EN email signup | ✅ AJAX wired | Inline success/error messages, loading states, no page reload |
| Homepage TH email signup | ✅ Fixed | "10%" → "15%", AJAX handler with Thai text |
| Image compression | ✅ Done | All 10 PNG photos → JPEGs (8.4MB → 624KB, 92.5% saved) |
| `discount_claims` migration | ✅ Created | `migrations/002_discount_claims.sql` — address-based 15% off tracking for Phase 5 |
| `wrangler.toml` | ✅ Fixed | Removed `[triggers]` and `[build]` (Pages-incompatible), removed `[[env.production]]` |
| SKILL.md | ✅ Updated | Added UX/UI Analysis, Copywriting, Strategic Guidelines sections |

### Next Step
Move to **Phase 5 — Checkout + Stripe Payments** when ready.

### Additional Updates (2026-05-14)

**Header consistency (blue-gradient CI Blue hero):**
- `/about/`, `/reviews/`, `/fabric/` — all updated from gray/page-hero to blue-gradient centered hero matching `/contact/` style
- Hero CSS: `linear-gradient(135deg, #2c96f4 0%, #1a7fd4 100%)` with white blueprint grid overlay

**Font system — bilingual EN/TH:**
- All 26+ HTML files: Google Fonts URL updated to include both Quicksand + Sarabun
- `main.css`: `:lang(th) { font-family: 'Sarabun', sans-serif; }` rule applied
- AGENTS.md and Framework.md updated with full font system documentation

**Full global footer restored:**
- `/how-to-measure-mattress-size/` — restored 4-col global footer (was copyright bar only)
- `/custom-measurement/` — restored 4-col global footer (was copyright bar only)

**Size guide — comprehensive revision across all 8 regions (JS-based interactive table):**

| Country | Changes |
|---|---|
| US/Canada | Family/Co-Sleep expanded (2xTwinXL through 2xKing — 6 sizes); Duvet corrected (68in widths, Twin XL added, Full/Queen/King/CalKing corrected); Pillow added Dakimakura (43x120cm) + Half (43x60cm) |
| UK | Family/Co-Sleep expanded (2xSmallDouble through 2xSuperKing — 4 sizes); EU-style brackets removed from standard mattress names; Pillow added Dakimakura + Half |
| EU | Standard mattress names cleaned (no brackets); Family/Co-Sleep expanded (6 combos: 2xDouble through 2xKing); Duvet corrected (Single 140x200, King 240x220, Super King 260x220); Pillow added Dakimakura + Half |
| Australia | Family/Co-Sleep expanded (7 combos including 2xDouble); Pillow added Dakimakura + Half |
| Thailand | 3FT added to Standard Mattress (90x198cm); Family/Co-Sleep expanded (8 sizes: 7FT–12FT with combined widths); Duvet column headers renamed (Bed Size / Duvet Cover Size); Duvet sizes corrected (3FT,3.5FT→70x90in, 5FT,6FT→90x100in, 7FT→110x100in, 9FT,9.5FT→125x100in); No Dakimakura (per user); removed Unified Directory kickers |
| Malaysia/SG | Standard added Single (91x190cm) alongside Super Single; Family/Co-Sleep expanded (6 combos); Duvet corrected (Single 150x210, Super King 260x230); Pillow added Dakimakura + Half |
| India | Standard Queen/King corrected to 60x75/72x75in; Family/Co-Sleep expanded (4 combos); Duvet corrected (150x200, 200x200, 240x220); Pillow added Dakimakura + Half |
| Japan | Family/Co-Sleep expanded (7 combos: 2xSemiDouble through 2xKing); Pillow added Dakimakura + Half |

### URL Structure & Redirects (2026-05-14)

**Redirect rules — add to `public/_redirects`:**

```
/mattress-size-th/*   /sizeguide/th/   301
/mattress-size/*      /sizeguide/      301
/bed-sheets-size/*    /sizeguide/      301
```

**Existing pages kept as-is:**
- `/sizeguide/` — English hub (all 8 regions, interactive tables)
- `/sizeguide/th/` — Thai-only size guide (all Thai UI, same size tables) ✅ existing
- `/how-to-measure-mattress-size/` — English measurement guide ✅ existing
- `/th/how-to-measure-mattress-size/` — Thai measurement guide ✅ existing

**Thai versions to build (2026-05-14):**
- `/about/th/` — Thai About Us page (all Thai text, same content structure as `/about/`)
- `/fabric/th/` — Thai Fabric Collections page (all Thai text)
- `/reviews/th/` — Thai Reviews page (all Thai text)

**Language toggle logic:** Header EN/TH toggle routes between `/th/` and non-`/th/` URL versions.

### Thai Pages Built (2026-05-14)
- `/th/about/index.html` — Thai About Us (all Thai UI, same content structure)
- `/th/fabric/index.html` — Thai Fabric Collections (all Thai UI, 4-tab fabric showcase)
- `/th/reviews/index.html` — Thai Reviews (all Thai UI, 7 real Etsy reviews)

---

### Thai Version — Missing Pages (2026-05-15)

After building 22 Thai pages, 10 EN pages remain without Thai equivalents. Priority below:

**Thai versions built (2026-05-15):**
| Page | EN | TH | Status |
|---|---|---|---|
| Homepage | `/` | `/th/` | ✅ Built |
| About Us | `/about/` | `/th/about/` | ✅ Built |
| Contact | `/contact/` | `/th/contact/` | ✅ Built |
| Fabric Collections | `/fabric/` | `/th/fabric/` | ✅ Built |
| FAQ | `/faq/` | `/th/faq/` | ✅ Built |
| Reviews | `/reviews/` | `/th/reviews/` | ✅ Built |
| Shipping Policy | `/shipping/` | `/th/shipping/` | ✅ Built |
| Privacy Policy | `/policy/` | `/th/policy/` | ✅ Built |
| Size Guide Hub | `/sizeguide/` | `/th/sizeguide/` | ✅ Built |
| How to Measure | `/how-to-measure-mattress-size/` | `/th/how-to-measure-mattress-size/` | ✅ Built |
| Custom Measurement | `/custom-measurement/` | `/th/custom-measurement/` | ✅ Built |
| Product Listing | `/products/` | `/th/products/` | ✅ Built |
| Sheets | `/sheets/` | `/th/sheets/` | ✅ Built |
| Flat Sheets | `/flat-sheets/` | `/th/flat-sheets/` | ❌ Deprecated — sheets now under `/sheets/` |
| Duvet Covers | `/duvet-covers/` | `/th/duvet-covers/` | ✅ Built |
| Pillowcases | `/pillowcases/` | `/th/pillowcases/` | ✅ Built |
| Protection | `/protection/` | `/th/protection/` | ✅ Built |
| Marine & Yacht | `/marine/` | `/th/marine/` | ✅ Built |
| Family & Co-Sleep | `/family/` | `/th/family/` | ✅ Built |
| Pet Owner | `/pets/` | `/th/pets/` | ✅ Built |
| Easy-Change Duvet | `/duvet/` | `/th/duvet/` | ✅ Built |
| Protection | `/protection/` | `/th/protection/` | ✅ Built |
| RV & Truck Cab | `/rv-truck/` | `/th/rv-truck/` | ✅ Built |

**Still missing — Thai versions not built:**
| Page | EN URL | Priority | Notes |
|---|---|---|---|
| ~~Bed Sheet Size Guide~~ | ~~`/bed-sheets-size/`~~ | — | **Redirects to `/sizeguide/`** (301) — no separate TH page needed |
| ~~Mattress Size (EN)~~ | ~~`/mattress-size/`~~ | — | **Redirects to `/sizeguide/`** (301) — no separate TH page needed |
| ~~Thai Mattress Sizes~~ | ~~`/mattress-size-th/`~~ | — | **Redirects to `/sizeguide/th/`** (301) — no separate TH page needed |
| ~~Pillow Protectors~~ | ~~`/pillow-protectors/`~~ | — | **Redirects to `/mattress-protectors/`** (301) — no separate TH page needed |
| Unsubscribe | `/unsubscribe/` | Low | User-specific; TH policy links to EN version ✅ |
| My Account | `/account/` | Low | Phase 5 gated; redirect logged-out users |
| Checkout | `/checkout/` | Low | Phase 5 payment flow; not SEO-critical |
| Order Confirmed | `/order-confirmed/` | Low | Phase 5 post-payment page |
| Blog Index | `/blogs/` | Low | Blog not built yet |

**WordPress redirects — no separate TH pages needed:**
The `_redirects` file handles ALL old WordPress URLs with 301 redirects to the new bilingual structure:
```
/bed-sheets-size/*   → /sizeguide/       (catches all /bed-sheets-size/sub-path)
/mattress-size/*     → /sizeguide/       (catches all /mattress-size/sub-path)
/mattress-size-th/* → /sizeguide/th/   (catches all /mattress-size-th/sub-path)
/pillow-protectors/* → /mattress-protectors/ (catches all /pillow-protectors/sub-path)
```
These wildcards redirect every old WordPress blog post, page, and sub-URL automatically. No separate TH versions needed.

**Language toggle — nav.js BILINGUAL_PAGES list (updated 2026-05-15):**
`['/', '/about/', '/contact/', '/faq/', '/fabric/', '/sizeguide/', '/reviews/', '/how-to-measure-mattress-size/', '/custom-measurement/', '/products/', '/sheets/', '/duvet-covers/', '/pillowcases/', '/protection/', '/accessories/', '/pets/', '/marine/', '/family/', '/deep-pocket/', '/boarding-dorm/', '/rv-truck/', '/shipping/', '/policy/']`

**Internal link fix (2026-05-15):** All 18 TH pages updated — nav links, footer links, hero CTAs changed from EN paths (`/products/`) to TH-prefixed paths (`/th/products/`). From any TH page, clicking nav links stays in TH. Lang toggle switches language correctly via BILINGUAL_PAGES lookup.

### Filtering System — Tag & Category Consistency (2026-05-18)

**Verified working pattern across all three components:**

1. **Product card tags** (`.card-tags` on category/niche listing pages like `/pets/`, `/family/`, `/sheets/`, etc.)
2. **Filter dropdown** (category selector in `/products/` shop page header)
3. **`data-categories` attribute** (on `.product-card` articles in `/products/`)

**How they connect:**
- All three components derive from the SAME `data-categories` attribute on each product card article in `/products/index.html`.
- Tags on category/niche pages are filtered chips — each chip displays a slug from `data-categories` as uppercase text.
- The filter dropdown in `/products/` filters the `/products/` grid via JavaScript matching against `data-categories`.
- A product appears on a category listing page (`/sheets/`, `/pets/`, etc.) when that page's niche slug is present in the product's `data-categories` list.

**Valid tag/category slugs (lowercase, hyphenated):**
`sheets`, `duvet-covers`, `pillowcases`, `protection`, `accessories`, `family`, `pets`, `marine`, `rv-truck`, `boarding-dorm`, `deep-pocket`, `duvet`

**`data-categories` format:**
`data-categories="sheets,marine,pets"` — comma-separated slugs, no spaces, first slug = primary type.

**Tag display rules per context (verified 2026-05-18):**
| Page | Tags shown |
|---|---|
| Primary type listing (`/sheets/`, `/duvet-covers/`, etc.) | Product type tag + cross-link niche tags |
| Niche landing (`/family/`, `/pets/`, `/marine/`, etc.) | Page's own niche tag + any product type tags |
| `/products/` shop page | All tags matching the card's `data-categories` |

**Example — 3-Sided Zipper Duvet Cover:**
- `data-categories="duvet-covers,pets,family"` → appears on `/duvet-covers/`, `/pets/`, `/family/`
- On `/duvet-covers/`: shows `DUVET-COVERS` + `FAMILY` + `PETS` chips
- On `/pets/`: shows `DUVET-COVERS` + `FAMILY` + `PETS` chips (product is listed here because `pets` matches)
- On `/products/`: dropdown filters by matching `data-categories` values

**All three components must stay in sync:** If a product is added to `/marine/`, its `data-categories` in `/products/index.html` must include `marine`.

---

## Product Catalog System — JSON-Based Build System (2026-05-18)

### Single Source of Truth: `data/products.json`

All 27 products are defined in **`data/products.json`** — a JSON file that drives every storefront page.

**Why JSON instead of D1 for catalog data:**
- Static HTML pages load instantly (no Worker API call on page load)
- Regeneration is deterministic and auditable
- D1 `products` table exists separately for Phase 5+ order processing
- Admin dashboard (Phase 7) will read/write the JSON file

### Files

| File | Purpose |
|---|---|
| `data/products.json` | **Master product data** — 27 products with slugs, names, prices, categories, images |
| `data/templates.json` | HTML card templates |
| `scripts/build-products.js` | Full page generator (initial build) |
| `scripts/regenerate-products.js` | Incremental updater (run after any JSON change) |
| `data/HOW_TO_USE.md` | Full documentation for the system |

### Regenerating All Pages

```bash
node scripts/regenerate-products.js
```

This updates 23 pages with consistent card tags, `data-categories`, and filter counts — all derived from the JSON `categories[]` array.

### `data/products.json` Structure

```json
{
  "products": [
    {
      "slug": "family-fitted-sheet",
      "name": "Family Fitted Sheet",
      "nameTh": "ผ้าปูครอบครัว Co-Sleep",
      "categories": ["sheets", "family"],
      "priceUsd": 45,
      "priceThb": 1590,
      "image": "/images/products/family-fitted-sheet/main.jpg",
      "url": "/product/family-fitted-sheet/",
      "urlTh": "/th/product/family-fitted-sheet/"
    }
  ]
}
```

**`categories[]` drives everything:**
1. `data-categories` attribute on `/products/` cards
2. Card tags (primary type tag first, niche tags second)
3. Which niche pages the card appears on
4. Filter dropdown counts in the consistency check output

### Tag Rules (verified 2026-05-18)

| Page | Tags shown |
|---|---|
| `/products/` shop | All tags from `categories[]` — e.g., `PILLOWCASES` + all niche tags |
| `/pillowcases/` | `PILLOWCASES` only (no niche tags, no DUVET) |
| `/sheets/` | `SHEETS` + niche tags |
| `/duvet-covers/` | `DUVET-COVERS` + niche tags |
| Niche page (`/marine/`, `/family/`, etc.) | Primary type tag + that niche's tag |
| **No DUVET tag** on pillowcase cards | DUVET = Duvet Cover product type only |

### Filter Consistency Check

The regenerator outputs this after every run:

```
sheets         → 9 products
duvet-covers   → 6 products
pillowcases    → 3 products
protection     → 7 products
accessories    → 2 products
marine         → 7 products
family         → 8 products
pets           → 8 products
deep-pocket    → 7 products
boarding-dorm  → 6 products
rv-truck       → 8 products
```

This confirms all three components (card tags, filter dropdown, `data-categories`) stay in sync.

### Adding a New Product

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
  "urlTh": "/th/product/my-new-product/"
}
```

**Step 2:** Add image at `public/images/products/my-new-product/main.jpg`

**Step 3:** Run:
```bash
node scripts/regenerate-products.js
```

**Result:** Automatically updates:
- `/products/` → card with `data-categories="sheets,marine,family"` + tags `SHEETS` `MARINE` `FAMILY`
- `/marine/` → card with tags `SHEETS` `MARINE`
- `/family/` → card with tags `SHEETS` `FAMILY`
- `/sheets/` → card with tags `SHEETS` `MARINE` `FAMILY`
- Filter counts updated in consistency check

### Product Dashboard (Phase 7 — Future)

The admin dashboard will include a **Product Catalog Editor** that reads/writes `data/products.json`:

| Field | Input Type |
|---|---|
| Title EN + TH | Text inputs |
| Description EN + TH | Textarea |
| Product Type tag | Dropdown (from `types` in JSON) |
| Niche tags | Multi-select dropdown (from `niches` in JSON) |
| Images (up to 10) | Drag & drop → R2 CDN |
| Video | URL input (optional) |
| Prices | Size × Fabric matrix |
| Slug | Auto-generated from title, editable |
| Status | Active / Draft toggle |

The dashboard will regenerate `data/products.json` on save and run `scripts/regenerate-products.js` automatically.

### D1 `products` Table — No Schema Change Needed

The existing D1 `products` table (from Phase 1) stores **catalog metadata for the admin dashboard and Phase 5+ features**. It is NOT the source of truth for storefront pages.

| Table | Purpose | Updated By |
|---|---|---|
| D1 `products` | Admin CRUD, Phase 5+ order processing | Phase 7 Admin Dashboard |
| `data/products.json` | All storefront catalog pages | `scripts/regenerate-products.js` |

### Additional Updates (2026-05-20)

| Item | Status | Notes |
|---|---|---|
| Product inventory verified | ✅ | 27 products confirmed across 5 categories (Sheets:9, Duvet Covers:6, Pillowcases:3, Protection:7, Accessories:2). All 28 product directories and 5 category pages cross-referenced. |
| Fitted sheet pricing formula | ✅ Implemented | Real formula in `workers/api/pricing.ts` for 4 products (Standard, Deep Pocket, Dorm, RV & Truck). Fabric dimensions: W_fabric=W+2D+14, L_fabric=L+2D+14. Area-based fabric cost with 20% waste: CloudSoft 100 THB/yd, others 180 THB/yd. Tiered sewing: 120–500 THB by area. Markups: +15% Op, +20% Mkt, +30% Margin (45% for RV/Truck). Round to 100 THB. USD ÷ 30. Max W=220cm (above → Family/Co-Sleep). |
| Flat sheet pricing formula | ✅ Implemented | Real formula for 2 products (Standard, Extra Deep Pocket). Fabric: W_fabric=W+2D+50, L_fabric=L+2D+50 (25cm tuck/sewing each side). Flat sewing 250 THB (no elastic). Same fabric cost and markups as fitted (15/20/30%). |
| Encasement pricing formula | ✅ Implemented | Real formula for 2 products (6-Sided General, RV & Truck). 6-sided surface area: 2(W×L + W×D + L×D). TPU fabric: 120 THB/linear metre (210cm bolt) ÷ 21,000 cm² ×1.20 waste. Sewing 300 THB flat. Zipper 0.4 THB/cm × (2L+W). Markups: 15% Op + 25% Mkt + 50% Margin. |
| Product page configurators | ✅ Built (23/27 products) | `public/js/product-configurator.js` — shared configurator on 23 product detail pages. Auto-detects product type from URL path. 6 formula types: fitted sheet, flat sheet, encasement (TPU), duvet cover, pillowcase, pillow protector (TPU), mattress protector (3-layer). Standard size dropdown → parse W×L×D → formula. Custom W×L×D → formula. Unit toggle (cm/inch). Full quote popup flow: [Custom Size] → [Custom Quote] → modal form → POST `/api/quote` → Resend email. Centralized product template system (2 templates + build script) regenerates all 27 pages from source. Fabric specs grids replace dropdowns for locked-fabric products. Per-fabric color selector (4 color sets, 6-col grid). Responsive carousel dots on reviews + related products. |
| Product detail pages enhanced | ✅ | Centralized template system (2 templates, build script, 1667-line content JSON). All 27 product pages regenerated from templates with consistent UI. `standard-fitted-sheet` through `mattress-lift-helper`: full configurator with auto-detection. Fabric specs grids for locked-fabric products (BreezePlus: pet-owner, CloudSoft: marine/RV, TPU: encasements/protectors, 3-layer: mattress protectors). Per-fabric color selector with 6-col grid. Responsive carousel dots on reviews + related. Region-aware size formatting (US imperial, others metric). UI simplifications: region grid removed, Apple Pay removed, star ratings removed. |
| 1 product awaits configurator | ⏸️ Pending | Marine Fitted Sheet (V-Berth) — currently uses legacy placeholder pricing. |
| 3 products skip configurator | ✅ Verified | BedBridge Connector + Bed Lifter (fixed-price accessories) + Duvet Insert (Thai-only, fixed standard sizes, Microfiber 200g/m² fill). |
| Hybrid pricing architecture designed | ✅ Documented | Future: D1 `standard_prices` table for admin-controlled standard-size pricing. Standard sizes → API D1 lookup. Custom dimensions → live formula. Implementation deferred until all 27 formulas ready. Design documented in `pricing.ts` header comment + Framework.md. |
| USD-only pricing (EN pages) | ✅ Implemented | EN product pages show `$XX.XX` only. TH pages (when built) show THB only. Detected via URL path `/th/` prefix. |
| Custom quote popup flow | ✅ Implemented | "Custom Quote" button (renamed from "Submit for Custom Quote →") → modal popup: Name*, Email*, Address, Telephone → [Submit] → POST `/api/quote` → D1 `custom_quotes` + `subscribers` dedup → Resend email to contact@mildmate.com → confirmation popup (dimensions, fabric, quote ID). Dimensions validation blocks submission if W×L×D not entered. |
| Quote API worker | ✅ Created | `workers/api/quote.ts` — validates, generates QT-YYMMDD-NNN ID, inserts to D1 + rate_limits, fire-and-forget Resend notification with quoted_price |
| Custom quotes D1 table | ✅ Created | `migrations/003_quote_fields.sql` — `custom_quotes` table: quote_id, customer_name, email, address, telephone, product_slug, dimensions (JSON), fabric, color, status, quoted_price |
| Anti-spam: honeypot + rate limit | ✅ Implemented | Hidden `_website` field catches bots; D1 `rate_limits` table enforces IP limits: quote 3/hr, subscribe 5/hr. Applied to `quote.ts`, `subscribe.ts`, quote popup, homepage subscribe, blog newsletter. |
| MailChannels → Resend migration | ✅ Complete | MailChannels sunset Aug 2024 — migrated to Resend (free: 100/day). Shared `workers/api/email.ts` helper. `RESEND_API_KEY` secret required. Both quote and contact forms migrated. |
| Pages Functions for local dev | ✅ Created | `functions/api/[[path]].ts` — catch-all router bridging Pages Functions to Worker handlers. Enables local API testing with `wrangler pages dev`. |
| Rate limits D1 table | ✅ Created | `migrations/004_rate_limits.sql` — `rate_limits` table (ip_address, endpoint, created_at) |
| AGENTS.md + Framework.md updated | ✅ | 27-product table, configurator pricing status (23 live / 2 skip / 2 pending), all 7 formula types documented, fabric specs grids, per-fabric color selector, centralized template system, UI removals documented |

No D1 schema change is needed. The JSON file is the build-time source; D1 is the runtime/order database.

---

### Additional Updates (2026-05-18)

**JSON-driven product catalog system:**
- `data/products.json` — 27 products defined as single source of truth
- `scripts/regenerate-products.js` — regenerates 23 catalog pages (EN + TH type/niche listings)
- All product cards use clickable `<a>` tag links for tags — links to type and niche listing pages
- Type pages show only primary type tag (no niche tags); niche pages show primary type + current niche
- Price display changed from `$XX` to `USD XX` across all pages

**Global reach updates:**
- About page Global Reach section updated with real customer cities: North America (Alaska, Florida, Arizona, Alberta, Vancouver), Europe (London, Highland Council, Berlin, Dubai, Amsterdam), Asia-Pacific (Seoul added)

**Performance optimizations:**
- WebP images generated for hero, logo, and all 11 category thumbnails (avg 42% size reduction, logo 87% reduction)
- Hero + category images use `<picture>` with WebP source + JPG fallback
- Logo WebP across all 107 HTML pages
- `main.css` minified → `main.min.css` (55KB → 39.7KB, -28%)
- 16.6KB critical CSS inlined in `<head>` across all pages
- Non-critical CSS deferred via `<link rel="preload" onload="this.rel='stylesheet'">` pattern
- `nav.js` scroll handler: rAF throttling to eliminate forced DOM reflows (was 2,183ms)
- `reviews-carousel.js` scroll handler: rAF throttling
- `scripts/convert-webp.js` — reusable WebP conversion script
