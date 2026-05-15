# MildMate Web Rebuild — Full Framework Plan

## Stack Confirmed
- **Frontend:** Vanilla HTML + CSS + minimal JS
- **Backend:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 + Storage R2
- **Deploy:** `mildmate-new.pages.dev` → cutover to `www.mildmate.com` when 100% done
- **Email:** MailChannels (free, built into Workers — no signup needed)
- **Payments:** Stripe (USD + PromptPay THB natively)
- **Admin auth:** Cloudflare Access (Google login)

---

## Frontend Design System

### Brand Tokens (CSS Variables)
```css
--color-primary: #2c96f4;       /* CI Blue */
--color-primary-dark: #1a7fd4;
--color-text: #333333;
--color-bg: #ffffff;
--color-surface: #f8f9fa;
--color-border: #e5e7eb;
--font-main: 'Quicksand', sans-serif;
--radius: 8px;
--shadow: 0 2px 12px rgba(0,0,0,0.08);
```

### Typography Scale
| Element | Size | Weight |
|---|---|---|
| H1 (Hero) | 2.5rem | 700 |
| H2 (Section) | 1.75rem | 700 |
| H3 (Card title) | 1.25rem | 600 |
| Body | 1rem | 400 |
| Small/Caption | 0.875rem | 400 |

**Font pairing (bilingual):** Quicksand (EN) + Sarabun (TH) — loaded together via Google Fonts, CSS `:lang(th)` applies Sarabun automatically.

---

## Complete Site Pages Overview

### Static Pages (manually authored HTML)
| Page | URL | Notes |
|---|---|---|
| Homepage EN | `/` | 8 sections, full content |
| Homepage TH | `/th/` | Thai language version |
| About Us | `/about/` | Company story, certifications |
| Contact | `/contact/` | Form + multi-channel links |
| Fabric Collections | `/fabric/` | 4 fabric tabs, expanded detail |
| Size Guide | `/sizeguide/` | Unified country-first mattress size selector |
| Size Guide TH (#1 SEO) | `/mattress-size-th/` | Thai SEO hub — preserved with country tabs |
| How to Measure | `/how-to-measure-mattress-size/` | Credit card method diagram |
| Bed Sheet Size | `/bed-sheets-size/` | Sheet sizing guide |
| Shipping Policy | `/shipping/` | Rates, regions, transit times |
| Privacy Policy | `/policy/` | GDPR-compatible policy |
| Customer Reviews | `/reviews/` | Curated reviews + rating badge |
| Checkout | `/checkout/` | 3-step guest checkout (guest or logged-in) |
| Order Confirmed | `/order-confirmed/` | Post-payment confirmation |
| My Account | `/account/` | Order history, saved addresses, social login |
| All 258 WordPress URLs | various | Preserved from Phase 2 |

### Blog Pages (static HTML, managed manually)
| Page | URL | Notes |
|---|---|---|
| Blog Index | `/blogs/` | 20 posts per page, paginated |
| Blog Index Page 2+ | `/blogs/page/2/` etc. | Pagination pages |
| Individual Blog Post | `/blogs/[post-slug]/` | One file per article |

### Dynamic Pages (data from Cloudflare D1)
| Page | URL | Notes |
|---|---|---|
| **Primary Product Type Categories** | | |
| Fitted Sheets | `/fitted-sheets/` | All fitted sheet variants — standard, marine, family, pet, adjustable |
| Flat Sheets | `/flat-sheets/` | Standard + Extra Deep Pocket (20") |
| Duvet Covers | `/duvet-covers/` | 3-Sided Zipper + Pet Owner variants |
| Pillowcases | `/pillowcases/` | Envelope, Zipper, Sham styles |
| Mattress Protectors | `/mattress-protectors/` | Encasements + Pillow Protectors |
| **SEO Landing Pages (Use Case)** | | |
| Marine & Yacht | `/marine/` | Marine bedding — links to fitted-sheets |
| Family & Co-Sleep | `/family/` | Co-sleeping solutions — links to fitted-sheets |
| Easy-Change Duvet | `/duvet/` | Duvet landing — links to duvet-covers |
| Protection | `/protection/` | Waterproof line — links to mattress-protectors |
| Pet Owner Bedding | `/pets/` | **NEW** BreezePlus anti-fur — links to fitted-sheets + duvet-covers |
| RV & Truck Cab | `/rv-truck/` | **NEW** RV, van, truck cab — 6-Sided Encasement + Marine Fitted Sheet |
| All Products | `/products/` | Full product listing with filter bar |
| Product Detail | `/product/[slug]/` | 15 product pages (expandable to 83), configurator |

### Admin Pages (Google login required)
| Page | URL | Notes |
|---|---|---|
| Admin Dashboard | `/admin/` | Summary cards |
| Orders | `/admin/orders.html` | Manufacturing view |
| Products | `/admin/products.html` | CRUD product catalog |
| Image Uploader | `/admin/upload.html` | Drag & drop → R2 |
| Subscribers | `/admin/subscribers.html` | Email list + CSV export |

---

## Site Layout Blueprint

### Header (Sticky)

**Desktop (≥1025px):**
```
┌────────────────────────────────────────────────────────────┐
│ [Logo 64px]   [Home] [Shop] [Fabrics] [Size Guide]   [🔍][👤][🛒][EN/TH] │
└────────────────────────────────────────────────────────────┘
```
- Logo left, nav center, actions right
- Sticky on scroll (shrinks from 80px → 60px)
- Nav text: 1.2rem, weight 600, Quicksand
- Actions: Search → Account → Cart → EN/TH
- Icons: 20px inline SVGs, blue hover

**Mobile (≤1024px):**
```
┌──────────────────────────────────────────┐
│ [☰]        [   Logo (centered)   ]   [🔍][👤][🛒][EN/TH] │
└──────────────────────────────────────────┘
```
- Hamburger far left, logo centered, actions right
- Nav hidden — replaced by hamburger drawer
- Icons: 18px default, 16px on ≤480px
- Drawer slides in from **left**

### Navigation Menu
```
Home | Shop | Fabrics | Size Guide
```

**Simplified nav (no dropdowns in current build):**
```
┌─────────────────────────────────────────────────┐
│ Marine & Yacht    │ Family & Co-Sleep            │
│ • V-Berth Sheets  │ • Family Fitted Sheets       │
│ • Marine Pillows  │ • BedBridge Connector        │
│ • Boat Duvets     │ • Co-Sleep Duvets            │
├───────────────────┼──────────────────────────────┤
│ Easy-Change Duvet │ Protection                   │
│ • 3-Sided Zipper  │ • TPU Waterproof             │
│ • Dorm/College    │ • Pet-Proof Sheets           │
│ • Weighted Cover  │ • Mattress Encasement        │
└─────────────────────────────────────────────────┘
```

**Fabrics Dropdown:**
```
BreezePlus | CloudSoft | PremaCotton | EcoLuxe
```

---

## Custom Configurator Specification

The configurator appears in two places: the **Homepage** (conversion preview) and every **Product Detail page** (full purchase flow). It has two modes selectable by tab.

### Mode A — Fitted Bed Sheet (rectangular)
| Input | Label | Unit Toggle |
|---|---|---|
| Width | W | cm / inch |
| Length | L | cm / inch |
| Depth | D (pocket height) | cm / inch |

### Mode B — V-Berth Boat Sheet (trapezoidal)
| Input | Label | Description | Unit Toggle |
|---|---|---|---|
| Head Width | Head | Narrow end (bow) | cm / inch |
| Foot Width | Foot | Wide end (cabin entry) | cm / inch |
| Length | L | Bow to stern (center line) | cm / inch |
| Depth | D | Mattress thickness | cm / inch |

**V-Berth pricing formula:** `((Head + Foot) / 2) × Length` = trapezoid area → × fabric rate per cm²

### Shared Configurator Features
- **Unit toggle:** cm / inch switch (converts values in place)
- **Fabric selector:** 4 options (BreezePlus, CloudSoft, PremaCotton, EcoLuxe)
- **Live price display:** Updates automatically as inputs change
- **Pricing note on all displays:** *"Price excludes shipping & import tariff"*
- **Measurement diagram:** Labeled SVG diagram shown beside inputs (rectangle for bed sheet, trapezoid for V-Berth)

---

## Custom Quote-to-Cart Workflow (Custom Sizes)

For non-standard sizes (marine V-berths, truck cabs, family co-sleep, RVs), customers cannot add directly to cart. Instead they submit a quote request, you manually price it, and they add the locked price via a magic link.

### Step-by-Step Flow

```
Customer on Product Page (Custom Configurator)
       ↓
Enters dimensions + selects fabric + extras
       ↓
Clicks "Submit for Custom Quote"
       ↓
POST /api/quote  →  D1 custom_quotes table (status='pending')
                     + MailChannels email to admin
       ↓
Customer sees: "Quote submitted. We'll reply within 24 hours."
       ↓
ADMIN: Review in dashboard → set quoted_price → approve
       ↓
Customer receives email: "Your quote QT-250512-001 is ready — $89.00"
       ↓
Magic link: /quote/QT-250512-001
       ↓
Customer opens link → sees locked quote with "Add to Cart — $89.00"
       ↓
Quote item added to cart with type='custom_quote', price frozen
       ↓
Standard checkout (Phase 5 Stripe flow)
       ↓
Order stored with quote_id reference + full dimensions
```

### Quote Item in Cart JSON
```json
{
  "type": "custom_quote",
  "quote_id": "QT-250512-001",
  "product_name": "Custom Marine Fitted Sheet",
  "dimensions": {"w":183,"l":198,"h":12,"unit":"cm"},
  "fabric": "PremaCotton",
  "color": "Sea",
  "extras": ["embroidery_name"],
  "locked_price": 8900,
  "currency": "USD"
}
```

### Admin Quote Management
| Field | Admin Action |
|---|---|
| `status` | pending → approved / rejected / expired |
| `quoted_price` | Admin enters price in cents (e.g., 8900 = $89.00) |
| `expires_at` | Auto-set to 7 days from creation; admin can extend |

---

## Blog Template Specifications

### Image Sizes — Quick Reference
| Image | Used Where | Required Size | Format | Max Size |
|---|---|---|---|---|
| Hero / Banner | Top of blog post | 1200 × 500 px (2.4:1) | JPG/WebP | 400 KB |
| Card Thumbnail | Blog index cards + Related posts | 800 × 534 px (3:2) | JPG/WebP | 200 KB |
| Inline Post Image | Inside article body | 1200 × 675 px (16:9) | JPG/WebP | 300 KB |
| Author Avatar | Bio box + post meta | 160 × 160 px (1:1) | JPG/WebP | 50 KB |

### Blog Index Layout
- 3-column grid desktop, 2-column tablet, 1-column mobile
- 20 posts per page
- Pagination: First ← | Prev | 1 2 3 … N | Next | Last →
- Category filter bar: All · Marine & Yacht · Family Bedding · Care Tips · Size Guides · News
- Each card: Thumbnail (800×534) + Category tag + Title + Excerpt (3 lines) + Date + Read Time

### Blog Post Layout
- Breadcrumb: Home › Blog › Category › Title
- Hero banner (1200×500) — full width
- Two-column: Article body (left) + Sidebar (right)
- Sidebar: Recent Posts + Categories + CTA widget (configure your sheet)
- Related Posts: 3 cards at bottom (reuse card thumbnail)
- Post navigation: ← Previous Post | Next Post →

### Per-Post Content Required
| Field | Required | Spec |
|---|---|---|
| Title | Yes | Max 100 characters (under 60 for SEO) |
| Hero / Banner Image | Yes | 1200 × 500 px |
| Card Thumbnail | Yes | 800 × 534 px (reused for index, related posts) |
| Category | Yes | One of the 5 category options |
| Excerpt / Meta description | Yes | 120–160 characters |
| Body Content | Yes | Min 400 words, supports H2, p, ul, blockquote |
| Publish Date | Yes | YYYY-MM-DD |
| URL Slug | Yes | /blogs/[lowercase-hyphenated-english]/ |
| Inline Images | Optional | 1200 × 675 px, max 3 per post |
| Tags | Optional | 3–6 short keywords |
| Author Name | Optional | Default: "MildMate Team" |

---

## Page-by-Page Layout

### 1. Homepage (`/index.html`)

```
[HERO]
  Headline: "Bedding Made Easy Again: Custom Sizes, Perfect Fits."
  Sub: Brand CI Blue strip with 3 value props
  CTA: "Shop Custom Bedding" + "Measure My Mattress"
  Background: lifestyle image (boat/family bed)

[TRUST BAR]  ← single row, 4 icons
  OEKO-TEX Certified | Siriraj Dust-Mite Certified | 5★ Reviews | Ships Worldwide

[SHOP BY NICHE]  ← 4 cards, image + label
  Marine & Yacht | Family Co-Sleep | Easy-Change Duvet | Protection

[TOP PRODUCTS]  ← horizontal scroll on mobile, 3-col grid desktop
  Based on Etsy top 5 performers

[CUSTOM CONFIGURATOR PREVIEW]  ← conversion focus
  Tab: [🛏 Fitted Bed Sheet] [⚓ V-Berth Boat Sheet]
  Unit toggle: cm / inch
  Bed Sheet mode: Width / Length / Depth + Fabric selector
  V-Berth mode: Head Width / Foot Width / Length / Depth + Fabric selector
  Measurement diagram shown beside inputs
  Live price display — note: "Excludes shipping & import tariff"

[FABRIC SHOWCASE]  ← 4 tabs (BreezePlus / CloudSoft / PremaCotton / EcoLuxe)

[SOCIAL PROOF]  ← 2 Etsy reviews + 5★ badge

[EMAIL SIGNUP]  ← abandoned cart recovery hook
  "Get 10% off your first order"

[FOOTER]
```

### 2. Blog Index (`/blogs/`)

```
[PAGE HERO]  "The MildMate Blog" + short tagline

[FILTER BAR]  All | Marine & Yacht | Family Bedding | Care Tips | Size Guides | News

[POST GRID]  3-col desktop, 2-col tablet, 1-col mobile
  Card: Thumbnail (800×534) | Category tag | Title | Excerpt | Date | Read time | Read →

[PAGINATION]
  ⟵ First | ← Prev | 1  2  3  …  N | Next → | Last ⟶
  "Showing posts X–Y of Z total"
```

### 3. Blog Post (`/blogs/[slug]/`)

```
[HEADER + BREADCRUMB]  Home › Blog › Category › Post Title

[HERO BANNER]  1200 × 500 px — full width

[TWO-COLUMN LAYOUT]
  Left (main):
    Category tag | H1 Title
    Author | Date | Read Time | Share icons
    Article body (H2, paragraphs, inline images 1200×675, blockquotes, lists)
    Tags
    Author bio box (avatar 160×160 + name + bio)
  
  Right (sidebar, sticky):
    Recent Posts widget
    Categories widget
    CTA widget: "Get a Custom Quote" → configurator

[RELATED POSTS]  3 cards (same thumbnail spec as index)

[PREV / NEXT POST NAVIGATION]
```

### 4. Product Listing (`/products/`, category pages)

```
[FILTER BAR]  Category | Fabric | Size Region (TH/US/UK/EU/AU)
[PRODUCT GRID]  3-col desktop, 2-col mobile — data pulled from D1
  Card: Image | Title | Price (THB or USD) | "View Options" CTA
```
> Category pages (`/marine/`, `/family/`, `/duvet/`, `/protection/`) render the same grid pre-filtered by category. All data is dynamic from D1.

### 5. Product Detail (`/product/[slug]/`)

**Two distinct purchase paths on every product page:**

**Path A — Standard Size (Instant Add to Cart)**
```
[PRODUCT INFO]
  Title (TH/EN toggle)
  Fabric badge + short description
  ★★★★★ (Siriraj certified badge if BreezePlus/TPU)

[STANDARD SIZE SELECTOR]
  Step 1: Country / Region
    [🇺🇸 US/Canada ▼]  [🇬🇧 UK ▼]  [🇪🇺 EU ▼]  [🇹🇭 Thailand ▼] ...

  Step 2: Size (filtered to that country's standards)
    [○] Twin      99×191 cm / 39×75 in   $35
    [○] Full     137×191 cm / 54×75 in   $42
    [●] Queen    153×203 cm / 60×80 in   $49
    [○] King     193×203 cm / 76×80 in   $55

  Step 3: Fabric & Color
    [●] PremaCotton  [○] BreezePlus  [○] CloudSoft  [○] EcoLuxe
    Color swatches

  Price: $49.00     [         Add to Cart          ]
```

**Path B — Custom Size (Quote Required)**
```
[Need a custom size? Click here →]
  ↓ (expands)
[CUSTOM CONFIGURATOR]
  Tab: [🛏 Fitted Bed Sheet] [⚓ V-Berth Boat Sheet] [🚛 Truck Cab] [👨‍👩‍👧 Family / Co-Sleep] [🚐 RV]
  Unit toggle: cm / inch  (geo-defaulted, localStorage persisted)
  Measurement diagram beside inputs (SVG switches per tab)
  Fabric swatches (4 options)
  Color selector
  Live ESTIMATE price (via Worker API)
  Note: "Price excludes shipping & import tariff. Final price confirmed after quote approval."
  [Submit for Custom Quote]

  → Quote stored in `custom_quotes` table
  → Admin approves → customer receives magic link → adds locked price to cart
```

[MEASUREMENT GUIDE]  ← inline collapsible
  Credit card method diagram

[PRODUCT TABS]  Description | Fabric Details | Size Guide | Care

[RELATED PRODUCTS]

### 6. About Us (`/about/`)

```
[HERO]  Blue gradient (CI Blue) centered hero with blueprint grid overlay
  H1: "Precision Bedding. Engineered for Every Shape of Sleep."
  Sub: Brand story intro (consistent with /contact/ hero style)

[OUR STORY]  Founding, mission, handcraft in Thailand

[CERTIFICATIONS]  OEKO-TEX + Siriraj certified badges with descriptions

[THE TEAM]  Brief team introduction

[CTA]  → Shop Custom Bedding
```

### 7. Contact (`/contact/`)

```
[CONTACT FORM]  Name | Email | Subject | Message | Send

[CONTACT CHANNELS]
  💬 LINE Official    — [LINE link]
  📱 WhatsApp         — [WhatsApp link]
  📘 Facebook         — [Facebook page link]

[MARKETPLACE LINKS]  ← Icon row
  🛍️ Etsy  |  🛒 eBay  |  🛍️ Shopee  |  📦 Lazada  |  🎵 TikTok Shop

[LOCATION / ABOUT]  Made in Thailand — brief note
```

### 8. Fabric Collections (`/fabric/`)

```
[PAGE HERO]  "Our Fabrics" headline

[4 FABRIC TABS]  BreezePlus | CloudSoft | PremaCotton | EcoLuxe
  Each tab panel:
    Full-width fabric visual
    Name + tagline
    Extended description
    Feature list (5–6 items)
    Color options grid
    Certifications (OEKO-TEX, Siriraj where applicable)
    CTA → Shop [Fabric Name] products

**BreezePlus Color Palette (9 swatches):**
Dark Grey #4D545B | Silver #B7BEC8 | Sand #D9D1C1 | Sky #9CCAE1 | Emerald #618283 | Sea #5A7DA2 | Pure White #FFFFFF | Baby Pink #E9B7BF | Ivory #F1EFE1

**EcoLuxe Note:** Calico / Greige cotton — natural unbleached, minimal processing. Not GOTS-certified.

[FABRIC COMPARISON TABLE]  Side-by-side spec comparison of all 4
```

### 9. Size Guide Pages (SEO Hub)

**Architecture: Country-First Progressive Disclosure**

**Landing page** (`/sizeguide/`):
```
Step 1: Select Your Country / Region
  🇺🇸 US/Canada    🇬🇧 UK    🇪🇺 EU    🇦🇺 Australia
  🇹🇭 Thailand     🇲🇾/🇸🇬 MY/SG    🇮🇳 India    🇯🇵 Japan
  [🌍 Other / Not Sure?]

Step 2: Select Your Mattress Type
  Standard Mattress | Family / Co-Sleep | Marine | Truck Cab | RV

Step 3: Pick Your Size
  [Only 4–6 sizes relevant to that country + type]
  Each size label shows BOTH units: "Queen  153 × 203 cm / 60 × 80 in"

[→ CTA: Shop this size  /  → CTA: Need custom? Measure →]
```

**Deep pages:**
```
/mattress-size-th/             ← #1 traffic page, Thai SEO hub
/how-to-measure-mattress-size/
/mattress-size/                ← International size tables by country tab
/bed-sheets-size/              ← Duvet + pillow sizing
```

**Unit display rule:** Every size label shows BOTH `cm` and `inch` simultaneously — no toggle needed. Geo unit preference (cm vs inch) is stored in `localStorage` and used for configurator inputs only.

### 10. Shipping Policy (`/shipping/`)

```
[HERO]  Shipping & Delivery
[CONTENT]  Processing time | Shipping regions | Rates (USD/THB) | Transit times | Customs note
[FAQ]  Common shipping questions
```
> Note: All product prices displayed on the site are *product price only* and exclude shipping costs and any import tariffs applicable in the destination country.

### 11. Privacy Policy (`/policy/`)

```
Standard GDPR-compatible privacy policy
Covers: data collected, usage, cookies, third parties (Stripe, MailChannels), rights
```

### 12. Customer Reviews (`/reviews/`)

```
[HERO]  Blue gradient (CI Blue) centered hero with blueprint grid overlay
  H1: "Customer Reviews"
  Sub: "Real feedback from verified buyers around the world."
  (Consistent with /contact/ hero style)

[RATING BADGE]  5.0 ★★★★★ — verified reviews

[REVIEW GRID]  3-col desktop — curated reviews with star rating, text, name, country

[ETSY BADGE]  Link to Etsy shop reviews
```

### 13. Checkout (`/checkout/`)

```
[STEP 1: CART REVIEW]
  Items, dimensions, fabric, price
  Currency toggle (THB / USD)
  Note: "Prices shown exclude shipping — rates calculated at payment"
  Optional: "Sign in for faster checkout" (social login buttons)

[STEP 2: SHIPPING DETAILS]  ← email captured HERE for abandoned cart
  Name | Email | Phone | Shipping Address
  Custom notes (special shape description)
  Post-checkout prompt: "Create account to save your measurements"

[STEP 3: PAYMENT]
  → Stripe Checkout (hosted, redirects to Stripe)
  TH visitors: PromptPay QR via Stripe
  Global: Card / Apple Pay / Google Pay
```

**Social Login (Optional — No Forced Login):**
- Customers can check out as guests without any login
- Social login buttons shown at checkout and in header for convenience
- Supported providers: Google, Facebook, LINE (Thailand essential), Apple
- Logging in pre-fills shipping details and saves order history
- Account creation is encouraged *after* purchase, not required before

### 14. Admin Dashboard (`/admin/`) — protected by Cloudflare Access

```
Sidebar: Dashboard | Products | Orders | Images | Subscribers

[ORDERS PAGE]  ← manufacturing team view
  Table: Date | Customer | Product | Sheet Type | Dimensions | Fabric | Color | Status
  Sheet Type: Fitted Bed Sheet → shows W × L × D
             V-Berth → shows Head × Foot × L × D
  Filter by: pending / in-production / shipped

[PRODUCTS PAGE]
  Card grid: product name | price USD/THB | active toggle | Edit button
  Edit modal: title TH / title EN / prices / fabric options

[IMAGE UPLOADER]
  Drag & drop zone → uploads to R2 → returns CDN URL

[SUBSCRIBERS]
  Email list table + "Export CSV" button
```

### Footer Layout

**Minimal, modern, premium style — deep navy #001d3d background**

```
┌─────────────────────────────────────────────────────────────┐
│  Quick Links   Customer Service   Shop With Us     Contact  │
│  ─────────────────────────────────────────────────────────  │
│  About Us      FAQ                [Etsy][eBay]     ✉ email │
│  Contact Us    Size Guide         [Shopee][Lazada] ☎ phone │
│  Reviews       Blog                                     [WA][LINE] │
├─────────────────────────────────────────────────────────────┤
│           [FB] [IG] [TikTok] [Pinterest] [YouTube]         │
├─────────────────────────────────────────────────────────────┤
│  © MildMate 2026          Privacy Policy | Shipping        │
└─────────────────────────────────────────────────────────────┘
```
> **Design rules:** No logo or description block. Icon-only marketplace links (44px circles, 22px icons, blue hover). Social icons centered in their own row (same circular style). LINE/WhatsApp icon-only buttons under phone number. No LINE sticky bar (removed for international positioning).

---

## Project Folder Structure

```
mildmate-web/
├── AGENTS.md
├── Framework.md
├── wrangler.toml
├── package.json
├── blog-mockup.html           ← Blog template design reference
├── mockup.html                ← Homepage design reference
│
├── public/                          ← Cloudflare Pages static files
│   ├── index.html                   ← Homepage EN
│   ├── th/index.html                ← Homepage TH
│   │
│   ├── about/index.html
│   ├── contact/index.html
│   ├── fabric/index.html
│   ├── shipping/index.html
│   ├── policy/index.html
│   ├── reviews/index.html
│   ├── checkout/index.html
│   ├── order-confirmed/index.html
│   ├── account/index.html          ← My Account (order history, social login)
│   ├── products/index.html
│   ├── marine/index.html            ← Category page (dynamic from D1)
│   ├── family/index.html
│   ├── duvet/index.html
│   ├── protection/index.html
│   │
│   ├── blogs/index.html             ← Blog index page 1
│   ├── blogs/page/[n]/index.html    ← Blog index pagination
│   ├── blogs/[slug]/index.html      ← Individual blog post pages
│   │
│   ├── product/[slug]/index.html    ← 83 product detail pages (standard + custom paths)
│   ├── quote/[quote-id]/index.html  ← Magic link: locked custom quote → Add to Cart
│   │
│   ├── mattress-size-th/index.html  ← #1 SEO page
│   ├── mattress-size/index.html
│   ├── how-to-measure-mattress-size/index.html
│   ├── bed-sheets-size/index.html
│   ├── [all-other-258-slugs]/index.html   ← Phase 2 URL preservation
│   │
│   ├── css/
│   │   ├── main.css                 ← All public styles
│   │   └── admin.css                ← Admin dashboard styles
│   ├── js/
│   │   ├── cart.js                  ← localStorage cart logic
│   │   ├── configurator.js          ← Price calculator (both modes)
│   │   └── geo.js                   ← Currency toggle
│   ├── images/
│   │   ├── logo.png                 ← Main logo (transparent PNG)
│   │   ├── Hero01.jpg               ← Homepage hero background
│   │   ├── og-image.jpg             ← Social share preview (1200×630)
│   │   ├── categories/              ← Category card images (Shop by Product + Shop by Niche)
│   │   │   ├── category-marine.jpg      ✅ Real photo
│   │   │   ├── category-family.jpg      ✅ Real photo
│   │   │   ├── category-duvet.jpg       ✅ Real photo
│   │   │   ├── category-protection.jpg  ✅ Real photo
│   │   │   ├── category-pets.jpg        ✅ Real photo
│   │   │   ├── category-rv-truck.jpg    ✅ Real photo
│   │   │   ├── category-fitted-sheets.jpg     ✅ Real photo
│   │   │   ├── category-flat-sheets.jpg       ✅ Real photo
│   │   │   ├── category-duvet-covers.jpg        ✅ Real photo
│   │   │   ├── category-pillowcases.jpg         ✅ Real photo
│   │   │   └── category-mattress-protectors.jpg   ✅ Real photo
│   │   ├── products/                ← Product detail hero images
│   │   │   ├── 3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets.jpg  ✅ Real
│   │   │   ├── family-co-sleeping-solutions-th-size.jpg                      ✅ Real
│   │   │   ├── product-boat-bedding-fitted-sheet-microfiber.jpg              ✅ Real
│   │   │   ├── sheet-protectors.jpg                                          ✅ Real
│   │   │   ├── tbar.jpg                                                      ✅ Real
│   │   │   ├── pet-owner-fitted-sheet.jpg              ✅ Real photo
│   │   │   ├── pet-owner-duvet-cover.jpg               ✅ Real photo
│   │   │   ├── adjustable-mattress-fitted-sheet.jpg      ✅ Real photo
│   │   │   ├── flat-sheet-standard.jpg                 ✅ Real photo
│   │   │   ├── flat-sheet-extra-deep-pocket.jpg        ✅ Real photo
│   │   │   ├── pillowcase-envelope.jpg                 ✅ Real photo
│   │   │   ├── pillowcase-zipper.jpg                   ✅ Real photo
│   │   │   ├── pillowcase-sham.jpg                     ✅ Real photo
│   │   │   ├── pet-proof-mattress-protector.jpg        ✅ Real photo
│   │   │   └── pillow-protector.jpg                    ✅ Real photo
│   │   ├── fabrics/                 ← Fabric showcase photos
│   │   ├── router/                  ← Niche landing page hero/router images
│   │   ├── Logo/                    ← Marketplace & social icons
│   │   └── about/                   ← About page photos
│   ├── _redirects                   ← 301s for WordPress legacy URLs
│   ├── _headers                     ← Security headers (CSP, HSTS)
│   ├── sitemap.xml
│   └── robots.txt
│
├── workers/
│   ├── api/
│   │   ├── products.ts
│   │   ├── pricing.ts               ← Handles both bed sheet + V-Berth formulas
│   │   ├── geo-currency.ts
│   │   ├── cart.ts
│   │   ├── checkout.ts
│   │   ├── webhook.ts
│   │   ├── email.ts
│   │   ├── subscribers.ts
│   │   ├── auth.ts                  ← Social login (Google, Facebook, LINE, Apple)
│   │   ├── customers.ts             ← Customer profile, order history, saved addresses
│   │   └── quote.ts                 ← Custom quote: submit, approve, fetch by ID
│   ├── admin/
│   │   ├── products.ts
│   │   ├── orders.ts
│   │   ├── upload.ts
│   │   └── subscribers.ts
│   └── cron.ts                      ← Abandoned cart cron (Phase 6)
│
├── admin/
│   ├── index.html
│   ├── products.html
│   ├── orders.html
│   ├── upload.html
│   └── subscribers.html
│
└── migrations/
    └── 001_initial.sql
```

---

## SEO URL Strategy

| Type | Count | Action |
|---|---|---|
| Clean EN slugs | ~80 | Preserve exact — create matching `/slug/index.html` |
| Clean TH slugs | ~15 | Preserve exact — UTF-8 folder names supported by CF Pages |
| `/th/` prefixed pages | ~20 | Preserve exact |
| `/product/[slug]/` | 83 | Preserve exact |
| Duplicate/junk slugs | ~60 | `_redirects` 301 → canonical |

---

## D1 Database Schema

```sql
-- Products
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title_th TEXT, title_en TEXT,
  description_th TEXT, description_en TEXT,
  category TEXT,                  -- 'marine', 'family', 'duvet', 'protection'
  base_price_usd REAL, base_price_thb REAL,
  price_per_sqcm_usd REAL, price_per_sqcm_thb REAL,
  fabric_options TEXT,            -- JSON array
  image_r2_key TEXT,
  active INTEGER DEFAULT 1
);

-- Orders
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  customer_name TEXT, phone TEXT,
  address TEXT,                   -- JSON {line1, city, country}
  product_id INTEGER REFERENCES products(id),
  sheet_type TEXT DEFAULT 'fitted_bed',   -- 'fitted_bed' | 'vberth'
  -- Fitted Bed Sheet dimensions
  custom_width_cm REAL,
  custom_length_cm REAL,
  custom_depth_cm REAL,
  -- V-Berth additional dimensions (NULL for fitted bed sheet orders)
  custom_head_width_cm REAL,      -- Bow (narrow end)
  custom_foot_width_cm REAL,      -- Cabin entry (wide end)
  fabric TEXT, color TEXT,
  amount REAL, currency TEXT,     -- 'USD' | 'THB'
  payment_id TEXT,                -- Stripe session ID
  payment_status TEXT DEFAULT 'pending',
  order_status TEXT DEFAULT 'pending',    -- 'pending' | 'in-production' | 'shipped' | 'cancelled'
  created_at TEXT DEFAULT (datetime('now'))
);

-- Custom Quotes (custom-size orders requiring manual pricing)
CREATE TABLE custom_quotes (
  id INTEGER PRIMARY KEY,
  quote_id TEXT UNIQUE NOT NULL,   -- e.g., "QT-250512-001"
  customer_email TEXT NOT NULL,
  product_type TEXT,               -- 'marine', 'truck_cab', 'family_cosleep', 'rv', 'other'
  dimensions TEXT,                 -- JSON: {"w":183,"l":198,"h":15,"unit":"cm"}
  fabric TEXT,
  color TEXT,
  extras TEXT,                     -- JSON array: ["embroidery_name", "tpu_liner"]
  status TEXT DEFAULT 'pending',     -- pending | approved | rejected | expired
  quoted_price INTEGER,            -- cents, NULL until admin approves
  expires_at TEXT,                 -- ISO timestamp, 7 days from created
  created_at TEXT DEFAULT (datetime('now'))
);

-- Abandoned Carts
CREATE TABLE abandoned_carts (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  cart_json TEXT,                 -- Full cart with sheet_type + all dimensions
  recovered INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Email Subscribers
CREATE TABLE subscribers (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  source TEXT,                    -- 'footer', 'checkout'
  created_at TEXT DEFAULT (datetime('now'))
);

-- Customers (social login accounts — optional)
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  auth_provider TEXT,             -- 'google', 'facebook', 'line', 'apple'
  auth_provider_id TEXT,          -- ID from provider
  addresses TEXT,                 -- JSON array of saved addresses
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## Build Phases

| Phase | Scope | Key Output |
|---|---|---|
| **1** | Foundation | `AGENTS.md`, `wrangler.toml`, D1 schema (incl. V-Berth fields), folder scaffold | ✅ Complete |
| **2** | SEO URL Preservation | All 258 static HTML shells + `_redirects` | ⏸️ Deferred — runs pre-launch after Phase 7 |
| **3** | Design System + Shared Components | `main.css`, header, footer (with all social/marketplace links), nav | ✅ Complete |
| **4** | All Content Pages | Homepage EN+TH, About, Contact, Fabric Collections, Policy pages, Reviews, Size Guides, Product pages, Configurator (both modes), `/api/subscribe` endpoint | ✅ Complete |
| **5** | Checkout + Stripe + Social Login | Guest checkout + Stripe payments + optional social login (Google, Facebook, LINE, Apple) + My Account page | ⏸️ Pending |
| **6** | Abandoned Cart Cron | Email capture → D1 → Cron Trigger → MailChannels | ⏸️ Pending |
| **7** | Admin Dashboard | Orders (V-Berth fields visible), product CRUD, R2 uploader, CSV export | ⏸️ Pending |
| **8** | Polish + Launch | Mobile QA, Lighthouse 95+, DNS cutover to `www.mildmate.com` | ⏸️ Pending |
| **9** | Testing (Vitest) | Unit tests for Worker API: pricing (V-Berth/fitted), cart, geo-currency, subscribers, quote, products, webhook — `@cloudflare/vitest-pool-workers` | ⏸️ Pending |
| **9** | Testing (Vitest) | Unit tests for Worker API: pricing (V-Berth/fitted), cart, geo-currency, subscribers, quote, products, webhook | ⏸️ Pending |

> **Note:** Phase 2 (SEO URL Preservation) is intentionally deferred — it will run pre-launch after Phase 7 is complete. All other phases proceed in normal order.

---

## Pricing Rules

- All product prices displayed on the site are **product price only**
- All configurator estimates are **product price only**
- Shipping costs are calculated separately at checkout based on destination country
- Import tariffs are the customer's responsibility and are NOT included in any displayed price
- This note appears on every price display: *"Price excludes shipping & import tariff"*

---

## What Is NOT Being Built (Deferred or Out of Scope)
- Blog CMS editor (static HTML only — blog posts are manually authored HTML files)
- Inventory management
- Auto-translation (manual TH/EN per page)
- Shopee/Lazada direct API integration (links only — orders managed on those platforms directly)
