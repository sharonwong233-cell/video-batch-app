'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),v=require('../windows版/package.json').version;
for(const file of ['frameflow-app.js','视频处理应用-高保真交互原型.html','windows版/Windows使用说明.txt','windows版/安装与卸载说明.txt','windows版/安装包说明.txt']){
 const text=fs.readFileSync(path.join(root,file),'utf8');assert.ok(text.includes(v),'Missing current version: '+file);
 if(file.endsWith('.js')||file.endsWith('.html'))for(const m of text.matchAll(/(?:FrameFlow |V)(\d+\.\d+\.\d+)/g))assert.equal(m[1],v,'Stale UI version: '+file);
}
assert.equal(require('../frameflow-core').initial().version,3,'Project schema is not app version');
console.log('VERSION_PASS app='+v+' projectSchema=3');
