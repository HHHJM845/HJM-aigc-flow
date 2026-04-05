import { Router } from 'express';
import type { Request, Response } from 'express';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { promises as fs, createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import https from 'https';
import http from 'http';
import { randomUUID } from 'crypto';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

interface VideoOrderItem {
  id: string;
  url: string;
  trimStart?: number;
  trimEnd?: number;
}

interface SubtitleEntry {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

function msToSRTTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msRem = ms % 1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(msRem).padStart(3,'0')}`;
}

function generateSRT(subtitles: SubtitleEntry[]): string {
  const sorted = [...subtitles].sort((a, b) => a.startMs - b.startMs);
  return sorted.map((s, i) =>
    `${i + 1}\n${msToSRTTime(s.startMs)} --> ${msToSRTTime(s.endMs)}\n${s.text}`
  ).join('\n\n');
}

async function resolveClipPath(url: string, dest: string): Promise<void> {
  // Local /uploads/ path — copy directly from disk instead of HTTP
  if (url.startsWith('/uploads/')) {
    const filename = url.slice('/uploads/'.length);
    const localPath = path.join(UPLOADS_DIR, filename);
    await fs.copyFile(localPath, dest);
    return;
  }
  // Remote URL — download via HTTP/HTTPS
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`Download failed: HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('error', (err) => {
      fs.unlink(dest).catch(() => {});
      reject(err);
    });
  });
}

function trimClip(input: string, output: string, startSec: number, durationSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .inputOptions([`-ss ${startSec}`])
      .outputOptions([`-t ${durationSec}`, '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'])
      .videoCodec('libx264')
      .audioCodec('aac')
      .output(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

function copyClip(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'])
      .output(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

function concatClips(concatFile: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatFile)
      .inputOptions(['-f concat', '-safe 0'])
      .videoCodec('copy')
      .audioCodec('copy')
      .output(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

function concatAndBurnSubs(concatFile: string, srtFile: string, output: string): Promise<void> {
  const escapedSrt = srtFile.replace(/\\/g, '/').replace(/:/g, '\\\\:');
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatFile)
      .inputOptions(['-f concat', '-safe 0'])
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([`-vf subtitles='${escapedSrt}'`])
      .output(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const tmpDir = path.join(os.tmpdir(), `export-${randomUUID()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    const { videoOrder, subtitles, totalMs } = req.body as {
      videoOrder: VideoOrderItem[];
      subtitles: SubtitleEntry[];
      totalMs: number;
    };

    if (!Array.isArray(videoOrder) || videoOrder.length === 0) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      return res.status(400).json({ error: '没有视频片段' });
    }

    const trimmedPaths: string[] = [];
    for (let i = 0; i < videoOrder.length; i++) {
      const item = videoOrder[i];
      const rawPath = path.join(tmpDir, `clip-${i}-raw.mp4`);
      const normalizedPath = path.join(tmpDir, `clip-${i}-norm.mp4`);

      console.log(`[export] resolving clip ${i + 1}/${videoOrder.length}: ${item.url}`);
      await resolveClipPath(item.url, rawPath);

      const trimStart = item.trimStart ?? 0;
      const trimEnd = item.trimEnd;

      if (trimStart > 0 || trimEnd !== undefined) {
        const startSec = trimStart / 1000;
        const durationSec = trimEnd !== undefined
          ? (trimEnd - trimStart) / 1000
          : 99999;
        console.log(`[export] trimming clip ${i + 1}: start=${startSec}s duration=${durationSec}s`);
        await trimClip(rawPath, normalizedPath, startSec, durationSec);
      } else {
        console.log(`[export] normalizing clip ${i + 1} (no trim)`);
        await copyClip(rawPath, normalizedPath);
      }

      trimmedPaths.push(normalizedPath);
    }

    const concatFile = path.join(tmpDir, 'concat.txt');
    const concatContent = trimmedPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    await fs.writeFile(concatFile, concatContent, 'utf8');

    const filteredSubs = (subtitles ?? []).filter(s => s.startMs < totalMs);
    const srtFile = path.join(tmpDir, 'subtitles.srt');
    await fs.writeFile(srtFile, generateSRT(filteredSubs), 'utf8');

    const outputFile = path.join(tmpDir, 'output.mp4');
    if (filteredSubs.length > 0) {
      console.log(`[export] concatenating ${trimmedPaths.length} clips with ${filteredSubs.length} subtitles`);
      await concatAndBurnSubs(concatFile, srtFile, outputFile);
    } else {
      console.log(`[export] concatenating ${trimmedPaths.length} clips (no subtitles)`);
      await concatClips(concatFile, outputFile);
    }

    const filename = `export-${Date.now()}.mp4`;
    res.download(outputFile, filename, async (err) => {
      if (err && !res.headersSent) {
        console.error('[export] download error', err);
      }
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    });

  } catch (err) {
    console.error('[export] error:', err);
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    if (!res.headersSent) {
      res.status(500).json({ error: String(err) });
    }
  }
});

export default router;
