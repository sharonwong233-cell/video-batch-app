'use strict';
const {contextBridge,ipcRenderer,webUtils}=require('electron');

contextBridge.exposeInMainWorld('frameFlowNative',{
  platform:process.platform==='win32'?'Windows':'macOS',
  invoke:(action,data={})=>ipcRenderer.invoke('frameflow',{action,...data}),
  getPathForFile:file=>webUtils.getPathForFile(file)
});
