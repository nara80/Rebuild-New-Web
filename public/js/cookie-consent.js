/* ============================================
   MildMate Cookie Consent — Phase 4
   GDPR/CCPA-compliant banner + settings modal
   ============================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'mildmate-cookie-consent';
  const ATTRIBUTION_STORAGE_KEY = 'mildmate-acquisition-attribution-v1';

  // First-party mirror of the current choice, read by the GTM consent
  // template at Consent Initialization (the template sandbox cannot read
  // localStorage). Plain ASCII so no URI encoding is needed:
  //   mm-consent=analytics:granted,marketing:denied
  const CONSENT_COOKIE = 'mm-consent';

  // Default consent state (nothing accepted until user chooses).
  // marketing is independent of analytics; historical records without the
  // marketing key are treated as marketing: false (never auto-granted).
  const defaultConsent = {
    essential: true,
    analytics: false,
    marketing: false,
    timestamp: 0,
  };

  let consent = { ...defaultConsent };

  // Load saved consent from localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        consent = { ...defaultConsent, ...parsed };
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }

  function readAttributionState() {
    try {
      const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeAttributionState(nextState) {
    try {
      localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(nextState || {}));
    } catch (e) {
      // localStorage may be unavailable
    }
  }

  function cleanPath(rawPath) {
    var path = String(rawPath || '').trim();
    if (!path) return null;
    path = path.split('?')[0].split('#')[0].trim();
    if (!path) return null;
    if (path.charAt(0) !== '/') path = '/' + path;
    path = path.replace(/\/{2,}/g, '/');
    if (/^\/quote\/qt-[^/]+\/?$/i.test(path)) return '/quote/';
    return path.slice(0, 240);
  }

  function getCookieValue(name) {
    try {
      var parts = document.cookie ? document.cookie.split('; ') : [];
      var prefix = name + '=';
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].indexOf(prefix) === 0) return parts[i].substring(prefix.length);
      }
    } catch (e) {}
    return '';
  }

  function getGaClientId() {
    if (consent.analytics !== true) return null;
    var ga = getCookieValue('_ga');
    if (!ga) return null;
    var m = ga.match(/GA\d+\.\d+\.(\d+\.\d+)/);
    return m && m[1] ? m[1] : null;
  }

  function getGaSessionId() {
    if (consent.analytics !== true) return null;
    try {
      var parts = document.cookie ? document.cookie.split('; ') : [];
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].indexOf('_ga_') !== 0) continue;
        var value = parts[i].split('=').slice(1).join('=');
        var m = value.match(/GS\d+\.\d+\.(\d+)/);
        if (m && m[1]) return m[1];
      }
    } catch (e) {}
    return null;
  }

  function readConsentStateForAttribution() {
    return {
      essential: true,
      analytics: consent.analytics === true,
      marketing: consent.marketing === true,
      timestamp: Number(consent.timestamp || 0) || null,
      captured_at: new Date().toISOString(),
      source: 'cookie-consent-js'
    };
  }

  function inferSourceMedium(utmSource, utmMedium, gclid, gbraid, wbraid, refDomain) {
    if (utmSource || utmMedium) {
      return {
        source: (utmSource || 'unknown').toLowerCase(),
        medium: (utmMedium || 'unknown').toLowerCase(),
        observed: true,
        inferred: false
      };
    }
    if (gclid || gbraid || wbraid) {
      return { source: 'google', medium: 'cpc', observed: true, inferred: false };
    }
    if (refDomain) {
      return { source: refDomain.toLowerCase(), medium: 'referral', observed: false, inferred: true };
    }
    return { source: '(direct)', medium: '(none)', observed: false, inferred: true };
  }

  function parseReferrerParts() {
    var out = { domain: null, path: null };
    var ref = String(document.referrer || '').trim();
    if (!ref) return out;
    try {
      var refUrl = new URL(ref);
      var currentHost = (window.location && window.location.hostname || '').toLowerCase();
      if (refUrl.hostname && refUrl.hostname.toLowerCase() === currentHost) return out;
      out.domain = refUrl.hostname ? refUrl.hostname.toLowerCase() : null;
      out.path = cleanPath(refUrl.pathname || '/');
      return out;
    } catch (e) {
      return out;
    }
  }

  function buildCurrentTouch() {
    var params;
    var search = (window.location && window.location.search) || '';
    if (typeof URLSearchParams !== 'undefined') {
      try {
        params = new URLSearchParams(search);
      } catch (e) {
        params = null;
      }
    }
    if (!params) {
      var manualMap = {};
      var query = String(search || '').replace(/^\?/, '');
      if (query) {
        var pairs = query.split('&');
        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i].split('=');
          var key = decodeURIComponent(String(pair[0] || '')).trim();
          if (!key) continue;
          var val = decodeURIComponent(String(pair.slice(1).join('=') || '')).trim();
          manualMap[key] = val;
        }
      }
      params = {
        get: function (k) {
          return Object.prototype.hasOwnProperty.call(manualMap, k) ? manualMap[k] : null;
        }
      };
    }
    var utmSource = (params.get('utm_source') || '').trim() || null;
    var utmMedium = (params.get('utm_medium') || '').trim() || null;
    var utmCampaign = (params.get('utm_campaign') || '').trim() || null;
    var utmTerm = (params.get('utm_term') || '').trim() || null;
    var utmContent = (params.get('utm_content') || '').trim() || null;

    var gclidRaw = (params.get('gclid') || '').trim() || null;
    var gbraidRaw = (params.get('gbraid') || '').trim() || null;
    var wbraidRaw = (params.get('wbraid') || '').trim() || null;
    var gclid = consent.marketing === true ? gclidRaw : null;
    var gbraid = consent.marketing === true ? gbraidRaw : null;
    var wbraid = consent.marketing === true ? wbraidRaw : null;

    var ref = parseReferrerParts();
    var inferred = inferSourceMedium(utmSource, utmMedium, gclid, gbraid, wbraid, ref.domain);
    var path = cleanPath((window.location && window.location.pathname) || '/');

    return {
      source: inferred.source,
      medium: inferred.medium,
      utm_source: utmSource ? utmSource.slice(0, 120) : null,
      utm_medium: utmMedium ? utmMedium.slice(0, 120) : null,
      utm_campaign: utmCampaign ? utmCampaign.slice(0, 140) : null,
      utm_term: utmTerm ? utmTerm.slice(0, 140) : null,
      utm_content: utmContent ? utmContent.slice(0, 140) : null,
      gclid: gclid ? gclid.slice(0, 120) : null,
      gbraid: gbraid ? gbraid.slice(0, 120) : null,
      wbraid: wbraid ? wbraid.slice(0, 120) : null,
      referrer_domain: ref.domain ? ref.domain.slice(0, 200) : null,
      referrer_path: ref.path,
      landing_path: path,
      ga_client_id: getGaClientId(),
      ga_session_id: getGaSessionId(),
      observed: inferred.observed,
      inferred: inferred.inferred,
      captured_at: new Date().toISOString()
    };
  }

  function scrubAttributionByConsent(state) {
    var next = state && typeof state === 'object' ? state : {};
    function scrubTouch(touch) {
      if (!touch || typeof touch !== 'object') return touch;
      var out = { ...touch };
      if (consent.marketing !== true) {
        out.gclid = null;
        out.gbraid = null;
        out.wbraid = null;
      }
      if (consent.analytics !== true) {
        out.ga_client_id = null;
        out.ga_session_id = null;
      }
      return out;
    }
    next.first_touch = scrubTouch(next.first_touch);
    next.latest_touch = scrubTouch(next.latest_touch);
    if (next.quote_session) next.quote_session = scrubTouch(next.quote_session);
    if (next.checkout_session) next.checkout_session = scrubTouch(next.checkout_session);
    next.consent_state = readConsentStateForAttribution();
    return next;
  }

  function captureAttributionTouch() {
    var state = readAttributionState();
    var touch = buildCurrentTouch();
    if (!state.first_touch) {
      state.first_touch = touch;
    }
    state.latest_touch = touch;
    state.consent_state = readConsentStateForAttribution();
    state.schema_version = 1;
    state.updated_at = new Date().toISOString();
    writeAttributionState(scrubAttributionByConsent(state));
  }

  function getAttributionSnapshot(stage) {
    var state = readAttributionState();
    var touch = buildCurrentTouch();
    if (!state.first_touch) state.first_touch = touch;
    state.latest_touch = touch;
    state.consent_state = readConsentStateForAttribution();
    state.schema_version = 1;
    state.updated_at = new Date().toISOString();
    state = scrubAttributionByConsent(state);
    writeAttributionState(state);
    return {
      schema_version: 1,
      consent_state: state.consent_state,
      first_touch: state.first_touch || null,
      quote_session: stage === 'quote' ? state.latest_touch : null,
      checkout_session: stage === 'checkout' ? state.latest_touch : null
    };
  }

  captureAttributionTouch();
  window.__mildmateGetAttributionSnapshot = getAttributionSnapshot;

  // Mirror any existing saved choice into the consent cookie immediately at
  // script scope — historical users have localStorage only, and the GTM
  // consent template must see their preferences BEFORE Initialization tags
  // fire (returning-user requirement).
  writeConsentCookie();

  // Only show banner if no valid consent exists
  const hasConsent = consent.timestamp > 0;

  // Last consent state actually applied — drives transition events pushed to
  // the dataLayer so GTM tags can re-fire after a mid-page consent change
  // (blocked tags do not re-fire on their own).
  let lastAnalyticsState = consent.analytics === true;
  let lastMarketingState = consent.marketing === true;

  // Listener registry the GTM consent template hooks into via callInWindow.
  // Defined at script scope (NOT inside DOMContentLoaded init) so it exists
  // before GTM loads, whenever GTM's Consent Initialization runs.
  const consentListeners = [];
  window.__mildmateAddConsentListener = function (cb) {
    if (typeof cb === 'function' && consentListeners.indexOf(cb) === -1) {
      consentListeners.push(cb);
    }
  };

  function writeConsentCookie() {
    try {
      const value =
        'analytics:' + (consent.analytics === true ? 'granted' : 'denied') +
        ',marketing:' + (consent.marketing === true ? 'granted' : 'denied');
      document.cookie = CONSENT_COOKIE + '=' + value +
        ';path=/;max-age=31536000;SameSite=Lax;Secure';
    } catch (e) {
      // Cookies unavailable — GTM template falls back to the denied default.
    }
  }

  function notifyConsentListeners() {
    const payload = {
      analyticsConsentGranted: consent.analytics === true,
      adConsentGranted: consent.marketing === true,
      adUserDataConsentGranted: consent.marketing === true,
      adPersonalizationConsentGranted: consent.marketing === true
    };
    for (let i = 0; i < consentListeners.length; i++) {
      try { consentListeners[i](payload); } catch (e) { /* listener errors must not break the UI */ }
    }
  }

  // Transition events only fire while the container is already loaded; when
  // it is not, the GTM consent template reads the fresh cookie at Consent
  // Initialization instead, which produces exactly one clean tag firing.
  function pushTransitionEvents() {
    if (!window.__mildmateAnalyticsLoaded) return;
    if (lastAnalyticsState !== true && consent.analytics === true) {
      window.dataLayer.push({ event: 'mildmate_analytics_granted' });
    } else if (lastAnalyticsState === true && consent.analytics !== true) {
      window.dataLayer.push({ event: 'mildmate_analytics_revoked' });
    }
    if (lastMarketingState !== true && consent.marketing === true) {
      window.dataLayer.push({ event: 'mildmate_marketing_granted' });
    } else if (lastMarketingState === true && consent.marketing !== true) {
      window.dataLayer.push({ event: 'mildmate_marketing_revoked' });
    }
  }

  // Banner HTML
  const bannerHTML = `
    <div id="cookie-banner" class="cookie-banner" role="dialog" aria-label="Cookie consent" aria-modal="false" style="display:none;">
      <div class="cookie-banner-inner">
        <p class="cookie-banner-text">We use cookies (and other similar technologies) to collect data to improve your shopping experience.</p>
        <div class="cookie-banner-actions">
          <button type="button" class="cookie-btn cookie-btn-settings" id="cookie-btn-settings">Settings</button>
          <button type="button" class="cookie-btn cookie-btn-reject" id="cookie-btn-reject">Reject all</button>
          <button type="button" class="cookie-btn cookie-btn-accept" id="cookie-btn-accept">Accept All Cookies</button>
        </div>
      </div>
    </div>
  `;

  // Settings modal HTML
  const modalHTML = `
    <div id="cookie-modal" class="cookie-modal" role="dialog" aria-label="Cookie preferences" aria-modal="true" style="display:none;">
      <div class="cookie-modal-backdrop" id="cookie-modal-backdrop"></div>
      <div class="cookie-modal-panel">
        <h2 class="cookie-modal-title">Cookie Preferences</h2>
        <p class="cookie-modal-desc">Manage your cookie preferences below. Essential cookies are always enabled as they are necessary for the website to function.</p>

        <div class="cookie-category">
          <div class="cookie-category-header">
            <div>
              <h3>Essential</h3>
              <p class="cookie-category-desc">Required for the website to function. Cannot be disabled.</p>
            </div>
            <label class="cookie-toggle">
              <input type="checkbox" checked disabled>
              <span class="cookie-toggle-slider cookie-toggle-locked"></span>
            </label>
          </div>
        </div>

        <div class="cookie-category">
          <div class="cookie-category-header">
            <div>
              <h3>Analytics</h3>
              <p class="cookie-category-desc">Help us understand how visitors interact with our website (Google Analytics 4).</p>
            </div>
            <label class="cookie-toggle">
              <input type="checkbox" id="cookie-toggle-analytics">
              <span class="cookie-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="cookie-category">
          <div class="cookie-category-header">
            <div>
              <h3>Marketing</h3>
              <p class="cookie-category-desc">Measure advertising performance, such as purchases from Google Ads. Not enabled by Analytics acceptance.</p>
            </div>
            <label class="cookie-toggle">
              <input type="checkbox" id="cookie-toggle-marketing">
              <span class="cookie-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="cookie-modal-actions">
          <button type="button" class="cookie-btn cookie-btn-settings" id="cookie-modal-save">Save Preferences</button>
          <button type="button" class="cookie-btn cookie-btn-accept" id="cookie-modal-accept-all">Accept All</button>
        </div>
      </div>
    </div>
  `;

  // Inject banner and modal into body
  function injectUI() {
    const div = document.createElement('div');
    div.innerHTML = bannerHTML + modalHTML;
    document.body.appendChild(div);
  }

  // Show banner
  function showBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.style.display = 'block';
      setTimeout(() => banner.classList.add('active'), 10);
    }
  }

  // Hide banner
  function hideBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.classList.remove('active');
      setTimeout(() => { banner.style.display = 'none'; }, 300);
    }
  }

  // Show modal
  function showModal() {
    const modal = document.getElementById('cookie-modal');
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('active'), 10);
      document.body.style.overflow = 'hidden';

      // Set toggles to current consent state
      const analyticsToggle = document.getElementById('cookie-toggle-analytics');
      if (analyticsToggle) analyticsToggle.checked = consent.analytics;
      const marketingToggle = document.getElementById('cookie-toggle-marketing');
      if (marketingToggle) marketingToggle.checked = consent.marketing;
    }
  }

  // Hide modal
  function hideModal() {
    const modal = document.getElementById('cookie-modal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }, 300);
    }
  }

  // Permanent Cookie Settings entry point — returning users must be able to
  // reopen preferences and change/withdraw consent without a page reload.
  // Injected at runtime into the site footer (bilingual label), with a
  // fixed-position fallback when no footer exists. Inline styles only: the
  // shared stylesheet is minified and page CSP allows inline styles.
  function injectSettingsEntry() {
    if (document.getElementById('cookie-settings-entry')) return;
    const isThai = (document.documentElement && document.documentElement.lang || '').toLowerCase() === 'th';
    const entry = document.createElement('button');
    entry.type = 'button';
    entry.id = 'cookie-settings-entry';
    entry.textContent = isThai ? 'ตั้งค่าคุกกี้' : 'Cookie Settings';
    entry.setAttribute('aria-haspopup', 'dialog');
    entry.style.cssText = 'display:block;margin:12px auto 0;padding:0;background:none;border:none;' +
      'color:#64748b;font:inherit;font-size:12px;text-decoration:underline;cursor:pointer;';
    entry.addEventListener('click', showModal);
    const footer = document.querySelector('footer');
    if (footer) {
      footer.appendChild(entry);
    } else {
      entry.style.cssText += 'position:fixed;left:12px;bottom:12px;z-index:9998;';
      document.body.appendChild(entry);
    }
  }

  // Save consent to localStorage + first-party consent cookie
  function saveConsent(newConsent) {
    consent = { ...newConsent, timestamp: Date.now() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch (e) {
      // localStorage might be disabled
    }
    try {
      const state = readAttributionState();
      writeAttributionState(scrubAttributionByConsent(state));
    } catch (e) {}
    writeConsentCookie();
    applyConsent();
    hideBanner();
    hideModal();
  }

  // Apply consent (notify GTM, load scripts)
  function applyConsent() {
    pushTransitionEvents();
    lastAnalyticsState = consent.analytics === true;
    lastMarketingState = consent.marketing === true;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'mildmate_consent_update',
      analytics_consent: consent.analytics === true ? 'granted' : 'denied',
      marketing_consent: consent.marketing === true ? 'granted' : 'denied'
    });

    if ((consent.analytics === true || consent.marketing === true) &&
        typeof window.__mildmateLoadAnalytics === 'function') {
      window.__mildmateLoadAnalytics();
    }

    // GTM consent template (registered via __mildmateAddConsentListener)
    // applies the new state with updateConsentState — no site-side
    // gtag('consent', ...) commands, so ordering with queued messages can
    // never desync.
    notifyConsentListeners();
  }

  // Initialize
  function init() {
    injectUI();
    injectSettingsEntry();

    // Bind banner buttons
    const btnSettings = document.getElementById('cookie-btn-settings');
    const btnReject = document.getElementById('cookie-btn-reject');
    const btnAccept = document.getElementById('cookie-btn-accept');

    if (btnSettings) {
      btnSettings.addEventListener('click', showModal);
    }
    if (btnReject) {
      btnReject.addEventListener('click', () => {
        saveConsent({ essential: true, analytics: false, marketing: false });
      });
    }
    if (btnAccept) {
      btnAccept.addEventListener('click', () => {
        saveConsent({ essential: true, analytics: true, marketing: true });
      });
    }

    // Bind modal buttons
    const modalBackdrop = document.getElementById('cookie-modal-backdrop');
    const modalSave = document.getElementById('cookie-modal-save');
    const modalAcceptAll = document.getElementById('cookie-modal-accept-all');

    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', hideModal);
    }
    if (modalSave) {
      modalSave.addEventListener('click', () => {
        const analytics = document.getElementById('cookie-toggle-analytics');
        const marketing = document.getElementById('cookie-toggle-marketing');
        saveConsent({
          essential: true,
          analytics: analytics ? analytics.checked : false,
          marketing: marketing ? marketing.checked : false
        });
      });
    }
    if (modalAcceptAll) {
      modalAcceptAll.addEventListener('click', () => {
        saveConsent({ essential: true, analytics: true, marketing: true });
      });
    }

    // Close modal on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const modal = document.getElementById('cookie-modal');
        if (modal && modal.classList.contains('active')) {
          hideModal();
        }
      }
    });

    // If no consent yet, show banner after a short delay
    if (!hasConsent) {
      setTimeout(showBanner, 1500);
    } else {
      // Apply existing consent (load scripts)
      applyConsent();
    }
  }

  // Programmatic consent change (future "Cookie Settings" footer link, QA
  // harnesses). Same path as the UI: persists, notifies GTM, fires
  // transitions, notifies listeners — no reload required.
  window.__mildmateSaveConsent = saveConsent;

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
