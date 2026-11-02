/* ============================================
   MildMate Catalog Campaign UI
   Applies sale badge, strike price, sale price, countdown on listing cards
   ============================================ */

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.__MildMateCatalogCampaignUiLoaded = true;

  var cards = Array.prototype.slice.call(document.querySelectorAll('.product-card'));
  if (!cards.length) return;

  var isThai = (function () {
    try {
      var lang = (document.documentElement && document.documentElement.lang || '').toLowerCase();
      var path = window.location.pathname || '';
      return lang === 'th' || path.indexOf('/th/') === 0;
    } catch (_) {
      return false;
    }
  })();

  function toNumber(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function getProductSlug(card) {
    var link = card.querySelector('a[href*="/product/"]');
    if (!link) return '';
    var href = link.getAttribute('href') || '';
    var parts = href.split('/').filter(function (s) { return s; });
    return parts.length ? parts[parts.length - 1] : '';
  }

  function formatBasePrice(usd, thb) {
    return isThai ? ('เริ่มต้น ฿' + Math.round(thb).toLocaleString()) : ('From US$' + Math.round(usd));
  }

  function buildSalePriceHtml(usd, thb, saleUsd, saleThb) {
    var base = formatBasePrice(usd, thb);
    var sale = formatBasePrice(saleUsd, saleThb);
    return '<span class="price-strike">' + base + '</span><span class="price-sale">' + sale + '</span>';
  }

  function ensureStyles() {
    if (document.getElementById('catalog-campaign-ui-style')) return;
    var style = document.createElement('style');
    style.id = 'catalog-campaign-ui-style';
    style.textContent =
      '.product-price .price-strike{color:#94a3b8;text-decoration:line-through;font-weight:600;margin-right:6px}' +
      '.product-price .price-sale{color:#dc2626;font-weight:800}' +
      '.catalog-sale-meta{display:flex;align-items:center;gap:8px;margin-top:6px;min-height:20px;flex-wrap:wrap}' +
      '.catalog-sale-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:#dc2626;color:#fff;font-size:11px;font-weight:700;letter-spacing:.02em;line-height:1.2}' +
      '.catalog-sale-countdown{font-size:12px;color:#64748b;font-weight:600;line-height:1.3}' +
      '@media (max-width:768px){.catalog-sale-meta{gap:6px}.catalog-sale-badge{font-size:10px;padding:2px 7px}.catalog-sale-countdown{display:block;width:100%;font-size:11px}}';
    document.head.appendChild(style);
  }

  function renderCardSale(card) {
    var priceEl = card.querySelector('.product-price');
    if (!priceEl) return;

    var usd = toNumber(priceEl.getAttribute('data-usd'));
    var thb = toNumber(priceEl.getAttribute('data-thb'));
    if (!usd && !thb) return;

    var slug = getProductSlug(card);
    var discountInfo = (typeof MildMateCampaigns !== 'undefined' && slug)
      ? MildMateCampaigns.getDiscountForProduct(slug)
      : { discount: 0 };
    var discount = toNumber(discountInfo && discountInfo.discount);

    var meta = card.querySelector('.catalog-sale-meta');
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'catalog-sale-meta';
      priceEl.insertAdjacentElement('afterend', meta);
    }

    if (discount > 0) {
      var saleUsd = Math.max(1, Math.round(usd * (1 - discount / 100)));
      var saleThb = Math.max(1, Math.round(thb * (1 - discount / 100)));
      priceEl.innerHTML = buildSalePriceHtml(usd, thb, saleUsd, saleThb);

      var countdown = (typeof MildMateCampaigns !== 'undefined' && slug)
        ? MildMateCampaigns.getCampaignCountdown(slug)
        : null;
      var countdownText = '';
      if (countdown) {
        countdownText = isThai
          ? ('หมดเขตใน ' + countdown.days + ' วัน ' + countdown.hours + ' ชม. ' + countdown.mins + ' นาที')
          : ('Ends in ' + countdown.days + 'd ' + countdown.hours + 'h ' + countdown.mins + 'm');
      }
      meta.innerHTML = (isThai
        ? ('<span class="catalog-sale-badge">ลด ' + discount + '%</span>')
        : ('<span class="catalog-sale-badge">-' + discount + '% SALE</span>')) +
        (countdownText ? '<span class="catalog-sale-countdown">' + countdownText + '</span>' : '');
    } else {
      priceEl.textContent = formatBasePrice(usd, thb);
      meta.innerHTML = '';
    }
  }

  function renderAllCards() {
    cards.forEach(renderCardSale);
  }

  function init() {
    ensureStyles();
    renderAllCards();
    if (typeof MildMateCampaigns !== 'undefined' && typeof MildMateCampaigns.loadStorefrontCampaigns === 'function') {
      MildMateCampaigns.loadStorefrontCampaigns(false).finally(renderAllCards);
    }
  }

  init();
  window.addEventListener('mildmate:campaigns-updated', renderAllCards);
  window.setInterval(renderAllCards, 60000);
})();
