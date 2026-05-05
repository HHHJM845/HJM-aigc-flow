import type { ActiveView } from '../components/BottomTabBar';

export interface BottomTabItem {
  key: ActiveView;
  icon: string;
  label: string;
}

export const BOTTOM_TABS: BottomTabItem[] = [
  { key: 'topic',      icon: 'lightbulb',     label: '选题' },
  { key: 'breakdown',  icon: 'description',   label: '剧本拆解' },
  { key: 'assetWorkbench', icon: 'recent_actors', label: '角色场景' },
  { key: 'canvas',     icon: 'architecture',  label: '无限画布' },
  { key: 'storyboard', icon: 'movie_edit',    label: '分镜管理' },
  { key: 'video',      icon: 'video_library', label: '视频管理' },
  { key: 'assets',     icon: 'inventory_2',   label: '资产管理' },
  { key: 'templates',  icon: 'bookmark_manager', label: '模板库' },
];
