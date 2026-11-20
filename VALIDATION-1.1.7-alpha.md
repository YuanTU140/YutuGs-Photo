# 1.1.7-alpha 验证记录

## 本轮修改
- `tests/core.test.ts` 整理：所有 imports 集中至文件顶部，保留现有测试范围，并保留项目透视、ICC 元数据和新建文档设置测试。
- 路径布尔测试采用面积断言，验证 union/subtract/intersect/exclude 的实际几何结果。

## 已验证
- 使用 TypeScript 5.8.3 的 `transpileModule` 对 `tests/core.test.ts` 执行语法转译检查。
- 源码归档完整性检查（`unzip -t`）。

## 未执行
- 当前源码目录无 `node_modules`，未执行 Vitest。
- 未执行完整 React 类型检查、Vite production build、Rust/Tauri 编译及 Windows 安装包测试。

语法转译通过不代表测试断言已运行；本记录不将未执行项目标记为通过。
