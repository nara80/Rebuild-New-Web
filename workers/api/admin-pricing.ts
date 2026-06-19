// MildMate Admin API — Pricing Params management
// POST /api/admin/pricing-params  — upsert a param
// PUT  /api/admin/pricing-params  — same

import { verifyClerkJwt } from "./clerk-verify";

interface ParamRow {
  key: string;
  value: number;
  label: string;
  category: string;
}

function getClerkSessionToken(request: Request): string {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookieMatch =
    cookieHeader.match(/__session=([^;]+)/) ||
    cookieHeader.match(/__clerk_db_jwt=([^;]+)/);
  return cookieMatch ? cookieMatch[1] : "";
}

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
    const token = hasBearer ? authHeader.slice(7).trim() : getClerkSessionToken(request);
    if (!token) return false;

    const verifyReq = new Request(request.url, {
      method: request.method,
      headers: new Headers({
        ...Object.fromEntries(request.headers.entries()),
        Authorization: `Bearer ${token}`,
      }),
    });
    const verified = await verifyClerkJwt(verifyReq, env);
    if (!verified.valid) return false;

    const raw = verified.payload.raw || {};
    const email = String(verified.payload.email || "").trim().toLowerCase();
    if (hasAdminRole(raw) || emailAllowed(email, env)) return true;

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

export async function handleAdminPricingParams(request: Request, env: any): Promise<Response> {
  // Dev bypass: pages.dev and localhost skip auth entirely
  const host = new URL(request.url).hostname;
  const isDev = host.includes("pages.dev") || host === "localhost" || host.startsWith("127.0.0.1");

  if (!isDev) {
    const clerkOk = await isClerkAdmin(request, env);
    if (!clerkOk) {
    const provided = (request.headers.get("X-Admin-Secret") || "").trim();
    const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
      if (!provided) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      // If ADMIN_SECRET is not set in Cloudflare, allow any non-empty secret from browser
      if (configured && provided !== configured) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  } // end isDev

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
