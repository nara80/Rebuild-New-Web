# Phase 16 — UI & Human-Approval Workflow: Owner Acceptance Pack (2026-11-07)

**Scope:** owner browser acceptance of the Phase 16 AI Analyst panel and the human approval / rejection / post-action-review loop on the isolated preview. Documentation and verification only — no code change, no production change, no Clerk change, no AI provider configuration.

- **Preview URL:** `https://phase16-ai-analyst.mildmate-new.pages.dev/super-admin/marketing/`
- **Preview branch:** `feature/marketing-ai-analyst-r1` (worktree `.phase16-ai-analyst`)
- **Preview D1:** `mildmate-db` (`85ce2f41-463a-43fa-8485-181e983b8fd4`)
- **Production:** unchanged and untouched.
- **Status:** **OWNER ACCEPTED — 2026-11-07.** The owner completed the authenticated preview workflow, verified persistence after a hard refresh, and reported PASS on every step. Acceptance record and the two UI corrections are in section 2.5 below.

---

## 1. Owner-reported status accepted as-is

| Item | Status |
|---|---|
| Phase 16 preview Super Admin | PASS (owner browser) |
| Marketing Command Center | PASS (owner browser) |
| Phase 14 preview schema | Repaired (additive migrations applied to preview D1 only) |
| Phase 16 automated workflow tests | PASS |
| Phase 16 human approval workflow (browser) | **OWNER ACCEPTED — 2026-11-07** |
| Production | Unchanged |

Per owner direction, the completed Phase 14–16 schema audits and the Clerk authentication investigation are **closed and not repeated**. No further Clerk configuration changes are made while the current preview session works.

---

## 2. Fixture inventory — verified live, 2026-11-07

Read directly from preview D1 `marketing_actions` (read-only `SELECT`). All three `[TEST/DEMO]` fixtures are present and in their expected initial states:

| ID | Status | Product | Channel | Type | Title |
|---|---|---|---|---|---|
| 14 | `proposed` | #1 Standard Fitted Sheet | `seo` | `push_product` | `[TEST/DEMO] Refresh Standard Fitted Sheet product copy (owner approval workflow test)` |
| 15 | `proposed` | #2 Deep Pocket Fitted Sheet | `google-ads` | `campaign` | `[TEST/DEMO] Deep Pocket Fitted Sheet Ads test (owner rejection workflow test)` |
| 16 | `approved` | #3 Marine Fitted Sheet | *(overall)* | `content` | `[TEST/DEMO] Marine Fitted Sheet content update (owner post-action review test)` |

Supporting values: #14 `confidence=80`, `caution=0`, `review_date=2026-12-07`. #15 `confidence=55`, `caution=1` (forced caution: Google Ads attribution UNVERIFIED, Phase 12 open), `review_date=2026-12-07`. #16 `approved_budget=3000 THB`, `confidence=70`, `caution=0`, `review_date=2026-12-14`, with an illustrative `baseline_metrics_json` snapshot.

All three rows carry `source='human'`, `ai_model='TEST-DEMO-FIXTURE'`, and the `[TEST/DEMO]` title prefix, so they are always distinguishable from genuine future AI recommendations (`source='ai'`). No fabricated marketing performance and no customer PII.

Fixtures were frozen until the owner finished acceptance. Acceptance is now complete; the fixtures still hold their owner-accepted states and must not be reset without authorization.

---

## 2.5 Owner acceptance result — OWNER ACCEPTED, 2026-11-07

The owner ran the authenticated workflow in the preview browser and confirmed every step. Verbatim confirmed results:

| # | Check | Result |
|---|---|---|
| 1 | #14 Standard Fitted Sheet: `PROPOSED` → `APPROVED` | **PASS** |
| 2 | #15 Deep Pocket Fitted Sheet: `PROPOSED` → `REJECTED` | **PASS** |
| 3 | #16 Marine Fitted Sheet: `APPROVED` → `REVIEWED` | **PASS** |
| 4 | #16 result classification = `POSITIVE` | **PASS** |
| 5 | #16 lessons learned saved and persisted | **PASS** |
| 6 | #16 approved budget `THB 3,000` preserved | **PASS** |
| 7 | All three statuses persisted after Ctrl+F5 | **PASS** |
| 8 | Rejected action remained non-executed | **PASS** |

**Phase 16 UI & Human Approval Workflow: OWNER ACCEPTED.**

Scope of this acceptance: the human approval / rejection / post-action-review workflow and its persistence, exercised against clearly labeled `[TEST/DEMO]` fixture records.

**Explicitly NOT claimed:** no real AI generation was validated (no provider is configured, by design), and no measurable marketing improvement was demonstrated. The `[TEST/DEMO]` records are not real marketing actions.

### UI corrections applied after acceptance

Two display defects the owner reported were corrected in the AI Analyst panel of `public/super-admin/marketing/index.html`. Both are presentation-only — the stored D1 values are unchanged and no marketing fact is inferred.

**A. Baseline metrics readability.** The panel previously passed `baseline_metrics_json` through `JSON.stringify` and rendered the escaped JSON blob, which was hard to read. It now parses the stored record and renders labeled field/value rows with humanized field names (for example `snapshot_at` → *Snapshot at*, `opportunity_at_approval · score` → *Opportunity at approval · Score*). Nested objects are flattened with `·` separators, arrays are summarized as `N item(s)`, and rendering is capped at 12 fields and 3 levels so a large record cannot flood the cell. Missing or unreadable records fall back to an explicit empty state. Every key and value is escaped before it reaches HTML.

**B. Missing post-action metrics.** A reviewed action with no metrics previously rendered `Post: "null"` — the API stores `JSON.stringify(null)` as the four-character string `"null"`, which the old renderer then stringified again. The panel now shows **`No post-action metrics recorded`** for absent metrics and *Post-action record unreadable* for an unparseable record. The saved result classification and lessons learned are preserved and still displayed, and the row now states whether the result is **Manually selected result (no metrics recorded)** or **Result backed by recorded metrics**, so a human classification is never presented as a metrics-verified outcome.

Both helpers live in a marked, self-contained block (`METRICS_RENDER_BEGIN` / `METRICS_RENDER_END`) in the page's inline script. No other Command Center component was modified.

---

## 3. Owner acceptance script — steps 1–7

Open `https://phase16-ai-analyst.mildmate-new.pages.dev/super-admin/marketing/` and scroll to the **AI Analyst (Phase 16) — Advisory Only** card. The panel loads the three fixtures automatically via `GET /api/admin/ai-analyst/actions`.

### Step 1 — Panel and recommendation details display correctly

Expected: the AI Analyst table shows three rows with columns *ID / Source, Status, Recommendation, Product, Channel, Confidence, Approved budget, Success target, Review date, Human action*.

| Row | Expected rendering |
|---|---|
| #14 | Status pill `proposed`; Product `#1 Standard Fitted Sheet`; Channel `seo`; Confidence `80`; Approved budget `—`; Human action: **Approve** + **Reject** |
| #15 | Status pill `proposed`; caution line "⚠ Google Ads purchase attribution remains UNVERIFIED (Phase 12 open) …"; Confidence `55`; Human action: **Approve** + **Reject** |
| #16 | Status pill `approved`; Channel `overall`; Approved budget `฿3,000`; Human action: **Record review** + an illustrative `Baseline: {…}` line |

Also expected: the filter buttons (All / Proposed / Approved / Rejected / Reviewed-Results) each narrow the table.

### Step 2 — Approve the proposed Standard Fitted Sheet action

Click **Approve** on row #14. Expected: status pill flips to `approved`, the row's action cell becomes **Record review**, the status line reads `Action #14 → approved …`, and the table reloads.

Two behaviours to expect, so neither is misread as a defect:

1. **Approved budget stays `—` for #14.** The panel's Approve button sends `{op:'approve'}` with no budget, and the handler uses `approved_budget = COALESCE(?3, approved_budget)`, so a null budget leaves the column unchanged (still NULL for #14). The ฿3,000 budget belongs to fixture #16. A blank budget on a newly approved row is correct behaviour, not a bug.
2. A **baseline snapshot is captured at approval time** (`baseline_metrics_json`, plus `opportunity_at_approval` when the product has a score row). The approved row's **Baseline:** line therefore appears after this step.

### Step 3 — Reject the proposed Deep Pocket Fitted Sheet Ads action

Click **Reject** on row #15. Expected: status pill flips to `rejected`, the action cell becomes `—`, and the status line reads `Action #15 → rejected …`.

Expected: the rejected row shows **no result class and no executed state** — rejection is terminal for the workflow; only `approved` rows can be reviewed (the handler returns `409 INVALID_TRANSITION` otherwise).

### Step 4 — Review the approved Marine Fitted Sheet action

Click **Record review** on row #16. The inline **Post-action review — action #16** form appears. Choose a **Result class** (Positive / Neutral / Negative / Inconclusive), type a **Lessons learned** sentence, then click **Save review**.

Expected: status pill flips to `reviewed`; the action cell shows the result-class pill plus `Post: {…}` and `Lessons: …`. Reviewed outcomes feed future AI context through the input contract (`past_outcomes`).

### Step 5 — Action History, approved budget, baseline, and human audit records

Expected:

- **Action History / audit:** every row's *ID / Source* cell labels the row `Human` (fixtures) and the *Human action* column reflects the terminal state reached.
- **Approved budget:** `฿3,000` on #16 (the seeded fixture value). #14 remains `—` per the note in step 2.
- **Baseline:** the `Baseline: {…}` line on approved/reviewed rows reflects the snapshot captured at approval.
- **Human audit records:** `approved_by` / `rejected_by` / `reviewed_by` are populated from the signed-in admin's Clerk session token.

**One nuance to check and report, not fix pre-emptively:** the audit attribution is read from the JWT `email` claim (`actorEmail()` in `workers/api/admin-ai-analyst.ts`). If the Development instance's session token does not carry an `email` claim, the audit column renders blank. If you observe a blank audit attribution, report it as an observation — it is a token-claim nuance, not an authorization failure, and the decisions themselves still persist.

### Step 6 — Refresh and confirm decisions persist

Hard-refresh the page (Ctrl+F5). Expected: #14 `approved`, #15 `rejected`, #16 `reviewed` with the chosen result class and lesson text — read back from preview D1, not from browser state.

**Do not confuse this with the separate "Next Actions with Human Review" card**, which is explicitly a browser-local tracker for the current session. Persistence of the Phase 16 workflow is proven by the **AI Analyst** card after refresh.

### Step 7 — AI generation correctly reports that no provider is configured

Click **Generate AI recommendations**. Expected: the panel reports that no provider is configured and that nothing was generated or stored — no fabricated recommendation is inserted and the fixture count stays at three.

This is the intended state: `POST /api/admin/ai-analyst/recommend` returns `ai_available:false` with the message *"AI provider not configured (set AI_API_KEY, optional AI_API_BASE / AI_MODEL). No recommendations were generated or stored — nothing is fabricated."*

### After acceptance (owner-side reset, when you choose)

```
npx wrangler d1 execute mildmate-db --remote --file scripts/seed-phase16-demo-fixtures.sql
```

This deletes every `TEST-DEMO-FIXTURE%` row and restores the three canonical fixtures (`proposed` / `proposed` / `approved` with ฿3,000). Fixture IDs are re-issued on reset — always address rows by their `[TEST/DEMO]` title.

---

## 4. Provider decision recorded — Anthropic Claude (future stage)

| Decision | Value |
|---|---|
| Selected provider | Anthropic Claude API |
| Selected model (owner-stated identifier) | `claude-haiku-5-5` |
| Effective now | **Deferred** — no key, no secrets, no adapter, no paid generation |

### Why an adapter is required

The current implementation is provider-neutral over the **OpenAI-compatible** `chat/completions` protocol (`callAiProvider()` in `workers/api/admin-ai-analyst.ts`, default base `https://api.deepseek.com`, `Authorization: Bearer`). Anthropic's **Messages API** is a different protocol: different endpoint (`/v1/messages`), different auth header (`x-api-key` + `anthropic-version`), and a different request/response schema. The existing code **cannot** call Claude as-is.

### Remaining Claude integration requirements (not started)

1. **Adapter:** add a native Anthropic Messages API path in `callAiProvider()` (or a separate provider module) that maps the existing grounded contract to an Anthropic request and normalizes the response back into the current `{available, model, list, error}` shape. Keep the existing OpenAI-compatible path intact.
2. **Model identifier validation:** confirm the exact Anthropic model ID at integration time against the live model list. `claude-haiku-5-5` is the owner's stated identifier; Anthropic model IDs are versioned, so the exact callable string must be verified rather than assumed.
3. **Secrets (owner action, next stage only):** `AI_API_KEY` for Anthropic, plus `AI_API_BASE` / `AI_MODEL` as needed, set in the relevant environment. Not configured now.
4. **Grounding + cost guardrails preserved:** `validateRecommendations()` must continue to reject ungrounded output, and the `ai_available:false` path must remain the default until a provider is deliberately enabled.
5. **Mirror + bundle sync:** any change to `workers/api/admin-ai-analyst.ts` must be mirrored into `public/index.js` and `public/_worker.js`, with the Pages bundle rebuilt via `extract-worker.ps1` (runtime-parity convention).
6. **Test coverage:** extend the Phase 16 suite with adapter tests (request mapping, response normalization, failure and no-key paths).

### Credential notice

Anthropic API credentials **will be required** to begin the next stage. They are **not** needed now and must not be created or configured until the owner authorizes Claude integration separately.

---

## 5. Guardrails observed in this cycle

- No production deployment, no `main` merge.
- No production D1 write. Preview D1 was read only; the owner-accepted fixture rows were left byte-identical (never reset or mutated).
- No Clerk configuration change.
- Application code change limited to the AI Analyst display layer in `public/super-admin/marketing/index.html`; no other Command Center component touched.
- No AI provider configuration; no paid AI generation.
- Preview deployment and existing test/acceptance evidence preserved.

---

## 6. Next step

**Done:** owner ran the workflow in the preview browser — **OWNER ACCEPTED, 2026-11-07** (section 2.5). The two reported display defects were corrected in the AI Analyst panel and the focused tests re-run green. Existing acceptance and test evidence preserved.

**Remaining Phase 16 items:**

1. **AI provider integration (deferred, needs separate authorization).** Implement the native Anthropic Messages API adapter and validate the exact versioned model ID; see section 4. Anthropic credentials required.
2. **Opportunity scoring snapshot on the preview.** The Command Center still shows `—` for the top opportunity score and scored opportunities because preview `opportunity_scores` is empty (no snapshot generated yet). Not a defect; the owner-side step is *Recalculate costs* → *Recompute scores* on the Data Analyst tab when a populated snapshot is wanted.
3. **Google Ads purchase attribution** remains UNVERIFIED (Phase 12 open). Independent business track; the #15 fixture's caution flag reflects it.
4. **Fixture reset** (owner action, when wanted): `npx wrangler d1 execute mildmate-db --remote --file scripts/seed-phase16-demo-fixtures.sql`. The three owner-accepted demo rows are left in place and must not be reset without authorization.
5. **Production release of Phase 16** remains NO-GO while the AI provider is intentionally unconfigured and owner acceptance of a production deployment has not been sought.

**Recommendation for the subsequent Claude integration stage:** proceed as a separate authorized stage — add the Anthropic Messages adapter behind the existing provider-neutral boundary, keep the OpenAI-compatible path intact, keep `ai_available:false` as the default until a key is deliberately set, extend the Phase 16 suite with adapter tests (request mapping, response normalization, no-key and provider-error paths), mirror any `workers/api/admin-ai-analyst.ts` change into `public/index.js` + `public/_worker.js` and rebuild the bundle via `extract-worker.ps1`, and validate the exact model identifier against Anthropic's live model list before the first paid call. Do not begin until the owner authorizes it and supplies credentials.

Then stop and await separate authorization for Claude integration.
