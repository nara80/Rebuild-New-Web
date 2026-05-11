// MildMate Reviews Carousel — Dot pagination for horizontal scroll
// Attaches to any .reviews-carousel on the page

(function () {
  const carousel = document.querySelector('.reviews-carousel');
  if (!carousel) return;

  const track = carousel.querySelector('.reviews-track');
  const dots = carousel.querySelectorAll('.reviews-dot');
  if (!track || !dots.length) return;

  function updateDots() {
    const maxScroll = track.scrollWidth - track.clientWidth;
    if (maxScroll <= 0) return;

    const ratio = track.scrollLeft / maxScroll;
    const activeIndex = Math.min(
      dots.length - 1,
      Math.round(ratio * (dots.length - 1))
    );

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === activeIndex);
    });
  }

  track.addEventListener('scroll', updateDots, { passive: true });

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      track.scrollTo({
        left: (maxScroll / (dots.length - 1)) * i,
        behavior: 'smooth',
      });
    });
  });

  // Initialise on load (images may shift layout)
  window.addEventListener('load', updateDots);
  updateDots();
})();
