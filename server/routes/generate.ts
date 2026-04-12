import { Router } from 'express';
import { uploadUrlsToOss, uploadBase64ToOss } from '../oss.js';

const router = Router();

const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const MODEL = 'doubao-seedream-4-5-251128';

// Ratio → pixel dimensions at each quality level
// 所有尺寸须 ≥ 3,686,400 像素（API 最低要求）
const SIZE_MAP: Record<string, Record<string, string>> = {
  '1K': {
    '1:1':  '1920x1920', // 3,686,400 px ✓
    '4:3':  '2304x1728', // 3,981,312 px ✓
    '3:4':  '1728x2304', // 3,981,312 px ✓
    '16:9': '2560x1440', // 3,686,400 px ✓
    '9:16': '1440x2560', // 3,686,400 px ✓
    '3:2':  '2400x1600', // 3,840,000 px ✓
    '2:3':  '1600x2400', // 3,840,000 px ✓
    '21:9': '3024x1296', // 3,919,104 px ✓
  },
  '2K': {
    '1:1':  '2048x2048', // 4,194,304 px ✓
    '4:3':  '2560x1920', // 4,915,200 px ✓
    '3:4':  '1920x2560', // 4,915,200 px ✓
    '16:9': '2560x1440', // 3,686,400 px ✓
    '9:16': '1440x2560', // 3,686,400 px ✓
    '3:2':  '2880x1920', // 5,529,600 px ✓
    '2:3':  '1920x2880', // 5,529,600 px ✓
    '21:9': '3360x1440', // 4,838,400 px ✓
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
      // base64 data URL 无法被 API 直接访问，先上传到 OSS 取得公网 URL
      const resolvedRefImages = await Promise.all(
        referenceImages.map(url =>
          url.startsWith('data:') ? uploadBase64ToOss(url) : Promise.resolve(url)
        )
      );
      body.image = resolvedRefImages.length === 1 ? resolvedRefImages[0] : resolvedRefImages;
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
