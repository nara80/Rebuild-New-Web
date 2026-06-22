# MildMate Shop Manager: At a Glance

A high-performance, standalone control center designed to completely decouple MildMate's Etsy operations from the main codebase and retire slow, legacy Notion workflows. Built on a blazing-fast, serverless Cloudflare stack, it gives you absolute control over your e-commerce data with zero overhead.

---

## ⚙️ Key Capabilities

*   **Blazing Fast Storage:** Replaces Notion blocks by caching listing metadata in Cloudflare D1 and serving product imagery instantly via Cloudflare R2.
*   **Direct API Sync:** Seamlessly updates titles, descriptions, tags, and complex pricing variations directly to Etsy via the Open API v3.
*   **Lockout-Proof Auth:** Engineered with sequential client-side execution and robust backend token rotation middleware to keep your API session permanently active and secure.
*   **Tailored UI:** A lightweight, custom-styled admin dashboard configured specifically for rapid, drag-and-drop inventory management.

**The Bottom Line:** It's your dedicated, private pipeline for keeping MildMate's listings agile, optimized, and entirely under your control.

---

## 📊 Deployment & Setup Status

### 1. Local Development Environment
*   **Wrangler Environment:** Upgraded to Wrangler `v4.103.0` to support Node `v24.14.1` on Windows.
*   **Dynamic Route Format:** Fixed asset worker route from Next.js format (`[...path].ts`) to Cloudflare Pages format (`[[path]].ts`).
*   **Local D1 Cache Database:** Schema initialized successfully on local SQLite emulator.
*   **Status:** Running successfully at `http://127.0.0.1:8788`.

### 2. Production Infrastructure (Cloudflare Pages)
*   **D1 Database:** Created database `etsy-db` (ID: `9215f034-d251-4901-9c88-63295562a425` in region `APAC`).
*   **D1 Schema:** Pushed and initialized remote database successfully (`npm run db:init:prod`).
*   **R2 Storage:** Created bucket `etsy-assets` to cache product images.
*   **Secrets Configured:**
    *   `ETSY_CLIENT_ID` (Keystring)
    *   `ETSY_CLIENT_SECRET` (Shared Secret)
    *   `ETSY_REDIRECT_URI` (`https://mildmate-shop-manger.pages.dev/api/auth/callback`)
    *   `ADMIN_PASSPHRASE` (Secure custom passcode)
*   **Scope Approvals:** Configured and authorized `listings_r`, `listings_w`, `profile_r`, `shops_r`, and `email_r` permissions.
*   **Header Format Resolution:** Adjusted `x-api-key` header to use the required `keystring:shared_secret` structure.
*   **Listing PATCH Routing:** Shifted general updates to the shop-nested endpoint: `/v3/application/shops/{shop_id}/listings/{listing_id}`.
*   **Inventory PUT Sanitization:** Added backend filtering to parse prices as floats, preserve required fields (`property_name` and `readiness_state_id`), and remove read-only fields (`product_id`, `is_deleted`, `offering_id`).
*   **On-Demand Image Syncing & Throttling (2026-06-22):**
    *   *Throttled Bulk Sync:* Added a `300ms` delay between requests in the bulk sync loop to respect the Etsy API rate limit (5 requests/sec).
    *   *On-Demand Fetching:* Configured the single listing fetch API (`GET /api/listings?id=...`) to dynamically download images from Etsy to R2 and cache them in D1 if they are missing. This resolved the missing images on the dashboard for listing `1746345383` and others.
    *   *Database Image Updates:* Fixed the `PUT` api endpoint to accept edited images from the dashboard and save them to D1.
*   **Etsy Image Syncing Constraints:**
    *   *Local R2/D1 Cache:* The custom Shop Manager completely supports uploading, removing, and reordering up to 20 images saved directly to Cloudflare R2 and cached in D1.
    *   *Etsy Sync Limits:* Image changes (add/delete/reorder) are **not** pushed to Etsy via the API (the sync logic only updates basic metadata: title, description, tags, and variations).
    *   *Etsy UI Legacy Bug:* If a listing has >10 images synced from the API, the official Etsy seller dashboard UI will hide the "Add Photo" button when you click "x" to delete an image. This is because the Etsy interface still checks against their legacy 10-image limit unless your shop has been fully migrated to their new web listing form.
*   **Status:** Fully deployed, verified, and active at `https://mildmate-shop-manger.pages.dev/`.
