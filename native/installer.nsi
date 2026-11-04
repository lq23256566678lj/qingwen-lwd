Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"

!define APP_NAME "Qingwen LWD Native"
!define APP_VERSION "0.9.6"
!define APP_EXE "Qingwen-LWD-Native.exe"
!define APP_PROGID "Qingwen.LWD.Native.Document"
!define APP_REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\QingwenLWDNative"

Name "${APP_NAME}"
OutFile "..\qingwen-native-${APP_VERSION}-windows-x64-setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Qingwen LWD Native"
InstallDirRegKey HKCU "Software\Qingwen\LWDNative" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
VIProductVersion "0.9.6.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "FileDescription" "Qingwen LWD Native"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright 2026 Qingwen"

!define MUI_ABORTWARNING
!define MUI_ICON "..\qingwen\src-tauri\icons\icon.ico"
!define MUI_UNICON "..\qingwen\src-tauri\icons\icon.ico"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Section "Install Qingwen LWD Native" SecMain
  SetOutPath "$INSTDIR"
  File "..\qingwen-native-dist\Qingwen-LWD-Native.exe"
  File "/oname=README.md" "..\qingwen-native-dist\README.md"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateDirectory "$SMPROGRAMS\Qingwen LWD Native"
  CreateShortCut "$SMPROGRAMS\Qingwen LWD Native\Qingwen LWD Native.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortCut "$DESKTOP\Qingwen LWD Native.lnk" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "Software\Qingwen\LWDNative" "InstallDir" "$INSTDIR"

  WriteRegStr HKCU "Software\Classes\.lwd" "" "${APP_PROGID}"
  WriteRegStr HKCU "Software\Classes\${APP_PROGID}" "" "Qingwen LWD Document"
  WriteRegStr HKCU "Software\Classes\${APP_PROGID}\DefaultIcon" "" "$INSTDIR\${APP_EXE},0"
  WriteRegStr HKCU "Software\Classes\${APP_PROGID}\shell\open\command" "" '"$INSTDIR\${APP_EXE}" "%1"'
  WriteRegStr HKCU "Software\Classes\.lwd\OpenWithProgids" "${APP_PROGID}" ""

  WriteRegStr HKCU "${APP_REGKEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${APP_REGKEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${APP_REGKEY}" "Publisher" "Qingwen"
  WriteRegStr HKCU "${APP_REGKEY}" "DisplayIcon" "$INSTDIR\${APP_EXE},0"
  WriteRegStr HKCU "${APP_REGKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${APP_REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${APP_REGKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  ReadRegStr $0 HKCU "Software\Classes\.lwd" ""
  ${If} $0 == "${APP_PROGID}"
    DeleteRegValue HKCU "Software\Classes\.lwd" ""
  ${EndIf}
  Delete "$DESKTOP\Qingwen LWD Native.lnk"
  Delete "$SMPROGRAMS\Qingwen LWD Native\Qingwen LWD Native.lnk"
  RMDir "$SMPROGRAMS\Qingwen LWD Native"
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\README.md"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  DeleteRegKey HKCU "${APP_REGKEY}"
  DeleteRegKey HKCU "Software\Qingwen\LWDNative"
  DeleteRegKey HKCU "Software\Classes\${APP_PROGID}"
  DeleteRegValue HKCU "Software\Classes\.lwd\OpenWithProgids" "${APP_PROGID}"
SectionEnd
