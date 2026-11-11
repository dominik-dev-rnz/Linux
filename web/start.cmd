@echo off
setlocal
if "%~1"==":browser" goto browser
cd /d "%~dp0"
title Vortrag 4 - Website (dieses Fenster offen lassen)

echo.
echo   Vortrag 4 - Benutzer- und Gruppenverwaltung
echo   ============================================
echo.

rem --- Node.js vorhanden? ---------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo   [FEHLER] Node.js ist nicht installiert.
  echo   Bitte die LTS-Version von https://nodejs.org installieren
  echo   und danach start.cmd noch einmal doppelklicken.
  start "" https://nodejs.org
  pause
  exit /b 1
)
for /f "tokens=1 delims=." %%v in ('node -v') do set "NODEVER=%%v"
set "NODEVER=%NODEVER:v=%"
if %NODEVER% LSS 20 (
  echo   [FEHLER] Node.js ist zu alt ^(gefunden: Version %NODEVER%, noetig: 20 oder neuer^).
  echo   Bitte die LTS-Version von https://nodejs.org installieren.
  start "" https://nodejs.org
  pause
  exit /b 1
)

rem --- Pakete nur beim ersten Start installieren ---------------------------
if not exist "node_modules\.bin\next.cmd" (
  echo   Erster Start: Pakete werden installiert, das dauert 1-2 Minuten ...
  echo.
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo   [FEHLER] npm install ist fehlgeschlagen. Internetverbindung pruefen.
    pause
    exit /b 1
  )
)

rem --- Browser oeffnen, sobald der Server antwortet ------------------------
start "" /min cmd /c ""%~f0" :browser"

echo.
echo   Website: http://localhost:3000  (oeffnet sich gleich automatisch)
echo   Beenden: dieses Fenster schliessen oder Strg+C druecken.
echo.
call npm.cmd run dev -- -p 3000
pause
exit /b 0

:browser
where curl.exe >nul 2>nul
if errorlevel 1 (
  timeout /t 15 /nobreak >nul
  start "" http://localhost:3000/
  exit /b 0
)
for /l %%i in (1,1,120) do (
  curl.exe -s -o nul http://localhost:3000/ && (
    start "" http://localhost:3000/
    exit /b 0
  )
  timeout /t 1 /nobreak >nul
)
start "" http://localhost:3000/
exit /b 0
