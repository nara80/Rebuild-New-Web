// MildMate Admin API — Exchange Rates management
// POST /api/admin/exchange-rates  — upsert a rate
// PUT  /api/admin/exchange-rates  — same

function isProductionHost(host: string): boolean {
  return host === "www.mildmate.com" || host === "mildmate.com";
}

function isDevHost(host: string): boolean {
  return host.includes("pages.dev") || host === "localhost" || host.startsWith("127.0.0.1");
}

function authorizeAdmin(request: Request, env: any): { ok: boolean; status?: number; error?: string } {
  const host = new URL(request.url).hostname;
  if (isDevHost(host)) return { ok: true };
  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const prodHost = isProductionHost(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }
  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

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

  const auth = authorizeAdmin(request, env);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error || "Unauthorized" }), {
      status: auth.status || 401,
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
