# 1.1.2-alpha 验证报告

## 已执行并通过

1. 核心 TypeScript：
   `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM src/core/*.ts src/io/svg.ts src/persistence/ygs.ts`
2. TS/TSX 语法转译检查：`App.tsx`、`SvgArtboard.tsx`、AI 工作区、AI 客户端、包装模板、核心模型和命令模块均无语法诊断。
3. Python 语法检查：`python -m py_compile local-ai-service/app.py`
4. 独立 Node 行为验证：AI 图像结果原子插入图层并撤销；参考线写入；图层可见性/锁定切换。
5. YGS v2 往返：包装元数据、参考线和内嵌栅格 data URL 保存后重新打开一致。
6. 包装模板数据核对：共 18 款模板。
7. Canvas 2D 禁用 API 源码扫描：`src/` 与 `src-tauri/src/` 中未发现 `CanvasRenderingContext2D`、`Path2D` 或 `getContext('2d')` 调用。

## 未执行 / 未通过验证

- `npm install`：因当前环境离线且 npm 缓存无所需包，执行 `npm install --ignore-scripts --offline --no-audit --no-fund` 失败（ENOTCACHED）。
- 完整 React/TSX 类型检查、Vitest 全量测试、Vite production build：未执行。
- Rust/Tauri build、Windows x64 NSIS/MSI 安装和实际启动：未执行；当前环境没有 `cargo` 命令。
- Local AI Python 依赖安装、模型下载、GPU/CPU 推理：未执行。服务代码可编译不代表模型可用；必须按 `local-ai-service/README.md` 安装依赖并下载/配置权重。
- AI 结果写入 YGS 的实际桌面 UI 操作、保存/关闭/重开：未进行端到端测试。

## 重要限制

本轮恢复的 AI 工作区在本地推理服务未启动或模型/权重缺失时会显示离线/错误状态，不会显示伪造结果。RealESRGAN 权重不包含在源码包中。SDXL/RealESRGAN 模型的商用使用、分发和权重许可需在实际部署前单独核验。
