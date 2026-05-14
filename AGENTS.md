# AGENTS.md — MildMate Web Rebuild Project Memory

This file is read by Droid at the start of every session. It contains all critical project context so any Droid instance can continue work without re-asking questions.

---

## Project Overview

- **Business:** MildMate — custom bedding manufacturer in Thailand
- **Current site:** WordPress on `www.mildmate.com` (Flatsome theme)
- **Goal:** Rebuild to Vanilla HTML + Cloudflare Workers with e-commerce features
- **Dev URL:** `mildmate-new.pages.dev` (production: `www.mildmate.com` at 100% completion)
- **Phase 2 deferred:** Will be done at pre-launch (after Phase 7)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML + CSS + minimal JS |
| Backend | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (`mildmate-db`) |
| Storage | Cloudflare R2 (`mildmate-assets`) |
| Email | MailChannels (free, via Workers `fetch()`) |
| Payments | Stripe (USD + PromptPay THB) |
| Admin Auth | Cloudflare Access (Google login) |
| Deploy | Cloudflare Pages |

---

## Cloudflare Account

- **Account:** `nara19080@gmail.com` (old account — existing resources)
- **D1 Database:** `mildmate-db` (ID: `85ce2f41-463a-43fa-8485-181e983b8fd4`)
- **R2 Bucket:** `mildmate-assets`
- **Pages Project:** `mildmate-new`
- **Wrangler login:** Use `nara19080@gmail.com`

---

## GitHub

- **Account:** `nara80` (email: `nara19080@gmail.com`)
- **Repo:** `Rebuild-New-Web` (private)
- **Repo URL:** `https://github.com/nara80/Rebuild-New-Web`
- **Auth method:** HTTPS with Personal Access Token (credential helper cached 1 year)

---

## Brand Design Tokens

```css
--color-primary: #2c96f4;
--color-primary-dark: #1a7fd4;
--color-text: #333333;
--color-bg: #ffffff;
--color-surface: #f8f9fa;
--color-border: #e5e7eb;
--font-main: 'Quicksand', sans-serif;
--radius: 8px;
--shadow: 0 2px 12px rgba(0,0,0,0.08);
```

### Font System (Bilingual EN/TH)
| Language | Font | Source |
|---|---|---|
| English | Quicksand (400, 600, 700) | Google Fonts |
| Thai | Sarabun (400, 600, 700) | Google Fonts |

**Implementation:**
- Both fonts loaded via single Google Fonts URL: `family=Quicksand:wght@400;600;700&family=Sarabun:wght@400;600;700&display=swap`
- CSS `:lang(th) { font-family: 'Sarabun', sans-serif; }` in `main.css` overrides Quicksand for Thai text
- All 26+ HTML files updated with dual font URL

---

## Phase Status

| Phase | Status | Notes |
|---|---|---|
| 0 — Mockup | ✅ Approved | `mockup.html` created |
| 1 — Foundation | ✅ Complete | Scaffold, D1 migration, local server tested, placeholder index.html |
| 2 — SEO URLs | ⏸️ Deferred | **Intentionally deferred — runs pre-launch AFTER Phase 7 complete** |
| 3 — Design System | ✅ Complete | Header, footer, CSS, nav.js, search overlay, mobile drawer left |
| 4 — Homepage + Products | ✅ Complete | Homepage EN+TH (AJAX email signup, 15% off), configurator, cart.js, geo.js, all static pages (about→Engineering Authority 5-section rebuild with real images, contact, fabric, shipping→Returns&Delivery, policy, reviews), size guides, product/category skeletons, workers (products, pricing, geo, subscribe, unsubscribe), image compression (92.5% saved), `discount_claims` migration ready, cookie consent banner (GDPR, GA4 G-0GWVSPJLVJ), real Etsy reviews (8 with mapped names/countries), 14-section privacy policy, unsubscribe page + API, header consistency (about/reviews/contact/fabric all blue-gradient hero), full global footer restored on how-to-measure-mattress-size + custom-measurement, Sarabun Thai font added to all 26+ HTML files, comprehensive size guide revision across all 8 regions (US/CA, UK, EU, AU, TH, MY/SG, India, JP) — Family/Co-Sleep expanded for all, Duvet tables corrected, Thailand uses Bed Size/Duvet Cover Size column headers, Dakimakura body pillow added to all pillow tables except Thailand, all footers now full 4-col global |
| 5 — Checkout + Stripe + Social Login | ⏸️ Pending | Guest checkout, Stripe (PromptPay/cards), social login (Google/FB/LINE/Apple), My Account |
| 6 — Abandoned Cart | ⏸️ Pending | Cron trigger, recovery emails |
| 7 — Admin Dashboard | ⏸️ Pending | Orders, products, upload, subscribers |
| 8 — Launch | ⏸️ Pending | DNS cutover, testing, sitemap |

---

## Key Decisions Already Made

| Decision | Value |
|---|---|
| Payment gateway | Stripe (PromptPay for TH, cards for global) |
| Email service | MailChannels (free, no signup) |
| Admin access | Cloudflare Access (Google login) |
| Dev domain | `mildmate-new.pages.dev` |
| Cutover trigger | 100% completion, not before |
| Language | Bilingual Thai/English, EN primary |
| Font | Quicksand (EN) + Sarabun (TH) — bilingual font pairing |
| Header desktop | Logo left, nav center, actions right |
| Header mobile | Hamburger left, logo center, actions right |
| Mobile drawer | Slides in from left |
| Footer style | Minimal, icon-only marketplace/social, no logo block |
| LINE sticky bar | Removed (international positioning) |
| Checkout | Guest checkout default, social login optional |
| Search | Overlay triggered by magnifying glass icon |

---

## Existing WordPress URLs (258 total)

- 125 pages
- 50 posts
- 83 products

Source files in `MildMateDataBase/ExistingWeb/`:
- `MildMate_Pages.md`
- `MildMate_Posts.md`
- `MildMate_Products.md`

---

## Product Category Structure (Revised 2026-05-14)

### Primary Navigation — Product Type (SEO discoverability)
| Category | URL | Products |
|---|---|---|
| Fitted Sheets | `/fitted-sheets/` | Marine, Family, Pet Owner, Adjustable |
| Flat Sheets | `/flat-sheets/` | Standard, Extra Deep Pocket (20") |
| Duvet Covers | `/duvet-covers/` | 3-Sided Zipper, Pet Owner |
| Pillowcases | `/pillowcases/` | Envelope, Zipper, Sham |
| Mattress Protectors | `/mattress-protectors/` | Encasement, Pillow Protector |

### SEO Landing Pages — Use Case (high-conversion)
| Category | URL | Cross-links to Product Type |
|---|---|---|
| Marine & Yacht | `/marine/` | `/fitted-sheets/` — Marine Fitted Sheet |
| Family & Co-Sleep | `/family/` | `/fitted-sheets/` — Family Fitted Sheet |
| Easy-Change Duvet | `/duvet/` | `/duvet-covers/` — 3-Sided Zipper |
| Protection | `/protection/` | `/mattress-protectors/` — Encasement |
| Pet Owner Bedding | `/pets/` | `/fitted-sheets/`, `/duvet-covers/` — BreezePlus |

### Product Detail Pages (14 total)
| Product | URL | Category |
|---|---|---|
| 3-Sided Zipper Duvet Cover | `/product/3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets/` | Duvet Cover, Pets |
| Custom Family Fitted Sheet | `/product/family-co-sleeping-solutions-th-size/` | Fitted Sheet, Family |
| Marine Fitted Sheet (V-Berth) | `/product/product-boat-bedding-fitted-sheet-microfiber/` | Fitted Sheet, Marine |
| RV & Van Mattress Encasement | `/product/sheet-protectors/` | Protector, Protection |
| BedBridge Connector | `/product/tbar/` | Accessory, Family |
| Pillow Protector | `/product/pillow-protector/` | Protector, Protection |
| Pet Owner Fitted Sheet | `/product/pet-owner-fitted-sheet/` | Fitted Sheet, Pets |
| Pet Owner Duvet Cover | `/product/pet-owner-duvet-cover/` | Duvet Cover, Pets |
| Adjustable Mattress Fitted Sheet | `/product/adjustable-mattress-fitted-sheet/` | Fitted Sheet |
| Flat Sheet — Standard | `/product/flat-sheet-standard/` | Flat Sheet |
| Flat Sheet — Extra Deep Pocket | `/product/flat-sheet-extra-deep-pocket/` | Flat Sheet |
| Envelope Pillowcase | `/product/pillowcase-envelope/` | Pillowcase |
| Zipper Pillowcase | `/product/pillowcase-zipper/` | Pillowcase |
| Sham Pillowcase | `/product/pillowcase-sham/` | Pillowcase |

---

## Database Schema (4 tables)

- `products` — product catalog
- `orders` — customer orders with custom dimensions
- `abandoned_carts` — email + cart JSON for recovery
- `subscribers` — email signup list

See `migrations/001_initial.sql` for full schema.

---

## File Structure

```
D:\00_MildMate\Re-Bulit_Web\
├── AGENTS.md                          ← This file
├── mockup.html                        ← Design reference (Phase 0)
├── wrangler.toml                      ← Cloudflare config
├── package.json                       ← Node dependencies
├── public\                            ← Static site files
│   ├── css\                           ← Stylesheets
│   ├── js\                            ← Client scripts
│   ├── images\                       ← Logo, product photos
│   ├── _redirects                     ← SEO redirects (Phase 2)
│   └── _headers                       ← Security headers
├── workers\                           ← Cloudflare Workers
│   ├── api\                          ← Public API endpoints
│   └── admin\                        ← Admin dashboard API
├── admin\                            ← Admin dashboard HTML
├── migrations\                       ← Database migrations
│   └── 001_initial.sql
└── MildMateDataBase\                  ← Knowledge base files
    └── ExistingWeb\
```

---

## Deployment Protocol

**The user controls all deployments manually. Droid NEVER deploys automatically.**

| Rule | Instruction |
|---|---|
| **Never auto-deploy** | Do NOT run `wrangler pages deploy`, `wrangler deploy`, `git push`, or any command that modifies the live site or remote repository without explicit user instruction. |
| **User-triggered only** | Only deploy when the user explicitly says: "Deploy now", "Push to GitHub", "Deploy to Cloudflare", or a similar direct command. |
| **Default phrase** | When work is complete and ready for deployment, say: **"Deploy when you're ready."** Provide the exact manual command the user should run. |
| **GitHub push blocked** | If Droid-Shield blocks `git push` due to false positives (e.g., base64 images in markdown), inform the user and offer 3 options: (1) push manually outside Droid, (2) disable Droid-Shield in settings, (3) replace the flagged content. |
| **No deploy-on-commit** | Local `git commit` is fine. Remote push and Cloudflare deploy are user-controlled only. |

---

## Notes for Future Droid Sessions

- **ALWAYS read `Framework.md` at the start of every session** — it contains the full site blueprint, page layouts, design system, database schema, and build phases. AGENTS.md is summary memory; Framework.md is the complete specification.
- Always check `wrangler.toml` before running `npx wrangler` commands
- Database ID is hardcoded in `wrangler.toml` — do not change without confirming
- R2 bucket name is `mildmate-assets` — consistent everywhere
- Admin pages are in `/admin/` path, protected by Cloudflare Access
- All customer-facing pages go in `public/`
- **Phase 2 (SEO URLs) is intentionally deferred** — it will run pre-launch after Phase 7 is complete. Do not start Phase 2 early.
