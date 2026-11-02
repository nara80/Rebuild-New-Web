// Regression tests for the /account client-side auth gate repair.
//
// Extracts the pure accountGateDecision() function from the real
// public/account/index.html (between __ACCOUNT_GATE_DECISION_START__ /
// __ACCOUNT_GATE_DECISION_END__ markers), evaluates it, and asserts the gate
// decision matrix. Structural checks then assert the page wires the decision
// correctly (late-init recovery listeners, no data loads before the session
// is confirmed, one-shot dev bounce).
// Run: node scripts/test-account-gate.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('public/account/index.html', 'utf8');

// ── Extract and evaluate the pure decision function ──
const m = html.match(/__ACCOUNT_GATE_DECISION_START__([\s\S]*?)\/\/ __ACCOUNT_GATE_DECISION_END__/);
assert.ok(m, 'gate decision markers must exist in public/account/index.html');
const src = m[1].replace(/^.*__ACCOUNT_GATE_DECISION_START__.*$/m, '');
const accountGateDecision = new Function(`${src}; return accountGateDecision;`)();

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
}

// ── Decision matrix ──
check('successful login: user present on production → render', () => {
  assert.equal(accountGateDecision({ hasClerkUser: true, isDevHost: false, alreadyBounced: false }), 'render');
});

check('successful login: user present on dev → render (even after a bounce)', () => {
  assert.equal(accountGateDecision({ hasClerkUser: true, isDevHost: true, alreadyBounced: true }), 'render');
});

check('timeout on production: no user → manual sign-in, never auto-redirect', () => {
  assert.equal(accountGateDecision({ hasClerkUser: false, isDevHost: false, alreadyBounced: false }), 'manual');
});

check('expired-session bounce-back on production: still no user → manual, no loop', () => {
  assert.equal(accountGateDecision({ hasClerkUser: false, isDevHost: false, alreadyBounced: true }), 'manual');
});

check('dev host: no user, first attempt → one auto-redirect allowed', () => {
  assert.equal(accountGateDecision({ hasClerkUser: false, isDevHost: true, alreadyBounced: false }), 'redirect');
});

check('dev host: no user, already bounced → manual (no repeated redirects)', () => {
  assert.equal(accountGateDecision({ hasClerkUser: false, isDevHost: true, alreadyBounced: true }), 'manual');
});

check('delayed initialization recovery: manual state flips to render once user appears', () => {
  const before = accountGateDecision({ hasClerkUser: false, isDevHost: false, alreadyBounced: false });
  const after = accountGateDecision({ hasClerkUser: true, isDevHost: false, alreadyBounced: false });
  assert.equal(before, 'manual');
  assert.equal(after, 'render');
});

// ── Structural wiring ──
check('late-init recovery listeners re-run checkAuth on clerk:ready and clerk:signed-in', () => {
  assert.ok(/addEventListener\('clerk:ready', function \(\) \{ checkAuth\(\); \}\)/.test(html));
  assert.ok(/addEventListener\('clerk:signed-in', function \(\) \{ checkAuth\(\); \}\)/.test(html));
});

check('loading state preserved while Clerk restores the session (10s wait intact)', () => {
  assert.ok(html.includes('setTimeout(resolve, 10000)'));
  assert.ok(html.includes('id="loading-state"'));
});

check('manual state offers a manual Sign in again button', () => {
  assert.ok(html.includes('id="manual-signin-btn"'));
  assert.ok(/manual-signin-btn[^>]*signInWithClerk/.test(html));
});

check('unauthorized/unconfirmed session triggers no customer-data requests', () => {
  const manualFn = html.match(/function showManualSignIn\(\) \{[\s\S]*?\n      \}/);
  assert.ok(manualFn, 'showManualSignIn must exist');
  for (const forbidden of ['loadOrders', 'loadFavorites', 'loadAddresses', 'fetch(', 'getClerkToken']) {
    assert.ok(!manualFn[0].includes(forbidden), `showManualSignIn must not call ${forbidden}`);
  }
  // The gate region (decision → render confirmation) must contain no data
  // loads or authenticated requests; the initial batch runs only after the
  // accountRendered confirmation. (Post-action refreshes elsewhere are fine —
  // they are reachable only from the rendered portal.)
  const gateRegion = html.slice(html.indexOf('__ACCOUNT_GATE_DECISION_START__'), html.indexOf('// Build user profile'));
  for (const forbidden of ['loadOrders', 'loadFavorites', 'loadAddresses', 'fetch(', 'getClerkToken']) {
    assert.ok(!gateRegion.includes(forbidden), `gate region must not call ${forbidden}`);
  }
  const renderIdx = html.indexOf('accountRendered = true;');
  const initialLoadIdx = html.indexOf('loadOrders();');
  assert.ok(renderIdx > -1 && initialLoadIdx > renderIdx, 'initial data loads must follow render confirmation');
});

check('dev auto-redirect is one-shot via sessionStorage bounce flag', () => {
  assert.ok(html.includes("var GATE_BOUNCE_KEY = 'mm_account_gate_bounced'"));
  assert.ok(/decision === 'redirect'[\s\S]{0,200}markGateBounced\(\);/.test(html));
  assert.ok(/accountRendered = true;\s*\n\s*clearGateBounce\(\);/.test(html));
});

check('no unconditional auto-redirect remains on the no-user path', () => {
  // signInWithClerk is invoked only inside the dev redirect branch, the manual
  // button markup, and nowhere else in the gate flow.
  const gateRegion = html.slice(html.indexOf('__ACCOUNT_GATE_DECISION_START__'), html.indexOf('// Build user profile'));
  const calls = gateRegion.match(/signInWithClerk\(window\.location\.href\)/g) || [];
  assert.equal(calls.length, 2, 'exactly: dev redirect branch + manual button');
});

console.log(`\nAll ${passed} account-gate regression tests passed.`);
