/* ============================================
   MildMate Cookie Consent — Phase 4
   GDPR/CCPA-compliant banner + settings modal
   ============================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'mildmate-cookie-consent';

  // Default consent state (nothing accepted until user chooses)
  const defaultConsent = {
    essential: true,
    analytics: false,
    timestamp: 0,
  };

  let consent = { ...defaultConsent };

  // Load saved consent from localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        consent = { ...defaultConsent, ...parsed };
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }

  // Only show banner if no valid consent exists
  const hasConsent = consent.timestamp > 0;

  // Banner HTML
  const bannerHTML = `
    <div id="cookie-banner" class="cookie-banner" role="dialog" aria-label="Cookie consent" aria-modal="false" style="display:none;">
      <div class="cookie-banner-inner">
        <p class="cookie-banner-text">We use cookies (and other similar technologies) to collect data to improve your shopping experience.</p>
        <div class="cookie-banner-actions">
          <button type="button" class="cookie-btn cookie-btn-settings" id="cookie-btn-settings">Settings</button>
          <button type="button" class="cookie-btn cookie-btn-reject" id="cookie-btn-reject">Reject all</button>
          <button type="button" class="cookie-btn cookie-btn-accept" id="cookie-btn-accept">Accept All Cookies</button>
        </div>
      </div>
    </div>
  `;

  // Settings modal HTML
  const modalHTML = `
    <div id="cookie-modal" class="cookie-modal" role="dialog" aria-label="Cookie preferences" aria-modal="true" style="display:none;">
      <div class="cookie-modal-backdrop" id="cookie-modal-backdrop"></div>
      <div class="cookie-modal-panel">
        <h2 class="cookie-modal-title">Cookie Preferences</h2>
        <p class="cookie-modal-desc">Manage your cookie preferences below. Essential cookies are always enabled as they are necessary for the website to function.</p>

        <div class="cookie-category">
          <div class="cookie-category-header">
            <div>
              <h3>Essential</h3>
              <p class="cookie-category-desc">Required for the website to function. Cannot be disabled.</p>
            </div>
            <label class="cookie-toggle">
              <input type="checkbox" checked disabled>
              <span class="cookie-toggle-slider cookie-toggle-locked"></span>
            </label>
          </div>
        </div>

        <div class="cookie-category">
          <div class="cookie-category-header">
            <div>
              <h3>Analytics</h3>
              <p class="cookie-category-desc">Help us understand how visitors interact with our website (Google Analytics 4).</p>
            </div>
            <label class="cookie-toggle">
              <input type="checkbox" id="cookie-toggle-analytics">
              <span class="cookie-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="cookie-modal-actions">
          <button type="button" class="cookie-btn cookie-btn-settings" id="cookie-modal-save">Save Preferences</button>
          <button type="button" class="cookie-btn cookie-btn-accept" id="cookie-modal-accept-all">Accept All</button>
        </div>
      </div>
    </div>
  `;

  // Inject banner and modal into body
  function injectUI() {
    const div = document.createElement('div');
    div.innerHTML = bannerHTML + modalHTML;
    document.body.appendChild(div);
  }

  // Show banner
  function showBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.style.display = 'block';
      setTimeout(() => banner.classList.add('active'), 10);
    }
  }

  // Hide banner
  function hideBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.classList.remove('active');
      setTimeout(() => { banner.style.display = 'none'; }, 300);
    }
  }

  // Show modal
  function showModal() {
    const modal = document.getElementById('cookie-modal');
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('active'), 10);
      document.body.style.overflow = 'hidden';

      // Set toggles to current consent state
      const analyticsToggle = document.getElementById('cookie-toggle-analytics');
      if (analyticsToggle) analyticsToggle.checked = consent.analytics;
    }
  }

  // Hide modal
  function hideModal() {
    const modal = document.getElementById('cookie-modal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }, 300);
    }
  }

  // Save consent to localStorage
  function saveConsent(newConsent) {
    consent = { ...newConsent, timestamp: Date.now() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch (e) {
      // localStorage might be disabled
    }
    applyConsent();
    hideBanner();
    hideModal();
  }

  // Apply consent (load/unload scripts)
  function applyConsent() {
    // Analytics: Google Analytics 4
    if (consent.analytics) {
      if (!window.gtag) {
        loadScript('https://www.googletagmanager.com/gtag/js?id=G-0GWVSPJLVJ', true);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', 'G-0GWVSPJLVJ');
      }
    }

    // Advertising: Facebook Pixel — disabled until needed
    // if (consent.advertising) { ... }

    // If consent withdrawn, we can't unload scripts that are already injected,
    // but we can prevent future events by checking consent before tracking calls.
  }

  // Helper: inject script tag
  function loadScript(src, async) {
    const s = document.createElement('script');
    s.src = src;
    if (async) s.async = true;
    document.head.appendChild(s);
  }

  // Initialize
  function init() {
    injectUI();

    // Bind banner buttons
    const btnSettings = document.getElementById('cookie-btn-settings');
    const btnReject = document.getElementById('cookie-btn-reject');
    const btnAccept = document.getElementById('cookie-btn-accept');

    if (btnSettings) {
      btnSettings.addEventListener('click', showModal);
    }
    if (btnReject) {
      btnReject.addEventListener('click', () => {
        saveConsent({ essential: true, analytics: false });
      });
    }
    if (btnAccept) {
      btnAccept.addEventListener('click', () => {
        saveConsent({ essential: true, analytics: true });
      });
    }

    // Bind modal buttons
    const modalBackdrop = document.getElementById('cookie-modal-backdrop');
    const modalSave = document.getElementById('cookie-modal-save');
    const modalAcceptAll = document.getElementById('cookie-modal-accept-all');

    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', hideModal);
    }
    if (modalSave) {
      modalSave.addEventListener('click', () => {
        const analytics = document.getElementById('cookie-toggle-analytics');
        saveConsent({
          essential: true,
          analytics: analytics ? analytics.checked : false,
        });
      });
    }
    if (modalAcceptAll) {
      modalAcceptAll.addEventListener('click', () => {
        saveConsent({ essential: true, analytics: true });
      });
    }

    // Close modal on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const modal = document.getElementById('cookie-modal');
        if (modal && modal.classList.contains('active')) {
          hideModal();
        }
      }
    });

    // If no consent yet, show banner after a short delay
    if (!hasConsent) {
      setTimeout(showBanner, 1500);
    } else {
      // Apply existing consent (load scripts)
      applyConsent();
    }
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
