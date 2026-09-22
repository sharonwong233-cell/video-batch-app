'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {performance}=require('node:perf_hooks');
const {spawn}=require('node:child_process');
const C=require('./frameflow-core');
const ratio=value=>{const [a,b=1]=String(value||'0').split(/[/:]/).map(Number);return b&&Number.isFinite(a/b)?a/b:0;};
const even=value=>Math.max(2,Math.round(value/2)*2);
const n=value=>String(Number(Number(value).toFixed(6)));
const cancelled=()=>Object.assign(Error('任务已取消，原视频和已有输出未改变。'),{code:'CANCELLED'});

class Engine{
  constructor(runtime){this.runtime=runtime;this.job=null;this.encoder=null;this.children=new Set();}
  async shutdown(){await Promise.all([...this.children].map(child=>new Promise(resolve=>{child.once('close',resolve);child.kill('SIGKILL');})));}
  bin(name){return path.join(this.runtime,name+(process.platform==='win32'?'.exe':''));}
  run(name,args,{job=null,onProgress=null,timeout=0,binary=false,strict=false}={}){
    if(job?.cancelled)return Promise.reject(cancelled());
    return new Promise((resolve,reject)=>{
      const child=spawn(this.bin(name),args,{windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});
      this.children.add(child);child.once('close',()=>this.children.delete(child));
      if(job)job.child=child;
      let stdout=[],length=0,stderr='',pending='',timedOut=false;
      const timer=timeout?setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeout):null;
      child.stdout.on('data',data=>{
        if(onProgress){pending+=data.toString();const lines=pending.split(/\r?\n/);pending=lines.pop();for(const line of lines){const match=/^out_time_us=(\d+)/.exec(line);if(match)onProgress(Number(match[1])/1e6);}}
        else{length+=data.length;if(length>64*1024*1024){child.kill();stderr='响应超过大小上限';}else stdout.push(data);}
      });
      child.stderr.on('data',data=>{stderr=(stderr+data).slice(-24000);});
      child.once('error',error=>{clearTimeout(timer);if(job?.child===child)job.child=null;reject(Error('视频引擎无法启动：'+error.message));});
      child.once('close',code=>{clearTimeout(timer);if(job?.child===child)job.child=null;if(job?.cancelled)return reject(cancelled());if(timedOut)return reject(Error('视频读取或处理超时，请检查文件。'));if(code!==0||(strict&&/corrupt|invalid (?:data|nal|packet)|error (?:while decoding|submitting|during)/i.test(stderr)))return reject(Object.assign(Error(stderr.trim()||'视频处理失败，退出码 '+code),{engineFailure:true}));const data=Buffer.concat(stdout);resolve(binary?data:data.toString());});
    });
  }
  async health(){const [ffmpeg,ffprobe]=await Promise.all(['ffmpeg','ffprobe'].map(name=>this.run(name,['-version'],{timeout:15000})));return {ready:true,ffmpeg:ffmpeg.split('\n')[0],ffprobe:ffprobe.split('\n')[0]};}
  async probe(filePath,job=null){
    if(typeof filePath!=='string'||!path.isAbsolute(filePath))throw Error('请导入本地视频文件。');
    const stat=await fs.promises.stat(filePath);if(!stat.isFile())throw Error('源视频不是普通文件。');
    const raw=JSON.parse(await this.run('ffprobe',['-v','error','-show_streams','-show_format','-show_data','-of','json',filePath],{timeout:45000,job}));
    const v=raw.streams.find(s=>s.codec_type==='video'&&!s.disposition?.attached_pic),a=raw.streams.find(s=>s.codec_type==='audio');
    if(!v)throw Error('文件中没有可读取的视频轨道。');
    const rotation=Number(v.side_data_list?.find(s=>s.rotation!=null)?.rotation||v.tags?.rotate||0),rotated=Math.abs(rotation%180)>45;
    const sar=ratio(v.sample_aspect_ratio)||1,width=rotated?v.height:v.width*sar,height=rotated?v.width*sar:v.height;
    const duration=Number(v.duration||raw.format.duration),fps=ratio(v.avg_frame_rate)||ratio(v.r_frame_rate);
    if(!(duration>0&&fps>0&&width>0&&height>0)||duration>604800)throw Error('视频时长、尺寸或帧率无效（最长支持 7 天素材）。');
    return {path:filePath,name:path.basename(filePath),size:stat.size,duration,width:Math.round(width),height:Math.round(height),fps,bitrate:Number(v.bit_rate)||0,codec:v.codec_name,pixelFormat:v.pix_fmt,rotation,sar,hdr:['smpte2084','arib-std-b67'].includes(v.color_transfer),vfr:Math.abs(ratio(v.r_frame_rate)-fps)>.1,audio:!!a,videoIndex:v.index,audioIndex:a?.index,signature:JSON.stringify([v.codec_name,v.profile,v.width,v.height,v.pix_fmt,v.time_base,v.extradata,v.avg_frame_rate,a?.codec_name,a?.sample_rate,a?.channels,a?.channel_layout,a?.extradata]),audioCodec:a?.codec_name};
  }
  async prepare(raw,job=null){
    const project=C.parse(raw),files=project.files.filter(f=>f.selected);if(!files.length)throw Error('请至少勾选一个视频。');
    for(const file of files)Object.assign(file,await this.probe(file.path,job));
    const plan=C.plan(project),first=files[0],warnings=[],fit=project.settings.fit!=='none';
    const width=even(first.width),height=even(first.height),fps=first.fps,bitrate=first.bitrate;
    const groups=(project.settings.concat?[files]:files.map(f=>[f])).map(items=>{
      const baseline=fit?first:items[0],target={width:even(baseline.width),height:even(baseline.height),fps:items[0].fps,bitrate:items[0].bitrate};
      const masks=items.some(f=>f.masks.some(m=>m.enabled));
      const compatible=items.every(f=>f.signature===items[0].signature&&f.rotation===items[0].rotation&&f.sar===items[0].sar&&f.videoIndex===items[0].videoIndex&&f.audioIndex===items[0].audioIndex);
      const mp4=items.every(f=>['h264','hevc'].includes(f.codec)&&(!f.audio||f.audioCodec==='aac'));
      const adaptation=fit&&items.some(f=>f.width!==target.width||f.height!==target.height);
      const copy=!masks&&compatible&&mp4&&!adaptation;
      if(!copy&&items.some(f=>f.hdr))throw Error('HDR 素材需要重新编码，请先转换为 SDR；本版不自动改变 HDR 色彩。');
      if(!fit&&!copy&&items.some(f=>f.width%2||f.height%2))throw Error('重新编码需要偶数尺寸；请开启画面适配或使用偶数尺寸素材。');
      let reason='';
      if(!compatible)reason='编码格式、分辨率、帧率或音轨参数不兼容';
      else if(!mp4)reason='源编码不符合本版 MP4 无损输出兼容条件';
      else if(adaptation)reason='画面适配需要改变画面尺寸或方向';
      if(reason)warnings.push(items[0].name+'：'+reason+'，将自动使用容错解码并重新编码。');
      if(!copy)warnings.push(items[0].name+'：'+(target.bitrate?'目标码率 '+(target.bitrate/1e6).toFixed(2)+' Mbps':'源视频码率未知，使用 CRF 18')+'；编码后码率与画质可能有偏差。');
      return {files:items,...target,copy,recover:!!reason,total:items.reduce((sum,f)=>sum+f.duration,0)};
    });
    const copy=groups.every(g=>g.copy);
    if(groups.some(g=>g.copy))warnings.push('无打码且参数兼容的素材直接复制视频流，不重编码；保留源编码，切分位置随关键帧可能有偏差。输出仍做解码核验，异常时自动容错重编码。');
    const output=project.settings.output.trim();if(!path.isAbsolute(output))throw Error('请选择本地输出目录。');
    const stat=await fs.promises.stat(output);if(!stat.isDirectory())throw Error('输出位置不是文件夹。');await fs.promises.access(output,fs.constants.W_OK);
    const names=await fs.promises.readdir(output),base=project.settings.baseName.trim().toLowerCase();
    if(names.some(name=>name.toLowerCase().startsWith(base+'_')&&/^\d+\.mp4$/i.test(name.slice(base.length+1))))throw Error('输出目录已有同名课程片段。请更改课程名称或选择另一目录，已有文件不会覆盖。');
    const estimatedBytes=Math.ceil(groups.reduce((sum,g)=>sum+(g.copy?g.files.reduce((s,f)=>s+f.size,0)*2.1:g.total*((g.bitrate||g.width*g.height*g.fps*.12)+192000)/8*2.4),0));
    if(fs.promises.statfs){const space=await fs.promises.statfs(output);if(space.bavail*space.bsize<estimatedBytes)throw Error('输出磁盘可用空间不足，预计需 '+(estimatedBytes/1024**3).toFixed(2)+' GB（含临时文件）。');}
    return {project,files,plan,output,width,height,fps,bitrate,copy,warnings,estimatedBytes,groups};
  }
  filter(file,target,{time=null,imageInputs={}}={}){
    // Both preview and export use this exact graph. Coordinates refer to displayed, rotated video.
    const parts=[`[0:${file.videoIndex}]setpts=PTS-STARTPTS,scale=${even(file.width)}:${even(file.height)},setsar=1[v0]`];let last='v0',index=0;
    for(const original of file.masks||[]){const m=C.mask(original),timing=C.range(m,file.duration);if(!m.enabled||(time!=null&&(time<timing.start||time>=timing.end)))continue;
      const w0=even(file.width),h0=even(file.height),x=Math.min(w0-2,Math.floor(m.x*w0/2)*2),y=Math.min(h0-2,Math.floor(m.y*h0/2)*2),w=Math.min(w0-x,even(m.w*w0)),h=Math.min(h0-y,even(m.h*h0)),out='v'+(++index);
      const enable=time==null?`:enable='gte(t,${n(timing.start)})*lt(t,${n(timing.end)})'`:'';
      if(m.type==='纯色')parts.push(`[${last}]drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${m.color.replace('#','0x')}:t=fill${enable}[${out}]`);
      else if(m.type==='图片'){
        if(imageInputs[m.id]==null)throw Error('图片区域缺少图片，请重新选择。');
        parts.push(`[${imageInputs[m.id]}:v]format=rgba,scale=${w}:${h},setsar=1[image${index}]`);
        parts.push(`[${last}][image${index}]overlay=${x}:${y}:eof_action=repeat:repeatlast=1${enable}[${out}]`);
      }
      else{const radius=Math.max(1,Math.min(Math.floor(Math.min(w,h)/4),Math.round(m.strength*w0/960))),cell=Math.max(2,Math.round(m.strength*w0/960));
        parts.push(`[${last}]split[base${index}][crop${index}]`);
        const effect=m.type==='模糊'?`boxblur=luma_radius=${radius}:luma_power=2:chroma_radius=0`:`scale=${Math.max(1,Math.ceil(w/cell))}:${Math.max(1,Math.ceil(h/cell))}:flags=neighbor,scale=${w}:${h}:flags=neighbor`;
        parts.push(`[crop${index}]crop=${w}:${h}:${x}:${y},${effect}[effect${index}]`);
        parts.push(`[base${index}][effect${index}]overlay=${x}:${y}:eof_action=pass${enable}[${out}]`);
      }last=out;
    }
    parts.push(`[${last}]scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,format=yuv420p${time==null?',fps='+n(target.fps):''}[vout]`);
    return parts.join(';');
  }
  async selectEncoder(job){
    if(this.encoder)return this.encoder;
    const names=process.platform==='darwin'?['h264_videotoolbox']:process.platform==='win32'?['h264_nvenc','h264_qsv','h264_amf']:[];
    for(const name of names){try{await this.run('ffmpeg',['-hide_banner','-v','error','-f','lavfi','-i','color=size=320x180:rate=25','-frames:v','2','-c:v',name,'-pix_fmt','yuv420p','-f','null','-'],{timeout:15000,job});return this.encoder=name;}catch(e){if(job?.cancelled)throw e;}}
    return this.encoder='libx264';
  }
  encoding(encoder,p){const args=['-c:v',encoder,'-pix_fmt','yuv420p'];if(encoder==='libx264')args.push('-preset','medium');
    if(p.bitrate>0)args.push('-b:v',String(p.bitrate));else if(encoder==='libx264')args.push('-crf','18');else args.push('-b:v',String(Math.round(p.width*p.height*p.fps*.12)));
    args.push('-g',String(Math.max(1,Math.round(p.fps*2))),'-bf','0','-force_key_frames','expr:gte(t,n_forced*1)','-video_track_timescale','90000');return args;
  }
  async imageInputs(file,images,dir,startIndex=1){
    const data=C.images(images),args=[],indices={};
    for(const m of file.masks||[])if(m.enabled&&m.type==='图片'){
      if(!Object.hasOwn(data,m.imageId))throw Error('图片区域缺少图片，请重新选择。');
      const dest=path.join(dir,'overlay-'+Object.keys(indices).length+'.png');await fs.promises.writeFile(dest,Buffer.from(data[m.imageId].split(',')[1],'base64'));
      indices[m.id]=startIndex+Object.keys(indices).length;args.push('-i',dest);
    }return {args,indices};
  }
  async preview(rawFile,time,baseline=null,settings={},images={}){
    const file={...rawFile,...await this.probe(rawFile.path)},first=settings.fit!=='none'&&baseline?.path?await this.probe(baseline.path):file,target={width:even(first.width),height:even(first.height),fps:first.fps};
    if(file.hdr)throw Error('HDR 素材需先转换为 SDR。');
    time=Math.max(0,Math.min(Number(time)||0,file.duration-1/file.fps));
    const dir=await fs.promises.mkdtemp(path.join(os.tmpdir(),'frameflow-preview-'));
    try{const image=await this.imageInputs(file,images,dir),data=await this.run('ffmpeg',['-hide_banner','-v','error','-ss',n(time),'-i',file.path,...image.args,'-filter_complex_threads','1','-filter_complex',this.filter(file,target,{time,imageInputs:image.indices}),'-map','[vout]','-frames:v','1','-c:v','png','-f','image2pipe','pipe:1'],{binary:true,timeout:60000});
    return 'data:image/png;base64,'+data.toString('base64');}finally{await fs.promises.rm(dir,{recursive:true,force:true});}
  }
  async playback(filePath,destination){
    const meta=await this.probe(filePath);if(meta.hdr)throw Error('HDR 视频请先转换为 SDR 再导入。');
    const scale=Math.min(1,1280/meta.width,720/meta.height);
    await this.run('ffmpeg',['-hide_banner','-v','error','-nostdin','-y','-i',filePath,'-map','0:'+meta.videoIndex,'-map','0:a:0?','-vf',`scale=${even(meta.width*scale)}:${even(meta.height*scale)},setsar=1`,'-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-g','25','-c:a','aac','-b:a','128k','-ac','2','-movflags','+faststart',destination]);
    return destination;
  }
  status(){if(!this.job)return null;const {child,cancelled,started,...value}=this.job;return {...value,elapsed:value.state==='running'?(performance.now()-started)/1000:value.elapsed};}
  start(raw){if(this.job?.state==='running')throw Error('已有任务正在处理。');const job={id:C.id(),state:'running',started:performance.now(),progress:0,message:'检查素材与输出目录…',output:'',outputs:[],logs:[],warnings:[],cancelled:false};this.job=job;this.execute(C.clone(raw),job);return this.status();}
  cancel(){if(this.job?.state==='running'){this.job.cancelled=true;this.job.message='正在取消并清理本次临时文件…';this.job.child?.kill('SIGKILL');}return this.status();}
  async processGroup(group,p,temp,job,offset,log){
    let attemptDirectory;
    const check=()=>{if(job.cancelled)throw cancelled();};
    const progress=fraction=>{job.progress=Math.min(96,Math.round((offset+group.total*fraction)/p.plan.total*96));};
    const warn=text=>{job.warnings.push(text);log(text);};
    const mediaFailure=e=>(e.engineFailure||e.mediaFailure)&&!/no space left|permission denied|read.only file|input\/output error|cannot allocate memory|no such file/i.test(e.message);
    const attempt=async(copy,encoder,tolerant)=>{
      check();const dir=await fs.promises.mkdtemp(path.join(temp,'attempt-')),files=[];attemptDirectory=dir;
      job.encoder=copy?'copy':encoder;const audio=copy?group.files[0].audio:group.files.some(f=>f.audio);let elapsed=0;
      for(let i=0;i<group.files.length;i++){
        check();const file=group.files[i];log((copy?'直接复制视频流：':tolerant?'容错解码并编码：':'处理视频：')+file.name);
        if(copy){files.push(file.path);continue;}
        const dest=path.join(dir,'clip-'+i+'.mp4'),args=['-hide_banner','-v','warning','-nostdin','-y'];
        if(tolerant)args.push('-fflags','+genpts+discardcorrupt','-err_detect','ignore_err');else args.push('-xerror');
        args.push('-i',file.path);if(audio&&!file.audio)args.push('-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000');
        const image=await this.imageInputs(file,p.project.images,dir,audio&&!file.audio?2:1);args.push(...image.args);
        args.push('-filter_complex_threads','1','-filter_complex',this.filter(file,group,{imageInputs:image.indices}),'-map','[vout]');
        if(audio)args.push('-map',file.audio?'0:'+file.audioIndex:'1:a:0','-af','aresample=48000:async=1:first_pts=0,apad','-c:a','aac','-b:a','192k','-ar','48000','-ac','2');
        args.push('-t',n(file.duration),...this.encoding(encoder,group),'-map_metadata','-1','-map_chapters','-1','-movflags','+faststart','-progress','pipe:1','-nostats',dest);
        await this.run('ffmpeg',args,{job,onProgress:seconds=>progress((elapsed+Math.min(seconds,file.duration))/group.total*.72)});files.push(dest);elapsed+=file.duration;
      }
      check();log(p.project.settings.concat?'按顺序拼接并分段…':'独立分段：'+group.files[0].name);
      // AAC encoder padding can overlap at clip joins; let the muxer normalize timestamps, then verify decoded outputs.
      const args=['-hide_banner','-v','warning','-nostdin','-y'];
      if(files.length===1)args.push('-i',files[0]);
      else{
        const list=path.join(dir,'concat.txt');await fs.promises.writeFile(list,files.map(file=>"file '"+file.replace(/\\/g,'/').replace(/'/g,"'\\''")+"'").join('\n')+'\n');
        args.push('-f','concat','-safe','0','-i',list);
      }
      args.push('-map',copy?'0:'+group.files[0].videoIndex:'0:v:0');if(audio)args.push('-map',copy?'0:'+group.files[0].audioIndex:'0:a:0');
      args.push('-c','copy','-map_metadata','-1','-map_chapters','-1','-f','segment','-segment_time',String(C.seconds(p.project.settings)),'-reset_timestamps','1','-segment_format','mp4','-segment_format_options','movflags=+faststart','-progress','pipe:1','-nostats',path.join(dir,'part-%06d.mp4'));
      await this.run('ffmpeg',args,{job,strict:copy,onProgress:seconds=>progress((copy?0:.72)+Math.min(seconds/group.total,1)*(copy?.3:.08))});
      const parts=(await fs.promises.readdir(dir)).filter(name=>/^part-\d+\.mp4$/.test(name)).sort();
      const invalid=text=>Object.assign(Error(text),{mediaFailure:true});if(!parts.length)throw invalid('视频处理没有生成片段。');
      const results=[];let total=0;
      for(let i=0;i<parts.length;i++){
        check();const source=path.join(dir,parts[i]),meta=await this.probe(source,job),expected=copy?group.files[0]:group;
        if(meta.codec!==(copy?expected.codec:'h264')||meta.audio!==audio||(audio&&meta.audioCodec!=='aac')||meta.size<100||meta.width!==expected.width||meta.height!==expected.height)throw invalid('输出格式与处理参数不一致，未发布文件。');
        log('核验视频码流：'+(i+1)+' / '+parts.length);
        // ponytail: decode verification detects corrupt frames without an encode pass; it still costs decoder time.
        await this.run('ffmpeg',['-hide_banner','-v','error','-nostdin','-xerror','-err_detect','explode','-i',source,'-map','0:v:0','-map','0:a:0?','-f','null','-'],{job,strict:true});
        results.push({source,duration:meta.duration,size:meta.size,width:meta.width,height:meta.height,fps:meta.fps,codec:meta.codec,audioCodec:meta.audioCodec||'',mode:copy?'copy':'encode'});total+=meta.duration;progress((copy?.3:.8)+(i+1)/parts.length*(copy?.7:.2));
      }
      if(Math.abs(total-group.total)>Math.max(2,parts.length*.15))throw invalid('输出总时长不符合源素材，未发布文件。');
      return results;
    };
    let encoder=group.copy?'copy':await this.selectEncoder(job);
    try{return await attempt(group.copy,encoder,group.recover);}
    catch(error){
      if(job.cancelled||!mediaFailure(error))throw error;
      if(group.files.some(f=>f.hdr))throw Error('HDR 码流异常，不能安全自动重编码。请先修复素材或转换为 SDR。');
      if(!group.copy&&encoder==='libx264'&&group.recover)throw error;
      job.fallback=true;this.encoder='libx264';
      warn(group.copy?'检测到复制或码流核验异常，自动切换容错解码与软件重编码。':encoder==='libx264'?'检测到解码异常，自动切换容错解码与重新编码。':'硬件处理失败，自动切换容错解码与软件重编码。');
      warn('容错处理可能跳过损坏帧或修正时间戳，请检查输出画面；原因：'+error.message.slice(0,500));
      await fs.promises.rm(attemptDirectory,{recursive:true,force:true});
      return attempt(false,'libx264',true);
    }
  }
  async execute(raw,job){
    let temp=null,published=[],finalState='failed';
    const check=()=>{if(job.cancelled)throw cancelled();};
    const log=text=>{job.message=text;job.logs.push(text);if(job.logs.length>1000)job.logs.shift();};
    try{
      const p=await this.prepare(raw,job);job.output=p.output;job.spec={width:p.width,height:p.height,fps:p.fps,bitrate:p.bitrate};job.warnings=[...p.warnings];
      p.warnings.forEach(log);temp=await fs.promises.mkdtemp(path.join(p.output,'.frameflow-'));const verified=[];let offset=0;
      for(const group of p.groups){verified.push(...await this.processGroup(group,p,temp,job,offset,log));offset+=group.total;}
      check();job.progress=97;log('保存已核验的视频…');
      for(let i=0;i<verified.length;i++){
        const result=verified[i];result.name=p.project.settings.baseName.trim()+'_'+String(i+1).padStart(3,'0')+'.mp4';result.path=path.join(p.output,result.name);
        if(p.files.some(f=>path.resolve(f.path).toLowerCase()===result.path.toLowerCase()))throw Error('输出文件与源视频同名。');
        check();await fs.promises.copyFile(result.source,result.path,fs.constants.COPYFILE_EXCL);published.push(result.path);
      }
      job.outputs=verified.map(({source,...value})=>value);job.progress=100;finalState='complete';log('已生成 '+verified.length+' 个视频片段。');
    }catch(error){
      for(const file of published)await fs.promises.unlink(file).catch(()=>{});
      finalState=job.cancelled?'cancelled':'failed';job.message=job.cancelled?cancelled().message:error.message;job.logs.push(job.message);job.outputs=[];
    }finally{if(temp)await fs.promises.rm(temp,{recursive:true,force:true}).catch(error=>{job.logs.push('临时文件清理失败：'+temp+'（'+error.message+'）');});job.state=finalState;job.elapsed=(performance.now()-job.started)/1000;}
  }
}
module.exports={Engine,ratio};
