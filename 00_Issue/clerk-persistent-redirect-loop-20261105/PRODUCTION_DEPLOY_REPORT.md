# MildMate — Clerk Redirect-Loop Recovery Production Deployment Report

**Date:** 2026-11-05  
**Mode:** Controlled production pass (scoped fix only)

---

## 1) Rollback target captured before deploy

- Pre-deploy production deployment: `90ac3798-ef4b-433f-a21a-7c1cceb123d8`
- This remains the rollback target.

---

## 2) Release-parity and scope gate

Deployment was executed from an isolated workspace cloned at production source commit `8e07c54`, then patched with only approved files:

1. `functions/auth/clerk-return/[[path]].ts`
2. `workers/api/clerk-session-token.ts`
3. `workers/api/clerk-handshake.ts`
4. `workers/api/__tests__/clerk-redirect-loop-rca.test.ts`
5. `public/_worker.js` (rebuilt)

Parity check versus production base confirmed only the above paths changed for release payload scope.

---

## 3) Regression gates (isolated release workspace)

### Redirect-loop suite

Command:

`npm test -- workers/api/__tests__/clerk-redirect-loop-rca.test.ts`

Result:

- **PASS** (18/18)

### Related Clerk/auth suites

Command:

`npm test -- workers/api/__tests__/clerk-return-dev-host.test.ts workers/api/__tests__/clerk-session-token.test.ts workers/api/__tests__/admin-route-matrix-r1.test.ts`

Result:

- **PASS** for executed suites (14/14 across 2 files in isolated baseline)

Note: one referenced test file is not present in the production-baseline clone; no functional gate failure occurred.

---

## 4) Production deployment executed

- New production deployment: `ef0f2f8e-b11a-461b-bd28-e4d0a9c5b3e3`
- URL: `https://ef0f2f8e.mildmate-new.pages.dev`
- Deploy command used:
  - `wrangler pages deploy ./public --project-name=mildmate-new --branch=master --commit-dirty=true --no-bundle`

No production rollback was triggered because post-deploy gates passed.

---

## 5) Post-deploy production verification (sanitized)

Hosts verified:

- `https://www.mildmate.com`
- `https://mildmate.com`

### Callback behavior

1. `/auth/clerk-return/?next=%2Fsuper-admin%2F` with no cookies:
   - `302` to Clerk sign-in (expected)
   - no clear headers (expected for no-candidate state)

2. Callback with synthetic single invalid `__session`:
   - `302` to Clerk sign-in
   - **Set-Cookie clears now present** for `__session` in:
     - host scope
     - `Domain=mildmate.com` scope

3. Callback with synthetic stale handshake mismatch:
   - `302` to Clerk sign-in
   - **Set-Cookie clears present for `__clerk_handshake` only** in both scopes

4. Callback with synthetic ambiguous session conflict:
   - `302` to Clerk sign-in
   - clears for both `__session` and `__session_whv9OBe3` in both scopes

### Security boundaries

- `/super-admin/` still protected by Cloudflare Access redirect (`302`) on both hosts
- `/api/admin/analysis/summary` returns `401`
- `/api/admin/orders` returns `401`
- `/account/` unauthenticated flow still redirects to Clerk sign-in (`302`)

No auth-bypass or boundary regression observed in automated checks.

---

## 6) Git commit/push status

- Verified Clerk recovery fix commit: `e91514c9`
- Branch: `security/admin-api-remediation-r1`
- Deployment was executed from isolated local workspace only.

---

## 7) Remaining limitations

1. This pass does **not** claim authenticated end-user browser success in the owner’s affected Chrome profile.
2. Final acceptance still requires owner-side real browser verification of the original loop scenario.
3. Automated verification used synthetic cookie names and sanitized headers only (no token values logged).

---

## 8) Decision

**Status: GO (deployment completed, gates passed).**

The original redirect-loop scenario is now prepared for owner verification in the affected Chrome profile, with rollback target preserved:

- rollback target: `90ac3798-ef4b-433f-a21a-7c1cceb123d8`

---

## 9) Owner browser acceptance

Owner acceptance received after deployment:

- **PASS** — normal Chrome browser now opens `https://www.mildmate.com/super-admin/` successfully without the prior redirect loop.
- Accepted production deployment: `ef0f2f8e-b11a-461b-bd28-e4d0a9c5b3e3`
