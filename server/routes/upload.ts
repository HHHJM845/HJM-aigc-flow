import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /image\/(jpeg|png|gif|webp)|video\/(mp4|webm|quicktime|x-msvideo)/;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error(`不支持的文件类型: ${file.mimetype}`));
  },
});

const router = Router();
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

function sanitizeFilename(filename: string): string {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext).replace(/[^a-zA-Z0-9_\-]/g, '_') || 'upload';
  return `${base}${ext}`;
}

router.get('/oss-policy', (req, res) => {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  const bucket = process.env.OSS_BUCKET || 'augc-flow';
  const region = process.env.OSS_REGION || 'oss-cn-shenzhen';
  const publicBaseUrl = process.env.OSS_PUBLIC_BASE_URL;

  if (!accessKeyId || !accessKeySecret) {
    res.status(500).json({ error: 'OSS credentials are not configured' });
    return;
  }

  const filename = sanitizeFilename(String(req.query.filename || 'upload'));
  const mimeType = String(req.query.type || '');
  const folder = mimeType.startsWith('video') ? 'videos' : 'images';
  const key = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}_${filename}`;
  const host = `https://${bucket}.${region}.aliyuncs.com`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const policy = {
    expiration: expiresAt,
    conditions: [
      ['content-length-range', 1, MAX_UPLOAD_BYTES],
      ['starts-with', '$key', `${folder}/`],
      ['starts-with', '$Content-Type', ''],
      { bucket },
      { success_action_status: '200' },
    ],
  };

  const policyBase64 = Buffer.from(JSON.stringify(policy)).toString('base64');
  const signature = crypto
    .createHmac('sha1', accessKeySecret)
    .update(policyBase64)
    .digest('base64');

  res.json({
    host,
    key,
    url: `${publicBaseUrl || host}/${key}`,
    fields: {
      key,
      policy: policyBase64,
      OSSAccessKeyId: accessKeyId,
      signature,
      success_action_status: '200',
      'Content-Type': mimeType || 'application/octet-stream',
    },
  });
});

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '未收到文件' });
    return;
  }
  res.json({
    id: path.basename(req.file.filename, path.extname(req.file.filename)),
    url: `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
  });
});

export default router;
