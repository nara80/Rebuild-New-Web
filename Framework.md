# MildMate Web Rebuild — Full Framework Plan

## Stack Confirmed
- **Frontend:** Vanilla HTML + CSS + minimal JS
- **Backend:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 + Storage R2
- **Deploy:** `mildmate-new.pages.dev` → cutover to `www.mildmate.com` when 100% done
- **Email:** Resend (free tier: 100/day, `RESEND_API_KEY` required as Pages secret)
- **Payments:** Stripe (USD + PromptPay THB natively)
- **Admin auth:** Cloudflare Access (Google login)
- **Parcel tracking:** AfterShip (FedEx, UPS, DHL, Thai Post + 100+ carriers) — tracking page at `/track/[tracking]` via AfterShip embedded widget or API

---

## Frontend Design System

### Brand Tokens (CSS Variables) — Updated 2026-05-21
```css
--color-primary: #2c96f4;       /* CI Blue — interactive elements only */
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
**Color rule:** #2c96f4 restricted to links, buttons, active states, hover borders. Never used as decorative color.

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
| My Account | `/account/` | Order history, saved addresses, parcel tracking (AfterShip), social login |
| Parcel Tracking | `/track/[tracking]/` | AfterShip embedded widget — FedEx, UPS, DHL, Thai Post + 100+ carriers auto-detected |
| All 258 WordPress URLs | various | Preserved from Phase 2 |

### Blog Pages (static HTML, managed manually)
| Page | URL | Notes |
|---|---|---|
| Blog Index | `/blogs/` | Featured post + 11-card grid, filter tabs, pagination (12/page), newsletter CTA — implemented 2026-05-16 |
| Blog Pagination | `/blogs/page/2/` | Page 2 — posts 13–17 (5 cards) — implemented 2026-05-16 |
| Blog Post Template | `/blogs/template/index.html` | Hero image, rich article body, author box, social share, related products — implemented 2026-05-16 |
| Blog Post Sample | `/blogs/v-berth-sheets-vs-standard/` | First real blog post (Marine/V-Berth) — implemented 2026-05-16 |
| Individual Blog Post | `/blogs/[post-slug]/` | One file per article — copy from template |

### Dynamic Pages (data from Cloudflare D1)

**Shop by Product — 5 categories (primary navigation, SEO discoverability)**
| Category | URL | Products |
|---|---|---|
| Sheets | `/sheets/` | Standard, Deep Pocket, Marine, Dorm, RV & Truck, Family, Pet Owner (Fitted) + Standard, Extra Deep Pocket (Flat) — 9 products |
| Duvet Covers | `/duvet-covers/` | 3-Sided Zipper, Pet Owner, Marine, RV, Dorm, Duvet Insert — 6 products |
| Pillowcases | `/pillowcases/` | Envelope, Zipper, Sham — 3 products |
| Protection | `/protection/` | Standard, Family, Deep Pocket, Pet-Proof, 6-Sided Encasement, RV & Truck Encasement, Pillow Protector — 7 products |
| Accessories | `/accessories/` | BedBridge Connector, Bed Lifter — 2 products |

**Shop by Niche — 6 categories (use-case landing pages, high-conversion)**
| Category | URL | Cross-links to |
|---|---|---|
| Marine & Yacht | `/marine/` | `/sheets/` |
| Family & Co-Sleep | `/family/` | `/sheets/` |
| Deep Pocket | `/deep-pocket/` | `/sheets/` |
| Boarding Dorm | `/boarding-dorm/` | `/sheets/` |
| Pet Owner Bedding | `/pets/` | `/sheets/`, `/protection/` |
| RV & Truck Cab | `/rv-truck/` | `/sheets/`, `/protection/` |

**Browse All**
| Category | URL | Notes |
|---|---|---|
| All Products | `/products/` | Full catalog grid with filter bar |

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
│ Deep Pocket       │ Boarding Dorm                 │
│ • Deep Pocket     │ • Parents Buying for Kids Abroad │
│ • Adjustable Base │ • 3-Sided Zipper Duvet          │
│                   │ • Mattress Encasement        │
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

For non-standard sizes (marine V-berths, truck cabs, family co-sleep, RVs), customers submit a quote request via popup form. Admin reviews, prices manually, and customer receives a magic link to add the locked price to cart.

### Step-by-Step Flow (Implemented 2026-05-19)

```
Customer on Product Page (Fitted Sheet Configurator)
       ↓
Enters custom W×L×D + selects fabric
       ↓
Clicks "Custom Quote" (inside custom dimensions panel)
       ↓
Popup Form: Name* + Email* + Address + Telephone
       ↓
[Submit] → POST /api/quote → D1 custom_quotes (status='pending')
                            → D1 subscribers (INSERT OR IGNORE dedup)
                            → Resend email to contact@mildmate.com
       ↓
Confirmation popup: "We'll email you@... within 24 hours."
  Dimension: W × L × D cm   Fabric: CloudSoft   Quote ID: QT-250519-001
       ↓
[OK] dismisses popup
       ↓
ADMIN: Receives email → Review in dashboard → set quoted_price → approve
       ↓
Customer receives email: "Your quote QT-250519-001 is ready — $89.00"
       ↓
Magic link: /quote/QT-250519-001  (Phase 5+)
       ↓
Customer opens link → sees locked quote with "Add to Cart — $89.00"
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

### 1. Homepage (`/index.html`) — Redesigned 2026-05-21

```
[HEADER]  ← sticky, 95% opacity + backdrop-blur on scroll
  Logo left | Home / Shop / Fabrics / Size Guide center | Search / Account / Cart / EN-TH right

[HERO]  ← full-bleed lifestyle image + light gradient overlay
  Headline: "Bedding Made Easy Again" + "Any Size, Any Shape" (dark text)
  CTA: "Shop All Products" (centered, 5px below heading)
  Mobile: 1:1 square image first, text below (30px lower, 10px gap)

[TRUST BAR]  ← 4 icons on #F8FAFC background
  Precision Fit | Global Delivery | Top-Rated | Sensitive Skin Friendly

[SHOP BY PRODUCT]  ← 5 cards, 4-col grid
  Sheets | Duvet Covers | Pillowcases | Protection | Accessories

[SHOP BY NICHE]  ← 6 cards, 3-col grid, 8px radius + 2px border
  Marine & Yacht | Family & Co-Sleep | Pet Owner | Deep Pocket | Boarding Dorm | RV & Truck
  Mobile: horizontal swipe strip, 220px min-width cards

[FABRIC INTELLIGENCE]  ← lateral comparison grid (2026-05-21)
  4-column comparison: Feature | BreezePlus | CloudSoft | PremaCotton | EcoLuxe
  Rows: Material | Cooling | Best For | Colors (swatches)
  No tabs — all fabrics visible side-by-side for instant scanning

[MOST POPULAR]  ← horizontal scroll carousel, 5 product cards

[SOCIAL PROOF]  ← reviews carousel + 5★ Etsy badge

[EMAIL SIGNUP]  ← blue gradient, "Get 15% Off Your First Order"

[FOOTER]  ← 4-col global, deep navy #001d3d
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
> Category pages (`/marine/`, `/family/`, `/deep-pocket/`, `/pets/`, `/boarding-dorm/`, `/rv-truck/`) render the same grid pre-filtered by category. **All data is driven from `data/products.json`** via `scripts/regenerate-products.js`. Run the regenerator after any change to the JSON file.

### 5. Product Detail (`/product/[slug]/`)

**Two distinct purchase paths on every product page:**

**Path A — Standard Size (Instant Add to Cart)**
```
[PRODUCT INFO]
  Title (TH/EN toggle)
  Fabric badge + short description

[STANDARD SIZE SELECTOR]
  Step 1: Size (dropdown with region optgroups — US/CA: imperial, others: metric)
    [○] Twin/Single 39×75″      [○] Full/Double 54×75″
    [●] Queen 60×80″            [○] King 76×80″

  Step 2: Fabric & Color
    [●] PremaCotton  [○] BreezePlus  [○] CloudSoft  [○] EcoLuxe
    Color swatches (follow fabric selection, 6 per row)

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
Covers: data collected, usage, cookies, third parties (Stripe, Resend), rights
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
  Global: Card / Google Pay
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
├── functions/                        ← Pages Functions (local dev bridge)
│   └── api/
│       └── [[path]].ts               ← API catch-all → Worker handlers
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
│   ├── marine/index.html            ← Niche landing (from `data/products.json`)
│   ├── family/index.html
│   ├── deep-pocket/index.html
│   ├── boarding-dorm/index.html
│   ├── pets/index.html
│   ├── rv-truck/index.html
│   │
│   ├── blogs/index.html             ← Blog index page (featured + 11-card grid)
│   ├── blogs/page/2/index.html    ← Blog pagination page 2 (5 posts)
│   ├── blogs/template/index.html    ← Blog post template
│   ├── blogs/v-berth-sheets-vs-standard/index.html  ← First real blog post
│   ├── blogs/[slug]/index.html      ← Individual blog post pages (copy from template)
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
│   │   ├── configurator.js          ← Homepage price calculator (both modes)
│   │   ├── product-configurator.js  ← Shared product page configurator (19 products, 6 formula types)
│   │   ├── product-sizes.js         ← Centralized size data (174 entries, 8 regions — synced from /sizeguide/)
│   │   ├── geo.js                   ← Currency toggle
│   │   └── cookie-consent.js        ← GDPR consent banner
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
│   │   ├── products/                ← Product detail hero images (per-product subfolders)
│   │   │   ├── 3-sided-duvet/main.jpg
│   │   │   ├── bedbridge-connector/main.jpg + main-th.jpg
│   │   │   ├── boat-fitted-sheet/main.jpg
│   │   │   ├── deep-pocket-fitted-sheet/main.jpg
│   │   │   ├── dorm-fitted-sheet/main.jpg
│   │   │   ├── duvet-cover-dorm/main.jpg
│   │   │   ├── duvet-cover-marine/main.jpg
│   │   │   ├── duvet-cover-rv/main.jpg
│   │   │   ├── duvet-insert/main.jpg
│   │   │   ├── family-fitted-sheet/main.jpg + main-th.jpg
│   │   │   ├── flat-sheet-extra-deep-pocket/main.jpg
│   │   │   ├── flat-sheet-standard/main.jpg
│   │   │   ├── marine-fitted-sheet/main.jpg
│   │   │   ├── mattress-encasement-general/main.jpg
│   │   │   ├── mattress-lift-helper/main.jpg
│   │   │   ├── mattress-protector-deep-pocket/main.jpg
│   │   │   ├── mattress-protector-dorm/main.jpg
│   │   │   ├── mattress-protector-family/main.jpg
│   │   │   ├── mattress-protector-standard/main.jpg
│   │   │   ├── pet-owner-duvet-cover/main.jpg
│   │   │   ├── pet-owner-fitted-sheet/main.jpg
│   │   │   ├── pet-proof-mattress-protector/main.jpg
│   │   │   ├── pillow-protector-general/main.jpg
│   │   │   ├── pillowcase-envelope/main.jpg
│   │   │   ├── pillowcase-sham/main.jpg
│   │   │   ├── pillowcase-zipper/main.jpg
│   │   │   ├── rv-truck-fitted-sheet/main.jpg
│   │   │   ├── rv-truck-mattress-encasement/main.jpg
│   │   │   └── standard-fitted-sheet/main.jpg
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
│   │   ├── email.ts                  ← Shared Resend email helper
│   ├── subscribers.ts
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
    ├── 001_initial.sql
    ├── 003_quote_fields.sql
    └── 004_rate_limits.sql
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
  tracking_number TEXT,           -- AfterShip / carrier tracking ID (FedEx, UPS, DHL, Thai Post)
  carrier TEXT,                   -- Carrier slug: 'fedex' | 'ups' | 'dhl' | 'thaipost' | 'other'
  created_at TEXT DEFAULT (datetime('now'))
);

-- Custom Quotes (custom-size orders requiring manual pricing)
CREATE TABLE custom_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id TEXT NOT NULL UNIQUE,     -- e.g., "QT-250519-001"
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT,
  telephone TEXT,
  product_slug TEXT NOT NULL,
  dimensions TEXT NOT NULL,          -- JSON: {"w":183,"l":198,"d":51,"unit":"cm"}
  fabric TEXT,
  color TEXT,
  status TEXT DEFAULT 'pending',     -- pending | approved | rejected | expired
  quoted_price INTEGER,              -- cents, NULL until admin approves
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

-- Rate Limits (anti-spam)
CREATE TABLE rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,         -- 'quote' | 'subscribe'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
| **4** | All Content Pages | Homepage EN+TH, About, Contact, Fabric Collections, Policy pages, Reviews, Size Guides, Product pages, Configurator (both modes), `/api/subscribe` endpoint, JSON catalog system (data/products.json), clickable product card tags, USD price prefix, WebP images + critical CSS inlining, rAF scroll throttling | ✅ Complete |
| **5** | Checkout + Stripe + Social Login | Guest checkout + Stripe payments + optional social login (Google, Facebook, LINE, Apple) + My Account page with AfterShip parcel tracking | ⏸️ Pending |
| **6** | Abandoned Cart Cron | Email capture → D1 → Cron Trigger → Resend | ⏸️ Pending |
| **7** | Admin Dashboard | Orders (V-Berth fields + tracking_number + carrier), AfterShip tracking display, product CRUD, R2 uploader, CSV export | ⏸️ Pending |
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
- **Currency display:** EN pages (`/product/.../`) show USD only; TH pages (`/th/product/.../`) show THB only

### Fitted Sheet Pricing Formula (Implemented 2026-05-19)

Active for 6 products: Standard, Deep Pocket, Dorm, RV & Truck Fitted Sheets + Standard, Extra Deep Pocket Flat Sheets.

**Fabric dimensions (cm):**
```
W_fabric = W + 2D + 14
L_fabric = L + 2D + 14
```

**Fabric rates per yard (91.44cm × 260cm bolt = 23,774.4 cm²):**
| Fabric | Rate (THB/yd) | After 20% waste |
|---|---|---|
| CloudSoft | 100 | area × 1.20 × 100/23,744 |
| BreezePlus, PremaCotton, EcoLuxe | 180 | area × 1.20 × 180/23,744 |

**Sewing cost — tiered by fabric area (cm²):**
| Area Range | Cost (THB) |
|---|---|
| ≤ 51,600 | 120 |
| ≤ 71,000 | 200 |
| ≤ 91,200 | 300 |
| ≤ 120,000 | 400 |
| > 120,000 | 500 |

**Accessories:** 10% of fabric cost

**Markups (on subtotal = fabric + sewing + accessories + packing 100 + delivery 50):**
- Fitted Sheet: +15% Operations, +20% Marketing, +30% Margin (45% for RV & Truck)
- Flat Sheet: +15% Operations, +20% Marketing, +30% Margin (no accessories, sewing = flat 250 THB)

**Rounding:** Final THB rounded up to nearest 100 THB. USD = THB ÷ 30.

**Max width:** 220cm — above trigger directs to Family/Co-Sleep custom quote.

### Encasement Pricing Formula (Implemented 2026-05-20)

Active for 2 products: 6-Sided Mattress Encasement + RV & Truck Mattress Encasement. TPU-only (no fabric selector).

**Fabric dimensions — 6-sided surface area (cm²):**
```
Area = 2(W×L + W×D + L×D)
```

**TPU fabric cost:**
```
TPU bolt width: 210 cm
1 linear metre = 100 × 210 = 21,000 cm² → costs 120 THB
fabricCost = (120 × area / 21,000) × 1.20  (20% waste factor)
```

**Sewing:** 300 THB flat rate

**Zipper:** 0.4 THB/cm on 3 sides: L + W + L = 2L + W

**Fixed costs:** Packing 100 + Delivery 50

**Markups (on subtotal = fabric + sewing + zipper + packing + delivery):**
- +15% Operations, +25% Marketing, +50% Margin (90% total — higher than cotton bedding)

**Rounding:** Final THB rounded up to nearest 100 THB. USD = THB ÷ 30.

**Implementation files:**
- `workers/api/pricing.ts` — `calculateEncasementPrice()` + `isEncasementProduct()`
- `public/js/product-configurator.js` — auto-detects `encasement` in URL path

### Duvet Cover Pricing Formula (Implemented 2026-05-21)

Active for 5 products: 3-Sided Zipper, Pet Owner, Marine, RV, Dorm Duvet Covers.

**Fabric dimensions — 2 pieces (cm²):**
```
rawArea = 2 × (W + 5) × (L + 5)   (5cm sewing allowance each edge)
floorArea = rawArea × 1.20          (20% waste)
```

**Zipper:** 0.4 THB/cm × (2L + W) — 3-sided zipper

**Sewing cost — tiered by raw area (cm²):**
| Area Range | Cost (THB) |
|---|---|
| ≤ 139,200 | 300 |
| ≤ 170,400 | 400 |
| > 170,400 | 600 |

**Fixed costs:** Packing 100 + Delivery 50

**Markups (on subtotal = fabric + zipper + sewing + packing + delivery):**
- +15% Operations, +20% Marketing, +30% Margin (65% total)

**Rounding:** Final THB rounded up to nearest 100 THB. USD = THB ÷ 30, rounded whole.

**No depth input** — duvet covers use W×L only.

### Pillowcase Pricing Formula (Implemented 2026-05-21)

Active for 3 products: Envelope, Zipper, Sham Pillowcases.

**Fabric dimensions (cm²):**
```
rawArea = 2 × (W + 5) × (L + 5)   (5cm sewing allowance)
Sham: rawArea × 1.15                (+15% fabric for flange)
floorArea = rawArea × 1.60          (60% waste)
```

**Sewing:** 40 THB flat (50 THB for Sham)

**Zipper (pillowcase-zipper only):** 0.4 THB/cm × max(W, L) — one side

**Fixed costs:** Packing 100 + Delivery 50

**Markups:** +15% Operations, +25% Marketing, +15% Margin (55% total)

**Max dimensions:** W, L ≤ 120cm each

**Rounding:** Final THB rounded up to nearest 100 THB. USD = THB ÷ 30, rounded whole.

### Pillow Protector Pricing Formula (Implemented 2026-05-21)

Active for 1 product: Pillow Protector (TPU waterproof).

Same geometry as pillowcase-zipper (2 pieces, 60% waste, zipper on longest side).

**TPU fabric cost:** 120 THB/linear metre ÷ 21,000 cm²/lm (210cm bolt)

**Markups:** +15% Operations, +25% Marketing, +35% Margin (75% total)

**Max dimensions:** W, L ≤ 120cm each

### Mattress Protector Pricing Formula (Implemented 2026-05-21)

Active for 4 products: Standard, Deep Pocket, Family, Pet-Proof Mattress Protectors. 3-layer construction (Cotton Quilted + Polyester Filling + TPU Waterproof), customer inputs W×L×D in cm.

**Fabric cost — area-based tiered (W×L in sq.inch):**
| Area Range (sq.inch) | Cost (THB) |
|---|---|
| ≤ 3,200 | 550 |
| ≤ 6,620 | 670 |
| ≤ 8,000 | 920 |
| ≤ 9,000 | 980 |
| ≤ 10,300 | 1,100 |
| ≤ 11,300 | 1,200 |
| > 11,300 | 1,300 |

**Depth surcharge:** <30cm: 0, 30-51cm: 200, 52-56cm: 400, >56cm: 600 THB.

**Fixed costs:** Packing 200 + Delivery 80

**Markups (on subtotal):** +15% Ops, +20% Mkt, +15% Margin (Standard+Pet-Proof), +25% (Deep Pocket), +50% (Family).

**Constraints:** Max W/L = 210 cm for non-family; over 210 → redirects to Family Protector.

**Rounding:** Final THB rounded up to nearest 100 THB. USD = THB ÷ 30.

### Centralized Size System (Implemented 2026-05-21)

`public/js/product-sizes.js` — 174 size entries across fitted-sheet/duvet/pillow types, 8 regions.
All product page size-selects are auto-populated from this data by `product-configurator.js`.
To update sizes across all pages: edit `/sizeguide/` → sync `product-sizes.js`.

### Configurator Pricing Status (2026-05-21 — All 27 Complete)

| Status | Count | Products |
|---|---|---|
| Live formula | 20 | 7 fitted (incl. Marine V-Berth) + 2 flat + 2 encasement + 5 duvet + 3 pillowcase + 1 pillow protector + 4 mattress protectors |
| No configurator needed | 3 | BedBridge Connector, Bed Lifter, Duvet Insert (Thai fixed-size) |
| Awaiting | 0 | — |

**All 27 products now have live pricing formulas or don't require configurators.**

**V-Berth formula (Marine Fitted Sheet):** `calcVBerthFitted()` — width = max(HW,FW)+2D+14, length = L+2D+14. CloudSoft fabric. Same sewing tiers as fitted sheet. Shape selector (8 shapes A-H with discounted prices). VERTH_MARKUP = 8.15 (680% margin). 4-field custom layout: HW, FW, Centerline L (tooltip), D. "Select Mattress Size" hidden — replaced by shape selector.

**Implementation files:**
- `workers/api/pricing.ts` — server-side formulas
- `public/js/product-configurator.js` — shared configurator on product detail pages (auto-detects product type, includes VBerth formula)

### Hybrid Pricing Architecture (Future — D1 standard_prices)

When all 27 product formulas are ready:

```
Standard Size selected → GET /api/pricing?product=...&size=153x203x30&fabric=cloudsoft
                       → D1 standard_prices lookup → return admin-managed price

Custom W×L×D entered  → POST /api/pricing { w, l, d, fabric }
                       → Formula calculates → return live price
```

**D1 `standard_prices` table schema (planned):**
```sql
CREATE TABLE standard_prices (
  id INTEGER PRIMARY KEY,
  product_slug TEXT NOT NULL,
  size_key TEXT NOT NULL,     -- '153x203x30'
  fabric TEXT NOT NULL,
  label_en TEXT,
  price_thb INTEGER NOT NULL,
  price_usd REAL NOT NULL,
  UNIQUE(product_slug, size_key, fabric)
);
```
Admin seeds via formula initially, can override any price for business control.

---

## What Is NOT Being Built (Deferred or Out of Scope)
- Blog CMS editor (static HTML only — blog posts are manually authored HTML files)
- Inventory management
- Auto-translation (manual TH/EN per page)
- Shopee/Lazada direct API integration (links only — orders managed on those platforms directly)

---

## Bug Fix: Language Toggle Fails on `/sizeguide/` (Inline Onclick Workaround)

### Symptom
- Lang-toggle works on all pages
- On `/sizeguide/` only: clicking EN (from TH version) works; clicking TH (from EN version) does nothing — no navigation, no error
- nav.js has `/sizeguide/` correctly in `BILINGUAL_PAGES`, `/th/sizeguide/` exists and returns 200, `_redirects` is not the cause

### Root Cause
Pages with a large inline `<script>` block (e.g., `/sizeguide/` has ~330 lines of interactive JS for the size-table UI) can have a JS timing or event-bubbling edge case that prevents nav.js's `addEventListener` from reliably triggering `window.location.href` for the TH span specifically.

### Fix Applied (commit `9116e7b`)
Add a guaranteed fallback `onclick` directly on the language-toggle spans. This fires before any external JS event delegation and works regardless of nav.js load order or inline-script interference.

**On `/sizeguide/index.html` (EN page):**
```html
<div class="lang-toggle" role="group" aria-label="Language switch">
  <span data-lang="en" class="active">EN</span><span>/</span><span data-lang="th" onclick="window.location.href='/th/sizeguide/'" style="cursor:pointer">TH</span>
</div>
```
Both the desktop header and mobile drawer instances are updated.

**On `/th/sizeguide/index.html` (TH page):**
```html
<div class="lang-toggle" role="group" aria-label="สวิตช์ภาษา">
  <span data-lang="en" onclick="window.location.href='/sizeguide/'" style="cursor:pointer">EN</span><span>/</span><span data-lang="th" class="active">TH</span>
</div>
```

### How to Apply This Fix to Any Other Page
1. Find all `lang-toggle` blocks in the page HTML (there can be 2 — desktop header + mobile drawer)
2. Add `onclick="window.location.href='/th/[path]/'"` to the TH span
3. Add `onclick="window.location.href='/[path]/'"` to the EN span on the TH version
4. Include `style="cursor:pointer"` for visual clarity
5. Keep the nav.js event delegation as the primary mechanism — the inline onclick is a fallback, not a replacement

### Key Insight
The issue is specific to pages with large inline `<script>` blocks that run before nav.js can attach. Most pages (no large inline JS, nav.js loads cleanly) work fine via nav.js alone. Only pages with conflicting inline scripts need the onclick workaround.

---

## Product Listing Page Specification (Phase 4 Updated)

Every category page (`/sheets/`, `/duvet-covers/`, `/pillowcases/`, `/protection/`, `/accessories/`, `/marine/`, `/family/`, `/pets/`, `/deep-pocket/`, `/boarding-dorm/`, `/rv-truck/`) uses this layout:

### Page Structure

```
[BRAND HERO]                    ← Blue gradient + blueprint grid, consistent with /contact/
  H1: {Category Name}
  Sub: {Category-specific tagline}
  (same style as /contact/ hero)

[LISTING SECTION]               ← 11 product cards in auto-fill grid
  [Filter bar] (optional per page)
  [11 listing-card elements]

[LISTING DESC SECTION]         ← Description + Features + Pricing Panel
  Left: description text + features grid
  Right: interactive pricing panel
```

### Brand Hero (Consistent Across All Pages)
```css
.brand-hero {
  background: linear-gradient(135deg, #2c96f4 0%, #1a7fd4 100%);
  padding: 72px 24px 56px;
  position: relative;
  overflow: hidden;
  color: #fff;
}
.brand-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.08;
  background-image:
    linear-gradient(#fff 1px, transparent 1px),
    linear-gradient(90deg, #fff 1px, transparent 1px);
  background-size: 40px 40px;
}
.brand-hero-inner h1 { font-size: 2.5rem; font-weight: 700; color: #fff; }
.hero-sub { font-size: 1.0625rem; color: rgba(255,255,255,0.92); }
```

### Product Card (`.listing-card`)
Each card contains:
- `.card-image` with `img` (4:3 aspect ratio) + optional `.card-video-badge`
- `.card-body` with `.card-tags`, `.card-title`, `.card-price`, `.card-price-note`, `.card-cta`

- `.card-tags` — chip pills. Each chip is an `<span class="card-tag">{SLUG}</span>` inside `<div class="card-tags">`.

**How card-tags work (verified 2026-05-18):**
- Tags are HTML chip pills rendered from `/products/index.html` `data-categories` attribute, NOT from D1.
- Each chip displays an ALL-CAPS slug from the `data-categories` attribute on the product card article.
- ALL tags must be UPPERCASE slugs.
- Valid tag slugs: `SHEETS`, `DUVET-COVERS`, `PILLOWCASES`, `PROTECTION`, `ACCESSORIES`, `FAMILY`, `PETS`, `MARINE`, `RV-TRUCK`, `BOARDING-DORM`, `DEEP-POCKET`
- Product type tags (`SHEETS`, `PILLOWCASES`, etc.) are rendered when the product's `data-categories` includes that slug.
- Niche tags (`FAMILY`, `PETS`, `MARINE`, etc.) are rendered when the product's `data-categories` includes that niche slug.

**Tag display rules per listing context (verified 2026-05-18):**
- Primary product-type listing page (`/sheets/`, `/duvet-covers/`, `/protection/`, etc.): Shows the product's primary type tag + any cross-link niche tags it belongs to.
- Niche landing page (`/family/`, `/pets/`, `/marine/`, etc.): Shows the page's own niche tag + any product-type tags.
- The 3 tag layers must stay in sync: card-tags chips on listing pages must match `data-categories` in `/products/index.html`.

**Filter dropdown in `/products/index.html` (2026-05-18):**
- Value = slug matches `data-categories` attribute on `.product-card` articles.
- EN dropdown values: `sheets`, `duvet-covers`, `pillowcases`, `protection`, `accessories`, `marine`, `family`, `pets`, `deep-pocket`, `boarding-dorm`, `rv-truck`
- TH dropdown adds `/th/` prefix to each href.
- Tag format: `data-categories="sheets,marine,pets"` (comma-separated slugs, no spaces.
- Product type slug (first in list) = the primary category the product belongs to.
- A product appears on ALL category listing pages whose slug matches any value in its `data-categories` attribute.

**Video badge** (`card-video-badge`): used for measurement guide cards (links to `/custom-measurement/`). Contains inline SVG play icon + "VIDEO" text.

### Pricing Panel

Structure:
1. **Select Region** → enables Standard Size dropdown
2. **Standard Size** → populated from `SIZES_BY_REGION` JS object
3. **Depth / Pocket Height** (optional for fitted/flat/protectors)
4. **Fabric Collection** or **Fabric Badge** (restricted pages)
5. **Price Display** → shows selected price or "Custom quote"
6. **Custom Shape CTA** → dashed-border box with CTA button

### Fabric Rules Per Category
| Category | Fabric Options |
|---|---|
| Sheets | All 4: BreezePlus, CloudSoft, PremaCotton, EcoLuxe |
| Duvet Covers | BreezePlus only (badge, no selector) |
| Pillowcases | All 4: BreezePlus, CloudSoft, PremaCotton, EcoLuxe |
| Protection | BreezePlus + CloudSoft (TPU badge) |
| Accessories | All 4 (BedBridge) |
| Marine & Yacht | CloudSoft only (badge, no selector) |
| Family & Co-Sleep | All 4: BreezePlus, CloudSoft, PremaCotton, EcoLuxe |
| Pet Owner Bedding | BreezePlus only (badge, no selector) |
| Deep Pocket | All 4: BreezePlus, CloudSoft, PremaCotton, EcoLuxe |
| Boarding Dorm | BreezePlus only (badge, no selector) |
| RV & Truck Cab | CloudSoft only (badge, no selector) |

### Custom Shape CTA — Links
| Page | CTA Link |
|---|---|
| Fitted Sheets, Flat Sheets, Mattress Protectors, Protection, Deep Pocket | `/how-to-measure-mattress-size/` |
| Marine & Yacht, Family, Pets, RV & Truck, Pillowcases | `/custom-measurement/` |

### Price Display Note
Every price display includes: *"Price excludes shipping, tax & tariff"*

### D1 `products` Table — Tags Field
Added in migration `002_add_tags.sql`:
```sql
ALTER TABLE products ADD COLUMN tags TEXT DEFAULT '';
```
Tags format: comma-separated cross-sell category names.
Example: `"Family, Duvet, Marine, Pets"` for 3-Sided Zipper Duvet Cover.

Tags are driven by the `data-categories` attribute on each product article in `/products/index.html`, NOT a D1 column.
Valid tag slugs: `sheets`, `duvet-covers`, `pillowcases`, `protection`, `accessories`, `family`, `pets`, `marine`, `rv-truck`, `boarding-dorm`, `deep-pocket`, `duvet`

Migration `003_seed_products.sql` seeds all 15 products with their tags.

---

## Product Catalog System (2026-05-18)

### Architecture: JSON as Build-Time Source of Truth

Product data lives in **`data/products.json`** — a single JSON file that drives all static pages.

```
data/products.json
       │
       ├──► scripts/regenerate-products.js
       │         │
       │         ├──► public/products/index.html        (EN shop, 27 cards)
       │         ├──► public/th/products/index.html     (TH shop, 27 cards)
       │         ├──► public/sheets/index.html          (EN type, 9 cards)
       │         ├──► public/pillowcases/index.html    (EN type, 3 cards)
       │         ├──► public/marine/index.html          (EN niche, 7 cards)
       │         ├──► public/family/index.html         (EN niche, 8 cards)
       │         └──► ...all type + niche pages (EN + TH)
```

**D1 `products` table is separate** — it stores orders/custom dimensions from Phase 5+. The JSON drives the storefront catalog pages only.

### JSON Schema (`data/products.json`)

```json
{
  "products": [
    {
      "slug": "pillowcase-envelope",
      "name": "Envelope Pillowcase",
      "nameTh": "ถุงหมอนแบบซอง",
      "categories": ["pillowcases", "marine", "family", "pets", "deep-pocket", "boarding-dorm", "rv-truck"],
      "priceUsd": 16,
      "priceThb": 565,
      "image": "/images/products/pillowcase-envelope/main.jpg",
      "url": "/product/pillowcase-envelope/",
      "urlTh": "/th/product/pillowcase-envelope/"
    }
  ]
}
```

**`categories[]` array drives everything:**
- `data-categories` attribute on `/products/` cards
- Card tags (primary type first, niche tags second)
- Which niche pages the card appears on
- Filter dropdown counts

### Tag Rules (verified 2026-05-18)

| Page Type | Tag Rule | Example |
|---|---|---|
| `/products/` shop | All tags from `categories[]` | `PILLOWCASES` `MARINE` `FAMILY` `PETS` ... |
| `/pillowcases/` type page | `PILLOWCASES` only (no niche tags) | `PILLOWCASES` |
| `/sheets/` type page | `SHEETS` + niche tags | `SHEETS` `MARINE` |
| Niche page (`/marine/`, `/family/`, etc.) | Primary type + current niche | `PILLOWCASES` `MARINE` |
| **No DUVET tag** on pillowcase cards | DUVET is for Duvet Cover products only | — |

### Regenerator Command

```bash
node scripts/regenerate-products.js

# Output:
# ✅ 23 pages updated, 189 cards generated
# 🔍 Filter consistency check:
#   sheets         → 9 products
#   duvet-covers  → 6 products
#   pillowcases    → 3 products
#   protection     → 7 products
#   accessories   → 2 products
#   marine        → 7 products
#   family        → 8 products
#   pets          → 8 products
#   deep-pocket   → 7 products
#   boarding-dorm  → 6 products
#   rv-truck      → 8 products
```

### Adding a New Product

1. Add entry to `data/products.json`
2. Add image to `public/images/products/<slug>/main.jpg`
3. Run: `node scripts/regenerate-products.js`
4. All 23 pages auto-update

### Product Dashboard (Phase 7 — Future)

Admin CRUD interface that edits `data/products.json`:
- Title (EN + TH)
- Description (EN + TH)
- Tags: dual dropdown (Product Type + Niche Category) — populated from JSON metadata
- Images: drag & drop (up to 10 per product) → uploads to R2
- Video: optional URL field
- Prices: per Size + Fabric matrix

D1 schema remains unchanged — serves order/custom-dimension storage from Phase 5+.

---

## Product Detail Page Specification (Phase 4 — Updated 2026-05-15)

Every product detail page (`/product/[slug]/`) uses this layout:

### Page Structure

```
[BRAND HERO]                    ← Blue gradient + blueprint grid (same as /contact/)
  H1: {Product Name}
  Sub: {Product-specific tagline}

[PRODUCT LAYOUT — 2-column grid]
  Left: Product Gallery (sticky)
  Right: Product Info Panel
    ├── Breadcrumb
    ├── Product Title (H1)
    ├── Tagline
    ├── Pricing Panel (bordered card)
    │   ├── Step 1: Size (dropdown with optgroups by region, region-aware formatting)
    │   ├── Step 2: Fabric (swatch selector OR fabric specs grid for locked-fabric products)
    │   ├── Step 3: Color (per-fabric color dots in 6-col grid, follows fabric selection)
    │   ├── Price Display (฿X,XXX / $XX)
    │   ├── Add to Cart + Custom Size buttons
    │   ├── Custom Dimensions panel (toggle expand)
    │   │   ├── Width / Length / Depth inputs
    │   │   ├── Unit toggle (cm / inch)
    │   │   ├── Live price estimate
    │   │   └── [Custom Quote] button → popup form (Name*, Email*, Address, Telephone)
    │   └── Payment badges (Visa/MC, Secure checkout)
    ├── Trust Signals (2×2 grid of icons)
    └── Trust Badges row

[PRODUCT TABS — accordion below fold]
  Description | Fabric Details | Size Guide | Care

[REVIEWS SECTION]
  Rating summary (score + stars + count)
  2-column grid of review cards

[RELATED PRODUCTS — 4 cards horizontal]
  4 related product cards

[FOOTER — 4-col global]
```

### Hero (Consistent with /contact/)

```css
background: linear-gradient(135deg, #2c96f4 0%, #1a7fd4 100%);
padding: 72px 24px 56px;
```

### Pricing Panel (`.pricing-panel`)

- White background, bordered card, 28px padding
- **Size selector**: Single dropdown with optgroups per region. Flag emoji on optgroup labels. Region-aware formatting: US/CA shows imperial only ("39×75″"), all others show metric ("90×190 cm").
- **Size dropdown**: Shows optgroups per country/region. Selected size updates price instantly.
- **Custom Size toggle**: Button reveals custom dimension inputs (W × L × D + unit toggle + live estimate + Submit for Custom Quote)
- **Add to Cart button**: Blue filled, disabled until size selected. Shows "Added!" with green background for 2 seconds after click.
- **Custom Size button**: Blue outline, toggles custom dimensions panel.

### Fabric Rules Per Product Type

| Product | Fabric Options |
|---|---|
| Pet Owner (Fitted/Duvet) | BreezePlus only (specs grid: Pet Hair Resistant, 3-5°C Cooler, 50/50 Blend) |
| Marine & Yacht (Fitted/Duvet) | CloudSoft only (specs grid: Quick-Dry, Moisture-Wicking, 100% Cotton) |
| RV & Truck (Fitted/Duvet) | CloudSoft only (specs grid) |
| Fitted Sheets (other) | All 4: fabric dropdown + per-fabric color selector |
| Flat Sheets | All 4: fabric dropdown + per-fabric color selector |
| Duvet Covers (other) | All 4: fabric dropdown + per-fabric color selector |
| Pillowcases | All 4: fabric dropdown + per-fabric color selector |
| Mattress Protectors (4) | 3-layer specs grid (Cotton Quilted + Polyester Filling + TPU Waterproof), no fabric selection |
| Mattress Encasements (2) | TPU specs grid (TPU Waterproof Membrane + Water Spills & Accidents), no fabric selection |
| Pillow Protector | TPU specs grid, no fabric selection |
| BedBridge Connector, Bed Lifter, Duvet Insert | Fixed-price, no fabric selection |

### Color Selector

Per-fabric color swatches matching `/fabric/` data in a 6-column CSS grid:
- **BreezePlus** (9): Dark Grey, Silver, Sand, Sky, Emerald, Sea, Pure White, Baby Pink, Ivory
- **CloudSoft** (12): Mint, Charcoal, Grey, Sapphire, Forest, Denim, RoseGold, Beige, Ovaltine, White, Lavender, Olive
- **PremaCotton** (1): Snow White
- **EcoLuxe** (1): Vanilla Linen

All swatches have visible border + inset shadow for white/light color visibility.
Selected dot gets 3px blue border + glow ring. Swatches swap when fabric selection changes. Default visible set matches product's locked fabric or first fabric.

### Gallery

- Main image (4:3, sticky on scroll above fold)
- Thumbnail strip (5 max) with video thumb option
- Badge overlay (top-left): BEST SELLER / ANTI-FUR / WATERPROOF etc.
- Clicking video thumb opens YouTube in new tab

### Tabs (Description, Fabric Details, Size Guide, Care)

- Active tab: CI Blue bottom border
- Content panel shows/hides on click (no animation)

### Reviews Section

- Summary card: large score number + star row + text
- Review cards: avatar circle (initials), name, country, star rating, review text, verified purchase label

### Related Products

- 4 cards in responsive grid
- Card: image (4:3) + title + price + price note

### Custom Quote Flow (Implemented 2026-05-19)

Custom dimensions panel expands on "Custom Size" button click.
Unit toggle (cm/inch) converts all input labels.
"Custom Quote" button (renamed from "Submit for Custom Quote →") opens a popup modal form:
- Name* + Email* + Address + Telephone + [Submit]
- Validates required fields client-side
- POSTs to `/api/quote`
- Quote stored in `custom_quotes` table + email saved to `subscribers` (dedup)
- Resend notification sent to `contact@mildmate.com`
- Confirmation popup shows email, dimensions, fabric, quote ID
- [OK] dismisses

### Add to Cart Flow (Phase 5 stub)

"Add to Cart" button disabled until size selected.
On click: button text changes to "Added!" with green background for 2 seconds, then reverts.
Real cart logic stored in `cart.js` localStorage with product details + dimensions.

---

## Updated File Structure (2026-05-19)

New catalog system files + configurator:

```
├── data/
│   ├── products.json              ← MASTER PRODUCT DATA (single source of truth)
│   ├── templates.json             ← HTML card templates
│   └── HOW_TO_USE.md             ← Catalog system documentation
├── scripts/
│   ├── build-products.js          ← Full page generator (initial build)
│   └── regenerate-products.js     ← Incremental updater (run after JSON changes)
├── public/js/
│   ├── configurator.js            ← Homepage configurator
│   └── product-configurator.js    ← Shared product page configurator (4 fitted sheet products)
```

All existing pages remain in `public/`. The regenerator overwrites only the product grid sections in each page — hero, descriptions, footer, and all other content is preserved.
