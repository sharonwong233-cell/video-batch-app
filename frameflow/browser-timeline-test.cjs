'use strict';
// Isolated Chrome fallback for layout-only checks when Electron cannot launch.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const profile=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'frameflow-layout-')),version=require('./windows版/package.json').version,dir=path.join(__dirname,'验收记录/V'+version);
const chrome=spawn(require('./tools/browser-path.cjs')(),['--headless','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
let socket,server,closed=false;const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const file=path.join(profile,'DevToolsActivePort');for(let i=0;i<200&&!fs.existsSync(file);i++){if(chrome.exitCode!==null)throw Error('Chrome exited '+chrome.exitCode);await pause(50);}const port=fs.readFileSync(file,'utf8').split('\n')[0];
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let id=0;const pending=new Map();socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')console.error(JSON.stringify(m.params));if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
 const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 await call('Page.enable');await call('Runtime.enable');
 server=http.createServer((req,res)=>{const name=req.url==='/'?'视频处理应用-高保真交互原型.html':req.url.slice(1);if(!['视频处理应用-高保真交互原型.html','frameflow-core.js','frameflow-app.js'].includes(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,name)));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
 const evalJS=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await evalJS('(async()=>{for(let i=0;i<100&&!window.FrameFlow;i++)await new Promise(r=>setTimeout(r,50));if(!window.FrameFlow)throw Error("Page boot failed: "+location.href+" / "+document.title+" / "+document.body?.innerText.slice(0,300));})()');
 let width=1440,height=900,zoom=1;
 const setMetrics=()=>call('Emulation.setDeviceMetricsOverride',{width:Math.round(width/zoom),height:Math.round(height/zoom),deviceScaleFactor:zoom,mobile:false});
 await setMetrics();
 const window={webContents:{executeJavaScript:code=>evalJS(code.replace('while(!window.FrameFlow?.ready())','while(!window.FrameFlow)')),setZoomFactor:value=>{zoom=value;return setMetrics();},capturePage:async()=>{const r=await call('Page.captureScreenshot',{format:'png'});return {toPNG:()=>Buffer.from(r.data,'base64')};}},setSize:(w,h)=>{width=w;height=h;return setMetrics();}};
 const app={commandLine:{getSwitchValue:()=>dir},exit:code=>{closed=true;socket.close();chrome.kill('SIGTERM');process.exitCode=code;}};
 await require('./timeline-acceptance.cjs')(window,app);
 if(process.exitCode===0){const report=path.join(dir,'timeline-report.json'),r=JSON.parse(fs.readFileSync(report,'utf8'));r.environment='Isolated headless Chrome; layout fixtures only; device metrics emulate scale, not native Windows display scaling';fs.writeFileSync(report,JSON.stringify(r,null,2));}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server?.close();if(!closed){socket?.close();chrome.kill('SIGTERM');}});
