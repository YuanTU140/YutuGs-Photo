import { useEffect, useState } from 'react';
import './print-color.css';

type PrintSettings = { renderingIntent: 'perceptual'|'relative-colorimetric'|'saturation'|'absolute-colorimetric'; blackPointCompensation: boolean; totalInkLimit: number };
type SpotInk = { id: string; name: string; color: string; kind: 'spot'|'process' };
type Props = { svg: string; spotInks: SpotInk[]; fileName: string; onClose: () => void; initialSettings?: PrintSettings; onProfileReady?: (profile: ProfileInfo) => void; onSettingsChange?: (settings: PrintSettings) => void };
type ProfileInfo = { description: string; color_space: string; connection_space: string; manufacturer: string; model: string; sha256: string; bytes: number };
const DEFAULT_SERVICE = 'http://127.0.0.1:8766';

export default function PrintColorWorkspace({ svg, spotInks, fileName, onClose, initialSettings, onProfileReady, onSettingsChange }: Props) {
  const [service, setService] = useState(DEFAULT_SERVICE);
  const [online, setOnline] = useState(false);
  const [profile, setProfile] = useState<File | null>(null);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);
  const [intent, setIntent] = useState<PrintSettings['renderingIntent']>(initialSettings?.renderingIntent ?? 'relative-colorimetric');
  const [tac, setTac] = useState(initialSettings?.totalInkLimit ?? 300);
  const [dpi, setDpi] = useState(300);
  const [bpc, setBpc] = useState(initialSettings?.blackPointCompensation ?? true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('请加载印厂提供的 CMYK ICC/ICM 输出配置文件。');
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const checkService = async () => {
    try {
      const response = await fetch(`${service.replace(/\/$/, '')}/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const info = await response.json();
      setOnline(true);
      setMessage(`服务正常：${info.engine} · ${info.version}`);
    } catch (error) {
      setOnline(false);
      setMessage(`无法连接本地印前服务：${error instanceof Error ? error.message : String(error)}。请先按 local-print-service/README.md 启动服务。`);
    }
  };
  useEffect(() => { void checkService(); }, []);
  useEffect(() => () => { if (proofPreview) URL.revokeObjectURL(proofPreview); }, [proofPreview]);

  const inspectProfile = async (file: File | null) => {
    setProfile(file); setProfileInfo(null);
    if (!file) return;
    try {
      const body = new FormData(); body.append('profile', file);
      const response = await fetch(`${service.replace(/\/$/, '')}/v1/profiles/inspect`, { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? `HTTP ${response.status}`);
      if (result.color_space !== 'CMYK') throw new Error(`该配置文件色彩空间为 ${result.color_space}，需要 CMYK 输出配置文件`);
      setProfileInfo(result); onProfileReady?.(result); setMessage(`已载入：${result.description} · ${result.color_space} · SHA-256 ${result.sha256.slice(0, 16)}…`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };

  const previewSoftProof = async () => {
    if (!profile || !profileInfo || !online) return;
    onSettingsChange?.({ renderingIntent: intent as PrintSettings['renderingIntent'], blackPointCompensation: bpc, totalInkLimit: tac });
    setBusy(true); setMessage('正在执行 ICC 软打样预览…');
    try {
      const body = new FormData(); body.append('artwork', new Blob([buildProcessOnlySvg()], { type: 'image/svg+xml' }), `${fileName}-工艺四色预览.svg`); body.append('proof_profile', profile, profile.name); body.append('intent', intent); body.append('proof_intent', 'absolute-colorimetric'); body.append('black_point_compensation', String(bpc)); body.append('dpi', String(Math.min(dpi, 150)));
      const response = await fetch(`${service.replace(/\/$/, '')}/v1/soft-proof/svg`, { method: 'POST', body });
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.detail ?? `软打样失败：HTTP ${response.status}`); }
      const next = URL.createObjectURL(await response.blob()); setProofPreview(old => { if (old) URL.revokeObjectURL(old); return next; }); setMessage('软打样预览已生成。此预览用于屏幕模拟，不替代实体打样。');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };

  const buildProcessOnlySvg = () => {
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (parsed.querySelector('parsererror')) throw new Error('当前画板 SVG 无法解析');
    parsed.querySelectorAll('[data-spot-ink]').forEach(node => node.setAttribute('display', 'none'));
    return new XMLSerializer().serializeToString(parsed);
  };

  const exportSeparations = async () => {
    if (!profile || !profileInfo || !online) return;
    onSettingsChange?.({ renderingIntent: intent, blackPointCompensation: bpc, totalInkLimit: tac });
    setBusy(true); setMessage('正在栅格化画板并执行 ICC 转换、TAC 检查和四色分色…');
    try {
      const body = new FormData();
      body.append('artwork', new Blob([buildProcessOnlySvg()], { type: 'image/svg+xml' }), `${fileName}-CMYK-process-only.svg`);
      body.append('output_profile', profile, profile.name);
      body.append('intent', intent); body.append('black_point_compensation', String(bpc));
      body.append('total_ink_limit', String(tac)); body.append('dpi', String(dpi));
      const response = await fetch(`${service.replace(/\/$/, '')}/v1/separations/svg`, { method: 'POST', body });
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.detail ?? `分色失败：HTTP ${response.status}`); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${fileName}-CMYK-四色分色.zip`; anchor.click(); URL.revokeObjectURL(url);
      const maxTac = response.headers.get('X-YutuGs-TAC-Max-Before'); const afterTac = response.headers.get('X-YutuGs-TAC-Max-After');
      setMessage(`分色文件已生成。最高总墨量：限制前 ${maxTac ?? '未知'}%，处理后 ${afterTac ?? '未知'}%（目标 ${tac}%）。请检查分色报告并与印厂确认。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };

  const exportSpotPlate = (ink: SpotInk) => {
    try {
      const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
      if (parsed.querySelector('parsererror')) throw new Error('当前画板 SVG 无法解析');
      const root = parsed.documentElement;
      root.querySelectorAll('[data-object-id]').forEach(node => {
        if (node.getAttribute('data-spot-ink') !== ink.id) node.setAttribute('display', 'none');
        else { node.setAttribute('fill', 'black'); if (node.hasAttribute('stroke')) node.setAttribute('stroke', 'black'); }
      });
      const bg = root.querySelector(':scope > rect'); if (bg) bg.setAttribute('fill', 'none');
      root.setAttribute('data-plate-name', ink.name);
      const content = new XMLSerializer().serializeToString(parsed);
      const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${fileName}-专色版-${ink.name}.svg`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (error) { setMessage(`专色版导出失败：${error instanceof Error ? error.message : String(error)}`); }
  };

  return <div className="print-workspace-backdrop"><section className="print-workspace">
    <header><div><b>CMYK 色彩管理与印刷分色</b><small>LittleCMS · ICC 色彩管理 · 本地印前服务</small></div><button onClick={onClose}>关闭</button></header>
    <div className="print-service-row"><span className={online ? 'service-dot online' : 'service-dot'} />{online ? '本地印前服务已连接' : '本地印前服务未连接'}<input value={service} onChange={e => setService(e.target.value)} aria-label="本地印前服务地址"/><button onClick={() => void checkService()}>检查连接</button></div>
    <div className="print-profile-block"><h3>输出 ICC 配置文件</h3><p>必须选择与实际印刷设备、纸张和油墨匹配的输出配置文件，例如印厂提供的 FOGRA、GRACoL 或专用 ICC。不要把通用 CMYK 配置当成印厂配置。</p><label className="print-file-picker">选择 CMYK ICC/ICM 文件<input type="file" accept=".icc,.icm,application/vnd.iccprofile" onChange={e => void inspectProfile(e.target.files?.[0] ?? null)}/></label>
      {profileInfo && <div className="print-profile-card"><b>{profileInfo.description}</b><span>色彩空间：{profileInfo.color_space} → {profileInfo.connection_space}</span><span>文件：{profile?.name} · {(profileInfo.bytes / 1024).toFixed(1)} KB</span><code>SHA-256：{profileInfo.sha256}</code></div>}
    </div>
    <div className="print-settings"><label>渲染意图<select value={intent} onChange={e => setIntent(e.target.value as PrintSettings['renderingIntent'])}><option value="perceptual">感知</option><option value="relative-colorimetric">相对比色</option><option value="saturation">饱和度</option><option value="absolute-colorimetric">绝对比色</option></select></label><label>总墨量上限（TAC %）<input type="number" min="100" max="400" value={tac} onChange={e => setTac(Math.max(100, Math.min(400, Number(e.target.value) || 300)))}/></label><label>输出分辨率（DPI）<input type="number" min="72" max="2400" value={dpi} onChange={e => setDpi(Math.max(72, Math.min(2400, Number(e.target.value) || 300)))}/></label><label className="print-checkbox"><input type="checkbox" checked={bpc} onChange={e => setBpc(e.target.checked)}/> 黑点补偿</label></div>
    {proofPreview && <div className="print-proof-preview"><b>ICC 软打样预览</b><img src={proofPreview} alt="CMYK ICC 软打样"/><small>屏幕显示仍受显示器自身 ICC 配置和环境光影响。</small></div>}
    <div className="print-output-list"><b>导出内容</b><span>CMYK 工艺四色合成 TIFF（已排除独立标记的专色对象）</span><span>青版 C / 品红版 M / 黄版 Y / 黑版 K（独立灰度 TIFF）</span><span>分色报告 JSON、输出 ICC 配置文件副本</span></div>
    <div className="print-output-list"><b>专色矢量分版</b>{spotInks.length===0?<span>尚未建立专色色板。请先关闭本窗口，在右侧“专色与标色”中添加专色并给对象标色。</span>:spotInks.map(ink=><div key={ink.id} className="print-spot-row"><span style={{display:'inline-block',width:14,height:14,background:ink.color,border:'1px solid #888'}}/><span>{ink.name}</span><button onClick={()=>exportSpotPlate(ink)}>导出该专色 SVG 版</button></div>)}<small>每个专色版保持矢量对象与画板尺寸；未标记对象会从该专色版隐藏。请在制版前检查叠印、陷印和对象完整性。</small></div>
    <div className="print-warning"><b>重要印前限制</b><p>CMYK 四色版当前由 SVG 栅格化后进行 ICC 转换生成；专色版可另行导出独立矢量 SVG。当前仍不生成 PDF/X 原生专色对象、陷印和 RIP 网点参数。TAC 限制采用保黑比例缩减 CMY，不等同于印厂 DeviceLink ICC 的专业黑版生成策略。正式制版前必须核对分色报告并由印厂打样确认。</p></div>
    <footer><span>{message}</span><div className="print-footer-actions"><button disabled={!online || !profileInfo || busy} onClick={() => void previewSoftProof()}>软打样预览</button><button disabled={!online || !profileInfo || busy} onClick={() => void exportSeparations()}>{busy ? '正在处理…' : '导出 CMYK 四色分色'}</button></div></footer>
  </section></div>;
}
