// Clerk handshake consumption for Cloudflare Pages middleware.
//
// Clerk's FAPI /v1/client/handshake never sets __session directly. It returns
// a __clerk_handshake cookie (or query param) containing an RS256 JWT whose
// payload lists Set-Cookie directives; the application middleware must verify
// that JWT against the instance JWKS and apply the directives itself (this is
// what Clerk's official SDK middleware does). Without this step the handshake
// redirect is a no-op and expired sessions loop through the sign-in portal.
//
// Security model:
// - The handshake JWT must verify against the configured production JWKS
//   (CLERK_JWKS_URL); JWT header type/category checks follow Clerk's official
//   backend SDK (typ=JWT when present; reject non-session cat values), and the
//   payload must be a bounded array of directive strings.
// - Cookie directives are parsed and re-serialized from a strict whitelist:
//   only Clerk cookie names (__session / __client_uat / __clerk_handshake,
//   optionally suffixed), header-safe values, Path=/, a Domain that scopes to
//   the request host, and known attributes. Nothing else is ever forwarded.
// - A refreshed __session token is accepted ONLY after it passes the same
//   verifyClerkJwt used everywhere else (fail-closed guard, rate limiting,
//   strict issuer, expiry). An unverified token never reaches Set-Cookie.
// - Signed-out handshakes (empty __session directive) apply the clearing
//   directives and fall through to the sign-in redirect — they can never
//   mint authentication.

import { verifyClerkJwt } from "./clerk-verify";

const HANDSHAKE_JWKS_CACHE_MS = 3600 * 1000;
const MAX_DIRECTIVES = 10;
const MAX_DIRECTIVE_LENGTH = 8192;
// Clerk backend SDK category constants:
// https://raw.githubusercontent.com/clerk/javascript/main/packages/backend/src/tokens/jwtCategories.ts
const JWT_CATEGORY_SESSION_TOKEN = "cl_B7d4PD111AAA";
const JWT_CATEGORY_IGNORE = "cl_I7d4PD111III";

// Clerk cookie names only (optionally suffixed, e.g. __session_abc12).
const ALLOWED_COOKIE_NAME = /^(__session|__client_uat|__clerk_handshake)(_[A-Za-z0-9_-]{1,64})?$/;
// Header-safe cookie value charset (JWT/base64url + URL-encoding); blocks
// separators and CR/LF so a directive can never smuggle extra headers.
const ALLOWED_COOKIE_VALUE = /^[A-Za-z0-9._~%+/=-]*$/;
const ALLOWED_SAMESITE = new Set(["lax", "strict", "none"]);

const handshakeJwksCache: Map<string, { keys: any[]; fetchedAt: number }> = new Map();

function b64urlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getHandshakeToken(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie") || "";
  const m = cookieHeader.match(/(?:^|;\s*)__clerk_handshake=([^;]+)/);
  if (m && m[1]) return m[1].trim();
  try {
    const qp = new URL(request.url).searchParams.get("__clerk_handshake");
    if (qp) return qp.trim();
  } catch {}
  return null;
}

function isNonSessionJwtCategory(cat: unknown): boolean {
  // SDK parity:
  // return cat !== undefined && cat !== SESSION && cat !== IGNORE;
  return cat !== undefined && cat !== JWT_CATEGORY_SESSION_TOKEN && cat !== JWT_CATEGORY_IGNORE;
}

/** Verify the handshake JWT and return its directive list, or null. */
async function verifyHandshakeJwt(token: string, env: any): Promise<string[] | null> {
  const issuer = String(env?.CLERK_ISSUER || "").trim();
  const jwksUrl = String(env?.CLERK_JWKS_URL || "").trim();
  if (!issuer || !jwksUrl) return null; // no production Clerk config — ignore

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let header: any;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  } catch {
    return null;
  }
  // SDK parity with assertHeaderType(typ):
  // - typ may be omitted (legacy compatibility)
  // - if present, must be "JWT"
  if (header.typ !== undefined && header.typ !== "JWT") return null;
  if (header.alg !== "RS256" || !header.kid) return null;
  // Critical category discriminator (AISEC-85 hardening):
  // non-session token classes signed by the same key must not pass as handshake.
  if (isNonSessionJwtCategory(header.cat)) return null;

  let keys: any[];
  try {
    const cached = handshakeJwksCache.get(jwksUrl);
    if (cached && Date.now() - cached.fetchedAt < HANDSHAKE_JWKS_CACHE_MS) {
      keys = cached.keys;
    } else {
      const resp = await fetch(jwksUrl);
      if (!resp.ok) return null;
      const data: any = await resp.json();
      keys = data.keys || [];
      handshakeJwksCache.set(jwksUrl, { keys, fetchedAt: Date.now() });
    }
  } catch {
    return null;
  }

  const jwk = keys.find((k) => k.kid === header.kid && k.alg === "RS256");
  if (!jwk) return null;

  let valid = false;
  try {
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: false },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      b64urlToBytes(parts[2]) as unknown as BufferSource,
      new TextEncoder().encode(parts[0] + "." + parts[1]) as unknown as BufferSource
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  let payload: any;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    return null;
  }

  // Enforce issuer / expiry when the claims are present.
  if (payload.iss && String(payload.iss) !== issuer) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp > 0 && payload.exp < now) return null;

  const list = payload.handshake;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_DIRECTIVES) return null;
  if (!list.every((d: any) => typeof d === "string" && d.length <= MAX_DIRECTIVE_LENGTH)) return null;
  return list as string[];
}

interface ParsedDirective {
  name: string;
  value: string;
  serialized: string;
}

/** Parse + strictly validate one directive; re-serialize from whitelisted parts. */
function parseDirective(directive: string, requestHost: string): ParsedDirective | null {
  const segments = directive.split(";").map((s) => s.trim());
  const first = segments.shift() || "";
  const eq = first.indexOf("=");
  if (eq <= 0) return null;
  const name = first.slice(0, eq).trim();
  const value = first.slice(eq + 1).trim();
  if (!ALLOWED_COOKIE_NAME.test(name)) return null;
  if (!ALLOWED_COOKIE_VALUE.test(value)) return null;

  const attrs: string[] = [];
  for (const seg of segments) {
    if (!seg) continue;
    const aEq = seg.indexOf("=");
    const key = (aEq >= 0 ? seg.slice(0, aEq) : seg).trim().toLowerCase();
    const val = aEq >= 0 ? seg.slice(aEq + 1).trim() : "";
    if (key === "path") {
      if (val !== "/") return null;
      attrs.push("Path=/");
    } else if (key === "domain") {
      const domain = val.replace(/^\./, "").toLowerCase();
      if (!/^[a-z0-9.-]+$/.test(domain)) return null;
      if (requestHost !== domain && !requestHost.endsWith("." + domain)) return null;
      attrs.push("Domain=" + domain);
    } else if (key === "expires") {
      const ts = Date.parse(val);
      if (!Number.isFinite(ts)) return null;
      attrs.push("Expires=" + new Date(ts).toUTCString());
    } else if (key === "max-age") {
      if (!/^\d{1,10}$/.test(val)) return null;
      attrs.push("Max-Age=" + val);
    } else if (key === "secure") {
      attrs.push("Secure");
    } else if (key === "httponly") {
      attrs.push("HttpOnly");
    } else if (key === "samesite") {
      if (!ALLOWED_SAMESITE.has(val.toLowerCase())) return null;
      attrs.push("SameSite=" + val.charAt(0).toUpperCase() + val.slice(1).toLowerCase());
    }
    // Unknown attributes are dropped (never forwarded).
  }

  return { name, value, serialized: [first.slice(0, eq).trim() + "=" + value, ...attrs].join("; ") };
}

function stripAuthParams(url: URL): string {
  const clean = new URL(url.toString());
  for (const p of ["__clerk_handshake", "__clerk_help", "__clerk_db_jwt", "__mm_hs"]) {
    clean.searchParams.delete(p);
  }
  return clean.toString();
}

function redirectWithCookies(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

function signInUrl(url: URL, env: any): string {
  const accountsDomain = String(env?.CLERK_ACCOUNTS_DOMAIN || "accounts.mildmate.com").trim();
  const target = new URL(`https://${accountsDomain}/sign-in`);
  target.searchParams.set("redirect_url", url.origin + url.pathname);
  return target.toString();
}

/**
 * Consume a __clerk_handshake delivery if present.
 * Returns a Response the middleware must return, or null to continue the
 * normal verification flow (no handshake present, or it was unverifiable —
 * the existing one-shot __mm_hs marker remains the backstop).
 */
export async function consumeClerkHandshake(request: Request, env: any): Promise<Response | null> {
  const token = getHandshakeToken(request);
  if (!token) return null;

  const directives = await verifyHandshakeJwt(token, env);
  if (!directives) return null;

  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  const parsed: ParsedDirective[] = [];
  let sessionToken = "";
  let sawSessionDirective = false;
  for (const d of directives) {
    const p = parseDirective(d, host);
    if (!p) continue; // invalid directive — never forwarded
    if (/^__session(_|$)/.test(p.name)) {
      sawSessionDirective = true;
      if (p.value) sessionToken = p.value;
    }
    parsed.push(p);
  }

  if (sessionToken) {
    // Verify the refreshed session with the exact same semantics as every
    // other auth check (fail-closed guard, rate limit, signature, expiry,
    // strict issuer) BEFORE trusting any directive.
    const verifyReq = new Request(request.url, {
      headers: new Headers({
        ...Object.fromEntries(request.headers.entries()),
        Authorization: `Bearer ${sessionToken}`,
      }),
    });
    const result = await verifyClerkJwt(verifyReq, env);
    if (result.valid) {
      return redirectWithCookies(stripAuthParams(url), parsed.map((p) => p.serialized));
    }
    // Refreshed token failed verification — clear ONLY the handshake cookie
    // (so it cannot re-trigger) and fall back to the sign-in redirect.
    const clears = parsed
      .filter((p) => /^__clerk_handshake(_|$)/.test(p.name) && !p.value)
      .map((p) => p.serialized);
    return redirectWithCookies(signInUrl(url, env), clears);
  }

  if (sawSessionDirective) {
    // Signed-out handshake: apply the clearing directives (session/uat reset,
    // handshake cookie removal) and send the user to sign-in.
    return redirectWithCookies(signInUrl(url, env), parsed.map((p) => p.serialized));
  }

  // No session directive — unexpected structure; ignore (handshake cookie
  // expires on its own within ~70s).
  return null;
}
