# 1.1.10-alpha 验证记录

## CI 失败原因

截图显示 `tests/core.test.ts:210` 的 XOR 面积断言失败：测试期望面积 10000，实际辅助函数计算为 5000。失败用例为两个 100×100 矩形横向重叠 50% 的 `exclude`（对称差/XOR）。

源码中的 `booleanPath(..., 'exclude')` 返回两个独立闭合轮廓：A\B 与 B\A。两个轮廓各自面积 5000，总面积应为 10000。

原测试辅助函数 `pathArea` 错误地把 `geometry.nodes` 中所有节点连成单一环。对多个 `move` 子路径，它把前一个轮廓末尾与下一个轮廓开头当作真实边，导致复合路径面积计算错误。该辅助函数不能正确计算包含多个独立子路径的 SVG/VectorPath。

## 本轮修复

- 将 `pathArea` 改为遍历 `VectorPath.segments`，每遇到 `move` 就开始一个新轮廓。
- 分别计算每个轮廓的鞋带公式面积，再累加绝对面积。
- XOR 测试增加 `move` 段数量断言，要求输出恰好包含两个独立轮廓。
- 保持布尔运算核心实现不变，避免为迎合错误测试而破坏实际几何。

## 验证边界

- 需要在 GitHub Actions / Windows 项目环境运行 `npm test`，确认全部 30 个用例通过。
- 本记录不宣称 Vitest、完整 TypeScript 检查、Vite、Tauri 或 NSIS 已通过。

## 已执行验证
- Git 冲突标记扫描：通过，0 处。
- TS/TSX 语法转译：19 个文件，0 个语法诊断。
- `src/core/pathBoolean.ts` 使用全局 TypeScript 编译为临时 CommonJS：通过。
- 使用实际 `booleanPath` 内核执行两个 100×100、重叠 50% 矩形的 XOR smoke：输出 2 个独立 `move` 轮廓，按轮廓累计面积为 10000。
