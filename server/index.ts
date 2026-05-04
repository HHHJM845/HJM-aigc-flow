import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import breakdownRouter from './routes/breakdown.js';
import chatRouter from './routes/chat.js';
import generateRouter from './routes/generate.js';
import videoRouter from './routes/video.js';
import analyzeRouter from './routes/analyze.js';
import exportVideoRouter from './routes/export-video.js';
import matchAssetsRouter from './routes/match-assets.js';
import optimizePromptRouter from './routes/optimize-prompt.js';
import topicResearchRouter from './routes/topic-research.js';
import uploadRouter from './routes/upload.js';
import reviewRouter from './routes/review.js';
import templatesRouter from './routes/templates.js';
import agentAnnotationReviewRouter from './routes/agent-annotation-review.js';
import agentCanvasCommandRouter from './routes/agent-canvas-command.js';
import { createServer } from 'http';
import { attachWebSocketServer } from './ws.js';
import { seedDefaultImageTemplates } from './db.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import projectContextRouter from './routes/project-context.js';
import { seedAdminUser } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
seedDefaultImageTemplates();
seedAdminUser().catch(err => console.error('[auth] seed error:', err));
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '20mb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowed = process.env.CORS_ORIGIN || 'http://localhost:3000';
  if (origin === allowed || allowed === '*') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api/breakdown', breakdownRouter);
app.use('/api/chat', chatRouter);
app.use('/api/generate', generateRouter);
app.use('/api/video', videoRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/export-video', exportVideoRouter);
app.use('/api/match-assets', matchAssetsRouter);
app.use('/api/optimize-prompt', optimizePromptRouter);
app.use('/api/topic-research', topicResearchRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/agent/annotation-review', agentAnnotationReviewRouter);
app.use('/api/agent/canvas-command', agentCanvasCommandRouter);
app.use('/api', reviewRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/project-context', projectContextRouter);

// Serve uploaded files publicly
import { fileURLToPath as fu } from 'url';
const __dirname2 = path.dirname(fu(import.meta.url));
const uploadsDir = path.resolve(__dirname2, '../uploads');
import fs2 from 'fs';
if (!fs2.existsSync(uploadsDir)) fs2.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server error]', err.message);
  res.status(500).json({ error: err.message });
});

const httpServer = createServer(app);
const wss = attachWebSocketServer(httpServer);
httpServer.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});

// Graceful shutdown: force-close all connections so the port is released immediately
function shutdown() {
  httpServer.closeAllConnections();
  wss.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
