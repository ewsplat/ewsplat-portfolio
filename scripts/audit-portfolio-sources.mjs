#!/usr/bin/env node
/**
 * EWSPLAT — Recursive Source Portfolio Inventory
 *
 * Walks both source roots and produces deterministic JSON inventories.
 * Captures full directory hierarchy for every media file.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const SOURCE_ROOTS = [
  'C:\\Users\\Nic\\Documents\\TOUPLOADFORPORTFOLIO',
  'D:\\Portfolio',
];

const MEDIA_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.mp4', '.mov', '.webm', '.avi', '.m4v',
  '.svg', '.tif', '.tiff',
]);

const JUNK_PATTERNS = [
  '.DS_Store', 'Thumbs.db', '.lock', '.cache',
  'desktop.ini', 'Icon\r',
];

function isJunk(filename) {
  const lower = filename.toLowerCase();
  for (const p of JUNK_PATTERNS) {
    if (lower.includes(p.toLowerCase())) return true;
  }
  if (filename.startsWith('~$')) return true;
  if (filename.startsWith('._')) return true;
  return false;
}

function isMediaFile(filename) {
  const ext = extname(filename).toLowerCase();
  return MEDIA_EXTS.has(ext);
}

function walkDir(dirPath, rootLabel, rootPath) {
  const directories = [];
  const files = [];
  let dirCount = 0;
  let fileCount = 0;

  function walk(currentPath, depth) {
    let entries;
    try {
      entries = readdirSorted(currentPath);
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);
      const rel = relative(rootPath, fullPath);

      if (entry.isDirectory()) {
        dirCount++;
        directories.push({
          absolutePath: fullPath,
          relativePath: rel,
          name: entry.name,
        });
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        fileCount++;
        const ext = extname(entry.name).toLowerCase();
        const isMedia = isMediaFile(entry.name);

        const fileRecord = {
          absolutePath: fullPath,
          relativePath: rel,
          filename: entry.name,
          extension: ext,
          sizeBytes: entry.size,
          parentDirectory: dirname(rel),
          fullDirectoryChain: dirname(rel).split('\\').filter(Boolean),
          mediaType: isMedia ? 'media' : 'other',
          isRelevantMedia: isMedia && !isJunk(entry.name),
        };

        if (isMedia && !isJunk(entry.name)) {
          files.push(fileRecord);
        }
      }
    }
  }

  try {
    walk(rootPath, 0);
  } catch (err) {
    console.error(`Walk error for ${rootPath}: ${err.message}`);
  }

  return {
    rootLabel,
    rootPath,
    exists: existsSync(rootPath),
    directoriesTraversed: dirCount,
    totalFilesTraversed: fileCount,
    relevantMediaFiles: files.length,
    directories,
    mediaFiles: files,
  };
}

function readdirSorted(dirPath) {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    return [];
  }
}

function getTopLevelDirs(inventory) {
  const tops = new Set();
  for (const d of inventory.directories) {
    const parts = d.relativePath.split('\\').filter(Boolean);
    if (parts.length >= 1) tops.add(parts[0]);
  }
  return Array.from(tops).sort();
}

function countByExtension(inventory) {
  const counts = {};
  for (const f of inventory.mediaFiles) {
    counts[f.extension] = (counts[f.extension] || 0) + 1;
  }
  return counts;
}

async function main() {
  const outDir = join(repoRoot, 'codex_handover', 'source_audit');
  mkdirSync(outDir, { recursive: true });

  const inventories = {};
  const summaries = {};

  for (const rootPath of SOURCE_ROOTS) {
    const rootLabel = rootPath.replace(/[:\\]/g, '_');
    console.log(`\nWalking: ${rootPath}`);

    if (!existsSync(rootPath)) {
      console.log(`  ROOT DOES NOT EXIST — skipping`);
      inventories[rootLabel] = { rootLabel, rootPath, exists: false, directoriesTraversed: 0, totalFilesTraversed: 0, relevantMediaFiles: 0, directories: [], mediaFiles: [] };
      summaries[rootLabel] = {
        rootLabel,
        rootPath,
        exists: false,
        directoriesTraversed: 0,
        totalFilesTraversed: 0,
        relevantMediaFiles: 0,
        topLevelDirectories: [],
        mediaExtensionCounts: {},
      };
      continue;
    }

    const inv = walkDir(rootPath, rootLabel, rootPath);
    inventories[rootLabel] = inv;

    const summary = {
      rootLabel,
      rootPath,
      exists: true,
      directoriesTraversed: inv.directoriesTraversed,
      totalFilesTraversed: inv.totalFilesTraversed,
      relevantMediaFiles: inv.relevantMediaFiles,
      topLevelDirectories: getTopLevelDirs(inv),
      mediaExtensionCounts: countByExtension(inv),
    };
    summaries[rootLabel] = summary;

    console.log(`  Directories: ${inv.directoriesTraversed}`);
    console.log(`  Files traversed: ${inv.totalFilesTraversed}`);
    console.log(`  Relevant media files: ${inv.relevantMediaFiles}`);
    console.log(`  Top-level dirs: ${summary.topLevelDirectories.length}`);
    console.log(`  Extensions: ${JSON.stringify(summary.mediaExtensionCounts)}`);
  }

  // Write inventories
  for (const [label, inv] of Object.entries(inventories)) {
    const outPath = join(outDir, `${label}_inventory.json`);
    writeFileSync(outPath, JSON.stringify(inv, null, 2));
    console.log(`\nWrote: ${outPath}`);
  }

  // Write summary
  const summaryPath = join(outDir, 'source_inventory_summary.json');
  writeFileSync(summaryPath, JSON.stringify(summaries, null, 2));
  console.log(`\nWrote: ${summaryPath}`);

  console.log('\n=== SOURCE AUDIT COMPLETE ===');
  for (const [label, s] of Object.entries(summaries)) {
    console.log(`\n${label} (${s.rootPath}):`);
    console.log(`  exists: ${s.exists}`);
    console.log(`  directories: ${s.directoriesTraversed}`);
    console.log(`  files: ${s.totalFilesTraversed}`);
    console.log(`  media: ${s.relevantMediaFiles}`);
    console.log(`  top-level: ${s.topLevelDirectories.join(', ')}`);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});