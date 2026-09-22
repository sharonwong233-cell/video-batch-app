# GitHub 同步说明

2026-09-21，用户已明确确认将 FrameFlow V1.5.1 同步至公开仓库 `sharonwong233-cell/video-batch-app`。此前文档中的“闭源自用”是原始产品定位；本次确认允许公开托管这些源文件，不代表自动采用原 VideoBatch 的MIT许可证或购买了数字签名。

## 目录与文件

- 仓库根目录保留原VideoBatch，FrameFlow完整源码/文档/测试/验收记录放在 `frameflow/`。
- `GITHUB-SOURCE-MANIFEST.json`为首次同步的文件清单，后续修改会产生新提交，不应伪造快照校验值。
- 大型运行时、引擎、NSIS、安装器和完整Windows迁移ZIP不进入Git源码历史，应从仓库 [Releases](https://github.com/sharonwong233-cell/video-batch-app/releases) 获取。发布状态以Releases页面实际附件为准。
- 临时缓存、个人配置、私人课程视频及旧版重复安装包不上传。
- 2026-09-22：历史验收MP4与PNG截图暂不纳入公开分支。媒体公开披露审核尚未放行，文件仍在本地保留；完整迁移包也包含这些媒体，在获得明确媒体公开授权前不另行上传该包。当前公开同步范围是纯文本源码、文档、构建脚本和测试报告，报告内的截图/视频路径是历史证据引用，不表示该媒体已在仓库公开。

## 在另一台Windows继续

直接获取完整开发迁移包并全部解压是最方便的方式。只克隆Git源码时不含内置运行时：从完整开发包复制 `FrameFlow-Windows-x64/`、`.build-cache/nsis-3.0.4.1/` 和 `.build-cache/nsis-3.0.4.1-api.7z` 到克隆目录的 `frameflow/` 内，之后执行 `dev.cmd check`、`dev.cmd`。

源码克隆不包含迁移包的 `HANDOFF-MANIFEST.json`，不要在此运行 `dev.cmd verify`；该命令只验证完整迁移包初始解压快照。新电脑的助手先阅读HANDOFF、README、CHANGELOG，然后再确认新的修改。

GitHub公开可见不等同于Windows真机已验收；不得抹去现有测试范围说明。历史文档里“当时不存在Git仓库”的表述是迁移前状态，本次同步建立了新的版本存档，但没有找回过去不存在的本地提交。
