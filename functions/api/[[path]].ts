// Pages Functions API catch-all
// Routes /api/* requests to the appropriate Worker handler
// Enables local dev with: npx wrangler pages dev public

import { handleQuote } from "../../workers/api/quote";
import { handleContact } from "../../workers/api/contact";
import { handleSubscribe } from "../../workers/api/subscribe";
import handleUnsubscribe from "../../workers/api/unsubscribe";
import { handlePricing } from "../../workers/api/pricing";
import { handleProducts } from "../../workers/api/products";
import { handleGeo } from "../../workers/api/geo-currency";

export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/health") {
    return new Response(JSON.stringify({ status: "ok", project: "mildmate-new" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (path.startsWith("/api/products")) return handleProducts(request, env);
  if (path.startsWith("/api/pricing")) return handlePricing(request, env);
  if (path === "/api/geo") return handleGeo(request, env);
  if (path === "/api/subscribe" || path === "/api/subscribe/") return handleSubscribe(request, env);
  if (path === "/api/unsubscribe" || path === "/api/unsubscribe/") return handleUnsubscribe(request, env);
  if (path === "/api/contact" || path === "/api/contact/") return handleContact(request, env);
  if (path === "/api/quote" || path === "/api/quote/") return handleQuote(request, env);

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
