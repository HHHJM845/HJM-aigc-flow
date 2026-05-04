import assert from 'node:assert/strict';
import { createStoryboardVideoNodeData } from '../src/lib/storyboardVideoExport';

const data = createStoryboardVideoNodeData({
  index: 3,
  imageSrc: 'data:image/png;base64,storyboard-frame',
  shotDescription: '雨夜，父亲站在老屋门口回头。',
});

assert.equal(data.label, '分镜 03');
assert.equal(data.contentType, 'video');
assert.equal(data.content, null);
assert.equal(data.referenceImage, 'data:image/png;base64,storyboard-frame');
assert.equal(data.shotDescription, '雨夜，父亲站在老屋门口回头。');
assert.equal('initialPrompt' in data, false);

const noImage = createStoryboardVideoNodeData({
  index: 1,
  imageSrc: '',
  shotDescription: '空镜。',
});

assert.equal(noImage.referenceImage, undefined);
assert.equal(noImage.shotDescription, '空镜。');

console.log('storyboard video export behavior ok');
