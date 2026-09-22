# 课程剪辑 FrameFlow — 接续开发

2026-09-22，应用1.5.1，项目格式3。唯一主工程入口现在是根package.json，源码在src/。先读README、DEVELOPMENT、PRODUCT、CHANGELOG和RESTRUCTURE-20260922。

当前公开仓库为 sharonwong233-cell/video-batch-app，用户已授权源码同步；不要推送个人素材、项目、测试媒体或旧迁移ZIP。历史MP4和PNG未获单独公开许可，继续排除。

本次重排不改剪辑功能。保留无损复制/按需重编码、保护源视频与同名输出、项目格式3、图片共享字典、900秒刻度和统一时间坐标等行为。`src/main.js`是Electron入口，`src/app.html`不是纯展示页面；不要把真实导出退回模拟结果。

旧VideoBatch与原frameflow目录保留在Git历史，不能再按旧根目录启动说明开发。docs/history/文档仅为原始历史快照，里面的路径、无Git历史/闭源上传限制与旧命令不是本次工程现状；以本文件及用户最新授权为准。

先跑保存/路径检查、引擎测试，再在Windows验证安装与实际交互。Mac验证不等于Windows验收。项目名和对外标题用“课程剪辑 FrameFlow”，内部frameflow标识不随意改动，避免用户配置丢失。
