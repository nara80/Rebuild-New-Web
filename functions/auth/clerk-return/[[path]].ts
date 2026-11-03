import { consumeClerkHandshake } from "../../../workers/api/clerk-handshake";
import {
  extractClerkSessionToken,
  verifySessionCandidates,
  redirectWithCookieClears,
} from "../../../workers/api/clerk-session-token";

const DEFAULT_NEXT_PATH = "/super-admin/";

function normalizeNextPath(raw: string | null): string {
  const value = String(raw || "").trim();
  if (!value) return DEFAULT_NEXT_PATH;
  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_NEXT_PATH;
  try {
    const parsed = new URL(value, "https://mildmate.local");
    if (!parsed.pathname.startsWith("/")) return DEFAULT_NEXT_PATH;
    return parsed.pathname + parsed.search;
  } catch {
    return DEFAULT_NEXT_PATH;
  }
}

function buildCallbackUrl(url: URL, nextPath: string): string {
  const callback = new URL("/auth/clerk-return/", url.origin);
  callback.searchParams.set("next", nextPath);
  return callback.toString();
}

function redirectToSignIn(url: URL, env: any, nextPath: string): Response {
  const accountsDomain = String(env?.CLERK_ACCOUNTS_DOMAIN || "accounts.mildmate.com").trim();
  const signInUrl = new URL(`https://${accountsDomain}/sign-in`);
  signInUrl.searchParams.set("redirect_url", buildCallbackUrl(url, nextPath));
  return Response.redirect(signInUrl.toString(), 302);
}

export const onRequest: PagesFunction<{
  CLERK_ACCOUNTS_DOMAIN?: string;
  CLERK_ISSUER?: string;
  CLERK_JWKS_URL?: string;
  DB: D1Database;
}> = async (context) => {
  const url = new URL(context.request.url);
  const nextPath = normalizeNextPath(url.searchParams.get("next"));

  // If handshake payload is present, consume it first to set the refreshed
  // Clerk cookies (including __session). consumeClerkHandshake handles
  // verification and cookie hardening.
  const handshakeResponse = await consumeClerkHandshake(context.request, context.env);
  if (handshakeResponse) return handshakeResponse;

  // Conflicting session cookies (e.g. plain __session + Clerk's suffixed
  // __session_<id> holding different tokens) are resolved by verifying EVERY
  // distinct candidate with the strict JWT pipeline — never by cookie order.
  // Rejections for ambiguous identities attach clearing directives for every
  // conflicting cookie name in both host and domain scopes, so Clerk's next
  // bounce starts from a clean jar instead of regenerating the loop.
  const session = extractClerkSessionToken(context.request, { allowQueryToken: true });
  const verified = await verifySessionCandidates(session, context.request, context.env);

  if (verified.state !== "valid") {
    return redirectWithCookieClears(redirectToSignIn(url, context.env, nextPath), verified.clears || []);
  }

  return Response.redirect(new URL(nextPath, url.origin).toString(), 302);
};
