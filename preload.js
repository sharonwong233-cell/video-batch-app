'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: (opts) => ipcRenderer.invoke('select-folder', opts),
  scanDir: (dir) => ipcRenderer.invoke('scan-dir', { dir }),
  startProcess: (config) => ipcRenderer.invoke('start-process', config),
  cancelProcess: () => ipcRenderer.invoke('cancel-process'),
  onProgress: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('on-progress', listener);
    return () => ipcRenderer.removeListener('on-progress', listener);
  },
});
