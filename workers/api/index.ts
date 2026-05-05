// MildMate Public API Worker
// Phase 4+ will add: products.ts, pricing.ts, geo-currency.ts, checkout.ts, webhook.ts, email.ts, subscribers.ts

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

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};
