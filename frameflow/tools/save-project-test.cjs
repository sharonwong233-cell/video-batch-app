'use strict';
// Execute the actual main-process save function, with only Electron dialogs mocked.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const C=require('../frameflow-core'),root=path.resolve(__dirname,'..'),file=path.join(root,'windows版/main.js'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'frameflow-save-test-'));
let calls=0,cancel=false;const target=path.join(dir,'图片项目.json'),localRequire=createRequire(file);
const app={commandLine:{getSwitchValue:()=>''},requestSingleInstanceLock:()=>true,on(){},whenReady:()=>({then(){}}),getPath:()=>dir};
const electron={app,dialog:{showSaveDialog:async()=>{calls++;return {canceled:cancel,filePath:target};}},ipcMain:{handle(){}},protocol:{registerSchemesAsPrivileged(){}}};
const context=vm.createContext({require:name=>name==='electron'?electron:localRequire(name),__dirname:path.dirname(file),process,Buffer,console,URL,Response,Headers,setTimeout,clearTimeout});
vm.runInContext(fs.readFileSync(file,'utf8')+'\nglobalThis.testSave=saveProject;',context,{filename:file});
async function main(){
 const p=C.initial();p.images.test='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';p.files=[{id:'clip',name:'源视频.mp4',duration:3,masks:[C.mask({type:'图片',imageId:'test'})]}];
 assert.equal((await context.testSave(JSON.stringify(p))).saved,true);const restored=C.parse(fs.readFileSync(target,'utf8'));assert.equal(restored.version,3);assert.equal(restored.images.test,p.images.test);assert.equal(restored.files[0].masks[0].imageId,'test');
 const before=fs.readFileSync(target,'utf8');cancel=true;assert.equal((await context.testSave(JSON.stringify(p))).saved,false);assert.equal(fs.readFileSync(target,'utf8'),before);cancel=false;
 const n=calls;await assert.rejects(()=>context.testSave(JSON.stringify({...p,version:99})));assert.equal(calls,n);assert.equal(fs.readFileSync(target,'utf8'),before);
 const old=C.initial();old.version=2;delete old.images;await context.testSave(JSON.stringify(old));assert.equal(JSON.parse(fs.readFileSync(target,'utf8')).version,3);
 console.log('SAVE_PROJECT_PASS: version3 image round-trip, cancel preservation, invalid rejection before dialog, version2 migration. Mocked dialog; not native Windows UI.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(dir,{recursive:true,force:true}));
