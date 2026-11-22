"""ICC-managed print color pipeline for YutuGs-Photo.

Profiles are supplied by the user/printer vendor. No generic CMYK formula is used.
The service uses LittleCMS through Pillow ImageCms for ICC transforms.
"""
from __future__ import annotations
import io, json, zipfile, hashlib
from pathlib import Path
from typing import Optional

import cairosvg
from PIL import Image, ImageCms, ImageOps
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

app = FastAPI(title="YutuGs Print Color Engine", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:1420", "http://tauri.localhost", "https://tauri.localhost"], allow_methods=["GET", "POST"], allow_headers=["*"])
INTENTS = {"perceptual": 0, "relative-colorimetric": 1, "saturation": 2, "absolute-colorimetric": 3}
BPC_FLAG = getattr(ImageCms.Flags, "BLACKPOINTCOMPENSATION", 0x2000)


def open_profile(data: bytes, label: str):
    if len(data) < 128 or len(data) > 32 * 1024 * 1024:
        raise HTTPException(400, f"{label} ICC 文件大小无效")
    try:
        profile = ImageCms.ImageCmsProfile(io.BytesIO(data))
        # Accessing these fields forces LittleCMS to parse the profile header.
        _ = profile.profile.xcolor_space, profile.profile.profile_description
        return profile
    except Exception as exc:
        raise HTTPException(400, f"{label} 不是有效的 ICC/ICM 配置文件: {exc}") from exc


def profile_info(profile, data: bytes):
    p = profile.profile
    return {
        "description": str(p.profile_description),
        "color_space": str(p.xcolor_space).strip(),
        "connection_space": str(p.connection_space).strip(),
        "manufacturer": str(getattr(p, "manufacturer", "") or ""),
        "model": str(getattr(p, "model", "") or ""),
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data),
    }


def intent_value(value: str) -> int:
    if value not in INTENTS:
        raise HTTPException(400, f"不支持的渲染意图: {value}")
    return INTENTS[value]


def load_rgb(data: bytes):
    try:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
        embedded = image.info.get("icc_profile")
        return image.convert("RGB"), embedded
    except Exception as exc:
        raise HTTPException(400, f"无法读取输入图像: {exc}") from exc


def convert_rgb_to_cmyk(image: Image.Image, source_profile, output_profile, intent: int, bpc: bool):
    flags = BPC_FLAG if bpc else 0
    transform = ImageCms.buildTransformFromOpenProfiles(source_profile, output_profile, "RGB", "CMYK", renderingIntent=intent, flags=flags)
    return ImageCms.applyTransform(image, transform)


def limit_total_ink(cmyk: Image.Image, limit: float):
    """Apply a K-preserving proportional CMY reduction; returns adjusted image and stats.

    This is a controllable TAC limiter, not a device-link profile. For critical work,
    the output profile/device-link should perform the printer-specific black generation.
    """
    if not 100 <= limit <= 400:
        raise HTTPException(400, "总墨量限制必须在 100%–400% 之间")
    values = np.asarray(cmyk, dtype=np.uint16)
    totals = values.sum(axis=2, dtype=np.uint32)
    maximum = float(totals.max()) if totals.size else 0.0
    average = float(totals.mean()) if totals.size else 0.0
    limit_units = limit * 255.0 / 100.0
    mask = totals > limit_units
    chroma = values[:, :, :3].sum(axis=2, dtype=np.uint32).astype(np.float32)
    allowed = np.maximum(0.0, limit_units - values[:, :, 3].astype(np.float32))
    scale = np.ones_like(chroma, dtype=np.float32)
    np.divide(allowed, chroma, out=scale, where=(chroma > 0) & mask)
    values[:, :, :3] = np.rint(values[:, :, :3].astype(np.float32) * scale[:, :, None]).clip(0, 255).astype(np.uint16)
    after_totals = values.sum(axis=2, dtype=np.uint32)
    result = Image.fromarray(values.astype(np.uint8), mode="CMYK")
    return result, {"max_tac_before": round(maximum / 255 * 100, 2), "average_tac_before": round(average / 255 * 100, 2), "max_tac_after": round((float(after_totals.max()) if after_totals.size else 0.0) / 255 * 100, 2), "average_tac_after": round((float(after_totals.mean()) if after_totals.size else 0.0) / 255 * 100, 2), "limit_percent": limit}


def cmyk_tiff_bytes(image: Image.Image, icc: bytes, dpi: float):
    out = io.BytesIO()
    image.save(out, format="TIFF", compression="tiff_lzw", dpi=(dpi, dpi), icc_profile=icc)
    return out.getvalue()


@app.get("/health")
def health():
    return {"ok": True, "service": "YutuGs Print Color Engine", "version": "0.1.0", "engine": "LittleCMS via Pillow ImageCms", "features": ["icc-profile-inspection", "icc-rgb-to-cmyk", "icc-soft-proof", "cmyk-tiff", "four-channel-separations", "tac-report", "svg-rasterization"]}


@app.post("/v1/profiles/inspect")
async def inspect_profile(profile: UploadFile = File(...)):
    data = await profile.read()
    parsed = open_profile(data, "配置文件")
    return profile_info(parsed, data)


@app.post("/v1/convert/cmyk")
async def convert_to_cmyk(
    image: UploadFile = File(...), output_profile: UploadFile = File(...), source_profile: Optional[UploadFile] = File(None),
    intent: str = Form("relative-colorimetric"), black_point_compensation: bool = Form(True), total_ink_limit: float = Form(320), dpi: float = Form(300),
):
    image_data = await image.read(); profile_data = await output_profile.read()
    output_icc = open_profile(profile_data, "输出")
    if output_icc.profile.xcolor_space.strip() != "CMYK": raise HTTPException(400, "输出配置文件必须是 CMYK ICC 配置文件")
    rgb, embedded = load_rgb(image_data)
    if source_profile is not None:
        source_data = await source_profile.read(); source_icc = open_profile(source_data, "源")
    elif embedded:
        source_data = embedded; source_icc = open_profile(source_data, "图像内嵌源")
    else:
        source_data = b""; source_icc = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))
    if source_icc.profile.xcolor_space.strip() != "RGB": raise HTTPException(400, "当前源配置文件必须是 RGB ICC 配置文件")
    converted = convert_rgb_to_cmyk(rgb, source_icc, output_icc, intent_value(intent), black_point_compensation)
    converted, tac = limit_total_ink(converted, total_ink_limit)
    payload = cmyk_tiff_bytes(converted, profile_data, dpi)
    return Response(payload, media_type="image/tiff", headers={"X-YutuGs-Output-Profile": profile_info(output_icc, profile_data)["description"], "X-YutuGs-TAC-Limit": str(total_ink_limit), "X-YutuGs-TAC-Max-Before": str(tac["max_tac_before"]), "X-YutuGs-TAC-Max-After": str(tac["max_tac_after"])})


@app.post("/v1/soft-proof")
async def soft_proof(image: UploadFile = File(...), proof_profile: UploadFile = File(...), source_profile: Optional[UploadFile] = File(None), intent: str = Form("relative-colorimetric"), proof_intent: str = Form("absolute-colorimetric"), black_point_compensation: bool = Form(True)):
    data = await image.read(); proof_data = await proof_profile.read(); proof = open_profile(proof_data, "印刷打样")
    if proof.profile.xcolor_space.strip() != "CMYK": raise HTTPException(400, "打样配置文件必须是 CMYK ICC 配置文件")
    rgb, embedded = load_rgb(data)
    src_data = await source_profile.read() if source_profile else embedded
    source = open_profile(src_data, "源") if src_data else ImageCms.createProfile("sRGB")
    display = ImageCms.createProfile("sRGB")
    flags = (BPC_FLAG if black_point_compensation else 0) | int(ImageCms.Flags.SOFTPROOFING)
    transform = ImageCms.buildProofTransformFromOpenProfiles(source, display, proof, "RGB", "RGB", renderingIntent=intent_value(intent), proofRenderingIntent=intent_value(proof_intent), flags=flags)
    result = ImageCms.applyTransform(rgb, transform)
    out = io.BytesIO(); result.save(out, format="PNG", icc_profile=ImageCms.ImageCmsProfile(display).tobytes())
    return Response(out.getvalue(), media_type="image/png", headers={"X-YutuGs-Soft-Proof": profile_info(proof, proof_data)["description"]})


@app.post("/v1/soft-proof/svg")
async def soft_proof_svg(artwork: UploadFile = File(...), proof_profile: UploadFile = File(...), intent: str = Form("relative-colorimetric"), proof_intent: str = Form("absolute-colorimetric"), black_point_compensation: bool = Form(True), dpi: float = Form(150)):
    svg_data = await artwork.read(); proof_data = await proof_profile.read(); proof = open_profile(proof_data, "印刷打样")
    if proof.profile.xcolor_space.strip() != "CMYK": raise HTTPException(400, "打样配置文件必须是 CMYK ICC 配置文件")
    if b"matrix3d(" in svg_data or b"matrix3d%28" in svg_data: raise HTTPException(422, "当前印前栅格化器尚不支持透视/扭曲 CSS matrix3d 对象，暂不能对这类文档生成准确软打样。")
    try:
        png = cairosvg.svg2png(bytestring=svg_data, dpi=dpi)
        rgb, _ = load_rgb(png)
    except Exception as exc: raise HTTPException(400, f"SVG 栅格化失败: {exc}") from exc
    source = ImageCms.createProfile("sRGB"); display = ImageCms.createProfile("sRGB")
    flags = (BPC_FLAG if black_point_compensation else 0) | int(ImageCms.Flags.SOFTPROOFING)
    transform = ImageCms.buildProofTransformFromOpenProfiles(source, display, proof, "RGB", "RGB", renderingIntent=intent_value(intent), proofRenderingIntent=intent_value(proof_intent), flags=flags)
    result = ImageCms.applyTransform(rgb, transform)
    display_profile = ImageCms.ImageCmsProfile(display)
    out = io.BytesIO(); result.save(out, format="PNG", icc_profile=display_profile.tobytes())
    return Response(out.getvalue(), media_type="image/png", headers={"X-YutuGs-Soft-Proof": profile_info(proof, proof_data)["description"]})


@app.post("/v1/separations/svg")
async def separate_svg(
    artwork: UploadFile = File(...), output_profile: UploadFile = File(...), intent: str = Form("relative-colorimetric"),
    black_point_compensation: bool = Form(True), total_ink_limit: float = Form(320), dpi: float = Form(300),
):
    svg_data = await artwork.read(); profile_data = await output_profile.read()
    if len(svg_data) > 100 * 1024 * 1024: raise HTTPException(413, "SVG 文件超过 100 MB")
    output_icc = open_profile(profile_data, "输出")
    if output_icc.profile.xcolor_space.strip() != "CMYK": raise HTTPException(400, "输出配置文件必须是 CMYK ICC 配置文件")
    if b"matrix3d(" in svg_data or b"matrix3d%28" in svg_data:
        raise HTTPException(422, "当前印前栅格化器尚不支持透视/扭曲 CSS matrix3d 对象。请先将这些对象在外部可靠栅格化并重新导入，或等待下一版网格/透视印前渲染器。")
    try:
        png = cairosvg.svg2png(bytestring=svg_data, dpi=dpi)
        rgb, _ = load_rgb(png)
    except Exception as exc: raise HTTPException(400, f"SVG 栅格化失败: {exc}") from exc
    converted = convert_rgb_to_cmyk(rgb, ImageCms.createProfile("sRGB"), output_icc, intent_value(intent), black_point_compensation)
    converted, tac = limit_total_ink(converted, total_ink_limit)
    channels = converted.split()
    manifest = {"engine": "LittleCMS", "profile": profile_info(output_icc, profile_data), "rendering_intent": intent, "black_point_compensation": black_point_compensation, "dpi": dpi, "width_px": converted.width, "height_px": converted.height, "total_ink": tac, "plates": ["Cyan", "Magenta", "Yellow", "Black"], "limitations": ["本次分色以 SVG 栅格化结果为输入；不保留 PDF/X 矢量透明度/专色对象。", "总墨量限制采用保黑比例缩减 CMY，不替代印厂专用 DeviceLink ICC。", "专色需单独定义色板及分色通道，目前本服务输出 CMYK 四色版。", "SVG 栅格化默认按 sRGB 处理；SVG 内嵌图像的独立 ICC 源配置和浏览器 SVG 滤镜一致性尚未完成。"]}
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("composite-cmyk.tif", cmyk_tiff_bytes(converted, profile_data, dpi))
        for name, channel in zip(["Cyan", "Magenta", "Yellow", "Black"], channels):
            plate = io.BytesIO(); channel.save(plate, format="TIFF", compression="tiff_lzw", dpi=(dpi, dpi))
            zf.writestr(f"plates/{name}.tif", plate.getvalue())
        zf.writestr("separation-report.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        zf.writestr("output-profile.icc", profile_data)
    return Response(archive.getvalue(), media_type="application/zip", headers={"Content-Disposition": "attachment; filename=yutugs-cmyk-separations.zip", "X-YutuGs-TAC-Max-Before": str(tac["max_tac_before"]), "X-YutuGs-TAC-Max-After": str(tac["max_tac_after"])})


def _be16(value: int) -> bytes:
    return int(value).to_bytes(2, "big")


def _be32(value: int) -> bytes:
    return int(value).to_bytes(4, "big")


def _psd_cmyk_bytes(image: Image.Image, icc: bytes) -> bytes:
    """Write a flattened, 8-bit CMYK PSD v1 with an embedded ICC resource."""
    image = image.convert("CMYK")
    width, height = image.size
    if width > 30000 or height > 30000 or width * height > 100_000_000:
        raise HTTPException(413, "PSD 尺寸超过当前导出上限")
    header = b"8BPS" + _be16(1) + bytes(6) + _be16(4) + _be32(height) + _be32(width) + _be16(8) + _be16(4)
    # Image resource 0x040F: ICC profile. Pascal name is empty and padded to an even length.
    resource = b"8BIM" + _be16(0x040F) + b"\x00\x00" + _be32(len(icc)) + icc
    if len(icc) % 2:
        resource += b"\x00"
    channels = [bytes(255 - value for value in image.getchannel(name).tobytes()) for name in ("C", "M", "Y", "K")]
    return header + _be32(0) + _be32(len(resource)) + resource + _be32(0) + _be16(0) + b"".join(channels)


def _pdf_cmyk_jpeg(jpeg: bytes, width: int, height: int) -> bytes:
    """Create a one-page PDF whose image XObject uses DeviceCMYK."""
    content = f"q\n{width} 0 0 {height} 0 0 cm\n/Im0 Do\nQ\n".encode("ascii")
    objects: dict[int, bytes] = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        3: f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>".encode("ascii"),
        4: f"<< /Length {len(content)} >>\nstream\n".encode("ascii") + content + b"endstream",
        5: f"<< /Type /XObject /Subtype /Image /Width {width} /Height {height} /ColorSpace /DeviceCMYK /BitsPerComponent 8 /Filter /DCTDecode /Length {len(jpeg)} >>\nstream\n".encode("ascii") + jpeg + b"\nendstream",
    }
    chunks = [b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"]
    offsets = [0]
    offset = len(chunks[0])
    for index in range(1, 6):
        offsets.append(offset)
        part = f"{index} 0 obj\n".encode("ascii") + objects[index] + b"\nendobj\n"
        chunks.append(part)
        offset += len(part)
    xref = offset
    table = "xref\n0 6\n0000000000 65535 f \n" + "".join(f"{item:010d} 00000 n \n" for item in offsets[1:])
    chunks.append(f"{table}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode("ascii"))
    return b"".join(chunks)


def _eps_cmyk(image: Image.Image) -> bytes:
    image = image.convert("CMYK")
    width, height = image.size
    hex_data = image.tobytes().hex().upper()
    lines = "\n".join(hex_data[i:i + 120] for i in range(0, len(hex_data), 120))
    ps = (f"%!PS-Adobe-3.0 EPSF-3.0\n%%Creator: YutuGs-Photo\n%%BoundingBox: 0 0 {width} {height}\n"
          f"%%LanguageLevel: 2\n%%Pages: 1\n%%EndComments\ngsave\n{width} {height} scale\n"
          f"{width} {height} 8\n[{width} 0 0 -{height} 0 {height}]\n"
          "{currentfile /ASCIIHexDecode filter} false 4 colorimage\n" + lines + "\n>\ngrestore\nshowpage\n%%EOF\n")
    return ps.encode("ascii")


@app.post("/v1/export/cmyk")
async def export_cmyk_file(
    artwork: UploadFile = File(...), output_profile: UploadFile = File(...),
    format: str = Form(...), dpi: float = Form(300), quality: int = Form(92),
    intent: str = Form("relative-colorimetric"), black_point_compensation: bool = Form(True),
    total_ink_limit: float = Form(300),
):
    """Rasterize SVG, convert through the selected CMYK ICC, then encode a CMYK deliverable."""
    target = format.lower().strip()
    if target not in {"jpg", "psd", "pdf", "eps", "tif", "tiff"}:
        raise HTTPException(400, "CMYK 导出仅支持 JPG、PSD、PDF、EPS、TIFF；PNG/SVG 不支持原生 CMYK")
    if not 72 <= dpi <= 2400:
        raise HTTPException(400, "DPI 必须在 72–2400 之间")
    if not 10 <= quality <= 100:
        raise HTTPException(400, "JPG 质量必须在 10–100 之间")
    svg_data = await artwork.read()
    profile_data = await output_profile.read()
    if len(svg_data) > 100 * 1024 * 1024:
        raise HTTPException(413, "SVG 文件超过 100 MB")
    output_icc = open_profile(profile_data, "输出")
    if output_icc.profile.xcolor_space.strip() != "CMYK":
        raise HTTPException(400, "输出配置文件必须是 CMYK ICC 配置文件")
    if b"matrix3d(" in svg_data or b"matrix3d%28" in svg_data:
        raise HTTPException(422, "当前印前栅格化器尚不支持透视/扭曲 CSS matrix3d 对象")
    try:
        png = cairosvg.svg2png(bytestring=svg_data, dpi=dpi)
        rgb, _ = load_rgb(png)
    except Exception as exc:
        raise HTTPException(400, f"SVG 栅格化失败: {exc}") from exc
    converted = convert_rgb_to_cmyk(rgb, ImageCms.createProfile("sRGB"), output_icc, intent_value(intent), black_point_compensation)
    converted, tac = limit_total_ink(converted, total_ink_limit)
    output = io.BytesIO()
    media_type = "application/octet-stream"
    if target == "jpg":
        converted.save(output, format="JPEG", quality=quality, dpi=(dpi, dpi), icc_profile=profile_data)
        media_type = "image/jpeg"
    elif target == "psd":
        output.write(_psd_cmyk_bytes(converted, profile_data))
        media_type = "image/vnd.adobe.photoshop"
    elif target == "pdf":
        jpg_buffer = io.BytesIO()
        converted.save(jpg_buffer, format="JPEG", quality=quality, dpi=(dpi, dpi), icc_profile=profile_data)
        output.write(_pdf_cmyk_jpeg(jpg_buffer.getvalue(), converted.width, converted.height))
        media_type = "application/pdf"
    elif target == "eps":
        output.write(_eps_cmyk(converted))
        media_type = "application/postscript"
    else:
        converted.save(output, format="TIFF", compression="tiff_lzw", dpi=(dpi, dpi), icc_profile=profile_data)
        media_type = "image/tiff"
    return Response(output.getvalue(), media_type=media_type, headers={
        "X-YutuGs-Output-Profile": profile_info(output_icc, profile_data)["description"],
        "X-YutuGs-TAC-Max-Before": str(tac["max_tac_before"]),
        "X-YutuGs-TAC-Max-After": str(tac["max_tac_after"]),
        "X-YutuGs-Color-Mode": "CMYK",
        "X-YutuGs-DPI": str(dpi),
    })
