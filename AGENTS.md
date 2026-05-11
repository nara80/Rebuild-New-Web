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

---

## Phase Status

| Phase | Status | Notes |
|---|---|---|
| 0 — Mockup | ✅ Approved | `mockup.html` created |
| 1 — Foundation | ✅ Complete | Scaffold, D1 migration, local server tested, placeholder index.html |
| 2 — SEO URLs | ⏸️ Deferred | **Intentionally deferred — runs pre-launch AFTER Phase 7 complete** |
| 3 — Design System | ✅ Complete | Header, footer, CSS, nav.js, search overlay, mobile drawer left |
| 4 — Homepage + Products | ✅ Complete | Homepage EN+TH (AJAX email signup, 15% off), configurator, cart.js, geo.js, all static pages (about→Engineering Authority 5-section rebuild with real images, contact, fabric, shipping→Returns&Delivery, policy, reviews), size guides, product/category skeletons, workers (products, pricing, geo, subscribe, unsubscribe), image compression (92.5% saved), `discount_claims` migration ready, cookie consent banner (GDPR, GA4 G-0GWVSPJLVJ), real Etsy reviews (8 with mapped names/countries), 14-section privacy policy, unsubscribe page + API |
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
| Font | Quicksand (replaced Prompt) |
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

## Notes for Future Droid Sessions

- **ALWAYS read `Framework.md` at the start of every session** — it contains the full site blueprint, page layouts, design system, database schema, and build phases. AGENTS.md is summary memory; Framework.md is the complete specification.
- Always check `wrangler.toml` before running `npx wrangler` commands
- Database ID is hardcoded in `wrangler.toml` — do not change without confirming
- R2 bucket name is `mildmate-assets` — consistent everywhere
- Admin pages are in `/admin/` path, protected by Cloudflare Access
- All customer-facing pages go in `public/`
- **NEVER auto-deploy.** The user controls all deployments manually. Do NOT run `wrangler pages deploy` or any deploy command unless the user explicitly asks. Always say "Deploy when you're ready" instead.
- **Phase 2 (SEO URLs) is intentionally deferred** — it will run pre-launch after Phase 7 is complete. Do not start Phase 2 early.
