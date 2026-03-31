export interface StoryboardRow {
  id: string;
  index: number;
  shotType: string;
  description: string;
  sourceSegment?: string; // 对应的原文段落文本，用于 diff 映射
}

// ── 剧本拆解 ─────────────────────────────────────────
export async function breakdownScript(scriptText: string): Promise<StoryboardRow[]> {
  const res = await fetch('/api/breakdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script: scriptText }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(err.error || `API 错误 ${res.status}`);
  }

  const { scenes } = await res.json() as { scenes: StoryboardRow[] };
  return scenes;
}

// ── AI 提示词对话 ────────────────────────────────────
export async function chatForPrompt(
  shotDescription: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const systemPrompt = `你是专业的AI图片提示词工程师。根据以下镜头描述和用户需求，生成适合AI图片生成的英文提示词。镜头描述：${shotDescription}`;

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(err.error || `API 错误 ${res.status}`);
  }

  const { content } = await res.json() as { content: string };
  return content;
}

// ── 文本生成（DeepSeek）──────────────────────────────
export async function generateText(prompt: string): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(err.error || `API 错误 ${res.status}`);
  }

  const { content } = await res.json() as { content: string };
  return content;
}

// ── 图生文（图片分析生成提示词）──────────────────────
export async function analyzeImageToPrompt(image: string): Promise<string> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(err.error || `API 错误 ${res.status}`);
  }

  const { prompt } = await res.json() as { prompt: string };
  return prompt;
}

// ── 视频生成 ─────────────────────────────────────────
export async function generateVideo(
  prompt: string,
  referenceImage?: string,
  duration: number = 5,
  audio: 'on' | 'off' = 'on',
  resolution: '480p' | '720p' | '1080p' = '720p',
  ratio: '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9' = '16:9'
): Promise<string[]> {
  const res = await fetch('/api/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      duration,
      audio,
      resolution,
      ratio,
      ...(referenceImage ? { referenceImage } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(err.error || `API 错误 ${res.status}`);
  }

  const { urls } = await res.json() as { urls: string[] };
  return urls;
}

// ── 图片生成 ─────────────────────────────────────────
export async function generateImages(
  prompt: string,
  count: number,
  ratio: string,
  referenceImages?: string | string[],
  quality: string = '2K'
): Promise<string[]> {
  const images = referenceImages
    ? (Array.isArray(referenceImages) ? referenceImages : [referenceImages])
    : [];
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      count,
      ratio,
      quality,
      ...(images.length > 0 ? { referenceImages: images } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(err.error || `API 错误 ${res.status}`);
  }

  const { urls } = await res.json() as { urls: string[] };
  return urls;
}
