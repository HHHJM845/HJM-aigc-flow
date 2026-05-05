import assert from 'node:assert/strict';
import { createProject, loadProjects } from '../src/lib/storage';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
  configurable: true,
});

storage.set('hjm_aigc_projects', JSON.stringify([
  {
    id: 'legacy',
    name: '旧项目',
    createdAt: 1,
    updatedAt: 1,
    storyboardRows: [],
    nodes: [],
    edges: [],
    assets: [],
    generationHistory: [],
    storyboardOrder: [],
    videoOrder: [],
  },
]));

const loaded = loadProjects();
assert.equal(loaded.length, 1);
assert.deepEqual(loaded[0].assetWorkbenchCards, []);
assert.deepEqual(loaded[0].topicHistory, []);
assert.deepEqual(loaded[0].members, []);
assert.deepEqual(loaded[0].tags, []);

const fresh = createProject('新项目');
assert.deepEqual(fresh.assetWorkbenchCards, []);

console.log('project storage defaults behavior ok');
