// Server-side protection for /account/*
// Verifies Clerk __session cookie (or __clerk_db_jwt in dev mode)
// Clerk dev mode: __clerk_db_jwt passed as query param on redirect back
// Redirects unauthenticated users to Clerk sign-in
// Works alongside client-side gate as defense-in-depth

import { verifyClerkJwt } from "../../workers/api/clerk-verify";

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
  ENVIRONMENT?: string;
}> = async (context) => {
  // Dev mode: Clerk stores session in IndexedDB (not cookies), so cookie-based
  // middleware cannot detect auth. Rely on client-side gate instead.
  const host = new URL(context.request.url).host;
  if (host.includes("pages.dev") || host.includes("localhost")) {
    return context.next();
  }

  const sessionToken = getClerkSessionToken(context.request);

  if (!sessionToken) {
    return redirectToSignIn(context.request.url);
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
    return redirectToSignIn(context.request.url);
  }

  // Authenticated — serve the page
  return context.next();
};

function redirectToSignIn(currentUrl: string) {
  const parsed = new URL(currentUrl);
  const isDev = parsed.host.includes("pages.dev") || parsed.host.includes("localhost");
  const accountsDomain = isDev
    ? "kind-joey-29.accounts.dev"
    : "accounts.mildmate.com"; // production (Option 3)

  // Strip query params — avoid circular redirects with Clerk tokens in URL
  const cleanReturnUrl = parsed.origin + parsed.pathname;

  const signInUrl = new URL(`https://${accountsDomain}/sign-in`);
  signInUrl.searchParams.set("redirect_url", cleanReturnUrl);

  return Response.redirect(signInUrl.toString(), 302);
}
