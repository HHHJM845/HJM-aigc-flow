export interface UploadedFile {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  size: number;
  type: 'image' | 'video';
}

interface UploadOptions {
  fallbackToServer?: boolean;
}

function fileKind(file: File): 'image' | 'video' {
  return file.type.startsWith('video') ? 'video' : 'image';
}

async function uploadViaServer(file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = await response.json().catch(() => ({})) as Partial<UploadedFile> & { error?: string };
  if (!response.ok || !data.url) {
    throw new Error(data.error || `上传失败：HTTP ${response.status}`);
  }

  return {
    id: data.id || `${Date.now()}`,
    url: data.url,
    filename: data.filename || file.name,
    originalName: data.originalName || file.name,
    size: data.size || file.size,
    type: data.type || fileKind(file),
  };
}

export async function uploadFile(file: File, options: UploadOptions = {}): Promise<UploadedFile> {
  const fallbackToServer = options.fallbackToServer ?? file.size <= 1024 * 1024;

  try {
    const params = new URLSearchParams({
      filename: file.name,
      type: file.type || 'application/octet-stream',
      size: String(file.size),
    });
    const policyResponse = await fetch(`/api/upload/oss-policy?${params}`);
    const policy = await policyResponse.json().catch(() => ({})) as {
      host?: string;
      key?: string;
      url?: string;
      fields?: Record<string, string>;
      error?: string;
    };

    if (!policyResponse.ok || !policy.host || !policy.key || !policy.url || !policy.fields) {
      throw new Error(policy.error || 'OSS 直传签名不可用');
    }

    const formData = new FormData();
    Object.entries(policy.fields).forEach(([key, value]) => formData.append(key, value));
    formData.append('file', file);

    const uploadResponse = await fetch(policy.host, { method: 'POST', body: formData });
    if (!uploadResponse.ok) {
      throw new Error(`OSS 上传失败：HTTP ${uploadResponse.status}`);
    }

    return {
      id: policy.key.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\-]/g, '_'),
      url: policy.url,
      filename: policy.key.split('/').pop() || file.name,
      originalName: file.name,
      size: file.size,
      type: fileKind(file),
    };
  } catch (error) {
    if (!fallbackToServer) {
      throw error instanceof Error
        ? error
        : new Error('OSS 直传失败，请检查 Bucket CORS 配置。');
    }
    console.warn('[upload] direct OSS upload failed, falling back to server upload:', error);
    return uploadViaServer(file);
  }
}
