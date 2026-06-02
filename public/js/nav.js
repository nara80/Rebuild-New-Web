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
        header.classList.toggle('scrolled', window.scrollY > 20);
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
  // Pages known to have both EN and TH versions (expand as TH pages are built)
  const BILINGUAL_PAGES = ['/', '/about/', '/contact/', '/faq/', '/fabric/', '/sizeguide/', '/reviews/', '/how-to-measure-mattress-size/', '/custom-measurement/', '/products/', '/fitted-sheets/', '/flat-sheets/', '/duvet-covers/', '/pillowcases/', '/mattress-protectors/', '/pets/', '/marine/', '/family/', '/duvet/', '/boarding-dorm/', '/rv-truck/', '/shipping/', '/policy/'];
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
      'font-size:0.875rem;font-weight:600;color:var(--color-primary);' +
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
