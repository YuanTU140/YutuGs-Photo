# YutuGs-Photo — 全新重建工程

**版本：1.0.0-alpha.6（独立版本线）**

本项目从空白工程重新构建。旧版 0.4.x 仅作为功能需求参考，不继承旧版 App.tsx、Canvas 2D 编辑逻辑或旧前端文档模型。

## 当前已建立的基础

- Tauri 2 + React + TypeScript 全新桌面工程骨架。
- YGS v2 规范文档模型：文档、画板、图层、对象、路径锚点/控制柄、栅格资产元数据、调整效果数据结构。
- SVG 矢量显示器；当前工程没有 Canvas 2D 绘制代码。
- 独立视口坐标换算与以鼠标锚点缩放算法。
- Geometry Engine：仿射矩阵应用/求逆/组合、对象局部与世界边界框、三次 Bézier 曲线求值与极值、路径采样命中测试。
- Selection Service：单选、追加选择、切换选择、点选命中、框选对象。
- 对象对齐命令已接入命令/历史系统：支持左/中/右、上/中/下对齐，以及相对所选对象整体边界或参考对象对齐。
- 基础命令分发与撤销/重做快照历史。
- YGS v2 JSON envelope + SHA-256 完整性校验原型。
- 多画板文档数据结构和画板新增命令（目前属性面板可列出画板；工作区尚未实现多画板并排显示、选择和拖动）。

## 明确尚未完成

这仍是新项目的早期 Alpha 工程，不是可交付的完整 Photoshop/Illustrator 替代品。尚未实现：真实工具指针交互和选择框可视化、对象间距分布、完整 Bézier 节点编辑、路径布尔运算、位图像素处理引擎、滤镜/调整图层合成、PSD/AI/PDF 适配器、完整 YGS 二进制资产包、AI 五项能力接入主文档、全部菜单命令及 Windows 安装包。

当前 `object.align` 命令已接入几何服务，支持相对选择集边界或参考对象的六种对齐方式；对象间距分布仍未实现。栅格图像对象目前只定义数据结构，尚未接入图像资产显示管线。

## 核心架构方向

`YGS Document → Object/Layer/Artboard → Command/History → Geometry & Raster Services → SVG/WebGPU Renderer → Viewport`

SVG 负责矢量显示；栅格处理计划采用独立像素缓冲区与 WebGPU/CPU 图像服务，不回退到 Canvas 2D。PhotoCraft / VectorCraft 不作为程序依赖。

## 开发环境

- Node.js 20+
- Rust stable
- Tauri 2 所需 Windows WebView2 / MSVC 构建工具链

```bash
npm install
npm run typecheck
npm test
npm run build
npm run tauri dev
```

Windows 安装包：在 Windows 构建主机配置 Rust 与 Tauri 工具链后运行 `npm run tauri build`。

## 阶段计划

1. 规范文档模型、对象/图层/画板关系、YGS v2 持久化与迁移规范。
2. Geometry Engine：基础矩阵、边界框、Bézier 求值、命中测试、对象选择、Shift 多选、框选、拖拽移动、组缩放/旋转、方向键微移、批量变换命令和撤销/重做已进入 alpha.4；后续补齐精确曲线几何、节点编辑、间距分布与布尔运算。
3. SVG Renderer + Raster Engine：无 Canvas 2D 的矢量/位图显示和处理。
4. Selection/Tool Engine：对象选择集、钢笔、节点编辑、对齐分布、参考线和吸附。
5. Layer Compositor：蒙版、混合模式、滤镜、调整图层。
6. Menu/Command Registry：全部菜单、工具和快捷键统一命令化并覆盖测试。
7. AI Provider 接入、五项 AI 工作流写回独立图层。
8. 导入导出、恢复、性能、Windows 构建与真实交互验收。

## 验收底线

- 不允许 Canvas 2D 作为编辑、绘制、取色、像素填充或图像变换内核。
- 不允许空接口或占位 UI 被标记为已实现。
- 每项菜单操作必须产生可验证的文档变化或明确显示不可用原因。
- 保存、关闭、重新打开后，文档结构与编辑状态必须通过测试。

## 品牌与启动界面（alpha.3）

- 应用图标、品牌图和启动画面原图直接沿用 0.4.7 原始资源，文件内容保持逐字节一致。
- 启动画面在原有“正在初始化...”文字位置覆盖动态状态文字“正在初始化.....”，五个点依次呼吸闪烁；启动画面主体图片不做重绘或换色。
- Tauri 启动时先显示品牌启动窗口，约 1.8 秒后显示主窗口并关闭启动窗口。
- 动画遵循 `prefers-reduced-motion`，减少动态效果时显示静态五点。


## Alpha 0.5 — viewport navigation

- Alt + 鼠标滚轮以指针所在位置为锚点缩放，避免鼠标下方内容漂移。
- 鼠标中键按住拖动画布。
- 按住空格键 + 鼠标左键或右键拖动画布；右键上下文菜单在画布内被抑制。
- 平移手势取消时恢复手势开始前的视口。
- 视口平移和缩放锚点逻辑增加单元测试。
- 修复 Tauri `Manager` trait 导入，确保 `get_webview_window` API 在作用域中。

## Alpha 0.4 — interactive selection and transforms

This iteration adds a working SVG-based interaction loop: rectangle/ellipse drag creation, object hit testing, click selection, Shift-toggle multi-selection, marquee selection, multi-object dragging, group resize handles, rotation handle, arrow-key nudging (Shift = 10 px), Delete, alignment actions, and atomic multi-object transform history. YGS open/save now round-trips the transformed document model. The renderer and interaction layer remain SVG/DOM based; Canvas 2D is not used.

Known limits in this iteration: the pen tool, node-level path editing, aspect-ratio lock during resizing, snapping/guides, artboard-aware clipping, and full raster-object rendering are not implemented. Resize/rotate are bounding-box/group transforms, not individual object pivot controls. Automated browser pointer tests and native Windows/Tauri runtime validation still need to be run in an environment with installed dependencies and a Windows toolchain.
