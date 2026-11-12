/**
 * Deliberate reading orders for the public Archive. Project records remain the
 * single source of truth for content; this file only governs presentation.
 */
export const archiveOrders = {
  all: [
    'orange-fields', 'all-stars-nexgen-converse', 'pawa-dog-3d-model',
    'commercial-bay-fifa-womens-world-cup', 'checks-radio-animated-identity', 'peace-and-love',
    'newground-product-renders-website-motion', 'matty-searching', 'elsewhere-festival-auckland',
    'personal-sour-yuck', 'lower-billie-hoodie-graphic', 'personal-character-exploration',
    'digital-farming-fence', 'coffee-adventures', 'spinoff-nz-web-illustrations',
    'plans-after-pa-festival', 'ewsplat-motion-experiments', 'iloveugly-product-illustration',
    'personal-wuu2', 'lower-effn-endcap', 'personal-dog', 'play-it-strange-animated-logo-character',
    'personal-trippy-pup', 'commercial-bay-happy-plants', 'les-mills-animated-paid-ad-typography',
    'odd-company-drinks', 'personal-headphone-dog', 'kiljoy-event-campaign',
    'plans-after-24th-march-2023', 'checks-downtown-graphic-design', 'how-we-can-be-event-visuals',
    'commercial-bay-valet-service', 'personal-scared-dog', 'wet-denim-again-and-again',
    'personal-at-cafe-with-dog', 'flux-eden-burns-event-artwork', 'plans-after-20th-january-2023',
    'deepstate-rain', 'personal-snakebite', 'mxfm-tee-illustration-apparel-graphics',
    'personal-morphing-characters', 'lower-bogo-animation', 'personal-upscaled-tiger',
    'kaylee-bell-cowboy-up', 'dj-edenna-vj-visuals', 'how-we-can-be-bella-claxton',
    'personal-crazy-scary', 'plans-after-festival-2023', 'found-store',
    'plans-after-pop-up-party', 'lower-logo-animation', 'deepstate-now-that-youre-gone',
    'personal-layering-rhythm', 'plans-after-projector-visuals', 'wyld-coffee-product-renders',
    'plans-after-ilu-marathon', 'personal-cheers', 'plans-after-pubcrawl-london',
    'personal-like-what-you-like', 'plans-after-24th-february-2023',
    'how-we-can-be-egg-hatch', 'digital-spagetti', 'personal-when-lid-closes',
  ],
  personal: [
    'orange-fields', 'pawa-dog-3d-model', 'peace-and-love', 'matty-searching',
    'personal-sour-yuck', 'personal-character-exploration', 'coffee-adventures',
    'ewsplat-motion-experiments', 'personal-wuu2', 'personal-dog', 'personal-trippy-pup',
    'personal-morphing-characters', 'personal-snakebite', 'personal-like-what-you-like',
    'personal-layering-rhythm', 'personal-scared-dog', 'personal-at-cafe-with-dog',
    'personal-headphone-dog', 'personal-cheers', 'personal-crazy-scary',
    'personal-upscaled-tiger', 'personal-when-lid-closes',
  ],
  commissions: [
    'all-stars-nexgen-converse', 'commercial-bay-fifa-womens-world-cup',
    'checks-radio-animated-identity', 'newground-product-renders-website-motion',
    'elsewhere-festival-auckland', 'lower-billie-hoodie-graphic', 'digital-farming-fence',
    'spinoff-nz-web-illustrations', 'plans-after-pa-festival', 'iloveugly-product-illustration',
    'play-it-strange-animated-logo-character', 'commercial-bay-valet-service',
    'dj-edenna-vj-visuals', 'odd-company-drinks', 'kiljoy-event-campaign',
    'checks-downtown-graphic-design', 'plans-after-projector-visuals',
    'wet-denim-again-and-again', 'how-we-can-be-bella-claxton',
    'commercial-bay-happy-plants', 'flux-eden-burns-event-artwork',
    'plans-after-pop-up-party', 'deepstate-rain', 'wyld-coffee-product-renders',
    'mxfm-tee-illustration-apparel-graphics', 'kaylee-bell-cowboy-up',
    'plans-after-ilu-marathon', 'digital-spagetti', 'found-store', 'lower-effn-endcap',
    'plans-after-pubcrawl-london', 'how-we-can-be-event-visuals', 'lower-bogo-animation',
    'plans-after-20th-january-2023', 'deepstate-now-that-youre-gone',
    'plans-after-24th-february-2023', 'lower-logo-animation',
    'plans-after-24th-march-2023', 'how-we-can-be-egg-hatch',
    'plans-after-festival-2023', 'les-mills-animated-paid-ad-typography',
  ],
} as const;

export type ArchiveOrderMode = keyof typeof archiveOrders;

export const getArchiveOrder = (slug: string, mode: ArchiveOrderMode = 'all') => {
  const position = archiveOrders[mode].indexOf(slug as never);
  return position === -1 ? Number.MAX_SAFE_INTEGER : position;
};
