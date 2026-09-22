'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),payload=path.join(root,'FrameFlow-Windows-x64');
const pairs=[['frameflow-core.js','frameflow-core.js'],['frameflow-engine.js','frameflow-engine.js'],['frameflow-app.js','frameflow-app.js'],['视频处理应用-高保真交互原型.html','app.html'],['windows版/main.js','main.js'],['windows版/preload.js','preload.js'],['windows版/package.json','package.json']];
function sync(){
 if(!fs.existsSync(path.join(payload,'FrameFlow.exe')))throw Error('Missing FrameFlow-Windows-x64 runtime.');
 const app=path.join(payload,'resources/app');fs.mkdirSync(app,{recursive:true});
 for(const [from,to] of pairs)fs.copyFileSync(path.join(root,from),path.join(app,to));
 for(const [from,to] of [['windows版/Windows使用说明.txt','README.txt'],['windows版/安装与卸载说明.txt','安装与卸载说明.txt'],['DEPENDENCIES.md','DEPENDENCIES.md']])fs.copyFileSync(path.join(root,from),path.join(payload,to));
 for(const name of ['ffmpeg.exe','ffprobe.exe','LICENSE','README.txt']){
  const source=path.join(root,'runtime/win32',name),dest=path.join(app,'runtime',name);fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(fs.existsSync(source))fs.copyFileSync(source,dest);else if(!fs.existsSync(dest))throw Error('Missing Windows engine: '+name);
 }
 console.log('Payload synced: '+require('../windows版/package.json').version);
}
module.exports={sync,pairs};if(require.main===module)sync();
