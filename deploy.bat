@echo off
title MONEST Deploy

echo ====================================
echo        MONEST Deploy Tool
echo ====================================
echo.

set PWA_DIR=%~dp0pwa
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd"') do set BACKUP_BASE=%~dp0backup\pwa\%%d

REM ---- Step 1: Syntax check ----
echo [1/4] Syntax check...
cd /d "%PWA_DIR%"
node --check core.js
if errorlevel 1 echo FAIL: core.js & pause & exit /b 1
node --check app.js
if errorlevel 1 echo FAIL: app.js & pause & exit /b 1
node --check desktop.js
if errorlevel 1 echo FAIL: desktop.js & pause & exit /b 1
echo  OK
echo.

REM ---- Step 2: Find next backup number via PowerShell ----
echo [2/4] Creating backup...
for /f %%n in ('powershell -NoProfile -Command "$max=0; Get-ChildItem -LiteralPath \"%BACKUP_BASE%\" -Directory | Where-Object { $_.Name -match '^\d{3}$' } | ForEach-Object { $v=[int]$_.Name; if($v -gt $max){$max=$v} }; '{0:d3}' -f ($max+1)"') do set BACKUP_NUM=%%n

set BACKUP_DIR=%BACKUP_BASE%\%BACKUP_NUM%
mkdir "%BACKUP_DIR%" 2>nul

copy "%PWA_DIR%\index.html"          "%BACKUP_DIR%\" >nul
copy "%PWA_DIR%\index_mobile.html"   "%BACKUP_DIR%\" >nul
copy "%PWA_DIR%\index_pc.html"       "%BACKUP_DIR%\" >nul
copy "%PWA_DIR%\core.js"             "%BACKUP_DIR%\" >nul
copy "%PWA_DIR%\app.js"              "%BACKUP_DIR%\" >nul
copy "%PWA_DIR%\desktop.js"          "%BACKUP_DIR%\" >nul
copy "%PWA_DIR%\style.css"           "%BACKUP_DIR%\" >nul
copy "%PWA_DIR%\style_pc.css"        "%BACKUP_DIR%\" >nul
copy "%PWA_DIR%\firebase-config.js"  "%BACKUP_DIR%\" >nul
copy "%PWA_DIR%\sw.js"               "%BACKUP_DIR%\" >nul
copy "%PWA_DIR%\manifest.json"       "%BACKUP_DIR%\" >nul
copy "%PWA_DIR%\icon.svg"            "%BACKUP_DIR%\" >nul

echo  Backup: %BACKUP_DIR%
echo.

REM ---- Step 3: Deploy ----
echo [3/4] Deploying to Firebase Hosting + Firestore...
cd /d "%~dp0"
cmd /c firebase deploy --only hosting,firestore
if errorlevel 1 echo Deploy FAILED & pause & exit /b 1
echo.

REM ---- Done ----
echo ====================================
echo   Deploy complete!
echo.
echo   URL: https://accounting-book-8e7e8.web.app
echo ====================================
echo.
pause
