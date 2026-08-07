import { verifyClerkJwt } from "./clerk-verify";

function isProductionHost(hostname: string): boolean {
  const h = String(hostname || "").toLowerCase();
  return h === "www.mildmate.com" || h === "mildmate.com" || h.endsWith(".mildmate.com");
}

function hasAdminRole(raw: any): boolean {
  if (!raw) return false;
  const candidates: any[] = [];
  if (raw.role) candidates.push(raw.role);
  if (raw.roles) candidates.push(raw.roles);
  if (raw.public_metadata?.role) candidates.push(raw.public_metadata.role);
  if (raw.publicMetadata?.role) candidates.push(raw.publicMetadata.role);
  if (raw.metadata?.role) candidates.push(raw.metadata.role);
  if (raw.organization_role) candidates.push(raw.organization_role);
  if (raw.org_role) candidates.push(raw.org_role);
  const flat: string[] = [];
  for (const c of candidates) {
    if (Array.isArray(c)) flat.push(...c.map(String));
    else if (typeof c === "string") flat.push(c);
  }
  return flat.some((v) => {
    const r = String(v).toLowerCase();
    return r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin");
  });
}

function emailAllowed(email: string, env: any): boolean {
  const allow = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!email && allow.includes(email.toLowerCase());
}

function normalizeModelKey(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sanitizeDimensions(raw: any): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, val] of Object.entries(raw)) {
    const k = String(key || "").trim().toUpperCase();
    if (!k) continue;
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) continue;
    out[k] = Math.round(n * 100) / 100;
  }
  return out;
}

async function ensureBoatModelsTable(env: any): Promise<void> {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS boat_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_key TEXT NOT NULL UNIQUE,
      model_name TEXT NOT NULL,
      shape_code TEXT NOT NULL,
      dimensions_json TEXT NOT NULL,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function authorizeAdmin(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const hostname = request.headers.get("Host") || "";
  if (!isProductionHost(hostname)) return { ok: true };

  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const verified = await verifyClerkJwt(request, env);
    if (!verified.valid) return { ok: false, status: verified.status, error: verified.error };
    const raw = (verified as any).payload?.raw || {};
    if (hasAdminRole(raw)) return { ok: true };
    const jwtEmail = String(raw.email || (verified as any).payload?.email || "").trim().toLowerCase();
    if (emailAllowed(jwtEmail, env)) return { ok: true };
    return { ok: false, status: 403, error: "Forbidden: admin role required" };
  }

  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const expectedSecret = String(env.ADMIN_SECRET || "").trim();
  if (providedSecret && expectedSecret && providedSecret === expectedSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

export async function handleAdminBoatModels(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret, Authorization",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers });

  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers });

  await ensureBoatModelsTable(env);

  if (request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT id, model_key, model_name, shape_code, dimensions_json, notes, is_active, updated_at
       FROM boat_models
       ORDER BY updated_at DESC, id DESC`
    ).all() as any;
    return new Response(JSON.stringify({ models: rows.results || [] }), { headers });
  }

  if (request.method === "DELETE") {
    let body: any = {};
    try { body = await request.json(); } catch {}
    const id = Number(body.id || 0);
    if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers });
    await env.DB.prepare("DELETE FROM boat_models WHERE id = ?1").bind(id).run();
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  if (request.method === "POST" || request.method === "PUT") {
    let body: any;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }

    const id = Number(body.id || 0);
    const modelName = String(body.model_name || "").trim();
    const shapeCode = String(body.shape_code || "").trim();
    const notes = String(body.notes || "").trim();
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    const dimensions = sanitizeDimensions(body.dimensions || {});
    const modelKey = normalizeModelKey(body.model_key || modelName);

    if (!modelName) return new Response(JSON.stringify({ error: "model_name is required" }), { status: 400, headers });
    if (!modelKey) return new Response(JSON.stringify({ error: "model_key is required" }), { status: 400, headers });
    if (!/^(0[1-9]|1[0-4])$/.test(shapeCode)) {
      return new Response(JSON.stringify({ error: "shape_code must be 01-14" }), { status: 400, headers });
    }
    if (!Object.keys(dimensions).length) {
      return new Response(JSON.stringify({ error: "dimensions are required" }), { status: 400, headers });
    }
    const dimensionsJson = JSON.stringify(dimensions);

    if (id > 0) {
      await env.DB.prepare(
        `UPDATE boat_models
         SET model_key = ?1, model_name = ?2, shape_code = ?3, dimensions_json = ?4, notes = ?5, is_active = ?6, updated_at = datetime('now')
         WHERE id = ?7`
      ).bind(modelKey, modelName, shapeCode, dimensionsJson, notes || null, isActive, id).run();
      return new Response(JSON.stringify({ success: true, id }), { headers });
    }

    const existing = await env.DB.prepare("SELECT id FROM boat_models WHERE model_key = ?1").bind(modelKey).first() as any;
    if (existing?.id) {
      return new Response(JSON.stringify({ error: "model_key already exists. Use a unique key." }), { status: 409, headers });
    }

    const insert = await env.DB.prepare(
      `INSERT INTO boat_models (model_key, model_name, shape_code, dimensions_json, notes, is_active, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))`
    ).bind(modelKey, modelName, shapeCode, dimensionsJson, notes || null, isActive).run();
    return new Response(JSON.stringify({ success: true, id: insert.meta?.last_row_id || null }), { headers });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
