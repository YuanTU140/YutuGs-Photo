# YutuGs-Photo 1.1.4-alpha 验证报告

## 已执行并通过

- 核心 TypeScript 严格检查（含未使用变量/参数）：`tsc --noEmit --strict --noUnusedLocals --noUnusedParameters --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM src/core/*.ts`。
- TS/TSX 语法转译：使用 TypeScript `transpileModule` 检查 `src/` 与 `tests/`，19 个文件、0 个语法诊断。此项不等同完整 React 类型检查。
- 核心 Node 冒烟：透视四角映射/逆变换、对象边界和命中测试、对齐/分布及撤销、YGS SHA-256 保存重开、CMYK profile 元数据往返通过。
- Python 服务语法：`python -m py_compile local-print-service/app.py`。
- 印前服务单元测试：`python -m pytest -q local-print-service/tests`，3 passed。
- 印前 API 集成冒烟：使用测试环境可用的 FOGRA39L CMYK ICC（只在测试环境读取，不复制进源码包）验证 `/health`、ICC profile 检查、RGB 图像→CMYK TIFF（嵌入输出 ICC）、SVG 软打样 PNG、CMYK 合成 TIFF、C/M/Y/K 四张分色 TIFF、ZIP 报告、TAC 限制前/后统计，均通过。
- 透视/扭曲 `matrix3d` 印前安全保护：软打样/分色接口明确返回 HTTP 422，不静默输出错误分色。
- Canvas 2D 禁用 API 扫描：`src/` 与 `src-tauri/src/` 未发现 `CanvasRenderingContext2D`、`getContext('2d')`、`Path2D`。
- 原品牌资产与 alpha.4 逐字节对照：启动页、品牌图、启动图、SVG/PNG/ICO 图标均一致。
- `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`createDocument` 版本均为 `1.1.4-alpha`；Tauri 配置已将印前服务脚本和启动批处理列为 bundle resources。

## 测试环境说明

本轮 API 冒烟测试环境的实际库版本：Python 3.13、Pillow 12.3.0、NumPy 2.3.5、CairoSVG 2.8.2、FastAPI 0.128.2、Uvicorn 0.48.0、python-multipart 0.0.29；与 `local-print-service/requirements.txt` 锁定版本一致。测试使用的 FOGRA39L ICC 来自环境系统路径，不属于项目资产，也未打包。

## 未执行 / 尚未验证

- 当前没有安装 npm 前端依赖；完整 React 类型检查、Vitest 全量测试、Vite 构建未运行。
- 当前没有 Cargo/Rust 工具链；Rust/Tauri 编译、NSIS/MSI 安装包构建未执行。
- 未在 Windows 桌面实机验证自由变换/透视/扭曲鼠标交互、系统字体、安装后本地印前服务启动和 ICC 文件加载。
- Tauri 已配置打包印前服务脚本，但 Python 运行时、Cairo 原生 DLL 和 Python wheels 不随安装包提供；Windows Cairo/GTK 运行库部署方式仍需实机验证。
- 未验证 DeviceLink、专色/专金色、陷印、网点、PDF/X、RIP、印厂纸张/油墨组合和真实打样；本版本不是完整商业 RIP。
- SVG 栅格化默认按 sRGB 处理，未完成 SVG 内嵌位图的独立 ICC 源配置、复杂 SVG filter 与浏览器渲染的一致性验证。
- 透视/扭曲对象以 CSS `matrix3d` 显示/保存；当前 CairoSVG 印前服务主动返回 422，不提供这类对象的分色输出。
- 第三方依赖许可目前仅做初步登记，正式 Windows 发布前仍需 SBOM、原生 DLL 许可文本和 LGPL 动态链接/可替换性审查。

## 已知功能边界

CMYK 是基于用户输出 ICC 的印前转换/软打样/四色栅格分色工作流；编辑器实时颜色与 SVG 预览仍为 RGB，尚非原生 CMYK 全编辑链路。TAC 处理为保黑比例缩减 CMY，不替代 DeviceLink。选择工具支持自由变换、移动、缩放、旋转、斜切、翻转和四角透视/扭曲；任意控制网格 Warp、操控变形尚未实现。

## 完整源码归档

- 文件名：`YutuGs-Photo 1.1.4-alpha.zip`
- 当前归档：86 个 ZIP 条目（含目录）；不包含 `node_modules`、Python 虚拟环境、测试缓存或 ICC 测试配置文件。
- ZIP 完整性：交付前使用 `unzip -t` 检查通过；最终 SHA-256 在交付说明中提供。
