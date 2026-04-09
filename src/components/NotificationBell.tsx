import React, { useState } from 'react';

export interface NotificationItem {
  id: string;
  projectId: string;
  shareId: string;
  rowIndex: number;
  rowId: string;
  status: string;
  comment: string;
  createdAt: number;
  read: number;
}

interface Props {
  notifications: NotificationItem[];
  onRead: (id: string) => void;
  onReadAll: (projectId: string) => void;
  onNavigate: (projectId: string, rowId: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  approved: 'rgba(80,200,120,0.8)',
  revision: 'rgba(255,140,60,0.8)',
};

export default function NotificationBell({ notifications, onRead, onReadAll, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter(n => n.read === 0).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-8 h-8 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unreadCount > 0 && (
          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[8px] text-white font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden" style={{ fontFamily: 'Inter' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <span className="text-xs font-bold text-white/60">批注通知</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    const ids = [...new Set(notifications.map(n => n.projectId))];
                    ids.forEach(id => onReadAll(id));
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
                      onNavigate(n.projectId, n.rowId);
                      onRead(n.id);
                      setOpen(false);
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
        </>
      )}
    </div>
  );
}
