import React, { useEffect, useState, useCallback } from 'react';

interface ImageNodeItem {
  rowId: string;
  imageUrl: string | null;
}

interface StoryboardRowItem {
  id: string;
  index: number;
  shotType: string;
  description: string;
}

interface SnapshotData {
  storyboardOrder: string[];
  storyboardRows: StoryboardRowItem[];
  imageNodes: ImageNodeItem[];
}

interface ReviewData {
  shareId: string;
  projectId: string;
  projectName: string;
  snapshotData: SnapshotData;
  expiresAt: number;
}

interface AnnotationItem {
  id: string;
  share_id: string;
  row_index: number;
  row_id: string;
  status: 'pending' | 'approved' | 'revision';
  comment: string;
  created_at: number;
}

interface FrameItem {
  rowIndex: number;
  rowId: string;
  shotType: string;
  description: string;
  imageUrl: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'rgba(80, 200, 120, 0.8)',
  revision: 'rgba(255, 140, 60, 0.8)',
  pending: 'rgba(255, 255, 255, 0.2)',
};

const STATUS_LABELS: Record<string, string> = {
  approved: '✓ 已通过',
  revision: '↩ 需修改',
  pending: '待审核',
};

export default function ReviewPage() {
  const token = window.location.pathname.split('/r/')[1]?.split('/')[0] ?? '';
  const [data, setData] = useState<ReviewData | null>(null);
  const [annotations, setAnnotations] = useState<Map<string, AnnotationItem>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commentInput, setCommentInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setError('无效链接'); setLoading(false); return; }
    Promise.all([
      fetch(`/api/review/${token}`).then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch(`/api/review/${token}/annotations`).then(r => r.ok ? r.json() : []),
    ])
      .then(([reviewData, anns]: [ReviewData, AnnotationItem[]]) => {
        setData(reviewData);
        const map = new Map<string, AnnotationItem>();
        anns.forEach(a => map.set(a.row_id, a));
        setAnnotations(map);
      })
      .catch(err => setError(err === 410 ? 'link_expired' : '加载失败'))
      .finally(() => setLoading(false));
  }, [token]);

  const frames: FrameItem[] = data
    ? data.snapshotData.storyboardOrder.map((rowId, i) => {
        const row = data.snapshotData.storyboardRows.find(r => r.id === rowId);
        const imgNode = data.snapshotData.imageNodes.find(n => n.rowId === rowId);
        return {
          rowIndex: i,
          rowId,
          shotType: row?.shotType ?? '',
          description: row?.description ?? '',
          imageUrl: imgNode?.imageUrl ?? null,
        };
      })
    : [];

  const selectedFrame = frames[selectedIndex] ?? null;
  const selectedAnnotation = selectedFrame ? annotations.get(selectedFrame.rowId) : undefined;

  const handleAnnotate = useCallback(async (status: 'approved' | 'revision') => {
    if (!selectedFrame || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`/api/review/${token}/annotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: selectedFrame.rowIndex,
          rowId: selectedFrame.rowId,
          status,
          comment: commentInput.trim(),
        }),
      });
      setAnnotations(prev => {
        const next = new Map(prev);
        next.set(selectedFrame.rowId, {
          id: '',
          share_id: data!.shareId,
          row_index: selectedFrame.rowIndex,
          row_id: selectedFrame.rowId,
          status,
          comment: commentInput.trim(),
          created_at: Date.now(),
        });
        return next;
      });
      setCommentInput('');
    } finally {
      setSubmitting(false);
    }
  }, [selectedFrame, commentInput, token, data, submitting]);

  // ── Error states ──
  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-white/30 text-sm" style={{ fontFamily: 'Inter' }}>加载中...</p>
    </div>
  );
  if (error === 'link_expired') return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-3">
      <p className="text-white/50 text-base" style={{ fontFamily: 'Manrope' }}>此审片链接已过期</p>
      <p className="text-white/25 text-sm" style={{ fontFamily: 'Inter' }}>请联系工作室获取新链接</p>
    </div>
  );
  if (error || !data) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-white/30 text-sm">{error ?? '加载失败'}</p>
    </div>
  );

  const totalFrames = frames.length;
  const approvedCount = frames.filter(f => annotations.get(f.rowId)?.status === 'approved').length;
  const revisionCount = frames.filter(f => annotations.get(f.rowId)?.status === 'revision').length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col" style={{ fontFamily: 'Inter' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/8">
        <h1 className="text-sm font-bold text-white/70" style={{ fontFamily: 'Manrope' }}>
          {data.projectName}
        </h1>
        <div className="flex items-center gap-4 text-xs text-white/25">
          <span>共 {totalFrames} 镜</span>
          {approvedCount > 0 && <span style={{ color: STATUS_COLORS.approved }}>{approvedCount} 通过</span>}
          {revisionCount > 0 && <span style={{ color: STATUS_COLORS.revision }}>{revisionCount} 需修改</span>}
          <span>7天内有效</span>
        </div>
      </div>

      {/* Main: left grid + right detail */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 57px - 40px)' }}>

        {/* Left: thumbnail grid */}
        <div className="w-72 flex-shrink-0 overflow-y-auto p-4 border-r border-white/8">
          <div className="grid grid-cols-3 gap-2">
            {frames.map((frame, i) => {
              const ann = annotations.get(frame.rowId);
              const isSelected = i === selectedIndex;
              return (
                <button
                  key={frame.rowId}
                  onClick={() => { setSelectedIndex(i); setCommentInput(''); }}
                  className="relative aspect-[4/3] rounded-lg overflow-hidden border transition-all"
                  style={{
                    borderColor: isSelected ? 'rgba(200,190,220,0.6)' : 'rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  {frame.imageUrl ? (
                    <img src={frame.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-white/15 text-xl">image</span>
                    </div>
                  )}
                  {/* Status badge */}
                  <div
                    className="absolute top-1 right-1 w-2 h-2 rounded-full"
                    style={{ background: STATUS_COLORS[ann?.status ?? 'pending'] }}
                  />
                  {/* Index */}
                  <div className="absolute bottom-1 left-1 text-[8px] text-white/40 bg-black/50 px-1 rounded">
                    {String(frame.rowIndex + 1).padStart(2, '0')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail */}
        {selectedFrame ? (
          <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 max-w-2xl">
            {/* Big image */}
            <div className="w-full aspect-video bg-black/40 rounded-xl overflow-hidden border border-white/8 flex items-center justify-center">
              {selectedFrame.imageUrl ? (
                <img src={selectedFrame.imageUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="material-symbols-outlined text-white/15 text-5xl">image</span>
              )}
            </div>

            {/* Shot info */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-white/8 border border-white/10 rounded-full px-2 py-0.5 text-white/45">
                  {selectedFrame.shotType || '镜头'}
                </span>
                <span className="text-xs text-white/30">
                  镜头 {String(selectedFrame.rowIndex + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{selectedFrame.description}</p>
            </div>

            {/* Current status */}
            {selectedAnnotation && (
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[selectedAnnotation.status] }} />
                <span style={{ color: STATUS_COLORS[selectedAnnotation.status] }}>
                  {STATUS_LABELS[selectedAnnotation.status]}
                </span>
                {selectedAnnotation.comment && (
                  <span className="text-white/35 ml-2">"{selectedAnnotation.comment}"</span>
                )}
              </div>
            )}

            {/* Annotation input */}
            <div className="border border-white/8 rounded-xl p-4 bg-white/3">
              <p className="text-xs text-white/30 mb-3">批注（可选）</p>
              <textarea
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                placeholder="输入对此镜头的意见..."
                rows={3}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:border-white/25 resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAnnotate('approved')}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(80,200,120,0.15)', color: 'rgba(80,200,120,0.9)', border: '1px solid rgba(80,200,120,0.3)' }}
                >
                  ✓ 标记通过
                </button>
                <button
                  onClick={() => handleAnnotate('revision')}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(255,140,60,0.12)', color: 'rgba(255,140,60,0.85)', border: '1px solid rgba(255,140,60,0.3)' }}
                >
                  ↩ 需要修改
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/20 text-sm">选择左侧镜头查看详情</p>
          </div>
        )}
      </div>

      {/* Footer watermark */}
      <div className="h-10 flex items-center justify-center border-t border-white/5">
        <p className="text-[10px] text-white/15">
          由 JM AIGC Studio 制作
          <a href="/" className="ml-2 text-white/25 hover:text-white/40 transition-colors underline">
            免费注册 →
          </a>
        </p>
      </div>
    </div>
  );
}
