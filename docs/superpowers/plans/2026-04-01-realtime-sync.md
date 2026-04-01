# Realtime Multi-Device Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WebSocket + SQLite-based real-time sync so all devices connected to the server share one workspace with live project updates and shared generation history.

**Architecture:** The existing Express HTTP server is upgraded to an `http.Server` with a `ws` WebSocket server attached on the same port. SQLite stores all project data server-side via `better-sqlite3`. The React frontend connects via WebSocket, receives the full project list on connection, and broadcasts all changes in real time. `localStorage` is kept as an offline fallback. Live canvas updates are propagated to the open `Flow` component via `externalNodes`/`externalEdges` props with a feedback-loop guard.

**Tech Stack:** `ws` (WebSocket), `better-sqlite3` (SQLite), `useSync` custom React hook

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `server/db.ts` | SQLite init, project CRUD |
| Create | `server/ws.ts` | WebSocket server, broadcast logic |
| Create | `src/hooks/useSync.ts` | Frontend WS connection + state |
| Modify | `server/index.ts` | Switch to `http.Server`, attach WS |
| Modify | `src/App.tsx` | Integrate useSync; add externalCanvas props to Flow; pass projects to HomePage |
| Modify | `src/components/HomePage.tsx` | Receive `projects` and `onDeleteProject` as props (remove direct storage calls) |
| Modify | `.gitignore` | Ignore `data/` directory |

---

### Task 1: Install dependencies and prepare data directory

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `.gitignore`

- [ ] **Step 1: Install server packages**

```bash
cd C:\Users\oldch\Desktop\HJM-aigc-flow-main
npm install better-sqlite3 ws
npm install -D @types/better-sqlite3 @types/ws
```

Expected: packages added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Create the data directory and add to .gitignore**

Create `data/.gitkeep` (empty file to track the directory in git):

```bash
mkdir -p data
touch data/.gitkeep
```

Add `data/*.db` to `.gitignore` — append this line:

```
data/*.db
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .gitignore data/.gitkeep
git commit -m "chore: install ws and better-sqlite3 for realtime sync"
```

---

### Task 2: Create `server/db.ts` — SQLite data layer

**Files:**
- Create: `server/db.ts`

- [ ] **Step 1: Create the file**

```typescript
// server/db.ts
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Project } from '../src/lib/storage.js';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../data/projects.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id        TEXT PRIMARY KEY,
    data      TEXT NOT NULL,
    updatedAt INTEGER NOT NULL
  );
`);

export function getAllProjects(): Project[] {
  const rows = db.prepare('SELECT data FROM projects ORDER BY updatedAt DESC').all() as { data: string }[];
  return rows.map((r: { data: string }) => JSON.parse(r.data) as Project);
}

export function upsertProject(project: Project): void {
  db.prepare(
    'INSERT OR REPLACE INTO projects (id, data, updatedAt) VALUES (?, ?, ?)'
  ).run(project.id, JSON.stringify(project), project.updatedAt);
}

export function removeProject(id: string): void {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}
```

- [ ] **Step 2: Verify TypeScript compiles (no errors)**

```bash
npx tsc --noEmit
```

Expected: no errors related to `server/db.ts`. (Ignore unrelated pre-existing errors if any.)

- [ ] **Step 3: Commit**

```bash
git add server/db.ts
git commit -m "feat: add SQLite data layer for server-side project storage"
```

---

### Task 3: Create `server/ws.ts` — WebSocket server

**Files:**
- Create: `server/ws.ts`

- [ ] **Step 1: Create the file**

```typescript
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
      ws.send(msg);
    }
  });
}

export function attachWebSocketServer(httpServer: Server): void {
  const wss = new WebSocketServer({ server: httpServer });

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

      if (msg.type === 'project_save') {
        const project = msg.project as Project;
        if (!project?.id) return;
        upsertProject(project);
        broadcast({ type: 'project_update', project }, clientId);
      }

      if (msg.type === 'project_delete') {
        const id = msg.id as string;
        if (!id) return;
        removeProject(id);
        broadcast({ type: 'project_deleted', id }, clientId);
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
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add server/ws.ts
git commit -m "feat: add WebSocket server with project sync broadcast"
```

---

### Task 4: Modify `server/index.ts` — attach WebSocket to HTTP server

**Files:**
- Modify: `server/index.ts`

Current last section (lines 51–53):
```typescript
app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
```

- [ ] **Step 1: Add imports at the top of `server/index.ts`**

After the existing imports (after line 12 `import analyzeRouter from './routes/analyze.js';`), add:

```typescript
import { createServer } from 'http';
import { attachWebSocketServer } from './ws.js';
```

- [ ] **Step 2: Replace `app.listen` with `http.Server`**

Replace the final section (lines 51–53):
```typescript
app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
```

With:
```typescript
const httpServer = createServer(app);
attachWebSocketServer(httpServer);
httpServer.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Verify the server starts without errors**

```bash
npm run dev:server
```

Expected output includes:
```
[ws] WebSocket server attached
[server] running on http://localhost:3001
```

Press Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add server/index.ts
git commit -m "feat: attach WebSocket server to shared HTTP server port"
```

---

### Task 5: Create `src/hooks/useSync.ts` — frontend WebSocket hook

**Files:**
- Create: `src/hooks/useSync.ts`

- [ ] **Step 1: Create the file**

```typescript
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
  // In production (Express serves the built frontend), same port.
  const port = window.location.port === '3000' ? '3001' : window.location.port;
  return `${protocol}//${window.location.hostname}:${port}`;
}

export function useSync(onRemoteProjectUpdate?: (project: Project) => void) {
  // Seed initial state from localStorage (offline fallback)
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep callback ref stable so connect() closure doesn't go stale
  const onRemoteRef = useRef(onRemoteProjectUpdate);
  onRemoteRef.current = onRemoteProjectUpdate;

  const connect = useCallback(() => {
    // Don't create a duplicate connection
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Clear any pending reconnect timer
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
        const serverProjects = msg.projects as Project[];
        setProjects(serverProjects);
        // Update localStorage cache for each project
        serverProjects.forEach(localSave);
      }

      if (msg.type === 'project_update') {
        const updated = msg.project as Project;
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
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose → schedules reconnect
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const saveProject = useCallback((project: Project) => {
    // Optimistic local update
    localSave(project);
    setProjects(prev => {
      const idx = prev.findIndex(p => p.id === project.id);
      return idx >= 0
        ? prev.map((p, i) => (i === idx ? project : p))
        : [project, ...prev];
    });
    // Broadcast to server
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSync.ts
git commit -m "feat: add useSync hook for WebSocket project synchronization"
```

---

### Task 6: Add external canvas update props to `Flow` in `src/App.tsx`

This lets the `App` component push remote project changes into the live canvas without re-mounting it.

**Files:**
- Modify: `src/App.tsx` (Flow component section, lines 88–770)

- [ ] **Step 1: Add three new props to the Flow props interface**

Find the props interface (lines 103–118):
```typescript
}: {
  initialNodes: Node[];
  initialEdges: Edge[];
  initialStoryboardRows: StoryboardRow[];
  initialAssets: AssetItem[];
  initialHistory: HistoryItem[];
  onGoHome: () => void;
  onSave: (nodes: Node[], edges: Edge[]) => void;
  onSaveRows: (rows: StoryboardRow[]) => void;
  onSaveAssets: (assets: AssetItem[]) => void;
  onSaveHistory: (history: HistoryItem[]) => void;
  initialStoryboardOrder: string[];
  onSaveStoryboardOrder: (order: string[]) => void;
  initialVideoOrder: VideoOrderItem[];
  onSaveVideoOrder: (order: VideoOrderItem[]) => void;
```

Replace with:
```typescript
}: {
  initialNodes: Node[];
  initialEdges: Edge[];
  initialStoryboardRows: StoryboardRow[];
  initialAssets: AssetItem[];
  initialHistory: HistoryItem[];
  onGoHome: () => void;
  onSave: (nodes: Node[], edges: Edge[]) => void;
  onSaveRows: (rows: StoryboardRow[]) => void;
  onSaveAssets: (assets: AssetItem[]) => void;
  onSaveHistory: (history: HistoryItem[]) => void;
  initialStoryboardOrder: string[];
  onSaveStoryboardOrder: (order: string[]) => void;
  initialVideoOrder: VideoOrderItem[];
  onSaveVideoOrder: (order: VideoOrderItem[]) => void;
  externalNodes?: Node[] | null;
  externalEdges?: Edge[] | null;
  externalHistory?: HistoryItem[] | null;
  connected?: boolean;
```

- [ ] **Step 2: Destructure the new props in the Flow function signature**

Find the function signature line:
```typescript
function Flow({
  initialNodes,
  initialEdges,
  initialStoryboardRows,
  initialAssets,
  initialHistory,
  onGoHome,
  onSave,
  onSaveRows,
  onSaveAssets,
  onSaveHistory,
  initialStoryboardOrder,
  onSaveStoryboardOrder,
  initialVideoOrder,
  onSaveVideoOrder,
```

Replace with:
```typescript
function Flow({
  initialNodes,
  initialEdges,
  initialStoryboardRows,
  initialAssets,
  initialHistory,
  onGoHome,
  onSave,
  onSaveRows,
  onSaveAssets,
  onSaveHistory,
  initialStoryboardOrder,
  onSaveStoryboardOrder,
  initialVideoOrder,
  onSaveVideoOrder,
  externalNodes,
  externalEdges,
  externalHistory,
  connected = true,
```

- [ ] **Step 3: Add the external-update guard ref and useEffect inside the Flow function body**

After the existing refs (after line 154: `useEffect(() => { edgesRef.current = edges; }, [edges]);`), add:

```typescript
  // Guard: prevents external-applied updates from triggering auto-save loop
  const isApplyingExternal = useRef(false);

  // Apply remote canvas updates pushed from App (other client edited the project)
  useEffect(() => {
    if (!externalNodes || !externalEdges) return;
    isApplyingExternal.current = true;
    setNodes(externalNodes);
    setEdges(externalEdges);
    if (externalHistory) setGenerationHistory(externalHistory);
    const t = setTimeout(() => { isApplyingExternal.current = false; }, 200);
    return () => clearTimeout(t);
  }, [externalNodes, externalEdges, externalHistory, setNodes, setEdges]);
```

- [ ] **Step 4: Guard the auto-save effect against external updates**

Find the auto-save useEffect (lines 158–164):
```typescript
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      onSave(nodesRef.current, edgesRef.current);
    }, 3000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [nodes, edges]);
```

Replace with:
```typescript
  useEffect(() => {
    if (isApplyingExternal.current) return; // skip save triggered by remote update
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      onSave(nodesRef.current, edgesRef.current);
    }, 3000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [nodes, edges]);
```

- [ ] **Step 5: Add connection status dot to the canvas UI**

Search for the element that renders the home/back button in the Flow JSX (look for `handleGoHome` in the JSX). It will be in a `<Panel>` or a positioned `<div>`. Add a small colored dot next to it.

Find the home button render — it looks like:
```tsx
<button onClick={handleGoHome}
```

Just before or after this button (inside the same container), add:
```tsx
<span
  title={connected ? '已连接' : '离线'}
  style={{
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: connected ? '#22c55e' : '#6b7280',
    marginLeft: 6,
    flexShrink: 0,
  }}
/>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors from the Flow changes.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add external canvas update props to Flow with feedback-loop guard"
```

---

### Task 7: Integrate `useSync` into the `App` component

**Files:**
- Modify: `src/App.tsx` (App component section, lines 772–884)

- [ ] **Step 1: Add useSync import at the top of `src/App.tsx`**

After the existing imports, add:
```typescript
import { useSync } from './hooks/useSync';
```

- [ ] **Step 2: Replace the App component internals**

Find the `App` function (starting line 772). Replace the entire function with the following. The key changes are:
- `useSync` replaces direct `saveProject`/`loadProjects` calls
- `currentProjectRef` enables the remote-update callback to read fresh state without stale closure
- `externalCanvasUpdate` passes remote canvas data to `Flow`
- `projects` from `useSync` is passed to `HomePage`
- `handleCanvasSave` etc. now call `wsSaveProject`

```typescript
export default function App() {
  const [view, setView] = useState<'home' | 'canvas' | 'skills'>('home');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [canvasInitialNodes, setCanvasInitialNodes] = useState<Node[]>([]);
  const [canvasInitialEdges, setCanvasInitialEdges] = useState<Edge[]>([]);
  const [canvasInitialRows, setCanvasInitialRows] = useState<StoryboardRow[]>([]);
  const [canvasInitialAssets, setCanvasInitialAssets] = useState<AssetItem[]>([]);
  const [canvasInitialHistory, setCanvasInitialHistory] = useState<HistoryItem[]>([]);
  const [canvasInitialStoryboardOrder, setCanvasInitialStoryboardOrder] = useState<string[]>([]);
  const [canvasInitialVideoOrder, setCanvasInitialVideoOrder] = useState<VideoOrderItem[]>([]);

  // External canvas update: when a remote client saves the currently-open project,
  // we push the updated nodes/edges into the live Flow canvas.
  const [externalCanvasUpdate, setExternalCanvasUpdate] = useState<{
    nodes: Node[];
    edges: Edge[];
    history: HistoryItem[];
  } | null>(null);

  // Stable ref so the useSync callback can always read the latest currentProject
  const currentProjectRef = useRef<Project | null>(null);
  currentProjectRef.current = currentProject;

  const handleRemoteProjectUpdate = useCallback((project: Project) => {
    const curr = currentProjectRef.current;
    // Only update the canvas if this is the project currently open
    if (curr && curr.id === project.id && project.updatedAt > curr.updatedAt) {
      setCurrentProject(project);
      setExternalCanvasUpdate({
        nodes: project.nodes,
        edges: project.edges,
        history: project.generationHistory || [],
      });
      // Clear after one tick so Flow sees a fresh object reference next time
      setTimeout(() => setExternalCanvasUpdate(null), 0);
    }
  }, []);

  const { projects, connected, saveProject: wsSaveProject, deleteProject: wsDeleteProject } =
    useSync(handleRemoteProjectUpdate);

  const handleNewProject = () => {
    const proj = createProject();
    wsSaveProject(proj);
    setCurrentProject(proj);
    setCanvasInitialNodes([]);
    setCanvasInitialEdges([]);
    setCanvasInitialRows([]);
    setCanvasInitialAssets([]);
    setCanvasInitialHistory([]);
    setCanvasInitialStoryboardOrder([]);
    setCanvasInitialVideoOrder([]);
    setView('canvas');
  };

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    setCanvasInitialNodes(project.nodes);
    setCanvasInitialEdges(project.edges);
    setCanvasInitialRows(project.storyboardRows);
    setCanvasInitialAssets(project.assets || []);
    setCanvasInitialHistory(project.generationHistory || []);
    setCanvasInitialStoryboardOrder(project.storyboardOrder || []);
    setCanvasInitialVideoOrder(project.videoOrder || []);
    setView('canvas');
  };

  const handleGoHome = () => setView('home');
  const handleGoToSkills = () => setView('skills');

  const handleCanvasSave = (nodes: Node[], edges: Edge[]) => {
    if (!currentProject) return;
    const thumbnail = extractThumbnail(nodes);
    const updated = { ...currentProject, nodes, edges, thumbnail, updatedAt: Date.now() };
    setCurrentProject(updated);
    wsSaveProject(updated);
  };

  const handleRowsSave = (rows: StoryboardRow[]) => {
    if (!currentProject) return;
    const updated = { ...currentProject, storyboardRows: rows, updatedAt: Date.now() };
    setCurrentProject(updated);
    wsSaveProject(updated);
  };

  const handleAssetsSave = (assets: AssetItem[]) => {
    if (!currentProject) return;
    const updated = { ...currentProject, assets, updatedAt: Date.now() };
    setCurrentProject(updated);
    wsSaveProject(updated);
  };

  const handleHistorySave = (history: HistoryItem[]) => {
    if (!currentProject) return;
    const updated = { ...currentProject, generationHistory: history, updatedAt: Date.now() };
    setCurrentProject(updated);
    wsSaveProject(updated);
  };

  const handleStoryboardOrderSave = (order: string[]) => {
    if (!currentProject) return;
    const updated = { ...currentProject, storyboardOrder: order, updatedAt: Date.now() };
    setCurrentProject(updated);
    wsSaveProject(updated);
  };

  const handleVideoOrderSave = (order: VideoOrderItem[]) => {
    if (!currentProject) return;
    const updated = { ...currentProject, videoOrder: order, updatedAt: Date.now() };
    setCurrentProject(updated);
    wsSaveProject(updated);
  };

  return (
    <ReactFlowProvider>
      {view === 'home' ? (
        <HomePage
          projects={projects}
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          onDeleteProject={wsDeleteProject}
          onGoToSkills={handleGoToSkills}
        />
      ) : view === 'skills' ? (
        <SkillCommunity onBack={handleGoHome} />
      ) : (
        <Flow
          initialNodes={canvasInitialNodes}
          initialEdges={canvasInitialEdges}
          initialStoryboardRows={canvasInitialRows}
          initialAssets={canvasInitialAssets}
          initialHistory={canvasInitialHistory}
          onGoHome={handleGoHome}
          onSave={handleCanvasSave}
          onSaveRows={handleRowsSave}
          onSaveAssets={handleAssetsSave}
          onSaveHistory={handleHistorySave}
          initialStoryboardOrder={canvasInitialStoryboardOrder}
          onSaveStoryboardOrder={handleStoryboardOrderSave}
          initialVideoOrder={canvasInitialVideoOrder}
          onSaveVideoOrder={handleVideoOrderSave}
          externalNodes={externalCanvasUpdate?.nodes ?? null}
          externalEdges={externalCanvasUpdate?.edges ?? null}
          externalHistory={externalCanvasUpdate?.history ?? null}
          connected={connected}
        />
      )}
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 3: Remove unused `saveProject` import from `src/App.tsx`**

The import on line 39–46:
```typescript
import {
  createProject,
  saveProject,
  extractThumbnail,
  type Project,
  type AssetItem,
  type HistoryItem,
  type VideoOrderItem,
} from './lib/storage';
```

Remove `saveProject` from this import:
```typescript
import {
  createProject,
  extractThumbnail,
  type Project,
  type AssetItem,
  type HistoryItem,
  type VideoOrderItem,
} from './lib/storage';
```

Also add `useCallback` to the React import if not already present (it's already imported at line 1).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate useSync into App, replace localStorage calls with WebSocket sync"
```

---

### Task 8: Modify `src/components/HomePage.tsx` — receive projects as props

**Files:**
- Modify: `src/components/HomePage.tsx`

- [ ] **Step 1: Read the current Props interface in HomePage.tsx**

The current interface (around line 13):
```typescript
interface Props {
  onNewProject: (initialScript?: string) => void;
  onOpenProject: (project: Project) => void;
  onGoToSkills?: () => void;
}
```

Replace with:
```typescript
interface Props {
  projects: Project[];
  onNewProject: (initialScript?: string) => void;
  onOpenProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onGoToSkills?: () => void;
}
```

- [ ] **Step 2: Update the component function signature to accept new props**

Find the HomePage function declaration. It will have `{ onNewProject, onOpenProject, onGoToSkills }` in the parameter. Add the new props:

```typescript
export default function HomePage({ projects, onNewProject, onOpenProject, onDeleteProject, onGoToSkills }: Props) {
```

- [ ] **Step 3: Remove internal projects state and replace with the prop**

Find any `useState` for projects and the `loadProjects()` call. It will look like:
```typescript
const [projects, setProjects] = useState<Project[]>(() => loadProjects());
```

Delete this line entirely. The `projects` variable now comes from the prop.

- [ ] **Step 4: Replace internal `deleteProject` call with `onDeleteProject` prop**

Find all calls to `deleteProject(...)` in HomePage.tsx (from the storage import). Replace each one with `onDeleteProject(...)`.

Also find and remove the `deleteProject` import from `../lib/storage`. The updated import should be:
```typescript
import { type Project } from '../lib/storage';
```

(Remove `loadProjects` and `deleteProject` from the import. If other items were imported, keep them.)

- [ ] **Step 5: Remove any `useEffect` that reloads projects from storage**

If there is a `useEffect(() => { setProjects(loadProjects()); }, [...])`, delete it entirely — projects are now always up-to-date from the prop.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/HomePage.tsx
git commit -m "feat: HomePage receives projects and deleteProject from App via props"
```

---

### Task 9: End-to-end manual test

**Files:** none (testing only)

- [ ] **Step 1: Start both servers**

```bash
npm run dev:all
```

Expected: Vite on port 3000, Express+WebSocket on port 3001.

- [ ] **Step 2: Open the app in two browser windows**

Open `http://localhost:3000` in Window A and Window B (or two different browsers).

- [ ] **Step 3: Verify initial sync**

Create a new project in Window A. Verify it appears in Window B's home page within 1 second without refreshing.

- [ ] **Step 4: Verify canvas sync**

Open the project in both windows. In Window A, add an image node. Verify it appears on Window B's canvas within a few seconds (after the 3-second auto-save fires).

- [ ] **Step 5: Verify history sync**

Generate an image in Window A. Verify the new history item appears in Window B's history panel after the project auto-saves.

- [ ] **Step 6: Verify connection indicator**

In the canvas view, the green dot should be visible. Temporarily stop the server (`Ctrl+C`). The dot should turn gray within a few seconds. Restart the server — the dot should turn green again and projects should re-sync.

- [ ] **Step 7: Verify offline fallback**

With the server stopped, refresh Window A. The home page should still show the locally cached projects (from localStorage).

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: realtime multi-device project sync via WebSocket + SQLite"
```

---

## Summary of Changes

| File | What changed |
|---|---|
| `server/db.ts` | New: SQLite CRUD for projects |
| `server/ws.ts` | New: WebSocket server, broadcasts project_save/delete |
| `server/index.ts` | Switch to `http.createServer`, attach WS |
| `src/hooks/useSync.ts` | New: WS client hook, optimistic updates, auto-reconnect |
| `src/App.tsx` | Use useSync; add externalNodes/Edges/History to Flow; pass projects to HomePage |
| `src/components/HomePage.tsx` | Receive projects + onDeleteProject as props; remove direct storage calls |
| `.gitignore` | Add `data/*.db` |
