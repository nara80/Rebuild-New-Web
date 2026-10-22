// Shared admin authorization for all /api/admin/* endpoints.
// AND logic: requires BOTH admin role claim AND email in ADMIN_EMAILS.
// This is the strictest model — no single condition alone grants access.
//
// Migration: each admin-* handler should import { authorizeAdmin } from "./admin-auth"
// and remove its local hasAdminRole / emailAllowed / authorizeAdmin copies.

import { verifyClerkJwt } from "./clerk-verify";

// ── Role extraction ──

export function collectRoles(raw: any): string[] {
  if (!raw || typeof raw !== "object") return [];
  const values: any[] = [];
  const add = (v: any) => { if (v !== undefined && v !== null) values.push(v); };
  add(raw.role);
  add(raw.roles);
  add(raw.org_role);
  add(raw.orgRole);
  add(raw.public_metadata?.role);
  add(raw.public_metadata?.roles);
  add(raw.unsafe_metadata?.role);
  add(raw.unsafe_metadata?.roles);
  add(raw.metadata?.role);
  add(raw.metadata?.roles);
  add(raw["https://mildmate.com/role"]);
  add(raw["https://mildmate.com/roles"]);
  const out: string[] = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}

export function hasAdminRole(rawClaims: any): boolean {
  const roles = collectRoles(rawClaims);
  return roles.some((r) =>
    r === "admin" ||
    r === "super-admin" ||
    r === "super_admin" ||
    r === "superadmin" ||
    r.endsWith(":admin") ||
    r.endsWith("/admin")
  );
}

export function emailAllowed(email: string, env: any): boolean {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

function blockedEmailsFromEnv(env: any): Set<string> {
  return new Set(
    String(env?.ADMIN_BLOCKED_EMAILS || "")
      .split(",")
      .map((s: string) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function emailBlocked(email: string, env: any): boolean {
  if (!email) return false;
  return blockedEmailsFromEnv(env).has(email.toLowerCase());
}

// ── Clerk Backend API enrichment ──

function getPrimaryClerkEmail(user: any): string {
  if (!user || typeof user !== "object") return "";
  const list = Array.isArray(user.email_addresses) ? user.email_addresses : [];
  const primaryId = user.primary_email_address_id;
  const primary = list.find((e: any) => e && e.id === primaryId);
  return String(primary?.email_address || list[0]?.email_address || "").trim().toLowerCase();
}

async function enrichFromClerk(
  sub: string,
  env: any
): Promise<{ email: string; hasAdmin: boolean }> {
  const clerkKey = String(env.CLERK_SECRET_KEY || "").trim();
  if (!sub || !clerkKey) return { email: "", hasAdmin: false };
  try {
    const resp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
      headers: { Authorization: "Bearer " + clerkKey },
    });
    if (!resp.ok) return { email: "", hasAdmin: false };
    const user = await resp.json();
    const email = getPrimaryClerkEmail(user);
    const metadataRaw = {
      role: user?.public_metadata?.role,
      roles: user?.public_metadata?.roles,
      org_role: user?.public_metadata?.org_role,
      orgRole: user?.public_metadata?.orgRole,
      public_metadata: user?.public_metadata || {},
      unsafe_metadata: user?.unsafe_metadata || {},
      metadata: user?.private_metadata || {},
    };
    return { email, hasAdmin: hasAdminRole(metadataRaw) };
  } catch {
    return { email: "", hasAdmin: false };
  }
}

// ── Host detection ──

export function isProductionHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  if (hostname.endsWith(".pages.dev")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}

// ── Main authorization function (AND logic) ──
// Returns { ok: true } if the caller has BOTH:
//   (a) an admin/super-admin role claim (from JWT or Clerk Backend API enrichment)
//   (b) an email listed in the ADMIN_EMAILS env var
// AND the email is not in the BLOCKED_EMAILS denylist.
// Falls back to X-Admin-Secret only on non-production hosts or when
// ADMIN_SECRET_ALLOW_PROD is explicitly "true".

export async function authorizeAdmin(
  request: Request,
  env: any
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");

  // 1) Preferred: Clerk Bearer token with AND logic
  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      let hasRole = hasAdminRole(raw);
      let email = String(verified.payload.email || "").trim().toLowerCase();
      let allowed = emailAllowed(email, env);

      // Enrichment: if either role or email is missing from JWT, look up
      // via Clerk Backend API (JWT may lack claims on production custom domains).
      if (!hasRole || !allowed) {
        const sub = String(verified.payload.sub || "").trim();
        const enriched = await enrichFromClerk(sub, env);
        if (enriched.email) email = enriched.email;
        hasRole = hasRole || enriched.hasAdmin;
        allowed = allowed || emailAllowed(email, env);
      }

      // Deny blocked emails first (defense-in-depth).
      if (emailBlocked(email, env)) {
        return { ok: false, status: 403, error: "Forbidden: account not authorized for admin access" };
      }

      // AND logic: both conditions must be true.
      if (hasRole && allowed) {
        return { ok: true };
      }

      return { ok: false, status: 403, error: "Forbidden: admin role and email allowlist required" };
    }
    // If JWT invalid, fall through to secret fallback.
  }

  // 2) Legacy fallback: X-Admin-Secret (blocked in production unless explicitly enabled)
  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  if (!providedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }

  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  // Dev bypass: if ADMIN_SECRET not set, allow any non-empty secret.
  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}
