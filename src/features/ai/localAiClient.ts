export type LocalAiTask = "repair" | "remove" | "expand" | "generate" | "upscale";
export const DEFAULT_LOCAL_AI_URL = "http://127.0.0.1:8765";
export type LocalAiHealth = { ok: boolean; service: string; device: string; cuda_available: boolean; loaded_models: string[]; operations: LocalAiTask[] };

export async function checkLocalAi(baseUrl = DEFAULT_LOCAL_AI_URL): Promise<LocalAiHealth> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(2500) });
  if (!response.ok) throw new Error(`本地 AI 服务返回 HTTP ${response.status}`);
  return response.json() as Promise<LocalAiHealth>;
}

export async function runLocalAi(task: LocalAiTask, data: { image?: File | null; mask?: File | null; prompt?: string; negativePrompt?: string; strength?: number; steps?: number; guidance?: number; scale?: number; width?: number; height?: number }, baseUrl = DEFAULT_LOCAL_AI_URL, onProgress?: (value: number) => void): Promise<Blob> {
  const form = new FormData();
  if (data.image) form.append("image", data.image);
  if (data.mask) form.append("mask", data.mask);
  form.append("prompt", data.prompt ?? "");
  form.append("negative_prompt", data.negativePrompt ?? "");
  form.append("strength", String(data.strength ?? 0.85));
  form.append("steps", String(data.steps ?? 30));
  form.append("guidance", String(data.guidance ?? 7));
  form.append("scale", String(data.scale ?? 4));
  form.append("width", String(data.width ?? 1024));
  form.append("height", String(data.height ?? 1024));
  onProgress?.(5);
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/tasks/${task}`, { method: "POST", body: form });
  if (!response.ok) {
    let message = `AI 任务失败：HTTP ${response.status}`;
    try { const body = await response.json(); message = body.detail || message; } catch { /* keep HTTP fallback */ }
    throw new Error(message);
  }
  const blob = await response.blob();
  if (!blob.type.includes("image/")) throw new Error("本地 AI 服务未返回有效图像");
  onProgress?.(100);
  return blob;
}
