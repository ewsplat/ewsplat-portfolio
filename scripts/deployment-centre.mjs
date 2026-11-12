import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const command = process.argv[2] ?? 'validate';
const mib = Number(process.env.DEPLOY_EXTERNAL_VIDEO_MIN_MIB ?? 40);
const manifestPath = path.join(root, 'data', 'deployment-media-manifest.json');

const run = (cmd, args, env = {}) => {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
const stagedRoot = path.join(root, '.deploy-public');
const bytes = (files) => files.reduce((sum, file) => {
  const staged = path.join(stagedRoot, file.path.replace(/^public[\\/]/, ''));
  return sum + (fs.existsSync(staged) ? fs.statSync(staged).size : file.bytes);
}, 0);
const isVideo = (file) => ['.mp4', '.webm', '.m4v', '.mov'].includes(file.extension);
const isYoutube = (file) => false;

if (command === 'build') {
  run('node', ['scripts/build-deployment-manifest.mjs']);
  run('node', ['scripts/prepare-deployment-public.mjs']);
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { DEPLOY_PUBLIC_DIR: '.deploy-public' });
  process.exit(0);
}

if (command === 'preview') {
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'preview'], { DEPLOY_PUBLIC_DIR: '.deploy-public' });
  process.exit(0);
}

if (command === 'media') {
  run('node', ['scripts/r2-media.mjs']);
  process.exit(0);
}

if (command === 'publish') {
  console.log(JSON.stringify({ status: 'HOSTING NOT CONFIGURED', publish: 'LOCKED', message: 'Configure a reviewed hosting adapter before publishing.' }, null, 2));
  process.exit(0);
}

if (!fs.existsSync(manifestPath)) run('node', ['scripts/build-deployment-manifest.mjs']);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const required = manifest.files.filter((file) => ['required-published', 'required-site'].includes(file.classification));
const external = required.filter((file) => isVideo(file) && file.bytes >= mib * 1048576);
const youtube = required.filter(isYoutube);
const staticFiles = required.filter((file) => !external.includes(file));
const missing = required.filter((file) => !fs.existsSync(path.join(stagedRoot, file.path.replace(/^public[\\/]/, ''))));
const siteReady = !missing.length;
const report = {
  generatedAt: new Date().toISOString(),
  readiness: {
    siteBuild: siteReady ? 'READY' : 'BLOCKED',
    media: external.length ? 'EXTERNAL HOST REQUIRED' : 'READY',
    seo: process.env.PUBLIC_SITE_URL || process.env.GITHUB_REPOSITORY ? 'READY' : 'NEEDS PRODUCTION DOMAIN',
    domain: process.env.PUBLIC_SITE_URL || process.env.GITHUB_REPOSITORY ? 'CONFIGURED' : 'NOT CONFIGURED',
    publish: 'LOCKED',
  },
  thresholds: { externalVideoMinMiB: mib },
  requiredFiles: required.length,
  missingFiles: missing.map((file) => file.path),
  classification: {
    static: { files: staticFiles.length, bytes: bytes(staticFiles) },
    external: { files: external.length, bytes: bytes(external), paths: external.map((file) => file.url) },
    youtube: { files: youtube.length },
    excluded: manifest.files.filter((file) => !required.includes(file)).length,
  },
  deploymentStaging: fs.existsSync(stagedRoot) ? 'AVAILABLE' : 'NOT BUILT',
  externalDryRun: {
    configured: Boolean(process.env.PUBLIC_MEDIA_BASE_URL),
    baseUrl: process.env.PUBLIC_MEDIA_BASE_URL ?? null,
    prefixes: (process.env.PUBLIC_EXTERNAL_MEDIA_PREFIXES ?? '').split(',').map((value) => value.trim()).filter(Boolean),
    fallback: 'local paths remain active when external media is disabled',
  },
};
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data', 'deployment-centre-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
