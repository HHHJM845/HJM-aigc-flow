import assert from 'node:assert/strict';
import {
  ASSET_WORKBENCH_STYLES,
  ASSET_WORKBENCH_QUALITIES,
  buildAssetWorkbenchPrompt,
  createAssetWorkbenchCard,
  createAssetFromWorkbenchCard,
  markWorkbenchCardSaved,
  normalizeAssetWorkbenchQuality,
  type AssetWorkbenchCard,
} from '../src/lib/assetWorkbench';

const character = createAssetWorkbenchCard('character', 1000);
assert.equal(character.kind, 'character');
assert.equal(character.name, '新角色');
assert.equal(character.roleTag, '主角');
assert.equal(character.ratio, '1:1');
assert.equal(character.quality, '2K');
assert.equal(character.status, 'draft');
assert.equal(character.createdAt, 1000);
assert.equal(character.updatedAt, 1000);
assert.ok(ASSET_WORKBENCH_STYLES.some(style => style.id === character.styleId));
assert.deepEqual(ASSET_WORKBENCH_QUALITIES, ['1K', '2K']);
assert.equal(normalizeAssetWorkbenchQuality('1K'), '1K');
assert.equal(normalizeAssetWorkbenchQuality('2K'), '2K');
assert.equal(normalizeAssetWorkbenchQuality('4K'), '2K');

const scene = createAssetWorkbenchCard('scene', 1100);
assert.equal(scene.kind, 'scene');
assert.equal(scene.name, '新场景');
assert.equal(scene.roleTag, undefined);
assert.equal(scene.ratio, '16:9');

const editedCharacter: AssetWorkbenchCard = {
  ...character,
  name: '莱恩·格林',
  description: '深圳长大的少年，穿旧夹克，神情敏感但倔强。',
  styleId: 'vintage-comic',
};

const prompt = buildAssetWorkbenchPrompt(editedCharacter);
assert.match(prompt, /character concept art/i);
assert.match(prompt, /莱恩·格林/);
assert.match(prompt, /深圳长大的少年/);
assert.match(prompt, /vintage comic/i);

const generatedCharacter: AssetWorkbenchCard = {
  ...editedCharacter,
  generatedImage: '/uploads/ryan.png',
};
const asset = createAssetFromWorkbenchCard(generatedCharacter, 'asset_1', 1200);
assert.deepEqual(asset, {
  id: 'asset_1',
  type: 'image',
  src: '/uploads/ryan.png',
  name: '莱恩·格林',
  createdAt: 1200,
  category: 'character',
});

const saved = markWorkbenchCardSaved(generatedCharacter, 'asset_1', 1300);
assert.equal(saved.assetId, 'asset_1');
assert.equal(saved.status, 'saved');
assert.equal(saved.updatedAt, 1300);

const generatedScene: AssetWorkbenchCard = {
  ...scene,
  name: '雨夜巷口',
  description: '潮湿街道，霓虹反光，深夜无人。',
  generatedImage: '/uploads/alley.png',
};
const sceneAsset = createAssetFromWorkbenchCard(generatedScene, 'asset_2', 1400);
assert.equal(sceneAsset.category, 'scene');
assert.equal(sceneAsset.name, '雨夜巷口');

assert.throws(
  () => createAssetFromWorkbenchCard({ ...scene, generatedImage: undefined }, 'asset_3', 1500),
  /generated image is required/
);

console.log('asset workbench behavior ok');
