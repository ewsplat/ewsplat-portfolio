import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const publicRoot = path.join(root, 'public');
const distRoot = path.join(root, 'dist');
const projectRoot = path.join(root, 'src', 'content', 'projects');

const walk = (dir) => fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const file = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(file) : [file];
    })
  : [];

const toUrl = (file) => `/${path.relative(publicRoot, file).split(path.sep).join('/')}`;
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const records = walk(projectRoot).filter((file) => file.endsWith('.json')).map((file) => ({
  id: path.basename(file, '.json'),
  ...readJson(file),
}));
const published = records.filter((record) => !record.draft && !record.compositionTest && !record.placeholder);
const drafts = records.filter((record) => record.draft || record.compositionTest || record.placeholder);

// Media appears in thumbnail, hero, gallery items, and section media items.
// Walk the record rather than assuming one exact content shape so this audit
// stays correct as the local Manager adds optional presentation fields.
const refsFromRecord = (record) => {
  const refs = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.src === 'string' && value.src.startsWith('/')) refs.push(value.src);
    if (typeof value.poster === 'string' && value.poster.startsWith('/')) refs.push(value.poster);
    for (const child of Object.values(value)) visit(child);
  };
  visit(record);
  return refs;
};

const publishedRefs = new Set(published.flatMap(refsFromRecord));
const draftRefs = new Set(drafts.flatMap(refsFromRecord));
const sourceFiles = walk(path.join(root, 'src')).filter((file) => /\.(astro|ts|js|css|json)$/.test(file));
const sourceText = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const distFiles = walk(distRoot).filter((file) => /\.(html|js|css)$/.test(file));
const distText = distFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const siteRefs = new Set([...sourceText.matchAll(/(?:\/media\/|\/images\/)[^"'\s<>)`]+/g), ...distText.matchAll(/(?:\/media\/|\/images\/)[^"'\s<>)`]+/g)].map((match) => match[0].split('?')[0]));

const hashCache = new Map();
const hash = (file) => {
  if (!hashCache.has(file)) hashCache.set(file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
  return hashCache.get(file);
};
const files = walk(publicRoot).map((file) => {
  const url = toUrl(file);
  const stat = fs.statSync(file);
  const extension = path.extname(file).toLowerCase();
  const classification = publishedRefs.has(url)
    ? 'required-published'
    : siteRefs.has(url)
      ? 'required-site'
      : draftRefs.has(url)
        ? 'draft-only'
        : 'unreferenced';
  return { path: path.relative(root, file).split(path.sep).join('/'), url, bytes: stat.size, extension, classification, sha256: hash(file) };
});

const byHash = new Map();
for (const file of files) byHash.set(file.sha256, [...(byHash.get(file.sha256) ?? []), file.path]);
for (const file of files) {
  const matches = byHash.get(file.sha256);
  if (matches.length > 1) file.duplicateGroup = matches;
  if (/\.(glb|blend|mov|psd|ai|aep|zip)$/i.test(file.path)) file.sourceOrNonWebCandidate = true;
}

const summary = Object.fromEntries([...new Set(files.map((file) => file.classification))].map((classification) => {
  const group = files.filter((file) => file.classification === classification);
  return [classification, { files: group.length, bytes: group.reduce((sum, file) => sum + file.bytes, 0) }];
}));
const manifest = {
  generatedAt: new Date().toISOString(),
  records: { total: records.length, published: published.length, draftLike: drafts.length },
  summary,
  files,
};
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data', 'deployment-media-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ records: manifest.records, summary }, null, 2));
