@echo off
rem Liga o Mercadinho do Joao neste computador. Precisa do Docker Desktop.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar.ps1"
echo.
pause
