# Phase 13 Growth Signals UI Remediation — Local Handoff (2026-10-12)

Status: **LOCAL ONLY — not pushed, not deployed.** Awaiting owner review and separate deployment approval.

## Screenshot-observed defect

Owner report on `https://www.mildmate.com/super-admin/marketing/data-analyst/` (Sales Growth Signals table):
long JSON values overflow into neighboring columns; coverage/freshness/confidence/reason text overlaps;
horizontal scrolling does not make the table readable; worst in narrow windows.

## Technical root cause (Stage A audit, file `public/super-admin/marketing/data-analyst/index.html` @ `3cfa4de`)

A combination of three factors:

1. **Unbounded JSON content** — `growthValueHtml()` rendered object/array values as a single minified
   `JSON.stringify(v)` token (no spaces) inside `<span class="mono">` (former lines 971–981).
2. **Conflicting sizing rules** — Value/Coverage/Freshness/Reason cells carried inline `max-width`
   (former lines 1021–1025), but the global rule `td{…white-space:nowrap}` (line 32) makes those
   `max-width`s ineffective: an unbreakable token forces the auto table layout to either blow the
   column width out or — because `table{width:100%}` (line 30) forces columns to fit the container —
   overflow the cell box (`overflow` defaults to visible) and paint over adjacent cells. That is the
   literal overlap.
3. **No break-word handling** — even where wrapping was intended, minified JSON has no break
   opportunities without `word-break`/`overflow-wrap`.

The scroll container itself (`.table-wrap{overflow-x:auto}`, line 29) was correct; the content was not.
Precedent for the fix already existed in the same file (line 449: `white-space:normal;max-width:320px`
for long error messages).

## Rendering/layout behavior after the fix (Stage B)

- **Scoped CSS block** (added after `.muted`, lines 61–70): `#growth-signals-table td{white-space:normal;vertical-align:top}`
  plus `wrap-json` (max-width 260px), `gs-reason` (max-width 360px, break-word), `.gs-summary`,
  and `.gs-details` disclosure styles (`pre`: pretty-printed, `pre-wrap`, `overflow-wrap:anywhere`,
  `max-height:260px` with internal scroll). Every rule is scoped under `#growth-signals-table` —
  zero global table changes.
- **Structured values**: short readable summary in the cell (`key: value` for up to 4 top-level keys,
  `·`-separated, `+N more` overflow marker; nested objects collapsed to `{…}`), followed by a native
  `<details class="gs-details"><summary>Full JSON (N keys/items)</summary><pre>…</pre></details>`
  holding the FULL pretty-printed payload. Exact values preserved; nothing discarded.
- **Readable formatting**: `null`/`undefined` → `—` (muted); `0` → literal `0`; `""` → `(empty)`;
  booleans as `true`/`false`. No color-coded judgments beyond existing status badges.
- **Keyboard accessibility**: native `<details>/<summary>` — Tab-focusable toggle, Enter/Space
  toggles; `summary:focus-visible` outline styled.
- **No framework/dependency added.** Native HTML disclosure only.

## Exact changed files (branch `fix/phase13-growth-ui`, worktree `D:\00_mildmate\re-build_web_phase13_ui`, base `3cfa4de`)

Commit `6a182b0596e4431162739ca8f01c350f1e5f68f6`:
- `public/super-admin/marketing/data-analyst/index.html` — **+46/−6**, the only production file touched
- `tests/phase13-growth-ui.test.mjs` — new sandbox-vm regression suite (11 tests, 15-point checklist)
- `tests/growth-ui-harness.mjs`, `tests/layout-probe.mjs` — visual/probe harness generators
- `tests/fixtures/*` — harness pages, probe pages, screenshots

Not touched (verified): `workers/api/*`, `scripts/opportunity-core.mjs`, `marketing-sync-worker/*`,
migrations, `public/index.js`, `public/_worker.js`, GA4/GTM files, all other dashboards.

## Before/after example

Before (momentum Value cell): the entire object as one unbreakable line —
`{"units_growth_pct":null,"current_units":null,"previous_units":null}` — overflowing the 260px
`max-width` (which was inert) into the Coverage column.

After (same cell):
```
units_growth_pct: — · current_units: — · previous_units: —
▾ Full JSON (3 keys)          ← native disclosure; click/Enter expands full pretty-printed payload
```

## Regression results (12/12 pass, `node --test tests/phase13-growth-ui.test.mjs`)

The suite evaluates the REAL page script (extracted from the patched HTML) in a `node:vm` sandbox
with a stubbed DOM/fetch, against a realistic Phase 13 contract-v1 fixture:

| # | Checklist item | Result |
|---|---|---|
| 1 | All eight signal rows render | ✅ |
| 2 | Seven columns remain | ✅ |
| 3 | Long JSON cannot overlap adjacent cells | ✅ (no minified JSON outside `<pre>`; wrapping enforced) |
| 4 | Full JSON inspectable | ✅ (details/pre; JSON.parse of extracted pre deep-equals original) |
| 5 | Null momentum growth never −100% | ✅ (renders `—`) |
| 6 | Zero distinguishable from null | ✅ (`0` vs `—`) |
| 7 | Status badges preserve semantics | ✅ (SUFFICIENT/NEUTRAL/MAPPING_GAP/STALE_SOURCE/SECONDARY_GUARDRAIL/INSUFFICIENT_SIGNAL) |
| 8 | Full reason text accessible | ✅ (untruncated, wrapped; missing reason → `—`) |
| 9 | Horizontal scrolling correct | ✅ (`.table-wrap{overflow-x:auto}` retained; probe-verified containment) |
| 10 | Expanded details keyboard accessible | ✅ (native `<details>/<summary>` + focus-visible outline) |
| 11 | Narrow viewports readable | ✅ (probe at 578px: 0 overlaps, contained scroll; media queries intact) |
| 12 | No regression to other tables | ✅ (global `td{…nowrap}` untouched; all new CSS scoped) |
| 13 | API response object never mutated | ✅ (deep-compare before/after render) |
| 14 | No additional API requests | ✅ (exactly 1 fetch for the growth-signals load) |
| 15 | Growth/GA4/Opportunity sections functional | ✅ (all loader functions intact; boot path exercised) |
| 16 | XSS safety (added 2026-10-12 final review) | ✅ (malicious keys/values/reasons — `<script>`, `<img onerror>`, `<svg onload>`, `</pre>`/`</td>`/`</details>` breakouts, `&`, quotes — all entity-escaped; JSON round-trips exactly; no raw markup rendered) |

**Real-browser layout probe** (headless Chrome, `--dump-dom`, measured `getBoundingClientRect`):

| Viewport | Rows | Columns | Cell overlaps | Scroll contained | Disclosures | nowrap cells |
|---|---|---|---|---|---|---|
| 1440px | 8 | 7 | **0** | yes (table fits wrap) | 16 | none |
| 600px | 8 | 7 | **0** | yes (h-scroll inside wrap) | 16 | none |

**Visual-test limitation:** PNG screenshots were captured at both widths
(`tests/fixtures/growth-desktop-1440.png`, `tests/fixtures/growth-narrow-600.png`) for owner review,
but the agent could not visually inspect them (model image-input limitation). Objective evidence is
the measured geometry above from the same rendered pages, plus the DOM/CSS assertions in the test suite.

## Production build safety

- Cloudflare Pages auto-deploys production from master; therefore all work happened in the isolated
  worktree `D:\00_mildmate\re-build_web_phase13_ui`, branch `fix/phase13-growth-ui` @ `6a182b0`.
  The dirty primary workspace's tracked files were not read or modified.
- **Nothing is pushed or deployed.** A push of this branch to master would auto-trigger a Pages
  production build that includes the patched `index.html` (it is a static asset under `public/`).
- No Worker bundle change: `public/_worker.js`/`public/index.js` untouched, so the `--no-bundle`
  runtime-parity convention is unaffected; the patched file ships as plain static HTML.
- Production baseline: Pages deployment `5c06b486-81fd-4296-8b48-7f3f0217e656` (master `3cfa4de`),
  Worker `be60cbe7` (not affected by this change).
- **First-choice rollback: restore Pages deployment `5c06b486-81fd-4296-8b48-7f3f0217e656`**
  (current healthy production, verified available in the deployment list). The older `08f64271`
  (`d245468`) is a secondary fallback only if `5c06b486` becomes unavailable.
- Rollback: revert/`git revert` the single commit on master (Pages auto-redeploys), or restore the
  `5c06b486` deployment directly from the Cloudflare dashboard.

## Addendum 2 (2026-10-12) — Confidence "NaN" correction (owner-approved local fix)

The owner's visual review of the acceptance screenshots showed `Confidence: NaN` in the growth-summary
badge. Root cause (presentation-only): the badge called `fmtNum(s.confidence && s.confidence.value)`,
and `fmtNum` runs `Number(n)` on anything non-null — an object-shaped or non-numeric value became NaN.
The fixture modeled `confidence.value` as an envelope; the real production response carries a primitive
(`confidence.value = 30`, verified 2026-10-12), so production was not displaying NaN — but the fragility
was real. Fix: new fail-safe `confidenceSummaryHtml()` — accepts a primitive score or a `{value: N}`
envelope, preserves numeric values including 0, renders `—` for null/missing/non-numeric/ambiguous
shapes. Never renders NaN. No backend change (backend output was and is valid).

Tests now **18/18 pass** (added 17a–17f: numeric, zero, null, missing signal, non-numeric strings,
envelope primitive, ambiguous-nesting fail-safe). Real-Chrome badge probe: `{"nan_found":false,"confidence_text":"30"}`.
All four screenshots regenerated with the corrected display. Commit `6840585` on `fix/phase13-growth-ui`;
nothing pushed or deployed.

### Addendum 2b — narrow-layout correction (owner visual review follow-up, commit `a6ef91d`)

Owner visual review passed desktop, confidence, disclosure, null/zero, and reason wrapping; at 600px the
Value/Coverage columns were squeezed into unreadable fragments. Fix (same scoped CSS block):
`td.wrap-json{min-width:220px;max-width:280px}`, `td.gs-reason{min-width:240px…}`, and
`overflow-wrap:anywhere` → `overflow-wrap:break-word` (breaks long tokens only when unavoidable —
no mid-word fragmentation). Narrow viewports now scroll horizontally inside `.table-wrap` with
readable columns. Probe-verified at 578px: `squeezed_json_cols: 0`, `cell_overlaps: 0`,
`anywhere_wrap_css: false`, scroll contained; desktop probe unchanged (0 overlaps, fits without scroll).
Tests 18/18 pass (test 9+11 asserts the min-width and no-`anywhere` invariants). Screenshots regenerated.
**Final release commit: `a6ef91d`.**

## DEPLOYMENT RECORD (2026-10-12 ~10:55 UTC / 17:55 ICT) — owner-approved, deployed to production

- **Git:** branch updated `b7116ce..a6ef91d`; master fast-forwarded non-force `3cfa4de..a6ef91d` — **`origin/master` = `a6ef91dc5d0cc8fb28c1f1b17a53ce4a49bb668c`**.
- **Pages auto-deployments:** Production **`5ad60dc6-0150-40cb-8bbf-03a65426122a`** from master `a6ef91d` (build succeeded); preview `62de6f5c` from the branch push.
- **Served-content verification** (via `5ad60dc6.mildmate-new.pages.dev`, pages.dev gate bypass): HTTP 200; `min-width:220px` CSS present; `confidenceSummaryHtml` present; `gs-details` present; `overflow-wrap:anywhere` ABSENT; canonical GA4 `G-0GWVSPJLVJ` + GTM-KLJZZM9 retained.
- **Health:** www.mildmate.com 200, `/api/auth/me` 200. Custom-domain unauthenticated access to the dashboard redirects to the Clerk sign-in gate as designed (pre-existing `accounts.mildmate.com` DNS quirk of the dev Clerk setup noted; unrelated to this release).
- **Worker untouched:** active `be60cbe7`@100%.
- **Post-release owner smoke checklist (authenticated):** growth table 8 rows/7 cols; momentum `units_growth_pct: —` (not −100%); Full JSON disclosure expands; zeros literal; narrow-window readability; other dashboard sections normal.
- **Rollback:** restore Pages deployment **`5c06b486-81fd-4296-8b48-7f3f0217e656`** (master `3cfa4de`), or `git revert` on master; Worker unaffected.



## Addendum 1 (2026-10-12 ~10:00 UTC) — Preview authentication blocker (root-caused, read-only)

The owner observed `Forbidden: admin role required` on the preview deployment `62a9de4c` for all
authenticated APIs. Root cause, verified via `wrangler pages secret list` (names only) + code inspection:

- **The Pages PREVIEW environment is missing `CLERK_SECRET_KEY` and `ADMIN_SECRET`** (production has both,
  plus `ADMIN_SECRET_ALLOW_PROD`). Preview has only `ADMIN_EMAILS`, `ORDER_*`, `RESEND_API_KEY`,
  `SALES_SYNC_API_TOKEN`, `STRIPE_*`.
- Failure chain (`workers/api/admin-analysis.ts` `authorizeAdmin`, lines 94–145): the owner's Clerk JWT
  verifies fine (signature/issuer OK; same-origin GETs carry no `Origin` header so the allowlist in
  `clerk-verify.ts` lines 76–82 never fires), but Clerk dev-instance JWTs omit role/email claims →
  `hasAdminRole()` and `emailAllowed()` fail → the Clerk-API enrichment fallback silently no-ops because
  `CLERK_SECRET_KEY` is absent in preview → **403**.
- Additional structural factor: each preview deployment URL is a unique origin, so `localStorage`
  (`admin_secret`) and Clerk session state never carry over between preview builds.
- **This is an intentional-isolation limitation, not a defect of the UI patch.** Production
  authorization is unaffected. Remediation (owner-side, NOT performed): set `CLERK_SECRET_KEY` (and
  optionally `ADMIN_SECRET`) for the Preview environment in the Cloudflare dashboard if authenticated
  preview QA is wanted. Alternatively accept the sandbox-vm tests + headless-Chrome probes + fixture
  screenshots as preview evidence.

### Acceptance screenshots (fixture data, sanitized — no production data or credentials)

Captured from the exact deployed implementation (`b7116ce`) via headless Chrome:
- `tests/fixtures/growth-desktop-1440.png` — desktop, table-only view
- `tests/fixtures/growth-narrow-600.png` — 600px viewport, table-only view
- `tests/fixtures/growth-momentum-json-expanded.png` — Momentum Full JSON expanded
  (probe-verified: open=true, pre 101px visible, 5 rows, JSON parses)
- `tests/fixtures/growth-demand-json-expanded.png` — Demand Full JSON expanded
  (probe-verified: open=true, pre 150px visible, 7 rows, JSON parses)

## Deployment plan (when approved)

1. `git push origin fix/phase13-growth-ui` (backup).
2. `git push origin <release-commit>:master` (fast-forward; expect ONE automatic Pages production build).
3. Verify www.mildmate.com 200 and the data-analyst page loads; visual QA of the growth table by the owner (authenticated).
4. Rollback if needed per the identifiers above.
