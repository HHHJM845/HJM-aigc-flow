import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export interface TemplateFormData {
  name: string;
  genre: string;
  nodeType: 'image' | 'video';
  promptPreset: string;
  styleTag: string;
  compositionTip: string;
  cameraParams: string;
  durationHint: string;
  audioHint: string;
}

const GENRES = ['古风武侠', '都市情感', '科幻奇幻', '微短剧爆款', '自定义'];

const EMPTY: TemplateFormData = {
  name: '', genre: '古风武侠', nodeType: 'image', promptPreset: '',
  styleTag: '', compositionTip: '', cameraParams: '', durationHint: '', audioHint: '',
};

interface Props {
  open: boolean;
  initial?: Partial<TemplateFormData> & { id?: string };
  onClose: () => void;
  onSave: (data: TemplateFormData, id?: string) => Promise<void>;
}

export default function TemplateFormDrawer({ open, initial, onClose, onSave }: Props) {
  const [form, setForm] = useState<TemplateFormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...EMPTY, ...initial });
  }, [open, initial]);

  const set = (k: keyof TemplateFormData, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.promptPreset.trim()) return;
    setSaving(true);
    try { await onSave(form, initial?.id); onClose(); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-[400px] h-full bg-[#1c1c20] border-l border-white/8 flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <span className="text-white font-medium text-sm">
            {initial?.id ? '编辑模板' : '新建模板'}
          </span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 节点类型 */}
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">节点类型</label>
            <div className="flex gap-2">
              {(['image', 'video'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => set('nodeType', t)}
                  className={`px-4 py-1.5 rounded-lg text-[12px] transition-colors border ${
                    form.nodeType === t
                      ? 'bg-white/10 text-white border-white/20'
                      : 'text-gray-500 border-white/8 hover:text-gray-300'
                  }`}
                >
                  {t === 'image' ? '图片' : '视频'}
                </button>
              ))}
            </div>
          </div>

          {/* 名称 */}
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">模板名称 *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="如：古风·开场航拍"
              className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20"
            />
          </div>

          {/* 题材 */}
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">题材分类</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => (
                <button
                  key={g}
                  onClick={() => set('genre', g)}
                  className={`px-3 py-1 rounded-full text-[11px] transition-colors border ${
                    form.genre === g
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'text-gray-500 border-white/8 hover:text-gray-300'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 提示词预设 */}
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">提示词预设 *</label>
            <textarea
              value={form.promptPreset}
              onChange={e => set('promptPreset', e.target.value)}
              placeholder="核心提示词，AI 将以此为基底与用户输入融合"
              rows={4}
              className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20 resize-none"
            />
          </div>

          {/* 图片模板专属 */}
          {form.nodeType === 'image' && (
            <>
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">画风标签</label>
                <input
                  value={form.styleTag}
                  onChange={e => set('styleTag', e.target.value)}
                  placeholder="如：中国水墨/暖色调"
                  className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">构图建议</label>
                <input
                  value={form.compositionTip}
                  onChange={e => set('compositionTip', e.target.value)}
                  placeholder="如：三分法/低角度仰拍"
                  className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20"
                />
              </div>
            </>
          )}

          {/* 视频模板专属 */}
          {form.nodeType === 'video' && (
            <>
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">运镜参数</label>
                <input
                  value={form.cameraParams}
                  onChange={e => set('cameraParams', e.target.value)}
                  placeholder="如：缓慢推进+俯拍45°"
                  className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">建议时长（秒）</label>
                <input
                  value={form.durationHint}
                  onChange={e => set('durationHint', e.target.value)}
                  type="number"
                  min={4} max={12}
                  placeholder="如：5"
                  className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">音效建议</label>
                <input
                  value={form.audioHint}
                  onChange={e => set('audioHint', e.target.value)}
                  placeholder="如：古筝背景音/无音效"
                  className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.promptPreset.trim()}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
