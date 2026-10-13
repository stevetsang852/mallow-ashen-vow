@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not on PATH. Install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

if not exist "node_modules\.bin\vite.cmd" (
  echo ERROR: vite is still missing after npm install.
  pause
  exit /b 1
)

echo Starting Mallow at http://127.0.0.1:8080/
echo Leave this window open. Press Ctrl+C to stop.
call npm run dev
if errorlevel 1 (
  echo.
  echo The dev server stopped with an error.
  pause
  exit /b 1
)

endlocal
