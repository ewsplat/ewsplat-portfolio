import { withBase } from '../utils/site';

// Deployment manifest references: ensures all 60 wordmark animation frames
// are classified as required-site in the deployment manifest, so they are
// included in the GitHub Pages production build. Without these references, only
// frame-000.png was classified as required-site (because it appears in .astro HTML);
// frames 001-059 were excluded as "unreferenced" since they are only used by the
// pointerenter/pointerleave animation in this file.
'/images/wordmark/frames/frame-000.png';
'/images/wordmark/frames/frame-001.png';
'/images/wordmark/frames/frame-002.png';
'/images/wordmark/frames/frame-003.png';
'/images/wordmark/frames/frame-004.png';
'/images/wordmark/frames/frame-005.png';
'/images/wordmark/frames/frame-006.png';
'/images/wordmark/frames/frame-007.png';
'/images/wordmark/frames/frame-008.png';
'/images/wordmark/frames/frame-009.png';
'/images/wordmark/frames/frame-010.png';
'/images/wordmark/frames/frame-011.png';
'/images/wordmark/frames/frame-012.png';
'/images/wordmark/frames/frame-013.png';
'/images/wordmark/frames/frame-014.png';
'/images/wordmark/frames/frame-015.png';
'/images/wordmark/frames/frame-016.png';
'/images/wordmark/frames/frame-017.png';
'/images/wordmark/frames/frame-018.png';
'/images/wordmark/frames/frame-019.png';
'/images/wordmark/frames/frame-020.png';
'/images/wordmark/frames/frame-021.png';
'/images/wordmark/frames/frame-022.png';
'/images/wordmark/frames/frame-023.png';
'/images/wordmark/frames/frame-024.png';
'/images/wordmark/frames/frame-025.png';
'/images/wordmark/frames/frame-026.png';
'/images/wordmark/frames/frame-027.png';
'/images/wordmark/frames/frame-028.png';
'/images/wordmark/frames/frame-029.png';
'/images/wordmark/frames/frame-030.png';
'/images/wordmark/frames/frame-031.png';
'/images/wordmark/frames/frame-032.png';
'/images/wordmark/frames/frame-033.png';
'/images/wordmark/frames/frame-034.png';
'/images/wordmark/frames/frame-035.png';
'/images/wordmark/frames/frame-036.png';
'/images/wordmark/frames/frame-037.png';
'/images/wordmark/frames/frame-038.png';
'/images/wordmark/frames/frame-039.png';
'/images/wordmark/frames/frame-040.png';
'/images/wordmark/frames/frame-041.png';
'/images/wordmark/frames/frame-042.png';
'/images/wordmark/frames/frame-043.png';
'/images/wordmark/frames/frame-044.png';
'/images/wordmark/frames/frame-045.png';
'/images/wordmark/frames/frame-046.png';
'/images/wordmark/frames/frame-047.png';
'/images/wordmark/frames/frame-048.png';
'/images/wordmark/frames/frame-049.png';
'/images/wordmark/frames/frame-050.png';
'/images/wordmark/frames/frame-051.png';
'/images/wordmark/frames/frame-052.png';
'/images/wordmark/frames/frame-053.png';
'/images/wordmark/frames/frame-054.png';
'/images/wordmark/frames/frame-055.png';
'/images/wordmark/frames/frame-056.png';
'/images/wordmark/frames/frame-057.png';
'/images/wordmark/frames/frame-058.png';
'/images/wordmark/frames/frame-059.png';

function setupAnimationControls() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return;

  document.querySelectorAll<HTMLElement>('[data-media-control]').forEach((media) => {
    if (media.dataset.controlReady === 'true') return;
    media.dataset.controlReady = 'true';

    const video = media.querySelector<HTMLVideoElement>('video');
    if (!video) return; // Only provide controls for video, not GIF images

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'media-toggle';
    toggle.setAttribute('aria-label', 'Play or pause animation');
    toggle.setAttribute('aria-pressed', 'true');
    toggle.innerHTML =
      '<span class="sr-only">Pause</span><svg class="play-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="4" x2="6" y2="20"></line><line x1="18" y1="4" x2="18" y2="20"></line></svg>';
    media.appendChild(toggle);

    let isPlaying = true;

    const togglePlay = () => {
      isPlaying = !isPlaying;
      toggle.setAttribute('aria-pressed', String(isPlaying));
      if (isPlaying) {
        video.play().catch(() => {});
        toggle.innerHTML =
          '<span class="sr-only">Pause</span><svg class="play-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="4" x2="6" y2="20"></line><line x1="18" y1="4" x2="18" y2="20"></line></svg>';
      } else {
        video.pause();
        toggle.innerHTML =
          '<span class="sr-only">Play</span><svg class="play-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21"></polygon></svg>';
      }
    };

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      togglePlay();
    });

    video.addEventListener('play', () => {
      isPlaying = true;
      toggle.setAttribute('aria-pressed', 'true');
      toggle.innerHTML =
        '<span class="sr-only">Pause</span><svg class="play-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="4" x2="6" y2="20"></line><line x1="18" y1="4" x2="18" y2="20"></line></svg>';
    });

    video.addEventListener('pause', () => {
      isPlaying = false;
      toggle.setAttribute('aria-pressed', 'false');
      toggle.innerHTML =
        '<span class="sr-only">Play</span><svg class="play-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21"></polygon></svg>';
    });
  });
}

function setupPreviewVideos() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video[data-preview-video]'));
  if (!videos.length) return;

  const setPreviewState = (video: HTMLVideoElement, shouldPlay: boolean) => {
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    if (shouldPlay && !reducedMotion.matches) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  videos.forEach((video) => {
    if (video.dataset.previewReady === 'true') return;
    video.dataset.previewReady = 'true';
    setPreviewState(video, false);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => setPreviewState(entry.target as HTMLVideoElement, entry.isIntersecting));
  }, { rootMargin: '180px 0px', threshold: 0.08 });
  videos.forEach((video) => observer.observe(video));

  reducedMotion.addEventListener('change', () => {
    videos.forEach((video) => setPreviewState(video, !reducedMotion.matches));
  });
}

function setupProjectVideos() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('[data-project-video] video'));
  if (!videos.length) return;

  const setProjectVideoState = (video: HTMLVideoElement, shouldPlay: boolean) => {
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    if (shouldPlay && !reducedMotion.matches) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  videos.forEach((video) => {
    if (video.dataset.projectVideoReady === 'true') return;
    video.dataset.projectVideoReady = 'true';
    setProjectVideoState(video, !reducedMotion.matches);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => setProjectVideoState(entry.target as HTMLVideoElement, entry.isIntersecting));
  }, { rootMargin: '220px 0px', threshold: 0.03 });
  videos.forEach((video) => observer.observe(video));

  reducedMotion.addEventListener('change', () => {
    videos.forEach((video) => setProjectVideoState(video, !reducedMotion.matches));
  });
}

function setupArtworkInteractions() {
  const canTrackPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (canTrackPointer) {
    document.querySelectorAll<HTMLElement>('[data-playful-media="expressive"], [data-playful-media="tilt"]').forEach((media) => {
      if (media.dataset.pointerReady === 'true') return;
      media.dataset.pointerReady = 'true';

      // Per-element tilt intensity: subtle | medium | strong
      const intensity = media.dataset.tiltIntensity ?? 'medium';
      const tiltMax = intensity === 'subtle' ? 1.5 : intensity === 'strong' ? 3.5 : 2.5;
      const shiftMax = intensity === 'subtle' ? 2 : intensity === 'strong' ? 6 : 4;

      media.addEventListener('pointermove', (event) => {
        if (reducedMotion.matches || event.pointerType !== 'mouse') return;
        const bounds = media.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

        media.style.setProperty('--media-shift-x', `${(x * shiftMax).toFixed(2)}px`);
        media.style.setProperty('--media-shift-y', `${(y * shiftMax).toFixed(2)}px`);
        media.style.setProperty('--media-tilt-x', `${(-y * tiltMax).toFixed(2)}deg`);
        media.style.setProperty('--media-tilt-y', `${(x * tiltMax).toFixed(2)}deg`);
      });

      media.addEventListener('pointerleave', () => {
        media.style.removeProperty('--media-shift-x');
        media.style.removeProperty('--media-shift-y');
        media.style.removeProperty('--media-tilt-x');
        media.style.removeProperty('--media-tilt-y');
      });
    });
  }
}

/* ==========================================================================
   Wordmark Directional Interactive Animation (Ping / Pong)
   - Pointer Enter: Plays forward (0 -> 59) and holds on frame 59.
   - Pointer Leave: Plays backwards (current -> 0) and rests on frame 0.
   - Paced ~50% slower (frame display duration ~33ms, ~30fps).
   - Seamless mid-flight direction reversals without resets.
   - Precached frames, reduced-motion & touch-friendly.
   ========================================================================== */

const WORDMARK_FRAME_COUNT = 60;
const WORDMARK_FRAME_BASE = withBase('/images/wordmark/frames/frame-');
const WORDMARK_FRAME_DURATION_MS = 33.3; // ~30 fps (~50% slower than 60fps)

let cachedWordmarkFrames: HTMLImageElement[] | null = null;

function preloadWordmarkFrames(): HTMLImageElement[] {
  if (cachedWordmarkFrames) return cachedWordmarkFrames;
  const frames: HTMLImageElement[] = [];
  for (let i = 0; i < WORDMARK_FRAME_COUNT; i++) {
    const img = new Image();
    img.src = `${WORDMARK_FRAME_BASE}${String(i).padStart(3, '0')}.png`;
    frames.push(img);
  }
  cachedWordmarkFrames = frames;
  return frames;
}

function setupWordmarkAnimation() {
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const wordmarks = document.querySelectorAll<HTMLElement>('[data-wordmark-nav], [data-wordmark-footer]');
  if (!wordmarks.length) return;

  wordmarks.forEach((navWordmark) => {

  const targetImg = navWordmark.querySelector<HTMLImageElement>('img');
  if (!targetImg) return;

  // Ensure default frame is established
  if (!targetImg.getAttribute('src')) {
    targetImg.src = `${WORDMARK_FRAME_BASE}000.png`;
  }

  // Touch devices and users with reduced motion preferences keep the clean static wordmark
  if (!isFinePointer || isReducedMotion) {
    targetImg.src = `${WORDMARK_FRAME_BASE}000.png`;
    return;
  }

  // Idempotency guard for Astro page navigation
  if (navWordmark.dataset.animInitialized === 'true') return;
  navWordmark.dataset.animInitialized = 'true';

  const frames = preloadWordmarkFrames();

  let currentFrameIndex = 0;
  let targetDirection: 1 | -1 = -1; // 1 = PING (forward to 59), -1 = PONG (backward to 0)
  let animationFrameId = 0;
  let isLoopRunning = false;
  let lastTimestamp = 0;
  let timeAccumulator = 0;

  const renderCurrentFrame = () => {
    const frame = frames[currentFrameIndex];
    if (frame && targetImg.src !== frame.src) {
      targetImg.src = frame.src;
    }
  };

  const animationStep = (timestamp: number) => {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    timeAccumulator += delta;

    while (timeAccumulator >= WORDMARK_FRAME_DURATION_MS) {
      timeAccumulator -= WORDMARK_FRAME_DURATION_MS;

      if (targetDirection === 1) {
        // PING: Advancing forward toward frame 59
        if (currentFrameIndex < WORDMARK_FRAME_COUNT - 1) {
          currentFrameIndex++;
          renderCurrentFrame();
        } else {
          // Reached frame 59: hold position while hovering
          isLoopRunning = false;
          cancelAnimationFrame(animationFrameId);
          return;
        }
      } else if (targetDirection === -1) {
        // PONG: Rewinding backward toward frame 0
        if (currentFrameIndex > 0) {
          currentFrameIndex--;
          renderCurrentFrame();
        } else {
          // Reached frame 0: clean static wordmark restored
          isLoopRunning = false;
          cancelAnimationFrame(animationFrameId);
          return;
        }
      }
    }

    animationFrameId = requestAnimationFrame(animationStep);
  };

  const startLoop = () => {
    if (isLoopRunning) return;
    isLoopRunning = true;
    lastTimestamp = performance.now();
    timeAccumulator = 0;
    cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(animationStep);
  };

  navWordmark.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    targetDirection = 1; // Play forward
    startLoop();
  });

  navWordmark.addEventListener('pointerleave', () => {
    targetDirection = -1; // Play backward
    startLoop();
  });

  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    if (e.matches) {
      cancelAnimationFrame(animationFrameId);
      isLoopRunning = false;
      currentFrameIndex = 0;
      renderCurrentFrame();
    }
  });
  });
}

/* ==========================================================================
   Interactive Easter Eggs & Character Cameo Discoveries
   ========================================================================== */

function setupInteractiveEasterEggs() {
  const cameoBox = document.querySelector<HTMLElement>('[data-interactive-cameo]');
  if (!cameoBox || cameoBox.dataset.easterReady === 'true') return;
  cameoBox.dataset.easterReady = 'true';

  const btn = cameoBox.querySelector<HTMLButtonElement>('[data-cameo-btn]');
  const bubble = cameoBox.querySelector<HTMLElement>('[data-cameo-bubble]');
  const cameoImg = cameoBox.querySelector<HTMLElement>('.cameo-image');

  const messages = [
    'WUF // 2026!',
    'SPECIMEN CURIOUS',
    'ALTERNATIVE CARTOONING',
    'TOY INDUSTRIALISM VIBES',
    'KEEP EXPLORING ↗'
  ];
  let msgIdx = 0;
  let bubbleTimer = 0;

  if (btn && bubble) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.clearTimeout(bubbleTimer);
      bubble.textContent = messages[msgIdx % messages.length];
      msgIdx++;
      bubble.removeAttribute('hidden');

      if (cameoImg) {
        cameoImg.style.transform = 'scale(1.15) rotate(6deg)';
        setTimeout(() => {
          cameoImg.style.transform = 'scale(1.1) rotate(-6deg)';
          setTimeout(() => {
            cameoImg.style.transform = '';
          }, 150);
        }, 150);
      }

      bubbleTimer = window.setTimeout(() => {
        bubble.setAttribute('hidden', '');
      }, 2200);
    });
  }

  // Pointer tracking for gentle eye/tilt movement
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (isFinePointer && !isReducedMotion && cameoImg) {
    document.addEventListener('pointermove', (e) => {
      const rect = cameoBox.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);

      // Only track when within 400px of the cameo box
      if (dist < 400) {
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const shiftX = Math.cos(angle) * 3;
        const shiftY = Math.sin(angle) * 3;
        cameoImg.style.transform = `translate(${shiftX.toFixed(1)}px, ${shiftY.toFixed(1)}px)`;
      } else {
        cameoImg.style.transform = '';
      }
    });
  }
}

function setupSpecimenPaletteEffects() {
  const swatches = document.querySelectorAll<HTMLElement>('[data-swatch]');
  const leadSpecimen = document.querySelector<HTMLElement>('[data-specimen-lead]');
  if (!swatches.length || !leadSpecimen) return;

  swatches.forEach((swatch) => {
    const color = swatch.dataset.swatch;
    if (!color) return;

    swatch.addEventListener('pointerenter', () => {
      leadSpecimen.style.borderColor = color;
      leadSpecimen.style.boxShadow = `0 0 24px ${color}33`;
    });

    swatch.addEventListener('pointerleave', () => {
      leadSpecimen.style.borderColor = '';
      leadSpecimen.style.boxShadow = '';
    });
  });
}

// Initial bootstrap
setupAnimationControls();
setupPreviewVideos();
setupProjectVideos();
setupArtworkInteractions();
setupWordmarkAnimation();
setupInteractiveEasterEggs();
setupSpecimenPaletteEffects();

// Astro view transition rehydration
document.addEventListener('astro:page-load', () => {
  setupAnimationControls();
  setupPreviewVideos();
  setupProjectVideos();
  setupArtworkInteractions();
  setupWordmarkAnimation();
  setupInteractiveEasterEggs();
  setupSpecimenPaletteEffects();
});
