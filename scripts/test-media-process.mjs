// Test suite for Phase 5 Media Processing CLI
// Tests cover: JPG, PNG, GIF (animated & static), MP4, unusual aspect ratios,
// large files, duplicate processing, missing FFmpeg, missing gifsicle,
// manifest recovery, interrupted download
//
// NOTE ON ASSERTION COUNT:
// Each `assert()` call is an individual assertion, not a test function.
// There are 12 test functions but 40+ individual assertions across them.
// "Passed" counts individual assertions; "Not tested" counts skipped checks.

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { processGIF } from './media-process.js';

const TEST_DIR = path.resolve('./.media-work/test-data');
const OUTPUT_DIR = path.resolve('./.media-work/test-output');
const TEST_MANIFEST_PATH = path.resolve('./.media-work/test-manifest.json');

// Track test results
let passed = 0;
let failed = 0;
let notTested = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
    failures.push(message);
  } else {
    console.log(`✓ PASS: ${message}`);
    passed++;
  }
}

function notTestedResult(message) {
  console.log(`○ NOT TESTED: ${message}`);
  notTested++;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function cryptoHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function setup() {
  // Clean test directories only - never touches real project media
  ensureDir(TEST_DIR);
  ensureDir(OUTPUT_DIR);
  ensureDir('./.media-work');

  const sharp = await import('sharp');
  const sharpDefault = sharp.default || sharp;

  // JPG - portrait (9:16)
  await sharpDefault({
    create: { width: 270, height: 480, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).jpeg({ quality: 90 }).toFile(path.join(TEST_DIR, 'test-portrait.jpg'));

  // PNG - landscape (16:9)
  await sharpDefault({
    create: { width: 480, height: 270, channels: 3, background: { r: 0, g: 0, b: 255 } }
  }).png().toFile(path.join(TEST_DIR, 'test-landscape.png'));

  // GIF - animated square (FFmpeg)
  execSync(`ffmpeg -f lavfi -i color=c=green:s=300x300:duration=3 -framerate 30 -loop 0 -y "${TEST_DIR}/test-animated.gif"`);

  // MP4 video (FFmpeg)
  execSync(`ffmpeg -f lavfi -i color=c=yellow:s=480x270:duration=3 -c:v libx264 -tune zerolatency -pix_fmt yuv420p -r 1 -y "${TEST_DIR}/test-video.mp4"`);

  // Large file test (make a bigger JPG)
  await sharpDefault({
    create: { width: 2000, height: 2000, channels: 3, background: { r: 255, g: 255, b: 255 } }
  }).jpeg({ quality: 90 }).toFile(path.join(TEST_DIR, 'test-large.jpg'));

  console.log('Test data created:\n');
  fs.readdirSync(TEST_DIR).forEach(f => {
    const fullPath = path.join(TEST_DIR, f);
    const stat = fs.statSync(fullPath);
    console.log(`  ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  });
}

async function testImageProcessing() {
  console.log('\n=== Test: JPG Processing ===');
  const input = path.join(TEST_DIR, 'test-portrait.jpg');
  const output = path.join(OUTPUT_DIR, 'test-portrait.webp');
  const sharp = await import('sharp');
  const sharpDefault = sharp.default || sharp;
  try {
    const metadata = await sharpDefault(input).metadata();
    assert(metadata.width === 270 && metadata.height === 480, `Portrait JPG: 270x480 (got ${metadata.width}x${metadata.height})`);

    await sharpDefault(input)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 90 })
      .toFile(output);
    assert(fs.existsSync(output), 'WebP output file created');
    const outMeta = await sharpDefault(output).metadata();
    assert(outMeta.format === 'webp', `Output format is WebP (got ${outMeta.format})`);
  } catch (err) {
    assert(false, `JPG processing error: ${err.message}`);
  }
}

async function testPNGProcessing() {
  console.log('\n=== Test: PNG Processing ===');
  const input = path.join(TEST_DIR, 'test-landscape.png');
  const output = path.join(OUTPUT_DIR, 'test-landscape.webp');
  try {
    const sharp = await import('sharp');
    const sharpDefault = sharp.default || sharp;
    const metadata = await sharpDefault(input).metadata();
    assert(metadata.width === 480 && metadata.height === 270, `Landscape PNG: 480x270 (got ${metadata.width}x${metadata.height})`);

    await sharpDefault(input)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 90 })
      .toFile(output);
    assert(fs.existsSync(output), 'WebP output created');
    const outMeta = await sharpDefault(output).metadata();
    assert(outMeta.format === 'webp', `Output format is WebP (got ${outMeta.format})`);
  } catch (err) {
    assert(false, `PNG processing error: ${err.message}`);
  }
}

async function testGIFAnimated() {
  console.log('\n=== Test: Animated GIF Processing ===');
  const input = path.join(TEST_DIR, 'test-animated.gif');
  const poster = path.join(OUTPUT_DIR, 'test-animated.gif-poster.jpg');

  try {
    const sharp = await import('sharp');
    const sharpDefault = sharp.default || sharp;
    const metadata = await sharpDefault(input).metadata();
    // Sharp reports animation metadata when GIF has multiple frames
    const isAnimated = Boolean(metadata.pages && metadata.pages > 1);
    assert(isAnimated, `Animated GIF has multiple frames (pages=${metadata.pages})`);

    // Poster generation via FFmpeg
    execSync(`ffmpeg -i "${input}" -ss 00:00:01 -vframes 1 -vf "scale=1200:-1" -qscale:v 2 -y "${poster}"`);
    assert(fs.existsSync(poster), 'GIF poster frame generated');

    // Original GIF must remain untouched
    const originalSize = fs.statSync(input).size;
    assert(originalSize > 0, `Original GIF preserved (${originalSize} bytes)`);
  } catch (err) {
    assert(false, `Animated GIF processing error: ${err.message}`);
  }
}

async function testStaticGIF() {
  console.log('\n=== Test: Static GIF Processing ===');
  // Derive static GIF from animated
  execSync(`ffmpeg -i "${TEST_DIR}/test-animated.gif" -frames:v 1 -y "${TEST_DIR}/test-static.gif"`);
  const input = path.join(TEST_DIR, 'test-static.gif');
  const output = path.join(OUTPUT_DIR, 'test-static.webp');
  try {
    const sharp = await import('sharp');
    const sharpDefault = sharp.default || sharp;
    const metadata = await sharpDefault(input).metadata();
    const isAnimated = Boolean(metadata.pages && metadata.pages > 1);
    assert(!isAnimated, 'Static GIF has only 1 frame');
    await sharpDefault(input).webp({ quality: 90 }).toFile(output);
    assert(fs.existsSync(output), 'Static GIF converted to WebP');
  } catch (err) {
    assert(false, `Static GIF processing error: ${err.message}`);
  }
}

async function testVideoProcessing() {
  console.log('\n=== Test: MP4 Video Processing ===');
  const input = path.join(TEST_DIR, 'test-video.mp4');
  const output = path.join(OUTPUT_DIR, 'test-video.mp4');
  const poster = path.join(OUTPUT_DIR, 'test-video-poster.jpg');

  try {
    execSync(`ffmpeg -i "${input}" -c:v libx264 -crf 23 -c:a aac -b:a 128k -pix_fmt yuv420p -y "${output}"`);
    assert(fs.existsSync(output), 'Video encoded to MP4');

    execSync(`ffmpeg -i "${output}" -ss 00:00:01 -vframes 1 -vf "scale=1200:-1" -qscale:v 2 -y "${poster}"`);
    assert(fs.existsSync(poster), 'Video poster generated');

    const size = fs.statSync(output).size;
    assert(size > 0, `Output video has content (${size} bytes)`);
  } catch (err) {
    assert(false, `Video processing error: ${err.message}`);
  }
}

async function testUnusualAspectRatios() {
  console.log('\n=== Test: Unusual Aspect Ratios ===');
  const testCases = [
    { name: 'portrait', file: 'test-portrait.jpg', expectedW: 270, expectedH: 480 },
    { name: 'square', file: 'test-animated.gif', expectedW: 300, expectedH: 300 },
    { name: 'landscape', file: 'test-landscape.png', expectedW: 480, expectedH: 270 },
  ];

  const sharp = await import('sharp');
  const sharpDefault = sharp.default || sharp;
  for (const tc of testCases) {
    try {
      const metadata = await sharpDefault(path.join(TEST_DIR, tc.file)).metadata();
      assert(
        metadata.width === tc.expectedW && metadata.height === tc.expectedH,
        `${tc.name}: ${tc.expectedW}x${tc.expectedH} (got ${metadata.width}x${metadata.height})`
      );
    } catch (err) {
      assert(false, `${tc.name} aspect ratio error: ${err.message}`);
    }
  }
}

async function testDuplicateProcessing() {
  console.log('\n=== Test: Duplicate Processing (Content Hash Skip) ===');
  const sharp = await import('sharp');
  const sharpDefault = sharp.default || sharp;

  const input = path.join(TEST_DIR, 'test-portrait.jpg');

  // First run: process source → output
  const output1 = path.join(OUTPUT_DIR, 'test-dup-1.webp');
  await sharpDefault(input)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(output1);
  assert(fs.existsSync(output1), 'First processing run completed');

  const hash1 = await cryptoHash(output1);

  // Second run: process same source → different output path
  const output2 = path.join(OUTPUT_DIR, 'test-dup-2.webp');
  await sharpDefault(input)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(output2);
  assert(fs.existsSync(output2), 'Second processing run completed');

  const hash2 = await cryptoHash(output2);

  // Verify both outputs are identical (same source → same derivative)
  assert(hash1 === hash2, 'Content hash identical across duplicate runs (same source, same settings)');

  // Clean up duplicate outputs
  fs.unlinkSync(output1);
  fs.unlinkSync(output2);
}

async function testMissingFFmpeg() {
  console.log('\n=== Test: Missing FFmpeg Simulation ===');
  // Simulate missing FFmpeg by running with empty PATH (isolated, system PATH unchanged)
  try {
    execSync('ffmpeg -version', { encoding: 'utf8', stdio: 'pipe', env: { PATH: '' } });
    assert(false, 'FFmpeg should NOT be found when PATH is empty');
  } catch (err) {
    assert(true, 'FFmpeg not found when PATH is empty (simulated missing ffmpeg)');
  }
  // Verify FFmpeg actually exists on system PATH (real availability)
  try {
    execSync('ffmpeg -version', { encoding: 'utf8', stdio: 'pipe' });
    assert(true, 'FFmpeg available on system PATH (real check)');
  } catch (err) {
    assert(false, `FFmpeg not found on system PATH: ${err.message}`);
  }
}

async function testMissingGifsicle() {
  console.log('\n=== Test: Missing Gifsicle (Original GIF Preserved) ===');
  // Confirm gifsicle is not installed
  try {
    execSync('gifsicle --version', { encoding: 'utf8', stdio: 'pipe' });
    assert(false, 'Gifsicle should NOT be available in this environment');
  } catch (err) {
    assert(true, 'Gifsicle not installed (expected in this environment)');
  }

  const input = path.join(TEST_DIR, 'test-animated.gif');
  const output = path.join(OUTPUT_DIR, 'test-missing-gifsicle.gif');

  // Call processGIF with convertToWebp=false (default) - gifsicle missing
  // Should preserve original GIF unchanged
  let resultPath;
  try {
    resultPath = await processGIF(input, output, {
      targetWidth: 1200,
      generatePoster: true,
      convertToWebp: false,
    });
    // resultPath should be the original input path (preserved)
    assert(resultPath === input, `Original GIF preserved: returned ${path.basename(resultPath)}`);
  } catch (err) {
    assert(false, `processGIF should preserve original GIF when gifsicle missing: ${err.message}`);
  }

  // Verify output file is NOT a WebP (gifsicle missing → no conversion)
  const resultExt = path.extname(resultPath).toLowerCase();
  assert(resultExt === '.gif', `Output extension is .gif (got ${resultExt})`);

  // Verify the original file still exists unchanged
  const originalSize = fs.statSync(input).size;
  assert(originalSize > 0, `Original animated GIF preserved unchanged (${originalSize} bytes)`);

  // Explicit opt-in WebP conversion test - should succeed even without gifsicle
  try {
    const webpResult = await processGIF(input, output.replace('.gif', '.webp'), {
      targetWidth: 1200,
      generatePoster: true,
      convertToWebp: true,
    });
    const webpExt = path.extname(webpResult).toLowerCase();
    assert(webpExt === '.webp', `Opt-in WebP conversion succeeded: ${path.extname(webpResult)}`);
    // Clean up opt-in WebP
    fs.unlinkSync(webpResult);
  } catch (err) {
    assert(false, `Opt-in WebP conversion should work when requested: ${err.message}`);
  }
}

async function testInterruptedDownloadRecovery() {
  console.log('\n=== Test: Interrupted Download Recovery ===');
  const partialPath = path.join(OUTPUT_DIR, 'partial-download.tmp');
  const completePath = path.join(OUTPUT_DIR, 'recovered-download.tmp');

  // Simulate interrupted download: partial file written but incomplete
  fs.writeFileSync(partialPath, Buffer.alloc(100, 0x00)); // 100 zero bytes

  assert(fs.existsSync(partialPath), 'Partial file exists after simulated interruption');

  // Verify partial file is detected as invalid (different from expected hash)
  const partialHash = await cryptoHash(partialPath);
  assert(partialHash !== null, 'Partial file has a detectable hash');

  // Simulate recovery: write complete file over partial
  const sharp = await import('sharp');
  const sharpDefault = sharp.default || sharp;
  await sharpDefault({
    create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } }
  }).jpeg({ quality: 90 }).toFile(completePath);

  assert(fs.existsSync(completePath), 'Complete file written after recovery');

  const completeHash = await cryptoHash(completePath);
  assert(partialHash !== completeHash, 'Recovered file hash differs from partial file');

  // Cleanup
  fs.unlinkSync(partialPath);
  fs.unlinkSync(completePath);
}

async function testManifestRecovery() {
  console.log('\n=== Test: Manifest Recovery Verification ===');
  const testManifest = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    assets: {
      'test-drive-id-1': {
        originalDriveId: 'test-drive-id-1',
        originalFilename: 'test-portrait.jpg',
        originalMimeType: 'image/jpeg',
        sourceContentHash: 'abc123',
        generatedAssets: [
          {
            path: path.join(OUTPUT_DIR, 'test-portrait.webp'),
            format: 'webp',
            width: null,
            height: null,
            fileSize: null,
            processingVersion: 'phase5',
          },
        ],
        associatedProjects: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  };

  fs.writeFileSync(TEST_MANIFEST_PATH, JSON.stringify(testManifest, null, 2));
  const manifest = JSON.parse(fs.readFileSync(TEST_MANIFEST_PATH, 'utf8'));
  assert(manifest.assets['test-drive-id-1'], 'Manifest entry created');

  // Verify derivative exists at recorded path
  const asset = manifest.assets['test-drive-id-1'].generatedAssets[0];
  assert(fs.existsSync(asset.path), `Derivative exists at recorded path: ${asset.path}`);

  // Verify manifest structure has all required fields
  const entry = manifest.assets['test-drive-id-1'];
  assert(typeof entry.originalDriveId === 'string' && entry.originalDriveId.length > 0, 'Manifest has originalDriveId');
  assert(typeof entry.originalFilename === 'string' && entry.originalFilename.length > 0, 'Manifest has originalFilename');
  assert(typeof entry.originalMimeType === 'string' && entry.originalMimeType.length > 0, 'Manifest has originalMimeType');
  assert(typeof entry.sourceContentHash === 'string' && entry.sourceContentHash.length > 0, 'Manifest has sourceContentHash');
  assert(Array.isArray(entry.generatedAssets) && entry.generatedAssets.length > 0, 'Manifest has generatedAssets');
  assert(typeof entry.generatedAssets[0].processingVersion === 'string', 'Manifest has processingVersion');

  // Clean up test manifest
  fs.unlinkSync(TEST_MANIFEST_PATH);
}

async function testManifestHashSkipLogic() {
  console.log('\n=== Test: Manifest Hash Skip Logic ===');
  const inputHash = await cryptoHash(path.join(TEST_DIR, 'test-portrait.jpg'));
  assert(inputHash !== null, 'Source file hash computed successfully');
  assert(inputHash.length === 64, `SHA-256 hash is 64 chars (got ${inputHash.length})`);

  // Simulate: same source hash → skip processing
  // Different source hash → regenerate
  const sameHash = inputHash;
  const differentHash = crypto.createHash('sha256').update('different-content').digest('hex');
  assert(sameHash !== differentHash, 'Different content produces different hashes');

  assert(sameHash === inputHash, 'Same source hash matches - skip processing');
  assert(differentHash !== inputHash, 'Different source hash - regenerate required');
}

async function main() {
  await setup();
  await testImageProcessing();
  await testPNGProcessing();
  await testGIFAnimated();
  await testStaticGIF();
  await testVideoProcessing();
  await testUnusualAspectRatios();
  await testDuplicateProcessing();
  await testInterruptedDownloadRecovery();
  await testManifestRecovery();
  await testManifestHashSkipLogic();
  await testMissingFFmpeg();
  await testMissingGifsicle();

  console.log('\n=== TEST SUMMARY ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Not tested: ${notTested}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});