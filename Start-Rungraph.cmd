@echo off
rem Double-click to run rungraph on Windows: installs dependencies the
rem first time, builds the dashboard, starts the server and opens the
rem browser. Close this window (or press Ctrl+C) to stop it.
setlocal
title rungraph
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is needed. Install it from https://nodejs.org and try again.
  goto :fail
)

if not exist "node_modules\" (
  echo Installing dependencies, first run only...
  call npm install
  if errorlevel 1 goto :fail
)

echo Building the dashboard...
call npm run build
if errorlevel 1 goto :fail

echo Starting rungraph. Close this window to stop it.
node bin\rungraph.js
if errorlevel 1 goto :fail
exit /b 0

:fail
echo.
echo rungraph did not start. See the messages above.
pause
exit /b 1
