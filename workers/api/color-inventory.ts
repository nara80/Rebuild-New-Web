// GET /api/color-inventory
// Public endpoint — returns all fabric+color stock status
// Called by product-configurator.js on page load

export async function handleColorInventory(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=60",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { ...headers, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
  }

  try {
    const rows = await env.DB.prepare(
      "SELECT fabric, color, in_stock FROM fabric_color_inventory ORDER BY fabric, color"
    ).all() as any;

    return new Response(JSON.stringify({ inventory: rows.results || [] }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ inventory: [] }), { headers });
  }
}
