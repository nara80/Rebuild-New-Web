async function ensureCampaignsSchema(env: any): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS marketing_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      discount_pct INTEGER NOT NULL,
      product_slugs TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
}

export async function handleCampaigns(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  await ensureCampaignsSchema(env);

  const { results } = await env.DB.prepare(
    "SELECT id, name, discount_pct, product_slugs, start_date, end_date FROM marketing_campaigns WHERE is_active = 1 AND datetime(start_date) <= datetime('now') AND datetime(end_date) >= datetime('now') ORDER BY discount_pct DESC, created_at DESC"
  ).all();

  const campaigns = ((results || []) as any[]).map((r: any) => ({
    id: r.id,
    name: r.name,
    discount: Number(r.discount_pct || 0),
    productSlugs: (() => { try { return JSON.parse(r.product_slugs || "[]"); } catch { return []; } })(),
    startDate: r.start_date,
    endDate: r.end_date,
    isActive: true,
  }));

  return new Response(JSON.stringify({ campaigns }), { headers });
}
