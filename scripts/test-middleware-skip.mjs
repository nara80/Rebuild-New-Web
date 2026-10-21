// Regression tests for functions/_middleware.ts SKIP_PREFIXES path handling.
// Verifies bare /admin and /super-admin responses are NOT post-processed
// (no injected site chrome on Access Denied pages), while normal pages
// still receive header/footer injection.
// Run: node scripts/test-middleware-skip.mjs
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const outfile = join(tmpdir(), `mildmate-middleware-test-${Date.now()}.mjs`);
execSync(
  `npx esbuild functions/_middleware.ts --bundle --format=esm --platform=neutral --outfile="${outfile}" --log-level=silent`,
  { stdio: 'inherit' }
);
const { onRequest } = await import(pathToFileURL(outfile).href);

const ACCESS_DENIED_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Access Denied — MildMate</title></head>
<body><div><h1>Access Denied</h1><p>test@example.com does not have admin access.</p><a href="/">Go to Homepage</a></div></body></html>`;

const PLAIN_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>About — MildMate</title></head>
<body><main><h1>About MildMate</h1></main></body></html>`;

// Minimal D1 stub: empty template cache → middleware falls back to embedded chrome.
const dbStub = {
  prepare: () => ({
    all: async () => ({ results: [] }),
    bind: () => ({ all: async () => ({ results: [] }) }),
  }),
};

function makeContext(url, html, status) {
  return {
    request: new Request(url),
    env: { DB: dbStub },
    next: async () =>
      new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  };
}

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS  ${name}`);
}

// Regression: bare /super-admin previously received injected fallback chrome
// (duplicated navigation + unstyled oversized SVG icons) on the 403 page.
await check('bare /super-admin 403 is untouched (no injected chrome)', async () => {
  const res = await onRequest(makeContext('https://www.mildmate.com/super-admin', ACCESS_DENIED_HTML, 403));
  const body = await res.text();
  assert.equal(res.status, 403);
  assert.ok(!body.includes('site-header'), 'header chrome must not be injected');
  assert.ok(!body.includes('site-footer'), 'footer chrome must not be injected');
  assert.equal(body, ACCESS_DENIED_HTML, 'body must pass through unmodified');
});

await check('bare /admin 403 is untouched (no injected chrome)', async () => {
  const res = await onRequest(makeContext('https://www.mildmate.com/admin', ACCESS_DENIED_HTML, 403));
  const body = await res.text();
  assert.equal(res.status, 403);
  assert.equal(body, ACCESS_DENIED_HTML);
});

await check('/super-admin/ (trailing slash) stays skipped as before', async () => {
  const res = await onRequest(makeContext('https://www.mildmate.com/super-admin/', ACCESS_DENIED_HTML, 403));
  const body = await res.text();
  assert.equal(body, ACCESS_DENIED_HTML);
});

// Narrow-scope guards: unrelated routes keep existing behavior.
await check('normal page (/about/) still receives chrome injection', async () => {
  const res = await onRequest(makeContext('https://www.mildmate.com/about/', PLAIN_PAGE_HTML, 200));
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.ok(body.includes('site-header'), 'header chrome must be injected on normal pages');
  assert.ok(body.includes('site-footer'), 'footer chrome must be injected on normal pages');
});

await check('path merely sharing a prefix word (/administrators/) is NOT skipped', async () => {
  const res = await onRequest(makeContext('https://www.mildmate.com/administrators/', PLAIN_PAGE_HTML, 200));
  const body = await res.text();
  assert.ok(body.includes('site-header'), 'lookalike paths must still get chrome');
});

console.log(`\nAll ${passed} middleware skip regression tests passed.`);
