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

const KEY_MAP: Record<string, string> = {
  basketThreshold: "basket_threshold_usd",
  stage2Enabled: "stage2_enabled",
  stage2Discount: "stage2_discount",
  stage3Enabled: "stage3_enabled",
  stage3Discount: "stage3_discount",
  expiryDays: "discount_expiry_days",
  cronHour: "cron_hour_utc",
  thankyou: "thankyou_discount",
  thankyouHours: "thankyou_send_after_hours",
};

function toBoolString(v: any): string {
  return (v === true || String(v).toLowerCase() === "true") ? "true" : "false";
}

function normalizeOffersInput(input: any): Record<string, string> {
  const basketThreshold = Math.max(0, Math.min(10000, Number(input?.basketThreshold || 150)));
  const stage2Enabled = toBoolString(input?.stage2Enabled !== false);
  const stage2Discount = Math.max(1, Math.min(95, Number(input?.stage2Discount || 10)));
  const stage3Enabled = toBoolString(input?.stage3Enabled !== false);
  const stage3Discount = Math.max(1, Math.min(95, Number(input?.stage3Discount || 10)));
  const expiryDays = Math.max(1, Math.min(3650, Number(input?.expiryDays || 60)));
  const cronHour = Math.max(0, Math.min(23, Number(input?.cronHour || 10)));
  const thankyou = Math.max(1, Math.min(95, Number(input?.thankyou || 20)));
  const thankyouHours = Math.max(0, Math.min(720, Number(input?.thankyouHours || 1)));

  return {
    [KEY_MAP.basketThreshold]: String(Math.round(basketThreshold)),
    [KEY_MAP.stage2Enabled]: stage2Enabled,
    [KEY_MAP.stage2Discount]: String(Math.round(stage2Discount)),
    [KEY_MAP.stage3Enabled]: stage3Enabled,
    [KEY_MAP.stage3Discount]: String(Math.round(stage3Discount)),
    [KEY_MAP.expiryDays]: String(Math.round(expiryDays)),
    [KEY_MAP.cronHour]: String(Math.round(cronHour)),
    [KEY_MAP.thankyou]: String(Math.round(thankyou)),
    [KEY_MAP.thankyouHours]: String(Math.round(thankyouHours)),
  };
}

function parseOffersConfig(rows: any[]): any {
  const map: Record<string, string> = {};
  for (const row of rows || []) map[String(row.key)] = String(row.value);
  return {
    basketThreshold: Number(map[KEY_MAP.basketThreshold] || 150),
    stage2Enabled: map[KEY_MAP.stage2Enabled] !== "false",
    stage2Discount: Number(map[KEY_MAP.stage2Discount] || 10),
    stage3Enabled: map[KEY_MAP.stage3Enabled] !== "false",
    stage3Discount: Number(map[KEY_MAP.stage3Discount] || 10),
    expiryDays: Number(map[KEY_MAP.expiryDays] || 60),
    cronHour: Number(map[KEY_MAP.cronHour] || 10),
    thankyou: Number(map[KEY_MAP.thankyou] || 20),
    thankyouHours: Number(map[KEY_MAP.thankyouHours] || 1),
  };
}

export async function handleAdminOffers(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers });

  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers });

  if (request.method === "GET") {
    const keys = Object.values(KEY_MAP);
    const placeholders = keys.map((_, i) => `?${i + 1}`).join(",");
    const { results } = await env.DB.prepare(`SELECT key, value FROM recovery_config WHERE key IN (${placeholders})`).bind(...keys).all();
    return new Response(JSON.stringify({ offers: parseOffersConfig((results || []) as any[]) }), { headers });
  }

  if (request.method === "POST" || request.method === "PUT") {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }
    const normalized = normalizeOffersInput(body || {});
    for (const [key, value] of Object.entries(normalized)) {
      await env.DB.prepare("INSERT OR REPLACE INTO recovery_config (key, value) VALUES (?1, ?2)").bind(key, value).run();
    }
    const { results } = await env.DB.prepare(
      `SELECT key, value FROM recovery_config WHERE key IN (${Object.values(KEY_MAP).map((_, i) => `?${i + 1}`).join(",")})`
    ).bind(...Object.values(KEY_MAP)).all();
    return new Response(JSON.stringify({ ok: true, offers: parseOffersConfig((results || []) as any[]) }), { headers });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
