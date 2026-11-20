# alpha.5 验证记录

## 已执行

- `tsc` 全局编译器对 `src/` 与 `tests/` 共 12 个 TypeScript/TSX 文件执行 `transpileModule` 语法转译：通过，无语法诊断。
- Node.js 运行时直接执行 `viewport.ts` 转译产物：平移增量断言通过；鼠标锚点缩放不漂移断言通过。
- Canvas 2D 禁用扫描：`src/` 与 `src-tauri/` 源码未发现 `CanvasRenderingContext2D`、`Path2D`、`toDataURL`、`getImageData`、`putImageData`、`getContext("2d")` 或 `getContext('2d')`。
- alpha.5 ZIP 完整性检查：通过（`ZipFile.testzip()` 无错误）。
- 品牌资源与启动页关键文件：均存在且非空；本轮没有修改其内容。

## 未能执行

- `npm run typecheck`：失败/受环境限制。工程依赖目录 `node_modules` 不存在；全局 TypeScript 因缺少 `react`、`react-dom`、`lucide-react` 类型和模块而无法完成项目级类型检查。`npm install` 网络安装超时；`npm install --offline` 因 npm 缓存没有 `@tauri-apps/api` 而失败。
- `npm test`：未运行成功，Vitest 未安装（`vitest: not found`）。测试代码已补充，但不能据此声称 Vitest 测试通过。
- Rust `cargo check` / `cargo test`：未执行，环境没有 Cargo。
- Tauri / Windows x64 安装包构建与真实交互：未执行，本环境不是 Windows 构建环境，也缺少 Rust 工具链。

## 依赖与许可边界

- 本轮没有增加 npm 或 Rust 依赖，也没有引入商业格式 SDK。
- 现有直接依赖仍为 Tauri 2、React 18、TypeScript、Vite、Vitest、lucide-react；具体传递依赖许可证扫描因未能安装依赖而未完成。
- 不包含 PhotoCraft 或 VectorCraft 运行时依赖；完整供应链/许可证审计仍是后续工作。
