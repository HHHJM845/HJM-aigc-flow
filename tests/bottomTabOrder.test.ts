import assert from 'node:assert/strict';
import { BOTTOM_TABS } from '../src/lib/bottomTabs';

const labels = BOTTOM_TABS.map(tab => tab.label);

assert.deepEqual(labels, [
  '选题',
  '剧本拆解',
  '角色场景',
  '无限画布',
  '分镜管理',
  '视频管理',
  '资产管理',
  '模板库',
]);

assert.equal(labels.indexOf('角色场景'), labels.indexOf('剧本拆解') + 1);
assert.equal(labels.indexOf('角色场景'), labels.indexOf('无限画布') - 1);
assert.equal(labels.indexOf('资产管理'), labels.indexOf('视频管理') + 1);
assert.equal(labels.indexOf('资产管理'), labels.indexOf('模板库') - 1);

console.log('bottom tab order behavior ok');
