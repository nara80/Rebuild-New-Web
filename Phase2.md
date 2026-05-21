# Phase 2 — SEO URL Preservation
**Status (2026-05-21): ⏸️ DEFERRED — runs pre-launch after Phase 7**
**Goal:** Make sure every existing page on `www.mildmate.com` has a matching page on the new site so Google never loses your rankings when you launch.

**End Result:** 258 HTML placeholder pages — one for every URL from your WordPress site — plus a `_redirects` file that handles duplicate and broken old URLs with 301 redirects.

**Time Estimate:** 15–30 minutes (most of it is Droid building — you only review and approve one list)

---

## Initial Requirements — What You Must Provide

Collect all of the following before telling Droid to build. Phase 2 has fewer decisions than other phases — most of the work is Droid reading your existing URL files — but these 4 items must be confirmed first.

---

### Requirement 1 — Confirm Phase 1 Is Complete

Phase 2 builds directly inside the `public/` folder created in Phase 1. If Phase 1 is not complete, Phase 2 cannot run.

**Confirm before starting:**
- [ ] `public/` folder exists at `D:\00_MildMate\Re-Bulit_Web\public\`
- [ ] `AGENTS.md` exists at `D:\00_MildMate\Re-Bulit_Web\AGENTS.md`
- [ ] Local server runs: `npx wrangler pages dev public` shows `Ready on http://localhost:8788`

**If any item is missing:** Go back and complete Phase 1 before continuing.

---

### Requirement 2 — Confirm the 3 Source URL Files Exist

Droid reads these 3 files to know every URL on your existing site. Confirm they are all present.

**Check in File Explorer** or tell Droid to check — these files must exist:

| File | Full Path |
|---|---|
| Pages | `D:\00_MildMate\Re-Bulit_Web\MildMateDataBase\ExistingWeb\MildMate_Pages.md` |
| Posts | `D:\00_MildMate\Re-Bulit_Web\MildMateDataBase\ExistingWeb\MildMate_Posts.md` |
| Products | `D:\00_MildMate\Re-Bulit_Web\MildMateDataBase\ExistingWeb\MildMate_Products.md` |

**If any file is missing:** Tell Droid which file is missing — it will recreate it from the URL data already in your knowledge base.

---

### Requirement 3 — Your Canonical Language Preference

Your site has both Thai and English pages. Droid needs to know which language is the "primary" version for each URL so it can set the correct `hreflang` tags.

**Decide:**

| URL Pattern | Language | Example |
|---|---|---|
| `/[english-slug]/` | English (primary) | `/mattress-size-th/`, `/custom-bedding/` |
| `/th/[slug]/` | Thai (alternate) | `/th/home-th/`, `/th/about-mildmate-our-story-mission/` |
| `/[thai-slug]/` | Thai (primary) | `/ผ้าปูที่นอนสั่งตัด/`, `/เตียงครอบครัว/` |
| `/product/[slug]/` | English (primary) | `/product/tbar/`, `/product/baby-blanket/` |

**Your answer:** This is already determined by your URL structure — English slugs are primary, Thai slugs and `/th/` prefixed pages are alternates. **No action needed** — just confirm this matches your intention.

> **Confirm:** "Yes, English URLs are primary and Thai URLs are alternates" — OR — tell Droid if you want any URLs treated differently.

---

### Requirement 4 — Your Redirect Decisions for Key Duplicate URLs

A small number of URLs require your personal decision because they could go to more than one destination. Review this list and confirm or change each one.

**Decisions needed:**

| Old URL | Proposed Destination | Your Confirmation |
|---|---|---|
| `/shop/` | `/all-products/` | Confirm or change? |
| `/product/` (the page, not folder) | `/all-products/` | Confirm or change? |
| `/blogs/` | `/blogs/` (keep as blog listing page) | Confirm or change? |
| `/faq/` | `/faq/` (keep — will build in Phase 4) | Confirm or change? |
| `/reviews/` | `/productreview/` (your main review page) | Confirm or change? |
| `/about/` and `/about-us/` | Both keep as separate pages OR merge to `/about/`? | Decide |
| `/my-account/` | `/` (homepage — no login system) | Confirm or change? |
| `/shop-with-us/` | `/all-products/` | Confirm or change? |
| `/hotel-resort-hospital-bedding-manufacturer/` | Keep as separate page or redirect to `/about-us/`? | Decide |

**Write your decisions** — give them to Droid in Step 2.3.

---

## Why This Phase Is Critical

Your WordPress site has **5 years of SEO history**. Google has indexed every one of your 258 URLs and assigned them ranking scores. If even one important URL disappears or changes when you launch, Google treats it as a new page with zero history — and your ranking drops.

### The Risk Without This Phase
- `/mattress-size-th/` — your #1 traffic page — disappears → you lose all Thai search traffic
- `/product/product-boat-bedding-fitted-sheet-microfiber/` → 404 error → Google drops the product from search results
- Customers who bookmarked your pages get error pages

### What This Phase Guarantees
- Every existing URL continues to work on the new site
- Google sees a smooth migration with no broken links
- Duplicate/messy WordPress URLs are cleaned up with proper 301 redirects
- Thai and English pages are correctly labeled so Google shows the right language to the right visitor

---

## What You Have (Source Data)

Droid will read these 3 files you already have:

| File | Contains | Count |
|---|---|---|
| `MildMateDataBase/ExistingWeb/MildMate_Pages.md` | All WordPress pages (homepage, about, contact, size guides, etc.) | 125 pages |
| `MildMateDataBase/ExistingWeb/MildMate_Posts.md` | All blog posts (Thai SEO articles, bedding guides) | 50 posts |
| `MildMateDataBase/ExistingWeb/MildMate_Products.md` | All product pages | 83 products |
| **Total** | | **258 URLs** |

---

## What Phase 2 Builds

| Output | What It Is |
|---|---|
| `public/[slug]/index.html` | One HTML file per URL (258 total) — preserves the exact URL path |
| `public/product/[slug]/index.html` | Product pages under `/product/` path (83 total) |
| `public/th/[slug]/index.html` | Thai-language pages under `/th/` path (~20 total) |
| `public/_redirects` | 301 redirect rules for duplicate and junk WordPress slugs |
| `hreflang` tags in each page | Tells Google which language each page is in |
| Schema.org JSON-LD in product pages | Structured data that helps Google show your products in search |

---

## Step-by-Step Instructions

### Step 2.1 — Understand the Two Types of URLs

Before Droid builds, you need to understand how your 258 URLs are categorized:

**Type A — Keep As-Is (Droid creates a matching HTML file)**
These are clean, meaningful URLs that must be preserved exactly:
```
/mattress-size-th/
/product/product-boat-bedding-fitted-sheet-microfiber/
/custom-bedding/
/bedsheet-in-a-boat/
/th/home-th/
```

**Type B — Redirect to Canonical (301 redirect)**
These are WordPress duplicates, typos, or junk slugs that should forward to the real page:
```
/cotact-us/          → redirect to → /contact/
/blogs-2/            → redirect to → /blogs/
/blogs-2-2/          → redirect to → /blogs/
/blogs3/             → redirect to → /blogs/
/blogs-2-2/          → redirect to → /blogs/
/reviews-2/          → redirect to → /reviews/
/reviews-3/          → redirect to → /reviews/
/privacypolicy/      → redirect to → /privacy-policy/
/policy/             → redirect to → /privacy-policy/
/policy-en/          → redirect to → /privacy-policy/
/my-account/         → redirect to → /  (no login system)
/order/              → redirect to → /checkout/
/fabric-2/           → redirect to → /fabric-collections/
/fabric-4/           → redirect to → /fabric-collections/
/breezeplus-2/       → redirect to → /fabric-collections/
/cloudsoft-4/        → redirect to → /fabric-collections/
/premacotton-2/      → redirect to → /fabric-collections/
/ecoluxe-3/          → redirect to → /fabric-collections/
/สินค้า/             → redirect to → /all-products/
/สินค้า-2/           → redirect to → /all-products/
/หน้าแรก/            → redirect to → /th/home-th/
/?page_id=10056      → redirect to → /  (WordPress internal ID, not a real page)
```

---

### Step 2.2 — Review and Approve the Redirect List

Before Droid writes the `_redirects` file, Droid will show you the **full proposed redirect list** and ask for your approval.

**Your job:** Read through the list and confirm:
1. Does the destination URL make sense? (e.g., `/cotact-us/` → `/contact/` — yes, that's correct)
2. Is there any redirect you want to change?

**Example of what Droid will show you:**
```
PROPOSED REDIRECTS (confirm or edit before I write the file):

/cotact-us/           → /contact/           (typo fix)
/blogs-2/             → /blogs/             (duplicate)
/my-account/          → /                   (no login system planned)
/fabric-2/            → /fabric-collections/ (old slug)
...
```

You reply: "Confirmed" or "Change [old URL] to redirect to [new URL] instead."

---

### Step 2.3 — Tell Droid to Build Phase 2

Once you have completed all 4 initial requirements, hand off to Droid.

**Tell Droid:**
> "Phase 1 is complete. Please start Phase 2.
>
> **Requirement 1:** Phase 1 confirmed complete — public/ folder and AGENTS.md exist.
> **Requirement 2:** All 3 source URL files confirmed present in MildMateDataBase/ExistingWeb/.
> **Requirement 3:** English URLs are primary, Thai /th/ prefix and Thai-slug pages are alternates.
> **Requirement 4 — My redirect decisions:**
> - /shop/ → /all-products/
> - /product/ (page) → /all-products/
> - /blogs/ → keep as blog listing
> - /faq/ → keep as separate page
> - /reviews/ → /productreview/
> - /about/ and /about-us/ → [your decision: keep both / merge to /about/]
> - /my-account/ → / (no login system)
> - /shop-with-us/ → /all-products/
> - /hotel-resort-hospital-bedding-manufacturer/ → [your decision]
>
> Read the 3 URL files, categorize all 258 URLs into Type A (keep) and Type B (redirect), show me the full proposed redirect list for approval before writing any files."

**What Droid does:**
1. Reads all 3 source files
2. Classifies every URL as Type A or Type B
3. Shows you the redirect list for approval
4. After your approval, creates all 258 HTML files
5. Writes `public/_redirects` with all 301 rules
6. Adds `hreflang` tags to every page
7. Adds Schema.org JSON-LD to all 83 product pages

---

### Step 2.4 — Understand What Each HTML Page Looks Like

Each of the 258 HTML files Droid creates is a **minimal placeholder page** — not the final design (that comes in Phase 3 and 4). It contains:

```
- Correct <title> tag (from your WordPress SEO title)
- Correct <meta description> tag (from your WordPress meta description)
- Correct <link rel="canonical"> tag
- hreflang tags (TH + EN)
- Schema.org JSON-LD (product pages only)
- A simple "Coming Soon" body (replaced with real content in Phase 3/4)
- Header and footer placeholders (filled in Phase 3)
```

**Why placeholders first?**
Because Google can re-index the URLs immediately after launch, even before the full design is ready. The SEO signals (title, description, canonical, hreflang) are what matter most — not the visual design.

---

### Step 2.5 — Verify a Sample of the Output

After Droid finishes building, you do a quick spot-check. You do not need to check all 258 — just 5 key ones.

**Open these files in your browser (double-click each):**

| File to open | What to check |
|---|---|
| `public/mattress-size-th/index.html` | Title should be: `[เช็คขนาด] ที่นอน 6ฟุต 5ฟุต 3.5ฟุต...` |
| `public/product/product-boat-bedding-fitted-sheet-microfiber/index.html` | Title should be: `Boat Bedding: CloudSoft Marine Fitted Sheet` |
| `public/custom-bedding/index.html` | Title should be: `เครื่องนอนสั่งตัด – ออกแบบชุดเครื่องนอน...` |
| `public/th/home-th/index.html` | Should have `hreflang="th"` tag |
| `public/_redirects` | Open in Notepad — should contain lines like `/cotact-us/ /contact/ 301` |

**How to check the title and hreflang:**
1. Open the HTML file in your browser
2. Right-click anywhere on the page → click **View Page Source**
3. Press `Ctrl + F` and search for `<title>` — confirm the text matches
4. Search for `hreflang` — confirm it exists

---

### Step 2.6 — Check the _redirects File

Open `public/_redirects` in Notepad (right-click the file → Open with → Notepad).

Each line should look like this:
```
/cotact-us/  /contact/  301
/blogs-2/    /blogs/    301
/my-account/ /          301
```

- The **first part** is the old URL (the one that exists on your WordPress site)
- The **second part** is where it should go on the new site
- `301` means "permanent redirect" — this is what tells Google to transfer SEO value

If anything looks wrong, tell Droid to fix it before moving to Phase 3.

---

### Step 2.7 — Run a Local Test

Test that the redirects work correctly on your local computer.

**How to do it:**
1. Open cmd and navigate to your project:
   ```
   cd D:\00_MildMate\Re-Bulit_Web
   ```
2. Start the local server:
   ```
   npx wrangler pages dev public
   ```
3. Open your browser and test these URLs:
   - `http://localhost:8788/mattress-size-th/` → should show the placeholder page (not a 404 error)
   - `http://localhost:8788/cotact-us/` → should redirect to `http://localhost:8788/contact/`
   - `http://localhost:8788/product/product-boat-bedding-fitted-sheet-microfiber/` → should show the placeholder page
4. Press `Ctrl + C` to stop the server when done.

> **What is a 404 error?** It means "page not found." If you see one, tell Droid which URL caused it.

---

## How You Know Phase 2 Is Complete

Go through this checklist before moving to Phase 3:

**Initial Requirements:**
- [ ] Phase 1 confirmed complete (public/ folder and AGENTS.md exist)
- [ ] All 3 source URL files confirmed present in MildMateDataBase/ExistingWeb/
- [ ] Language preference confirmed (English primary, Thai alternate)
- [ ] All 9 redirect decisions from Requirement 4 answered and given to Droid

**Build Steps:**
- [ ] Droid showed you the full redirect list and you approved it
- [ ] `public/` folder contains subfolders for all 258 URL slugs
- [ ] `public/product/` contains 83 product page folders
- [ ] `public/th/` contains ~20 Thai-language page folders
- [ ] `public/_redirects` file exists and contains 301 rules
- [ ] 5 spot-check files opened correctly in browser with correct `<title>` tags
- [ ] `hreflang` tags confirmed in Thai and English pages
- [ ] Local server test passed — no 404 errors on checked URLs
- [ ] `/cotact-us/` redirects correctly to `/contact/`

---

## Troubleshooting Common Problems

| Problem | Solution |
|---|---|
| `public/` folder does not exist | Phase 1 is not complete. Go back and finish Phase 1 before starting Phase 2. |
| Source URL file is missing | Tell Droid: "The file MildMateDataBase/ExistingWeb/MildMate_[Pages/Posts/Products].md is missing." |
| Not sure what to decide for Requirement 4 | Use the proposed defaults — they are safe. You can change any redirect later by editing `public/_redirects`. |
| A URL shows a 404 error locally | Tell Droid: "URL `/[slug]/` gives a 404 error locally." Droid will check if the folder/file was created correctly. |
| Redirect goes to the wrong page | Tell Droid: "Change the redirect for `/[old-slug]/` to go to `/[correct-slug]/` instead." |
| Thai URL folders not created | Windows sometimes has issues with Thai characters in folder names. Tell Droid and it will use URL-encoded folder names instead. |
| `_redirects` file is empty | Tell Droid: "`_redirects` file is empty. Please rewrite it." |
| `hreflang` tag missing | Tell Droid: "The file `public/[slug]/index.html` is missing the hreflang tag." |
| Unsure if a URL should be Type A or Type B | Default rule: if the URL has a real SEO title and meta description in the source files → Type A (keep). If it is blank or a duplicate → Type B (redirect). |

---

## Important SEO Notes

### Your #1 Priority URL
`/mattress-size-th/` is your highest-traffic page. Confirm this file exists:
```
public\mattress-size-th\index.html
```
If it is missing, **stop and tell Droid immediately** before proceeding.

### Thai Slug URLs
Some of your URLs use Thai characters, for example:
- `/ผ้าปูที่นอนสั่งตัด/`
- `/เตียงครอบครัว/`

Cloudflare Pages supports UTF-8 folder names. Droid will handle encoding automatically.

### URLs You Can Safely Skip
These WordPress system URLs do not need HTML pages — they can go directly to redirects:
- `/?page_id=10056` → redirect to `/`
- `/my-account/` → redirect to `/` (no login system)
- `/languages/` → redirect to `/` (WordPress translation system page)
- `/shop-with-us/` → redirect to `/all-products/`

---

## What Happens Next

Once Phase 2 is complete, move to **Phase 3 — Design System + Shared Components**.

Phase 3 is where the site starts to look like a real MildMate website. Droid builds the full CSS design system with your brand blue color, the sticky header with mega-menu, and the footer — then injects them into all 258 pages at once.

**Tell Droid:** "Phase 2 is complete. All checklist items are done. Please start Phase 3."
