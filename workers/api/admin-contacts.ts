// MildMate Admin Contacts API
// GET  /api/admin/contacts       — list all contacts (with optional ?subscribed=1 filter)
// GET  /api/admin/contacts/:id   — single contact with order history
// PUT  /api/admin/contacts/:id   — update contact (unsubscribe, name, etc.)
//
// Auth: same as admin-orders (Clerk Bearer token or X-Admin-Secret)

import { verifyClerkJwt } from "./clerk-verify";

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function collectRoles(raw: any): string[] {
  if (!raw || typeof raw !== "object") return [];
  const values: any[] = [];
  const add = (v: any) => { if (v !== undefined && v !== null) values.push(v); };
  add(raw.role); add(raw.roles); add(raw.org_role); add(raw.orgRole);
  add(raw.public_metadata?.role); add(raw.public_metadata?.roles);
  add(raw.unsafe_metadata?.role); add(raw.unsafe_metadata?.roles);
  add(raw.metadata?.role); add(raw.metadata?.roles);
  add(raw["https://mildmate.com/role"]); add(raw["https://mildmate.com/roles"]);
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
    r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" ||
    r.endsWith(":admin") || r.endsWith("/admin")
  );
}

function emailAllowed(email: string, env: any): boolean {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}

function isProductionHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}

async function authorizeAdmin(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");

  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole(raw) || emailAllowed(verified.payload.email || "", env)) return { ok: true };
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = (await clerkResp.json()) as any;
            const email = user.email_addresses?.find((e: any) => e.id === user.primary_email_address_id)?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed(email, env)) return { ok: true };
            if (hasAdminRole(metadata)) return { ok: true };
          }
        } catch(e) { /* fall through */ }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
    // fall through to secret
  }

  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) return { ok: false, status: 401, error: "Unauthorized" };
  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

function escHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function handleAdminContacts(request: Request, env: any): Promise<Response> {
  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const url = new URL(request.url);
  const method = request.method;
  const db = env.DB;

  // GET /api/admin/contacts — list all contacts
  if (method === "GET") {
    const onlySubscribed = url.searchParams.get("subscribed") === "1";
    const sortBy = url.searchParams.get("sort") || "last_seen";
    const page = parseInt(url.searchParams.get("page") || "1");

    let query = "SELECT id, email, name, phone, sources, is_subscribed, language, first_seen, last_seen FROM contacts";
    if (onlySubscribed) query += " WHERE is_subscribed = 1";
    query += " ORDER BY " + (sortBy === "first_seen" ? "first_seen" : sortBy === "email" ? "email" : "last_seen") + " DESC";
    query += " LIMIT 50 OFFSET " + ((page - 1) * 50);

    const { results } = await db.prepare(query).all();
    const totalRow = await db.prepare(
      "SELECT COUNT(*) as cnt FROM contacts" + (onlySubscribed ? " WHERE is_subscribed = 1" : "")
    ).first();

    return json({
      contacts: results,
      total: totalRow?.cnt || 0,
      page,
      filter: onlySubscribed ? "subscribed" : "all",
    });
  }

  // PUT /api/admin/contacts — update (unsubscribe, name, etc.)
  if (method === "PUT") {
    let body: any;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const email = (body.email || "").trim().toLowerCase();
    if (!email) return json({ error: "Email required" }, 400);

    if (body.unsubscribe !== undefined && body.unsubscribe) {
      await db.prepare("UPDATE contacts SET is_subscribed = 0, sources = TRIM(REPLACE(REPLACE(REPLACE(sources, ',subscribe', ''), 'subscribe,', ''), 'subscribe', ''), ','), last_seen = datetime('now') WHERE email = ?").bind(email).run();
      return json({ success: true, message: "Unsubscribed" });
    }

    if (body.name) {
      await db.prepare("UPDATE contacts SET name = ?, last_seen = datetime('now') WHERE email = ?").bind(body.name, email).run();
      return json({ success: true });
    }

    return json({ error: "No valid update field" }, 400);
  }

  return json({ error: "Method not allowed" }, 405);
}
