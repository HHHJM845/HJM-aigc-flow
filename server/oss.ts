// eslint-disable-next-line @typescript-eslint/no-require-imports
const COS = require('cos-nodejs-sdk-v5');

let _client: InstanceType<typeof COS> | null = null;

function getClient() {
  if (!_client) {
    _client = new COS({
      SecretId: process.env.COS_SECRET_ID || '',
      SecretKey: process.env.COS_SECRET_KEY || '',
    });
  }
  return _client;
}

function getBucket() {
  return process.env.COS_BUCKET || 'hjm-1352978613';
}

function getRegion() {
  return process.env.COS_REGION || 'ap-guangzhou';
}

function cosUrl(key: string): string {
  return `https://${getBucket()}.cos.${getRegion()}.myqcloud.com/${key}`;
}

function putObject(key: string, buffer: Buffer, contentType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getClient().putObject(
      {
        Bucket: getBucket(),
        Region: getRegion(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
      },
      (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

/**
 * 把一个外部 URL 的内容下载后上传到腾讯云 COS，返回永久公开访问链接
 */
export async function uploadUrlToOss(url: string, folder: 'images' | 'videos'): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载资源失败: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const contentType = res.headers.get('content-type') || '';
  const ext = folder === 'videos'
    ? 'mp4'
    : contentType.includes('png') ? 'png' : 'jpg';

  const key = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  await putObject(key, buffer, contentType || (folder === 'videos' ? 'video/mp4' : 'image/jpeg'));
  return cosUrl(key);
}

/**
 * 批量转存多个 URL
 */
export async function uploadUrlsToOss(urls: string[], folder: 'images' | 'videos'): Promise<string[]> {
  return Promise.all(urls.map(url => uploadUrlToOss(url, folder)));
}

/**
 * 把 base64 data URL（data:image/...;base64,...）上传到腾讯云 COS，返回公网 URL
 */
export async function uploadBase64ToOss(dataUrl: string, folder: 'images' | 'videos' = 'images'): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('无效的 base64 data URL');
  const [, mimeType, base64Data] = match;
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const buffer = Buffer.from(base64Data, 'base64');
  const key = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  await putObject(key, buffer, mimeType);
  return cosUrl(key);
}
