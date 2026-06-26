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
    const sub = String((verified as any).payload?.sub || "").trim();
    const clerkKey = String(env.CLERK_SECRET_KEY || "").trim();
    if (sub && clerkKey) {
      try {
        const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
          headers: { Authorization: "Bearer " + clerkKey }
        });
        if (clerkResp.ok) {
          const user = await clerkResp.json() as any;
          const email = user.email_addresses?.find((e: any) => e.id === user.primary_email_address_id)?.email_address || "";
          const metadata = user.public_metadata || {};
          if (emailAllowed(email, env) || hasAdminRole(metadata)) return { ok: true };
        }
      } catch {}
    }
    return { ok: false, status: 403, error: "Forbidden: admin role required" };
  }

  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const expectedSecret = String(env.ADMIN_SECRET || "").trim();
  if (providedSecret && expectedSecret && providedSecret === expectedSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

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

export async function handleAdminCampaigns(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers });

  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers });
  await ensureCampaignsSchema(env);

  if (request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT id, name, discount_pct, product_slugs, start_date, end_date, is_active, created_at FROM marketing_campaigns ORDER BY created_at DESC"
    ).all();
    const campaigns = ((results || []) as any[]).map((r: any) => ({
      id: r.id,
      name: r.name,
      discount: Number(r.discount_pct || 0),
      productSlugs: (() => { try { return JSON.parse(r.product_slugs || "[]"); } catch { return []; } })(),
      startDate: r.start_date,
      endDate: r.end_date,
      isActive: Number(r.is_active || 1) === 1,
      createdAt: r.created_at,
    }));
    return new Response(JSON.stringify({ campaigns }), { headers });
  }

  if (request.method === "POST") {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }
    const name = String(body?.name || "").trim();
    const discount = Math.max(1, Math.min(90, Number(body?.discount || 15)));
    const startDate = String(body?.startDate || "").trim();
    const endDate = String(body?.endDate || "").trim();
    const productSlugs = Array.isArray(body?.productSlugs) ? body.productSlugs.map((s: any) => String(s || "").trim()).filter(Boolean) : [];
    if (!name) return new Response(JSON.stringify({ error: "Campaign name is required" }), { status: 400, headers });
    if (!startDate || !endDate) return new Response(JSON.stringify({ error: "Start/end dates are required" }), { status: 400, headers });
    if (!productSlugs.length) return new Response(JSON.stringify({ error: "At least one product is required" }), { status: 400, headers });

    const id = String(body?.id || ("camp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8)));
    await env.DB.prepare(
      "INSERT INTO marketing_campaigns (id, name, discount_pct, product_slugs, start_date, end_date, is_active) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)"
    ).bind(id, name, Math.round(discount), JSON.stringify(productSlugs), startDate, endDate).run();
    return new Response(JSON.stringify({ ok: true, id }), { headers });
  }

  if (request.method === "DELETE") {
    let id = "";
    try {
      const body = await request.json() as any;
      id = String(body?.id || "").trim();
    } catch {}
    if (!id) id = String(new URL(request.url).searchParams.get("id") || "").trim();
    if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers });
    await env.DB.prepare("DELETE FROM marketing_campaigns WHERE id = ?1").bind(id).run();
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
