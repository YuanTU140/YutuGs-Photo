# 1.1.0-alpha 验证记录

## 已执行并通过

- ZIP 压缩包完整性检查：通过（`unzip -t`）。
- 核心 TypeScript 严格检查：通过，命令为 `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM src/core/*.ts`。
- Canvas 2D 禁用 API 源码扫描：`src` 与 `src-tauri/src` 未发现 `CanvasRenderingContext2D`、`getContext('2d')`、`Path2D`。
- 品牌资源对照 alpha.4：启动页 HTML、品牌图、启动图及 Tauri 图标文件逐字节一致。
- 版本元数据核对：`package.json` 与 `src-tauri/tauri.conf.json` 均为 `1.1.0-alpha`。

## 未执行 / 不能宣称通过

- 完整项目 TypeScript/React 类型检查：未执行；当前包未安装 npm 依赖。
- Vitest 全量测试：未执行。
- Tauri/Rust 检查与构建：未执行。
- Windows x64 NSIS 安装包构建、安装、启动、交互、保存与重开：未执行。
- 分布按钮的真实浏览器/桌面端交互：未执行。分布核心命令有测试源码覆盖，但本次没有运行测试套件。

## 本版修改

- 将已有水平/垂直等间距分布命令接入对象面板按钮。
- 至少选择三个对象时启用分布按钮，少于三个对象时禁用。
- README、功能迁移矩阵、变更记录与版本元数据同步为 `1.1.0-alpha`。
- 按完整源码替换包方式交付，压缩包根目录为 `YutuGs-Photo/`。
