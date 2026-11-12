#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const outDir = join(repoRoot, 'codex_handover', 'source_audit');
const current = JSON.parse(readFileSync(join(outDir, 'current_portfolio_projects.json'), 'utf8'));

const audits = current.projects.filter(p => p.published).map(p => ({
  slug: p.slug,
  title: p.title,
  client: p.client,
  categoryContext: p.categoryContext,
  discipline: p.discipline,
  projectType: p.projectType,
  composition: p.composition,
  presentation: p.presentation,
  year: p.year,
  roles: p.roles,
}));

const byDiscipline = {};
const byCategoryContext = {};

for (const a of audits) {
  byDiscipline[a.discipline] = (byDiscipline[a.discipline] || 0) + 1;
  byCategoryContext[a.categoryContext] = (byCategoryContext[a.categoryContext] || 0) + 1;
}

const report = {
  generatedAt: new Date().toISOString(),
  publishedCount: audits.length,
  byDiscipline,
  byCategoryContext,
};

function main() {
  const outPath = join(outDir, 'category_discipline_audit.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  for (const [k, v] of Object.entries(byDiscipline)) {
    console.log(`Discipline ${k}: ${v}`);
  }
  console.log('---CONTEXTS---');
  for (const [k, v] of Object.entries(byCategoryContext)) {
    console.log(`Context ${k}: ${v}`);
  }
}

main();
