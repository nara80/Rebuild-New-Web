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

  window.MildMateCart = cartAPI;

  const initCart = loadCart();
  updateCount(initCart);
})();
