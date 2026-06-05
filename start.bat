@echo off
cd /d "%~dp0"
echo Instalando dependencias...
.venv\Scripts\pip install -r requirements.txt
echo.
echo Iniciando SPICED ^& MEDDPICC Trainer...
start http://localhost:5001
.venv\Scripts\python app.py
pause
