#!/usr/bin/env node
/**
 * EWSPLAT safe publish workflow.
 *
 * Usage:
 *   npm run publish -- "Update description"
 *
 * Sequence:
 *   1. Validate deployment (deploy:validate)
 *   2. Build staged production site (deploy:build)
 *   3. Sync changed R2 external media (deploy:media)
 *   4. Selective git staging of approved files only
 *   5. Commit with the provided message
 *   6. Push main to origin
 *
 * The script never stages the entire repository. It uses an explicit allowlist.
 * Unknown untracked files cause a SAFE FAILURE.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const commitMessage = process.argv.slice(2).join(' ').trim() || 'Update EWSPLAT portfolio';

// Approved allowlist: relative paths that may be staged.
// Any file outside this list is rejected.
const ALLOWED_PREFIXES = [
  'src/',
  '.github/',
  'package.json',
  'package-lock.json',
  'DEPLOY.md',
];

// Explicitly forbidden patterns (defense in depth).
const FORBIDDEN_PATTERNS = [
  '.env',
  'credentials',
  'secrets',
  'node_modules',
  '.deploy-public',
  'dist/',
  '.astro/',
  'public/media/portfolio/club121/',
  'public/media/ClothingBrands/',
  'public/media/Clothing/',
  'public/media/Events/',
  'public/media/LesMills_Gym/',
  'public/media/Music/',
  'public/media/MusicFestivals-Gigs-Events/',
  'public/media/PersonalWorks/',
  'public/media/PlayItStrange_NonProfit/',
  'public/media/Spinoff_NZ/',
  'public/media/club121/',
  'public/media/coffee/',
  'public/media/portfolio/web/',
  'public/media/portfolio/youtube-posters/',
  'public/media/portfolio/flight-coffee.mp4',
  'public/media/portfolio/killjoy-nz-promo.mp4',
  'public/media/portfolio/newground-all-products.mp4',
  'public/media/portfolio/ozone-coffee.mp4',
  'public/media/portfolio/paramount-skateboards.mp4',
  'public/media/portfolio/plans-after-normataps.mp4',
  'public/media/portfolio/st-ali-coffee.mp4',
  'public/media/portfolio/wyld-coffee-post.mp4',
  'public/media/portfolio/wyld-coffee-post2.mp4',
  'validate-output.txt',
  '.seo-qa-dist-20261112/',
  'EWSPLAT_KILO_CONTEXT_README.txt',
  'EWSPLAT_STAGE5_DESIGN_DIRECTION.md',
  'PORTFOLIO-COMPLETION.md',
  'archive-header.txt',
  'deepstate-rain-page.png',
  'portal_verify.png',
];

const run = (cmd, args, env = {}) => {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }
};

const isAllowed = (file) => {
  const normalized = file.replace(/\\/g, '/');
  if (FORBIDDEN_PATTERNS.some((pattern) => normalized.includes(pattern))) return false;
  return ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

// Step 1: validate
console.log('--- Step 1: validate ---');
run('npm', ['run', 'deploy:validate']);

// Step 2: build
console.log('--- Step 2: build ---');
run('npm', ['run', 'deploy:build']);

// Step 3: sync R2 media (dry run if not configured)
console.log('--- Step 3: R2 media sync ---');
run('npm', ['run', 'deploy:media']);

// Step 4: selective staging
console.log('--- Step 4: selective git staging ---');
const status = spawnSync('git', ['status', '--short', '--porcelain'], { cwd: root, encoding: 'utf8' });
if (status.status !== 0) {
  console.error('git status failed');
  process.exit(status.status ?? 1);
}
const lines = status.stdout.split('\n').filter((line) => line.trim().length > 0);
const staged = [];
const rejected = [];
for (const line of lines) {
  const match = line.match(/^([ MADRC?U])([ MADRC?U]?)\s+(.+)$/);
  if (!match) continue;
  const file = match[3].trim();
  if (file.startsWith('"') && file.endsWith('"')) {
    // File path was quoted because of special characters.
    continue;
  }
  if (isAllowed(file)) {
    staged.push(file);
  } else {
    rejected.push(file);
  }
}
if (rejected.length > 0) {
  console.error('SAFE FAILURE: unknown/untracked files detected that are not in the approved allowlist:');
  for (const file of rejected) console.error(`  - ${file}`);
  console.error('Refusing to stage the entire repository. Review the allowlist in scripts/publish.mjs.');
  process.exit(1);
}
if (staged.length === 0) {
  console.log('No approved files to stage.');
  process.exit(0);
}
for (const file of staged) {
  spawnSync('git', ['add', '--', file], { cwd: root, stdio: 'inherit' });
}
console.log(`Staged ${staged.length} approved file(s).`);

// Step 5: commit
console.log('--- Step 5: commit ---');
const commitResult = spawnSync('git', ['commit', '-m', commitMessage], { cwd: root, stdio: 'inherit' });
if (commitResult.status !== 0) {
  console.error('Commit failed.');
  process.exit(commitResult.status ?? 1);
}

// Step 6: push
console.log('--- Step 6: push ---');
const pushResult = spawnSync('git', ['push', 'origin', 'main'], { cwd: root, stdio: 'inherit' });
if (pushResult.status !== 0) {
  console.error('Push failed.');
  process.exit(pushResult.status ?? 1);
}

console.log('Publish complete. GitHub Actions will deploy automatically.');