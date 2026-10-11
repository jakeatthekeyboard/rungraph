@echo off
rem Double-click to run rungraph on Windows: installs what the build needs
rem the first time, builds the dashboard, starts the server and opens the
rem browser. Close this window (or press Ctrl+C) to stop it.
setlocal
title rungraph
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is needed. Install it from https://nodejs.org and try again.
  goto :fail
)

rem Running rungraph needs only the three packages that build the dashboard.
rem A plain "npm install" also fetches the test tools (vitest and its
rem dependencies), which some company package mirrors do not carry. So the
rem three are installed into a scratch folder that has no package.json,
rem using whatever registry npm is set up for, and moved into node_modules.
rem Keep the versions in step with devDependencies in package.json.
if exist "node_modules\.rungraph-build-deps" goto :build
echo Installing the build packages, first run only...
if exist ".build-deps\" rmdir /s /q ".build-deps"
call npm install --prefix .build-deps --no-save --no-package-lock --no-audit --no-fund "esbuild@^0.24.0" "preact@^10.24.0" "elkjs@^0.9.3"
if errorlevel 1 goto :fail
robocopy ".build-deps\node_modules" "node_modules" /e /move /nfl /ndl /njh /njs /np >nul
if errorlevel 8 goto :fail
rmdir /s /q ".build-deps" 2>nul
echo installed> "node_modules\.rungraph-build-deps"

:build
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
