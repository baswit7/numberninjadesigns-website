@echo off
setlocal
set "LAUNCHER=%~dp0scripts\start-finance-product-factory.ps1"

if not exist "%LAUNCHER%" (
  echo De Finance Product Factory-launcher ontbreekt.
  exit /b 1
)

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LAUNCHER%"
exit /b %ERRORLEVEL%
