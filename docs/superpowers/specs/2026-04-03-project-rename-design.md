# Project Rename Design

**Date:** 2026-04-03
**Status:** Approved

## Overview

Allow users to rename any project after creation, via two entry points: double-clicking the project name on the card, or selecting "重命名" from the card's context menu.

## Interaction Behavior

- **Double-click** on the project name text in `ProjectCard` → enters edit mode
- **Context menu "重命名"** option → enters edit mode
- Edit mode: name text replaced with a focused `<input>` with current name pre-selected
- **Enter** or **blur** → save (if input is empty, restore original name)
- **Escape** → cancel, restore original name

## Data Flow

1. User confirms new name (Enter or blur)
2. Update project object with new `name` and current `updatedAt`
3. Call existing `wsSaveProject()` — reuses WebSocket sync, broadcasts to all connected clients
4. Optimistic UI update is immediate via existing `useSync` hook

## Files Changed

| File | Change |
|------|--------|
| `src/components/HomePage.tsx` | Add rename state, double-click handler, inline input, "重命名" menu item |

## Edge Cases

- Empty input on save → revert to original name
- Escape key → revert to original name without saving
- Name unchanged → no save call needed (avoid unnecessary writes)
