import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Sparkles, ImagePlus, WandSparkles, Eraser, Expand, ScanFace, Settings2, ShieldCheck, AlertCircle, Download, RefreshCw, Cpu, LoaderCircle } from "lucide-react";
import { checkLocalAi, DEFAULT_LOCAL_AI_URL, runLocalAi, type LocalAiHealth, type LocalAiTask } from "./localAiClient";
import "./ai-workspace.css";

type AiTask = LocalAiTask;
const tasks: { id: AiTask; title: string; detail: string; icon: typeof Sparkles }[] = [
  { id: "repair", title: "图像修复", detail: "根据蒙版修复划痕、污损、破损与老照片缺陷", icon: WandSparkles },
  { id: "remove", title: "智能移除", detail: "移除蒙版区域对象并智能补全背景", icon: Eraser },
  { id: "expand", title: "智能扩展", detail: "向画布外扩展图像与构图", icon: Expand },
  { id: "generate", title: "AI 生图", detail: "根据文字描述生成图像素材", icon: Sparkles },
  { id: "upscale", title: "超清放大", detail: "使用 RealESRGAN 提升分辨率与细节", icon: ScanFace },
];

export default function AiWorkspace({ onBack, onApply }: { onBack: () => void; onApply?: (image: Blob) => void }) {
  const [task, setTask] = useState<AiTask>("generate");
  const [prompt, setPrompt] = useState("为农业肥料包装设计生成高品质、真实自然的田园背景，预留清晰的文字排版空间");
  const [negativePrompt, setNegativePrompt] = useState("模糊，低质量，文字，水印，畸形");
  const [reference, setReference] = useState<File | null>(null);
  const [mask, setMask] = useState<File | null>(null);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceUrl, setServiceUrl] = useState(DEFAULT_LOCAL_AI_URL);
  const [health, setHealth] = useState<LocalAiHealth | null>(null);
  const [serviceError, setServiceError] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState("yutugs-ai-result.png");
  const [steps, setSteps] = useState("30");
  const [scale, setScale] = useState("4");
  const [width, setWidth] = useState("1024");
  const [height, setHeight] = useState("1024");
  const fileRef = useRef<HTMLInputElement>(null);
  const maskRef = useRef<HTMLInputElement>(null);
  const activeTask = tasks.find((item) => item.id === task)!;
  const needsImage = task !== "generate";
  const needsMask = task === "repair" || task === "remove";

  async function refreshHealth() {
    try { const status = await checkLocalAi(serviceUrl); setHealth(status); setServiceError(""); }
    catch (error) { setHealth(null); setServiceError(error instanceof Error ? error.message : "无法连接本地 AI 服务"); }
  }
  useEffect(() => { void refreshHealth(); const timer = window.setInterval(() => void refreshHealth(), 10000); return () => window.clearInterval(timer); }, [serviceUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  async function execute() {
    if (needsImage && !reference) { setServiceError("请先选择要处理的原始图像。"); return; }
    if (needsMask && !mask) { setServiceError("此任务需要蒙版图像：白色区域表示需要 AI 重绘的范围，黑色区域表示保留。"); return; }
    setRunning(true); setProgress(0); setServiceError("");
    try {
      const blob = await runLocalAi(task, { image: reference, mask, prompt, negativePrompt, steps: Number(steps), scale: Number(scale), width: Number(width), height: Number(height) }, serviceUrl, setProgress);
      setResultBlob(blob);
      const nextUrl = URL.createObjectURL(blob);
      setResultUrl(old => { if (old) URL.revokeObjectURL(old); return nextUrl; });
      setResultName(`yutugs-${task}-${Date.now()}.png`);
    } catch (error) { setServiceError(error instanceof Error ? error.message : "AI 任务执行失败"); }
    finally { setRunning(false); void refreshHealth(); }
  }

  return <main className="ai-studio">
    <header className="ai-topbar"><div className="ai-brand"><span className="ai-brand-mark"><Sparkles size={19}/></span><div><b>YutuGs <span>AI 智能工作台</span></b><small>独立本地 AI 创作与图像编辑工作区</small></div></div>
      <div className="ai-top-actions"><span className={`ai-status ${health ? "connected" : ""}`}><i/> {health ? `本地模型服务已连接 · ${health.device.toUpperCase()}` : "本地模型服务未连接"}</span><button className="ai-back" onClick={onBack}><ArrowLeft size={15}/> 返回专业设计工作区</button></div>
    </header>
    <div className="ai-layout"><aside className="ai-sidebar"><div className="ai-section-title">AI 编辑工具</div>
      {tasks.map(({ id, title, detail, icon: Icon }) => <button key={id} className={`ai-task ${task === id ? "selected" : ""}`} onClick={() => { setTask(id); setServiceError(""); }}><span><Icon size={18}/></span><div><b>{title}</b><small>{detail}</small></div></button>)}
      <div className="ai-sidebar-foot"><ShieldCheck size={15}/> 默认本机推理；若修改服务地址，图像会发送到该地址</div>
    </aside>
    <section className="ai-main"><div className="ai-heading"><div><div className="ai-eyebrow">YUTUGS 本地智能引擎</div><h1>{activeTask.title}</h1><p>{activeTask.detail}。推理由本机模型服务执行。</p></div><button className="ai-settings" onClick={() => setServiceOpen(v => !v)}><Settings2 size={16}/> 本地服务设置</button></div>
      <div className="ai-work-grid"><section className="ai-card ai-input-card"><div className="ai-card-title">任务参数</div>
        {needsImage && <button className="ai-upload" onClick={() => fileRef.current?.click()}><ImagePlus size={22}/><b>{reference ? reference.name : "选择原始图像"}</b><small>PNG、JPG、WEBP · 默认发送到本机 AI 服务；修改服务地址后将发送到该地址</small></button>}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => setReference(e.target.files?.[0] || null)}/>
        {needsMask && <button className="ai-upload" onClick={() => maskRef.current?.click()}><ImagePlus size={22}/><b>{mask ? mask.name : "选择蒙版图像（必需）"}</b><small>白色区域重绘，黑色区域保留；蒙版尺寸应与原图一致</small></button>}
        <input ref={maskRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => setMask(e.target.files?.[0] || null)}/>
        <label className="ai-label">提示词 / 编辑要求</label><textarea className="ai-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="描述你希望 AI 完成的内容、风格、构图和细节…"/>
        <label className="ai-label">负面提示词</label><textarea className="ai-prompt" rows={2} value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)}/>
        <div className="ai-parameter-row"><label>推理步数</label><select value={steps} onChange={e => setSteps(e.target.value)}><option value="20">20 · 快速</option><option value="30">30 · 平衡</option><option value="40">40 · 精细</option><option value="50">50 · 高质量</option></select></div>
        {task === "upscale" && <div className="ai-parameter-row"><label>放大倍率</label><select value={scale} onChange={e => setScale(e.target.value)}><option value="2">2 倍</option><option value="4">4 倍</option></select></div>}
        {(task === "generate" || task === "expand") && <><div className="ai-parameter-row"><label>输出宽度</label><input type="number" min="512" max="2048" step="64" value={width} onChange={e => setWidth(e.target.value)}/></div><div className="ai-parameter-row"><label>输出高度</label><input type="number" min="512" max="2048" step="64" value={height} onChange={e => setHeight(e.target.value)}/></div></>}
        <button className="ai-run" disabled={running || !health} onClick={() => void execute()}>{running ? <LoaderCircle size={17} className="ai-spin"/> : <Sparkles size={17}/>} {running ? `本机推理中 ${progress}%` : `开始 AI ${activeTask.title}`}</button>
        {running && <div className="ai-progress"><span style={{ width: `${progress}%` }}/></div>}
        {serviceError && <div className="ai-disabled-note"><AlertCircle size={15}/>{serviceError}</div>}
        {!health && <div className="ai-disabled-note"><AlertCircle size={15}/> 本地服务未连接。请先按 local-ai-service/README.md 安装并启动模型服务。</div>}
      </section>
      <section className="ai-card ai-preview-card"><div className="ai-card-title">结果预览</div><div className={`ai-preview ${resultUrl ? "has-result" : ""}`}>{resultUrl ? <img src={resultUrl} alt="AI 处理结果"/> : <><div className="ai-preview-icon"><Sparkles size={34}/></div><b>AI 结果将在这里显示</b><span>执行本地模型任务后显示真实结果</span></>}</div>
        {resultUrl && <div className="ai-result-actions"><a href={resultUrl} download={resultName}><Download size={15}/> 导出 PNG</a>{onApply && <button onClick={() => resultBlob && onApply(resultBlob)}>添加到当前文档为新图层</button>}<button onClick={() => { URL.revokeObjectURL(resultUrl); setResultUrl(""); setResultBlob(null); }}>清除预览</button></div>}
        <div className="ai-result-meta"><Cpu size={14}/> {health ? `运行设备：${health.device} · 已加载模型：${health.loaded_models.length}` : "等待本地模型服务"}</div>
      </section></div>
      {serviceOpen && <section className="ai-card ai-service-card"><div className="ai-card-title">本地模型服务连接</div><label className="ai-label">服务地址</label><input value={serviceUrl} onChange={e => setServiceUrl(e.target.value)} placeholder="http://127.0.0.1:8765"/><div className="ai-result-actions"><button onClick={() => void refreshHealth()}><RefreshCw size={14}/> 测试连接</button></div><p>默认只连接本机 127.0.0.1。模型在首次调用时下载并加载；图像推理在本地执行。修复、移除和扩展需要黑白蒙版。</p><div className="ai-provider-state">连接状态：<b>{health ? `已连接（${health.device}）` : "未连接"}</b></div>{serviceError && <div className="ai-disabled-note">{serviceError}</div>}</section>}
    </section></div>
    <footer className="ai-footer"><span>YUTUGS PHOTO · 本地 AI</span><span>本地模型服务 · 请确认服务地址可信</span><span>{health ? "服务在线" : "服务离线"}</span></footer>
  </main>;
}
