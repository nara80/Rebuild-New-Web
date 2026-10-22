// MildMate Admin API — Exchange Rates management
// POST /api/admin/exchange-rates  — upsert a rate
// PUT  /api/admin/exchange-rates  — same

import { authorizeAdmin } from "./admin-auth";

export async function handleAdminExchangeRates(request: Request, env: any): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Secret",
      },
    });
  }

  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  if (request.method === "POST" || request.method === "PUT") {
    try {
      const body: any = await request.json();
      const { currency, rate_per_thb, label, symbol } = body;

      if (!currency || rate_per_thb === undefined) {
        return new Response(JSON.stringify({ error: "currency and rate_per_thb are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      await env.DB.prepare(
        `INSERT INTO exchange_rates (currency, rate_per_thb, label, symbol, updated_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(currency) DO UPDATE SET
           rate_per_thb = ?2, label = ?3, symbol = ?4, updated_at = datetime('now')`
      )
        .bind(currency.toUpperCase(), rate_per_thb, label || currency, symbol || "")
        .run();

      return new Response(JSON.stringify({ success: true, currency, message: "Exchange rate saved to D1" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
