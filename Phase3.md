# Phase 3 — Design System + Shared Components
**Goal:** Build the visual identity of the entire website — the brand colors, typography, sticky header with simplified navigation, minimal premium footer, and mobile navigation. These components are then injected into all pages at once.

**End Result:** Every page on the site suddenly looks like a real MildMate website. Open any HTML file in your browser and you will see the blue brand header, navigation, and footer — even though the page content is still a placeholder.

**Time Estimate:** 30–45 minutes (you provide logo + give feedback; Droid builds everything)

---

## Initial Requirements — What You Must Provide

Collect all of the following before telling Droid to build. These are the only assets and decisions Phase 3 requires from you — everything else is already decided in your brand bible.

---

### Requirement 1 — Confirm Phase 1 Is Complete

Phase 3 builds the design system (CSS, header, footer, navigation) and injects it into all pages. Phase 1 must be complete first.

> **Note:** Phase 2 (SEO URL Preservation) is **intentionally deferred** — it will run pre-launch after Phase 7. Phase 3 injects components into the existing `public/index.html` placeholder and all new pages created in this phase.

**Confirm before starting:**
- [ ] `public/` folder exists with `css/`, `js/`, `images/` subfolders
- [ ] `public/index.html` exists (placeholder from Phase 1)
- [ ] `wrangler.toml` has `pages_build_output_dir = "public"`
- [ ] D1 database `mildmate-db` has 4 tables confirmed
- [ ] `http://localhost:8788/` loads the placeholder page without error

**If any item is missing:** Go back and complete Phase 1 before continuing.

---

### Requirement 2 — Your Logo File

The header needs your MildMate logo. This is the most important visual asset in Phase 3.

**What to prepare:**

| Version | File Name | Background | Used For |
|---|---|---|---|
| Main logo | `logo.png` | Transparent (PNG) | White header background |
| White logo | `logo-white.png` | Transparent (PNG) | Dark backgrounds (optional) |

**How to prepare:**
1. Find your MildMate logo file on your computer
2. If it is already a PNG with transparent background → rename it to `logo.png`
3. If it is a JPG or has a white background → tell Droid "My logo is a [JPG/PNG with white background]" — Droid will work with what you have
4. Place the file here:
   ```
   D:\00_MildMate\Re-Bulit_Web\public\images\logo.png
   ```

**Logo size guidance:**
- Ideal width: 150–200px
- Ideal height: 50–80px
- The existing site uses max-height 83px — your new site will match this

> **Don't have a digital logo file?** Tell Droid "I do not have a logo file yet — use the text 'MildMate' in the brand blue color as a placeholder." Droid will create a text-based logo placeholder you can replace later.

---

### Requirement 3 — Your LINE Official Account Link

The footer contact column and mobile hamburger drawer need your LINE contact link.

**How to find your LINE link:**
1. Open the **LINE Official Account Manager** app or website
2. Go to your account settings
3. Look for your **LINE URL** or **LINE ID**
   - URL format: `https://lin.ee/XXXXXXX`
   - ID format: `@mildmate` or similar
4. Write it down

**If you do not have a LINE Official Account yet:**
Tell Droid "No LINE account yet — use a placeholder link." The LINE widget will be hidden until you add the real link later.

---

### Requirement 4 — Your Social & Marketplace Links

The footer has two groups of links: **Contact channels** (how customers reach you) and **Marketplace shops** (where you sell online).

**Contact Channels — fill in your URLs:**

| Platform | Your URL | Required? |
|---|---|---|
| LINE Official | `https://lin.ee/[your-id]` | Yes |
| WhatsApp | `https://wa.me/[your-number]` | Yes |
| Facebook Page | `https://www.facebook.com/[your-page]` | Yes |

**Marketplace Shops — fill in your shop URLs:**

| Platform | Your URL | Required? |
|---|---|---|
| Etsy Shop | `https://www.etsy.com/shop/[your-shop]` | Yes |
| eBay Store | `https://www.ebay.com/str/[your-store]` | Yes |
| Shopee | `https://shopee.co.th/[your-shop]` | Yes |
| Lazada | `https://www.lazada.co.th/shop/[your-shop]` | Yes |
| TikTok Shop | `https://www.tiktok.com/@[your-handle]` | Yes |

**How to find your Etsy shop URL:**
1. Go to your Etsy shop
2. The URL in your browser bar is your shop URL (e.g., `https://www.etsy.com/shop/MildMateBedding`)

---

### Requirement 5 — Your Navigation Menu Decisions

The header navigation has 6 items by default. Confirm or adjust the order and names.

**Default navigation (confirm or change):**

| Position | Label (EN) | Label (TH) | Links To |
|---|---|---|---|
| 1 | Home | หน้าแรก | `/` |
| 2 | Shop ▾ | ช้อป ▾ | Mega-dropdown |
| 3 | Fabrics ▾ | ผ้า ▾ | Dropdown |
| 4 | Size Guide | คู่มือขนาด | `/sizeguide/` |
| 5 | About | เกี่ยวกับเรา | `/about/` |
| 6 | Contact | ติดต่อเรา | `/contact/` |

**Decisions needed:**
- Are the label names correct in both Thai and English?
- Is the order correct?
- Do you want to add or remove any navigation items?

Write your final navigation list — give it to Droid in Step 3.4.

---

### Requirement 6 — Your Footer Tagline

The footer shows a short tagline under your logo. This is a 1–2 line description of MildMate.

**Examples:**
- "Custom bedding made in Thailand. Perfect fit, guaranteed."
- "ผ้าปูที่นอนสั่งตัด ผลิตในไทย รับประกันความพอดี"
- "Bespoke bedding for every mattress shape — from V-Berths to family mega-beds."

**Write your tagline in both Thai and English** — give it to Droid in Step 3.4.

---

### Requirement 7 — Footer Policy Links

The footer bottom bar has links to your policy pages. Confirm which policy pages to link to.

**Default links (confirm or change):**

| Label | Links To |
|---|---|
| Privacy Policy | `/policy/` |
| Shipping Policy | `/policy-en/` |
| Return Policy | (add if needed) |

---

## Why This Phase Comes Before Content

Think of Phase 3 as building the **frame of a house** before putting in the furniture.

- The header and footer are shared across all 258 pages
- If you build them once here and inject them everywhere, changing them later only requires editing 1 file — not 258
- Your brand identity (color, font, spacing) is defined once as CSS variables — changing `--color-primary` in one place updates every button, link, and badge across the whole site

---

## What Phase 3 Builds

| File | What It Is |
|---|---|
| `public/css/main.css` | All visual styles — brand tokens, typography, layout, header, footer, buttons, cards, forms |
| `public/css/admin.css` | Styles for the admin dashboard (separate from public site) |
| `public/js/nav.js` | Mega-menu open/close, mobile hamburger drawer, sticky header shrink on scroll |
| Header HTML component | Sticky bar: logo + navigation + TH/EN toggle + cart icon |
| Footer HTML component | 4-column minimal footer + icon-only marketplace/social + search overlay |
| Injected into all 258 pages | Header and footer added to every `public/[slug]/index.html` file |

---

## Your Design System (Already Decided)

These are the visual rules Droid will code into `main.css`. No decisions needed — they come from your brand bible.

### Brand Colors
| Name | Color Code | Used For |
|---|---|---|
| Primary Blue | `#2c96f4` | Buttons, links, badges, active states, borders |
| Primary Dark | `#1a7fd4` | Button hover states |
| Text | `#333333` | All body text |
| Background | `#ffffff` | Page background |
| Surface | `#f8f9fa` | Card backgrounds, section backgrounds |
| Border | `#e5e7eb` | Dividers, input borders |

### Typography
| Element | Size | Weight | Used For |
|---|---|---|---|
| H1 | 2.5rem | Bold (700) | Hero headline |
| H2 | 1.75rem | Bold (700) | Section titles |
| H3 | 1.25rem | Semi-bold (600) | Card titles |
| Body | 1rem | Regular (400) | All paragraph text |
| Small | 0.875rem | Regular (400) | Labels, captions, meta |
| Font Family | `Quicksand` (Google Fonts) | — | All text, matching existing site |

### Spacing & Shapes
- Border radius: `8px` on cards and buttons
- Box shadow: `0 2px 12px rgba(0,0,0,0.08)` on cards
- Section padding: `60px` top/bottom on desktop, `40px` on mobile

---

## Navigation Structure (What Gets Built)

### Desktop Header
```
┌─────────────────────────────────────────────────────────┐
│  [MildMate Logo]  Home  Shop  Fabrics  Size Guide          │
│                                    [🔍][👤][🛒][EN/TH]  │
└─────────────────────────────────────────────────────────┘
```
- Height: 80px normal → shrinks to 60px when you scroll down
- Background: white with a subtle bottom border
- Logo: left-aligned, max-height 64px (shrinks to 50px on scroll)
- Nav text: 1.2rem, weight 600, Quicksand
- Actions right: Search → Account → Cart → EN/TH
- Icons: 20px inline SVGs, blue hover

### Mobile Header (screen width ≤ 1024px)
```
┌────────────────────────────────────────────┐
│  [☰]        [   Logo (centered)   ]   [🔍][👤][🛒][EN/TH]  │
└────────────────────────────────────────────┘
```
- Hamburger far left, logo centered, actions right
- Nav hidden — replaced by hamburger drawer
- Icons: 18px default, 16px on smallest screens (≤480px)
- Drawer slides in from **left** (matches hamburger position)
- Drawer contains all navigation links in a vertical list
- Tapping anywhere outside the drawer closes it

### TH / EN Language Toggle
- Shown in header top-right (desktop and mobile)
- Not duplicated inside mobile drawer
- Clicking TH → goes to `/th/` version of the current page
- Clicking EN → goes to the English version
- Current language is highlighted in blue

### Cart Icon
- Shows item count badge (blue circle, white text) when cart has items
- Clicking links to `/checkout/` (cart drawer built in Phase 4)
- Account icon links to `/account/` (placeholder for Phase 5)
- Search icon opens full-screen search overlay

---

## Footer Structure

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

> **Footer style:** Minimal, modern, premium. No logo or description block. Icon-only marketplace links (Etsy, eBay, Shopee, Lazada) with circular hover buttons. Social icons centered in their own row. LINE/WhatsApp icon-only buttons under phone number. Deep navy #001d3d background.

---

## Step-by-Step Instructions

### Step 3.1 — Complete All 7 Initial Requirements

Go through Requirements 1–7 above and collect every item. Fill in this summary before moving to Step 3.2:

```
PHASE 3 REQUIREMENTS SUMMARY

Requirement 1 — Phase 1 complete (Phase 2 deferred): Yes / No
Requirement 2 — Logo file: placed at public/images/logo.png / [describe format]
Requirement 3 — LINE link: [your LINE URL]
Requirement 4 — Contact & Marketplace links:
  LINE: [URL]
  WhatsApp: [URL]
  Facebook: [URL]
  Etsy: [URL]
  eBay: [URL]
  Shopee: [URL]
  Lazada: [URL]
  TikTok Shop: [URL]
Requirement 5 — Navigation:
  1. Home / หน้าแรก → /
  2. Shop / ช้อป → mega-dropdown
  3. Fabrics / ผ้า → dropdown
  4. Size Guide / คู่มือขนาด → /sizeguide/
  5. About / เกี่ยวกับเรา → /about/
  6. Contact / ติดต่อเรา → /contact/
  [add/remove/rename if needed]
Requirement 6 — Footer tagline:
  EN: [your tagline]
  TH: [your tagline]
Requirement 7 — Footer policy links:
  Privacy Policy → /policy/
  Shipping Policy → /shipping/
  [add others if needed]
```

---

### Step 3.2 — Place Your Logo File

If not already done in Requirement 2:

1. Find your MildMate logo image file on your computer
2. Rename it to exactly `logo.png`
3. Place it here:
   ```
   D:\00_MildMate\Re-Bulit_Web\public\images\logo.png
   ```
4. If you have a white version, name it `logo-white.png` in the same folder

---

### Step 3.3 — Confirm Phase 2 Pages Are Present

Before asking Droid to inject the header and footer, quickly confirm the Phase 2 pages exist.

**Quick check in cmd:**
```
cd D:\00_MildMate\Re-Bulit_Web
npx wrangler pages dev public
```
Open `http://localhost:8788/mattress-size-th/` — if the page loads (even as a blank/placeholder), Phase 2 is confirmed. Press `Ctrl + C` to stop.

---

### Step 3.4 — Tell Droid to Build Phase 3

Once all 7 requirements are collected and the logo is placed, hand off to Droid.

**Tell Droid:**
> "Phase 2 is complete. Please build Phase 3 — the design system and shared components.
>
> **Requirement 1:** Phase 2 confirmed complete.
> **Requirement 2 — Logo:** Placed at `public/images/logo.png` [or describe: 'JPG file' / 'no logo yet — use text placeholder']
> **Requirement 3 — LINE:** [your LINE URL]
> **Requirement 4 — Social links:**
> - Facebook: [URL]
> - Etsy: [URL]
> - Instagram: [URL or none]
> - TikTok: [URL or none]
> **Requirement 5 — Navigation:** [confirm default OR list your changes]
> **Requirement 6 — Footer tagline:**
> - EN: [your tagline]
> - TH: [your tagline]
> **Requirement 7 — Policy links:** Privacy Policy → /policy/ | Shipping Policy → /shipping/ [add others if needed]
>
> Build main.css, admin.css, nav.js, the sticky header with mega-menu, the footer with LINE widget and all contact/marketplace links (LINE, WhatsApp, Facebook, Etsy, eBay, Shopee, Lazada, TikTok), mobile hamburger drawer, and inject header + footer into all 258 pages."

**What Droid builds:**
1. `public/css/main.css` — full design system CSS (~400 lines)
2. `public/js/nav.js` — header scroll shrink + mega-menu + mobile drawer
3. Header HTML (injected into all pages)
4. Footer HTML with LINE widget (injected into all pages)
5. Updates all 258 `index.html` files with the header and footer

---

### Step 3.5 — Review the Header on Desktop

After Droid finishes, open your browser and check the header.

**How to start the local server:**
1. Open cmd
2. Type:
   ```
   cd D:\00_MildMate\Re-Bulit_Web
   npx wrangler pages dev public
   ```
3. Open `http://localhost:8788` in your browser

**What to check on desktop (full-width browser window):**

| Check | Expected |
|---|---|
| Logo appears | Your logo shows in top-left |
| Logo size | Not too big, not too small — similar to existing site |
| Navigation links | Home, Shop, Fabrics, Size Guide, About, Contact visible |
| Brand color | Navigation links turn blue (`#2c96f4`) on hover |
| TH/EN toggle | Shows in top-right area |
| Cart icon | Shows in top-right with `🛒` icon |
| Scroll down | Header shrinks slightly (83px → 60px) |
| Hover "Shop" | Mega-dropdown appears with 4 categories |
| Hover "Fabrics" | Dropdown shows 4 fabric names |

---

### Step 3.6 — Review the Header on Mobile

**How to simulate mobile on desktop:**
1. In your browser, press `F12` to open Developer Tools
2. Click the phone/tablet icon at the top of the Developer Tools panel (called "Toggle device toolbar")
3. Select "iPhone 12 Pro" or "Galaxy S20" from the dropdown
4. Refresh the page

**What to check on mobile:**

| Check | Expected |
|---|---|
| Hamburger icon `☰` | Appears in top-right |
| Logo visible | Shows in top-left, not cut off |
| Tap `☰` | A drawer slides in from the right with all menu items |
| Tap outside drawer | Drawer closes |
| Cart icon | Visible next to hamburger |
| LINE bar at bottom | Green bar visible at bottom of screen |

---

### Step 3.7 — Review the Footer

Scroll all the way to the bottom of any page.

**What to check:**

| Check | Expected |
|---|---|
| 4 columns visible | Logo+email, Shop links, Info links, Contact links |
| Email input box | Has a "Subscribe" button next to it |
| Contact channels | LINE, WhatsApp, Facebook links visible and clickable |
| Marketplace links | Etsy, eBay, Shopee, Lazada, TikTok links visible |
| Copyright line | "© 2026 MildMate" at very bottom |
| LINE widget (mobile only) | Green bar at bottom — only visible when in mobile view |

---

### Step 3.8 — Review One of the 258 Injected Pages

Confirm the header and footer were injected into the SEO pages from Phase 2.

**How to check:**
1. In your browser, go to: `http://localhost:8788/mattress-size-th/`
2. Confirm: The header appears at the top with the logo and navigation
3. Confirm: The footer appears at the bottom
4. Confirm: The page title in the browser tab says: `[เช็คขนาด] ที่นอน 6ฟุต...`

---

### Step 3.9 — Give Feedback and Request Fixes

Look at the site on both desktop and mobile. Write down anything that looks wrong or that you want to change.

**Common things to give feedback on:**
- Logo size (too big / too small)
- Font looks wrong
- Colors look different than expected
- Navigation item names you want to change
- Footer column layout needs adjustment
- LINE bar position or appearance

**Tell Droid:**
> "I have reviewed Phase 3. Here are my changes: [list your feedback]."

Droid makes the changes. Repeat Step 3.5–3.8 until you are happy.

---

## How You Know Phase 3 Is Complete

Go through this checklist before moving to Phase 4:

**Initial Requirements:**
- [ ] Phase 2 confirmed complete (258 pages exist)
- [ ] Logo file placed at `public/images/logo.png`
- [ ] LINE Official Account link collected
- [ ] All contact links collected (LINE, WhatsApp, Facebook)
- [ ] All marketplace links collected (Etsy, eBay, Shopee, Lazada, TikTok)
- [ ] Navigation labels and order confirmed in both TH and EN
- [ ] Footer tagline written in both TH and EN
- [ ] Footer policy links confirmed

**Build Steps:**
- [ ] `public/css/main.css` exists and has content
- [ ] `public/js/nav.js` exists
- [ ] Logo appears correctly in the header on desktop
- [ ] Mega-menu opens when hovering "Shop" on desktop
- [ ] Fabrics dropdown opens when hovering "Fabrics" on desktop
- [ ] Header shrinks when scrolling down the page
- [ ] Mobile view shows hamburger icon `☰` on far left
- [ ] Tapping `☰` opens slide-in drawer from the **left**
- [ ] TH/EN toggle visible in header (desktop and mobile)
- [ ] Account, search, and cart icons visible in header
- [ ] Footer shows all 4 columns with correct links
- [ ] Footer marketplace icons are icon-only (no text labels)
- [ ] Social icons centered in footer row
- [ ] No LINE sticky widget (removed for international positioning)
- [ ] Header and footer appear on `http://localhost:8788/`
- [ ] Brand color `#2c96f4` used on buttons and hover states
- [ ] Quicksand font loads correctly (text looks rounded and clean)

---

## Troubleshooting Common Problems

| Problem | Solution |
|---|---|
| Phase 2 pages not found | Run `npx wrangler pages dev public` and check `http://localhost:8788/mattress-size-th/` — if 404, go back and complete Phase 2. |
| Logo file not found | Confirm the file is named exactly `logo.png` (lowercase) and is inside `public/images/`. Windows file names are case-sensitive when deployed to Cloudflare. |
| Logo is not showing in browser | Tell Droid: "Logo is not showing — the path is `public/images/logo.png`." |
| Logo looks stretched or blurry | Tell Droid: "Logo appears stretched — please set max-height to 60px and width to auto." |
| LINE link not working | Confirm your LINE URL starts with `https://lin.ee/` or is in `@handle` format. Tell Droid if it needs to be updated. |
| Contact link not in footer | Tell Droid: "The [LINE/WhatsApp/Facebook] link is not appearing in the footer Contact column." |
| Marketplace link not in footer | Tell Droid: "The [Etsy/eBay/Shopee/Lazada/TikTok] link is not appearing in the footer Marketplaces column." |
| Navigation label in wrong language | Tell Droid: "The navigation item '[label]' should say '[correct label]' in [TH/EN]." |
| Footer logo/description showing | Tell Droid: "The footer still shows a logo or description block — it should be minimal with only 4 columns of links." |
| Marketplace icons showing text labels | Tell Droid: "Marketplace links in the footer are showing text labels — they should be icon-only circles." |
| Mobile drawer slides from right | Tell Droid: "The hamburger drawer is sliding in from the right — it should slide from the left to match the hamburger position." |
| LINE widget showing | LINE sticky bar was removed for international positioning. It should not appear on any screen size. |
| Quicksand font not loading | The font loads from Google Fonts and requires internet. Check your internet connection and refresh. |
| Footer columns stacked on desktop | Tell Droid: "Footer columns are not in a row on desktop — they are stacking vertically." |
| Header not shrinking on scroll | Tell Droid: "The sticky header is not shrinking when I scroll down." |
| Account/cart icons not visible | Tell Droid: "The account and cart icons are not showing in the header." |

---

## Design Decisions You Can Still Change in Phase 3

These are not locked in until you approve them:

| Decision | Default | How to Change |
|---|---|---|
| Navigation order | Home, Shop, Fabrics, Size Guide, About, Contact | Tell Droid to reorder |
| Footer column links | As shown in footer layout above | Tell Droid which links to add/remove |
| Header height | 83px → 60px on scroll | Tell Droid a different size |
| Cart icon style | Simple bag icon with count badge | Tell Droid if you prefer a different style |
| Mobile drawer direction | Slides in from left (matches hamburger position) | Tell Droid "slide from right" if preferred |

---

## What Happens Next

Once Phase 3 is complete and you are happy with the visual shell, move to **Phase 4 — Homepage + Product Pages**.

Phase 4 is where the site comes alive with real content — the hero section, product grid, custom configurator, fabric tabs, and social proof sections are all built and filled with your actual MildMate content.

**Tell Droid:** "Phase 3 is complete. All checklist items are done. I am happy with the design. Please start Phase 4."
