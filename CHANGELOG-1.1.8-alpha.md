# YutuGs-Photo 1.1.8-alpha

## 图层堆栈顺序管理

- 新增 `layer.reorder` 核心命令，可在指定画板内将图层移动到目标堆栈索引。
- 图层面板新增上移/下移按钮；按钮边界状态与画板图层数量联动。
- 图层顺序直接修改 `Artboard.layerIds`，与 SVG Renderer 的绘制顺序保持一致。
- 图层排序进入统一命令历史，支持撤销和重做。
- 新增测试覆盖顺序变化、撤销/重做、跨画板图层拒绝及目标索引校验。

## 保留与限制

- 延续 1.1.7-alpha 完整代码基线及原有功能，不引入 Canvas 2D 编辑内核。
- 本版未实现拖拽排序、图层分组、跨画板移动和完整混合模式。
- Vitest、完整 React/Vite build、Rust/Tauri 和 Windows 安装测试是否执行，以 `VALIDATION-1.1.8-alpha.md` 为准。
