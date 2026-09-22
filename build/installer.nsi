Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "WinVer.nsh"
!include "x64.nsh"
!include "Sections.nsh"

Name "课程剪辑 FrameFlow ${APP_VERSION}"
OutFile "${SETUP_OUT}"
InstallDir "$LOCALAPPDATA\Programs\FrameFlow"
InstallDirRegKey HKCU "Software\FrameFlow\Installer" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 32
ShowInstDetails show
ShowUninstDetails show
VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey /LANG=2052 "ProductName" "课程剪辑 FrameFlow 安装程序"
VIAddVersionKey /LANG=2052 "CompanyName" "SharonWong"
VIAddVersionKey /LANG=2052 "FileDescription" "课程剪辑 FrameFlow 安装向导"
VIAddVersionKey /LANG=2052 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=2052 "LegalCopyright" "FrameFlow · 闭源自用"

!define REG_APP "Software\FrameFlow\Installer"
!define REG_UNINSTALL "Software\Microsoft\Windows\CurrentVersion\Uninstall\FrameFlow"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "此向导将安装 FrameFlow 课程剪辑软件。$\r$\n$\r$\n可选择安装目录、桌面快捷方式和开始菜单入口。只为当前 Windows 用户安装。$\r$\n$\r$\n视频处理依赖已内置，无需另装开发环境。安装前请保存项目并退出 FrameFlow。"
!insertmacro MUI_PAGE_WELCOME
!define MUI_COMPONENTSPAGE_TEXT_TOP "选择需要的快捷方式；主程序为必选项。"
!insertmacro MUI_PAGE_COMPONENTS
!define MUI_DIRECTORYPAGE_TEXT_TOP "请选择可写入的 FrameFlow 专用目录，目录名称须为 FrameFlow。请勿选择便携版目录或存有其他文件的文件夹。"
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE ValidateDirectory
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\FrameFlow.exe"
!define MUI_FINISHPAGE_RUN_TEXT "立即启动 FrameFlow"
!define MUI_FINISHPAGE_RUN_UNCHECKED
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "SimpChinese"

Function .onInit
 SetShellVarContext current
 SetRegView 64
 ReadRegStr $0 HKCU "${REG_APP}" "InstallDir"
 ${If} $0 != ""
  StrCpy $INSTDIR $0
 ${EndIf}
 Call RestoreShortcutChoices
 ${IfNot} ${RunningX64}
  MessageBox MB_ICONSTOP "需要64位 Windows 10或以上系统。"
  Abort
 ${EndIf}
 ${IfNot} ${AtLeastWin10}
  MessageBox MB_ICONSTOP "需要 Windows 10或以上系统。"
  Abort
 ${EndIf}
FunctionEnd

Function ValidateDirectory
 ReadRegStr $0 HKCU "${REG_APP}" "InstallDir"
 ${If} $0 != ""
 ${AndIf} $0 != $INSTDIR
  IfFileExists "$0\Uninstall.exe" 0 +3
  MessageBox MB_ICONEXCLAMATION "已安装 FrameFlow。覆盖安装请使用原目录；如需更换目录，请先卸载旧版本（项目配置会保留）。"
  Abort
 ${EndIf}
 ${GetFileName} "$INSTDIR" $0
 ${If} $0 != "FrameFlow"
  MessageBox MB_ICONEXCLAMATION "请选择名称为 FrameFlow 的专用子文件夹。"
  Abort
 ${EndIf}
 IfFileExists "$INSTDIR\.frameflow-install" owned
 FindFirst $0 $1 "$INSTDIR\*"
 scan:
  StrCmp $1 "" empty
  StrCmp $1 "." next
  StrCmp $1 ".." next
  FindClose $0
  MessageBox MB_ICONEXCLAMATION "该目录已有其他文件。请选择空的 FrameFlow 文件夹，避免覆盖现有内容。"
  Abort
 next:
  FindNext $0 $1
  Goto scan
 empty:
  FindClose $0
  Return
 owned:
  ReadRegStr $0 HKCU "${REG_APP}" "InstallDir"
  StrCmp $0 $INSTDIR valid
  MessageBox MB_ICONEXCLAMATION "该目录不属于当前用户登记的安装，请另选空目录。"
  Abort
 valid:
FunctionEnd

!macro CheckClosed PREFIX
Function ${PREFIX}CheckClosed
 IfFileExists "$INSTDIR\FrameFlow.exe" 0 done
 retry:
 System::Call 'kernel32::CreateFileW(w "$INSTDIR\FrameFlow.exe", i 0x80000000, i 0, p 0, i 3, i 0, p 0) p.r0'
 ${If} $0 == -1
  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "FrameFlow 正在使用中，或当前目录无访问权限。请保存项目、退出应用后重试。" IDRETRY retry
  Abort
 ${EndIf}
 System::Call 'kernel32::CloseHandle(p r0)'
 done:
FunctionEnd
!macroend
!insertmacro CheckClosed ""
!insertmacro CheckClosed "un."

Section "FrameFlow 主程序及视频引擎（必选）" Main
 SectionIn RO
 Call ValidateDirectory
 Call CheckClosed
 SetOutPath "$INSTDIR"
 SetOverwrite on
 File /r "${PAYLOAD}/*"
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 FileOpen $0 "$INSTDIR\.frameflow-install" w
 FileWrite $0 "FrameFlow ${APP_VERSION}"
 FileClose $0
 WriteRegStr HKCU "${REG_APP}" "InstallDir" "$INSTDIR"
 WriteRegStr HKCU "${REG_UNINSTALL}" "DisplayName" "课程剪辑 FrameFlow"
 WriteRegStr HKCU "${REG_UNINSTALL}" "DisplayVersion" "${APP_VERSION}"
 WriteRegStr HKCU "${REG_UNINSTALL}" "Publisher" "SharonWong"
 WriteRegStr HKCU "${REG_UNINSTALL}" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "${REG_UNINSTALL}" "DisplayIcon" "$INSTDIR\FrameFlow.exe"
 WriteRegStr HKCU "${REG_UNINSTALL}" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
 WriteRegDWORD HKCU "${REG_UNINSTALL}" "EstimatedSize" ${PAYLOAD_KB}
 WriteRegDWORD HKCU "${REG_UNINSTALL}" "NoModify" 1
 WriteRegDWORD HKCU "${REG_UNINSTALL}" "NoRepair" 1
SectionEnd

Section "创建桌面快捷方式" Desktop
 CreateShortCut "$DESKTOP\FrameFlow.lnk" "$INSTDIR\FrameFlow.exe"
 WriteRegDWORD HKCU "${REG_APP}" "Desktop" 1
SectionEnd
Section "创建开始菜单入口" StartMenu
 CreateDirectory "$SMPROGRAMS\FrameFlow"
 CreateShortCut "$SMPROGRAMS\FrameFlow\FrameFlow.lnk" "$INSTDIR\FrameFlow.exe"
 WriteRegDWORD HKCU "${REG_APP}" "StartMenu" 1
SectionEnd

Section "-ApplyShortcutChoices"
 ${IfNot} ${SectionIsSelected} ${Desktop}
  ReadRegDWORD $0 HKCU "${REG_APP}" "Desktop"
  ${If} $0 == 1
   Delete "$DESKTOP\FrameFlow.lnk"
  ${EndIf}
  WriteRegDWORD HKCU "${REG_APP}" "Desktop" 0
 ${EndIf}
 ${IfNot} ${SectionIsSelected} ${StartMenu}
  ReadRegDWORD $0 HKCU "${REG_APP}" "StartMenu"
  ${If} $0 == 1
   Delete "$SMPROGRAMS\FrameFlow\FrameFlow.lnk"
   RMDir "$SMPROGRAMS\FrameFlow"
  ${EndIf}
  WriteRegDWORD HKCU "${REG_APP}" "StartMenu" 0
 ${EndIf}
SectionEnd

Function RestoreShortcutChoices
 ClearErrors
 ReadRegDWORD $0 HKCU "${REG_APP}" "Desktop"
 ${IfNot} ${Errors}
 ${AndIf} $0 == 0
  !insertmacro UnselectSection ${Desktop}
 ${EndIf}
 ClearErrors
 ReadRegDWORD $0 HKCU "${REG_APP}" "StartMenu"
 ${IfNot} ${Errors}
 ${AndIf} $0 == 0
  !insertmacro UnselectSection ${StartMenu}
 ${EndIf}
FunctionEnd

Function un.onInit
 SetShellVarContext current
 SetRegView 64
 ReadRegStr $0 HKCU "${REG_APP}" "InstallDir"
 ${If} $0 != $INSTDIR
  MessageBox MB_ICONSTOP "安装位置与登记信息不一致，已停止卸载以保护文件。"
  Abort
 ${EndIf}
 Call un.CheckClosed
FunctionEnd
Section "Uninstall"
 Call un.CheckClosed
 ; Generated list removes only packaged files; never recursively delete user folders.
 !include "${DELETE_MANIFEST}"
 ReadRegDWORD $0 HKCU "${REG_APP}" "Desktop"
 ${If} $0 == 1
  Delete "$DESKTOP\FrameFlow.lnk"
 ${EndIf}
 ReadRegDWORD $0 HKCU "${REG_APP}" "StartMenu"
 ${If} $0 == 1
  Delete "$SMPROGRAMS\FrameFlow\FrameFlow.lnk"
  RMDir "$SMPROGRAMS\FrameFlow"
 ${EndIf}
 Delete "$INSTDIR\.frameflow-install"
 Delete "$INSTDIR\Uninstall.exe"
 RMDir "$INSTDIR"
 DeleteRegKey HKCU "${REG_UNINSTALL}"
 DeleteRegKey HKCU "${REG_APP}"
SectionEnd
