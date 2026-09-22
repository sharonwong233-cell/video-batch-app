'use strict';
// Shared project model. Runtime URLs are deliberately excluded from saved projects.
const FrameFlowCore = (() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = () => crypto.randomUUID();
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const initial = () => ({ version: 3, files: [], images: {}, settings: { hours: 0, minutes: 45, seconds: 0, output: '', baseName: '课程视频', concat: true, fit: 'letterbox', encoder: 'auto' } });
  function mask(input = {}) {
    const w = clamp(finite(input.w, .25), .02, 1), h = clamp(finite(input.h, .15), .02, 1);
    return { id: typeof input.id === 'string' ? input.id : id(), x: clamp(finite(input.x, .1), 0, 1-w), y: clamp(finite(input.y, .1), 0, 1-h), w, h,
      type: ['纯色','模糊','马赛克','图片'].includes(input.type) ? input.type : '纯色', color: /^#[\da-f]{6}$/i.test(input.color || '') ? input.color : '#111111',
      strength: clamp(finite(input.strength, input.type==='模糊'?10:16), 1, input.type==='模糊'?10:30), enabled: input.enabled !== false,
      imageId: typeof input.imageId==='string'?input.imageId:'',
      start: Math.max(0,finite(input.start)), end: input.end == null ? null : Math.max(0,finite(input.end)) };
  }
  function range(input,duration) {
    const total=Math.max(0,finite(duration));if(!total)return {start:0,end:0};
    const minimum=Math.min(.1,total),start=clamp(finite(input.start),0,Math.max(0,total-minimum));
    return {start,end:clamp(input.end==null?total:finite(input.end,total),start+minimum,total)};
  }
  function parse(raw) {
    const p = typeof raw === 'string' ? JSON.parse(raw) : clone(raw);
    if (!p || ![1,2,3].includes(p.version) || !Array.isArray(p.files) || p.files.length > 1000) throw Error('不是受支持的 FrameFlow 项目文件（版本 1 / 2 / 3）。');
    const result = initial(), seen = new Set();result.images=images(p.images);
    result.files = p.files.map(f => {
      if (typeof f === 'string' && p.version === 1) f = {name:f};
      if (!f || typeof f.name !== 'string' || !f.name.trim() || f.name.length > 1024) throw Error('项目中有无效素材名称。');
      let regions = p.version === 1 ? [p.masks?.[f.name] || p.mask, ...(p.extraMasks?.[f.name] || [])].filter(Boolean) : f.masks;
      if (!Array.isArray(regions) || regions.length > 100) throw Error('项目打码区域数据无效。');
      let fid = typeof f.id === 'string' ? f.id : id();
      if (seen.has(fid)) fid = id(); seen.add(fid);
      const maskIDs = new Set();
      return {id:fid,name:f.name,path:typeof f.path === 'string' ? f.path : '',size:Math.max(0,finite(f.size)),duration:Math.max(0,finite(f.duration)),width:Math.max(0,finite(f.width)),height:Math.max(0,finite(f.height)),fps:Math.max(0,finite(f.fps)),bitrate:Math.max(0,finite(f.bitrate)),selected:f.selected !== false,masks:regions.map(m => {const value=mask(m);if(maskIDs.has(value.id))value.id=id();maskIDs.add(value.id);return value;})};
    });
    const s = p.version === 1 ? { minutes:p.splitMinutes ?? 45,baseName:p.baseName } : p.settings;
    if (!s || typeof s !== 'object') throw Error('项目缺少片段设置。');
    if(s.concat!=null&&typeof s.concat!=='boolean')throw Error('拼接选项无效。');
    if(s.fit!=null&&!['letterbox','none'].includes(s.fit))throw Error('画面适配选项无效。');
    result.settings = {...result.settings, hours:finite(s.hours),minutes:finite(s.minutes,45),seconds:finite(s.seconds),output:typeof s.output === 'string' ? s.output : '',baseName:typeof s.baseName === 'string' ? s.baseName : '课程视频',concat:s.concat!==false,fit:s.fit||'letterbox'};
    return result;
  }
  function seconds(settings) {
    const parts = [settings.hours, settings.minutes, settings.seconds].map(Number);
    if (parts.some(n=>!Number.isInteger(n)||n<0) || parts[0]>999 || parts[1]>59 || parts[2]>59) throw Error('时长请输入整数：小时 0–999，分钟与秒 0–59。');
    const value = parts[0]*3600+parts[1]*60+parts[2];
    if (value <= 0) throw Error('每段目标时长必须大于 0 秒。');
    return value;
  }
  function plan(project) {
    const selected = project.files.filter(f=>f.selected), settings = project.settings;
    if (!selected.length) throw Error('请至少勾选一个视频。');
    for(const f of selected)for(const m of f.masks)if(m.enabled&&m.type==='图片'&&!Object.hasOwn(project.images||{},m.imageId))throw Error('请为图片区域选择图片：'+f.name);
    if (selected.some(f=>!(f.duration>0))) throw Error('请先完成素材读取，或重新定位无法读取的视频。');
    const duration = seconds(settings), name = settings.baseName.trim();
    if (!name || name.length>100 || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) throw Error('文件名称不可为空，也不能包含路径符号或系统保留名称。');
    if(settings.concat!==false&&settings.fit==='none'&&selected.some(f=>f.width!==selected[0].width||f.height!==selected[0].height))throw Error('素材尺寸不同：请开启画面适配，或取消拼接以保留各视频原尺寸。');
    const total = selected.reduce((sum,f)=>sum+f.duration,0),groups=settings.concat===false?selected.map(f=>f.duration):[total],count=groups.reduce((sum,time)=>sum+Math.ceil(time/duration),0);
    if (count>10000) throw Error('预计片段超过 10000 个，请增加每段目标时长。');
    const segments=[];for(const time of groups)for(let start=0;start<time;start+=duration)segments.push({name:`${name}_${String(segments.length+1).padStart(3,'0')}.mp4`,duration:Math.min(duration,time-start)});
    return {total,baseline:selected[0],files:clone(selected),segments};
  }
  function moveMask(m, handle, dx, dy) {
    if (!handle) return {...m,x:clamp(m.x+dx,0,1-m.w),y:clamp(m.y+dy,0,1-m.h)};
    let l=m.x,t=m.y,r=m.x+m.w,b=m.y+m.h;
    if(handle.includes('l')) l=clamp(l+dx,0,r-.02); else r=clamp(r+dx,l+.02,1);
    if(handle.includes('t')) t=clamp(t+dy,0,b-.02); else b=clamp(b+dy,t+.02,1);
    return {...m,x:l,y:t,w:r-l,h:b-t};
  }
  function batch(project, sourceID, targets) {
    const source=project.files.find(f=>f.id===sourceID);
    if (!source) return;
    project.files.filter(f=>f.id!==sourceID&&targets.includes(f.id)).forEach(f=>{f.masks=source.masks.map(m=>({...m,start:0,end:f.duration,id:id()}));});
  }
  function images(raw={}) {
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>20)throw Error('图片素材最多20张。');
    const result={};let size=0;for(const [key,value] of Object.entries(raw)){
      if(!/^[a-zA-Z0-9-]{1,80}$/.test(key)||typeof value!=='string'||value.length>2800000||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('图片素材无效，请重新选择 PNG、JPG 或 WebP 图片。');
      const header=atob(value.split(',')[1].slice(0,32)),dimension=offset=>[0,1,2,3].reduce((n,i)=>n*256+header.charCodeAt(offset+i),0),w=dimension(16),h=dimension(20);
      if(header.slice(12,16)!=='IHDR'||!(w>0&&w<=1280&&h>0&&h<=1280))throw Error('图片尺寸无效或超过1280像素，请重新导入。');
      size+=value.length;if(size>8*1024*1024)throw Error('项目图片总量超过8MB，请选择较小图片。');result[key]=value;
    }return result;
  }
  function format(s) { const n=Math.max(0,Math.floor(finite(s)));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,'0')).join(':'); }
  function elapsed(s){const n=Math.max(0,Math.floor(finite(s)));return String(Math.floor(n/60)).padStart(2,'0')+'分'+String(n%60).padStart(2,'0')+'秒';}
  return {initial,clone,id,mask,range,parse,seconds,plan,moveMask,batch,format,elapsed,images};
})();
if(typeof module!=='undefined')module.exports=FrameFlowCore;
