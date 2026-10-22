// Server-side protection for /admin/* and /super-admin/*
// Verifies Clerk __session cookie + admin role AND email allowlist check.
// Dev mode: relies on client-side Clerk gate since cookies are not available.
//
// Auth flow (AND logic — strictest model):
// 1. Extract Clerk session token from cookie or query param
// 2. Verify JWT via Web Crypto + JWKS (clerk-verify.ts)
// 3. Require BOTH: admin/super-admin role claim AND email in ADMIN_EMAILS
// 4. Enrich from Clerk Backend API if JWT lacks role/email claims
// 5. Deny blocked emails (defense-in-depth)
// 6. Redirect unauthenticated to sign-in; 403 for authenticated-but-unauthorized

import { verifyClerkJwt } from "../../workers/api/clerk-verify";
import { consumeClerkHandshake } from "../../workers/api/clerk-handshake";
import { hasAdminRole, emailAllowed, emailBlocked } from "../../workers/api/admin-auth";

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
  CLERK_ACCOUNTS_DOMAIN?: string;
  ADMIN_EMAILS?: string;
  ENVIRONMENT?: string;
}> = async (context) => {
  // Dev mode: Clerk uses IndexedDB (not cookies), so cookie-based middleware
  // cannot detect auth. Rely on client-side gate instead.
  if (isDevelopmentAuthHost(context.request.url)) {
    return context.next();
  }

  // Clerk delivers refreshed session cookies as a signed __clerk_handshake
  // payload that the application must verify and apply itself — FAPI never
  // sets __session directly. Consume it before token verification; the
  // markerless retry re-runs the full role/allowlist gates below.
  const handshakeResponse = await consumeClerkHandshake(context.request, context.env);
  if (handshakeResponse) return handshakeResponse;

  const sessionToken = getClerkSessionToken(context.request);

  if (!sessionToken) {
    return redirectToSignIn(context.request.url, context.env);
  }

  const modifiedRequest = new Request(context.request.url, {
    headers: new Headers({
      ...Object.fromEntries(context.request.headers.entries()),
      Authorization: `Bearer ${sessionToken}`,
    }),
  });

  const result = await verifyClerkJwt(modifiedRequest, context.env);

  if (!result.valid) {
    if (result.error === "Token expired") {
      const handshake = redirectToHandshake(context.request.url, context.env);
      if (handshake) return handshake;
    }
    return redirectToSignIn(context.request.url, context.env);
  }

  // Drop the one-shot handshake marker once the refreshed token verifies.
  // The markerless retry re-runs the full role/allowlist gates below.
  const cleaned = stripHandshakeMarker(context.request.url);
  if (cleaned) return cleaned;

  // AND logic: require BOTH admin role claim AND email in ADMIN_EMAILS.
  const raw = (result.payload as any).raw || {};
  let email = String((result.payload as any).email || "").trim().toLowerCase();
  let hasAdmin = hasAdminRole(raw);
  let allowed = emailAllowed(email, context.env);

  // Enrichment: if either role or email is missing from JWT, look up
  // via Clerk Backend API (JWT may lack claims on production custom domains).
  if (!hasAdmin || !allowed) {
    const sub = String((result.payload as any).sub || "").trim();
    const enriched = await enrichAdminFromClerk(sub, context.env);
    if (enriched.email) email = enriched.email;
    hasAdmin = hasAdmin || enriched.hasAdmin;
    allowed = allowed || emailAllowed(email, context.env);
  }

  // Deny blocked emails first (defense-in-depth).
  if (emailBlocked(email, context.env)) {
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Access Denied — MildMate</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F8FAFC;color:#1E293B;text-align:center;padding:24px}h1{font-size:1.5rem;margin-bottom:8px}p{color:#64748b;font-size:0.9375rem;max-width:400px;margin:0 auto 24px}a{color:#2c96f4;text-decoration:none;font-weight:600}a:hover{text-decoration:underline}</style></head>
<body><div><h1>Access Denied</h1><p>${escHtml(email)} does not have super-admin access.</p><a href="/">Go to Homepage</a></div></body></html>`,
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // AND logic: both conditions must be true.
  if (!hasAdmin || !allowed) {
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

// Clerk __session tokens live ~60s and are refreshed only by clerk-js running
// on a page — which never happens on gated paths (this middleware redirects
// before any page JS runs). For the expired-token case only, bounce once
// through Clerk's FAPI handshake, which re-mints the session cookie and
// redirects back. The marker makes the retry one-shot: if the token is still
// expired on return, fall through to the sign-in redirect.
const HANDSHAKE_MARKER = "__mm_hs";

function redirectToHandshake(currentUrl: string, env?: any): Response | null {
  try {
    const parsed = new URL(currentUrl);
    if (parsed.searchParams.has(HANDSHAKE_MARKER)) return null; // already retried once
    const issuer = String(env?.CLERK_ISSUER || "").trim();
    if (!issuer) return null; // no production Clerk config — keep sign-in behavior
    const fapiHost = new URL(issuer).host;
    const returnUrl = new URL(parsed.origin + parsed.pathname);
    returnUrl.searchParams.set(HANDSHAKE_MARKER, "1");
    const handshakeUrl = new URL(`https://${fapiHost}/v1/client/handshake`);
    handshakeUrl.searchParams.set("redirect_url", returnUrl.toString());
    return Response.redirect(handshakeUrl.toString(), 302);
  } catch {
    return null;
  }
}

function stripHandshakeMarker(currentUrl: string): Response | null {
  try {
    const url = new URL(currentUrl);
    if (!url.searchParams.has(HANDSHAKE_MARKER)) return null;
    url.searchParams.delete(HANDSHAKE_MARKER);
    return Response.redirect(url.toString(), 302);
  } catch {
    return null;
  }
}

function redirectToSignIn(currentUrl: string, env?: any) {
  const parsed = new URL(currentUrl);
  const isDev = isDevelopmentAuthHost(currentUrl);
  const accountsDomain = isDev
    ? "kind-joey-29.accounts.dev"
    : String(env?.CLERK_ACCOUNTS_DOMAIN || "accounts.mildmate.com").trim();

  const clean = new URL(parsed.origin + parsed.pathname + parsed.search);
  for (const key of Array.from(clean.searchParams.keys())) {
    if (key.indexOf("__clerk_") === 0 || key === HANDSHAKE_MARKER) {
      clean.searchParams.delete(key);
    }
  }
  const cleanReturnUrl = clean.origin + clean.pathname;
  const isSuperAdminPath = clean.pathname.toLowerCase().startsWith("/super-admin");
  const callbackReturnUrl = new URL("/auth/clerk-return/", clean.origin);
  if (isSuperAdminPath) {
    const nextPath = clean.pathname + clean.search;
    callbackReturnUrl.searchParams.set("next", nextPath || "/super-admin/");
  }
  const signInUrl = new URL(`https://${accountsDomain}/sign-in`);
  signInUrl.searchParams.set("redirect_url", isSuperAdminPath ? callbackReturnUrl.toString() : cleanReturnUrl);

  return Response.redirect(signInUrl.toString(), 302);
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function isDevelopmentAuthHost(url: string): boolean {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  if (hostname.includes("pages.dev")) return true;
  if (hostname === "localhost") return true;
  if ((hostname === "127.0.0.1" || hostname === "::1") && parsed.protocol === "http:") return true;
  return false;
}
