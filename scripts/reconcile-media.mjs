// Read-only source inventory. Outputs stay in the repository; never changes originals.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
const run = promisify(execFile);
const root = 'C:\\Users\\Nic\\Documents\\TOUPLOADFORPORTFOLIO';
const output = 'codex_handover/media-reconciliation';
fs.mkdirSync(output, {recursive:true});
const errors = [];
const directories = [];
function walk(dir, sourceRoot) {
  let entries;
  try { entries = fs.readdirSync(dir, {withFileTypes:true}); }
  catch (error) { errors.push({path:dir, code:error.code}); return []; }
  return entries.flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) { errors.push({path:file, code:'SYMLINK_NOT_FOLLOWED'}); return []; }
    if (entry.isDirectory()) {
      if (sourceRoot) directories.push({sourceRoot, relativePath:path.relative(sourceRoot,file)});
      return walk(file, sourceRoot);
    }
    return [{path:file, bytes:fs.statSync(file).size}];
  });
}
const projects = fs.readdirSync('src/content/projects').filter(f=>f.endsWith('.json')).map(f=>({id:f.slice(0,-5),...JSON.parse(fs.readFileSync(`src/content/projects/${f}`,'utf8'))}));
const references = new Map();
const archive = fs.readFileSync('dist/archive/index.html','utf8');
for (const p of projects) {
  const slug = p.slug ?? p.id;
  const page = `dist/projects/${slug}/index.html`;
  const html = fs.existsSync(page) ? fs.readFileSync(page,'utf8') : '';
  const media = [['thumbnail',p.thumbnail],['hero',p.hero],...(p.gallery??[]).map((m,i)=>[`gallery[${i}]`,m]),...(p.sections??[]).filter(s=>s.type==='media').map((s,i)=>[`sections[${i}]`,s.media])];
  for (const [location,m] of media) for (const [kind,url] of Object.entries(m??{})) {
    if (!['src','poster'].includes(kind) || !url.startsWith('/')) continue;
    const ref = {slug,title:p.title,classification:p.workType??'uncertain',location,kind,url,published:!p.draft&&!p.compositionTest&&!p.placeholder,renderedInGeneratedPage:html.includes(url.replaceAll('&','&amp;')),archiveLinked:archive.includes(`/projects/${slug}\"`),thumbnail:p.thumbnail?.src??p.thumbnail?.poster??null};
    references.set(url,[...(references.get(url)??[]),ref]);
  }
}
const repoFiles = walk('public').map(f=>({...f,url:'/'+path.relative('public',f.path).split(path.sep).join('/')}));
const bySize = new Map();
for (const f of repoFiles) bySize.set(f.bytes,[...(bySize.get(f.bytes)??[]),f]);
const hashCache = new Map();
function hash(file) {
  if (!hashCache.has(file)) hashCache.set(file,new Promise((resolve,reject)=>{
    const h=crypto.createHash('sha256'); const stream=fs.createReadStream(file);
    stream.on('data',chunk=>h.update(chunk)); stream.on('error',reject); stream.on('end',()=>resolve(h.digest('hex')));
  }));
  return hashCache.get(file);
}
async function metadata(file) {
  const ext=path.extname(file).toLowerCase();
  try {
    if (/^\.(jpe?g|png|gif|webp|tiff?|avif|svg)$/.test(ext)) {
      const m=await sharp(file,{animated:true}).metadata();
      return {width:m.width,height:m.pageHeight??m.height,frames:m.pages??1,format:m.format};
    }
    if (/^\.(mp4|mov|m4v|webm|avi|mkv|mp3|wav)$/.test(ext)) {
      const {stdout}=await run('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,avg_frame_rate,nb_frames:format=duration','-of','json',file],{windowsHide:true,timeout:30000,maxBuffer:1024*1024});
      return JSON.parse(stdout);
    }
    return {note:'Unfamiliar/non-browser format retained for review'};
  } catch(error) { return {error:error.code??error.message}; }
}
const rows=[];
const sourceFiles=walk(root,root);
console.log(`Inventory: ${sourceFiles.length} files in ${directories.length} directories. Hashing and probing originals read-only.`);
for (const file of sourceFiles) {
  const relativePath=path.relative(root,file.path);
  const digest=await hash(file.path);
  const matches=[];
  for (const candidate of bySize.get(file.bytes)??[]) if (await hash(candidate.path)===digest) matches.push(candidate.url);
  const refs=matches.flatMap(url=>references.get(url)??[]);
  const rendered=refs.filter(r=>r.published&&r.renderedInGeneratedPage&&r.location!=='thumbnail');
  const parentChain=relativePath.split(path.sep).slice(0,-1);
  const personal=parentChain.some(p=>/personal\s*(works?|projects?)/i.test(p));
  const status=rendered.length ? 'incorporated-generated-html-verified' : matches.length ? 'staged-not-rendered' : 'unmatched-needs-review';
  rows.push({sourceRoot:root,sourcePath:file.path,relativePath,parentChain,extension:path.extname(file.path).toLowerCase(),bytes:file.bytes,sha256:digest,metadata:await metadata(file.path),inferredProject:[...new Set(refs.map(r=>r.slug))],classification:personal?'personal':refs[0]?.classification??'uncertain',repoMatches:matches,projectReferences:refs,actuallyRendered:rendered.length>0,browserVerified:false,confidence:matches.length?'exact-byte-match':'unresolved',status,reason:rendered.length?'SHA-256 matches an asset referenced by a published generated project page. Browser rendering/attribution still needs visual review.':matches.length?'An identical public asset exists but is not rendered as published project media.':'No byte-identical public asset. May be missing or an optimized derivative; do not assign by basename.',duplicateCanonicalSource:null});
  if(rows.length%25===0) console.log(`Processed ${rows.length}/${sourceFiles.length}`);
}
const canonical=new Map();
for(const row of rows) { if(canonical.has(row.sha256)) row.duplicateCanonicalSource=canonical.get(row.sha256); else canonical.set(row.sha256,row.sourcePath); }
// Access to D:\Portfolio was denied in this session. Import historical inventory
// transparently; never claim a fresh walk, file hash or completeness for that root.
const historical=JSON.parse(fs.readFileSync('src/data/portfolio-manifest.json','utf8'));
for(const a of historical.assets) rows.push({sourceRoot:historical.source_root,sourcePath:a.source_path,relativePath:a.relative_path,parentChain:a.relative_path.split('\\').slice(0,-1),extension:a.extension,bytes:a.bytes,metadata:{width:a.width_px,height:a.height_px,duration:a.duration_seconds,codec:a.codec},inferredProject:[a.project_id],classification:/personalworks/i.test(a.relative_path)?'personal':'uncertain',repoMatches:[],projectReferences:[],actuallyRendered:null,browserVerified:false,confidence:'historical-only',status:'blocked-source-access',reason:`Source access denied. Historical inventory dated ${historical.generated_utc}; not a fresh verification.`,duplicateCanonicalSource:null});
const counts={};
for(const row of rows){counts[row.sourceRoot]??={};counts[row.sourceRoot][row.status]=(counts[row.sourceRoot][row.status]??0)+1;}
const result={generatedAt:new Date().toISOString(),complete:false,scope:'Exact-byte reconciliation; derivatives and attribution require review. D drive source is inaccessible.',roots:[{path:root,freshInventory:true,fileCount:sourceFiles.length,directoryCount:directories.length},{path:historical.source_root,freshInventory:false,historicalFileCount:historical.assets.length,reason:'access denied'}],directories,errors,counts,files:rows};
fs.writeFileSync(`${output}/ledger.json`,JSON.stringify(result,null,2)+'\n');
const columns=['sourceRoot','relativePath','parentChain','extension','bytes','sha256','inferredProject','classification','repoMatches','actuallyRendered','browserVerified','confidence','status','reason','duplicateCanonicalSource'];
const csv=v=>'"'+String(Array.isArray(v)?v.join(' | '):v??'').replaceAll('"','""')+'"';
fs.writeFileSync(`${output}/ledger.csv`,[columns.join(','),...rows.map(r=>columns.map(c=>csv(r[c])).join(','))].join('\n')+'\n');
fs.writeFileSync(`${output}/SUMMARY.md`, `# Source-media reconciliation\n\nGenerated ${result.generatedAt}. **Incomplete:** D drive access blocked; attribution and optimized derivatives require review.\n\n${Object.entries(counts).map(([root,statuses])=>`## ${root}\n\n${Object.entries(statuses).map(([s,n])=>`- ${s}: ${n}`).join('\n')}`).join('\n\n')}\n\nEvery accessible file and directory is retained with its full relative hierarchy. No source originals changed. Exact byte matches are verified against generated project HTML; this does not prove visual correctness or project attribution. D drive rows come only from the pre-existing inventory.\n\n## Accessible files needing review\n\n${rows.filter(r=>r.sourceRoot===root&&!r.actuallyRendered).map(r=>`- ${r.relativePath} — ${r.status}`).join('\n')}\n`);
console.log(JSON.stringify({counts,errors,output},null,2));
