// MildMate API — Pages Function catch-all for /api/*
// Converts Service Worker format to Pages Function format
import { handleProducts } from "../../workers/api/products";
import { handlePricing } from "../../workers/api/pricing";
import { handleGeo } from "../../workers/api/geo-currency";
import { handleSubscribe } from "../../workers/api/subscribe";
import handleUnsubscribe from "../../workers/api/unsubscribe";
import { handleContact } from "../../workers/api/contact";
import { handleQuote } from "../../workers/api/quote";
import { handlePricingParams } from "../../workers/api/pricing-params";
import { handleAdminPricingParams } from "../../workers/api/admin-pricing";
import { handleAdminProducts } from "../../workers/api/admin-products";
import { handleAdminUpload } from "../../workers/api/admin-upload";

export const onRequest: PagesFunction<{
  DB: D1Database;
  MILDMATE_ASSETS: R2Bucket;
  RESEND_API_KEY: string;
  ADMIN_SECRET?: string;
}> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Health check
  if (path === "/api/health") {
    return new Response(JSON.stringify({ status: "ok" }), {
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

  // Geo
  if (path === "/api/geo") {
    return handleGeo(request, env);
  }

  // Subscribe
  if (path === "/api/subscribe" || path === "/api/subscribe/") {
    return handleSubscribe(request, env);
  }

  // Unsubscribe
  if (path === "/api/unsubscribe" || path === "/api/unsubscribe/") {
    return handleUnsubscribe(request, env);
  }

  // Contact
  if (path === "/api/contact" || path === "/api/contact/") {
    return handleContact(request, env);
  }

  // Quote
  if (path === "/api/quote" || path === "/api/quote/") {
    return handleQuote(request, env);
  }

  // Admin upload
  if (path === "/api/admin/upload" || path === "/api/admin/upload/") {
    return handleAdminUpload(request, env);
  }

  // Admin products
  if (path.startsWith("/api/admin/products")) {
    return handleAdminProducts(request, env);
  }

  // Admin pricing
  if (path === "/api/admin/pricing-params" || path === "/api/admin/pricing-params/") {
    return handleAdminPricingParams(request, env);
  }

  // Public pricing params
  if (path.startsWith("/api/pricing-params") || path.startsWith("/api/diy-prices")) {
    return handlePricingParams(request, env);
  }

  // R2 asset proxy
  if (path.startsWith("/r2/")) {
    const key = path.substring(4);
    const bucket = env.MILDMATE_ASSETS;
    const obj = await bucket.get(key);
    if (obj) {
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
    return new Response("Not Found", { status: 404 });
  }

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
};
