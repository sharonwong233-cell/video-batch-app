'use strict';
// Prepare a source snapshot beside the existing VideoBatch code; no network writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),repo=path.join(root,'.build-cache/github-sync-v151'),dest=path.join(repo,'frameflow');
if(!fs.existsSync(path.join(repo,'.git')))throw Error('Clone the confirmed video-batch-app repository first.');
if(fs.existsSync(dest))throw Error('frameflow already exists; review changes instead of overwriting.');
fs.mkdirSync(dest);
function copy(from,to=from){const source=path.join(root,from),target=path.join(dest,to),stat=fs.lstatSync(source);if(stat.isSymbolicLink())throw Error('Unexpected link');if(stat.isDirectory()){fs.mkdirSync(target,{recursive:true});for(const name of fs.readdirSync(source))if(name!=='.DS_Store'&&!name.startsWith('._'))copy(path.join(from,name),path.join(to,name));}else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);fs.chmodSync(target,stat.mode&0o777);}}
for(const name of fs.readdirSync(root))if(/\.(?:js|cjs|html|md|sh|cmd)$/.test(name)&&name!=='AGENTS.md')copy(name);
for(const name of ['windows版','tools','docs','sources','验收记录'])copy(name);
copy('.gitignore');copy('docs/AGENTS-for-transfer.md','AGENTS.md');
for(const name of ['FrameFlow-v1.5.1-Windows-Dev-20260921.zip.sha256','FrameFlow-v1.5.1-Windows-x64-Setup.exe.sha256'])copy(name);
const files=[];function walk(dir){for(const name of fs.readdirSync(dir).sort()){const f=path.join(dir,name);if(fs.statSync(f).isDirectory())walk(f);else{const data=fs.readFileSync(f);files.push({path:path.relative(dest,f).split(path.sep).join('/'),size:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});}}}walk(dest);
fs.writeFileSync(path.join(dest,'GITHUB-SOURCE-MANIFEST.json'),JSON.stringify({version:'1.5.1',scope:'Source/docs/tests; runtime and installers are release artifacts',files},null,2));
console.log(JSON.stringify({directory:dest,files:files.length,bytes:files.reduce((n,f)=>n+f.size,0)},null,2));
