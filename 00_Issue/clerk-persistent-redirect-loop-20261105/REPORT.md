# MildMate — Persistent Super Admin Redirect Loop Audit (READ-ONLY)

**Date:** 2026-11-05  
**Mode:** Read-only only. No code/deploy/git/config changes performed.

---

## 1) Exact production deployment verified

- **Current production deployment:** `90ac3798-ef4b-433f-a21a-7c1cceb123d8`
- **Branch/source:** `master` / source commit `8e07c54`
- Verified via: `wrangler pages deployment list --project-name mildmate-new`

Auth loop-relevant code is present in deployed source commit `8e07c54`:

- `functions/auth/clerk-return/[[path]].ts`
  - `consumeClerkHandshake(...)`
  - `verifySessionCandidates(...)`
  - `redirectWithCookieClears(...)`
- `workers/api/clerk-session-token.ts`
  - `CLERK_SESSION_COOKIE_DOMAIN` resolution
  - fallback `DEFAULT_TRUSTED_SESSION_COOKIE_DOMAIN = "mildmate.com"`
  - dual-scope clear builder (host + `Domain=mildmate.com`)

Live runtime behavior confirms dual-scope clear directives are active (see section 3).

---

## 2) Reconstructed redirect sequence

### Observed from this audit environment

Unauthenticated `GET https://www.mildmate.com/super-admin/` first hits **Cloudflare Access**:

1. `www.mildmate.com/super-admin/` → `302` to `calm-bar-...cloudflareaccess.com/...`
2. Cloudflare Access login page returns `200`

So, in this environment, Clerk flow is behind Access unless Access is already satisfied in-browser.

### Direct Clerk callback path (matches owner symptom segment)

`GET https://www.mildmate.com/auth/clerk-return/?next=/super-admin/`:

1. callback returns `302`
2. `Location` points to `https://accounts.mildmate.com/sign-in?redirect_url=https://www.mildmate.com/auth/clerk-return/?next=%2Fsuper-admin%2F`

That `302` is the same redirect target shape as `redirectToSignIn(...)` in callback code.

---

## 3) Two session cookies and scope behavior

### Coexistence

`__session` and `__session_whv9OBe3` are both treated as valid Clerk session-candidate names by verifier regex and are expected to be handled as separate candidates if both are sent to `www.mildmate.com`.

### Scope verification (synthetic, isolated browser context)

With cookies set on `accounts.mildmate.com` only:
- visible on `accounts.mildmate.com`
- **not** sent to `www.mildmate.com`

Only domain cookies scoped to `.mildmate.com` appear for `www.mildmate.com`.

### Dual-scope clearing correction verification (live callback)

Synthetic conflicting request:
- Cookie header: `__session=fakeA; __session_whv9OBe3=fakeB`
- Callback response: `302` to sign-in **plus Set-Cookie clears** for both names in both scopes:
  - host-scoped clear (`Path=/; Expires=1970...; Secure; HttpOnly`)
  - `Domain=mildmate.com` clear

This confirms dual-scope clearing logic is active in production runtime behavior.

---

## 4) Confirmed cause vs remaining hypotheses

## Confirmed

The repeated callback bounce is produced when callback cannot establish a **single valid session state** and falls back to sign-in redirect.

Practically, that is the callback branch:
- `verifySessionCandidates(...)` not `valid`  
→ `redirectToSignIn(...)` (with clears only in conflict/ambiguous cases)

## Strongly supported hypotheses for persistent normal-browser loop

1. **Stale single invalid session cookie on `www` scope**  
   - Single invalid candidate returns sign-in redirect **without clear directives** in current behavior.
   - Repeats if stale cookie persists.

2. **Stale `__clerk_handshake*` mismatch (cookie vs query token)**  
   - If cookie handshake token and query handshake token differ, handshake consumption is skipped.
   - Synthetic mismatch probe produced callback `302` to sign-in with **no Set-Cookie clear**, consistent with repeated loop potential.

## Less likely from current evidence

- “Both session cookies visible on `accounts.mildmate.com`” alone as root cause.  
  Those cookies do not prove they are sent to `www.mildmate.com`.
- CSP warning as primary loop cause.  
  No direct evidence ties CSP warning to callback branch selection.

---

## 5) Why Incognito succeeds

Incognito starts with a clean cookie jar and no stale host/domain Clerk remnants.  
That removes stale-state conflict paths and lets the normal sign-in→callback handshake/session minting complete.

Normal profile can keep stale cookies/handshake artifacts that repeatedly force callback back to sign-in.

---

## 6) Safest immediate recovery + minimal permanent correction

## Immediate browser-side recovery (safest now)

On **both** `www.mildmate.com` and `accounts.mildmate.com`, clear only auth/session cookies:

- `__session*`
- `__clerk_handshake*`
- `__client_uat*`

Then:
1. reopen a clean tab
2. sign in again
3. test `/super-admin/`
4. temporarily disable extensions that inject request/cookie behavior if loop persists

## Minimal permanent correction (if code fix is approved later)

1. Add stale-state clearing for **single invalid session candidate** on callback path (not only ambiguous conflicts).
2. Add explicit stale handshake-cookie recovery when cookie/query handshake tokens mismatch (clear stale handshake cookie and proceed safely).
3. Keep existing strict security posture (no weakening JWT/issuer/category checks).

## Regression tests required before any future deploy

1. Single invalid `__session` on `www` + fresh sign-in callback must recover (no infinite loop).
2. Stale `__clerk_handshake` cookie + fresh query handshake mismatch must recover.
3. Conflicting `__session` + `__session_*` still clears both names in both scopes.
4. No token leakage to URL-based admin access; existing query-token forbids remain enforced.

## Rollback plan for future fix release

If a future fix deploy regresses auth, rollback via Cloudflare Pages deployment rollback to prior known-good production deployment.

---

## Additional evidence needed to fully collapse hypotheses (single capture)

Please provide **one sanitized Network capture** for a looping callback request:

- request URL: `/auth/clerk-return/?next=/super-admin/`
- response status + `Location`
- request cookie **names/scopes only** (no values)
- response `Set-Cookie` **names/attributes only** (no values)

This will determine whether the live loop is caused by:
- single invalid session residue, or
- handshake cookie/query mismatch residue.

---

## Follow-up Addendum (owner screenshot evidence, 2026-11-05)

Owner-confirmed browser evidence:

- Host: `www.mildmate.com`
- Request: `/auth/clerk-return?next=%2Fsuper-admin%2F`
- Response: repeated `302` to `accounts.mildmate.com/sign-in`
- Callback response headers in DevTools show no `Set-Cookie`

### 1) Exact production callback branch producing the 302

In deployed runtime (`public/_worker.js`, production source `8e07c54`), callback flow is:

1. `consumeClerkHandshake(request, env)`  
2. `extractClerkSessionToken(..., { allowQueryToken: true })`  
3. `verifySessionCandidates(...)`  
4. if `verified.state !== "valid"` →  
   `redirectWithCookieClears(redirectToSignIn(...), verified.clears || [])`

So this 302 is the callback’s non-valid session branch.

### 2) Why the observed 302 can have no Set-Cookie

`redirectWithCookieClears(...)` appends cookies **only** when `verified.clears` is non-empty.

`verifySessionCandidates(...)` currently builds clears only for:
- `session.ambiguous` **or**
- truncated candidate list (`!session.candidatesComplete`)

Therefore, these non-valid states produce 302 **without** `Set-Cookie`:
- no cookie candidates
- single invalid/stale session candidate

Synthetic production-endpoint probes in this audit matched exactly:

- `no-cookies` → 302 sign-in, **no Set-Cookie**
- `single-invalid (__session=fakeOnly)` → 302 sign-in, **no Set-Cookie**
- `ambiguous conflict (__session + __session_whv9OBe3)` → 302 sign-in, **with dual-scope clears**

### 3) Reconciliation with dual-scope clearing implementation

No contradiction:

- dual-scope clearing is implemented and working
- but it is intentionally scoped to ambiguous-conflict invalidation paths
- it is not applied to single-invalid or no-candidate paths

So the screenshot pattern (302 with no `Set-Cookie`) indicates callback is not entering the conflict-clearing branch.

### 4) Smallest safe permanent correction

Smallest safe fix (no security weakening):

1. **Single-invalid stale session recovery**  
   On callback non-valid branch, if session cookie names exist and `verified.clears` is empty, attach dual-scope clears for those candidate names before redirecting to sign-in.

2. **Handshake mismatch recovery**  
   In handshake consumption path, when cookie/query `__clerk_handshake*` tokens conflict, clear stale handshake cookie(s) and continue to sign-in/callback path cleanly.

This keeps strict JWT verification/issuer/category checks unchanged.

### 5) Required regression tests (www + apex)

Add/extend tests for both `https://www.mildmate.com` and `https://mildmate.com`:

1. single invalid `__session` on callback → 302 sign-in **with** dual-scope clear(s), then successful next handshake/login cycle
2. stale cookie `__clerk_handshake*` + fresh query handshake mismatch → stale handshake clear emitted; no endless callback/sign-in loop
3. existing ambiguous `__session` + `__session_*` conflict still emits dual-scope clears (no regression)
4. valid single session still passes to `/super-admin/` without unnecessary clearing

---

## Updated root-cause statement and confidence

**Root cause (most likely):** callback repeatedly enters non-valid branch where `verified.clears` is empty (single-invalid/no-candidate and/or handshake-token mismatch), so 302 sign-in is returned without cookie clearing; stale state survives and re-triggers the loop in persistent profile.

**Confidence:** **High** on branch-level mechanism; **Medium-High** on exact trigger mix in owner browser until one sanitized looping callback capture includes cookie-name/scope inventory for that exact request.

---

## Final production acceptance (2026-11-05)

- Production deployment: `ef0f2f8e-b11a-461b-bd28-e4d0a9c5b3e3`
- Owner real-browser verification: **PASS**
- Confirmed outcome: `https://www.mildmate.com/super-admin/` opens in normal Chrome without the prior redirect loop.
