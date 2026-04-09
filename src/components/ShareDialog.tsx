import React, { useState } from 'react';

interface Props {
  projectName: string;
  shareUrl: string;
  expiresAt: number;
  onClose: () => void;
}

export default function ShareDialog({ projectName, shareUrl, expiresAt, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const fullUrl = `${window.location.origin}${shareUrl}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const expiryDate = new Date(expiresAt).toLocaleDateString('zh-CN', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-96 shadow-2xl" style={{ fontFamily: 'Inter' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-[#e8e6e4]" style={{ fontFamily: 'Manrope' }}>
            审片链接已生成
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none">×</button>
        </div>

        <p className="text-xs text-white/35 mb-2">{projectName} · 快照已保存</p>

        <div className="bg-black/40 border border-white/10 rounded-xl p-3 mb-4 flex items-center gap-3">
          <span className="flex-1 text-xs text-white/50 truncate font-mono">{fullUrl}</span>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex-shrink-0"
            style={{
              background: copied ? 'rgba(80,200,120,0.2)' : 'rgba(255,255,255,0.08)',
              color: copied ? 'rgba(80,200,120,0.9)' : 'rgba(255,255,255,0.6)',
              border: copied ? '1px solid rgba(80,200,120,0.3)' : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {copied ? '已复制 ✓' : '复制'}
          </button>
        </div>

        <p className="text-[10px] text-white/25 mb-5">
          <span className="material-symbols-outlined text-[11px] align-middle mr-1">schedule</span>
          链接有效期至 {expiryDate}，甲方无需注册即可查看和批注
        </p>

        <button
          onClick={onClose}
          className="w-full py-2.5 text-xs font-bold bg-white/90 text-black rounded-xl hover:bg-white transition-colors"
        >
          完成
        </button>
      </div>
    </div>
  );
}
