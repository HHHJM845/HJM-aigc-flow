import type { AssetItem } from './storage';

export type AssetWorkbenchKind = 'character' | 'scene';
export type AssetWorkbenchStatus = 'draft' | 'generating' | 'generated' | 'saved' | 'error';
export type AssetWorkbenchRatio = '1:1' | '16:9' | '9:16' | '4:3';
export type AssetWorkbenchQuality = '1K' | '2K';

export interface AssetWorkbenchStyle {
  id: string;
  name: string;
  promptPreset: string;
  thumbnail: string;
}

export interface AssetWorkbenchCard {
  id: string;
  kind: AssetWorkbenchKind;
  name: string;
  roleTag?: string;
  description: string;
  referenceImage?: string;
  styleId: string;
  ratio: AssetWorkbenchRatio;
  quality: AssetWorkbenchQuality;
  generatedImage?: string;
  assetId?: string;
  status: AssetWorkbenchStatus;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export const ASSET_WORKBENCH_STYLES: AssetWorkbenchStyle[] = [
  {
    id: 'vintage-comic',
    name: '复古漫画',
    promptPreset: 'vintage comic book style, grainy textures, dynamic action lines, muted reds and sepia tones',
    thumbnail: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'american-3d',
    name: '美式 3D',
    promptPreset: 'sleek American 3D animation style, smooth surfaces, expressive features, soft global lighting',
    thumbnail: 'https://images.unsplash.com/photo-1635189779577-c0364171fdc7?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'cel-shaded',
    name: '三渲二',
    promptPreset: 'modern cel shaded anime style, crisp outlines, vibrant flattened colors, cinematic composition',
    thumbnail: 'https://images.unsplash.com/photo-1618331835717-801e976710b2?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'romance-comic',
    name: '女频漫画',
    promptPreset: 'romance comic illustration, delicate linework, soft lighting, elegant color palette',
    thumbnail: 'https://images.unsplash.com/photo-1518893063132-36e46dbe2428?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'storybook',
    name: '吉卜力',
    promptPreset: 'lush hand painted storybook animation background, warm atmosphere, watercolor textures',
    thumbnail: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'chinese-3d',
    name: '3D 国创',
    promptPreset: 'Chinese 3D animated feature style, detailed costume, cinematic lighting, heroic composition',
    thumbnail: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'jojo',
    name: 'JoJo',
    promptPreset: 'high contrast stylized manga fashion pose, bold colors, dramatic shadows, graphic composition',
    thumbnail: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    promptPreset: 'vibrant cyberpunk scene, neon reflections, wet pavement, deep shadows, high contrast lighting',
    thumbnail: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'ink-wash',
    name: '水墨国风',
    promptPreset: 'modern Chinese ink wash painting style, charcoal and silver brushstrokes, poetic atmosphere',
    thumbnail: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'painterly-cinema',
    name: '厚涂电影感',
    promptPreset: 'rich painterly cinematic still, layered colors, tactile texture, dramatic film lighting',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=240&q=80',
  },
];

export const ASSET_WORKBENCH_QUALITIES: AssetWorkbenchQuality[] = ['1K', '2K'];

export function normalizeAssetWorkbenchQuality(quality: unknown): AssetWorkbenchQuality {
  return quality === '1K' || quality === '2K' ? quality : '2K';
}

export function getAssetWorkbenchStyle(styleId: string): AssetWorkbenchStyle {
  return ASSET_WORKBENCH_STYLES.find(style => style.id === styleId) ?? ASSET_WORKBENCH_STYLES[0];
}

export function createAssetWorkbenchCard(
  kind: AssetWorkbenchKind,
  now = Date.now()
): AssetWorkbenchCard {
  return {
    id: `workbench_${now}_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name: kind === 'character' ? '新角色' : '新场景',
    ...(kind === 'character' ? { roleTag: '主角' } : {}),
    description: '',
    styleId: ASSET_WORKBENCH_STYLES[0].id,
    ratio: kind === 'character' ? '1:1' : '16:9',
    quality: '2K',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export function buildAssetWorkbenchPrompt(card: AssetWorkbenchCard): string {
  const style = getAssetWorkbenchStyle(card.styleId);
  const subject =
    card.kind === 'character'
      ? `character concept art for ${card.name}${card.roleTag ? `, role tag: ${card.roleTag}` : ''}`
      : `environment concept art for ${card.name}`;

  return [
    subject,
    card.description.trim(),
    style.promptPreset,
    'premium dark cinematic production design, high detail, polished visual development sheet',
  ].filter(Boolean).join(', ');
}

export function createAssetFromWorkbenchCard(
  card: AssetWorkbenchCard,
  assetId: string,
  createdAt = Date.now()
): AssetItem {
  if (!card.generatedImage) {
    throw new Error('generated image is required before saving to asset library');
  }

  return {
    id: assetId,
    type: 'image',
    src: card.generatedImage,
    name: card.name.trim() || (card.kind === 'character' ? '未命名角色' : '未命名场景'),
    createdAt,
    category: card.kind,
  };
}

export function markWorkbenchCardSaved(
  card: AssetWorkbenchCard,
  assetId: string,
  updatedAt = Date.now()
): AssetWorkbenchCard {
  return {
    ...card,
    assetId,
    status: 'saved',
    errorMessage: undefined,
    updatedAt,
  };
}
