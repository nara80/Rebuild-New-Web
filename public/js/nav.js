/* ============================================
   MildMate Navigation — Phase 3 (Simplified)
   Sticky header, mobile drawer
   ============================================ */

(function () {
  const header = document.querySelector('.site-header');
  const hamburger = document.querySelector('.hamburger');
  const mobileDrawer = document.querySelector('.mobile-drawer');
  const mobileOverlay = document.querySelector('.mobile-overlay');

  /* ── 1. Sticky header shrink on scroll ───── */
  function onScroll() {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── 2. Mobile hamburger toggle ──────────── */
  function openDrawer() {
    hamburger.classList.add('active');
    mobileDrawer.classList.add('active');
    mobileOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    hamburger.classList.remove('active');
    mobileDrawer.classList.remove('active');
    mobileOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      if (mobileDrawer.classList.contains('active')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
  }

  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeDrawer);
  }

  /* ── 3. Language toggle (Phase 4 hook) ───── */
  const langToggle = document.querySelector('.lang-toggle');
  if (langToggle) {
    langToggle.addEventListener('click', function (e) {
      if (e.target.tagName === 'SPAN') {
        const lang = e.target.dataset.lang;
        if (lang) {
          document.querySelectorAll('.lang-toggle span').forEach(function (s) {
            s.classList.toggle('active', s.dataset.lang === lang);
          });
          console.log('Language switched to:', lang);
        }
      }
    });
  }

  /* ── 4. Cart count (Phase 4 hook) ────────── */
  window.updateCartCount = function (count) {
    const badge = document.querySelector('.cart-count');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  };

  try {
    const cart = JSON.parse(localStorage.getItem('mildmate-cart') || '{"items":[]}');
    updateCartCount(cart.items ? cart.items.length : 0);
  } catch (e) {
    updateCartCount(0);
  }

  /* ── 5. Search overlay toggle ────────────── */
  const searchBtn = document.querySelector('.search-btn');
  const searchOverlay = document.querySelector('.search-overlay');
  const searchClose = document.querySelector('.search-close');

  function openSearch() {
    if (searchOverlay) {
      searchOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      const input = searchOverlay.querySelector('input');
      if (input) input.focus();
    }
  }

  function closeSearch() {
    if (searchOverlay) {
      searchOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', openSearch);
  }

  if (searchClose) {
    searchClose.addEventListener('click', closeSearch);
  }

  if (searchOverlay) {
    searchOverlay.addEventListener('click', function (e) {
      if (e.target === searchOverlay) closeSearch();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSearch();
  });
})();
