import assert from 'node:assert/strict';
import type { Node, Edge } from '@xyflow/react';
import { createProject } from '../src/lib/storage';
import { applyProjectPatch } from '../src/lib/projectPatch';
import type { AssetWorkbenchCard } from '../src/lib/assetWorkbench';
import type { TopicHistoryEntry } from '../src/lib/topicHistory';

const topicHistory: TopicHistoryEntry[] = [
  {
    id: 'topic-1',
    keyword: '雨夜',
    sources: ['cinema'],
    createdAt: 100,
    results: {
      summary: {
        filmCount: 0,
        dominantMood: '悬疑',
        dominantGenre: '剧情',
      },
      films: [],
      insight: '雨夜人物关系可强化视觉对比。',
      suggestions: [],
    },
  },
];

const assetWorkbenchCards: AssetWorkbenchCard[] = [
  {
    id: 'workbench-1',
    kind: 'character',
    name: '莱恩',
    roleTag: '主角',
    description: '少年主角',
    styleId: 'vintage-comic',
    ratio: '1:1',
    quality: '2K',
    status: 'saved',
    generatedImage: '/uploads/ryan.png',
    assetId: 'asset-ryan',
    createdAt: 100,
    updatedAt: 120,
  },
];

const project = {
  ...createProject('patch test'),
  storyboardOrder: ['image-a', 'image-b'],
  videoOrder: [
    {
      id: 'video-1',
      nodeId: 'video-node-1',
      url: '/uploads/video-1.mp4',
      label: '视频节点 1',
    },
  ],
  topicHistory,
  assetWorkbenchCards,
};

const nodes = [{ id: 'image-a', type: 'imageNode', data: {}, position: { x: 0, y: 0 } }] as Node[];
const edges = [] as Edge[];
const updated = applyProjectPatch(project, { nodes, edges }, 200);

assert.deepEqual(updated.nodes, nodes);
assert.deepEqual(updated.edges, edges);
assert.deepEqual(updated.storyboardOrder, ['image-a', 'image-b']);
assert.deepEqual(updated.videoOrder, [
  {
    id: 'video-1',
    nodeId: 'video-node-1',
    url: '/uploads/video-1.mp4',
    label: '视频节点 1',
  },
]);
assert.deepEqual(updated.topicHistory, project.topicHistory);
assert.deepEqual(updated.assetWorkbenchCards, project.assetWorkbenchCards);
assert.equal(updated.updatedAt, 200);

console.log('project patch behavior ok');
