// MildMate API — Exercise 3: Shopping Cart API
// This teaches how a cart works before checkout
// In the real project, this maps to: cart.js (Phase 4) + checkout API (Phase 5)

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8002;
const cartFile = path.join(__dirname, "cart.json");
const productsFile = path.join(__dirname, "products.json");

function readCart() {
  const data = fs.readFileSync(cartFile, "utf-8");
  return JSON.parse(data);
}

function writeCart(cart) {
  fs.writeFileSync(cartFile, JSON.stringify(cart, null, 2), "utf-8");
}

function readProducts() {
  const data = fs.readFileSync(productsFile, "utf-8");
  return JSON.parse(data);
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url;
  const method = req.method;
  console.log(`${method} ${url}`);

  // ── Route: GET / — Welcome ──────────────────────────
  if (url === "/" && method === "GET") {
    sendJson(res, 200, {
      message: "MildMate Shopping Cart API — Exercise 3",
      routes: {
        "GET /api/cart": "View current cart with items and total",
        "POST /api/cart": "Add item to cart (product + dimensions + fabric)",
        "DELETE /api/cart/:itemId": "Remove one item from cart",
        "DELETE /api/cart": "Clear entire cart",
        "POST /api/cart/currency": "Switch currency (USD or THB)",
      },
    });
  }

  // ── Route: GET /api/cart — View cart ────────────────
  else if (url === "/api/cart" && method === "GET") {
    const cart = readCart();
    const products = readProducts();

    // Enrich cart items with product details
    const enrichedItems = cart.items.map((item) => {
      const product = products.find((p) => p.id === item.product_id);
      return {
        ...item,
        product_title: product ? product.title_en : "Unknown",
        product_image: product ? product.image_url : "",
      };
    });

    // Calculate total
    const total = enrichedItems.reduce((sum, item) => sum + (item.price || 0), 0);

    sendJson(res, 200, {
      currency: cart.currency,
      item_count: cart.items.length,
      items: enrichedItems,
      total: total.toFixed(2),
    });
  }

  // ── Route: POST /api/cart — Add item ────────────────
  else if (url === "/api/cart" && method === "POST") {
    const body = await readBody(req);
    const cart = readCart();
    const products = readProducts();

    // Validate: product must exist
    const product = products.find((p) => p.id === body.product_id);
    if (!product) {
      sendJson(res, 400, { error: `Product ${body.product_id} not found` });
      return;
    }

    // Build cart item (this is what a customer submits from the configurator)
    const newItem = {
      item_id: Date.now().toString(), // simple unique ID
      product_id: body.product_id,
      sheet_type: body.sheet_type || "fitted_bed", // 'fitted_bed' or 'vberth'
      // Fitted Bed Sheet dimensions
      width_cm: body.width_cm || null,
      length_cm: body.length_cm || null,
      depth_cm: body.depth_cm || null,
      // V-Berth dimensions
      head_width_cm: body.head_width_cm || null,
      foot_width_cm: body.foot_width_cm || null,
      fabric: body.fabric || product.fabric_options.split(",")[0],
      color: body.color || "White",
      quantity: body.quantity || 1,
      price: body.price || product.base_price_usd,
      added_at: new Date().toISOString(),
    };

    cart.items.push(newItem);
    writeCart(cart);

    sendJson(res, 201, {
      message: "Item added to cart",
      item: newItem,
      cart_total_items: cart.items.length,
    });
  }

  // ── Route: DELETE /api/cart/:itemId — Remove item ───
  else if (url.startsWith("/api/cart/") && method === "DELETE") {
    const itemId = url.split("/")[3];
    const cart = readCart();
    const originalLength = cart.items.length;
    cart.items = cart.items.filter((item) => item.item_id !== itemId);

    if (cart.items.length === originalLength) {
      sendJson(res, 404, { error: `Cart item ${itemId} not found` });
      return;
    }

    writeCart(cart);
    sendJson(res, 200, {
      message: `Item ${itemId} removed`,
      cart_total_items: cart.items.length,
    });
  }

  // ── Route: DELETE /api/cart — Clear cart ────────────
  else if (url === "/api/cart" && method === "DELETE") {
    writeCart({ items: [], currency: "USD" });
    sendJson(res, 200, { message: "Cart cleared" });
  }

  // ── Route: POST /api/cart/currency — Switch currency
  else if (url === "/api/cart/currency" && method === "POST") {
    const body = await readBody(req);
    const cart = readCart();
    const newCurrency = body.currency === "THB" ? "THB" : "USD";
    cart.currency = newCurrency;
    writeCart(cart);
    sendJson(res, 200, { message: `Currency set to ${newCurrency}`, currency: newCurrency });
  }

  // Route not found
  else {
    sendJson(res, 404, { error: "Route not found" });
  }
});

server.listen(PORT, () => {
  console.log(`Exercise 3 — Cart API running at http://localhost:${PORT}`);
  console.log("This simulates the cart system from Phase 4 + checkout from Phase 5");
  console.log("Try these:");
  console.log(`  GET    http://localhost:${PORT}/api/cart`);
  console.log(`  POST   http://localhost:${PORT}/api/cart   { "product_id": 1, "width_cm": 200, "length_cm": 200, "depth_cm": 30, "fabric": "BreezePlus", "price": 39.99 }`);
  console.log(`  DELETE http://localhost:${PORT}/api/cart/[item_id]`);
  console.log(`  POST   http://localhost:${PORT}/api/cart/currency   { "currency": "THB" }`);
});
