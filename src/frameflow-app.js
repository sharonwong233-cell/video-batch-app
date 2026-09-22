'use strict';
(() => {
const C=FrameFlowCore,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const bridge=window.frameFlowNative||window.webkit?.messageHandlers?.frameflow,assets=new Map(),pending=new Map();
let project=C.initial(),saved=JSON.stringify(project),current='',region='',page='editor',history=[],future=[],job=null,timer=null,toastTimer,saving=false,importing=false,generation=0,modalResolve,previousFocus,picking=false;
let autosaveTimer,booting=true,engineReady=false,preparing=false;
async function flushSession(){clearTimeout(autosaveTimer);if(!bridge||booting)return true;const snapshot=JSON.stringify(project);try{await native('saveSession',{contents:snapshot});saved=snapshot;syncDirty(false);return true;}catch(e){$('#saveState').textContent='自动保存失败';toast('项目保存失败',e.message);return false;}}
const video=$('#videoPlayer'),canvas=$('#effectCanvas'),ctx=canvas.getContext('2d'),sample=document.createElement('canvas'),patch=document.createElement('canvas');
const supportsCanvasBlur='filter' in ctx;
const maskImages=new Map();
function maskImage(id){if(!Object.hasOwn(project.images||{},id))return null;const data=project.images[id];let cached=maskImages.get(id);if(!cached||cached.data!==data){const img=new Image();img.onload=draw;img.src=data;cached={data,img};maskImages.set(id,cached);}return cached.img.complete&&cached.img.naturalWidth?cached.img:null;}
const currentFile=()=>project.files.find(f=>f.id===current),currentMask=()=>currentFile()?.masks.find(m=>m.id===region);
const running=()=>job?.state==='running'||preparing,dirty=()=>JSON.stringify(project)!==saved;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const bytes=value=>value>=1024**3?(value/1024**3).toFixed(2)+' GB':value>=1024**2?(value/1024**2).toFixed(1)+' MB':(value/1024).toFixed(1)+' KB';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(text,action,cls='btn')=>{const b=document.createElement('button');b.className=cls;b.textContent=text;b.onclick=action;return b;};
function toast(title,text=''){clearTimeout(toastTimer);$('#toastTitle').textContent=title;$('#toastText').textContent=text;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function native(action,data={}){
 if(!bridge)return Promise.reject(Error('请在桌面应用中使用此操作。'));
 if(typeof bridge.invoke==='function')return bridge.invoke(action,data);
 const requestId=C.id();
 return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{pending.delete(requestId);reject(Error('系统操作未完成，请重试。'));},300000);pending.set(requestId,{resolve,reject,timeout});bridge.postMessage({action,requestId,...data});});
}
window.frameFlowNativeReply=reply=>{const p=pending.get(reply.requestId);if(!p)return;clearTimeout(p.timeout);pending.delete(reply.requestId);reply.error?p.reject(Error(reply.error)):p.resolve(reply.result);};
async function applyHostPreferences(){
 if(!bridge||project.files.length||dirty())return;
 try{const prefs=await native('loadPreferences');if(prefs?.output)project.settings.output=prefs.output;if(prefs?.baseName)project.settings.baseName=prefs.baseName;saved=JSON.stringify(project);render();syncDirty();}catch{}
}
function rememberPreferences(){if(bridge)native('savePreferences',{output:project.settings.output,baseName:project.settings.baseName}).catch(e=>toast('偏好保存失败',e.message));}
function syncDirty(schedule=true){const value=dirty();$('#saveState').textContent=saving?'正在保存…':value?'正在自动保存…':project.files.length?'已自动保存':'新项目';document.body.dataset.dirty=value?'1':'';if(typeof bridge?.invoke==='function')bridge.invoke('dirty',{value}).catch(()=>{});else bridge?.postMessage({action:'dirty',value});if(schedule&&value&&!booting){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(flushSession,500);}}
function checkpoint(){history.push(C.clone(project));if(history.length>50)history.shift();future=[];}
function changed(){if(!running())job=null;syncDirty();render();}
function edit(fn){if(running()||importing)return;checkpoint();fn();changed();}
function closeModal(value=null){$('#modal').classList.add('hidden');$('#modalPreview').replaceChildren();const done=modalResolve;modalResolve=null;previousFocus?.focus?.();done?.(value);}
function dialog(title,text,choices=[['关闭','close']],preview=null){
 if(modalResolve)closeModal();previousFocus=document.activeElement;$('#modalTitle').textContent=title;$('#modalText').textContent=text;
 $('#modalActions').replaceChildren(...choices.map(([label,value])=>button(label,()=>closeModal(value),value==='save'||value==='confirm'?'btn primary':'btn')));
 $('#modalPreview').classList.toggle('hidden',!preview);$('#modalPreview').replaceChildren(...(preview?[preview]:[]));$('#modal').classList.remove('hidden');$('#modalActions button')?.focus();return new Promise(resolve=>{modalResolve=resolve;});
}
async function mayReplace(){
 if(importing||saving||preparing){toast('请等待当前操作完成');return false;}if(running()){toast('请先取消当前任务');return false;}if(bridge)return await dialog('新建项目？','当前项目将被替换。新建后自动恢复的将是新项目，请确认已完成当前编辑。',[['取消','cancel'],['新建项目','confirm']])==='confirm';if(!dirty())return true;
 const answer=await dialog('保存当前项目？','未保存的素材顺序、打码区域和片段设置将丢失。',[['取消','cancel'],['不保存','discard'],['保存后继续','save']]);
 return answer==='discard'||(answer==='save'&&await saveProject());
}
async function saveProject(){
 if(saving||importing)return false;saving=true;syncDirty();if($('#saveBtn'))$('#saveBtn').disabled=true;
 const snapshot=JSON.stringify(project),contents=JSON.stringify(project,null,2);
 try{
  if(bridge){const result=await native('saveProject',{contents});if(!result?.saved)return false;}
  else{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([contents],{type:'application/json'}));a.href=url;a.download='课程剪辑项目.vproject.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  saved=snapshot;toast('项目已保存',bridge?'已写入所选项目文件':'已下载配置；重开后需要重新定位源视频');return true;
 }catch(error){await dialog('项目保存失败',error.message);return false;}
 finally{saving=false;if($('#saveBtn'))$('#saveBtn').disabled=false;syncDirty();}
}
function reset(next=C.initial(),runtime=[]){
 generation++;resumeAfterScrub=false;scrub=null;maskImages.clear();video.pause();video.removeAttribute('src');video.load();assets.forEach(a=>{if(a.url?.startsWith('blob:'))URL.revokeObjectURL(a.url);});assets.clear();
 project=next;history=[];future=[];job=null;clearInterval(timer);current=project.files[0]?.id||'';region='';page='editor';
 project.files.forEach((f,i)=>{const r=runtime[i];assets.set(f.id,r?.url?{...r,status:r.error?'failed':'ready'}:{status:'missing',error:'源文件失效，请重新定位'});});
 saved=JSON.stringify(project);showPage('editor');loadCurrent();syncDirty();
}
async function openProject(){
 if(!await mayReplace())return;if(!bridge){$('#projectInput').click();return;}
 try{const r=await native('openProject');if(r?.contents){const p=C.parse(r.contents);reset(p,r.media);toast('项目已恢复',p.files.some(f=>assets.get(f.id)?.status!=='ready')?'部分素材需要重新定位':'素材顺序与全部打码配置已恢复');}}catch(e){dialog('项目无法打开',e.message);}
}
$('#projectInput').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>10*1024*1024)throw Error('项目文件过大。');reset(C.parse(await file.text()));toast('配置已恢复','请重新定位源视频以继续编辑');}catch(error){dialog('项目无法打开',error.message);}};
function persistentMedia(m){return {id:m.id||C.id(),name:m.name,path:m.path||'',size:m.size||0,duration:m.duration||0,width:m.width||0,height:m.height||0,fps:m.fps||0,bitrate:m.bitrate||0,selected:true,masks:[]};}
async function addMedia(media){
 if(project.files.length+media.length>1000){toast('最多支持 1000 个素材','请分成多个项目处理');return;}
 if(running())return;checkpoint();let added=0;
 for(const m of media){if(!m.name||(!m.url&&!m.error))continue;if(m.path&&project.files.some(f=>f.path===m.path))continue;
  const f=persistentMedia(m);project.files.push(f);assets.set(f.id,{url:m.url,status:m.error?'failed':m.duration?'ready':'loading',error:m.error||''});added++;current=f.id;if(!m.error&&!m.duration)probe(f.id,m.url);}
 region='';changed();loadCurrent();toast(added?'素材已导入':'没有新增素材',added?added+' 个视频已加入项目':'已导入的视频不会重复添加');
}
async function importVideos(){
 if(running()||importing)return;if(!bridge){$('#videoInput').click();return;}importing=true;render();
 try{await addMedia(await native('importVideos')||[]);}catch(e){dialog('导入失败',e.message);}finally{importing=false;render();}
}
async function filesFromBrowser(files,relinkID=null){
 const valid=[...files].filter(f=>f.type.startsWith('video/')||/\.(mp4|mov|m4v|webm|mkv|avi|wmv|mpeg|mpg)$/i.test(f.name));
 if(!valid.length){toast('未导入素材','请选择视频文件');return;}let media;
 try{if(bridge?.getPathForFile){const paths=valid.map(file=>bridge.getPathForFile(file)).filter(Boolean);media=paths.length?await native('describePaths',{paths}):[];}
 else media=valid.map(f=>({name:f.name,size:f.size,url:URL.createObjectURL(f)}));
 }catch(error){dialog('导入失败',error.message);return;}
 if(!media.length){toast('未导入素材','无法读取拖入的文件路径');return;}
 if(relinkID)replaceMedia(relinkID,media[0]);else await addMedia(media);
}
function probe(id,url){
 const epoch=generation,probe=document.createElement('video');probe.preload='metadata';let ended=false;
 const finish=error=>{if(ended)return;ended=true;clearTimeout(timeout);const f=project.files.find(x=>x.id===id);
 if(epoch===generation&&f){const a=assets.get(id);if(error){a.status='failed';a.error=error;}else{Object.assign(f,{duration:probe.duration,width:probe.videoWidth,height:probe.videoHeight});a.status='ready';}syncDirty();render();}
 probe.removeAttribute('src');probe.load();};
 const timeout=setTimeout(()=>finish('读取超时，请重新定位视频或更换格式。'),15000);
 probe.onloadedmetadata=()=>finish(Number.isFinite(probe.duration)&&probe.duration>0?null:'无法读取视频时长。');probe.onerror=()=>finish('当前播放器无法解码该视频，请重新定位为可播放的文件。');probe.src=url;
}
let relinkTarget='';
async function relink(id){if(running())return;if(!bridge){relinkTarget=id;$('#relinkInput').click();return;}try{const r=await native('relink');if(r)replaceMedia(id,r);}catch(e){dialog('重新定位失败',e.message);}}
function replaceMedia(id,m){edit(()=>{const f=project.files.find(f=>f.id===id);if(!f)return;const masks=f.masks,selected=f.selected;Object.assign(f,persistentMedia({...m,id}),{masks,selected});assets.set(id,{url:m.url,status:m.error?'failed':m.duration?'ready':'loading',error:m.error||''});current=id;});if(!m.error&&!m.duration)probe(id,m.url);loadCurrent();}
window.frameFlowDropped=media=>{if(running()||importing){toast('请等待当前任务完成');return;}addMedia(media);};
$('#videoInput').onchange=e=>{filesFromBrowser(e.target.files);e.target.value='';};$('#relinkInput').onchange=e=>{filesFromBrowser(e.target.files,relinkTarget);e.target.value='';};
$('#importBtn').onclick=importVideos;
const dropZone=$('.sidebar');dropZone.ondragenter=e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();dropZone.classList.add('drag-over');}};dropZone.ondragover=e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}};
dropZone.ondragleave=e=>{if(!dropZone.contains(e.relatedTarget))dropZone.classList.remove('drag-over');};dropZone.ondrop=e=>{const files=e.dataTransfer?.files;if(!files?.length)return;e.preventDefault();dropZone.classList.remove('drag-over');if(!running())filesFromBrowser(files);};
function selectFile(id){video.pause();current=id;region=currentFile()?.masks[0]?.id||'';picking=false;render();loadCurrent();}
function loadCurrent(){const a=assets.get(current);video.pause();if(a?.url&&a.status!=='missing'&&a.status!=='failed'){if(video.getAttribute('src')!==a.url){video.src=a.url;video.load();}}else{video.removeAttribute('src');video.load();}renderMasks();draw();}
function drawTo(target,width,height){
 target.clearRect(0,0,width,height);if(video.readyState<2||!video.videoWidth)return;
 sample.width=width;sample.height=height;sample.getContext('2d').drawImage(video,0,0,width,height);target.drawImage(sample,0,0);
 const f=currentFile(),time=video.currentTime;for(const m of f?.masks||[]){const timing=C.range(m,f.duration);if(!m.enabled||time<timing.start||time>timing.end)continue;const x=m.x*width,y=m.y*height,w=m.w*width,h=m.h*height;target.save();target.beginPath();target.rect(x,y,w,h);target.clip();
 if(m.type==='模糊'||m.type==='马赛克')sample.getContext('2d').drawImage(target.canvas,0,0);
 if(m.type==='图片'){const img=maskImage(m.imageId);if(img)target.drawImage(img,x,y,w,h);}else if(m.type==='纯色'){target.fillStyle=m.color;target.fillRect(x,y,w,h);}else if(m.type==='模糊'&&supportsCanvasBlur){target.filter='blur('+(m.strength*width/960)+'px)';target.drawImage(sample,0,0);}
 else{const cell=Math.max(2,m.strength*width/960);patch.width=Math.max(1,Math.ceil(w/cell));patch.height=Math.max(1,Math.ceil(h/cell));patch.getContext('2d').drawImage(sample,x,y,w,h,0,0,patch.width,patch.height);target.imageSmoothingEnabled=m.type==='模糊';target.imageSmoothingQuality='high';target.drawImage(patch,0,0,patch.width,patch.height,x,y,w,h);}target.restore();}
}
function frameRect(){const box=$('#viewer').getBoundingClientRect(),f=currentFile(),ratio=(f?.width||16)/(f?.height||9),w=Math.min(box.width,box.height*ratio),h=w/ratio;return {x:(box.width-w)/2,y:(box.height-h)/2,w,h};}
function draw(){
 const r=frameRect(),ratio=devicePixelRatio||1;canvas.width=Math.max(1,Math.round(r.w*ratio));canvas.height=Math.max(1,Math.round(r.h*ratio));canvas.style.cssText='left:'+r.x+'px;top:'+r.y+'px;width:'+r.w+'px;height:'+r.h+'px';$('#maskLayer').style.cssText=canvas.style.cssText;
 try{drawTo(ctx,canvas.width,canvas.height);}catch(e){toast('画面预览失败',e.message);}
}
let raf;function animate(){cancelAnimationFrame(raf);draw();if(!video.paused)raf=requestAnimationFrame(animate);}
video.onplay=()=>{playState();animate();};video.onpause=playState;video.onended=playState;
function playState(){$('#playBtn').textContent=video.paused?'▶':'Ⅱ';$('#playBtn').setAttribute('aria-label',video.paused?'播放':'暂停');}
video.onloadedmetadata=()=>{const f=currentFile();if(!f)return;if(Number.isFinite(video.duration)&&!f.fps){Object.assign(f,{duration:video.duration,width:video.videoWidth,height:video.videoHeight});syncDirty();}const requested=pendingSeek;pendingSeek=null;render();if(requested!=null)seekTo(requested);draw();};
video.onloadeddata=()=>{const a=assets.get(current);if(a){a.status='ready';a.error='';}render();draw();};
video.onerror=async()=>{if(!video.getAttribute('src'))return;const id=current,f=currentFile(),a=assets.get(id);if(!a)return;if(bridge&&f?.path&&!a.proxyAttempted){a.proxyAttempted=true;a.status='loading';a.error='正在生成兼容播放副本，原视频保持不变…';render();try{const proxy=await native('playbackProxy',{path:f.path});if(assets.get(id)!==a)return;a.url=proxy.url;a.status='ready';a.error='';if(current===id)loadCurrent();render();}catch(e){a.status='failed';a.error='兼容播放副本生成失败：'+e.message;render();}}else{a.status='failed';a.error='播放器无法读取该视频。可重新定位源文件后继续。';render();}};
function timelineContext(){const files=project.files,total=files.reduce((sum,item)=>sum+Math.max(0,Number(item.duration)||0),0),index=files.findIndex(item=>item.id===current),offset=index<0?0:files.slice(0,index).reduce((sum,item)=>sum+Math.max(0,Number(item.duration)||0),0);return {files,total,offset};}
let pendingSeek=null,resumeAfterScrub=false;
function resumeScrub(){if(resumeAfterScrub&&video.readyState>=2&&!video.seeking){resumeAfterScrub=false;video.play().catch(()=>{});}}
// All timeline elements use the same unpadded surface and global seconds.
function timePercent(seconds,total){return (total?seconds/total*100:0)+'%';}
function placeTime(el,start,end,total){el.style.left=timePercent(start,total);if(end!==undefined)el.style.width=timePercent(end-start,total);}
function updateTransport(){const duration=currentFile()?.duration||0,time=clamp(Number(video.currentTime)||0,0,duration),timeline=timelineContext();$('#timecode').textContent=C.format(time)+' / '+C.format(duration);$('#seek').max=duration||1;$('#seek').value=time;$('#playhead').textContent=C.format(timeline.offset+time);placeTime($('#timelinePlayhead'),timeline.offset+time,undefined,timeline.total);}
function seekTo(value){const duration=Number.isFinite(video.duration)&&video.duration>0?video.duration:currentFile()?.duration||0;if(!(duration>0))return;const target=clamp(Math.round((Number(value)||0)*1000000)/1000000,0,duration);if(video.readyState<1){pendingSeek=target;return;}try{pendingSeek=null;video.currentTime=target;updateTransport();draw();}catch(error){pendingSeek=target;toast('正在准备定位','视频可跳转后会自动到达所选位置');}}
function updatePreviewAvailability(){$('#previewBtn').disabled=!currentFile()||assets.get(current)?.status!=='ready'||running()||video.readyState<2;}
video.onseeked=()=>{updateTransport();updatePreviewAvailability();draw();resumeScrub();};video.ontimeupdate=updateTransport;
video.addEventListener('canplay',updatePreviewAvailability);
video.addEventListener('canplay',resumeScrub);
$('#playBtn').onclick=async()=>{try{video.paused?await video.play():video.pause();}catch(e){toast('无法播放视频',e.message);}};
$('#prevBtn').onclick=()=>seekTo(video.currentTime-1);$('#nextBtn').onclick=()=>seekTo(video.currentTime+1);$('#seek').oninput=$('#seek').onchange=e=>seekTo(e.target.value);
new ResizeObserver(draw).observe($('#viewer'));
function renderAssets(){
 const list=$('.asset-list');list.replaceChildren();if(!project.files.length){list.innerHTML='<div class="asset-empty"><span><b>暂无视频素材</b><small>通过上方区域导入或拖入视频</small></span></div>';return;}
 project.files.forEach((f,index)=>{
 const a=assets.get(f.id)||{status:'missing'},row=document.createElement('div');row.className='asset '+(f.selected?'selected ':'unselected ')+(current===f.id?'active ':'')+(a.status==='ready'?'':a.status==='loading'?'loading':'failed');row.dataset.id=f.id;
 const check=document.createElement('input');check.type='checkbox';check.checked=f.selected;check.disabled=running();check.setAttribute('aria-label','选择 '+f.name);check.onchange=()=>edit(()=>f.selected=check.checked);
 const select=button('',()=>selectFile(f.id),'select-asset asset-name');select.title=f.name;select.innerHTML='<b>'+escape(f.name)+'</b><small>'+(a.status==='ready'?C.format(f.duration)+' · '+f.width+' × '+f.height+(f.fps?' · '+f.fps.toFixed(2)+' fps':''):a.status==='loading'?'正在读取…':escape(a.error||'源文件失效，请重新定位'))+'</small>';
 const actions=document.createElement('div');actions.className='asset-actions';const move=delta=>edit(()=>{const next=index+delta;if(next>=0&&next<project.files.length){project.files.splice(index,1);project.files.splice(next,0,f);}});
 const up=button('上移',()=>move(-1)),down=button('下移',()=>move(1)),remove=button('移除',()=>edit(()=>{project.files.splice(index,1);if(current===f.id){current=project.files[0]?.id||'';region='';loadCurrent();}}));
 up.disabled=running()||index===0;down.disabled=running()||index===project.files.length-1;remove.disabled=running();actions.append(up,down,remove);
 if(a.status==='missing'||a.status==='failed'){const locate=button('重新定位',()=>relink(f.id));locate.disabled=running();actions.append(locate);}
 row.append(check,select,actions);row.draggable=!running();row.ondragstart=e=>e.dataTransfer.setData('application/x-frameflow',f.id);
 row.ondragover=e=>e.preventDefault();row.ondrop=e=>{e.preventDefault();const from=e.dataTransfer.getData('application/x-frameflow');if(!from||from===f.id)return;edit(()=>{const i=project.files.findIndex(x=>x.id===from);if(i<0)return;const item=project.files.splice(i,1)[0];project.files.splice(project.files.findIndex(x=>x.id===f.id),0,item);});};list.append(row);
 });
}
function renderMasks(){
 const f=currentFile(),m=currentMask(),available=!!f&&assets.get(current)?.status==='ready';$('#maskLayer').replaceChildren();$('.mask-list').replaceChildren();
 if(!f?.masks.length)$('.mask-list').innerHTML='<small class="muted">暂无打码区域'+(f?'，点击 ＋ 添加':'，请先导入视频')+'</small>';
 (f?.masks||[]).forEach((item,i)=>{
 const row=document.createElement('div');row.className='mask-item'+(item.id===region?' active':'');
 const timing=C.range(item,f.duration),select=button('',()=>{region=item.id;if(video.currentTime<timing.start||video.currentTime>timing.end)seekTo(timing.start);render();},'');select.innerHTML='<b>区域 '+(i+1)+'</b><small>'+item.type+' · '+C.format(timing.start)+'–'+C.format(timing.end)+' · '+(item.enabled?'生效':'已隐藏')+'</small>';
 const visibility=button(item.enabled?'◉':'○',()=>edit(()=>item.enabled=!item.enabled),'btn ghost square');visibility.setAttribute('aria-label',(item.enabled?'隐藏':'显示')+'区域 '+(i+1));visibility.disabled=running();row.append(select,visibility);$('.mask-list').append(row);
 if(!item.enabled||!available)return;const box=document.createElement('div');box.className='maskbox'+(item.id===region?' selected':'');box.dataset.id=item.id;box.dataset.label=item.type+' · 区域 '+(i+1);positionBox(box,item);
 box.innerHTML='<i class="handle tl" data-corner="tl"></i><i class="handle tr" data-corner="tr"></i><i class="handle bl" data-corner="bl"></i><i class="handle br" data-corner="br"></i>';let drag=null;
 box.onpointerdown=e=>{if(running())return;e.preventDefault();region=item.id;checkpoint();drag={x:e.clientX,y:e.clientY,start:{...item},corner:e.target.dataset.corner||'',rect:$('#maskLayer').getBoundingClientRect()};box.setPointerCapture(e.pointerId);$$('.maskbox').forEach(b=>b.classList.toggle('selected',b===box));};
 box.onpointermove=e=>{if(!drag)return;Object.assign(item,C.moveMask(drag.start,drag.corner,(e.clientX-drag.x)/drag.rect.width,(e.clientY-drag.y)/drag.rect.height));positionBox(box,item);renderProperties();draw();};box.onpointerup=box.onpointercancel=()=>{if(drag){drag=null;changed();}};$('#maskLayer').append(box);
 });
 $('#addMaskBtn').disabled=!available||running()||f.masks.length>=100;$('#copyMaskBtn').disabled=(f?.masks.length||0)>=100;$('#maskFields').disabled=!m||!available||running();$('#batchBtn').disabled=!available||running()||project.files.filter(x=>x.selected&&x.id!==current).length===0;updatePreviewAvailability();renderProperties();draw();
}
function positionBox(el,m){el.style.cssText='left:'+m.x*100+'%;top:'+m.y*100+'%;width:'+m.w*100+'%;height:'+m.h*100+'%';}
function renderProperties(){const m=currentMask();$$('#maskTypes button').forEach(b=>b.classList.toggle('active',b.dataset.type===m?.type));$('#colorField').classList.toggle('hidden',m?.type!=='纯色');$('#strengthField').classList.toggle('hidden',!m||!['模糊','马赛克'].includes(m.type));$('#maskColor').value=m?.color||'#111111';$('#colorPicker').value=m?.color||'#111111';$('#imageField').classList.toggle('hidden',m?.type!=='图片');$('#imageStatus').textContent=project.images?.[m?.imageId]?'已选择图片 · 可拖动四角缩放':'尚未选择图片';$('#strength').max=m?.type==='模糊'?10:30;$('#strength').value=m?.strength||(m?.type==='模糊'?10:16);$('#strengthValue').textContent=m?.strength||16;$$('[data-geo]').forEach(input=>input.value=m?m[input.dataset.geo].toFixed(3):'');}
function positionTimeBar(bar,item,duration,index,offset,total){const timing=C.range(item,duration);placeTime(bar,offset+timing.start,offset+timing.end,total);const label=bar.querySelector('span');label.textContent='区域 '+(index+1)+' · '+C.format(timing.start)+'–'+C.format(timing.end);bar.title=label.textContent;}
function sizeTimeline(){const viewport=$('#timelineViewport'),surface=$('#timelineSurface'),total=timelineContext().total,zoom=Number($('#timelineZoom').value)||1;surface.style.width=Math.max(viewport.clientWidth,Math.ceil(total/900)*72)*zoom+'px';}
$('#timelineZoom').onchange=sizeTimeline;
new ResizeObserver(sizeTimeline).observe($('#timelineViewport'));
let scrub=null,suppressTimelineClick=false;
function seekTimeline(clientX){const {files,total}=timelineContext(),rect=$('#timelineSurface').getBoundingClientRect();if(!total||!rect.width)return;
 const global=clamp((clientX-rect.left)/rect.width*total,0,total);let offset=0;
 for(let i=0;i<files.length;i++){const f=files[i];if(global<offset+f.duration||i===files.length-1){if(current!==f.id){current=f.id;region=f.masks[0]?.id||'';loadCurrent();render();}seekTo(global-offset);break;}offset+=f.duration;}
}
$('#timelineSurface').onpointerdown=e=>{if(e.button!==0||running()||importing||e.target.closest('.mask-range')||!project.files.length)return;e.preventDefault();scrub={id:e.pointerId,resume:!video.paused};resumeAfterScrub=false;video.pause();suppressTimelineClick=true;$('#timelineSurface').setPointerCapture(e.pointerId);seekTimeline(e.clientX);};
$('#timelineSurface').onpointermove=e=>{if(scrub?.id===e.pointerId)seekTimeline(e.clientX);};
const finishScrub=e=>{if(scrub?.id!==e.pointerId)return;resumeAfterScrub=scrub.resume;scrub=null;resumeScrub();setTimeout(()=>suppressTimelineClick=false,0);};
$('#timelineSurface').onpointerup=$('#timelineSurface').onpointercancel=finishScrub;
$('#timelineSurface').addEventListener('click',e=>{if(suppressTimelineClick){e.preventDefault();e.stopImmediatePropagation();}},true);
function renderTimeline(){
 const f=currentFile(),duration=f?.duration||0,timeline=timelineContext(),ruler=$('#ruler'),track=$('.track'),maskTrack=$('.mask-track');ruler.replaceChildren();track.replaceChildren();maskTrack.replaceChildren();
 for(let seconds=0;seconds<=timeline.total;seconds+=900){const tick=document.createElement('span');tick.className='time-tick'+(seconds===timeline.total&&seconds>0?' last':'');tick.dataset.seconds=seconds;tick.textContent=C.format(seconds);placeTime(tick,seconds,undefined,timeline.total);ruler.append(tick);}
 if(timeline.total>0){const end=document.createElement('span');end.className='timeline-total';end.textContent='总时长 '+C.format(timeline.total);placeTime(end,timeline.total,undefined,timeline.total);ruler.append(end);}sizeTimeline();updateTransport();
 if(!timeline.files.length){track.innerHTML='<small class="muted">导入视频后显示时间线</small>';maskTrack.textContent='暂无打码区域';return;}
 let offset=0;timeline.files.forEach(item=>{const duration=Math.max(0,Number(item.duration)||0),active=item.id===current,clip=button('',()=>selectFile(item.id),'clip timeline-video'+(active?' timeline-current':'')+(item.selected?'':' timeline-unselected'));placeTime(clip,offset,offset+duration,timeline.total);offset+=duration;clip.innerHTML='<b>'+escape(item.name)+'</b><small>'+C.format(item.duration)+(item.selected?'':' · 未勾选')+'</small>';clip.title=item.name+' · '+C.format(item.duration)+(item.selected?'':' · 不参与处理');track.append(clip);});
 if(!f||!duration||!timeline.total){maskTrack.textContent='当前视频尚未就绪';return;}
 if(!f.masks.length){maskTrack.textContent='暂无打码区域';return;}
 f.masks.forEach((item,index)=>{const lane=document.createElement('div'),bar=document.createElement('div');lane.className='mask-lane';bar.className='mask-range'+(item.id===region?' active':'')+(item.enabled?'':' disabled');bar.innerHTML='<i class="time-handle start" data-edge="start"></i><span></span><i class="time-handle end" data-edge="end"></i>';positionTimeBar(bar,item,duration,index,timeline.offset,timeline.total);lane.append(bar);maskTrack.append(lane);let drag=null;
  bar.onpointerdown=e=>{if(running()||assets.get(f.id)?.status!=='ready')return;e.preventDefault();region=item.id;const timing=C.range(item,duration),rect=$('#timelineSurface').getBoundingClientRect();drag={pointerTime:(e.clientX-rect.left)/rect.width*timeline.total,edge:e.target.dataset.edge||'move',timing,moved:false,recorded:false};try{bar.setPointerCapture(e.pointerId);}catch{}$$('.mask-range').forEach(node=>node.classList.toggle('active',node===bar));};
  bar.onpointermove=e=>{if(!drag)return;const rect=$('#timelineSurface').getBoundingClientRect(),delta=(e.clientX-rect.left)/rect.width*timeline.total-drag.pointerTime;if(Math.abs(delta)<.01)return;if(!drag.recorded){checkpoint();drag.recorded=true;}drag.moved=true;const minimum=Math.min(.1,duration);let start=drag.timing.start,end=drag.timing.end;if(drag.edge==='start')start=clamp(start+delta,0,end-minimum);else if(drag.edge==='end')end=clamp(end+delta,start+minimum,duration);else{const length=end-start;start=clamp(start+delta,0,duration-length);end=start+length;}item.start=Math.round(start*1000)/1000;item.end=Math.round(end*1000)/1000;positionTimeBar(bar,item,duration,index,timeline.offset,timeline.total);seekTo(drag.edge==='end'?end:start);};
  const finish=()=>{if(!drag)return;const moved=drag.moved;drag=null;if(moved)changed();else{const timing=C.range(item,duration);if(video.currentTime<timing.start||video.currentTime>timing.end)seekTo(timing.start);render();}};bar.onpointerup=finish;bar.onpointercancel=finish;
 });
}
$('#addMaskBtn').onclick=()=>edit(()=>{const m=C.mask({start:0,end:currentFile().duration});currentFile().masks.push(m);region=m.id;});
$('#copyMaskBtn').onclick=()=>edit(()=>{const m=C.mask({...currentMask(),id:C.id(),x:currentMask().x+.03,y:currentMask().y+.03});currentFile().masks.push(m);region=m.id;});
$('#deleteMaskBtn').onclick=()=>edit(()=>{currentFile().masks=currentFile().masks.filter(m=>m.id!==region);region=currentFile().masks[0]?.id||'';});
$$('#maskTypes button').forEach(b=>b.onclick=()=>edit(()=>{const m=currentMask();if(m.type!==b.dataset.type&&b.dataset.type==='模糊')m.strength=10;m.type=b.dataset.type;}));
$('#chooseImageBtn').onclick=()=>$('#maskImageInput').click();
$('#maskImageInput').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file||running())return;const fid=current,mid=region,epoch=generation;
 try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('请选择20MB以内的 PNG、JPG 或 WebP 图片。');
  const url=URL.createObjectURL(file),img=new Image();try{img.src=url;await img.decode();}finally{URL.revokeObjectURL(url);}
  const scale=Math.min(1,1280/img.naturalWidth,1280/img.naturalHeight),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);const data=c.toDataURL('image/png');
  if(epoch!==generation||fid!==current||mid!==region||running())return;const imageId=C.id(),next={...(project.images||{}),[imageId]:data},used=new Set(project.files.flatMap(f=>f.masks.filter(m=>m.id!==mid).map(m=>m.imageId)));for(const key of Object.keys(next))if(key!==imageId&&!used.has(key))delete next[key];C.images(next);
  if(JSON.stringify({...project,images:next}).length>9*1024*1024)throw Error('项目已接近保存容量限制，请使用更小的图片。');
  edit(()=>{project.images=next;currentMask().imageId=imageId;currentMask().type='图片';});toast('图片已添加','可拖动四角或编辑宽高，自由调整图片大小。');
 }catch(error){dialog('图片导入失败',error.message);}
};
function changeColor(value){if(!/^#[\da-f]{6}$/i.test(value)){toast('请输入六位十六进制颜色，例如 #111111');renderProperties();return;}edit(()=>currentMask().color=value);}
$('#maskColor').onchange=e=>changeColor(e.target.value);$('#colorPicker').onchange=e=>changeColor(e.target.value);$('#strength').onchange=e=>edit(()=>currentMask().strength=Number(e.target.value));$('#strength').oninput=e=>$('#strengthValue').textContent=e.target.value;
$$('[data-geo]').forEach(input=>input.onchange=()=>{if(!input.value||!Number.isFinite(Number(input.value))){renderProperties();return;}edit(()=>Object.assign(currentMask(),C.mask({...currentMask(),[input.dataset.geo]:Number(input.value)})));});
$('#eyedropper').onclick=()=>{picking=true;video.pause();document.body.classList.add('is-picking');toast('点击视频画面取色','按 Esc 取消');};
$('#viewer').onclick=e=>{if(!picking||!currentMask())return;const r=canvas.getBoundingClientRect();if(e.clientX<r.left||e.clientY<r.top||e.clientX>r.right||e.clientY>r.bottom)return;
try{sample.width=video.videoWidth;sample.height=video.videoHeight;const s=sample.getContext('2d');s.drawImage(video,0,0);const p=s.getImageData(Math.floor((e.clientX-r.left)/r.width*sample.width),Math.floor((e.clientY-r.top)/r.height*sample.height),1,1).data;changeColor('#'+[...p].slice(0,3).map(c=>c.toString(16).padStart(2,'0')).join(''));}catch(error){toast('取色失败',error.message);}picking=false;document.body.classList.remove('is-picking');};
$('#batchBtn').onclick=async()=>{const source=current,targets=project.files.filter(f=>f.selected&&f.id!==source).map(f=>f.id);if(await dialog('批量应用打码区域','将覆盖 '+targets.length+' 个已勾选视频的现有区域，默认从开头到结尾整段生效；应用后仍可独立编辑。',[['取消','cancel'],['应用','confirm']])==='confirm')edit(()=>C.batch(project,source,targets));};
$('#previewBtn').onclick=async()=>{if(!engineReady)return toast('视频引擎尚未就绪');video.pause();preparing=true;render();const spinner=document.createElement('div');spinner.className='loading-preview';spinner.innerHTML='<span class="spinner"></span>';dialog('正在生成真实效果预览','使用导出引擎处理当前帧…',[],spinner);try{const image=new Image();image.style.cssText='display:block;width:100%;height:auto';image.src=await native('previewFrame',{file:C.clone(currentFile()),time:video.currentTime,baseline:project.files.find(f=>f.selected),settings:project.settings,images:project.images||{}});await image.decode();dialog('真实处理效果 · 当前帧','FFmpeg 使用与导出相同的打码与补边规则生成；最终编码压缩仍可能带来细微差异。',[['关闭','close']],image);}catch(e){dialog('预览生成失败',e.message);}finally{preparing=false;render();}};
function undo(redo=false){if(running()||importing)return;const from=redo?future:history,to=redo?history:future;if(!from.length)return;to.push(C.clone(project));project=from.pop();if(!currentFile())current=project.files[0]?.id||'';region=currentFile()?.masks[0]?.id||'';changed();loadCurrent();}
$('#undoBtn').onclick=()=>undo();$('#redoBtn').onclick=()=>undo(true);
['hours','minutes','seconds'].forEach(key=>$('#'+key).onchange=e=>edit(()=>project.settings[key]=e.target.value===''?'':Number(e.target.value)));
$('#concatEnabled').onchange=e=>edit(()=>project.settings.concat=e.target.checked);
$('#fitEnabled').onchange=e=>edit(()=>project.settings.fit=e.target.checked?'letterbox':'none');
$('#baseName').onchange=e=>{edit(()=>project.settings.baseName=e.target.value);rememberPreferences();};
$('#directoryBtn').onclick=async()=>{try{if(!bridge){toast('目录选择需要桌面应用','浏览器中可先检查其他交互');return;}const path=await native('chooseDirectory');if(path){edit(()=>project.settings.output=path);rememberPreferences();}}catch(e){dialog('无法选择目录',e.message);}};
function validation(){if(!engineReady)return '视频处理引擎尚未就绪，请使用带引擎的桌面应用。';if(importing||preparing)return '正在读取或检查视频，请稍候。';if(project.files.some(f=>f.selected&&assets.get(f.id)?.status!=='ready'))return '所选素材尚未读取完成或已失效，请等待或重新定位。';try{C.plan(project);if(!project.settings.output.trim())return '请选择输出目录。';return '';}catch(e){return e.message;}}
function renderSettings(){
const selected=project.files.filter(f=>f.selected),first=selected[0],s=project.settings;['hours','minutes','seconds','baseName'].forEach(key=>{if(document.activeElement!==$('#'+key))$('#'+key).value=s[key];});$('#outputDir').value=s.output;
$('#concatEnabled').checked=s.concat!==false;$('#fitEnabled').checked=s.fit!=='none';for(const id of ['concatEnabled','fitEnabled']){const input=$('#'+id);input.disabled=running()||importing;input.closest('.option').classList.toggle('selected',input.checked);}
$('#concatOrder').textContent=s.concat===false?'不拼接，各视频分别按目标时长分段，片段连续编号。':selected.map(f=>f.name).join(' → ')||'尚未选择视频';$('#fitDescription').textContent=s.fit==='none'?'不缩放、不补边，保留各视频原尺寸；不同尺寸不能直接拼接。':first?'适配到 '+(first.width||'—')+' × '+(first.height||'—')+'，保持比例，不裁切画面。':'不裁切源视频画面。';
let p;try{p=C.plan(project);}catch{}
const masks=selected.reduce((sum,f)=>sum+f.masks.filter(m=>m.enabled).length,0),rows=[['视频',selected.length+' 个 · '+C.format(p?.total)],['拼接',s.concat===false?'关闭 · 逐个分段':'开启 · 顺序拼接'],['画面适配',s.fit==='none'?'关闭 · 原尺寸':first?(first.width||'—')+' × '+(first.height||'—')+' · 补黑边':'—'],['画面处理',masks+' 个打码区域'],['分割预览',p?p.segments.length+' 个片段':'—'],['编码设置',masks?'打码需要重编码':'优先直接复制 · 不兼容时重编码'],['输出规划','MP4 · 实际编码以导出检查为准']];
$('#exportSummary').innerHTML=rows.map(([k,v])=>'<div class="summary-row"><span>'+k+'</span><strong>'+escape(v)+'</strong></div>').join('');$('#namePreview').textContent=p?'命名预览：'+p.segments[0].name:'命名或时长无效';
const error=validation();$('#validation').textContent=error;$('#validation').hidden=!error;$('#startBtn').disabled=!!error||running();$('#directoryBtn').disabled=running();['hours','minutes','seconds','baseName'].forEach(key=>$('#'+key).disabled=running());
}
function showPage(name){page=name;$$('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+name));$$('.tab').forEach(t=>{const on=t.dataset.page===name;t.classList.toggle('active',on);t.setAttribute('aria-selected',String(on));});video.pause();render();}
$$('.tab,[data-go]').forEach(b=>b.onclick=()=>showPage(b.dataset.page||b.dataset.go));
async function pollJob(){try{job=await native('jobStatus');if(!job)return;if(job.state==='complete')showPage('result');else render();}catch(e){toast('无法读取处理状态',e.message);}if(job?.state==='running')timer=setTimeout(pollJob,500);}
async function startJob(){const error=validation();if(error)return toast('暂时无法开始',error);preparing=true;render();dialog('检查导出条件','正在检查源视频、输出格式、磁盘空间及文件重名…',[]);try{const snapshot=C.clone(project),info=await native('prepareExport',{project:snapshot});const text=[info.summary+'\n预计 '+info.segments+' 段',info.copy?'兼容素材直接复制视频流；切分时间随源关键帧可能有偏差。':'自动选择可用编码器；硬件失败将回退软件。',...info.warnings].join('\n');if(await dialog('确认真实导出',text,[['取消','cancel'],['开始导出','confirm']])!=='confirm')return;await flushSession();video.pause();job=await native('startExport',{project:snapshot});showPage('monitor');clearTimeout(timer);pollJob();}catch(e){dialog('无法开始处理',e.message);}finally{preparing=false;render();}}
$('#startBtn').onclick=startJob;
$('#cancelBtn').onclick=async()=>{if(await dialog('取消任务？','本次尚未完成的输出会清理，源视频与项目配置会保留。',[['继续任务','keep'],['确认取消','confirm']])==='confirm'&&running()){try{job=await native('cancelExport');render();}catch(e){dialog('取消失败',e.message);}}};
$('#retryBtn').onclick=startJob;
function renderJob(){
 const labels={running:'正在处理',failed:'处理失败',cancelled:'已取消',complete:'处理完成'};$('#jobTitle').textContent=labels[job?.state]||'尚未开始处理';$('#jobState').textContent=labels[job?.state]||'待开始';$('#progressTitle').textContent='进度 '+(job?.progress||0)+'%';$('.big-progress span').style.width=(job?.progress||0)+'%';$('#elapsed').textContent=C.format(job?.elapsed);$('#progressDetail').textContent=(job?.message||'等待开始')+(job?.encoder?' · '+job.encoder:'');
 $('#jobWarnings').textContent=(job?.warnings||[]).join('\n');$('#jobWarnings').hidden=!job?.warnings?.length;
 $('#taskLog').innerHTML=(job?.logs||[]).slice(-100).map(name=>'<div class="log-row"><i class="log-dot"></i><b>'+escape(name)+'</b></div>').join('');
 $('#cancelBtn').disabled=!running();$('#retryBtn').hidden=!['failed','cancelled'].includes(job?.state);
}
function renderResult(){
 const p=job?.state==='complete'?job:null,outputs=p?.outputs||[];$('#resultTitle').textContent=p?'已生成 '+outputs.length+' 个视频片段':'暂无处理结果';$('#resultDescription').textContent=p?'视频已写入：'+p.output:'完成导出后，这里显示实际文件。';$('#outputs').replaceChildren();$('.result-stat strong').textContent=p?bytes(outputs.reduce((s,f)=>s+f.size,0)):'—';$('.result-stat small').textContent=p?[...new Set(outputs.map(f=>(f.codec==='hevc'?'H.265':f.codec==='h264'?'H.264':f.codec)+(f.audioCodec?' + '+f.audioCodec.toUpperCase():' · 无音轨')))].join(' / ')+' · MP4':'尚未生成';
 $('#resultElapsed').textContent='输出用时：'+(p?C.elapsed(p.elapsed):'—');$('#resultWarnings').textContent=(p?.warnings||[]).join('\n');$('#resultWarnings').hidden=!p?.warnings?.length;
 // ponytail: cap visible rows at 200; the summary retains the complete segment count.
 outputs.slice(0,200).forEach(s=>{const row=document.createElement('div');row.className='output-row';row.innerHTML='<span class="file-icon">MP4</span><span><b>'+escape(s.name)+'</b><small class="muted">'+s.width+' × '+s.height+'</small></span><span class="mono">'+C.format(s.duration)+'</span><span>'+bytes(s.size)+'</span>';row.append(button('定位文件',()=>native('showOutput',{path:s.path}).catch(e=>dialog('文件无法打开',e.message))));$('#outputs').append(row);});
 if(outputs.length>200){const note=document.createElement('p');note.textContent='显示前 200 / '+outputs.length+' 个片段；全部文件在输出目录。';$('#outputs').append(note);}$('#openFolder').disabled=!p||!bridge;
}
$('#openFolder').onclick=async()=>{try{await native('openDirectory',{path:job?.output});}catch(e){dialog('无法打开目录',e.message);}};
function render(){
 const f=currentFile(),a=assets.get(current),selected=project.files.filter(f=>f.selected);document.body.classList.toggle('empty-project',!project.files.length);$('#currentFile').textContent=f?.name||'尚未选择视频';$('#currentFile').title=f?.name||'';$('#mediaStatus').textContent=!f?'等待导入':a?.status==='ready'?'可编辑':a?.status==='loading'?'读取中':'需重新定位';$('#viewerEmpty').classList.toggle('hidden',a?.status==='ready');
 $('#viewerEmpty').innerHTML=!f?'<span><b>暂无预览内容</b><small>导入视频后，在这里添加打码区域</small></span>':'<span><b>'+(a?.status==='loading'?'正在读取视频…':'无法预览当前素材')+'</b><small>'+escape(a?.error||'请等待视频加载')+'</small></span>';
 $('.count').textContent=project.files.length+' 个 · 已选 '+selected.length;$('#selectedCount').textContent=selected.length+' 个';$('#maskCount').textContent=(f?.masks.length||0)+' 个';$('#dimensions').textContent=f?.width?f.width+' × '+f.height:'—';updateTransport();
 for(const id of ['playBtn','prevBtn','nextBtn','seek'])$('#'+id).disabled=a?.status!=='ready'||running();
 $('#undoBtn').disabled=!history.length||running()||importing;$('#redoBtn').disabled=!future.length||running()||importing;$('#importBtn').disabled=running()||importing;$('#importBtn').textContent=importing?'正在读取素材…':'＋ 导入或拖入视频';$('#newBtn').disabled=running()||importing||saving;
 $$('.tab').forEach(b=>b.disabled=b.dataset.page==='settings'?!project.files.length:b.dataset.page==='monitor'?!job:b.dataset.page==='result'?job?.state!=='complete':false);$('[data-go=settings]').disabled=!project.files.length||running();
 renderTimeline();renderAssets();renderMasks();renderSettings();renderJob();renderResult();playState();
}
if($('#saveBtn'))$('#saveBtn').onclick=saveProject;if($('#openBtn'))$('#openBtn').onclick=openProject;$('#newBtn').onclick=async()=>{if(await mayReplace()){reset();await applyHostPreferences();await flushSession();}};
window.frameFlowRequestClose=async()=>{if(importing||preparing)return toast('请等待当前操作完成');if(running()){if(await dialog('停止处理并退出？','当前导出将取消，编辑配置会自动保存。',[['继续处理','cancel'],['停止并退出','confirm']])!=='confirm')return;await native('cancelExport');while((await native('jobStatus'))?.state==='running')await new Promise(r=>setTimeout(r,100));}if(!await flushSession())return;await native('closeApproved');};
addEventListener('beforeunload',e=>{if(!bridge&&dirty()){e.preventDefault();e.returnValue='';}});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){picking=false;document.body.classList.remove('is-picking');if(modalResolve)closeModal('cancel');}
 if(modalResolve){if(e.key==='Tab'){const buttons=$$('#modal button'),first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
 if(!(e.metaKey||e.ctrlKey))return;if(e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();undo(e.shiftKey);}
});
$('#hostStatus').textContent=bridge?'● macOS 原生应用':'● 本地浏览器预览';
// Host entry points are also used by the native acceptance check.
if(bridge?.platform)$('#hostStatus').textContent='● '+bridge.platform+' 本地工作台';
window.FrameFlow={ready:()=>engineReady&&!booting,getProject:()=>C.clone(project),isDirty:dirty,addMedia,reset,saveProject,openProject,showPage,getJob:()=>C.clone(job),native,render};
document.title='FrameFlow 1.5.1 课程剪辑';$('.brand .chip').textContent='V1.5.1';$('.statusbar div:last-child span:last-child').textContent='V1.5.1';
$('#prevBtn').className='btn seek-step';$('#nextBtn').className='btn seek-step';$('#prevBtn').textContent='− 1 秒';$('#nextBtn').textContent='＋ 1 秒';$('.inspector .section-title .chip').textContent='可调时间范围';const hint=document.createElement('small');hint.className='mask-time-hint';hint.textContent='在下方时间线拖动区域或两端，调整生效时间。';$('.mask-list').after(hint);$('.timeline-tools h3').textContent='视频与打码时间线';
async function boot(){try{if(!bridge)return;await native('health');engineReady=true;const session=await native('loadSession');if(session){reset(C.parse(session.contents),session.media);if(project.files.length)toast('已恢复上次编辑','素材顺序、打码时间与片段设置已恢复');}else await applyHostPreferences();}catch(e){dialog('启动检查未完成',e.message);}finally{booting=false;render();syncDirty();}}render();syncDirty();boot();
})();
