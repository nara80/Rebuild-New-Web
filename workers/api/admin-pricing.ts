// MildMate Admin API — Pricing Params management
// POST /api/admin/pricing-params  — upsert a param
// PUT  /api/admin/pricing-params  — same

interface ParamRow {
  key: string;
  value: number;
  label: string;
  category: string;
}

export async function handleAdminPricingParams(request: Request, env: any): Promise<Response> {
  // Dev bypass: pages.dev and localhost skip auth entirely
  const host = new URL(request.url).hostname;
  const isDev = host.includes("pages.dev") || host === "localhost" || host.startsWith("127.0.0.1");

  if (!isDev) {
    const provided = (request.headers.get("X-Admin-Secret") || "").trim();
    const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!provided) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Dev bypass: if ADMIN_SECRET not set in Cloudflare, allow any non-empty secret from browser
  if (configured && provided !== configured) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  } // end isDev

  if (request.method === "POST" || request.method === "PUT") {
    try {
      const body: any = await request.json();
      const { key, value, label, category } = body;

      if (!key || value === undefined) {
        return new Response(JSON.stringify({ error: "key and value are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Upsert into D1
      await env.DB.prepare(
        `INSERT INTO pricing_params (key, value, label, category)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(key) DO UPDATE SET value = ?2, label = ?3, category = ?4, updated_at = datetime('now')`
      )
        .bind(key, value, label || key, category || "fixed")
        .run();

      return new Response(JSON.stringify({
        success: true,
        key,
        value,
        message: "Param saved to D1"
      }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // DELETE — remove a param
  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return new Response(JSON.stringify({ error: "?key= required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    await env.DB.prepare("DELETE FROM pricing_params WHERE key = ?1").bind(key).run();
    return new Response(JSON.stringify({ success: true, key, message: "Deleted from D1" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
