// MildMate Public API Worker
// Phase 4: products, pricing, geo-currency, subscribe
// Phase 5+: checkout, webhook, email, discount-claims

import { handleProducts } from "./products";
import { handlePricing } from "./pricing";
import { handleGeo } from "./geo-currency";
import { handleCountries } from "./countries";
import { handleSubscribe } from "./subscribe";
import handleUnsubscribe from "./unsubscribe";
import { handleContact } from "./contact";
import { handleQuote } from "./quote";
import { handlePricingParams } from "./pricing-params";
import { handleAdminPricingParams } from "./admin-pricing";
import { handleAdminDiyPrices } from "./admin-diy";
import { handleAdminExchangeRates } from "./admin-exchange";
import { handleAdminProducts } from "./admin-products";
import { handleAdminUpload } from "./admin-upload";
import { handleAdminOrders } from "./admin-orders";
import { handleAdminCustomers } from "./admin-customers";
import { handleAdminStats } from "./admin-stats";
import { handleAdminShippingRates, handleAdminShippingProductTiers, handleAdminShippingAddRates } from "./admin-shipping";
import { handleAdminQuotes } from "./admin-quotes";
import { handleAdminThankyouDispatch } from "./admin-thankyou-dispatch";
import { handleDiscountValidate, handleDiscountClaim } from "./discount";
import { handleAdminPromo } from "./admin-promo";
import { handleAdminBlog } from "./admin-blog";
import { handleBlogPosts } from "./blog-posts";
import { handleAdminContacts } from "./admin-contacts";
import { handleAdminTemplates } from "./admin-templates";
import { handleAdminOffers } from "./admin-offers";
import { handleAdminCampaigns } from "./admin-campaigns";
import { handleFavorites } from "./favorites";
import { handleReviews, handleAdminReviews } from "./reviews";
import { handleCheckout } from "./checkout";
import { handleShippingCalculate } from "./shipping";
import { handleStripeWebhook } from "./webhook";
import { handleAuth } from "./auth";
import { handleCustomers } from "./customers";
import { handleOrderConfirmed } from "./order-confirmed";

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

    // Country master list API
    if (path === "/api/countries" || path === "/api/countries/") {
      return handleCountries(request, env);
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

    // Admin API — orders management
    if (path.startsWith("/api/admin/orders")) {
      return handleAdminOrders(request, env);
    }

    // Admin API — customers list (grouped by email from orders)
    if (path === "/api/admin/customers" || path === "/api/admin/customers/") {
      return handleAdminCustomers(request, env);
    }

    // Admin API — listing performance stats
    if (path === "/api/admin/stats" || path === "/api/admin/stats/") {
      return handleAdminStats(request, env);
    }

    // Admin API — shipping rates
    if (path === "/api/admin/shipping-rates" || path === "/api/admin/shipping-rates/") {
      return handleAdminShippingRates(request, env);
    }
    if (path === "/api/admin/shipping-product-tiers" || path === "/api/admin/shipping-product-tiers/") {
      return handleAdminShippingProductTiers(request, env);
    }
    if (path === "/api/admin/shipping-add-rates" || path === "/api/admin/shipping-add-rates/") {
      return handleAdminShippingAddRates(request, env);
    }

    // Admin API — promo codes (create, list, revoke)
    if (path === "/api/admin/promo" || path === "/api/admin/promo/") {
      return handleAdminPromo(request, env);
    }

    // Admin Blog Posts — CRUD
    if (path === "/api/admin/blog" || path === "/api/admin/blog/") {
      return handleAdminBlog(request, env);
    }

    // Admin Templates — header/footer management
    if (path === "/api/admin/templates" || path === "/api/admin/templates/") {
      return handleAdminTemplates(request, env);
    }

    // Public Blog Posts — listing + single post
    if (path === "/api/blog/posts" || path === "/api/blog/posts/") {
      return handleBlogPosts(request, env);
    }

    // Public Reviews API
    if (path === "/api/reviews" || path === "/api/reviews/") {
      return handleReviews(request, env);
    }

    // Admin Reviews API — CRUD
    if (path === "/api/admin/reviews" || path === "/api/admin/reviews/") {
      return handleAdminReviews(request, env);
    }

    // Admin API — sales custom quotes
    if (path === "/api/admin/quotes" || path === "/api/admin/quotes/") {
      return handleAdminQuotes(request, env);
    }

    // Admin API — offers config persisted in D1 recovery_config
    if (path === "/api/admin/offers" || path === "/api/admin/offers/") {
      return handleAdminOffers(request, env);
    }

    // Admin API — Run a Sale campaigns
    if (path === "/api/admin/campaigns" || path === "/api/admin/campaigns/") {
      return handleAdminCampaigns(request, env);
    }

    // Admin API — manual dispatch for due thank-you emails
    if (path === "/api/admin/thankyou-dispatch" || path === "/api/admin/thankyou-dispatch/") {
      return handleAdminThankyouDispatch(request, env);
    }

    // Public API — shipping quote calculation for checkout totals
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

    // Discount code validation and claiming
    if (path === "/api/discount/validate" || path === "/api/discount/validate/") {
      return handleDiscountValidate(request, env);
    }
    if (path === "/api/discount/claim" || path === "/api/discount/claim/") {
      return handleDiscountClaim(request, env);
    }

    // Admin API — subscribers list
    if (path === "/api/admin/subscribers" || path === "/api/admin/subscribers/") {
      return handleAdminSubscribers(request, env);
    }

    // Admin API — pricing params management (write)
    if (path === "/api/admin/pricing-params" || path === "/api/admin/pricing-params/") {
      return handleAdminPricingParams(request, env);
    }

    // Admin API — DIY prices management (write)
    if (path === "/api/admin/diy-prices" || path === "/api/admin/diy-prices/") {
      return handleAdminDiyPrices(request, env);
    }

    // Admin API — exchange rates management (write)
    if (path === "/api/admin/exchange-rates" || path === "/api/admin/exchange-rates/") {
      return handleAdminExchangeRates(request, env);
    }


    // Phase 5 — Checkout API
    if (path === "/api/checkout" || path === "/api/checkout/") {
      return handleCheckout(request, env);
    }

    // Phase 5 — Stripe Webhook
    if (path === "/api/webhook/stripe" || path === "/api/webhook/stripe/") {
      return handleStripeWebhook(request, env);
    }

    // Phase 5 — Auth API (Cloudflare Access JWT)
    if (path.startsWith("/api/auth")) {
      return handleAuth(request, env);
    }

    // Phase 5 — Customers API (order history)
    if (path.startsWith("/api/customers")) {
      return handleCustomers(request, env);
    }

    // Phase 5 — Order confirmation lookup
    if (path === "/api/order-confirmed" || path === "/api/order-confirmed/") {
      return handleOrderConfirmed(request, env);
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

async function handleAdminSubscribers(request: Request, env: any): Promise<Response> {
  const secret = request.headers.get("X-Admin-Secret");
  if (secret !== (env.ADMIN_SECRET || "admin")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const url = new URL(request.url);
  // DELETE — remove a subscriber by ID
  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing 'id' parameter" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    await env.DB.prepare("DELETE FROM subscribers WHERE id = ?").bind(Number(id)).run();
    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  }
  const format = url.searchParams.get("format");
  const { results } = await env.DB.prepare("SELECT id, email, source, language, created_at FROM subscribers ORDER BY created_at DESC").all();
  if (format === "csv") {
    const header = "id,email,source,language,created_at";
    const rows = results.map((r: any) => [r.id, r.email, r.source, r.language, r.created_at].join(","));
    return new Response(header + "\n" + rows.join("\n"), { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=subscribers.csv" } });
  }
  return new Response(JSON.stringify({ subscribers: results }), { headers: { "Content-Type": "application/json" } });
}
