"""
Local AI Image Editor - FastAPI Backend
Connects to Stable Diffusion WebUI (Automatic1111) via local API
"""

import base64
import io
import httpx
import logging
from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ─── App ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Local AI Image Editor",
    description="FastAPI backend that bridges the Android app with Stable Diffusion WebUI (Automatic1111)",
    version="1.0.0",
)

# Allow all origins (local network use only)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stable Diffusion WebUI base URL (Automatic1111 running locally)
SD_BASE_URL = "http://127.0.0.1:7860"

# HTTP client timeout – generation can take up to 120 seconds
HTTP_TIMEOUT = httpx.Timeout(120.0, connect=10.0)


# ─── Helper ─────────────────────────────────────────────────────────────────

def image_to_base64(image_bytes: bytes) -> str:
    """Convert raw image bytes to a base64-encoded string."""
    return base64.b64encode(image_bytes).decode("utf-8")


async def switch_checkpoint(checkpoint: str) -> None:
    """Tell Stable Diffusion to load a different model checkpoint."""
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.post(
            f"{SD_BASE_URL}/sdapi/v1/options",
            json={"sd_model_checkpoint": checkpoint},
        )
        resp.raise_for_status()
        logger.info("Switched checkpoint to: %s", checkpoint)


# ─── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/", summary="Health check")
async def root():
    return {"status": "ok", "message": "Local AI Image Editor backend is running"}


@app.get("/models", summary="List available SD checkpoints")
async def get_models():
    """
    Fetch the list of available Stable Diffusion model checkpoints
    from the local Automatic1111 WebUI instance.
    """
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(f"{SD_BASE_URL}/sdapi/v1/sd-models")
            resp.raise_for_status()
            models = resp.json()

        # Return a simplified list: title + model_name
        simplified = [
            {
                "title": m.get("title", ""),
                "model_name": m.get("model_name", ""),
                "filename": m.get("filename", ""),
            }
            for m in models
        ]
        return {"models": simplified}

    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Cannot connect to Stable Diffusion WebUI. Make sure it is running with --api --listen flags.",
        )
    except Exception as exc:
        logger.exception("Error fetching models")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/generate", summary="Generate image via img2img")
async def generate_image(
    prompt: str = Form(..., description="Positive prompt for image generation"),
    negative_prompt: str = Form("", description="Negative prompt"),
    denoising_strength: float = Form(0.5, ge=0.0, le=1.0, description="Denoising strength (0–1)"),
    cfg_scale: float = Form(7.0, ge=1.0, le=20.0, description="CFG scale (1–20)"),
    steps: int = Form(20, ge=1, le=50, description="Number of sampling steps (1–50)"),
    sampler: str = Form("Euler a", description="Sampler name"),
    checkpoint: Optional[str] = Form(None, description="Model checkpoint name (optional)"),
    width: int = Form(512, ge=64, le=2048, description="Output image width"),
    height: int = Form(512, ge=64, le=2048, description="Output image height"),
    # ControlNet (optional high-priority feature)
    use_controlnet: bool = Form(False, description="Enable ControlNet for face preservation"),
    controlnet_model: str = Form("control_v11p_sd15_openpose", description="ControlNet model name"),
    # Face enhancement
    restore_faces: bool = Form(False, description="Enable face restoration (GFPGAN/CodeFormer)"),
    # Upscaling
    enable_hr: bool = Form(False, description="Enable high-resolution upscaling"),
    hr_scale: float = Form(2.0, ge=1.0, le=4.0, description="Upscaling factor"),
    hr_upscaler: str = Form("Latent", description="Upscaler model"),
    file: UploadFile = File(..., description="Input image to edit"),
):
    """
    Main generation endpoint. Accepts an image and parameters, sends an
    img2img request to Stable Diffusion WebUI, and returns the result as
    a base64-encoded image string.
    """
    # 1. Read and encode the uploaded image
    try:
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        init_image_b64 = image_to_base64(image_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded image: {exc}")

    # 2. Optionally switch checkpoint BEFORE generating
    if checkpoint:
        try:
            await switch_checkpoint(checkpoint)
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail="Cannot connect to Stable Diffusion WebUI to switch checkpoint.",
            )
        except Exception as exc:
            logger.warning("Failed to switch checkpoint: %s", exc)
            # Non-fatal – continue with current checkpoint

    # 3. Build the img2img payload
    payload: dict = {
        "init_images": [init_image_b64],
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "denoising_strength": denoising_strength,
        "cfg_scale": cfg_scale,
        "steps": steps,
        "sampler_name": sampler,
        "width": width,
        "height": height,
        "restore_faces": restore_faces,
        # High-resolution upscaling
        "enable_hr": enable_hr,
        "hr_scale": hr_scale,
        "hr_upscaler": hr_upscaler,
    }

    # 4. Attach ControlNet extension payload (if requested)
    if use_controlnet:
        payload["alwayson_scripts"] = {
            "controlnet": {
                "args": [
                    {
                        "input_image": init_image_b64,
                        "model": controlnet_model,
                        "module": "openpose_face",
                        "weight": 0.8,
                        "guidance_start": 0.0,
                        "guidance_end": 1.0,
                        "control_mode": 0,
                        "resize_mode": 1,
                    }
                ]
            }
        }

    # 5. Call Stable Diffusion img2img API
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            logger.info("Sending img2img request | steps=%d cfg=%.1f denoise=%.2f", steps, cfg_scale, denoising_strength)
            resp = await client.post(f"{SD_BASE_URL}/sdapi/v1/img2img", json=payload)
            resp.raise_for_status()
            result = resp.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Cannot connect to Stable Diffusion WebUI. Ensure it is running with --api --listen.",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Stable Diffusion took too long to respond. Try reducing steps or image size.",
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text)
    except Exception as exc:
        logger.exception("Unexpected error during generation")
        raise HTTPException(status_code=500, detail=str(exc))

    # 6. Extract the generated image from the response
    images = result.get("images", [])
    if not images:
        raise HTTPException(status_code=500, detail="Stable Diffusion returned no images.")

    generated_b64 = images[0]

    logger.info("Image generated successfully")
    return JSONResponse(content={"image": generated_b64})


@app.get("/samplers", summary="List available samplers")
async def get_samplers():
    """Return the list of available samplers from Stable Diffusion WebUI."""
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(f"{SD_BASE_URL}/sdapi/v1/samplers")
            resp.raise_for_status()
            samplers = resp.json()
        return {"samplers": [s.get("name") for s in samplers]}
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Stable Diffusion WebUI.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/upscalers", summary="List available upscalers")
async def get_upscalers():
    """Return the list of available upscaler models."""
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(f"{SD_BASE_URL}/sdapi/v1/upscalers")
            resp.raise_for_status()
            upscalers = resp.json()
        return {"upscalers": [u.get("name") for u in upscalers]}
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Stable Diffusion WebUI.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/controlnet-models", summary="List available ControlNet models")
async def get_controlnet_models():
    """Return the list of available ControlNet models (requires ControlNet extension)."""
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(f"{SD_BASE_URL}/controlnet/model_list")
            resp.raise_for_status()
            data = resp.json()
        return {"controlnet_models": data.get("model_list", [])}
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Stable Diffusion WebUI.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
