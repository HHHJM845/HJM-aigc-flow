import type { Node, Edge } from '@xyflow/react';
import type { StoryboardRow } from './api';

export type ProjectStage = 'script' | 'storyboard' | 'generation' | 'review';
export type ProjectType = '短片' | '广告' | 'MV' | '教程' | '其他';

export interface AssetItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  name: string;
  createdAt: number;
  category?: 'character' | 'scene' | 'other';
}

export interface HistoryItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  nodeLabel: string;
  createdAt: number;
}

export interface VideoOrderItem {
  id: string;       // e.g. `vid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  nodeId: string;   // source VideoNode ID
  url: string;      // snapshotted video URL at time of check
  label: string;    // snapshotted node label at time of check
  trimStart?: number; // ms from clip start, default 0
  trimEnd?: number;   // ms from clip start, default = full clip duration
}

export interface Project {
  id: string;
  name: string;
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
  storyboardRows: StoryboardRow[];
  nodes: Node[];
  edges: Edge[];
  assets: AssetItem[];
  generationHistory: HistoryItem[];
  storyboardOrder: string[];
  videoOrder: VideoOrderItem[];
  topicDraft?: string;
  stageOverride?: ProjectStage;
  members: string[];
  projectType?: ProjectType;
  tags: string[];
}

const STORAGE_KEY = 'hjm_aigc_projects';

export function loadProjects(): Project[] {
  try {
    const raw: Project[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return raw.map(p => ({ members: [], tags: [], ...p }));
  } catch {
    return [];
  }
}

export function saveProject(project: Project): void {
  const all = loadProjects();
  const idx = all.findIndex(p => p.id === project.id);
  if (idx >= 0) all[idx] = project;
  else all.unshift(project);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    const lite: Project = {
      ...project,
      thumbnail: undefined,
      assets: [],
      generationHistory: project.generationHistory.slice(0, 20),
      nodes: project.nodes.map(n => ({
        ...n,
        data: { ...n.data, content: null, uploadedImages: [] },
      })),
    };
    const idx2 = all.findIndex(p => p.id === lite.id);
    if (idx2 >= 0) all[idx2] = lite;
    else all.unshift(lite);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch {}
  }
}

export function deleteProject(id: string): void {
  const all = loadProjects().filter(p => p.id !== id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch {}
}

export function createProject(name = '未命名项目'): Project {
  return {
    id: `proj_${Date.now()}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    storyboardRows: [],
    nodes: [],
    edges: [],
    assets: [],
    generationHistory: [],
    storyboardOrder: [],
    videoOrder: [],
    members: [],
    tags: [],
  };
}

export function extractThumbnail(nodes: Node[]): string | undefined {
  for (const node of nodes) {
    if (node.type === 'imageNode' && node.data?.content) {
      const c = node.data.content as string | string[];
      const first = Array.isArray(c) ? c[0] : c;
      if (typeof first === 'string' && first.startsWith('data:image')) return first;
    }
  }
  return undefined;
}

const STAGE_ORDER: ProjectStage[] = ['script', 'storyboard', 'generation', 'review'];

export function stageIndex(stage: ProjectStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function inferStage(project: Project): ProjectStage {
  if (project.stageOverride) return project.stageOverride;
  if (project.videoOrder?.length > 0) return 'review';
  const hasGeneratedImage = project.nodes.some(
    n => n.type === 'imageNode' && n.data?.content
  );
  if (hasGeneratedImage) return 'generation';
  if (project.storyboardRows.length > 0) return 'storyboard';
  return 'script';
}
