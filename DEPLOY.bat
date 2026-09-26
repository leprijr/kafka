@echo off
REM Botao FLY DEPLOY do Kafka — duplo clique aqui
cd /d "%~dp0"

echo -- Salvando no GitHub...
git add -A
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set D=%%c-%%b-%%a
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set T=%%a-%%b
git commit -m "atualizacao %D% %T%" 2>nul
if errorlevel 1 echo (nada novo para commitar, seguindo...)
git push

echo -- Publicando na Fly (pode demorar 4-6 min)...
fly deploy

echo.
echo Pronto! Teste em https://kafka.app.br
pause
