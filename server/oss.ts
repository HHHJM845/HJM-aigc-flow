import OSS from 'ali-oss';

let _client: OSS | null = null;

function getClient(): OSS {
  if (!_client) {
    _client = new OSS({
      region: process.env.OSS_REGION || 'oss-cn-shenzhen',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
      bucket: process.env.OSS_BUCKET || 'augc-flow',
    });
  }
  return _client;
}

/**
 * 把一个外部 URL 的内容下载后上传到 OSS，返回永久公开访问链接
 */
export async function uploadUrlToOss(url: string, folder: 'images' | 'videos'): Promise<string> {
  // 下载原始内容
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载资源失败: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  // 根据 Content-Type 决定扩展名
  const contentType = res.headers.get('content-type') || '';
  const ext = folder === 'videos'
    ? 'mp4'
    : contentType.includes('png') ? 'png' : 'jpg';

  const key = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  await getClient().put(key, buffer, {
    headers: { 'Content-Type': contentType || (folder === 'videos' ? 'video/mp4' : 'image/jpeg') },
  });

  const bucket = process.env.OSS_BUCKET || 'augc-flow';
  const region = process.env.OSS_REGION || 'oss-cn-shenzhen';
  return `https://${bucket}.${region}.aliyuncs.com/${key}`;
}

/**
 * 批量转存多个 URL
 */
export async function uploadUrlsToOss(urls: string[], folder: 'images' | 'videos'): Promise<string[]> {
  return Promise.all(urls.map(url => uploadUrlToOss(url, folder)));
}
