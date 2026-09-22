# FrameFlow 开发工程约定

先完整阅读 README.md、HANDOFF.md、PRODUCT.md、CHANGELOG.md 与当前版本验收文档。尊重用户最新需求，不自行扩成功能更多的产品。

- `sources/`是只读参考资料；不得修改、重命名、移动或删除。
- 只修改根目录源代码和 `windows版/`、`tools/` 中的开发文件；`FrameFlow-Windows-x64/resources/app/`是生成副本，使用 `dev.cmd sync` 更新。
- `release/`及历史验收记录是冻结交付证据。新版本另建记录，禁止伪造Windows已通过的结果。
- 私人视频、用户项目配置、输出文件不得作为测试清理目标；测试用独立配置和新建临时目录。
- 应用1.5.1，项目格式3。版本升级同步显示与说明，用 `dev.cmd check` 验证。
- Windows开发默认使用随包运行时。除可选浏览器测试外，不预先执行npm install、不升级运行依赖、不修改全局PATH。
- 未获用户授权不得上传、推送或公开项目。当前闭源自用，显示发布者名SharonWong，但未代码签名。
- 修改后运行相关测试，再生成安装包；编译通过不等于Windows运行验收通过。
