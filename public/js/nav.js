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
  var headerTicking = false;
  function onScroll() {
    if (!headerTicking) {
      requestAnimationFrame(function () {
        if (header) header.classList.toggle('scrolled', window.scrollY > 20);
        headerTicking = false;
      });
      headerTicking = true;
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
  // Pages with both EN and TH versions (TH pages served via SSR or static files)
  // IMPORTANT: only add paths here when TH pages actually exist
  const BILINGUAL_PAGES = [
    // Products page
    '/products/', '/products',
    // Blog (SSR — all blog posts have TH now)
    '/blogs/', '/blogs',
    // Static TH pages
    '/sizeguide/', '/sizeguide',
    '/how-to-measure-mattress-size/', '/how-to-measure-mattress-size',
    '/custom-measurement/', '/custom-measurement',
    '/shipping/', '/shipping',
    '/policy/', '/policy',
    '/fabric/', '/fabric',
    '/faq/', '/faq',
    '/about/', '/about',
    '/contact/', '/contact',
    '/reviews/', '/reviews',
    // Homepage — TH homepage now live at /th/
    '/'
  ];
  // Normalize path to handle both trailing-slash and non-trailing-slash variants
  const hasTHVersion = (enPath) => {
    return BILINGUAL_PAGES.includes(enPath) ||
           BILINGUAL_PAGES.includes(enPath + '/') ||
           BILINGUAL_PAGES.includes(enPath.replace(/\/$/, '') || '/') ||
           // Blog posts always have TH versions
           enPath.startsWith('/blogs/');
  };
  const langToggles = document.querySelectorAll('.lang-toggle, .mobile-drawer-lang');
  langToggles.forEach(function (langToggle) {
    langToggle.addEventListener('click', function (e) {
      if (e.target.tagName !== 'SPAN') return;
      const targetLang = e.target.dataset.lang;
      if (!targetLang) return;

      const path = window.location.pathname;
      const isTh = path.startsWith('/th/');
      const enPath = isTh ? path.replace(/^\/th/, '') || '/' : path;

      if (targetLang === 'th' && !isTh) {
        // EN → TH: navigate only if TH version exists
        if (hasTHVersion(enPath)) {
          window.location.href = '/th' + enPath;
        }
        // else: no TH version, stay on EN page (do nothing)
      } else if (targetLang === 'en' && isTh) {
        // TH → EN: always strip /th/ prefix
        window.location.href = enPath;
      }
      // else: Already on target language, do nothing
    });
  });

  /* ── 3b. Thai nav href safeguard ─────────── */
  (function normalizeThaiNavLinks() {
    const path = window.location.pathname;
    const isThPage = path === '/th' || path.startsWith('/th/');
    if (!isThPage) return;

    const thaiRouteMap = {
      '/products': '/th/products/',
      '/products/': '/th/products/',
      '/about': '/th/about/',
      '/about/': '/th/about/',
      '/contact': '/th/contact/',
      '/contact/': '/th/contact/',
      '/faq': '/th/faq/',
      '/faq/': '/th/faq/',
      '/fabric': '/th/fabric/',
      '/fabric/': '/th/fabric/',
      '/sizeguide': '/th/sizeguide/',
      '/sizeguide/': '/th/sizeguide/',
      '/blogs': '/th/blogs/',
      '/blogs/': '/th/blogs/',
      '/policy': '/th/policy/',
      '/policy/': '/th/policy/',
      '/shipping': '/th/shipping/',
      '/shipping/': '/th/shipping/',
      '/reviews': '/th/reviews/',
      '/reviews/': '/th/reviews/',
      '/how-to-measure-mattress-size': '/th/how-to-measure-mattress-size/',
      '/how-to-measure-mattress-size/': '/th/how-to-measure-mattress-size/',
      '/custom-measurement': '/th/custom-measurement/',
      '/custom-measurement/': '/th/custom-measurement/'
    };

    document.querySelectorAll('a[href]').forEach(function (link) {
      const rawHref = link.getAttribute('href');
      if (!rawHref) return;
      if (rawHref.startsWith('#')) return;
      if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) return;

      try {
        const url = new URL(rawHref, window.location.origin);
        if (url.origin !== window.location.origin) return;
        const mappedPath = thaiRouteMap[url.pathname];
        if (!mappedPath) return;
        link.setAttribute('href', mappedPath + (url.search || '') + (url.hash || ''));
      } catch (_) {
        // ignore malformed hrefs
      }
    });
  })();

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

  /* ── 4b. Auth-aware account button ────────── */
  (function setupAccountButton() {
    var accountBtn = document.querySelector('.header-actions .account-btn');
    if (!accountBtn) return;

    // Create "Sign In" text button
    var signInText = document.createElement('button');
    signInText.className = 'sign-in-text';
    signInText.textContent = 'Sign In';
    signInText.setAttribute('aria-label', 'Sign in to your account');
    signInText.style.cssText =
      'font-size:0.875rem;font-weight:600;color:#1e3a8a;' +
      'border:none;background:none;cursor:pointer;white-space:nowrap;padding:0 2px;';

    // Store the default SVG HTML for sign-out fallback
    var defaultSvg = accountBtn.innerHTML;

    // Insert before the existing account icon
    accountBtn.parentNode.insertBefore(signInText, accountBtn);

    function updateAccountButton() {
      var signedIn =
        (window.clerk && window.clerk.user) ||
        (typeof window.isClerkSignedIn === 'function' && window.isClerkSignedIn());
      signInText.style.display = signedIn ? 'none' : '';
      accountBtn.style.display = signedIn ? '' : 'none';

      if (signedIn) {
        // Try to show the real profile photo from Google/Facebook
        var photoUrl =
          window.clerk &&
          window.clerk.user &&
          window.clerk.user.imageUrl;
        if (photoUrl) {
          // Replace SVG with the real profile photo — circular, same 20×20 SVG size
          accountBtn.innerHTML =
            '<img src="' +
            photoUrl +
            '" alt="My account" width="20" height="20"' +
            ' style="width:28px;height:28px;border-radius:50%;' +
            'object-fit:cover;display:block;">';
          // Remove the circular border from the <a> when photo is shown
          accountBtn.style.borderRadius = '50%';
        } else {
          // No photo — use default person SVG
          accountBtn.innerHTML = defaultSvg;
          accountBtn.style.borderRadius = '';
        }
      }
    }

    signInText.addEventListener('click', function () {
      if (typeof window.signInWithClerk === 'function') {
        window.signInWithClerk(window.location.href);
      } else {
        // Fallback — direct URL to Clerk hosted sign-in page
        window.location.href =
          'https://kind-joey-29.accounts.dev/sign-in?redirect_url=' +
          encodeURIComponent(window.location.href);
      }
    });

    updateAccountButton();
    window.addEventListener('clerk:signed-in', updateAccountButton);
    window.addEventListener('clerk:signed-out', updateAccountButton);
    // Also run when Clerk is fully ready (covers page-load-while-signed-in)
    window.addEventListener('clerk:ready', updateAccountButton);
  })();

  /* ── 5. Search overlay toggle ────────────── */
  const searchBtn = document.querySelector('.search-btn');
  const searchOverlay = document.querySelector('.search-overlay');
  const searchClose = document.querySelector('.search-close');

  function openSearch() {
    if (searchOverlay) {
      searchOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      const input = searchOverlay.querySelector('input');
      if (input) {
        requestAnimationFrame(function () {
          try {
            input.focus({ preventScroll: true });
          } catch (_) {
            input.focus();
          }
        });
      }
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
  var cachedCardWidth = 280;

  function recalcCardWidth() {
    if (!cards.length) return;
    var rect = cards[0].getBoundingClientRect();
    cachedCardWidth = Math.max(1, Math.round(rect.width + 16)); // width + gap
  }
  recalcCardWidth();
  var resizeTicking = false;
  window.addEventListener('resize', function () {
    if (resizeTicking) return;
    resizeTicking = true;
    requestAnimationFrame(function () {
      recalcCardWidth();
      resizeTicking = false;
    });
  }, { passive: true });

  function updateActiveDot() {
    if (!scrollRow || !cards.length) return;
    const scrollLeft = scrollRow.scrollLeft;
    const activeIndex = Math.round(scrollLeft / cachedCardWidth);
    dots.forEach(function (dot, i) {
      dot.classList.toggle('active', i === activeIndex);
    });
  }

  var dotTicking = false;
  if (scrollRow) {
    scrollRow.addEventListener('scroll', function () {
      if (!dotTicking) {
        requestAnimationFrame(function () {
          updateActiveDot();
          dotTicking = false;
        });
        dotTicking = true;
      }
    }, { passive: true });
  }

  if (carouselPrev && scrollRow) {
    carouselPrev.addEventListener('click', function () {
      scrollRow.scrollBy({ left: -cachedCardWidth, behavior: 'smooth' });
    });
  }

  if (carouselNext && scrollRow) {
    carouselNext.addEventListener('click', function () {
      scrollRow.scrollBy({ left: cachedCardWidth, behavior: 'smooth' });
    });
  }

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      const index = parseInt(dot.dataset.index, 10);
      if (scrollRow && cards[index]) {
        scrollRow.scrollTo({ left: index * cachedCardWidth, behavior: 'smooth' });
      }
    });
  });
})();
