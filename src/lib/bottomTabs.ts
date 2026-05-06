import type { ActiveView } from '../components/BottomTabBar';

export interface BottomTabItem {
  key: ActiveView;
  iconKey: 'Lightbulb' | 'FileText' | 'UserRound' | 'DraftingCompass' | 'Clapperboard' | 'Video' | 'Package' | 'Bookmark';
  label: string;
}

export const BOTTOM_TABS: BottomTabItem[] = [
  { key: 'topic',      iconKey: 'Lightbulb',       label: '选题' },
  { key: 'breakdown',  iconKey: 'FileText',        label: '剧本拆解' },
  { key: 'assetWorkbench', iconKey: 'UserRound', label: '角色场景' },
  { key: 'canvas',     iconKey: 'DraftingCompass', label: '无限画布' },
  { key: 'storyboard', iconKey: 'Clapperboard',    label: '分镜管理' },
  { key: 'video',      iconKey: 'Video',           label: '视频管理' },
  { key: 'assets',     iconKey: 'Package',         label: '资产管理' },
  { key: 'templates',  iconKey: 'Bookmark',        label: '模板库' },
];
