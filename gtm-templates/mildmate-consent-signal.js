// MildMate Consent Signal — GTM Custom VARIABLE Template (Sandboxed JavaScript).
// CSP-compatible replacement for the blocked Custom JavaScript variables
// JS - mmConsentAnalytics / JS - mmConsentMarketing: page-context Custom JS
// variables require 'unsafe-eval' (absent from the staging CSP), while
// sandboxed variable templates do not. Tested by
// workers/api/__tests__/gtm-consent-variable.test.ts — edit this file,
// re-run vitest, then paste the final version into the GTM variable
// template editor.
//
// One template, two instances: the `signal` field selects which consent
// signal the variable resolves (analytics | marketing).
//
// Required template permissions (GTM Permissions tab — nothing else):
//   Reads cookies — mm-consent (Read).
//   No consent-state access, no global access, no DOM access: this variable
//   only reads a cookie and computes a string, so it cannot alter consent.
// Template fields: exactly one — `signal` (select: analytics | marketing).
// The cookie name is a constant coupled to public/js/cookie-consent.js.

const getCookieValues = require('getCookieValues');

const CONSENT_COOKIE = 'mm-consent';

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
// Returns {analytics, marketing} or null for anything else — every invalid
// shape must fail closed to 'denied'.
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

// Fail closed on an unexpected field value (template misconfiguration must
// never open consent).
const signal = data.signal;
if (signal !== 'analytics' && signal !== 'marketing') {
  return 'denied';
}

// Exactly one cookie value is acceptable: absent (empty array) and
// ambiguous duplicates (more than one mm-consent cookie) both deny.
const values = getCookieValues(CONSENT_COOKIE);
if (!values || values.length !== 1) {
  return 'denied';
}

const choice = parseConsentCookie(values[0]);
if (!choice) {
  return 'denied';
}

return choice[signal] === 'granted' ? 'granted' : 'denied';
