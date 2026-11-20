# YutuGs-Photo 1.1.5-alpha

## 新建文档
- 重构新建文档界面，拆分 Photoshop 风格图像文档设置与 Illustrator 风格矢量/画板文档设置。
- 增加 Photo、Print、Art & Illustration、Web、Mobile、Film & Video 用途分类及常用空白尺寸预设。
- 增加方向、单位、分辨率、颜色模式、位深、颜色配置名称、自定义背景色、像素长宽比、画板布局、四边出血、栅格效果分辨率和预览模式设置。
- 新建设置写入 YGS v2 `documentSetup`，新增持久化测试。

## 菜单与快捷键
- 编辑菜单新增内部剪切、复制、粘贴、重复对象、取消选择。
- 增加 Ctrl/Cmd+Shift+S、Ctrl/Cmd+C/X/V/D、Ctrl/Cmd+Shift+A、Ctrl/Cmd+0。
- 另存为明确限定为 YGS；未完成的打开为、打印、图像重采样、关闭全部和退出继续禁用并说明限制。
- 修正滤镜菜单多选对象处理和数值校验。
- 新增 `MENU_SHORTCUT_AUDIT-1.1.5-alpha.md`，逐项记录菜单、工具、工作区按钮、快捷键和未实现项。

## 兼容与边界
- YGS schema 仍为 v2；新增 `documentSetup` 为可选字段，旧文档不含该字段时仍可读取。
- CMYK、位深、像素长宽比、出血、栅格效果、叠印预览和像素网格设置目前保存为元数据；不宣称已经实现对应完整编辑/印前内核。
- 未引入 Canvas 2D 编辑内核。
