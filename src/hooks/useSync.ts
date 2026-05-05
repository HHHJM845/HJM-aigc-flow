// src/hooks/useSync.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadProjects,
  saveProject as localSave,
  deleteProject as localDelete,
  type Project,
} from '../lib/storage';

const RECONNECT_DELAY = 3000;

function normalizeProject(project: Project): Project {
  return { members: [], tags: [], topicHistory: [], assetWorkbenchCards: [], ...project };
}

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // In Vite dev mode (port 3000), the Express server is on port 3001.
  // In production (Express serves the built frontend on same port), use window.location.host.
  const isDev = window.location.port === '3000';
  const host = isDev ? `${window.location.hostname}:3001` : window.location.host;
  return `${protocol}//${host}`;
}

export function useSync(
  onRemoteProjectUpdate?: (project: Project) => void,
  onAnnotationAdded?: (msg: {
    projectId: string;
    shareId: string;
    rowIndex: number;
    rowId: string;
    status: string;
    comment: string;
    createdAt: number;
  }) => void
) {
  // Seed initial state from localStorage (offline fallback)
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  // Keep callback ref stable so connect() closure doesn't go stale
  const onRemoteRef = useRef(onRemoteProjectUpdate);
  onRemoteRef.current = onRemoteProjectUpdate;
  const onAnnotationRef = useRef(onAnnotationAdded);
  onAnnotationRef.current = onAnnotationAdded;

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
        const serverProjects = Array.isArray(msg.projects)
          ? (msg.projects as Project[]).map(normalizeProject)
          : [];
        const serverMap = new Map(serverProjects.map(p => [p.id, p]));
        const localProjects = loadProjects();
        const localMap = new Map(localProjects.map(p => [p.id, p]));

        // 三路合并：以 updatedAt 时间戳为准，谁新谁赢
        // 防止服务端空数据（重启/重置后）覆盖本地已有数据
        const allIds = new Set([...serverMap.keys(), ...localMap.keys()]);
        const resolved: Project[] = [];

        for (const id of allIds) {
          const sp = serverMap.get(id);
          const lp = localMap.get(id);

          if (sp && !lp) {
            // 仅服务端有 → 写入本地
            localSave(sp);
            resolved.push(sp);
          } else if (!sp && lp) {
            // 仅本地有 → 上传服务端
            ws.send(JSON.stringify({ type: 'project_save', project: lp }));
            resolved.push(lp);
          } else if (sp && lp) {
            if (lp.updatedAt > sp.updatedAt) {
              // 本地更新 → 上传服务端，保留本地（不覆盖）
              ws.send(JSON.stringify({ type: 'project_save', project: lp }));
              resolved.push(lp);
            } else {
              // 服务端更新 → 写入本地
              localSave(sp);
              resolved.push(sp);
            }
          }
        }

        setProjects(resolved.sort((a, b) => b.updatedAt - a.updatedAt));
      }

      if (msg.type === 'project_update') {
        const updated = normalizeProject(msg.project as Project);
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

      if (msg.type === 'annotation_added') {
        onAnnotationRef.current?.({
          projectId: msg.projectId as string,
          shareId: msg.shareId as string,
          rowIndex: msg.rowIndex as number,
          rowId: msg.rowId as string,
          status: msg.status as string,
          comment: msg.comment as string,
          createdAt: msg.createdAt as number,
        });
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
