import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

const OUT_DIR = path.resolve('screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const routes: {
  name: string;
  path: string;
  composition?: 'single-artwork' | 'motion' | 'graphic-sequence';
  verifyVideoPlayback?: boolean;
}[] = [
  { name: 'home', path: '/' },
  { name: 'archive', path: '/archive' },
  { name: 'composition-single', path: '/projects/composition-single-artwork', composition: 'single-artwork' },
  { name: 'composition-motion', path: '/projects/composition-motion', composition: 'motion' },
  { name: 'composition-sequence', path: '/projects/composition-graphic-sequence', composition: 'graphic-sequence' },
  { name: 'project-single-artwork', path: '/projects/peace-and-love', composition: 'single-artwork' },
  { name: 'project-motion-campaign', path: '/projects/all-stars-nexgen-converse', composition: 'motion', verifyVideoPlayback: false },
  { name: 'project-graphic-sequence', path: '/projects/digital-spagetti', composition: 'graphic-sequence' },
  { name: 'project-plans-after', path: '/projects/plans-after-pop-up-party', composition: 'motion', verifyVideoPlayback: false },
  { name: 'project-farming-animation', path: '/projects/digital-farming-fence', composition: 'motion', verifyVideoPlayback: false },
  { name: 'about', path: '/about' },
  { name: 'contact', path: '/contact' },
];

const viewports = [
  { name: 'desktop', width: 1280, height: 900, isMobile: false },
  { name: 'mobile', width: 375, height: 812, isMobile: true },
];

async function capture() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });

    for (const route of routes) {
      for (const viewport of viewports) {
        for (const theme of ['dark', 'light'] as const) {
          runtimeErrors.length = 0;
          await page.setViewport({
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: 1,
            isMobile: viewport.isMobile,
          });

          const response = await page.goto(`http://127.0.0.1:4321${route.path}?theme=${theme}`, {
            waitUntil: 'networkidle0',
          });
          if (response?.status() !== 200) {
            throw new Error(`${route.path} returned HTTP ${response?.status() ?? 'no response'}.`);
          }
          await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all(
              ['16px "Bebas Neue"', '16px Inter', '16px "JetBrains Mono"']
                .map((font) => document.fonts.load(font)),
            );
          });

          const pageChecks = await page.evaluate((expectedTheme) => ({
            hasHeading: Boolean(document.querySelector('h1')),
            hasExpectedTheme: document.documentElement.dataset.theme === expectedTheme,
            hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
            fontsLoaded: [
              document.fonts.check('16px "Bebas Neue"'),
              document.fonts.check('16px Inter'),
              document.fonts.check('16px "JetBrains Mono"'),
            ].every(Boolean),
          }), theme);

          if (route.composition) {
            const compositionMatches = await page.$(`.project-opening.composition-${route.composition}`);
            if (!compositionMatches) {
              throw new Error(`${route.path} did not render its ${route.composition} composition.`);
            }
            const mediaRatiosPreserved = await page.$$eval('.media-block', (blocks) =>
              blocks.every((block) => {
                if (!block.style.aspectRatio) return true;
                const [width, height] = block.style.aspectRatio.split('/').map(Number);
                const bounds = block.getBoundingClientRect();
                return Math.abs(bounds.width / bounds.height - width / height) < 0.02;
              }),
            );
            if (!mediaRatiosPreserved) {
              throw new Error(`${route.path} did not preserve a configured media aspect ratio.`);
            }
            if (route.composition === 'motion') {
              const videoConfigured = await page.$eval('.project-hero video', (video) =>
                video.controls && Boolean(video.poster) && Boolean(video.currentSrc),
              );
              if (!videoConfigured) {
                throw new Error('Motion composition video needs a source, controls and a poster.');
              }
              if (route.verifyVideoPlayback === false) {
                const assetStatuses = await page.evaluate(async () => {
                  const video = document.querySelector('.project-hero video');
                  if (!(video instanceof HTMLVideoElement)) return [];
                  const [source, poster] = await Promise.all([
                    fetch(video.currentSrc, { method: 'HEAD' }),
                    fetch(video.poster, { method: 'HEAD' }),
                  ]);
                  return [source.status, poster.status];
                });
                if (assetStatuses.length !== 2 || assetStatuses.some((status) => status !== 200)) {
                  throw new Error('Motion source or poster could not be retrieved.');
                }
              } else {
                await page.$eval('.project-hero video', (video) => {
                  video.preload = 'auto';
                  video.load();
                });
                await page.waitForFunction(() => {
                  const video = document.querySelector('.project-hero video');
                  return video instanceof HTMLVideoElement && (video.readyState >= 2 || video.error !== null);
                }, { timeout: 10000 });
                const videoPlayable = await page.$eval('.project-hero video', (video) =>
                  video.controls && Boolean(video.poster) && video.error === null,
                );
                if (!videoPlayable) {
                  throw new Error('Motion composition video is not playable in the test browser.');
                }
              }
            }
          }

          if (route.path === '/' || route.path === '/archive') {
            const compositionTestsHidden = await page.$$eval(
              'a[href^="/projects/composition-"]',
              (links) => links.length === 0,
            );
            if (!compositionTestsHidden) {
              throw new Error(`Composition test routes leaked into ${route.path}.`);
            }
            const draftLinksHidden = await page.$$eval(
              'a[href^="/projects/"]',
              (links) => links.every((link) =>
                !/placeholder-0[1-4]|wet-denim-again-and-again|dj-edenna-vj-visuals|pawa-soccer-player-model|matty-album-art-01/.test(
                  link.getAttribute('href') ?? '',
                ),
              ),
            );
            if (!draftLinksHidden) {
              throw new Error(`Draft project routes leaked into ${route.path}.`);
            }
          }

          if (!pageChecks.hasHeading || !pageChecks.hasExpectedTheme || pageChecks.hasHorizontalOverflow) {
            throw new Error(`${route.name} ${viewport.name} ${theme} failed layout, heading or theme checks.`);
          }
          if (!pageChecks.fontsLoaded) {
            throw new Error(`One or more site fonts failed to load on ${route.path}.`);
          }
          if (runtimeErrors.length > 0) {
            throw new Error(`${route.path} reported browser errors: ${runtimeErrors.join('; ')}`);
          }

          const name = `${route.name}-${viewport.name}-${theme}.png`;
          await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
          console.log(`Captured: ${name}`);

          if (viewport.isMobile) {
            await page.locator('.menu-toggle').click();
            const menuOpened = await page.$eval('.mobile-nav-details', (element) => element.hasAttribute('open'));
            if (!menuOpened) throw new Error('Mobile navigation did not open.');
            await page.locator('.menu-toggle').click();
          }
        }
      }
    }

    for (const route of [
      '/projects/placeholder-01',
      '/projects/placeholder-02',
      '/projects/placeholder-03',
      '/projects/placeholder-04',
      '/projects/wet-denim-again-and-again',
      '/projects/dj-edenna-vj-visuals',
      '/projects/pawa-soccer-player-model',
      '/projects/matty-album-art-01',
    ]) {
      const response = await page.goto(`http://127.0.0.1:4321${route}`, { waitUntil: 'networkidle0' });
      if (response?.status() !== 404) {
        throw new Error(`${route} should be draft-only but returned HTTP ${response?.status() ?? 'no response'}.`);
      }
    }

    await page.goto('http://127.0.0.1:4321/contact?theme=dark', { waitUntil: 'networkidle0' });
    await page.locator('.mobile-menu .theme-toggle').click();
    await page.goto('http://127.0.0.1:4321/about', { waitUntil: 'networkidle0' });
    const themePersisted = await page.evaluate(() => document.documentElement.dataset.theme === 'light');
    if (!themePersisted) throw new Error('Theme preference did not persist across routes.');

    console.log(`Verified routes, themes, fonts and navigation; captured ${routes.length * viewports.length * 2} screenshots in ${OUT_DIR}`);
  } finally {
    await browser.close();
  }
}

capture().catch((error) => {
  console.error('Screenshot capture failed:', error);
  process.exitCode = 1;
});
