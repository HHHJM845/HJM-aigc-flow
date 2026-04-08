// src/hooks/useSync.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadProjects,
  saveProject as localSave,
  deleteProject as localDelete,
  type Project,
} from '../lib/storage';

const RECONNECT_DELAY = 3000;

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // In Vite dev mode (port 3000), the Express server is on port 3001.
  // In production (Express serves the built frontend on same port), use window.location.host.
  const isDev = window.location.port === '3000';
  const host = isDev ? `${window.location.hostname}:3001` : window.location.host;
  return `${protocol}//${host}`;
}

export function useSync(onRemoteProjectUpdate?: (project: Project) => void) {
  // Seed initial state from localStorage (offline fallback)
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  // Keep callback ref stable so connect() closure doesn't go stale
  const onRemoteRef = useRef(onRemoteProjectUpdate);
  onRemoteRef.current = onRemoteProjectUpdate;

  const connect = useCallback(() => {
    // Don't create a duplicate connection (guard both CONNECTING and OPEN states)
    const rs = wsRef.current?.readyState;
    if (rs === WebSocket.CONNECTING || rs === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (evt: MessageEvent) => {
      let msg: { type: string; [key: string]: unknown };
      try {
        msg = JSON.parse(evt.data as string);
      } catch {
        return;
      }

      if (msg.type === 'init') {
        const serverProjects = Array.isArray(msg.projects) ? (msg.projects as Project[]).map(p => ({ members: [], tags: [], ...p })) : [];
        const serverIds = new Set(serverProjects.map((p: Project) => p.id));

        // Migrate any local projects that the server doesn't have yet.
        // This recovers data from localStorage on first run or after a server reset.
        const localProjects = loadProjects();
        const toUpload = localProjects.filter(p => !serverIds.has(p.id));
        toUpload.forEach(p => {
          ws.send(JSON.stringify({ type: 'project_save', project: p }));
        });

        // Merge: server is authoritative for projects it knows; locals fill the rest
        const merged = [...serverProjects, ...toUpload]
          .sort((a, b) => b.updatedAt - a.updatedAt);
        setProjects(merged);
        serverProjects.forEach(localSave);
      }

      if (msg.type === 'project_update') {
        const updated = { members: [], tags: [], ...(msg.project as Project) };
        setProjects(prev => {
          const idx = prev.findIndex(p => p.id === updated.id);
          const next =
            idx >= 0
              ? prev.map((p, i) => (i === idx ? updated : p))
              : [updated, ...prev];
          return [...next].sort((a, b) => b.updatedAt - a.updatedAt);
        });
        localSave(updated);
        onRemoteRef.current?.(updated);
      }

      if (msg.type === 'project_deleted') {
        const id = msg.id as string;
        setProjects(prev => prev.filter(p => p.id !== id));
        localDelete(id);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Don't reconnect if the component has unmounted
      if (!unmountedRef.current) {
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
      }
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose → schedules reconnect
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const saveProject = useCallback((project: Project) => {
    // Optimistic local update
    localSave(project);
    setProjects(prev => {
      const idx = prev.findIndex(p => p.id === project.id);
      const next = idx >= 0
        ? prev.map((p, i) => (i === idx ? project : p))
        : [project, ...prev];
      return [...next].sort((a, b) => b.updatedAt - a.updatedAt); // keep list sorted after local save
    });
    // Broadcast to server (if offline, save is preserved in localStorage)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'project_save', project }));
    }
  }, []);

  const deleteProject = useCallback((id: string) => {
    localDelete(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'project_delete', id }));
    }
  }, []);

  return { projects, connected, saveProject, deleteProject };
}
