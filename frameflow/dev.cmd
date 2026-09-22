@echo off
setlocal
cd /d "%~dp0"
if not exist "FrameFlow-Windows-x64\FrameFlow.exe" (
  echo Missing bundled Windows runtime. Extract the FULL migration ZIP first.
  pause
  exit /b 1
)
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0FrameFlow-Windows-x64\FrameFlow.exe" "%~dp0tools\workspace.cjs" %*
set "FRAMEFLOW_EXIT=%ERRORLEVEL%"
if not "%FRAMEFLOW_EXIT%"=="0" pause
exit /b %FRAMEFLOW_EXIT%
