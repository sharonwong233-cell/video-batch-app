'use strict';
// Snapshot only explicit development artifacts. Never copy user profiles or video caches.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),version=require('../windows版/package.json').version;
const archiveVersion='20260921',name=`FrameFlow-v${version}-Windows-Dev-${archiveVersion}`,dest=path.join(root,'handoff',name);
if(fs.existsSync(dest))throw Error('Snapshot already exists; choose a new archive version, do not overwrite it.');
require('./version-check.cjs');require('./sync-payload.cjs').sync();
fs.mkdirSync(dest,{recursive:true});
function copy(from,to=from){
 const source=path.join(root,from),target=path.join(dest,to),stat=fs.lstatSync(source);
 if(stat.isSymbolicLink())throw Error('Unexpected symlink: '+from);
 if(stat.isDirectory()){fs.mkdirSync(target,{recursive:true});for(const entry of fs.readdirSync(source))if(entry!=='.DS_Store'&&!entry.startsWith('._'))copy(path.join(from,entry),path.join(to,entry));}
 else {fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);fs.chmodSync(target,stat.mode&0o777);}
}
for(const entry of fs.readdirSync(root))if(/\.(?:js|cjs|html|md|sh|cmd)$/.test(entry)&&entry!=='AGENTS.md')copy(entry);
for(const dir of ['windows版','tools','docs','sources','验收记录','FrameFlow-Windows-x64'])copy(dir);
copy('.gitignore');copy('docs/AGENTS-for-transfer.md','AGENTS.md');
for(const entry of ['nsis-3.0.4.1','nsis-3.0.4.1-api.7z'])copy('.build-cache/'+entry);
const setup=`FrameFlow-v${version}-Windows-x64-Setup.exe`;copy(setup,'release/'+setup);copy(setup+'.sha256','release/'+setup+'.sha256');copy('windows版/安装包说明.txt','release/README.txt');
const files=[];function walk(dir){for(const entry of fs.readdirSync(dir).sort()){const full=path.join(dir,entry),stat=fs.lstatSync(full);if(stat.isDirectory())walk(full);else{const content=fs.readFileSync(full);files.push({path:path.relative(dest,full).split(path.sep).join('/'),size:content.length,sha256:crypto.createHash('sha256').update(content).digest('hex')});}}}walk(dest);
fs.writeFileSync(path.join(dest,'HANDOFF-MANIFEST.json'),JSON.stringify({appVersion:version,projectSchema:3,archiveVersion,createdAt:new Date().toISOString(),windowsRuntimeTested:false,files},null,2));
console.log('HANDOFF_STAGED '+dest+' / '+files.length+' files');
