// MildMate API — Exercise 2: Full CRUD (Create, Read, Update, Delete)
// This teaches the 4 basic operations every API needs
// In the real project, these map to: Admin adding products, editing prices, removing items

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8001;
const productsFile = path.join(__dirname, "products.json");

// Helper: read products from JSON file
function readProducts() {
  const data = fs.readFileSync(productsFile, "utf-8");
  return JSON.parse(data);
}

// Helper: write products back to JSON file
function writeProducts(products) {
  fs.writeFileSync(productsFile, JSON.stringify(products, null, 2), "utf-8");
}

// Helper: send JSON response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// Helper: read body from POST/PUT requests
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
  const url = req.url.split("?")[0]; // strip query string for route matching
  const fullUrl = req.url; // keep full URL for query parameter parsing
  const method = req.method;
  console.log(`${method} ${req.url}`);

  // ── Route: GET / — Welcome ──────────────────────────
  if (url === "/" && method === "GET") {
    sendJson(res, 200, {
      message: "MildMate Admin Product API — Exercise 2",
      routes: {
        "GET /api/products": "List all products",
        "GET /api/products/1": "Get one product by ID",
        "GET /api/products?category=Bedding": "Filter by category",
        "POST /api/products": "Add a new product (admin)",
        "PUT /api/products/1": "Update a product (admin)",
        "DELETE /api/products/1": "Remove a product (admin)",
      },
    });
  }

  // ── Route: GET /api/products — List + Filter ────────
  else if (url === "/api/products" && method === "GET") {
    let products = readProducts();

    // Simple query filter: /api/products?category=Bedding
    const category = new URL(fullUrl, `http://localhost:${PORT}`).searchParams.get("category");
    if (category) {
      products = products.filter((p) => p.category === category);
    }

    sendJson(res, 200, { total: products.length, products });
  }

  // ── Route: GET /api/products/:id — Get one ──────────
  else if (url.startsWith("/api/products/") && method === "GET" && !url.includes("?")) {
    const id = parseInt(url.split("/")[3]);
    const products = readProducts();
    const product = products.find((p) => p.id === id);

    if (product) {
      sendJson(res, 200, product);
    } else {
      sendJson(res, 404, { error: `Product ${id} not found` });
    }
  }

  // ── Route: POST /api/products — Create new ──────────
  else if (url === "/api/products" && method === "POST") {
    const body = await readBody(req);
    const products = readProducts();

    // Auto-assign next ID
    const newId = Math.max(...products.map((p) => p.id), 0) + 1;
    const newProduct = {
      id: newId,
      slug: body.slug || `product-${newId}`,
      title_en: body.title_en || "New Product",
      description_en: body.description_en || "",
      category: body.category || "Bedding",
      subcategory: body.subcategory || "",
      fabric_options: body.fabric_options || "BreezePlus",
      base_price_usd: body.base_price_usd || 0,
      is_custom: body.is_custom !== undefined ? body.is_custom : true,
      image_url: body.image_url || "/images/products/default.jpg",
    };

    products.push(newProduct);
    writeProducts(products);

    sendJson(res, 201, { message: "Product created", product: newProduct });
  }

  // ── Route: PUT /api/products/:id — Update ───────────
  else if (url.startsWith("/api/products/") && method === "PUT") {
    const id = parseInt(url.split("/")[3]);
    const body = await readBody(req);
    const products = readProducts();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) {
      sendJson(res, 404, { error: `Product ${id} not found` });
      return;
    }

    // Update only the fields provided
    products[index] = { ...products[index], ...body, id };
    writeProducts(products);

    sendJson(res, 200, { message: "Product updated", product: products[index] });
  }

  // ── Route: DELETE /api/products/:id — Remove ────────
  else if (url.startsWith("/api/products/") && method === "DELETE") {
    const id = parseInt(url.split("/")[3]);
    let products = readProducts();
    const originalLength = products.length;
    products = products.filter((p) => p.id !== id);

    if (products.length === originalLength) {
      sendJson(res, 404, { error: `Product ${id} not found` });
      return;
    }

    writeProducts(products);
    sendJson(res, 200, { message: `Product ${id} deleted`, total: products.length });
  }

  // Route not found
  else {
    sendJson(res, 404, { error: "Route not found" });
  }
});

server.listen(PORT, () => {
  console.log(`Exercise 2 — CRUD API running at http://localhost:${PORT}`);
  console.log("Try these (use a tool like Postman, or curl, or a simple HTML form):");
  console.log(`  GET  http://localhost:${PORT}/api/products`);
  console.log(`  GET  http://localhost:${PORT}/api/products?category=Bedding`);
  console.log(`  POST http://localhost:${PORT}/api/products   { "title_en": "New Item", "base_price_usd": 19.99 }`);
  console.log(`  PUT  http://localhost:${PORT}/api/products/1   { "base_price_usd": 49.99 }`);
  console.log(`  DELETE http://localhost:${PORT}/api/products/1`);
});
