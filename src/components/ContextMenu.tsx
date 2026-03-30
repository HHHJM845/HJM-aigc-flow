import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Type, Image as ImageIcon, Video, PenTool } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  sourceNodeType?: string | null;
  onClose: () => void;
  onAction: (action: string) => void;
}

export default function ContextMenu({ x, y, visible, sourceNodeType, onClose, onAction }: ContextMenuProps) {
  const isFromTextNode = sourceNodeType === 'textNode';
  const isFromVideoNode = sourceNodeType === 'videoNode';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed z-50 w-56 bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          style={{ top: y, left: x }}
        >
          <div className="px-4 py-3 text-sm font-medium text-gray-400 border-b border-white/5">
            {isFromTextNode ? '根据文本生成' : isFromVideoNode ? '根据视频生成' : '引用该节点生成'}
          </div>
          <div className="p-2 flex flex-col gap-1">
            {!isFromTextNode && (
              <MenuButton icon={<Type size={18} />} label="文本生成" onClick={() => onAction('text')} />
            )}
            {!isFromVideoNode && (
              <MenuButton icon={<ImageIcon size={18} />} label="图片生成" onClick={() => onAction('image')} />
            )}
            {!isFromVideoNode && (
              <MenuButton icon={<Video size={18} />} label="视频生成" onClick={() => onAction('video')} />
            )}
            {!isFromTextNode && !isFromVideoNode && (
              <MenuButton icon={<PenTool size={18} />} label="图片编辑器" onClick={() => onAction('editor')} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex items-center gap-3 px-3 py-2.5 text-[15px] text-gray-200 hover:bg-white/10 rounded-lg transition-colors text-left w-full"
    >
      <span className="text-gray-400">{icon}</span>
      {label}
    </button>
  );
}
