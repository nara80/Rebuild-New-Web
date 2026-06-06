# MildMate Web Rebuild â€” Full Framework Plan

## Stack Confirmed
- **Frontend:** Vanilla HTML + CSS + minimal JS
- **Backend:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 + Storage R2
- **Deploy:** `mildmate-new.pages.dev` â†’ cutover to `www.mildmate.com` when 100% done
- **Email:** Resend (free tier: 100/day, `RESEND_API_KEY` required as Pages secret)
- **Payments:** Stripe (USD + PromptPay THB natively)
- **Admin auth:** Clerk (Google / Facebook / Email login)
- **Order tracking:** Option A â€” carrier code + tracking number entered by admin on shipped, URL auto-generated from templates (thaipost, flash, dhl, ups, fedex, usps). No external API needed. Tracking shown inline in `/account` Orders panel.

---

## Frontend Design System

### Brand Tokens (CSS Variables) â€” Updated 2026-05-21
```css
--color-primary: #2c96f4;       /* CI Blue â€” interactive elements only */
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

**Font pairing (bilingual):** Quicksand (EN) + Sarabun (TH) â€” loaded together via Google Fonts, CSS `:lang(th)` applies Sarabun automatically.

---

## Complete Site Pages Overview

### Static Pages (manually authored HTML)
| Page | URL | Status |
|---|---|---|
| Homepage EN | `/` | âœ… Built |
| Homepage TH | `/th/` | âœ… Built |
| About Us | `/about/` | âœ… Built |
| Contact | `/contact/` | âœ… Built |
| Fabric Collections | `/fabric/` | âœ… Built |
| Size Guide EN | `/sizeguide/` | âœ… Built |
| Size Guide TH (#1 SEO) | `/th/sizeguide/` | âœ… Built via redirect: `/th/mattress-size-th/*` â†’ `/th/sizeguide/` |
| How to Measure | `/how-to-measure-mattress-size/` | âœ… Built |
| Shipping Policy | `/shipping/` | âœ… Built |
| Privacy Policy | `/policy/` | âœ… Built |
| Customer Reviews | `/reviews/` | âœ… Built |
| Checkout | `/checkout/` | âœ… Built |
| Order Confirmed | `/order-confirmed/` | âœ… Built |
| My Account | `/account/` | âœ… Built |
| Order Tracking | Inline in `/account/` Orders panel | âœ… Built â€” Option A (carrier code + tracking number, auto-generated carrier URL, no external API needed) |
| All 258 WP URLs | various | Phase 2 redirect file â€” pre-launch after Phase 8 |

### Blog Pages (static HTML, managed manually)
| Page | URL | Status |
|---|---|---|
| Blog Index | `/blogs/` | âœ… Built â€” featured + 11-card grid, filter tabs, pagination (12/page) |
| Blog Pagination | `/blogs/page/2/` | âœ… Built |
| Blog Post Template | `/blogs/template/index.html` | âŒ Not a live file â€” used to generate posts, then deleted |
| Blog Post Sample | `/blogs/v-berth-sheets-vs-standard/` | âœ… Built |
| Individual Blog Post | `/blogs/[post-slug]/` | Copy from template when adding new posts |

### Dynamic Pages (data from Cloudflare D1)

**Shop by Product â€” 5 categories (primary navigation, SEO discoverability)**
| Category | URL | Products |
|---|---|---|
| Sheets | `/sheets/` | Standard, Deep Pocket, Marine, Dorm, RV & Truck, Family, Pet Owner (Fitted) + Standard, Extra Deep Pocket (Flat) â€” 9 products |
| Duvet Covers | `/duvet-covers/` | 3-Sided Zipper, Pet Owner, Marine, RV, Dorm, Duvet Insert â€” 6 products |
| Pillowcases | `/pillowcases/` | Envelope, Zipper, Sham â€” 3 products |
| Protection | `/protection/` | Standard, Family, Deep Pocket, Pet-Proof, 6-Sided Encasement, RV & Truck Encasement, Pillow Protector â€” 7 products |
| Accessories | `/accessories/` | BedBridge Connector, Bed Lifter â€” 2 products |

**Shop by Niche â€” 6 categories (use-case landing pages, high-conversion)**
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
| Page | URL | Status |
|---|---|---|
| Admin Hub | `/admin/` | âœ… Built â€” role cards linking to super-admin.html + admin.html |
| Super Admin | `/admin/super-admin.html` | âœ… Built â€” products CRUD, orders, R2 upload, pricing params, marketing, customers (D1), subscribers |
| Admin | `/admin/admin.html` | âœ… Built â€” orders, products, subscribers, customers (D1) |

---

## Site Layout Blueprint

### Header (Sticky)

**Desktop (â‰¥1025px):**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ [Logo 64px]   [Home] [Shop] [Fabrics] [Size Guide]   [ðŸ”][ðŸ‘¤][ðŸ›’][EN/TH] â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```
- Logo left, nav center, actions right
- Sticky on scroll (shrinks from 80px â†’ 60px)
- Nav text: 1.2rem, weight 600, Quicksand
- Actions: Search â†’ Account â†’ Cart â†’ EN/TH
- Icons: 20px inline SVGs, blue hover

**Mobile (â‰¤1024px):**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ [â˜°]        [   Logo (centered)   ]   [ðŸ”][ðŸ‘¤][ðŸ›’][EN/TH] â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```
- Hamburger far left, logo centered, actions right
- Nav hidden â€” replaced by hamburger drawer
- Icons: 18px default, 16px on â‰¤480px
- Drawer slides in from **left**

### Navigation Menu
```
Home | Shop | Fabrics | Size Guide
```

**Simplified nav (no dropdowns in current build):**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Marine & Yacht    â”‚ Family & Co-Sleep            â”‚
â”‚ â€¢ V-Berth Sheets  â”‚ â€¢ Family Fitted Sheets       â”‚
â”‚ â€¢ Marine Pillows  â”‚ â€¢ BedBridge Connector        â”‚
â”‚ â€¢ Boat Duvets     â”‚ â€¢ Co-Sleep Duvets            â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Deep Pocket       â”‚ Boarding Dorm                 â”‚
â”‚ â€¢ Deep Pocket     â”‚ â€¢ Parents Buying for Kids Abroad â”‚
â”‚ â€¢ Adjustable Base â”‚ â€¢ 3-Sided Zipper Duvet          â”‚
â”‚                   â”‚ â€¢ Mattress Encasement        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Fabrics Dropdown:**
```
BreezePlus | CloudSoft | PremaCotton | EcoLuxe
```

---

## Custom Configurator Specification

The configurator appears on every **Product Detail page** (`/product/[slug]/`). It has two modes selectable by tab.

### Mode A â€” Fitted Bed Sheet (rectangular)
| Input | Label | Unit Toggle |
|---|---|---|
| Width | W | cm / inch |
| Length | L | cm / inch |
| Depth | D (pocket height) | cm / inch |

### Mode B â€” V-Berth Boat Sheet (trapezoidal)
| Input | Label | Description | Unit Toggle |
|---|---|---|---|
| Head Width | Head | Narrow end (bow) | cm / inch |
| Foot Width | Foot | Wide end (cabin entry) | cm / inch |
| Length | L | Bow to stern (center line) | cm / inch |
| Depth | D | Mattress thickness | cm / inch |

**V-Berth pricing formula:** `((Head + Foot) / 2) Ã— Length` = trapezoid area â†’ Ã— fabric rate per cmÂ²

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
       â†“
Enters custom WÃ—LÃ—D + selects fabric
       â†“
Clicks "Custom Quote" (inside custom dimensions panel)
       â†“
Popup Form: Name* + Email* + Address + Telephone
       â†“
[Submit] â†’ POST /api/quote â†’ D1 custom_quotes (status='pending')
                            â†’ D1 subscribers (INSERT OR IGNORE dedup)
                            â†’ Resend email to contact@mildmate.com
       â†“
Confirmation popup: "We'll email you@... within 24 hours."
  Dimension: W Ã— L Ã— D cm   Fabric: CloudSoft   Quote ID: QT-250519-001
       â†“
[OK] dismisses popup
       â†“
ADMIN: Receives email â†’ Review in dashboard â†’ set quoted_price â†’ approve
       â†“
Customer receives email: "Your quote QT-250519-001 is ready â€” $89.00"
       â†“
Magic link: /quote/QT-250519-001  (Phase 5+)
       â†“
Customer opens link â†’ sees locked quote with "Add to Cart â€” $89.00"
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
| `status` | pending â†’ approved / rejected / expired |
| `quoted_price` | Admin enters price in cents (e.g., 8900 = $89.00) |
| `expires_at` | Auto-set to 7 days from creation; admin can extend |

---

## Blog Template Specifications

### Image Sizes â€” Quick Reference
| Image | Used Where | Required Size | Format | Max Size |
|---|---|---|---|---|
| Hero / Banner | Top of blog post | 1200 Ã— 500 px (2.4:1) | JPG/WebP | 400 KB |
| Card Thumbnail | Blog index cards + Related posts | 800 Ã— 534 px (3:2) | JPG/WebP | 200 KB |
| Inline Post Image | Inside article body | 1200 Ã— 675 px (16:9) | JPG/WebP | 300 KB |
| Author Avatar | Bio box + post meta | 160 Ã— 160 px (1:1) | JPG/WebP | 50 KB |

### Blog Index Layout
- 3-column grid desktop, 2-column tablet, 1-column mobile
- 12 posts per page
- Pagination: First â† | Prev | 1 2 3 â€¦ N | Next | Last â†’
- Category filter bar: All Â· Marine & Yacht Â· Family Bedding Â· Care Tips Â· Size Guides Â· News
- Each card: Thumbnail (800Ã—534) + Category tag + Title + Excerpt (3 lines) + Date + Read Time

### Blog Post Layout
- Breadcrumb: Home â€º Blog â€º Category â€º Title
- Hero banner (1200Ã—500) â€” full width
- Two-column: Article body (left) + Sidebar (right)
- Sidebar: Recent Posts + Categories + CTA widget (configure your sheet)
- Related Posts: 3 cards at bottom (reuse card thumbnail)
- Post navigation: â† Previous Post | Next Post â†’

### Per-Post Content Required
| Field | Required | Spec |
|---|---|---|
| Title | Yes | Max 100 characters (under 60 for SEO) |
| Hero / Banner Image | Yes | 1200 Ã— 500 px |
| Card Thumbnail | Yes | 800 Ã— 534 px (reused for index, related posts) |
| Category | Yes | One of the 5 category options |
| Excerpt / Meta description | Yes | 120â€“160 characters |
| Body Content | Yes | Min 400 words, supports H2, p, ul, blockquote |
| Publish Date | Yes | YYYY-MM-DD |
| URL Slug | Yes | /blogs/[lowercase-hyphenated-english]/ |
| Inline Images | Optional | 1200 Ã— 675 px, max 3 per post |
| Tags | Optional | 3â€“6 short keywords |
| Author Name | Optional | Default: "MildMate Team" |

---

## Page-by-Page Layout

### 1. Homepage (`/index.html`) â€” Redesigned 2026-05-21

```
[HEADER]  â† sticky, 95% opacity + backdrop-blur on scroll
  Logo left | Home / Shop / Fabrics / Size Guide center | Search / Account / Cart / EN-TH right

[HERO]  â† full-bleed lifestyle image + light gradient overlay
  Headline: "Bedding Made Easy Again" + "Any Size, Any Shape" (dark text)
  CTA: "Shop All Products" (centered, 5px below heading)
  Mobile: 1:1 square image first, text below (30px lower, 10px gap)

[TRUST BAR]  â† 4 icons on #F8FAFC background
  Precision Fit | Global Delivery | Top-Rated | Sensitive Skin Friendly

[SHOP BY PRODUCT]  â† 5 cards, 4-col grid
  Sheets | Duvet Covers | Pillowcases | Protection | Accessories

[SHOP BY NICHE]  â† 4 cards (verified 2026-05-28): Marine & Yacht / Family & Co-Sleep / Specialized Protection / Duvet Covers
  Mobile: horizontal swipe strip, 220px min-width cards
  (Note: 6-card grid was planned; actual build uses 4 cards. Deep Pocket / Boarding Dorm / RV & Truck / Pet Owner are accessible via SHOP BY PRODUCT category links instead.)

[FABRIC INTELLIGENCE]  â† lateral comparison grid (2026-05-21)
  4-column comparison: Feature | BreezePlus | CloudSoft | PremaCotton | EcoLuxe
  Rows: Material | Cooling | Best For | Colors (swatches)
  No tabs â€” all fabrics visible side-by-side for instant scanning

[MOST POPULAR]  â† horizontal scroll carousel, 5 product cards

[SOCIAL PROOF]  â† reviews carousel + 5â˜… Etsy badge

[EMAIL SIGNUP]  â† blue gradient, "Get 15% Off Your First Order"

[FOOTER]  â† 4-col global, deep navy #001d3d
```

### 2. Blog Index (`/blogs/`)

```
[PAGE HERO]  "The MildMate Blog" + short tagline

[FILTER BAR]  All | Marine & Yacht | Family Bedding | Care Tips | Size Guides | News

[POST GRID]  3-col desktop, 2-col tablet, 1-col mobile
  Card: Thumbnail (800Ã—534) | Category tag | Title | Excerpt | Date | Read time | Read â†’

[PAGINATION]
  âŸµ First | â† Prev | 1  2  3  â€¦  N | Next â†’ | Last âŸ¶
  "Showing posts Xâ€“Y of Z total"
```

### 3. Blog Post (`/blogs/[slug]/`)

```
[HEADER + BREADCRUMB]  Home â€º Blog â€º Category â€º Post Title

[HERO BANNER]  1200 Ã— 500 px â€” full width

[TWO-COLUMN LAYOUT]
  Left (main):
    Category tag | H1 Title
    Author | Date | Read Time | Share icons
    Article body (H2, paragraphs, inline images 1200Ã—675, blockquotes, lists)
    Tags
    Author bio box (avatar 160Ã—160 + name + bio)
  
  Right (sidebar, sticky):
    Recent Posts widget
    Categories widget
    CTA widget: "Get a Custom Quote" â†’ configurator

[RELATED POSTS]  3 cards (same thumbnail spec as index)

[PREV / NEXT POST NAVIGATION]
```

### 4. Product Listing (`/products/`, category pages)

```
[FILTER BAR]  Category | Fabric | Size Region (TH/US/UK/EU/AU)
[PRODUCT GRID]  3-col desktop, 2-col mobile â€” data pulled from D1
  Card: Image | Title | Price (THB or USD) | "View Options" CTA
```
> Category pages (`/marine/`, `/family/`, `/deep-pocket/`, `/pets/`, `/boarding-dorm/`, `/rv-truck/`) render the same grid pre-filtered by category. **All data is driven from `data/products.json`** via `scripts/regenerate-products.js`. Run the regenerator after any change to the JSON file.

### 5. Product Detail (`/product/[slug]/`)

**Two distinct purchase paths on every product page:**

**Path A â€” Standard Size (Instant Add to Cart)**
```
[PRODUCT INFO]
  Title (TH/EN toggle)
  Fabric badge + short description

[STANDARD SIZE SELECTOR]
  Step 1: Size (dropdown with region optgroups â€” US/CA: imperial, others: metric)
    [â—‹] Twin/Single 39Ã—75â€³      [â—‹] Full/Double 54Ã—75â€³
    [â—] Queen 60Ã—80â€³            [â—‹] King 76Ã—80â€³

  Step 2: Fabric & Color
    [â—] PremaCotton  [â—‹] BreezePlus  [â—‹] CloudSoft  [â—‹] EcoLuxe
    Color swatches (follow fabric selection, 6 per row)

  Price: $49.00     [         Add to Cart          ]
```

**Path B â€” Custom Size (Quote Required)**
```
[Need a custom size? Click here â†’]
  â†“ (expands)
[CUSTOM CONFIGURATOR]
  Tab: [ðŸ› Fitted Bed Sheet] [âš“ V-Berth Boat Sheet] [ðŸš› Truck Cab] [ðŸ‘¨â€ðŸ‘©â€ðŸ‘§ Family / Co-Sleep] [ðŸš RV]
  Unit toggle: cm / inch  (geo-defaulted, localStorage persisted)
  Measurement diagram beside inputs (SVG switches per tab)
  Fabric swatches (4 options)
  Color selector
  Live ESTIMATE price (via Worker API)
  Note: "Price excludes shipping & import tariff. Final price confirmed after quote approval."
  [Submit for Custom Quote]

  â†’ Quote stored in `custom_quotes` table
  â†’ Admin approves â†’ customer receives magic link â†’ adds locked price to cart
```

[MEASUREMENT GUIDE]  â† inline collapsible
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

[CTA]  â†’ Shop Custom Bedding
```

### 7. Contact (`/contact/`)

```
[CONTACT FORM]  Name | Email | Subject | Message | Send

[CONTACT CHANNELS]
  ðŸ’¬ LINE Official    â€” [LINE link]
  ðŸ“± WhatsApp         â€” [WhatsApp link]
  ðŸ“˜ Facebook         â€” [Facebook page link]

[MARKETPLACE LINKS]  â† Icon row
  ðŸ›ï¸ Etsy  |  ðŸ›’ eBay  |  ðŸ›ï¸ Shopee  |  ðŸ“¦ Lazada  |  ðŸŽµ TikTok Shop

[LOCATION / ABOUT]  Made in Thailand â€” brief note
```

### 8. Fabric Collections (`/fabric/`)

```
[PAGE HERO]  "Our Fabrics" headline

[4 FABRIC TABS]  BreezePlus | CloudSoft | PremaCotton | EcoLuxe
  Each tab panel:
    Full-width fabric visual
    Name + tagline
    Extended description
    Feature list (5â€“6 items)
    Color options grid
    Certifications (OEKO-TEX, Siriraj where applicable)
    CTA â†’ Shop [Fabric Name] products

**BreezePlus Color Palette (9 swatches):**
Dark Grey #4D545B | Silver #B7BEC8 | Sand #D9D1C1 | Sky #9CCAE1 | Emerald #618283 | Sea #5A7DA2 | Pure White #FFFFFF | Baby Pink #E9B7BF | Ivory #F1EFE1

**EcoLuxe Note:** Calico / Greige cotton â€” natural unbleached, minimal processing. Not GOTS-certified.

[FABRIC COMPARISON TABLE]  Side-by-side spec comparison of all 4
```

### 9. Size Guide Pages (SEO Hub)

**Architecture: Country-First Progressive Disclosure**

**Landing page** (`/sizeguide/`):
```
Step 1: Select Your Country / Region
  ðŸ‡ºðŸ‡¸ US/Canada    ðŸ‡¬ðŸ‡§ UK    ðŸ‡ªðŸ‡º EU    ðŸ‡¦ðŸ‡º Australia
  ðŸ‡¹ðŸ‡­ Thailand     ðŸ‡²ðŸ‡¾/ðŸ‡¸ðŸ‡¬ MY/SG    ðŸ‡®ðŸ‡³ India    ðŸ‡¯ðŸ‡µ Japan
  [ðŸŒ Other / Not Sure?]

Step 2: Select Your Mattress Type
  Standard Mattress | Family / Co-Sleep | Marine | Truck Cab | RV

Step 3: Pick Your Size
  [Only 4â€“6 sizes relevant to that country + type]
  Each size label shows BOTH units: "Queen  153 Ã— 203 cm / 60 Ã— 80 in"

[â†’ CTA: Shop this size  /  â†’ CTA: Need custom? Measure â†’]
```

**Deep pages:**
```
/mattress-size-th/             â† #1 traffic page, Thai SEO hub
/how-to-measure-mattress-size/
/mattress-size/                â† International size tables by country tab
/bed-sheets-size/              â† Duvet + pillow sizing
```

**Unit display rule:** Every size label shows BOTH `cm` and `inch` simultaneously â€” no toggle needed. Geo unit preference (cm vs inch) is stored in `localStorage` and used for configurator inputs only.

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

[RATING BADGE]  5.0 â˜…â˜…â˜…â˜…â˜… â€” verified reviews

[REVIEW GRID]  3-col desktop â€” curated reviews with star rating, text, name, country

[ETSY BADGE]  Link to Etsy shop reviews
```

### 13. Checkout (`/checkout/`)

```
[STEP 1: CART REVIEW]  â† 65/35 split (cart left, order summary sidebar right)
  Items, dimensions, fabric, color, qty, line total
  Google sign-in banner (optional â€” pre-fills shipping form)
  "Continue as guest" default path
  Order summary sidebar: subtotal, grand total, [Continue to Shipping]

[STEP 2: SHIPPING DETAILS]  â† email captured HERE for abandoned cart
  65/35 grid: form left, order summary sidebar right
  Floating label inputs (48px min-height, CI colors: #F8FAFC bg, #1E293B text)
  Row 1: First Name* | Last Name*     (autocomplete: given-name, family-name)
  Row 2: Email*       | Phone*        (autocomplete: email, tel-national + tel-country-code)
  Row 3: Street Address*              (autocomplete: street-address)
  Row 4: Apt/Suite    | Country*      (autocomplete: address-line2, country â€” 61 countries)
  Row 5: City*        | Postal Code*  (autocomplete: address-level2, postal-code)
  Row 6: Province/State*              (autocomplete: address-level1)
  Valid checkmarks on required fields (blue circle âœ“)
  Phone: country code select + number input (auto-detected from geo)
  [Back to Cart] [Review & Pay]

[STEP 3: PAYMENT]  â† 65/35 split
  Order Summary card: items list + grand total
  [Proceed to Payment] â†’ redirects to Stripe Checkout (hosted)
  "Secured by Stripe. We never store your card details."
  Order summary sidebar (sticky)
  [Edit Details]
```

**Social Login (Optional â€” No Forced Login):**
- Customers can check out as guests without any login
- Google sign-in button shown at Step 1 (Clerk)
- Logging in pre-fills name + email in shipping form
- Account creation is encouraged *after* purchase, not required before

**Long-term Option 3 (confirmed):**
- Move to Clerk Production instance + custom auth domain before go-live
- Enforce centralized bearer-token auth for `/api/auth/me` + `/api/customers/*` across checkout/account pages
- Keep explicit sign-out CTA on checkout/account (not only profile menu) for account switching and QA reliability

### 14. Admin Dashboard (`/admin/`) â€” protected by Clerk (Option A)

**Auth (Option A â€” implemented):** `functions/admin/_middleware.ts` verifies Clerk JWT on every request to `/admin/*`. Checks for admin/super-admin role claims or email in `ADMIN_EMAILS` env var. Non-admins redirected to Clerk sign-in; non-admin authenticated users see a 403 page. Dev mode (pages.dev/localhost) bypasses middleware (relies on client-side gate instead). API endpoints (`/api/admin/*`) are independently protected server-side via `authorizeAdmin()`.

**Planned (Option B):** Cloudflare Access zero-trust policy in front of `/admin/*` â€” Cloudflare handles identity verification before requests reach the Worker. Adds defense-in-depth without code changes. Requires Cloudflare Teams (free for up to 50 users).

```
Sidebar: Dashboard | Products | Orders | Images | Subscribers

[ORDERS PAGE]  â† manufacturing team view
  Table: Date | Customer | Product | Sheet Type | Dimensions | Fabric | Color | Status
  Sheet Type: Fitted Bed Sheet â†’ shows W Ã— L Ã— D
             V-Berth â†’ shows Head Ã— Foot Ã— L Ã— D
  Filter by: pending / in-production / shipped

[PRODUCTS PAGE]
  Card grid: product name | price USD/THB | active toggle | Edit button
  Edit modal: title TH / title EN / prices / fabric options

[IMAGE UPLOADER]
  Drag & drop zone â†’ uploads to R2 â†’ returns CDN URL

[SUBSCRIBERS]
  Email list table + "Export CSV" button
```

### Footer Layout

**Minimal, modern, premium style â€” deep navy #001d3d background**

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Quick Links   Customer Service   Shop With Us     Contact  â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€  â”‚
â”‚  About Us      FAQ                [Etsy][eBay]     âœ‰ email â”‚
â”‚  Contact Us    Size Guide         [Shopee][Lazada] â˜Ž phone â”‚
â”‚  Reviews       Blog                                     [WA][LINE] â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚           [FB] [IG] [TikTok] [Pinterest] [YouTube]         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Â© MildMate 2026          Privacy Policy | Shipping        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```
> **Design rules:** No logo or description block. Icon-only marketplace links (44px circles, 22px icons, blue hover). Social icons centered in their own row (same circular style). LINE/WhatsApp icon-only buttons under phone number. No LINE sticky bar (removed for international positioning).

---

## Project Folder Structure

```
mildmate-web/
â”œâ”€â”€ AGENTS.md
â”œâ”€â”€ Framework.md
â”œâ”€â”€ wrangler.toml
â”œâ”€â”€ package.json
â”œâ”€â”€ blog-mockup.html           â† Not in project root (kept in design assets if needed)
â”œâ”€â”€ mockup.html                â† Not in project root (design reference only)
â”‚
â”œâ”€â”€ functions/                        â† Pages Functions (local dev bridge)
â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â””â”€â”€ [[path]].ts               â† API catch-all â†’ Worker handlers
â”‚   â”œâ”€â”€ account/
â”‚   â”‚   â””â”€â”€ _middleware.ts            â† Clerk auth gate for /account/*
â”‚   â”œâ”€â”€ admin/
â”‚   â”‚   â””â”€â”€ _middleware.ts            â† Clerk admin-role gate for /admin/*
â”‚   â””â”€â”€ quote/
â”‚       â””â”€â”€ [[path]].ts               â† Magic quote link: /quote/QT-XXXXX/

â”œâ”€â”€ public/                          â† Cloudflare Pages static files
â”‚   â”œâ”€â”€ index.html                   â† Homepage EN
â”‚   â”œâ”€â”€ th/index.html                â† Homepage TH
â”‚   â”‚
â”‚   â”œâ”€â”€ about/index.html
â”‚   â”œâ”€â”€ contact/index.html
â”‚   â”œâ”€â”€ fabric/index.html
â”‚   â”œâ”€â”€ shipping/index.html
â”‚   â”œâ”€â”€ policy/index.html
â”‚   â”œâ”€â”€ reviews/index.html
â”‚   â”œâ”€â”€ checkout/index.html
â”‚   â”œâ”€â”€ order-confirmed/index.html
â”‚   â”œâ”€â”€ account/index.html          â† My Account (order history, social login)
â”‚   â”œâ”€â”€ products/index.html
â”‚   â”œâ”€â”€ marine/index.html            â† Niche landing (from `data/products.json`)
â”‚   â”œâ”€â”€ family/index.html
â”‚   â”œâ”€â”€ deep-pocket/index.html
â”‚   â”œâ”€â”€ boarding-dorm/index.html
â”‚   â”œâ”€â”€ pets/index.html
â”‚   â”œâ”€â”€ rv-truck/index.html
â”‚   â”‚
â”‚   â”œâ”€â”€ blogs/index.html             â† Blog index page (featured + 11-card grid)
â”‚   â”œâ”€â”€ blogs/page/2/index.html    â† Blog pagination page 2 (5 posts)
â”‚   â”œâ”€â”€ blogs/template/index.html    â† Blog post template
â”‚   â”œâ”€â”€ blogs/v-berth-sheets-vs-standard/index.html  â† First real blog post
â”‚   â”œâ”€â”€ blogs/[slug]/index.html      â† Individual blog post pages (copy from template)
â”‚   â”‚
â”‚   â”œâ”€â”€ product/[slug]/index.html    â† 83 product detail pages (standard + custom paths)
â”‚   â”œâ”€â”€ quote/[quote-id]/index.html  â† Magic link: locked custom quote â†’ Add to Cart
â”‚   â”‚
â”‚   â”œâ”€â”€ th/sizeguide/                â† #1 SEO page (WordPress /mattress-size-th/* â†’ /sizeguide/, /th/mattress-size-th/* â†’ /th/sizeguide/)
â”‚   â”œâ”€â”€ [all-other-258-slugs]/index.html   â† Phase 2 URL preservation
â”‚   â”‚
â”‚   â”œâ”€â”€ css/
â”‚   â”‚   â”œâ”€â”€ main.css                 â† All public styles
â”‚   â”‚   â””â”€â”€ admin.css                â† Admin dashboard styles
â”‚   â”œâ”€â”€ js/
â”‚   â”‚   â”œâ”€â”€ cart.js                  â† localStorage cart logic
â”‚   â”‚   â”œâ”€â”€ configurator.js          â† Homepage price calculator (both modes)
â”‚   â”‚   â”œâ”€â”€ product-configurator.js  â† Shared product page configurator (19 products, 6 formula types)
â”‚   â”‚   â”œâ”€â”€ product-sizes.js         â† Centralized size data (174 entries, 8 regions â€” synced from /sizeguide/)
â”‚   â”‚   â”œâ”€â”€ geo.js                   â† Currency toggle
â”‚   â”‚   â””â”€â”€ cookie-consent.js        â† GDPR consent banner
â”‚   â”œâ”€â”€ images/
â”‚   â”‚   â”œâ”€â”€ logo.png                 â† Main logo (transparent PNG)
â”‚   â”‚   â”œâ”€â”€ Hero01.jpg               â† Homepage hero background
â”‚   â”‚   â”œâ”€â”€ og-image.jpg             â† Social share preview (1200Ã—630)
â”‚   â”‚   â”œâ”€â”€ categories/              â† Category card images (Shop by Product + Shop by Niche)
â”‚   â”‚   â”‚   â”œâ”€â”€ category-marine.jpg      âœ… Real photo
â”‚   â”‚   â”‚   â”œâ”€â”€ category-family.jpg      âœ… Real photo
â”‚   â”‚   â”‚   â”œâ”€â”€ category-duvet.jpg       âœ… Real photo
â”‚   â”‚   â”‚   â”œâ”€â”€ category-protection.jpg  âœ… Real photo
â”‚   â”‚   â”‚   â”œâ”€â”€ category-pets.jpg        âœ… Real photo
â”‚   â”‚   â”‚   â”œâ”€â”€ category-rv-truck.jpg    âœ… Real photo
â”‚   â”‚   â”‚   â”œâ”€â”€ category-fitted-sheets.jpg     âœ… Real photo
â”‚   â”‚   â”‚   â”œâ”€â”€ category-flat-sheets.jpg       âœ… Real photo
â”‚   â”‚   â”‚   â”œâ”€â”€ category-duvet-covers.jpg        âœ… Real photo
â”‚   â”‚   â”‚   â”œâ”€â”€ category-pillowcases.jpg         âœ… Real photo
â”‚   â”‚   â”‚   â””â”€â”€ category-mattress-protectors.jpg   âœ… Real photo
â”‚   â”‚   â”œâ”€â”€ products/                â† Product detail hero images (per-product subfolders)
â”‚   â”‚   â”‚   â”œâ”€â”€ 3-sided-duvet/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ bedbridge-connector/main.jpg + main-th.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ boat-fitted-sheet/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ deep-pocket-fitted-sheet/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ dorm-fitted-sheet/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ duvet-cover-dorm/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ duvet-cover-marine/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ duvet-cover-rv/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ duvet-insert/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ family-fitted-sheet/main.jpg + main-th.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ flat-sheet-extra-deep-pocket/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ flat-sheet-standard/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ marine-fitted-sheet/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ mattress-encasement-general/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ mattress-lift-helper/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ mattress-protector-deep-pocket/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ mattress-protector-dorm/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ mattress-protector-family/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ mattress-protector-standard/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ pet-owner-duvet-cover/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ pet-owner-fitted-sheet/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ pet-proof-mattress-protector/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ pillow-protector-general/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ pillowcase-envelope/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ pillowcase-sham/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ pillowcase-zipper/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ rv-truck-fitted-sheet/main.jpg
â”‚   â”‚   â”‚   â”œâ”€â”€ rv-truck-mattress-encasement/main.jpg
â”‚   â”‚   â”‚   â””â”€â”€ standard-fitted-sheet/main.jpg
â”‚   â”‚   â”œâ”€â”€ fabrics/                 â† Fabric showcase photos
â”‚   â”‚   â”œâ”€â”€ router/                  â† Niche landing page hero/router images
â”‚   â”‚   â”œâ”€â”€ Logo/                    â† Marketplace & social icons
â”‚   â”‚   â””â”€â”€ about/                   â† About page photos
â”‚   â”œâ”€â”€ _redirects                   â† 301s for WordPress legacy URLs
â”‚   â”œâ”€â”€ _headers                     â† Security headers (CSP, HSTS, Permissions-Policy)
â”‚   â”œâ”€â”€ sitemap.xml                  â† â¸ Pending (Phase 8)
â”‚   â””â”€â”€ robots.txt                   â† âœ… Built

â”œâ”€â”€ workers/
â”‚   â””â”€â”€ api/
â”‚       â”œâ”€â”€ index.ts                â† Main Worker entry (all /api/* routes)
â”‚       â”œâ”€â”€ products.ts              â† Public products catalog API
â”‚       â”œâ”€â”€ pricing.ts              â† All pricing formulas (fitted/V-Berth/flat/encasement/duvet/pillowcase/mattress-protector)
â”‚       â”œâ”€â”€ pricing-params.ts       â† Public read for admin-set pricing params
â”‚       â”œâ”€â”€ geo-currency.ts          â† Country â†’ THB/USD
â”‚       â”œâ”€â”€ subscribe.ts             â† Email â†’ D1 subscribers
â”‚       â”œâ”€â”€ unsubscribe.ts           â† Email removal from D1
â”‚       â”œâ”€â”€ quote.ts                 â† Custom quote â†’ D1 + Resend email
â”‚       â”œâ”€â”€ contact.ts               â† Contact form â†’ D1 + Resend email
â”‚       â”œâ”€â”€ email.ts                 â† Shared Resend helper
â”‚       â”œâ”€â”€ checkout.ts              â† Stripe Checkout Sessions + PromptPay
â”‚       â”œâ”€â”€ webhook.ts               â† checkout.session.completed â†’ D1 + Resend
â”‚       â”œâ”€â”€ auth.ts                  â† Clerk JWT decode, /api/auth/me
â”‚       â”œâ”€â”€ customers.ts             â† Order history (dual-match thumbnail) + saved-cart sync + addresses CRUD
â”‚       â”œâ”€â”€ shipping.ts              â† Centralized shipping-quote engine (THB rates, geo-country, OTHER fallback)
â”‚       â”œâ”€â”€ countries.ts             â† Centralized country master list (D1 countries_master, 95 countries + OTHER)
â”‚       â”œâ”€â”€ order-confirmed.ts       â† Lookup by stripe_session_id
â”‚       â”œâ”€â”€ clerk-verify.ts          â† Clerk JWT verification (production)
â”‚       â”œâ”€â”€ favorites.ts             â† Authenticated wishlist: POST /api/favorites (add), DELETE /api/favorites/:id (remove), GET /api/favorites (list); user+email matching, duplicate guard, schema auto-heal
â”‚       â”œâ”€â”€ discount.ts              â† Discount code validation and claim tracking
â”‚       â”œâ”€â”€ admin-products.ts       â† Admin: GET/PUT products
â”‚       â”œâ”€â”€ admin-upload.ts         â† Admin: R2 image upload â†’ CDN URL
â”‚       â”œâ”€â”€ admin-pricing.ts        â† Admin: GET/PUT pricing params
â”‚       â”œâ”€â”€ admin-orders.ts        â† Admin: GET/PUT orders (status + Option A shipping tracking)
â”‚       â”œâ”€â”€ admin-customers.ts      â† Admin: customers grouped by email from D1 orders
â”‚       â”œâ”€â”€ admin-diy.ts           â† Admin: GET/PUT DIY prices
â”‚       â”œâ”€â”€ admin-exchange.ts       â† Admin: GET/PUT exchange rates
â”‚       â”œâ”€â”€ admin-contacts.ts       â† Admin: contacts management
â”‚       â”œâ”€â”€ admin-stats.ts          â† Admin: dashboard statistics
â”‚       â”œâ”€â”€ admin-shipping.ts       â† Admin: shipping rates CRUD (THB-only, OTHER protected)
â”‚       â””â”€â”€ admin-quotes.ts         â† Admin: custom quotes management (status, price, expiry)

â””â”€â”€ migrations/
    â”œâ”€â”€ 001_initial.sql             â† products/orders/abandoned_carts/subscribers/rate_limits
    â”œâ”€â”€ 002_add_tags.sql             â† tags column on products
    â”œâ”€â”€ 002_discount_claims.sql      â† discount_claims table
    â”œâ”€â”€ 003_custom_quotes.sql        â† custom_quotes table (updated schema)
    â”œâ”€â”€ 003_seed_products.sql        â† 15 products
    â”œâ”€â”€ 004_rate_limits.sql          â† rate_limits table
    â”œâ”€â”€ 005_pricing_params.sql       â† standard_prices + pricing_params tables
    â”œâ”€â”€ 006_product_editor.sql       â† youtube_url + images columns on products
    â”œâ”€â”€ 007_seed_products.sql        â† 27 products
    â”œâ”€â”€ 008_seed_image_urls.sql      â† image_url seeded for all 27 products
    â”œâ”€â”€ 009_customer_addresses.sql   â† customer_addresses table
    â”œâ”€â”€ 010_discount_expiry.sql      â† expires_at + source columns on discount_claims
    â”œâ”€â”€ 011_orders_discount_code.sql â† discount_code column on orders
    â”œâ”€â”€ 012_contacts.sql             â† contacts table (unified)
    â”œâ”€â”€ 013_favorites.sql            â† favorites table (authenticated wishlist)
    â”œâ”€â”€ 014_order_shipping_tracking.sql  â† carrier_code + tracking_number + tracking_url + shipping_status + shipped_at on orders
    â”œâ”€â”€ 015_shipping_rates.sql       â† shipping_rates table (country_code, first_item_thb, additional_item_thb) + seed TH/US/OTHER
    â”œâ”€â”€ 016_countries_master.sql    â† countries_master table (95 countries + OTHER, phone codes)
    â”œâ”€â”€ 017_recovery_stages.sql    â† recovery_stages table (per-cart stage timestamps)
    â”œâ”€â”€ 018_recovery_config.sql     â† recovery_config table (Stage 2/3 discount, basket threshold)
    â”œâ”€â”€ 019_discount_pct.sql        â† discount_pct column on thankyou_queue
    â”œâ”€â”€ 020_thankyou_queue.sql      â† thankyou_queue table (post-purchase discount emails)
    â””â”€â”€ 021_promo_codes.sql         â† promo_codes + promo_redemptions tables (admin-created custom promo)
â””â”€â”€ MildMateDataBase/ExistingWeb/    â† WordPress URL source data
```

---

## SEO URL Strategy


---

## SEO URL Strategy

Phase 2 runs pre-launch after Phase 8. The approach is **redirect-first** â€” no HTML placeholder pages are created for old WordPress URLs. Everything goes through `public/_redirects`.

| Type | Count | Action |
|---|---|---|
| Product URLs | 81 | `_redirects` â†’ 27 product pages (1:1 where possible, category redirect for size variants) |
| Static page URLs | ~102 | `_redirects` â†’ existing new site pages, or â†’ `/` for orphaned URLs |
| Clean EN slugs | ~80 | Redirect or preserve depending on new site match |
| `/th/` prefixed pages | ~20 | Redirect â†’ `/th/` pages (not yet built) or â†’ EN equivalent |
| Duplicate/junk slugs | ~60 | `_redirects` 301 â†’ canonical |

---

## D1 Database Schema

**Actual schema (migrations 001â€“020). Run `npx wrangler d1 execute mildmate-db --remote --file=migrations/001_initial.sql` to initialize.**

```sql
-- Products (migration 001 + 006)
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title_en TEXT NOT NULL, title_th TEXT,
  description_en TEXT, description_th TEXT,
  category TEXT NOT NULL,          -- 'sheets', 'duvet-covers', 'pillowcases', etc.
  subcategory TEXT,
  fabric_options TEXT DEFAULT 'BreezePlus,CloudSoft,PremaCotton,EcoLuxe',
  base_price_usd REAL NOT NULL DEFAULT 0,
  base_price_thb REAL NOT NULL DEFAULT 0,
  price_per_cm2_usd REAL DEFAULT 0,
  price_per_cm2_thb REAL DEFAULT 0,
  is_custom INTEGER DEFAULT 1,
  image_url TEXT,                   -- CDN path: /images/products/{slug}/main.jpg
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  tags TEXT,                        -- comma-separated cross-sell tags
  youtube_url TEXT,
  images TEXT DEFAULT '[]',       -- JSON array of image URLs
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Orders (migration 001 â€” Phase 5+ checkout saves here)
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  email TEXT NOT NULL,
  customer_name TEXT, phone TEXT,
  shipping_address TEXT,
  product_slug TEXT NOT NULL,
  product_title_en TEXT,
  fabric TEXT, color TEXT,
  width_cm REAL, length_cm REAL, depth_cm REAL,
  width_in REAL, length_in REAL, depth_in REAL,
  custom_notes TEXT,
  price_usd REAL, price_thb REAL,
  currency TEXT DEFAULT 'USD',
  quantity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',  -- 'pending' | 'in-production' | 'shipped' | 'cancelled'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Custom Quotes (migration 003_quote_fields.sql)
CREATE TABLE custom_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id TEXT NOT NULL UNIQUE,       -- e.g. "QT-250519-001"
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT, telephone TEXT,
  product_slug TEXT NOT NULL,
  dimensions TEXT NOT NULL,            -- JSON: {"w":183,"l":198,"d":51,"unit":"cm"}
  fabric TEXT, color TEXT,
  status TEXT DEFAULT 'pending',       -- pending | approved | rejected | expired
  quoted_price INTEGER,               -- cents, NULL until admin approves
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Abandoned Carts (migration 001)
CREATE TABLE abandoned_carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  customer_name TEXT,
  cart_json TEXT NOT NULL,
  recovered INTEGER DEFAULT 0,
  recovery_stage INTEGER DEFAULT 0,
  discount_code TEXT,
  recovery_sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Email Subscribers (migration 001)
CREATE TABLE subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'footer',
  language TEXT DEFAULT 'en',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rate Limits â€” anti-spam (migration 004)
CREATE TABLE rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,            -- 'quote' | 'subscribe'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Standard Prices â€” admin-controlled pricing (migration 005)
CREATE TABLE standard_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_category TEXT NOT NULL,    -- 'fitted-sheet', 'flat-sheet', 'duvet-cover', etc.
  size_key TEXT NOT NULL,             -- e.g. '153x203x30'
  fabric TEXT NOT NULL,
  price_thb INTEGER NOT NULL,
  price_usd REAL NOT NULL,
  UNIQUE(product_category, size_key, fabric)
);

-- Pricing Params â€” global pricing config (migration 005)
CREATE TABLE pricing_params (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  param_key TEXT UNIQUE NOT NULL,
  param_value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```



## Blog Posts (migration 023)

The log_posts table stores CMS-managed blog articles with bilingual support (EN/TH).

### Schema
\\\sql
CREATE TABLE blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_th TEXT DEFAULT '',
  meta_description_en TEXT DEFAULT '',
  meta_description_th TEXT DEFAULT '',
  body_en TEXT DEFAULT '',
  body_th TEXT DEFAULT '',
  featured_image TEXT DEFAULT '',
  featured_image_alt_en TEXT DEFAULT '',
  featured_image_alt_th TEXT DEFAULT '',
  category TEXT DEFAULT 'General',
  author TEXT DEFAULT 'MildMate Team',
  read_time_en TEXT DEFAULT '5 min read',
  read_time_th TEXT DEFAULT '5 นาที อ่าน',
  status TEXT DEFAULT 'draft',
  is_featured INTEGER DEFAULT 0,
  th_redirect_path TEXT DEFAULT '',
  related_products_json TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
\\\

### API Endpoints
| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | /api/admin/blog | handleAdminBlog | List all posts (admin) |
| GET | /api/admin/blog?id=N | handleAdminBlog | Get single post (admin) |
| POST | /api/admin/blog | handleAdminBlog | Create post (admin) |
| PUT | /api/admin/blog | handleAdminBlog | Update post (admin) |
| DELETE | /api/admin/blog | handleAdminBlog | Delete post (admin) |
| GET | /api/blog/posts | handleBlogPosts | List published posts (public) |
| GET | /api/blog/posts?slug=x | handleBlogPosts | Get single published post (public) |

### Frontend Files
- **Admin:** /admin/blog.html — dedicated blog CMS page with WYSIWYG editor
- **Listing:** /blogs/ — fetches from D1 via /api/blog/posts, client-side rendering
- **Post:** /blogs/{slug}/ — Pages Function (unctions/blogs/[[path]].ts) SSR from D1


 001_initial, 002_add_tags, 002_discount_claims, 003_custom_quotes, 003_quote_fields, 003_seed_products, 004_rate_limits, 005_pricing_params, 006_product_editor, 007_seed_products, 008_seed_image_urls, 009_customer_addresses, 010_discount_expiry, 011_orders_discount_code, 012_contacts, 013_favorites, 014_order_shipping_tracking, 015_shipping_rates, 016_countries_master, 017_recovery_stages, 018_recovery_config, 019_discount_pct, 020_thankyou_queue, 021_promo_codes, 022_promo_min_usd, 023_blog_posts

---

## Build Phases

| Phase | Scope | Key Output |
|---|---|---|
| **1** | Foundation | `AGENTS.md`, `wrangler.toml`, D1 schema (incl. V-Berth fields), folder scaffold | âœ… Complete |
| **2** | SEO URL Preservation | Unified `_redirects` covering all WordPress URLs: ~81 product redirects â†’ 27 product pages, ~90 page redirects â†’ existing pages, Thai WP URLs â†’ `/th/` pages. No HTML shells created. | â¸ï¸ Deferred â€” runs pre-launch after Phase 8 |
| **3** | Design System + Shared Components | `main.css`, header, footer (with all social/marketplace links), nav | âœ… Complete |
| **4** | All Content Pages | Homepage EN+TH, About, Contact, Fabric Collections, Policy pages, Reviews, Size Guides, Product pages, Configurator (both modes), `/api/subscribe` endpoint, JSON catalog system (data/products.json), clickable product card tags, USD price prefix, WebP images + critical CSS inlining, rAF scroll throttling, **sequential add-to-cart validation** (Country/Region chip first, then Size, Fabric, Color; US/CA auto-selected on load) | âœ… Complete |
| **5** | Checkout + Stripe + Auth | Checkout/account/order-confirmed pages, Stripe Checkout Sessions + PromptPay, Clerk multi-provider (Google/Facebook/Email), cartâ†”server sync, quote magic link (`/quote/QT-XXXXX/`), Resend emails, D1 orders + favorites + customer_addresses + contacts (migrations 001â€“020). Workers API defensive schema self-heal on all endpoints. **Option A order tracking:** carrier code + tracking number entered by admin on shipped, URL auto-generated from templates, inline in `/account` Orders panel. **Centralized shipping-quote engine** (`workers/api/shipping.ts`): THB-only rates from D1 `shipping_rates`, exchange-rate conversion, geo-country detection, OTHER fallback. **D1 country master list** (`workers/api/countries.ts`, 95 countries + OTHER): consumed by checkout, /account, and super-admin country dropdowns. **Country-specific tariff/tax notes:** EU/UK/OTHER â†’ "Price excludes import tariff and Tax."; TH/US/CA/AU â†’ hidden. **Order thumbnail dual-match resolution:** slug normalization + title fallback for legacy orders. **Pending:** Option 3 production-auth hardening (Clerk production instance). | âœ… Built (code complete; thank-you discount âœ…; wrangler.toml [triggers] â¸ Pending) |
| **6** | Abandoned Cart Cron | `abandoned_carts` table (migration 001), webhook marks `recovered=1` on payment (`workers/api/webhook.ts` âœ…), cart email capture via `PUT /api/customers/cart` âœ… (Phase 5). `functions/cron.ts` multi-stage recovery handler: Stage 1 (24h gentle reminder), Stage 2 (72h discount for carts â‰¥$150, via `recovery_config` migration 018), Stage 3 (7d last-chance). `thankyou_queue` (migration 020) sends 1-year discount post-purchase. Cron trigger in Cloudflare Dashboard. **Pending:** wrangler.toml `[triggers]` cron schedule. | âœ… Built |
| **7** | Admin Dashboard | Admin at `/admin/` (moved from `/admin/sandbox/`, 301 redirect in place). Two dashboards: `super-admin.html` (~155KB) + `admin.html` (~118KB) with full products CRUD, orders table (D1 live + Option A shipping tracking), R2 drag-drop upload, CSV export, customers (D1-grouped by email), subscribers, pricing params, DIY prices, exchange rates, **Shipping Rates** (THB-only with USD preview, D1 country master dropdown via `/api/countries`), marketing. `workers/api/admin-shipping.ts` â€” shipping rates CRUD (THB-only, OTHER protected). `functions/admin/_middleware.ts` â€” Clerk admin-role gate for `/admin/*`. `functions/account/_middleware.ts` protects `/account/*`. All workers protected via `authorizeAdmin()`. **Planned:** Cloudflare Access zero-trust (Option B, defense-in-depth). | âœ… Built (code complete; setup â¸ pending) |
| **8** | Polish + Launch | Mobile QA, Lighthouse 95+, DNS cutover to `www.mildmate.com` | â¸ï¸ Pending |
| **9** | Testing (Vitest) | Unit tests for Worker API: pricing (V-Berth/fitted), cart, geo-currency, subscribers, quote, products, webhook â€” `@cloudflare/vitest-pool-workers` | â¸ï¸ Pending |

> **Note:** Phase 2 (SEO URLs) runs pre-launch after Phase 8 is complete. Phase 5 (Checkout/Stripe/Auth) is âœ… Built. Phase 6 (Abandoned Cart) is âœ… Built. Phase 7 (Admin Dashboard) is âœ… Code Complete. Phase 8 (Polish + Launch) is â¸ï¸ Pending.

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

**Fabric rates per yard (91.44cm Ã— 260cm bolt = 23,774.4 cmÂ²):**
| Fabric | Rate (THB/yd) | After 20% waste |
|---|---|---|
| CloudSoft | 100 | area Ã— 1.20 Ã— 100/23,744 |
| BreezePlus, PremaCotton, EcoLuxe | 180 | area Ã— 1.20 Ã— 180/23,744 |

**Sewing cost â€” tiered by fabric area (cmÂ²):**
| Area Range | Cost (THB) |
|---|---|
| â‰¤ 51,600 | 120 |
| â‰¤ 71,000 | 200 |
| â‰¤ 91,200 | 300 |
| â‰¤ 120,000 | 400 |
| > 120,000 | 500 |

**Accessories:** 10% of fabric cost

**Markups (on subtotal = fabric + sewing + accessories + packing 100 + delivery 50):**
- Fitted Sheet: +15% Operations, +20% Marketing, +30% Margin (45% for RV & Truck)
- Flat Sheet: +15% Operations, +20% Marketing, +30% Margin (no accessories, sewing = flat 250 THB)

**Rounding:** Final THB rounded up to nearest 100 THB. USD = THB Ã· 30.

**Max width:** 220cm â€” above trigger directs to Family/Co-Sleep custom quote.

### Encasement Pricing Formula (Implemented 2026-05-20)

Active for 2 products: 6-Sided Mattress Encasement + RV & Truck Mattress Encasement. TPU-only (no fabric selector).

**Fabric dimensions â€” 6-sided surface area (cmÂ²):**
```
Area = 2(WÃ—L + WÃ—D + LÃ—D)
```

**TPU fabric cost:**
```
TPU bolt width: 210 cm
1 linear metre = 100 Ã— 210 = 21,000 cmÂ² â†’ costs 120 THB
fabricCost = (120 Ã— area / 21,000) Ã— 1.20  (20% waste factor)
```

**Sewing:** 300 THB flat rate

**Zipper:** 0.4 THB/cm on 3 sides: L + W + L = 2L + W

**Fixed costs:** Packing 100 + Delivery 50

**Markups (on subtotal = fabric + sewing + zipper + packing + delivery):**
- +15% Operations, +25% Marketing, +50% Margin (90% total â€” higher than cotton bedding)

**Rounding:** Final THB rounded up to nearest 100 THB. USD = THB Ã· 30.

**Implementation files:**
- `workers/api/pricing.ts` â€” `calculateEncasementPrice()` + `isEncasementProduct()`
- `public/js/product-configurator.js` â€” auto-detects `encasement` in URL path

### Duvet Cover Pricing Formula (Implemented 2026-05-21)

Active for 5 products: 3-Sided Zipper, Pet Owner, Marine, RV, Dorm Duvet Covers.

**Fabric dimensions â€” 2 pieces (cmÂ²):**
```
rawArea = 2 Ã— (W + 5) Ã— (L + 5)   (5cm sewing allowance each edge)
floorArea = rawArea Ã— 1.20          (20% waste)
```

**Zipper:** 0.4 THB/cm Ã— (2L + W) â€” 3-sided zipper

**Sewing cost â€” tiered by raw area (cmÂ²):**
| Area Range | Cost (THB) |
|---|---|
| â‰¤ 139,200 | 300 |
| â‰¤ 170,400 | 400 |
| > 170,400 | 600 |

**Fixed costs:** Packing 100 + Delivery 50

**Markups (on subtotal = fabric + zipper + sewing + packing + delivery):**
- +15% Operations, +20% Marketing, +30% Margin (65% total)

**Rounding:** Final THB rounded up to nearest 100 THB. USD = THB Ã· 30, rounded whole.

**No depth input** â€” duvet covers use WÃ—L only.

### Pillowcase Pricing Formula (Implemented 2026-05-21)

Active for 3 products: Envelope, Zipper, Sham Pillowcases.

**Fabric dimensions (cmÂ²):**
```
rawArea = 2 Ã— (W + 5) Ã— (L + 5)   (5cm sewing allowance)
Sham: rawArea Ã— 1.15                (+15% fabric for flange)
floorArea = rawArea Ã— 1.60          (60% waste)
```

**Sewing:** 40 THB flat (50 THB for Sham)

**Zipper (pillowcase-zipper only):** 0.4 THB/cm Ã— max(W, L) â€” one side

**Fixed costs:** Packing 100 + Delivery 50

**Markups:** +15% Operations, +25% Marketing, +15% Margin (55% total)

**Max dimensions:** W, L â‰¤ 120cm each

**Rounding:** Final THB rounded up to nearest 100 THB. USD = THB Ã· 30, rounded whole.

### Pillow Protector Pricing Formula (Implemented 2026-05-21)

Active for 1 product: Pillow Protector (TPU waterproof).

Same geometry as pillowcase-zipper (2 pieces, 60% waste, zipper on longest side).

**TPU fabric cost:** 120 THB/linear metre Ã· 21,000 cmÂ²/lm (210cm bolt)

**Markups:** +15% Operations, +25% Marketing, +35% Margin (75% total)

**Max dimensions:** W, L â‰¤ 120cm each

### Mattress Protector Pricing Formula (Implemented 2026-05-21)

Active for 4 products: Standard, Deep Pocket, Family, Pet-Proof Mattress Protectors. 3-layer construction (Cotton Quilted + Polyester Filling + TPU Waterproof), customer inputs WÃ—LÃ—D in cm.

**Fabric cost â€” area-based tiered (WÃ—L in sq.inch):**
| Area Range (sq.inch) | Cost (THB) |
|---|---|
| â‰¤ 3,200 | 550 |
| â‰¤ 6,620 | 670 |
| â‰¤ 8,000 | 920 |
| â‰¤ 9,000 | 980 |
| â‰¤ 10,300 | 1,100 |
| â‰¤ 11,300 | 1,200 |
| > 11,300 | 1,300 |

**Depth surcharge:** <30cm: 0, 30-51cm: 200, 52-56cm: 400, >56cm: 600 THB.

**Fixed costs:** Packing 200 + Delivery 80

**Markups (on subtotal):** +15% Ops, +20% Mkt, +15% Margin (Standard+Pet-Proof), +25% (Deep Pocket), +50% (Family).

**Constraints:** Max W/L = 210 cm for non-family; over 210 â†’ redirects to Family Protector.

**Rounding:** Final THB rounded up to nearest 100 THB. USD = THB Ã· 30.

### Centralized Size System (Implemented 2026-05-21)

`public/js/product-sizes.js` â€” 174 size entries across fitted-sheet/duvet/pillow types, 8 regions.
All product page size-selects are auto-populated from this data by `product-configurator.js`.
To update sizes across all pages: edit `/sizeguide/` â†’ sync `product-sizes.js`.

### Configurator Pricing Status (2026-05-21 â€” All 27 Complete)

| Status | Count | Products |
|---|---|---|
| Live formula | 20 | 7 fitted (incl. Marine V-Berth) + 2 flat + 2 encasement + 5 duvet + 3 pillowcase + 1 pillow protector + 4 mattress protectors |
| No configurator needed | 3 | BedBridge Connector, Bed Lifter, Duvet Insert (Thai fixed-size) |
| Awaiting | 0 | â€” |

**All 27 products now have live pricing formulas or don't require configurators.**

**V-Berth formula (Marine Fitted Sheet):** `calcVBerthFitted()` â€” width = max(HW,FW)+2D+14, length = L+2D+14. CloudSoft fabric. Same sewing tiers as fitted sheet. Shape selector (8 shapes A-H with discounted prices). VERTH_MARKUP = 8.15 (680% margin). 4-field custom layout: HW, FW, Centerline L (tooltip), D. "Select Mattress Size" hidden â€” replaced by shape selector.

**Implementation files:**
- `workers/api/pricing.ts` â€” server-side formulas
- `public/js/product-configurator.js` â€” shared configurator on product detail pages (auto-detects product type, includes VBerth formula)

### Hybrid Pricing Architecture (Future â€” D1 standard_prices)

When all 27 product formulas are ready:

```
Standard Size selected â†’ GET /api/pricing?product=...&size=153x203x30&fabric=cloudsoft
                       â†’ D1 standard_prices lookup â†’ return admin-managed price

Custom WÃ—LÃ—D entered  â†’ POST /api/pricing { w, l, d, fabric }
                       â†’ Formula calculates â†’ return live price
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
- Blog CMS editor (static HTML only â€” blog posts are manually authored HTML files)
- Inventory management
- Auto-translation (manual TH/EN per page)
- Shopee/Lazada direct API integration (links only â€” orders managed on those platforms directly)

---

## Bug Fix: Language Toggle Fails on `/sizeguide/` (Inline Onclick Workaround)

### Symptom
- Lang-toggle works on all pages
- On `/sizeguide/` only: clicking EN (from TH version) works; clicking TH (from EN version) does nothing â€” no navigation, no error
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
<div class="lang-toggle" role="group" aria-label="à¸ªà¸§à¸´à¸•à¸Šà¹Œà¸ à¸²à¸©à¸²">
  <span data-lang="en" onclick="window.location.href='/sizeguide/'" style="cursor:pointer">EN</span><span>/</span><span data-lang="th" class="active">TH</span>
</div>
```

### How to Apply This Fix to Any Other Page
1. Find all `lang-toggle` blocks in the page HTML (there can be 2 â€” desktop header + mobile drawer)
2. Add `onclick="window.location.href='/th/[path]/'"` to the TH span
3. Add `onclick="window.location.href='/[path]/'"` to the EN span on the TH version
4. Include `style="cursor:pointer"` for visual clarity
5. Keep the nav.js event delegation as the primary mechanism â€” the inline onclick is a fallback, not a replacement

### Key Insight
The issue is specific to pages with large inline `<script>` blocks that run before nav.js can attach. Most pages (no large inline JS, nav.js loads cleanly) work fine via nav.js alone. Only pages with conflicting inline scripts need the onclick workaround.

---

## Product Listing Page Specification (Phase 4 Updated)

Every category page (`/sheets/`, `/duvet-covers/`, `/pillowcases/`, `/protection/`, `/accessories/`, `/marine/`, `/family/`, `/pets/`, `/deep-pocket/`, `/boarding-dorm/`, `/rv-truck/`) uses this layout:

### Page Structure

```
[BRAND HERO]                    â† Blue gradient + blueprint grid, consistent with /contact/
  H1: {Category Name}
  Sub: {Category-specific tagline}
  (same style as /contact/ hero)

[LISTING SECTION]               â† 11 product cards in auto-fill grid
  [Filter bar] (optional per page)
  [11 listing-card elements]

[LISTING DESC SECTION]         â† Description + Features + Pricing Panel
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

- `.card-tags` â€” chip pills. Each chip is an `<span class="card-tag">{SLUG}</span>` inside `<div class="card-tags">`.

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
1. **Select Region** â†’ enables Standard Size dropdown
2. **Standard Size** â†’ populated from `SIZES_BY_REGION` JS object
3. **Depth / Pocket Height** (optional for fitted/flat/protectors)
4. **Fabric Collection** or **Fabric Badge** (restricted pages)
5. **Price Display** â†’ shows selected price or "Custom quote"
6. **Custom Shape CTA** â†’ dashed-border box with CTA button

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

### Custom Shape CTA â€” Links
| Page | CTA Link |
|---|---|
| Fitted Sheets, Flat Sheets, Mattress Protectors, Protection, Deep Pocket | `/how-to-measure-mattress-size/` |
| Marine & Yacht, Family, Pets, RV & Truck, Pillowcases | `/custom-measurement/` |

### Price Display Note
Every price display includes: *"Price excludes shipping, tax & tariff"*

### D1 `products` Table â€” Tags Field
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

Product data lives in **`data/products.json`** â€” a single JSON file that drives all static pages.

```
data/products.json
       â”‚
       â”œâ”€â”€â–º scripts/regenerate-products.js
       â”‚         â”‚
       â”‚         â”œâ”€â”€â–º public/products/index.html        (EN shop, 27 cards)
       â”‚         â”œâ”€â”€â–º public/th/products/index.html     (TH shop, 27 cards)
       â”‚         â”œâ”€â”€â–º public/sheets/index.html          (EN type, 9 cards)
       â”‚         â”œâ”€â”€â–º public/pillowcases/index.html    (EN type, 3 cards)
       â”‚         â”œâ”€â”€â–º public/marine/index.html          (EN niche, 7 cards)
       â”‚         â”œâ”€â”€â–º public/family/index.html         (EN niche, 8 cards)
       â”‚         â””â”€â”€â–º ...all type + niche pages (EN + TH)
```

**D1 `products` table is separate** â€” it stores orders/custom dimensions from Phase 5+. The JSON drives the storefront catalog pages only.

### JSON Schema (`data/products.json`)

```json
{
  "products": [
    {
      "slug": "pillowcase-envelope",
      "name": "Envelope Pillowcase",
      "nameTh": "à¸–à¸¸à¸‡à¸«à¸¡à¸­à¸™à¹à¸šà¸šà¸‹à¸­à¸‡",
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
| **No DUVET tag** on pillowcase cards | DUVET is for Duvet Cover products only | â€” |

### Regenerator Command

```bash
node scripts/regenerate-products.js

# Output:
# âœ… 23 pages updated, 189 cards generated
# ðŸ” Filter consistency check:
#   sheets         â†’ 9 products
#   duvet-covers  â†’ 6 products
#   pillowcases    â†’ 3 products
#   protection     â†’ 7 products
#   accessories   â†’ 2 products
#   marine        â†’ 7 products
#   family        â†’ 8 products
#   pets          â†’ 8 products
#   deep-pocket   â†’ 7 products
#   boarding-dorm  â†’ 6 products
#   rv-truck      â†’ 8 products
```

### Adding a New Product

1. Add entry to `data/products.json`
2. Add image to `public/images/products/<slug>/main.jpg`
3. Run: `node scripts/regenerate-products.js`
4. All 23 pages auto-update

### Product Dashboard (Phase 7 â€” Future)

Admin CRUD interface that edits `data/products.json`:
- Title (EN + TH)
- Description (EN + TH)
- Tags: dual dropdown (Product Type + Niche Category) â€” populated from JSON metadata
- Images: drag & drop (up to 10 per product) â†’ uploads to R2
- Video: optional URL field
- Prices: per Size + Fabric matrix

D1 schema remains unchanged â€” serves order/custom-dimension storage from Phase 5+.

---

## Product Detail Page Specification (Phase 4 â€” Updated 2026-05-15)

Every product detail page (`/product/[slug]/`) uses this layout:

### Page Structure

```
[BRAND HERO]                    â† Blue gradient + blueprint grid (same as /contact/)
  H1: {Product Name}
  Sub: {Product-specific tagline}

[PRODUCT LAYOUT â€” 2-column grid]
  Left: Product Gallery (sticky)
  Right: Product Info Panel
    â”œâ”€â”€ Breadcrumb
    â”œâ”€â”€ Product Title (H1)
    â”œâ”€â”€ Tagline
    â”œâ”€â”€ Pricing Panel (bordered card)
    â”‚   â”œâ”€â”€ Step 1: Size (dropdown with optgroups by region, region-aware formatting)
    â”‚   â”œâ”€â”€ Step 2: Fabric (swatch selector OR fabric specs grid for locked-fabric products)
    â”‚   â”œâ”€â”€ Step 3: Color (per-fabric color dots in 6-col grid, follows fabric selection)
    â”‚   â”œâ”€â”€ Price Display (à¸¿X,XXX / $XX)
    â”‚   â”œâ”€â”€ Add to Cart + Custom Size buttons
    â”‚   â”œâ”€â”€ Custom Dimensions panel (toggle expand)
    â”‚   â”‚   â”œâ”€â”€ Width / Length / Depth inputs
    â”‚   â”‚   â”œâ”€â”€ Unit toggle (cm / inch)
    â”‚   â”‚   â”œâ”€â”€ Live price estimate
    â”‚   â”‚   â””â”€â”€ [Custom Quote] button â†’ popup form (Name*, Email*, Address, Telephone)
    â”‚   â””â”€â”€ Payment badges (Visa/MC, Secure checkout)
    â”œâ”€â”€ Trust Signals (2Ã—2 grid of icons)
    â””â”€â”€ Trust Badges row

[PRODUCT TABS â€” accordion below fold]
  Description | Fabric Details | Size Guide | Care

[REVIEWS SECTION]
  Rating summary (score + stars + count)
  2-column grid of review cards

[RELATED PRODUCTS â€” 4 cards horizontal]
  4 related product cards

[FOOTER â€” 4-col global]
```

### Hero (Consistent with /contact/)

```css
background: linear-gradient(135deg, #2c96f4 0%, #1a7fd4 100%);
padding: 72px 24px 56px;
```

### Pricing Panel (`.pricing-panel`)

- White background, bordered card, 28px padding
- **Size selector**: Single dropdown with optgroups per region. Flag emoji on optgroup labels. Region-aware formatting: US/CA shows imperial only ("39Ã—75â€³"), all others show metric ("90Ã—190 cm").
- **Size dropdown**: Shows optgroups per country/region. Selected size updates price instantly.
- **Custom Size toggle**: Button reveals custom dimension inputs (W Ã— L Ã— D + unit toggle + live estimate + Submit for Custom Quote)
- **Add to Cart button**: Blue filled, disabled until size selected. Shows "Added!" with green background for 2 seconds after click.
- **Custom Size button**: Blue outline, toggles custom dimensions panel.

### Fabric Rules Per Product Type

| Product | Fabric Options |
|---|---|
| Pet Owner (Fitted/Duvet) | BreezePlus only (specs grid: Pet Hair Resistant, 3-5Â°C Cooler, 50/50 Blend) |
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
"Custom Quote" button (renamed from "Submit for Custom Quote â†’") opens a popup modal form:
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
â”œâ”€â”€ data/
â”‚   â”œâ”€â”€ products.json              â† MASTER PRODUCT DATA (single source of truth)
â”‚   â”œâ”€â”€ templates.json             â† HTML card templates
â”‚   â””â”€â”€ HOW_TO_USE.md             â† Catalog system documentation
â”œâ”€â”€ scripts/
â”‚   â”œâ”€â”€ build-products.js          â† Full page generator (initial build)
â”‚   â””â”€â”€ regenerate-products.js     â† Incremental updater (run after JSON changes)
â”œâ”€â”€ public/js/
â”‚   â”œâ”€â”€ configurator.js            â† Homepage configurator
â”‚   â””â”€â”€ product-configurator.js    â† Shared product page configurator (4 fitted sheet products)
```

All existing pages remain in `public/`. The regenerator overwrites only the product grid sections in each page â€” hero, descriptions, footer, and all other content is preserved.


---

## Operational Notes (2026-06)

### Multi-Stage Abandoned Cart Recovery
functions/cron.ts runs 3 recovery stages on a daily schedule:
- Stage 1 (24h): Gentle reminder, always sent.
- Stage 2 (72h): Discount offer; only for carts >= $basketThresholdUsd (default $150, configurable via D1 recovery_config table).
- Stage 3 (7d): Last-chance, reuses Stage 2 discount code.
- Max 50 emails/day overall; 5+3+3 per-stage batching. thankyou_queue sends 1-year discount code post-purchase.
- All config driven from D1 recovery_config table (migrations 018) - not hardcoded.
- Pending: wrangler.toml [triggers] cron schedule needs to be configured in Cloudflare Dashboard.

### Sequential Add-to-Cart Validation
Selections must proceed in order: Country/Region -> Size -> Fabric -> Color (each chip highlighted before next). US/CA region auto-selected on page load. Cart duplicate prevention: case-insensitive + trim on color in public/js/cart.js add() and workers/api/customers.ts loadFromServer().

### Database Migrations (001-020)
All 20 migrations applied. Tables include abandoned_carts (with recovery_stage, discount_code columns), recovery_stages (migration 017), recovery_config (migration 018), thankyou_queue (migration 020).
