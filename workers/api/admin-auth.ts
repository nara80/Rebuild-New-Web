// Shared admin authorization for /api/admin/* endpoints.
// Browser-admin operations require Clerk Bearer auth + role + allowlist
// (+ denylist enforcement). Machine integrations are explicitly route-scoped.

import { verifyClerkJwt } from "./clerk-verify";

export type AdminAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

type AdminRouteAuthMode = "not_admin" | "browser_admin" | "machine_secret";

const MACHINE_SECRET_ROUTES = new Set<string>([
  "/api/admin/subscribers",
]);

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

// ── Route normalization / classification ──

export function normalizeAdminApiPath(pathname: string): string {
  let path = String(pathname || "/").trim();
  if (!path) path = "/";
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep raw form when decode fails
  }
  path = path.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

export function classifyAdminApiPath(pathname: string): AdminRouteAuthMode {
  const path = normalizeAdminApiPath(pathname);
  if (path !== "/api/admin" && !path.startsWith("/api/admin/")) return "not_admin";
  if (MACHINE_SECRET_ROUTES.has(path)) return "machine_secret";
  return "browser_admin";
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
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}

function hasBearerAuth(request: Request): boolean {
  return (request.headers.get("Authorization") || "").startsWith("Bearer ");
}

function configuredAdminSecret(env: any): string {
  return typeof env?.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
}

// ── Strict browser-admin auth: Clerk only (AND logic) ──

export async function authorizeAdminBrowser(
  request: Request,
  env: any
): Promise<AdminAuthResult> {
  if (!hasBearerAuth(request)) {
    return { ok: false, status: 401, error: "Unauthorized: bearer token required" };
  }

  const verified = await verifyClerkJwt(request, env);
  if (!verified.valid) {
    return { ok: false, status: verified.status, error: verified.error };
  }

  const raw = verified.payload.raw || {};
  let hasRole = hasAdminRole(raw);
  let email = String(verified.payload.email || "").trim().toLowerCase();
  let allowed = emailAllowed(email, env);

  // Enrichment: if either role or email is missing from JWT, look up
  // via Clerk Backend API.
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

  if (hasRole && allowed) {
    return { ok: true };
  }
  return { ok: false, status: 403, error: "Forbidden: admin role and email allowlist required" };
}

// ── Strict machine auth: explicit secret only, no defaults ──

export async function authorizeAdminMachineSecret(
  request: Request,
  env: any
): Promise<AdminAuthResult> {
  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  if (!providedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const expectedSecret = configuredAdminSecret(env);
  if (!expectedSecret) {
    return { ok: false, status: 401, error: "Unauthorized: ADMIN_SECRET not configured" };
  }
  if (providedSecret !== expectedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}

// Route-aware policy:
// - browser_admin routes: Clerk Bearer token + role + allowlist + denylist.
// - machine_secret routes: machine secret, OR browser admin token if provided.
export async function authorizeAdminForRoute(
  request: Request,
  env: any,
  pathname: string
): Promise<AdminAuthResult> {
  const mode = classifyAdminApiPath(pathname);
  if (mode === "not_admin") return { ok: true };
  if (mode === "machine_secret") {
    if (hasBearerAuth(request)) return authorizeAdminBrowser(request, env);
    return authorizeAdminMachineSecret(request, env);
  }
  return authorizeAdminBrowser(request, env);
}

// Backward-compatible helper used by legacy handlers.
// Browser calls use strict Clerk auth.
// Secret fallback is only allowed when:
// - route is not production host, OR
// - ADMIN_SECRET_ALLOW_PROD=true
// and always requires configured ADMIN_SECRET.
export async function authorizeAdmin(
  request: Request,
  env: any
): Promise<AdminAuthResult> {
  if (hasBearerAuth(request)) {
    return authorizeAdminBrowser(request, env);
  }

  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }
  return authorizeAdminMachineSecret(request, env);
}
