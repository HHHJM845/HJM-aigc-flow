// src/components/AgentContextPanel.tsx
import React, { useEffect, useState } from 'react';
import { getProjectContext, updateProjectContext, type ProjectContext } from '../lib/api';

interface Props {
  projectId: string;
  refreshTrigger?: number;
}

const FIELD_LABELS: { key: keyof ProjectContext; label: string; multiline?: boolean }[] = [
  { key: 'keyword',       label: '主题' },
  { key: 'selectedTopic', label: '选题标题' },
  { key: 'topicInsight',  label: '风格方向', multiline: true },
  { key: 'scriptSummary', label: '剧本摘要', multiline: true },
];

export default function AgentContextPanel({ projectId, refreshTrigger = 0 }: Props) {
  const [ctx, setCtx]         = useState<ProjectContext>({});
  const [editing, setEditing] = useState<keyof ProjectContext | null>(null);
  const [draft, setDraft]     = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!projectId) return;
    getProjectContext(projectId).then(setCtx);
  }, [projectId, refreshTrigger]);

  const hasData = ctx.keyword || ctx.sceneCount || ctx.selectedTopic;
  if (!hasData) return null;

  async function saveField(key: keyof ProjectContext) {
    setSaving(true);
    const updated = await updateProjectContext(projectId, { [key]: draft });
    setCtx(updated);
    setEditing(null);
    setSaving(false);
  }

  function startEdit(key: keyof ProjectContext) {
    setDraft(String(ctx[key] ?? ''));
    setEditing(key);
  }

  return (
    <div style={{
      background: 'rgba(99,102,241,0.08)',
      border: '1px solid rgba(99,102,241,0.2)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      color: '#a5b4fc',
      lineHeight: 1.7,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: '#818cf8' }}>
        项目背景（Agent 共享）
      </div>

      {FIELD_LABELS.filter(f => ctx[f.key] != null && ctx[f.key] !== '').map(({ key, label, multiline }) => (
        <div key={key} style={{ marginBottom: 6 }}>
          <span style={{ color: '#6b7280' }}>{label}：</span>
          {editing === key ? (
            <span>
              {multiline ? (
                <textarea
                  autoFocus
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%', marginTop: 4, background: 'rgba(0,0,0,0.3)',
                    color: '#e5e7eb', border: '1px solid #4f46e5', borderRadius: 4,
                    padding: '4px 6px', fontSize: 12, resize: 'vertical',
                  }}
                />
              ) : (
                <input
                  autoFocus
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  style={{
                    width: '100%', marginTop: 4, background: 'rgba(0,0,0,0.3)',
                    color: '#e5e7eb', border: '1px solid #4f46e5', borderRadius: 4,
                    padding: '4px 6px', fontSize: 12,
                  }}
                />
              )}
              <span style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button
                  onClick={() => saveField(key)}
                  disabled={saving}
                  style={{ fontSize: 11, padding: '2px 8px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  {saving ? '保存中…' : '保存'}
                </button>
                <button
                  onClick={() => setEditing(null)}
                  style={{ fontSize: 11, padding: '2px 8px', background: 'transparent', color: '#9ca3af', border: '1px solid #374151', borderRadius: 4, cursor: 'pointer' }}
                >
                  取消
                </button>
              </span>
            </span>
          ) : (
            <span
              onClick={() => startEdit(key)}
              title="点击编辑"
              style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(99,102,241,0.4)' }}
            >
              {multiline
                ? String(ctx[key]).slice(0, 100) + (String(ctx[key]).length > 100 ? '…' : '')
                : String(ctx[key])}
            </span>
          )}
        </div>
      ))}

      {ctx.sceneCount !== undefined && (
        <div style={{ color: '#6b7280', marginTop: 2 }}>
          分镜数：<span style={{ color: '#a5b4fc' }}>{ctx.sceneCount} 个</span>
          <span style={{ marginLeft: 6, fontSize: 10, color: '#4b5563' }}>（自动同步，不可编辑）</span>
        </div>
      )}
    </div>
  );
}
