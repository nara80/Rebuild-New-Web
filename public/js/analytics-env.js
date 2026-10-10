(function (global) {
  'use strict';

  var PROD_HOSTS = {
    'www.mildmate.com': true,
    'mildmate.com': true
  };
  var PROD_GTM_ID = 'GTM-KLJZZM9';
  var PROD_GA4_ID = 'G-ESL161CNBV';

  function norm(s) {
    return String(s || '').trim();
  }

  function isProdHost(hostname) {
    return !!PROD_HOSTS[norm(hostname).toLowerCase()];
  }

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

  global.__resolveMildMateAnalyticsConfig = resolveMildMateAnalyticsConfig;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { resolveMildMateAnalyticsConfig: resolveMildMateAnalyticsConfig };
  }
})(typeof window !== 'undefined' ? window : globalThis);
