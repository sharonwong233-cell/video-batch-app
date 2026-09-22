# 课程剪辑 FrameFlow 依赖

应用1.5.1；没有第三方 npm 运行依赖。开发脚本使用 Node.js 22+ 标准库。

| 组件 | 固定版本 | 来源 |
| --- | --- | --- |
| Electron Windows x64 | 43.4.1 | https://github.com/electron/electron/releases/tag/v43.4.1 |
| FFmpeg / FFprobe Windows x64 | 9.0.1 essentials | https://www.gyan.dev/ffmpeg/builds/ |
| NSIS（仅安装器编译） | 3.0.4.1 | https://github.com/electron-userland/electron-builder-binaries/releases/tag/nsis-3.0.4.1 |

Electron ZIP按同版本官方SHASUMS256.txt核验；FFmpeg ZIP固定SHA-256：`fec81ae03971d9dd4be3ebe02e263bd2ec1d789483f931bdba5f5715e65da2e9`。

NSIS归档固定SHA-512（Base64）：`VKMiizYdmNdJOWpRGz4trl4lD++BvYP2irAXpMilheUP0pc93iKlWAoP843Vlraj8YG19CVn0j+dCo/hURz9+Q==`。

自动准备依赖需网络，解压ZIP使用Windows PowerShell，解压NSIS使用单独安装的7-Zip。所有运行依赖放在工程内部，安装软件的最终用户不需Node或7-Zip。不改全局PATH，不关闭系统防护。

打包保留Electron/Chromium许可证、FFmpeg LICENSE/README。完整历史依赖及macOS本机验证来源见 [历史依赖记录](history/DEPENDENCIES-1.5.1.md)。
