'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),version=require('../windows版/package.json').version,command=process.argv[2]||'start';
process.chdir(root);
function run(exe,args,env=process.env){const p=spawnSync(exe,args,{cwd:root,env,stdio:'inherit'});if(p.error)throw p.error;if(p.status!==0)throw Error('Command failed: '+exe+' (exit '+p.status+')');}
function node(file,args=[]){run(process.execPath,[path.join(root,file),...args]);}
function engines(){
 fs.mkdirSync(path.join(root,'.build-cache'),{recursive:true});
 if(process.platform!=='win32')return;
 const dest=path.join(root,'runtime/win32');fs.mkdirSync(dest,{recursive:true});
 for(const name of ['ffmpeg.exe','ffprobe.exe','LICENSE','README.txt'])if(!fs.existsSync(path.join(dest,name)))fs.copyFileSync(path.join(root,'FrameFlow-Windows-x64/resources/app/runtime',name),path.join(dest,name));
}
function desktop(args=[],test=false){
 if(process.platform!=='win32')throw Error('This launcher targets Windows x64.');
 const profile=test?fs.mkdtempSync(path.join(root,'.build-cache/test-profile-')):path.join(root,'.dev-user-data');
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 run(path.join(root,'FrameFlow-Windows-x64/FrameFlow.exe'),[path.join(root,'windows版'),'--dev-profile='+profile,...args],env);
}
async function main(){
 if(command==='verify'){node('tools/verify-handoff.cjs');return;}
 engines();
 switch(command){
  case 'start':desktop();break;
  case 'check':{
   for(const file of ['frameflow-core.js','frameflow-engine.js','frameflow-app.js','windows版/main.js','windows版/preload.js','build-installer.cjs'])run(process.execPath,['--check',path.join(root,file)]);
   const {Engine}=require('../frameflow-engine');console.log(await new Engine(path.join(root,'runtime',process.platform)).health());
   node('tools/version-check.cjs');console.log('CHECK_PASS '+version);break;
  }
  case 'test':node('selftest.cjs');break;
  case 'test-save':node('tools/save-project-test.cjs');break;
  case 'timeline':desktop(['--timeline-test','--acceptance-dir='+path.join(root,'验收记录','V'+version+'-Windows-timeline')],true);break;
  case 'native-test':{
   node('selftest.cjs');const dirs=fs.readdirSync(path.join(root,'.build-cache')).filter(n=>n.startsWith('acceptance-')).map(n=>path.join(root,'.build-cache',n)).filter(d=>fs.existsSync(path.join(d,'report.json'))).sort((a,b)=>fs.statSync(path.join(b,'report.json')).mtimeMs-fs.statSync(path.join(a,'report.json')).mtimeMs);
   if(!dirs[0])throw Error('Missing engine test report');desktop(['--acceptance-test','--acceptance-dir='+dirs[0]],true);break;
  }
  case 'sync':require('./sync-payload.cjs').sync();break;
  case 'installer':node('build-installer.cjs');break;
  default:throw Error('Commands: start, verify, check, test, test-save, timeline, native-test, sync, installer');
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
