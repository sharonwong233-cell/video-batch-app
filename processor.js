'use strict';

const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v', '.ts',
]);

// ---------------------------------------------------------------------------
// 二进制定位
// ---------------------------------------------------------------------------

function resolveBin(name, ffmpegDir) {
  if (ffmpegDir) {
    const p = path.join(ffmpegDir, `${name}.exe`);
    try {
      fs.accessSync(p);
      return p;
    } catch (e) { /* fallthrough */ }
  }
  return name; // 回退到系统 PATH
}

// ---------------------------------------------------------------------------
// 媒体信息
// ---------------------------------------------------------------------------

function getVideoDuration(filepath, { ffprobe = 'ffprobe' } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      ffprobe,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filepath],
      { timeout: 30000 },
      (err, stdout) => {
        if (err) return reject(err);
        const dur = parseFloat(String(stdout).trim());
        if (Number.isNaN(dur)) return reject(new Error(`无法解析时长: ${stdout}`));
        resolve(dur);
      }
    );
  });
}

function getVideoInfo(filepath, { ffprobe = 'ffprobe' } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      ffprobe,
      [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,r_frame_rate',
        '-of', 'csv=p=0',
        filepath,
      ],
      { timeout: 30000 },
      (err, stdout) => {
        if (err) return reject(err);
        const line = String(stdout).trim().split('\n')[0];
        const parts = line.split(',');
        if (parts.length < 3) return reject(new Error(`无法读取视频信息: ${stdout}`));
        const width = parseInt(parts[0], 10);
        const height = parseInt(parts[1], 10);
        const [num, den] = parts[2].split('/');
        const fps = parseFloat(num) / (parseFloat(den) || 1);
        if (!width || !height) return reject(new Error(`分辨率无效: ${stdout}`));
        resolve({ width, height, fps: Number.isFinite(fps) && fps > 0 ? fps : 30 });
      }
    );
  });
}

// ---------------------------------------------------------------------------
// drawbox filter 构造
// ---------------------------------------------------------------------------

function buildDrawbox(maskSize, maskPos, maskColor) {
  const size = String(maskSize).trim();
  let w, h;
  if (size.endsWith('%')) {
    const pct = parseFloat(size.slice(0, -1)) / 100;
    w = `iw*${pct}`;
    h = `iw*${pct}`; // 以宽度为基准，保证正方形
  } else if (size.includes('x')) {
    const [wp, hp] = size.toLowerCase().split('x', 2);
    w = String(parseInt(wp, 10));
    h = String(parseInt(hp, 10));
  } else {
    const px = parseInt(size, 10);
    w = String(px);
    h = String(px);
  }

  const x = maskPos === 'topright' ? `iw-(${w})` : '0';
  const y = '0';
  return `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${maskColor}:t=fill`;
}

// ---------------------------------------------------------------------------
// ffmpeg 运行
// ---------------------------------------------------------------------------

/**
 * @param {string} bin ffmpeg 路径
 * @param {string[]} args 参数
 * @param {(pct:number)=>void} onProgress 进度回调（基于目标时长）
 * @param {number} [totalDur] 目标总时长（秒），用于计算百分比
 */
function runFfmpeg(bin, args, onProgress, totalDur) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { windowsHide: true });

    let buf = '';
    let errBuf = '';
    let lastReported = -1;

    proc.stdout.on('data', (chunk) => {
      if (!onProgress || !totalDur) return;
      buf += chunk.toString();
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (line.startsWith('out_time=')) {
          const val = line.slice('out_time='.length);
          if (val !== 'N/A') {
            const secs = parseTime(val);
            if (secs >= 0) {
              const pct = Math.min(99, Math.round((secs / totalDur) * 100));
              if (pct !== lastReported) {
                lastReported = pct;
                onProgress(pct);
              }
            }
          }
        }
      }
    });

    proc.stderr.on('data', (chunk) => {
      if (errBuf.length < 4000) errBuf += chunk.toString();
    });

    proc.on('error', (e) => reject(e));
    proc.on('close', (code) => {
      if (code === 0) {
        if (onProgress) onProgress(100);
        resolve();
      } else {
        reject(new Error(`ffmpeg 退出码 ${code}${errBuf ? '：' + errBuf.slice(-500).trim() : ''}`));
      }
    });
  });
}

function parseTime(s) {
  const m = s.match(/^(\d+):(\d+):([\d.]+)$/);
  if (!m) return NaN;
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
}

// ---------------------------------------------------------------------------
// 拼接 filter 构造
// ---------------------------------------------------------------------------

/**
 * 构造把所有输入统一到基准分辨率后 concat 的 filtergraph。
 * @param {number} n 输入个数
 * @param {{width:number,height:number,fps:number}} base 基准（第一个素材）
 * @param {string|null} drawbox 色块 filter（追加在拼接输出后），或 null
 */
function buildConcatFilter(n, base, drawbox) {
  const { width: W, height: H, fps: FPS } = base;
  const parts = [];

  for (let i = 0; i < n; i++) {
    // 视频：缩放后补黑边居中，对齐帧率与像素格式
    parts.push(
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,` +
      `fps=${FPS},format=yuv420p,settb=AVTB,setsar=1[v${i}]`
    );
    // 音频：统一采样率与声道
    parts.push(`[${i}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}]`);
  }

  // concat 输入必须是视频/音频交替排列：[v0][a0][v1][a1]...
  const interleaved = [];
  for (let i = 0; i < n; i++) {
    interleaved.push(`[v${i}][a${i}]`);
  }
  const ins = interleaved.join('');

  let concat = `${ins}concat=n=${n}:v=1:a=1[outv][outa]`;
  if (drawbox) {
    concat = `${ins}concat=n=${n}:v=1:a=1[outv0][outa];[outv0]${drawbox}[outv]`;
  }

  parts.push(concat);
  return parts.join(';');
}

// ---------------------------------------------------------------------------
// 拼接
// ---------------------------------------------------------------------------

/**
 * 拼接多个视频为一条长视频（剪片头 + 统一分辨率 + concat + 可选色块）。
 * @param {string[]} files 按序排列的素材路径
 * @param {string} output 输出路径
 * @param {object} cfg { trimHeadSec, maskColor, maskSize, maskPos, ffmpeg, ffprobe }
 * @param {(pct:number)=>void} onProgress
 * @returns {Promise<{duration:number}>} 拼接后的总时长
 */
async function mergeVideos(files, output, cfg, onProgress) {
  const {
    trimHeadSec = 0, maskColor, maskSize = '15%', maskPos = 'topleft',
    ffmpeg = 'ffmpeg', ffprobe = 'ffprobe',
  } = cfg;

  if (!files.length) throw new Error('没有可拼接的素材');
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const base = await getVideoInfo(files[0], { ffprobe });
  const drawbox = maskColor ? buildDrawbox(maskSize, maskPos, maskColor) : null;
  const filter = buildConcatFilter(files.length, base, drawbox);

  const args = ['-y'];
  for (const f of files) {
    if (trimHeadSec > 0) {
      args.push('-ss', String(trimHeadSec));
    }
    args.push('-i', f);
  }
  args.push('-filter_complex', filter);
  args.push('-map', '[outv]', '-map', '[outa]');
  args.push(
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    output
  );

  // 估算总时长（剪片头后）用于进度
  let totalDur = 0;
  for (const f of files) {
    const d = await getVideoDuration(f, { ffprobe });
    totalDur += Math.max(0, d - trimHeadSec);
  }

  await runFfmpeg(ffmpeg, args, onProgress, totalDur);
  const duration = await getVideoDuration(output, { ffprobe });
  return { duration };
}

// ---------------------------------------------------------------------------
// 切分
// ---------------------------------------------------------------------------

/**
 * 将长视频切成指定分钟数的片段（不足分钟数不补齐）。
 * @param {string} input 完整长视频
 * @param {string} outputDir 输出目录
 * @param {number} segmentMin 每段分钟数
 * @param {object} cfg { ffmpeg, ffprobe, baseName }
 * @param {(pct:number)=>void} onProgress 0-100
 * @returns {Promise<{segments:number}>}
 */
async function splitVideo(input, outputDir, segmentMin, cfg, onProgress) {
  const { ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', baseName = 'merged' } = cfg;

  fs.mkdirSync(outputDir, { recursive: true });

  const total = await getVideoDuration(input, { ffprobe });
  const segDur = segmentMin * 60;
  const segments = Math.max(1, Math.ceil(total / segDur));

  for (let i = 0; i < segments; i++) {
    const start = i * segDur;
    const out = path.join(outputDir, `${baseName}_part${String(i + 1).padStart(2, '0')}.mp4`);

    const args = [
      '-y',
      '-ss', String(start),
      '-i', input,
      '-t', String(segDur),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
      '-c:a', 'aac', '-b:a', '192k',
      out,
    ];
    await runFfmpeg(ffmpeg, args, onProgress, total);
  }

  return { segments };
}

// ---------------------------------------------------------------------------
// 扫描文件夹
// ---------------------------------------------------------------------------

function scanDir(dir) {
  return fs.readdirSync(dir)
    .filter((f) => VIDEO_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => ({ path: path.join(dir, f), name: f }));
}

module.exports = {
  VIDEO_EXTENSIONS,
  buildDrawbox,
  buildConcatFilter,
  getVideoDuration,
  getVideoInfo,
  mergeVideos,
  splitVideo,
  scanDir,
  resolveBin,
};
