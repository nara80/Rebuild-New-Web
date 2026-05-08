# MildMate API Learning Exercises

These exercises teach API/server concepts using the MildMate product data. Each exercise builds on the previous one.

## How to Run

Each exercise runs on its own port so they can all run at the same time.

```powershell
cd "D:\00_MildMate\Re-Build_Web\learn-api"
```

### Exercise 1 — Read-Only Product API (Port 8000)
```powershell
node server.js
```
- GET `/` — Welcome
- GET `/api/products` — List all products
- GET `/api/products/1` — Get one product

**Browser test:** Open `http://localhost:8000/api/products`

---

### Exercise 2 — Full CRUD API (Port 8001)
```powershell
node exercise-02-crud.js
```
- GET `/api/products` — List all (with `?category=Bedding` filter)
- GET `/api/products/1` — Get one
- POST `/api/products` — Add new product
- PUT `/api/products/1` — Update product
- DELETE `/api/products/1` — Remove product

**Maps to real project:** Admin product CRUD in Phase 7

**How to test POST/PUT/DELETE:**
Since browsers can only do GET easily, use PowerShell:

```powershell
# Add a new product
Invoke-RestMethod -Uri "http://localhost:8001/api/products" -Method POST -Body '{"title_en":"Test Pillow","base_price_usd":9.99}' -ContentType "application/json"

# Update a product's price
Invoke-RestMethod -Uri "http://localhost:8001/api/products/1" -Method PUT -Body '{"base_price_usd":49.99}' -ContentType "application/json"

# Delete a product
Invoke-RestMethod -Uri "http://localhost:8001/api/products/11" -Method DELETE
```

---

### Exercise 3 — Shopping Cart API (Port 8002)
```powershell
node exercise-03-cart.js
```
- GET `/api/cart` — View cart with enriched product details
- POST `/api/cart` — Add item (with dimensions + fabric)
- DELETE `/api/cart/:itemId` — Remove one item
- DELETE `/api/cart` — Clear all
- POST `/api/cart/currency` — Switch USD/THB

**Maps to real project:** `cart.js` (Phase 4) + checkout data capture (Phase 5)

**How to test:**
```powershell
# Add a fitted bed sheet to cart
Invoke-RestMethod -Uri "http://localhost:8002/api/cart" -Method POST -Body '{"product_id":1,"width_cm":200,"length_cm":200,"depth_cm":30,"fabric":"BreezePlus","price":39.99}' -ContentType "application/json"

# View cart
Invoke-RestMethod -Uri "http://localhost:8002/api/cart" -Method GET

# Switch to THB
Invoke-RestMethod -Uri "http://localhost:8002/api/cart/currency" -Method POST -Body '{"currency":"THB"}' -ContentType "application/json"
```

---

## Mapping to Real MildMate Project

| Exercise | Concept | Real Project Location |
|---|---|---|
| Exercise 1 | Reading product data | `workers/api/products.ts` (Phase 4) |
| Exercise 2 | Admin CRUD operations | `workers/admin/products.ts` (Phase 7) |
| Exercise 3 | Cart + dimensions + fabric | `public/js/cart.js` + `workers/api/checkout.ts` (Phases 4-5) |

---

## Resetting Data

If you want to reset `products.json` or `cart.json` to their original state, you can restore them from git:

```powershell
cd "D:\00_MildMate\Re-Build_Web"
git checkout learn-api/products.json
```

Or manually copy the original data back.
