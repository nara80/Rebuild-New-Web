/* ============================================
   MildMate Geo & Currency — Phase 4
   Detects visitor location, sets currency/price display
   ============================================ */

(function () {
  var _callbacks = [];
  var geo = {
    country: null,
    currency: 'USD',
    detected: false
  };

  function getPageCurrencyByLanguage() {
    var p = (window.location && window.location.pathname ? window.location.pathname : '').toLowerCase();
    if (p === '/th' || p.indexOf('/th/') === 0) return 'THB';
    return 'USD';
  }

  function formatPrice(el, currency) {
    var usd = parseFloat(el.dataset.usd);
    var thb = parseFloat(el.dataset.thb);
    if (!usd && !thb) return;
    if (currency === 'THB' && thb) {
      el.textContent = '฿' + thb.toLocaleString();
    } else {
      el.textContent = 'USD ' + usd.toFixed(2);
    }
  }

  function updatePrices(currency) {
    document.querySelectorAll('[data-usd]').forEach(function (el) {
      formatPrice(el, currency);
    });
    if (typeof window.configuratorRecalc === 'function') {
      window.configuratorRecalc();
    }
  }

  function fireCallbacks() {
    _callbacks.forEach(function (fn) { fn(geo); });
    _callbacks = [];
  }

  function detect() {
    var pageCurrency = getPageCurrencyByLanguage();
    fetch('/api/geo')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        geo.country = data.country || null;
        // Currency is language-based: EN pages = USD, TH pages = THB
        geo.currency = pageCurrency;
        geo.detected = true;
        updatePrices(geo.currency);
        fireCallbacks();
      })
      .catch(function () {
        geo.currency = pageCurrency;
        geo.detected = true;
        updatePrices(geo.currency);
        fireCallbacks();
      });
  }

  window.MildMateGeo = geo;
  window.MildMateGeo.updatePrices = updatePrices;
  window.MildMateGeo.onDetect = function (fn) {
    if (geo.detected) { fn(geo); return; }
    _callbacks.push(fn);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detect);
  } else {
    detect();
  }
})();
