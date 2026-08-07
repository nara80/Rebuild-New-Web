type BoatModelRow = {
  id: number;
  model_key: string;
  model_name: string;
  shape_code: string;
  dimensions_json: string;
  notes?: string | null;
  is_active: number;
  updated_at?: string | null;
};

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

function parseDimensions(raw: string): Record<string, number> {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) continue;
      out[String(k).toUpperCase()] = Math.round(n * 100) / 100;
    }
    return out;
  } catch {
    return {};
  }
}

export async function handleBoatModels(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=120",
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { ...headers, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
  }
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    await ensureBoatModelsTable(env);
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 250);

    let sql = `
      SELECT id, model_key, model_name, shape_code, dimensions_json, notes, is_active, updated_at
      FROM boat_models
      WHERE is_active = 1
    `;
    let stmt: any;
    if (q) {
      sql += " AND (lower(model_name) LIKE ?1 OR lower(model_key) LIKE ?1) ORDER BY model_name ASC LIMIT ?2";
      stmt = env.DB.prepare(sql).bind(`%${q}%`, limit);
    } else {
      sql += " ORDER BY model_name ASC LIMIT ?1";
      stmt = env.DB.prepare(sql).bind(limit);
    }
    const rows = await stmt.all() as any;
    const models = (rows.results || []).map((r: BoatModelRow) => ({
      id: r.id,
      model_key: r.model_key,
      model_name: r.model_name,
      shape_code: r.shape_code,
      dimensions: parseDimensions(r.dimensions_json),
      notes: r.notes || "",
      updated_at: r.updated_at || null,
    }));
    return new Response(JSON.stringify({ models }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ models: [], error: e?.message || "Failed to load boat models" }), { status: 500, headers });
  }
}
