'use strict';
const fs=require('node:fs'),path=require('node:path');
module.exports=function(){
 const candidates=[process.env.FRAMEFLOW_BROWSER];
 if(process.platform==='darwin')candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
 if(process.platform==='win32')for(const base of [process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean))for(const app of ['Google/Chrome/Application/chrome.exe','Microsoft/Edge/Application/msedge.exe'])candidates.push(path.join(base,app));
 if(process.platform==='linux')candidates.push('/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser');
 const selected=candidates.find(p=>p&&fs.existsSync(p));if(!selected)throw Error('Chrome/Edge not found. Set FRAMEFLOW_BROWSER to the executable path.');return selected;
};
