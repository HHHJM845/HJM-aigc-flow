import assert from 'node:assert/strict';
import { initialActiveViewForProjectEntry } from '../src/lib/initialActiveView';

assert.equal(initialActiveViewForProjectEntry('new'), 'topic');
assert.equal(initialActiveViewForProjectEntry('open'), 'topic');
assert.equal(initialActiveViewForProjectEntry('topicKeyword'), 'topic');

console.log('initial active view behavior ok');
