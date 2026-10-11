# GA4 Consent Timing and GA4 Firing Review — 2026-10-10

Scope: response to the two risks raised on commit `429d996` (consent update timing; GA4 tag firing under denied default with additional consent checks). Full GTM consent-template integration implemented locally on `ga4/remediation-isolated`. **No deploy, no GTM publish, no GA4 change.**

---

## 1. Revised consent architecture (v3 — final)

Root cause unifying both risks: the GA4 Google Tag fires on the **Initialization** trigger, and GTM replays queued site-side consent commands only **after** Initialization triggers. Any consent state applied via queued `gtag('consent', …)` commands — default or update — therefore arrives after the Google Tag has already been evaluated (blocked). The fix is to make the state fully correct **during the Consent Initialization phase**, applied by GTM itself.

Ownership split:

| Concern | Owner | Mechanism |
|---|---|---|
| Consent UI + saved choice | Website (`cookie-consent.js`) | localStorage `mildmate-cookie-consent` (unchanged model: Essential/Analytics/Marketing) |
| Choice readable by GTM before any tag fires | Website | First-party cookie `mm-consent=analytics:granted,marketing:denied` written at script scope (migrating localStorage-only users) and on every save |
| Consent DEFAULT (all 4 denied) | GTM consent template | `setDefaultConsentState` on **Consent Initialization – All Pages** |
| Consent UPDATE (returning users) | GTM consent template | Reads `mm-consent` cookie during Consent Initialization, applies with `updateConsentState` — before any Initialization-phase tag fires |
| Consent UPDATE (mid-page change/withdrawal, no reload) | GTM consent template | `callInWindow('__mildmateAddConsentListener', cb)` — template registers a callback; site invokes it on every consent change → `updateConsentState` |
| Site-side `gtag('consent', …)` commands | **Removed entirely** | Site now emits zero consent commands (default AND update moved to the template) |
| Tag-level Basic-Consent enforcement | GTM triggers | GA4 tags additionally conditioned on consent-cookie variables (below) — additional consent checks are **retained**, never removed |
| Grant-after-load GA4 initialization | Website + GTM trigger | Site pushes transition events `mildmate_analytics_granted` / `mildmate_analytics_revoked` / `mildmate_marketing_granted` / `mildmate_marketing_revoked` (only while the container is loaded); the GA4 Config tag has a second trigger on `mildmate_analytics_granted` |

Key invariants (test-asserted):
- Marketing is **never** inferred from analytics-only history: absent `marketing` key ⇒ denied; the cookie mirrors the same rule.
- On a fresh GTM load, the template reads the cookie at Consent Initialization — exactly one clean GA4 firing; the transition events are suppressed when the container is not yet loaded, so no duplicate page_view is possible.
- Basic Consent policy untouched: default all-denied before any Google tag executes; site load-gate unchanged (GTM loads only when Analytics **or** Marketing is granted; Reject ⇒ GTM never loads ⇒ zero requests).

## 2. Exact GTM staging configuration (GTM-M9DMRGCD) — for owner execution

### 2a. Custom consent template (Template → New, name "MildMate Consent Bridge")

**Correction (2026-10-11):** (1) `callInWindow` requires the `access_globals` permission with **Execute** on `__mildmateAddConsentListener` — added, narrowly scoped to that one key, no read/write. (2) Substring-based cookie parsing replaced with strict validation of the exact two-segment format; missing, duplicated, malformed, or unrecognized values keep the denied default. Canonical source: `gtm-templates/mildmate-consent-bridge.js`, executed under stubbed template APIs by `workers/api/__tests__/gtm-consent-template.test.ts` (vitest 83/83).

Template code (paste exactly; the repo file is the single source of truth):

```js
const setDefaultConsentState = require('setDefaultConsentState');
const updateConsentState = require('updateConsentState');
const getCookieValues = require('getCookieValues');
const callInWindow = require('callInWindow');

const CONSENT_COOKIE = 'mm-consent';
const CONSENT_LISTENER_KEY = '__mildmateAddConsentListener';

// 1. DEFAULT — always all-denied, before any Google tag executes.
setDefaultConsentState({
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied'
});

// Strict parser for the site's consent cookie. Accepts exactly
// 'analytics:<granted|denied>,marketing:<granted|denied>' (either segment
// order, no whitespace, no duplicates, no extra segments, no other keys).
// Returns {analytics, marketing} or null for anything else — null must
// leave the denied default as the operative state.
function parseConsentCookie(raw) {
  if (typeof raw !== 'string') return null;
  const parts = raw.split(',');
  if (parts.length !== 2) return null;
  const parsed = {};
  for (let i = 0; i < 2; i++) {
    const m = parts[i].match(/^(analytics|marketing):(granted|denied)$/);
    if (!m) return null;
    if (parsed[m[1]] !== undefined) return null; // duplicated key
    parsed[m[1]] = m[2];
  }
  return parsed;
}

function updateFromChoice(choice) {
  updateConsentState({
    analytics_storage: choice.analytics === 'granted' ? 'granted' : 'denied',
    ad_storage: choice.marketing === 'granted' ? 'granted' : 'denied',
    ad_user_data: choice.marketing === 'granted' ? 'granted' : 'denied',
    ad_personalization: choice.marketing === 'granted' ? 'granted' : 'denied'
  });
}

// 2. UPDATE for returning users — applied DURING Consent Initialization,
//    before any Initialization-phase tag fires. Malformed or missing
//    cookies intentionally keep the denied default (no update call).
try {
  const values = getCookieValues(CONSENT_COOKIE);
  if (values && values.length > 0) {
    const choice = parseConsentCookie(values[0]);
    if (choice) {
      updateFromChoice(choice);
    }
  }
} catch (e) {
  // Cookie unreadable — denied default stands.
}

// 3. Live updates (mid-page opt-in / withdrawal) — the site invokes the
//    registered callback on every consent change. The payload shape is
//    owned by public/js/cookie-consent.js (notifyConsentListeners).
try {
  callInWindow(CONSENT_LISTENER_KEY, function (payload) {
    updateConsentState({
      analytics_storage: payload && payload.analyticsConsentGranted === true ? 'granted' : 'denied',
      ad_storage: payload && payload.adConsentGranted === true ? 'granted' : 'denied',
      ad_user_data: payload && payload.adUserDataConsentGranted === true ? 'granted' : 'denied',
      ad_personalization: payload && payload.adPersonalizationConsentGranted === true ? 'granted' : 'denied'
    });
  });
} catch (e) {
  // Registry absent (e.g. site script blocked) — denied default stands.
}

data.gtmOnSuccess();
```

**Template permissions (complete set — nothing else):**

| Permission section in GTM UI | Required access | Value |
|---|---|---|
| Accesses consent state | `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage` | Write |
| Reads cookies | Specified cookie names | `mm-consent` only |
| Access global variables (`access_globals`) | Key `__mildmateAddConsentListener` | **Execute only** (required by `callInWindow`; no Read, no Write, no other keys) |

**Template fields:** none. `CONSENT_COOKIE` and `CONSENT_LISTENER_KEY` are constants coupled to `public/js/cookie-consent.js`; a Fields-tab configuration surface is deliberately not provided.

### 2b. Consent bridge tag

- Tag type: Custom (the template above), name "MildMate Consent Bridge".
- Trigger: **Consent Initialization – All Pages** (built-in; firing during this phase is what makes the state correct before Initialization-phase measurement tags run).

### 2c. Variables

| Name | Type | Code |
|---|---|---|
| `JS - mmConsentAnalytics` | Custom JavaScript | `function () { var m = document.cookie.match(/(?:^|;\s*)mm-consent=([^;]*)/); if (!m) return 'denied'; var a = m[1].match(/analytics:(granted|denied)/); return a ? a[1] : 'denied'; }` |
| `JS - mmConsentMarketing` | Custom JavaScript | same with `marketing:(granted|denied)` |
| DLVs (existing plan §2.3) | Data Layer Variables | `eventModel`, `ecommerce`, `eventModel.transaction_id`, `eventModel.value`, `eventModel.currency` |

Absent cookie ⇒ `'denied'` (fail-closed).

### 2d. Tags and triggers

| Tag | Trigger(s) + condition | Effect |
|---|---|---|
| **GA4 Config — Staging QA** (Google tag `G-E8W6FZE6LP`) | 1. Initialization – All Pages **with condition** `{{JS - mmConsentAnalytics}} equals granted`<br>2. Custom Event `mildmate_analytics_granted` | Fires once at page load for returning Analytics users; re-fires after a mid-page Analytics grant so GA4 initializes without a refresh |
| **GA4 Event — ecommerce router** (GA4 Event, Measurement ID `G-E8W6FZE6LP`, Event Name `{{Event}}`, Send Ecommerce: ON / Data Layer) | Custom Event, regex `(?i)^(view_item|add_to_cart|view_cart|begin_checkout|purchase)$` **with condition** `{{JS - mmConsentAnalytics}} equals granted` | Per-event gating; blocked after withdrawal |
| Ads tags | **None in staging** (unchanged isolation rule). In the production container later: Initialization + condition `{{JS - mmConsentMarketing}} equals granted`, plus second trigger on `mildmate_marketing_granted`, plus additional consent checks on all four types. | Production-only; not in this container |

**Additional consent checks are retained** on both GA4 tags (Analytics tags require `analytics_storage` granted — tag-level "Consent settings: Require additional consent" / built-in Google-tag consent check). The trigger conditions do not replace them; they add a deterministic, locally testable second gate that guarantees the Basic-mode policy (no GA4 request at all when Analytics is denied, not even consent-mode cookieless pings).

### 2e. Deployment sequencing (mandatory)

1. Owner configures the staging container (template + tag + variables + conditions) in **Preview mode only** — do not publish yet.
2. Site commit (`0edb380`) is deployed to the preview branch (requires approval).
3. Validate with Tag Assistant + the §6 checklist, then publish the container once.
   - Rationale: the site at `0edb380` emits no consent commands; it **must** not run before the template exists, or no consent owner is present at all. The currently deployed preview (`0329707d`, pre-`429d996` code) still owns defaults+updates site-side, so there is no gap on today's live preview.

## 3. Website code changes (commit `0edb380`)

- `public/js/analytics-env.js` — removed `pushConsentUpdate()` and `__mildmateUpdateConsent()`; the site no longer queues any `gtag('consent', …)` command (comment block documents the full-template ownership model). Resolver, load gate, event contract, and staging isolation unchanged.
- `public/js/cookie-consent.js` —
  - `writeConsentCookie()`: mirrors the choice to `mm-consent` (1 year, SameSite=Lax, Secure); called at script scope (covers localStorage-only historical users) and on every save — so the template always reads the current state at Consent Initialization.
  - `window.__mildmateAddConsentListener` registry defined at **script scope** (before DOMContentLoaded ⇒ before any possible GTM load); template callbacks invoked with `{analyticsConsentGranted, adConsentGranted, adUserDataConsentGranted, adPersonalizationConsentGranted}`.
  - Transition events (`mildmate_analytics_granted` / `_revoked`, `mildmate_marketing_granted` / `_revoked`) pushed only while the container is already loaded — prevents duplicate page_view fires.
  - `window.__mildmateSaveConsent` exposed (programmatic consent change; future "Cookie Settings" footer link builds directly on it).
- `public/_worker.js` — unchanged (static JS is served directly, not compiled into the bundle; rebuild verified byte-identical).

## 4. Test coverage (consent initialization + update timing)

- **vitest 83/83** (`0edb380` tree + template suite). Contract suite asserts: zero site-side consent commands (default and update) with the container booted on stored consent; `gtm.js` still gated on consent; marketing independence for legacy analytics-only records; marketing-only still boots the container (Ads gating lives in GTM).
- **GTM template suite (2026-10-11 correction):** the template source (`gtm-templates/mildmate-consent-bridge.js`) is executed under stubbed `setDefaultConsentState` / `updateConsentState` / `getCookieValues` / `callInWindow` APIs: all four valid cookie combinations map exactly; 13 malformed-cookie cases (empty, garbage, single segment, extra segment, duplicated key, unrecognized value, wrong separator, whitespace, uppercase, unknown key, trailing comma) plus absent cookie produce **no** `updateConsentState` call (denied default stands); listener payload mapping, withdrawal, partial/null payload denial; static assertions pin the required template APIs to exactly the four documented ones, `callInWindow` to the single key `__mildmateAddConsentListener`, and the cookie read to `mm-consent`.
- **Browser matrix 23/23** (was 14) — new checks:
  - `mm-consent` cookie exposed before GTM state application (`analytics:granted,marketing:denied` for an analytics-only history) and fully denied after withdrawal;
  - `__mildmateAddConsentListener` registered and receives the exact template-shaped payload on change;
  - site emits zero gtag consent commands in a real browser;
  - mid-page marketing opt-in on a loaded container fires `mildmate_marketing_granted` with **no** `mildmate_analytics_granted` (no spurious GA4 refire);
  - withdrawal on a loaded container fires `mildmate_analytics_revoked` and flips the listener payload and cookie to fully denied.
- Not locally automatable: real-GTM consent-state ordering (template execution) — covered by the Tag Assistant steps in §6.

## 5. GA4 tag firing matrix (denied default + additional consent checks)

| # | Scenario | Cookie / consent state at Consent Initialization | GA4 Config (Google tag) | GA4 events | Verified by |
|---|---|---|---|---|---|
| 1 | Returning visitor, Analytics-only | cookie read during Consent Initialization → `analytics_storage` granted before Initialization tags | Fires at Initialization (consent check passes + condition granted) — exactly once | Permitted ecommerce events fire | Matrix #1/#4/#5 + Tag Assistant (§6) |
| 2 | Marketing-only | analytics denied, ads granted | **Never fires** — trigger condition fails AND consent check blocks; no GA4 request of any kind (Basic mode; no cookieless ping because the tag never executes) | Blocked (condition + consent) | Matrix (bridge/cookie checks) + §6 |
| 3 | Accept All | both granted | Fires | Fire | Matrix #3 + §6 |
| 4 | Reject Optional | cookie `denied,denied`; site load-gate: GTM never loads | No container, no requests | None | Matrix #2 |
| 5 | Grant after page load (first visit, Accept All at t>0) | GTM loads fresh; template applies granted state during Consent Initialization; transition event suppressed (container not loaded at change time) | Fires exactly once via Initialization | Fire thereafter | Matrix #3 + §6 |
| 6 | Returning visitor | same as #1 — applied **before** tag firing | Fires once (no duplicate from backlog: no queued consent commands exist anymore) | Fire | Contract tests + §6 |
| 7 | Mid-page Analytics grant on already-loaded container (marketing-only → +Analytics via settings) | listener → `updateConsentState(granted)`; site pushes `mildmate_analytics_granted` | **Re-fires** on second trigger → GA4 initializes without refresh | Fire thereafter | Matrix #8 (marketing variant) + §6 |
| 8 | Withdrawal after load | listener → `updateConsentState(denied)`; `mildmate_analytics_revoked` (no GA4 trigger on it) | Does not re-fire | Subsequent ecommerce events blocked by condition + consent check. (GA4 cookies already set remain until expiry — inherent Basic-mode limitation, documented) | Matrix #9 + §6 |

The refire claim for #7 (GA4 initializes on the `mildmate_analytics_granted` event without refresh) is mechanically guaranteed by the second trigger, and the consent state is applied synchronously via the listener **before** GTM processes that dataLayer event — but final confirmation requires one real-GTM Tag Assistant pass (§6.3).

## 6. Remaining manual Tag Assistant validation (owner, staging container in Preview mode)

1. **Consent default check (the original failure):** Tag Assistant → Consent → "Default consent state" must show all four signals `denied`, set during Consent Initialization, before Initialization.
2. **Consent update check:** with a pre-set `mm-consent` cookie, Consent tab must show the update applied during Consent Initialization (returning-user path), before the Google tag fires.
3. **Grant-after-load:** clear cookies, load with all denied, click Accept All → confirm the Google tag fires on `mildmate_analytics_granted` (no page refresh), `analytics_storage` granted.
4. **Marketing-only isolation:** cookie `analytics:denied,marketing:granted` → confirm zero `/g/collect` (GA4) requests; ads-classified requests only appear in the production container.
5. **Withdrawal:** revoke via settings → confirm subsequent GA4 events are held in Tag Assistant.
6. Then publish the container once (owner action).

## 7. Commits (local only, `ga4/remediation-isolated`)

- `0edb380` — GA4 consent ownership: GTM template owns default and update (site code + contract tests + matrix 23/23).
- 2026-10-11 corrections commit (see git log): strict cookie parsing + `access_globals` Execute permission on `__mildmateAddConsentListener`; canonical template file `gtm-templates/mildmate-consent-bridge.js`; template test suite (vitest 83/83).
- Prior chain unchanged: `429d996` (site default removal, superseded by `0edb380`) ← `685aa85` (deployment evidence) ← …
- This report + staging-plan consent section updated in the follow-up commit (recorded in the handoff folder).

## 8. Verdict

**GO — conditional**, for the exact staging GTM configuration in §2 (owner action, Preview mode first; container publish only after the §6 checklist passes):
1. Configure the consent template + tag conditions per §2 (no publish).
2. Approve the preview deploy of `0edb380` (sequencing in §2e — site code must not go live before the template exists).
3. Run §6 Tag Assistant validation; publish the container; then proceed to real-GTM e2e.

**NO-GO** for: deploying the site consent commits before the template is configured, publishing GTM before §6 passes, and any production container/GA4/Ads change (unchanged blockers: Marketing-category UI sign-off, release execution approval).

No deploy, push, GTM publish, GA4 change, production change, or payment action was performed. Stopping here for review.
