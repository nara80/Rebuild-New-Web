import { consumeClerkHandshake } from "../../../workers/api/clerk-handshake";
import {
  extractClerkSessionToken,
  verifySessionCandidates,
  redirectWithCookieClears,
} from "../../../workers/api/clerk-session-token";

const DEFAULT_NEXT_PATH = "/super-admin/";

// Clerk DEVELOPMENT instances hand the cross-origin session back as
// `__clerk_db_jwt` (the dev-browser token). The PRODUCTION instance uses the
// `__clerk_handshake` payload instead. Both names may carry a Clerk suffix
// (e.g. `__clerk_db_jwt_abc123`).
const DEV_HANDSHAKE_PARAM = /^__clerk_db_jwt(?:_[A-Za-z0-9_-]{1,64})?$/;

/**
 * Preview / local hosts. Production (www.mildmate.com, mildmate.com) is
 * deliberately excluded so the production callback path stays byte-identical.
 */
function isPreviewHost(hostname: string): boolean {
  const h = String(hostname || "").toLowerCase();
  if (h.endsWith(".pages.dev")) return true;
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  return false;
}

/** Locate the Clerk development handshake token in the callback query. */
function findDevHandshake(url: URL): { name: string; value: string } | null {
  for (const [name, value] of url.searchParams.entries()) {
    if (!value) continue;
    if (DEV_HANDSHAKE_PARAM.test(name)) return { name, value };
  }
  return null;
}

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

  // Clerk DEVELOPMENT instances (preview / local) hand the cross-origin
  // session back as `__clerk_db_jwt` (the dev-browser token) — NOT the
  // production `__clerk_handshake` payload that consumeClerkHandshake()
  // understands. That token used to be stripped without ever being consumed,
  // so the preview callback found no session and bounced the browser straight
  // back to the hosted sign-in page: the recurring Clerk Development sign-in
  // loop.
  //
  // The Clerk SDK already knows how to finish a development handshake
  // (public/js/clerk.js: hasClerkHandshakeParams() → initClerk() →
  // waitForSessionAndCleanup() → session established, token dropped from the
  // address bar), so the token is forwarded to the destination page instead
  // of being discarded. Production hosts keep the existing behaviour exactly
  // as before — production signs in through `__clerk_handshake`.
  if (isPreviewHost(url.hostname)) {
    const devHandshake = findDevHandshake(url);
    if (devHandshake) {
      const target = new URL(nextPath, url.origin);
      target.searchParams.set(devHandshake.name, devHandshake.value);
      return Response.redirect(target.toString(), 302);
    }
  }

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
