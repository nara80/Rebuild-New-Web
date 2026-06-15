/* ============================================
   MildMate Auth — Clerk Multi-Provider (Google / Facebook / Email)
   Hosted-page redirect flow + embedded UserButton
   Security: Turnstile CAPTCHA (Clerk-side), JWT verification (Worker-side)
   ============================================ */

(function () {
  if (window.__SKIP_CLERK) return;
  var PUBLISHABLE_KEY = 'pk_test_a2luZC1qb2V5LTI5LmNsZXJrLmFjY291bnRzLmRldiQ';
  var clerkDomain;
  var hostedAccountsDomain;
  try {
    clerkDomain = atob(PUBLISHABLE_KEY.split('_')[2]).slice(0, -1);
    hostedAccountsDomain = clerkDomain.replace(
      '.clerk.accounts.dev',
      '.accounts.dev'
    );
  } catch (e) {
    console.error('Clerk: invalid publishable key');
    return;
  }

  var clerkInstance = null;
  var _readyPromise = null;
  var _initScheduled = false;

  function addConnectionHints() {
    var origins = [
      'https://cdn.jsdelivr.net',
      'https://' + clerkDomain,
      'https://' + hostedAccountsDomain,
    ];
    origins.forEach(function (origin) {
      var dnsHref = origin.replace(/^https?:/, '');
      if (!document.querySelector('link[rel="dns-prefetch"][href="' + dnsHref + '"]')) {
        var dns = document.createElement('link');
        dns.rel = 'dns-prefetch';
        dns.href = dnsHref;
        document.head.appendChild(dns);
      }
      if (!document.querySelector('link[rel="preconnect"][href="' + origin + '"]')) {
        var pre = document.createElement('link');
        pre.rel = 'preconnect';
        pre.href = origin;
        pre.crossOrigin = 'anonymous';
        document.head.appendChild(pre);
      }
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = function () {
        reject(new Error('Failed to load: ' + src));
      };
      document.head.appendChild(s);
    });
  }

  async function initClerk() {
    if (_readyPromise) return _readyPromise;

    _readyPromise = (async function () {
      var clerkModule = await import(
        'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@6.16.1/dist/clerk.mjs'
      );
      var ClerkCtor = clerkModule && clerkModule.Clerk;
      if (!ClerkCtor) {
        throw new Error('Clerk SDK failed to expose Clerk class');
      }

      await loadScript(
        'https://' + clerkDomain + '/npm/@clerk/ui@1.16.1/dist/ui.browser.js'
      );
      if (!window.__internal_ClerkUICtor) {
        throw new Error('Clerk UI bundle failed to load');
      }

      var clerk = new ClerkCtor(PUBLISHABLE_KEY);
      await clerk.load({
        ui: { ClerkUI: window.__internal_ClerkUICtor },
      });

      clerkInstance = clerk;
      window.clerk = clerk;

      mountUserButton();

      clerk.addListener(function (payload) {
        if (payload.user) {
          window.dispatchEvent(
            new CustomEvent('clerk:signed-in', {
              detail: { user: payload.user },
            })
          );
        } else {
          window.dispatchEvent(new CustomEvent('clerk:signed-out'));
        }
      });

      window.dispatchEvent(
        new CustomEvent('clerk:ready', { detail: { clerk: clerk } })
      );
    })();

    return _readyPromise;
  }

  function mountUserButton() {
    var el = document.getElementById('clerk-user-button');
    if (!el || !clerkInstance) return;
    if (clerkInstance.user) {
      try { clerkInstance.mountUserButton(el); } catch (e) {}
    }
    window.addEventListener('clerk:signed-in', function () {
      try {
        if (clerkInstance && clerkInstance.user) {
          clerkInstance.mountUserButton(el);
        }
      } catch (e) {}
    });
  }

  // ── Public API ──

  /**
   * Redirect to Clerk hosted sign-in page.
   * Uses Clerk SDK for dev-mode cross-domain session (__clerk_db_jwt).
   * Direct URL redirect won't work — Clerk SDK must initiate the flow.
   */
  window.signInWithClerk = function (returnTo) {
    var btn = document.querySelector('.btn-google');
    var initialText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
    var redirectUrl = returnTo || window.location.href;
    var fallbackUrl =
      'https://' +
      hostedAccountsDomain +
      '/sign-in?redirect_url=' +
      encodeURIComponent(redirectUrl);

    function resetButton() {
      if (!btn) return;
      btn.disabled = false;
      btn.textContent = initialText || 'Sign in with Google';
    }

    function doRedirect() {
      if (clerkInstance) {
        clerkInstance.redirectToSignIn({ redirectUrl: redirectUrl, signUpForceRedirectUrl: redirectUrl });
      } else {
        resetButton();
        window.location.href = fallbackUrl;
      }
    }

    if (clerkInstance) { doRedirect(); return; }
    var starter = _readyPromise || initClerk();
    starter.then(doRedirect).catch(function (e) {
      console.error('Clerk sign-in redirect failed:', e && e.message);
      resetButton();
      window.location.href = fallbackUrl;
    });
  };

  /**
   * Redirect to Clerk hosted sign-up page.
   * Uses Clerk SDK for dev-mode cross-domain session (__clerk_db_jwt).
   */
  window.signUpWithClerk = function (returnTo) {
    var btn = document.querySelector('.btn-google');
    var initialText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
    var redirectUrl = returnTo || window.location.href;
    var fallbackUrl =
      'https://' +
      hostedAccountsDomain +
      '/sign-up?redirect_url=' +
      encodeURIComponent(redirectUrl);

    function resetButton() {
      if (!btn) return;
      btn.disabled = false;
      btn.textContent = initialText || 'Sign up';
    }

    function doRedirect() {
      if (clerkInstance) {
        clerkInstance.redirectToSignUp({ redirectUrl: redirectUrl, signInForceRedirectUrl: redirectUrl });
      } else {
        resetButton();
        window.location.href = fallbackUrl;
      }
    }

    if (clerkInstance) { doRedirect(); return; }
    var starter = _readyPromise || initClerk();
    starter.then(doRedirect).catch(function (e) {
      console.error('Clerk sign-up redirect failed:', e && e.message);
      resetButton();
      window.location.href = fallbackUrl;
    });
  };

  /** Sign out — keep server cart for same-account restore, clear local cart, end session */
  window.signOutClerk = async function (returnTo) {
    try { localStorage.removeItem('mildmate-cart'); } catch (e) {}
    if (clerkInstance) {
      await clerkInstance.signOut();
    }
    window.location.href = returnTo || '/';
  };

  /** Get a short-lived Clerk session JWT for API calls */
  window.getClerkToken = async function () {
    try {
      if (!clerkInstance) {
        if (_readyPromise) {
          await _readyPromise;
        } else if (isAuthCriticalPath()) {
          await initClerk();
        }
      }
      if (!clerkInstance || !clerkInstance.session) return null;
      return await clerkInstance.session.getToken();
    } catch (e) {
      return null;
    }
  };

  /** Check if user is signed in (sync) */
  window.isClerkSignedIn = function () {
    return !!(clerkInstance && clerkInstance.user);
  };

  /** Get current user profile */
  window.getClerkUser = function () {
    if (!clerkInstance || !clerkInstance.user) return null;
    var u = clerkInstance.user;
    return {
      id: u.id,
      email:
        u.primaryEmailAddress && u.primaryEmailAddress.emailAddress
          ? u.primaryEmailAddress.emailAddress
          : '',
      name: u.fullName || '',
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      imageUrl: u.imageUrl || '',
    };
  };

  function isAuthCriticalPath() {
    var path = (window.location && window.location.pathname ? window.location.pathname : '/').toLowerCase();
    return (
      path.indexOf('/account') === 0 ||
      path.indexOf('/admin') === 0 ||
      path.indexOf('/super-admin') === 0 ||
      path.indexOf('/quote') === 0
    );
  }

  function scheduleClerkInit() {
    if (_initScheduled) return;
    _initScheduled = true;
    var startInit = function () {
      initClerk().catch(function (err) {
        console.error('Clerk init failed:', err && err.message);
      });
    };
    if (isAuthCriticalPath()) {
      startInit();
      return;
    }
    var started = false;
    var startOnce = function () {
      if (started) return;
      started = true;
      window.removeEventListener('pointerdown', startOnce, true);
      window.removeEventListener('keydown', startOnce, true);
      window.removeEventListener('touchstart', startOnce, true);
      document.removeEventListener('focusin', startOnAuthIntent, true);
      document.removeEventListener('click', startOnAuthIntent, true);
      startInit();
    };
    var startOnAuthIntent = function (ev) {
      var t = ev && ev.target;
      if (!t || !t.closest) return;
      if (
        t.closest('.account-btn') ||
        t.closest('.sign-in-pill') ||
        t.closest('.sign-in-drawer-link') ||
        t.closest('.btn-google') ||
        t.closest('[data-clerk-signin]') ||
        t.closest('#clerk-user-button')
      ) {
        startOnce();
      }
    };
    window.addEventListener('pointerdown', startOnce, { once: true, capture: true, passive: true });
    window.addEventListener('keydown', startOnce, { once: true, capture: true });
    window.addEventListener('touchstart', startOnce, { once: true, capture: true, passive: true });
    document.addEventListener('focusin', startOnAuthIntent, true);
    document.addEventListener('click', startOnAuthIntent, true);
  }

  addConnectionHints();
  scheduleClerkInit();
})();
