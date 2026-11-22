import { useState } from 'react';
import './export-dialog.css';

type ExportFormat = 'psd'|'pdf'|'eps'|'jpg'|'png'|'svg';
type Props = { svg: string; fileName: string; onClose: () => void; onRgbExport: (format: ExportFormat) => Promise<void>|void };
const SERVICE = 'http://127.0.0.1:8766';

export default function ExportDialog({svg,fileName,onClose,onRgbExport}:Props) {
  const [format,setFormat] = useState<ExportFormat>('pdf');
  const [mode,setMode] = useState<'RGB'|'CMYK'>('RGB');
  const [profile,setProfile] = useState<File|null>(null);
  const [dpi,setDpi] = useState(300);
  const [quality,setQuality] = useState(92);
  const [intent,setIntent] = useState('relative-colorimetric');
  const [bpc,setBpc] = useState(true);
  const [tac,setTac] = useState(300);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('RGB 可直接导出；CMYK 需要连接本地印前服务并加载印厂提供的 ICC 配置文件。');

  const runExport = async () => {
    if (mode === 'RGB') { await onRgbExport(format); onClose(); return; }
    if (format === 'png' || format === 'svg') { setMessage(`${format.toUpperCase()} 标准格式不支持原生 CMYK。请选择 RGB 导出，或改用 CMYK PDF、PSD、EPS、JPG。`); return; }
    if (!profile) { setMessage('请先选择印厂提供的 CMYK ICC/ICM 配置文件。'); return; }
    setBusy(true); setMessage('正在执行 ICC 色彩转换并生成 CMYK 文件…');
    try {
      const body = new FormData();
      body.append('artwork',new Blob([svg],{type:'image/svg+xml'}),`${fileName}.svg`);
      body.append('output_profile',profile,profile.name);
      body.append('format',format); body.append('dpi',String(dpi)); body.append('quality',String(quality));
      body.append('intent',intent); body.append('black_point_compensation',String(bpc)); body.append('total_ink_limit',String(tac));
      const response = await fetch(`${SERVICE}/v1/export/cmyk`,{method:'POST',body});
      if (!response.ok) { const error=await response.json().catch(()=>({})); throw new Error(error.detail ?? `导出失败：HTTP ${response.status}`); }
      const blob=await response.blob(); const url=URL.createObjectURL(blob); const anchor=document.createElement('a');
      anchor.href=url; anchor.download=`${fileName}.${format}`; anchor.click(); window.setTimeout(()=>URL.revokeObjectURL(url),1500);
      const tacAfter=response.headers.get('X-YutuGs-TAC-Max-After');
      setMessage(`CMYK ${format.toUpperCase()} 已导出。输出 ICC：${response.headers.get('X-YutuGs-Output-Profile')??profile.name}；最大总墨量：${tacAfter??'未知'}%。`);
    } catch(error) { setMessage(error instanceof Error?error.message:String(error)); }
    finally { setBusy(false); }
  };

  return <div className="export-dialog-backdrop"><section className="export-dialog" role="dialog" aria-modal="true" aria-label="导出文件设置">
    <header><div><b>导出文件</b><small>原生工程始终保存为 YGS；这里仅生成交付文件</small></div><button onClick={onClose}>关闭</button></header>
    <div className="export-dialog-grid">
      <label>导出格式<select value={format} onChange={e=>setFormat(e.target.value as ExportFormat)}><option value="psd">PSD · Photoshop</option><option value="pdf">PDF · 文档/印刷</option><option value="eps">EPS · PostScript</option><option value="jpg">JPG · JPEG 图像</option><option value="png">PNG · 透明图像</option><option value="svg">SVG · 矢量图形</option></select></label>
      <label>色彩模式<select value={mode} onChange={e=>setMode(e.target.value as 'RGB'|'CMYK')}><option value="RGB">RGB · 屏幕/网页</option><option value="CMYK">CMYK · 印刷</option></select></label>
    </div>
    {mode==='CMYK' ? <>
      <div className="export-note">CMYK 导出会先将当前画板栅格化，再通过 LittleCMS 和指定 ICC 转换。当前 CMYK PSD/PDF/EPS/JPG 为合成图像输出，不保留原生矢量对象或多图层。</div>
      <label className="export-profile">输出 CMYK ICC/ICM 配置文件<input type="file" accept=".icc,.icm,application/vnd.iccprofile" onChange={e=>setProfile(e.target.files?.[0]??null)}/>{profile&&<small>已选择：{profile.name}</small>}</label>
      <div className="export-dialog-grid"><label>分辨率（DPI）<input type="number" min="72" max="2400" value={dpi} onChange={e=>setDpi(Math.max(72,Math.min(2400,Number(e.target.value)||300)))}/></label><label>JPG 质量（%）<input type="number" min="10" max="100" value={quality} onChange={e=>setQuality(Math.max(10,Math.min(100,Number(e.target.value)||92)))}/></label><label>渲染意图<select value={intent} onChange={e=>setIntent(e.target.value)}><option value="perceptual">感知</option><option value="relative-colorimetric">相对比色</option><option value="saturation">饱和度</option><option value="absolute-colorimetric">绝对比色</option></select></label><label>总墨量上限（%）<input type="number" min="100" max="400" value={tac} onChange={e=>setTac(Math.max(100,Math.min(400,Number(e.target.value)||300)))}/></label></div>
      <label className="export-check"><input type="checkbox" checked={bpc} onChange={e=>setBpc(e.target.checked)}/> 启用黑点补偿</label>
      {(format==='png'||format==='svg')&&<div className="export-warning">{format.toUpperCase()} 不支持标准原生 CMYK，将不能按 CMYK 输出。请切换 RGB，或选择 PSD、PDF、EPS、JPG。</div>}
      <div className="export-note">需要先启动项目内的 local-print-service（默认地址 http://127.0.0.1:8766）。CMYK 颜色转换必须使用与印刷设备和纸张匹配的 ICC，不会使用虚构的通用 CMYK 配置。</div>
    </> : <div className="export-note">RGB 导出使用 sRGB/浏览器标准 RGB 管线。PNG 保留透明背景；JPG、PDF、EPS 使用白色背景。当前 PSD/PDF/EPS 导出为单层或合成图像。</div>}
    <div className="export-message" role="status">{message}</div>
    <footer><button onClick={onClose} disabled={busy}>取消</button><button className="export-primary" onClick={()=>void runExport()} disabled={busy||(mode==='CMYK'&&(format==='png'||format==='svg'))}>{busy?'正在导出…':'导出文件'}</button></footer>
  </section></div>;
}
