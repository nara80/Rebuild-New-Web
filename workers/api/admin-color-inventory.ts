// GET  /api/admin/color-inventory  — list all fabric+color stock status
// PUT  /api/admin/color-inventory  — bulk update stock flags

import { verifyClerkJwt } from "./clerk-verify";

function isProductionHost(hostname: string): boolean {
  const h = String(hostname || "").toLowerCase();
  return h === "www.mildmate.com" || h === "mildmate.com" || h.endsWith(".mildmate.com");
}

function emailAllowed(email: string, env: any): boolean {
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
  return !!email && allow.includes(email.toLowerCase());
}

async function authorizeAdmin(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const hostname = request.headers.get("Host") || "";
  const isProd = isProductionHost(hostname);
  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const verified = await verifyClerkJwt(request, env);
    if (!verified.valid) return { ok: false, status: (verified as any).status || 401, error: "Unauthorized" };
    return { ok: true };
  }
  if (isProd) {
    const secret = (request.headers.get("X-Admin-Secret") || "").trim();
    const expected = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
    if (!secret || !expected || secret !== expected) return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}

export async function handleAdminColorInventory(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { ...headers, "Access-Control-Allow-Methods": "GET, PUT, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }

  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers });

  const db = env.DB;

  if (request.method === "GET") {
    const rows = await db.prepare(
      "SELECT fabric, color, in_stock, updated_at FROM fabric_color_inventory ORDER BY fabric, color"
    ).all() as any;
    return new Response(JSON.stringify({ inventory: rows.results || [] }), { headers });
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
      await db.prepare(
        `INSERT INTO fabric_color_inventory (fabric, color, in_stock, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(fabric, color) DO UPDATE SET in_stock = excluded.in_stock, updated_at = excluded.updated_at`
      ).bind(String(item.fabric), String(item.color), item.in_stock ? 1 : 0).run();
    }

    return new Response(JSON.stringify({ success: true, updated: body.updates.length }), { headers });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
