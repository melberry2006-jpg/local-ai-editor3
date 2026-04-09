#!/usr/bin/env bash
echo "============================================"
echo " Local AI Image Editor - FastAPI Backend"
echo "============================================"
echo ""
echo "Installing dependencies..."
pip install -r requirements.txt
echo ""
echo "Starting server on http://0.0.0.0:8000"
echo "Make sure Stable Diffusion WebUI is running with:"
echo "  ./webui.sh --api --listen"
echo ""
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
