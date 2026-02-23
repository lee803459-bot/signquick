@echo off
start "Backend" cmd /k "cd /d D:\myproject\backend && npm start"
timeout /t 2 /nobreak >nul
start "Frontend" cmd /k "cd /d D:\myproject\frontend && npm start"
timeout /t 5 /nobreak >nul
start http://localhost:3000
