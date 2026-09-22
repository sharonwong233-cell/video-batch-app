'use strict';
// Fetch only public dependency archives; hashes are verified before extraction.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {Readable}=require('node:stream'),{pipeline}=require('node:stream/promises');
const root=path.resolve(__dirname,'..'),cache=path.join(root,'.build-cache');
async function download(url,file,algorithm,expected,encoding='hex'){
 if(!fs.existsSync(file)){
  console.log('下载 '+url);const response=await fetch(url,{signal:AbortSignal.timeout(600000)});
  if(!response.ok)throw Error('下载失败 HTTP '+response.status);
  const temp=file+'.part';await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(temp));
  const digest=crypto.createHash(algorithm).update(fs.readFileSync(temp)).digest(encoding);
  if(digest!==expected)throw Error('校验失败，请删除对应 .part 下载缓存后重试：'+temp);
  fs.renameSync(temp,file);
 }
 if(crypto.createHash(algorithm).update(fs.readFileSync(file)).digest(encoding)!==expected)throw Error('已缓存文件校验失败，请检查：'+file);
}
function run(exe,args){const p=spawnSync(exe,args,{stdio:'inherit'});if(p.error)throw p.error;if(p.status!==0)throw Error('解压失败：'+exe);}
function unzip(file,dest){
 const q=s=>"'"+s.replaceAll("'","''")+"'";
 run('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath "+q(file)+' -DestinationPath '+q(dest)]);
}
async function main(){
 if(process.platform!=='win32'||process.arch!=='x64')throw Error('此准备脚本仅支持 Windows x64。');
 fs.mkdirSync(cache,{recursive:true});
 const payload=path.join(root,'FrameFlow-Windows-x64');
 if(!fs.existsSync(path.join(payload,'FrameFlow.exe'))){
  const base='https://github.com/electron/electron/releases/download/v43.4.1/';
  const name='electron-v43.4.1-win32-x64.zip',res=await fetch(base+'SHASUMS256.txt',{signal:AbortSignal.timeout(60000)});
  if(!res.ok)throw Error('无法获取 Electron 官方校验表');
  const line=(await res.text()).split('\n').find(l=>l.trim().endsWith(name));const hash=line?.trim().split(/\s+/)[0];
  if(!/^[a-f0-9]{64}$/.test(hash||''))throw Error('缺少 Electron 校验值');
  const zip=path.join(cache,name);await download(base+name,zip,'sha256',hash);
  const temp=fs.mkdtempSync(path.join(cache,'electron-'));unzip(zip,path.join(temp,'payload'));
  if(fs.existsSync(payload))throw Error('目标运行时目录已存在但不完整，请移走后重试，未覆盖现有文件。');
  fs.renameSync(path.join(temp,'payload'),payload);fs.renameSync(path.join(payload,'electron.exe'),path.join(payload,'FrameFlow.exe'));
 }
 const ffzip=path.join(cache,'ffmpeg-9.0.1-essentials_build.zip');
 await download('https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.1-essentials_build.zip',ffzip,'sha256','fec81ae03971d9dd4be3ebe02e263bd2ec1d789483f931bdba5f5715e65da2e9');
 const extracted=fs.mkdtempSync(path.join(cache,'ffmpeg-'));unzip(ffzip,path.join(extracted,'archive'));
 const ffroot=path.join(extracted,'archive','ffmpeg-9.0.1-essentials_build'),runtime=path.join(root,'runtime/win32');fs.mkdirSync(runtime,{recursive:true});
 for(const [from,to] of [['bin/ffmpeg.exe','ffmpeg.exe'],['bin/ffprobe.exe','ffprobe.exe'],['LICENSE','LICENSE'],['README.txt','README.txt']])fs.copyFileSync(path.join(ffroot,from),path.join(runtime,to));
 if(process.argv.includes('--installer')){
  const archive=path.join(cache,'nsis-3.0.4.1-api.7z');
  await download('https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-3.0.4.1/nsis-3.0.4.1.7z',archive,'sha512','VKMiizYdmNdJOWpRGz4trl4lD++BvYP2irAXpMilheUP0pc93iKlWAoP843Vlraj8YG19CVn0j+dCo/hURz9+Q==','base64');
  const seven=process.env.FRAMEFLOW_7ZIP||path.join(process.env.ProgramFiles||'C:\\Program Files','7-Zip/7z.exe');
  if(!fs.existsSync(seven))throw Error('编译安装器需要 7-Zip。安装后重新运行，或设置 FRAMEFLOW_7ZIP 为 7z.exe 的完整路径。');
  run(seven,['x','-y',archive,'-o'+path.join(cache,'nsis-3.0.4.1')]);
 }
 require('./sync-payload.cjs').sync();console.log('准备完成，运行 npm run check，再运行 npm start。');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
