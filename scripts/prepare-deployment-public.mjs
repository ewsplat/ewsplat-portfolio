import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const staging = path.join(root, '.deploy-public');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'deployment-media-manifest.json'), 'utf8'));
const externalMinBytes = Number(process.env.DEPLOY_EXTERNAL_VIDEO_MIN_MIB ?? 40) * 1048576;
const externalConfigured = Boolean(process.env.PUBLIC_MEDIA_BASE_URL);
const isExternal = (file) => externalConfigured
  && ['.mp4', '.webm', '.m4v', '.mov'].includes(file.extension)
  && file.bytes >= externalMinBytes;
const files = manifest.files.filter((file) => (file.classification === 'required-published' || file.classification === 'required-site') && !isExternal(file));
const videoExtensions = new Set(['.mp4', '.webm', '.m4v']);
const optimizeAboveMiB = 8;

fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

const copy = (source, target) => {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
};

const optimizeVideo = (source, target) => {
  const temp = `${target}.tmp.mp4`;
  const result = spawnSync('ffmpeg', [
    '-y', '-i', source,
    '-map', '0:v:0', '-map', '0:a?',
    '-vf', "scale=w='min(1920,iw)':h=-2:force_original_aspect_ratio=decrease",
    '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', temp,
  ], { stdio: 'ignore' });
  if (result.status === 0 && fs.existsSync(temp)) {
    fs.renameSync(temp, target);
    return true;
  }
  if (fs.existsSync(temp)) fs.rmSync(temp);
  copy(source, target);
  return false;
};

let optimized = 0;
let copied = 0;
for (const file of files) {
  const source = path.join(root, file.path);
  const target = path.join(staging, file.path.replace(/^public[\\/]/, ''));
  if (videoExtensions.has(file.extension) && file.bytes >= optimizeAboveMiB * 1048576) {
    if (optimizeVideo(source, target)) optimized += 1;
    else copied += 1;
  } else {
    copy(source, target);
    copied += 1;
  }
}

for (const name of ['favicon.ico', 'favicon.svg']) {
  const source = path.join(root, 'public', name);
  if (fs.existsSync(source)) copy(source, path.join(staging, name));
}

console.log(JSON.stringify({ staging: path.relative(root, staging), selectedFiles: files.length, externalizedFiles: externalConfigured ? manifest.files.filter(isExternal).length : 0, optimizedVideos: optimized, copiedFiles: copied }, null, 2));
