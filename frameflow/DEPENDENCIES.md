# FrameFlow 1.5.1 依赖记录

2026-09-21：应用版本1.5.1、项目数据格式3。迁移包内置 Windows x64 Electron、FFmpeg/FFprobe 和开发用 NSIS，运行/引擎测试/安装包构建无需 npm install。`dev.cmd` 利用现有 Electron 的 Node 模式调用开发脚本，不修改系统环境。Windows 路径已改为相对项目目录。

可选浏览器交互测试 `v15-acceptance.cjs` 需要 Playwright（本机验收使用1.62.1）及 Chrome/Edge；不是应用运行依赖。仅需完整桌面测试时可优先执行 `dev.cmd native-test` 和 `dev.cmd timeline`，不需 Playwright。迁移包不携带 Mac 可执行文件；Mac 的原验证证据保留。

2026-09-11：新增 Windows 安装版，仅开发侧使用 NSIS 3.0.4.1 编译器（放在项目 `.build-cache/`），不新增应用运行依赖。来源与校验值见《Windows安装版交付说明.md》。之前的便携 ZIP 继续保留。

2026-09-10：V1.4 沿用以下依赖，未新增运行环境。

2026-09-09。运行时随应用携带，不修改系统 PATH、不安装全局 Node/Python。只使用 Node 标准库、Electron 原生接口及 FFmpeg 子进程；没有新增 npm 运行依赖。

| 组件 | 用途 | 版本 / 来源 |
| --- | --- | --- |
| Electron | 独立桌面窗口、文件选择、媒体分段读取 | 复用本项目已有 43.4.1 运行时；Windows x64，开发验证使用 macOS arm64 |
| FFmpeg / FFprobe Windows x64 | 视频处理、检测与核验 | Gyan 9.0.1 essentials，https://www.gyan.dev/ffmpeg/builds/ |
| FFmpeg / FFprobe macOS | 本机开发与实际编码测试 | evermeet 9.0.1-tessus Intel 二进制，https://evermeet.cx/ffmpeg/；本机 Apple Silicon 通过现有 Rosetta 执行 |

FFmpeg 官方下载指引：https://ffmpeg.org/download.html 。Windows 下载包原链接：https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.1-essentials_build.zip 。该 ZIP 的 SHA-256 已与发行方 `.sha256` 核对一致：

```
fec81ae03971d9dd4be3ebe02e263bd2ec1d789483f931bdba5f5715e65da2e9
```

随包引擎 SHA-256：

```
72a489eccd008c2ec2c0a5856c5c75bc3d8bbfa90166c4566865c246445e6aa3  Windows ffmpeg.exe
19202b23c0043f15ad1b7bce2344f406fd52bd6efd8f995ce02e7392a1cec52f  Windows ffprobe.exe
e27de05e3a9f9c758f9766d15d1a069fddeed5f725e35d9ab28683be4740dad7  macOS ffmpeg
a1508faa028bfb8e20c9d182c3d41fcff29ee7584ae21b2d6c357472a3ecbc24  macOS ffprobe
```

Windows ZIP 仅带 ffmpeg.exe / ffprobe.exe 以及原发行 LICENSE、README，不带不使用的 ffplay。Electron 原许可证、Chromium 许可证保留在包内。FFmpeg 源码版本：https://ffmpeg.org/releases/ffmpeg-9.0.1.tar.xz 。原发行构建参数、附加库信息见引擎 README。

`download-deps.cjs` 是开发用的可恢复分块下载器，按官方已核对的地址与长度下载，最终仍需核对发行校验值。`.build-cache/` 为下载与测试临时产物，不是应用源代码。

当前提供独立的安装器和开发迁移包：安装器含安装向导；迁移包包含便携运行时、源码与构建工具，不应当作安装器。macOS 本机验证不等于 Windows 实机验收；当前未宣称已完成 Intel/Apple Silicon 双架构发行。
