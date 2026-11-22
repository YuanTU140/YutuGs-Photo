# YutuGs-Photo

**版本：1.1.9-alpha**  
**交付类型：完整源码替换包**

本版本延续 alpha.4 演进代码线，以 `1.1.8-alpha` 为本轮代码基线；0.4.9 工程只作菜单、功能和交互行为对照，不作代码开发基线。每次交付均为完整源码替换包。

## 1.1.9-alpha 本轮更新：图层堆栈顺序管理

- 图层面板新增上移/下移控制，顺序与 SVG 实际绘制堆栈一致：上移会将图层置于更高层级，下移会置于更低层级。
- 新增 `layer.reorder` 文档命令，限定在所属画板内调整图层顺序，并纳入统一撤销/重做历史。
- 对无效画板、跨画板图层和越界索引执行明确校验；不改变图层对象归属、图层属性或画板其他内容。
- 本轮只补齐图层堆栈排序，不代表已完成图层分组、拖拽排序、跨画板移动或完整混合模式。

## 1.1.7-alpha 本轮更新：SVG 画板渲染参数修正

- `SvgArtboard.tsx` 的 `pathData` 增加可选 `_id?: string` 参数，并在对象路径与橡皮擦蒙版路径调用时传入对应对象 ID。
- `filterMarkup` 中高斯模糊半径、亮度斜率和色相旋转值统一显式转换为字符串，避免 SVG 数值属性序列化类型不一致。
- `adjustmentFilter` 中模糊半径、亮度/对比度斜率与截距、色相旋转值统一显式转换为字符串。
- 保留 1.1.5-alpha 已有的 `previewProjectives`、透视矩阵 SVG 渲染和 `transformMode` 控制，不以用户提供的基础片段覆盖这些已有能力。
- 本次仅修正 SVG 渲染器参数与调用，不宣称新增滤镜种类或完整图像滤镜内核。


## 1.1.5-alpha 本轮更新：菜单与新建文档纠正

- 以 1.1.4-alpha 为唯一代码起点，针对顶部全部 12 个菜单、工具区、属性区、工作区按钮和快捷键进行逐项盘点；详细状态见 `MENU_SHORTCUT_AUDIT-1.1.5-alpha.md`。
- 重做新建文档参数界面：Photoshop 风格图像文档设置与 Illustrator 风格矢量/画板文档设置分开呈现；增加 Photo、Print、Art & Illustration、Web、Mobile、Film & Video 分类及用途预设。
- 新建参数增加方向、单位、PPI、颜色模式、位深、颜色配置名称、像素长宽比；Illustrator 设置增加画板数量/列数/间距、四边出血、栅格效果分辨率、预览模式和像素网格选项。多画板按行列间距初始化。
- 新建参数写入 YGS v2 `documentSetup` 并随文档保存。注意：位深、像素长宽比、出血、栅格效果、叠印预览和像素网格目前属于文档设置元数据，不表示对应的完整像素/印前内核已经实现。
- 编辑菜单新增内部对象剪切/复制/粘贴、重复；新增 Ctrl/Cmd+X/C/V/D、Ctrl/Cmd+Shift+S、Ctrl/Cmd+Shift+A、Ctrl/Cmd+0 等快捷键。
- 另存为当前仅支持另存 YGS；图像大小/重采样、打开为、打印、多文档关闭和桌面退出仍明确禁用，不伪装成可用功能。
- 滤镜菜单修正为支持多选矢量对象，并拒绝无效数值；图像对象滤镜仍未实现。
- 版本号更新为 1.1.5-alpha。

## 1.1.4-alpha 本轮更新

### 选择工具与变换

- **自由变换**：选择对象后拖动对象移动；拖动八个控制点缩放；顶部旋转手柄旋转。支持多对象同时变换、预览、撤销/重做和 YGS 持久化。
- **旋转/斜切/翻转**：属性面板提供 ±15°、自定义旋转、水平/垂直斜切和水平/垂直翻转；围绕所选对象组中心执行矩阵变换。
- **透视/扭曲**：切换模式后拖动四角，使用 3×3 单应矩阵执行项目变换。透视模式采用对角角点联动；扭曲模式四角独立。变换应用于矢量和图像对象，命中测试与边界计算纳入投影矩阵，矩阵写入 YGS 并可撤销/重做。
- **尚未实现**：Photoshop 式自由网格 Warp、任意控制网格/网格节点、操控变形、内容识别变形；透视/扭曲对象的印前 SVG 栅格化目前由印前服务明确拒绝，避免错误输出。

### ICC 色彩管理与 CMYK 印前工作流

新增 `local-print-service/`，通过 Pillow ImageCms 调用 **LittleCMS**，而不是用简化 RGB→CMYK 公式：

- ICC/ICM 配置文件解析、色彩空间检查、配置文件描述与 SHA-256 识别。
- 使用用户提供的 CMYK 输出 ICC 执行 RGB→CMYK 色彩转换，支持感知、相对比色、饱和度、绝对比色四种渲染意图及黑点补偿。
- ICC 软打样预览，生成带 sRGB 配置的屏幕预览 PNG。
- SVG 按指定 DPI 栅格化，输出嵌入输出 ICC 的 CMYK TIFF 合成图，以及 Cyan、Magenta、Yellow、Black 四张独立灰度 TIFF 分色版。
- 生成 JSON 分色报告，记录 ICC 描述、SHA-256、DPI、渲染意图、TAC 统计和处理限制。
- TAC 限制采用保留 K 版并按比例缩减 CMY 的通用后处理；该算法不是印厂 DeviceLink ICC 的专业黑版生成方案。
- YGS 文档保存工作 RGB 配置名称、输出 CMYK 配置描述/SHA-256、渲染意图、黑点补偿和 TAC 设置。ICC 文件本身由用户保管并在印前工作区加载，不嵌入 YGS。

**启动印前服务**（需单独安装 Python 依赖）：

```powershell
cd local-print-service
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8766
```

应用内选择“文件 → CMYK 印刷分色”，连接本地服务，加载印厂提供的 CMYK ICC/ICM 配置文件，再执行软打样或导出四色分色 ZIP。Tauri 安装配置会将印前服务脚本和启动批处理作为资源打包；目标 Windows 电脑仍需安装 Python 3、服务依赖，以及 CairoSVG 所需的 Cairo 运行库。

### CMYK 能力边界（不得误解为完整 RIP）

- 编辑器内部矢量颜色和 SVG 实时预览仍以 RGB/CSS 色彩显示；本轮完成的是基于 ICC 的印前转换/软打样/四色栅格分色工作流，不是全编辑器原生 CMYK 颜色空间。
- 分色以当前画板 SVG 栅格化图像为输入，默认按 sRGB 源处理；SVG 内嵌图像的独立 ICC 源配置和复杂滤镜一致性尚未完成。不保留可编辑 PDF/X 矢量对象、专色/专金色通道、白墨、烫金、陷印、网点角度、网花、RIP 参数和透明度对象。
- 透视/扭曲对象目前以 CSS `matrix3d` 保存和预览，CairoSVG 印前栅格化器尚不支持；服务会返回 422 明确拒绝，不会静默生成错误分色。
- TAC 限制不是 DeviceLink。正式印刷必须使用印厂指定的 ICC/DeviceLink、确认总墨量/黑版生成，并进行实体打样和印厂预检。
- ICC 配置文件需由用户/印厂提供并自行确认授权；源码包不捆绑第三方印刷配置文件。

## 延续的 1.1.3-alpha 功能

- SVG 矢量画笔与图层蒙版橡皮擦；钢笔与 Bézier 节点编辑。
- 矢量对象滴管/填充、系统字体选择和文字属性。
- 凸轮廓路径布尔、SVG 滤镜与基础调整图层。
- 多画板并排显示和活动画板切换。
- Photoshop 2026 风格和 Illustrator 2025 风格新建文档双入口。
- AI 工作区、本地 AI 服务、包装模板、YGS v2 文档保存。

## 核心架构与硬性约束

YGS 文档模型 → 对象/图层/画板 → 命令与历史 → 几何/资产 → SVG Renderer。矢量编辑、对象变换和显示由 SVG/YGS 完成；印前 ICC 转换由独立本地 LittleCMS 服务完成。禁止 Canvas 2D 编辑、绘制、擦除、像素处理或合成内核；不得加入 `CanvasRenderingContext2D`、`getContext('2d')`、`Path2D` 编辑流程。PhotoCraft / VectorCraft 不作为运行时依赖。

## 开发

```bash
npm install
npm run typecheck
npm test
npm run build
npm run tauri dev
```

AI 服务位于 `local-ai-service/`，模型权重不随源码包提供。印前服务位于 `local-print-service/`，需独立启动。完整 React/Vite、Rust/Tauri 和 Windows 安装验证情况见 `VALIDATION-1.1.9-alpha.md`。

## 尚未完成

- 原生 CMYK 编辑颜色模型、CMYK 色板/专色与专金色通道、PDF/X-1a/X-4、DeviceLink 分色、陷印、网点/RIP 和印厂完整预检。
- 透视/扭曲的 CairoSVG 印前渲染；任意网格 Warp、操控变形和网格控制柄。
- Photoshop 原生像素画笔、压感/纹理笔刷、像素级橡皮擦和像素洪泛填充。
- 非凸/自交/复杂曲线路径布尔及完整 Pathfinder。
- 多画板跨画板对象操作、独立视口导航和完整 Illustrator 画板工具集。
- PSD、AI、EPS、CDR、PDF 原生可编辑解析与往返验证；不宣称这些格式原生编辑已支持。

## 完整替换说明

解压后以包内 `YutuGs-Photo` 目录整体替换旧工程目录。替换前备份未提交修改。每版同步更新 README、package/Tauri 版本、变更记录、功能迁移矩阵和验证报告。
