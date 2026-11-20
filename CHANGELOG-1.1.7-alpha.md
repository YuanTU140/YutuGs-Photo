# YutuGs-Photo 1.1.7-alpha

## 测试套件整理
- 更新 `tests/core.test.ts`，统一将 Vitest 与核心模块 imports 放在文件顶部。
- 保留 YGS v2 文档创建、视口变换、历史记录、几何命中测试、选择、对象变换、持久化、分布、图层/参考线、路径布尔、滤镜、调整图层、画笔/橡皮擦/文字持久化测试。
- 保留并覆盖透视矩阵、透视对象历史与 YGS 持久化、ICC 色彩管理元数据、Photoshop/Illustrator 新建文档设置元数据测试。
- 路径布尔测试继续验证实际几何面积，而不只检查节点数量；这是比单纯节点计数更可靠的断言。

## 验证边界
- 已执行 TypeScript TSX/TS 语法转译检查。
- 当前工作环境未安装项目 npm 依赖，Vitest 全量测试、React/Vite 构建及 Tauri 编译未执行。
