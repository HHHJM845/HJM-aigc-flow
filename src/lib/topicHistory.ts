import type { FilmItem } from '../components/TopicVideoCard';

export type TopicSource = 'cinema' | 'streaming' | 'festival';

export interface FilmIdeaSuggestion {
  title: string;
  coreConflict: string;
  genreTag: string;
  referenceStyle: string;
}

export interface FilmSummary {
  filmCount: number;
  dominantMood: string;
  dominantGenre: string;
}

export interface FilmResults {
  summary: FilmSummary;
  films: FilmItem[];
  insight: string;
  suggestions: FilmIdeaSuggestion[];
}

export interface TopicHistoryEntry {
  id: string;
  keyword: string;
  sources: TopicSource[];
  createdAt: number;
  results: FilmResults;
}

export const TOPIC_HISTORY_LIMIT = 20;

export function createTopicHistoryEntry({
  keyword,
  sources,
  results,
  createdAt = Date.now(),
}: {
  keyword: string;
  sources: TopicSource[];
  results: FilmResults;
  createdAt?: number;
}): TopicHistoryEntry {
  return {
    id: `topic_${createdAt}_${Math.random().toString(36).slice(2, 8)}`,
    keyword: keyword.trim(),
    sources: [...sources],
    createdAt,
    results,
  };
}

export function appendTopicHistoryEntry(
  history: TopicHistoryEntry[],
  entry: TopicHistoryEntry,
  limit = TOPIC_HISTORY_LIMIT
): TopicHistoryEntry[] {
  const next = [
    entry,
    ...history.filter(item => item.keyword !== entry.keyword),
  ];
  return next.slice(0, limit);
}
