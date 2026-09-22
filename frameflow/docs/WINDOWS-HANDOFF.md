# 搬到另一台 Windows 并继续开发

## 交付内容

完整迁移ZIP包括当前源码、Windows运行时（Electron 43.4.1）、FFmpeg/FFprobe、NSIS工具及校验归档、最新安装EXE、原许可证、历史修改记录、自动测试和接手上下文。`HANDOFF-MANIFEST.json`列出迁移快照中每个文件的SHA-256，ZIP旁另有整个ZIP的SHA-256。

不含旧版本的大型安装包、Mac运行时、缓存测试视频、个人正在编辑的项目、真实课程素材、开发者浏览器配置、个人偏好和任何账号凭据。`.build-cache`只移交已明确需要的NSIS编译器，不整体复制缓存。

## 迁移步骤

1. 复制ZIP到新Windows电脑，右键“全部解压”。目录建议 `D:\FrameFlow-dev`，不要在压缩包里运行。解压后应能在同一根目录看到 `dev.cmd`、`HANDOFF.md` 和 `FrameFlow-Windows-x64`。
2. 校验ZIP可用 PowerShell：`Get-FileHash .\FrameFlow-v1.5.1-Windows-Dev-20260921.zip -Algorithm SHA256`，与配套sha256文本比较。首次改源码前执行 `./dev.cmd verify`；清单哈希只用于识别损坏或变化，不是数字签名或发布者认证。
3. 打开根目录终端依次执行 `./dev.cmd check`、`./dev.cmd test-save`、`./dev.cmd test`。接着运行 `./dev.cmd`。不要要求用户先安装Python/FFmpeg/Electron等已经内置的组件。
4. 先用短视频验收，确认真实输出和图片项目恢复，再进行新功能开发。`./dev.cmd native-test`与`timeline`使用新建测试配置，不复用正式配置。
5. 如果只想安装使用，运行 `release/`中的Setup.exe，不需要复制源码到安装目录。开发时仍编辑解压目录源码，别修改安装后的resources文件。

## 在另一台电脑给新助手的提示词

> 这是FrameFlow课程视频剪辑软件的1.5.1完整开发工程。请先阅读README.md、HANDOFF.md、PRODUCT.md、CHANGELOG.md、DEPENDENCIES.md及V1.5.1修改与验收.md，再检查文件与本机Windows环境。先运行dev.cmd check、test-save和test，能启动和真实导出后再继续改需求。不要重写成静态网页、不要安装重复运行依赖、不要改sources只读资料、不要覆盖源视频、不要把Mac测试当作Windows真机验收。当前新增需求是：〔在这里填写〕。

文件传到新电脑，并不等于新对话自动获得这段历史。向助手提供上面的提示词及HANDOFF文件：

- 有本地文件/终端访问能力的编程工具：打开解压后的工程目录，在目录内继续。
- 如果只是网页聊天：先提供README、HANDOFF、PRODUCT、CHANGELOG和本次要修改的源文件；不要仅上传EXE来请求修改源码。附件是否接受ZIP、大小上限及能否读取包内文件，以当前界面实际支持为准。实际Windows运行/编译仍需本地环境完成。

## 私人项目与配置另行迁移

开发工程不包含真实课程视频。如要续编某个用户项目，需另行保存/复制项目JSON及原视频；图片已经内嵌项目JSON。旧视频路径和输出目录不能直接沿用另一台机器的绝对路径。

正式Windows版本的自动保存/偏好位于用户数据目录（历史发行使用 `%APPDATA%\frameflow`），开发版使用工程 `.dev-user-data/`；不要拿测试产生的session.json覆盖正式项目。当前顶部仅保留新建项目按钮，已存在的 `FrameFlow.openProject()` / `saveProject()`为内部入口；若没有可见导入项目入口，让开发助手协助调用或先确认是否需要新增入口，不擅自恢复一排按钮。

## 版本与重新构建

- 应用版本以 `windows版/package.json` 为准；HTML、app.js及Windows文案同步后运行 `check`。
- `./dev.cmd sync`更新便携副本；`./dev.cmd installer`重新生成同版本Setup及SHA-256。构建目录必须是本开发工程，不是已安装目录。
- 交付新功能前先递增版本，记录CHANGELOG并保留旧包。`release/`是此次冻结快照，重新构建产生的新EXE在工程根目录，**不会自动替换release旧文件**。
- 打包器本身可能较慢；不要把打包耗时误认为视频编码耗时。直接复制视频流仍需磁盘读写和输出核验。

## 可选浏览器自动化

主要测试优先用内置Electron，无需新依赖。只有要跑 `v15-acceptance.cjs` 的鼠标自动化时才需要可用的Node与Playwright（原测试版本1.62.1）；该文件不参与应用运行。浏览器优先自动寻找本机Chrome/Edge，也可设 `FRAMEFLOW_BROWSER` 为其可执行文件。浏览器布局测试用到fetch/WebSocket等接口，独立Node需支持这些接口；内置运行时已支持。不要把Mac缓存中Node或Chrome的绝对路径复制到Windows。

## 常见问题

- 打开还是旧界面：确认运行的是 `dev.cmd`，不是旧桌面快捷方式；关闭旧开发进程后重启。便携副本须先sync。
- `verify`报告Changed：初次解压时意味着有差异；已修改代码后属于预期，保留原始ZIP用于比较，不要重新生成清单来掩盖缺文件。
- 引擎不能启动：检查是否完整解压/被隔离、是否Windows x64，以及`check`具体错误。不要关闭防护；核对可信来源后再处理系统提示。
- 项目找不到素材：原素材未随源码包迁移，需要复制视频并重新定位，重选输出目录。
- 没有Git历史：本目录不存在.git。可以在新电脑确认快照后初始化新本地仓库，但不能宣称恢复了早期提交。
