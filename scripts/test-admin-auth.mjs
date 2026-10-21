// Regression tests for workers/api/admin-auth.ts role/allowlist/denylist logic.
// Bundles the real TS module with esbuild, then asserts behavior offline.
// Run: node scripts/test-admin-auth.mjs
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const outfile = join(tmpdir(), `mildmate-admin-auth-test-${Date.now()}.mjs`);
execSync(
  `npx esbuild workers/api/admin-auth.ts --bundle --format=esm --platform=neutral --outfile="${outfile}" --log-level=silent`,
  { stdio: 'inherit' }
);
const { collectRoles, hasAdminRole, emailAllowed, emailBlocked } = await import(pathToFileURL(outfile).href);

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
}

// ── collectRoles / hasAdminRole ──
// Regression: scalar string role used to throw "ReferenceError: x is not defined".
check('string role "super-admin" grants admin (regression: previously threw)', () => {
  assert.equal(hasAdminRole({ role: 'super-admin' }), true);
});
check('string role "admin" grants admin', () => {
  assert.equal(hasAdminRole({ role: 'admin' }), true);
});
check('array roles ["super-admin"] grants admin', () => {
  assert.equal(hasAdminRole({ roles: ['super-admin'] }), true);
});
check('public_metadata.role "super-admin" grants admin (Backend API enrichment shape)', () => {
  assert.equal(hasAdminRole({ public_metadata: { role: 'super-admin' } }), true);
});
check('"super_admin" and "superadmin" variants grant admin', () => {
  assert.equal(hasAdminRole({ role: 'super_admin' }), true);
  assert.equal(hasAdminRole({ role: 'superadmin' }), true);
});
check('role values are lowercased and trimmed', () => {
  assert.deepEqual(collectRoles({ role: '  ADMIN ' }), ['admin']);
});
check('missing roles deny admin', () => {
  assert.equal(hasAdminRole({}), false);
  assert.equal(hasAdminRole({ public_metadata: {} }), false);
});
check('non-admin role denies admin', () => {
  assert.equal(hasAdminRole({ role: 'customer' }), false);
});
check('null/undefined/non-object claims deny admin without throwing', () => {
  assert.equal(hasAdminRole(null), false);
  assert.equal(hasAdminRole(undefined), false);
  assert.equal(hasAdminRole('admin'), false);
});

// ── emailAllowed (ADMIN_EMAILS allowlist) ──
check('email in ADMIN_EMAILS is allowed (case-insensitive, trimmed)', () => {
  const env = { ADMIN_EMAILS: 'x@y.com, Nara19080@Gmail.com' };
  assert.equal(emailAllowed('nara19080@gmail.com', env), true);
});
check('email missing from ADMIN_EMAILS is denied', () => {
  assert.equal(emailAllowed('someone@else.com', { ADMIN_EMAILS: 'x@y.com' }), false);
});
check('empty email / empty allowlist are denied', () => {
  assert.equal(emailAllowed('', { ADMIN_EMAILS: 'x@y.com' }), false);
  assert.equal(emailAllowed('x@y.com', {}), false);
});

// ── emailBlocked (denylist) ──
check('denylisted email is blocked', () => {
  assert.equal(emailBlocked('mildmateshop@gmail.com'), true);
});
check('non-denylisted admin email is not blocked', () => {
  assert.equal(emailBlocked('nara19080@gmail.com'), false);
  assert.equal(emailBlocked(''), false);
});

console.log(`\nAll ${passed} admin-auth regression tests passed.`);
