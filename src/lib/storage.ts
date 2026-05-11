import type { Node, Edge } from '@xyflow/react';
import type { StoryboardRow } from './api';
import type { AssetWorkbenchCard } from './assetWorkbench';
import type { TopicHistoryEntry } from './topicHistory';

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
  scriptText?: string;
  nodes: Node[];
  edges: Edge[];
  assets: AssetItem[];
  generationHistory: HistoryItem[];
  storyboardOrder: string[];
  videoOrder: VideoOrderItem[];
  topicDraft?: string;
  topicHistory: TopicHistoryEntry[];
  assetWorkbenchCards: AssetWorkbenchCard[];
  stageOverride?: ProjectStage;
  members: string[];
  projectType?: ProjectType;
  tags: string[];
}

const STORAGE_KEY = 'hjm_aigc_projects';

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function sanitizeNodes(nodes: Node[]): Node[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node, index) => {
    const fallbackX = 80 + (index % 5) * 440;
    const fallbackY = 80 + Math.floor(index / 5) * 400;
    const width = finiteNumber(node.width, node.type === 'textNode' ? 380 : 380);
    const height = finiteNumber(node.height, node.type === 'textNode' ? 300 : 214);

    return {
      ...node,
      position: {
        x: finiteNumber(node.position?.x, fallbackX),
        y: finiteNumber(node.position?.y, fallbackY),
      },
      width,
      height,
      data: node.data || {},
    };
  });
}

export function sanitizeEdges(edges: Edge[], nodes: Node[]): Edge[] {
  if (!Array.isArray(edges)) return [];
  const nodeIds = new Set(nodes.map(node => node.id));
  return edges
    .filter(edge => edge?.id && nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map(edge => ({ ...edge, type: edge.type || 'custom' }));
}

export function sanitizeProject(project: Project): Project {
  const nodes = sanitizeNodes(project.nodes || []);
  return {
    members: [],
    tags: [],
    topicHistory: [],
    assetWorkbenchCards: [],
    ...project,
    nodes,
    edges: sanitizeEdges(project.edges || [], nodes),
  };
}

export function loadProjects(): Project[] {
  try {
    const raw: Project[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return raw.map(sanitizeProject);
  } catch {
    return [];
  }
}

export function saveProject(project: Project): void {
  project = sanitizeProject(project);
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
      topicHistory: project.topicHistory.slice(0, 20),
      assetWorkbenchCards: (Array.isArray(project.assetWorkbenchCards) ? project.assetWorkbenchCards : []).map(card => ({
        ...card,
        referenceImage: card.referenceImage?.startsWith('data:image') ? undefined : card.referenceImage,
        generatedImage: card.generatedImage?.startsWith('data:image') ? undefined : card.generatedImage,
      })),
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
    topicHistory: [],
    assetWorkbenchCards: [],
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
