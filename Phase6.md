# Phase 6 — Abandoned Cart Recovery
**Status (2026-05-21): ⏸️ PENDING**
**Goal:** Automatically catch customers who started checkout but did not finish.

**End Result:** A fully automated background system that runs every hour without you doing anything. When a customer enters their email at checkout but does not complete payment, they receive one recovery email the next day. Based on your Etsy data (8 abandoned carts = $1,005 in lost revenue), this system pays for itself immediately.

**Time Estimate:** 20–30 minutes (you write the email text; Droid builds everything)

---

## Initial Requirements — What You Must Provide

Phase 6 has the fewest decisions of any phase — most of the build is Droid writing code. There are only 4 things you need to confirm and write before starting.

---

### Requirement 1 — Confirm Phase 5 Is Complete

Phase 6 builds on top of the checkout and Resend email system from Phase 5. If Phase 5 is not complete, the recovery email cannot be sent.

**Confirm before starting:**
- [ ] A full test purchase in Phase 5 succeeded (order appeared in D1 and emails were received)
- [ ] Resend domain verified + `RESEND_API_KEY` secret set — customer confirmation email was successfully received
- [ ] `workers/api/email.ts` exists (built in Phase 5)

**If any item is missing:** Go back and complete Phase 5 before continuing.

---

### Requirement 2 — Your Recovery Email Subject Line

The subject line is the first thing the customer sees. Pick one from the list below or write your own.

**Options (pick one or write your own):**

| Option | Subject Line |
|---|---|
| A | "You left something behind 🛏️" |
| B | "Your custom bedding is waiting" |
| C | "We saved your custom dimensions" |
| D | "Complete your MildMate order" |
| E | Write your own |

**Write down your chosen subject line.** You will give it to Droid in Step 6.4.

---

### Requirement 3 — Your Recovery Email Body Text

Write the text that appears in the recovery email. Keep it friendly and helpful — not pushy or automated-sounding.

**Fill in this template:**

```
Opening line (pick one or write your own):
[ ] "It looks like you were in the middle of ordering custom bedding.
    We saved your measurements so you don't have to start over."
[ ] "Your custom [Product Name] is still waiting for you.
    We kept your dimensions saved."
[ ] "Still thinking it over? Your cart is saved and ready whenever you are."
[ ] Your own: _______________________________________________

Button text (pick one):
[ ] "Complete My Order"
[ ] "Finish Your Purchase"
[ ] "Return to My Cart"
[ ] Your own: _______________

Closing line (pick one or write your own):
[ ] "Your order will be made exactly to your specifications —
    just click below to finish."
[ ] "If you have any questions about sizing or fabric,
    just reply to this email — we are happy to help."
[ ] Your own: _______________________________________________

Sign-off name:
[ ] "BT & the MildMate Bedding Team"
[ ] Your own: _______________
```

> The product name, dimensions, fabric, and price are inserted automatically by Droid — you do not need to write those parts.

---

### Requirement 4 — Your Discount Decision

You can optionally include a discount code in the recovery email to encourage the customer to complete their order.

**Options:**

| Option | What It Means | Recommendation |
|---|---|---|
| No discount | Email only — no code | Good starting point. Add one later if recovery rate is low. |
| 5% off | ~$10 off a $195 order | Gentle nudge. Easy to justify. |
| 10% off | ~$20 off a $195 order | Stronger incentive but cuts into margin. |
| Free shipping | Waive shipping cost | Good if you normally charge shipping. |

**If you choose a discount:** Write down the discount code you want to use (e.g., `COMEBACK5`). You will create this code in your Stripe dashboard → **Coupon codes** before Phase 6 goes live.

**Write down:** "No discount" OR "X% off with code: [YOURCODE]"

---

## How the Abandoned Cart System Works (Plain English)

```
Customer opens checkout page
           ↓
Enters their email address in Step 2 (Guest Details)
           ↓
Worker IMMEDIATELY saves to D1:
  - Email address
  - Cart contents (products, dimensions, fabric, price)
  - Timestamp
  - recovered = 0  (not yet sent)
           ↓
Customer closes browser / leaves without paying
           ↓
Cloudflare Cron Trigger runs every hour (automatically)
           ↓
Checks D1: "Any carts older than 24 hours with recovered = 0?"
           ↓
     YES → Sends recovery email via Resend
            Updates recovered = 1 (never sends again)
      NO → Does nothing, waits for next hour
           ↓
Customer receives email with:
  - Their saved product + dimensions
  - Direct "Complete Your Order" button
  - Optional: discount code
```

> **Key detail:** The email is sent exactly once per abandoned cart. If the customer ignores it, no more emails are sent. This respects privacy and avoids being spammy.

---

## What Phase 6 Builds

| File | What It Is |
|---|---|
| `workers/api/cart.ts` | Updated: captures email + cart to D1 the moment email is entered |
| `workers/cron.ts` | Cron Trigger: runs every hour, finds and sends recovery emails |
| `wrangler.toml` | Updated: adds Cron Trigger schedule |
| Recovery email template | HTML email with cart summary + "Complete Your Order" button |

---

## Step-by-Step Instructions

### Step 6.1 — Complete All 4 Initial Requirements

Go through Requirements 1–4 above and write down your decisions. Use this summary to fill in before Step 6.4:

```
PHASE 6 REQUIREMENTS SUMMARY

Requirement 1 — Phase 5 complete: Yes / No
Requirement 2 — Subject line: [your chosen subject line]
Requirement 3 — Email body:
  Opening line: [your choice]
  Button text: [your choice]
  Closing line: [your choice]
  Sign-off name: [your name / team name]
Requirement 4 — Discount: No discount / [X]% off with code: [CODE]
```

**Example of a completed recovery email (for reference):**

```
Subject: We saved your custom bedding order 🛏️

Hi [Name],

It looks like you were in the middle of ordering custom bedding.
We saved your measurements so you don't have to start over.

Here is what you left in your cart:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Product Name]
Dimensions: [Width] × [Length] × [Depth] cm
Fabric: [Fabric Name]
Price: [Price in THB or USD]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your order will be made exactly to your specifications —
just click below to finish.

[Complete My Order →]

If you have any questions about sizing or fabric,
just reply to this email — we are happy to help.

Warm regards,
BT & the MildMate Bedding Team
mildmate.com
```

---

### Step 6.2 — Understand the Cron Trigger

A **Cron Trigger** is a timer that runs your Worker automatically on a schedule — like setting an alarm that goes off every hour, forever, without you having to do anything.

**How it is configured in `wrangler.toml`:**
```toml
[triggers]
crons = ["0 * * * *"]
```

This means: "Run at minute 0 of every hour" — so at 1:00, 2:00, 3:00 etc.

**What happens when it runs:**
1. Connects to your D1 database
2. Runs this search: "Find all rows in `abandoned_carts` where `created_at` was more than 24 hours ago AND `recovered` = 0"
3. For each row found: sends recovery email → marks `recovered = 1`
4. If no rows found: does nothing

> **This costs you nothing extra.** Cloudflare's free plan includes up to 3 Cron Triggers. Your Worker only runs for a fraction of a second each hour.

---

### Step 6.3 — Understand the Email Capture Timing

**Important:** The email is captured at **Step 2 of checkout** (Guest Details) — the moment the customer types their email address and moves to the next field.

This means:
- Customer enters email → IMMEDIATELY saved to `abandoned_carts` table
- Customer completes payment → the webhook from Phase 5 marks the cart as `recovered = 1` (so no recovery email is sent to paying customers)
- Customer leaves → after 24 hours, recovery email is sent

**Why capture at email entry, not at checkout start?**
Because the email address is what we need to send the recovery email. Without it, we have no way to contact them.

---

### Step 6.4 — Tell Droid to Build Phase 6

Once all 4 requirements are ready, hand off to Droid.

**Tell Droid:**
> "Phase 5 is complete. Please build Phase 6 — the abandoned cart recovery system.
>
> **Requirement 1:** Phase 5 confirmed complete — test purchase succeeded, Resend emails working.
> **Requirement 2 — Subject line:** [your chosen subject line]
> **Requirement 3 — Email body:**
> - Opening: [your opening line]
> - Button text: [your button text]
> - Closing: [your closing line]
> - Sign-off: [your name / team name]
> **Requirement 4 — Discount:** [No discount / X% off with code: YOURCODE]
>
> Build the cart capture on email entry in checkout Step 2, the Cron Trigger Worker that runs every hour, the recovery email template, and update wrangler.toml with the cron schedule."

**What Droid builds:**
1. Updates `public/checkout/index.html` — adds JavaScript that saves to D1 the moment email is entered
2. Updates `workers/api/cart.ts` — saves email + cart JSON + timestamp to `abandoned_carts` table
3. Creates `workers/cron.ts` — hourly cron that finds and sends recovery emails
4. Updates `wrangler.toml` — adds `[triggers]` cron schedule
5. Designs the HTML recovery email template with your text + cart summary block

---

### Step 6.5 — Deploy the Updated Workers

The Cron Trigger only works when deployed to Cloudflare — it cannot run on your local computer.

**How to deploy:**
1. In cmd:
   ```
   cd D:\00_MildMate\Re-Bulit_Web
   npx wrangler pages deploy public
   ```
2. Wait for confirmation:
   ```
   ✅ Deployment complete
   ```
3. Check the Cron Trigger is registered:
   ```
   npx wrangler triggers list
   ```
   You should see:
   ```
   Cron: 0 * * * *
   ```

---

### Step 6.6 — Test the Email Capture

Verify that entering an email in checkout saves it to D1 immediately.

**How to test:**
1. Go to `https://mildmate-new.pages.dev`
2. Add a product to cart → go to checkout
3. In Step 2 (Guest Details), type a test email address (use your own email for testing)
4. Click into the next field (Name or Phone) — this triggers the save
5. **Do NOT complete the payment** — just close the browser tab

**Verify it was saved in D1:**
```
npx wrangler d1 execute mildmate-db --command="SELECT * FROM abandoned_carts ORDER BY created_at DESC LIMIT 3;"
```

You should see your test email in the results:
```
┌────┬──────────────────────┬───────────┬───────────────────────┬───────────────┐
│ id │ email                │ recovered │ created_at            │ cart_json     │
├────┼──────────────────────┼───────────┼───────────────────────┼───────────────┤
│  1 │ your@email.com       │ 0         │ 2026-05-03 10:00:00   │ {...}         │
└────┴──────────────────────┴───────────┴───────────────────────┴───────────────┘
```

The `recovered = 0` confirms this cart has not been sent a recovery email yet.

---

### Step 6.7 — Test the Recovery Email (Force Send)

You do not want to wait 24 hours to test. Droid will add a test command that forces the cron to run immediately.

**Tell Droid:**
> "Please add a test endpoint at `/api/cron/test` that triggers the abandoned cart cron immediately (only works in test/development mode, disabled in production)."

**How to use it:**
1. Make sure there is a test row in `abandoned_carts` with `recovered = 0` (from Step 6.6)
2. In your browser, go to:
   ```
   https://mildmate-new.pages.dev/api/cron/test
   ```
3. Check your email inbox — the recovery email should arrive within 1–2 minutes
4. Check D1 — the row should now show `recovered = 1`:
   ```
   npx wrangler d1 execute mildmate-db --command="SELECT id, email, recovered FROM abandoned_carts;"
   ```

---

### Step 6.8 — Review the Recovery Email

Check that the email you received looks correct.

**What to verify in the email:**

| Check | Expected |
|---|---|
| Subject line | Matches what you wrote |
| Greeting | "Hi [your test name]" or "Hi there" if name was not entered |
| Product name | Correct product from your test cart |
| Dimensions | Correct width, length, depth from your test |
| Fabric | Correct fabric selection from your test |
| Price | Correct price in correct currency (THB or USD) |
| "Complete My Order" button | Visible, blue, correctly styled |
| Button link | Clicking it goes to your checkout page |
| Your sign-off | Your name and team name shown |
| No broken images | All images (if any) load correctly |
| Looks good on mobile | Check on your phone — most emails are opened on mobile |

**If anything looks wrong:** Tell Droid exactly what needs to change (e.g., "The price is showing in USD but the customer was Thai — it should show THB").

---

### Step 6.9 — Verify Paying Customers Do NOT Get Recovery Emails

This is a critical check. A customer who paid must never receive an abandoned cart email.

**How to test:**
1. Do a full test purchase (same as Phase 5 Step 5.11 — use Stripe test card)
2. After the purchase completes, check D1:
   ```
   npx wrangler d1 execute mildmate-db --command="SELECT email, recovered FROM abandoned_carts ORDER BY created_at DESC LIMIT 3;"
   ```
3. The row for the email you used during purchase should show `recovered = 1`
4. Trigger the test cron again (`/api/cron/test`) — confirm NO recovery email arrives for that purchase

> **If a paying customer receives a recovery email:** Tell Droid immediately — the webhook from Phase 5 is not correctly updating `recovered = 1` after successful payment.

---

### Step 6.10 — Check Cron is Running in Production

After deployment, confirm Cloudflare has registered and is running your Cron Trigger.

**How to check in Cloudflare dashboard:**
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **Workers & Pages** → click your project → **Settings** → **Triggers**
3. You should see your cron schedule listed: `0 * * * *`
4. Click **View logs** — after an hour has passed, you will see the cron execution logs here

---

## How You Know Phase 6 Is Complete

Go through this checklist before moving to Phase 7:

**Initial Requirements:**
- [ ] Phase 5 confirmed complete (test purchase worked, Resend emails received)
- [ ] Recovery email subject line chosen and written down
- [ ] Recovery email body text written (opening, button, closing, sign-off)
- [ ] Discount decision made (no discount / code + percentage)

**Build Steps:**
- [ ] `workers/cron.ts` file exists
- [ ] `wrangler.toml` updated with `[triggers]` cron schedule (`0 * * * *`)
- [ ] Deployed to `mildmate-new.pages.dev`
- [ ] Cron Trigger appears in Cloudflare dashboard under Triggers
- [ ] Test email capture: entering email in checkout → row appears in `abandoned_carts` table with `recovered = 0`
- [ ] Test recovery email received in inbox after triggering `/api/cron/test`
- [ ] Recovery email content is correct (product, dimensions, fabric, price, button)
- [ ] Recovery email looks good on mobile phone
- [ ] "Complete My Order" button links to checkout correctly
- [ ] Test purchase marks cart as `recovered = 1` — no recovery email sent to paying customers
- [ ] Running `/api/cron/test` again after `recovered = 1` does NOT send another email

---

## Troubleshooting Common Problems

| Problem | Solution |
|---|---|
| Phase 5 Resend email was never tested | Go back and complete Phase 5 Step 5.11 (test purchase + confirm emails received) before starting Phase 6. |
| Not sure what to write for the email body | Use the example email in Step 6.1 exactly as written — it is already proven to work. Change the sign-off name only. |
| Want to use a discount but no Stripe coupon code exists | Go to Stripe dashboard → **Products** → **Coupons** → **Create coupon** → set percentage off → name your code (e.g., `COMEBACK5`). Then give the code to Droid. |
| Email not saved to D1 after entering in checkout | Tell Droid: "The cart is not being saved to D1 when I enter email in checkout Step 2." |
| `abandoned_carts` table is empty after test | Confirm you are checking the right database: `npx wrangler d1 execute mildmate-db --command="SELECT COUNT(*) FROM abandoned_carts;"` |
| Recovery email not arriving after `/api/cron/test` | Check spam folder first. Then tell Droid: "The cron test endpoint ran but no email arrived." |
| Recovery email arrived for a paying customer | Tell Droid immediately: "A paying customer received a recovery email — the recovered flag is not being set to 1 after successful payment." |
| Cron not showing in Cloudflare dashboard | Tell Droid: "The Cron Trigger is not appearing in Cloudflare dashboard after deployment." |
| Button link in email goes to wrong page | Tell Droid: "The Complete My Order button links to [wrong URL] — it should go to [correct URL]." |
| Email shows wrong currency | Tell Droid: "Recovery email shows USD for a Thai customer — price should show THB." |
| Cart JSON is empty in D1 | Tell Droid: "The cart_json column in abandoned_carts is empty — cart contents are not being saved." |

---

## Business Impact Reminder

Based on your Etsy performance data:
- **8 abandoned carts** in Jan–Apr 2026
- **$1,005 in potential recovery revenue**
- Industry average cart recovery rate: **5–15%**

At a 10% recovery rate on your $195 AOV:
- 1 recovered order per month = **$195/month**
- Over 12 months = **$2,340/year in recovered revenue**

This system runs automatically forever — you set it up once in Phase 6 and it works in the background every hour without any action from you.

---

## What Happens Next

Once Phase 6 is complete, move to **Phase 7 — Admin Dashboard**.

Phase 7 builds the private management interface for your team — the orders table showing custom dimensions for manufacturing, the product editor, the image uploader, and the subscriber CSV export. It is protected by Google login via Cloudflare Access so only your team can access it.

**Tell Droid:** "Phase 6 is complete. All checklist items are done. Please start Phase 7."
