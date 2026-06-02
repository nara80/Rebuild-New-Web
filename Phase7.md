# Phase 7 — Admin Dashboard
**Status (2026-05-31): ✅ CODE COMPLETE — Admin at `/admin/` (moved from `/admin/sandbox/`, 301 redirect in place). Two dashboards built: `super-admin.html` + `admin.html` with full products CRUD, orders table (live D1 + Option A shipping tracking: carrier + tracking number + tracking URL), R2 drag-drop upload, CSV export, subscribers, customers (D1-grouped), **Quotes** (full sales quote CRUD with dual-currency THB/USD, Resend magic-link email via `orders@mildmate.com`). Workers API protected via `authorizeAdmin()` (Clerk JWT admin role + X-Admin-Secret fallback). Pages protected via `functions/admin/_middleware.ts` (admin-role gate) and `functions/account/_middleware.ts` (customer session gate).**
**Goal:** Build a private management interface for your team — protected by Clerk admin authentication.

**End Result:** A clean, Clerk-protected dashboard at `mildmate-new.pages.dev/admin/` that only your team can access. Your manufacturing team sees every order's exact custom dimensions. Your marketing team can update products and export email lists without touching any code. Your operations team can update order status live.

**Time Estimate:** Done (code complete). Setup remaining: assign admin roles in Clerk, set `ADMIN_EMAILS` env var on Cloudflare.

---

## What the Admin Dashboard Contains

The dashboard has 8–10 sections across two views, accessible from a left sidebar:

### Super Admin (`/admin/super-admin.html`)
```
┌─────────────────────────────────────────────────────────────────┐
│  MildMate Super Admin                                           │
├────────────┬────────────────────────────────────────────────────┤
│            │                                                    │
│ Dashboard  │   [Main content area — changes per sidebar tab]    │
│ Pricing    │                                                    │
│ DIY Prices │   Super Admin only: pricing params, exchange       │
│ Exchange   │   rates, marketing campaigns, admin accounts       │
│ Marketing  │                                                    │
│ Products   │   Admin: products CRUD, orders, customers,         │
│ Orders     │   subscribers, CSV export                          │
│ Customers  │                                                    │
│ Subscribers│                                                    │
│ Accounts   │                                                    │
│            │                                                    │
└────────────┴────────────────────────────────────────────────────┘
```

### Admin (`/admin/admin.html`)
```
┌─────────────────────────────────────────────────────────────────┐
│  MildMate Admin                                                 │
├────────────┬────────────────────────────────────────────────────┤
│            │                                                    │
│ Dashboard  │   [Main content area — changes per sidebar tab]     │
│ Marketing  │                                                    │
│ Products   │   Products CRUD, orders table with status dropdown,│
│ Orders     │   customers (D1), subscribers with CSV export      │
│ Customers  │                                                    │
│ Subscribers│                                                    │
│            │                                                    │
└────────────┴────────────────────────────────────────────────────┘
```

---

## What Phase 7 Actually Built

| File | What It Is |
|---|---|
| `public/admin/index.html` | Admin hub — role cards linking to super-admin + admin |
| `public/admin/super-admin.html` | Full super-admin — sidebar SPA, Products CRUD, Orders (D1 live + status dropdown + Option A shipping tracking), R2 drag-drop upload (20 slots), Customers (D1-grouped by email), Subscribers CSV, Pricing Params, DIY Prices, Exchange Rates, **Shipping Rates** (THB-only with USD preview, country dropdown from D1), Marketing (campaigns + offers), Admin Accounts, **Quotes** (sales quote CRUD with dual-currency THB/USD, soft-delete via archived, Resend magic-link email) |
| `public/admin/admin.html` | Admin dashboard — sidebar SPA, Products CRUD, Orders (D1 live + status dropdown), Customers (D1-grouped), Subscribers CSV, Marketing, **Quotes** (sales quote CRUD) |
| `public/_redirects` | `/admin/sandbox/*` → `/admin/:splat` (301) |
| `functions/admin/_middleware.ts` | **Option A auth** — Clerk JWT verification + admin role/email check for all `/admin/*` requests. Non-admins redirected to sign-in. Dev bypass on pages.dev/localhost. |
| `functions/account/_middleware.ts` | Clerk session gate for `/account/*` — redirects unauthenticated users to sign-in |
| `workers/api/admin-quotes.ts` | Admin: sales quote CRUD (GET/POST/PUT). Clerk JWT admin-role gate or X-Admin-Secret fallback. Dual-currency (THB/USD) with auto-conversion. Soft-delete via `archived` status. Resend magic-link email via `QUOTE_FROM_EMAIL` + `QUOTE_REPLY_TO` env vars. |
| `workers/api/admin-products.ts` | GET list / GET by slug / PUT update products (D1) |
| `workers/api/admin-upload.ts` | POST image → R2 → return CDN URL |
| `workers/api/admin-pricing.ts` | GET/PUT pricing params → D1 |
| `workers/api/admin-orders.ts` | GET/PUT orders → D1 (status CRUD + Option A shipping tracking: requires carrier_code + tracking_number on shipped). Auth: `authorizeAdmin()` — Clerk JWT admin role or X-Admin-Secret fallback |
| `workers/api/admin-customers.ts` | GET customers grouped by email from D1 orders. `?email=x` returns that customer's orders. Shipping Rates UI in super-admin uses this endpoint. |
| `workers/api/admin-diy.ts` | GET/PUT DIY prices |
| `workers/api/admin-exchange.ts` | GET/PUT exchange rates |
| `workers/api/admin-shipping.ts` | Super-admin shipping rates CRUD — THB-only upsert with USD preview column; OTHER rate protected (cannot be deleted). Ships alongside Exchange Rates tab in super-admin dashboard. |
| `workers/api/countries.ts` | Centralized country master list — D1 `countries_master` table (95 countries + OTHER), `GET /api/countries` endpoint consumed by checkout, /account, and super-admin dropdowns. |
| `workers/api/admin-contacts.ts` | Admin: contacts management — list, view, delete contact form submissions from D1. |
| `workers/api/admin-stats.ts` | Admin: dashboard statistics (today/7d/30d orders + revenue) — schema self-heal, dual-currency. **Wired to super-admin Dashboard tab?** Check: if not yet, add `loadStats()` call in super-admin.html sidebar SPA init. |
| `workers/api/clerk-verify.ts` | Shared Clerk JWT verification via Web Crypto + JWKS |

### Migrations Applied by Phase 7

| Migration | What It Is |
|---|---|
| `010_discount_expiry.sql` | `expires_at` + `source` on `discount_claims` |
| `011_orders_discount_code.sql` | `discount_code` on `orders` |
| `012_contacts.sql` | Unified `contacts` table |
| `013_favorites.sql` | `favorites` table (authenticated wishlist) |
| `014_order_shipping_tracking.sql` | `carrier_code`, `tracking_number`, `tracking_url`, `shipping_status`, `shipped_at` on `orders` |
| `015_shipping_rates.sql` | `shipping_rates` table (THB-only, Option A) |
| `016_countries_master.sql` | `countries_master` table (95 countries + OTHER) |

---

## Admin Auth Architecture

### Option A — Implemented (Clerk Middleware + API Auth)

**Page protection (`functions/admin/_middleware.ts`):**
Every request to `/admin/*` is intercepted. The middleware:
1. Extracts Clerk session token from `__session` cookie or query param
2. Verifies the JWT against Clerk's JWKS endpoint
3. Checks for `admin`/`super-admin` role in the JWT claims OR email in `ADMIN_EMAILS` env var
4. Unauthenticated → redirect to Clerk sign-in
5. Authenticated but not admin → 403 "Access Denied" page
6. Dev mode (pages.dev/localhost) → bypass (relies on client-side gate)

**API protection (per-worker `authorizeAdmin()`):**
Each `/api/admin/*` endpoint independently verifies auth:
- Prefers `Authorization: Bearer <clerk-jwt>` → verifies → checks admin role/email
- Falls back to `X-Admin-Secret` header (non-prod only, or `ADMIN_SECRET_ALLOW_PROD=true`)

### Option B — Planned (Cloudflare Access)

Add Cloudflare Access zero-trust policy in front of `/admin/*` for defense-in-depth:
- Cloudflare handles identity verification before requests reach the Worker
- Works with Google, GitHub, or any OIDC provider
- Requires Cloudflare Teams (free for up to 50 users)
- Can co-exist with Option A — Access is the outer gate, middleware is the inner gate

### Setup Required

All Phase 7 setup items are complete as of 2026-05-31:
- Clerk admin roles assigned (`super-admin` for nara19080@gmail.com + sriprasit9@gmail.com; `admin` for mildmateshop@gmail.com) ✅
- `ADMIN_EMAILS` secret set on Cloudflare ✅
- `QUOTE_FROM_EMAIL` + `QUOTE_REPLY_TO` set for quote magic-link emails ✅
- `admin-stats.ts` wiring verified in super-admin.html ✅
- `CLERK_PUBLISHABLE_KEY` env var set ✅

---

## Orders — Live D1 Behavior

| Environment | Auth Present? | What You See |
|---|---|---|
| Production (www.mildmate.com) | Yes (Clerk admin) | Live D1 orders with status dropdowns |
| Production (www.mildmate.com) | No / wrong role | Red error card: "D1 unavailable — Sign in with admin Clerk role" |
| Dev (pages.dev) | Any | Tries D1 first, falls back to 3 sample orders |
| Local | Any | Tries D1 first, falls back to 3 sample orders |

---

## Customers — Live D1 Behavior

Same pattern as Orders. Customers are grouped by email from the D1 `orders` table:
- List view shows: Name, Email, Order Count, Total Spent (THB/USD)
- Detail view (click row) fetches that customer's orders from D1 via `?email=x`
- Non-production fallback: 3 hardcoded sample customers

---

## What's Still Pending

| Item | Status |
|---|---|
| Option B — Cloudflare Access | **Planned for launch** — defense-in-depth, no code changes needed |
| AfterShip tracking widget | Not built — Option A tracking implemented instead (carrier + tracking number entered by admin on shipped, URL auto-generated from templates, inline in `/account` Orders panel and admin Orders table. No external API needed.) |
| Dashboard overview (live stats) | Currently shows static sample; `workers/api/admin-stats.ts` exists with schema self-heal but not yet wired to UI in super-admin dashboard |
| Shipping Rates management UI | Built in super-admin.html (Shipping Rates tab) — uses `workers/api/admin-shipping.ts`; countries dropdown from `workers/api/countries.ts`; THB-only inputs with USD preview |
| Old sandbox files cleanup | `/admin/sandbox/` files still exist as reference; redirect covers production URLs |

---

## How to Access

**Dev:** `https://mildmate-new.pages.dev/admin/` — no auth gate (dev bypass), client-side Clerk gate handles it

**Production:** `https://www.mildmate.com/admin/` — `functions/admin/_middleware.ts` enforces Clerk admin auth

---

## How to Add a New Admin User

1. **Option A (Clerk role):** Clerk Dashboard → Users → select user → Metadata → set `public_metadata.role` to `admin` or `super-admin`
2. **Option A (Email):** Add their email to the `ADMIN_EMAILS` env var (comma-separated) and redeploy
3. **Option B (future):** Add their email in Cloudflare Zero Trust → Access → MildMate Admin policy

---

## How You Know Phase 7 Is Complete

- [x] Admin pages built and accessible at `/admin/`
- [x] Products CRUD working (D1 read/write)
- [x] Orders table shows live D1 data (when authenticated)
- [x] Order status can be changed (PUT to D1)
- [x] R2 drag-drop image upload (20 slots per product)
- [x] Customers list grouped from D1 orders
- [x] Subscribers with CSV export
- [x] Pricing params, DIY prices, exchange rates editable
- [x] Marketing campaigns + offers UI
- [x] Admin accounts management (localStorage-based)
- [x] `/admin/sandbox/` → `/admin/` 301 redirect
- [x] `functions/admin/_middleware.ts` — Clerk admin-role gate for `/admin/*`
- [x] `functions/account/_middleware.ts` — Clerk session gate for `/account/*`
- [x] API endpoints protected via `authorizeAdmin()`
- [x] `workers/api/admin-quotes.ts` — Admin sales quote management (GET/POST/PUT, dual-currency, soft-delete)
- [ ] Clerk admin roles assigned to team members
- [ ] `ADMIN_EMAILS` env var set on Cloudflare
- [ ] `QUOTE_FROM_EMAIL` / `QUOTE_REPLY_TO` env vars set for quote magic-link emails (optional, defaults to `orders@mildmate.com`)
- [ ] Option B — Cloudflare Access (optional, for launch)

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "D1 unavailable" on Orders page (production) | Clerk session missing or user doesn't have admin role. Check `public_metadata.role` in Clerk Dashboard or add email to `ADMIN_EMAILS`. |
| /admin/ redirects to Clerk sign-in loop | Clerk dev instance (`kind-joey-29`) may have cookie issues on custom domain. Verify Clerk production instance is configured (Option 3). |
| "Not Found" on /api/admin/orders | Worker hasn't been deployed yet. Run `npx wrangler pages deploy public`. |
| Product list won't select | Missing `_pendingUploads`/`_pendingCount` declarations — fixed in super-admin.html. |
| Image upload fails | Check R2 bucket binding `MILDMATE_ASSETS` in `wrangler.toml`. |
| CSV export empty | No subscribers in D1. Test footer signup flow first. |

---

## What Happens Next

Once Phase 7 admin is fully verified, move to **Phase 8 — Polish + Launch**.
