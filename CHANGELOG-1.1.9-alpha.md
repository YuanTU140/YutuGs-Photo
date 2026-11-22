# YutuGs-Photo 1.1.9-alpha

## 构建与类型检查修复

- 修复 `src/App.tsx` 中变换手柄联合类型未正确收窄的问题：新增 `ProjectiveHandle` 类型和 `isProjectiveHandle` 类型守卫，确保透视角点手柄不会被误传给只接受普通变换手柄的 `createInteractiveTransform`。
- 新增 `scripts/check-conflict-markers.mjs`，在类型检查和生产构建前扫描未解决的 Git 合并冲突标记。
- `npm run typecheck` 与 `npm run build` 均先执行冲突标记检查，避免 `<<<<<<<`、`=======`、`>>>>>>>` 再次进入构建。
- 保留 1.1.8-alpha 的图层堆栈排序、撤销/重做及其他既有功能。
