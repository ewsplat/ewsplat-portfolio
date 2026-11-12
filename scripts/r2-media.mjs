import fs from 'node:fs';
import path from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
const root = process.cwd();
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!match || process.env[match[1]]) continue;
  let value = match[2].trim();
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) value = value.slice(1, -1);
  process.env[match[1]] = value;
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'deployment-media-manifest.json'), 'utf8'));
const staging = path.join(root, '.deploy-public');
const minBytes = Number(process.env.DEPLOY_EXTERNAL_VIDEO_MIN_MIB ?? 40) * 1048576;
const external = manifest.files.filter((file) => file.classification === 'required-published' && ['.mp4', '.webm', '.m4v', '.mov'].includes(file.extension) && file.bytes >= minBytes);
const required = ['R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_MEDIA_BASE_URL'];
const configured = required.every((name) => process.env[name]);
const upload = process.env.R2_UPLOAD === 'true';
const base = process.env.R2_PUBLIC_MEDIA_BASE_URL?.replace(/\/$/, '');
console.log(JSON.stringify({ mode: upload ? 'UPLOAD' : 'DRY RUN', files: external.length, configured, publicBaseConfigured: Boolean(base) }, null, 2));
if (upload && !configured) { console.error(`R2 configuration incomplete. Required variables: ${required.join(', ')}`); process.exit(1); }
const client = upload ? new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, forcePathStyle: true, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } }) : null;
const mime = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.m4v': 'video/mp4', '.mov': 'video/quicktime' };
for (const file of external) {
  const relative = file.path.replace(/^public[\\/]/, '').replaceAll('\\', '/');
  const local = path.join(staging, relative);
  const publicUrl = `${base ?? '<R2_PUBLIC_MEDIA_BASE_URL>'}/${relative}`;
  if (!fs.existsSync(local)) { console.error(`Missing deployment derivative: ${local}`); process.exit(1); }
  if (upload) { await client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: relative, Body: fs.createReadStream(local), ContentType: mime[file.extension] ?? 'application/octet-stream' })); const head = await client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: relative })); if (Number(head.ContentLength) !== fs.statSync(local).size) { console.error(`Remote size verification failed for ${relative}`); process.exit(1); } }
  console.log(`${relative} -> ${publicUrl}`);
}
