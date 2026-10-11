// MildMate Consent Bridge — GTM Custom Tag Template (sandboxed JavaScript).
// Single source of truth for the staging container GTM-M9DMRGCD consent
// template. Tested by workers/api/__tests__/gtm-consent-template.test.ts:
// edit this file, re-run vitest, then paste the final version into GTM.
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
