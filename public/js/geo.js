/* ============================================
   MildMate Geo & Currency — Phase 4
   Detects visitor location, sets currency/price display
   ============================================ */

(function () {
  const geo = {
    country: null,
    currency: 'USD',
    detected: false
  };

  function formatPrice(el, currency) {
    const usd = parseFloat(el.dataset.usd);
    const thb = parseFloat(el.dataset.thb);
    if (!usd && !thb) return;
    if (currency === 'THB' && thb) {
      el.textContent = '฿' + thb.toLocaleString();
    } else {
      el.textContent = '$' + usd.toFixed(2);
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

  function detect() {
    fetch('/api/geo')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        geo.country = data.country || null;
        geo.currency = data.currency || 'USD';
        geo.detected = true;
        window.MildMateGeo = geo;
        updatePrices(geo.currency);
      })
      .catch(function () {
        geo.detected = true;
        window.MildMateGeo = geo;
      });
  }

  window.MildMateGeo = geo;
  window.MildMateGeo.updatePrices = updatePrices;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detect);
  } else {
    detect();
  }
})();
