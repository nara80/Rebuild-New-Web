# Phase 1 — Foundation
**Goal:** Set up the complete project scaffold, database schema, and Cloudflare configuration so every future phase has a clean, working base to build on.

**End Result:** A wired-up project folder on your computer, connected to Cloudflare, with an empty but fully structured database ready to receive products and orders.

**Time Estimate:** 30–60 minutes (most of it is waiting for Droid to build)

---

## Initial Requirements — What You Must Provide

Collect all of the following before telling Droid to build. These are the only decisions Phase 1 requires from you.

---

### Requirement 1 — Cloudflare Account

Phase 1 requires an active Cloudflare account. This is where your website, database, and file storage will live.

**Check or create:**
1. Go to [cloudflare.com](https://cloudflare.com)
2. Sign in or click **Sign Up** (free account is sufficient)
3. Write down the email address you used to sign up — you will need it for Wrangler login in Step 1.3

> **Already have a Cloudflare account?** Your D1 database (`mildmate-db`) and R2 bucket (`mildmate-assets`) are already created — see "What Already Exists" below.

---

### Requirement 2 — GitHub Account and Repository

Your project code is stored on GitHub. This gives you a safe backup and allows Cloudflare Pages to deploy automatically.

**Check or create:**
1. Go to [github.com](https://github.com)
2. Sign in or click **Sign Up** (free account is sufficient)
3. Create a new **empty** repository named `mildmate-web`
   - Go to github.com → click **+** (top right) → **New repository**
   - Name: `mildmate-web`
   - Visibility: **Private** (recommended — keeps your code private)
   - Do NOT initialize with README — leave it empty
   - Click **Create repository**
4. Copy the repository URL (looks like: `https://github.com/yourusername/mildmate-web`)

**Write down:** Your GitHub username and the repository URL — give both to Droid in Step 1.4.

---

### Requirement 3 — Project Name for Cloudflare Pages

Your development site will be accessible at `[project-name].pages.dev` during the build period (before you switch to `www.mildmate.com`).

**Decide your project name:**

| Option | Dev URL | Notes |
|---|---|---|
| `mildmate-web` | `mildmate-web.pages.dev` | Simple, matches GitHub repo name |
| `mildmate-new` | `mildmate-new.pages.dev` | Makes it clear this is the new site |
| `mildmate-2026` | `mildmate-2026.pages.dev` | Year-versioned |

**Recommendation:** Use `mildmate-new` — it is clear this is the rebuild, separate from the current live site.

**Write down:** Your chosen project name.

---

### Requirement 4 — Your Node.js and Wrangler Status

Droid needs to know whether these tools are already installed on your computer so it knows which setup steps to include.

**Check Node.js:**
1. Press `Windows Key + R` → type `cmd` → press Enter
2. Type: `node --version` → press Enter
3. Write down: version number (e.g., `v20.11.0`) OR "not installed"

**Check Wrangler:**
1. In the same cmd window, type: `npx wrangler --version` → press Enter
2. Write down: version number (e.g., `3.x.x`) OR "not installed"

**Write down both results** — give them to Droid in Step 1.4 so it knows what to install.

---

### Requirement 5 — Confirmation of Existing Resources

Your project already has a D1 database and R2 bucket set up. Confirm these exist before starting.

**Check in Cloudflare dashboard:**
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **Workers & Pages** → **D1** — confirm `mildmate-db` exists
3. Click **R2** — confirm `mildmate-assets` exists

**If either is missing:** Tell Droid which one is missing and it will guide you through creating it.

| Resource | Expected Name | Expected Status |
|---|---|---|
| D1 Database | `mildmate-db` | Exists (ID: `85ce2f41-463a-43fa-8485-181e983b8fd4`) |
| R2 Bucket | `mildmate-assets` | Exists |

---

## What Already Exists (No Action Needed)

Your current project at `D:\00_MildMate\Re-Bulit_Web` already has:

| Item | Status | Notes |
|---|---|---|
| `wrangler.toml` | Done | D1 database `mildmate-db` already bound |
| D1 Database | Done | ID: `85ce2f41-463a-43fa-8485-181e983b8fd4` |
| R2 Bucket | Done | `mildmate-assets` already bound |
| `package.json` | Done | Node dependencies installed |
| `MildMateDataBase/` | Done | All brand knowledge files exist |

> You do NOT need to recreate these. Phase 1 builds on top of what already exists.

---

## What Phase 1 Builds

| File / Folder | What It Is |
|---|---|
| `AGENTS.md` | Project memory — Droid reads this at the start of every session |
| `public/` | All website HTML, CSS, JS files live here |
| `public/css/main.css` | Empty CSS file ready for Phase 3 styling |
| `public/js/cart.js` | Empty JS file ready for Phase 4 cart logic |
| `public/js/configurator.js` | Empty JS file ready for Phase 4 price calculator (both Bed Sheet and V-Berth modes) |
| `public/js/geo.js` | Empty JS file ready for Phase 4 currency toggle |
| `public/images/` | Folder for your logo and product photos |
| `public/_redirects` | Empty — will be filled in Phase 2 |
| `public/_headers` | Security rules file (CSP, HSTS) |
| `workers/api/` | Folder for all Cloudflare Worker backend code |
| `workers/admin/` | Folder for all Admin dashboard backend code |
| `admin/` | Admin dashboard HTML pages |
| `migrations/001_initial.sql` | Database blueprint — creates all 4 tables with V-Berth dimension fields |

---

## Step-by-Step Instructions

### Step 1.1 — Install Node.js (if not already installed)

Node.js is the tool that runs Wrangler and all build commands. You checked this in Requirement 4.

**If Node.js is already installed:** Skip to Step 1.2.

**If Node.js is NOT installed:**
1. Go to [nodejs.org](https://nodejs.org)
2. Click the **LTS** version button (the left green button — "Recommended for most users")
3. Download and run the installer — click Next through all steps, keep all defaults
4. When installation finishes, close and reopen cmd
5. Type `node --version` — you should now see a version number like `v20.11.0`

---

### Step 1.2 — Install Wrangler (if not already installed)

Wrangler is the official Cloudflare tool that connects your project to your Cloudflare account. You checked this in Requirement 4.

**If Wrangler is already installed:** Skip to Step 1.3.

**If Wrangler is NOT installed:**
1. Open cmd (`Windows Key + R` → type `cmd` → Enter)
2. Type:
   ```
   npm install -g wrangler
   ```
3. Wait for installation to complete (about 30 seconds)
4. Confirm it worked:
   ```
   npx wrangler --version
   ```
   You should see a version number like `3.x.x`

---

### Step 1.3 — Log in to Cloudflare from your computer

This connects Wrangler on your computer to your Cloudflare account.

**How to do it:**
1. In the cmd window, navigate to your project folder by typing:
   ```
   cd D:\00_MildMate\Re-Bulit_Web
   ```
2. Type:
   ```
   npx wrangler login
   ```
3. A browser window opens → Click **Allow** to give permission
4. The cmd window shows: `Successfully logged in` — done

> You only need to do this once. Wrangler remembers your login.

---

### Step 1.4 — Tell Droid to build the Phase 1 scaffold

At this point, your computer is ready and all requirements are collected. Now you hand off to Droid.

**Tell Droid:**
> "I have completed the initial requirements. Here are my details:
>
> **Requirement 1 — Cloudflare account email:** [your Cloudflare email]
> **Requirement 2 — GitHub repo URL:** [https://github.com/yourusername/mildmate-web]
> **Requirement 3 — Cloudflare Pages project name:** mildmate-new
> **Requirement 4 — Node.js version:** [your result] / Wrangler version: [your result]
> **Requirement 5 — D1 and R2:** Both confirmed to exist in Cloudflare dashboard
>
> Node.js and Wrangler are installed. I am logged into Cloudflare. Please build the Phase 1 scaffold — create AGENTS.md, all folders, empty CSS/JS files, _headers file, and the migrations/001_initial.sql database schema."

**What Droid will build:**

```
D:\00_MildMate\Re-Bulit_Web\
├── AGENTS.md                          ← Project memory for Droid
├── public\
│   ├── css\
│   │   ├── main.css                   ← Empty, ready for Phase 3
│   │   └── admin.css                  ← Empty, ready for Phase 7
│   ├── js\
│   │   ├── cart.js                    ← Empty, ready for Phase 4
│   │   ├── configurator.js            ← Empty, ready for Phase 4
│   │   └── geo.js                     ← Empty, ready for Phase 4
│   ├── images\
│   │   └── (place your logo here)
│   ├── _redirects                     ← Empty, ready for Phase 2
│   └── _headers                       ← Security rules written now
├── workers\
│   ├── api\
│   │   └── index.ts                   ← Main Worker entry point
│   └── admin\
│       └── index.ts                   ← Admin Worker entry point
├── admin\
│   ├── index.html
│   ├── products.html
│   ├── orders.html
│   ├── upload.html
│   └── subscribers.html
└── migrations\
    └── 001_initial.sql                ← Database schema
```

---

### Step 1.5 — Run the database migration

This step creates the actual database tables inside your Cloudflare D1 database. It takes about 10 seconds.

**How to do it:**
1. In your cmd window (make sure you are still in `D:\00_MildMate\Re-Bulit_Web`), type:
   ```
   npx wrangler d1 execute mildmate-db --file=migrations/001_initial.sql
   ```
2. You will see output like:
   ```
   Executing on mildmate-db (85ce2f41-...)
   ✅ Executed 4 statements
   ```
3. Done — your database now has 4 empty tables: `products`, `orders`, `abandoned_carts`, `subscribers`

> **What if you see an error?** Tell Droid the exact error message. It is usually a small typo or a missing file — easy to fix.

---

### Step 1.6 — Verify the database tables were created

This confirms the migration worked correctly.

**How to check:**
1. In cmd, type:
   ```
   npx wrangler d1 execute mildmate-db --command="SELECT name FROM sqlite_master WHERE type='table';"
   ```
2. You should see:
   ```
   ┌──────────────────┐
   │ name             │
   ├──────────────────┤
   │ products         │
   │ orders           │
   │ abandoned_carts  │
   │ subscribers      │
   └──────────────────┘
   ```
3. All 4 tables exist — Phase 1 database is complete.

---

### Step 1.7 — Update wrangler.toml for the new project structure

The current `wrangler.toml` is configured for the old Next.js project (`pages_build_output_dir = "out"`). Droid will update it to point to the new `public/` folder and add Worker configuration.

**Tell Droid:**
> "Please update wrangler.toml for the new project structure — change the build output directory from 'out' to 'public', add the Workers configuration, and keep the existing D1 and R2 bindings."

---

### Step 1.8 — Test that the project runs locally

**How to test:**
1. In cmd, type:
   ```
   npx wrangler pages dev public
   ```
2. You will see:
   ```
   Ready on http://localhost:8788
   ```
3. Open your browser and go to `http://localhost:8788`
4. You should see a blank white page — this is correct. The structure is built, but content comes in later phases.
5. Press `Ctrl + C` in cmd to stop the local server when done.

---

## How You Know Phase 1 Is Complete

Go through this checklist. Every item must be ticked before moving to Phase 2.

**Initial Requirements:**
- [x] Cloudflare account exists and email noted
- [x] GitHub account exists and `Rebuild-New-Web` private repository created
- [x] Cloudflare Pages project name decided (`mildmate-new`)
- [x] Node.js version confirmed or installed
- [x] Wrangler version confirmed or installed
- [x] D1 database `mildmate-db` confirmed in Cloudflare dashboard
- [x] R2 bucket `mildmate-assets` confirmed in Cloudflare dashboard

**Build Steps:**
- [x] Logged into Cloudflare (`npx wrangler login` completed)
- [x] `AGENTS.md` file exists in `D:\00_MildMate\Re-Build_Web\`
- [x] `public/` folder exists with `css/`, `js/`, `images/` subfolders
- [x] `workers/` folder exists with `api/` and `admin/` subfolders
- [x] `admin/` folder exists with 5 HTML files
- [x] `migrations/001_initial.sql` exists
- [x] Database migration ran successfully (4 tables confirmed)
- [x] `wrangler.toml` updated (build dir = `public`)
- [x] Local server starts at `http://localhost:8788`

---

## Troubleshooting Common Problems

| Problem | Solution |
|---|---|
| `node` command not found | Install Node.js from nodejs.org (LTS version) — close and reopen cmd after installing |
| `npx wrangler --version` shows error after install | Close cmd completely, reopen, then try again — the PATH may need refreshing |
| `wrangler login` opens browser but nothing happens | Try `npx wrangler login --browser=false` — it gives you a URL to paste manually |
| `wrangler login` says "already logged in" | That is fine — you are already connected to Cloudflare |
| GitHub repository already exists with that name | Choose a different name or delete the old empty repository on GitHub first |
| D1 database not found in Cloudflare dashboard | Go to Cloudflare → Workers & Pages → D1 → Create database → name it `mildmate-db` |
| R2 bucket not found in Cloudflare dashboard | Go to Cloudflare → R2 → Create bucket → name it `mildmate-assets` |
| Migration error: `no such file` | Make sure you are in `D:\00_MildMate\Re-Bulit_Web` in cmd before running the command |
| Migration error: `table already exists` | The table was already created — this is fine. Confirm by running the SELECT check in Step 1.6 |
| `localhost:8788` shows an error | Tell Droid the exact error text shown in the cmd window |

---

## What Happens Next

Phase 1 is **complete**. Phase 2 (SEO URL Preservation) is **intentionally deferred** — it will run pre-launch after Phase 7 is complete.

Move directly to **Phase 3 — Design System + Shared Components**.

**Tell Droid:** "Phase 1 is complete. All checklist items are done. Phase 2 is deferred. Please start Phase 3."
