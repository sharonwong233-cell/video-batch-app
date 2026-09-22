# 课程剪辑 FrameFlow — 视频打码、拼接与快速分段工具

面向网课整理的本地桌面软件：批量打码、按顺序拼接课程视频，再按指定时长分段导出。无需画面处理且参数兼容时，直接复制视频流，减少等待并避免重编码造成的画质损失。

## 产品特点

- **灵活打码**：纯色、模糊、马赛克、图片遮挡；支持时间范围、自由缩放及批量整段应用。
- **课程拼接**：多段素材按顺序合并，可保持比例补黑边。
- **快速分段**：默认每段45分钟，可自定义；不足时长的尾段仍保留。
- **按需编码**：无打码、无需实际画面适配且编码兼容时免重编码；不兼容或异常码流提示后容错重编码。
- **本地处理**：真实效果预览、导出进度和输出文件，项目关闭后可继续编辑。

免重编码分段依赖关键帧，时长可能略有偏差；打码和实际补边仍需编码，速度取决于视频及设备。本项目不是多轨专业剪辑软件，目前不提供任意入点/出点剪辑。

## 安装使用

当前应用版本 **1.5.1**，Windows 10及以上 x64。发布者显示名称 **SharonWong**，暂未数字签名。

**GitHub 的 Download ZIP 是源码，不是安装包。** 之前生成的安装包尚未上传到 Releases；本仓库不声称已提供在线安装包下载。已有安装包用户可继续使用，不必准备开发环境。

## Windows 从源码开发

安装 Node.js 22或以上版本后，在本目录打开终端：

```powershell
npm run setup:windows
npm run check
npm test
npm start
```

没有 npm 第三方运行依赖，**无需先执行 npm install**。准备命令下载固定版本 Electron 和 FFmpeg，校验后解压到工程内，不修改系统 PATH。首次下载取决于网络；已有完整迁移包可离线复用，见 [开发说明](docs/DEVELOPMENT.md)。

构建带安装目录和快捷方式选择的安装包：

```powershell
# 仅构建安装器需要预先安装 7-Zip
npm run setup:installer
npm run build:windows
```

输出到 `dist/课程剪辑-FrameFlow-v1.5.1-Windows-x64-Setup.exe`，并附 SHA-256 校验文件。准备脚本下载的是官方依赖，不下载或上传个人视频。

## 目录

```text
src/          桌面主进程、隔离桥接、界面、视频处理和项目模型
scripts/      依赖准备、开发启动、源码同步和安装包构建
tests/        项目保存、真实引擎和时间线测试
build/        Windows 安装向导配置
docs/         开发指南、需求基线、依赖及冻结历史记录
package.json  唯一应用版本与命令入口
```

运行时、安装包、测试媒体、项目数据均不提交到 Git。旧 VideoBatch 与原迁移目录可从 Git 历史查看；新版不再嵌套在 `frameflow/` 内。

## 接续开发

- [Windows 开发、测试及打包](docs/DEVELOPMENT.md)
- [给下一台电脑的开发助手](docs/HANDOFF.md)
- [需求基线与已知边界](docs/PRODUCT.md)
- [版本记录](CHANGELOG.md)
- [依赖来源](docs/DEPENDENCIES.md)

历史验收不等于当前 Windows 真机验收。目录迁移测试记录见 [本次整理记录](docs/RESTRUCTURE-20260922.md)。macOS 双架构发行尚未完成。

代码公开可见不等于开源授权，当前许可仍为保留权利，见 [LICENSE.txt](LICENSE.txt)。
