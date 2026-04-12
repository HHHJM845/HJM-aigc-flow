import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  Panel,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type OnConnectEnd
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import ImageNode from './components/ImageNode';
import TextNode from './components/TextNode';
import VideoNode from './components/VideoNode';
import ContextMenu from './components/ContextMenu';
import CustomEdge from './components/CustomEdge';
import BreakdownView from './components/BreakdownView';
import HomePage from './components/HomePage';
import { type NewProjectData } from './components/NewProjectDialog';
import LoginView from './components/LoginView';
import LeftToolbar, { type ActiveTool } from './components/LeftToolbar';
import BoardNode from './components/BoardNode';
import CommentNode from './components/CommentNode';
import AssetPanel from './components/AssetPanel';
import AssetManagerView from './components/AssetManagerView';
import HistoryPanel from './components/HistoryPanel';
import BottomTabBar, { type ActiveView } from './components/BottomTabBar';
import StoryboardView from './components/StoryboardView';
import { type StoryboardRow, generateVideoPrompt } from './lib/api';
import {
  createProject,
  extractThumbnail,
  type Project,
  type AssetItem,
  type HistoryItem,
  type VideoOrderItem,
} from './lib/storage';
import VideoView from './components/VideoView';
import TopicView from './components/TopicView';
import TemplateLibraryView from './components/TemplateLibraryView';
import { useSync } from './hooks/useSync';
import { FileText } from 'lucide-react';
import UserMenu from './components/UserMenu';
import { type NotificationItem } from './components/NotificationBell';
import type { AnnotationData } from './components/AnnotationBubble';
import CanvasAssistantPanel, { type RefNode, type ChatMessage } from './components/CanvasAssistantPanel';

const nodeTypes = {
  imageNode: ImageNode,
  textNode: TextNode,
  videoNode: VideoNode,
  boardNode: BoardNode,
  commentNode: CommentNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const COLS = 5;
const NODE_W = 380;
const NODE_H = 320;
const GAP_X = 60;
const GAP_Y = 80;

function rowsToNodes(rows: StoryboardRow[], cardW = NODE_W, cardH = NODE_H, ratio = '16:9'): Node[] {
  return rows.map((row, i) => ({
    id: `storyboard-${row.id}`,
    type: 'imageNode' as const,
    position: {
      x: (i % COLS) * (cardW + GAP_X) + 80,
      y: Math.floor(i / COLS) * (cardH + GAP_Y) + 80,
    },
    width: cardW,
    height: cardH,
    data: {
      label: `分镜${row.index.toString().padStart(2, '0')}${row.shotType ? ' · ' + row.shotType : ''}`,
      contentType: 'image',
      content: null,
      shotDescription: row.description,
      ratio,
    },
  }));
}

function Flow({
  initialNodes,
  initialEdges,
  initialStoryboardRows,
  initialAssets,
  initialHistory,
  onGoHome,
  onSave,
  onSaveRows,
  onSaveAssets,
  onSaveHistory,
  initialStoryboardOrder,
  onSaveStoryboardOrder,
  initialVideoOrder,
  onSaveVideoOrder,
  projectName,
  externalNodes,
  externalEdges,
  externalHistory,
  connected = true,
  initialTopicDraft,
  onSaveTopicDraft,
  initialTopicKeyword,
  projectId,
  annotations = [],
  annotationSuggestions,
  annotationSuggestionsLoading,
  onDismissSuggestion,
  onApplySuggestion,
  revisionNodeRequest,
  onAssistantChange,
}: {
  initialNodes: Node[];
  initialEdges: Edge[];
  initialStoryboardRows: StoryboardRow[];
  initialAssets: AssetItem[];
  initialHistory: HistoryItem[];
  onGoHome: () => void;
  onSave: (nodes: Node[], edges: Edge[]) => void;
  onSaveRows: (rows: StoryboardRow[]) => void;
  onSaveAssets: (assets: AssetItem[]) => void;
  onSaveHistory: (history: HistoryItem[]) => void;
  initialStoryboardOrder: string[];
  onSaveStoryboardOrder: (order: string[]) => void;
  initialVideoOrder: VideoOrderItem[];
  onSaveVideoOrder: (order: VideoOrderItem[]) => void;
  projectName: string;
  externalNodes?: Node[] | null;
  externalEdges?: Edge[] | null;
  externalHistory?: HistoryItem[] | null;
  connected?: boolean;
  initialTopicDraft: string;
  onSaveTopicDraft: (draft: string) => void;
  initialTopicKeyword?: string;
  projectId?: string;
  annotations?: AnnotationData[];
  annotationSuggestions?: Map<string, { suggestedPrompt: string; reason: string; comment: string; rowIndex: number; status: 'pending' | 'dismissed' }>;
  annotationSuggestionsLoading?: boolean;
  onDismissSuggestion?: (rowId: string) => void;
  onApplySuggestion?: (rowId: string, prompt: string, rowIndex: number) => void;
  revisionNodeRequest?: { sourceNodeId: string; newNodeId: string; prompt: string; rowIndex: number; } | null;
  onAssistantChange?: (open: boolean) => void;
}) {
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const [storyboardRows, setStoryboardRows] = useState<StoryboardRow[]>(initialStoryboardRows);
  const [activeView, setActiveView] = useState<ActiveView>(initialTopicKeyword ? 'topic' : 'canvas');
  const [topicDraft, setTopicDraft] = useState(initialTopicDraft);
  const [breakdownInitText, setBreakdownInitText] = useState('');
  const [storyboardOrder, setStoryboardOrder] = useState<string[]>(initialStoryboardOrder);
  const [videoOrder, setVideoOrder] = useState<VideoOrderItem[]>(initialVideoOrder);

  // Toolbar state
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [showAssets, setShowAssets] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // ── Canvas Assistant state ─────────────────────────────────
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<ChatMessage[]>([]);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantRefNodes, setAssistantRefNodes] = useState<RefNode[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>(initialAssets);
  const [generationHistory, setGenerationHistory] = useState<HistoryItem[]>(initialHistory);

  // Board drag-create state (screen coordinates)
  const [boardDraft, setBoardDraft] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const isDraggingBoard = useRef(false);

  const [menu, setMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    sourceNodeId: string | null;
    sourceNodeType: string | null;
    sourceHandleId: string | null;
  }>({
    isOpen: false, x: 0, y: 0,
    sourceNodeId: null, sourceNodeType: null, sourceHandleId: null,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Guard: prevents external-applied updates from triggering auto-save loop
  const isApplyingExternal = useRef(false);

  // Apply remote canvas updates pushed from App (another client edited the project)
  useEffect(() => {
    if (!externalNodes || !externalEdges) return;
    isApplyingExternal.current = true;
    setNodes(externalNodes);
    setEdges(externalEdges);
    if (externalHistory) setGenerationHistory(externalHistory);
    const t = setTimeout(() => { isApplyingExternal.current = false; }, 200);
    return () => clearTimeout(t);
  }, [externalNodes, externalEdges, externalHistory, setNodes, setEdges]);

  // Handle revision node addition from BreakdownView suggestions
  useEffect(() => {
    if (!revisionNodeRequest) return;
    const { sourceNodeId, newNodeId, prompt, rowIndex } = revisionNodeRequest;
    const sourceNode = nodesRef.current.find(n => n.id === sourceNodeId);
    const baseX = sourceNode ? sourceNode.position.x + 420 : 200;
    const baseY = sourceNode ? sourceNode.position.y : 200;
    const revisionNode: Node = {
      id: newNodeId,
      type: 'imageNode',
      position: { x: baseX, y: baseY },
      width: 380,
      height: 214,
      data: {
        label: `修改版 · #${rowIndex}`,
        contentType: 'image',
        content: [],
        initialPrompt: prompt,
        onPlusClick: handlePlusClick,
        onUpdate: handleUpdateNode,
      },
    };
    setNodes(nds => [...nds, revisionNode]);
  }, [revisionNodeRequest]);

  // 自动保存：nodes 或 edges 变化后 3 秒防抖通过 onSave → wsSaveProject 同步到服务器
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      // Skip save if this render was triggered by an incoming remote update.
      // The 3s debounce outlasts the 200ms isApplyingExternal window, so by
      // the time this fires the flag is clear for any genuine local edits.
      if (!isApplyingExternal.current) {
        onSave(nodesRef.current, edgesRef.current);
      }
    }, 3000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [nodes, edges]);

  // Esc exits active tool
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveTool(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleGoHome = () => {
    onSave(nodesRef.current, edgesRef.current);
    onGoHome();
  };

  const handleImportFromBreakdown = useCallback(async (rows: StoryboardRow[], ratio: string, cardW: number, cardH: number) => {
    setStoryboardRows(rows);
    onSaveRows(rows);
    const newNodes = rowsToNodes(rows, cardW, cardH, ratio);
    setNodes(newNodes);
    setEdges([]);
    setActiveView('canvas');

    // AI asset matching — runs after nodes appear on canvas
    if (assets.length > 0) {
      try {
        const resp = await fetch('/api/match-assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: rows.map(r => ({ id: r.id, description: r.description ?? '' })),
            assets: assets.map(a => ({ id: a.id, name: a.name, category: a.category })),
          }),
        });
        if (resp.ok) {
          const { matches } = await resp.json() as { matches: { rowId: string; assetId: string }[] };
          const assetMap = new Map(assets.map(a => [a.id, a]));
          setNodes(prev => prev.map(node => {
            const match = matches.find(m => `storyboard-${m.rowId}` === node.id);
            if (match) {
              const asset = assetMap.get(match.assetId);
              if (asset) return { ...node, data: { ...node.data, referenceImage: asset.src } };
            }
            return node;
          }));
        }
      } catch {
        // Silent fail — asset matching is best-effort
      }
    }
  }, [setNodes, setEdges, onSaveRows, assets]);

  const handleUpdateNode = useCallback((id: string, newData: any) => {
    // Record generated content to history
    if (newData.content) {
      const contents = Array.isArray(newData.content) ? newData.content : [newData.content];
      const node = nodesRef.current.find(n => n.id === id);
      const isVideo = node?.type === 'videoNode';
      const newItems: HistoryItem[] = contents
        .filter((src: string) => typeof src === 'string' && src.length > 0)
        .map((src: string) => ({
          id: `hist_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type: (isVideo ? 'video' : 'image') as 'image' | 'video',
          src,
          nodeLabel: String(node?.data?.label || ''),
          createdAt: Date.now(),
        }));
      if (newItems.length > 0) {
        setGenerationHistory(prev => {
          const updated = [...newItems, ...prev];
          onSaveHistory(updated);
          return updated;
        });
      }
    }

    setNodes(nds => nds.map(node => {
      if (node.id !== id) return node;
      const { _width, _height, ...rest } = newData;
      const updated = { ...node, data: { ...node.data, ...rest } };
      if (_width != null) updated.width = _width;
      if (_height != null) updated.height = _height;
      return updated;
    }));
  }, [setNodes, onSaveHistory]);

  const handlePlusClick = useCallback((event: React.MouseEvent, nodeId: string) => {
    event.stopPropagation();
    const node = getNodes().find(n => n.id === nodeId);
    setMenu({ isOpen: true, x: event.clientX, y: event.clientY, sourceNodeId: nodeId, sourceNodeType: node?.type || null, sourceHandleId: 'right' });
  }, [getNodes]);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes(nds => {
      const target = nds.find(n => n.id === id);
      if (target?.type === 'boardNode') {
        const childIds = new Set(nds.filter(n => n.parentId === id).map(n => n.id));
        if (childIds.size > 0) {
          setStoryboardOrder(prev => {
            const next = prev.filter(nodeId => !childIds.has(nodeId));
            onSaveStoryboardOrder(next);
            return next;
          });
        }
        return nds.filter(n => n.id !== id && n.parentId !== id);
      }
      return nds.filter(n => n.id !== id);
    });
  }, [setNodes, setStoryboardOrder, onSaveStoryboardOrder]);

  const handleToggleStoryboard = useCallback((nodeId: string) => {
    setStoryboardOrder(prev => {
      const next = prev.includes(nodeId)
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId];
      onSaveStoryboardOrder(next);
      return next;
    });
  }, [onSaveStoryboardOrder]);

  const handleExportStoryboardToCanvas = useCallback(async () => {
    const COLS = 4;
    const NODE_W = 380;
    const NODE_H = 214;
    const GAP_X = 60;
    const GAP_Y = 60;

    // 找现有节点 bounding box 最右边，新节点从右侧追加
    const currentNodes = nodesRef.current;
    const startX = currentNodes.length > 0
      ? Math.max(...currentNodes.map(n => n.position.x + (n.width ?? NODE_W))) + 80
      : 80;
    const startY = 80;

    // 收集每个分镜的图片和描述
    const items = storyboardOrder.map((nodeId, i) => {
      const node = currentNodes.find(n => n.id === nodeId);
      const content = node?.data?.content;
      const contentArr = Array.isArray(content) ? content : (content ? [content] : []);
      const imageSrc = (contentArr[0] as string) || '';
      const shotDesc = (node?.data?.shotDescription as string) || '';
      return { nodeId, imageSrc, shotDesc, index: i + 1 };
    });

    // 并行调 AI 生成视频提示词，单个失败不阻断
    const promptResults = await Promise.allSettled(
      items.map(item => generateVideoPrompt(item.shotDesc))
    );

    const newNodes: Node[] = items.map((item, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = startX + col * (NODE_W + GAP_X);
      const y = startY + row * (NODE_H + GAP_Y);
      const optimizedPrompt =
        promptResults[i].status === 'fulfilled' ? promptResults[i].value : '';

      return {
        id: `export_${item.nodeId}_${Date.now()}_${i}`,
        type: 'videoNode' as const,
        position: { x, y },
        width: NODE_W,
        height: NODE_H,
        data: {
          label: `分镜 ${String(item.index).padStart(2, '0')}`,
          contentType: 'video',
          content: null,
          referenceImage: item.imageSrc || undefined,
          initialPrompt: optimizedPrompt,
          onPlusClick: handlePlusClick,
          onUpdate: handleUpdateNode,
        },
      };
    });

    setNodes(nds => [...nds, ...newNodes]);
    setActiveView('canvas');
  }, [storyboardOrder, nodesRef, setNodes, setActiveView, handlePlusClick, handleUpdateNode]);

  const handleToggleVideo = useCallback((nodeId: string, url: string, label: string) => {
    setVideoOrder(prev => {
      const exists = prev.find(v => v.nodeId === nodeId && v.url === url);
      const next = exists
        ? prev.filter(v => v.id !== exists.id)
        : [...prev, { id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, nodeId, url, label }];
      onSaveVideoOrder(next);
      return next;
    });
  }, [onSaveVideoOrder]);

  // ── Board drag-create ────────────────────────────────
  const handleBoardDragStart = useCallback((e: React.MouseEvent) => {
    if (activeTool !== 'board') return;
    e.preventDefault();
    isDraggingBoard.current = true;
    setBoardDraft({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });
  }, [activeTool]);

  const handleBoardDragMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingBoard.current) return;
    setBoardDraft(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
  }, []);

  const handleBoardDragEnd = useCallback((e: React.MouseEvent) => {
    if (!isDraggingBoard.current || !boardDraft) return;
    isDraggingBoard.current = false;

    const screenW = Math.abs(boardDraft.currentX - boardDraft.startX);
    const screenH = Math.abs(boardDraft.currentY - boardDraft.startY);

    if (screenW < 30 || screenH < 30) {
      setBoardDraft(null);
      return;
    }

    const topLeft = screenToFlowPosition({
      x: Math.min(boardDraft.startX, boardDraft.currentX),
      y: Math.min(boardDraft.startY, boardDraft.currentY),
    });
    const bottomRight = screenToFlowPosition({
      x: Math.max(boardDraft.startX, boardDraft.currentX),
      y: Math.max(boardDraft.startY, boardDraft.currentY),
    });
    const boardW = bottomRight.x - topLeft.x;
    const boardH = bottomRight.y - topLeft.y;
    const boardId = `board_${Date.now()}`;

    const boardNode: Node = {
      id: boardId,
      type: 'boardNode',
      position: topLeft,
      width: boardW,
      height: boardH,
      zIndex: -1,
      data: { label: '未命名画板', onUpdate: handleUpdateNode },
    };

    // Auto-assign nodes inside board as children
    setNodes(nds => {
      const updatedChildren = nds.map(n => {
        if (n.type === 'boardNode' || n.type === 'commentNode' || n.parentId) return n;
        const cx = n.position.x + (n.width || 380) / 2;
        const cy = n.position.y + (n.height || 300) / 2;
        const inside = cx >= topLeft.x && cx <= topLeft.x + boardW &&
                       cy >= topLeft.y && cy <= topLeft.y + boardH;
        if (inside) {
          return { ...n, parentId: boardId, position: { x: n.position.x - topLeft.x, y: n.position.y - topLeft.y } };
        }
        return n;
      });
      const childrenOfBoard = updatedChildren.filter(n => n.parentId === boardId);
      const otherNodes = updatedChildren.filter(n => n.parentId !== boardId);
      return [...otherNodes, boardNode, ...childrenOfBoard];
    });

    setBoardDraft(null);
    setActiveTool(null);
  }, [boardDraft, screenToFlowPosition, setNodes, handleUpdateNode]);

  // ── parentId assignment on drag stop ────────────────
  const onNodeDragStop = useCallback((_: React.MouseEvent, draggedNode: Node, allNodes: Node[]) => {
    if (draggedNode.type === 'boardNode' || draggedNode.type === 'commentNode') return;
    const boards = allNodes.filter(n => n.type === 'boardNode');
    if (boards.length === 0 && !draggedNode.parentId) return;

    // 计算节点的绝对坐标
    // 若节点有 parentId，其 position 是相对坐标，需加上父节点的绝对坐标
    let absX = draggedNode.position.x;
    let absY = draggedNode.position.y;
    if (draggedNode.parentId) {
      const parent = allNodes.find(n => n.id === draggedNode.parentId);
      if (parent) {
        absX += parent.position.x;
        absY += parent.position.y;
      }
    }

    // 用节点中心点判断是否落入画板
    const centerX = absX + (draggedNode.width || 380) / 2;
    const centerY = absY + (draggedNode.height || 300) / 2;

    // boardNode 的 position 始终是绝对坐标（boardNode 自身无 parentId）
    const containingBoard = boards.find(board => {
      const bw = board.width || 600;
      const bh = board.height || 400;
      return centerX >= board.position.x && centerX <= board.position.x + bw &&
             centerY >= board.position.y && centerY <= board.position.y + bh;
    });

    const newParentId = containingBoard?.id;
    // parentId 未变化时不做任何更新，避免无效 setNodes
    if (draggedNode.parentId === newParentId) return;

    setNodes(nds => nds.map(n => {
      if (n.id !== draggedNode.id) return n;
      if (newParentId && containingBoard) {
        // 落入新画板：转换为相对坐标
        return {
          ...n,
          parentId: newParentId,
          position: {
            x: absX - containingBoard.position.x,
            y: absY - containingBoard.position.y,
          },
        };
      }
      // 离开所有画板：使用绝对坐标，清除 parentId
      return { ...n, parentId: undefined, position: { x: absX, y: absY } };
    }));
  }, [setNodes]);

  // ── Comment creation ─────────────────────────────────
  const onPaneClick = useCallback((event: React.MouseEvent) => {
    closeMenu();
    if (activeTool === 'comment') {
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const commentId = `comment_${Date.now()}`;
      const commentNode: Node = {
        id: commentId,
        type: 'commentNode',
        position: { x: pos.x - 18, y: pos.y - 18 },
        width: 36,
        height: 36,
        data: {
          text: '',
          author: '少军 黄',
          authorInitials: '少军',
          createdAt: Date.now(),
          onUpdate: handleUpdateNode,
          onDelete: handleDeleteNode,
        },
      };
      setNodes(nds => [...nds, commentNode]);
      setActiveTool(null);
    }
  }, [activeTool, screenToFlowPosition, setNodes, handleUpdateNode]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    if (activeTool) return;
    event.preventDefault();
    setMenu({ isOpen: true, x: event.clientX, y: event.clientY, sourceNodeId: null, sourceNodeType: null, sourceHandleId: null });
  }, [activeTool]);

  const closeMenu = useCallback(() => setMenu(prev => ({ ...prev, isOpen: false })), []);

  // ── Asset handlers ───────────────────────────────────
  const handleAssetUpload = useCallback((newItems: AssetItem[]) => {
    setAssets(prev => {
      const updated = [...newItems, ...prev];
      onSaveAssets(updated);
      return updated;
    });
  }, [onSaveAssets]);

  const handleAssetRemove = useCallback((id: string) => {
    setAssets(prev => {
      const updated = prev.filter(a => a.id !== id);
      onSaveAssets(updated);
      return updated;
    });
  }, [onSaveAssets]);

  const handleAssetRename = useCallback((id: string, name: string) => {
    setAssets(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, name } : a);
      onSaveAssets(updated);
      return updated;
    });
  }, [onSaveAssets]);

  const handleAddAsset = useCallback((asset: AssetItem) => {
    setAssets(prev => {
      const updated = [asset, ...prev];
      onSaveAssets(updated);
      return updated;
    });
  }, [onSaveAssets]);

  // ── Canvas Assistant ─────────────────────────────────────
  const showAssistantRef = useRef(false);
  useEffect(() => {
    showAssistantRef.current = showAssistant;
    onAssistantChange?.(showAssistant);
  }, [showAssistant, onAssistantChange]);

  const handleSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    if (!showAssistantRef.current) return;
    const imageNodes = selectedNodes.filter(n => n.type === 'imageNode');
    if (imageNodes.length === 0) return;
    setAssistantRefNodes(prev => {
      const existingIds = new Set(prev.map(r => r.id));
      const toAdd = imageNodes
        .filter(n => !existingIds.has(n.id))
        .map(n => ({
          id: n.id,
          label: String(n.data?.label ?? n.id),
          imageUrl: Array.isArray(n.data?.content)
            ? (n.data.content[0] as string | undefined)
            : (n.data?.content as string | undefined),
        }));
      const combined = [...prev, ...toAdd];
      return combined.slice(0, 4);
    });
  }, []);

  const handleExecuteOperations = useCallback(async (
    operations: Array<
      | { op: 'update_prompt';  nodeId: string; newPrompt: string }
      | { op: 'update_label';   nodeId: string; newLabel: string }
      | { op: 'insert_node';    afterNodeId: string; label: string; prompt: string }
      | { op: 'delete_node';    nodeId: string }
      | { op: 'generate_image'; nodeId: string }
    >,
    onImageGenerated: (nodeId: string, url: string) => void,
  ) => {
    const idMap: Record<string, string> = {};
    const resolveId = (id: string) => idMap[id] ?? id;

    for (const op of operations) {
      try {
        if (op.op === 'update_prompt') {
          handleUpdateNode(resolveId(op.nodeId), { initialPrompt: op.newPrompt });

        } else if (op.op === 'update_label') {
          handleUpdateNode(resolveId(op.nodeId), { label: op.newLabel });

        } else if (op.op === 'insert_node') {
          const afterId = resolveId(op.afterNodeId);
          const newId = `canvas_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          idMap[`new_${op.afterNodeId}`] = newId;

          const afterNode = nodesRef.current.find(n => n.id === afterId);
          const baseX = (afterNode?.position?.x ?? 0) + (afterNode?.width ?? 380) + 32;
          const baseY = afterNode?.position?.y ?? 100;

          const newNode: Node = {
            id: newId,
            type: 'imageNode',
            position: { x: baseX, y: baseY },
            width: 380,
            height: 214,
            data: {
              label: op.label,
              initialPrompt: op.prompt,
              content: null,
              onPlusClick: handlePlusClick,
              onUpdate: handleUpdateNode,
              onAddAsset: handleAddAsset,
            },
          };
          setNodes(nds => [...nds, newNode]);

        } else if (op.op === 'delete_node') {
          handleDeleteNode(resolveId(op.nodeId));

        } else if (op.op === 'generate_image') {
          const nodeId = resolveId(op.nodeId);
          const targetNode = nodesRef.current.find(n => n.id === nodeId);
          const prompt = String(targetNode?.data?.initialPrompt ?? targetNode?.data?.label ?? '');

          handleUpdateNode(nodeId, { isGenerating: true });
          try {
            const resp = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt, count: 1, ratio: '16:9', quality: '2K' }),
            });
            const data = await resp.json() as { urls?: string[]; error?: string };
            if (data.urls?.[0]) {
              handleUpdateNode(nodeId, { content: data.urls[0], isGenerating: false });
              onImageGenerated(nodeId, data.urls[0]);
            } else {
              handleUpdateNode(nodeId, { isGenerating: false });
            }
          } catch {
            handleUpdateNode(nodeId, { isGenerating: false });
          }
        }
      } catch (err) {
        console.error('[canvas-assistant] op failed:', op, err);
      }
    }
  }, [handleUpdateNode, handleDeleteNode, handlePlusClick, handleAddAsset, setNodes]);

  const handleAssistantSend = useCallback(async (text: string) => {
    const allNodes = nodesRef.current.filter(n => n.type === 'imageNode');
    const refIds = new Set(assistantRefNodes.map(r => r.id));

    const referencedNodes = assistantRefNodes.map(r => {
      const node = allNodes.find(n => n.id === r.id);
      return {
        id: r.id,
        label: r.label,
        prompt: String(node?.data?.initialPrompt ?? node?.data?.label ?? ''),
        imageUrl: r.imageUrl,
      };
    });

    const otherNodes = allNodes.filter(n => !refIds.has(n.id));
    let canvasNodes: { id: string; label: string; index: number }[] = [];
    if (otherNodes.length <= 20) {
      canvasNodes = otherNodes.map((n, i) => ({ id: n.id, label: String(n.data?.label ?? n.id), index: i }));
    } else {
      const refIndices = assistantRefNodes
        .map(r => allNodes.findIndex(n => n.id === r.id))
        .filter(i => i >= 0);
      const neighborSet = new Set<number>();
      refIndices.forEach(idx => {
        for (let d = -3; d <= 3; d++) {
          const ni = idx + d;
          if (ni >= 0 && ni < allNodes.length && !refIds.has(allNodes[ni].id)) {
            neighborSet.add(ni);
          }
        }
      });
      canvasNodes = [...neighborSet].sort((a, b) => a - b).map(i => ({
        id: allNodes[i].id,
        label: String(allNodes[i].data?.label ?? allNodes[i].id),
        index: i,
      }));
    }

    const userMsg: ChatMessage = {
      role: 'user',
      text,
      refNodeLabels: assistantRefNodes.map(r => r.label),
    };
    setAssistantMessages(prev => [...prev, userMsg]);
    setAssistantRefNodes([]);
    setAssistantLoading(true);

    try {
      const resp = await fetch('/api/agent/canvas-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, referencedNodes, canvasNodes }),
      });
      const result = await resp.json() as { reply: string; operations: Array<Record<string, unknown>> };

      let lastGeneratedUrl: string | undefined;
      await handleExecuteOperations(
        result.operations as Parameters<typeof handleExecuteOperations>[0],
        (_nodeId, url) => { lastGeneratedUrl = url; },
      );

      setAssistantMessages(prev => [...prev, {
        role: 'assistant',
        text: result.reply,
        inlineImage: lastGeneratedUrl,
      }]);
    } catch (err) {
      setAssistantMessages(prev => [...prev, {
        role: 'assistant',
        text: '抱歉，执行时遇到了问题，请稍后重试。',
      }]);
      console.error('[canvas-assistant] send error:', err);
    } finally {
      setAssistantLoading(false);
    }
  }, [assistantRefNodes, handleExecuteOperations]);

  const handleHistoryUse = useCallback((item: HistoryItem) => {
    const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const newId = `from_hist_${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type: item.type === 'video' ? 'videoNode' : 'imageNode',
      position: { x: pos.x - 190, y: pos.y - 107 },
      width: 380,
      height: 214,
      data: { label: item.nodeLabel || '历史图片', contentType: item.type, content: [item.src], onPlusClick: handlePlusClick, onUpdate: handleUpdateNode },
    };
    setNodes(nds => [...nds, newNode]);
    setShowHistory(false);
  }, [screenToFlowPosition, setNodes, handlePlusClick, handleUpdateNode]);

  // ── Asset drag-to-canvas ─────────────────────────────
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const assetType = e.dataTransfer.getData('application/asset-type') as 'image' | 'video' | '';
    const assetSrc = e.dataTransfer.getData('application/asset-src');
    const assetName = e.dataTransfer.getData('application/asset-name');
    if (!assetType || !assetSrc) return;

    // 若 drop 到已有节点上，由 ImageNode/VideoNode 的 onDrop 先拦截；
    // 走到这里说明 drop 在空白画布，创建新节点
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newId = `dropped_${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type: assetType === 'video' ? 'videoNode' : 'imageNode',
      position: { x: pos.x - 190, y: pos.y - 107 },
      width: 380,
      height: 214,
      data: { label: assetName || '素材', contentType: assetType, content: [assetSrc], onPlusClick: handlePlusClick, onUpdate: handleUpdateNode },
    };
    setNodes(nds => [...nds, newNode]);
  }, [screenToFlowPosition, setNodes, handlePlusClick, handleUpdateNode]);

  // ── Context menu action ──────────────────────────────
  const onAction = useCallback((action: string) => {
    const position = screenToFlowPosition({ x: menu.x, y: menu.y });
    const newNodeId = `${Date.now()}`;
    const actionLabels: Record<string, string> = { text: '文本生成', image: '图片生成', video: '视频生成', editor: '图片编辑器' };
    const nodeSizes: Record<string, { width: number; height: number }> = {
      image: { width: 380, height: 214 }, video: { width: 380, height: 214 }, text: { width: 380, height: 300 },
    };
    const { width: nw, height: nh } = nodeSizes[action] ?? { width: 380, height: 300 };
    const newNode: Node = {
      id: newNodeId,
      type: action === 'text' ? 'textNode' : action === 'video' ? 'videoNode' : 'imageNode',
      position, width: nw, height: nh,
      data: { label: actionLabels[action] || '新节点', contentType: action, content: null, onPlusClick: handlePlusClick, onUpdate: handleUpdateNode },
    };
    setNodes(nds => nds.concat(newNode));
    if (menu.sourceNodeId) {
      setEdges(eds => eds.concat({
        id: `e-${menu.sourceNodeId}-${newNodeId}`,
        source: menu.sourceNodeId!, sourceHandle: menu.sourceHandleId || 'right',
        target: newNodeId, targetHandle: 'left', type: 'custom',
      }));
    }
    closeMenu();
  }, [menu, screenToFlowPosition, setNodes, setEdges, closeMenu, handlePlusClick, handleUpdateNode]);

  // ── Node data enrichment ─────────────────────────────
  const nodesWithHandlers = nodes.map(node => {
    const getFirstImageFromNode = (n: Node) => {
      if (n.type !== 'imageNode' || !n.data.content) return undefined;
      const contents = Array.isArray(n.data.content) ? n.data.content : [n.data.content];
      return contents[0] || undefined;
    };

    const referenceImage = (() => {
      if (node.type !== 'imageNode' && node.type !== 'videoNode') return undefined;
      for (const edge of edges) {
        if (edge.target !== node.id) continue;
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode) { const img = getFirstImageFromNode(sourceNode); if (img) return img; }
      }
      return undefined;
    })();

    const sourceImage = (() => {
      if (node.type !== 'textNode') return undefined;
      for (const edge of edges) {
        if (edge.target !== node.id) continue;
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode) { const img = getFirstImageFromNode(sourceNode); if (img) return img; }
      }
      return undefined;
    })();

    return {
      ...node,
      data: {
        ...node.data,
        onPlusClick: handlePlusClick,
        onUpdate: handleUpdateNode,
        onDelete: handleDeleteNode,
        referenceImage,
        sourceImage,
        ...(node.type === 'imageNode' ? {
          isInStoryboard: storyboardOrder.includes(node.id),
          onToggleStoryboard: handleToggleStoryboard,
          assets: assets,
          onAddAsset: handleAddAsset,
          onNavigateToTemplates: () => setActiveView('templates'),
        } : {}),
        ...(node.type === 'videoNode' ? {
          videoOrderUrls: videoOrder.map(v => v.url),
          onToggleVideo: handleToggleVideo,
          onNavigateToTemplates: () => setActiveView('templates'),
        } : {}),
      },
    };
  });

  const edgesWithHighlight = edges.map(edge => {
    const sourceSelected = nodes.find(n => n.id === edge.source)?.selected;
    const targetSelected = nodes.find(n => n.id === edge.target)?.selected;
    return { ...edge, data: { ...edge.data, isHighlighted: sourceSelected || targetSelected } };
  });

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({ ...params, type: 'custom' } as Edge, eds)),
    [setEdges],
  );

  const onConnectEnd: OnConnectEnd = useCallback((event, connectionState) => {
    if (!connectionState.isValid && connectionState.fromNode && connectionState.fromHandle?.type === 'source') {
      const clientX = 'clientX' in event ? (event as MouseEvent).clientX : (event as TouchEvent).changedTouches?.[0]?.clientX ?? 0;
      const clientY = 'clientY' in event ? (event as MouseEvent).clientY : (event as TouchEvent).changedTouches?.[0]?.clientY ?? 0;
      setTimeout(() => {
        setMenu({ isOpen: true, x: clientX, y: clientY, sourceNodeId: connectionState.fromNode?.id || null, sourceNodeType: connectionState.fromNode?.type || null, sourceHandleId: connectionState.fromHandle?.id || null });
      }, 50);
    }
  }, []);

  const handleSnapshotRestore = async (snapshotId: string) => {
    const res = await fetch(`/api/snapshots/${snapshotId}/restore`, { method: 'POST' });
    if (!res.ok) throw new Error('restore failed');
    // WS broadcast will trigger useSync to update project state
  };

  const handleSaveSnapshot = async (label: string) => {
    if (!projectId) return;
    await fetch(`/api/projects/${projectId}/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
  };

  return (
    <div className="w-screen h-screen bg-[#000000] overflow-hidden relative">

      {/* Canvas view */}
      <div
        className="absolute inset-0"
        style={{
          opacity: activeView === 'canvas' ? 1 : 0,
          transform: activeView === 'canvas' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
          pointerEvents: activeView === 'canvas' ? 'auto' : 'none',
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleCanvasDrop}
      >
        <div className="w-full h-full" style={{ display: 'flex', flexDirection: 'row' }}>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <ReactFlow
            nodes={nodesWithHandlers}
            edges={edgesWithHighlight}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onMoveStart={closeMenu}
            onNodeDragStop={onNodeDragStop}
            onSelectionChange={handleSelectionChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'custom' }}
            colorMode="dark"
            style={{ '--xy-background-color': '#000000' } as React.CSSProperties}
            connectionLineStyle={{ stroke: '#666666', strokeWidth: 2, strokeDasharray: '5 5' }}
            connectionRadius={250}
            panOnDrag={activeTool === 'board' ? false : [1, 2]}
            selectionOnDrag={activeTool === null}
            panOnScroll={false}
            minZoom={0.05}
            maxZoom={4}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          >
            <Background variant={BackgroundVariant.Dots} color="#2a2a2a" gap={24} size={1.8} />
            <Controls />

            {/* Top-left: home button */}
            <Panel position="top-left">
              <button
                onClick={handleGoHome}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 rounded-xl text-[13px] border border-white/5 transition-all backdrop-blur-sm"
              >
                ⌂ 首页
                <span
                  title={connected ? '已连接' : '离线'}
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: connected ? '#22c55e' : '#6b7280',
                    marginLeft: 6,
                    flexShrink: 0,
                  }}
                />
              </button>
            </Panel>


<MiniMap nodeColor="#333333" maskColor="rgba(0, 0, 0, 0.8)" className="bg-[#0a0a0a] border-[#1a1a1a]" />
          </ReactFlow>

          {/* Board drag-create overlay */}
          {activeTool === 'board' && (
            <div
              className="absolute inset-0 z-40"
              style={{ cursor: 'crosshair' }}
              onMouseDown={handleBoardDragStart}
              onMouseMove={handleBoardDragMove}
              onMouseUp={handleBoardDragEnd}
            />
          )}

          {/* Board draft preview rectangle */}
          {boardDraft && (
            <div
              className="absolute pointer-events-none border-2 border-dashed border-blue-400/70 bg-blue-400/5 rounded-xl"
              style={{
                zIndex: 41,
                left: Math.min(boardDraft.startX, boardDraft.currentX),
                top: Math.min(boardDraft.startY, boardDraft.currentY),
                width: Math.abs(boardDraft.currentX - boardDraft.startX),
                height: Math.abs(boardDraft.currentY - boardDraft.startY),
              }}
            />
          )}

          {/* Active tool hint */}
          {activeTool && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none px-4 py-1.5 bg-black/70 backdrop-blur-sm border border-white/10 rounded-full text-sm text-white/70" style={{ zIndex: 50 }}>
              {activeTool === 'board' ? '拖拽画布创建画板 · Esc 退出' : '点击画布添加评论 · Esc 退出'}
            </div>
          )}

          {/* Left Toolbar */}
          <LeftToolbar
            activeTool={activeTool}
            showAssets={showAssets}
            showHistory={showHistory}
            showAssistant={showAssistant}
            onToolChange={setActiveTool}
            onToggleAssets={() => { setShowAssets(v => !v); setShowHistory(false); }}
            onToggleHistory={() => { setShowHistory(v => !v); setShowAssets(false); }}
            onToggleAssistant={() => setShowAssistant(v => !v)}
          />

          {/* Asset Panel */}
          {showAssets && (
            <AssetPanel
              assets={assets}
              onUpload={handleAssetUpload}
              onRemove={handleAssetRemove}
              onRename={handleAssetRename}
            />
          )}

          {/* History Panel */}
          {showHistory && (
            <HistoryPanel
              history={generationHistory}
              onUseItem={handleHistoryUse}
            />
          )}

          <ContextMenu
            x={menu.x} y={menu.y}
            visible={menu.isOpen}
            sourceNodeType={menu.sourceNodeType}
            onClose={closeMenu}
            onAction={onAction}
          />

          </div>{/* end inner flex-1 div */}

          {/* Canvas Assistant Sidebar */}
          {showAssistant && (
            <CanvasAssistantPanel
              onClose={() => setShowAssistant(false)}
              referencedNodes={assistantRefNodes}
              onRemoveRef={id => setAssistantRefNodes(prev => prev.filter(r => r.id !== id))}
              messages={assistantMessages}
              loading={assistantLoading}
              onSend={handleAssistantSend}
            />
          )}

        </div>
      </div>

      {/* Storyboard view */}
      <div
        className="absolute inset-0"
        style={{
          opacity: activeView === 'storyboard' ? 1 : 0,
          transform: activeView === 'storyboard' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
          pointerEvents: activeView === 'storyboard' ? 'auto' : 'none',
        }}
      >
        <StoryboardView
          storyboardOrder={storyboardOrder}
          nodes={nodes}
          onReorder={(newOrder) => {
            setStoryboardOrder(newOrder);
            onSaveStoryboardOrder(newOrder);
          }}
          onToggle={handleToggleStoryboard}
          onExportToCanvas={handleExportStoryboardToCanvas}
          projectId={projectId}
        />
      </div>

      {/* Breakdown view */}
      <div
        className="absolute inset-0"
        style={{
          opacity: activeView === 'breakdown' ? 1 : 0,
          transform: activeView === 'breakdown' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
          pointerEvents: activeView === 'breakdown' ? 'auto' : 'none',
        }}
      >
        <BreakdownView
          initialRows={storyboardRows}
          onImport={handleImportFromBreakdown}
          externalInitText={breakdownInitText}
          projectId={projectId}
          projectName={projectName}
          annotations={annotations}
          onSnapshotRestore={handleSnapshotRestore}
          onSaveSnapshot={handleSaveSnapshot}
          annotationSuggestions={annotationSuggestions}
          annotationSuggestionsLoading={annotationSuggestionsLoading}
          onDismissSuggestion={onDismissSuggestion}
          onApplySuggestion={onApplySuggestion}
        />
      </div>

      {/* Video manager view */}
      <div
        className="absolute inset-0"
        style={{
          opacity: activeView === 'video' ? 1 : 0,
          transform: activeView === 'video' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
          pointerEvents: activeView === 'video' ? 'auto' : 'none',
        }}
      >
        <VideoView
          videoOrder={videoOrder}
          onReorder={(newOrder) => {
            setVideoOrder(newOrder);
            onSaveVideoOrder(newOrder);
          }}
          onRemove={(id) => {
            setVideoOrder(prev => {
              const next = prev.filter(v => v.id !== id);
              onSaveVideoOrder(next);
              return next;
            });
          }}
        />
      </div>

      {/* Asset manager view */}
      <div
        className="absolute inset-0"
        style={{
          opacity: activeView === 'assets' ? 1 : 0,
          transform: activeView === 'assets' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
          pointerEvents: activeView === 'assets' ? 'auto' : 'none',
        }}
      >
        <AssetManagerView
          assets={assets}
          onAddAsset={handleAddAsset}
          onDeleteAsset={handleAssetRemove}
          onRenameAsset={handleAssetRename}
        />
      </div>

      {activeView === 'templates' && <TemplateLibraryView />}

      {/* Topic inspiration view */}
      <div
        className="absolute inset-0"
        style={{
          opacity: activeView === 'topic' ? 1 : 0,
          transform: activeView === 'topic' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
          pointerEvents: activeView === 'topic' ? 'auto' : 'none',
        }}
      >
        <TopicView
          initialDraft={topicDraft}
          initialKeyword={initialTopicKeyword}
          onSaveDraft={(text) => {
            setTopicDraft(text);
            onSaveTopicDraft(text);
          }}
          onImportToBreakdown={(text) => {
            setBreakdownInitText('');
            setTimeout(() => {
              setBreakdownInitText(text);
              setActiveView('breakdown');
            }, 0);
          }}
        />
      </div>

      {/* Bottom tab bar — always on top */}
      <BottomTabBar activeView={activeView} onViewChange={setActiveView} onGoHome={onGoHome} />

    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => sessionStorage.getItem('loggedIn') === '1');
  const [username, setUsername] = useState(() => sessionStorage.getItem('username') || 'user');
  const [view, setView] = useState<'home' | 'canvas'>('home');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  // ── Annotation AI suggestions ────────────────────────
  type AnnotationSuggestion = {
    suggestedPrompt: string;
    reason: string;
    comment: string;
    rowIndex: number;
    status: 'pending' | 'dismissed';
  };
  const [annotationSuggestions, setAnnotationSuggestions] = useState<Map<string, AnnotationSuggestion>>(new Map());
  const [annotationSuggestionsLoading, setAnnotationSuggestionsLoading] = useState(false);

  const [revisionNodeRequest, setRevisionNodeRequest] = useState<{
    sourceNodeId: string;
    newNodeId: string;
    prompt: string;
    rowIndex: number;
  } | null>(null);

  const handleDismissSuggestion = (rowId: string) => {
    setAnnotationSuggestions(prev => {
      const next = new Map(prev);
      const s = next.get(rowId);
      if (s) next.set(rowId, { ...s, status: 'dismissed' });
      return next;
    });
  };

  const handleApplySuggestion = (rowId: string, prompt: string, rowIndex: number) => {
    const newNodeId = `revision_${rowId}_${Date.now()}`;
    setRevisionNodeRequest({
      sourceNodeId: `storyboard-${rowId}`,
      newNodeId,
      prompt,
      rowIndex,
    });
    handleDismissSuggestion(rowId);
  };
  const annotationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnnotationsRef = useRef<{ rowId: string; rowIndex: number; comment: string }[]>([]);
  const [projectAnnotations, setProjectAnnotations] = useState<AnnotationData[]>([]);
  const [canvasInitialNodes, setCanvasInitialNodes] = useState<Node[]>([]);
  const [canvasInitialEdges, setCanvasInitialEdges] = useState<Edge[]>([]);
  const [canvasInitialRows, setCanvasInitialRows] = useState<StoryboardRow[]>([]);
  const [canvasInitialAssets, setCanvasInitialAssets] = useState<AssetItem[]>([]);
  const [canvasInitialHistory, setCanvasInitialHistory] = useState<HistoryItem[]>([]);
  const [canvasInitialStoryboardOrder, setCanvasInitialStoryboardOrder] = useState<string[]>([]);
  const [canvasInitialVideoOrder, setCanvasInitialVideoOrder] = useState<VideoOrderItem[]>([]);
  const [canvasInitialTopicDraft, setCanvasInitialTopicDraft] = useState('');
  const [canvasInitialTopicKeyword, setCanvasInitialTopicKeyword] = useState('');

  // External canvas update: when a remote client saves the currently-open project,
  // push updated nodes/edges into the live Flow canvas.
  const [externalCanvasUpdate, setExternalCanvasUpdate] = useState<{
    nodes: Node[];
    edges: Edge[];
    history: HistoryItem[];
  } | null>(null);

  // Stable ref so the useSync callback can always read the latest currentProject
  const currentProjectRef = useRef<Project | null>(null);
  currentProjectRef.current = currentProject;

  const handleRemoteProjectUpdate = useCallback((project: Project) => {
    const curr = currentProjectRef.current;
    // Only update the canvas if this is the project currently open
    if (curr && curr.id === project.id && project.updatedAt > curr.updatedAt) {
      setCurrentProject(project);
      setExternalCanvasUpdate({
        nodes: project.nodes,
        edges: project.edges,
        history: project.generationHistory || [],
      });
      // Clear after one tick so Flow sees a fresh object reference next time
      setTimeout(() => setExternalCanvasUpdate(null), 0);
    }
  }, []);

  const triggerAnnotationReview = async (
    pending: { rowId: string; rowIndex: number; comment: string }[]
  ) => {
    const project = currentProjectRef.current;
    if (!project) return;

    const rows = pending.map(p => {
      const row = project.storyboardRows?.find(r => r.id === p.rowId);
      return {
        rowId: p.rowId,
        rowIndex: p.rowIndex,
        shotType: row?.shotType ?? '',
        description: row?.description ?? '',
        comment: p.comment,
      };
    });

    if (!rows.length) return;

    setAnnotationSuggestionsLoading(true);
    try {
      const res = await fetch('/api/agent/annotation-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) return;
      const data = await res.json() as {
        suggestions: { rowId: string; prompt: string; reason: string }[];
      };
      setAnnotationSuggestions(prev => {
        const next = new Map(prev);
        for (const s of data.suggestions) {
          const pItem = pending.find(p => p.rowId === s.rowId);
          const comment = pItem?.comment ?? '';
          const rowIndex = pItem?.rowIndex ?? 0;
          next.set(s.rowId, { suggestedPrompt: s.prompt, reason: s.reason, comment, rowIndex, status: 'pending' });
        }
        return next;
      });
    } catch (err) {
      console.error('[annotation-review]', err);
    } finally {
      setAnnotationSuggestionsLoading(false);
    }
  };

  const handleAnnotationAdded = (msg: {
    projectId: string; shareId: string; rowIndex: number; rowId: string;
    status: string; comment: string; createdAt: number;
  }) => {
    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      projectId: msg.projectId,
      shareId: msg.shareId,
      rowIndex: msg.rowIndex,
      rowId: msg.rowId,
      status: msg.status,
      comment: msg.comment,
      createdAt: msg.createdAt,
      read: 0,
    };
    setNotifications(prev => [newNotif, ...prev]);
    setProjectAnnotations(prev => {
      const filtered = prev.filter(a => a.rowId !== msg.rowId);
      return [...filtered, {
        rowId: msg.rowId,
        status: msg.status as 'approved' | 'revision',
        comment: msg.comment,
        createdAt: msg.createdAt,
      }];
    });
    // Only trigger AI review for revision annotations on the current project
    if (msg.status === 'revision' && msg.projectId === currentProjectRef.current?.id) {
      pendingAnnotationsRef.current.push({
        rowId: msg.rowId,
        rowIndex: msg.rowIndex,
        comment: msg.comment,
      });
      if (annotationDebounceRef.current) clearTimeout(annotationDebounceRef.current);
      annotationDebounceRef.current = setTimeout(() => {
        triggerAnnotationReview(pendingAnnotationsRef.current);
        pendingAnnotationsRef.current = [];
      }, 3000);
    }
  };

  const { projects, connected, saveProject: wsSaveProject, deleteProject: wsDeleteProject } =
    useSync(handleRemoteProjectUpdate, handleAnnotationAdded);

  const handleNewProject = (data?: NewProjectData) => {
    const proj: Project = {
      ...createProject(data?.name),
      projectType: data?.projectType,
      tags: data?.tags ?? [],
      members: data?.members ?? [],
    };
    wsSaveProject(proj);
    setCurrentProject(proj);
    setCanvasInitialNodes([]);
    setCanvasInitialEdges([]);
    setCanvasInitialRows([]);
    setCanvasInitialAssets([]);
    setCanvasInitialHistory([]);
    setCanvasInitialStoryboardOrder([]);
    setCanvasInitialVideoOrder([]);
    setCanvasInitialTopicDraft('');
    setCanvasInitialTopicKeyword('');
    setView('canvas');
  };

  const handleUpdateProject = (id: string, updates: Partial<Project>) => {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    wsSaveProject({ ...proj, ...updates });
  };

  const handleRenameProject = (id: string, name: string) => {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    const updated = { ...proj, name, updatedAt: Date.now() };
    wsSaveProject(updated);
  };

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    setCanvasInitialNodes(project.nodes);
    setCanvasInitialEdges(project.edges);
    setCanvasInitialRows(project.storyboardRows);
    setCanvasInitialAssets(project.assets || []);
    setCanvasInitialHistory(project.generationHistory || []);
    setCanvasInitialStoryboardOrder(project.storyboardOrder || []);
    setCanvasInitialVideoOrder(project.videoOrder || []);
    setCanvasInitialTopicDraft(project.topicDraft ?? '');
    setCanvasInitialTopicKeyword('');
    // 拉取该项目的批注通知
    fetch(`/api/projects/${project.id}/notifications`)
      .then(r => r.ok ? r.json() : [])
      .then((notifs: NotificationItem[]) => {
        setNotifications(notifs);
        setProjectAnnotations(notifs.map(n => ({
          rowId: n.rowId,
          status: n.status as 'approved' | 'revision' | 'pending',
          comment: n.comment,
          createdAt: n.createdAt,
        })));
      })
      .catch(() => {});
    setView('canvas');
  };

  const handleGoHome = () => setView('home');

  const handleGoToTopic = (keyword: string) => {
    const proj = createProject();
    wsSaveProject(proj);
    setCurrentProject(proj);
    setCanvasInitialNodes([]);
    setCanvasInitialEdges([]);
    setCanvasInitialRows([]);
    setCanvasInitialAssets([]);
    setCanvasInitialHistory([]);
    setCanvasInitialStoryboardOrder([]);
    setCanvasInitialVideoOrder([]);
    setCanvasInitialTopicDraft('');
    setCanvasInitialTopicKeyword(keyword);
    setView('canvas');
  };

  const handleCanvasSave = (nodes: Node[], edges: Edge[]) => {
    if (!currentProject) return;
    const thumbnail = extractThumbnail(nodes);
    const updated = { ...currentProject, nodes, edges, thumbnail, updatedAt: Date.now() };
    setCurrentProject(updated);
    wsSaveProject(updated);
  };

  const handleRowsSave = (rows: StoryboardRow[]) => {
    if (!currentProject) return;
    const updated = { ...currentProject, storyboardRows: rows, updatedAt: Date.now() };
    setCurrentProject(updated);
    wsSaveProject(updated);
  };

  const handleAssetsSave = (assets: AssetItem[]) => {
    if (!currentProject) return;
    const updated = { ...currentProject, assets, updatedAt: Date.now() };
    setCurrentProject(updated);
    wsSaveProject(updated);
  };

  const handleHistorySave = (history: HistoryItem[]) => {
    if (!currentProject) return;
    const updated = { ...currentProject, generationHistory: history, updatedAt: Date.now() };
    setCurrentProject(updated);
    wsSaveProject(updated);
  };

  const handleStoryboardOrderSave = (order: string[]) => {
    if (!currentProject) return;
    const updated = { ...currentProject, storyboardOrder: order, updatedAt: Date.now() };
    setCurrentProject(updated);
    wsSaveProject(updated);
  };

  const handleTopicDraftSave = (draft: string) => {
    if (!currentProject) return;
    const updated = { ...currentProject, topicDraft: draft, updatedAt: Date.now() };
    setCurrentProject(updated);
    wsSaveProject(updated);
  };

  const handleVideoOrderSave = (order: VideoOrderItem[]) => {
    if (!currentProject) return;
    const updated = { ...currentProject, videoOrder: order, updatedAt: Date.now() };
    setCurrentProject(updated);
    wsSaveProject(updated);
  };

  if (!isLoggedIn) {
    return (
      <LoginView
        onLogin={(name) => {
          sessionStorage.setItem('loggedIn', '1');
          sessionStorage.setItem('username', name);
          setUsername(name);
          setIsLoggedIn(true);
        }}
      />
    );
  }

  const handleLogout = () => {
    setIsLoggedIn(false);
    setView('home');
  };

  return (
    <>
    <UserMenu
      username={username}
      onLogout={handleLogout}
      sidebarOpen={assistantOpen}
      notifications={notifications}
      onRead={id => {
        fetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
      }}
      onReadAll={projectId => {
        fetch(`/api/projects/${projectId}/notifications/read-all`, { method: 'POST' }).catch(() => {});
        setNotifications(prev => prev.map(n => n.projectId === projectId ? { ...n, read: 1 } : n));
      }}
      onNavigate={(projectId, _rowId) => {
        const proj = projects.find(p => p.id === projectId);
        if (proj) handleOpenProject(proj);
      }}
    />
    <ReactFlowProvider>
      {view === 'home' ? (
        <HomePage
          projects={projects}
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          onDeleteProject={wsDeleteProject}
          onRenameProject={handleRenameProject}
          onUpdateProject={handleUpdateProject}
          onGoToTopic={handleGoToTopic}
        />
      ) : (
        <Flow
          initialNodes={canvasInitialNodes}
          initialEdges={canvasInitialEdges}
          initialStoryboardRows={canvasInitialRows}
          initialAssets={canvasInitialAssets}
          initialHistory={canvasInitialHistory}
          onGoHome={handleGoHome}
          onSave={handleCanvasSave}
          onSaveRows={handleRowsSave}
          onSaveAssets={handleAssetsSave}
          onSaveHistory={handleHistorySave}
          initialStoryboardOrder={canvasInitialStoryboardOrder}
          onSaveStoryboardOrder={handleStoryboardOrderSave}
          initialVideoOrder={canvasInitialVideoOrder}
          onSaveVideoOrder={handleVideoOrderSave}
          projectName={currentProject?.name ?? ''}
          externalNodes={externalCanvasUpdate?.nodes ?? null}
          externalEdges={externalCanvasUpdate?.edges ?? null}
          externalHistory={externalCanvasUpdate?.history ?? null}
          connected={connected}
          initialTopicDraft={canvasInitialTopicDraft}
          onSaveTopicDraft={handleTopicDraftSave}
          initialTopicKeyword={canvasInitialTopicKeyword}
          projectId={currentProject?.id}
          annotations={projectAnnotations}
          annotationSuggestions={annotationSuggestions}
          annotationSuggestionsLoading={annotationSuggestionsLoading}
          onDismissSuggestion={handleDismissSuggestion}
          onApplySuggestion={handleApplySuggestion}
          revisionNodeRequest={revisionNodeRequest}
          onAssistantChange={setAssistantOpen}
        />
      )}
    </ReactFlowProvider>
    </>
  );
}
