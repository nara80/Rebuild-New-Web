// Server-side protection for /admin/*
// Verifies Clerk __session cookie + admin role/email check
// Dev mode: relies on client-side Clerk gate since cookies are not available
//
// Auth flow:
// 1. Extract Clerk session token from cookie or query param
// 2. Verify JWT via Web Crypto + JWKS (reuse clerk-verify.ts)
// 3. Check for admin/super-admin role claims OR email in ADMIN_EMAILS env var
// 4. Redirect non-admins to sign-in
//
// Works alongside client-side gate as defense-in-depth.
// Future: Option B — Cloudflare Access for zero-trust before Worker.

import { verifyClerkJwt } from "../../workers/api/clerk-verify";

function getClerkSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookieMatch =
    cookieHeader.match(/__session=([^;]+)/) ||
    cookieHeader.match(/__clerk_db_jwt=([^;]+)/);
  if (cookieMatch) return cookieMatch[1];

  const url = new URL(request.url);
  const qp =
    url.searchParams.get("__clerk_db_jwt") ||
    url.searchParams.get("__session");
  if (qp) return qp;

  return null;
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

function hasAdminRole(rawClaims: any): boolean {
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

async function enrichAdminFromClerk(sub: string, env: any): Promise<{ email: string; hasAdmin: boolean }> {
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

export const onRequest: PagesFunction<{
  DB: D1Database;
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
  ADMIN_EMAILS?: string;
  ENVIRONMENT?: string;
}> = async (context) => {
  const host = new URL(context.request.url).host;

  // Dev mode: Clerk uses IndexedDB (not cookies), so cookie-based middleware
  // cannot detect auth. Rely on client-side gate instead.
  if (host.includes("pages.dev") || host.includes("localhost")) {
    return context.next();
  }

  const sessionToken = getClerkSessionToken(context.request);

  if (!sessionToken) {
    return redirectToSignIn(context.request.url);
  }

  const modifiedRequest = new Request(context.request.url, {
    headers: new Headers({
      ...Object.fromEntries(context.request.headers.entries()),
      Authorization: `Bearer ${sessionToken}`,
    }),
  });

  const result = await verifyClerkJwt(modifiedRequest, context.env);

  if (!result.valid) {
    return redirectToSignIn(context.request.url);
  }

  // Check for admin role or allowed email
  const raw = (result.payload as any).raw || {};
  let email = String((result.payload as any).email || "").trim().toLowerCase();
  let hasAdmin = hasAdminRole(raw);
  let allowed = emailAllowed(email, context.env);

  // Fallback: Clerk JWT sometimes lacks email/metadata claims on production custom domains.
  if (!hasAdmin && !allowed) {
    const sub = String((result.payload as any).sub || "").trim();
    const enriched = await enrichAdminFromClerk(sub, context.env);
    if (enriched.email) email = enriched.email;
    hasAdmin = hasAdmin || enriched.hasAdmin;
    allowed = allowed || emailAllowed(email, context.env);
  }

  if (!hasAdmin && !allowed) {
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Access Denied — MildMate</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F8FAFC;color:#1E293B;text-align:center;padding:24px}h1{font-size:1.5rem;margin-bottom:8px}p{color:#64748b;font-size:0.9375rem;max-width:400px;margin:0 auto 24px}a{color:#2c96f4;text-decoration:none;font-weight:600}a:hover{text-decoration:underline}</style></head>
<body><div><h1>Access Denied</h1><p>${escHtml(email)} does not have admin access. Contact a MildMate admin to request access.</p><a href="/">Go to Homepage</a></div></body></html>`,
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return context.next();
};

function redirectToSignIn(currentUrl: string) {
  const parsed = new URL(currentUrl);
  const isDev = parsed.host.includes("pages.dev") || parsed.host.includes("localhost");
  const accountsDomain = isDev
    ? "kind-joey-29.accounts.dev"
    : "accounts.mildmate.com";

  const cleanReturnUrl = parsed.origin + parsed.pathname;
  const signInUrl = new URL(`https://${accountsDomain}/sign-in`);
  signInUrl.searchParams.set("redirect_url", cleanReturnUrl);

  return Response.redirect(signInUrl.toString(), 302);
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
