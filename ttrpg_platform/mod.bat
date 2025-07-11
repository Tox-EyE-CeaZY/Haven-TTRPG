@echo off
echo Make sure you have activated your Python virtual environment first!
echo (e.g., by running 'venv\Scripts\Activate.ps1' in PowerShell or 'venv\Scripts\activate' in Command Prompt)
echo.
echo Press any key to continue with module installation, or Ctrl+C to cancel.
pause > nul
echo.
echo Installing required Python modules...
pip install -r requirements.txt
echo.
echo Module installation complete.
pause