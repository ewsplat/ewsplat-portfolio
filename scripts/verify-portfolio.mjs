import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { youtubeVideoId } from '../src/utils/youtube.ts';

const read = (file) => fs.readFileSync(file, 'utf8');
const records = fs.readdirSync('src/content/projects').filter(f => f.endsWith('.json')).map(file => ({
  id: file.slice(0, -5), ...JSON.parse(read(`src/content/projects/${file}`)),
}));
const published = records.filter(p => !p.draft && !p.compositionTest && !p.placeholder);
const archive = read('dist/archive/index.html');
const home = read('dist/index.html');
const cards = [...archive.matchAll(/<article\b[^>]*data-archive-item[^>]*>[\s\S]*?<\/article>/g)].map(m => m[0]);
assert.equal(cards.length, published.length, 'One archive card per published project');
const missing = [];
let mediaReferences = 0;
let iframeCount = 0;
for (const p of published) {
  const slug = p.slug ?? p.id;
  const html = read(`dist/projects/${slug}/index.html`);
  assert.equal(cards.filter(card => card.includes(`/projects/${slug}"`)).length, 1, `${slug}: archive inclusion`);
  const media = [p.hero, ...(p.gallery ?? []), ...(p.sections ?? []).filter(s => s.type === 'media').map(s => s.media)].filter(Boolean);
  const expectedIds = new Set(media.filter(m => m.type === 'youtube').map(m => m.videoId));
  for (const link of p.links ?? []) {
    const id = youtubeVideoId(link.url);
    if (id) expectedIds.add(id);
  }
  const frames = [...html.matchAll(/<iframe\b[^>]*>/g)].map(m => m[0]);
  assert.equal(frames.length, expectedIds.size, `${slug}: one embed per unique video`);
  for (const id of expectedIds) {
    assert.equal(frames.filter(f => f.includes(`src="https://www.youtube-nocookie.com/embed/${id}?`)).length, 1, `${slug}: populated iframe src`);
  }
  iframeCount += frames.length;
  for (const m of media.filter(m => m.src)) {
    assert.ok(html.includes(m.src.replaceAll('&', '&amp;')), `${slug}: media rendered: ${m.src}`);
  }
}
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const pages = walk('dist').filter(f => f.endsWith('.html'));
for (const file of pages) {
  const html = read(file);
  for (const match of html.matchAll(/<(?:img|video|source|script|link)\b[^>]*>/g)) {
    for (const attr of match[0].matchAll(/\b(?:src|poster|href)="([^"#?]+)(?:[^\"]*)"/g)) {
      const url = attr[1].replaceAll('&amp;', '&');
      if (!url.startsWith('/') || url.startsWith('//')) continue;
      mediaReferences++;
      if (!fs.existsSync(path.join('dist', decodeURIComponent(url)))) missing.push({page:file, url});
    }
  }
}
assert.equal((archive.match(/<iframe\b/g) ?? []).length, 0, 'Archive embeds must be navigable posters');
assert.match(home.match(/<article\b[\s\S]*?<\/article>/)?.[0] ?? '', /\/projects\/orange-fields"/, 'Orange Fields first');
assert.ok(!home.includes('/projects/pawa-dog-3d-model"'), 'Pawa turnaround excluded from homepage');
for (const [url, expected] of [
  ['https://youtu.be/AUlziTbce8A?t=20', 'AUlziTbce8A'],
  ['https://www.youtube.com/watch?feature=share&v=q_PdKqG6NYY', 'q_PdKqG6NYY'],
  ['https://www.youtube.com/shorts/KI_552q_ZvY', 'KI_552q_ZvY'],
  ['https://www.youtube-nocookie.com/embed/KI_552q_ZvY', 'KI_552q_ZvY'],
  ['https://youtube.com.evil.example/watch?v=q_PdKqG6NYY', undefined],
  ['https://youtube.com/watch?v=invalid', undefined],
]) assert.equal(youtubeVideoId(url), expected);
const result = {pages: pages.length, records: records.length, published: published.length, archiveCards:cards.length, youtubeEmbeds:iframeCount, mediaReferences, missing};
fs.mkdirSync('.media-work', {recursive:true});
fs.writeFileSync('.media-work/portfolio-verification.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
assert.equal(missing.length, 0, 'All generated local media references must resolve');
