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
    '.rc-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: #fff; border: 1px solid #d1d5db; color: #000; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 3; transition: all 0.2s; }',
    '.rc-arrow:hover { background: #f3f4f6; color: #000; }',
    '.rc-arrow:disabled { opacity: 0.3; cursor: default; }',
    '.rc-arrow:disabled:hover { background: #fff; color: #000; }',
    '.rc-arrow svg { width: 18px; height: 18px; }',
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
    '.rel-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: #fff; border: 1px solid #d1d5db; color: #000; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 3; transition: all 0.2s; }',
    '.rel-arrow:hover { background: #f3f4f6; color: #000; }',
    '.rel-arrow:disabled { opacity: 0.3; cursor: default; }',
    '.rel-arrow:disabled:hover { background: #fff; color: #000; }',
    '.rel-arrow svg { width: 18px; height: 18px; }',
    '.rel-prev { left: 8px; }',
    '.rel-next { right: 8px; }',
    '.rel-dots { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 20px; }',
    '.rel-dot { width: 8px; height: 8px; border-radius: 50%; border: none; background: #e5e7eb; cursor: pointer; padding: 0; transition: all 0.2s; }',
    '.rel-dot.active { background: #2c96f4; width: 24px; border-radius: 4px; }',
    '/* Responsive */',
    '@media (max-width: 900px) {',
    '  .rc-card, .rc-track .review-card { flex: 0 0 calc(50% - 10px); }',
    '  .rel-card { flex: 0 0 calc(33.333% - 14px); }',
    '  .rc-prev { left: 0; } .rc-next { right: 0; }',
    '  .rel-prev { left: 0; } .rel-next { right: 0; }',
    '}',
    '@media (max-width: 640px) {',
    '  .rc-wrapper { padding: 0 36px; }',
    '  .rel-carousel { padding: 0 36px; }',
    '  .rc-card, .rc-track .review-card { flex: 0 0 100%; min-width: 0; }',
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
    var d = dir === 'prev' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="' + d + '"/></svg>';
  }

  function initCarousel(wrapper, trackSelector, cardSelector, opts) {
    opts = opts || {};
    var cardsPerView = opts.cardsPerView || 3;
    var track = wrapper.querySelector(trackSelector);
    if (!track) return;
    var cards = track.querySelectorAll(cardSelector);
    if (cards.length <= cardsPerView) {
      // Not enough cards — hide arrows/dots
      var arrows = wrapper.querySelectorAll('[class*="-arrow"]');
      for (var a = 0; a < arrows.length; a++) arrows[a].style.display = 'none';
      return;
    }

    var prevBtn = wrapper.querySelector(opts.prevSelector || '.rc-prev');
    var nextBtn = wrapper.querySelector(opts.nextSelector || '.rc-next');
    var dotsContainer = wrapper.querySelector(opts.dotsSelector || '.rc-dots');
    var dotClass = opts.dotClass || 'rc-dot';

    // Create dots
    var totalSlides = Math.ceil(cards.length / cardsPerView);
    for (var d = 0; d < totalSlides; d++) {
      var dot = document.createElement('button');
      dot.className = dotClass;
      if (d === 0) dot.classList.add('active');
      dot.setAttribute('aria-label', 'Go to slide ' + (d + 1));
      (function (idx) {
        dot.addEventListener('click', function () { scrollToSlide(track, cards, idx, cardsPerView); });
      })(d);
      if (dotsContainer) dotsContainer.appendChild(dot);
    }

    var currentSlide = 0;

    function updateUI() {
      if (prevBtn) prevBtn.disabled = currentSlide === 0;
      if (nextBtn) nextBtn.disabled = currentSlide >= totalSlides - 1;
      if (dotsContainer) {
        var dots = dotsContainer.querySelectorAll('.' + dotClass);
        for (var i = 0; i < dots.length; i++) {
          dots[i].classList.toggle('active', i === currentSlide);
        }
      }
    }

    function scrollToSlide(trk, crds, idx, cPerView) {
      currentSlide = idx;
      var cardWidth = crds[0].offsetWidth;
      var gap = parseInt(getComputedStyle(trk).gap) || 20;
      var offset = idx * (cardWidth + gap) * cPerView;
      trk.scrollTo({ left: offset, behavior: 'smooth' });
      updateUI();
    }

    // Scroll event listener to update dots
    var scrollTimer;
    track.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        var cardWidth = cards[0].offsetWidth;
        var gap = parseInt(getComputedStyle(track).gap) || 20;
        var slideWidth = (cardWidth + gap) * cardsPerView;
        var newSlide = Math.round(track.scrollLeft / slideWidth);
        if (newSlide !== currentSlide) {
          currentSlide = Math.min(newSlide, totalSlides - 1);
          updateUI();
        }
      }, 100);
    }, { passive: true });

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (currentSlide > 0) scrollToSlide(track, cards, currentSlide - 1, cardsPerView);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (currentSlide < totalSlides - 1) scrollToSlide(track, cards, currentSlide + 1, cardsPerView);
      });
    }

    updateUI();
  }

  /* ================================================================
     Transform Review Section
     ================================================================ */
  function transformReviews() {
    var reviewsContainer = document.getElementById('reviews');
    if (!reviewsContainer) return;
    var reviewsSection = reviewsContainer.querySelector('.reviews-section');
    if (!reviewsSection) return;

    // Find existing review cards container (the div directly containing .review-card elements)
    var existingCards = reviewsSection.querySelectorAll('.review-card');
    var existingGrid = existingCards.length > 0 ? existingCards[0].parentElement : null;

    // Build the carousel HTML
    var carouselHTML = '<div class="rc-wrapper">';
    carouselHTML += '<button class="rc-arrow rc-prev" aria-label="Previous reviews">' + arrowSVG('prev') + '</button>';
    carouselHTML += '<button class="rc-arrow rc-next" aria-label="Next reviews">' + arrowSVG('next') + '</button>';
    carouselHTML += '<div class="rc-track">';

    // Insert existing review cards
    for (var e = 0; e < existingCards.length; e++) {
      carouselHTML += existingCards[e].outerHTML;
    }

    carouselHTML += '</div>';
    carouselHTML += '<div class="rc-dots"></div>';
    carouselHTML += '</div>';

    // Replace old grid with carousel
    if (existingGrid) {
      existingGrid.outerHTML = carouselHTML;
    } else {
      // Fallback: append after reviews-summary
      var summary = reviewsSection.querySelector('.reviews-summary');
      if (summary) {
        summary.insertAdjacentHTML('afterend', carouselHTML);
      }
    }

    // Init carousel
    var wrapper = reviewsSection.querySelector('.rc-wrapper');
    if (wrapper) {
      initCarousel(wrapper, '.rc-track', '.rc-card, .review-card', {
        cardsPerView: 3,
        prevSelector: '.rc-prev',
        nextSelector: '.rc-next',
        dotsSelector: '.rc-dots',
        dotClass: 'rc-dot'
      });
    }
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
