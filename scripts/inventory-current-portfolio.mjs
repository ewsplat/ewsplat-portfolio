#!/usr/bin/env node
/**
 * EWSPLAT — Current Portfolio Project Inventory
 *
 * Reads all src/content/projects/*.json and writes a normalised index.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const projectsDir = join(repoRoot, 'src', 'content', 'projects');
const outDir = join(repoRoot, 'codex_handover', 'source_audit');

const DISCIPLINES = [
  'animation-motion',
  'illustration',
  'graphic-design',
  'campaigns-events',
  'character-design',
  'art-direction',
  'visual-identity',
  'visual-experiments',
  'mixed',
];

function getMediaItems(item) {
  const mediaItems = [];
  const collect = (m, context) => {
    if (!m) return;
    mediaItems.push({
      context,
      type: m.type,
      src: m.src,
      poster: m.poster,
      aspect: m.aspect,
      color: m.color,
      alt: m.alt,
      crop: m.crop,
      videoId: m.videoId,
      caption: context === 'gallery' ? (m.caption || undefined) : undefined,
    });
  };
  collect(item.thumbnail, 'thumbnail');
  collect(item.hero, 'hero');
  for (const g of item.gallery || []) collect(g, 'gallery');
  for (const s of item.sections || []) {
    if (s.media) collect(s.media, 'section');
  }
  return mediaItems;
}

function classifyProject(record) {
  const discipline = record.discipline || 'mixed';
  const projectType = record.projectType || record.workType || 'uncertain';
  const workType = record.workType || record.projectType || 'uncertain';
  const presentation = record.presentation || 'editorial';
  const composition = record.composition || 'standard';

  // Context / category mapping heuristics
  let categoryContext = 'personal';
  if (record.projectType === 'client' || record.client) categoryContext = 'commercial-client';
  if (record.projectType === 'collaboration') categoryContext = 'collaboration';
  if (record.projectType === 'experiment') categoryContext = 'experiment';

  const isClient = record.client && record.projectType === 'client';
  const isPersonal = record.projectType === 'personal' || record.workType === 'personal';
  const isCollaboration = record.projectType === 'collaboration';

  const published = !record.draft && !record.compositionTest && !record.placeholder;

  const roles = record.roles || [];
  const credits = record.credits || [];

  const media = getMediaItems(record);

  return {
    slug: record.slug,
    title: record.title,
    client: record.client || null,
    projectType: record.projectType || record.workType || 'uncertain',
    workType: record.workType || record.projectType || 'uncertain',
    discipline,
    collection: record.collection || null,
    composition,
    presentation,
    categoryContext,
    compositionTest: record.compositionTest || false,
    year: record.year || null,
    description: record.description || null,
    roles,
    credits,
    thumbnail: record.thumbnail || null,
    hero: record.hero || null,
    gallery: record.gallery || [],
    sections: record.sections || [],
    mediaItems: media,
    mediaRefs: media.map(m => m.src).filter(Boolean),
    homepageFeatured: record.homepageFeatured || false,
    homepageOrder: record.homepageOrder || null,
    featured: record.featured || false,
    featuredOrder: record.featuredOrder || null,
    draft: record.draft || false,
    placeholder: record.placeholder || false,
    published,
    archiveOrder: record.archiveOrder || null,
    mode: record.mode || null,
    links: record.links || [],
  };
}

function main() {
  const projects = [];
  const entries = readdirSync(projectsDir).filter(f => f.endsWith('.json')).sort();

  for (const f of entries) {
    const fullPath = join(projectsDir, f);
    const content = readFileSync(fullPath, 'utf8');
    try {
      const record = JSON.parse(content);
      projects.push(classifyProject(record));
    } catch (err) {
      console.error(`SKIPPED (parse error): ${f} — ${err.message}`);
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    root: join(projectsDir, '..'),
    totalRecords: projects.length,
    publishedCount: projects.filter(p => p.published).length,
    draftCount: projects.filter(p => !p.published).length,
    projects,
  };

  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'current_portfolio_projects.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote: ${outPath}`);
  console.log(`Projects: ${projects.length}`);
  console.log(`Published: ${output.publishedCount}`);
  console.log(`Draft: ${output.draftCount}`);
}

main();
