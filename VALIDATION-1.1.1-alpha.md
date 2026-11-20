# 1.1.1-alpha 验证记录

## 已执行

- `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM src/core/*.ts src/io/svg.ts`：通过。
- TypeScript `transpileModule` 语法检查：`src/App.tsx`、`src/io/svg.ts`、`src/core/model.ts` 均通过。
- Canvas 2D 禁用 API 扫描：扫描 `src` 与 `src-tauri/src`，未发现 `CanvasRenderingContext2D`、`Path2D`、`getContext("2d")`。
- ZIP 完整性：打包后执行 `unzip -t`，通过。
- 版本元数据：`package.json`、`src-tauri/tauri.conf.json`、新建 YGS 文档 `appVersion` 均为 `1.1.1-alpha`。
- 品牌资源：与 alpha.4 的启动页 HTML、品牌图、启动图、Tauri SVG/PNG/ICO 图标逐字节一致。

## 未执行 / 不能宣称通过

- 完整 React/JSX 类型检查：npm 依赖安装未能完成，`react`、`lucide-react` 类型缺失。
- Vitest 全量测试：未执行。
- Vite 构建：未执行。
- Rust/Tauri 检查与构建：未执行。
- Windows x64 NSIS 安装、启动、菜单交互、SVG 文件往返、保存重开：未执行。
- SVG 导入器尚未经过真实浏览器 DOMParser 及复杂文件兼容测试。

## 本轮代码变更

- 恢复交互式顶部菜单和基础菜单动作。
- 接入 YGS 新建/打开/保存、SVG 导入/导出、画布大小、文字对象创建、对象对齐与分布。
- 新增 `src/io/svg.ts`，仅覆盖 README 所列 SVG 元素和 path 指令子集。
- 未实现功能均禁用并标注原因。
- `package.json`、Tauri 配置及 YGS 文档 appVersion 更新为 `1.1.1-alpha`。
