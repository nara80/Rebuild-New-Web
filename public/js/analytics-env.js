(function (global) {
  'use strict';

  var PROD_HOSTS = {
    'www.mildmate.com': true,
    'mildmate.com': true
  };
  var PROD_GTM_ID = 'GTM-KLJZZM9';
  var PROD_GA4_ID = 'G-0GWVSPJLVJ';
  var CONSENT_STORAGE_KEY = 'mildmate-cookie-consent';
  var ECOM_EVENTS = {
    view_item: true,
    add_to_cart: true,
    view_cart: true,
    begin_checkout: true,
    purchase: true
  };

  function norm(s) {
    return String(s || '').trim();
  }

  function isProdHost(hostname) {
    return !!PROD_HOSTS[norm(hostname).toLowerCase()];
  }

  function ensureDataLayerAndGtag() {
    global.dataLayer = global.dataLayer || [];
    if (typeof global.gtag !== 'function') {
      global.gtag = function () {
        global.dataLayer.push(arguments);
      };
    }
  }

  function hasAnalyticsConsent() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(CONSENT_STORAGE_KEY) : null;
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      return !!(parsed && parsed.analytics === true);
    } catch (e) {
      return false;
    }
  }

  // Marketing consent is independent of analytics consent. Absent key on
  // historical records (analytics-only acceptance) means NOT granted.
  function hasMarketingConsent() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(CONSENT_STORAGE_KEY) : null;
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      return !!(parsed && parsed.marketing === true);
    } catch (e) {
      return false;
    }
  }

  // Consent Mode v2 (Basic) — consent ownership (full GTM template model):
  //   The GTM consent template owns BOTH the default state
  //   (setDefaultConsentState) and all updates (updateConsentState). The
  //   site never queues gtag('consent', ...) commands: queued consent
  //   commands from a deferred loader are replayed only AFTER GTM's
  //   Initialization triggers, so tags would evaluate before the state was
  //   applied (the Tag Assistant "Consent not configured" failure).
  //   Instead, the site (cookie-consent.js) exposes the current choice via
  //   (1) a first-party cookie `mm-consent` the template reads at Consent
  //   Initialization, and (2) a listener registry `__mildmateAddConsentListener`
  //   the template registers so changes and withdrawals apply live via
  //   updateConsentState. Analytics acceptance never grants advertising
  //   signals and vice versa (marketing defaults denied, never inferred).

  function resolveMildMateAnalyticsConfig(input) {
    var host = norm(input && input.hostname ? input.hostname : (global.location && global.location.hostname) || '').toLowerCase();
    var override = (input && input.override) || global.__MILDMATE_ANALYTICS_CONFIG || {};
    var prodHost = isProdHost(host);

    var envRaw = norm(override.environment).toLowerCase();
    var env = envRaw || (prodHost ? 'production' : 'non-production');
    var isProduction = env === 'production' && prodHost;

    var config = {
      environment: env,
      isProduction: isProduction,
      host: host,
      enabled: false,
      gtmId: null,
      ga4Id: null,
      allowAdsConversions: false,
      reason: ''
    };

    if (isProduction) {
      config.enabled = true;
      config.gtmId = PROD_GTM_ID;
      config.ga4Id = PROD_GA4_ID;
      config.allowAdsConversions = true;
      return config;
    }

    var nonProdApproved = override && override.nonProductionApproved === true;
    if (!nonProdApproved) {
      config.reason = 'non_production_default_disabled';
      return config;
    }

    var gtmId = norm(override.gtmId);
    var ga4Id = norm(override.ga4Id);
    if (!gtmId || !ga4Id) {
      config.reason = 'non_production_ids_missing';
      return config;
    }
    if (gtmId === PROD_GTM_ID || ga4Id === PROD_GA4_ID) {
      config.reason = 'non_production_ids_match_production_blocked';
      return config;
    }

    config.enabled = override.enabled !== false;
    config.gtmId = gtmId;
    config.ga4Id = ga4Id;
    config.allowAdsConversions = false;
    config.reason = config.enabled ? 'non_production_isolated_enabled' : 'non_production_explicitly_disabled';
    return config;
  }

  function loadAnalytics(options) {
    var opts = options || {};
    var gtmId = norm(opts.gtmId);
    if (!gtmId) return false;
    if (global.__mildmateAnalyticsLoaded) return true;

    ensureDataLayerAndGtag();
    global.__mildmateAnalyticsLoaded = true;
    global.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

    var s = document.createElement('script');
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + gtmId;
    s.async = true;
    document.head.appendChild(s);

    var noscriptId = norm(opts.noscriptId);
    if (noscriptId) {
      var ns = document.getElementById(noscriptId);
      if (ns && !ns.innerHTML) {
        ns.innerHTML = '<iframe src="https://www.googletagmanager.com/ns.html?id=' + gtmId + '" height="0" width="0" style="display:none;visibility:hidden"></iframe>';
      }
    }
    return true;
  }

  function trackEvent(name, params) {
    var eventName = norm(name);
    if (!eventName) return;
    ensureDataLayerAndGtag();
    var payload = params && typeof params === 'object' ? params : {};
    var eventObj = {
      event: eventName,
      eventModel: payload
    };
    if (ECOM_EVENTS[eventName]) {
      eventObj.ecommerce = payload;
    }
    global.dataLayer.push(eventObj);
  }

  function initAnalytics(options) {
    var opts = options || {};
    var resolver = global.__resolveMildMateAnalyticsConfig || resolveMildMateAnalyticsConfig;
    var cfg = resolver({ hostname: global.location && global.location.hostname });
    if (!cfg || cfg.enabled !== true) return false;

    var gtmId = norm(cfg.gtmId);
    if (!gtmId) return false;

    global.__mildmateLoadAnalytics = function () {
      return loadAnalytics({ gtmId: gtmId, noscriptId: norm(opts.noscriptId) || 'gtm-noscript' });
    };

    // Load when EITHER measured category is granted; per-tag behavior is
    // governed by the GTM consent template (consent state) plus tag-level
    // trigger conditions on the consent cookie (Basic Consent policy).
    var consentGranted = hasAnalyticsConsent() || hasMarketingConsent();
    if (!consentGranted) return false;

    var mobileLazy = opts.mobileLazy !== false;
    var isMobile = global.matchMedia && global.matchMedia('(max-width: 768px)').matches;
    if (!mobileLazy || !isMobile) {
      global.__mildmateLoadAnalytics();
      return true;
    }

    var started = false;
    var startOnce = function () {
      if (started) return;
      started = true;
      global.removeEventListener('pointerdown', startOnce, true);
      global.removeEventListener('keydown', startOnce, true);
      global.removeEventListener('touchstart', startOnce, true);
      global.__mildmateLoadAnalytics();
    };

    global.addEventListener('pointerdown', startOnce, { once: true, capture: true, passive: true });
    global.addEventListener('keydown', startOnce, { once: true, capture: true });
    global.addEventListener('touchstart', startOnce, { once: true, capture: true, passive: true });

    if (document.readyState === 'complete') {
      setTimeout(startOnce, 6000);
    } else {
      global.addEventListener('load', function () { setTimeout(startOnce, 6000); }, { once: true });
    }
    return true;
  }

  global.__mildmateHasAnalyticsConsent = hasAnalyticsConsent;
  global.__mildmateHasMarketingConsent = hasMarketingConsent;
  global.__mildmateTrackEvent = trackEvent;
  global.__mildmateInitAnalytics = initAnalytics;
  global.__resolveMildMateAnalyticsConfig = resolveMildMateAnalyticsConfig;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      resolveMildMateAnalyticsConfig: resolveMildMateAnalyticsConfig,
      hasAnalyticsConsent: hasAnalyticsConsent,
      hasMarketingConsent: hasMarketingConsent
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
