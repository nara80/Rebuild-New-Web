// MildMate Admin API — DIY Prices management
// POST   /api/admin/diy-prices  — upsert (id or product_slug+shape_code)
// PUT    /api/admin/diy-prices  — same
// DELETE /api/admin/diy-prices  — ?id= or ?product=&shape_code=

export async function handleAdminDiyPrices(request: Request, env: any): Promise<Response> {
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
      const { id, product_slug, shape_code, size_key, price_thb, price_usd, label } = body;

      if (!product_slug || price_thb === undefined || price_usd === undefined) {
        return new Response(JSON.stringify({ error: "product_slug, price_thb, price_usd are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Upsert: prefer id if given, else insert new with conflict on (product_slug, shape_code, size_key)
      await env.DB.prepare(
        `INSERT INTO diy_prices (id, product_slug, shape_code, size_key, price_thb, price_usd, label, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           product_slug = ?2, shape_code = ?3, size_key = ?4,
           price_thb = ?5, price_usd = ?6, label = ?7, updated_at = datetime('now')`
      )
        .bind(id || null, product_slug, shape_code || null, size_key || null, price_thb, price_usd, label || null)
        .run();

      return new Response(JSON.stringify({ success: true, product_slug, shape_code, message: "DIY price saved to D1" }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const product = url.searchParams.get("product");
    const shape = url.searchParams.get("shape_code");
    if (id) {
      await env.DB.prepare("DELETE FROM diy_prices WHERE id = ?1").bind(id).run();
    } else if (product && shape) {
      await env.DB.prepare("DELETE FROM diy_prices WHERE product_slug = ?1 AND shape_code = ?2").bind(product, shape).run();
    } else {
      return new Response(JSON.stringify({ error: "?id= or ?product=&shape_code= required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true, message: "Deleted from D1" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
