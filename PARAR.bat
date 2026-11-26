@echo off
rem Desliga o Mercadinho do Joao. Os dados continuam guardados.
chcp 65001 >nul
cd /d "%~dp0"
docker compose stop
echo.
pause
