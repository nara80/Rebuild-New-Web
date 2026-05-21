# Phase 7 — Admin Dashboard
**Status (2026-05-21): ⏸️ PENDING**
**Goal:** Build a private management interface for your team — protected by Google login.

**End Result:** A clean, password-protected web dashboard at `mildmate-new.pages.dev/admin/` that only your team can access. Your manufacturing team sees every order's exact custom dimensions. Your marketing team can update products and export email lists without touching any code. Your operations team can enter tracking numbers and monitor delivery status via AfterShip (FedEx, UPS, DHL, Thai Post + 100+ carriers).

**Time Estimate:** 30–45 minutes setup (mostly Cloudflare Access configuration); Droid builds all the code.

---

## What the Admin Dashboard Contains

The dashboard has 5 sections, accessible from a left sidebar:

```
┌─────────────────────────────────────────────────────────────────┐
│  MildMate Admin                                                 │
├────────────┬────────────────────────────────────────────────────┤
│            │                                                    │
│ Dashboard  │   [Main content area changes based on sidebar]     │
│ Products   │                                                    │
│ Orders     │                                                    │
│ Images     │                                                    │
│ Subscribers│                                                    │
│            │                                                    │
└────────────┴────────────────────────────────────────────────────┘
```

---

## What Phase 7 Builds

| File | What It Is |
|---|---|
| `admin/index.html` | Dashboard overview — order counts, revenue summary |
| `admin/orders.html` | Order table with custom dimensions for manufacturing + tracking_number + carrier fields (AfterShip integration) |
| `admin/products.html` | Product editor — titles, prices, fabric options |
| `admin/upload.html` | Drag-and-drop R2 image uploader |
| `admin/subscribers.html` | Email subscriber list + CSV export |
| `public/css/admin.css` | Admin-specific styles (clean, functional, no-frills) |
| `workers/admin/orders.ts` | API: fetch and update orders from D1 |
| `workers/admin/products.ts` | API: CRUD operations on products in D1 |
| `workers/admin/upload.ts` | API: receive image → save to R2 → return CDN URL |
| `workers/admin/subscribers.ts` | API: fetch subscribers + stream CSV download |

---

## Initial Requirements — What You Must Provide

Before telling Droid to build, collect the following. This section is the most important preparation step in Phase 7.

---

### Requirement 1 — Team Email Addresses for Admin Access

Write down every email address that should have access to the admin dashboard. These must be **Google/Gmail accounts** (used to log in via Cloudflare Access).

**Fill in your list:**
```
Admin user 1: [email]@gmail.com   (your main account)
Admin user 2: [email]@gmail.com   (marketing team)
Admin user 3: [email]@gmail.com   (manufacturing team, if needed)
```

> **Maximum free users:** Cloudflare Access free plan allows up to 50 users — more than enough for your team.
> **Important:** Only email addresses on this list can log in. Anyone else is blocked automatically.

---

### Requirement 2 — Order Status Labels

The Orders page has a status column. Decide what status options your team needs.

**Recommended defaults (you can change these):**

| Status | Color | Meaning |
|---|---|---|
| `pending` | Yellow | Payment received, not yet in production |
| `in-production` | Blue | Manufacturing team is making the order |
| `shipped` | Green | Order has been sent to customer |
| `cancelled` | Red | Order was cancelled/refunded |

**Do you want to add, remove, or rename any of these?** Write your final status list — you will give it to Droid.

---

### Requirement 4 — Parcel Tracking Provider (AfterShip)

Phase 5 added AfterShip for customer-facing parcel tracking. Now the admin dashboard needs to display and manage tracking data.

**AfterShip account:**
- Sign up at [aftership.com](https://www.aftership.com) — Free Plan: 100 tracked shipments/month
- AfterShip provides a tracking page at `mildmate.com/track/[tracking]` (custom domain can be configured)
- Supports FedEx, UPS, DHL, Thai Post, and 400+ other carriers automatically

**What to collect:**
| Item | Where | What You Need |
|---|---|---|
| AfterShip API Key | Settings → API → Free tier key | `aftership-api-key-...` |
| Tracking page slug | AfterShip dashboard | `/track/[tracking]` — Droid configures this |

> Without AfterShip, tracking numbers are stored but status cannot be auto-fetched. Admin enters `tracking_number` + selects `carrier` in the Orders page. Customer sees tracking via carrier link in My Account.

---

### Requirement 3 — Order Table Columns

The Orders table shows one row per order. The dimensions columns differ based on sheet type — Droid will display them intelligently.

**Recommended columns for manufacturing:**

| Column | Why It Matters |
|---|---|
| Order ID | Reference number |
| Date | When the order was placed |
| Customer Name | Who to ship to |
| Phone | Contact number |
| Country | Where to ship |
| Product | What was ordered |
| Sheet Type | "Fitted Bed Sheet" or "V-Berth Boat Sheet" |
| Dimensions | **Critical for manufacturing.** Fitted Bed: W × L × D. V-Berth: Head × Foot × L × D |
| Fabric | Which fabric to use |
| Color | Which color to cut |
| Amount | How much was paid (USD or THB) |
| Payment Status | Confirmed / pending |
| Order Status | pending / in-production / shipped |

> **V-Berth orders display format:** `Head: 120cm | Foot: 160cm | L: 190cm | D: 20cm`
> **Fitted Bed orders display format:** `W: 160cm × L: 200cm × D: 25cm`

**Do you want to add or remove any columns?** Write your final column list.

---

### Requirement 4 — Product Fields to Edit

The Products editor lets your team update product information without touching code. Decide which fields should be editable.

**Recommended editable fields:**

| Field | Example |
|---|---|
| Title (English) | "Boat Bedding: CloudSoft Marine Fitted Sheet" |
| Title (Thai) | "ผ้าปูที่นอนสำหรับเรือ CloudSoft" |
| Description (English) | Short product description |
| Description (Thai) | Thai version |
| Base Price USD | 45.00 |
| Base Price THB | 1600 |
| Price per extra cm² USD | 0.0012 |
| Price per extra cm² THB | 0.042 |
| Fabric Options | BreezePlus, CloudSoft, PremaCotton, EcoLuxe (checkboxes) |
| Available Colors | List of color names |
| Category | marine / family / duvet / protection |
| Active (show/hide) | Toggle on/off without deleting |

**Do you want to add or remove any fields?** Write your final list.

---

### Requirement 5 — Image Upload Rules

The Image Uploader sends photos to your Cloudflare R2 storage. Decide on upload rules.

**Recommended rules:**

| Rule | Recommended Value | Why |
|---|---|---|
| Maximum file size | 5 MB per image | Prevents huge files slowing the site |
| Allowed formats | JPG, PNG, WebP | Standard web image formats |
| Auto-generate WebP | Yes | WebP is smaller and faster for the web |
| Folder structure in R2 | `products/[slug]/` and `categories/` | Keeps images organized |

**Any changes to these rules?** Write your preferences.

---

### Requirement 6 — CSV Export Columns for Subscribers

The Subscribers page has an "Export CSV" button that downloads your email list for use in Mailchimp, Brevo, or other email tools.

**Recommended CSV columns:**

| Column | Example |
|---|---|
| Email | customer@example.com |
| Source | footer / checkout |
| Date Subscribed | 2026-05-03 |

**Do you want to add any other columns?** (e.g., country, language preference)

---

### Requirement 7 — Dashboard Overview Numbers

The main Dashboard page shows a summary of your business at a glance.

**Recommended summary cards:**

| Card | What It Shows |
|---|---|
| Total Orders | All-time order count |
| Revenue This Month | Sum of paid orders this month |
| Pending Orders | Orders with status = pending |
| Subscribers | Total email list size |
| Abandoned Carts | Carts not yet recovered |
| Recovery Rate | % of abandoned carts that converted |

**Do you want to add or remove any summary cards?**

---

## Step-by-Step Instructions

### Step 7.1 — Fill In All 7 Requirements Above

Go through Requirements 1–7 and write down your answers. You will give all of them to Droid in Step 7.5.

**Create a simple text document on your computer with this format:**

```
PHASE 7 REQUIREMENTS

Requirement 1 — Admin Emails:
- [email 1]
- [email 2]
- [email 3]

Requirement 2 — Order Statuses:
- pending (yellow)
- in-production (blue)
- shipped (green)
- cancelled (red)

Requirement 3 — Order Table Columns:
[list your columns]

Requirement 4 — Product Fields:
[list your fields]

Requirement 5 — Image Upload Rules:
Max size: 5MB
Formats: JPG, PNG, WebP
Auto WebP: Yes

Requirement 6 — CSV Columns:
Email, Source, Date Subscribed

Requirement 7 — Dashboard Cards:
[list your cards]
```

---

### Step 7.2 — Set Up Cloudflare Access (Google Login Protection)

This is the security gate that protects your `/admin/` area. Only emails you approve can enter.

**Step-by-step in Cloudflare dashboard:**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. In the left sidebar, click **Zero Trust**
   > If you see a setup screen, click **Get started** → choose the free plan
3. In the Zero Trust sidebar, click **Access** → **Applications**
4. Click **Add an application**
5. Select **Self-hosted**
6. Fill in the application details:
   - **Application name:** `MildMate Admin`
   - **Session duration:** `24 hours` (team stays logged in for 24 hours)
   - **Application domain:** `mildmate-new.pages.dev`
   - **Path:** `/admin`
7. Click **Next**
8. On the **Policies** screen:
   - Policy name: `Team Access`
   - Action: **Allow**
   - Under **Include**, select **Emails** from the dropdown
   - Enter each email address from Requirement 1 — click **Add** after each one
9. Click **Next** → **Add application**

**Test the protection:**
1. Open a private/incognito browser window
2. Go to `https://mildmate-new.pages.dev/admin/`
3. You should be redirected to a Cloudflare login page asking for your Google account
4. Sign in with one of the approved emails → you should be allowed in
5. Try with a different Google account not on the list → you should be blocked

---

### Step 7.3 — Understand How the Image Uploader Works

The image uploader is a drag-and-drop box in the admin dashboard. Here is exactly what happens when you upload a photo:

```
You drag a photo into the upload box
           ↓
Browser sends the image to your Worker
           ↓
Worker validates: correct format? Under size limit?
           ↓
Worker saves original image to R2 storage
Worker creates an optimized WebP version in R2
           ↓
Worker returns two URLs:
  Original:  https://[r2-url]/products/[slug]/image.jpg
  WebP:      https://[r2-url]/products/[slug]/image.webp
           ↓
URL is automatically filled into the product's image field
Product pages now show the new image
```

> You never need to open R2 directly — the uploader handles everything.

---

### Step 7.4 — Prepare Sample Product Data for Testing

After the admin is built, you will test it by adding real product data. Prepare one complete product to enter as a test.

**Pick one product and gather:**

```
Product: [pick from your top 5 Etsy products]

Title (English): [from MildMate_Products.md]
Title (Thai): [from MildMate_Products.md if available]

Description (English): [2-3 sentences describing the product]
Description (Thai): [Thai version if available]

Base Price USD: $[your price]
Base Price THB: ฿[your price]

Fabric options: [which fabrics are available for this product]
Colors: [which colors are available]
Category: [marine / family / duvet / protection]

Image: [have one product photo ready]
```

---

### Step 7.5 — Tell Droid to Build Phase 7

Once you have completed Steps 7.1–7.4, hand off to Droid.

**Tell Droid:**
> "Phase 6 is complete. Please build Phase 7 — the admin dashboard.
>
> Here are my requirements:
>
> **Requirement 1 — Admin Emails:**
> [paste your email list]
>
> **Requirement 2 — Order Statuses:**
> [paste your status list]
>
> **Requirement 3 — Order Table Columns:**
> [paste your column list]
>
> **Requirement 4 — Product Fields:**
> [paste your field list]
>
> **Requirement 5 — Image Upload Rules:**
> [paste your rules]
>
> **Requirement 6 — CSV Columns:**
> [paste your columns]
>
> **Requirement 7 — Dashboard Cards:**
> [paste your card list]
>
> Build all 5 admin pages, admin CSS, and all admin Worker API endpoints."

---

### Step 7.6 — Deploy and Access the Admin Dashboard

**Deploy the updated project:**
```
cd D:\00_MildMate\Re-Bulit_Web
npx wrangler pages deploy public
```

**Access the admin:**
1. Go to `https://mildmate-new.pages.dev/admin/`
2. Log in with your Google account (one of the approved emails from Requirement 1)
3. You should see the Dashboard overview page

---

### Step 7.7 — Review the Dashboard Overview Page

The first page you see after logging in.

| Check | Expected |
|---|---|
| Summary cards visible | Total Orders, Revenue, Pending, Subscribers, Abandoned Carts |
| Numbers are correct | Should match your D1 database (even if all zeros from testing) |
| Sidebar navigation | Dashboard, Products, Orders, Images, Subscribers links all visible |
| Logout option | Somewhere in the header or sidebar |
| Looks clean | Simple table-style layout — no need for flashy design |

---

### Step 7.8 — Review the Orders Page

Click **Orders** in the sidebar.

| Check | Expected |
|---|---|
| Table loads | Shows your test orders from Phase 5 |
| All columns visible | Date, Customer Name, Product, Sheet Type, Dimensions, Fabric, Color, Amount, Status |
| Sheet Type visible | Shows "Fitted Bed Sheet" or "V-Berth Boat Sheet" |
| Dimensions — Fitted Bed | Shows `W: 160cm × L: 200cm × D: 25cm` format |
| Dimensions — V-Berth | Shows `Head: 120cm \| Foot: 160cm \| L: 190cm \| D: 20cm` format |
| Status dropdown | Click the status on any order — dropdown appears with your status options |
| Status update saves | Change status to "in-production" → refresh page → status is still "in-production" |
| Filter by status | Click "pending" filter → only pending orders show |
| Mobile view | Table scrolls horizontally on narrow screens |

> **The dimensions column is the most important thing to verify.** This is what your manufacturing team reads to know what to sew. Test BOTH a Fitted Bed Sheet order and a V-Berth order to confirm both formats display correctly.

---

### Step 7.9 — Review the Products Page

Click **Products** in the sidebar.

| Check | Expected |
|---|---|
| Product cards visible | All products from D1 shown as cards |
| Each card shows | Product name, price USD/THB, Active toggle, Edit button |
| Active toggle works | Click toggle → product becomes inactive → toggle is now off → refresh → still off |
| Edit button opens modal | Clicking Edit opens a form with all editable fields |
| Edit and save | Change a title → click Save → close modal → product card shows new title |
| Add new product | "Add Product" button → empty form → fill in → Save → new product appears in list |

---

### Step 7.10 — Test the Image Uploader

Click **Images** in the sidebar.

| Check | Expected |
|---|---|
| Upload box visible | Large drag-and-drop zone with "Drop image here or click to browse" |
| File picker works | Clicking the box opens a file browser |
| Drag-and-drop works | Drag an image from your desktop into the box |
| Upload progress | Shows a loading indicator while uploading |
| Success message | After upload: shows the image and its CDN URL |
| URL is copyable | You can copy the URL to use in a product |
| Wrong file type rejected | Try dragging a `.pdf` file — should show an error "Only JPG, PNG, WebP allowed" |
| Oversized file rejected | Try uploading a file over 5MB — should show an error |

---

### Step 7.11 — Add Your First Real Product

Use the admin Products page to add one real product as a test (the product you prepared in Step 7.4).

**How to do it:**
1. Click **Products** → **Add Product**
2. Fill in all fields with your prepared product data (Step 7.4)
3. Upload the product image using the Images uploader — copy the URL
4. Paste the image URL into the product's image field
5. Click **Save**
6. Open `https://mildmate-new.pages.dev/all-products/` in a new tab
7. Confirm the new product appears in the product listing with the correct image and price

---

### Step 7.12 — Review the Subscribers Page

Click **Subscribers** in the sidebar.

| Check | Expected |
|---|---|
| Subscriber table visible | Shows emails collected from footer signup and checkout |
| Columns visible | Email, Source (footer/checkout), Date Subscribed |
| Export CSV button | Blue "Export CSV" button visible at top |
| CSV download works | Clicking Export CSV → file downloads to your computer |
| Open CSV in Excel | Open the downloaded file — data appears in correct columns |
| Thai text in CSV | If any subscribers have Thai names, text is not garbled (UTF-8 encoding) |

**How to test the subscriber capture:**
1. Go to `https://mildmate-new.pages.dev`
2. Scroll to the footer email signup
3. Enter a test email → click Subscribe
4. Go back to Admin → Subscribers
5. Refresh the page — your test email should appear with source = "footer"

---

### Step 7.13 — Share Access with Your Team

Once you have confirmed everything works:

1. Share the URL `https://mildmate-new.pages.dev/admin/` with your team members
2. They go to the URL → click "Sign in with Google" → use their Gmail
3. If their email is on the approved list (Requirement 1) → they get in
4. If not → they see "Access denied" — add their email in Cloudflare Access if needed

**How to add a new team member to Cloudflare Access:**
1. Cloudflare dashboard → Zero Trust → Access → Applications
2. Click **MildMate Admin** → **Edit**
3. Go to the **Policies** tab → click **Edit** on your Team Access policy
4. Add the new email address under **Include** → **Save**

---

## How You Know Phase 7 Is Complete

Go through this checklist before moving to Phase 8:

- [ ] All 7 requirements filled in and given to Droid
- [ ] Cloudflare Access set up — `/admin/` requires Google login
- [ ] Approved email addresses added to Cloudflare Access policy
- [ ] Non-approved email is blocked (tested in incognito window)
- [ ] Dashboard overview page loads with summary cards
- [ ] Orders page shows test orders with correct custom dimensions
- [ ] Order status can be changed and saved
- [ ] Products page shows all products
- [ ] Product edit modal opens and saves changes correctly
- [ ] Active toggle on products works
- [ ] New product can be added from admin
- [ ] Image uploader accepts JPG/PNG/WebP files
- [ ] Image uploader rejects wrong file types and oversized files
- [ ] Uploaded image appears in R2 and URL is returned
- [ ] New product with uploaded image appears on public product listing
- [ ] Subscribers page shows email list
- [ ] CSV export downloads correctly and opens in Excel/Google Sheets
- [ ] Footer email signup saves to subscribers table
- [ ] Team member login tested with a second approved Google account

---

## Troubleshooting Common Problems

| Problem | Solution |
|---|---|
| Cloudflare Access login page not appearing | Tell Droid: "Going to /admin/ does not redirect to the Google login page." The Access policy may not be configured correctly. |
| "Access denied" for an approved email | Go to Cloudflare Zero Trust → Access → Applications → MildMate Admin → Policies → confirm the email is listed exactly as typed (case-sensitive). |
| Orders page is empty | Tell Droid: "The orders admin page is not loading any orders." Run the D1 check: `npx wrangler d1 execute mildmate-db --command="SELECT COUNT(*) FROM orders;"` |
| Custom dimensions not showing in orders table | Tell Droid: "The custom_width, custom_length, custom_depth columns are not appearing in the orders table." |
| Product edit modal not saving | Tell Droid: "Changes in the product edit modal are not being saved to D1." |
| Image upload fails | Tell Droid the exact error message shown. Common cause: R2 bucket binding not configured in wrangler.toml. |
| CSV export downloads empty file | Tell Droid: "The CSV export is downloading but the file is empty." |
| CSV has garbled Thai text | Tell Droid: "Thai characters in the CSV export appear as question marks or symbols — please ensure UTF-8 encoding with BOM." |
| Active toggle not persisting | Tell Droid: "The product active toggle reverts to its old state after page refresh." |

---

## What Happens Next

Once Phase 7 is complete, move to **Phase 8 — Polish + Launch**.

Phase 8 is the final phase. Droid audits every page for mobile issues, runs performance tests, adds security headers, and prepares everything for the DNS cutover that switches `www.mildmate.com` from your old WordPress site to the new MildMate website.

**Tell Droid:** "Phase 7 is complete. All checklist items are done. Please start Phase 8."
