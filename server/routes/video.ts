import { Router } from 'express';
import type { Request } from 'express';
import { uploadBase64ToOss, uploadUrlsToOss } from '../oss.js';

const router = Router();

const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const MODEL = 'doubao-seedance-1-5-pro-251215';
const POLL_INTERVAL = 3000; // ms
const POLL_TIMEOUT = 300000; // 5 min

function buildOrigin(req: Request): string {
  const configured = process.env.PUBLIC_BASE_URL || process.env.APP_PUBLIC_URL || process.env.SERVER_PUBLIC_URL;
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function isValidHttpImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    return isHttp && url.pathname !== '/' && !url.pathname.endsWith('/undefined') && !url.pathname.endsWith('/null');
  } catch {
    return false;
  }
}

async function resolveReferenceImage(referenceImage: string | undefined, origin: string): Promise<string | undefined> {
  const raw = referenceImage?.trim();
  if (!raw) return undefined;

  if (raw.startsWith('data:image/')) {
    return uploadBase64ToOss(raw, 'images');
  }

  const absoluteUrl = raw.startsWith('/uploads/')
    ? `${origin}${raw}`
    : raw;

  if (!isValidHttpImageUrl(absoluteUrl)) {
    console.warn('[video] ignored invalid reference image:', raw.slice(0, 120));
    return undefined;
  }

  if (raw.startsWith('/uploads/') || absoluteUrl.startsWith(origin)) {
    console.warn('[video] ignored local reference image; use OSS upload for image-to-video:', raw.slice(0, 120));
    return undefined;
  }

  return absoluteUrl;
}

router.post('/', async (req, res, next) => {
  try {
    const { prompt, referenceImage, duration = 5, audio = 'on', resolution = '720p', ratio = '16:9' } = req.body as {
      prompt: string;
      referenceImage?: string;
      duration?: number;
      audio?: 'on' | 'off';
      resolution?: '480p' | '720p' | '1080p';
      ratio?: string;
    };
    if (!prompt?.trim()) {
      return res.status(400).json({ error: '请提供提示词' });
    }

    const apiKey = process.env.VIDEO_API_KEY || process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 VIDEO_API_KEY' });

    // 将参数拼接为 Seedance 支持的文本 flags
    const flags = [
      `--duration ${duration}`,
      `--resolution ${resolution}`,
      `--ratio ${ratio}`,
      `--sound_effect ${audio === 'on' ? 'true' : 'false'}`,
    ].join(' ');
    const fullText = `${prompt.trim()} ${flags}`;

    // 构建 content 数组：text 在前，参考图在后
    const content: object[] = [{ type: 'text', text: fullText }];
    const resolvedReferenceImage = await resolveReferenceImage(referenceImage, buildOrigin(req));
    if (resolvedReferenceImage) {
      content.push({ type: 'image_url', image_url: { url: resolvedReferenceImage } });
    }

    // 1. 提交任务
    const submitRes = await fetch(`${ARK_BASE}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODEL, content }),
    });

    if (!submitRes.ok) {
      const text = await submitRes.text();
      console.error('[video] submit failed', submitRes.status, text);
      if (submitRes.status === 403 && text.includes('AccountOverdueError')) {
        return res.status(403).json({ error: '视频生成账号欠费或余额不足，请先处理火山引擎/豆包账户余额。' });
      }
      return res.status(submitRes.status).json({ error: `提交任务失败: ${text}` });
    }

    const { id: taskId } = await submitRes.json() as { id: string };
    if (!taskId) return res.status(502).json({ error: '未获取到任务 ID' });

    // 2. 轮询任务状态
    const deadline = Date.now() + POLL_TIMEOUT;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));

      const pollRes = await fetch(`${ARK_BASE}/contents/generations/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!pollRes.ok) {
        const text = await pollRes.text();
        return res.status(pollRes.status).json({ error: `查询任务失败: ${text}` });
      }

      const task = await pollRes.json() as {
        id: string;
        status: 'queued' | 'running' | 'succeeded' | 'failed';
        content?: unknown;
        error?: { message: string };
      };

      console.log('[video] task status:', task.status, 'content:', JSON.stringify(task.content)?.slice(0, 200));

      if (task.status === 'failed') {
        return res.status(500).json({ error: task.error?.message || '视频生成失败' });
      }

      if (task.status === 'succeeded') {
        // content may be an array or a single object
        const contentArr: { video_url?: string }[] = Array.isArray(task.content)
          ? task.content as { video_url?: string }[]
          : task.content ? [task.content as { video_url?: string }] : [];

        const urls = contentArr
          .map(c => c.video_url)
          .filter((u): u is string => !!u);

        if (urls.length === 0) {
          return res.status(502).json({ error: 'API 未返回视频 URL' });
        }
        // 转存到 OSS，返回永久链接（失败时回退到原始 URL，避免整个流程 500）
        console.log('[video] uploading', urls.length, 'video(s) to OSS...');
        try {
          const ossUrls = await uploadUrlsToOss(urls, 'videos');
          console.log('[video] OSS upload done:', ossUrls);
          return res.json({ urls: ossUrls });
        } catch (ossErr) {
          console.error('[video] OSS upload failed, returning original URL:', ossErr);
          return res.json({ urls });
        }
      }
      // queued / running → 继续轮询
    }

    return res.status(504).json({ error: '视频生成超时（5 分钟）' });
  } catch (err) {
    console.error('[video] route error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: `视频生成异常: ${msg}` });
  }
});

export default router;
