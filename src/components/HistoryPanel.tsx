import React, { useState, useMemo } from 'react';
import { Search, Film } from 'lucide-react';
import type { HistoryItem } from '../lib/storage';

interface Props {
  history: HistoryItem[];
  onUseItem: (item: HistoryItem) => void;
}

function groupByDate(items: HistoryItem[]): { label: string; items: HistoryItem[] }[] {
  const today = new Date().setHours(0, 0, 0, 0);
  const yesterday = today - 86400000;

  const groups: Record<string, HistoryItem[]> = {};
  items.forEach(item => {
    const d = new Date(item.createdAt).setHours(0, 0, 0, 0);
    const label = d >= today ? '今天 Today' : d >= yesterday ? '昨天 Yesterday' : '更早 Earlier';
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });

  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

export default function HistoryPanel({ history, onUseItem }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    return history.filter(h => h.nodeLabel.toLowerCase().includes(search.toLowerCase()));
  }, [history, search]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <div className="absolute left-16 top-1/2 -translate-y-1/2 z-40 w-[320px] max-h-[70vh] bg-[#141414] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06] flex-shrink-0">
        <Search size={13} className="text-gray-500 flex-shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search History..."
          className="flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-600 focus:outline-none"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-xs text-center gap-2">
            <p>生成图片或视频后<br />将记录在这里</p>
          </div>
        ) : (
          groups.map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs text-gray-500 font-medium mb-2">{label}</p>
              <div className="grid grid-cols-2 gap-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    onClick={() => onUseItem(item)}
                    className="relative group rounded-xl overflow-hidden border border-white/10 cursor-pointer aspect-video bg-black/30 hover:border-white/25 transition-colors"
                  >
                    {item.type === 'image' ? (
                      <img src={item.src} alt={item.nodeLabel} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <Film size={20} className="text-gray-500" />
                      </div>
                    )}
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white/70 font-medium uppercase">
                      {item.type === 'image' ? 'IMAGE 图像' : 'VIDEO 视频'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
