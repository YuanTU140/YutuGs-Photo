# YutuGs-Photo 1.1.15-alpha

## 导出色彩模式
- 新增统一导出设置窗口，可选择 RGB 或 CMYK。
- RGB 导出沿用现有 SVG、PNG、JPG、PSD、PDF、EPS 导出器。
- CMYK 导出要求用户提供印厂 CMYK ICC/ICM，并通过本地 LittleCMS 印前服务执行 ICC 转换、黑点补偿和总墨量限制。
- 新增 CMYK JPG、PSD v1（单一合成层）、PDF（单页 CMYK JPEG 图像）、EPS Level 2（四通道 CMYK 位图）及 TIFF 输出。
- PSD 写入 CMYK 图像模式与 ICC 配置文件资源；CMYK PNG/SVG 不提供伪 CMYK 输出，界面明确提示改用 RGB。
- YGS 仍是唯一原生工程保存格式，导出不会覆盖或改变 YGS 工程。

## 已知限制
- CMYK 输出当前为画板栅格化结果；不保留原生矢量、PSD 多图层、可编辑文字或 PDF/X 印前对象。
- CMYK 导出需要先启动 `local-print-service`，并选择与印刷设备、纸张匹配的 ICC 配置文件。
- AI 与 CDR 原生编码器仍未实现；本版不伪造 AI/CDR 文件。
- 本次环境缺少完整 `node_modules`，TypeScript/build 无法完整验证；Python 印前服务语法检查及 CMYK JPG/PSD/PDF/EPS/TIFF 编码器实测通过。
