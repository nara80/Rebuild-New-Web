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

function normalizeProductSlugs(input: any): string[] {
  const raw = Array.isArray(input) ? input : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    const slug = String(v || "").trim();
    if (!slug) continue;
    const key = slug.toLowerCase();
    if (key === "all" || key === "*") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(slug);
  }
  return out;
}

function parseIsoDate(value: any): number {
  const ts = new Date(String(value || "").trim()).getTime();
  return Number.isFinite(ts) ? ts : NaN;
}

async function getActiveListings(env: any): Promise<any[]> {
  const { results } = await env.DB.prepare(
    "SELECT slug, title_en, image_url, base_price_usd, base_price_thb, category, product_type, is_active FROM products WHERE slug IS NOT NULL AND slug != '' AND COALESCE(is_active, 1) = 1 ORDER BY COALESCE(sort_order, 9999), title_en"
  ).all();
  return ((results || []) as any[]).map((r: any) => ({
    slug: r.slug,
    title_en: r.title_en || r.slug,
    image_url: r.image_url || "",
    base_price_usd: Number(r.base_price_usd || 0),
    base_price_thb: Number(r.base_price_thb || 0),
    category: r.category || "",
    product_type: r.product_type || "",
    is_active: Number(r.is_active || 1) === 1,
  }));
}

async function validateCampaignPayload(body: any, env: any, requireId = false): Promise<{ ok: true; normalized: any } | { ok: false; error: string }> {
  const id = String(body?.id || "").trim();
  const name = String(body?.name || "").trim();
  const discountRaw = Number(body?.discount);
  const discount = Math.round(discountRaw);
  const startDateRaw = String(body?.startDate || "").trim();
  const endDateRaw = String(body?.endDate || "").trim();
  const productSlugs = normalizeProductSlugs(body?.productSlugs);

  if (requireId && !id) return { ok: false, error: "Campaign id is required" };
  if (!name || name.length < 3 || name.length > 80) return { ok: false, error: "Campaign name must be 3-80 characters" };
  if (!Number.isFinite(discountRaw) || !Number.isInteger(discountRaw) || discount < 1 || discount > 90) {
    return { ok: false, error: "Discount must be an integer between 1 and 90" };
  }
  if (!startDateRaw || !endDateRaw) return { ok: false, error: "Start/end dates are required" };
  const startTs = parseIsoDate(startDateRaw);
  const endTs = parseIsoDate(endDateRaw);
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return { ok: false, error: "Invalid date format" };
  if (endTs <= startTs) return { ok: false, error: "End date must be after start date" };
  if (!productSlugs.length) return { ok: false, error: "At least one product is required" };
  const maybeAll = (Array.isArray(body?.productSlugs) ? body.productSlugs : []).some((v: any) => String(v || "").trim().toLowerCase() === "all");
  if (maybeAll) return { ok: false, error: "\"All listings\" is not allowed. Select specific listings." };

  const placeholders = productSlugs.map((_, i) => `?${i + 1}`).join(", ");
  const found = await env.DB.prepare(
    `SELECT slug FROM products WHERE COALESCE(is_active, 1) = 1 AND slug IN (${placeholders})`
  ).bind(...productSlugs).all();
  const foundSet = new Set(((found.results || []) as any[]).map((r: any) => String(r.slug || "")));
  const invalid = productSlugs.filter((slug) => !foundSet.has(slug));
  if (invalid.length) return { ok: false, error: "Invalid or inactive product slugs: " + invalid.join(", ") };

  return {
    ok: true,
    normalized: {
      id,
      name,
      discount,
      productSlugs,
      startDate: new Date(startTs).toISOString(),
      endDate: new Date(endTs).toISOString(),
    }
  };
}

export async function handleAdminCampaigns(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers });

  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers });
  await ensureCampaignsSchema(env);
  const url = new URL(request.url);

  if (request.method === "GET") {
    if (url.searchParams.get("mode") === "listings") {
      const listings = await getActiveListings(env);
      return new Response(JSON.stringify({ products: listings }), { headers });
    }
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
    const valid = await validateCampaignPayload(body, env, false);
    if (!valid.ok) return new Response(JSON.stringify({ error: valid.error }), { status: 400, headers });
    const payload = valid.normalized;

    const id = String(body?.id || ("camp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8)));
    await env.DB.prepare(
      "INSERT INTO marketing_campaigns (id, name, discount_pct, product_slugs, start_date, end_date, is_active) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)"
    ).bind(id, payload.name, payload.discount, JSON.stringify(payload.productSlugs), payload.startDate, payload.endDate).run();
    return new Response(JSON.stringify({ ok: true, id }), { headers });
  }

  if (request.method === "PUT") {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }
    const valid = await validateCampaignPayload(body, env, true);
    if (!valid.ok) return new Response(JSON.stringify({ error: valid.error }), { status: 400, headers });
    const payload = valid.normalized;
    const updated = await env.DB.prepare(
      "UPDATE marketing_campaigns SET name = ?1, discount_pct = ?2, product_slugs = ?3, start_date = ?4, end_date = ?5 WHERE id = ?6"
    ).bind(payload.name, payload.discount, JSON.stringify(payload.productSlugs), payload.startDate, payload.endDate, payload.id).run();
    const changes = Number((updated as any)?.meta?.changes || 0);
    if (!changes) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers });
    return new Response(JSON.stringify({ ok: true, id: payload.id }), { headers });
  }

  if (request.method === "DELETE") {
    let id = "";
    try {
      const body = await request.json() as any;
      id = String(body?.id || "").trim();
    } catch {}
    if (!id) id = String(url.searchParams.get("id") || "").trim();
    if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers });
    await env.DB.prepare("DELETE FROM marketing_campaigns WHERE id = ?1").bind(id).run();
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
