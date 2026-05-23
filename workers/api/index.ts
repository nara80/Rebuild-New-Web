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
import { handleAdminPricingParams } from "./admin-pricing";
import { handleAdminProducts } from "./admin-products";
import { handleAdminUpload } from "./admin-upload";

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

    // Admin API — image upload to R2
    if (path === "/api/admin/upload" || path === "/api/admin/upload/") {
      return handleAdminUpload(request, env);
    }

    // Admin API — products management (CRUD)
    if (path.startsWith("/api/admin/products")) {
      return handleAdminProducts(request, env);
    }

    // Admin API — pricing params management (write)
    if (path === "/api/admin/pricing-params" || path === "/api/admin/pricing-params/") {
      return handleAdminPricingParams(request, env);
    }

    // Pricing Parameters API (public read-only)
    if (path.startsWith("/api/pricing-params") || path.startsWith("/api/diy-prices")) {
      return handlePricingParams(request, env);
    }

    // R2 asset proxy — serves uploaded product images
    if (path.startsWith("/r2/")) {
      const key = path.substring(4);
      const bucket = env.MILDMATE_ASSETS as R2Bucket;
      const obj = await bucket.get(key);
      if (obj) {
        return new Response(obj.body, {
          headers: {
            "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable"
          }
        });
      }
      return new Response("Not Found", { status: 404 });
    }

        return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};
