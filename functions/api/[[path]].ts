// MildMate API — Pages Function catch-all for /api/*
// Converts Service Worker format to Pages Function format
import { handleProducts } from "../../workers/api/products";
import { handlePricing } from "../../workers/api/pricing";
import { handleGeo } from "../../workers/api/geo-currency";
import { handleCountries } from "../../workers/api/countries";
import { handleSubscribe } from "../../workers/api/subscribe";
import handleUnsubscribe from "../../workers/api/unsubscribe";
import { handleContact } from "../../workers/api/contact";
import { handleQuote } from "../../workers/api/quote";
import { handlePricingParams } from "../../workers/api/pricing-params";
import { handleAdminPricingParams } from "../../workers/api/admin-pricing";
import { handleAdminDiyPrices } from "../../workers/api/admin-diy";
import { handleAdminExchangeRates } from "../../workers/api/admin-exchange";
import { handleAdminProducts } from "../../workers/api/admin-products";
import { handleAdminUpload } from "../../workers/api/admin-upload";
import { handleAdminOrders } from "../../workers/api/admin-orders";
import { handleAdminCustomers } from "../../workers/api/admin-customers";
import { handleAdminStats } from "../../workers/api/admin-stats";
import { handleAdminShippingRates } from "../../workers/api/admin-shipping";
import { handleAdminQuotes } from "../../workers/api/admin-quotes";
import { handleDiscountValidate, handleDiscountClaim } from "../../workers/api/discount";
import { handleAdminContacts } from "../../workers/api/admin-contacts";
import { handleAdminPromo } from "../../workers/api/admin-promo";
import { handleAdminBlog } from "../../workers/api/admin-blog";
import { handleBlogPosts } from "../../workers/api/blog-posts";
import { handleAdminRecoveryTest } from "../../workers/api/admin-recovery-test";
import { handleFavorites } from "../../workers/api/favorites";
import { handleCheckout } from "../../workers/api/checkout";
import { handleShippingCalculate } from "../../workers/api/shipping";
import { handleStripeWebhook } from "../../workers/api/webhook";
import { handleAuth } from "../../workers/api/auth";
import { handleCustomers } from "../../workers/api/customers";
import { handleOrderConfirmed } from "../../workers/api/order-confirmed";

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

  // Public pricing params
  // Keep before /api/pricing* route to avoid /api/pricing-params being swallowed.
  if (path.startsWith("/api/pricing-params") || path.startsWith("/api/diy-prices")) {
    return handlePricingParams(request, env);
  }

  // Pricing API
  if (path.startsWith("/api/pricing")) {
    return handlePricing(request, env);
  }

  // Geo
  if (path === "/api/geo") {
    return handleGeo(request, env);
  }

  // Country master list
  if (path === "/api/countries" || path === "/api/countries/") {
    return handleCountries(request, env);
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

  // Admin orders
  if (path.startsWith("/api/admin/orders")) {
    return handleAdminOrders(request, env);
  }

  // Admin customers
  if (path === "/api/admin/customers" || path === "/api/admin/customers/") {
    return handleAdminCustomers(request, env);
  }

  // Admin listing performance stats
  if (path === "/api/admin/stats" || path === "/api/admin/stats/") {
    return handleAdminStats(request, env);
  }

  // Admin shipping rates
  if (path === "/api/admin/shipping-rates" || path === "/api/admin/shipping-rates/") {
    return handleAdminShippingRates(request, env);
  }

  // Admin sales quotes
  if (path === "/api/admin/quotes" || path === "/api/admin/quotes/") {
    return handleAdminQuotes(request, env);
  }

  // Admin promo codes
  if (path === "/api/admin/promo" || path === "/api/admin/promo/") {
    return handleAdminPromo(request, env);
  }

  // Admin Blog Posts — CRUD
  if (path === "/api/admin/blog" || path === "/api/admin/blog/") {
    return handleAdminBlog(request, env);
  }

  // Public Blog Posts — listing + single post
  if (path === "/api/blog/posts" || path === "/api/blog/posts/") {
    return handleBlogPosts(request, env);
  }

  // Admin recovery test — triggers abandoned cart recovery email manually
  if (path === "/api/admin/recovery-test" || path === "/api/admin/recovery-test/") {
    return handleAdminRecoveryTest(request, env);
  }

  // Public checkout shipping quote
  if (path === "/api/shipping/calculate" || path === "/api/shipping/calculate/") {
    return handleShippingCalculate(request, env);
  }

  // Favorites API — customer wishlist + admin leaderboard stats
  if (
    path === "/api/favorites" ||
    path === "/api/favorites/" ||
    path === "/api/admin/favorites/stats" ||
    path === "/api/admin/favorites/stats/"
  ) {
    return handleFavorites(request, env);
  }

  // Discount code validation
  if (path === "/api/discount/validate" || path === "/api/discount/validate/") {
    return handleDiscountValidate(request, env);
  }
  if (path === "/api/discount/claim" || path === "/api/discount/claim/") {
    return handleDiscountClaim(request, env);
  }

  // Admin contacts
  if (path.startsWith("/api/admin/contacts")) {
    return handleAdminContacts(request, env);
  }

  // Admin pricing
  if (path === "/api/admin/pricing-params" || path === "/api/admin/pricing-params/") {
    return handleAdminPricingParams(request, env);
  }
  // Admin DIY prices
  if (path === "/api/admin/diy-prices" || path === "/api/admin/diy-prices/") {
    return handleAdminDiyPrices(request, env);
  }
  // Admin exchange rates
  if (path === "/api/admin/exchange-rates" || path === "/api/admin/exchange-rates/") {
    return handleAdminExchangeRates(request, env);
  }

  // Admin subscribers
  if (path === "/api/admin/subscribers" || path === "/api/admin/subscribers/") {
    const secret = request.headers.get("X-Admin-Secret");
    if (secret !== (env.ADMIN_SECRET || "admin")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    // DELETE — remove a subscriber by ID
    if (request.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing 'id' parameter" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      await env.DB.prepare("DELETE FROM subscribers WHERE id = ?").bind(Number(id)).run();
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }
    // GET — list subscribers
    const fmt = url.searchParams.get("format");
    const { results } = await env.DB.prepare("SELECT id, email, source, language, created_at FROM subscribers ORDER BY created_at DESC").all();
    if (fmt === "csv") {
      const header = "id,email,source,language,created_at";
      const rows = results.map((r: any) => [r.id, r.email, r.source, r.language, r.created_at].join(","));
      return new Response(header + "\n" + rows.join("\n"), { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=subscribers.csv" } });
    }
    return new Response(JSON.stringify({ subscribers: results }), { headers: { "Content-Type": "application/json" } });
  }

  // Checkout
  if (path === "/api/checkout" || path === "/api/checkout/") {
    return handleCheckout(request, env);
  }

  // Stripe webhook
  if (path === "/api/webhook/stripe" || path === "/api/webhook/stripe/") {
    return handleStripeWebhook(request, env);
  }

  // Auth
  if (path === "/api/auth/me" || path === "/api/auth/me/") {
    return handleAuth(request, env);
  }

  // Customers
  if (path.startsWith("/api/customers")) {
    return handleCustomers(request, env);
  }

  // Order confirmed lookup
  if (path === "/api/order-confirmed" || path === "/api/order-confirmed/") {
    return handleOrderConfirmed(request, env);
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
