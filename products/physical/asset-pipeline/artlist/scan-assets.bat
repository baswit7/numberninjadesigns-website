@echo off
setlocal
set "ASSET_ROOT=%~dp0"
echo [INFO] Scanning NumberNinjaDesigns Artlist assets...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ASSET_ROOT%scan-assets.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo [ERROR] Asset scan failed with exit code %EXIT_CODE%.
  if /I not "%~1"=="--no-pause" pause
  exit /b %EXIT_CODE%
)
echo [DONE] asset-index.json has been updated.
if /I not "%~1"=="--no-pause" pause
exit /b 0
