import React, { useEffect, useRef, useState } from 'react';

interface Props {
  username: string;
  onLogout: () => void;
}

const CHANGELOG = [
  { version: 'v0.9.3', date: '2026-04-05', notes: ['新增 NLE 专业剪辑界面', '资产上传改为服务端存储', 'FFmpeg 合成导出支持'] },
  { version: 'v0.9.2', date: '2026-04-04', notes: ['主界面配色重设计', '选题灵感界面', 'AI 字幕批量生成'] },
  { version: 'v0.9.1', date: '2026-04-02', notes: ['资产库全新 UI', '登录界面', 'Ken Burns 背景动效'] },
];

export default function UserMenu({ username, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initial = username.charAt(0).toUpperCase() || 'U';

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowChangelog(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleLogout = () => {
    sessionStorage.removeItem('loggedIn');
    sessionStorage.removeItem('username');
    setOpen(false);
    onLogout();
  };

  return (
    <div ref={menuRef} className="fixed top-4 right-4 z-[9999]" style={{ fontFamily: 'Inter' }}>
      {/* Avatar button */}
      <button
        onClick={() => { setOpen(v => !v); setShowChangelog(false); }}
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
          open
            ? 'bg-[#e0dfdf] text-black shadow-lg'
            : 'bg-[#1e1e1e] text-[#aaa] border border-[#2a2a2a] hover:border-[#3a3a3a] hover:text-white'
        }`}
      >
        {initial}
      </button>

      {/* Dropdown */}
      {open && !showChangelog && (
        <div
          className="absolute top-11 right-0 w-52 rounded-2xl border border-[#2a2a2a] bg-[#161616] shadow-2xl shadow-black/60 overflow-hidden"
          style={{ backdropFilter: 'blur(12px)' }}
        >
          {/* User info */}
          <div className="px-4 py-3 border-b border-[#222]">
            <p className="text-[12px] text-[#888] font-medium truncate">{username}</p>
          </div>

          {/* Points */}
          <div className="px-4 py-3 flex items-center gap-2.5 border-b border-[#1a1a1a]">
            <span className="material-symbols-outlined text-[#555] text-[15px]">timer</span>
            <span className="text-[13px] text-[#aaa]">330 积分</span>
          </div>

          {/* Changelog */}
          <button
            onClick={() => setShowChangelog(true)}
            className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-white/[0.04] transition-colors border-b border-[#1a1a1a]"
          >
            <span className="material-symbols-outlined text-[#555] text-[15px]">description</span>
            <span className="text-[13px] text-[#aaa]">更新日志</span>
          </button>

          {/* Settings */}
          <button
            className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-white/[0.04] transition-colors border-b border-[#1a1a1a]"
            onClick={() => setOpen(false)}
          >
            <span className="material-symbols-outlined text-[#555] text-[15px]">settings</span>
            <span className="text-[13px] text-[#aaa]">个人设置</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-white/[0.04] transition-colors"
          >
            <span className="material-symbols-outlined text-red-500/70 text-[15px]">logout</span>
            <span className="text-[13px] text-red-500/80">退出登录</span>
          </button>
        </div>
      )}

      {/* Changelog panel */}
      {open && showChangelog && (
        <div
          className="absolute top-11 right-0 w-72 rounded-2xl border border-[#2a2a2a] bg-[#161616] shadow-2xl shadow-black/60 overflow-hidden"
          style={{ backdropFilter: 'blur(12px)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#222]">
            <button
              onClick={() => setShowChangelog(false)}
              className="text-[#555] hover:text-[#aaa] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            </button>
            <span className="text-[12px] font-semibold text-[#888]">更新日志</span>
          </div>

          {/* Entries */}
          <div className="max-h-72 overflow-y-auto">
            {CHANGELOG.map(entry => (
              <div key={entry.version} className="px-4 py-3 border-b border-[#1a1a1a] last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-bold text-[#ccc]">{entry.version}</span>
                  <span className="text-[10px] text-[#444]">{entry.date}</span>
                </div>
                <ul className="space-y-1">
                  {entry.notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-[#666]">
                      <span className="text-[#333] mt-0.5">·</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
