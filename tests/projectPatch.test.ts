import assert from 'node:assert/strict';
import type { Node, Edge } from '@xyflow/react';
import { createProject } from '../src/lib/storage';
import { applyProjectPatch } from '../src/lib/projectPatch';

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
  topicHistory: [
    {
      id: 'topic-1',
      keyword: '雨夜',
      topics: ['雨夜归人'],
      selectedTopic: '雨夜归人',
      createdAt: 100,
    },
  ],
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
assert.equal(updated.updatedAt, 200);

console.log('project patch behavior ok');
