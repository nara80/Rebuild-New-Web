/* ============================================
   MildMate Campaign State — Shared localStorage module
   Sandbox: campaigns, offers, favorites stored client-side
   Production: fetched from D1 + Worker API
   ============================================ */

var MildMateCampaigns = (function(){
  var STORAGE_KEY = 'mildmate_campaigns';
  var OFFERS_KEY = 'mildmate_offers';
  var FAVORITES_KEY = 'mildmate_favorites';

  function load(key, fallback){
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch(e) { return fallback; }
  }

  function save(key, data){
    try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
  }

  // ── Campaigns ──
  function getActiveCampaigns(){
    var all = load(STORAGE_KEY, []);
    var now = Date.now();
    return all.filter(function(c){
      var start = new Date(c.startDate).getTime();
      var end = new Date(c.endDate).getTime();
      return now >= start && now <= end;
    });
  }

  function getAllCampaigns(){
    return load(STORAGE_KEY, []);
  }

  function addCampaign(c){
    var all = load(STORAGE_KEY, []);
    c.id = 'CAMP' + Date.now();
    all.push(c);
    save(STORAGE_KEY, all);
    return c;
  }

  function deleteCampaign(id){
    var all = load(STORAGE_KEY, []);
    var filtered = all.filter(function(c){ return c.id !== id; });
    save(STORAGE_KEY, filtered);
  }

  function getDiscountForProduct(productSlug){
    var campaigns = getActiveCampaigns();
    var best = 0;
    var bestCampaign = null;
    for (var i = 0; i < campaigns.length; i++) {
      var c = campaigns[i];
      var matches = c.productSlugs.indexOf('ALL') !== -1 || c.productSlugs.indexOf(productSlug) !== -1;
      if (matches && c.discount > best) {
        best = c.discount;
        bestCampaign = c;
      }
    }
    return { discount: best, campaign: bestCampaign };
  }

  function getCampaignCountdown(productSlug){
    var res = getDiscountForProduct(productSlug);
    if (!res.campaign) return null;
    var end = new Date(res.campaign.endDate).getTime();
    var now = Date.now();
    var remaining = end - now;
    if (remaining <= 0) return null;
    var days = Math.floor(remaining / 86400000);
    var hours = Math.floor((remaining % 86400000) / 3600000);
    var mins = Math.floor((remaining % 3600000) / 60000);
    return { days: days, hours: hours, mins: mins, campaign: res.campaign, discount: res.discount };
  }

  // ── Offers ──
  function getOffers(){
    return load(OFFERS_KEY, { favorite: 15, cart: 20, thankyou: 20 });
  }

  function saveOffers(offers){
    save(OFFERS_KEY, offers);
  }

  // ── Favorites ──
  function getFavorites(){
    return load(FAVORITES_KEY, []);
  }

  function toggleFavorite(slug, name){
    var favs = load(FAVORITES_KEY, []);
    var idx = -1;
    for (var i = 0; i < favs.length; i++) { if (favs[i].slug === slug) { idx = i; break; } }
    var isFav;
    if (idx >= 0) {
      favs.splice(idx, 1);
      isFav = false;
    } else {
      favs.push({ slug: slug, name: name || slug, addedAt: Date.now() });
      isFav = true;
    }
    save(FAVORITES_KEY, favs);
    return isFav;
  }

  function isFavorite(slug){
    var favs = load(FAVORITES_KEY, []);
    for (var i = 0; i < favs.length; i++) { if (favs[i].slug === slug) return true; }
    return false;
  }

  // ── Public API ──
  return {
    getActiveCampaigns: getActiveCampaigns,
    getAllCampaigns: getAllCampaigns,
    addCampaign: addCampaign,
    deleteCampaign: deleteCampaign,
    getDiscountForProduct: getDiscountForProduct,
    getCampaignCountdown: getCampaignCountdown,
    getOffers: getOffers,
    saveOffers: saveOffers,
    getFavorites: getFavorites,
    toggleFavorite: toggleFavorite,
    isFavorite: isFavorite,
    STORAGE_KEY: STORAGE_KEY,
    OFFERS_KEY: OFFERS_KEY,
    FAVORITES_KEY: FAVORITES_KEY
  };
})();
