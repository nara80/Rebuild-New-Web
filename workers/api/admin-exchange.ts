// MildMate Admin API — Exchange Rates management
// POST /api/admin/exchange-rates  — upsert a rate
// PUT  /api/admin/exchange-rates  — same

export async function handleAdminExchangeRates(request: Request, env: any): Promise<Response> {
  const provided = (request.headers.get("X-Admin-Secret") || "").trim();
  const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!provided) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (configured && provided !== configured) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method === "POST" || request.method === "PUT") {
    try {
      const body: any = await request.json();
      const { currency, rate_per_thb, label, symbol } = body;

      if (!currency || rate_per_thb === undefined) {
        return new Response(JSON.stringify({ error: "currency and rate_per_thb are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
