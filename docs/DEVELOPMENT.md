# 课程剪辑 FrameFlow 开发说明

## 从干净源码开始（Windows x64）

1. 将源码解压至独立目录，例如 `D:\course-editor`，不要覆盖已安装程序。
2. 安装 Node.js 22或以上版本；运行 `node --version` 检查。在工程根目录执行 `npm run setup:windows`。
3. 运行 `npm run check`、`npm test`、`npm run test:engine`，再运行 `npm start`。也可双击 `dev.cmd`。
4. 修改 `src/` 后重新打开开发窗口。开发项目与偏好存于 `.dev-user-data/`，与已安装应用隔离。

本工程无 npm 第三方运行依赖；package-lock.json 记录空依赖树。Electron、视频引擎和NSIS是独立二进制依赖，来源与校验说明见 DEPENDENCIES.md。不要把“无 npm 依赖”理解成“无需运行时”。

## 离线复用之前的完整迁移包

复制迁移包的 `FrameFlow-Windows-x64/` 到本工程根目录；将其中 `resources/app/runtime/` 的 ffmpeg.exe、ffprobe.exe、LICENSE、README.txt 复制到本工程 `runtime/win32/`。如需要构建安装包，再复制迁移包的 `.build-cache/nsis-3.0.4.1/` 与 `.build-cache/nsis-3.0.4.1-api.7z`。

执行 `dev.cmd check` 检查源码与视频引擎。执行 `dev.cmd sync` 更新便携副本，再用 `dev.cmd` 启动开发版。不要直接把旧迁移包根目录代码覆盖到新工程。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run check` | 所有JS语法、路径/版本和引擎健康 |
| `npm test` | 不依赖媒体引擎的保存与布局入口回归 |
| `npm run test:engine` | 40项真实视频处理检查，生成合成视频 |
| `npm run test:timeline` | Electron隔离配置的时间线检查 |
| `npm run test:native` | 引擎与桌面交互验收 |
| `npm run sync` | 将源码复制至便携运行时 |
| `npm run build:windows` | 编译安装器及生成校验文件 |

只有完整浏览器交互测试 `tests/v15-acceptance.cjs` 需要可选 Playwright（历史验证1.62.1）及Chrome/Edge；它不是应用依赖。`tests/browser-timeline-test.cjs` 可利用已有Chrome/Edge进行布局回归，不等于Windows真机验收。

## 安装器构建

先安装 7-Zip，再执行 `npm run setup:installer`（自定义7-Zip位置可设置 `FRAMEFLOW_7ZIP` 为7z.exe绝对路径）。脚本会下载、核验并解压NSIS3.0.4.1。然后运行 `npm run build:windows`。文件位于 dist/，构建报告位于 reports/。

保留原NSIS安装行为：当前用户安装、目录选择、可选快捷方式、保护现有文件、精确卸载清单。为兼容升级，内部安装目录、快捷方式文件名和注册表标识仍为FrameFlow；显示名称以“课程剪辑”开头。发布者名不是数字签名。

## 约定

源代码统一在src/；FrameFlow-Windows-x64/resources/app是生成副本。旧副本可能保留历史文件，但入口始终由新的package.json指定src/main.js。新下载的运行时没有此类旧副本。

应用版本仍为1.5.1，本次仅工程布局与命名维护，没有新视频功能。修改版本时同步package.json、package-lock.json、界面和发行文案，运行check。项目数据格式维持3。

Windows真机需补验：原生文件对话框、拖入/播放、图片打码、真实导出、关闭恢复、中文路径、安装升级、快捷方式与卸载。macOS可复用本机runtime/darwin进行引擎测试，但不能据此宣布Windows验证通过。
