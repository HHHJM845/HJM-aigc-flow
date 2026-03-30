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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '20mb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowed = process.env.CORS_ORIGIN || 'http://localhost:3000';
  if (origin === allowed || allowed === '*') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api/breakdown', breakdownRouter);
app.use('/api/chat', chatRouter);
app.use('/api/generate', generateRouter);
app.use('/api/video', videoRouter);
app.use('/api/analyze', analyzeRouter);

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

app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
