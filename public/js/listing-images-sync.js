(function () {
  if (window.__listingImageSyncInit) return;
  window.__listingImageSyncInit = true;

  function extractSlugFromHref(href) {
    if (!href) return '';
    var m = href.match(/\/product\/([^\/?#]+)\/?/i);
    return m ? String(m[1] || '').toLowerCase() : '';
  }

  function parseImages(imagesRaw) {
    if (!imagesRaw) return [];
    if (Array.isArray(imagesRaw)) return imagesRaw.filter(Boolean);
    if (typeof imagesRaw !== 'string') return [];
    try {
      var parsed = JSON.parse(imagesRaw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (e) {
      try {
        var repaired = JSON.parse(imagesRaw.replace(/\\"/g, '"'));
        if (Array.isArray(repaired)) return repaired.filter(Boolean);
      } catch (_) {}
    }
    return [];
  }

  function getProductImage(p) {
    if (!p || typeof p !== 'object') return '';
    if (p.image_url && typeof p.image_url === 'string') return p.image_url;
    var imgs = parseImages(p.images);
    return imgs[0] || '';
  }

  async function syncListingImages() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.product-card'));
    if (!cards.length) return;

    var cardSlugs = {};
    cards.forEach(function (card, idx) {
      var link = card.querySelector('a[href*="/product/"]');
      var slug = extractSlugFromHref(link ? link.getAttribute('href') : '');
      if (slug) cardSlugs[idx] = slug;
    });

    if (!Object.keys(cardSlugs).length) return;

    var resp = await fetch('/api/products', { credentials: 'same-origin' });
    if (!resp.ok) return;
    var json = await resp.json();
    var list = Array.isArray(json) ? json : (json.products || []);
    if (!Array.isArray(list) || !list.length) return;

    var bySlug = {};
    list.forEach(function (p) {
      if (!p || !p.slug) return;
      var img = getProductImage(p);
      if (img) bySlug[String(p.slug).toLowerCase()] = img;
    });

    cards.forEach(function (card, idx) {
      var slug = cardSlugs[idx];
      if (!slug) return;
      var newSrc = bySlug[slug];
      if (!newSrc) return;
      var imgEl = card.querySelector('.product-image img');
      if (!imgEl) return;
      if (imgEl.getAttribute('src') === newSrc) return;
      imgEl.setAttribute('src', newSrc);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      syncListingImages().catch(function () {});
    });
  } else {
    syncListingImages().catch(function () {});
  }
})();
