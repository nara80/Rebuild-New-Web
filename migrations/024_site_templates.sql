-- Migration: 024_site_templates
-- Centralized header/footer templates for all pages

CREATE TABLE IF NOT EXISTS site_templates (
  template_key TEXT PRIMARY KEY,
  template_html TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed standard header (nav + drawer + search overlay)
INSERT OR REPLACE INTO site_templates (template_key, template_html, description) VALUES
('header-standard', '<header class="site-header">
    <div class="container header-inner">

      <!-- Mobile Hamburger (hidden on desktop) -->
      <button class="hamburger" aria-label="Open menu" aria-expanded="false">
        <span></span>
        <span></span>
        <span></span>
      </button>

      <!-- Logo -->
      <a href="/" class="logo-link" aria-label="MildMate Home">
        <picture><source srcset="/images/logo.webp" type="image/webp"><img src="/images/logo.png" alt="MildMate" width="180" height="50"></picture>
      </a>

      <!-- Desktop Navigation  -  Simplified, no dropdowns -->
      <nav class="main-nav" aria-label="Main navigation">
        <ul class="nav-list">
          <li class="nav-item">
            <a href="/products/" class="nav-link">Shop</a>
          </li>
          <li class="nav-item">
            <a href="/fabric/" class="nav-link">Fabrics</a>
          </li>
          <li class="nav-item">
            <a href="/sizeguide/" class="nav-link">Size Guide</a>
          </li>
          <li class="nav-item">
            <a href="/blogs/" class="nav-link">Blog</a>
          </li>
        </ul>
      </nav>

      <!-- Header Actions -->
      <div class="header-actions">
        <button class="search-btn" aria-label="Search products" aria-expanded="false">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
        <a href="/account/" class="account-btn" aria-label="My account" style="display:flex;align-items:center;gap:4px">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none" class="account-icon"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span class="sign-in-pill">Sign In</span>
        </a>
        <a href="/checkout/" class="cart-btn" aria-label="Shopping cart">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span class="cart-count">0</span>
        </a>
        <div class="lang-toggle" role="group" aria-label="Language switch">
          <span data-lang="en" class="active" style="color:var(--color-primary);border-bottom:2px solid var(--color-primary);padding-bottom:1px">EN</span>
          <span style="color:var(--color-border)">/</span>
          <span data-lang="th" style="color:var(--color-muted)">TH</span>
        </div>
      </div>
    </div>

    <!-- Mobile Drawer  -  Simplified, no submenus -->
    <div class="mobile-overlay" aria-hidden="true"></div>
    <div class="mobile-drawer" aria-label="Mobile menu">
      <div class="mobile-drawer-search">
        <form action="/products/" method="get" class="drawer-search-form">
          <input type="search" name="q" placeholder="Search bedding, fabrics, sizes..." aria-label="Search products" autocomplete="off">
          <button type="submit" aria-label="Submit search">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
        </form>
      </div>
      <ul class="mobile-nav-list">
        <li><a href="/">Home</a></li>
        <li><a href="/products/">Shop</a></li>
        <li><a href="/fabric/">Fabrics</a></li>
        <li><a href="/sizeguide/">Size Guide</a></li>
        <li class="mobile-nav-signin"><a href="/account/" class="sign-in-drawer-link" style="display:inline-block;background:var(--color-primary);color:#fff;font-weight:700;padding:8px 16px;border-radius:6px;margin-top:12px">Sign In</a></li>
      </ul>
      <div class="mobile-drawer-lang" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--color-border);display:flex;align-items:center;gap:8px">
        <span style="font-size:0.8125rem;font-weight:600;color:var(--color-muted)">Language:</span>
        <span data-lang="en" class="active" style="color:var(--color-primary);font-weight:700;font-size:0.9375rem;cursor:pointer">EN</span>
        <span style="color:var(--color-border)">/</span>
        <span data-lang="th" style="color:var(--color-muted);font-weight:600;font-size:0.9375rem;cursor:pointer" onclick="window.location.href=''/th/''">TH</span>
      </div>
    </div>

    <!-- Search Overlay -->
    <div class="search-overlay" aria-hidden="true">
      <div class="search-overlay-inner">
        <button class="search-close" aria-label="Close search">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <form action="/products/" method="get" class="search-form">
          <input type="search" name="q" placeholder="Search bedding, fabrics, sizes..." aria-label="Search" autocomplete="off">
          <button type="submit" aria-label="Submit search">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
        </form>
      </div>
    </div>
  </header>', 'Standard site header with logo, desktop nav, mobile drawer, search overlay');

-- Seed standard footer
INSERT OR REPLACE INTO site_templates (template_key, template_html, description) VALUES
('footer-standard', '<footer class="site-footer">
    <div class="container">
      <div class="footer-grid">

        <!-- Column 1: Quick Links -->
        <div class="footer-col">
          <h3>Quick Links</h3>
          <ul>
            <li><a href="/about/">About Us</a></li>
            <li><a href="/contact/">Contact Us</a></li>
            <li><a href="/reviews/">Reviews</a></li>
          </ul>
        </div>

        <!-- Column 2: Customer Service -->
        <div class="footer-col">
          <h3>Customer Service</h3>
          <ul>
            <li><a href="/faq/">FAQ</a></li>
            <li><a href="/sizeguide/">Size Guide</a></li>
            <li><a href="/blogs/">Blog</a></li>
          </ul>
        </div>

        <!-- Column 3: Shop With Us (icon only) -->
        <div class="footer-col">
          <h3>Shop With Us</h3>
          <div class="footer-icons-grid">
            <a href="https://www.etsy.com/shop/mildmate" target="_blank" rel="noopener noreferrer" aria-label="Etsy" class="footer-icon-circle">
              <img src="/images/Logo/Etsy.png" alt="" width="100" height="100" decoding="async">
            </a>
            <a href="https://www.ebay.com/str/mildmate" target="_blank" rel="noopener noreferrer" aria-label="eBay" class="footer-icon-circle">
              <img src="/images/Logo/eBay.png" alt="" width="100" height="100" decoding="async">
            </a>
            <a href="https://shopee.co.th/neededshop_bt.2n.1y" target="_blank" rel="noopener noreferrer" aria-label="Shopee" class="footer-icon-circle">
              <img src="/images/Logo/Shopee.png" alt="" width="100" height="100" decoding="async">
            </a>
            <a href="https://www.lazada.co.th/shop/needed-shop" target="_blank" rel="noopener noreferrer" aria-label="Lazada" class="footer-icon-circle">
              <img src="/images/Logo/Lazada.png" alt="" width="100" height="100" decoding="async">
            </a>
          </div>
        </div>

        <!-- Column 4: Contact -->
        <div class="footer-col">
          <h3>Contact</h3>
          <ul>
            <li>
              <a href="mailto:contact@mildmate.com">
                <svg class="footer-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                contact@mildmate.com
              </a>
            </li>
            <li>
              <a href="tel:+66872362364">
                <svg class="footer-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                +66 (0)87 236 2364
              </a>
            </li>
          </ul>
          <div class="footer-icons-grid contact-icons">
            <a href="https://wa.me/66811515995" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" class="footer-icon-circle">
              <img src="/images/Logo/WhatsAPP.png" alt="" width="100" height="100" decoding="async">
            </a>
            <a href="https://page.line.me/507abyoy" target="_blank" rel="noopener noreferrer" aria-label="LINE" class="footer-icon-circle">
              <img src="/images/Logo/LineOA.png" alt="" width="100" height="100" decoding="async">
            </a>
          </div>
        </div>
      </div>

      <!-- Social Media Center Row -->
      <div class="footer-social-center">
        <a href="https://www.facebook.com/mildmate.bedsheets" target="_blank" rel="noopener noreferrer" aria-label="Facebook" class="footer-social-icon">
          <img src="/images/Logo/Facebook.png" alt="" width="100" height="100" decoding="async">
        </a>
        <a href="https://www.instagram.com/mild_mate/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" class="footer-social-icon">
          <img src="/images/Logo/Instagram.png" alt="" width="100" height="100" decoding="async">
        </a>
        <a href="https://www.tiktok.com/@bt.mildmate" target="_blank" rel="noopener noreferrer" aria-label="TikTok" class="footer-social-icon">
          <img src="/images/Logo/TikTok.png" alt="" width="100" height="100" decoding="async">
        </a>
        <a href="https://www.pinterest.com/mildmateshop/" target="_blank" rel="noopener noreferrer" aria-label="Pinterest" class="footer-social-icon">
          <img src="/images/Logo/Pinterest.png" alt="" width="100" height="100" decoding="async">
        </a>
        <a href="https://www.youtube.com/channel/UCnxunfprych7pMss4zr6Qcw" target="_blank" rel="noopener noreferrer" aria-label="YouTube" class="footer-social-icon">
          <img src="/images/Logo/YouTube.png" alt="" width="100" height="100" decoding="async">
        </a>
      </div>

      <!-- Footer Bottom Bar -->
      <div class="footer-bottom">
        <p>&copy; MildMate 2026</p>
        <div class="footer-bottom-links">
          <a href="/policy/">Privacy Policy</a>
          <a href="/shipping/">Returns &amp; Delivery</a>
        </div>
      </div>
    </div>
  </footer>', 'Standard 4-column footer with marketplace icons, social links');
