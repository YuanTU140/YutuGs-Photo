# YutuGs 本地 AI 推理服务

本服务运行在用户自己的 Windows 电脑上，默认仅监听 `127.0.0.1:8765`。不会上传图片到云端；首次运行会从 Hugging Face 下载模型权重，下载完成后推理在本机执行。

## 安装

建议 NVIDIA 显卡 12GB+ 显存用于 SDXL，16GB+ 更稳妥。CPU 可运行但生成速度会很慢。请先安装与显卡驱动匹配的 PyTorch CUDA 版本，再执行：

```powershell
cd local-ai-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item config.example.json config.json
```

RealESRGAN 权重需单独放入 `weights/RealESRGAN_x4plus.pth`。服务不会在缺失权重时假装高清化成功。

## 启动

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app:app --host 127.0.0.1 --port 8765
```

检查 `http://127.0.0.1:8765/health`。首次调用各任务时加载模型并下载权重，可能需要较长时间和磁盘空间。

## 任务接口

`POST /v1/tasks/{repair|remove|expand|generate|upscale}`，使用 multipart/form-data。图像编辑任务传 `image`；修复、移除、扩展还必须传同尺寸 `mask`（白色区域代表重绘区域）；生图传 `prompt`；高清化传 `image` 和 `scale`（2 或 4）。成功返回 PNG 二进制，失败返回 JSON 错误。

默认模型：SDXL Inpainting、SDXL Base、RealESRGAN x4plus。模型首次下载前请确认许可、磁盘空间和网络条件。商用分发时必须单独核验每个模型的许可证及再分发条件。
