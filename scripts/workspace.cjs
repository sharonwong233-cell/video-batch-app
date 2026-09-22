'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),command=process.argv[2]||'start';
process.chdir(root);
function run(exe,args,env=process.env){const p=spawnSync(exe,args,{cwd:root,env,stdio:'inherit'});if(p.error)throw p.error;if(p.status!==0)throw Error('执行失败，退出码：'+p.status);}
function node(file){run(process.execPath,[path.join(root,file)]);}
function desktop(args=[],test=false){
 if(process.platform!=='win32')throw Error('桌面启动入口支持 Windows x64；macOS 可运行引擎测试，尚未提供发行版。');
 const exe=path.join(root,'FrameFlow-Windows-x64/FrameFlow.exe');
 if(!fs.existsSync(exe))throw Error('缺少运行时。请先运行 npm run setup:windows，或阅读 docs/DEVELOPMENT.md 的离线步骤。');
 const profile=test?fs.mkdtempSync(path.join(root,'.build-cache/test-profile-')):path.join(root,'.dev-user-data');
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 run(exe,[root,'--dev-profile='+profile,...args],env);
}
async function main(){
 fs.mkdirSync(path.join(root,'.build-cache'),{recursive:true});
 switch(command){
 case 'start':desktop();break;
 case 'check':{
  for(const dir of ['src','scripts','tests'])for(const file of fs.readdirSync(path.join(root,dir)))if(/\.(js|cjs)$/.test(file))run(process.execPath,['--check',path.join(root,dir,file)]);
  node('tests/layout-test.cjs');
  const health=await new (require('../src/frameflow-engine').Engine)(path.join(root,'runtime',process.platform)).health();
  console.log(health);if(!health.ready)throw Error('视频引擎不可用，请先准备依赖。');
  console.log('CHECK_PASS '+require('../package.json').version);break;
 }
 case 'test':node('tests/selftest.cjs');break;
 case 'test-save':node('tests/save-project-test.cjs');break;
 case 'timeline':desktop(['--timeline-test','--acceptance-dir='+path.join(root,'reports/timeline')],true);break;
 case 'native-test':{
  node('tests/selftest.cjs');
  const dirs=fs.readdirSync(path.join(root,'.build-cache')).filter(n=>n.startsWith('acceptance-')).map(n=>path.join(root,'.build-cache',n)).filter(d=>fs.existsSync(path.join(d,'report.json'))).sort((a,b)=>fs.statSync(path.join(b,'report.json')).mtimeMs-fs.statSync(path.join(a,'report.json')).mtimeMs);
  if(!dirs[0])throw Error('缺少引擎测试报告');desktop(['--acceptance-test','--acceptance-dir='+dirs[0]],true);break;
 }
 case 'sync':require('./sync-payload.cjs').sync();break;
 case 'installer':node('scripts/build-installer.cjs');break;
 default:throw Error('支持 start / check / test / test-save / timeline / native-test / sync / installer');
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
