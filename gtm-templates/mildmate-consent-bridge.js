// MildMate Consent Bridge — GTM Custom Tag Template (Sandboxed JavaScript).
// Single source of truth for the staging container GTM-M9DMRGCD consent
// template. Tested by workers/api/__tests__/gtm-consent-template.test.ts:
// edit this file, re-run vitest, then paste the final version into GTM.
//
// Sandboxed-JavaScript compatibility notes:
//   - No regular-expression literals or RegExp: parsing uses indexOf/slice
//     with exact string comparisons only.
//   - No exception-handling blocks: absent cookies are handled with plain
//     conditional checks (getCookieValues returns an empty array when the
//     cookie is missing — documented behavior, it does not throw).
//   - No arrow functions, template literals, object spread, or constructors.
//
// Required template permissions (GTM Permissions tab — nothing else):
//   Accesses consent state — Write on ad_storage, ad_user_data,
//     ad_personalization, analytics_storage.
//   Reads cookies — mm-consent.
//   Access global variables — key __mildmateAddConsentListener, operation
//     Execute only (required by callInWindow). No Read, no Write, no other
//     global keys.
// Template fields: none. The constants below are coupled to
// public/js/cookie-consent.js (CONSENT_COOKIE and the listener registry
// name); changing one side without the other breaks consent application.

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

// Strict cookie-segment parser. Accepts exactly 'analytics:<granted|denied>'
// or 'marketing:<granted|denied>' — exact string comparisons only, no
// regular expressions. Returns {key, value} or null for anything else.
function parseConsentSegment(segment) {
  const sep = segment.indexOf(':');
  if (sep === -1) return null;
  const key = segment.slice(0, sep);
  const value = segment.slice(sep + 1);
  if (key !== 'analytics' && key !== 'marketing') return null;
  if (value !== 'granted' && value !== 'denied') return null;
  return { key: key, value: value };
}

// Strict parser for the full consent-cookie value. Accepts exactly
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
    const segment = parseConsentSegment(parts[i]);
    if (!segment || parsed[segment.key] !== undefined) return null; // duplicate
    parsed[segment.key] = segment.value;
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
//    before any Initialization-phase tag fires. Conditional checks only:
//    a missing cookie yields an empty array (documented getCookieValues
//    behavior), a malformed value parses to null, and a duplicate
//    mm-consent cookie yields more than one array entry — all three keep
//    the denied default as the operative state (no update call). The
//    single-cookie requirement matches the MildMate Consent Signal
//    variable template: an ambiguous cookie state must fail closed.
const savedValues = getCookieValues(CONSENT_COOKIE);
if (savedValues && savedValues.length === 1) {
  const choice = parseConsentCookie(savedValues[0]);
  if (choice) {
    updateFromChoice(choice);
  }
}

// 3. Live updates (mid-page opt-in / withdrawal) — the site invokes the
//    registered callback on every consent change. The payload shape is
//    owned by public/js/cookie-consent.js (notifyConsentListeners).
//
//    Fail-safe note (replaces a guarded call): the site script defines
//    window.__mildmateAddConsentListener at script scope, and analytics
//    can only load through that script, so the registry exists whenever
//    this template runs. If it were ever absent, GTM would fail the tag
//    AFTER the default and any saved update were applied — the denied
//    default remains the operative state, which is the safe direction.
//    Gating the call on window state would require access_globals Read
//    (copyFromWindow), which the permission model forbids.
callInWindow(CONSENT_LISTENER_KEY, function (payload) {
  updateConsentState({
    analytics_storage: payload && payload.analyticsConsentGranted === true ? 'granted' : 'denied',
    ad_storage: payload && payload.adConsentGranted === true ? 'granted' : 'denied',
    ad_user_data: payload && payload.adUserDataConsentGranted === true ? 'granted' : 'denied',
    ad_personalization: payload && payload.adPersonalizationConsentGranted === true ? 'granted' : 'denied'
  });
});

data.gtmOnSuccess();
