# Project Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to rename projects inline via double-clicking the project name or via the card context menu.

**Architecture:** Add `onRenameProject(id, name)` prop to `HomePage` and `onRename(name)` to `ProjectCard`. Editing state is local to `ProjectCard`. Saving calls the existing `wsSaveProject` in `App.tsx`.

**Tech Stack:** React, TypeScript, existing WebSocket sync via `useSync`

---

### Task 1: Add `onRename` prop to `ProjectCard` and wire up editing state

**Files:**
- Modify: `src/components/HomePage.tsx`

- [ ] **Step 1: Add `onRename` to `ProjectCard` props interface**

In `HomePage.tsx`, update the `ProjectCard` function signature (currently at line 21):

```tsx
function ProjectCard({
  project,
  onOpen,
  onDelete,
  onRename,
}: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
```

- [ ] **Step 2: Add rename state inside `ProjectCard`**

After the existing `const [menuOpen, setMenuOpen] = useState(false);` line, add:

```tsx
const [editing, setEditing] = useState(false);
const [nameInput, setNameInput] = useState(project.name);
const inputRef = useRef<HTMLInputElement>(null);
```

Also update the imports at the top of the file — `useRef` is already imported, but ensure `useRef` and `useState` are present (they are).

- [ ] **Step 3: Add `startEditing` helper**

After the state declarations, add:

```tsx
const startEditing = () => {
  setNameInput(project.name);
  setEditing(true);
  setTimeout(() => {
    inputRef.current?.select();
  }, 0);
};
```

- [ ] **Step 4: Add `commitEdit` and `cancelEdit` helpers**

```tsx
const commitEdit = () => {
  const trimmed = nameInput.trim();
  if (trimmed && trimmed !== project.name) {
    onRename(trimmed);
  }
  setEditing(false);
};

const cancelEdit = () => {
  setNameInput(project.name);
  setEditing(false);
};
```

- [ ] **Step 5: Replace the name `<p>` with conditional input/text in the Info section**

Find the Info section inside `ProjectCard` (currently lines 62–69). Replace the inner `<button onClick={onOpen}>` block so the name area supports double-click and inline editing:

```tsx
{/* Info */}
<div className="px-3.5 py-3 flex items-start justify-between gap-2">
  <div className="flex-1 min-w-0">
    {editing ? (
      <input
        ref={inputRef}
        value={nameInput}
        onChange={e => setNameInput(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
          if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
        }}
        className="w-full bg-white/10 text-white text-xs font-medium rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-white/30"
        onClick={e => e.stopPropagation()}
      />
    ) : (
      <button onClick={onOpen} className="w-full text-left min-w-0">
        <p
          className="text-white text-xs font-medium truncate cursor-text"
          onDoubleClick={e => { e.stopPropagation(); startEditing(); }}
        >
          {project.name}
        </p>
      </button>
    )}
    <p className="text-gray-600 text-[11px] mt-0.5 flex items-center gap-1">
      <Clock size={9} />
      编辑于 {timeAgo(project.updatedAt)}
    </p>
  </div>
  {/* Context menu — unchanged, added below in Task 2 */}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/HomePage.tsx
git commit -m "feat: add inline rename state and double-click editing to ProjectCard"
```

---

### Task 2: Add "重命名" to the context menu

**Files:**
- Modify: `src/components/HomePage.tsx`

- [ ] **Step 1: Add Pencil icon import**

At the top of `HomePage.tsx`, update the lucide-react import to include `Pencil`:

```tsx
import { Plus, Sparkles, Clock, Folder, Trash2, MoreHorizontal, Pencil } from 'lucide-react';
```

- [ ] **Step 2: Add "重命名" button to the dropdown menu**

Find the dropdown menu inside `ProjectCard` (currently the `menuOpen && (...)` block). Add "重命名" **above** "删除项目":

```tsx
{menuOpen && (
  <div className="absolute right-0 bottom-7 bg-[#242424] border border-white/10 rounded-xl py-1 shadow-xl z-10 min-w-[100px]">
    <button
      onClick={() => { setMenuOpen(false); startEditing(); }}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-gray-300 hover:bg-white/5 text-xs transition-colors"
    >
      <Pencil size={12} />
      重命名
    </button>
    <button
      onClick={() => { setMenuOpen(false); onDelete(); }}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-white/5 text-xs transition-colors"
    >
      <Trash2 size={12} />
      删除项目
    </button>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/HomePage.tsx
git commit -m "feat: add rename option to ProjectCard context menu"
```

---

### Task 3: Wire `onRenameProject` through `HomePage` and `App.tsx`

**Files:**
- Modify: `src/components/HomePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `onRenameProject` to `HomePage` Props interface**

In `HomePage.tsx`, update the `Props` interface (currently at line 13):

```tsx
interface Props {
  projects: Project[];
  onNewProject: (initialScript?: string) => void;
  onOpenProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onGoToSkills?: () => void;
}
```

- [ ] **Step 2: Destructure the new prop in `HomePage`**

Update the function signature:

```tsx
export default function HomePage({ projects, onNewProject, onOpenProject, onDeleteProject, onRenameProject, onGoToSkills }: Props) {
```

- [ ] **Step 3: Pass `onRename` to each `ProjectCard`**

Find the `{projects.map(project => (` block and add the prop:

```tsx
{projects.map(project => (
  <ProjectCard
    key={project.id}
    project={project}
    onOpen={() => onOpenProject(project)}
    onDelete={() => handleDelete(project.id)}
    onRename={(name) => onRenameProject(project.id, name)}
  />
))}
```

- [ ] **Step 4: Add `handleRenameProject` in `App.tsx`**

In `App.tsx`, after `handleNewProject` (around line 1025), add:

```tsx
const handleRenameProject = (id: string, name: string) => {
  const proj = projects.find(p => p.id === id);
  if (!proj) return;
  const updated = { ...proj, name, updatedAt: Date.now() };
  wsSaveProject(updated);
};
```

- [ ] **Step 5: Pass `onRenameProject` to `HomePage` in the JSX**

Find the `<HomePage` usage in `App.tsx` (around line 1096) and add the prop:

```tsx
<HomePage
  projects={projects}
  onNewProject={handleNewProject}
  onOpenProject={handleOpenProject}
  onDeleteProject={wsDeleteProject}
  onRenameProject={handleRenameProject}
  onGoToSkills={handleGoToSkills}
/>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/HomePage.tsx src/App.tsx
git commit -m "feat: wire onRenameProject through HomePage to App, save via wsSaveProject"
```

---

### Task 4: Verify in browser

- [ ] **Step 1: Confirm dev server is running on port 3000**

- [ ] **Step 2: Open the home page, double-click a project name — should enter edit mode with text selected**

- [ ] **Step 3: Edit the name and press Enter — name should update on the card**

- [ ] **Step 4: Open the context menu (hover → ··· button) — "重命名" should appear above "删除项目"**

- [ ] **Step 5: Click "重命名" from the menu — should enter same inline edit mode**

- [ ] **Step 6: Press Escape while editing — should revert to original name without saving**

- [ ] **Step 7: Clear the name and blur — should revert to original name (empty name not saved)**
