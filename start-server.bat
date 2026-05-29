@echo off
title MONEST Server

echo ====================================
echo        Starting server...
echo ====================================
echo.

REM Kill old process on port 8080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
  taskkill /f /pid %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

REM Get local IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do set ip=%%a
set ip=%ip: =%
set url=http://%ip%:8080/main_data

echo.
echo  Open in phone: %url%
echo.
echo  (Opening QR code in browser...)
echo.
echo  Make sure phone and PC are on same WiFi
echo  Press Ctrl+C to stop
echo ====================================

REM Write QR .url file and open it
del "%TEMP%\monest-qr.url" 2>nul
echo [InternetShortcut]>"%TEMP%\monest-qr.url"
echo URL=https://api.qrserver.com/v1/create-qr-code/?size=300x300^&data=%url%>>"%TEMP%\monest-qr.url"
start "" "%TEMP%\monest-qr.url"

REM Open PC version in browser
start "" "%url%/index_pc.html"

cd /d "%~dp0"
python -m http.server 8080
pause
