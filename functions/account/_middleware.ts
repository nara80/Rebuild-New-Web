// Server-side protection for /account/*
// Verifies Clerk __session cookie (or __clerk_db_jwt in dev mode)
// Clerk dev mode: __clerk_db_jwt passed as query param on redirect back
// Redirects unauthenticated users to Clerk sign-in
// Works alongside client-side gate as defense-in-depth

import { verifyClerkJwt } from "../../workers/api/clerk-verify";
import { consumeClerkHandshake } from "../../workers/api/clerk-handshake";

function getClerkSessionToken(request: Request): string | null {
  // 1. Check cookies (production: __session, dev: __clerk_db_jwt)
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookieMatch = cookieHeader.match(/__session=([^;]+)/) || cookieHeader.match(/__clerk_db_jwt=([^;]+)/);
  if (cookieMatch) return cookieMatch[1];

  // 2. Check URL query params (Clerk dev mode redirects with ?__clerk_db_jwt=...)
  const url = new URL(request.url);
  const qp = url.searchParams.get("__clerk_db_jwt") || url.searchParams.get("__session");
  if (qp) return qp;

  return null;
}

export const onRequest: PagesFunction<{
  DB: D1Database;
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_ACCOUNTS_DOMAIN?: string;
  ENVIRONMENT?: string;
}> = async (context) => {
  // Dev mode: Clerk stores session in IndexedDB (not cookies), so cookie-based
  // middleware cannot detect auth. Rely on client-side gate instead.
  if (isDevelopmentAuthHost(context.request.url)) {
    return context.next();
  }

  // Clerk delivers refreshed session cookies as a signed __clerk_handshake
  // payload that the application must verify and apply itself — FAPI never
  // sets __session directly. Consume it before token verification.
  const handshakeResponse = await consumeClerkHandshake(context.request, context.env);
  if (handshakeResponse) return handshakeResponse;

  const sessionToken = getClerkSessionToken(context.request);

  if (!sessionToken) {
    return redirectToSignIn(context.request.url, context.env);
  }

  // Inject the session token as Bearer token so verifyClerkJwt can read it
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
  const cleaned = stripHandshakeMarker(context.request.url);
  if (cleaned) return cleaned;

  // Authenticated — serve the page
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

  // Strip query params — avoid circular redirects with Clerk tokens in URL
  const cleanReturnUrl = parsed.origin + parsed.pathname;

  const signInUrl = new URL(`https://${accountsDomain}/sign-in`);
  signInUrl.searchParams.set("redirect_url", cleanReturnUrl);

  return Response.redirect(signInUrl.toString(), 302);
}

function isDevelopmentAuthHost(url: string): boolean {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  if (hostname.includes("pages.dev")) return true;
  if (hostname === "localhost") return true;
  if ((hostname === "127.0.0.1" || hostname === "::1") && parsed.protocol === "http:") return true;
  return false;
}
