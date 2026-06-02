/**
 * MildMate — Review Carousel + Related Products Carousel
 * Transforms flat review grids into dynamic carousels with 3 pillar reviews.
 * Desktop: 3 cards visible / Mobile: 1 card, touch swipe with pagination.
 * Also converts "You might also like" grid into a carousel with pagination.
 */
(function () {
  'use strict';

  /* ================================================================
     CSS Injection
     ================================================================ */
  var style = document.createElement('style');
  style.textContent = [
    '/* Review Carousel */',
    '.rc-wrapper { position: relative; margin-bottom: 32px; padding: 0 44px; }',
    '.rc-track { display: flex; gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; scrollbar-width: none; -ms-overflow-style: none; padding: 4px 0; }',
    '.rc-track::-webkit-scrollbar { display: none; }',
    '.rc-card, .rc-track .review-card { flex: 0 0 calc(33.333% - 14px); min-width: 280px; scroll-snap-align: start; background: #fff; border-radius: var(--radius, 8px); padding: 24px; box-shadow: var(--shadow, 0 2px 12px rgba(0,0,0,0.08)); position: relative; display: flex; flex-direction: column; }',
    '.rc-track .review-card { margin-bottom: 0; }',
    '.rc-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.88); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.12); z-index: 3; transition: background 0.15s; }',
    '.rc-arrow:hover { background: #fff; }',
    '.rc-arrow:disabled { opacity: 0.3; cursor: default; }',
    '.rc-arrow:disabled:hover { background: rgba(255,255,255,0.88); }',
    '.rc-arrow svg { width: 18px !important; height: 18px !important; stroke: #1E293B !important; stroke-width: 2.5 !important; display: block !important; }',
    '.rc-prev { left: 8px; }',
    '.rc-next { right: 8px; }',
    '.rc-dots { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 20px; }',
    '.rc-dot { width: 8px; height: 8px; border-radius: 50%; border: none; background: #e5e7eb; cursor: pointer; padding: 0; transition: all 0.2s; }',
    '.rc-dot.active { background: #2c96f4; width: 24px; border-radius: 4px; }',
    '/* Related Carousel */',
    '.rel-carousel { position: relative; padding: 0 44px; }',
    '.rel-track { display: flex; gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; scrollbar-width: none; -ms-overflow-style: none; padding: 4px 0; }',
    '.rel-track::-webkit-scrollbar { display: none; }',
    '.rel-card { flex: 0 0 calc(25% - 15px); min-width: 220px; scroll-snap-align: start; background: #fff; border-radius: var(--radius, 8px); overflow: hidden; box-shadow: var(--shadow, 0 2px 12px rgba(0,0,0,0.08)); transition: transform 0.2s, box-shadow 0.2s; text-decoration: none; display: block; }',
    '.rel-card:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }',
    '.rel-card .rel-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }',
    '.rel-card .rel-body { padding: 16px; }',
    '.rel-card .rel-title { font-size: 0.875rem; font-weight: 700; color: #333; margin-bottom: 6px; line-height: 1.3; }',
    '.rel-card .rel-price { font-size: 0.9375rem; font-weight: 700; color: #2c96f4; }',
    '.rel-card .rel-note { font-size: 0.75rem; color: #999; }',
    '.rel-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.88); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.12); z-index: 3; transition: background 0.15s; }',
    '.rel-arrow:hover { background: #fff; }',
    '.rel-arrow:disabled { opacity: 0.3; cursor: default; }',
    '.rel-arrow:disabled:hover { background: rgba(255,255,255,0.88); }',
    '.rel-arrow svg { width: 18px !important; height: 18px !important; stroke: #1E293B !important; stroke-width: 2.5 !important; display: block !important; }',
    '.rel-prev { left: 8px; }',
    '.rel-next { right: 8px; }',
    '.rel-dots { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 20px; }',
    '.rel-dot { width: 8px; height: 8px; border-radius: 50%; border: none; background: #e5e7eb; cursor: pointer; padding: 0; transition: all 0.2s; }',
    '.rel-dot.active { background: #2c96f4; width: 24px; border-radius: 4px; }',
    '/* Responsive */',
    '@media (max-width: 900px) {',
    '  .rc-card, .rc-track .review-card { flex: 0 0 calc(50% - 10px); min-width: 0; max-width: calc(50% - 10px); }',
    '  .rel-card { flex: 0 0 calc(33.333% - 14px); }',
    '  .rc-prev { left: 0; } .rc-next { right: 0; }',
    '  .rel-prev { left: 0; } .rel-next { right: 0; }',
    '}',
    '@media (max-width: 640px) {',
    '  .rc-wrapper { padding: 0 36px; }',
    '  .rel-carousel { padding: 0 36px; }',
    '  .rc-card, .rc-track .review-card { flex: 0 0 100% !important; width: 100% !important; min-width: 0 !important; max-width: 100% !important; box-sizing: border-box; }',
    '  .rel-card { flex: 0 0 calc(50% - 10px); min-width: 160px; }',
    '  .rc-prev { left: 0; } .rc-next { right: 0; }',
    '  .rel-prev { left: 0; } .rel-next { right: 0; }',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  /* ================================================================
     Shared Helpers
     ================================================================ */
  function arrowSVG(dir) {
    var points = dir === 'prev' ? '15 18 9 12 15 6' : '9 18 15 12 9 6';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="' + points + '"/></svg>';
  }

  function getCardsPerView(opts) {
    var w = window.innerWidth;
    if (opts.mobileBreak && w <= opts.mobileBreak) return opts.mobileCards || 1;
    if (opts.tabletBreak && w <= opts.tabletBreak) return opts.tabletCards || (opts.cardsPerView || 2);
    return opts.cardsPerView || 3;
  }

  function initCarousel(wrapper, trackSelector, cardSelector, opts) {
    opts = opts || {};
    var track = wrapper.querySelector(trackSelector);
    if (!track) return;
    var cards = track.querySelectorAll(cardSelector);
    if (cards.length <= 1) return;

    var prevBtn = wrapper.querySelector(opts.prevSelector || '.rc-prev');
    var nextBtn = wrapper.querySelector(opts.nextSelector || '.rc-next');
    var dotsContainer = wrapper.querySelector(opts.dotsSelector || '.rc-dots');
    var dotClass = opts.dotClass || 'rc-dot';

    var currentSlide = 0;

    function getTotalSlides() {
      return Math.max(1, Math.ceil(cards.length / getCardsPerView(opts)));
    }

    function buildDots() {
      if (!dotsContainer) return;
      dotsContainer.innerHTML = '';
      var totalSlides = getTotalSlides();
      if (totalSlides <= 1) { dotsContainer.style.display = 'none'; return; }
      dotsContainer.style.display = '';
      for (var d = 0; d < totalSlides; d++) {
        var dot = document.createElement('button');
        dot.className = dotClass;
        if (d === 0) dot.classList.add('active');
        dot.setAttribute('aria-label', 'Go to slide ' + (d + 1));
        (function (idx) {
          dot.addEventListener('click', function () { scrollToSlide(track, cards, idx); });
        })(d);
        dotsContainer.appendChild(dot);
      }
    }

    function updateUI() {
      var totalSlides = getTotalSlides();
      if (prevBtn) prevBtn.style.display = totalSlides <= 1 ? 'none' : '';
      if (nextBtn) nextBtn.style.display = totalSlides <= 1 ? 'none' : '';
      if (prevBtn) prevBtn.disabled = currentSlide === 0;
      if (nextBtn) nextBtn.disabled = currentSlide >= totalSlides - 1;
      if (dotsContainer) {
        var dots = dotsContainer.querySelectorAll('.' + dotClass);
        for (var i = 0; i < dots.length; i++) {
          dots[i].classList.toggle('active', i === currentSlide);
        }
      }
    }

    function scrollToSlide(trk, crds, idx) {
      var cpv = getCardsPerView(opts);
      currentSlide = idx;
      var cardWidth = crds[0].offsetWidth;
      var gap = parseInt(getComputedStyle(trk).gap) || 20;
      var offset = idx * (cardWidth + gap) * cpv;
      trk.scrollTo({ left: offset, behavior: 'smooth' });
      updateUI();
    }

    // Scroll event listener to update dots
    var scrollTimer;
    track.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        var cpv = getCardsPerView(opts);
        var cardWidth = cards[0].offsetWidth;
        var gap = parseInt(getComputedStyle(track).gap) || 20;
        var slideWidth = (cardWidth + gap) * cpv;
        var newSlide = Math.round(track.scrollLeft / slideWidth);
        var totalSlides = getTotalSlides();
        if (newSlide !== currentSlide) {
          currentSlide = Math.min(newSlide, totalSlides - 1);
          updateUI();
        }
      }, 100);
    }, { passive: true });

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        var totalSlides = getTotalSlides();
        if (currentSlide > 0) scrollToSlide(track, cards, currentSlide - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        var totalSlides = getTotalSlides();
        if (currentSlide < totalSlides - 1) scrollToSlide(track, cards, currentSlide + 1);
      });
    }

    // Rebuild dots on resize
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        currentSlide = 0;
        buildDots();
        updateUI();
      }, 200);
    });

    buildDots();
    updateUI();
  }

  /* ================================================================
     Transform Review Section
     ================================================================ */
  function transformReviews() {
    // Find the reviews carousel wrapper in the page (index.html uses .reviews-carousel-wrapper, others use #reviews)
    var wrapper = document.querySelector('.reviews-carousel-wrapper');
    if (!wrapper) {
      var reviewsContainer = document.getElementById('reviews');
      if (reviewsContainer) wrapper = reviewsContainer.querySelector('.reviews-section');
    }
    if (!wrapper) return;
    // Prevent double initialization
    if (wrapper.hasAttribute('data-carousel-initialized')) return;
    wrapper.setAttribute('data-carousel-initialized', '1');

    var track = wrapper.querySelector('.reviews-track');
    var cards = wrapper.querySelectorAll('.review-card');
    if (!track || cards.length <= 1) return;

    var prevBtn = wrapper.querySelector('.reviews-prev, .rc-prev');
    var nextBtn = wrapper.querySelector('.reviews-next, .rc-next');

    // Remove any stale dots, then create fresh container after the track
    var oldDots = wrapper.querySelectorAll('.rc-dots');
    for (var od = 0; od < oldDots.length; od++) oldDots[od].remove();
    var dotsContainer = document.createElement('div');
    dotsContainer.className = 'rc-dots';
    track.parentNode.insertBefore(dotsContainer, track.nextSibling);

    initCarousel(wrapper, '.reviews-track', '.review-card', {
      cardsPerView: 3,
      tabletBreak: 900,
      tabletCards: 2,
      mobileBreak: 640,
      mobileCards: 1,
      prevSelector: '.reviews-prev, .rc-prev',
      nextSelector: '.reviews-next, .rc-next',
      dotsSelector: '.rc-dots',
      dotClass: 'rc-dot'
    });
  }

  /* ================================================================
     Transform Related Products Section
     ================================================================ */
  function transformRelated() {
    var relatedCards = document.querySelectorAll('.related-card');
    if (relatedCards.length === 0) return;

    // Find the related-grid parent
    var relatedGrid = document.querySelector('.related-grid');
    if (!relatedGrid) return;

    var relatedSection = relatedGrid.closest('.related-section') || relatedGrid.parentElement;
    if (!relatedSection) return;

    var carouselHTML = '<div class="rel-carousel">';
    carouselHTML += '<button class="rel-arrow rel-prev" aria-label="Previous products">' + arrowSVG('prev') + '</button>';
    carouselHTML += '<button class="rel-arrow rel-next" aria-label="Next products">' + arrowSVG('next') + '</button>';
    carouselHTML += '<div class="rel-track">';

    for (var c = 0; c < relatedCards.length; c++) {
      var card = relatedCards[c];
      var img = card.querySelector('img');
      var title = card.querySelector('.card-title');
      var price = card.querySelector('.card-price');
      var note = card.querySelector('.card-price-note');
      var href = card.getAttribute('href') || '#';
      carouselHTML += '<a href="' + href + '" class="rel-card">' +
        (img ? '<img class="rel-img" src="' + img.getAttribute('src') + '" alt="' + (img.getAttribute('alt') || '') + '" width="' + (img.getAttribute('width') || '400') + '" height="' + (img.getAttribute('height') || '300') + '" loading="lazy">' : '') +
        '<div class="rel-body">' +
          (title ? '<div class="rel-title">' + title.textContent + '</div>' : '') +
          (price ? '<div class="rel-price">' + price.textContent + '</div>' : '') +
          (note ? '<div class="rel-note">' + note.textContent + '</div>' : '') +
        '</div>' +
      '</a>';
    }

    carouselHTML += '</div>';
    carouselHTML += '<div class="rel-dots"></div>';
    carouselHTML += '</div>';

    relatedGrid.outerHTML = carouselHTML;

    // Init carousel
    var relWrapper = relatedSection.querySelector('.rel-carousel');
    if (relWrapper) {
      initCarousel(relWrapper, '.rel-track', '.rel-card', {
        cardsPerView: 4,
        tabletBreak: 900,
        tabletCards: 3,
        mobileBreak: 640,
        mobileCards: 2,
        prevSelector: '.rel-prev',
        nextSelector: '.rel-next',
        dotsSelector: '.rel-dots',
        dotClass: 'rel-dot'
      });
    }
  }

  /* ================================================================
     Init on DOM ready
     ================================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      transformReviews();
      transformRelated();
    });
  } else {
    transformReviews();
    transformRelated();
  }
})();
