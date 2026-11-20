"""YutuGs local AI inference service. Models are downloaded on first use."""
from __future__ import annotations
import io, json, os, threading
from pathlib import Path
from typing import Optional
import numpy as np
import torch
from PIL import Image, ImageOps
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.json"
CONFIG = json.loads(CONFIG_PATH.read_text("utf-8")) if CONFIG_PATH.exists() else json.loads((ROOT / "config.example.json").read_text("utf-8"))
Path(CONFIG.get("cache_dir", "./models")).mkdir(parents=True, exist_ok=True)
os.environ.setdefault("HF_HOME", str((ROOT / CONFIG.get("cache_dir", "./models")).resolve()))
app = FastAPI(title="YutuGs Local AI", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:1420", "http://tauri.localhost", "https://tauri.localhost"], allow_methods=["GET", "POST"], allow_headers=["*"])
lock = threading.Lock()
pipelines = {}
upscaler = None

def device_dtype():
    requested = CONFIG.get("device", "auto")
    device = "cuda" if requested == "auto" and torch.cuda.is_available() else ("cpu" if requested == "auto" else requested)
    dtype = torch.float16 if device == "cuda" else torch.float32
    return device, dtype

def load_pipeline(kind: str):
    if kind in pipelines: return pipelines[kind]
    from diffusers import StableDiffusionXLInpaintPipeline, StableDiffusionXLPipeline
    device, dtype = device_dtype()
    model = CONFIG["models"]["inpaint" if kind == "inpaint" else "text_to_image"]
    cls = StableDiffusionXLInpaintPipeline if kind == "inpaint" else StableDiffusionXLPipeline
    pipe = cls.from_pretrained(model, torch_dtype=dtype, use_safetensors=True, cache_dir=CONFIG.get("cache_dir", "./models"))
    if device == "cuda": pipe.enable_model_cpu_offload()
    else: pipe.to(device)
    pipelines[kind] = pipe
    return pipe

def image_bytes(img: Image.Image) -> bytes:
    out = io.BytesIO(); img.save(out, format="PNG"); return out.getvalue()

def load_image(data: bytes) -> Image.Image:
    try: return ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    except Exception as exc: raise HTTPException(400, f"无法读取图像: {exc}")

def aligned_size(w: int, h: int): return max(512, (w // 8) * 8), max(512, (h // 8) * 8)

@app.get("/health")
def health():
    device, _ = device_dtype()
    return {"ok": True, "service": "YutuGs Local AI", "device": device, "cuda_available": torch.cuda.is_available(), "loaded_models": list(pipelines.keys()) + (["upscale"] if upscaler else []), "operations": ["repair", "remove", "expand", "generate", "upscale"]}

async def read_upload(upload: UploadFile) -> bytes:
    data = await upload.read()
    if len(data) > int(CONFIG.get("max_upload_mb", 40)) * 1024 * 1024: raise HTTPException(413, "上传图片超过本地服务大小限制")
    return data

@app.post("/v1/tasks/{task}")
async def run_task(task: str, image: Optional[UploadFile] = File(None), mask: Optional[UploadFile] = File(None), prompt: str = Form(""), negative_prompt: str = Form(""), strength: float = Form(0.85), steps: int = Form(30), guidance: float = Form(7.0), scale: int = Form(4), width: int = Form(1024), height: int = Form(1024), seed: int = Form(-1)):
    if task not in {"repair", "remove", "expand", "generate", "upscale"}: raise HTTPException(404, "不支持的 AI 任务")
    if not 1 <= steps <= 100 or not 0.05 <= strength <= 1 or not 1 <= scale <= 4: raise HTTPException(400, "任务参数超出允许范围")
    if task == "generate":
        if not prompt.strip(): raise HTTPException(400, "AI 生图需要填写提示词")
        base = None
    else:
        if image is None: raise HTTPException(400, "此任务需要上传原始图像")
        base = load_image(await read_upload(image))
    if task in {"repair", "remove"}:
        if mask is None: raise HTTPException(400, "图像修复和智能移除需要提供蒙版；白色区域表示需要重绘")
        mask_img = ImageOps.grayscale(load_image(await read_upload(mask)))
        if base.size != mask_img.size: mask_img = mask_img.resize(base.size, Image.Resampling.NEAREST)
    elif task == "expand":
        # White canvas outside the source image is generated; source remains intact.
        target_w, target_h = max(width, base.width), max(height, base.height)
        canvas = Image.new("RGB", (target_w, target_h), (127,127,127))
        x, y = (target_w-base.width)//2, (target_h-base.height)//2
        canvas.paste(base, (x,y))
        mask_img = Image.new("L", (target_w,target_h), 255)
        mask_img.paste(0, (x,y,x+base.width,y+base.height))
        base = canvas
    with lock:
        try:
            if task == "upscale":
                global upscaler
                if upscaler is None:
                    from basicsr.archs.rrdbnet_arch import RRDBNet
                    from realesrgan import RealESRGANer
                    device, _ = device_dtype()
                    model_path = os.environ.get("YUTUGS_REALESRGAN_WEIGHTS", str(ROOT / "weights" / "RealESRGAN_x4plus.pth"))
                    if not Path(model_path).exists(): raise HTTPException(503, "缺少 RealESRGAN_x4plus.pth 模型权重，请按 local-ai-service/README.md 安装")
                    net = RRDBNet(num_in_ch=3,num_out_ch=3,num_feat=64,num_block=23,num_grow_ch=32,scale=4)
                    upscaler = RealESRGANer(scale=4, model_path=model_path, model=net, tile=0, tile_pad=10, pre_pad=0, half=device=="cuda", device=torch.device(device))
                arr = np.array(base)[:,:,::-1]
                out, _ = upscaler.enhance(arr, outscale=scale)
                result = Image.fromarray(out[:,:,::-1])
            elif task == "generate":
                pipe = load_pipeline("text")
                generator = torch.Generator(device="cpu").manual_seed(seed if seed >= 0 else int.from_bytes(os.urandom(4),"big"))
                result = pipe(prompt=prompt, negative_prompt=negative_prompt, width=width//8*8, height=height//8*8, num_inference_steps=steps, guidance_scale=guidance, generator=generator).images[0]
            else:
                pipe = load_pipeline("inpaint")
                generator = torch.Generator(device="cpu").manual_seed(seed if seed >= 0 else int.from_bytes(os.urandom(4),"big"))
                w,h = aligned_size(*base.size); base=base.resize((w,h),Image.Resampling.LANCZOS); mask_img=mask_img.resize((w,h),Image.Resampling.NEAREST)
                default_prompt = {"repair":"restore damaged image, preserve original details and composition", "remove":"seamlessly fill the masked region with matching background", "expand":"continue the original image naturally beyond its borders"}[task]
                result = pipe(prompt=prompt.strip() or default_prompt, negative_prompt=negative_prompt, image=base, mask_image=mask_img, strength=strength, num_inference_steps=steps, guidance_scale=guidance, generator=generator).images[0]
            return Response(image_bytes(result), media_type="image/png", headers={"X-YutuGs-AI-Task":task})
        except HTTPException: raise
        except Exception as exc: raise HTTPException(500, f"本地模型执行失败: {type(exc).__name__}: {exc}") from exc
