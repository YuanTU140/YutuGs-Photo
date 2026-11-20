# YutuGs Print Color Engine

本地印前色彩服务，使用 Pillow ImageCms 调用 LittleCMS 执行 ICC 色彩转换、软打样和 CMYK 四色分色。不会用通用 RGB→CMYK 算式替代设备 ICC。

## 启动

Windows 需 Python 3；CairoSVG 依赖 Cairo 原生运行库，若安装后提示找不到 `cairo-2.dll`，需安装匹配架构的 Cairo/GTK 运行库并确保 DLL 位于 PATH。项目安装包包含服务脚本和启动批处理，但不包含 Python 运行时或 Cairo DLL。

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8766
```

健康检查：`GET http://127.0.0.1:8766/health`

## 能力

- ICC/ICM 配置文件解析与描述、色彩空间、SHA-256 检查。
- 带源配置文件/嵌入配置文件的 RGB→CMYK ICC 转换，支持四种渲染意图和黑点补偿。
- CMYK TIFF 输出并嵌入输出 ICC。
- SVG 默认按 sRGB 栅格化后 CMYK 输出、C/M/Y/K 四个灰度分色 TIFF 和 JSON 报告。
- ICC 软打样预览（输出 RGB 预览图）。
- 总墨量报告及可选保黑 CMY 比例限制。

## 印前限制（必须知悉）

1. 必须使用印厂/纸张/油墨组合对应的 ICC 输出配置文件；服务不附带或臆造印厂配置文件。
2. 四色分色以 SVG 栅格化图像为输入，不保留可编辑矢量透明度、PDF/X-4 对象、专色对象或陷印。
3. 总墨量限制采用保黑比例缩减 CMY 的通用后处理，并报告限制前/后的最高与平均 TAC；这不等同于印厂专用 DeviceLink ICC 的黑版生成和分色策略。正式生产应使用印厂提供的 DeviceLink/输出配置文件并做打样确认。
4. 本服务尚不生成 PDF/X-1a、PDF/X-4，也不提供专色、白墨、烫金、网点角度、陷印、网花和 RIP 控制。不能宣称为完整商业印前 RIP。
5. SVG 内嵌图像的独立 ICC 源配置、SVG 滤镜与浏览器渲染一致性尚未完成；当前 SVG 栅格化按 sRGB 处理。
6. ICC 配置文件由用户自行提供，需确认其授权允许在项目工作流中使用。

## 接口

- `POST /v1/profiles/inspect`: `profile` ICC 文件。
- `POST /v1/convert/cmyk`: `image`, `output_profile`, 可选 `source_profile`; 表单 `intent`, `black_point_compensation`, `total_ink_limit`, `dpi`。
- `POST /v1/soft-proof`: `image`, `proof_profile`, 可选 `source_profile`。
- `POST /v1/soft-proof/svg`: `artwork` SVG 文件和 `proof_profile`，返回屏幕软打样 PNG。
- `POST /v1/separations/svg`: `artwork` SVG 文本文件和 `output_profile`; 返回包含 CMYK TIFF、四个分色 TIFF、ICC 和报告的 ZIP。
