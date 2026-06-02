/* ============================================
   MildMate Cart — Phase 4
   localStorage-based shopping cart
   ============================================ */

(function () {
  const STORAGE_KEY = 'mildmate-cart';

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"items":[]}');
    } catch (e) {
      return { items: [] };
    }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateCount(cart);
  }

  function updateCount(cart) {
    const count = cart.items.reduce(function (sum, item) { return sum + (item.qty || 1); }, 0);
    if (typeof window.updateCartCount === 'function') {
      window.updateCartCount(count);
    }
  }

  const cartAPI = {
    get: loadCart,

    add: function (item) {
      const cart = loadCart();
      const existing = cart.items.find(function (i) {
        return i.type === item.type && i.fabric === item.fabric &&
          JSON.stringify(i.dimensions) === JSON.stringify(item.dimensions);
      });
      if (existing) {
        existing.qty = (existing.qty || 1) + 1;
      } else {
        cart.items.push(item);
      }
      saveCart(cart);
      return cart;
    },

    remove: function (id) {
      const cart = loadCart();
      cart.items = cart.items.filter(function (i) { return i.id !== id; });
      saveCart(cart);
      return cart;
    },

    updateQty: function (id, qty) {
      const cart = loadCart();
      const item = cart.items.find(function (i) { return i.id === id; });
      if (item) {
        item.qty = Math.max(1, parseInt(qty) || 1);
      }
      saveCart(cart);
      return cart;
    },

    clear: function () {
      saveCart({ items: [] });
    }
  };

  // Server sync (Phase 5 — Clerk multi-provider auth)
  var _syncPromise = null;

  function isLoggedIn() {
    return !!(window.clerk && window.clerk.user);
  }

  async function getAuthHeaders() {
    var token = null;
    if (typeof window.getClerkToken === 'function') {
      token = await window.getClerkToken();
    }
    var headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    try {
      if (window.clerk && window.clerk.user && window.clerk.user.primaryEmailAddress) {
        headers['X-User-Email'] = window.clerk.user.primaryEmailAddress.emailAddress || '';
      }
    } catch (e) {}
    return headers;
  }

  async function checkAuthState() {
    try {
      var headers = await getAuthHeaders();
      var resp = await fetch('/api/auth/me', { headers: headers });
      var data = await resp.json();
      return data.authenticated || false;
    } catch(e) {
      return false;
    }
  }

  async function syncToServer() {
    try {
      var authenticated = await checkAuthState();
      if (!authenticated) return false;

      var cart = loadCart();
      var headers = await getAuthHeaders();
      var resp = await fetch('/api/customers/cart', {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({ items: cart.items })
      });
      return resp.ok;
    } catch(e) {
      return false;
    }
  }

  async function clearServerCart() {
    try {
      var authenticated = await checkAuthState();
      if (!authenticated) return;

      var headers = await getAuthHeaders();
      await fetch('/api/customers/cart', { method: 'DELETE', headers: headers });
    } catch(e) {}
  }

  async function loadFromServer() {
    // Only load from server once per session to avoid loops
    if (_syncPromise) return;
    _syncPromise = (async function() {
      try {
        var authenticated = await checkAuthState();
        if (!authenticated) return;

        var headers = await getAuthHeaders();
        var resp = await fetch('/api/customers/cart', { headers: headers });
        var data = await resp.json();
        if (data.items && data.items.length > 0) {
          var localCart = loadCart();
          if (!localCart.items || localCart.items.length === 0) {
            // No local cart — use server cart
            saveCart({ items: data.items });
          } else {
            // Merge: server items not already in local cart
            var merged = localCart.items.slice();
            data.items.forEach(function(sItem) {
              var found = merged.some(function(lItem) {
                return lItem.type === sItem.type &&
                  lItem.product_slug === sItem.product_slug &&
                  JSON.stringify(lItem.dimensions) === JSON.stringify(sItem.dimensions);
              });
              if (!found) merged.push(sItem);
            });
            saveCart({ items: merged });
          }
        }
      } catch(e) {}
      finally { _syncPromise = null; }
    })();
  }

  // Auto-sync on load if Clerk session exists
  if (window.clerk && window.clerk.user) {
    loadFromServer();
  } else {
    // Wait for Clerk to initialize, then check
    window.addEventListener('clerk:ready', function() {
      if (isLoggedIn()) {
        loadFromServer();
      }
    });
  }

  window.addEventListener('clerk:signed-in', function() {
    _syncPromise = null;
    loadFromServer();
  });

  window.addEventListener('clerk:signed-out', function() {
    _syncPromise = null;
  });

  // Expose sync methods
  cartAPI.syncToServer = syncToServer;
  cartAPI.loadFromServer = loadFromServer;
  cartAPI.clearServerCart = clearServerCart;
  cartAPI.isLoggedIn = isLoggedIn;

  // Hook: sync cart to server whenever items change (if logged in)
  var originalSave = saveCart;
  saveCart = function(cart) {
    originalSave(cart);
    if (isLoggedIn()) {
      syncToServer().catch(function(){});
    }
  };

  window.MildMateCart = cartAPI;

  const initCart = loadCart();
  updateCount(initCart);

  // Multi-tab sync: listen for cart changes from other tabs
  window.addEventListener('storage', function(e) {
    if (e.key === 'mildmate-cart') {
      var cart = loadCart();
      updateCount(cart);
    }
  });
})();
