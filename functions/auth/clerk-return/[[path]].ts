import { consumeClerkHandshake } from "../../../workers/api/clerk-handshake";
import { verifyClerkJwt } from "../../../workers/api/clerk-verify";

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

function getSessionToken(request: Request): string {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookieMatch =
    cookieHeader.match(/__session=([^;]+)/) ||
    cookieHeader.match(/__clerk_db_jwt=([^;]+)/);
  if (cookieMatch && cookieMatch[1]) return cookieMatch[1].trim();
  return "";
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

  const sessionToken = getSessionToken(context.request);
  if (!sessionToken) {
    return redirectToSignIn(url, context.env, nextPath);
  }

  const verifyRequest = new Request(context.request.url, {
    headers: new Headers({
      ...Object.fromEntries(context.request.headers.entries()),
      Authorization: `Bearer ${sessionToken}`,
    }),
  });
  const verified = await verifyClerkJwt(verifyRequest, context.env);
  if (!verified.valid) {
    return redirectToSignIn(url, context.env, nextPath);
  }

  return Response.redirect(new URL(nextPath, url.origin).toString(), 302);
};
