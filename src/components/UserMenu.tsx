import React, { useEffect, useRef, useState } from 'react';
import { type NotificationItem } from './NotificationBell';

interface Props {
  username: string;
  role?: string;
  onLogout: () => void;
  onNavigateAdmin?: () => void;
  notifications?: NotificationItem[];
  onRead?: (id: string) => void;
  onReadAll?: (projectId: string) => void;
  onNavigate?: (projectId: string, rowId: string) => void;
  showAssistant?: boolean;
  onToggleAssistant?: () => void;
}

const CHANGELOG = [
  { version: 'v0.9.3', date: '2026-04-05', notes: ['新增 NLE 专业剪辑界面', '资产上传改为服务端存储', 'FFmpeg 合成导出支持'] },
  { version: 'v0.9.2', date: '2026-04-04', notes: ['主界面配色重设计', '选题灵感界面', 'AI 字幕批量生成'] },
  { version: 'v0.9.1', date: '2026-04-02', notes: ['资产库全新 UI', '登录界面', 'Ken Burns 背景动效'] },
];

const STATUS_COLOR: Record<string, string> = {
  approved: 'rgba(80,200,120,0.8)',
  revision: 'rgba(255,140,60,0.8)',
};

type Panel = 'main' | 'changelog' | 'notifications';

export default function UserMenu({ username, role = 'user', onLogout, onNavigateAdmin, notifications = [], onRead, onReadAll, onNavigate, sidebarOpen = false, showAssistant = false, onToggleAssistant }: Props & { sidebarOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>('main');
  const menuRef = useRef<HTMLDivElement>(null);

  const initial = username.charAt(0).toUpperCase() || 'U';
  const unreadCount = notifications.filter(n => n.read === 0).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPanel('main');
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
    <div ref={menuRef} className="fixed top-4 z-[9999] flex items-center gap-2" style={{ fontFamily: 'Inter', right: sidebarOpen ? 336 : 16, transition: 'right 0.2s ease' }}>
      {/* Avatar button */}
      <button
        onClick={() => { setOpen(v => !v); setPanel('main'); }}
        className={`relative w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
          open
            ? 'bg-[#e0dfdf] text-black shadow-lg'
            : 'bg-[#1e1e1e] text-[#aaa] border border-[#2a2a2a] hover:border-[#3a3a3a] hover:text-white'
        }`}
      >
        {initial}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border border-black flex items-center justify-center text-[7px] text-white font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Canvas Assistant toggle */}
      {onToggleAssistant && (
        <button
          onClick={onToggleAssistant}
          title="画布助手"
          className={`w-9 h-9 flex items-center justify-center rounded-full text-base transition-all ${
            showAssistant
              ? 'bg-[#7c3aed]/30 text-[#a78bfa] ring-1 ring-[#7c3aed]/40 shadow-lg'
              : 'bg-[#1e1e1e] text-[#aaa] border border-[#2a2a2a] hover:border-[#3a3a3a] hover:text-white'
          }`}
        >
          ✦
        </button>
      )}

      {/* Main dropdown */}
      {open && panel === 'main' && (
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

          {/* Notifications */}
          <button
            onClick={() => setPanel('notifications')}
            className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-white/[0.04] transition-colors border-b border-[#1a1a1a]"
          >
            <span className="material-symbols-outlined text-[#555] text-[15px]">notifications</span>
            <span className="text-[13px] text-[#aaa] flex-1 text-left">批注通知</span>
            {unreadCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[8px] text-white font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Changelog */}
          <button
            onClick={() => setPanel('changelog')}
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

          {/* Admin */}
          {role === 'admin' && (
            <button
              onClick={() => { setOpen(false); onNavigateAdmin?.(); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-gray-300 hover:bg-white/[0.06] hover:text-white transition-colors text-left border-b border-[#1a1a1a]"
              style={{ fontFamily: 'Inter' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>manage_accounts</span>
              用户管理
            </button>
          )}

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

      {/* Notifications panel */}
      {open && panel === 'notifications' && (
        <div
          className="absolute top-11 right-0 w-80 rounded-2xl border border-[#2a2a2a] bg-[#161616] shadow-2xl shadow-black/60 overflow-hidden"
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#222]">
            <button
              onClick={() => setPanel('main')}
              className="text-[#555] hover:text-[#aaa] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            </button>
            <span className="text-[12px] font-semibold text-[#888] flex-1">批注通知</span>
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  const ids = [...new Set(notifications.map(n => n.projectId))];
                  ids.forEach(id => onReadAll?.(id));
                }}
                className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
              >
                全部已读
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-white/25 text-center py-8">暂无批注通知</p>
            ) : (
              notifications.slice(0, 20).map(n => (
                <button
                  key={n.id}
                  onClick={() => {
                    onNavigate?.(n.projectId, n.rowId);
                    onRead?.(n.id);
                    setOpen(false);
                    setPanel('main');
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                    style={{ background: STATUS_COLOR[n.status] ?? 'rgba(255,255,255,0.3)', opacity: n.read ? 0.4 : 1 }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/60 mb-0.5" style={{ opacity: n.read ? 0.5 : 1 }}>
                      镜头 {String(n.rowIndex + 1).padStart(2, '0')} ·{' '}
                      <span style={{ color: STATUS_COLOR[n.status] }}>
                        {n.status === 'approved' ? '已通过' : '需修改'}
                      </span>
                    </p>
                    {n.comment && (
                      <p className="text-[10px] text-white/35 truncate">"{n.comment}"</p>
                    )}
                  </div>
                  {n.read === 0 && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Changelog panel */}
      {open && panel === 'changelog' && (
        <div
          className="absolute top-11 right-0 w-72 rounded-2xl border border-[#2a2a2a] bg-[#161616] shadow-2xl shadow-black/60 overflow-hidden"
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#222]">
            <button
              onClick={() => setPanel('main')}
              className="text-[#555] hover:text-[#aaa] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            </button>
            <span className="text-[12px] font-semibold text-[#888]">更新日志</span>
          </div>
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
