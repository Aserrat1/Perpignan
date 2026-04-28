@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
  goto :end
)

set "CODEX_NODE=%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe"
if exist "%CODEX_NODE%" (
  "%CODEX_NODE%" server.js
  goto :end
)

echo No se encontro Node.js en esta computadora.
echo Instala la version LTS desde https://nodejs.org/ y volve a abrir este archivo.
pause

:end
endlocal
