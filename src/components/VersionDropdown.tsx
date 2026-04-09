import React, { useState, useEffect, useRef } from 'react';

export interface SnapshotSummary {
  id: string;
  project_id: string;
  label: string | null;
  auto: number;
  created_at: number;
}

interface Props {
  projectId: string;
  currentLabel?: string;
  hasUnsavedChanges: boolean;
  onRestore: (snapshotId: string) => Promise<void>;
  onSaveSnapshot: (label: string) => Promise<void>;
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return '刚刚';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} 分钟前`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} 小时前`;
  if (d < 86_400_000 * 2) return '昨天';
  return `${Math.floor(d / 86_400_000)} 天前`;
}

export default function VersionDropdown({
  projectId,
  currentLabel,
  hasUnsavedChanges,
  onRestore,
  onSaveSnapshot,
}: Props) {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<SnapshotSummary | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load snapshots when dropdown opens
  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}/snapshots`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSnapshots(data as SnapshotSummary[]))
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowSaveInput(false);
        setConfirmRestore(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const latestLabel = snapshots[0]?.label ?? currentLabel ?? '当前版本';

  const doRestore = async (snapshot: SnapshotSummary) => {
    setRestoring(snapshot.id);
    try {
      await onRestore(snapshot.id);
      setOpen(false);
      setConfirmRestore(null);
    } finally {
      setRestoring(null);
    }
  };

  const handleRestoreClick = (snapshot: SnapshotSummary) => {
    if (hasUnsavedChanges) {
      setConfirmRestore(snapshot);
    } else {
      doRestore(snapshot);
    }
  };

  const handleSaveSnapshot = async () => {
    if (!saveLabel.trim() || saving) return;
    setSaving(true);
    try {
      await onSaveSnapshot(saveLabel.trim());
      setSaveLabel('');
      setShowSaveInput(false);
      // Refresh snapshots list
      const data = await fetch(`/api/projects/${projectId}/snapshots`).then(r => r.json());
      setSnapshots(data as SnapshotSummary[]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef} style={{ fontFamily: 'Inter' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/40 hover:text-white/60 border border-white/10 rounded-lg hover:border-white/20 transition-all bg-white/3"
      >
        <span className="material-symbols-outlined text-[13px]">history</span>
        <span className="max-w-[100px] truncate">{latestLabel}</span>
        <span className="text-white/20">▾</span>
        {hasUnsavedChanges && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="有未保存的修改" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-10 z-50 w-64 bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">版本历史</p>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {loading ? (
              <p className="text-xs text-white/25 text-center py-4">加载中...</p>
            ) : snapshots.length === 0 ? (
              <p className="text-xs text-white/25 text-center py-4">暂无版本记录</p>
            ) : (
              snapshots.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
                  style={{ background: i === 0 ? 'rgba(200,190,220,0.05)' : undefined }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {i === 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-300/60 flex-shrink-0" />
                      )}
                      <p className="text-xs text-white/60 truncate">{s.label ?? '未命名快照'}</p>
                    </div>
                    <p className="text-[10px] text-white/25 mt-0.5 ml-3.5">{timeAgo(s.created_at)}</p>
                  </div>
                  {i > 0 && (
                    <button
                      onClick={() => handleRestoreClick(s)}
                      disabled={restoring === s.id}
                      className="ml-3 text-[10px] text-purple-300/50 hover:text-purple-300/80 transition-colors flex-shrink-0 disabled:opacity-40"
                    >
                      {restoring === s.id ? '还原中...' : '↩ 还原'}
                    </button>
                  )}
                  {i === 0 && (
                    <span className="text-[10px] text-white/25 ml-2 flex-shrink-0">当前</span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Save snapshot */}
          <div className="border-t border-white/8 p-3">
            {showSaveInput ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={saveLabel}
                  onChange={e => setSaveLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveSnapshot();
                    if (e.key === 'Escape') { setShowSaveInput(false); setSaveLabel(''); }
                  }}
                  placeholder="如：v2·第二轮修改"
                  className="flex-1 bg-black/30 border border-white/12 rounded-lg px-2.5 py-1.5 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-white/25"
                />
                <button
                  onClick={handleSaveSnapshot}
                  disabled={!saveLabel.trim() || saving}
                  className="px-2.5 py-1.5 text-xs font-bold bg-white/90 text-black rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                >
                  {saving ? '...' : '存'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                className="w-full text-xs text-white/30 hover:text-white/50 transition-colors text-center py-1"
              >
                + 保存当前为快照
              </button>
            )}
          </div>
        </div>
      )}

      {/* Restore confirm dialog */}
      {confirmRestore && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
          onClick={e => { if (e.target === e.currentTarget) setConfirmRestore(null); }}
        >
          <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-5 w-80 shadow-2xl" style={{ fontFamily: 'Inter' }}>
            <h3 className="text-sm font-bold text-white/80 mb-2" style={{ fontFamily: 'Manrope' }}>还原到此版本？</h3>
            <p className="text-xs text-white/40 mb-1">"{confirmRestore.label ?? '未命名快照'}"</p>
            <p className="text-xs text-amber-400/70 mb-5">当前有未保存的修改，还原后将丢失。</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  await onSaveSnapshot(`还原前自动保存 · ${new Date().toLocaleTimeString('zh-CN')}`);
                  await doRestore(confirmRestore);
                }}
                className="w-full py-2 text-xs font-bold bg-white/8 text-white/70 rounded-xl hover:bg-white/12 transition-colors border border-white/10"
              >
                先保存当前再还原
              </button>
              <button
                onClick={() => doRestore(confirmRestore)}
                className="w-full py-2 text-xs text-red-400/70 hover:text-red-400 transition-colors"
              >
                直接还原（放弃当前修改）
              </button>
              <button
                onClick={() => setConfirmRestore(null)}
                className="w-full py-2 text-xs text-white/30 hover:text-white/50 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
