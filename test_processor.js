'use strict';

/**
 * 开发期命令行冒烟测试：拼接 + 切分。
 * 用法: node test_processor.js <素材目录> <输出目录> [--trim 3] [--min 1] [--mask-color red] [--mask-size 15%] [--mask-pos topleft]
 */
const path = require('path');
const fs = require('fs');
const { scanDir, getVideoDuration, mergeVideos, splitVideo, resolveBin } = require('./processor');

const BIN_DIR = path.join(__dirname, 'resources', 'bin');

const args = process.argv.slice(2);
const inputDir = args[0];
const outDir = args[1];
if (!inputDir || !outDir) {
  console.error('用法: node test_processor.js <素材目录> <输出目录> [--trim N] [--min N] [--mask-color C] [--mask-size S] [--mask-pos P]');
  process.exit(1);
}

const opt = { trim: 0, min: 1, maskColor: null, maskSize: '15%', maskPos: 'topleft' };
for (let i = 2; i < args.length; i++) {
  if (args[i] === '--trim') opt.trim = parseFloat(args[++i]);
  if (args[i] === '--min') opt.min = parseFloat(args[++i]);
  if (args[i] === '--mask-color') opt.maskColor = args[++i];
  if (args[i] === '--mask-size') opt.maskSize = args[++i];
  if (args[i] === '--mask-pos') opt.maskPos = args[++i];
}

(async () => {
  const ffmpeg = resolveBin('ffmpeg', BIN_DIR);
  const ffprobe = resolveBin('ffprobe', BIN_DIR);
  console.log(`二进制: ${ffmpeg} | ${ffprobe}`);

  const files = scanDir(inputDir);
  console.log(`素材: ${files.length} 个\n`);
  for (const f of files) {
    const d = await getVideoDuration(f.path, { ffprobe });
    console.log(`  ${f.name}: ${d.toFixed(1)}s`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const merged = path.join(outDir, '_merged_full.mp4');

  // ---- 拼接 ----
  console.log('\n[1] 拼接中…');
  const { duration } = await mergeVideos(
    files.map((f) => f.path),
    merged,
    { trimHeadSec: opt.trim, maskColor: opt.maskColor, maskSize: opt.maskSize, maskPos: opt.maskPos, ffmpeg, ffprobe },
    (pct) => process.stdout.write(`\r  拼接进度: ${pct}%   `)
  );
  console.log(`\n  拼接完成，总时长: ${duration.toFixed(1)}s`);

  // ---- 切分 ----
  console.log(`\n[2] 切分为 ${opt.min} 分钟片段…`);
  const { segments } = await splitVideo(
    merged,
    outDir,
    opt.min,
    { ffmpeg, ffprobe, baseName: 'merged' },
    (pct) => process.stdout.write(`\r  切分进度: ${pct}%   `)
  );
  console.log(`\n  切分完成，共 ${segments} 段\n`);

  // ---- 校验 ----
  const segDur = opt.min * 60;
  console.log('校验:');
  const parts = fs.readdirSync(outDir)
    .filter((f) => /_part\d+\.mp4$/.test(f))
    .sort();
  let pass = true;
  for (const p of parts) {
    const d = await getVideoDuration(path.join(outDir, p), { ffprobe });
    const ok = d <= segDur + 0.5 && d > 1;
    if (!ok) pass = false;
    console.log(`  ${p}: ${d.toFixed(2)}s ${ok ? '[PASS]' : '[FAIL]'}`);
  }
  const expect = Math.ceil(duration / segDur);
  if (parts.length !== expect) {
    console.log(`  [FAIL] 段数 ${parts.length} != 期望 ${expect}`);
    pass = false;
  } else {
    console.log(`  段数: ${parts.length} [PASS]`);
  }

  // 删除完整长视频（生产环境只要片段）
  fs.rmSync(merged, { force: true });
  console.log(pass ? '\n全部通过 ✅' : '\n存在失败 ❌');
  process.exit(pass ? 0 : 1);
})().catch((e) => {
  console.error('\n测试失败:', e.message || e);
  process.exit(1);
});
