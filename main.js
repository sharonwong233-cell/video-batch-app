'use strict';

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  scanDir, getVideoDuration, mergeVideos, splitVideo, resolveBin,
} = require('./processor');

let mainWindow = null;
let cancelFlag = false;

// ---------------------------------------------------------------------------
// FFmpeg 二进制定位
// ---------------------------------------------------------------------------

function binDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin');
  }
  return path.join(__dirname, 'resources', 'bin');
}

function tempMergedPath() {
  return path.join(os.tmpdir(), `vbs_merge_${process.pid}_${Date.now()}.mp4`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 800,
    minWidth: 760,
    minHeight: 680,
    autoHideMenuBar: true,
    backgroundColor: '#12151c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 调试钩子：--screenshot=<png> 截图后退出
  const shotArg = process.argv.find((a) => a.startsWith('--screenshot='));
  if (shotArg) {
    const out = shotArg.split('=')[1];
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        mainWindow.webContents.capturePage().then((img) => {
          fs.writeFileSync(out, img.toPNG());
          console.log('screenshot saved:', out);
          app.exit(0);
        });
      }, 1500);
    });
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

ipcMain.handle('select-folder', async (event, opts = {}) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: opts.title || '选择文件夹',
  });
  if (r.canceled || !r.filePaths.length) return null;
  return r.filePaths[0];
});

ipcMain.handle('scan-dir', async (event, { dir }) => {
  const ffprobe = resolveBin('ffprobe', binDir());
  const files = scanDir(dir);
  const out = [];
  for (const f of files) {
    try {
      const duration = await getVideoDuration(f.path, { ffprobe });
      out.push({ name: f.name, path: f.path, duration });
    } catch (e) {
      out.push({ name: f.name, path: f.path, duration: null });
    }
  }
  return out;
});

ipcMain.handle('start-process', async (event, config) => {
  cancelFlag = false;
  const send = (obj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('on-progress', obj);
    }
  };

  const ffmpeg = resolveBin('ffmpeg', binDir());
  const ffprobe = resolveBin('ffprobe', binDir());

  try {
    const { files, outputDir, trimHeadSec, segmentMin, maskColor, maskSize, maskPos } = config;

    // 阶段 1：拼接
    send({ type: 'stage', stage: 'merge' });
    const merged = tempMergedPath();
    const { duration } = await mergeVideos(
      files,
      merged,
      { trimHeadSec, maskColor, maskSize, maskPos, ffmpeg, ffprobe },
      (pct) => send({ type: 'merge-progress', percent: pct })
    );
    if (cancelFlag) { fs.rmSync(merged, { force: true }); return { result: { cancelled: true } }; }

    // 阶段 2：切分
    send({ type: 'stage', stage: 'split' });
    const { segments } = await splitVideo(
      merged,
      outputDir,
      segmentMin,
      { ffmpeg, ffprobe, baseName: 'merged' },
      (pct) => send({ type: 'split-progress', percent: pct })
    );

    // 只要片段，删除完整长视频
    fs.rmSync(merged, { force: true });

    return { result: { segments, duration, outputDir } };
  } catch (e) {
    return { error: String(e.message || e) };
  }
});

ipcMain.handle('cancel-process', () => {
  cancelFlag = true;
  return true;
});

// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
