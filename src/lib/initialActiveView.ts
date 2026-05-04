import type { ActiveView } from '../components/BottomTabBar';

export type ProjectEntryKind = 'new' | 'open' | 'topicKeyword';

export function initialActiveViewForProjectEntry(_entry: ProjectEntryKind): ActiveView {
  return 'topic';
}
