// Clerk JWT Verification for Cloudflare Workers
// Uses Web Crypto API — zero dependencies
// Caches JWKS keys for 1 hour (Clerk rotates keys rarely)

interface ClerkJwtPayload {
  sub: string;
  email?: string;
  name?: string;
  raw?: any;
  exp: number;
  iat: number;
  iss: string;
  azp: string;
  sid: string;
}

interface JwksKey {
  kid: string;
  kty: string;
  alg: string;
  n: string;
  e: string;
  use: string;
}

// Env-var-driven Clerk config with dev fallback.
// Production sets CLERK_ISSUER + CLERK_JWKS_URL via Cloudflare Pages secrets/vars.
// Dev/preview falls back to the Development instance (kind-joey-29).
const DEV_CLERK_ISSUER = "https://clerk.kind-joey-29.clerk.accounts.dev";
const DEV_JWKS_URL = "https://kind-joey-29.clerk.accounts.dev/.well-known/jwks.json";
const JWKS_CACHE_MS = 3600 * 1000; // 1 hour

function getIssuer(env: any): string {
  return String(env?.CLERK_ISSUER || DEV_CLERK_ISSUER).trim();
}

function getJwksUrl(env: any): string {
  return String(env?.CLERK_JWKS_URL || DEV_JWKS_URL).trim();
}

function isProdClerkConfigured(env: any): boolean {
  const issuer = String(env?.CLERK_ISSUER || "").trim();
  return issuer.length > 0 && issuer !== DEV_CLERK_ISSUER;
}

/** Production custom domains — the only hosts that must NEVER fall back to dev Clerk config. */
function isProductionHostname(hostname: string): boolean {
  const h = String(hostname || "").toLowerCase();
  return h === "www.mildmate.com" || h === "mildmate.com";
}

// Cache JWKS keys per-URL so dev and prod keys don't collide.
let jwksCache: Map<string, { keys: JwksKey[]; fetchedAt: number }> = new Map();

const RATE_WINDOW_MS = 60 * 1000; // 1 minute for auth rate limiting
const MAX_AUTH_REQUESTS = 30; // per IP per minute

/** Rate limit check — per-IP counter via D1 rate_limits table */
async function checkAuthRateLimit(env: any, ip: string): Promise<boolean> {
  try {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM rate_limits
       WHERE ip_address = ?1 AND endpoint = 'auth'
       AND created_at > datetime('now', '-1 minute')`
    ).bind(ip).first();
    return (row?.cnt || 0) >= MAX_AUTH_REQUESTS;
  } catch {
    return false;
  }
}

async function recordRateLimit(env: any, ip: string): Promise<void> {
  try {
    await env.DB.prepare(
      "INSERT INTO rate_limits (ip_address, endpoint) VALUES (?1, 'auth')"
    ).bind(ip).run();
  } catch {}
}

/** Fetch and cache JWKS keys (per-URL cache to support dev + prod simultaneously) */
async function getJwks(jwksUrl: string): Promise<JwksKey[]> {
  const cached = jwksCache.get(jwksUrl);
  if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_MS) {
    return cached.keys;
  }

  const resp = await fetch(jwksUrl);
  if (!resp.ok) throw new Error("Failed to fetch JWKS: " + resp.status);

  const data: any = await resp.json();
  const entry = { keys: data.keys || [], fetchedAt: Date.now() };
  jwksCache.set(jwksUrl, entry);
  return entry.keys;
}

/** Base64url → Uint8Array */
function base64urlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Base64url bigint → Uint8Array for RSA key */
function base64urlToBigInt(str: string): Uint8Array {
  return base64urlToBytes(str);
}

/** Import RSA public key from JWK */
async function importRsaKey(jwk: JwksKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      alg: "RS256",
      ext: false,
    },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

/** Verify a Clerk JWT and return the payload */
export async function verifyClerkJwt(
  request: Request,
  env: any
): Promise<{ valid: true; payload: ClerkJwtPayload } | { valid: false; error: string; status: number }> {

  // ── Origin validation ──
  const origin = request.headers.get("Origin") || "";
  const host = request.headers.get("Host") || "";
  const allowedOrigins = [
    "https://mildmate-new.pages.dev",
    "https://www.mildmate.com",
  ];
  if (origin && !allowedOrigins.includes(origin) &&
      host !== "localhost" && !host.startsWith("127.0.0.1")) {
    return { valid: false, error: "Invalid origin", status: 403 };
  }

  // ── Fail-closed production guard ──
  // If a request arrives on a production host but the Clerk Production
  // configuration (CLERK_ISSUER / CLERK_JWKS_URL) is missing, REJECT the
  // token instead of falling back to the Development instance. Production
  // must never silently trust Development-instance JWTs.
  try {
    const requestHost = new URL(request.url).hostname.toLowerCase();
    if (isProductionHostname(requestHost) && !isProdClerkConfigured(env)) {
      return { valid: false, error: "Auth service unavailable", status: 503 };
    }
  } catch {}

  // ── Rate limiting ──
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (await checkAuthRateLimit(env, ip)) {
    return { valid: false, error: "Too many requests", status: 429 };
  }
  await recordRateLimit(env, ip);

  // ── Extract token ──
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;
  if (!token) {
    return { valid: false, error: "Missing token", status: 401 };
  }

  // ── Parse JWT header ──
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Invalid token format", status: 401 };
  }

  let header: { kid?: string; alg?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(base64urlToBytes(parts[0])));
  } catch {
    return { valid: false, error: "Invalid token header", status: 401 };
  }

  if (header.alg !== "RS256") {
    return { valid: false, error: "Unsupported algorithm", status: 401 };
  }

  // ── Find matching JWK ──
  let keys: JwksKey[];
  try {
    keys = await getJwks(getJwksUrl(env));
  } catch (e: any) {
    console.error("Clerk JWKS fetch failed:", e.message);
    return { valid: false, error: "Auth service unavailable", status: 503 };
  }

  const jwk = keys.find((k) => k.kid === header.kid && k.alg === "RS256");
  if (!jwk) {
    return { valid: false, error: "Unknown signing key", status: 401 };
  }

  // ── Verify signature ──
  const signedData = new TextEncoder().encode(parts[0] + "." + parts[1]);
  const signature = base64urlToBytes(parts[2]);

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await importRsaKey(jwk);
  } catch {
    return { valid: false, error: "Invalid key", status: 401 };
  }

  let validSig = false;
  try {
    validSig = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signature as unknown as BufferSource,
      signedData as unknown as BufferSource
    );
  } catch {
    return { valid: false, error: "Signature verification failed", status: 401 };
  }

  if (!validSig) {
    return { valid: false, error: "Invalid signature", status: 401 };
  }

  // ── Parse payload ──
  let payload: ClerkJwtPayload;
  try {
    const rawPayload: any = JSON.parse(
      new TextDecoder().decode(base64urlToBytes(parts[1]))
    );
    payload = {
      sub: rawPayload.sub || "",
      email: rawPayload.email || "",
      name: rawPayload.name || "",
      raw: rawPayload,
      exp: rawPayload.exp || 0,
      iat: rawPayload.iat || 0,
      iss: rawPayload.iss || "",
      azp: rawPayload.azp || "",
      sid: rawPayload.sid || "",
    };
  } catch {
    return { valid: false, error: "Invalid token payload", status: 401 };
  }

  // ── Validate claims ──
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return { valid: false, error: "Token expired", status: 401 };
  }

  // ── Issuer validation ──
  // Production (CLERK_ISSUER env var set): strict match only — reject any
  // token signed by a different issuer (prevents dev JWTs from validating
  // on the production deployment).
  //
  // Dev/preview (no env var): permissive — accept any clerk.accounts.dev
  // issuer so test instances work.
  const expectedIssuer = getIssuer(env);
  if (payload.iss && payload.iss !== expectedIssuer) {
    if (isProdClerkConfigured(env)) {
      // Production mode: strict — no fallback patterns.
      return { valid: false, error: "Invalid issuer", status: 401 };
    }
    // Dev mode: allow other dev Clerk issuers for test instances.
    if (
      !payload.iss.startsWith("https://clerk.") &&
      !payload.iss.includes(".clerk.accounts.dev")
    ) {
      return { valid: false, error: "Invalid issuer", status: 401 };
    }
  }

  return { valid: true, payload };
}

export { DEV_CLERK_ISSUER as CLERK_ISSUER };
