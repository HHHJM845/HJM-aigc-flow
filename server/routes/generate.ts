import { Router } from 'express';
import { uploadUrlsToOss } from '../oss.js';

const router = Router();

const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const MODEL = 'doubao-seedream-4-5-251128';

// Ratio → pixel dimensions at each quality level
const SIZE_MAP: Record<string, Record<string, string>> = {
  '1K': {
    '1:1': '1024x1024', '4:3': '1024x768',  '3:4': '768x1024',
    '16:9': '1280x720', '9:16': '720x1280',
    '3:2': '1152x768',  '2:3': '768x1152',  '21:9': '1344x576',
  },
  '2K': {
    '1:1': '2048x2048', '4:3': '2048x1536', '3:4': '1536x2048',
    '16:9': '2560x1440', '9:16': '1440x2560',
    '3:2': '2304x1536', '2:3': '1536x2304', '21:9': '2688x1152',
  },
};

router.post('/', async (req, res, next) => {
  try {
    const {
      prompt,
      referenceImages,
      count = 1,
      ratio = '16:9',
      quality = '2K',
    } = req.body as {
      prompt: string;
      referenceImages?: string[];
      count?: number;
      ratio?: string;
      quality?: string;
    };

    if (!prompt?.trim()) return res.status(400).json({ error: '请提供提示词' });

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    const pixelSize = SIZE_MAP[quality]?.[ratio] ?? SIZE_MAP['2K']['16:9'];
    const isMultiple = count > 1;

    const body: Record<string, unknown> = {
      model: MODEL,
      prompt: prompt.trim(),
      response_format: 'url',
      size: pixelSize,
      stream: isMultiple,
      watermark: false,
      sequential_image_generation: isMultiple ? 'auto' : 'disabled',
    };

    if (isMultiple) {
      body.sequential_image_generation_options = { max_images: count };
    }

    if (referenceImages && referenceImages.length > 0) {
      body.image = referenceImages.length === 1 ? referenceImages[0] : referenceImages;
    }

    console.log('[generate] model:', MODEL, 'size:', pixelSize, 'count:', count, 'stream:', isMultiple);

    const upstream = await fetch(`${ARK_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: `图片生成失败: ${text}` });
    }

    const urls: string[] = [];

    if (isMultiple) {
      // SSE stream — parse line by line
      const text = await upstream.text();
      for (const line of text.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (raw === '[DONE]') break;
        try {
          const chunk = JSON.parse(raw) as { data?: { url?: string }[] };
          for (const item of chunk.data ?? []) {
            if (item.url) urls.push(item.url);
          }
        } catch { /* skip malformed line */ }
      }
    } else {
      const json = await upstream.json() as { data?: { url?: string }[] };
      for (const item of json.data ?? []) {
        if (item.url) urls.push(item.url);
      }
    }

    if (urls.length === 0) return res.status(502).json({ error: 'API 未返回图片 URL' });

    // 转存到 OSS，返回永久链接
    console.log('[generate] uploading', urls.length, 'image(s) to OSS...');
    const ossUrls = await uploadUrlsToOss(urls, 'images');
    console.log('[generate] OSS upload done:', ossUrls);
    res.json({ urls: ossUrls });
  } catch (err) {
    next(err);
  }
});

export default router;
