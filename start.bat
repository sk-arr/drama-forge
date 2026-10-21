@echo off
cd /d "%~dp0"
node server.js
if errorlevel 1 pause
