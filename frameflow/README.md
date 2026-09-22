# FrameFlow — Windows 接续开发包

当前应用 **1.5.1** · 项目数据格式 **3** · 迁移文档版 **2026-09-21.1**。闭源自用，发布者显示名称 SharonWong，未数字签名。

这是带源码、运行时、引擎和构建工具的开发工程，不是只有 HTML 的演示，也不是只有安装程序的交付。先读本文，再读 [HANDOFF.md](HANDOFF.md)、[PRODUCT.md](PRODUCT.md) 和 [CHANGELOG.md](CHANGELOG.md)。详细移交操作见 [docs/WINDOWS-HANDOFF.md](docs/WINDOWS-HANDOFF.md)。

## Windows 第一次打开

1. 将 ZIP **全部解压** 到一个新的短路径，例如 `D:\FrameFlow-dev`，不要直接在 ZIP 内运行，不要解压覆盖已安装软件目录。
2. 在该目录打开 PowerShell，执行 `./dev.cmd verify` 检查文件完整性（首次修改源码前执行）。
3. 执行 `./dev.cmd check` 检查引擎和版本，再执行 `./dev.cmd` 启动源码开发版；也可直接双击 `dev.cmd`。
4. 常规开发、引擎测试、安装包构建均复用内置环境，不需要先安装 Node、Python 或 npm 依赖。首次启动会将随包引擎复制到 `runtime/win32/`。

要求64位 Windows 10及以上，建议解压目录与测试输出合计预留至少4GB空间，真实视频输出另计。不要关闭系统安全软件来绕过告警；本自用包未签名，应先核对来源和校验值。

## 开发命令

| 命令 | 用途 |
| --- | --- |
| `./dev.cmd` | 直接运行根目录源码；开发配置隔离在 `.dev-user-data/` |
| `./dev.cmd check` | JS语法、版本、实际FFmpeg/FFprobe可运行检查 |
| `./dev.cmd test-save` | 版本3图片项目手动保存回归（模拟文件对话框） |
| `./dev.cmd test` | 40项真实视频引擎回归，会生成小型测试视频 |
| `./dev.cmd timeline` | 独立测试配置下运行桌面时间线几何回归 |
| `./dev.cmd native-test` | 先跑引擎测试，再跑真实桌面交互与导出测试 |
| `./dev.cmd sync` | 将最新源码同步到便携运行时，用于分发与打包 |
| `./dev.cmd installer` | 同步源码并调用内置NSIS生成当前版本Setup.exe与SHA-256 |
| `./dev.cmd verify` | 校验初始迁移快照；修改后不一致是正常的，不能当作开发测试 |

修改根目录源码，**不要修改 `FrameFlow-Windows-x64/resources/app/` 生成副本**。启动前退出上一开发进程；修改源码后关闭、重新打开开发窗口。双击便携 `FrameFlow.exe` 运行的是同步后的副本，不会自动载入刚修改的根目录文件。

## 工程地图

- `视频处理应用-高保真交互原型.html`：现有桌面界面的HTML/CSS入口，历史文件名保留。
- `frameflow-app.js`：交互、Canvas预览、时间线、项目状态与原生通信。
- `frameflow-core.js`：格式、校验、区域、批量、输出计划。
- `frameflow-engine.js`：FFprobe、FFmpeg、无损/编码路径、真实预览及导出。
- `windows版/`：Electron主进程、隔离preload、应用版本、NSIS安装脚本。
- `tools/`、`dev.cmd`：接续开发、校验、源码同步与移交工具。
- `FrameFlow-Windows-x64/`：现有Windows运行时和许可；`resources/app/runtime/`为视频引擎。
- `.build-cache/nsis-3.0.4.1/`：内置安装器编译工具及校验归档，其余缓存不随包迁移。
- `验收记录/` 与各 `V*.md`：原始历史证据，不应改写成新版本测试结果。
- `release/`（迁移包内）：当前版本安装程序和说明，供不开发时直接安装。

现有记录不等于 Windows 真机验收。当前代码与视频处理在 Mac 上运行检查，Windows启动、安装、显示缩放、原生文件对话框仍需在新电脑验证。

没有把私人视频、自动保存项目、个人偏好、浏览器配置或旧版大安装包打入迁移包。原工作目录不存在可移交的 `.git` 历史；该包是有SHA-256清单的完整当前快照，不冒充Git历史。
