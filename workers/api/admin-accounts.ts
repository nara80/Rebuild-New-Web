import { verifyClerkJwt } from "./clerk-verify";

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

async function ensureAdminAccountsTable(db: any): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_accounts (
      email TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'Admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_active TEXT
    )
  `).run();
}

export async function handleAdminAccounts(request: Request, env: any): Promise<Response> {
  const host = new URL(request.url).hostname;
  const isDev = host.includes("pages.dev") || host === "localhost" || host.startsWith("127.0.0.1");

  if (!isDev) {
    const clerkOk = await isClerkAdmin(request, env);
    if (!clerkOk) {
      const provided = (request.headers.get("X-Admin-Secret") || "").trim();
      const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
      if (!provided || (configured && provided !== configured)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  await ensureAdminAccountsTable(env.DB);

  if (request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT email, role, created_at, last_active FROM admin_accounts ORDER BY created_at DESC"
    ).all();
    return new Response(JSON.stringify({ accounts: results || [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method === "POST") {
    try {
      const body: any = await request.json();
      const email = String(body.email || "").trim().toLowerCase();
      const role = String(body.role || "Admin").trim();
      if (!email || !email.includes("@")) {
        return new Response(JSON.stringify({ error: "Valid email is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (role !== "Admin" && role !== "Super Admin") {
        return new Response(JSON.stringify({ error: "Role must be Admin or Super Admin" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      await env.DB.prepare(
        `INSERT INTO admin_accounts (email, role, created_at, last_active)
         VALUES (?1, ?2, datetime('now'), NULL)
         ON CONFLICT(email) DO UPDATE SET role = excluded.role`
      ).bind(email, role).run();

      return new Response(JSON.stringify({ success: true, email, role }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || "Failed to save admin account" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (request.method === "DELETE") {
    try {
      const url = new URL(request.url);
      const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
      if (!email) {
        return new Response(JSON.stringify({ error: "email is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      await env.DB.prepare("DELETE FROM admin_accounts WHERE email = ?1").bind(email).run();
      return new Response(JSON.stringify({ success: true, email }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || "Failed to delete admin account" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
