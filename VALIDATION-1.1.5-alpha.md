# 1.1.5-alpha 验证记录

## 本轮已执行
- `src/App.tsx`、`src/core/model.ts` 使用 TypeScript 5.8.3 `transpileModule` 进行 JSX/TS 语法转译检查：0 diagnostics。
- 核心 TypeScript 严格检查：
  `tsc --noEmit --strict --noUnusedLocals --noUnusedParameters --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM src/core/*.ts`：通过。
- 对 1.1.4-alpha 源码 ZIP 做了前置基线核验：SHA-256 为 `5598d5ab0817f7f90cf98de3abea66e65f1fdcf5e14f0b9401815035c5e96ed9`，`unzip -t` 通过。

## 未执行 / 环境限制
- 本轮 `npm install --ignore-scripts --no-audit --no-fund` 在执行环境中超时，未安装依赖；因此未执行完整 React 类型检查、Vite production build、Vitest 全量测试。
- 未执行 Cargo/Tauri 编译、Windows NSIS/MSI 安装包构建和桌面实机交互。
- 菜单和快捷键审计是源码级核对，不等于 Windows 实机逐项验收。
- 新建文档的 `documentSetup` 持久化测试已加入 `tests/core.test.ts`，但由于 Vitest 依赖未安装，本轮未运行该测试。

## 功能真实性边界
- 新建文档设置中位深、像素长宽比、出血、栅格效果、叠印预览、像素网格选项目前为元数据配置；对应完整编辑/印前内核未实现。
- 当前新建的画板由 SVG 对象内核承载，不是原生 Photoshop 位图文档或 Illustrator AI 文件。
- 另存为仅支持 YGS；图像大小/重采样、打印、关闭全部、多文档管理和桌面退出命令仍未实现。
- 剪切/复制/粘贴使用应用内部对象剪贴板，不等同系统剪贴板或跨应用剪贴板。
- 未引入 Canvas 2D API 或 Canvas 2D 编辑流程。
