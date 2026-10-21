// Regression tests for the expired-session handshake repair in
// functions/account/_middleware.ts and functions/admin/_middleware.ts.
//
// Bundles the real middlewares with esbuild and drives them with real
// RS256-signed JWTs against a mocked JWKS endpoint, so the genuine
// verification path (signature → exp → issuer) is exercised offline.
// Run: node scripts/test-middleware-handshake.mjs
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

function bundle(entry) {
  const outfile = join(tmpdir(), `mm-hs-${entry.replace(/[\\/]/g, '_')}-${Date.now()}.mjs`);
  execSync(
    `npx esbuild ${entry} --bundle --format=esm --platform=neutral --outfile="${outfile}" --log-level=silent`,
    { stdio: 'inherit' }
  );
  return import(pathToFileURL(outfile).href);
}

const account = await bundle('functions/account/_middleware.ts');
const admin = await bundle('functions/admin/_middleware.ts');

// ── Test RS256 keypair + JWT minting ──
const KID = 'test-key';
const ISSUER = 'https://clerk.test';
const JWKS_URL = 'https://clerk.test/jwks';

const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify']
);
const pubJwk = await crypto.subtle.exportKey('jwk', publicKey);
const JWKS = { keys: [{ ...pubJwk, kid: KID, alg: 'RS256', use: 'sig' }] };

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function mintJwt(claims) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: KID }));
  const payload = b64url(JSON.stringify({
    sub: 'user_test', iss: ISSUER, iat: now - 300, exp: now + 300,
    sid: 'sess_test', azp: 'https://www.mildmate.com', ...claims,
  }));
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data);
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
}

// ── fetch mock: serve the JWKS, block everything else ──
globalThis.fetch = async (url) => {
  if (String(url) === JWKS_URL) {
    return new Response(JSON.stringify(JWKS), { headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error('unexpected network call: ' + url);
};

// ── Context builder ──
const dbStub = {
  prepare: () => ({
    bind: () => ({
      first: async () => ({ cnt: 0 }),
      run: async () => ({}),
      all: async () => ({ results: [] }),
    }),
    all: async () => ({ results: [] }),
    run: async () => ({}),
  }),
};

const baseEnv = {
  DB: dbStub,
  CLERK_ISSUER: ISSUER,
  CLERK_JWKS_URL: JWKS_URL,
  CLERK_ACCOUNTS_DOMAIN: 'accounts.test',
  ADMIN_EMAILS: 'admin@test.com',
};

function ctx(mod, url, cookieToken, env = baseEnv) {
  const headers = {};
  if (cookieToken) headers.Cookie = `__session=${cookieToken}`;
  return {
    request: new Request(url, { headers }),
    env,
    next: async () => new Response('PAGE', { status: 200, headers: { 'Content-Type': 'text/html' } }),
  };
}

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS  ${name}`);
}

const now = Math.floor(Date.now() / 1000);
const validJwt = await mintJwt({});
const expiredJwt = await mintJwt({ exp: now - 120 });
const wrongIssuerJwt = await mintJwt({ iss: 'https://clerk.evil.test' });
const ACCOUNT_URL = 'https://www.mildmate.com/account/';
const ADMIN_URL = 'https://www.mildmate.com/super-admin/';

// ── Account middleware ──
await check('account: missing token → sign-in redirect (env accounts domain)', async () => {
  const res = await account.onRequest(ctx(account, ACCOUNT_URL, null));
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('location').startsWith('https://accounts.test/sign-in?'), res.headers.get('location'));
});

await check('account: invalid token → sign-in redirect (NOT handshake)', async () => {
  const res = await account.onRequest(ctx(account, ACCOUNT_URL, 'garbage.garbage.garbage'));
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('location').includes('accounts.test/sign-in'));
});

await check('account: expired token → one handshake redirect with marker', async () => {
  const res = await account.onRequest(ctx(account, ACCOUNT_URL, expiredJwt));
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, 'https://clerk.test/v1/client/handshake');
  const back = new URL(loc.searchParams.get('redirect_url'));
  assert.equal(back.origin + back.pathname, 'https://www.mildmate.com/account/');
  assert.equal(back.searchParams.get('__mm_hs'), '1');
});

await check('account: expired token + marker → sign-in redirect (one-shot guard)', async () => {
  const res = await account.onRequest(ctx(account, ACCOUNT_URL + '?__mm_hs=1', expiredJwt));
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('location').includes('accounts.test/sign-in'));
});

await check('account: valid token → page served', async () => {
  const res = await account.onRequest(ctx(account, ACCOUNT_URL, validJwt));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'PAGE');
});

await check('account: valid token + marker → marker stripped via redirect', async () => {
  const res = await account.onRequest(ctx(account, ACCOUNT_URL + '?__mm_hs=1', validJwt));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://www.mildmate.com/account/');
});

await check('account: wrong issuer (valid signature) → sign-in redirect, not handshake', async () => {
  const res = await account.onRequest(ctx(account, ACCOUNT_URL, wrongIssuerJwt));
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('location').includes('accounts.test/sign-in'));
});

// ── Admin middleware ──
await check('admin: missing token → sign-in redirect', async () => {
  const res = await admin.onRequest(ctx(admin, ADMIN_URL, null));
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('location').includes('accounts.test/sign-in'));
});

await check('admin: expired token → one handshake redirect with marker', async () => {
  const res = await admin.onRequest(ctx(admin, ADMIN_URL, expiredJwt));
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, 'https://clerk.test/v1/client/handshake');
  assert.equal(new URL(loc.searchParams.get('redirect_url')).searchParams.get('__mm_hs'), '1');
});

await check('admin: expired token + marker → sign-in redirect (failed handshake falls back)', async () => {
  const res = await admin.onRequest(ctx(admin, ADMIN_URL + '?__mm_hs=1', expiredJwt));
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('location').includes('accounts.test/sign-in'));
});

await check('admin: valid token with role + allowlisted email → page served (AND gate passes)', async () => {
  const jwt = await mintJwt({ role: 'super-admin', email: 'admin@test.com' });
  const res = await admin.onRequest(ctx(admin, ADMIN_URL, jwt));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'PAGE');
});

await check('admin: valid token without role/email → 403 (AND gate preserved)', async () => {
  const res = await admin.onRequest(ctx(admin, ADMIN_URL, validJwt));
  assert.equal(res.status, 403);
  assert.ok((await res.text()).includes('does not have admin access'));
});

await check('admin: valid token, role but email not allowlisted → 403 (AND gate preserved)', async () => {
  const jwt = await mintJwt({ role: 'super-admin', email: 'outsider@test.com' });
  const res = await admin.onRequest(ctx(admin, ADMIN_URL, jwt));
  assert.equal(res.status, 403);
});

await check('admin: valid token, denylisted email with role → 403 blocked variant', async () => {
  const jwt = await mintJwt({ role: 'super-admin', email: 'mildmateshop@gmail.com' });
  const res = await admin.onRequest(ctx(admin, ADMIN_URL, jwt, { ...baseEnv, ADMIN_EMAILS: 'mildmateshop@gmail.com' }));
  assert.equal(res.status, 403);
  assert.ok((await res.text()).includes('does not have super-admin access'));
});

await check('admin: valid admin token + marker → marker stripped via redirect', async () => {
  const jwt = await mintJwt({ role: 'super-admin', email: 'admin@test.com' });
  const res = await admin.onRequest(ctx(admin, ADMIN_URL + '?__mm_hs=1', jwt));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://www.mildmate.com/super-admin/');
});

console.log(`\nAll ${passed} handshake regression tests passed.`);
