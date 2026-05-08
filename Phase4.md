# Phase 4 — Homepage + Product Pages
**Goal:** Build all real content pages — the homepage with every section filled, the product listing grid, individual product detail pages with the live price configurator, and the size guide SEO hub pages.

**End Result:** A fully functional shopping experience. Visitors can land on the homepage, browse products by category, enter their mattress dimensions, and see a live price update — all before Phase 5 adds the actual payment step.

**Time Estimate:** 60–90 minutes (you provide content decisions + images; Droid builds everything)

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
- [ ] Footer with LINE widget appears at the bottom of the page

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
| Protection | `category-protection.jpg` | `public/images/categories/` | Waterproof protector or pet on bed |

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

### Requirement 8 — Size Guide Table Data

The `/mattress-size-th/` and `/mattress-size/` pages need accurate mattress size tables. Droid will use standard industry sizes — confirm you are happy with these defaults or provide corrections.

**Standard sizes Droid will use:**

| Size Name (EN) | Size Name (TH) | Width × Length (cm) |
|---|---|---|
| Single / Twin | 3.5 ฟุต | 100 × 200 |
| Double | 4 ฟุต | 120 × 200 |
| Queen | 5 ฟุต | 150 × 200 |
| King | 6 ฟุต | 180 × 200 |
| Super King | 7 ฟุต | 200 × 200 |
| IKEA Single | — | 90 × 200 |
| US Twin | — | 97 × 191 |
| US Queen | — | 152 × 203 |
| US King | — | 193 × 203 |
| UK Double | — | 135 × 190 |
| UK King | — | 150 × 200 |
| AU Queen | — | 153 × 203 |
| AU King | — | 183 × 203 |

**Confirm:** "These standard sizes are correct" — OR — provide any corrections.

---

### Requirement 9 — Custom Configurator Modes

The configurator must support two product types selectable by tab. Confirm the specification below is correct before Droid builds.

**Mode A — Fitted Bed Sheet:**
| Input | Label shown | Notes |
|---|---|---|
| Width | Width (W) | Mattress width |
| Length | Length (L) | Mattress length |
| Depth | Depth (D) | Pocket height (mattress thickness) |

**Mode B — V-Berth Boat Sheet:**
| Input | Label shown | Notes |
|---|---|---|
| Head Width | Head Width (Bow) | Narrow end at the front of the boat |
| Foot Width | Foot Width (Cabin) | Wide end at the cabin entry |
| Length | Length (L) | Bow to stern along the center line |
| Depth | Depth (D) | Mattress thickness for the elastic pocket |

**Pricing formula for V-Berth:** `((Head Width + Foot Width) / 2) × Length` = trapezoid area × fabric rate per cm²

**Shared features for both modes:**
- Unit toggle: **cm / inch** (converts all inputs in place)
- Fabric selector: BreezePlus | CloudSoft | PremaCotton | EcoLuxe
- SVG measurement diagram shown beside the inputs
- Live price updates as inputs change
- Price note on every display: *"Price excludes shipping & import tariff"*

**Confirm:** "Yes, both modes and specs are correct" — OR — list any changes.

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

**10E — Customer Reviews (`/reviews/`)**
Supplement your Phase 4 Requirement 6 (Etsy reviews) with:
- [ ] 6–10 total reviews (more than the 2–3 on the homepage)
- [ ] At least 1 review mentioning V-Berth / boat bedding
- [ ] At least 1 review mentioning the 3-sided zipper duvet
- [ ] Overall rating and total review count from Etsy

---

### Requirement 11 — Blog Template Setup

Blog posts are static HTML files written manually. Droid builds the **templates and index structure** — you fill in content later.

**What Droid builds for blog:**
- Blog index page (`/blogs/index.html`) with the 6 card layout + filter bar + pagination
- One sample blog post HTML file as a template (copy-paste to create each new post)
- Pagination structure (`/blogs/page/2/` etc.) as static pages initially

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
| `public/shipping/index.html` | Shipping Policy — regions, rates, transit times |
| `public/policy/index.html` | Privacy Policy — GDPR-compatible |
| `public/reviews/index.html` | Customer Reviews — grid + Etsy badge |

### Blog Pages (static HTML templates)
| Page / File | What It Is |
|---|---|
| `public/blogs/index.html` | Blog index page 1 — 20 posts, filter bar, pagination |
| `public/blogs/[slug]/index.html` | Blog post template — applied to each article |

### Product & SEO Pages
| Page / File | What It Is |
|---|---|
| `public/products/index.html` | Full product listing with filter bar (data from D1) |
| `public/marine/index.html` | Marine & Yacht category page (dynamic from D1) |
| `public/family/index.html` | Family & Co-Sleep category page (dynamic from D1) |
| `public/duvet/index.html` | Easy-Change Duvet category page (dynamic from D1) |
| `public/protection/index.html` | Protection category page (dynamic from D1) |
| `public/product/[slug]/index.html` | 83 individual product detail pages |
| `public/mattress-size-th/index.html` | #1 SEO page — fully built with size tables |
| `public/mattress-size/index.html` | EN size guide page |
| `public/how-to-measure-mattress-size/index.html` | Measurement guide with credit card diagram |
| `public/bed-sheets-size/index.html` | Bed sheet size guide |

### Backend Workers
| File | What It Is |
|---|---|
| `workers/api/products.ts` | Serves product data + category filtering from D1 |
| `workers/api/pricing.ts` | Calculates price for Fitted Bed Sheet AND V-Berth modes |
| `workers/api/geo-currency.ts` | Detects Thai visitors, returns THB prices |
| `public/js/configurator.js` | Frontend: two-mode live price calculator (Bed Sheet + V-Berth) |
| `public/js/cart.js` | Frontend: add to cart, localStorage (stores sheet_type + dimensions) |
| `public/js/geo.js` | Frontend: currency display toggle |

---

## Homepage Sections (What You Will See)

Phase 4 builds the homepage in 8 sections from top to bottom:

```
1. HERO           — Big headline + CTA buttons + lifestyle background image
2. TRUST BAR      — 4 certification/trust icons in a row
3. SHOP BY NICHE  — 4 category cards with images
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
> Build the homepage (EN + TH), all new static pages (About, Contact, Fabric Collections, Shipping Policy, Privacy Policy, Customer Reviews), blog index + 3 sample posts, product listing + 4 category pages (dynamic from D1), all 83 product detail pages, the 4 size guide pages, and all backend Workers (products API, pricing API with both modes, geo-currency API)."

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
| 4 cards visible | Marine, Family, Duvet, Protection |
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
- [ ] Phase 3 confirmed complete (header/footer visible on all pages)
- [ ] Hero image ready at `public/images/hero-bg.jpg` OR placeholder option decided
- [ ] Category images placed OR missing ones noted for Droid placeholder
- [ ] Top 10 priority product images placed in `public/images/products/`
- [ ] Pricing table filled in for all 9 product categories
- [ ] 2–3 customer reviews copied from Etsy with reviewer name + country
- [ ] Fabric content source confirmed (`01_Fabric_Intelligence_Guide_V2.md`)
- [ ] Mattress size table confirmed (standard sizes or your corrections)
- [ ] Configurator spec confirmed (Requirement 9 — both modes)
- [ ] Contact page channel URLs collected (LINE, WhatsApp, Facebook + all marketplace links)
- [ ] About Us story written (2–3 paragraphs)
- [ ] Shipping Policy content written (regions, rates, transit times)
- [ ] Customer Reviews content prepared (6–10 reviews)
- [ ] Blog content for 3 sample posts prepared (titles, categories, excerpts, body drafts)

**Build Steps:**
- [ ] Homepage loads with all 8 sections visible and correctly styled
- [ ] Hero headline reads: "Bedding Made Easy Again: Custom Sizes, Perfect Fits."
- [ ] Trust bar shows all 4 icons
- [ ] 4 category cards visible with images (or placeholders)
- [ ] Top 5 products show with prices
- [ ] Configurator shows two tabs: "🛏 Fitted Bed Sheet" and "⚓ V-Berth Boat Sheet"
- [ ] Fitted Bed Sheet tab shows Width / Length / Depth inputs
- [ ] V-Berth tab shows Head Width / Foot Width / Length / Depth inputs
- [ ] cm/inch unit toggle converts all values
- [ ] Measurement diagram switches when tab is changed
- [ ] Price updates instantly when dimensions are entered
- [ ] Price note "Excludes shipping & import tariff" visible
- [ ] Fabric tabs all work (click each — panel changes)
- [ ] At least 2 customer reviews visible in Social Proof section
- [ ] Email signup form visible in section 8
- [ ] About Us page (`/about/`) loads with company story
- [ ] Contact page (`/contact/`) shows form + LINE/WhatsApp/Facebook links + marketplace icons
- [ ] Fabric Collections page (`/fabric/`) shows 4 fabric tabs
- [ ] Shipping Policy page (`/shipping/`) loads with content
- [ ] Customer Reviews page (`/reviews/`) shows review grid
- [ ] Blog index (`/blogs/`) shows 3 sample posts with thumbnails + pagination
- [ ] Product listing page (`/products/`) shows product grid (data from D1)
- [ ] Category pages (`/marine/`, `/family/`, `/duvet/`, `/protection/`) show filtered grid
- [ ] Filter bar on product listing works
- [ ] Product detail page shows two-mode configurator with live price update
- [ ] "Measure My Mattress" collapsible section opens and closes
- [ ] Product detail tabs work (Description, Fabric Details, Size Guide, Care)
- [ ] "Add to Cart" saves item (with sheet_type + all dimensions) and updates header icon count
- [ ] Cart persists after browser refresh
- [ ] `/mattress-size-th/` page loads with size comparison table
- [ ] All pages still have header and footer from Phase 3
- [ ] Pages look correct on mobile (resize browser to narrow)

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
