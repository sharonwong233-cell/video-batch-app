# VideoBatch — 视频批量拼接切分工具

一个基于 Electron 的桌面应用，用于**批量拼接视频素材并按分钟切分**成统一长度的片段。支持剪片头、手动排序、色块打码。

## 功能特性

- **批量拼接**：将多个不同长度、不同分辨率的视频素材按顺序拼接成一条长视频
- **剪片头**：拼接前统一剪掉每个素材开头的指定秒数
- **按分钟切分**：将拼接后的长视频切成指定分钟数的片段（最后一段不足分钟数不补齐）
- **手动排序**：在素材列表拖拽调整拼接顺序
- **色块打码**：在拼接结果左上/右上角叠加自定义颜色的色块（支持半透明、百分比/固定像素大小）
- **分辨率自适应**：以第一个素材的分辨率为基准，其余素材自动缩放 + 黑边居中对齐，避免拼接画面跳动

## 界面预览

```
┌──────────────────────────────────────────────────────────────┐
│  ▶ VideoBatch      剪片头 · 拼接 · 按分钟切分 · 色块打码   状态 │
├───────────────────────────────┬──────────────────────────────┤
│  素材              N 个文件    │  配置                        │
│  ┌───────────────────────────┐│  剪掉片头（秒）  每段分钟数  │
│  │ ⋮⋮ 1 a_640x360.mp4   8.0s ││  输出文件夹  [浏览]          │
│  │ ⋮⋮ 2 b_1280x720.mp4 12.0s ││  ☐ 添加色块打码             │
│  │ ⋮⋮ 3 c_1280x720.mp4 10.0s ││  [色块预览]                  │
│  └───────────────────────────┘│  开始处理  [取消]             │
│                               │  ▓▓▓▓▓▓▓▓▓░░ 拼接中 45%      │
└───────────────────────────────┴──────────────────────────────┘
```

## 快速开始

### 使用打包版（推荐）

从 [Releases](../../releases) 下载 `VideoBatch-win-x64.zip`，解压后双击 `VideoBatch.exe` 即可运行。无需安装任何依赖（已内置 FFmpeg）。

### 从源码运行

需要 [Node.js](https://nodejs.org) 18+。

```bash
npm install
npm start
```

### 处理流程

1. 点击「浏览」选择素材文件夹，自动加载所有视频（支持 `.mp4 .mov .avi .mkv .webm .flv .wmv .m4v .ts`）
2. 在素材列表中拖拽调整拼接顺序
3. 设置「剪掉片头（秒）」和「每段分钟数」
4. 按需开启色块打码，设置颜色/大小/位置
5. 选择输出文件夹（留空自动生成 `素材文件夹_merged`）
6. 点击「开始处理」，等待拼接 + 切分完成

输出文件命名为 `merged_part01.mp4`、`merged_part02.mp4`……

## 构建

```bash
# 打包为 win-unpacked 目录（含内置 FFmpeg）
npm run build

# 若网络可访问 GitHub，可生成单文件便携版
npx electron-builder --win portable
```

产物在 `dist/` 目录。

> 注：`npm run build` 依赖 npm 脚本中的 `ELECTRON_MIRROR` 环境变量（国内网络访问 GitHub 较慢时使用 npmmirror 镜像）。可手动设置：
>
> ```bash
> export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
> export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
> ```

## 项目结构

```
video-batch-app/
├── main.js              # Electron 主进程：窗口、IPC、打包路径解析
├── preload.js           # contextBridge 安全桥接
├── processor.js         # 核心处理引擎（拼接、切分、色块，纯 Node 可独立测试）
├── renderer/            # 界面（HTML/CSS/JS）
│   ├── index.html
│   ├── style.css
│   └── app.js
├── test_processor.js    # 命令行冒烟测试脚本
├── resources/bin/       # FFmpeg / FFprobe 二进制（构建时打入）
└── package.json
```

## 命令行冒烟测试

不启动界面，直接验证核心引擎：

```bash
node test_processor.js <素材目录> <输出目录> --trim 2 --min 1 --mask-color red
```

## 工作原理

```
多个素材 ──trim 片头──▶ ──统一分辨率──▶ ──concat 拼接──▶ 完整长视频 ──按分钟切分──▶ 输出片段
                              │                                          │
                              └── 以首个素材分辨率为基准，其余缩放补黑边 ──┘
```

- **拼接**：一条 FFmpeg `filter_complex` 命令完成「剪片头 + 缩放/黑边统一 + concat + 色块」，重新编码为 H.264/AAC
- **切分**：对拼接结果逐段重编码切割，保证每段精确等于目标时长（最后一段保持不足）
- **色块**：`drawbox` filter，纯色或 `0xRRGGBB@alpha` 半透明，位置可选左上/右上

## 技术栈

- [Electron](https://www.electronjs.org/) — 桌面应用框架
- [FFmpeg](https://ffmpeg.org/) — 视频处理引擎（`filter_complex`、`drawbox`、`tpad`/`apad`）
- [electron-builder](https://www.electron.build/) — 打包分发
- 原生 HTML/CSS/JS — 无前端框架，轻量

## License

MIT
