const SESSION_COOKIE_RE = /^__session(?:_[A-Za-z0-9_-]{1,64})?$/;
const DEV_SESSION_COOKIE_RE = /^__clerk_db_jwt(?:_[A-Za-z0-9_-]{1,64})?$/;

import { verifyClerkJwt } from "./clerk-verify";

type TokenCandidate = {
  name: string;
  value: string;
  source: "cookie" | "query";
};

export type ClerkSessionTokenResult = {
  token: string | null;
  source: "cookie" | "query" | null;
  ambiguous: boolean;
  // Distinct session-token values observed (bounded by MAX_SESSION_CANDIDATES).
  // Populated even for the single-candidate case so callers can verify each
  // candidate cryptographically instead of rejecting on ambiguity alone.
  candidates: string[];
  // false when more distinct values were seen than MAX_SESSION_CANDIDATES —
  // callers must reject rather than partially examine.
  candidatesComplete: boolean;
  // Distinct session-cookie NAMES observed (e.g. "__session", a Clerk
  // suffixed variant). Used to build conflict-clearing Set-Cookie directives.
  candidateCookieNames: string[];
};

// Upper bound on distinct session-token candidates examined per request.
// Real-world conflicts come from duplicate host/domain-scoped cookies (2-3
// entries); 8 leaves generous headroom while bounding verification work.
const MAX_SESSION_CANDIDATES = 8;

function isSessionTokenName(name: string): boolean {
  return SESSION_COOKIE_RE.test(name) || DEV_SESSION_COOKIE_RE.test(name);
}

function parseCookieHeader(cookieHeader: string): Array<{ name: string; value: string }> {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf("=");
      if (idx <= 0) return { name: "", value: "" };
      return {
        name: part.slice(0, idx).trim(),
        value: part.slice(idx + 1).trim(),
      };
    })
    .filter((entry) => entry.name && entry.value);
}

function collectCookieCandidates(request: Request): TokenCandidate[] {
  const cookieHeader = request.headers.get("Cookie") || "";
  const parsed = parseCookieHeader(cookieHeader);
  return parsed
    .filter((entry) => isSessionTokenName(entry.name))
    .map((entry) => ({ name: entry.name, value: entry.value, source: "cookie" as const }));
}

function collectQueryCandidates(request: Request): TokenCandidate[] {
  const url = new URL(request.url);
  const out: TokenCandidate[] = [];
  for (const [name, value] of url.searchParams.entries()) {
    if (!value) continue;
    if (!isSessionTokenName(name)) continue;
    out.push({ name, value: value.trim(), source: "query" });
  }
  return out;
}

export function extractClerkSessionToken(
  request: Request,
  options: { allowQueryToken?: boolean } = {}
): ClerkSessionTokenResult {
  const cookieCandidates = collectCookieCandidates(request);
  const queryCandidates = options.allowQueryToken ? collectQueryCandidates(request) : [];
  const all = [...cookieCandidates, ...queryCandidates];

  if (!all.length) {
    return { token: null, source: null, ambiguous: false, candidates: [], candidatesComplete: true, candidateCookieNames: [] };
  }

  const cookieNames = Array.from(new Set(cookieCandidates.map((candidate) => candidate.name)));
  const uniqueValues = Array.from(new Set(all.map((candidate) => candidate.value)));
  if (uniqueValues.length !== 1) {
    // Conflicting credentials: never choose by cookie order, role, or
    // allowlist. Hand every distinct value to the caller so each can be
    // verified with the strict JWT pipeline; the caller accepts exactly one
    // valid candidate or rejects.
    return {
      token: null,
      source: null,
      ambiguous: true,
      candidates: uniqueValues.slice(0, MAX_SESSION_CANDIDATES),
      candidatesComplete: uniqueValues.length <= MAX_SESSION_CANDIDATES,
      candidateCookieNames: cookieNames.slice(0, MAX_SESSION_CANDIDATES),
    };
  }

  const token = uniqueValues[0];
  const source = all.some((candidate) => candidate.source === "cookie") ? "cookie" : "query";
  return { token, source, ambiguous: false, candidates: [token], candidatesComplete: true, candidateCookieNames: cookieNames };
}

export type SessionVerification =
  | { state: "none" }
  | { state: "expired" }
  | { state: "invalid"; clears: string[] }
  | { state: "valid"; token: string; result: any };

const DEFAULT_TRUSTED_SESSION_COOKIE_DOMAIN = "mildmate.com";

function sanitizeCookieDomain(raw: string): string | null {
  const trimmed = String(raw || "").trim().toLowerCase().replace(/^\.+/, "");
  if (!trimmed) return null;
  if (!/^[a-z0-9.-]+$/.test(trimmed)) return null;
  if (!/[a-z0-9]$/.test(trimmed)) return null;
  return trimmed;
}

function resolveTrustedSessionCookieDomain(request: Request, env: any): string | null {
  const host = new URL(request.url).hostname.toLowerCase();
  const configured = sanitizeCookieDomain(String(env?.CLERK_SESSION_COOKIE_DOMAIN || ""));
  const trusted = configured || DEFAULT_TRUSTED_SESSION_COOKIE_DOMAIN;
  if (host === trusted || host.endsWith("." + trusted)) return trusted;
  return null;
}

/**
 * Build Set-Cookie directives that clear the given cookie names in BOTH
 * storage scopes a browser may hold:
 * - host-scoped (no Domain attribute)
 * - domain-scoped (Domain=<trusted domain>)
 *
 * The domain-scoped variant MUST use an explicit trusted domain, never a
 * parent-domain guess from arbitrary request hostnames.
 */
export function buildSessionCookieClears(
  request: Request,
  names: string[],
  trustedDomain: string | null
): string[] {
  const past = "Expires=Thu, 01 Jan 1970 00:00:00 GMT";
  const out: string[] = [];
  for (const name of names) {
    out.push(`${name}=; Path=/; ${past}; Secure; HttpOnly`);
    if (trustedDomain) out.push(`${name}=; Domain=${trustedDomain}; Path=/; ${past}; Secure; HttpOnly`);
  }
  return out;
}

/**
 * Verify every distinct session-token candidate with the exact strict
 * pipeline used for single-token requests (signature, issuer, expiry,
 * fail-closed prod guard, rate limiting). Never selects by cookie order,
 * role, or allowlist:
 * - exactly one fully valid candidate → "valid" (token + verified result);
 * - zero valid candidates → "invalid", or "expired" when a candidate expired
 *   (preserves the one-shot handshake refresh path in callers);
 * - two or more distinct valid candidates, or a truncated candidate list →
 *   "invalid" WITH Set-Cookie clears for every conflicting cookie name in
 *   both scopes, so the caller can reject WITHOUT letting the conflicting
 *   cookies regenerate the loop on the next Clerk bounce.
 */
export async function verifySessionCandidates(
  session: ClerkSessionTokenResult,
  request: Request,
  env: any,
  options: { clearInvalidCookieCandidates?: boolean } = {}
): Promise<SessionVerification> {
  if (!session.candidates.length) return { state: "none" };

  let sawExpired = false;
  let validToken: string | null = null;
  let validResult: any = null;
  let validCount = 0;

  for (const candidate of session.candidates) {
    const modifiedRequest = new Request(request.url, {
      headers: new Headers({
        ...Object.fromEntries(request.headers.entries()),
        Authorization: `Bearer ${candidate}`,
      }),
    });
    const result = await verifyClerkJwt(modifiedRequest, env);
    if (result.valid) {
      validCount++;
      if (!validToken) {
        validToken = candidate;
        validResult = result;
      }
    } else if (result.error === "Token expired") {
      sawExpired = true;
    }
  }

  if (validCount === 1 && validToken) {
    return { state: "valid", token: validToken, result: validResult };
  }

  // Conflict (≥2 valid, or truncated cap) or zero-valid ambiguity: attach
  // clears so the caller's sign-in redirect removes conflicting stale cookie
  // scope and Clerk's next handshake starts from a clean jar.
  const trustedDomain = resolveTrustedSessionCookieDomain(request, env);
  const shouldClearInvalidCookieCandidates =
    options.clearInvalidCookieCandidates === true &&
    validCount === 0 &&
    session.candidateCookieNames.length > 0;
  const clears = session.ambiguous || !session.candidatesComplete || shouldClearInvalidCookieCandidates
    ? buildSessionCookieClears(request, session.candidateCookieNames, trustedDomain)
    : [];
  return { state: "invalid", clears };
}

/**
 * Re-issue a redirect Response with conflict-clearing Set-Cookie directives
 * attached (Response.redirect headers are immutable, so the response is
 * rebuilt with a mutable Headers copy).
 */
export function redirectWithCookieClears(signInResponse: Response, clears: string[]): Response {
  if (!clears.length) return signInResponse;
  const headers = new Headers(signInResponse.headers);
  for (const clear of clears) headers.append("Set-Cookie", clear);
  return new Response(null, { status: signInResponse.status, headers });
}
