'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),payload=path.join(root,'FrameFlow-Windows-x64');
function sync(){
 if(!fs.existsSync(path.join(payload,'FrameFlow.exe')))throw Error('缺少 Windows 运行时，请运行 npm run setup:windows。');
 const app=path.join(payload,'resources/app');fs.mkdirSync(app,{recursive:true});
 fs.cpSync(path.join(root,'src'),path.join(app,'src'),{recursive:true});
 fs.copyFileSync(path.join(root,'package.json'),path.join(app,'package.json'));
 const runtime=path.join(app,'runtime/win32');fs.mkdirSync(runtime,{recursive:true});
 for(const name of ['ffmpeg.exe','ffprobe.exe','LICENSE','README.txt'])fs.copyFileSync(path.join(root,'runtime/win32',name),path.join(runtime,name));
 fs.copyFileSync(path.join(root,'docs/DEPENDENCIES.md'),path.join(payload,'DEPENDENCIES.md'));
 fs.copyFileSync(path.join(root,'docs/windows/Windows使用说明.txt'),path.join(payload,'README.txt'));
 console.log('PAYLOAD_SYNC_PASS '+require('../package.json').version);
}
module.exports={sync};if(require.main===module)sync();
