function setupArtworkInteractions() {
  const canTrackPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (canTrackPointer) {
    document.querySelectorAll<HTMLElement>('[data-playful-media="expressive"], [data-playful-media="tilt"]').forEach((media) => {
      if (media.dataset.pointerReady === 'true') return;
      media.dataset.pointerReady = 'true';

      media.addEventListener('pointermove', (event) => {
        if (reducedMotion.matches || event.pointerType !== 'mouse') return;
        const bounds = media.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

        media.style.setProperty('--media-shift-x', `${(x * 2.5).toFixed(2)}px`);
        media.style.setProperty('--media-shift-y', `${(y * 2.5).toFixed(2)}px`);
        media.style.setProperty('--media-tilt-x', `${(-y * 1.2).toFixed(2)}deg`);
        media.style.setProperty('--media-tilt-y', `${(x * 1.2).toFixed(2)}deg`);
        media.style.setProperty('--media-tilt', `${(x * 1.1).toFixed(2)}deg`);
      });

      media.addEventListener('pointerleave', () => {
        media.style.removeProperty('--media-shift-x');
        media.style.removeProperty('--media-shift-y');
        media.style.removeProperty('--media-tilt-x');
        media.style.removeProperty('--media-tilt-y');
        media.style.removeProperty('--media-tilt');
      });
    });
  }

  const home = document.querySelector<HTMLElement>('[data-home-interaction]');
  const wordmark = home?.querySelector<HTMLButtonElement>('[data-wordmark-play]');
  const status = home?.querySelector<HTMLElement>('[data-ripple-status]');
  const featuredMedia = home?.querySelectorAll<HTMLElement>('[data-featured-media]');

  if (!home || !wordmark || !status || !featuredMedia || wordmark.dataset.rippleReady === 'true') return;
  if (featuredMedia.length !== 7) {
    throw new Error(`The homepage wordmark ripple requires seven featured projects; found ${featuredMedia.length}.`);
  }

  wordmark.dataset.rippleReady = 'true';
  let clearSequenceTimer = 0;
  const clearSequence = () => {
    window.clearTimeout(clearSequenceTimer);
    home.classList.remove('is-rippling');
  };

  wordmark.addEventListener('click', () => {
    if (reducedMotion.matches) {
      clearSequence();
      status.textContent = '';
      window.requestAnimationFrame(() => {
        status.textContent = 'The seven selected projects are ready to explore.';
      });
      return;
    }

    status.textContent = '';
    clearSequence();
    void home.offsetWidth;
    home.classList.add('is-rippling');
    clearSequenceTimer = window.setTimeout(clearSequence, 1000);
  });

  reducedMotion.addEventListener('change', (event) => {
    if (event.matches) clearSequence();
  });

  document.addEventListener('astro:before-swap', clearSequence, { once: true });
}

setupArtworkInteractions();
document.addEventListener('astro:page-load', setupArtworkInteractions);
