// MildMate Public API Worker
// Phase 4: products, pricing, geo-currency
// Phase 5+: checkout, webhook, email, subscribers

import { handleProducts } from "./products";
import { handlePricing } from "./pricing";
import { handleGeo } from "./geo-currency";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check endpoint
    if (path === "/api/health") {
      return new Response(JSON.stringify({ status: "ok", project: "mildmate-new" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Products API
    if (path.startsWith("/api/products")) {
      return handleProducts(request, env);
    }

    // Pricing API
    if (path.startsWith("/api/pricing")) {
      return handlePricing(request, env);
    }

    // Geo / Currency API
    if (path === "/api/geo") {
      return handleGeo(request, env);
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};
