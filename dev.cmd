@echo off
setlocal
cd /d "%~dp0"
if exist "FrameFlow-Windows-x64\FrameFlow.exe" (
  set "ELECTRON_RUN_AS_NODE=1"
  "FrameFlow-Windows-x64\FrameFlow.exe" "scripts\workspace.cjs" %*
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Please install Node.js 22 or newer, then run npm run setup:windows.
    pause
    exit /b 1
  )
  node "scripts\workspace.cjs" %*
)
exit /b %ERRORLEVEL%
