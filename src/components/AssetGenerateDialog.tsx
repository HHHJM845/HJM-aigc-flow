// src/components/AssetGenerateDialog.tsx
import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Sparkles, ImagePlus } from 'lucide-react';
import type { AssetItem } from '../lib/storage';

type Category = 'character' | 'scene' | 'other';

interface Message {
  role: 'ai' | 'user';
  text: string;
  image?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAddAsset: (asset: AssetItem) => void;
}

const CATEGORY_OPTIONS: { key: Category; label: string; icon: string }[] = [
  { key: 'character', label: '人物', icon: '👤' },
  { key: 'scene', label: '场景', icon: '🏙' },
  { key: 'other', label: '其他', icon: '📦' },
];

const OPENING_GREETINGS: Record<Category, string> = {
  character: '你好！请描述你想要的人物形象，比如年龄、外貌、风格、情绪等。',
  scene: '你好！请描述你想要的场景，比如地点、时间、氛围、天气等。',
  other: '你好！请描述你需要的素材，比如道具、动物、特效等。',
};

const CATEGORY_LABELS: Record<Category, string> = {
  character: '人物',
  scene: '场景',
  other: '其他',
};

export default function AssetGenerateDialog({ open, onClose, onAddAsset }: Props) {
  const [category, setCategory] = useState<Category>('character');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: OPENING_GREETINGS['character'] },
  ]);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generatedImage]);

  // Reset conversation when category changes
  useEffect(() => {
    setMessages([{ role: 'ai', text: OPENING_GREETINGS[category] }]);
    setGeneratedImage(null);
  }, [category]);

  const apiMessages = () =>
    messages
      .filter(m => m.text)
      .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', text, image: referenceImage ?? undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setReferenceImage(null);
    setLoading(true);

    try {
      const resp = await fetch('/api/asset-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...apiMessages(), { role: 'user', content: text }],
          category,
          mode: 'chat',
        }),
      });
      const data = await resp.json() as { reply: string };
      setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      // Step 1: extract prompt from conversation
      const extractResp = await fetch('/api/asset-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages(), category, mode: 'extract-prompt' }),
      });
      const { reply: prompt } = await extractResp.json() as { reply: string };

      // Step 2: generate image
      const genBody: Record<string, unknown> = {
        prompt,
        ratio: '1:1',
        quality: '1K',
        count: 1,
      };
      if (referenceImage) genBody.referenceImages = [referenceImage];

      const genResp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(genBody),
      });
      const genData = await genResp.json() as { urls?: string[]; url?: string };
      const url = genData.urls?.[0] ?? genData.url ?? null;
      setGeneratedImage(url);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generatedImage) return;
    const ts = Date.now();
    onAddAsset({
      id: `asset_${ts}_${Math.random().toString(36).slice(2)}`,
      type: 'image',
      src: generatedImage,
      name: `${CATEGORY_LABELS[category]}_${ts}`,
      createdAt: ts,
      category,
    });
    onClose();
  };

  const handleRefImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setReferenceImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-[560px] max-h-[80vh] bg-[#141414] border border-white/10 rounded-2xl flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07] flex-shrink-0">
          <span className="text-white text-sm font-medium flex-1">✨ AI 生成素材</span>
          {/* Category selector */}
          <div className="flex items-center gap-1">
            {CATEGORY_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setCategory(opt.key)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  category === opt.key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-300 bg-white/5'
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" style={{ minHeight: 320 }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  msg.role === 'ai'
                    ? 'bg-white/[0.06] text-gray-200'
                    : 'bg-blue-600/80 text-white'
                }`}
              >
                {msg.image && (
                  <img src={msg.image} alt="参考图" className="w-20 h-20 object-cover rounded-lg mb-1.5" />
                )}
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/[0.06] text-gray-400 rounded-2xl px-3 py-2 text-sm">
                思考中…
              </div>
            </div>
          )}
          {generatedImage && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <img src={generatedImage} alt="生成结果" className="rounded-xl max-w-full max-h-64 object-contain border border-white/10" />
              <button
                onClick={handleSave}
                className="px-4 py-1.5 bg-emerald-700/80 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors"
              >
                保存到资产库
              </button>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.07] px-4 py-3 flex-shrink-0 space-y-2">
          {/* Reference image row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => refImageInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 rounded-lg text-xs transition-colors"
            >
              <ImagePlus size={12} />
              参考图
            </button>
            {referenceImage && (
              <div className="relative">
                <img src={referenceImage} alt="参考" className="w-8 h-8 object-cover rounded" />
                <button
                  onClick={() => setReferenceImage(null)}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X size={8} className="text-white" />
                </button>
              </div>
            )}
            <input
              ref={refImageInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleRefImageChange}
            />
          </div>
          {/* Input row */}
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="描述你想要的素材…"
              className="flex-1 bg-white/[0.05] border border-white/[0.08] text-white text-sm rounded-xl px-3 py-2 outline-none placeholder-gray-600 focus:border-white/20"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-sm transition-colors"
            >
              <Send size={14} />
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || messages.length < 2}
              className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl text-sm transition-colors flex items-center gap-1"
            >
              <Sparkles size={14} />
              {generating ? '生成中…' : '生成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
