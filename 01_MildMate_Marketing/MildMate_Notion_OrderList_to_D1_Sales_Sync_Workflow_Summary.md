# MildMate – Notion OrderList to D1 Sales Sync

## Purpose

This Make.com scenario synchronizes mapped sales orders from the MildMate Notion **OrderList** into the MildMate D1 sales database through the production Sales API.

The workflow is designed to:

- Process only mapped Notion orders.
- Normalize the sales source/channel.
- Parse one or more mapped product lines.
- Send order-level totals without inventing per-item revenue.
- Upsert orders and items idempotently.
- Prevent duplicate sales records when the same order is synced again.

---

## Scenario

**Name:** `MildMate - Notion OrderList to D1 Sales Sync`

Current module flow:

1. **Notion [2] – Watch Data Source Items**
2. **Tools [4] – Set multiple variables**
3. **Text parser [5] – Match pattern**
4. **Array aggregator [7]**
5. **HTTP [10] – Make a request**

A route filter is used so only orders with:

`Product_Mapping_Status = Mapped`

continue through the scenario.

---

## 1. Notion Trigger

### Module

**Notion [2] – Watch Data Source Items**

### Data Source

`OrderList`

### Trigger behavior

The scenario watches updated Notion OrderList records.

Relevant Notion properties include:

- `Order_Number`
- `Shop`
- `Order_date01`
- `Order_Date`
- `TotalAmount`
- `Status`
- `D1_Product_Map`
- `Product_Mapping_Status`

### Production recommendation

Before enabling the schedule, set:

**Choose where to start → From now on**

This prevents old historical orders from being replayed automatically.

---

## 2. Tools – Order Variables

### Module

**Tools [4] – Set multiple variables**

### Variables

#### `source_order_id`

Mapped from:

`Notion → Order_Number`

#### `source_system`

Normalized from the Notion `Shop` value.

Examples:

- `TLine` → `line`
- `TWebSite` → `website`
- `TWhatsApp` → `whatsapp`
- `TFacebook` → `facebook`
- `MildMate` → `manual`
- Other channels fall back to lowercase, e.g.:
  - `Shopee` → `shopee`
  - `TikTok` → `tiktok`
  - `Lazada` → `lazada`

#### `order_total`

Mapped from:

`Notion → TotalAmount`

Currency is treated as THB for this OrderList workflow.

---

## 3. Text Parser

### Module

**Text parser [5] – Match pattern**

The parser converts `D1_Product_Map` text into structured line items.

Expected format example:

```text
Item 1 | D1 26 | BedBridge Connector | Qty 1 | Status Mapped
```

Parsed fields:

- `item_no`
- `product_id`
- `product_name`
- `quantity`
- `mapping_status`

The parser supports multiple product lines from one order.

---

## 4. Array Aggregator

### Module

**Array aggregator [7]**

### Source module

`Text parser [5]`

### Target module

`HTTP [10] – Make a request`

### Target structure

`Body content: Items`

### Item fields sent to the API

#### `source_item_key`

Built as a deterministic line key:

```text
<source_order_id>-<item_no>
```

Example:

```text
582630143523981168-1
```

This keeps item upserts idempotent.

#### `product_id`

Mapped from:

`Text parser → product_id`

#### `quantity`

Mapped from:

`Text parser → quantity`

#### `revenue_status`

Static value:

```text
UNALLOCATED
```

This is intentional because Notion does not provide reliable per-item revenue.

### Group by

`Tools [4] → source_order_id`

This groups all parsed items belonging to the same order into one API request.

---

## 5. HTTP Sales API

### Module

**HTTP [10] – Make a request**

### Production endpoint

```text
POST https://www.mildmate.com/api/v1/sales/orders/upsert
```

### Headers

```text
Content-Type: application/json
Authorization: Bearer <SALES_SYNC_API_TOKEN>
```

The real token is private and must not be stored in documentation.

### Cloudflare secret

The API reads:

```text
SALES_SYNC_API_TOKEN
```

from the Cloudflare Pages Production environment.

The secret was re-registered successfully using Wrangler and a fresh production deployment was completed.

---

## Request Body

The Make.com HTTP module uses a **Data structure** named:

`MildMate Sales Sync`

### Order fields

#### `source_system`

Mapped from:

`Tools [4] → source_system`

#### `source_order_id`

Mapped from:

`Tools [4] → source_order_id`

#### `order_date`

Uses the Notion date with fallback:

```text
ifempty(Order_date01.Start; Order_Date.date.start)
```

#### `currency`

Static:

```text
THB
```

#### `order_total`

Mapped from:

`Notion → TotalAmount`

#### `status`

Notion operational statuses are normalized to API-compatible values.

Current mapping:

```text
รอดำเนินการ → pending
กำลังเย็บ → processing
จัดส่งสินค้า → shipped
fallback → pending
```

#### `items`

Mapped directly from:

`Array aggregator [7] → Array[]`

---

## Revenue Handling

The workflow intentionally does **not** invent:

- unit price
- item subtotal
- line revenue allocation

Instead:

- `order_total` is sent at order level.
- Every line item uses:

```text
revenue_status = UNALLOCATED
```

- `line_revenue` is omitted / remains null.

This matches the Sales API contract.

---

## API Behavior

The API supports idempotent upserts using:

```text
UNIQUE(source_system, source_order_id)
```

Item-level upserts use:

```text
UNIQUE(sales_order_id, source_item_key)
```

The API also supports item reconciliation. If an existing item is missing from a later incoming payload, the API can mark that item as removed.

`product_id` is validated against the canonical D1 products table.

---

## Authentication Issue Resolved

During setup, the API originally returned:

```text
503 AUTH_NOT_CONFIGURED
```

even though `SALES_SYNC_API_TOKEN` appeared in Cloudflare.

Diagnosis confirmed:

- The source code expected the correct variable name.
- `context.env` was passed correctly.
- `www.mildmate.com` and `mildmate-new.pages.dev` were using the same Pages project.
- The problem was in the active Pages runtime environment.

The secret was re-set with Wrangler:

```powershell
npx wrangler pages secret put SALES_SYNC_API_TOKEN --project-name mildmate-new --env production
```

and verified with:

```powershell
npx wrangler pages secret list --project-name mildmate-new --env production
```

A fresh production deployment was then completed successfully.

---

## Git / Deployment Issue Resolved

A Cloudflare retry initially failed with:

```text
fatal: remote error: upload-pack: not our ref 936f011...
```

The local `master` branch was 18 commits ahead of `origin/master`.

After verification, the commits were pushed:

```powershell
git push origin master
```

GitHub `master` was updated to commit:

```text
936f011
```

Cloudflare then created a fresh successful Production deployment.

---

## Verified Test Results

### API connectivity

Confirmed:

```text
HTTP 200
success: true
```

### Successful new order creation

Example result:

```text
action: created
items:
  created: 1
  updated: 0
  unchanged: 0
  removed: 0
```

### Idempotency test

The same order was manually selected again:

```text
source_system: tiktok
source_order_id: 582630143523981168
```

Result:

```text
success: true
action: unchanged
sales_order_id: 2

items:
  created: 0
  updated: 0
  unchanged: 1
  removed: 0

Status Code: 200
```

This confirms that re-running the same order does not create duplicates.

Another Shopee order with two items was also re-synced successfully and returned:

```text
action: unchanged

items:
  created: 0
  updated: 0
  unchanged: 2
  removed: 0
```

---

## Current Status

### Verified working

- Notion trigger
- Mapped-order filter
- Source normalization
- Product-line parsing
- Multi-item aggregation
- Stable `source_item_key`
- Revenue status = `UNALLOCATED`
- Production API authentication
- Cloudflare Production deployment
- D1 order creation
- D1 item creation
- HTTP 200 responses
- Idempotent re-sync
- Duplicate prevention

### Final production step

Before turning the scenario on:

1. Right-click **Notion [2]**
2. Choose **Choose where to start**
3. Select **From now on**
4. Save
5. Enable the **Every 15 minutes** schedule

This ensures the live automation processes new/updated orders going forward instead of replaying historical records.

---

## Production Architecture

```text
Notion OrderList
      ↓
Mapped orders only
      ↓
Tools – normalize order variables
      ↓
Text Parser – parse D1 product lines
      ↓
Array Aggregator – build API items[]
      ↓
HTTP POST
https://www.mildmate.com/api/v1/sales/orders/upsert
      ↓
Cloudflare Pages Sales API
      ↓
MildMate D1 sales tables
```

---

## Key Safety Rules

- Do not expose `SALES_SYNC_API_TOKEN`.
- Do not invent item-level revenue.
- Do not enable historical replay for production.
- Keep deterministic `source_item_key` values.
- Keep `Product_Mapping_Status = Mapped` as the route filter.
- Use the canonical production endpoint:
  `https://www.mildmate.com/api/v1/sales/orders/upsert`
- Keep the schedule OFF while changing mappings or API structures.

---

## Overall Result

The **MildMate – Notion OrderList to D1 Sales Sync** workflow is now technically validated end-to-end.

The API connection, authentication, item mapping, D1 writes, and idempotent re-sync behavior have all been successfully tested.

The remaining operational step is to switch the Notion trigger to **From now on** and then enable the scheduled run once production activation is approved.
