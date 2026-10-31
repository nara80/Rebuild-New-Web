// Offline tests for clerk-verify.ts issuer/JWKS logic.
// All network (JWKS fetch) is stubbed â€” no live service is ever touched.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const DEV_ISSUER = "https://clerk.kind-joey-29.clerk.accounts.dev";
const PROD_ISSUER = "https://clerk.mildmate.com";
const DEV_JWKS = "https://kind-joey-29.clerk.accounts.dev/.well-known/jwks.json";
const PROD_JWKS = "https://clerk.mildmate.com/.well-known/jwks.json";

// clerk-verify keeps a module-level JWKS cache; reset modules per test so each
// test gets a fresh cache that matches its freshly generated keypair.
let verifyClerkJwt: typeof import("../clerk-verify").verifyClerkJwt;

// â”€â”€ RSA keypair helpers (Web Crypto, node runtime) â”€â”€

async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  ) as Promise<CryptoKeyPair>;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jwkFromSpki(spki: ArrayBuffer, kid: string) {
  // Extract modulus/exponent by importing the key as JWK
  return crypto.subtle.exportKey("jwk", spki) as Promise<JsonWebKey & { n: string; e: string }>;
}

async function signJwt(kp: CryptoKeyPair, kid: string, payload: Record<string, any>): Promise<string> {
  const header = { alg: "RS256", kid };
  const h = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const p = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signed = new TextEncoder().encode(`${h}.${p}`);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kp.privateKey, signed);
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
}

// â”€â”€ Env / fetch stubs â”€â”€

function stubFetch(jwks: Record<string, any>) {
  return vi.fn(async (url: string) => {
    if (url in jwks) {
      return { ok: true, json: async () => jwks[url] } as unknown as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
}

function makeRequest(token: string, url = "https://www.mildmate.com/api/auth/me"): Request {
  return new Request(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Preview/dev host URL â€” bypasses the production fail-closed guard so dev-mode
// fallback behavior can be exercised.
const PREVIEW_URL = "https://mildmate-new.pages.dev/api/auth/me";

function fakeEnv(over: Record<string, any> = {}) {
  return { ...over }; // no DB â€” rate-limit paths swallow errors
}

describe("clerk-verify issuer validation", () => {
  let devKp: CryptoKeyPair;
  let prodKp: CryptoKeyPair;
  let now: number;

  beforeEach(async () => {
    vi.resetModules();
    ({ verifyClerkJwt } = await import("../clerk-verify"));
    devKp = await generateKeyPair();
    prodKp = await generateKeyPair();
    now = Math.floor(Date.now() / 1000);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("dev mode (no env): accepts dev-issued token with valid signature", async () => {
    const devJwk = await jwkFromSpki(devKp.publicKey);
    const devJwks = { keys: [{ kid: "dev-kid", kty: "RSA", alg: "RS256", n: devJwk.n, e: devJwk.e, use: "sig" }] };
    vi.stubGlobal("fetch", stubFetch({ [DEV_JWKS]: devJwks }));

    const token = await signJwt(devKp, "dev-kid", { sub: "user_dev_1", iss: DEV_ISSUER, exp: now + 300 });
    const res = await verifyClerkJwt(makeRequest(token, PREVIEW_URL), fakeEnv());
    expect(res.valid).toBe(true);
  });

  it("prod mode: rejects dev-issued token (strict issuer, no dev fallback)", async () => {
    const devJwk = await jwkFromSpki(devKp.publicKey);
    const prodJwk = await jwkFromSpki(prodKp.publicKey);
    // Prod JWKS carries both keys so signature verification succeeds and the
    // issuer check itself is what rejects the dev token.
    const prodJwks = {
      keys: [
        { kid: "dev-kid", kty: "RSA", alg: "RS256", n: devJwk.n, e: devJwk.e, use: "sig" },
        { kid: "prod-kid", kty: "RSA", alg: "RS256", n: prodJwk.n, e: prodJwk.e, use: "sig" },
      ],
    };
    vi.stubGlobal("fetch", stubFetch({ [DEV_JWKS]: { keys: [] }, [PROD_JWKS]: prodJwks }));

    const env = fakeEnv({ CLERK_ISSUER: PROD_ISSUER, CLERK_JWKS_URL: PROD_JWKS });
    const token = await signJwt(devKp, "dev-kid", { sub: "user_dev_1", iss: DEV_ISSUER, exp: now + 300 });
    const res = await verifyClerkJwt(makeRequest(token), env);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBe("Invalid issuer");
      expect(res.status).toBe(401);
    }
  });

  it("prod mode: accepts prod-issued token", async () => {
    const prodJwk = await jwkFromSpki(prodKp.publicKey);
    const prodJwks = { keys: [{ kid: "prod-kid", kty: "RSA", alg: "RS256", n: prodJwk.n, e: prodJwk.e, use: "sig" }] };
    vi.stubGlobal("fetch", stubFetch({ [DEV_JWKS]: { keys: [] }, [PROD_JWKS]: prodJwks }));

    const env = fakeEnv({ CLERK_ISSUER: PROD_ISSUER, CLERK_JWKS_URL: PROD_JWKS });
    const token = await signJwt(prodKp, "prod-kid", { sub: "user_prod_1", iss: PROD_ISSUER, exp: now + 300 });
    const res = await verifyClerkJwt(makeRequest(token), env);
    expect(res.valid).toBe(true);
  });

  it("per-URL JWKS cache: dev and prod keys do not collide", async () => {
    const devJwk = await jwkFromSpki(devKp.publicKey);
    const prodJwk = await jwkFromSpki(prodKp.publicKey);
    const fetchMock = vi.fn(async (url: string) => {
      const jwks =
        url === DEV_JWKS
          ? { keys: [{ kid: "dev-kid", kty: "RSA", alg: "RS256", n: devJwk.n, e: devJwk.e, use: "sig" }] }
          : { keys: [{ kid: "prod-kid", kty: "RSA", alg: "RS256", n: prodJwk.n, e: prodJwk.e, use: "sig" }] };
      return { ok: true, json: async () => jwks } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const devEnv = fakeEnv();
    const prodEnv = fakeEnv({ CLERK_ISSUER: PROD_ISSUER, CLERK_JWKS_URL: PROD_JWKS });

    const devToken = await signJwt(devKp, "dev-kid", { sub: "u1", iss: DEV_ISSUER, exp: now + 300 });
    const prodToken = await signJwt(prodKp, "prod-kid", { sub: "u2", iss: PROD_ISSUER, exp: now + 300 });

    const r1 = await verifyClerkJwt(makeRequest(devToken, PREVIEW_URL), devEnv);
    expect(r1.valid).toBe(true);

    const r2 = await verifyClerkJwt(makeRequest(prodToken), prodEnv);
    expect(r2.valid).toBe(true);

    const r3 = await verifyClerkJwt(makeRequest(devToken, PREVIEW_URL), devEnv);
    expect(r3.valid).toBe(true);

    // JWKS fetched exactly once per URL despite three verifications
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const calledUrls = fetchMock.mock.calls.map((c: any[]) => String(c[0]));
    expect(calledUrls.filter((u: string) => u === DEV_JWKS).length).toBe(1);
    expect(calledUrls.filter((u: string) => u === PROD_JWKS).length).toBe(1);
  });

  it("prod mode: rejects unknown issuer entirely (no clerk.* pattern fallback)", async () => {
    vi.stubGlobal("fetch", stubFetch({ [PROD_JWKS]: { keys: [] } }));
    const env = fakeEnv({ CLERK_ISSUER: PROD_ISSUER, CLERK_JWKS_URL: PROD_JWKS });
    const token = await signJwt(prodKp, "prod-kid", { sub: "u3", iss: "https://clerk.evil.example.com", exp: now + 300 });
    // Signature check fails first (empty prod JWKS), which is acceptable â€”
    // the point is it must NEVER validate.
    const res = await verifyClerkJwt(makeRequest(token), env);
    expect(res.valid).toBe(false);
  });

  it("expired token is rejected in dev mode", async () => {
    const devJwk = await jwkFromSpki(devKp.publicKey);
    const devJwks = { keys: [{ kid: "dev-kid", kty: "RSA", alg: "RS256", n: devJwk.n, e: devJwk.e, use: "sig" }] };
    vi.stubGlobal("fetch", stubFetch({ [DEV_JWKS]: devJwks }));

    const token = await signJwt(devKp, "dev-kid", { sub: "u4", iss: DEV_ISSUER, exp: now - 10 });
    const res = await verifyClerkJwt(makeRequest(token, PREVIEW_URL), fakeEnv());
    expect(res.valid).toBe(false);
    if (!res.valid) expect(res.error).toBe("Token expired");
  });

  it("missing token returns 401 without any JWKS fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const res = await verifyClerkJwt(
      new Request(PREVIEW_URL),
      fakeEnv()
    );
    expect(res.valid).toBe(false);
    if (!res.valid) expect(res.error).toBe("Missing token");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fail-closed: production host without Clerk prod config rejects with 503 (no dev fallback)", async () => {
    const devJwk = await jwkFromSpki(devKp.publicKey);
    const devJwks = { keys: [{ kid: "dev-kid", kty: "RSA", alg: "RS256", n: devJwk.n, e: devJwk.e, use: "sig" }] };
    const fetchMock = vi.fn(async () => {
      return { ok: true, json: async () => devJwks } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    // Dev-signed token, prod host, CLERK_ISSUER missing — must NOT fall back
    // to the Development instance.
    const token = await signJwt(devKp, "dev-kid", { sub: "u5", iss: DEV_ISSUER, exp: now + 300 });
    const res = await verifyClerkJwt(makeRequest(token), fakeEnv());
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBe("Auth service unavailable");
      expect(res.status).toBe(503);
    }
    // Must never even reach for the Development JWKS on a prod host.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fail-closed: apex mildmate.com is also treated as a production host", async () => {
    const token = await signJwt(devKp, "dev-kid", { sub: "u6", iss: DEV_ISSUER, exp: now + 300 });
    const res = await verifyClerkJwt(
      makeRequest(token, "https://mildmate.com/api/auth/me"),
      fakeEnv()
    );
    expect(res.valid).toBe(false);
    if (!res.valid) expect(res.status).toBe(503);
  });
});
