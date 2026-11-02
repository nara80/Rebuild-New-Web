// GET  /api/admin/color-inventory  — list all fabric+color stock status
// PUT  /api/admin/color-inventory  — bulk update stock flags

import { authorizeAdminBrowser } from "./admin-auth";

export async function handleAdminColorInventory(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { ...headers, "Access-Control-Allow-Methods": "GET, PUT, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret" } });
  }

  const auth = await authorizeAdminBrowser(request, env);
  if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers });

  const db = env.DB;

  if (request.method === "GET") {
    const rows = await db.prepare(
      "SELECT fabric, color, in_stock, updated_at FROM fabric_color_inventory ORDER BY fabric, color"
    ).all() as any;
    const inventory = (rows.results || []).map((r: any) => ({
      fabric: String(r.fabric || "").trim().toLowerCase(),
      color: String(r.color || "").trim().toLowerCase(),
      in_stock: Number(r.in_stock) === 1 ? 1 : 0,
      updated_at: r.updated_at || null,
    }));
    return new Response(JSON.stringify({ inventory }), { headers });
  }

  if (request.method === "PUT") {
    let body: { updates: { fabric: string; color: string; in_stock: number }[] };
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }

    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      return new Response(JSON.stringify({ error: "updates array required" }), { status: 400, headers });
    }

    for (const item of body.updates) {
      const fabric = String(item.fabric || "").trim().toLowerCase();
      const color = String(item.color || "").trim().toLowerCase();
      const inStockRaw = item.in_stock;
      const inStock = inStockRaw === 1 || inStockRaw === true || String(inStockRaw).trim() === "1" ? 1 : 0;
      if (!fabric || !color) {
        return new Response(JSON.stringify({ error: "fabric and color are required" }), { status: 400, headers });
      }
      await db.prepare(
        `INSERT INTO fabric_color_inventory (fabric, color, in_stock, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(fabric, color) DO UPDATE SET in_stock = excluded.in_stock, updated_at = excluded.updated_at`
      ).bind(fabric, color, inStock).run();
    }

    return new Response(JSON.stringify({ success: true, updated: body.updates.length }), { headers });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
