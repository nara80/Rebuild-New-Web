/* ============================================
   MildMate Campaign State — Shared localStorage module
   Sandbox: campaigns, offers, favorites stored client-side
   Production: fetched from D1 + Worker API
   ============================================ */

var MildMateCampaigns = (function(){
  var STORAGE_KEY = 'mildmate_campaigns';
  var OFFERS_KEY = 'mildmate_offers';
  var FAVORITES_KEY = 'mildmate_favorites';
  var storefrontCampaigns = [];
  var storefrontLoaded = false;
  var storefrontLoadPromise = null;
  function isSuperAdminPage(){
    try { return window.location.pathname.indexOf('/super-admin/') === 0; }
    catch(e){ return false; }
  }

  function load(key, fallback){
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch(e) { return fallback; }
  }

  function save(key, data){
    try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
  }

  function getClerkEmail(){
    try {
      if (window.clerk && window.clerk.user && window.clerk.user.primaryEmailAddress) {
        return window.clerk.user.primaryEmailAddress.emailAddress || '';
      }
    } catch(e) {}
    return '';
  }

  async function getAuthHeaders(retries){
    if (typeof window.getClerkToken !== 'function') return null;
    var max = retries || 0;
    for (var attempt = 0; attempt <= max; attempt++) {
      try {
        var token = await window.getClerkToken();
        if (token) {
          var headers = { Authorization: 'Bearer ' + token };
          var email = getClerkEmail();
          if (email) headers['X-User-Email'] = email;
          return headers;
        }
      } catch(e) { /* SDK may not be ready yet */ }
      if (attempt < max) await new Promise(function(r) { setTimeout(r, 200); });
    }
    return null;
  }

  function normalizeCampaign(raw){
    if (!raw || typeof raw !== 'object') return null;
    var discount = Number(raw.discount || raw.discount_pct || 0);
    var startDate = String(raw.startDate || raw.start_date || '');
    var endDate = String(raw.endDate || raw.end_date || '');
    var productSlugs = Array.isArray(raw.productSlugs) ? raw.productSlugs : [];
    if (!startDate || !endDate || !productSlugs.length || discount <= 0) return null;
    return {
      id: String(raw.id || ''),
      name: String(raw.name || ''),
      discount: Math.max(0, Math.min(90, discount)),
      productSlugs: productSlugs.map(function(s){ return String(s || '').trim(); }).filter(Boolean),
      startDate: startDate,
      endDate: endDate,
      isActive: true
    };
  }

  function isCampaignActive(c){
    var now = Date.now();
    var start = new Date(c.startDate).getTime();
    var end = new Date(c.endDate).getTime();
    return isFinite(start) && isFinite(end) && now >= start && now <= end;
  }

  function emitCampaignsUpdated(){
    try {
      window.dispatchEvent(new CustomEvent('mildmate:campaigns-updated', {
        detail: { campaigns: getActiveCampaigns() }
      }));
    } catch(e) {}
  }

  async function loadStorefrontCampaigns(forceRefresh){
    if (isSuperAdminPage()) return [];
    if (!forceRefresh && storefrontLoaded) return storefrontCampaigns;
    if (!forceRefresh && storefrontLoadPromise) return storefrontLoadPromise;
    storefrontLoadPromise = fetch('/api/campaigns', { method: 'GET', credentials: 'same-origin' })
      .then(function(resp){
        if (!resp.ok) return { campaigns: [] };
        return resp.json().catch(function(){ return { campaigns: [] }; });
      })
      .then(function(payload){
        var list = Array.isArray(payload && payload.campaigns) ? payload.campaigns : [];
        storefrontCampaigns = list.map(normalizeCampaign).filter(Boolean);
        storefrontLoaded = true;
        emitCampaignsUpdated();
        return storefrontCampaigns;
      })
      .catch(function(){
        storefrontCampaigns = [];
        storefrontLoaded = true;
        emitCampaignsUpdated();
        return storefrontCampaigns;
      })
      .finally(function(){
        storefrontLoadPromise = null;
      });
    return storefrontLoadPromise;
  }

  // ── Campaigns ──
  function getActiveCampaigns(){
    // Storefront must never trust localStorage campaigns
    if (!isSuperAdminPage()) {
      return storefrontCampaigns.filter(isCampaignActive);
    }
    var all = load(STORAGE_KEY, []);
    return all.filter(isCampaignActive);
  }

  function getAllCampaigns(){
    if (!isSuperAdminPage()) return storefrontCampaigns.slice();
    return load(STORAGE_KEY, []);
  }

  function addCampaign(c){
    if (!isSuperAdminPage()) return c;
    var all = load(STORAGE_KEY, []);
    c.id = 'CAMP' + Date.now();
    all.push(c);
    save(STORAGE_KEY, all);
    return c;
  }

  function deleteCampaign(id){
    if (!isSuperAdminPage()) return;
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

  async function syncFavoritesFromServer(){
    var headers = await getAuthHeaders();
    if (!headers || !headers.Authorization) return load(FAVORITES_KEY, []);
    try {
      var resp = await fetch('/api/favorites', { headers: headers });
      if (!resp.ok) return load(FAVORITES_KEY, []);
      var data = await resp.json();
      var favs = (data.favorites || []).map(function(f){
        return {
          slug: f.slug,
          name: f.title_en || f.slug,
          image: f.image_url || '',
          priceUsd: f.price_usd || null,
          priceThb: f.price_thb || null,
          addedAt: f.created_at ? new Date(f.created_at).getTime() : Date.now()
        };
      });
      save(FAVORITES_KEY, favs);
      return favs;
    } catch(e) {
      return load(FAVORITES_KEY, []);
    }
  }

  async function getFavoritesServer(){
    return syncFavoritesFromServer();
  }

  async function toggleFavoriteServer(slug, name){
    var headers = await getAuthHeaders(25); // poll up to 5s for Clerk SDK
    if (!headers || !headers.Authorization) {
      return { ok: false, requiresAuth: true, isFavorite: isFavorite(slug) };
    }

    // Product pages optimistically toggle local state before calling server sync.
    // Therefore local state here represents the desired final server state.
    var shouldBeFavorite = isFavorite(slug);
    try {
      var resp;
      if (shouldBeFavorite) {
        resp = await fetch('/api/favorites', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
          body: JSON.stringify({ productSlug: slug, productName: name || slug })
        });
      } else {
        resp = await fetch('/api/favorites?productSlug=' + encodeURIComponent(slug), {
          method: 'DELETE',
          headers: headers
        });
      }

      if (resp.status === 401 || resp.status === 403) {
        return { ok: false, requiresAuth: true, isFavorite: shouldBeFavorite };
      }
      if (!resp.ok) {
        return { ok: false, requiresAuth: false, isFavorite: shouldBeFavorite };
      }

      var data = await resp.json().catch(function(){ return {}; });
      var nextFavorite = shouldBeFavorite;
      if (typeof data.isFavorite === 'boolean') nextFavorite = data.isFavorite;

      var favs = load(FAVORITES_KEY, []);
      var idx = -1;
      for (var i = 0; i < favs.length; i++) {
        if (favs[i].slug === slug) { idx = i; break; }
      }

      if (nextFavorite) {
        var product = data.product || {};
        var item = {
          slug: slug,
          name: name || product.title_en || slug,
          image: product.image_url || '',
          priceUsd: product.price_usd || null,
          priceThb: product.price_thb || null,
          addedAt: Date.now()
        };
        if (idx >= 0) favs[idx] = Object.assign({}, favs[idx], item);
        else favs.unshift(item);
      } else if (idx >= 0) {
        favs.splice(idx, 1);
      }

      save(FAVORITES_KEY, favs);
      return { ok: true, requiresAuth: false, isFavorite: nextFavorite };
    } catch(e) {
      return { ok: false, requiresAuth: false, isFavorite: shouldBeFavorite };
    }
  }

  // ── Public API ──
  if (!isSuperAdminPage()) {
    setTimeout(function(){ loadStorefrontCampaigns(false); }, 0);
  }

  return {
    getActiveCampaigns: getActiveCampaigns,
    getAllCampaigns: getAllCampaigns,
    addCampaign: addCampaign,
    deleteCampaign: deleteCampaign,
    getDiscountForProduct: getDiscountForProduct,
    getCampaignCountdown: getCampaignCountdown,
    loadStorefrontCampaigns: loadStorefrontCampaigns,
    getOffers: getOffers,
    saveOffers: saveOffers,
    getFavorites: getFavorites,
    toggleFavorite: toggleFavorite,
    isFavorite: isFavorite,
    syncFavoritesFromServer: syncFavoritesFromServer,
    getFavoritesServer: getFavoritesServer,
    toggleFavoriteServer: toggleFavoriteServer,
    STORAGE_KEY: STORAGE_KEY,
    OFFERS_KEY: OFFERS_KEY,
    FAVORITES_KEY: FAVORITES_KEY
  };
})();
