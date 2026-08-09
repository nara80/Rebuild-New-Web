// MildMate Admin API — Pricing Params management
// POST /api/admin/pricing-params  — upsert a param
// PUT  /api/admin/pricing-params  — same

import { verifyClerkJwt } from "./clerk-verify";

function collectRoles(raw: any): string[] {
  if (!raw || typeof raw !== "object") return [];
  const values: any[] = [];
  const add = (v: any) => { if (v !== undefined && v !== null) values.push(v); };

  add((raw as any).role);
  add((raw as any).roles);
  add((raw as any).org_role);
  add((raw as any).orgRole);
  add((raw as any).public_metadata?.role);
  add((raw as any).public_metadata?.roles);
  add((raw as any).unsafe_metadata?.roles);
  add((raw as any).metadata?.role);
  add((raw as any).metadata?.roles);
  add((raw as any)["https://mildmate.com/role"]);
  add((raw as any)["https://mildmate.com/roles"]);

  const out: string[] = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}

function hasAdminRole(raw: any): boolean {
  const roles = collectRoles(raw);
  return roles.some((r) =>
    r === "admin" ||
    r === "super-admin" ||
    r === "super_admin" ||
    r === "superadmin" ||
    r.endsWith(":admin") ||
    r.endsWith("/admin")
  );
}

function emailAllowed(email: string, env: any): boolean {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

function getPrimaryClerkEmail(user: any): string {
  if (!user || typeof user !== "object") return "";
  const list = Array.isArray(user.email_addresses) ? user.email_addresses : [];
  const primaryId = user.primary_email_address_id;
  const primary = list.find((e: any) => e && e.id === primaryId);
  return String(primary?.email_address || list[0]?.email_address || "").trim().toLowerCase();
}

async function isClerkAdmin(request: Request, env: any): Promise<boolean> {
  try {
    const authHeader = request.headers.get("Authorization") || "";
    const hasBearer = authHeader.startsWith("Bearer ");
    if (!hasBearer) return false;

    const verified = await verifyClerkJwt(request, env);
    if (!verified.valid) return false;

    const raw = verified.payload.raw || {};
    if (hasAdminRole(raw) || emailAllowed(verified.payload.email || "", env)) return true;

    const sub = String(verified.payload.sub || "").trim();
    const clerkKey = String(env.CLERK_SECRET_KEY || "").trim();
    if (!sub || !clerkKey) return false;

    const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
      headers: { Authorization: "Bearer " + clerkKey },
    });
    if (!clerkResp.ok) return false;

    const user = await clerkResp.json();
    const clerkEmail = getPrimaryClerkEmail(user);
    const metadataRaw = {
      role: user?.public_metadata?.role,
      roles: user?.public_metadata?.roles,
      org_role: user?.public_metadata?.org_role,
      orgRole: user?.public_metadata?.orgRole,
      public_metadata: user?.public_metadata || {},
      unsafe_metadata: user?.unsafe_metadata || {},
      metadata: user?.private_metadata || {},
    };
    return emailAllowed(clerkEmail, env) || hasAdminRole(metadataRaw);
  } catch {
    return false;
  }
}

function isProductionHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}

async function authorizeAdmin(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const clerkOk = await isClerkAdmin(request, env);
  if (clerkOk) return { ok: true };

  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }

  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

export async function handleAdminPricingParams(request: Request, env: any): Promise<Response> {
  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method === "GET") {
    try {
      const { results } = await env.DB.prepare(
        "SELECT key, value, label, category FROM pricing_params ORDER BY category, key"
      ).all();
      return new Response(JSON.stringify({ params: results || [] }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || "Failed to load pricing params" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (request.method === "POST" || request.method === "PUT") {
    try {
      const body: any = await request.json();
      const { key, value, label, category } = body;

      if (!key || value === undefined) {
        return new Response(JSON.stringify({ error: "key and value are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Upsert into D1
      await env.DB.prepare(
        `INSERT INTO pricing_params (key, value, label, category)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(key) DO UPDATE SET value = ?2, label = ?3, category = ?4, updated_at = datetime('now')`
      )
        .bind(key, value, label || key, category || "fixed")
        .run();

      return new Response(JSON.stringify({
        success: true,
        key,
        value,
        message: "Param saved to D1"
      }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // DELETE — remove a param
  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return new Response(JSON.stringify({ error: "?key= required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    await env.DB.prepare("DELETE FROM pricing_params WHERE key = ?1").bind(key).run();
    return new Response(JSON.stringify({ success: true, key, message: "Deleted from D1" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
