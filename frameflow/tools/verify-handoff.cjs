'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'HANDOFF-MANIFEST.json'),'utf8'));
let count=0;for(const entry of manifest.files){
 const file=path.resolve(root,entry.path);if(!file.startsWith(root+path.sep))throw Error('Unsafe manifest path');
 if(fs.lstatSync(file).isSymbolicLink())throw Error('Unexpected symlink: '+entry.path);
 const content=fs.readFileSync(file);if(content.length!==entry.size||crypto.createHash('sha256').update(content).digest('hex')!==entry.sha256)throw Error('Changed or incomplete file: '+entry.path);count++;
}console.log('HANDOFF_VERIFIED '+count+' files / app '+manifest.appVersion+' / archive '+manifest.archiveVersion);
