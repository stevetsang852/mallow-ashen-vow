@echo off
setlocal
cd /d "%~dp0"

docker compose version >nul 2>&1
if errorlevel 1 (
  echo Docker Compose is not available. Install Docker Desktop, then run this file again.
  pause
  exit /b 1
)

echo Starting Mallow in Docker at http://127.0.0.1:8080/
echo Leave this window open. Press Ctrl+C to stop.
docker compose up --build
if errorlevel 1 (
  echo.
  echo Docker failed to start the game.
  pause
  exit /b 1
)

endlocal
