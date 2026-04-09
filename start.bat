@echo off
echo ============================================
echo  Local AI Image Editor - FastAPI Backend
echo ============================================
echo.
echo Installing dependencies...
pip install -r requirements.txt
echo.
echo Starting server on http://0.0.0.0:8000
echo Stable Diffusion WebUI will be called with:
echo   --api --listen
echo.
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
