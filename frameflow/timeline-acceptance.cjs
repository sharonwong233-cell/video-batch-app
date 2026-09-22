'use strict';
const fs=require('node:fs'),path=require('node:path');
module.exports=async(window,app)=>{try{
 const dir=app.commandLine.getSwitchValue('acceptance-dir');fs.mkdirSync(dir,{recursive:true});
 const evaluate=fn=>window.webContents.executeJavaScript('('+fn.toString()+')()');
 await evaluate(async()=>{
  while(!window.FrameFlow?.ready())await new Promise(r=>setTimeout(r,50));
  window.timelineChecks=[];
  window.timelineCheck=(name,ok)=>{if(!ok)throw Error(name);timelineChecks.push(name);};
  window.timelineSet=(durations,many=false)=>{
   const p=FrameFlowCore.initial();p.files=durations.map((duration,i)=>({id:'clip-'+i,name:'验收片段 '+(i+1)+'.mp4',duration,fps:25,width:320,height:180,selected:i!==1,masks:[]}));
   const i=Math.min(2,durations.length-1),duration=durations[i];
   if(i>=0)p.files[i].masks=[FrameFlowCore.mask({start:0,end:duration}),FrameFlowCore.mask({start:duration*.25,end:duration*.75})];
   if(many)for(let j=0;j<12;j++)p.files[i].masks.push(FrameFlowCore.mask({start:0,end:duration}));
   FrameFlow.reset(p);if(i>=0)document.querySelectorAll('.timeline-video')[i].click();
  };
  window.timelineGeometry=label=>{
   const q=s=>document.querySelector(s),r=e=>e.getBoundingClientRect(),surface=r(q('#timelineSurface')),p=FrameFlow.getProject(),total=p.files.reduce((a,f)=>a+f.duration,0),x=t=>surface.left+t/total*surface.width;
   const near=(name,a,b)=>timelineCheck(label+' / '+name,Math.abs(a-b)<.12);
   timelineCheck(label+' / 摘要与轨道为相邻网格',q('.timeline-summary').parentElement===q('.timeline-panel'));
   for(const s of ['#ruler','.track','.mask-track','.mask-lane']){near(s+' 起点',r(q(s)).left,surface.left);near(s+' 宽度',r(q(s)).width,surface.width);}
   let offset=0;document.querySelectorAll('.timeline-video').forEach((clip,i)=>{near('片段'+i+' 起点',r(clip).left,x(offset));offset+=p.files[i].duration;near('片段'+i+' 终点',r(clip).right,x(offset));});
   const index=Math.min(2,p.files.length-1),f=p.files[index],start=p.files.slice(0,index).reduce((a,v)=>a+v.duration,0);
   document.querySelectorAll('.mask-range').forEach((bar,i)=>{near('区域'+i+' 起点',r(bar).left,x(start+f.masks[i].start));near('区域'+i+' 终点',r(bar).right,x(start+f.masks[i].end));});
   const ticks=[...document.querySelectorAll('.time-tick')];timelineCheck(label+' / 每15分钟一个刻度',ticks.length===Math.floor(total/900)+1&&ticks.every((t,i)=>Number(t.dataset.seconds)===i*900));
   ticks.forEach(t=>near('刻度'+t.dataset.seconds,Number(t.dataset.seconds)===total?r(t).right:r(t).left,x(Number(t.dataset.seconds))));
   const end=q('.timeline-total');timelineCheck(label+' / 总时长按时分秒显示',end?.textContent==='总时长 '+FrameFlowCore.format(total));near('总时长对齐时间轴末端',r(end).right,surface.right);
   ticks.forEach(t=>{const range=document.createRange();range.selectNodeContents(t);timelineCheck(label+' / 总时长不与刻度文字重叠',range.getBoundingClientRect().bottom<=r(end).top+1);});
   near('播放指针',r(q('#timelinePlayhead')).left,x(start+q('#videoPlayer').currentTime));
   timelineCheck(label+' / 全局播放时间',q('#playhead').textContent===FrameFlowCore.format(start+q('#videoPlayer').currentTime));
  };
  timelineSet([1525,1867,2353,1106,2105,2467],true);
 });
 for(const width of [1440,1100,1920])for(const zoom of [1,2,4,8]){
  window.setSize(width,900);await new Promise(r=>setTimeout(r,120));
  await window.webContents.executeJavaScript(`(async()=>{const z=document.querySelector('#timelineZoom');z.value='${zoom}';z.dispatchEvent(new Event('change'));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const v=document.querySelector('#timelineViewport');for(const scroll of [0,v.scrollWidth-v.clientWidth]){v.scrollLeft=scroll;v.scrollTop=30;timelineGeometry('${width}px / ${zoom}× / '+scroll);}})()`);
 }
 // Chromium page zoom is separate from timeline zoom and must also stay aligned.
 for(const factor of [.8,1.25]){window.webContents.setZoomFactor(factor);await new Promise(r=>setTimeout(r,160));await evaluate(()=>timelineGeometry('应用缩放'));}
 window.webContents.setZoomFactor(1);window.setSize(1440,900);
 await evaluate(async()=>{document.querySelector('#timelineZoom').value='1';timelineSet([.01,2,3]);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));timelineGeometry('极短片段无最小宽度挤占');timelineSet([900,900,900]);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));timelineGeometry('终点恰为15分钟刻度');timelineSet([]);timelineCheck('空项目不出现虚假轨道',!document.querySelector('.timeline-video')&&!document.querySelector('.mask-range'));timelineSet([1525,1867,2353,1106,2105,2467]);});
 await evaluate(async()=>{for(const seconds of [899,900,901]){timelineSet([seconds]);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));timelineGeometry('15分钟附近 '+seconds+'秒');}timelineSet([]);timelineCheck('空状态不显示虚假的总时长',!document.querySelector('.timeline-total'));timelineSet([1525,1867,2353,1106,2105,2467]);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const viewport=document.querySelector('#timelineViewport');viewport.scrollLeft=viewport.scrollWidth-viewport.clientWidth;});
 await new Promise(r=>setTimeout(r,150));
 fs.writeFileSync(path.join(dir,'时间线对齐.png'),(await window.webContents.capturePage()).toPNG());
 const checks=await evaluate(()=>timelineChecks);fs.writeFileSync(path.join(dir,'timeline-report.json'),JSON.stringify({checks,count:checks.length},null,2));
 console.log('TIMELINE_ALL_PASS '+checks.length);app.exit(0);
 }catch(e){console.error('TIMELINE_FAIL',e);app.exit(1);}};
