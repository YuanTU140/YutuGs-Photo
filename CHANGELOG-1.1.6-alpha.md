# YutuGs-Photo 1.1.6-alpha

## SVG 画板渲染器修正
- `pathData(g, _id?)` 增加可选对象 ID 参数，并在常规矢量路径和橡皮擦路径调用时传入对象 ID。
- `filterMarkup` 将高斯模糊、亮度和色相 SVG 滤镜数值显式转换为字符串。
- `adjustmentFilter` 将高斯模糊、亮度/对比度参数和色相旋转值显式转换为字符串。
- 保留透视/扭曲矩阵预览、对象变换预览及自由/透视/扭曲控制点显示，避免覆盖式修改造成已有功能回退。

## 边界
- 本次是 SVG 属性参数类型和路径函数签名修正，不代表增加新的滤镜算法。
- 完整 React/Vite、Vitest、Rust/Tauri 和 Windows 安装验收状态以验证报告为准。
