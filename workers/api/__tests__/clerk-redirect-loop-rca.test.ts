// RCA reproduction tests — Clerk redirect loop after hardening (20aacf5).
// READ-ONLY investigation artifact: exercises the REAL middleware onRequest
// handlers (previous-production snapshot vs hardened HEAD) against synthetic
// browser states. No network, no production tokens — all JWTs are generated
// and signed locally; JWKS + Clerk Backend API fetches are stubbed.
//
// Cookie-jar model: real browsers keep HOST-scoped and DOMAIN-scoped cookies
// of the same name as SEPARATE entries and send BOTH. A Set-Cookie with a
// Domain attribute only replaces the domain-scoped entry — this is how a
// conflicting duplicate __session can persist across Clerk handshakes.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Locate the previous-production snapshot middleware by walking up from this
// test file, so the suite runs identically in the main tree AND inside an
// isolated release-candidate copy of the repo.
function findOldAdminMiddleware(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, ".release-order-acquisition", "functions", "admin", "_middleware.ts");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("previous-production snapshot (.release-order-acquisition) not found above test dir");
}

function findFileAbove(relative: string): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, relative);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`${relative} not found above test dir`);
}

const PROD_ISSUER = "https://clerk.mildmate.com";
const PROD_JWKS = "https://clerk.mildmate.com/.well-known/jwks.json";
const OWNER_EMAIL = "owner@mildmate.com";
const ADMIN_URL = "https://www.mildmate.com/admin/templates";

// ── crypto helpers ──────────────────────────────────────────────────────────

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

async function signJwt(kp: CryptoKeyPair, kid: string, header: any, payload: any): Promise<string> {
  const h = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const p = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signed = new TextEncoder().encode(`${h}.${p}`);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kp.privateKey, signed);
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
}

// ── cookie jar (dual-scope browser model) ───────────────────────────────────

interface JarEntry { scope: "host" | "domain"; name: string; value: string }

class CookieJar {
  entries: JarEntry[] = [];
  header(): string {
    return this.entries.filter((e) => e.value !== "").map((e) => `${e.name}=${e.value}`).join("; ");
  }
  apply(setCookie: string) {
    const first = setCookie.split(";")[0] || "";
    const eq = first.indexOf("=");
    if (eq <= 0) return;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    const lower = setCookie.toLowerCase();
    const scope: "host" | "domain" = lower.includes("domain=") ? "domain" : "host";
    const existing = this.entries.find((e) => e.scope === scope && e.name === name);
    if (existing) existing.value = value;
    else this.entries.push({ scope, name, value });
    this.entries = this.entries.filter((e) => e.value !== "");
  }
  applyAll(resp: Response) {
    const list = (resp.headers as any).getSetCookie ? (resp.headers as any).getSetCookie() : [resp.headers.get("Set-Cookie")];
    for (const c of list || []) if (c) this.apply(String(c));
  }
  values(name: string): string[] {
    return this.entries.filter((e) => e.name === name).map((e) => e.value);
  }
}

// ── middleware harness (request → response, with simulated Clerk bounce) ────

type Middleware = (context: any) => Promise<Response>;

function makeContext(url: string, cookieHeader: string, env: any) {
  const request = new Request(url, {
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  });
  return {
    request,
    env,
    next: async () => new Response("OK-PROTECTED", { status: 200 }),
  };
}

/** Is this URL the Clerk sign-in portal? */
function isSignInRedirect(resp: Response): boolean {
  if (resp.status !== 302) return false;
  const loc = resp.headers.get("Location") || "";
  return loc.includes("accounts.mildmate.com/sign-in");
}

/**
 * Simulate the full browser round-trip:
 * handler → (302 sign-in) → Clerk sees a signed-in user → 302 back with a
 * FRESH __clerk_handshake query token → handler again … until a terminal
 * response or maxHops. isSuccess marks a non-loop terminal outcome.
 */
async function simulate(mw: Middleware, env: any, jar: CookieJar, startUrl: string, maxHops = 6, isSuccess?: (resp: Response) => boolean) {
  let url = startUrl;
  const trace: string[] = [];
  for (let hop = 0; hop < maxHops; hop++) {
    const resp = await mw(makeContext(url, jar.header(), env));
    trace.push(`${resp.status} ${url}${jar.header() ? ` [jar: ${jar.header()}]` : ""}`);
    if (isSuccess && isSuccess(resp)) return { terminal: resp, trace };
    if (isSignInRedirect(resp)) {
      // Browsers apply Set-Cookie on EVERY response — including the redirect
      // to the sign-in portal (this is how conflict clears take effect).
      jar.applyAll(resp);
      // Clerk-side: owner has a live Clerk session, so the portal immediately
      // bounces back through the FAPI handshake with a fresh token.
      const loc = new URL(resp.headers.get("Location")!);
      const returnUrl = new URL(loc.searchParams.get("redirect_url")!);
      const freshHandshake = await makeHandshakeJwt();
      returnUrl.searchParams.set("__clerk_handshake", freshHandshake);
      url = returnUrl.toString();
      continue;
    }
    jar.applyAll(resp);
    const loc = resp.headers.get("Location");
    if (resp.status === 302 && loc) {
      url = new URL(loc, url).toString();
      continue;
    }
    return { terminal: resp, trace };
  }
  return { terminal: null, trace };
}

// ── shared state per test ───────────────────────────────────────────────────

let prodKp: CryptoKeyPair;
let staleKp: CryptoKeyPair;
let now: number;
let env: any;
let validToken: string;
let hardenedMw: Middleware;
let oldMw: Middleware;
let clerkReturn: Middleware;
let nextHandshakeSeq = 0;

async function makeHandshakeJwt(): Promise<string> {
  // Fresh handshake minted by the real Clerk instance: session directive +
  // handshake-cookie clearing directive. `cat` intentionally omitted —
  // matches Clerk SDK parity (typ may be omitted, cat undefined = session-ish).
  // The session directive uses Clerk's SUFFIXED cookie name, mirroring the
  // owner's Nov-3 evidence (__session_whv9OBe3 alongside __session).
  const expires = new Date(Date.now() - 1000).toUTCString();
  const payload = {
    iss: PROD_ISSUER,
    exp: Math.floor(Date.now() / 1000) + 120,
    handshake: [
      `__session_whv9OBe3=${validToken}; Path=/; Domain=mildmate.com; Secure; HttpOnly`,
      `__clerk_handshake=; Path=/; Domain=mildmate.com; Expires=${expires}`,
    ],
  };
  return signJwt(prodKp, "prod-kid", { alg: "RS256", kid: "prod-kid", typ: "JWT" }, payload);
}

beforeEach(async () => {
  vi.resetModules();
  prodKp = await generateKeyPair();
  staleKp = await generateKeyPair();
  now = Math.floor(Date.now() / 1000);

  const prodJwk = await crypto.subtle.exportKey("jwk", prodKp.publicKey);
  const jwks = { keys: [{ kid: "prod-kid", kty: "RSA", alg: "RS256", n: (prodJwk as any).n, e: (prodJwk as any).e, use: "sig" }] };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url) === PROD_JWKS) return { ok: true, json: async () => jwks } as unknown as Response;
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch);

  env = {
    CLERK_ISSUER: PROD_ISSUER,
    CLERK_JWKS_URL: PROD_JWKS,
    ADMIN_EMAILS: OWNER_EMAIL,
  };

  validToken = await signJwt(prodKp, "prod-kid", { alg: "RS256", kid: "prod-kid" }, {
    sub: "user_owner", iss: PROD_ISSUER, exp: now + 300, email: OWNER_EMAIL, role: "admin",
  });

  ({ onRequest: hardenedMw } = await import("../../../functions/admin/_middleware"));
  ({ onRequest: oldMw } = await import(pathToFileURL(findOldAdminMiddleware()).href));
  ({ onRequest: clerkReturn } = await import(pathToFileURL(findFileAbove(join("functions", "auth", "clerk-return", "[[path]].ts")))));

  nextHandshakeSeq = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── tests ───────────────────────────────────────────────────────────────────

describe("RCA: Clerk redirect loop after hardening (20aacf5)", () => {
  it("T1 baseline: valid single __session authenticates on BOTH old and hardened", async () => {
    for (const [label, mw] of [["old", oldMw], ["hardened", hardenedMw]] as const) {
      const jar = new CookieJar();
      jar.entries.push({ scope: "host", name: "__session", value: validToken });
      const { terminal, trace } = await simulate(mw, env, jar, ADMIN_URL);
      expect(terminal, `${label}: ${trace.join(" | ")}`).not.toBeNull();
      expect(terminal!.status, `${label}: ${trace.join(" | ")}`).toBe(200);
    }
  });

  it("T2 OLD middleware: two conflicting __session cookies still authenticates (first match)", async () => {
    const staleToken = await signJwt(staleKp, "stale-kid", { alg: "RS256", kid: "stale-kid" }, {
      sub: "user_owner", iss: PROD_ISSUER, exp: now + 300, email: OWNER_EMAIL, role: "admin",
    });
    const jar = new CookieJar();
    jar.entries.push({ scope: "domain", name: "__session", value: validToken }); // sent first
    jar.entries.push({ scope: "host", name: "__session", value: staleToken });   // stale shadow
    const { terminal, trace } = await simulate(oldMw, env, jar, ADMIN_URL);
    expect(terminal, trace.join(" | ")).not.toBeNull();
    expect(terminal!.status, trace.join(" | ")).toBe(200);
  });

  it("T3 HARDENED middleware (POST-FIX): conflicting __session cookies resolve to the one valid candidate — no loop", async () => {
    const staleToken = await signJwt(staleKp, "stale-kid", { alg: "RS256", kid: "stale-kid" }, {
      sub: "user_owner", iss: PROD_ISSUER, exp: now + 300, email: OWNER_EMAIL, role: "admin",
    });
    const jar = new CookieJar();
    jar.entries.push({ scope: "domain", name: "__session", value: validToken });
    jar.entries.push({ scope: "host", name: "__session", value: staleToken });
    const { terminal, trace } = await simulate(hardenedMw, env, jar, ADMIN_URL, 8);
    // Before the fix this looped forever (ambiguous → sign-in → handshake →
    // stale host-scoped cookie survived → ambiguous …). Candidate verification
    // now authenticates the exactly-one-valid candidate.
    expect(terminal, `MUST AUTHENTICATE: ${trace.join(" | ")}`).not.toBeNull();
    expect(terminal!.status, trace.join(" | ")).toBe(200);
  });

  it("T4 HARDENED middleware: non-conflicting state + fresh handshake resolves cleanly (no loop)", async () => {
    const jar = new CookieJar();
    jar.entries.push({ scope: "host", name: "__session", value: validToken });
    const { terminal, trace } = await simulate(hardenedMw, env, jar, ADMIN_URL);
    expect(terminal, trace.join(" | ")).not.toBeNull();
    expect(terminal!.status, trace.join(" | ")).toBe(200);
  });

  it("T5 stale handshake cookie + fresh query handshake (mismatch): BOTH middlewares fall through to sign-in (not the regression)", async () => {
    const staleHandshake = await signJwt(staleKp, "stale-kid", { alg: "RS256", kid: "stale-kid", typ: "JWT" }, {
      iss: PROD_ISSUER, exp: now + 120, handshake: [`__session=x; Path=/`],
    });
    for (const [label, mw] of [["old", oldMw], ["hardened", hardenedMw]] as const) {
      const jar = new CookieJar();
      jar.entries.push({ scope: "host", name: "__clerk_handshake", value: staleHandshake });
      const url = `${ADMIN_URL}?__clerk_handshake=${await makeHandshakeJwt()}`;
      const resp = await mw(makeContext(url, jar.header(), env));
      // Ambiguity → token rejected → no session → sign-in redirect (both).
      expect(resp.status, label).toBe(302);
      expect(isSignInRedirect(resp), label).toBe(true);
    }
  });

  it("T6 conflicting credentials, ALL invalid: rejected up front, then safe handshake recovery (no loop)", async () => {
    const bad1 = await signJwt(staleKp, "bad-kid-1", { alg: "RS256", kid: "bad-kid-1" }, {
      sub: "attacker", iss: PROD_ISSUER, exp: now + 300, email: "attacker@evil.com", role: "admin",
    });
    const bad2 = await signJwt(staleKp, "bad-kid-2", { alg: "RS256", kid: "bad-kid-2" }, {
      sub: "attacker", iss: PROD_ISSUER, exp: now + 300, email: "attacker@evil.com", role: "admin",
    });
    const jar = new CookieJar();
    jar.entries.push({ scope: "domain", name: "__session", value: bad1 });
    jar.entries.push({ scope: "host", name: "__session", value: bad2 });
    // First response must be a rejection (zero valid candidates):
    const first = await hardenedMw(makeContext(ADMIN_URL, jar.header(), env));
    expect(first.status).toBe(302);
    expect(isSignInRedirect(first)).toBe(true);
    // Full round-trip: Clerk's fresh handshake re-mints a valid session →
    // exactly one valid candidate → authenticated. Safe recovery, no loop.
    const { terminal, trace } = await simulate(hardenedMw, env, jar, ADMIN_URL, 8);
    expect(terminal, `SAFE RECOVERY EXPECTED: ${trace.join(" | ")}`).not.toBeNull();
    expect(terminal!.status, trace.join(" | ")).toBe(200);
  });

  it("T7 TWO DISTINCT VALID candidates (two real identities) are rejected — never auto-chosen", async () => {
    // Both tokens fully verify cryptographically (both keys in the JWKS) but
    // belong to different identities — the middleware must not pick one.
    const secondKp = await generateKeyPair();
    const secondJwk = await crypto.subtle.exportKey("jwk", secondKp.publicKey);
    // Extend the stubbed JWKS with the second key.
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url) === PROD_JWKS) {
        const first = await crypto.subtle.exportKey("jwk", prodKp.publicKey);
        return {
          ok: true,
          json: async () => ({
            keys: [
              { kid: "prod-kid", kty: "RSA", alg: "RS256", n: (first as any).n, e: (first as any).e, use: "sig" },
              { kid: "second-kid", kty: "RSA", alg: "RS256", n: (secondJwk as any).n, e: (secondJwk as any).e, use: "sig" },
            ],
          }),
        } as unknown as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const ownerToken = validToken; // signed by prod-kid (owner identity)
    const secondToken = await signJwt(secondKp, "second-kid", { alg: "RS256", kid: "second-kid" }, {
      sub: "user_other", iss: PROD_ISSUER, exp: now + 300, email: "other@mildmate.com", role: "admin",
    });
    const jar = new CookieJar();
    jar.entries.push({ scope: "domain", name: "__session", value: ownerToken });
    jar.entries.push({ scope: "host", name: "__session", value: secondToken });
    const resp = await hardenedMw(makeContext(ADMIN_URL, jar.header(), env));
    // Rejected: two distinct valid candidates → no authentication, sign-in redirect.
    expect(resp.status).toBe(302);
    expect(isSignInRedirect(resp)).toBe(true);
  });

  it("T8 candidate cap: over the bounded limit the state is rejected, never partially examined", async () => {
    // 9 distinct fully-signed session tokens — over the extraction cap.
    const extraKp = await generateKeyPair();
    const extraJwk = await crypto.subtle.exportKey("jwk", extraKp.publicKey);
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url) === PROD_JWKS) {
        const first = await crypto.subtle.exportKey("jwk", prodKp.publicKey);
        return {
          ok: true,
          json: async () => ({
            keys: [
              { kid: "prod-kid", kty: "RSA", alg: "RS256", n: (first as any).n, e: (first as any).e, use: "sig" },
              { kid: "extra-kid", kty: "RSA", alg: "RS256", n: (extraJwk as any).n, e: (extraJwk as any).e, use: "sig" },
            ],
          }),
        } as unknown as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const tokens: string[] = [validToken];
    for (let i = 0; i < 8; i++) {
      tokens.push(await signJwt(extraKp, "extra-kid", { alg: "RS256", kid: "extra-kid" }, {
        sub: `user_x${i}`, iss: PROD_ISSUER, exp: now + 300, email: OWNER_EMAIL, role: "admin",
      }));
    }
    const jar = new CookieJar();
    jar.entries.push({ scope: "domain", name: "__session", value: tokens[0] });
    for (let i = 1; i < tokens.length; i++) {
      jar.entries.push({ scope: "host", name: `__session_x${i}`, value: tokens[i] });
    }
    const resp = await hardenedMw(makeContext(ADMIN_URL, jar.header(), env));
    expect(resp.status).toBe(302);
    expect(isSignInRedirect(resp)).toBe(true);
  });

  // ── Nov-3 loop: /auth/clerk-return + Clerk's suffixed session cookies ────

  it("T9 clerk-return + suffixed handshake cookie: two distinct valid candidates resolve without looping", async () => {
    // Owner state: plain __session (earlier session) + suffixed
    // __session_whv9OBe3 (Clerk FAPI) — two different, both-valid tokens.
    const secondKp = await generateKeyPair();
    const secondJwk = await crypto.subtle.exportKey("jwk", secondKp.publicKey);
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url) === PROD_JWKS) {
        const first = await crypto.subtle.exportKey("jwk", prodKp.publicKey);
        return {
          ok: true,
          json: async () => ({
            keys: [
              { kid: "prod-kid", kty: "RSA", alg: "RS256", n: (first as any).n, e: (first as any).e, use: "sig" },
              { kid: "second-kid", kty: "RSA", alg: "RS256", n: (secondJwk as any).n, e: (secondJwk as any).e, use: "sig" },
            ],
          }),
        } as unknown as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const secondToken = await signJwt(secondKp, "second-kid", { alg: "RS256", kid: "second-kid" }, {
      sub: "user_owner_2", iss: PROD_ISSUER, exp: now + 300, email: OWNER_EMAIL, role: "admin",
    });

    const jar = new CookieJar();
    jar.entries.push({ scope: "host", name: "__session", value: validToken });
    jar.entries.push({ scope: "domain", name: "__session_whv9OBe3", value: secondToken });
    const { terminal, trace } = await simulate(
      clerkReturn, env, jar, "https://www.mildmate.com/auth/clerk-return/?next=%2Fsuper-admin%2F", 8,
      (resp) => resp.status === 302 && (resp.headers.get("Location") || "").includes("/super-admin"),
    );
    // POST-FIX: the conflict is cleared, Clerk re-mints ONE suffixed session,
    // and the callback completes to the next path — no loop.
    expect(terminal, `MUST RESOLVE: ${trace.join(" | ")}`).not.toBeNull();
    expect(terminal!.status, trace.join(" | ")).toBe(302);
    expect(terminal!.headers.get("Location"), trace.join(" | ")).toContain("/super-admin");
    // Exactly one live session cookie remains — the conflict cannot regenerate.
    expect(jar.values("__session").length + jar.values("__session_whv9OBe3").length, trace.join(" | ")).toBe(1);
  });

  it("T10 clerk-return: conflicting cookies are CLEARED on rejection (host + domain scopes)", async () => {
    const secondKp = await generateKeyPair();
    const secondJwk = await crypto.subtle.exportKey("jwk", secondKp.publicKey);
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url) === PROD_JWKS) {
        const first = await crypto.subtle.exportKey("jwk", prodKp.publicKey);
        return {
          ok: true,
          json: async () => ({
            keys: [
              { kid: "prod-kid", kty: "RSA", alg: "RS256", n: (first as any).n, e: (first as any).e, use: "sig" },
              { kid: "second-kid", kty: "RSA", alg: "RS256", n: (secondJwk as any).n, e: (secondJwk as any).e, use: "sig" },
            ],
          }),
        } as unknown as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const secondToken = await signJwt(secondKp, "second-kid", { alg: "RS256", kid: "second-kid" }, {
      sub: "user_owner_2", iss: PROD_ISSUER, exp: now + 300, email: OWNER_EMAIL, role: "admin",
    });

    const jar = new CookieJar();
    jar.entries.push({ scope: "host", name: "__session", value: validToken });
    jar.entries.push({ scope: "domain", name: "__session_whv9OBe3", value: secondToken });
    const resp = await clerkReturn(makeContext(
      "https://www.mildmate.com/auth/clerk-return/?next=%2Fsuper-admin%2F", jar.header(), env));
    // Rejection is still a rejection (two valid identities are never auto-chosen)…
    expect(resp.status).toBe(302);
    expect(isSignInRedirect(resp)).toBe(true);
    // …but it CARRIES the clearing directives for every conflicting name in
    // both scopes, so the next Clerk bounce starts clean.
    const setCookies = (resp.headers as any).getSetCookie ? (resp.headers as any).getSetCookie() : [];
    const clearedNames = new Set((setCookies as string[])
      .filter((c) => /expires=thu, 01 jan 1970/i.test(c))
      .map((c) => c.split("=")[0].trim()));
    expect(clearedNames.has("__session")).toBe(true);
    expect(clearedNames.has("__session_whv9OBe3")).toBe(true);
  });
});
