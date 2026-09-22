'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async(window,engine,app)=>{try{
 const dir=app.commandLine.getSwitchValue('acceptance-dir'),report=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8')),out=path.join(dir,'桌面应用导出');await fs.promises.mkdir(out,{recursive:true});
 const renderer=async({files,out})=>{
  const wait=async(test,label,ms=45000)=>{const until=Date.now()+ms;while(Date.now()<until){if(await test())return;await new Promise(r=>setTimeout(r,80));}throw Error('Timeout '+label);},q=s=>document.querySelector(s),checks=[];
  const check=(label,ok)=>{if(!ok)throw Error(label);checks.push(label);};
  await wait(()=>window.FrameFlow?.ready(),'boot');check('启动为空素材',FrameFlow.getProject().files.length===0);check('默认分段45分钟',FrameFlow.getProject().settings.minutes===45);
  const media=await FrameFlow.native('describePaths',{paths:files});await FrameFlow.addMedia(media);q('.select-asset').click();const v=q('#videoPlayer');await wait(()=>v.readyState>=2&&!v.seeking,'first frame');
  const sample=document.createElement('canvas');sample.width=320;sample.height=180;
  const frame=()=>{const ctx=sample.getContext('2d');ctx.drawImage(v,0,0,320,180);const d=ctx.getImageData(0,0,320,180).data;let hash=0;for(let i=0;i<d.length;i+=109)hash=(hash*31+d[i])>>>0;return hash;};
  async function settled(target){await wait(()=>!v.seeking&&v.readyState>=2&&Math.abs(v.currentTime-target)<.1,'seek '+target);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}
  v.currentTime=.2;await settled(.2);const before=frame();q('#nextBtn').click();await settled(1.2);check('前进实际解码到新帧',frame()!==before);q('#prevBtn').click();await settled(.2);check('快退实际解码恢复原帧',frame()===before);
  q('#seek').value=2.3;q('#seek').dispatchEvent(new Event('input',{bubbles:true}));await settled(2.3);check('进度条跳转且画面变化',frame()!==before);
  q('#playBtn').click();await wait(()=>v.currentTime>2.45,'play');q('#playBtn').click();check('真实播放与暂停',v.paused);
  check('全素材时间线',document.querySelectorAll('.timeline-video').length===2);check('仅一个顶部功能按钮',document.querySelectorAll('.title-actions button').length===1);
  q('#addMaskBtn').click();check('添加打码与时间条',FrameFlow.getProject().files[0].masks.length===1&&!!q('.mask-range'));
  for(const zoom of [1,4]){
   const p=FrameFlow.getProject();p.files[0].masks[0].start=.5;p.files[0].masks[0].end=3;FrameFlow.reset(p,media);await wait(()=>v.readyState>=2&&!v.seeking,'timeline media');
   q('#timelineZoom').value=zoom;q('#timelineZoom').dispatchEvent(new Event('change'));q('#timelineViewport').scrollLeft=zoom===4?150:0;
   const drag=(edge,delta)=>{const bar=q('.mask-range'),target=edge?bar.querySelector('.'+edge):bar,rect=bar.getBoundingClientRect(),surface=q('#timelineSurface').getBoundingClientRect(),total=p.files.reduce((a,f)=>a+f.duration,0),x=edge==='end'?rect.right-2:edge==='start'?rect.left+2:rect.left+rect.width/2,y=rect.top+8;
    target.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,clientX:x,clientY:y}));bar.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,clientX:x+delta/total*surface.width,clientY:y}));bar.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,clientX:x+delta/total*surface.width,clientY:y}));};
   drag('end',-.5);await settled(2.5);check(zoom+'×滚动后右端拖动对应真实时间',FrameFlow.getProject().files[0].masks[0].end===2.5);
   drag('start',.25);await settled(.75);check(zoom+'×滚动后左端拖动对应真实时间',FrameFlow.getProject().files[0].masks[0].start===.75);
   drag('',.25);await settled(1);const m=FrameFlow.getProject().files[0].masks[0];check(zoom+'×整体拖动保持时间长度',m.start===1&&m.end===2.75);
   const s=q('#timelineSurface').getBoundingClientRect(),bar=q('.mask-range').getBoundingClientRect(),total=p.files.reduce((a,f)=>a+f.duration,0);check(zoom+'×拖动后播放指针与区域起点对齐',Math.abs(q('#timelinePlayhead').getBoundingClientRect().left-bar.left)<.15&&Math.abs(bar.left-s.left-m.start/total*s.width)<.15);
  }
  q('#timelineZoom').value='1';q('#timelineZoom').dispatchEvent(new Event('change'));
  q('#previewBtn').click();await wait(()=>q('#modalPreview img')?.complete&&q('#modalTitle').textContent.includes('真实处理'),'preview');check('真实 FFmpeg 预览进入弹窗',q('#modalPreview img').naturalWidth===320);q('#modalActions button').click();
  FrameFlow.showPage('settings');q('#concatEnabled').click();q('#fitEnabled').click();check('拼接与适配可以取消且状态一致',!q('#concatEnabled').checked&&!q('#fitEnabled').checked&&FrameFlow.getProject().settings.concat===false&&FrameFlow.getProject().settings.fit==='none'&&!q('#fitEnabled').closest('.option').classList.contains('selected'));
  q('#concatEnabled').click();check('取消适配时混合尺寸拼接明确提示冲突',q('#validation').textContent.includes('尺寸不同'));q('#fitEnabled').click();check('两个选项可以重新勾选',q('#concatEnabled').checked&&q('#fitEnabled').checked);
  const p=FrameFlow.getProject();p.settings={...p.settings,output:out,minutes:0,seconds:3};FrameFlow.reset(p,media);FrameFlow.showPage('settings');q('#baseName').value='桌面验收';q('#baseName').dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>!q('#startBtn').disabled,'start ready');q('#startBtn').click();await wait(()=>q('#modalTitle').textContent==='确认真实导出','preflight');q('#modalActions .primary').click();
  await wait(()=>FrameFlow.getJob()?.state==='complete'||FrameFlow.getJob()?.state==='failed','export',180000);const job=FrameFlow.getJob();check('桌面界面真实导出完成',job.state==='complete');check('结果列表显示真实文件',document.querySelectorAll('#outputs .output-row').length===job.outputs.length&&job.outputs.length===3);
  check('结果显示实际用时',q('#resultElapsed').textContent==='输出用时：'+FrameFlowCore.elapsed(job.elapsed));const text=q('#resultElapsed').textContent;await new Promise(r=>setTimeout(r,1100));FrameFlow.render();check('结果用时不会继续增长',q('#resultElapsed').textContent===text);
  FrameFlow.showPage('settings');q('#concatEnabled').click();q('#fitEnabled').click();q('#baseName').value='独立桌面验收';q('#baseName').dispatchEvent(new Event('change',{bubbles:true}));q('#startBtn').click();await wait(()=>q('#modalTitle').textContent==='确认真实导出','independent preflight');check('实际预检与未勾选状态一致',q('#modalText').textContent.includes('180 × 320'));q('#modalActions .primary').click();await wait(()=>['complete','failed'].includes(FrameFlow.getJob()?.state),'independent export',180000);const independent=FrameFlow.getJob();check('取消拼接适配后确实分别输出原尺寸',independent.state==='complete'&&independent.outputs[2].width===180&&independent.outputs[2].height===320&&independent.outputs[2].mode==='copy');
  await wait(()=>q('#saveState').textContent==='已自动保存','autosave');const session=await FrameFlow.native('loadSession');check('自动保存落盘含取消状态',JSON.parse(session.contents).files[0].masks.length===1&&JSON.parse(session.contents).settings.concat===false&&JSON.parse(session.contents).settings.fit==='none');return {checks,outputs:independent.outputs,joinedOutputs:job.outputs};
 };
 const result=await window.webContents.executeJavaScript('('+renderer.toString()+')('+JSON.stringify({files:[report.source,report.portrait],out})+')');
 for(const output of result.outputs){assert.ok(fs.statSync(output.path).size>100);await engine.run('ffmpeg',['-v','error','-xerror','-i',output.path,'-f','null','-']);}
 await fs.promises.writeFile(path.join(dir,'桌面真实导出.png'),(await window.webContents.capturePage()).toPNG());
 await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});
 const restored=await window.webContents.executeJavaScript(`(async()=>{const until=Date.now()+45000;while(Date.now()<until&&!window.FrameFlow?.ready())await new Promise(r=>setTimeout(r,80));return FrameFlow.getProject();})()`);
 assert.equal(restored.files.length,2);assert.equal(restored.files[0].masks.length,1);assert.equal(restored.settings.baseName,'独立桌面验收');assert.equal(restored.settings.concat,false);assert.equal(restored.settings.fit,'none');result.checks.push('重载恢复全部素材、打码、输出设置和取消状态');
 await fs.promises.writeFile(path.join(dir,'native-report.json'),JSON.stringify(result,null,2));console.log('NATIVE_ALL_PASS '+JSON.stringify(result));app.exit(0);
 }catch(e){console.error('NATIVE_FAIL',e);app.exit(1);}};
