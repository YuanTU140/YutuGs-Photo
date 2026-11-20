# alpha.6 验证记录

## 本轮修改
- 基线：已从归档恢复并校验 alpha.4、alpha.5；alpha.5 的 SHA-256 与上轮记录一致。
- 版本：package.json、Cargo.toml 与 YGS 文档 appVersion 更新为 1.0.0-alpha.6。
- 新增水平/垂直等间距分布核心命令；保留首尾对象边界，按变换后边界尺寸计算间隔；可通过现有 history dispatch/undo/redo 管线执行。
- 增加分布核心测试并更新功能迁移矩阵。

## 已验证
- 对 `src/core/model.ts`、`geometry.ts`、`commands.ts`、`history.ts` 执行独立严格 TypeScript 检查：通过。
- 将核心模块编译为 CommonJS 后执行 Node 运行时断言：水平与垂直方向的对象间距相等、首尾边界保持、撤销/重做通过。
- 对 `src/` 与 `tests/` 共 12 个 TS/TSX 文件执行 TypeScript `transpileModule`：0 语法诊断。
- Canvas 2D 禁用 API 扫描：无命中。
- 品牌 PNG 与独立启动页 HTML 均与 alpha.4 字节一致。
- 源码差异仅在 alpha.5 工程上增量修改；未从 0.4.9 复制代码作为基线。
- 本轮未增加依赖。
- ZIP 完整性、源文件语法转译、Canvas 2D 禁用项扫描将在归档后记录实际结果。

## 未验证/未完成
- 当前归档未包含完整 node_modules；`npm run typecheck` 因缺少 react/react-dom/lucide-react 类型与模块而失败。
- Vitest 未安装，`npm test` 无法运行。
- 当前环境无 Cargo/Rust 工具链，未执行 cargo check/test 或 Tauri 构建。
- Windows x64 安装包与真实桌面交互未验证。
- 分布命令尚未接入 UI 菜单/工具栏；不可宣称用户可通过界面调用。
