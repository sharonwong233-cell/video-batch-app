#!/bin/zsh
set -euo pipefail

ROOT_DIR=${0:A:h}
RUNTIME_DIR="$ROOT_DIR/FrameFlow-Windows-x64"
APP_DIR="$RUNTIME_DIR/resources/app"
OUTPUT_ZIP="$ROOT_DIR/FrameFlow-v1.5.1-Windows-x64.zip"
TEMP_ZIP="$ROOT_DIR/.build-cache/FrameFlow-v1.5.1-Windows-x64.zip"

[[ -f "$RUNTIME_DIR/FrameFlow.exe" ]] || { print -u2 '缺少 Windows x64 运行时。'; exit 1; }
[[ -d "$APP_DIR" ]] || { print -u2 '缺少应用资源目录。'; exit 1; }
[[ -f "$ROOT_DIR/runtime/win32/ffmpeg.exe" && -f "$ROOT_DIR/runtime/win32/ffprobe.exe" ]] || { print -u2 '缺少真实视频引擎，不能生成发行包。'; exit 1; }
/bin/mkdir -p "$APP_DIR/runtime"

/bin/cp "$ROOT_DIR/windows版/main.js" "$APP_DIR/main.js"
/bin/cp "$ROOT_DIR/windows版/preload.js" "$APP_DIR/preload.js"
/bin/cp "$ROOT_DIR/windows版/package.json" "$APP_DIR/package.json"
/bin/cp "$ROOT_DIR/windows版/Windows使用说明.txt" "$RUNTIME_DIR/README.txt"
/bin/cp "$ROOT_DIR/frameflow-core.js" "$APP_DIR/frameflow-core.js"
/bin/cp "$ROOT_DIR/frameflow-engine.js" "$APP_DIR/frameflow-engine.js"
/bin/cp "$ROOT_DIR/frameflow-app.js" "$APP_DIR/frameflow-app.js"
/bin/cp "$ROOT_DIR/视频处理应用-高保真交互原型.html" "$APP_DIR/app.html"
/bin/cp "$ROOT_DIR/runtime/win32/ffmpeg.exe" "$ROOT_DIR/runtime/win32/ffprobe.exe" "$ROOT_DIR/runtime/win32/LICENSE" "$ROOT_DIR/runtime/win32/README.txt" "$APP_DIR/runtime/"
/bin/cp "$ROOT_DIR/DEPENDENCIES.md" "$RUNTIME_DIR/DEPENDENCIES.md"

/bin/rm -f "$TEMP_ZIP"
(cd "$ROOT_DIR" && COPYFILE_DISABLE=1 /usr/bin/zip -X -q -r "$TEMP_ZIP" "${RUNTIME_DIR:t}")
/usr/bin/unzip -tq "$TEMP_ZIP"
/bin/mv "$TEMP_ZIP" "$OUTPUT_ZIP"
/usr/bin/unzip -tq "$OUTPUT_ZIP"
/usr/bin/file "$RUNTIME_DIR/FrameFlow.exe"
print "Windows V1.5.1 便携应用包已生成：$OUTPUT_ZIP"
