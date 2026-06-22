@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   ServiHogar - iniciando servidor...
echo   Abre en el navegador:  http://localhost:3000
echo   Para detener: cierra esta ventana o pulsa Ctrl+C
echo ============================================
echo.
node server.js
echo.
echo El servidor se detuvo. Pulsa una tecla para cerrar.
pause >nul
