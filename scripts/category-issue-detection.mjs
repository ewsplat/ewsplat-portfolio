#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const outDir = join(repoRoot, 'codex_handover', 'source_audit');

const reconciliation = JSON.parse(readFileSync(join(outDir, 'reconciliation.json'), 'utf8'));
const current = JSON.parse(readFileSync(join(outDir, 'current_portfolio_projects.json'), 'utf8'));

const published = current.projects.filter(p => p.published);

// Category/discipline audit based on source-path evidence
const sourceContexts = {
  events: ['events', 'musicfestivals-gigs-events', 'nexgentouring', 'plansafter', 'flux', 'howwebecan', 'club121', 'elsewhere'],
  clothing: ['clothing', 'clothingbrands', 'lower', 'pawa', 'checks downtown', 'iloveugly', 'paramount'],
  coffee: ['coffee', 'flight coffee', 'newground coffee', 'ozone coffee', 'st ali', 'wyld coffee'],
  music: ['music', 'album art', 'matty the friend', 'dj visuals', 'djedenna', 'music videos', 'wet denim'],
  personal: ['personalworks', 'morecontent', 'personalprojects', 'personal', 'illustration', '2d animation', 'illustration design'],
  goodbandit: ['goodbandit', 'patreon', 'digital spaghetti'],
  lesmills: ['lesmills', 'animated type'],
  spinoff: ['spinoff', 'illustrations for spinoff'],
  playitstrange: ['playitstrange'],
  fifa: ['fifa', 'commercial bay'],
  farming: ['digital farming fence', 'nz digital farming fence'],
  mxfm: ['mxfm'],
  newground: ['newground'],
  logoanimation: ['ewsplatlogoanimation'],
};

function inferCategoryFromSource(group) {
  const path = (group.logicalProjectPath + ' ' + group.topLevelContext + ' ' + group.clientContext).toLowerCase();
  for (const [cat, keywords] of Object.entries(sourceContexts)) {
    for (const kw of keywords) {
      if (path.includes(kw)) return cat;
    }
  }
  return null;
}

// Build source evidence for each current project
const sourceEvidence = {};
for (const g of reconciliation.reconciliation) {
  if (g.matchedCurrentSlug) {
    if (!sourceEvidence[g.matchedCurrentSlug]) sourceEvidence[g.matchedCurrentSlug] = [];
    sourceEvidence[g.matchedCurrentSlug].push(g);
  }
}

const categoryIssues = [];
for (const p of published) {
  const evidence = sourceEvidence[p.slug] || [];
  const inferredCategories = [...new Set(evidence.map(g => inferCategoryFromSource(g)).filter(Boolean))];
  const currentDiscipline = p.discipline;
  const currentContext = p.categoryContext;

  let recommendedCategory = null;
  if (inferredCategories.length === 1) {
    recommendedCategory = inferredCategories[0];
  } else if (inferredCategories.length > 1) {
    recommendedCategory = inferredCategories[0]; // primary
  }

  if (recommendedCategory && recommendedCategory !== currentDiscipline) {
    categoryIssues.push({
      slug: p.slug,
      title: p.title,
      client: p.client,
      currentDiscipline,
      currentContext,
      sourceInferredCategories: inferredCategories,
      recommendedCategory,
      evidence: evidence.map(e => e.logicalProjectPath),
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  publishedCount: published.length,
  sourceContexts,
  categoryIssueCount: categoryIssues.length,
  categoryIssues,
  summary: {
    totalPublished: published.length,
    withSourceEvidence: Object.keys(sourceEvidence).length,
    categoryIssues,
  },
};

const outPath = join(outDir, 'category_issues.json');
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`Wrote: ${outPath}`);
console.log(`Published projects: ${published.length}`);
console.log(`With source evidence: ${Object.keys(sourceEvidence).length}`);
console.log(`Category issues: ${categoryIssues.length}`);
for (const issue of categoryIssues) {
  console.log(`  ${issue.title} | current: ${issue.currentDiscipline} | recommended: ${issue.recommendedCategory} | evidence: ${issue.evidence.join(', ')}`);
}