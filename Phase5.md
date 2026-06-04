# Phase 5 — Checkout + Stripe Payments + Auth
**Status (2026-06-03): ✅ BUILT + VERIFIED — Full Stripe checkout + PromptPay QR, Clerk multi-provider auth (Google/Email/Facebook), magic quote link, account 4-tab portal (Dashboard/Orders/Favorites/Addresses), admin quote management system (`workers/api/admin-quotes.ts`), automated thank-you discount email after order confirmation (`buildThankyouEmail` → `thankyou_queue` table + cron), `migrations/001–016` applied. Workers API defensive schema self-heal on all endpoints. Admin order shipped flow with Option A tracking (carrier_code + tracking_number + tracking_url auto-generated from URL templates). Centralized `countries_master` D1 table + `/api/countries` consumed by all 3 country dropdowns. Shipping rates Option A (THB-only source, geo-country detection, OTHER fallback). Language-driven currency (EN pages → USD, TH pages → THB). Quote page: 65/35 sticky transaction-card layout, single-currency display (USD or THB), Review & Pay CTA. Quote email sender: `orders@mildmate.com` via `QUOTE_FROM_EMAIL` + `QUOTE_REPLY_TO` Cloudflare secrets. AfterShip NOT used.**

**Tracking:** AfterShip is NOT used. Option A tracking — carrier + tracking number entered by admin on shipped, URL auto-generated from carrier templates (thaipost, flash, dhl, ups, fedex, usps). No external API credentials. No `/track/` page — tracking is inline in `/account` Orders panel.**
**Goal:** Connect the shopping cart to Stripe so customers can actually complete a purchase.

**End Result:** A complete 3-step guest checkout with optional social login. You can do a real test purchase and see the order appear in your database, receive a "New Order" notification email, and the customer receives an order confirmation — all automatically. Logged-in customers can view their order history and re-order custom sizes quickly.

**Time Estimate:** 45–60 minutes (most of your time is in Stripe dashboard setup — Droid handles all the code)

---

## Initial Requirements — What You Must Provide

Collect all of the following before telling Droid to build. Most of Phase 5 involves setting up accounts and keys in external services — Droid cannot do those steps for you, but every step is explained in plain English below.

---

### Requirement 1 — Confirm Phase 4 Is Complete

Phase 5 requires the cart and checkout UI pages built in Phase 4. If Phase 4 is not complete, there is nothing to connect to Stripe.

**Confirm before starting:**
- [ ] `http://localhost:8788` shows the homepage with the Custom Configurator working
- [ ] Adding a product to cart updates the cart icon count in the header
- [ ] `http://localhost:8788/all-products/` shows the product listing grid

**If any item is missing:** Go back and complete Phase 4 before continuing.

---

### Requirement 2 — Your Stripe Account Status

Droid needs to know if you already have a Stripe account.

**Check one:**
- [ ] **I have a Stripe account already** — skip Step 5.1, go straight to Step 5.2
- [ ] **I do not have a Stripe account yet** — follow Step 5.1 to create one

> Stripe account creation takes about 10 minutes. You do NOT need to fully activate (verify identity) before testing — test mode works without full activation.

---

### Requirement 3 — Your PromptPay Registered ID

PromptPay QR codes for Thai customers require your registered Thai ID number in Stripe.

**Find and write down one of these:**
| ID Type | Where to Find It |
|---|---|
| Thai National ID (บัตรประชาชน) | Your national ID card — 13-digit number |
| Tax ID (เลขประจำตัวผู้เสียภาษี) | Your business registration document or Revenue Department card |

**Which to use:**
- If you are selling as an individual → use your Thai National ID
- If you have a registered company → use your Tax ID

> This is given directly to Stripe in their dashboard settings — never given to Droid or put in any code file.

---

### Requirement 4 — Your Stripe API Keys

After creating or logging into your Stripe account, you need to collect 3 keys from the Stripe dashboard. These are found in **Developers → API keys** (always use **Test mode** first).

**Keys to collect:**

| Key | Looks Like | Where to Find | Safe to Share? |
|---|---|---|---|
| Publishable Key | `pk_test_51...` | Developers → API keys | Yes (public) |
| Secret Key | `sk_test_51...` | Developers → API keys → Reveal | **Never share** |
| Webhook Secret | `whsec_...` | Developers → Webhooks → your endpoint → Reveal | **Never share** |

> The Webhook Secret is only available after you complete Step 5.4 (creating the webhook endpoint). Collect the Publishable Key and Secret Key first, then add the Webhook Secret after Step 5.4.

**How to find them — step by step:**
1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Make sure the top-right toggle says **Test mode** (not Live mode)
3. Click **Developers** in the top navigation
4. Click **API keys**
5. Copy the Publishable Key
6. Click **Reveal** next to the Secret Key → copy it
7. Save both in a notepad document on your computer (never in chat or email)

---

### Requirement 5 — Your Order Notification Email

Every time a customer completes a payment, one "New Order" notification email is sent to your team. Decide which email address receives this.

**Write down:**
- Order notification email: `[e.g. orders@mildmate.com or your personal business email]`

**Recommendation:** Use an email you check regularly, especially during the first month after launch.

---

### Requirement 6 — Your Email Sender Name and Address

Resend sends emails on behalf of your domain. The "From" field in all customer emails will use this name and address.

**Decide and write down:**
- Sender name: `[e.g. MildMate Bedding]`
- Sender address: `[e.g. orders@mildmate.com or hello@mildmate.com]`

**The full "From" field will look like:** `MildMate Bedding <orders@mildmate.com>`

> The sending domain must have a DNS TXT record added (explained in Step 5.9). If your domain is on Cloudflare, this takes under 2 minutes. If it is on another registrar, allow 5–30 minutes for the change to activate.

---

### Requirement 7 — Auth Providers (Implemented: Google + Email + Facebook via Clerk)

Clerk handles auth as a managed service. The current implementation uses:
- **Google** — OAuth sign-in via Clerk hosted pages
- **Facebook** — OAuth sign-in via Clerk hosted pages (requires Clerk dashboard configuration)
- **Email** — magic link or email/password via Clerk hosted pages
- **LINE** — NOT built; international positioning deprioritizes LINE-specific login

Checkout is **guest-first**: customers can complete payment without logging in. Social login is optional — it enables saved addresses and order history in `/account/`.

> To add LINE or Facebook login: configure them as social providers in your Clerk Dashboard → User Management → Social providers. No code changes needed — Clerk handles the UI automatically.

---

## How the Payment Flow Works (Plain English)

Understanding this flow helps you know what to check during testing:

```
Customer fills cart
       ↓
Enters email + shipping details on your site   ← email saved here for Phase 6
       ↓
Clicks "Pay Now"
       ↓
Redirected to Stripe's secure hosted page      ← Stripe handles all card security
       ↓
Thai visitor: sees PromptPay QR code
Global visitor: sees card / Apple Pay / Google Pay
       ↓
Payment successful
       ↓
Stripe sends a signal to your Worker (webhook)
       ↓
Worker saves order to D1 database              ← appears in your Admin dashboard
Worker sends email to customer (Resend)  ← order confirmation receipt
Worker sends email to you (Resend)       ← "New Order" notification
       ↓
Customer redirected back to your site
Shows: "Order Confirmed" page
```

> **Important:** You never touch credit card numbers. Stripe handles all payment security on their own servers. This is called "Stripe Checkout" — the safest and simplest integration available.

---

## Custom Quote Checkout Flow (Extension)

Custom-size orders (marine, truck cab, family co-sleep, RV) follow a **quote-first, pay-later** path that merges into the standard checkout above.

```
Customer receives magic link email:
  "Your quote QT-250512-001 is ready — $89.00"
       ↓
Clicks /quote/QT-250512-001
       ↓
Sees locked quote with full dimensions + fabric + extras
       ↓
Clicks "Add to Cart — $89.00 (Locked)"
       ↓
Quote item added to cart as type='custom_quote'
  { quote_id, product_name, dimensions, fabric, locked_price: 8900 }
       ↓
Proceeds to standard checkout (same 3-step flow above)
       ↓
Stripe payment — same PromptPay / card / Apple Pay / Google Pay
       ↓
Webhook saves order with quote_id reference
       ↓
Order confirmation email sent
```

**Quote item in cart:** Price is frozen at the admin-approved amount. Customer cannot change dimensions or fabric at checkout — only shipping address and payment method.

**Why this works:** The configurator (Phase 4) collected dimensions. The quote (between Phase 4 and 5) locked the price. The checkout (Phase 5) only handles payment — no pricing logic needed.

---

## What Phase 5 Builds

### Public Pages

| File | What It Is |
|---|---|
| `public/checkout/index.html` | Checkout page (Cart Review → Shipping Details → Payment) with autocomplete, optional Google sign-in banner, Subtotal/Shipping/Total on all steps, centralized country dropdown from `/api/countries`, phone code auto-fill on country change, country-specific tariff/tax notes, z-index fixed country dropdown, custom-quote product image placeholder |
| `public/order-confirmed/index.html` | Success page shown after payment — reads `?session_id=` |
| `public/account/index.html` | My Account 4-tab portal — Dashboard, Orders (with dual-match thumbnail resolution for legacy slugs), **Favorites** wishlist, Addresses (CRUD); inline carrier+tracking "Track Package" link (Option A) |

### Admin Pages

| File | What It Is |
|---|---|
| `public/admin/index.html` | Admin hub with role cards (Admin / Super Admin) |
| `public/admin/admin.html` | Admin dashboard — orders, products, subscribers, customers, **Quotes** (full CRUD) |
| `public/admin/super-admin.html` | Super-admin dashboard — full CRUD: orders, products, pricing params, shipping rates, exchange rates, DIY prices, contacts, stats, **Quotes** (full CRUD) |
| `functions/admin/_middleware.ts` | Clerk JWT + admin-role gate for `/admin/*` (dev bypass on pages.dev/localhost) |
| `functions/account/_middleware.ts` | Clerk session gate for `/account/*` — redirects unauthenticated users to sign-in |

### Workers / API Endpoints

| File | What It Is |
|---|---|
| `workers/api/index.ts` | Main Worker entry — routes all `/api/*` |
| `functions/api/[[path]].ts` | Pages Functions catch-all router — local dev bridge to Worker handlers |
| `workers/api/checkout.ts` | Creates Stripe Checkout Session (redirect flow) + PromptPay for TH. Returns `{url, session_id}`. Injects Stripe shipping line item + `shipping_amount_thb` metadata. |
| `workers/api/webhook.ts` | Receives `checkout.session.completed` → saves order to D1 → sends Resend emails (customer + team). Marks `abandoned_carts.recovered=1` on payment. |
| `workers/api/email.ts` | Resend email helper. Default sender: `MildMate <noreply@mildmate.com>`. Custom quote emails override via `QUOTE_FROM_EMAIL` env var (default: `MildMate <orders@mildmate.com>`). |
| `workers/api/order-confirmed.ts` | Order confirmed lookup — queries D1 by `stripe_session_id` |
| `workers/api/auth.ts` | Auth detection API — `/api/auth/me` reads Clerk JWT (Google/Email via Clerk hosted pages) |
| `workers/api/clerk-verify.ts` | Clerk JWT verification via Web Crypto + JWKS (`/api/auth/me` consumer) |
| `workers/api/customers.ts` | Customer API — order history with dual-match thumbnail resolution (slug normalization + title fallback), saved-cart sync (PUT/DELETE), saved-addresses CRUD (GET/POST/PUT/DELETE with default-address logic, 5-address limit) |
| `workers/api/shipping.ts` | Centralized shipping-quote engine. Reads THB-only rates from `shipping_rates`, converts via `exchange_rates.rate_per_thb` at query time. Returns `{amount, amount_thb, first_item_thb, additional_item_thb, is_fallback}`. Auto-creates table + seeds OTHER on first run. |
| `workers/api/countries.ts` | Centralized country master list. `countries_master` D1 table seeded from `MASTER_COUNTRIES` (95 countries + OTHER). |
| `workers/api/admin-orders.ts` | Admin: GET/PUT orders (status + Option A shipping tracking). CSV export. |
| `workers/api/admin-customers.ts` | Admin: customers grouped by email from D1 orders |
| `workers/api/admin-products.ts` | Admin: GET/PUT products (X-Admin-Secret) |
| `workers/api/admin-stats.ts` | Admin: dashboard statistics (today/7d/30d orders + revenue) |
| `workers/api/admin-quotes.ts` | **Admin: Sales quote management** (GET/POST/PUT). Clerk JWT admin-role gate or X-Admin-Secret fallback. Dual-currency (THB/USD) storage with auto-conversion. Soft-delete via `archived` status. Resend magic-link email via `QUOTE_FROM_EMAIL` + `QUOTE_REPLY_TO` env vars. |
| `workers/api/admin-upload.ts` | Admin: R2 image upload → CDN URL |
| `workers/api/admin-pricing.ts` | Admin: GET/PUT pricing params |
| `workers/api/admin-exchange.ts` | Admin: GET/PUT exchange rates |
| `workers/api/admin-diy.ts` | Admin: GET/PUT DIY prices |
| `workers/api/admin-shipping.ts` | Super-admin shipping rates CRUD. THB-only upsert; GET returns USD preview via `getUsdRatePerThb()`. OTHER rate is protected (cannot be deleted). |
| `workers/api/admin-contacts.ts` | Admin: contacts management |
| `workers/api/discount.ts` | Discount code validation + claim with `expires_at` + `source` tracking |
| `workers/api/favorites.ts` | Authenticated wishlist — user+email matching, duplicate guard, schema auto-heal |
| `workers/api/quote.ts` | Customer quote request → D1 `custom_quotes` + Resend email to `contact@mildmate.com` with `QUOTE_FROM_EMAIL` sender |
| `functions/quote/[[path]].ts` | **Quote magic link page** at `/quote/QT-XXXXX/`. Desktop: 65/35 asymmetric split (spec grid left + sticky transaction card right). Mobile: unified single-column card. Single-currency price display. Lock-icon validity badge. Add to Cart → Review & Pay → `/checkout/`. Logo header + EN/TH lang toggle. |
| `workers/api/subscribe.ts` | Email signup → D1 `subscribers` with `INSERT OR IGNORE` |
| `workers/api/unsubscribe.ts` | Email removal from D1 (privacy-safe, always 200) |
| `workers/api/contact.ts` | Contact form → D1 `contacts` + Resend email |
| `workers/api/products.ts` | D1 product catalog listing + category filtering |
| `workers/api/pricing.ts` | All 23 pricing formulas (fitted/V-Berth/flat/encasement/duvet/pillowcase/mattress-protector) |
| `workers/api/pricing-params.ts` | Public read-only access to admin-set pricing params |
| `workers/api/geo-currency.ts` | CF-IPCountry detection → THB/USD pricing |
| `functions/r2/[[path]].ts` | R2 asset proxy — serves uploaded product images at `/r2/*` |

### Client-side Scripts

| File | What It Is |
|---|---|
| `public/js/clerk.js` | Client-side Clerk auth — SDK init, sign-in/sign-up redirect, sign-out, token getter, auth state events |
| `public/js/cart.js` | Client-side cart — localStorage + server sync (PUT/DELETE `/api/customers/cart`), tokenized auth headers, auto-sync on save |
| `public/js/geo.js` | Currency display toggle — `getPageCurrencyByLanguage()` drives EN → USD, TH → THB (language-path detection, not geo-only). Reads `/api/geo` for geo context. |

### Migrations Applied (Phase 5 additions)

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

## Before You Start — Stripe Concepts Explained

| Term | Plain English |
|---|---|
| **Stripe Checkout** | Stripe's hosted payment page — customers go there to pay, then come back to your site |
| **Publishable Key** | A public code that identifies your Stripe account on the frontend (safe to show) |
| **Secret Key** | A private code used on the backend only — never share this, never put it in HTML |
| **Webhook** | A signal Stripe sends to your Worker when a payment is completed |
| **Webhook Secret** | A code that proves the signal came from Stripe and not a fake source |
| **Test Mode** | Stripe's sandbox — you can make fake payments without real money |
| **Live Mode** | Real payments with real money — only switch to this on launch day |
| **PromptPay** | Thai mobile payment via QR code — Stripe supports this natively |

---

## Step-by-Step Instructions

### Step 5.1 — Create Your Stripe Account

If you do not have a Stripe account yet:

1. Go to [stripe.com](https://stripe.com)
2. Click **Start now** → Sign up with your email
3. Complete your business profile:
   - Business type: **Individual** or **Company**
   - Country: **Thailand**
   - Business website: `https://www.mildmate.com`
   - Business category: **Retail** → **Home & Garden**
4. Verify your email address (check your inbox)

> **You do NOT need to activate your account for testing.** Stripe allows test payments before your account is fully verified. Activate it fully before launch day.

---

### Step 5.2 — Enable PromptPay in Stripe

1. In Stripe dashboard, click **Settings** (gear icon, top right)
2. Click **Payment methods**
3. Find **PromptPay** in the list
4. Click the toggle to **Enable** it
5. You will be asked for your PromptPay registered ID:
   - Enter your **Thai National ID** or **Tax ID** (the ID registered with PromptPay)
6. Click **Save**

> PromptPay is now enabled. Thai customers will automatically see a QR code instead of a card form when they pay.

---

### Step 5.3 — Get Your Stripe API Keys

**How to find your keys:**
1. In Stripe dashboard, click **Developers** (top navigation)
2. Click **API keys**
3. Make sure you are in **Test mode** (toggle in the top-right of the page — should say "Test mode")
4. You will see two keys:

| Key Type | Looks Like | What It Is |
|---|---|---|
| Publishable key | `pk_test_51...` | Safe to use in frontend code |
| Secret key | `sk_test_51...` | NEVER share — backend only |

5. Click **Reveal** next to the Secret key
6. Copy both keys somewhere safe (a notepad document on your computer)

> **Never paste these keys into chat messages, emails, or public places.** Droid stores them as Cloudflare encrypted secrets — they never appear in your code files.

---

### Step 5.4 — Set Up Your Stripe Webhook

The webhook is the connection that tells your Worker "a payment just succeeded."

**How to set it up:**

1. In Stripe dashboard → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. In the **Endpoint URL** field, enter:
   ```
   https://mildmate-new.pages.dev/api/webhook/stripe
   ```
   > Note: You will update this to `https://www.mildmate.com/api/webhook/stripe` on launch day
4. Under **Select events to listen to**, click **Select events**
5. Search for and select: `checkout.session.completed`
6. Click **Add events** → **Add endpoint**
7. On the next screen, click **Reveal** under **Signing secret**
8. Copy this webhook secret (starts with `whsec_...`) — you will give it to Droid

---

### Step 5.5 — Store Your Keys as Cloudflare Secrets

Cloudflare secrets are like a locked safe for sensitive information. They are stored encrypted and injected into your Worker at runtime — never visible in your code files.

**How to store them:**

1. Open cmd and navigate to your project:
   ```
   cd D:\00_MildMate\Re-Bulit_Web
   ```
2. Store your Stripe Secret Key:
   ```
   npx wrangler secret put STRIPE_SECRET_KEY
   ```
   When prompted, paste your secret key (starts with `sk_test_...`) and press Enter

3. Store your Stripe Webhook Secret:
   ```
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```
   When prompted, paste your webhook secret (starts with `whsec_...`) and press Enter

4. Store your Stripe Publishable Key (this one goes in wrangler.toml as a variable, not a secret — Droid handles this):
   ```
   npx wrangler secret put STRIPE_PUBLISHABLE_KEY
   ```
   When prompted, paste your publishable key (starts with `pk_test_...`) and press Enter

**Confirm they are saved:**
```
npx wrangler secret list
```
You should see:
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PUBLISHABLE_KEY
```

---

### Step 5.6 — Decide Your Order Notification Email

Every time a customer completes a payment, your team receives a "New Order" email. Decide which email address should receive this.

**Recommended:** Use a dedicated email like `orders@mildmate.com` or your personal business email.

Write it down — you will give it to Droid in the next step.

---

### Step 5.7 — Decide Your Email Sender Name and Address

Resend sends emails on your behalf. You need to decide what the "From" field says in emails customers receive.

**Examples:**
- From: `MildMate Bedding <orders@mildmate.com>`
- From: `MildMate <hello@mildmate.com>`

> **Important:** The sending domain (`mildmate.com`) must have a DNS record added to prove you own it. Droid will tell you exactly which DNS record to add when the time comes — it takes about 2 minutes.

---

### Step 5.8 — Tell Droid to Build Phase 5

Once all requirements are ready and your Stripe keys are stored as Cloudflare secrets (Step 5.5), hand off to Droid.

**Tell Droid:**
> "Phase 4 is complete. Please build Phase 5 — the checkout, Stripe payment integration, and social login.
>
> **Requirement 1:** Phase 4 confirmed complete — configurator works and cart is functional.
> **Requirement 2:** Stripe account is [already set up / just created in Step 5.1].
> **Requirement 3:** PromptPay registered and enabled in Stripe (Step 5.2 done).
> **Requirement 4:** All 3 Stripe keys stored as Cloudflare secrets (Step 5.5 done):
> - STRIPE_PUBLISHABLE_KEY ✓
> - STRIPE_SECRET_KEY ✓
> - STRIPE_WEBHOOK_SECRET ✓
> **Requirement 5 — Order notification email:** [your email]
> **Requirement 6 — Email sender:** [Sender Name] <[sender address]>
> **Requirement 7 — Social login:** [Build with Google + LINE / Skip for now — add later]
>
> Build the 3-step checkout page (guest checkout with optional social login), Stripe session Worker, webhook Worker, Resend email system, My Account page with inline Option A tracking (carrier + tracking number entered by admin on shipped, URL auto-generated from carrier template), and the magic quote `/quote/QT-XXXXX/` page.

**Phase 5 Additional Requirements:**

### Requirement 8 — Option A Order Tracking (Already Built)

No external API needed. When admin sets an order to "Shipped", they enter:
- **Carrier code** (thaipost / flash / dhl / ups / fedex / usps)
- **Tracking number** (text input)

The system auto-generates the carrier tracking URL from URL templates — no AfterShip, no API key needed.

| Carrier | URL Template |
|---|---|
| Thai Post | `https://track.thailandpost.co.th/?trackNumber={TRACKING}` |
| Flash Express | `https://www.flashexpress.co.th/fle/tracking?se={TRACKING}` |
| DHL | `https://www.dhl.com/th-en/home/tracking/tracking-express.html?submit=1&tracking-id={TRACKING}` |
| UPS | `https://www.ups.com/track?tracknum={TRACKING}` |
| FedEx | `https://www.fedex.com/fedextrack/?trknbr={TRACKING}` |
| USPS | `https://tools.usps.com/go/TrackConfirmAction?tLabels={TRACKING}` |

Tracking link is shown inline in the customer `/account` Orders panel and the admin Orders table.

---

**What was built (verified 2026-05-30):**
1. `public/checkout/index.html` — 3-step checkout UI with country dropdown from `/api/countries`, phone code auto-fill on country change, Subtotal/Shipping/Total display on all steps, tariff/tax notes by country group, CSS z-index fix for dropdown
2. `public/account/index.html` — My Account page (order history with dual-match thumbnail resolution, saved addresses, Favorites wishlist, social login via Clerk)
3. `public/order-confirmed/index.html` — post-payment success page
4. `workers/api/checkout.ts` — Stripe Checkout Session creator with shipping line item injection + `shipping_amount_thb` metadata
5. `workers/api/webhook.ts` — payment confirmation handler (saves order to D1 + sends Resend emails)
6. `workers/api/email.ts` — Resend email sender
7. `workers/api/auth.ts` — Clerk JWT verification (Google/Email via Clerk hosted pages; Facebook/LINE NOT implemented)
8. `workers/api/customers.ts` — Customer profile, order history with dual-match thumbnail resolution, cart sync, addresses CRUD
9. `workers/api/shipping.ts` — Centralized shipping-quote engine (THB-only rates, exchange-rate conversion, geo-country detection, OTHER fallback)
10. `workers/api/countries.ts` — Centralized country master list (D1 `countries_master`, 95 countries + OTHER)
11. `workers/api/admin-shipping.ts` — Super-admin shipping rates CRUD (THB-only, USD preview column, OTHER protected)

---

### Step 5.9 — Verify Resend API Key

The `RESEND_API_KEY` secret must be set on your Pages project (already done in Phase 4). Droid will verify this is in place.

**Domain verification:** Done via Resend dashboard auto-configuration (connects to Cloudflare, pushes DNS records). No manual DNS TXT records needed.

**To verify:**
1. Go to https://resend.com/domains — confirm `mildmate.com` shows "Verified"
2. Confirm `RESEND_API_KEY` is set: `npx wrangler pages secret list` shows the secret

---

### Step 5.10 — Deploy to Your Test Site

Before you can test webhooks, the Worker needs to be deployed to Cloudflare (not just running locally), because Stripe needs to reach a real URL to send the webhook.

**How to deploy:**
1. In cmd:
   ```
   cd D:\00_MildMate\Re-Bulit_Web
   npx wrangler pages deploy public
   ```
2. You will see:
   ```
   Deploying to mildmate-new.pages.dev...
   ✅ Deployment complete
   ```
3. Your test site is now live at `https://mildmate-new.pages.dev`

---

### Step 5.11 — Do a Full Test Purchase

This is the most important test in Phase 5. Use Stripe's test card — no real money is charged.

**Stripe test card details:**
| Field | Value |
|---|---|
| Card number | `4242 4242 4242 4242` |
| Expiry date | Any future date (e.g., `12/28`) |
| CVC | Any 3 digits (e.g., `123`) |
| Name | Any name |
| Address | Any address |

**Walk through the full purchase:**

1. Go to `https://mildmate-new.pages.dev`
2. Open a product → enter dimensions → select fabric → click **Add to Cart**
3. Click the cart icon → click **Checkout**
4. **Step 1 — Cart Review:** Confirm your item and price are shown correctly
5. **Step 2 — Guest Details:** Enter a test name, your own email, phone number, and address
6. Click **Proceed to Payment**
7. You are redirected to Stripe's hosted page
8. Enter the test card details above
9. Click **Pay**
10. You are redirected back to `https://mildmate-new.pages.dev/order-confirmed/`

**After the purchase, check all 4 outcomes:**

| What to Check | Where to Check | Expected |
|---|---|---|
| Order confirmation page | Your browser | Shows "Order Confirmed" with order summary |
| Customer email | Your own inbox (you used your email as test customer) | Receipt with order details and dimensions |
| Team notification email | Your order notification inbox | "New Order" email with customer details |
| Order in database | Stripe dashboard → **Payments** | Shows test payment of the correct amount |

---

### Step 5.12 — Verify the Order in Your Database

After the test purchase, confirm the order was saved to D1.

**How to check:**
1. In cmd:
   ```
   npx wrangler d1 execute mildmate-db --command="SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;"
   ```
2. You should see your test order with all details including custom dimensions:
   ```
   ┌────┬──────────────────┬───────────────┬──────────┬─────────────┬──────┬──────┐
   │ id │ email            │ customer_name │ fabric   │ custom_width│ ...  │ ...  │
   ├────┼──────────────────┼───────────────┼──────────┼─────────────┼──────┼──────┤
   │  1 │ test@example.com │ Test Customer │ BreezePlus│ 160        │ ...  │ ...  │
   └────┴──────────────────┴───────────────┴──────────┴─────────────┴──────┴──────┘
   ```

---

### Step 5.13 — Test PromptPay (Thai Payment)

To test the Thai payment flow:

1. In Stripe dashboard → **Developers** → **API keys** → confirm you are in **Test mode**
2. Go to `https://mildmate-new.pages.dev` and add an item to cart
3. Proceed to checkout → enter details
4. On the Stripe payment page, look for a **PromptPay** option
5. Click it — a QR code appears
6. Use Stripe's test instructions: for PromptPay in test mode, the payment automatically completes after a few seconds without scanning

> **If PromptPay is not showing:** Tell Droid. It may need to be explicitly enabled in the Stripe session creation code.

---

## How You Know Phase 5 Is Complete

Go through this checklist before moving to Phase 6:

**Initial Requirements:**
- [x] Phase 4 confirmed complete (configurator works, cart functional)
- [x] Stripe account exists (created or already had one)
- [x] PromptPay enabled in Stripe with your Thai National ID or Tax ID
- [x] All 3 Stripe keys collected (Publishable, Secret, Webhook Secret)
- [x] Order notification email address decided and written down
- [x] Email sender name and address decided and written down
- [x] Custom quote workflow confirmed: admin pricing → magic link → locked-price add to cart

**Build Steps:**
- [x] All 3 Stripe keys stored as Cloudflare secrets (`npx wrangler secret list` confirms all 3)
- [x] Webhook endpoint created in Stripe dashboard pointing to `mildmate-new.pages.dev/api/webhook/stripe`
- [x] Resend domain verified in dashboard (https://resend.com/domains) + `RESEND_API_KEY` secret set
- [x] Site deployed to `mildmate-new.pages.dev` with `npx wrangler pages deploy public`
- [x] Test purchase completed with test card `4242 4242 4242 4242`
- [x] "Order Confirmed" page appears after payment
- [x] Customer confirmation email received in inbox
- [x] Team "New Order" notification email received
- [x] Test order visible in D1 database with correct dimensions
- [x] Checkout has 3 clear steps (Cart Review → Shipping Details → Payment)
- [x] Country dropdown on `/checkout/` pulls from D1 `countries_master` via `/api/countries`
- [x] Phone code auto-fills when country is changed on `/checkout/`
- [x] Shipping cost updates dynamically when country or quantity changes
- [x] Tariff/tax note shown correctly per country group (EU/UK/OTHER → note shown; TH/US/CA/AU → hidden)
- [x] Order thumbnail visible in `/account` → Orders for legacy/mismatched slug orders
- [x] Custom quote magic link page (`/quote/QT-XXXXX/`) shows locked price and "Add to Cart" button
- [x] Custom quote item in cart shows correct dimensions, fabric, and locked price (uneditable)
- [x] Custom quote order stores `quote_id` reference in D1 `orders` table
- [x] PromptPay option visible on Stripe payment page

---

## Troubleshooting Common Problems

| Problem | Solution |
|---|---|
| Cart is empty or configurator not working | Phase 4 is not complete. Go back and finish Phase 4 before starting Phase 5. |
| Cannot find Stripe API keys | Go to [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API keys. Make sure you are in **Test mode** before copying keys. |
| PromptPay option not in Stripe settings | Go to Stripe → Settings → Payment methods. If PromptPay is not listed, your Stripe account may need to be set to Thailand. Contact Stripe support. |
| `npx wrangler secret put` command not found | Run `npm install -g wrangler` first, then retry. Or use `npx wrangler secret put` with `npx` prefix. |
| Secret key stored but Worker gives auth error | Run `npx wrangler secret list` to confirm the key name is exactly `STRIPE_SECRET_KEY` (case-sensitive). Tell Droid if the name differs. |
| Webhook secret not yet available | You can only get the webhook secret **after** creating the webhook endpoint in Step 5.4. Complete Step 5.4 first, then come back and store the webhook secret. |
| "Payment failed" on test card | Confirm you are using exactly `4242 4242 4242 4242` with a future expiry. Tell Droid the exact error message shown on screen. |
| Stripe payment page never loads | Tell Droid: "Clicking Pay Now does not redirect to Stripe." The checkout Worker may not be deployed. |
| No confirmation email received | Check spam folder first. If not there, tell Droid: "No confirmation email received after test purchase — Resend DNS record was added [X] minutes ago." |
| No team notification email | Tell Droid: "No New Order notification email received at [your notification email]." |
| Order not in D1 after payment | Tell Droid: "Order not in D1 after successful test payment." The webhook may not be reaching your Worker. |
| Webhook shows "Failed" in Stripe dashboard | Go to Stripe → Developers → Webhooks → click your endpoint → copy the error message → tell Droid. |
| PromptPay not showing on payment page | Tell Droid: "PromptPay is not appearing on the Stripe payment page even though it is enabled in Stripe settings." |
| Resend DNS not yet active | DNS changes take 5–30 minutes. Wait and retry. If still failing after 1 hour, tell Droid the exact DNS record you added. |
| Favorites not showing in `/account` after adding | Clerk session JWT may not be ready on first load. Tell Droid: "loadFavorites returning 500 — token retry patch may need redeploy." |
| Order thumbnail missing on `/account` → Orders | Slug mismatch between `orders.product_slug` and `products.slug`. Workers API uses dual-match resolution (slug normalization + title fallback). Redeploy after confirming the fix is live. |
| Checkout country dropdown not opening | CSS z-index overlay issue — fixed in `public/checkout/index.html` via `.float-group:focus-within {z-index:40}` and `select {z-index:2}`. Redeploy after confirming the fix is live. |

---

## Security Notes

| Rule | Why |
|---|---|
| Never paste your Stripe Secret Key in chat | Anyone who has it can charge cards on your behalf |
| Never commit keys to GitHub | Use `wrangler secret put` only — Droid follows this rule |
| Stay in Test mode until launch day | Test mode payments use fake money only |
| Switch to Live mode keys only on Phase 8 launch day | Droid will remind you to swap keys during the DNS cutover |

---

## What Happens Next

Once Phase 5 is complete, move to **Phase 7 — Admin Dashboard** (✅ CODE COMPLETE) then **Phase 6 — Abandoned Cart Recovery** (✅ BUILT — `functions/cron.ts` multi-stage 3-email flow + thank-you discount emails), then Phase 8 (Launch).

Phase 6 built the automatic system that catches customers who started checkout but did not finish. Phase 7 built the admin dashboard at `/admin/`. Both are code-complete. The remaining setup step is configuring the Cloudflare Cron Trigger (`wrangler.toml [triggers]` cron schedule) for Phase 6.

**Tell Droid:** "Phase 5 is complete. Both Phase 6 and Phase 7 are code-complete. Please add `crons = [\"0 * * * *\"]` to `[triggers]` in `wrangler.toml`, then verify the Cloudflare Cron Trigger is registered in the dashboard."
