import assert from 'node:assert/strict';
import {
  appendTopicHistoryEntry,
  createTopicHistoryEntry,
  type TopicHistoryEntry,
} from '../src/lib/topicHistory';

const result = {
  summary: { filmCount: 2, dominantMood: '希望', dominantGenre: '家庭剧情' },
  films: [],
  insight: '• 以家庭关系推动冲突',
  suggestions: [
    {
      title: '雨夜里的父子',
      coreConflict: '父子必须在一夜内说出多年误会',
      genreTag: '短片',
      referenceStyle: '是枝裕和',
    },
  ],
};

const first = createTopicHistoryEntry({
  keyword: '父子关系',
  sources: ['cinema', 'festival'],
  results: result,
  createdAt: 1000,
});

assert.equal(first.keyword, '父子关系');
assert.deepEqual(first.sources, ['cinema', 'festival']);
assert.equal(first.results.suggestions[0].title, '雨夜里的父子');

const previous: TopicHistoryEntry = {
  ...first,
  id: 'old-entry',
  keyword: '孤独',
  createdAt: 900,
};

const next = appendTopicHistoryEntry([previous], first, 2);
assert.equal(next.length, 2);
assert.equal(next[0].id, first.id);
assert.equal(next[1].id, 'old-entry');

const deduped = appendTopicHistoryEntry(next, { ...first, id: 'replacement', createdAt: 1100 }, 2);
assert.equal(deduped.length, 2);
assert.equal(deduped[0].id, 'replacement');
assert.equal(deduped.filter(entry => entry.keyword === '父子关系').length, 1);

const capped = appendTopicHistoryEntry(
  deduped,
  createTopicHistoryEntry({ keyword: '城市记忆', sources: ['streaming'], results: result, createdAt: 1200 }),
  2
);
assert.equal(capped.length, 2);
assert.equal(capped[0].keyword, '城市记忆');
assert.equal(capped[1].keyword, '父子关系');

console.log('topic history behavior ok');
