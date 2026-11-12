import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const mediaFields = {
  type: z.enum(['image', 'gif', 'video', 'youtube', 'placeholder']),
  src: z.string().optional(),
  poster: z.string().optional(),
  aspect: z.string()
    .regex(/^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/)
    .refine((value) => value.split('/').every((dimension) => Number(dimension) > 0))
    .optional(),
  color: z.string().optional(),
  alt: z.string().optional(),
  crop: z.boolean().default(false),
  // YouTube-specific
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).optional(),
};

const validateMedia = (
  item: { type: 'image' | 'gif' | 'video' | 'youtube' | 'placeholder'; src?: string; poster?: string; videoId?: string },
  context: z.RefinementCtx,
) => {
  if (item.type === 'youtube') {
    if (!item.videoId) {
      context.addIssue({ code: 'custom', message: 'YouTube media requires a videoId.' });
    }
  } else if (item.type !== 'placeholder' && !item.src) {
    context.addIssue({ code: 'custom', message: 'Image, GIF and video media require a source.' });
  }
  if (item.type !== 'video' && item.type !== 'youtube' && item.poster) {
    context.addIssue({ code: 'custom', message: 'Poster images are only supported for video and YouTube media.' });
  }
};

const media = z.object(mediaFields).superRefine(validateMedia);

const projectSection = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('media'),
    media,
    layout: z.enum(['full', 'half', 'narrow']).default('full'),
    alignment: z.enum(['left', 'right']).default('left'),
    caption: z.string().optional(),
  }),
  z.object({
    type: z.literal('text'),
    heading: z.string().optional(),
    body: z.string(),
    layout: z.enum(['full', 'half', 'narrow']).optional(),
    alignment: z.enum(['left', 'right']).optional(),
  }),
]);

const projects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/projects' }),
  schema: z.object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    title: z.string(),
    discipline: z.enum([
      'animation-motion',
      'illustration',
      'graphic-design',
      'campaigns-events',
      'character-design',
      'art-direction',
      'visual-identity',
      'visual-experiments',
      'mixed',
    ]).optional(),
    projectType: z.enum(['client', 'personal', 'collaboration', 'experiment']).optional(),
    composition: z.enum(['standard', 'single-artwork', 'motion', 'graphic-sequence']).default('standard'),
    presentation: z.enum(['campaign', 'execution', 'editorial', 'artwork', 'sequence']).optional(),
    compositionTest: z.boolean().default(false),
    year: z.number().int().min(2015).max(2030).optional(),
    client: z.string().optional(),
    collection: z.string().optional(),
    workType: z.enum(['client', 'personal', 'uncertain']).optional(),
    archiveOrder: z.number().int().optional(),
    homepageFeatured: z.boolean().default(false),
    homepageOrder: z.number().int().optional(),
    description: z.string().optional(),
    // Internal semantic terms for sharing metadata and structured data. These
    // are never rendered as a public keyword list.
    seoTags: z.array(z.string()).max(12).default([]),
    roles: z.array(z.string()).default([]),
    poster: z.string().optional(),
    thumbnail: media.optional(),
    hero: media.optional(),
    gallery: z.array(z.object({ ...mediaFields, caption: z.string().optional() }).superRefine(validateMedia)).default([]),
    sections: z.array(projectSection).default([]),
    credits: z.array(z.object({
      role: z.string(),
      name: z.string(),
    })).default([]),
    links: z.array(z.object({
      label: z.string(),
      url: z.string(),
    })).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    placeholder: z.boolean().default(false),
    featuredOrder: z.number().optional(),
    mode: z.enum(['commissions', 'personal']).optional(),
    compositionPreferences: z.object({
      layoutHint: z.enum(['single', 'paired', 'editorial', 'gallery', 'hero-gallery']).optional(),
      heroAspect: z.string().optional(),
    }).optional(),
  }),
});

export const collections = { projects };
