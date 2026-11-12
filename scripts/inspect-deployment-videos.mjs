import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'deployment-media-manifest.json'), 'utf8'));
const videoExt = new Set(['.mp4', '.webm', '.mov', '.m4v']);
const candidates = manifest.files.filter((file) => videoExt.has(file.extension) && file.classification !== 'unreferenced');
const report = candidates.map((file) => {
  const absolute = path.join(root, file.path);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', absolute], { encoding: 'utf8' });
  let data = {};
  try { data = JSON.parse(probe.stdout); } catch {}
  const streams = data.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === 'video') ?? {};
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  return {
    path: file.path,
    classification: file.classification,
    bytes: file.bytes,
    sizeMiB: Number((file.bytes / 1048576).toFixed(2)),
    container: data.format?.format_name ?? null,
    durationSeconds: Number(Number(data.format?.duration ?? 0).toFixed(2)),
    width: video.width ?? null,
    height: video.height ?? null,
    videoCodec: video.codec_name ?? null,
    pixelFormat: video.pix_fmt ?? null,
    audioCodec: audio?.codec_name ?? null,
    hasAudio: Boolean(audio),
  };
});
report.sort((a, b) => b.bytes - a.bytes);
fs.writeFileSync(path.join(root, 'data', 'deployment-video-report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), files: report }, null, 2));
console.log(JSON.stringify({ files: report.length, totalMiB: Number((report.reduce((sum, file) => sum + file.bytes, 0) / 1048576).toFixed(2)), largest: report.slice(0, 20) }, null, 2));
