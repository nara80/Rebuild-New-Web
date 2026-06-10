# Phase 8 — Polish + Launch
**Status (2026-06-10): ⏸️ PENDING — Phase 7 Admin Complete, Phase 8 Part A Not Yet Started. D1-backed reviews, product_type+niches columns, homepage niche card update, and orphaned file cleanup completed in subsequent sessions.**
**Goal:** Make everything production-ready — fix all mobile issues, hit 90+/100 performance, DNS cutover.

**End Result:** `www.mildmate.com` is live on the new site. The old WordPress site is retired. Google Search Console shows no errors. Real customers can browse, configure, and purchase custom bedding.

**Time Estimate:** 60–90 minutes spread over 2 days (Day 1: testing and fixes; Day 2: launch)

---

## Phase 8 Has Two Parts

| Part | Name | What Happens |
|---|---|---|
| **Part A** | Polish & Testing | Fix mobile issues, performance audit, security, real content, Stripe live mode |
| **Part B** | Launch Day | DNS cutover, verify live site, retire WordPress, post-launch monitoring |

> **Important:** Do NOT rush Part B. Complete every Part A checklist item first. A failed launch is harder to fix than taking an extra day to prepare.

---

## What Phase 8 Builds / Fixes

| Item | What It Is | Status |
|---|---|---|
| `public/_headers` | Security headers: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy | ✅ Built |
| `public/robots.txt` | Tells Google which pages to index — blocks `/admin/*`, `/api/*`, `/checkout/*`, `/account/*`, `/unsubscribe/` | ✅ Built |
| `sitemap.xml` | List of all URLs — submitted to Google Search Console | ⏸ Pending |
| Open Graph meta tags | Facebook/LINE share preview image + title on all pages | ⏸ Pending |
| GTM / Analytics | Google Tag Manager (`GTM-KLJZZM9`) + GA4 tracking on all pages | ⏸ Pending |
| Mobile CSS fixes | Any layout issues found during QA review | ⏸ Pending |
| Lighthouse performance fixes | Image compression, CSS/JS optimization | ⏸ Pending |
| Stripe live mode keys | Real payment credentials stored as Cloudflare secrets | ⏸ Pending |
| DNS records | Points `www.mildmate.com` to Cloudflare Pages | ⏸ Pending |
| Google Search Console verification | Confirms Google can crawl the new site | ⏸ Pending |

---

## Initial Requirements — What You Must Provide

Collect all of the following before telling Droid to start Part A.

---

### Requirement 1 — Your Domain Registrar

Where did you buy the domain `mildmate.com`? This determines where you go to change DNS settings on launch day.

**Common registrars:**

| Registrar | Where to find DNS settings |
|---|---|
| GoDaddy | My Products → DNS → Manage DNS |
| Namecheap | Domain List → Manage → Advanced DNS |
| Google Domains / Squarespace | DNS → Custom Records |
| Cloudflare | Already on Cloudflare → DNS tab in your domain |
| Thai registrar (e.g., Hostinglotus, Zillions) | cPanel → Zone Editor |

**Write down:** Which registrar you use and your login credentials (keep these private — do not share with Droid).

---

### Requirement 2 — Your Google Search Console Access

Google Search Console is the free Google tool that monitors your search rankings and crawl health. You must have access before launch day so you can submit the new sitemap immediately.

**Check if you have access:**
1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Sign in with your Google account
3. Look for `www.mildmate.com` in the property list

**If `mildmate.com` is not listed:**
1. Click **Add property**
2. Select **URL prefix** → enter `https://www.mildmate.com`
3. Choose **HTML tag** verification → copy the verification code (looks like: `<meta name="google-site-verification" content="XXXX...">`)
4. Give the verification code to Droid — it will be added to your homepage `<head>` tag
5. After DNS cutover, come back here and click **Verify**

---

### Requirement 3 — Your Open Graph (Social Share) Image

When someone shares your website link on LINE, Facebook, or other platforms, a preview image appears. This is called an Open Graph image.

**What you need:**
- One image sized **1200 × 630 pixels** (landscape orientation)
- Should show your brand — e.g., your logo on a blue background, or a lifestyle product photo
- Save it as: `og-image.jpg`
- Place it in: `D:\00_MildMate\Re-Build_Web\public\images\og-image.jpg` (not yet created)

**What it looks like when shared:**
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│          [Your og-image.jpg here]                   │
│                                                     │
├─────────────────────────────────────────────────────┤
│ mildmate.com                                        │
│ Bedding Made Easy Again: Custom Sizes, Perfect Fits │
│ Discover custom bedding solutions...                │
└─────────────────────────────────────────────────────┘
```

> **Don't have one yet?** Tell Droid "Use the CI blue background with MildMate logo as the OG image." Droid will generate a simple one automatically.

---

### Requirement 4 — Pages to Exclude from Google Index

Some pages should NOT appear in Google search results. By default, Droid will block these in `robots.txt`:

| Page | Why Exclude |
|---|---|
| `/admin/*` | Private — should never appear in Google |
| `/checkout/*` | No SEO value — Google should not index checkout |
| `/order-confirmed/` | No SEO value |
| `/api/*` | Backend endpoints — not pages |
| `/th/checkout/` | WordPress-era checkout — no longer used |

**Do you want to add any other pages to exclude?** Write your list.

---

### Requirement 5 — Stripe Live Mode Keys

On launch day, you switch from Stripe test mode to live mode. This means real payments with real money.

**Before launch day, collect your live mode keys:**
1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. In the top-right, toggle from **Test mode** to **Live mode**
3. Click **Developers** → **API keys**
4. Copy your **Live Publishable key** (`pk_live_...`) and **Live Secret key** (`sk_live_...`)
5. Store them somewhere safe on your computer (not in chat or email)

> **Important:** Do NOT store these yet in Step 8. You will enter them as Cloudflare secrets only on launch day (Part B Step 8.17). Storing live keys too early risks accidental real charges during testing.

**Also create a live mode webhook:**
1. In Stripe live mode → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. URL: `https://www.mildmate.com/api/webhook/stripe`
4. Select event: `checkout.session.completed`
5. Copy the live webhook signing secret (`whsec_live_...`)

---

### Requirement 6 — Your Google Tag Manager / Analytics ID

Your existing WordPress site already has Google Tag Manager (GTM-KLJZZM9 from the site source). You should keep this tracking on the new site.

**What to provide:**
- Your Google Tag Manager ID (looks like: `GTM-XXXXXXX`)
- Your Google Analytics ID if separate (looks like: `G-XXXXXXXXXX` or `UA-XXXXXXXX-X`)

> **Where to find it:** Log in to [tagmanager.google.com](https://tagmanager.google.com) → your account → your container — the ID is in the top right (e.g., `GTM-KLJZZM9`).

---

### Requirement 7 — Your Facebook Pixel ID (Optional)

If you run Facebook or Instagram ads, your Pixel ID should be on the new site.

**Where to find it:** Facebook Ads Manager → Events Manager → your Pixel → look for the Pixel ID (a long number like `1234567890123456`).

**If you don't use Facebook ads:** Write "none."

---

### Requirement 8 — Launch Date Decision

Choose your launch day. Recommended approach:

| Option | When | Best For |
|---|---|---|
| **Soft launch** | Weekday morning Thai time (7–9am) | Low traffic time — easier to monitor and fix issues |
| **Weekend launch** | Saturday morning | More time to watch for problems |
| **Avoid** | Friday afternoon | Weekend starts, harder to get support if something breaks |

**Write down your planned launch date and time.**

---

## Part A — Polish & Testing

### Step 8.1 — Tell Droid to Start Part A

**Tell Droid:**
> "Phase 7 is complete. Please start Phase 8 Part A — polish and testing.
>
> Here are my requirements:
>
> **Requirement 1 — Registrar:** [your registrar name]
> **Requirement 2 — Search Console:** [verified / not yet verified — verification code: XXXX]
> **Requirement 3 — OG Image:** [og-image.jpg is ready / use auto-generated CI blue]
> **Requirement 4 — Exclude from Google:** [your list or 'use defaults']
> **Requirement 5 — Live Stripe Keys:** [collected and stored safely — will provide on launch day]
> **Requirement 6 — GTM ID:** [GTM-KLJZZM9 or your ID]
> **Requirement 7 — Facebook Pixel:** [your Pixel ID or 'none']
> **Requirement 8 — Launch Date:** [your planned date]
>
> Build: _headers security file, Open Graph tags on all pages, sitemap.xml, robots.txt, GTM/Analytics tags. Then run a full audit and give me a list of everything to review."

---

### Step 8.2 — Full Mobile Review on Your Phone

This is the most important QA step. Open `https://mildmate-new.pages.dev` on your **actual mobile phone** (not browser simulation).

**Walk through every screen and report anything that looks wrong:**

| Screen | What to Check |
|---|---|
| Homepage | Hero text readable? Buttons not cut off? All sections visible? |
| Trust bar | Icons in a 2×2 grid? Not overlapping? |
| Shop by Niche cards | 2-column grid? Images not stretched? |
| Product listing | 2-column grid? Filter bar usable with fingers? |
| Product detail | Configurator inputs easy to tap? Fabric swatches big enough? |
| Checkout Step 1 | Cart items visible? Price correct? |
| Checkout Step 2 | Form fields readable? Keyboard pops up correctly? |
| Admin dashboard | Orders table scrolls horizontally? Edit button tappable? |
| Footer | All columns stacked vertically? LINE widget at bottom? |

**Write down everything that looks wrong.** Give the full list to Droid in one message:
> "Here are my mobile issues: [list each problem]"

---

### Step 8.3 — Run a Lighthouse Performance Test

Lighthouse is Google's free tool that scores your site on Speed, SEO, and Accessibility.

**How to run it:**
1. Open `https://mildmate-new.pages.dev` in Google Chrome on your computer
2. Press `F12` to open Developer Tools
3. Click the **Lighthouse** tab (may be hidden — click `>>` to find it)
4. Select: **Mobile** (important — Google scores mobile first)
5. Check: **Performance**, **SEO**, **Accessibility**, **Best Practices**
6. Click **Analyze page load**
7. Wait 30–60 seconds for the report

**Target scores:**

| Category | Target | Why |
|---|---|---|
| Performance | 90+ | Fast sites rank higher in Google and convert better |
| SEO | 95+ | Ensures Google can read and index your pages correctly |
| Accessibility | 85+ | Ensures the site works for all users |
| Best Practices | 90+ | Security and modern web standards |

**Share the results with Droid:**
> "Lighthouse scores: Performance [X], SEO [X], Accessibility [X], Best Practices [X]. Screenshot attached."

Droid will fix any items below target. Common fixes:
- Compressing large images (most common performance issue)
- Adding `alt` text to images (accessibility)
- Adding missing meta descriptions (SEO)

---

### Step 8.4 — Run Lighthouse on Your 3 Most Important Pages

The homepage is not the only page that matters. Run Lighthouse on these pages too:

| Page | Why Important |
|---|---|
| `https://mildmate-new.pages.dev/sizeguide/` | #1 traffic page — must score 95+ SEO (formerly `/mattress-size-th/` from WordPress) |
| `https://mildmate-new.pages.dev/product/marine-fitted-sheet/` | Top product page — performance matters for conversion (marine V-Berth is the anchor product) |
| `https://mildmate-new.pages.dev/checkout/` | Checkout — speed directly impacts conversion rate |

Give all 4 Lighthouse reports to Droid at once — it will fix everything in one pass.

---

### Step 8.5 — Check All Security Headers

Droid adds security headers to `public/_headers`. These protect your site from common web attacks.

**How to verify they are working:**
1. Go to [securityheaders.com](https://securityheaders.com)
2. Enter `https://mildmate-new.pages.dev`
3. Click **Scan**
4. You should see a grade of **A** or **A+**

**If the grade is lower:** Tell Droid "Security headers scan at securityheaders.com shows grade [X]. Missing headers: [list what is missing]."

---

### Step 8.6 — Verify Open Graph Share Previews

Test what your site looks like when shared on LINE and Facebook.

**For LINE:**
1. Go to [ogp.me](https://ogp.me) or [opengraph.xyz](https://opengraph.xyz)
2. Enter `https://mildmate-new.pages.dev`
3. Confirm: your OG image appears, title is correct, description is correct

**For Facebook:**
1. Go to [developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug)
2. Enter `https://mildmate-new.pages.dev`
3. Click **Debug** → **Scrape Again**
4. Confirm the preview looks correct

**If the image is wrong or missing:** Tell Droid: "The OG image is not showing correctly on [LINE/Facebook]. The current OG image URL is showing as: [URL from the tool]."

---

### Step 8.7 — Do a Final Full Purchase Test

Before going live, do one complete end-to-end test purchase using the Stripe test card.

**Walk through the entire flow:**
1. Land on homepage → read all sections
2. Click a product in the "Top Products" section
3. Enter custom dimensions → select fabric → click "Add to Cart"
4. Check cart icon count updated
5. Click cart → click Checkout
6. Fill in all guest details (use your own email)
7. Complete payment with test card `4242 4242 4242 4242`
8. Confirm "Order Confirmed" page appears
9. Confirm customer email received
10. Confirm team notification email received
11. Confirm order in Admin dashboard with correct dimensions
12. Change order status from "pending" to "in-production" in admin
13. Confirm status saved

**If any step fails:** Fix it before moving to Part B.

---

### Step 8.8 — Enter All Real Product Data

Before launch, use the Admin dashboard to enter your real products.

**Minimum required before launch:**
- [ ] All 83 products have correct titles (TH and EN)
- [ ] All 83 products have correct prices (USD and THB)
- [ ] All 83 products have fabric options set
- [ ] Top 10 products have real photos uploaded (not placeholders)
- [ ] All products are marked Active

> **You do not need all 83 photos on day one.** Top 10 is enough for launch. Add the rest in the first week after launch.

---

### Step 8.9 — Part A Completion Check

Before moving to Part B (Launch Day), confirm all of these:

- [ ] Mobile review done — all issues fixed
- [ ] Lighthouse scores: Performance 90+, SEO 95+
- [ ] Security headers grade A or A+
- [ ] Open Graph preview correct on LINE and Facebook
- [ ] GTM/Analytics tracking tag added to all pages
- [ ] `public/sitemap.xml` exists and lists all important URLs
- [ ] `public/robots.txt` exists and excludes `/admin/*`, `/checkout/*`, `/api/*`
- [ ] Final full test purchase passed all 13 steps
- [ ] Real product data entered for top 10 products minimum
- [ ] Stripe live mode keys collected and stored safely (not yet in Cloudflare)

---

## Part B — Launch Day

> **Before starting Part B:** Confirm with your team that everyone is available for the next 2 hours. Launches occasionally have small surprises — it is better to fix them immediately than the next morning.

---

### Step 8.10 — Switch Stripe to Live Mode

Replace test keys with live keys in Cloudflare secrets.

**In cmd:**
```
cd D:\00_MildMate\Re-Build_Web
npx wrangler secret put STRIPE_SECRET_KEY
```
When prompted: paste your **live** secret key (`sk_live_...`) — NOT the test key

```
npx wrangler secret put STRIPE_PUBLISHABLE_KEY
```
When prompted: paste your **live** publishable key (`pk_live_...`)

```
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```
When prompted: paste your **live** webhook secret (`whsec_live_...`)

**Verify:**
```
npx wrangler secret list
```
Confirm all 3 secrets are listed.

---

### Step 8.11 — Final Deploy to pages.dev

Deploy everything one last time before DNS cutover:

```
cd D:\00_MildMate\Re-Build_Web
npx wrangler pages deploy public
```

Wait for: `✅ Deployment complete`

**Do one final test purchase on `mildmate-new.pages.dev` with a REAL card** (a small amount — $1 or the minimum). Confirm:
- Payment goes through
- Order confirmation email received
- Order appears in Admin

Then **refund yourself** immediately in Stripe dashboard → Payments → find the charge → Refund.

> This confirms live mode is working before you point your real domain at it.

---

### Step 8.12 — Add Your Domain to Cloudflare Pages

Tell Cloudflare that `www.mildmate.com` should serve your Pages project.

**In Cloudflare dashboard:**
1. Go to **Workers & Pages** → your project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter: `www.mildmate.com`
4. Click **Continue**
5. Cloudflare will show you the DNS records needed — **copy them down**

They will look like:
```
Type:  CNAME
Name:  www
Value: mildmate-new.pages.dev
```

---

### Step 8.13 — Update DNS at Your Registrar

This is the switch that moves your domain to the new site.

**Go to your domain registrar** (the one from Requirement 1) and update the DNS records:

**What to change:**

| Record Type | Name | Old Value (WordPress host) | New Value |
|---|---|---|---|
| CNAME or A | `www` | [your old WordPress IP/CNAME] | `mildmate-new.pages.dev` |

**If your domain is already on Cloudflare:**
- Go to Cloudflare dashboard → your domain → **DNS**
- Find the `www` record → click **Edit**
- Change the value to `mildmate-new.pages.dev`
- Save

> **How long does it take?** DNS changes can take 5 minutes to 48 hours to fully propagate worldwide. Cloudflare-to-Cloudflare changes are usually instant (under 5 minutes). External registrars typically take 15–60 minutes.

---

### Step 8.14 — Monitor DNS Propagation

**How to check if DNS has updated:**
1. Go to [dnschecker.org](https://dnschecker.org)
2. Enter `www.mildmate.com`
3. Select **CNAME** from the dropdown
4. Click **Search**
5. You will see a world map — green checkmarks mean that location has the new DNS
6. When most locations are green — your site is live

**Alternative quick check:**
Open a new incognito browser window and go to `https://www.mildmate.com`
- If you see your **new site** → DNS has updated in your location
- If you see the **old WordPress site** → DNS has not updated yet — wait 15–30 more minutes

---

### Step 8.15 — Verify SSL Certificate

Cloudflare automatically issues a free SSL certificate for your domain. Confirm it is working:

1. Go to `https://www.mildmate.com` (with the `https://`)
2. In your browser address bar, you should see a **padlock icon** 🔒
3. Click the padlock → confirm it says "Connection is secure" and the certificate is issued to `mildmate.com`

**If you see a security warning:** Tell Droid immediately — the SSL certificate may still be provisioning (usually takes 5–15 minutes after DNS update).

---

### Step 8.16 — Update Stripe Webhook URL

Your Stripe webhook was pointing to `mildmate-new.pages.dev`. Update it to your real domain.

**In Stripe dashboard (live mode):**
1. Click **Developers** → **Webhooks**
2. Find your webhook endpoint
3. Click **Edit endpoint**
4. Change the URL from:
   `https://mildmate-new.pages.dev/api/webhook/stripe`
   to:
   `https://www.mildmate.com/api/webhook/stripe`
5. Click **Update endpoint**

---

### Step 8.17 — Submit Sitemap to Google Search Console

Tell Google about your new site immediately so it starts re-indexing.

**How to submit:**
1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Select your `www.mildmate.com` property
3. In the left sidebar, click **Sitemaps**
4. In the "Add a new sitemap" field, enter: `sitemap.xml`
5. Click **Submit**
6. You should see: "Sitemap submitted successfully"

---

### Step 8.18 — Monitor for 24 Hours After Launch

After the DNS switch, watch for problems in the first 24 hours.

**Check every 2–3 hours on launch day:**

| What to Check | Where to Check |
|---|---|
| Site loads at `www.mildmate.com` | Open in browser |
| New orders coming in | Admin dashboard → Orders |
| No errors in Cloudflare | Cloudflare dashboard → Workers & Pages → your project → **Metrics** |
| Stripe payments working | Stripe dashboard → **Payments** |
| Google Search Console | Look for "Coverage" errors after 24 hours |

**Signs everything is working:**
- Homepage loads fast (under 2 seconds)
- Product pages load with images
- Configurator updates price on dimension input
- Checkout completes to Stripe and back
- No errors in Cloudflare metrics

---

### Step 8.19 — Retire the Old WordPress Site

Once you have confirmed the new site is fully working (after 24–48 hours with no problems):

1. Log into your old WordPress hosting control panel
2. **Do NOT delete the WordPress database yet** — keep it for 30 days as a backup
3. You can cancel your WordPress hosting plan after 30 days if everything is stable
4. Keep a backup export of your WordPress database (Export → All Content) stored on your computer

---

### Step 8.20 — Post-Launch Google Search Console Check (48 Hours)

Two days after launch:

1. Go to Google Search Console → **Coverage**
2. Look for any "Error" or "Excluded" pages
3. Click on each error type to see which URLs are affected
4. If important pages show errors: Tell Droid the URL and error type

**Common post-launch Search Console errors and fixes:**

| Error | Likely Cause | Fix |
|---|---|---|
| "Page not found (404)" | A URL was missed in `_redirects` or product page not generated | Tell Droid: "URL `/[slug]/` returns 404 — please create or add redirect." |
| "Redirect error" | A `_redirects` rule points to a URL that also redirects | Tell Droid: "Redirect chain detected on `/[slug]/`." |
| "Blocked by robots.txt" | A page you want indexed is in robots.txt | Tell Droid: "Remove `/[slug]/` from robots.txt." |
| "Duplicate, Google chose different canonical" | hreflang is not set correctly on TH/EN pages | Tell Droid: "Google is treating `/[slug]/` and `/th/[slug]/` as duplicates." |

---

## How You Know Phase 8 Is Complete

**Part A Checklist:**
- [ ] All 8 initial requirements collected and given to Droid
- [ ] Mobile review done on real phone — all issues fixed
- [ ] Lighthouse: Performance 90+, SEO 95+, Accessibility 85+, Best Practices 90+
- [ ] Security headers grade A or A+ at securityheaders.com
- [ ] Open Graph preview correct on LINE and Facebook
- [ ] GTM tracking tag on all pages
- [ ] `sitemap.xml` and `robots.txt` created
- [ ] Final full test purchase passed (end-to-end)
- [ ] Real product data entered (minimum top 10 with photos)
- [ ] Stripe live keys collected and ready

**Part B Checklist:**
- [ ] Stripe live mode keys stored as Cloudflare secrets
- [ ] Final deploy to pages.dev completed
- [ ] Real test purchase with live Stripe — refunded
- [ ] Custom domain `www.mildmate.com` added to Cloudflare Pages
- [ ] DNS records updated at registrar
- [ ] DNS propagation confirmed at dnschecker.org
- [ ] `https://www.mildmate.com` loads with padlock (SSL)
- [ ] Stripe webhook URL updated to `www.mildmate.com`
- [ ] Sitemap submitted to Google Search Console
- [ ] 24-hour post-launch monitoring completed with no critical errors
- [ ] Google Search Console checked at 48 hours — no major errors
- [ ] Old WordPress site kept as backup for 30 days

---

## Troubleshooting Common Launch Problems

| Problem | Solution |
|---|---|
| DNS not updating after 1 hour | Check dnschecker.org — confirm the CNAME record was saved correctly at your registrar. Some registrars take up to 48 hours. |
| SSL padlock not showing | Wait 15 minutes — Cloudflare provisions SSL automatically. If still missing after 30 minutes, tell Droid. |
| Old WordPress site still showing | Your local ISP has cached the old DNS. Try opening on your phone's mobile data (not WiFi) — it may already show the new site there. |
| "Service unavailable" error | Tell Droid immediately — the Worker deployment may have failed. Run `npx wrangler pages deploy public` again. |
| Stripe live payment failing | Confirm you replaced ALL 3 secrets (Secret Key, Publishable Key, Webhook Secret) with live mode versions in Step 8.10. |
| Webhook not firing on live payments | Confirm the webhook URL in Stripe live mode was updated in Step 8.16 to `www.mildmate.com`. |
| Google Search Console "not verified" | The verification meta tag may not have been deployed. Tell Droid: "Search Console is not verified — please confirm the meta tag is in the homepage `<head>`." |
| Images not loading on live domain | R2 bucket may need a custom domain configured. Tell Droid: "Images are not loading on www.mildmate.com — they load on pages.dev." |

---

## Congratulations — You Are Live

When `https://www.mildmate.com` loads your new site with a padlock, Stripe is accepting real payments, and Google Search Console is verified — **Phase 8 is complete and MildMate's new website is live.**

**What you have built:**
- A modern custom bedding e-commerce site on Cloudflare's global edge network
- 258 SEO-preserved URLs — zero ranking loss from WordPress migration
- A live price configurator for custom mattress dimensions (27 products, all 24 with live pricing)
- Thai PromptPay + international card payments via Stripe (Option A shipping tracking: carrier + tracking number + auto-generated carrier URL)
- Clerk multi-provider auth (Google / Facebook / Email) — customer account portal at `/account/`
- Automatic order confirmation emails and team notifications via Resend
- Abandoned cart email capture (Phase 5 built) — `workers/cron.ts` recovery email cron ⏸ Pending (Phase 6)
- A private admin dashboard (`/admin/`) for your manufacturing and marketing teams (Phase 7 — code complete, setup pending)
- Performance score 90+, security headers grade A at securityheaders.com
- Favorites wishlist (authenticated users) — built + deployed
- `public/robots.txt` ✅ built — `sitemap.xml` ⏸ Pending

**The website will now run automatically.** Orders save to D1. Emails send via Resend. Abandoned carts recover themselves. Your team manages everything from the admin dashboard — no code required.

---

## What To Do After Launch (First 30 Days)

| Week | Action |
|---|---|
| Week 1 | Upload remaining product photos via Admin → Images. Monitor orders daily. |
| Week 2 | Check Google Search Console for crawl errors. Fix any 404s. |
| Week 3 | (Phase 6 pending) Monitor abandoned cart capture working in checkout Step 2. Once `workers/cron.ts` is deployed, review recovery email rate. |
| Week 4 | Check Lighthouse scores again — confirm no regression. Review first real orders for any issues. |
| Day 30 | If everything is stable, cancel old WordPress hosting. Keep database backup. |
