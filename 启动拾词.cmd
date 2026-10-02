@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js，请先安装 Node.js，再启动拾词。
  pause
  exit /b 1
)
echo 启动后，请打开窗口显示的电脑或手机网址。
node server.cjs
pause
