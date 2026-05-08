// MildMate Product API Server — Learning Exercise
// This teaches you how an API server works
// Later, the SAME concept applies to Cloudflare Workers + D1

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8000;
const productsFile = path.join(__dirname, "products.json");

// Helper: read products from JSON file (our "database")
function readProducts() {
  const data = fs.readFileSync(productsFile, "utf-8");
  return JSON.parse(data);
}

// Helper: send a JSON response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// Create the server
const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;

  console.log(`${method} ${url}`);

  // Route: GET / — Welcome message
  if (url === "/" && method === "GET") {
    sendJson(res, 200, {
      message: "Welcome to MildMate Product API!",
      routes: {
        "GET /": "This welcome message",
        "GET /api/products": "List all products",
        "GET /api/products/1": "Get product by ID (1-10)",
      },
    });
  }

  // Route: GET /api/products — List all products
  else if (url === "/api/products" && method === "GET") {
    const products = readProducts();
    sendJson(res, 200, {
      total: products.length,
      products: products,
    });
  }

  // Route: GET /api/products/:id — Get one product
  else if (url.startsWith("/api/products/") && method === "GET") {
    const id = parseInt(url.split("/")[3]);
    const products = readProducts();
    const product = products.find((p) => p.id === id);

    if (product) {
      sendJson(res, 200, product);
    } else {
      sendJson(res, 404, { error: `Product with id ${id} not found` });
    }
  }

  // Route not found
  else {
    sendJson(res, 404, { error: "Route not found" });
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`MildMate API Server running at http://localhost:${PORT}`);
  console.log(`Try these URLs in your browser:`);
  console.log(`  http://localhost:${PORT}/`);
  console.log(`  http://localhost:${PORT}/api/products`);
  console.log(`  http://localhost:${PORT}/api/products/1`);
});
