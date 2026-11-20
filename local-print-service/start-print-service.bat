@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv
  if errorlevel 1 exit /b 1
)
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo 印前依赖安装失败。请检查 Python、网络以及 Cairo/CairoSVG 运行库。
  pause
  exit /b 1
)
python -m uvicorn app:app --host 127.0.0.1 --port 8766
endlocal
