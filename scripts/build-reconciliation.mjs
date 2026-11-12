#!/usr/bin/env node
/**
 * EWSPLAT — Source-to-Portfolio Reconciliation Mapping
 *
 * Groups source media into logical projects and maps them to current portfolio projects.
 */

import { readFileSync } from 'node:fs';
import { join, dirname, basename, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const outDir = join(repoRoot, 'codex_handover', 'source_audit');

function normalise(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(str) {
  return normalise(str).replace(/\s+/g, '-');
}

function loadInventory(label) {
  const path = join(outDir, `${label}_inventory.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadCurrentProjects() {
  const path = join(outDir, 'current_portfolio_projects.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadIdentityAliases() {
  const path = join(outDir, 'project_identity_aliases.json');
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const aliasMap = new Map();
  const sourceLocationsBySlug = new Map();

  for (const a of raw.aliases || []) {
    const key = String(a.sourceIdentity || '');
    const normKey = key.replace(/\//g, '\\').replace(/\\+/g, '\\').replace(/^\\+|\\+$/g, '').trim().toLowerCase();
    aliasMap.set(normKey, a);

    if (a.sourceLocations) {
      for (const loc of a.sourceLocations) {
        const arr = sourceLocationsBySlug.get(a.matchedSlug) || [];
        arr.push(loc);
        sourceLocationsBySlug.set(a.matchedSlug, arr);
      }
    }
  }

  return { aliasMap, sourceLocationsBySlug };
}

function normaliseAliasKey(value) {
  return String(value ?? '')
    .replace(/\//g, '\\')
    .replace(/\\+/g, '\\')
    .replace(/^\\+|\\+$/g, '')
    .trim()
    .toLowerCase();
}

// Leaf/delivery folders that should NOT define a logical project
const LEAF_FOLDERS = new Set([
  'exports', 'export', 'final', 'finals', 'final-export', 'assets', 'media', 'images', 'image',
  'video', 'videos', 'motion', 'animation', 'renders', 'render', 'stills', 'social', 'socials',
  'web', 'website', 'deliverables', 'output', 'outputs', 'source', 'sourcefiles', 'footage',
  'apng', 'carousel-post', 'wip', 'unused', 'concepts', 'concept', 'ideas', 'test', 'tests',
  'tmp', 'temp', 'proof', 'review', 'client', 'clientwork', 'scratch', 'working', 'original',
  'raw', 'final_deliverables', 'final_export', 'social_media', 'for_web',
]);

// Broad personal-work collection folders where filename-based splitting should occur
const COLLECTION_FOLDERS = new Set([
  'personalprojects', 'personal-works', 'personalworks', 'illustration', '2d_animation',
  'illustration_design', 'personal', 'misc', 'various',
]);

function isLeafFolder(name) {
  const norm = normalise(name);
  if (LEAF_FOLDERS.has(norm)) return true;
  // media file names (contain a dot with image/video extension)
  const ext = extname(name).toLowerCase();
  if (['.jpg','.jpeg','.png','.webp','.gif','.mp4','.mov','.webm','.avi','.m4v','.svg','.tif','.tiff'].includes(ext)) return true;
  return false;
}

function isCollectionFolder(name) {
  return COLLECTION_FOLDERS.has(normalise(name));
}

function deriveLogicalProjectPath(fullRelativePath) {
  const parts = fullRelativePath.split('\\').filter(Boolean);
  if (parts.length === 0) return '';

  // Strip filename (last part with extension)
  const lastPart = parts[parts.length - 1];
  const ext = extname(lastPart).toLowerCase();
  const isFile = ['.jpg','.jpeg','.png','.webp','.gif','.mp4','.mov','.webm','.avi','.m4v','.svg','.tif','.tiff'].includes(ext);
  const dirParts = isFile ? parts.slice(0, -1) : parts;
  if (dirParts.length === 0) return '';

  // Walk up from deepest directory, skipping consecutive leaf folders
  let i = dirParts.length - 1;
  while (i >= 0 && isLeafFolder(dirParts[i])) i--;

  // Build the context path
  let contextParts = dirParts.slice(0, i + 1);

  // Special handling: if we ended up at a broad collection folder, we'll fall back to filename-based grouping later
  if (contextParts.length > 0 && isCollectionFolder(contextParts[contextParts.length - 1])) {
    // Don't use the collection folder as the project; caller should handle splitting
    return contextParts.join('\\');
  }

  return contextParts.join('\\');
}

function deriveTopLevelContext(fullRelativePath) {
  const parts = fullRelativePath.split('\\').filter(Boolean);
  return parts.length > 0 ? parts[0] : '';
}

function deriveClientContext(fullRelativePath) {
  const parts = fullRelativePath.split('\\').filter(Boolean);
  // Second level often holds client/context
  return parts.length > 1 ? parts[1] : '';
}

function deriveProbableProjectTitle(logicalProjectPath, mediaFilename) {
  const parts = logicalProjectPath.split('\\').filter(Boolean);
  if (parts.length > 0) {
    return parts[parts.length - 1]
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }
  // Fallback to filename without extension
  const name = basename(mediaFilename, extname(mediaFilename));
  return name
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function buildLogicalProjectGroups(inventory, currentProjects) {
  const groups = new Map();
  const collectionFiles = new Map(); // collectionPath -> Map<filenameWithoutExt, mediaFiles[]>

  for (const mediaFile of inventory.mediaFiles) {
    const mediaRel = mediaFile.relativePath;
    const topLevel = deriveTopLevelContext(mediaRel);
    const logicalPath = deriveLogicalProjectPath(mediaRel);
    const clientCtx = deriveClientContext(mediaRel);

    // Check if this falls under a collection folder that should split by filename
    const dirParts = mediaRel.split('\\').filter(Boolean).slice(0, -1); // dirs only
    const inCollection = dirParts.some(p => isCollectionFolder(p));

    if (inCollection) {
      // Group by filename (without extension) within the collection
      const filenameNoExt = basename(mediaFile.filename, extname(mediaFile.filename));
      const key = `${inventory.rootLabel}|${logicalPath}|${filenameNoExt}`;

      if (!collectionFiles.has(key)) {
        collectionFiles.set(key, {
          sourceRoot: inventory.rootLabel,
          rootPath: inventory.rootPath,
          logicalProjectPath: logicalPath,
          topLevelContext: topLevel,
          clientContext: clientCtx,
          likelyProjectTitle: deriveProbableProjectTitle(logicalPath, mediaFile.filename),
          mediaFiles: [],
          mediaCount: 0,
        });
      }
      const entry = collectionFiles.get(key);
      entry.mediaFiles.push({
        relativePath: mediaRel,
        filename: mediaFile.filename,
        extension: mediaFile.extension,
        sizeBytes: mediaFile.sizeBytes,
        fullPath: mediaFile.absolutePath,
      });
      entry.mediaCount++;
    } else {
      // Normal directory-based grouping
      const key = `${inventory.rootLabel}|${logicalPath}`;
      if (!groups.has(key)) {
        groups.set(key, {
          sourceRoot: inventory.rootLabel,
          rootPath: inventory.rootPath,
          logicalProjectPath: logicalPath,
          fullDirectoryChain: mediaFile.fullDirectoryChain,
          topLevelContext: topLevel,
          clientContext: clientCtx,
          likelyProjectTitle: deriveProbableProjectTitle(logicalPath, mediaFile.filename),
          mediaFiles: [],
          mediaCount: 0,
        });
      }
      const group = groups.get(key);
      group.mediaFiles.push({
        relativePath: mediaRel,
        filename: mediaFile.filename,
        extension: mediaFile.extension,
        sizeBytes: mediaFile.sizeBytes,
        fullPath: mediaFile.absolutePath,
      });
      group.mediaCount++;
    }
  }

  // Merge collection files into groups
  for (const [key, entry] of collectionFiles) {
    groups.set(key, entry);
  }

  return Array.from(groups.values());
}

function matchLogicalGroupToProject(group, currentProjects) {
  const candidates = [];

  const titleNorm = normalise(group.likelyProjectTitle);
  const pathNorm = normalise(group.logicalProjectPath);
  const clientNorm = normalise(group.clientContext);
  const topNorm = normalise(group.topLevelContext);

  for (const proj of currentProjects) {
    const projTitleNorm = normalise(proj.title);
    const projSlugNorm = normalise(proj.slug || '');
    const projClientNorm = normalise(proj.client || '');

    let score = 0;
    let matchBasis = [];

    // Direct title match
    if (titleNorm === projTitleNorm) {
      score += 10;
      matchBasis.push('exact-title');
    } else if (projTitleNorm.includes(titleNorm) || titleNorm.includes(projTitleNorm)) {
      score += 6;
      matchBasis.push('partial-title');
    } else if (slugify(proj.title) === slugify(group.likelyProjectTitle)) {
      score += 5;
      matchBasis.push('slug-title');
    }

    // Client match
    if (clientNorm && projClientNorm && clientNorm === projClientNorm) {
      score += 4;
      matchBasis.push('client');
    } else if (clientNorm && projClientNorm && (projClientNorm.includes(clientNorm) || clientNorm.includes(projClientNorm))) {
      score += 2;
      matchBasis.push('partial-client');
    }

    // Top-level context match
    if (topNorm === 'events' && proj.discipline === 'animation-motion') {
      score += 1;
      matchBasis.push('context-events');
    }
    if (topNorm === 'musicfestivals-gigs-events' && proj.discipline === 'animation-motion') {
      score += 1;
      matchBasis.push('context-music-events');
    }
    if (topNorm === 'clothing' || topNorm === 'clothingbrands') {
      score += 1;
      matchBasis.push('context-clothing');
    }
    if (topNorm === 'coffee') {
      score += 1;
      matchBasis.push('context-coffee');
    }
    if (topNorm === 'personalworks') {
      score += 1;
      matchBasis.push('context-personal');
    }
    if (topNorm === 'goodbandit_agency' || topNorm === 'goodbandit-agency') {
      score += 1;
      matchBasis.push('context-goodbandit');
    }
    if (topNorm === 'lesmills_gym') {
      score += 1;
      matchBasis.push('context-lesmills');
    }
    if (topNorm === 'spinoff_nz') {
      score += 1;
      matchBasis.push('context-spinoff');
    }
    if (topNorm === 'playitstrange_nonprofit' || topNorm === 'playitstrange') {
      score += 1;
      matchBasis.push('context-playitstrange');
    }
    if (topNorm === 'morecontent') {
      score += 1;
      matchBasis.push('context-morecontent');
    }

    // Media filename match
    for (const mf of group.mediaFiles) {
      const mfNorm = normalise(mf.filename.replace(extname(mf.filename), ''));
      if (mfNorm === projTitleNorm || mfNorm === projSlugNorm) {
        score += 3;
        matchBasis.push('media-title');
        break;
      }
    }

    // Directory path contains slug
    if (group.logicalProjectPath && projSlugNorm) {
      const pathNorm2 = slugify(group.logicalProjectPath);
      if (pathNorm2.includes(projSlugNorm) || projSlugNorm.includes(pathNorm2)) {
        score += 2;
        matchBasis.push('path-slug');
      }
    }

    if (score > 0) {
      candidates.push({ project: proj, score, matchBasis });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 3);
}

function determineConfidence(bestCandidate, allCandidates, group) {
  if (!bestCandidate) return 'LOW';

  const score = bestCandidate.score;
  const runnerUp = allCandidates[1] ? allCandidates[1].score : 0;

  if (score >= 8 && score > runnerUp * 2) return 'HIGH';
  if (score >= 5 && score > runnerUp + 2) return 'MEDIUM';
  return 'LOW';
}

function determineStatus(confidence, matchedSlug) {
  if (!matchedSlug) {
    if (confidence === 'HIGH') return 'genuinely-missing';
    if (confidence === 'MEDIUM') return 'possible-missing';
    return 'possible-missing';
  }
  if (confidence === 'HIGH') return 'mapped-existing';
  if (confidence === 'MEDIUM') return 'probable-existing';
  return 'ambiguous';
}

function classifySourceVariant(group) {
  const path = group.logicalProjectPath || '';

  if (/^Music\\AlbumArt\\MattyTheFriend\\Album art-0[12]$/i.test(path)) {
    return {
      isVariant: true,
      variantOfSlug: 'matty-searching',
      variantNote: 'Album artwork version/deliverable within Matty the Friend — Searching source project.',
    };
  }

  if (/^Goodbandit-Agency\\Patreon\\DigitalSpagetti\\SocialMediaPostContent-Design$/i.test(path)) {
    return {
      isVariant: true,
      variantOfSlug: 'digital-spagetti',
      variantNote: 'Social-media design deliverable within Digital Spagetti project.',
    };
  }

  if (/^MusicFestivals-Gigs-Events\\HowWeCanBe\\HWCB-AKL-WELLY-EVENT\\RobotfaceAssets-Looping animated faces$/i.test(path)) {
    return {
      isVariant: true,
      variantOfSlug: 'how-we-can-be-event-visuals',
      variantNote: 'Looping animated face assets within the How We Can Be event visuals project.',
    };
  }

  if (/^Events\\Elsewhere_Festival_AKL\\WIP_UnusedConcepts_$/i.test(path)) {
    return {
      isVariant: true,
      variantOfSlug: 'elsewhere-festival-auckland',
      variantNote: 'excluded-source-material: WIP / unused concepts; do not treat as missing portfolio content.',
    };
  }

  if (/^Events\\CommericalBay_x_EwSplat_HappyPlants\\carousel-post$/i.test(path)) {
    return {
      isVariant: true,
      variantOfSlug: 'commercial-bay-happy-plants',
      variantNote: 'Carousel/social deliverable within Commercial Bay Happy Plants project.',
    };
  }

  return { isVariant: false };
}

function compareMediaIdentity(sourceFile, destMedia) {
  // Compare by normalized basename without extension
  const srcName = normalise(basename(sourceFile.relativePath, extname(sourceFile.relativePath)));
  for (const dm of destMedia) {
    if (!dm.src) continue;
    const destName = normalise(basename(dm.src, extname(dm.src)));
    if (srcName === destName) return true;
    // Also check if one contains the other (e.g., "Cheers" vs "Cheers_web")
    if (srcName.length > 3 && (destName.includes(srcName) || srcName.includes(destName))) return true;
  }
  return false;
}

function main() {
  const toup = loadInventory('C__Users_Nic_Documents_TOUPLOADFORPORTFOLIO');
  const dport = loadInventory('D__Portfolio');
  const current = loadCurrentProjects();
  const { aliasMap } = loadIdentityAliases();

  const toupGroups = buildLogicalProjectGroups(toup, current.projects);
  const dportGroups = buildLogicalProjectGroups(dport, current.projects);

  // Combine groups from both roots
  const allGroups = [...toupGroups, ...dportGroups];

  // Build map of current projects by slug for quick lookup
  const currentBySlug = new Map(current.projects.map(p => [p.slug, p]));

  const reconciliation = [];

  for (const group of allGroups) {
    const candidates = matchLogicalGroupToProject(group, current.projects);
    let best = candidates[0];
    let matchedSlug = best ? best.project.slug : null;
    let confidence = determineConfidence(best, candidates, group);
    let status = determineStatus(confidence, matchedSlug);

    let variantOfSlug = null;
    let variantNote = null;
    let aliasSetVariant = false;

    // Second-pass identity resolution: check explicit alias layer first
    const logicalKey = normaliseAliasKey(group.logicalProjectPath);
    const aliasHit = aliasMap.get(logicalKey) || aliasMap.get(normaliseAliasKey(group.likelyProjectTitle));
    if (aliasHit) {
      if (aliasHit.matchedSlug) matchedSlug = aliasHit.matchedSlug;
      if (aliasHit.confidence) confidence = aliasHit.confidence;
      if (aliasHit.status) status = aliasHit.status;
      if (aliasHit.status === 'source-variant') {
        aliasSetVariant = true;
        variantOfSlug = aliasHit.matchedSlug || null;
        variantNote = aliasHit.reason || 'Source variant identified by alias layer.';
      }
    }

    // Explicit source-variant rule (do not override alias-defined source-variant)
    if (!aliasSetVariant) {
      const variant = classifySourceVariant(group);
      if (variant.isVariant) {
        status = 'source-variant';
        confidence = confidence || 'MEDIUM';
        variantOfSlug = variant.variantOfSlug;
        variantNote = variant.variantNote;
        matchedSlug = variant.variantOfSlug;
      }
    }

    // Collection folder detection: broad containers like PersonalWorks, PersonalWorks\Illustration, MOREContent\PersonalProjects
    const dirParts = group.logicalProjectPath.split('\\').filter(Boolean);
    const isCollection = dirParts.length > 0 && (dirParts.length === 1 || (dirParts.length === 2 && isCollectionFolder(dirParts[1]))) ||
      ['MOREContent\\PersonalProjects', 'PersonalWorks', 'Music\\MusicVideos', 'Events\\CLUB121'].some(c => group.logicalProjectPath === c);
    if (isCollection && !matchedSlug && status !== 'source-variant') {
      status = 'collection-folder';
      confidence = 'LOW';
    }

    const matchedProject = matchedSlug ? currentBySlug.get(matchedSlug) : null;

    // Count represented source files by comparing identities
    let representedCount = 0;
    if (matchedProject) {
      for (const mf of group.mediaFiles) {
        if (compareMediaIdentity(mf, matchedProject.mediaItems)) {
          representedCount++;
        }
      }
    }

    const sourceMediaCount = group.mediaCount;
    const candidateMissingMediaCount = Math.max(0, sourceMediaCount - representedCount);

    reconciliation.push({
      sourceRoot: group.sourceRoot,
      rootPath: group.rootPath,
      logicalProjectPath: group.logicalProjectPath,
      topLevelContext: group.topLevelContext,
      clientContext: group.clientContext,
      likelyProjectTitle: group.likelyProjectTitle,
      matchedCurrentSlug: matchedSlug,
      matchedProjectTitle: matchedProject ? matchedProject.title : null,
      confidence,
      status,
      variantOfSlug: variantOfSlug || undefined,
      variantNote: variantNote || undefined,
      matchScore: best ? best.score : 0,
      matchBasis: best ? best.matchBasis : [],
      sourceMediaCount,
      representedSourceMediaCount: representedCount,
      candidateMissingMediaCount,
      sourceMediaFiles: group.mediaFiles.map(mf => ({
        relativePath: mf.relativePath,
        filename: mf.filename,
        extension: mf.extension,
        sizeBytes: mf.sizeBytes,
      })),
    });
  }

  // Sort by status then title
  const statusOrder = { 'mapped-existing': 0, 'probable-existing': 1, 'genuinely-missing': 2, 'possible-missing': 3, 'source-variant': 4, 'collection-folder': 5, 'ambiguous': 6 };
  reconciliation.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.likelyProjectTitle.localeCompare(b.likelyProjectTitle));

  // Summary counts
  const summary = {
    totalLogicalProjects: reconciliation.length,
    byStatus: {},
    byConfidence: {},
    mappedExisting: reconciliation.filter(r => r.status === 'mapped-existing'),
    probableExisting: reconciliation.filter(r => r.status === 'probable-existing'),
    genuinelyMissing: reconciliation.filter(r => r.status === 'genuinely-missing'),
    possibleMissing: reconciliation.filter(r => r.status === 'possible-missing'),
    sourceVariants: reconciliation.filter(r => r.status === 'source-variant'),
    collectionFolders: reconciliation.filter(r => r.status === 'collection-folder'),
    ambiguous: reconciliation.filter(r => r.status === 'ambiguous'),
  };

  for (const r of reconciliation) {
    summary.byStatus[r.status] = (summary.byStatus[r.status] || 0) + 1;
    summary.byConfidence[r.confidence] = (summary.byConfidence[r.confidence] || 0) + 1;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    sourceRoots: {
      TOUPLOADFORPORTFOLIO: {
        totalDirectories: toup.directoriesTraversed,
        totalFiles: toup.totalFilesTraversed,
        relevantMediaFiles: toup.relevantMediaFiles,
        topLevelDirectories: [...new Set(toup.mediaFiles.map(m => m.fullDirectoryChain[0]).filter(Boolean))].sort(),
      },
      D_Portfolio: {
        totalDirectories: dport.directoriesTraversed,
        totalFiles: dport.totalFilesTraversed,
        relevantMediaFiles: dport.relevantMediaFiles,
        topLevelDirectories: [...new Set(dport.mediaFiles.map(m => m.fullDirectoryChain[0]).filter(Boolean))].sort(),
      },
    },
    currentPortfolio: {
      totalRecords: current.totalRecords,
      publishedCount: current.publishedCount,
      draftCount: current.draftCount,
    },
    summary,
    reconciliation,
  };

  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'reconciliation.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote: ${outPath}`);
  console.log(`Logical source projects: ${reconciliation.length}`);
  console.log(`By status:`, JSON.stringify(summary.byStatus));
  console.log(`By confidence:`, JSON.stringify(summary.byConfidence));
  console.log(`Mapped existing: ${summary.mappedExisting?.length ?? 0}`);
  console.log(`Probable existing: ${summary.probableExisting?.length ?? 0}`);
  console.log(`Genuinely missing: ${summary.genuinelyMissing?.length ?? 0}`);
  console.log(`Possible missing: ${summary.possibleMissing?.length ?? 0}`);
  console.log(`Source variants: ${summary.sourceVariants?.length ?? 0}`);
  console.log(`Collection folders: ${summary.collectionFolders?.length ?? 0}`);
  console.log(`Ambiguous: ${summary.ambiguous.length}`);
}

main();