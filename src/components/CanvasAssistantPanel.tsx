// src/components/CanvasAssistantPanel.tsx
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, ImageIcon } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────
export interface RefNode {
  id: string;
  label: string;
  imageUrl?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  refNodeLabels?: string[];   // labels shown inside user bubble
  inlineImage?: string;       // assistant bubble may embed a generated image
}

interface Props {
  onClose: () => void;
  referencedNodes: RefNode[];
  onRemoveRef: (id: string) => void;
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string) => void;
}

// ── Component ────────────────────────────────────────────────
export default function CanvasAssistantPanel({
  onClose,
  referencedNodes,
  onRemoveRef,
  messages,
  loading,
  onSend,
}: Props) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [draft]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || loading) return;
    onSend(text);
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        width: 320,
        minWidth: 320,
        background: '#0a0a0a',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* ── Title bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <span style={{
          color: 'rgba(255,255,255,0.85)',
          fontWeight: 600,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ color: '#7c3aed', fontSize: 16 }}>✦</span>
          画布助手
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)',
            padding: 4,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Chat area ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          background: '#111111',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.length === 0 && !loading && (
          <div style={{
            color: 'rgba(255,255,255,0.25)',
            fontSize: 12,
            textAlign: 'center',
            marginTop: 32,
            lineHeight: 1.6,
          }}>
            选中画布节点，然后输入你的指令
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {/* Reference labels inside user bubble */}
            {msg.role === 'user' && msg.refNodeLabels && msg.refNodeLabels.length > 0 && (
              <div style={{
                display: 'flex',
                gap: 4,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                marginBottom: 4,
              }}>
                {msg.refNodeLabels.map((label, j) => (
                  <span key={j} style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(124,58,237,0.2)',
                    color: '#a78bfa',
                    border: '1px solid rgba(124,58,237,0.3)',
                  }}>
                    {label}
                  </span>
                ))}
              </div>
            )}

            <div style={{
              maxWidth: '90%',
              padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user' ? 'rgba(255,255,255,0.05)' : '#1a1a1a',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 13,
              lineHeight: 1.5,
              border: '1px solid rgba(255,255,255,0.06)',
              wordBreak: 'break-word',
            }}>
              {msg.text}
              {msg.inlineImage && (
                <img
                  src={msg.inlineImage}
                  alt="generated"
                  style={{
                    marginTop: 8,
                    width: '100%',
                    borderRadius: 8,
                    display: 'block',
                  }}
                />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{
              padding: '8px 16px',
              borderRadius: '12px 12px 12px 2px',
              background: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 18,
              letterSpacing: 4,
            }}>
              ···
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom input area ── */}
      <div style={{
        background: '#080808',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        {/* Referenced node thumbnails */}
        {referencedNodes.length > 0 && (
          <div style={{
            padding: '8px 12px 0',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}>
            {referencedNodes.map(node => (
              <div key={node.id} style={{ position: 'relative', display: 'inline-flex' }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  background: '#1a1a1a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {node.imageUrl ? (
                    <img
                      src={node.imageUrl}
                      alt={node.label}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}>
                      <ImageIcon size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{
                        fontSize: 8,
                        color: 'rgba(255,255,255,0.3)',
                        textAlign: 'center',
                        padding: '0 2px',
                        lineHeight: 1.2,
                      }}>
                        {node.label.slice(0, 6)}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onRemoveRef(node.id)}
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  <X size={8} style={{ color: 'rgba(255,255,255,0.6)' }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text input + send */}
        <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的指令..."
            rows={1}
            style={{
              flex: 1,
              background: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.85)',
              fontSize: 13,
              padding: '8px 12px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              minHeight: 36,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || loading}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: draft.trim() && !loading ? '#7c3aed' : 'rgba(124,58,237,0.3)',
              border: 'none',
              cursor: draft.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            <Send size={14} style={{ color: 'white' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
