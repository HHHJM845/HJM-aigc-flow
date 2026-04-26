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
  const [collapsed, setCollapsed] = useState(true);
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
      position: 'fixed',
      top: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      width: 260,
      background: 'rgba(15,15,25,0.85)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: 10,
      fontSize: 12,
      color: '#a5b4fc',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      overflow: 'hidden',
    }}>
      {/* 标题栏，点击收纳/展开 */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 12px', cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid rgba(99,102,241,0.15)',
        }}
      >
        <span style={{ fontWeight: 600, color: '#818cf8', fontSize: 11, letterSpacing: '0.03em' }}>
          ✦ 项目背景
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280', fontSize: 11 }}>
          {ctx.keyword && collapsed && (
            <span style={{ color: '#c4b5fd', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ctx.keyword}
            </span>
          )}
          <span style={{ fontSize: 10 }}>{collapsed ? '▼' : '▲'}</span>
        </span>
      </div>

      {/* 展开内容 */}
      {!collapsed && (
        <div style={{ padding: '8px 12px 10px', lineHeight: 1.65 }}>
          {FIELD_LABELS.filter(f => ctx[f.key] != null && ctx[f.key] !== '').map(({ key, label, multiline }) => (
            <div key={key} style={{ marginBottom: 7 }}>
              <div style={{ color: '#4b5563', fontSize: 10, marginBottom: 2 }}>{label}</div>
              {editing === key ? (
                <div>
                  {multiline ? (
                    <textarea
                      autoFocus
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      rows={3}
                      style={{
                        width: '100%', background: 'rgba(0,0,0,0.4)', color: '#e5e7eb',
                        border: '1px solid #4f46e5', borderRadius: 4,
                        padding: '4px 6px', fontSize: 11, resize: 'vertical', boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    <input
                      autoFocus
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      style={{
                        width: '100%', background: 'rgba(0,0,0,0.4)', color: '#e5e7eb',
                        border: '1px solid #4f46e5', borderRadius: 4,
                        padding: '4px 6px', fontSize: 11, boxSizing: 'border-box',
                      }}
                    />
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button onClick={() => saveField(key)} disabled={saving}
                      style={{ fontSize: 10, padding: '2px 8px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                      {saving ? '保存中…' : '保存'}
                    </button>
                    <button onClick={() => setEditing(null)}
                      style={{ fontSize: 10, padding: '2px 8px', background: 'transparent', color: '#9ca3af', border: '1px solid #374151', borderRadius: 4, cursor: 'pointer' }}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => startEdit(key)}
                  title="点击编辑"
                  style={{ cursor: 'pointer', color: '#c4b5fd', borderBottom: '1px dashed rgba(99,102,241,0.3)', paddingBottom: 1 }}
                >
                  {multiline
                    ? String(ctx[key]).slice(0, 80) + (String(ctx[key]).length > 80 ? '…' : '')
                    : String(ctx[key])}
                </div>
              )}
            </div>
          ))}

          {ctx.sceneCount !== undefined && (
            <div style={{ color: '#4b5563', marginTop: 4, fontSize: 11 }}>
              分镜数：<span style={{ color: '#a5b4fc' }}>{ctx.sceneCount} 个</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
