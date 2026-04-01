// server/ws.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { RawData } from 'ws';
import { getAllProjects, upsertProject, removeProject } from './db.js';
import type { Project } from '../src/lib/storage.js';

interface WSMessage {
  type: string;
  [key: string]: unknown;
}

// Track all connected clients: clientId → WebSocket
const clients = new Map<string, WebSocket>();

function broadcast(data: object, excludeClientId?: string): void {
  const msg = JSON.stringify(data);
  clients.forEach((ws, id) => {
    if (id !== excludeClientId && ws.readyState === WebSocket.OPEN) {
      ws.send(msg, (err) => {
        if (err) console.error('[ws] send error', err.message);
      });
    }
  });
}

export function attachWebSocketServer(httpServer: Server): WebSocketServer {
  // Match the Express JSON body limit (20MB) to handle projects with base64 image content
  const wss = new WebSocketServer({ server: httpServer, maxPayload: 20 * 1024 * 1024 });

  wss.on('connection', (ws: WebSocket) => {
    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    clients.set(clientId, ws);

    // Send full project list to the newly connected client
    try {
      const projects = getAllProjects();
      ws.send(JSON.stringify({ type: 'init', projects }));
    } catch (e) {
      console.error('[ws] init error', e);
    }

    ws.on('message', (raw: RawData) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(raw.toString()) as WSMessage;
      } catch {
        return; // ignore malformed messages
      }

      try {
        if (msg.type === 'project_save') {
          const project = msg.project as Project;
          if (!project?.id || typeof project.updatedAt !== 'number') return;
          upsertProject(project);
          broadcast({ type: 'project_update', project }, clientId);
        } else if (msg.type === 'project_delete') {
          const id = msg.id as string;
          if (!id) return;
          removeProject(id);
          broadcast({ type: 'project_deleted', id }, clientId);
        }
      } catch (e) {
        console.error('[ws] message handler error', e);
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
    });

    ws.on('error', (err) => {
      console.error('[ws] client error', err.message);
      clients.delete(clientId);
    });
  });

  console.log('[ws] WebSocket server attached');
  return wss;
}
