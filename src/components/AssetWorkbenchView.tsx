import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ASSET_WORKBENCH_STYLES,
  buildAssetWorkbenchPrompt,
  createAssetFromWorkbenchCard,
  createAssetWorkbenchCard,
  getAssetWorkbenchStyle,
  markWorkbenchCardSaved,
  type AssetWorkbenchCard,
  type AssetWorkbenchKind,
  type AssetWorkbenchRatio,
} from '../lib/assetWorkbench';
import type { AssetItem } from '../lib/storage';

interface Props {
  cards: AssetWorkbenchCard[];
  onSaveCards: (cards: AssetWorkbenchCard[]) => void;
  onAddAsset: (asset: AssetItem) => void;
  onAddImageNode: (asset: AssetItem) => void;
}

const KIND_OPTIONS: { kind: AssetWorkbenchKind; label: string; icon: string }[] = [
  { kind: 'character', label: '角色', icon: 'person' },
  { kind: 'scene', label: '场景', icon: 'landscape' },
];

const RATIO_OPTIONS: AssetWorkbenchRatio[] = ['1:1', '16:9', '9:16', '4:3'];
const STALE_ASSET_FIELDS = new Set<keyof AssetWorkbenchCard>([
  'kind',
  'name',
  'roleTag',
  'description',
  'referenceImage',
  'styleId',
  'ratio',
  'quality',
  'generatedImage',
]);

const STATUS_LABELS: Record<AssetWorkbenchCard['status'], { label: string; cls: string; icon: string }> = {
  draft: { label: '草稿', cls: 'bg-white/[0.06] text-white/45 border-white/10', icon: 'edit' },
  generating: { label: '生成中', cls: 'bg-[#8ab4f8]/15 text-[#8ab4f8] border-[#8ab4f8]/25', icon: 'progress_activity' },
  generated: { label: '已生成', cls: 'bg-emerald-400/12 text-emerald-200 border-emerald-300/25', icon: 'auto_awesome' },
  saved: { label: '已入库', cls: 'bg-white text-black border-white', icon: 'check_circle' },
  error: { label: '错误', cls: 'bg-red-500/15 text-red-200 border-red-400/30', icon: 'error' },
};

function relativeTime(ts: number): string {
  const diffMs = Math.max(0, Date.now() - ts);
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${Math.floor(diffHours / 24)} 天前`;
}

function createAssetId(): string {
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function iconStyle(fill = false): React.CSSProperties {
  return fill ? { fontVariationSettings: "'FILL' 1" } : {};
}

export default function AssetWorkbenchView({
  cards,
  onSaveCards,
  onAddAsset,
  onAddImageNode,
}: Props) {
  const [activeKind, setActiveKind] = useState<AssetWorkbenchKind>('character');
  const [selectedId, setSelectedId] = useState<string | null>(cards[0]?.id ?? null);
  const cardsRef = useRef(cards);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const filteredCards = useMemo(
    () => cards.filter(card => card.kind === activeKind),
    [cards, activeKind]
  );
  const selectedCard = cards.find(card => card.id === selectedId) ?? filteredCards[0] ?? null;
  const selectedStyle = selectedCard ? getAssetWorkbenchStyle(selectedCard.styleId) : ASSET_WORKBENCH_STYLES[0];
  const promptPreview = selectedCard ? buildAssetWorkbenchPrompt(selectedCard) : '';
  const isGenerating = selectedCard?.status === 'generating';
  const canGenerate = Boolean(selectedCard) && !isGenerating;
  const canUseImage = Boolean(selectedCard?.generatedImage);

  const commitCards = (next: AssetWorkbenchCard[]) => {
    cardsRef.current = next;
    onSaveCards(next);
  };

  const saveCard = (card: AssetWorkbenchCard) => {
    const currentCards = cardsRef.current;
    const exists = currentCards.some(item => item.id === card.id);
    const next = exists
      ? currentCards.map(item => (item.id === card.id ? card : item))
      : [card, ...currentCards];
    commitCards(next);
    setSelectedId(card.id);
  };

  const updateCardById = (
    cardId: string,
    updater: (card: AssetWorkbenchCard) => AssetWorkbenchCard,
    selectCard = false
  ): AssetWorkbenchCard | null => {
    const currentCards = cardsRef.current;
    const index = currentCards.findIndex(card => card.id === cardId);
    if (index < 0) return null;

    const updated = updater(currentCards[index]);
    const next = currentCards.map(card => (card.id === cardId ? updated : card));
    commitCards(next);
    if (selectCard) setSelectedId(cardId);
    return updated;
  };

  const addCard = (kind: AssetWorkbenchKind) => {
    const card = createAssetWorkbenchCard(kind);
    commitCards([card, ...cardsRef.current]);
    setActiveKind(kind);
    setSelectedId(card.id);
  };

  const updateSelected = (patch: Partial<AssetWorkbenchCard>) => {
    if (!selectedCard) return;
    const hasStatus = Object.prototype.hasOwnProperty.call(patch, 'status');
    const hasGeneratedImage = Object.prototype.hasOwnProperty.call(patch, 'generatedImage');
    const hasStaleAssetField = Object.keys(patch).some(key =>
      STALE_ASSET_FIELDS.has(key as keyof AssetWorkbenchCard)
    );

    updateCardById(selectedCard.id, latest => {
      const nextGeneratedImage = hasGeneratedImage ? patch.generatedImage : latest.generatedImage;
      const status = hasStatus
        ? patch.status
        : hasGeneratedImage
          ? (patch.generatedImage ? 'generated' : 'draft')
          : hasStaleAssetField && latest.status === 'saved'
            ? (nextGeneratedImage ? 'generated' : 'draft')
          : latest.status;

      return {
        ...latest,
        ...patch,
        ...(hasStaleAssetField ? { assetId: undefined } : {}),
        status: status ?? latest.status,
        updatedAt: Date.now(),
      };
    }, true);
  };

  const deleteSelected = () => {
    if (!selectedCard) return;
    const next = cardsRef.current.filter(card => card.id !== selectedCard.id);
    commitCards(next);
    const nextSelected = next.find(card => card.kind === activeKind) ?? next[0] ?? null;
    setSelectedId(nextSelected?.id ?? null);
    if (nextSelected) setActiveKind(nextSelected.kind);
  };

  const duplicateSelected = () => {
    if (!selectedCard) return;
    const now = Date.now();
    const duplicate: AssetWorkbenchCard = {
      ...selectedCard,
      id: `workbench_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name: `${selectedCard.name || (selectedCard.kind === 'character' ? '新角色' : '新场景')} 副本`,
      assetId: undefined,
      status: selectedCard.generatedImage ? 'generated' : 'draft',
      errorMessage: undefined,
      createdAt: now,
      updatedAt: now,
    };
    commitCards([duplicate, ...cardsRef.current]);
    setActiveKind(duplicate.kind);
    setSelectedId(duplicate.id);
  };

  const handleKindChange = (kind: AssetWorkbenchKind) => {
    setActiveKind(kind);
    const first = cardsRef.current.find(card => card.kind === kind);
    setSelectedId(first?.id ?? null);
  };

  const handleReferenceUpload = (file: File | null | undefined) => {
    if (!selectedCard || !file) return;
    if (!file.type.startsWith('image/')) {
      updateSelected({
        status: 'error',
        errorMessage: '请上传图片格式的参考图。',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === 'string') {
        updateSelected({
          referenceImage: dataUrl,
          errorMessage: undefined,
        });
      }
    };
    reader.onerror = () => {
      updateSelected({
        status: 'error',
        errorMessage: '参考图读取失败，请重新选择文件。',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!selectedCard || isGenerating) return;
    const cardAtStart = selectedCard;
    const prompt = buildAssetWorkbenchPrompt(cardAtStart);
    updateSelected({
      assetId: undefined,
      status: 'generating',
      errorMessage: undefined,
    });

    try {
      const body: Record<string, unknown> = {
        prompt,
        ratio: cardAtStart.ratio,
        quality: cardAtStart.quality,
        count: 1,
      };
      if (cardAtStart.referenceImage) body.referenceImages = [cardAtStart.referenceImage];

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({})) as { urls?: string[]; url?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || `生成失败：HTTP ${response.status}`);
      }

      const generatedImage = data.urls?.[0] ?? data.url;
      if (!generatedImage) throw new Error('生成接口没有返回图片。');

      updateCardById(cardAtStart.id, latest => ({
        ...latest,
        generatedImage,
        assetId: undefined,
        status: 'generated',
        errorMessage: undefined,
        updatedAt: Date.now(),
      }));
    } catch (error) {
      updateCardById(cardAtStart.id, latest => ({
        ...latest,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : '生成失败，请稍后重试。',
        updatedAt: Date.now(),
      }));
    }
  };

  const handleSaveAsset = () => {
    if (!selectedCard || !selectedCard.generatedImage || selectedCard.status === 'saved') return;
    const now = Date.now();
    const assetId = selectedCard.assetId ?? createAssetId();
    const asset = createAssetFromWorkbenchCard(selectedCard, assetId, now);
    onAddAsset(asset);
    saveCard(markWorkbenchCardSaved(selectedCard, assetId, now));
  };

  const handleAddToCanvas = () => {
    if (!selectedCard || !selectedCard.generatedImage) return;
    const asset = createAssetFromWorkbenchCard(selectedCard, selectedCard.assetId ?? createAssetId());
    onAddImageNode(asset);
  };

  return (
    <div className="absolute inset-0 bg-black text-[#e0e0e0] flex overflow-hidden" style={{ fontFamily: 'Inter, sans-serif' }}>
      <aside className="w-[280px] min-w-[260px] border-r border-white/[0.08] bg-[#080808] flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-2xl bg-white text-black flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]" style={iconStyle(true)}>auto_awesome</span>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>资产工作台</h1>
              <p className="text-[11px] text-white/35">Character & Scene Lab</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-white/[0.06] border border-white/[0.08]">
            {KIND_OPTIONS.map(option => (
              <button
                key={option.kind}
                onClick={() => handleKindChange(option.kind)}
                className={`h-9 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeKind === option.kind
                    ? 'bg-[#e0e0e0] text-black shadow-lg shadow-white/10'
                    : 'text-white/45 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-4">
          <button
            onClick={() => addCard(activeKind)}
            className="w-full h-11 rounded-full bg-[#1f1f22] border border-white/10 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#2a2a2e] hover:border-white/20 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]" style={iconStyle(true)}>add</span>
            新建{activeKind === 'character' ? '角色' : '场景'}卡
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-5">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/25">Recent Cards</span>
            <span className="text-[11px] text-white/30">{filteredCards.length}</span>
          </div>

          {filteredCards.length === 0 ? (
            <button
              onClick={() => addCard(activeKind)}
              className="w-full mt-4 rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-8 text-center text-white/35 hover:text-white/60 hover:border-white/25 transition-all"
            >
              <span className="material-symbols-outlined block text-[32px] mb-2 opacity-50">add_photo_alternate</span>
              <span className="text-xs">创建第一张{activeKind === 'character' ? '角色' : '场景'}卡</span>
            </button>
          ) : (
            <div className="space-y-2">
              {filteredCards.map(card => {
                const status = STATUS_LABELS[card.status];
                const isSelected = selectedCard?.id === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelectedId(card.id)}
                    className={`group w-full text-left rounded-2xl border p-3 transition-all ${
                      isSelected
                        ? 'bg-[#19191c] border-[#8ab4f8]/55 shadow-[0_0_0_1px_rgba(138,180,248,0.16),0_16px_42px_rgba(0,0,0,0.45)]'
                        : 'bg-white/[0.035] border-white/[0.07] hover:bg-white/[0.06] hover:border-white/15'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="w-14 h-14 rounded-xl bg-[#101010] border border-white/[0.08] overflow-hidden flex-shrink-0">
                        {card.generatedImage || card.referenceImage ? (
                          <img
                            src={card.generatedImage ?? card.referenceImage}
                            alt={card.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-white/20 text-[24px]">
                              {card.kind === 'character' ? 'person' : 'landscape'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p className="text-sm font-bold text-white truncate flex-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {card.name || (card.kind === 'character' ? '未命名角色' : '未命名场景')}
                          </p>
                          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] flex items-center gap-1 ${status.cls}`}>
                            <span className="material-symbols-outlined text-[11px]">{status.icon}</span>
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-white/35 line-clamp-2">
                          {card.description || '等待描述设定'}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-white/25">
                          <span>{getAssetWorkbenchStyle(card.styleId).name}</span>
                          <span>{relativeTime(card.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto pb-28">
        {selectedCard ? (
          <div className="min-h-full px-7 py-6 xl:px-10">
            <header className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">
                  <span>{selectedCard.kind === 'character' ? 'Character Asset' : 'Scene Asset'}</span>
                  <span className="w-1 h-1 rounded-full bg-white/25" />
                  <span>{selectedCard.ratio}</span>
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {selectedCard.name || (selectedCard.kind === 'character' ? '未命名角色' : '未命名场景')}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={duplicateSelected}
                  className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 text-white/55 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center"
                  aria-label="复制卡片"
                  title="复制卡片"
                >
                  <span className="material-symbols-outlined text-[19px]">content_copy</span>
                </button>
                <button
                  onClick={deleteSelected}
                  className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 text-white/55 hover:text-red-200 hover:bg-red-500/10 hover:border-red-400/25 transition-all flex items-center justify-center"
                  aria-label="删除卡片"
                  title="删除卡片"
                >
                  <span className="material-symbols-outlined text-[19px]">delete</span>
                </button>
              </div>
            </header>

            <section className="grid grid-cols-1 xl:grid-cols-[minmax(320px,0.82fr)_minmax(420px,1.18fr)] gap-5">
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#111113] border border-white/[0.08] p-4">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-3">
                    <label className="block">
                      <span className="block text-[11px] text-white/35 mb-1.5">名称</span>
                      <input
                        value={selectedCard.name}
                        onChange={event => updateSelected({ name: event.target.value })}
                        className="w-full h-11 rounded-xl bg-black/40 border border-white/[0.08] px-3 text-sm text-white outline-none focus:border-[#8ab4f8]/60 focus:ring-2 focus:ring-[#8ab4f8]/15 transition-all"
                        placeholder={selectedCard.kind === 'character' ? '例如：冷面侦探' : '例如：雨夜街角'}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[11px] text-white/35 mb-1.5">
                        {selectedCard.kind === 'character' ? '角色定位' : '场景类型'}
                      </span>
                      <input
                        value={selectedCard.roleTag ?? ''}
                        onChange={event => updateSelected({ roleTag: event.target.value })}
                        className="w-full h-11 rounded-xl bg-black/40 border border-white/[0.08] px-3 text-sm text-white outline-none focus:border-[#8ab4f8]/60 focus:ring-2 focus:ring-[#8ab4f8]/15 transition-all"
                        placeholder={selectedCard.kind === 'character' ? '主角 / 反派' : '室内 / 城市'}
                      />
                    </label>
                  </div>

                  <label className="block mt-4">
                    <span className="block text-[11px] text-white/35 mb-1.5">描述</span>
                    <textarea
                      value={selectedCard.description}
                      onChange={event => updateSelected({ description: event.target.value })}
                      className="w-full min-h-[126px] resize-y rounded-2xl bg-black/40 border border-white/[0.08] p-3 text-sm leading-6 text-white outline-none focus:border-[#8ab4f8]/60 focus:ring-2 focus:ring-[#8ab4f8]/15 transition-all"
                      placeholder={selectedCard.kind === 'character' ? '外貌、服装、表情、姿态、关键道具...' : '空间结构、时间、天气、光线、镜头氛围...'}
                    />
                  </label>
                </div>

                <div className="rounded-2xl bg-[#111113] border border-white/[0.08] p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>参考图</h3>
                      <p className="text-[11px] text-white/35 mt-0.5">上传参考可强化造型和构图一致性</p>
                    </div>
                    {selectedCard.referenceImage && (
                      <button
                        onClick={() => updateSelected({ referenceImage: undefined })}
                        className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center"
                        aria-label="移除参考图"
                        title="移除参考图"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    )}
                  </div>
                  <label
                    className="relative block rounded-2xl border border-dashed border-white/15 bg-black/35 min-h-[144px] overflow-hidden cursor-pointer hover:border-[#8ab4f8]/45 focus:outline-none focus:border-[#8ab4f8]/60 focus:ring-2 focus:ring-[#8ab4f8]/20 transition-all"
                    tabIndex={0}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        referenceInputRef.current?.click();
                      }
                    }}
                  >
                    <input
                      ref={referenceInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={event => {
                        handleReferenceUpload(event.target.files?.[0]);
                        event.target.value = '';
                      }}
                    />
                    {selectedCard.referenceImage ? (
                      <img
                        src={selectedCard.referenceImage}
                        alt="参考图"
                        className="w-full h-[180px] object-cover opacity-85"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white/35">
                        <span className="material-symbols-outlined text-[34px] mb-2">add_photo_alternate</span>
                        <span className="text-xs">选择或替换参考图</span>
                      </div>
                    )}
                  </label>
                </div>

                <div className="rounded-2xl bg-[#111113] border border-white/[0.08] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>风格</h3>
                    <span className="text-[11px] text-white/35">{selectedStyle.name}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {ASSET_WORKBENCH_STYLES.map(style => {
                      const active = selectedCard.styleId === style.id;
                      return (
                        <button
                          key={style.id}
                          onClick={() => updateSelected({ styleId: style.id })}
                          className={`group rounded-xl overflow-hidden border bg-black transition-all ${
                            active
                              ? 'border-[#8ab4f8] shadow-[0_0_0_2px_rgba(138,180,248,0.18),0_0_26px_rgba(138,180,248,0.22)]'
                              : 'border-white/10 hover:border-white/30'
                          }`}
                          title={style.name}
                        >
                          <div className="aspect-square overflow-hidden">
                            <img
                              src={style.thumbnail}
                              alt={style.name}
                              className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className={`h-7 px-1 flex items-center justify-center text-[10px] ${active ? 'text-white' : 'text-white/45'}`}>
                            <span className="truncate">{style.name}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] bg-[#101012] border border-white/[0.08] p-4 shadow-2xl shadow-black/35">
                <div className="relative rounded-[22px] overflow-hidden bg-black min-h-[520px] border border-white/[0.06]">
                  {selectedCard.generatedImage ? (
                    <img
                      src={selectedCard.generatedImage}
                      alt={selectedCard.name}
                      className="absolute inset-0 w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center bg-[radial-gradient(circle_at_50%_30%,rgba(138,180,248,0.16),transparent_30%),linear-gradient(145deg,#111,#050505)]">
                      <div className="w-16 h-16 rounded-3xl bg-white/[0.07] border border-white/10 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-[34px] text-white/35">image</span>
                      </div>
                      <p className="text-sm font-bold text-white/75">预览区</p>
                      <p className="mt-2 text-xs leading-5 text-white/35 max-w-sm">完善描述并选择风格后，使用 AI 生成首张资产预览。</p>
                    </div>
                  )}

                  {isGenerating && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                      <span className="material-symbols-outlined text-[42px] animate-spin mb-3">progress_activity</span>
                      <span className="text-sm font-bold">生成中</span>
                    </div>
                  )}

                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3">
                    <span className={`rounded-full border px-3 py-1.5 text-xs flex items-center gap-1.5 backdrop-blur-xl ${STATUS_LABELS[selectedCard.status].cls}`}>
                      <span className="material-symbols-outlined text-[14px]">{STATUS_LABELS[selectedCard.status].icon}</span>
                      {STATUS_LABELS[selectedCard.status].label}
                    </span>
                    <div className="flex items-center gap-2 rounded-full bg-black/55 backdrop-blur-xl border border-white/10 p-1">
                      <button
                        onClick={handleGenerate}
                        disabled={!canGenerate}
                        className="w-9 h-9 rounded-full bg-white/[0.09] text-white/70 hover:text-white hover:bg-white/[0.16] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                        aria-label={selectedCard.generatedImage ? '重新生成' : 'AI 生成'}
                        title={selectedCard.generatedImage ? '重新生成' : 'AI 生成'}
                      >
                        <span className="material-symbols-outlined text-[19px]">{selectedCard.generatedImage ? 'autorenew' : 'auto_awesome'}</span>
                      </button>
                      <button
                        onClick={handleSaveAsset}
                        disabled={!canUseImage || selectedCard.status === 'saved'}
                        className="w-9 h-9 rounded-full bg-white/[0.09] text-white/70 hover:text-white hover:bg-white/[0.16] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                        aria-label="保存到资产库"
                        title="保存到资产库"
                      >
                        <span className="material-symbols-outlined text-[19px]">inventory_2</span>
                      </button>
                      <button
                        onClick={handleAddToCanvas}
                        disabled={!canUseImage}
                        className="w-9 h-9 rounded-full bg-white text-black hover:bg-[#8ab4f8] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                        aria-label="添加到画布"
                        title="添加到画布"
                      >
                        <span className="material-symbols-outlined text-[19px]" style={iconStyle(true)}>add</span>
                      </button>
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3">
                    <button
                      onClick={handleGenerate}
                      disabled={!canGenerate}
                      className="h-11 rounded-full bg-white text-black px-5 text-sm font-extrabold flex items-center gap-2 hover:bg-[#8ab4f8] disabled:opacity-45 disabled:cursor-not-allowed transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]" style={iconStyle(true)}>
                        {selectedCard.generatedImage ? 'autorenew' : 'auto_awesome'}
                      </span>
                      {selectedCard.generatedImage ? '重新生成' : 'AI 生成'}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveAsset}
                        disabled={!canUseImage || selectedCard.status === 'saved'}
                        className="h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 px-4 text-xs font-bold text-white/70 hover:text-white hover:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        入资产库
                      </button>
                      <button
                        onClick={handleAddToCanvas}
                        disabled={!canUseImage}
                        className="h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 px-4 text-xs font-bold text-white/70 hover:text-white hover:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[16px]">add_to_photos</span>
                        到画布
                      </button>
                    </div>
                  </div>
                </div>

                {selectedCard.errorMessage && (
                  <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-xs text-red-100 flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] mt-0.5">error</span>
                    <span>{selectedCard.errorMessage}</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center pb-28">
            <div className="text-center">
              <div className="w-16 h-16 rounded-3xl bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-white/35 text-[34px]">style</span>
              </div>
              <h2 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>暂无资产卡</h2>
              <button
                onClick={() => addCard(activeKind)}
                className="h-11 rounded-full bg-white text-black px-6 text-sm font-extrabold hover:bg-[#8ab4f8] transition-all"
              >
                新建第一张卡
              </button>
            </div>
          </div>
        )}
      </main>

      <aside className="w-[340px] min-w-[320px] border-l border-white/[0.08] bg-[#0b0b0c] overflow-y-auto pb-28">
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>生成设置</h2>
              <p className="text-[11px] text-white/35 mt-0.5">Prompt Console</p>
            </div>
            <span className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/45">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </span>
          </div>

          {selectedCard ? (
            <div className="space-y-4">
              <section className="rounded-2xl bg-[#151518] border border-white/[0.08] p-4">
                <span className="text-[11px] text-white/35">生成类型</span>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {KIND_OPTIONS.map(option => {
                    const active = selectedCard.kind === option.kind;
                    return (
                      <button
                        key={option.kind}
                        onClick={() => {
                          updateSelected({
                            kind: option.kind,
                            roleTag: option.kind === 'character' ? (selectedCard.roleTag || '主角') : selectedCard.roleTag,
                          });
                          setActiveKind(option.kind);
                        }}
                        className={`h-20 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                          active
                            ? 'bg-[#8ab4f8]/15 border-[#8ab4f8]/55 text-white shadow-[0_0_22px_rgba(138,180,248,0.14)]'
                            : 'bg-black/35 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[24px]">{option.icon}</span>
                        <span className="text-xs font-bold">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl bg-[#151518] border border-white/[0.08] p-4">
                <span className="text-[11px] text-white/35">当前风格</span>
                <div className="mt-3 flex gap-3">
                  <img
                    src={selectedStyle.thumbnail}
                    alt={selectedStyle.name}
                    className="w-16 h-16 rounded-2xl object-cover border border-[#8ab4f8]/45 shadow-[0_0_22px_rgba(138,180,248,0.15)]"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{selectedStyle.name}</p>
                    <p className="mt-1 text-[11px] leading-4 text-white/35 line-clamp-2">{selectedStyle.promptPreset}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-[#151518] border border-white/[0.08] p-4">
                <span className="text-[11px] text-white/35">画幅比例</span>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {RATIO_OPTIONS.map(ratio => {
                    const active = selectedCard.ratio === ratio;
                    return (
                      <button
                        key={ratio}
                        onClick={() => updateSelected({ ratio })}
                        className={`h-10 rounded-full border text-xs font-bold transition-all ${
                          active
                            ? 'bg-white text-black border-white'
                            : 'bg-black/35 border-white/10 text-white/45 hover:text-white hover:border-white/25'
                        }`}
                      >
                        {ratio}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl bg-[#151518] border border-white/[0.08] p-4">
                <span className="text-[11px] text-white/35">清晰度</span>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(['1K', '2K', '4K'] as const).map(quality => {
                    const active = selectedCard.quality === quality;
                    return (
                      <button
                        key={quality}
                        onClick={() => updateSelected({ quality })}
                        className={`h-10 rounded-full border text-xs font-bold transition-all ${
                          active
                            ? 'bg-[#8ab4f8] text-black border-[#8ab4f8]'
                            : 'bg-black/35 border-white/10 text-white/45 hover:text-white hover:border-white/25'
                        }`}
                      >
                        {quality}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl bg-[#151518] border border-white/[0.08] p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-[11px] text-white/35">提示词预览</span>
                  <span className="text-[10px] text-white/25">{promptPreview.length} chars</span>
                </div>
                <div className="rounded-2xl bg-black/45 border border-white/[0.08] p-3 min-h-[180px]">
                  <p className="text-xs leading-5 text-white/65 whitespace-pre-wrap break-words">
                    {promptPreview || '填写名称与描述后生成提示词预览。'}
                  </p>
                </div>
              </section>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#151518] border border-white/[0.08] p-5 text-sm text-white/40">
              新建或选择一张资产卡后可调整生成参数。
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
