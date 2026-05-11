// MildMate Reviews Carousel — Arrows + Dots (1 card per dot/step)
// Desktop: 2 cards visible, arrows + 5 dots
// Mobile:  1 card visible, swipe only (arrows hidden via CSS)

(function () {
  const wrapper = document.querySelector('.reviews-carousel-wrapper');
  if (!wrapper) return;

  const carousel = wrapper.querySelector('.reviews-carousel');
  const track = carousel?.querySelector('.reviews-track');
  const dots = carousel?.querySelectorAll('.reviews-dot');
  const prevBtn = wrapper.querySelector('.reviews-prev');
  const nextBtn = wrapper.querySelector('.reviews-next');

  if (!track || !dots.length) return;

  function getCardStride() {
    const firstCard = track.querySelector('.review-card');
    if (!firstCard) return 0;
    // Include gap in stride so each step reveals the next card
    const gap = parseFloat(getComputedStyle(track).gap) || 24;
    return firstCard.offsetWidth + gap;
  }

  function getTotalCards() {
    return track.querySelectorAll('.review-card').length;
  }

  function updateDots() {
    const stride = getCardStride();
    if (!stride) return;

    const maxScroll = track.scrollWidth - track.clientWidth;
    let activeIndex;

    if (maxScroll <= 0) {
      activeIndex = 0;
    } else if (track.scrollLeft >= maxScroll - 2) {
      // At the end — activate last dot
      activeIndex = dots.length - 1;
    } else {
      activeIndex = Math.max(0, Math.min(
        dots.length - 1,
        Math.round(track.scrollLeft / stride)
      ));
    }

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === activeIndex);
    });

    // Disable arrows at boundaries
    if (prevBtn) prevBtn.disabled = track.scrollLeft <= 1;
    if (nextBtn) nextBtn.disabled = track.scrollLeft >= maxScroll - 1;
  }

  function scrollByCards(deltaCards) {
    const stride = getCardStride();
    if (!stride) return;
    track.scrollBy({ left: stride * deltaCards, behavior: 'smooth' });
  }

  function scrollToCard(index) {
    const stride = getCardStride();
    if (!stride) return;
    track.scrollTo({ left: stride * index, behavior: 'smooth' });
  }

  // Scroll events
  track.addEventListener('scroll', updateDots, { passive: true });

  // Dot clicks — one dot per card
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => scrollToCard(i));
  });

  // Arrow clicks
  if (prevBtn) {
    prevBtn.addEventListener('click', () => scrollByCards(-1));
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => scrollByCards(1));
  }

  // Initialise on load
  window.addEventListener('load', updateDots);
  updateDots();
})();
