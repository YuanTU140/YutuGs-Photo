# 印前服务第三方组件许可初步记录

本文件是本轮源码依赖的初步登记，不构成完整法律审查。Python 依赖由用户安装，当前 Tauri 资源包只包含本项目服务脚本、README、requirements 和启动脚本，不直接捆绑 Python wheels 或 ICC 配置文件。

| 组件 | 用途 | 当前识别的许可/说明 |
|---|---|---|
| Pillow / ImageCms | 图像读写、LittleCMS ICC 变换接口 | Pillow 使用 HPND 许可；ImageCms 依赖 LittleCMS，分发二进制时需保留相应第三方许可文件 |
| LittleCMS | ICC 色彩管理核心 | 通过 Pillow ImageCms 调用；需在目标平台核对实际 wheel 所含/链接的 LittleCMS 版本与许可文本 |
| NumPy | TAC 总墨量向量化计算 | BSD-3-Clause；二进制构建还可能包含其他第三方组件，遵守其随包许可 |
| CairoSVG | SVG 栅格化 | LGPL-3.0-or-later；其 Cairo/CairoFFI 原生运行时也需单独核对许可与分发义务 |
| FastAPI | 本地 HTTP API | MIT |
| Uvicorn | ASGI 服务运行时 | BSD 风格许可；分发前需核对锁定版本的许可文件 |
| python-multipart | multipart 文件上传 | Apache-2.0 |

发布正式 Windows 安装包前，必须针对锁定依赖版本生成 SBOM、收集所有 wheel/原生 DLL 的许可文本，审查 LGPL 动态链接/可替换性义务，并检查 Cairo、LittleCMS、NumPy 二进制的实际打包内容。不得将本表视为完整许可验收。
