type BoatModelRow = {
  id: number;
  model_key: string;
  model_label?: string | null;
  model_name: string;
  model_year?: number | null;
  sale_price_usd?: number | null;
  shape_code: string;
  updated_at?: string | null;
};

async function ensureBoatModelsColumn(env: any, name: string, def: string): Promise<void> {
  try {
    await env.DB.prepare(`ALTER TABLE boat_models ADD COLUMN ${name} ${def}`).run();
  } catch (e: any) {
    const msg = String(e?.message || "").toLowerCase();
    if (!msg.includes("duplicate column")) throw e;
  }
}

async function ensureBoatModelsTable(env: any): Promise<void> {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS boat_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_key TEXT NOT NULL UNIQUE,
      model_label TEXT,
      model_name TEXT NOT NULL,
      model_year INTEGER,
      sale_price_usd REAL,
      shape_code TEXT NOT NULL,
      dimensions_json TEXT NOT NULL,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await ensureBoatModelsColumn(env, "model_label", "TEXT");
  await ensureBoatModelsColumn(env, "model_year", "INTEGER");
  await ensureBoatModelsColumn(env, "sale_price_usd", "REAL");
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
      SELECT id, model_key, model_label, model_name, model_year, sale_price_usd, shape_code, updated_at
      FROM boat_models
      WHERE is_active = 1
        AND model_year IS NOT NULL
        AND sale_price_usd IS NOT NULL
        AND sale_price_usd > 0
    `;
    let stmt: any;
    if (q) {
      sql += " AND (lower(model_label) LIKE ?1 OR lower(model_name) LIKE ?1 OR lower(model_key) LIKE ?1 OR CAST(model_year AS TEXT) LIKE ?1) ORDER BY model_label ASC, model_name ASC, model_year ASC LIMIT ?2";
      stmt = env.DB.prepare(sql).bind(`%${q}%`, limit);
    } else {
      sql += " ORDER BY model_label ASC, model_name ASC, model_year ASC LIMIT ?1";
      stmt = env.DB.prepare(sql).bind(limit);
    }
    const rows = await stmt.all() as any;
    const models = (rows.results || []).map((r: BoatModelRow) => ({
      id: r.id,
      model_key: r.model_key,
      model_label: (r.model_label && String(r.model_label).trim()) || `${r.model_name || ""}${r.model_year ? " - " + r.model_year : ""}`.trim(),
      model_name: r.model_name,
      model_year: r.model_year == null ? null : Number(r.model_year),
      price_usd: r.sale_price_usd == null ? null : Math.round(Number(r.sale_price_usd) * 100) / 100,
      shape_code: r.shape_code,
      updated_at: r.updated_at || null,
    }));
    return new Response(JSON.stringify({ models }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ models: [], error: e?.message || "Failed to load boat models" }), { status: 500, headers });
  }
}
