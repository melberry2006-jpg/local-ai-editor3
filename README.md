# Local AI Image Editor (Android APK – On-Premise)

This project is a fully local Android application that connects to a locally hosted Stable Diffusion instance (Automatic1111 WebUI) via a FastAPI backend. It allows personal image editing using image-to-image generation with full user control and zero external API dependencies.

## Features

- **100% Local Processing**: No external APIs, no censorship, no filtering.
- **Image-to-Image Generation**: Modify clothing, background, style, etc.
- **Advanced Controls**: Denoising strength, CFG scale, steps, sampler selection.
- **Model Selection**: Dynamically fetch and switch between available SD checkpoints.
- **High-Resolution Upscaling**: Built-in support for HR upscaling.
- **Face Restoration**: Toggle GFPGAN/CodeFormer face restoration.
- **ControlNet Integration**: Preserve face identity using ControlNet OpenPose.
- **Local Gallery**: Save generated images directly to the device (`Pictures/LocalAI/`).
- **Presets**: Save and manage favorite prompts and settings.

## System Architecture

```text
Android App (React Native)
       ↓ (Local Network IP)
FastAPI Backend (Python)
       ↓ (localhost:7860)
Stable Diffusion WebUI (Automatic1111 API)
```

## Prerequisites

1. **Stable Diffusion WebUI (Automatic1111)**
   Must be running on your local machine with API enabled.
   Start it using:
   ```bash
   webui-user.bat --api --listen
   ```

2. **Python 3.10+** (For the FastAPI Backend)
3. **Node.js & React Native Environment** (For building the Android App)

## Setup Instructions

### 1. FastAPI Backend

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the server:
   - On Windows: Run `start.bat`
   - On Linux/Mac: Run `./start.sh`
   - Or manually: `uvicorn main:app --host 0.0.0.0 --port 8000`

The backend will be available at `http://<YOUR_LOCAL_IP>:8000`.

### 2. Android App (React Native)

1. Navigate to the `android-app` directory:
   ```bash
   cd android-app
   ```
2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```
3. Run on Android device/emulator:
   ```bash
   npm run android
   ```
4. Build APK:
   ```bash
   npm run build-android
   ```
   The APK will be generated in `android/app/build/outputs/apk/debug/`.

## App Configuration

When you first open the app:
1. Go to the **Settings** tab.
2. Enter the local IP address of your FastAPI backend (e.g., `http://192.168.1.10:8000`).
3. Tap **Test Connection** to ensure the app can reach the backend and Stable Diffusion.
4. Tap **Save URL**.

## Directory Structure

- `/backend`: Python FastAPI server bridging the app and Stable Diffusion.
- `/android-app`: React Native source code for the Android application.

## License

Private / On-Premise Use Only.
