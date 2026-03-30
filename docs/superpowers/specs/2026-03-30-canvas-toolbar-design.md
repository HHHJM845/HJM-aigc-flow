# Canvas Left Toolbar — Design Spec
Date: 2026-03-30

## Overview
Add a left-side vertical toolbar to the canvas with four tools: Asset Library, Generation History, Board Tool, and Comment Tool. Also adds corresponding panels and two new node types (boardNode, commentNode).

## Components

### 1. LeftToolbar (`src/components/LeftToolbar.tsx`)
- Fixed vertical pill on the left, vertically centered
- Icons: Library, History, Frame, MessageSquare, HelpCircle, user avatar
- `activeTool: 'board' | 'comment' | null` — canvas interaction modes
- `showAssets / showHistory: boolean` — panel toggles, mutually exclusive
- Esc key exits active tool

### 2. AssetPanel (`src/components/AssetPanel.tsx`)
- Slides out from toolbar, width 280px
- Displays all images/videos in the current project (from node data + uploaded)
- Upload button (image/video) → stores in project `assets[]`
- Thumbnail grid with type badge (IMAGE / VIDEO)
- Drag from panel → drop on canvas → creates imageNode or videoNode at drop position

### 3. HistoryPanel (`src/components/HistoryPanel.tsx`)
- Slides out from toolbar (mutually exclusive with AssetPanel)
- Search bar at top
- Entries grouped by date (今天 / 昨天 / 更早)
- Source: every successful image/video generation appends to `project.generationHistory[]`
- Click thumbnail → create node on canvas reusing that image/video URL

### 4. BoardNode (`src/components/BoardNode.tsx`)
- New ReactFlow node type `boardNode`
- Transparent frame with colored border, `zIndex: -1` (renders behind other nodes)
- NodeResizer for drag-resize (min 200×150)
- Editable name label at top-left (double-click to edit)
- Creation: drag on canvas while board tool active → blue dashed preview rect → release creates node
- On creation: nodes whose center falls within board bounds get `parentId` set + position converted to relative coords
- `onNodeDragStop`: re-evaluate parentId for dragged node (absolute↔relative coord conversion)

### 5. CommentNode (`src/components/CommentNode.tsx`)
- New ReactFlow node type `commentNode`
- Yellow sticky note, 200×140 default, fixed size
- Folded top-left corner (CSS border trick)
- Editable textarea (nodrag)
- Author badge bottom-right
- Creation: click canvas while comment tool active → place at click position

## Data Model Changes

```typescript
// Project (storage.ts)
interface Project {
  // existing fields...
  assets: AssetItem[];           // uploaded/collected assets
  generationHistory: HistoryItem[];  // generation log
}

interface AssetItem {
  id: string;
  type: 'image' | 'video';
  src: string;           // base64 or URL
  name: string;
  createdAt: number;
}

interface HistoryItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  nodeLabel: string;
  createdAt: number;
}
```

## App.tsx Changes
- `activeTool: 'board' | 'comment' | null`
- `showAssets: boolean`, `showHistory: boolean`
- Board drag-create: track `boardDraft` (startPos + currentPos) via onMouseDown/Move/Up on pane
- `onNodeDragStop`: parentId assignment/removal with coord conversion
- `handleUpdateNode`: already handles data updates, reused for boardNode name
- Generation callbacks updated to append to `generationHistory`
- New nodeTypes: `boardNode`, `commentNode`

## Interaction Notes
- Board and comment tools deactivate after creation (single use per activation)
- Asset panel and history panel are mutually exclusive
- Drag-to-canvas from asset panel uses HTML5 drag events on the ReactFlow wrapper div
