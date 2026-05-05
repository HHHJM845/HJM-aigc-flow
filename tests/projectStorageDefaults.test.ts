import assert from 'node:assert/strict';
import { createProject, loadProjects, saveProject, type Project } from '../src/lib/storage';

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

let shouldThrowOnSet = true;
const fallbackStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => fallbackStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (shouldThrowOnSet) {
        shouldThrowOnSet = false;
        throw new Error('quota exceeded');
      }
      fallbackStorage.set(key, value);
    },
    removeItem: (key: string) => fallbackStorage.delete(key),
  },
  configurable: true,
});

assert.doesNotThrow(() => saveProject({
  ...createProject('fallback legacy shape'),
  id: 'fallback-legacy',
  assetWorkbenchCards: undefined,
} as unknown as Project));

const projectWithCards: Project = {
  ...createProject('fallback cards'),
  id: 'fallback-cards',
  assetWorkbenchCards: [
    {
      id: 'card-1',
      kind: 'character',
      name: '莱恩',
      roleTag: '主角',
      description: '少年主角',
      referenceImage: 'data:image/png;base64,reference',
      styleId: 'vintage-comic',
      ratio: '1:1',
      quality: '2K',
      status: 'generated',
      generatedImage: 'data:image/png;base64,generated',
      createdAt: 100,
      updatedAt: 120,
    },
    {
      id: 'card-2',
      kind: 'scene',
      name: '雨夜街口',
      description: '潮湿霓虹街道',
      referenceImage: '/uploads/reference.png',
      styleId: 'cyberpunk',
      ratio: '16:9',
      quality: '2K',
      status: 'saved',
      generatedImage: '/uploads/scene.png',
      assetId: 'asset-scene',
      createdAt: 200,
      updatedAt: 220,
    },
  ],
};

shouldThrowOnSet = true;
saveProject(projectWithCards);

const fallbackStored = JSON.parse(fallbackStorage.get('hjm_aigc_projects') ?? '[]');
const storedCards = fallbackStored.find((p: { id: string }) => p.id === 'fallback-cards').assetWorkbenchCards;
assert.equal(storedCards[0].referenceImage, undefined);
assert.equal(storedCards[0].generatedImage, undefined);
assert.equal(storedCards[1].referenceImage, '/uploads/reference.png');
assert.equal(storedCards[1].generatedImage, '/uploads/scene.png');

console.log('project storage defaults behavior ok');
