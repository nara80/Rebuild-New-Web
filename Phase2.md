# Phase 2 — SEO URL Preservation
**Status (2026-05-28): ⏸️ DEFERRED — runs pre-launch after Phase 8 (Launch)**
**Goal:** Redirect every existing WordPress URL so that when you swap domain names and point `www.mildmate.com` to the new Cloudflare Pages site, every old URL either lands on the correct new page or redirects to the nearest equivalent. Google never sees a 404.

**End Result:** A complete `_redirects` file covering:
- ~81 WordPress product URL redirects → the 27 new product pages
- ~90 WordPress static-page URL redirects → existing new site pages
- Thai WordPress URLs (Unicode slug format) → `/th/` prefixed new site pages
- All existing duplicate/typo redirect rules preserved

When you deploy to Cloudflare Pages and swap DNS, the `_redirects` file handles everything automatically — no changes needed to the old WordPress site.

**Time Estimate:** 15–30 minutes (most of it is Droid building — you only review and approve one list)

---

## Initial Requirements — What You Must Provide

Collect all of the following before telling Droid to build. Phase 2 has fewer decisions than other phases — most of the work is Droid reading your existing URL files — but these 4 items must be confirmed first.

---

### Requirement 1 — Confirm Phase 1 Is Complete

Phase 2 builds directly inside the `public/` folder created in Phase 1. If Phase 1 is not complete, Phase 2 cannot run.

**Confirm before starting:**
- [ ] `public/` folder exists at `D:\00_MildMate\Re-Build_Web\public\`
- [ ] `AGENTS.md` exists at `D:\00_MildMate\Re-Build_Web\AGENTS.md`
- [ ] Local server runs: `npx wrangler pages dev public` shows `Ready on http://localhost:8788`

**If any item is missing:** Go back and complete Phase 1 before continuing.

---

### Requirement 2 — Confirm the 3 Source URL Files Exist

Droid reads these 3 files to know every URL on your existing site. Confirm they are all present.

**Check in File Explorer** or tell Droid to check — these files must exist:

| File | Full Path |
|---|---|
| Pages | `D:\00_MildMate\Re-Build_Web\MildMateDataBase\ExistingWeb\MildMate_Pages.md` |
| Posts | `D:\00_MildMate\Re-Build_Web\MildMateDataBase\ExistingWeb\MildMate_Posts.md` |
| Products | `D:\00_MildMate\Re-Build_Web\MildMateDataBase\ExistingWeb\MildMate_Products.md` |

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
| `/faq/` | `/faq/` (keep — built in Phase 4) | Confirm or change? |
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
- `/product/product-boat-bedding-fitted-sheet-microfiber/` → 404 → Google drops the product from search results
- Old Thai WordPress URLs (`/ผ้าปูสั่งตัด/`) → 404 error → Thai SEO traffic lost
- Customers who bookmarked your pages get error pages

### How It Works (Redirect = Automatic, No Code Changes Needed)
When you deploy to Cloudflare Pages, Cloudflare reads `public/_redirects` and handles every redirect at the edge — before a page is even served. Your WordPress site stays live until DNS cutover, then `www.mildmate.com` starts routing through Cloudflare. No WordPress config changes needed.

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
| `MildMateDataBase/ExistingWeb/MildMate_Products.md` | All WordPress product pages | 81 products → **27 real pages** (remaining 54+ redirect via `_redirects`) |
| **Total** | | **258 URLs** |

---

## What Phase 2 Builds

| Output | What It Is |
|---|---|
| `public/_redirects` | **Unified redirect file** — covers all 258 WordPress URLs. Cloudflare Pages reads this file at deploy time and handles every redirect automatically. When you swap DNS to point `www.mildmate.com` at the new site, every old URL is resolved |
| Thai WordPress URLs → `/th/` pages | Your WordPress had Thai pages in two formats: Unicode slug (`/ผ้าปูสั่งตัด/`) and `/th/slug/. Both formats are redirected to the equivalent `/th/` page on the new site |
| Product URL redirects | All 81 WP product URLs → 27 new product pages (301 permanent redirect, Google ranking passes through) |

---

## Step-by-Step Instructions

### The 81 WordPress Product URLs → 27 New Product Pages

Your WordPress site had **81 product URLs** but the new site has only **27 product pages** (one per product). The remaining 54 URLs must be redirected — plus 2 URLs with old `product-` prefixes, 12 pillowcase variants, and some misc orphaned slugs — totaling **~81 product URLs that need redirect rules**.

**How the mapping works:**

| WordPress slug pattern | New destination | Count |
|---|---|---|
| Regional size variants (e.g., `ecoluxe-fitted-sheets-standard-size-in-au`) | Base product page (e.g., `/product/standard-fitted-sheet/`) | ~52 |
| Old `product-` prefix (e.g., `product-boat-bedding-fitted-sheet-microfiber`) | `/product/marine-fitted-sheet/` | 2 |
| Pillowcase variants (e.g., `boat-pillowcases-cloudsoft-quick-dry`) | `/product/pillowcase-envelope/` + `/product/pillowcase-zipper/` + `/product/pillowcase-sham/` (match by keyword) | ~12 |
| Misc orphaned (e.g., `tbar`, `baby-blanket`, `animal-bedding`) | `/all-products/` | ~8 |
| Direct 1:1 matches (same slug as new) | `/product/[slug]/` | 1 (`mattress-lift-helper`) |

**Example redirect rules:**

```
# Regional size variants → base product
/product/ecoluxe-fitted-sheets-standard-size-in-au/    /product/standard-fitted-sheet/   301
/product/ecoluxe-fitted-sheets-standard-size-in-eu/    /product/standard-fitted-sheet/   301
/product/ecoluxe-fitted-sheets-standard-size-in-us/    /product/standard-fitted-sheet/   301
/product/ecoluxe-fitted-sheets-standard-size-in-uk/    /product/standard-fitted-sheet/   301
/product/premacotton-fitted-sheets-standard-size-in-au/  /product/standard-fitted-sheet/  301
/product/breezeplus-fitted-sheets-standard-size-in-au/   /product/standard-fitted-sheet/  301
/product/cloudsoft-fitted-sheets-standard-size-in-us/    /product/standard-fitted-sheet/   301

# More regional variants
/product/breezeplus-duvet-standard-size-in-us/   /product/3-sided-duvet/  301
/product/breezeplus-duvet-standard-size-in-uk/   /product/3-sided-duvet/  301
/product/breezeplus-duvet-standard-size-in-eu/   /product/3-sided-duvet/  301

# Co-sleeping variants
/product/ecoluxe-co-sleeping-bed-size-in-au/    /product/family-fitted-sheet/   301
/product/premacotton-co-sleeping-bed-size-in-thailand/  /product/family-fitted-sheet/  301

# Old product- prefix
/product/product-boat-bedding-fitted-sheet-microfiber/  /product/marine-fitted-sheet/  301
/product/product-boat-top-sheet-rectangular-cloudsoft-mildew-resistant/  /product/marine-fitted-sheet/  301

# Pillowcase variants → closest matching pillowcase page
/product/boat-pillowcases-cloudsoft-quick-dry/   /product/pillowcase-envelope/   301
/product/ecoluxe-pillowcases-with-hidden-zippers-turn-your-bedroom-into-an-eco-friendly-paradise/  /product/pillowcase-zipper/  301
/product/3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets/  /product/pet-owner-duvet-cover/  301
/product/decorative-pillow-shams-th-size/        /product/pillowcase-sham/       301

# Misc orphaned
/product/tbar/           /all-products/  301
/product/baby-blanket/    /all-products/  301
/product/animal-bedding/  /all-products/  301
/product/sheet-protectors/ /product/mattress-protector-standard/  301
```

## Static Page Redirects: WP Pages → New Site Pages

Of the 102 WordPress pages, ~10 already have exact-match pages on the new site (e.g., `/contact/`, `/about/`, `/faq/`, `/blogs/`, `/reviews/`, `/policy/`, `/product/`, `/sizeguide/`, `/all-products/`). The remaining ~92 WordPress page URLs — including duplicates, typos, and pages for topics now covered by other URLs — should be redirected rather than recreated as placeholders. This keeps `public/` clean and preserves SEO ranking via 301 redirects.

**Redirect strategy by category:**

| WP page slug pattern | Destination | Why |
|---|---|---|
| `/privacy-policy/`, `/privacypolicy/` | `/policy/` | Privacy policy page already built |
| `/policy-en/` | `/policy/` | English privacy policy variant |
| `/cotact-us/` | `/contact/` | Typo fix |
| `/about-us/` | `/about/` | Standard about page |
| `/productreview/`, `/product-reviews/` | `/reviews/` | Reviews consolidated |
| `/size-guide/` | `/sizeguide/` | Size guide already built |
| `/all-products/`, `/shop/`, `/shop-with-us/` | `/all-products/` | Catalog page already built |
| `/product/` (the page, not folder) | `/product/` | Goes to product listing |
| `/my-account/`, `/order/` | `/` | No account/order system — redirect to homepage |
| `/languages/`, `?page_id=*` | `/` | WordPress internals — redirect to homepage |
| `/custom-bedding/`, `/personalised-pillow/` | `/custom-measurement/` | Custom measurement page |
| `/fabric-2/`, `/fabric-4/`, `/cloudsoft-4/`, `/premacotton-2/`, `/ecoluxe-3/`, `/breezeplus-2/` | `/fabric/` | Fabric collections page |
| `/bedsheet-in-a-boat/`, `/bedsheet-in-a-camper-van/` | `/marine/` | Marine category landing |
| `/ผ้าปูที่นอนสั่งตัด/`, `/เตียงครอบครัว/`, `/หน้าแรก/`, `/สินค้า/`, `/สินค้า-2/`, `/ผ้าปูที่นอนขนาดมาตรฐาน/`, `/ผ้าปูขนาดมาตรฐานในไทย/`, `/ภาษา/` | `/` or `/th/` | Thai system pages → homepage or Thai home |
| `/blogs-2/`, `/blogs-2-2/`, `/blogs3/` | `/blogs/` | Blog duplicates |
| `/reviews-2/`, `/reviews-3/` | `/reviews/` | Reviews duplicates |
| `/duvet-cover-with-3-sided-zipper/`, `/3-sided-zipper-duvet-cover/` | `/duvet-covers/` | Category landing |
| `/standard-mattress/`, `/standard-size-bed-sheet/`, `/standard-bed-sheets/` | `/sizeguide/` | Size guide content |
| `/family-co-sleeping-solutions/`, `/family-co-sleeping-solutions-2/`, `/bed-sheets-co-sleeping-sizes/`, `/family-co-sleeping-bedding-solutions-for-a-harmonious-sleep/` | `/family/` | Family category |
| `/easy-change-duvet-cover/`, `/duvet-cover-with-3-side/` | `/duvet-covers/` | Category landing |
| `/fabric-collections/` | `/fabric/` | Fabric page |
| `/bedbridge-mildmate/` | `/accessories/` | Accessories page |
| `/pet-friendly-fitted-sheet/`, `/pet-seat-cover/` | `/pets/` | Pets category |
| `/hotel-resort-hospital-bedding-manufacturer/` | `/about/` | About page |
| `/mattress-cover/`, `/waterproof-zippered-tpu-mattress-cover/`, `/prevent-dust-mites/` | `/protection/` | Protection category |
| Blog SEO posts (e.g., `bed-sheets-for-the-family-laid-out-side-by-side`, `bedsheet-in-a-boat`, `custom-dorm-bedding-students`) | `/blogs/` | Long-form blog content — redirect to blog listing |
| Any URL with no specific match on the new site | `/` | **Catch-all: redirect ALL orphaned WordPress URLs to the new site homepage. This guarantees zero 404s** |

**When Phase 2 runs:** Droid reads `MildMateDataBase/ExistingWeb/MildMate_Pages.md` and `MildMate_Posts.md`, generates all redirect rules (combining static pages, product URLs from `MildMate_Products.md`, and existing `_redirects` rules), and presents a unified list for approval.

### Step 2.1 — How URLs Are Categorized

Before Droid builds, you need to understand how your WordPress URLs are handled — they either get a redirect (preferred for duplicates/junk) or a new HTML placeholder page (for unique URLs that need preserving):

**What Phase 2 does:**

Phase 2 writes a complete `_redirects` file that covers every WordPress URL:
- **WordPress product URLs** → map to one of 27 product pages (e.g., `/product/product-boat-bedding-fitted-sheet-microfiber/` → `/product/marine-fitted-sheet/`)
- **Duplicates / typos** → map to the correct existing page (e.g., `/cotact-us/` → `/contact/`)
- **Page slugs** → map to existing pages (e.g., `/about-us/` → `/about/`, `/shop/` → `/all-products/`)
- **Orphaned URLs** → redirect to `/` (homepage of the new site). This catch-all guarantees zero 404s

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
> Read the 3 URL files, generates redirect rules for all WordPress URLs that map to existing pages or need consolidation, shows you the unified redirect list for approval before writing any files."

**What Droid does:**
1. Reads all 3 URL source files
2. Generates redirect rules for all WordPress URLs (products + static pages + posts)
3. Shows you the unified redirect list for approval
4. After your approval, updates `public/_redirects` with all 301 rules

---

### Step 2.5 — Verify the Redirects

After Droid writes `public/_redirects`, verify the key redirect rules are present. You do not need to check every rule — just confirm the main categories are covered.

**Open `public/_redirects` in Notepad** and look for:
- Product URL redirects (e.g., `/product/ecoluxe-fitted-sheets-standard-size-in-au/` → `/product/standard-fitted-sheet/`)
- Page redirects (e.g., `/cotact-us/` → `/contact/`, `/about-us/` → `/about/`)
- Thai language redirects (e.g., `/th/fitted-sheets/*` → `/th/sheets/`)

Each line should look like: `/old-url/ /new-destination/ 301`

If anything looks missing, tell Droid to add the rule before moving on.

---

### Step 2.6 — Run a Local Redirect Test

Test that the key redirects work correctly on your local computer.

**How to do it:**
1. Open cmd and navigate to your project:
   ```
   cd D:\00_MildMate\Re-Build_Web
   ```
2. Start the local server:
   ```
   npx wrangler pages dev public
   ```
3. Open your browser and test these redirects:
   - `http://localhost:8788/cotact-us/` → should redirect to `http://localhost:8788/contact/`
   - `http://localhost:8788/about-us/` → should redirect to `http://localhost:8788/about/`
   - `http://localhost:8788/product/ecoluxe-fitted-sheets-standard-size-in-au/` → should redirect to `/product/standard-fitted-sheet/`
4. Press `Ctrl + C` to stop the server when done.

> **What is a 404 error?** It means "page not found." If you see one, tell Droid which URL caused it so the redirect rule can be added.

---

## How You Know Phase 2 Is Complete

Go through this checklist before moving to **Phase 8 — Polish + Launch** (Phase 2 runs pre-launch):

**Initial Requirements:**
- [ ] Phase 1 confirmed complete (public/ folder and AGENTS.md exist)
- [ ] All 3 source URL files confirmed present in MildMateDataBase/ExistingWeb/
- [ ] Language preference confirmed (English primary, Thai alternate)
- [ ] All 9 redirect decisions from Requirement 4 answered and given to Droid

**Build Steps:**
- [ ] Droid showed you the unified redirect list (products + static pages) and you approved it
- [ ] public/_redirects updated with all product redirects (~81 rules) and static-page redirects (~90 rules)
- [ ] Key redirects tested: product URL + page URL redirects
- [ ] public/product/ contains 27 real product page folders
- [ ] Thai-language redirects confirmed in _redirects
- [ ] /cotact-us/ and other typo redirects tested and working

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
| `hreflang` tag missing on EN pages | Tell Droid: "EN page is missing hreflang tags — add `<link rel="alternate" hreflang="th" href="/th/[slug]/">` and canonical." |
| URL shows 404 instead of redirecting | Tell Droid: "URL `/[slug]/` is showing 404 — please add the redirect rule to `_redirects`." |

---

## Important SEO Notes

### Your #1 Priority URL
`/mattress-size-th/` is your highest-traffic page. Confirm the redirect exists in `_redirects`:
```
/th/mattress-size-th/*   /th/sizeguide/   301
```
If this line is missing, **stop and tell Droid immediately** before proceeding.

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

Once Phase 2 is complete, move to **Phase 7 — Admin Dashboard** (Phase 3 and 4 are already ✅ Complete, Phase 5 is 🚧 In Progress, Phase 6 is ⏸️ Pending).

Phase 7 builds the private management interface for your team — the orders table showing custom dimensions for manufacturing, the product editor, the image uploader, and the subscriber CSV export. It is protected by Clerk auth so only your team can access it.

**Tell Droid:** "Phase 2 is complete. All checklist items are done. Please start Phase 7."
