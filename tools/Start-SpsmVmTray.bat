@echo off
REM Launcher untuk SPSM VM Tray — jalankan di background (window tersembunyi)
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0SpsmVmTray.ps1"
