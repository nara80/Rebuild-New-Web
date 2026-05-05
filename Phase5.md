# Phase 5 — Checkout + Stripe Payments
**Goal:** Connect the shopping cart to Stripe so customers can actually complete a purchase. Thai visitors pay via PromptPay QR code. International visitors pay by card, Apple Pay, or Google Pay. Every successful payment automatically saves the order to your database and sends confirmation emails.

**End Result:** A complete 3-step guest checkout. You can do a real test purchase and see the order appear in your database, receive a "New Order" notification email, and the customer receives an order confirmation — all automatically.

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

MailChannels sends emails on behalf of your domain. The "From" field in all customer emails will use this name and address.

**Decide and write down:**
- Sender name: `[e.g. MildMate Bedding]`
- Sender address: `[e.g. orders@mildmate.com or hello@mildmate.com]`

**The full "From" field will look like:** `MildMate Bedding <orders@mildmate.com>`

> The sending domain must have a DNS TXT record added (explained in Step 5.9). If your domain is on Cloudflare, this takes under 2 minutes. If it is on another registrar, allow 5–30 minutes for the change to activate.

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
Worker sends email to customer (MailChannels)  ← order confirmation receipt
Worker sends email to you (MailChannels)       ← "New Order" notification
       ↓
Customer redirected back to your site
Shows: "Order Confirmed" page
```

> **Important:** You never touch credit card numbers. Stripe handles all payment security on their own servers. This is called "Stripe Checkout" — the safest and simplest integration available.

---

## What Phase 5 Builds

| File | What It Is |
|---|---|
| `public/checkout/index.html` | 3-step checkout page (Cart Review → Guest Details → Payment) |
| `public/order-confirmed/index.html` | Success page shown after payment |
| `workers/api/checkout.ts` | Creates a Stripe payment session |
| `workers/api/webhook.ts` | Receives Stripe payment confirmation → saves order → sends emails |
| `workers/api/email.ts` | MailChannels email helper (customer receipt + team notification) |
| `workers/api/subscribers.ts` | Saves email signups to D1 subscribers table |

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

MailChannels sends emails on your behalf. You need to decide what the "From" field says in emails customers receive.

**Examples:**
- From: `MildMate Bedding <orders@mildmate.com>`
- From: `MildMate <hello@mildmate.com>`

> **Important:** The sending domain (`mildmate.com`) must have a DNS record added to prove you own it. Droid will tell you exactly which DNS record to add when the time comes — it takes about 2 minutes.

---

### Step 5.8 — Tell Droid to Build Phase 5

Once all 6 requirements are ready and your Stripe keys are stored as Cloudflare secrets (Step 5.5), hand off to Droid.

**Tell Droid:**
> "Phase 4 is complete. Please build Phase 5 — the checkout and Stripe payment integration.
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
>
> Build the 3-step checkout page, Stripe session Worker, webhook Worker, MailChannels email system, and the Order Confirmed page."

**What Droid builds:**
1. `public/checkout/index.html` — 3-step checkout UI
2. `workers/api/checkout.ts` — Stripe session creator
3. `workers/api/webhook.ts` — payment confirmation handler
4. `workers/api/email.ts` — MailChannels email sender
5. `public/order-confirmed/index.html` — success page
6. Email templates for customer receipt and team notification

---

### Step 5.9 — Add the MailChannels DNS Record

Before emails can be sent, you need to add one DNS record to prove your domain owns the sending address.

**Droid will give you a record that looks like this:**

```
Type:  TXT
Name:  _mailchannels
Value: v=mc1 cfid=mildmate-web.pages.dev
```

**How to add it:**
1. Go to your domain registrar (where you bought `mildmate.com`)
   - Common registrars: GoDaddy, Namecheap, Google Domains, Cloudflare
2. Find **DNS Management** or **DNS Records**
3. Add a new TXT record with the values Droid gives you
4. Save — DNS changes take 5–30 minutes to activate

> **If your domain is already on Cloudflare:** Go to Cloudflare dashboard → your domain → **DNS** → **Add record** → fill in the values.

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
- [ ] Phase 4 confirmed complete (configurator works, cart functional)
- [ ] Stripe account exists (created or already had one)
- [ ] PromptPay enabled in Stripe with your Thai National ID or Tax ID
- [ ] All 3 Stripe keys collected (Publishable, Secret, Webhook Secret)
- [ ] Order notification email address decided and written down
- [ ] Email sender name and address decided and written down

**Build Steps:**
- [ ] All 3 Stripe keys stored as Cloudflare secrets (`npx wrangler secret list` confirms all 3)
- [ ] Webhook endpoint created in Stripe dashboard pointing to `mildmate-new.pages.dev/api/webhook/stripe`
- [ ] MailChannels DNS TXT record added to your domain
- [ ] Site deployed to `mildmate-new.pages.dev` with `npx wrangler pages deploy public`
- [ ] Test purchase completed with test card `4242 4242 4242 4242`
- [ ] "Order Confirmed" page appears after payment
- [ ] Customer confirmation email received in inbox
- [ ] Team "New Order" notification email received
- [ ] Test order visible in D1 database with correct dimensions
- [ ] Checkout has 3 clear steps (Cart Review → Guest Details → Payment)
- [ ] Email field in Step 2 is required before proceeding
- [ ] PromptPay option visible on Stripe payment page

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
| No confirmation email received | Check spam folder first. If not there, tell Droid: "No confirmation email received after test purchase — MailChannels DNS record was added [X] minutes ago." |
| No team notification email | Tell Droid: "No New Order notification email received at [your notification email]." |
| Order not in D1 after payment | Tell Droid: "Order not in D1 after successful test payment." The webhook may not be reaching your Worker. |
| Webhook shows "Failed" in Stripe dashboard | Go to Stripe → Developers → Webhooks → click your endpoint → copy the error message → tell Droid. |
| PromptPay not showing on payment page | Tell Droid: "PromptPay is not appearing on the Stripe payment page even though it is enabled in Stripe settings." |
| MailChannels DNS not yet active | DNS changes take 5–30 minutes. Wait and retry. If still failing after 1 hour, tell Droid the exact DNS record you added. |

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

Once Phase 5 is complete, move to **Phase 6 — Abandoned Cart Recovery**.

Phase 6 builds the automatic system that catches customers who started checkout but did not finish — and sends them a single recovery email 24 hours later. Based on your Etsy data, this could recover up to $1,005 in lost revenue.

**Tell Droid:** "Phase 5 is complete. All checklist items are done. Please start Phase 6."
