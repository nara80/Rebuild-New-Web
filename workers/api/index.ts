// MildMate Public API Worker
// Phase 4: products, pricing, geo-currency, subscribe
// Phase 5+: checkout, webhook, email, discount-claims

import { handleProducts } from "./products";
import { handlePricing } from "./pricing";
import { handleGeo } from "./geo-currency";
import { handleSubscribe } from "./subscribe";
import handleUnsubscribe from "./unsubscribe";
import { handleContact } from "./contact";
import { handleQuote } from "./quote";
import { handlePricingParams } from "./pricing-params";

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

    // Subscribe / Email signup API
    if (path === "/api/subscribe" || path === "/api/subscribe/") {
      return handleSubscribe(request, env);
    }

    // Unsubscribe API
    if (path === "/api/unsubscribe" || path === "/api/unsubscribe/") {
      return handleUnsubscribe(request, env);
    }

    // Contact form API
    if (path === "/api/contact" || path === "/api/contact/") {
      return handleContact(request, env);
    }

    // Custom Quote API
    if (path === "/api/quote" || path === "/api/quote/") {
      return handleQuote(request, env);
    }

    // Pricing Parameters API (public read-only)
    if (path.startsWith("/api/pricing-params") || path.startsWith("/api/diy-prices")) {
      return handlePricingParams(request, env);
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};
