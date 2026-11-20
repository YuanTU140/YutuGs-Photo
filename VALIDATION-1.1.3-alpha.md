# YutuGs-Photo 1.1.3-alpha 验证报告

## 已执行并通过

- 核心 TypeScript 严格检查：`tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM src/core/model.ts src/core/geometry.ts src/core/commands.ts src/core/pathBoolean.ts src/core/history.ts`
- 路径布尔内核独立编译：`tsc --target ES2022 --module commonjs --moduleResolution node --lib ES2022,DOM --outDir /tmp/ygs-pathbuild src/core/model.ts src/core/geometry.ts src/core/pathBoolean.ts`
- 路径布尔 Node 行为检查：两个 100×100 矩形水平重叠 50 px，减去面积 5000、相交面积 5000；联合输出两条同向闭合轮廓；排除输出两侧差集轮廓。
- TSX/TS 语法转译检查：使用 TypeScript `transpileModule` 对 App、SVG Renderer 及核心 TSX 源码执行语法检查（不等同于 React 类型检查）。
- Canvas 2D 禁用 API 扫描：`src/` 和 `src-tauri/src/` 中未发现 `CanvasRenderingContext2D`、`getContext('2d')`、`Path2D`。
- 版本元数据：`package.json`、`src-tauri/tauri.conf.json`、`createDocument` 均更新为 `1.1.3-alpha`。

## 未执行 / 未通过验证

- npm 依赖安装在当前环境超时，未完成安装；完整 React 类型检查、Vitest、Vite build 未运行。
- 当前环境没有 Cargo/Rust 工具链；Rust/Tauri 编译、Windows 系统字体枚举命令编译未执行。
- 未在 Windows 实机测试画笔、橡皮擦蒙版、钢笔控制柄、节点编辑、字体枚举、多画板鼠标交互、滤镜和调整层。
- 未进行 YGS 新对象/蒙版/调整层跨版本往返的完整桌面端测试。
- 未测试非凸路径布尔，因为内核明确拒绝此类输入。
- 未测试 CMYK 印刷色彩一致性；当前 CMYK 仅为元数据。

## 本版限制

画笔是 SVG 矢量笔迹而非像素笔刷；橡皮擦以当前图层 SVG mask 非破坏式工作。滴管只采样矢量对象颜色，油漆桶只改矢量对象填充。路径布尔只支持凸多边形、矩形和椭圆，曲线采样近似。调整层仅实现亮度/对比度 SVG 合成。多画板共享视口。以上不应描述为 Photoshop/Illustrator 全量功能兼容。

## 完整源码包

- 归档文件：`YutuGs-Photo 1.1.3-alpha.zip`
- 归档内容：72 个文件，未包含 `node_modules`。
- `unzip -t` 完整性检查通过；版本元数据与源码包版本一致。
