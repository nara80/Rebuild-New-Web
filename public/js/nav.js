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

  /* ── 3. Language toggle — actual navigation ── */
  // Pages known to have both EN and TH versions (expand as TH pages are built)
  const BILINGUAL_PAGES = ['/', '/about/', '/contact/', '/faq/', '/fabric/', '/sizeguide/', '/reviews/', '/how-to-measure-mattress-size/', '/custom-measurement/', '/products/', '/fitted-sheets/', '/flat-sheets/', '/duvet-covers/', '/pillowcases/', '/mattress-protectors/', '/pets/', '/marine/', '/family/', '/duvet/', '/protection/', '/rv-truck/'];
  const langToggle = document.querySelector('.lang-toggle');
  if (langToggle) {
    langToggle.addEventListener('click', function (e) {
      if (e.target.tagName !== 'SPAN') return;
      const targetLang = e.target.dataset.lang;
      if (!targetLang) return;

      const path = window.location.pathname;
      const isTh = path.startsWith('/th/');
      const enPath = isTh ? path.replace(/^\/th/, '') || '/' : path;
      let newPath;

      if (targetLang === 'th' && !isTh) {
        // EN → TH: if page has TH version, go there; else go to TH homepage
        newPath = BILINGUAL_PAGES.includes(enPath) ? '/th' + enPath : '/th/';
      } else if (targetLang === 'en' && isTh) {
        // TH → EN: strip /th/ prefix
        newPath = enPath;
      } else {
        return; // Already on target language
      }

      window.location.href = newPath;
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

  /* ── 5b. Close drawer on search submit ───── */
  const drawerSearchForm = document.querySelector('.drawer-search-form');
  if (drawerSearchForm) {
    drawerSearchForm.addEventListener('submit', function () {
      closeDrawer();
    });
  }

  /* ── 6. Product carousel arrows + dots ──── */
  const carouselPrev = document.querySelector('.carousel-prev');
  const carouselNext = document.querySelector('.carousel-next');
  const scrollRow = document.querySelector('.product-grid.scroll-row');
  const dots = document.querySelectorAll('.carousel-dot');
  const cards = scrollRow ? scrollRow.querySelectorAll('.product-card') : [];

  function updateActiveDot() {
    if (!scrollRow || !cards.length) return;
    const scrollLeft = scrollRow.scrollLeft;
    const cardWidth = cards[0].offsetWidth + 16; // width + gap
    const activeIndex = Math.round(scrollLeft / cardWidth);
    dots.forEach(function (dot, i) {
      dot.classList.toggle('active', i === activeIndex);
    });
  }

  if (scrollRow) {
    scrollRow.addEventListener('scroll', function () {
      window.requestAnimationFrame(updateActiveDot);
    }, { passive: true });
  }

  if (carouselPrev && scrollRow) {
    carouselPrev.addEventListener('click', function () {
      scrollRow.scrollBy({ left: -280, behavior: 'smooth' });
    });
  }

  if (carouselNext && scrollRow) {
    carouselNext.addEventListener('click', function () {
      scrollRow.scrollBy({ left: 280, behavior: 'smooth' });
    });
  }

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      const index = parseInt(dot.dataset.index, 10);
      if (scrollRow && cards[index]) {
        const cardWidth = cards[0].offsetWidth + 16;
        scrollRow.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
      }
    });
  });
})();
