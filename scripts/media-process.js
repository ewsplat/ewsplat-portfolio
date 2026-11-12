import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { execSync } from 'child_process';
import crypto from 'crypto';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const TOKEN_PATH = path.resolve('./.credentials/token.json');
const CREDENTIALS_PATH = path.resolve('./.credentials/credentials.json');

const PORT = 3000;

function loadSavedToken() {
  if (fs.existsSync(TOKEN_PATH)) {
    return fs.readFileSync(TOKEN_PATH, 'utf8');
  }
  return null;
}

function saveToken(token) {
  const dir = path.dirname(TOKEN_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TOKEN_PATH, token);
  console.log(`Saved credentials to ${TOKEN_PATH}`);
}

// Step 1: Verify that representative original files are accessible in Google Drive
async function verifyDriveFiles(drive, expectedFiles) {
  console.log('\n=== Verifying Google Drive access ===');
  const fileList = await drive.files.list({
    q: "mimeType != 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id, name, mimeType)',
    pageSize: 100,
  });

  const foundFiles = fileList.data.files || [];
  console.log(`Found ${foundFiles.length} non-folder files in Drive root.`);

  for (const expected of expectedFiles) {
    const match = foundFiles.find(f => f.name.toLowerCase() === expected.toLowerCase());
    if (match) {
      console.log(`✓ Found expected file: "${match.name}" (ID: ${match.id}, MIME: ${match.mimeType})`);
    } else {
      console.log(`✗ MISSING expected file: "${expected}"`);
      console.log(`  Available files (sample): ${foundFiles.slice(0, 10).map(f => `"${f.name}"`).join(', ')}`);
    }
  }

  return foundFiles;
}

// Step 2: Get Drive file ID by name
async function findDriveFileId(drive, filename) {
  const fileList = await drive.files.list({
    q: `name = '${filename}' and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, mimeType)',
    pageSize: 1,
  });

  const files = fileList.data.files || [];
  if (files.length === 0) {
    throw new Error(`Drive file not found: "${filename}"`);
  }
  if (files.length > 1) {
    console.log(`⚠️  Multiple files named "${filename}" found, using first.`);
  }
  return files[0].id;
}

// Step 3: Download a file from Google Drive
async function downloadFile(drive, fileId, destPath) {
  const destFolder = path.dirname(destPath);
  if (!fs.existsSync(destFolder)) {
    fs.mkdirSync(destFolder, { recursive: true });
  }

  const dest = fs.createWriteStream(destPath);
  await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  ).then(res => {
    res.data.pipe(dest);
    return new Promise((resolve, reject) => {
      dest.on('finish', resolve);
      dest.on('error', reject);
    });
  });
  console.log(`Downloaded to ${destPath}`);
  return destPath;
}

// Step 4: Image processing with Sharp (conditional, quality-preserving)
async function processImageSharp(inputPath, outputPath, options = {}) {
  const { maxWidth, maxHeight, targetFormat = 'webp', quality = 90 } = options;

  // First, probe the source image metadata
  let metadata;
  try {
    metadata = await sharp(inputPath).metadata();
  } catch (err) {
    throw new Error(`Cannot read image metadata from ${inputPath}: ${err.message}`);
  }

  // Skip if already in target format and dimensions are within limits
  const isAlreadyWebP = metadata.format && metadata.format === 'webp';
  if (targetFormat === 'webp' && isAlreadyWebP && metadata.width <= (maxWidth || Infinity) && metadata.height <= (maxHeight || Infinity)) {
    console.log(`  ✓ Skipping ${path.basename(inputPath)}: already WebP and within dimensions.`);
    // Copy file as-is
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  // Calculate resize dimensions preserving aspect ratio
  let width = metadata.width;
  let height = metadata.height;

  if (maxWidth && width > maxWidth) {
    height = Math.round(height * (maxWidth / width));
    width = maxWidth;
  }
  if (maxHeight && height > maxHeight) {
    width = Math.round(width * (maxHeight / height));
    height = maxHeight;
  }

  // Only resize if the image is larger than the target
  const shouldResize = (maxWidth && width > maxWidth) || (maxHeight && height > maxHeight);

  console.log(`  Processing: ${metadata.width}x${metadata.height} → ${width}x${height} ${targetFormat} quality=${quality}`);

  const resizeOptions = shouldResize
    ? { width, height, fit: 'inside', withoutEnlargement: true }
    : { width, height };

  await sharp(inputPath)
    .resize(resizeOptions)
    .toFormat(targetFormat, { quality })
    .toFile(outputPath);

  console.log(`  ✓ Processed ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
  return outputPath;
}

// Step 5: FFmpeg video processing (conditional)
async function processVideoFFmpeg(inputPath, outputPath, options = {}) {
  const { targetBitrate, posterFrame = true } = options;

  // Probe the source video with ffprobe
  let probeOutput;
  try {
    probeOutput = execSync(
      `ffprobe -v error -show_entries stream=codec_name,bit_rate,codec_type -of json "${inputPath}"`,
      { encoding: 'utf8' }
    );
  } catch (err) {
    throw new Error(`ffprobe failed for ${inputPath}: ${err.message}`);
  }

  const probe = JSON.parse(probeOutput);
  const videoStream = probe.streams.find(s => s.codec_type === 'video');

  if (!videoStream) {
    throw new Error(`No video stream found in ${inputPath}`);
  }

  const codec = videoStream.codec_name;
  const bitrate = parseInt(videoStream.bit_rate || '0');

  // Skip re-encoding if already H.264 with reasonable bitrate
  const isH264 = codec === 'h264' || codec === 'avc1' || codec === 'hevc';
  const bitrateOk = !targetBitrate || bitrate <= (targetBitrate * 1000);

  if (isH264 && bitrateOk) {
    console.log(`  ✓ Skipping ${path.basename(inputPath)}: already H.264, bitrate ${bitrate} within target.`);
    // Copy file as-is with correct extension
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  // Generate poster frame (single image from middle of video)
  if (posterFrame) {
    const posterPath = outputPath.replace(/\.[^.]+$/, '') + '-poster.jpg';
    try {
        execSync(
          `ffmpeg -i "${inputPath}" -ss 00:00:05 -vframes 1 -vf "scale=1200:-1" -qscale:v 2 -y "${posterPath}"`,
        { encoding: 'utf8' }
      );
      console.log(`  ✓ Generated poster: ${path.basename(posterPath)}`);
    } catch (err) {
      console.warn(`  ⚠ Poster generation failed: ${err.message}`);
    }
  }

  // Encode video with FFmpeg
  const outputExt = path.extname(outputPath).toLowerCase();
  const ffmpegOutputPath = outputPath; // Use the same path

  const ffmpegCmd = `ffmpeg -i "${inputPath}" -c:v libx264 -crf 23 -c:a aac -b:a 128k -pix_fmt yuv420p -y "${ffmpegOutputPath}"`;

  try {
    execSync(ffmpegCmd, { encoding: 'utf8' });
    console.log(`  ✓ Processed video: ${path.basename(outputPath)}`);

    // Also generate poster if requested
    if (posterFrame) {
      const posterPath = ffmpegOutputPath.replace(/\.[^.]+$/, '') + '-poster.jpg';
      try {
        execSync(
          `ffmpeg -i "${ffmpegOutputPath}" -ss 00:00:05 -vframes 1 -vf "scale=1200:-1" -qscale:v 2 -y "${posterPath}"`,
          { encoding: 'utf8' }
        );
        console.log(`  ✓ Generated video poster: ${path.basename(posterPath)}`);
      } catch (err) {
        console.warn(`  ⚠ Video poster generation failed: ${err.message}`);
      }
    }

    return ffmpegOutputPath;
  } catch (err) {
    throw new Error(`FFmpeg encoding failed for ${inputPath}: ${err.message}`);
  }
}

// Step 6: GIF handling with animation preservation
async function processGIF(inputPath, outputPath, options = {}) {
  const { targetWidth, targetHeight, generatePoster = true, convertToWebp = false } = options;

  // Read GIF metadata first
  let metadata;
  try {
    metadata = await sharp(inputPath).metadata();
  } catch (err) {
    throw new Error(`Cannot read GIF metadata: ${err.message}`);
  }

  const isAnimated = Boolean(metadata.pages && metadata.pages > 1);

  if (!isAnimated) {
    // Static GIF - treat as image
    console.log(`  Static GIF detected - processing as image.`);
    return await processImageSharp(inputPath, outputPath, {
      maxWidth: targetWidth,
      maxHeight: targetHeight,
      targetFormat: 'webp',
      quality: 90,
    });
  }

  // Animated GIF - try lossless optimisation first
  console.log(`  Animated GIF detected (${metadata.pages} frames).`);

  // Try lossless optimisation using gifsicle if available
  const optimizedPath = outputPath + '.opt.gif';
  try {
    execSync(
      `gifsicle -O3 -- "${inputPath}" > "${optimizedPath}"`,
      { encoding: 'utf8' }
    );
    console.log(`  ✓ Losslessly optimised GIF: ${path.basename(optimizedPath)}`);

    // If generating poster frame
    if (generatePoster) {
      const posterPath = outputPath + '-poster.jpg';
      try {
        execSync(
          `ffmpeg -i "${optimizedPath}" -ss 00:00:05 -vframes 1 -vf "scale=1200:-1" -qscale:v 2 -y "${posterPath}"`,
          { encoding: 'utf8' }
        );
        console.log(`  ✓ Generated GIF poster: ${path.basename(posterPath)}`);
      } catch (err) {
        console.warn(`  ⚠ GIF poster generation failed: ${err.message}`);
      }
    }

    // Optionally also generate WebP animation (explicit opt-in only)
    if (convertToWebp) {
      const webpPath = outputPath + '.webp';
      try {
        await sharp(optimizedPath)
          .resize(targetWidth ? { width: targetWidth, fit: 'inside', withoutEnlargement: true } : {})
          .toFormat('webp', { quality: 90 })
          .toFile(webpPath);
        console.log(`  ✓ Generated WebP animation: ${path.basename(webpPath)}`);
        return webpPath;
      } catch (err) {
        console.warn(`  ⚠ WebP animation generation failed (keeping GIF fallback): ${err.message}`);
        return optimizedPath;
      }
    }

    return optimizedPath;
  } catch (err) {
    // gifsicle unavailable or failed - preserve original, do not silently convert
    console.warn(`  ⚠ GIF optimisation unavailable: ${err.message}. Preserving original animated GIF.`);

    // Still generate poster if requested (uses ffmpeg directly on original)
    if (generatePoster) {
      const posterPath = outputPath + '-poster.jpg';
      try {
        execSync(
          `ffmpeg -i "${inputPath}" -ss 00:00:05 -vframes 1 -vf "scale=1200:-1" -qscale:v 2 -y "${posterPath}"`,
          { encoding: 'utf8' }
        );
        console.log(`  ✓ Generated GIF poster: ${path.basename(posterPath)}`);
      } catch (err2) {
        console.warn(`  ⚠ GIF poster generation failed: ${err2.message}`);
      }
    }

    // Explicit opt-in WebP conversion only
    if (convertToWebp) {
      console.log(`  → Explicit WebP conversion requested; attempting...`);
      try {
        const webpPath = outputPath + '.webp';
        await sharp(inputPath)
          .resize(targetWidth ? { width: targetWidth, fit: 'inside', withoutEnlargement: true } : {})
          .toFormat('webp', { quality: 80 })
          .toFile(webpPath);
        console.log(`  ✓ Generated WebP animation (lossy): ${path.basename(webpPath)}`);
        return webpPath;
      } catch (err2) {
        console.warn(`  ⚠ WebP conversion failed: ${err2.message}. Preserving original GIF.`);
      }
    }

    // Preserve original GIF unchanged
    console.log(`  ✓ Preserving original animated GIF: ${path.basename(inputPath)}`);
    return inputPath;
  }
}

// Step 7: Compute content hash for change detection
function computeContentHash(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Step 8: Manifest structure
function loadManifest(manifestPath) {
  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }
  return { assets: {}, version: '1.0.0', createdAt: new Date().toISOString() };
}

function saveManifest(manifestPath, manifest) {
  const dir = path.dirname(manifestPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Saved manifest to ${manifestPath}`);
}

// Main CLI entry point
async function main() {
  console.log('=== EWSPLAT Media Processing CLI ===\n');

  // Parse command
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'verify') {
    // Verify Drive access and list expected files
    const expectedFiles = args.slice(1);
    const credentials = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
    const oauth2Client = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentials),
      scopes: SCOPES,
    });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    await verifyDriveFiles(drive, expectedFiles);
    process.exit(0);
  }

  if (command === 'login') {
    // OAuth flow for Desktop app with localhost redirect
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.error(`❌ No credentials found at ${CREDENTIALS_PATH}`);
      console.error('Please create a Google Cloud Desktop OAuth client and save the JSON at that path.');
      process.exit(1);
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { OAuth2Client } = google.auth;
    const oauth2Client = new OAuth2Client(
      credentials.web.client_id,
      credentials.web.client_secret,
      credentials.web.redirect_uris[0] // Use first redirect URI
    );

    // Generate the consent URL with loopback redirect
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      redirect_uri: credentials.web.redirect_uris[0],
    });

    console.log('\n1. Open this URL in your browser:\n', authUrl);
    console.log('\n2. Complete the authorization flow.');
    console.log('\n3. Enter the authorization code here:');

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question('Code: ', async (code) => {
      try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Save the refresh token for future use
        saveToken(JSON.stringify(tokens));
        console.log('\n✓ OAuth complete! Refresh token saved.');
        readline.close();
      } catch (err) {
        console.error('\n❌ Failed to exchange authorization code:', err.message);
        readline.close();
        process.exit(1);
      }
    });
    return; // Exit early, the readline flow happens async
  }

  if (command === 'process') {
    // Main processing command
    const [, , driveFileId, destPath, sourceName] = args;

    if (!driveFileId || !destPath) {
      console.error('Usage: node scripts/media-process.js process --drive-file <id> --dest <path>');
      process.exit(1);
    }

    // Load saved credentials
    let oauth2Client;
    if (fs.existsSync(TOKEN_PATH)) {
      const token = loadSavedToken();
      oauth2Client = new google.auth.GoogleAuth({
        credentials: JSON.parse(token),
        scopes: SCOPES,
      });
    } else {
      console.error('❌ No saved credentials. Run `node scripts/media-process.js login` first.');
      process.exit(1);
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    try {
      // 1. Verify the Drive file exists
      const fileMetadata = await drive.files.get({
        fileId: driveFileId,
        fields: 'id, name, mimeType',
      });
      console.log(`Processing Drive file: "${fileMetadata.data.name}" (${fileMetadata.data.mimeType})`);

      // 2. Download the original file locally
      const tempLocalPath = path.join('./.media-work', `temp-${Date.now()}${path.extname(fileMetadata.data.name)}`);
      await downloadFile(drive, driveFileId, tempLocalPath);
      console.log(`✓ Downloaded to ${tempLocalPath}`);

      // 3. Compute source hash before processing
      const sourceHash = computeContentHash(tempLocalPath);
      console.log(`✓ Source content hash: ${sourceHash.substring(0, 16)}...`);

      // 4. Determine media type and process accordingly
      const mimeType = fileMetadata.data.mimeType;

      let resultPath;

      if (mimeType.startsWith('image/')) {
        // Image processing
        resultPath = path.resolve(destPath);
        await processImageSharp(tempLocalPath, resultPath, {
          maxWidth: 1200,
          maxHeight: 1200,
          targetFormat: 'webp',
          quality: 90,
        });
      } else if (mimeType.startsWith('video/')) {
        // Video processing
        resultPath = path.resolve(destPath);
        await processVideoFFmpeg(tempLocalPath, resultPath, {
          targetBitrate: 5, // 5 Mbps target
          posterFrame: true,
        });
      } else if (mimeType === 'image/gif') {
        // GIF handling - preserve original by default; WebP conversion explicit
        resultPath = path.resolve(destPath);
        await processGIF(tempLocalPath, resultPath, {
          targetWidth: 1200,
          generatePoster: true,
          convertToWebp: false,
        });
      } else {
        console.error(`❌ Unsupported MIME type: ${mimeType}`);
        process.exit(1);
      }

      console.log(`\n✓ Processing complete. Output: ${resultPath}`);

      // 5. Record manifest entry
      const manifestPath = path.resolve('./data/media-manifest.json');
      const manifest = loadManifest(manifestPath);

      const assetEntry = {
        originalDriveId: driveFileId,
        originalFilename: fileMetadata.data.name,
        originalMimeType: fileMetadata.data.mimeType,
        sourceContentHash: sourceHash,
        generatedAssets: [
          {
            path: resultPath,
            format: path.extname(resultPath).replace('.', ''),
            width: null,
            height: null,
            fileSize: null,
            processingVersion: 'phase5',
          },
        ],
        associatedProjects: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Check if this Drive file already has an entry
      const existing = manifest.assets[driveFileId];
      if (existing) {
        // Verify existing derivatives and hashes before overwriting
        console.log(`  → Existing manifest entry found for Drive file ${driveFileId}`);
        if (existing.sourceContentHash === sourceHash) {
          console.log(`  ✓ Source hash matches - derivative already up to date. Skipping regeneration.`);
        } else {
          console.log(`  ! Source hash changed - regenerating derivative.`);
          existing.updatedAt = new Date().toISOString();
          existing.sourceContentHash = sourceHash;
          existing.generatedAssets = assetEntry.generatedAssets;
          saveManifest(manifestPath, manifest);
        }
      } else {
        manifest.assets[driveFileId] = assetEntry;
        saveManifest(manifestPath, manifest);
        console.log(`  ✓ Added new manifest entry for Drive file ${driveFileId}`);
      }

    } catch (err) {
      console.error(`❌ Processing error: ${err.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (command === 'manifest-verify') {
    // Verify existing derivatives and their hashes
    const manifestPath = path.resolve('./data/media-manifest.json');
    const manifest = loadManifest(manifestPath);
    console.log(`Manifest version: ${manifest.version}`);
    console.log(`Total entries: ${Object.keys(manifest.assets).length}`);

    for (const [driveId, entry] of Object.entries(manifest.assets)) {
      console.log(`\nDrive file: ${entry.originalFilename} (${entry.originalMimeType})`);
      console.log(`  Source hash: ${entry.sourceContentHash?.substring(0, 16)}...`);

      for (const asset of entry.generatedAssets) {
        const hash = computeContentHash(asset.path);
        if (hash) {
          const match = hash === entry.sourceContentHash ? '✓' : '✗';
          console.log(`  ${match} ${path.basename(asset.path)}: hash ${hash?.substring(0, 16)}... (stored: ${entry.sourceContentHash?.substring(0, 16)}...)`);
        } else {
          console.log(`  ✗ ${path.basename(asset.path)}: file not found`);
        }
      }
    }
    process.exit(0);
  }

  // Default help
  console.log(`
Usage: node scripts/media-process.js <command> [args]

Commands:
  verify [file1] [file2]   Verify Google Drive access and check for expected files
  login                     Start OAuth Desktop flow (localhost redirect)
  process --drive-file <id> --dest <path>  Process a Drive file
  manifest-verify           Verify existing manifest derivatives and hashes

Examples:
  node scripts/media-process.js verify BellaClaxton.mp4 pawa-dog-turnaround.mp4
  node scripts/media-process.js login
  node scripts/media-process.js process --drive-file 1BxiMVs0XRA5nFMdKvBdBZjGMUUqptj5 --dest public/images/portfolio/web/test.webp
  node scripts/media-process.js manifest-verify
`);
}

// Only run CLI when invoked directly
export { main };

export { processGIF };
export { processImageSharp };
export { processVideoFFmpeg };

const isMainEntry =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainEntry) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exitCode = 1;
  });
}