// Regression tests for __clerk_handshake consumption in the gated middlewares.
//
// Bundles the real middlewares (which import workers/api/clerk-handshake.ts
// and clerk-verify.ts) and drives them with real RS256-signed handshake and
// session JWTs against a mocked JWKS endpoint. Covers: valid sessions,
// expired sessions, signed-out handshakes, invalid signatures, malformed /
// hostile directives, wrong issuer, query-param delivery, and admin
// authorization preservation.
// Run: node scripts/test-handshake-consume.mjs
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

function bundle(entry) {
  const outfile = join(tmpdir(), `mm-hsc-${entry.replace(/[\\/]/g, '_')}-${Date.now()}.mjs`);
  execSync(
    `npx esbuild ${entry} --bundle --format=esm --platform=neutral --outfile="${outfile}" --log-level=silent`,
    { stdio: 'inherit' }
  );
  return import(pathToFileURL(outfile).href);
}

const account = await bundle('functions/account/_middleware.ts');
const admin = await bundle('functions/admin/_middleware.ts');

// ── Keypairs: real instance key + an attacker key ──
const KID = 'test-key';
const ISSUER = 'https://clerk.test';
const JWKS_URL = 'https://clerk.test/jwks';

async function makeKeypair() {
  return crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify']
  );
}
const instance = await makeKeypair();
const attacker = await makeKeypair();
const pubJwk = await crypto.subtle.exportKey('jwk', instance.publicKey);
const JWKS = { keys: [{ ...pubJwk, kid: KID, alg: 'RS256', use: 'sig' }] };

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload, privateKey = instance.privateKey, kid = KID) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(new Uint8Array(sig))}`;
}

const now = () => Math.floor(Date.now() / 1000);
async function mintSession(claims = {}, key) {
  return sign({
    sub: 'user_test', iss: ISSUER, iat: now() - 300, exp: now() + 300,
    sid: 'sess_test', azp: 'https://www.mildmate.com', ...claims,
  }, key);
}
async function mintHandshake(directives, key, extra = {}) {
  return sign({ handshake: directives, ...extra }, key);
}

globalThis.fetch = async (url) => {
  if (String(url) === JWKS_URL) {
    return new Response(JSON.stringify(JWKS), { headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error('unexpected network call: ' + url);
};

const dbStub = {
  prepare: () => ({
    bind: () => ({ first: async () => ({ cnt: 0 }), run: async () => ({}), all: async () => ({ results: [] }) }),
    all: async () => ({ results: [] }), run: async () => ({}),
  }),
};
const baseEnv = {
  DB: dbStub, CLERK_ISSUER: ISSUER, CLERK_JWKS_URL: JWKS_URL,
  CLERK_ACCOUNTS_DOMAIN: 'accounts.test', ADMIN_EMAILS: 'admin@test.com',
};

function ctx(url, cookies, env = baseEnv) {
  const headers = {};
  if (cookies) headers.Cookie = cookies;
  return {
    request: new Request(url, { headers }),
    env,
    next: async () => new Response('PAGE', { status: 200, headers: { 'Content-Type': 'text/html' } }),
  };
}

function freshDirectives(sessionJwt) {
  return [
    '__clerk_handshake=; Path=/; Domain=mildmate.com; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
    '__client_uat=1761000000; Path=/; Domain=mildmate.com; Max-Age=315360000; Secure; SameSite=Lax',
    `__session=${sessionJwt}; Path=/; Domain=mildmate.com; Max-Age=70; Secure; SameSite=Lax`,
  ];
}
const SIGNED_OUT_DIRECTIVES = [
  '__clerk_handshake=; Path=/; Domain=mildmate.com; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
  '__client_uat=0; Path=/; Domain=mildmate.com; Max-Age=315360000; Secure; SameSite=Lax',
  '__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax',
];

const ACCOUNT_URL = 'https://www.mildmate.com/account/?__mm_hs=1';
const ADMIN_URL = 'https://www.mildmate.com/super-admin/?__mm_hs=1';

const validSession = await mintSession();
const expiredSession = await mintSession({ exp: now() - 120 });

let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log(`PASS  ${name}`); }
const setCookies = (res) => res.headers.getSetCookie ? res.headers.getSetCookie() : [];

// ── Handshake refresh: happy path ──
await check('account: handshake with fresh valid session → 302 clean URL + validated Set-Cookies', async () => {
  const hs = await mintHandshake(freshDirectives(validSession));
  const res = await account.onRequest(ctx(ACCOUNT_URL, `__session=${expiredSession}; __clerk_handshake=${hs}`));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://www.mildmate.com/account/');
  const sc = setCookies(res);
  assert.ok(sc.some((c) => c.startsWith(`__session=${validSession};`) && c.includes('Domain=mildmate.com')), 'fresh __session applied');
  assert.ok(sc.some((c) => c.startsWith('__clerk_handshake=;')), 'handshake cookie cleared');
  assert.ok(sc.some((c) => c.startsWith('__client_uat=1761000000;')), 'client_uat applied');
});

await check('account: handshake via query param also consumed', async () => {
  const hs = await mintHandshake(freshDirectives(validSession));
  const res = await account.onRequest(ctx(`https://www.mildmate.com/account/?__mm_hs=1&__clerk_handshake=${hs}`, `__session=${expiredSession}`));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://www.mildmate.com/account/');
  assert.ok(setCookies(res).some((c) => c.startsWith(`__session=${validSession};`)));
});

// ── Signed-out handshake ──
await check('account: signed-out handshake → sign-in redirect, clearing cookies only', async () => {
  const hs = await mintHandshake(SIGNED_OUT_DIRECTIVES);
  const res = await account.onRequest(ctx(ACCOUNT_URL, `__session=${expiredSession}; __clerk_handshake=${hs}`));
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('location').startsWith('https://accounts.test/sign-in?'));
  const sc = setCookies(res);
  assert.ok(sc.some((c) => c.startsWith('__session=;')), 'session cleared');
  assert.ok(!sc.some((c) => /^__session=.+[^;]/.test(c) && !c.startsWith('__session=;')), 'no session minted');
});

// ── Invalid / hostile handshakes ──
await check('account: handshake signed by attacker key → ignored, falls back to sign-in (marker guard)', async () => {
  const hs = await mintHandshake(freshDirectives(validSession), attacker.privateKey);
  const res = await account.onRequest(ctx(ACCOUNT_URL, `__session=${expiredSession}; __clerk_handshake=${hs}`));
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('location').includes('accounts.test/sign-in'));
  assert.equal(setCookies(res).length, 0, 'no cookies applied from unverified handshake');
});

await check('account: handshake with wrong iss claim → ignored', async () => {
  const hs = await mintHandshake(freshDirectives(validSession), instance.privateKey, { iss: 'https://clerk.evil.test' });
  const res = await account.onRequest(ctx(ACCOUNT_URL, `__session=${expiredSession}; __clerk_handshake=${hs}`));
  assert.ok(res.headers.get('location').includes('accounts.test/sign-in'));
  assert.equal(setCookies(res).length, 0);
});

await check('account: expired handshake JWT (exp claim) → ignored', async () => {
  const hs = await mintHandshake(freshDirectives(validSession), instance.privateKey, { exp: now() - 60 });
  const res = await account.onRequest(ctx(ACCOUNT_URL, `__session=${expiredSession}; __clerk_handshake=${hs}`));
  assert.ok(res.headers.get('location').includes('accounts.test/sign-in'));
  assert.equal(setCookies(res).length, 0);
});

await check('account: malformed payload (handshake not an array) → ignored', async () => {
  const hs = await sign({ handshake: 'not-an-array' });
  const res = await account.onRequest(ctx(ACCOUNT_URL, `__session=${expiredSession}; __clerk_handshake=${hs}`));
  assert.ok(res.headers.get('location').includes('accounts.test/sign-in'));
  assert.equal(setCookies(res).length, 0);
});

await check('account: hostile directives are never forwarded (name whitelist + domain scope)', async () => {
  const hs = await mintHandshake([
    'admin_secret=1; Path=/; Domain=mildmate.com',                       // forbidden name
    '__client_uat=1; Path=/; Domain=evil.com',                           // foreign domain
    '__session=inj\r\nSet-Cookie: pwn=1; Path=/; Domain=mildmate.com',   // header injection attempt
    ...freshDirectives(validSession),
  ]);
  const res = await account.onRequest(ctx(ACCOUNT_URL, `__session=${expiredSession}; __clerk_handshake=${hs}`));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://www.mildmate.com/account/');
  const sc = setCookies(res);
  assert.ok(!sc.some((c) => c.includes('admin_secret') || c.includes('evil.com') || c.includes('pwn=')), 'hostile directives dropped');
  assert.ok(sc.some((c) => c.startsWith(`__session=${validSession};`)), 'legitimate refresh still applied');
});

await check('account: handshake carrying an EXPIRED refreshed session → sign-in, no session cookie set', async () => {
  const hs = await mintHandshake(freshDirectives(expiredSession));
  const res = await account.onRequest(ctx(ACCOUNT_URL, `__session=${expiredSession}; __clerk_handshake=${hs}`));
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('location').includes('accounts.test/sign-in'));
  const sc = setCookies(res);
  assert.ok(!sc.some((c) => c.startsWith('__session=') && !c.startsWith('__session=;')), 'unverified session never set');
  assert.ok(sc.every((c) => c.startsWith('__clerk_handshake=;')), 'only handshake clear applied');
});

await check('account: handshake carrying wrong-issuer refreshed session → rejected', async () => {
  const foreign = await mintSession({ iss: 'https://clerk.evil.test' });
  const hs = await mintHandshake(freshDirectives(foreign));
  const res = await account.onRequest(ctx(ACCOUNT_URL, `__session=${expiredSession}; __clerk_handshake=${hs}`));
  assert.ok(res.headers.get('location').includes('accounts.test/sign-in'));
  assert.ok(!setCookies(res).some((c) => c.startsWith('__session=e')), 'foreign session never set');
});

// ── Existing flows preserved ──
await check('account: valid session, no handshake → page served (unchanged)', async () => {
  const res = await account.onRequest(ctx('https://www.mildmate.com/account/', `__session=${validSession}`));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'PAGE');
});

await check('account: expired session, no handshake, no marker → FAPI handshake redirect (unchanged)', async () => {
  const res = await account.onRequest(ctx('https://www.mildmate.com/account/', `__session=${expiredSession}`));
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, 'https://clerk.test/v1/client/handshake');
});

// ── Admin middleware: same consumption + gates preserved ──
await check('admin: handshake with fresh valid session → 302 clean URL (gates re-run on retry)', async () => {
  const hs = await mintHandshake(freshDirectives(validSession));
  const res = await admin.onRequest(ctx(ADMIN_URL, `__session=${expiredSession}; __clerk_handshake=${hs}`));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://www.mildmate.com/super-admin/');
  assert.ok(setCookies(res).some((c) => c.startsWith(`__session=${validSession};`)));
});

await check('admin: refreshed-but-roleless session on retry → 403 (AND gate preserved)', async () => {
  const res = await admin.onRequest(ctx('https://www.mildmate.com/super-admin/', `__session=${validSession}`));
  assert.equal(res.status, 403);
  assert.ok((await res.text()).includes('does not have admin access'));
});

await check('admin: refreshed session with role + allowlisted email → page served', async () => {
  const jwt = await mintSession({ role: 'super-admin', email: 'admin@test.com' });
  const res = await admin.onRequest(ctx('https://www.mildmate.com/super-admin/', `__session=${jwt}`));
  assert.equal(res.status, 200);
});

await check('admin: denylisted email with role → 403 blocked (denylist preserved)', async () => {
  const jwt = await mintSession({ role: 'super-admin', email: 'mildmateshop@gmail.com' });
  const res = await admin.onRequest(ctx('https://www.mildmate.com/super-admin/', `__session=${jwt}`, { ...baseEnv, ADMIN_EMAILS: 'mildmateshop@gmail.com' }));
  assert.equal(res.status, 403);
  assert.ok((await res.text()).includes('does not have super-admin access'));
});

await check('admin: signed-out handshake → sign-in redirect (unauthorized cannot reach gates)', async () => {
  const hs = await mintHandshake(SIGNED_OUT_DIRECTIVES);
  const res = await admin.onRequest(ctx(ADMIN_URL, `__session=${expiredSession}; __clerk_handshake=${hs}`));
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('location').startsWith('https://accounts.test/sign-in?'));
});

console.log(`\nAll ${passed} handshake-consumption regression tests passed.`);
