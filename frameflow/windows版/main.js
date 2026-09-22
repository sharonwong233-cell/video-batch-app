'use strict';
const {app,BrowserWindow,dialog,ipcMain,shell,protocol}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {Readable}=require('node:stream');
const {pathToFileURL}=require('node:url');
const {randomUUID}=require('node:crypto');
const appRoot=fs.existsSync(path.join(__dirname,'frameflow-engine.js'))?__dirname:path.dirname(__dirname);
const {Engine}=require(path.join(appRoot,'frameflow-engine'));
const C=require(path.join(appRoot,'frameflow-core'));
const devProfile=app.commandLine.getSwitchValue('dev-profile');
if(devProfile){if(!path.isAbsolute(devProfile))throw Error('开发配置目录必须是绝对路径。');fs.mkdirSync(devProfile,{recursive:true});app.setPath('userData',devProfile);}
const engine=new Engine(appRoot===__dirname?path.join(__dirname,'runtime'):path.join(appRoot,'runtime',process.platform));
let sessionWrites=Promise.resolve();
async function saveSession(contents){
  if(typeof contents!=='string'||Buffer.byteLength(contents)>10*1024*1024)throw Error('项目内容无效或过大。');
  const clean=JSON.stringify(C.parse(contents));
  const task=sessionWrites.catch(()=>{}).then(async()=>{const target=path.join(app.getPath('userData'),'session.json'),temp=target+'.'+randomUUID()+'.tmp';await fs.promises.mkdir(path.dirname(target),{recursive:true});await fs.promises.writeFile(temp,clean);await fs.promises.rename(temp,target);return true;});
  sessionWrites=task;return task;
}
async function loadSession(){
  let contents;try{contents=await fs.promises.readFile(path.join(app.getPath('userData'),'session.json'),'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}
  const parsed=C.parse(contents),media=[];for(const f of parsed.files){try{media.push(await describe(f.path));}catch{media.push(null);}}return {contents:JSON.stringify(parsed),media};
}

const mediaPaths=new Map();
const playbackProxies=new Map();let playbackDirectory;
const videoExtensions=new Set(['.mp4','.mov','.m4v','.webm','.mkv','.avi','.wmv','.mpeg','.mpg']);
let window=null,projectPath='',dirty=false,closeApproved=false;
let preferences={output:'',baseName:'课程视频',importDirectory:''};
if(!app.requestSingleInstanceLock()){app.quit();}
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});

protocol.registerSchemesAsPrivileged([{scheme:'frameflow-media',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);

async function describe(filePath){
  const absolute=path.resolve(filePath),stat=fs.statSync(absolute);
  if(!stat.isFile())throw Error('所选路径不是文件。');
  const token=randomUUID();mediaPaths.set(token,absolute);
  const meta=await engine.probe(absolute);
  return {...meta,name:path.basename(absolute),path:absolute,size:stat.size,url:'frameflow-media://asset/'+token};
}
async function describeMany(paths){
  const result=[];for(const filePath of paths.filter(value=>typeof value==='string'&&videoExtensions.has(path.extname(value).toLowerCase())).slice(0,1000)){
    try{result.push(await describe(filePath));}catch(error){result.push({name:path.basename(filePath),path:filePath,error:error.message});}
  }return result;
}
function mediaType(filePath){
  return ({'.mp4':'video/mp4','.m4v':'video/x-m4v','.mov':'video/quicktime','.webm':'video/webm','.mkv':'video/x-matroska','.avi':'video/x-msvideo','.wmv':'video/x-ms-wmv','.mpeg':'video/mpeg','.mpg':'video/mpeg'})[path.extname(filePath).toLowerCase()]||'application/octet-stream';
}
async function mediaResponse(request,filePath){
  const stat=await fs.promises.stat(filePath),size=stat.size,range=request.headers.get('range');
  const headers=new Headers({'Accept-Ranges':'bytes','Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Accept-Ranges, Content-Length, Content-Range','Cache-Control':'no-store','Content-Type':mediaType(filePath)});
  let start=0,end=Math.max(0,size-1),status=200;
  if(range){
    const match=/^bytes=(\d*)-(\d*)$/i.exec(range.trim());
    if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{...Object.fromEntries(headers),'Content-Range':`bytes */${size}`}});
    if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return new Response(null,{status:416,headers:{...Object.fromEntries(headers),'Content-Range':`bytes */${size}`}});start=Math.max(0,size-suffix);}
    else{start=Number(match[1]);if(match[2])end=Number(match[2]);}
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return new Response(null,{status:416,headers:{...Object.fromEntries(headers),'Content-Range':`bytes */${size}`}});
    end=Math.min(end,size-1);status=206;headers.set('Content-Range',`bytes ${start}-${end}/${size}`);
  }
  const length=size?end-start+1:0;headers.set('Content-Length',String(length));
  const body=request.method==='HEAD'||!length?null:Readable.toWeb(fs.createReadStream(filePath,{start,end}));
  return new Response(body,{status,headers});
}
async function loadPreferences(){
  try{
    const data=JSON.parse(await fs.promises.readFile(path.join(app.getPath('userData'),'preferences.json'),'utf8'));
    if(typeof data.output==='string')preferences.output=data.output;
    if(typeof data.baseName==='string'&&data.baseName.trim())preferences.baseName=data.baseName.slice(0,100);
    if(typeof data.importDirectory==='string')preferences.importDirectory=data.importDirectory;
  }catch{}
  return preferences;
}
async function savePreferences(next={}){
  if(typeof next.output==='string')preferences.output=next.output;
  if(typeof next.baseName==='string'&&next.baseName.trim())preferences.baseName=next.baseName.slice(0,100);
  if(typeof next.importDirectory==='string')preferences.importDirectory=next.importDirectory;
  const target=path.join(app.getPath('userData'),'preferences.json'),temp=target+'.'+randomUUID()+'.tmp';
  await fs.promises.mkdir(path.dirname(target),{recursive:true});
  await fs.promises.writeFile(temp,JSON.stringify(preferences,null,2),'utf8');
  await fs.promises.rename(temp,target);
  return preferences;
}
async function chooseVideos(single=false){
  const result=await dialog.showOpenDialog(window,{
    title:single?'重新定位视频':'导入视频',
    defaultPath:preferences.importDirectory||app.getPath('videos'),
    properties:single?['openFile']:['openFile','multiSelections'],
    filters:[{name:'视频文件',extensions:[...videoExtensions].map(value=>value.slice(1))},{name:'所有文件',extensions:['*']}]
  });
  if(result.canceled)return single?null:[];
  await savePreferences({importDirectory:path.dirname(result.filePaths[0])});
  const files=await describeMany(result.filePaths);return single?(files[0]||null):files;
}
async function saveProject(contents){
  if(typeof contents!=='string'||Buffer.byteLength(contents)>10*1024*1024)throw Error('项目文件过大或内容无效。');
  contents=JSON.stringify(C.parse(contents));
  const result=await dialog.showSaveDialog(window,{title:'保存 FrameFlow 项目',defaultPath:projectPath||path.join(app.getPath('documents'),'课程剪辑项目.vproject.json'),filters:[{name:'FrameFlow 项目',extensions:['json']}]});
  if(result.canceled||!result.filePath)return {saved:false};
  const target=result.filePath,temp=target+'.'+process.pid+'.tmp';
  await fs.promises.writeFile(temp,contents,'utf8');
  try{await fs.promises.rename(temp,target);}catch(error){await fs.promises.rm(temp,{force:true});throw error;}
  projectPath=target;return {saved:true,path:target};
}
async function openProject(){
  const result=await dialog.showOpenDialog(window,{title:'打开 FrameFlow 项目',properties:['openFile'],filters:[{name:'FrameFlow 项目',extensions:['json']}]});
  if(result.canceled||!result.filePaths[0])return null;
  const target=result.filePaths[0],stat=await fs.promises.stat(target);if(stat.size>10*1024*1024)throw Error('项目文件超过 10 MB。');
  const contents=await fs.promises.readFile(target,'utf8'),parsed=JSON.parse(contents);
  if(!parsed||![1,2,3].includes(parsed.version)||!Array.isArray(parsed.files))throw Error('不是受支持的 FrameFlow 项目文件。');
  projectPath=target;
  const media=[];for(const file of parsed.files){try{media.push(await describe(file.path));}catch{media.push(null);}}
  return {contents,media};
}
async function handleNative(event,message={}){
  if(!window||event.sender!==window.webContents)throw Error('无效的应用请求。');
  switch(message.action){
    case 'health':return engine.health();
    case 'saveSession':return saveSession(message.contents);
    case 'loadSession':return loadSession();
    case 'prepareExport':{const p=await engine.prepare(message.project);return {width:p.width,height:p.height,fps:p.fps,bitrate:p.bitrate,copy:p.copy,warnings:p.warnings,segments:p.plan.segments.length,summary:p.groups.map(g=>(g.files.length>1?'拼接 '+g.files.length+' 个视频':g.files[0].name)+'：'+(g.copy?'直接复制 · '+g.files[0].codec.toUpperCase():'容错/重新编码 · H.264')+' · '+(g.copy?g.files[0].width:g.width)+' × '+(g.copy?g.files[0].height:g.height)).join('\n')};}
    case 'startExport':return engine.start(message.project);
    case 'jobStatus':return engine.status();
    case 'cancelExport':return engine.cancel();
    case 'previewFrame':return engine.preview(message.file,message.time,message.baseline,message.settings,message.images);
    case 'playbackProxy':{
      if(![...mediaPaths.values()].includes(message.path))throw Error('请先导入该视频。');
      if(!playbackProxies.has(message.path)){const task=(async()=>{playbackDirectory??=await fs.promises.mkdtemp(path.join(app.getPath('temp'),'frameflow-playback-'));const dest=path.join(playbackDirectory,randomUUID()+'.mp4');await engine.playback(message.path,dest);const token=randomUUID();mediaPaths.set(token,dest);return {url:'frameflow-media://asset/'+token};})();playbackProxies.set(message.path,task);task.catch(()=>playbackProxies.delete(message.path));}
      return playbackProxies.get(message.path);
    }
    case 'showOutput':{const output=engine.status()?.outputs?.find(f=>f.path===message.path);if(!output)throw Error('未找到本次输出文件。');shell.showItemInFolder(output.path);return true;}
    case 'dirty':dirty=!!message.value;return true;
    case 'loadPreferences':return preferences;
    case 'savePreferences':return savePreferences({output:message.output,baseName:message.baseName});
    case 'importVideos':return chooseVideos(false);
    case 'relink':return chooseVideos(true);
    case 'describePaths':{
      const paths=Array.isArray(message.paths)?message.paths:[];
      if(paths[0])await savePreferences({importDirectory:path.dirname(paths[0])});
      return describeMany(paths);
    }
    case 'saveProject':return saveProject(message.contents);
    case 'openProject':return openProject();
    case 'chooseDirectory':{
      const result=await dialog.showOpenDialog(window,{title:'选择输出目录',defaultPath:preferences.output||preferences.importDirectory||app.getPath('videos'),properties:['openDirectory','createDirectory']});
      if(result.canceled)return '';
      await savePreferences({output:result.filePaths[0]});return result.filePaths[0];
    }
    case 'openDirectory':{
      if(typeof message.path!=='string'||!message.path.trim())throw Error('尚未选择输出目录。');
      const error=await shell.openPath(message.path);if(error)throw Error(error);return true;
    }
    case 'closeApproved':await engine.shutdown();closeApproved=true;dirty=false;window.close();return true;
    default:throw Error('不支持的系统操作。');
  }
}
function createWindow(){
  const page=path.join(appRoot,appRoot===__dirname?'app.html':'视频处理应用-高保真交互原型.html');
  window=new BrowserWindow({
    title:'FrameFlow '+require('./package.json').version+' 课程剪辑',width:1440,height:900,minWidth:1100,minHeight:700,
    backgroundColor:'#080b0d',autoHideMenuBar:true,show:!app.commandLine.hasSwitch('smoke-test'),
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}
  });
  window.loadFile(page);
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(url!==pathToFileURL(page).toString())event.preventDefault();});
  window.on('close',event=>{if(!closeApproved){event.preventDefault();window.webContents.executeJavaScript('window.frameFlowRequestClose()').catch(()=>{});}});
  window.on('closed',()=>{window=null;});
  if(app.commandLine.hasSwitch('smoke-test'))window.webContents.once('did-finish-load',runSmokeTest);
  if(app.commandLine.hasSwitch('acceptance-test'))window.webContents.once('did-finish-load',()=>require(path.join(appRoot,'native-acceptance.cjs'))(window,engine,app));
  if(app.commandLine.hasSwitch('timeline-test'))window.webContents.once('did-finish-load',()=>require(path.join(appRoot,'timeline-acceptance.cjs'))(window,app));
}
function smokeScript(media){
  const lines=[
    '(async()=>{',
    'const wait=async test=>{const until=Date.now()+15000;while(Date.now()<until&&!test())await new Promise(resolve=>setTimeout(resolve,80));};',
    'const initial=FrameFlow.getProject().files.length===0;',
    'const onlyNew=document.querySelectorAll(".title-actions button").length===1;',
    'const importProminent=document.querySelector("#importBtn").getBoundingClientRect().height>document.querySelector(".sidebar").getBoundingClientRect().height*.7;',
    'const prefs=await FrameFlow.native("loadPreferences");',
    'let canvasReadable=false,seekWorks=false,seekBackWorks=false,rangeSeekWorks=false,timeRange=false,timeResize=false,selection=false,timelineClips=false,seekable=false;'
  ];
  if(media.length)lines.push(
    'const files=await FrameFlow.native("describePaths",{paths:'+JSON.stringify(media)+'});',
    'await FrameFlow.addMedia(files);',
    'const video=document.querySelector("#videoPlayer");',
    'await wait(()=>FrameFlow.getProject().files.length===files.length&&FrameFlow.getProject().files.every(file=>file.duration>0)&&video.readyState>=2);',
    'await wait(()=>video.seekable.length>0);seekable=video.seekable.length>0;',
    'timelineClips=document.querySelectorAll(".track .timeline-video").length===files.length;',
    'video.currentTime=0;document.querySelector("#nextBtn").click();await wait(()=>video.currentTime>.9);seekWorks=video.currentTime>.9;',
    'document.querySelector("#prevBtn").click();await wait(()=>video.currentTime<.1);seekBackWorks=video.currentTime<.1;',
    'const seek=document.querySelector("#seek");seek.value="1.2";seek.dispatchEvent(new Event("input",{bubbles:true}));await wait(()=>video.currentTime>1.1);rangeSeekWorks=video.currentTime>1.1;',
    'document.querySelector("#addMaskBtn").click();await new Promise(requestAnimationFrame);',
    'timeRange=!!document.querySelector(".mask-range");selection=document.querySelectorAll(".asset.selected").length===files.length;',
    'const bar=document.querySelector(".mask-range"),lane=bar?.parentElement,handle=bar?.querySelector("[data-edge=end]");if(bar&&lane&&handle){const rect=lane.getBoundingClientRect();bar.onpointerdown({preventDefault(){},target:handle,pointerId:1,clientX:rect.right});bar.onpointermove({clientX:rect.left+rect.width*.85});bar.onpointerup();const p=FrameFlow.getProject(),active=p.files[p.files.length-1];timeResize=active.masks[0].end<active.duration;}',
    'try{const canvas=document.querySelector("#effectCanvas");canvas.getContext("2d").getImageData(0,0,1,1);canvasReadable=canvas.width>1;}catch{}',
    'await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));'
  );
  lines.push(
    'const p=FrameFlow.getProject(),active=p.files[p.files.length-1];return {initial,onlyNew,importProminent,dropZone:typeof document.querySelector(".sidebar").ondrop==="function",preferences:!!prefs&&typeof prefs.baseName==="string",platform:window.frameFlowNative.platform,files:p.files.length,masks:active?.masks.length||0,duration:active?.duration||0,canvasReadable,seekWorks,seekBackWorks,rangeSeekWorks,timeRange,timeResize,selection,timelineClips,seekable};',
    '})()'
  );
  return lines.join('');
}
async function runSmokeTest(){
  try{
    const media=[app.commandLine.getSwitchValue('smoke-test-media'),app.commandLine.getSwitchValue('smoke-test-media-2')].filter(Boolean);
    const result=await window.webContents.executeJavaScript(smokeScript(media));
    const screenshot=app.commandLine.getSwitchValue('smoke-test-output');if(screenshot){const image=await window.webContents.capturePage();await fs.promises.writeFile(screenshot,image.toPNG());}
    const mediaOK=!media.length||(result.files===media.length&&result.masks===1&&result.duration>0&&result.canvasReadable&&result.seekWorks&&result.seekBackWorks&&result.rangeSeekWorks&&result.timeRange&&result.timeResize&&result.selection&&result.timelineClips&&result.seekable);
    const ok=result.initial&&result.onlyNew&&result.importProminent&&result.dropZone&&result.preferences&&result.platform==='Windows'&&mediaOK;
    console.log('FRAMEFLOW_WINDOWS_SMOKE '+JSON.stringify(result));app.exit(ok?0:1);
  }catch(error){console.error('FRAMEFLOW_WINDOWS_SMOKE_FAIL',error);app.exit(1);}
}

ipcMain.handle('frameflow',handleNative);
app.whenReady().then(async()=>{
  await loadPreferences();
  protocol.handle('frameflow-media',async request=>{
    const url=new URL(request.url),filePath=url.hostname==='asset'?mediaPaths.get(decodeURIComponent(url.pathname.slice(1))):null;
    if(!filePath)return new Response('Not found',{status:404});
    try{return await mediaResponse(request,filePath);}
    catch(error){console.error('[frameflow-media] 读取失败',path.basename(filePath),error);return new Response('Media read failed',{status:500});}
  });
  createWindow();
});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
app.on('window-all-closed',()=>app.quit());
app.on('will-quit',()=>{if(playbackDirectory)try{fs.rmSync(playbackDirectory,{recursive:true,force:true});}catch{}});
