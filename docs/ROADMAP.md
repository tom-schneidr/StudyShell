# StudyShell — Master Feature Roadmap & Implementation Guide

> **🤖 GUIDANCE FOR AI IMPLEMENTERS:**
> This document is a strict blueprint. StudyShell is designed as a *clean, premium, desktop-native* application.
> 
> **CRITICAL RULES FOR IMPLEMENTATION:**
> 1. **Do NOT create extra clutter files.** Keep components consolidated. Do not extract tiny sub-components into separate files unless absolutely necessary for performance (e.g., heavy `useMemo` isolation).
> 2. **Never use `window.alert`, `window.confirm`, or `window.prompt`.** They block the Tauri main thread and ruin the premium aesthetic. Use the existing `ConfirmDialog` or build a custom React overlay.
> 3. **Tauri IPC:** Always mirror frontend hook methods (`useFileSystem`, `useStudyAI`) with matching Rust backend commands (`#[tauri::command]`).
> 4. **No Tailwind utility clutter in TS logic:** Keep complex class string manipulations clean using template literals or extracted consts. Rely on existing CSS variables (`var(--color-shell-...)`).
> 5. **Clean up after yourself:** If a feature deletes a file, ensure associated states (active file, AI context sources) are cleared.

---

## PILLAR 1: Core OS & File Management

### 1.2. File & Folder Rename
**Priority:** Critical — essential file operation.
**Approach:**
- **Rust Backend (`filesystem.rs`):** Add `rename_entry(old_path: String, new_path: String)`. Use `std::fs::rename`. Crucially: validate that `old_path` exists and `new_path` does *not* exist to prevent accidental overwrites.
- **Frontend (`CreationModal.tsx`):** Expand the `mode` prop type from `"file" | "folder"` to `"file" | "folder" | "rename"`. If `mode === "rename"`, change the header text to "Rename", change the submit button text, and use a `Pencil` icon from `lucide-react`. The existing auto-select logic (selecting text before the `.ext`) works perfectly here.
- **State (`App.tsx`):** Add `handleRenameRequest` and `handleConfirmRename`. 
- **Gotcha:** If the user renames the file they are currently viewing (`activeFile`), you MUST update `activeFile` state to the new path so the editor doesn't crash on the next save. (If Multi-Tab Editor #2.1 is already implemented, update the specific tab's `file.path` in `openTabs`). Do the same for paths in the `selectedSources` array for the AI chat.

### 1.3. Drag & Drop File Import
**Priority:** High
**Approach:**
- **Tauri Event API:** Use the `@tauri-apps/api/event` listener (NOT regular HTML drag events). Listen to `tauri://drag-drop` (which yields `{ paths, position }`).
- **Rust Backend:** Create `copy_file(source, dest)` in `filesystem.rs`. Use `fs::copy` for files. For directories, you must implement a recursive copy (using the `walkdir` crate).
- **Frontend Override:** Listen to `tauri://drag-enter` to show a full-screen or sidebar overlay (`bg-shell-accent/20` with a message "Drop files to import").
- **Resolution:** When files drop, use the currently selected directory in the `Sidebar` (or the root if none) as the drop target. Resolve filename conflicts using the existing `suggestUnique*` helpers in `fileCreation.ts`.

### 1.4. File Move via Tree Drag (or Context Menu)
**Priority:** Medium
**Approach:**
- To avoid conflicting with the OS-level drag-drop import feature above, recommend implementing this via the context menu.
- Add "Move to..." to `ContextMenu.tsx`.
- Trigger a new `FolderPickerModal.tsx` (a simplified version of `FileTree.tsx` showing only directories).
- Once a target directory is chosen, call the `rename_entry` Rust command (created in 1.2), as `std::fs::rename` handles moving files across directories perfectly on the same filesystem.

---

## PILLAR 2: Editor Experience

### 2.1. Multi-Tab Editor
**Priority:** High
**Approach:**
- **State Refactor (`App.tsx`):** Replace the single file state (`activeFile`, `fileContent`, `binaryData`, etc.) with an array of tabs: `openTabs: TabState[]` and `activeTabIndex: number`.
  - `TabState` should look like: `{ file: FileNode, content: string | null, binaryData: Uint8Array | null, dirty: boolean }`.
- **UI (`Editor.tsx`):** Build a horizontal scrollable tab row (`overflow-x-auto`, `scrollbar-width: none`). Render tabs with the file name, an icon, and an `X` to close.
- **Behavior:** Clicking a file in the sidebar checks if it's already in `openTabs`. If yes, switch to that index. If no, fetch content and push to the array. Middle-clicking a tab should close it.
- **Gotcha:** Lazy load contents! Don't load file contents until the tab actually becomes active.

### 2.3. Full-Text Search Across Files
**Priority:** High
**Approach:**
- **Rust Backend:** Add `search_files(root_path, query, max_results)`. Use `walkdir`. 
  - **CRITICAL:** Skip files > 1MB to prevent locking the thread on binary files or massive datasets. Try to read as UTF-8; ignore gracefully if it fails.
- **Frontend:** Create a `SearchPanel.tsx` component that occupies the same sidebar space as `FileTree`. Use a tab toggle at the top of the Sidebar to switch modes.
- **Search Input:** MUST be debounced (e.g., 400ms) to prevent spawning excessive Rust threads on every keystroke. Return line numbers and snippets for matches.

### 2.4. Syntax Highlighting for Code Files
**Priority:** Medium
**Approach:**
- Currently, files like `.py` or `.rs` render as raw text in a `<textarea>`.
- **Dependency:** Install `@codemirror/view`, `@codemirror/state`, `@codemirror/theme-one-dark`, and basic languages (`html`, `javascript`, `python`, `rust`).
- **Component:** Create a single `CodeEditor.tsx` wrapper around CodeMirror. 
- **Integration:** In `types.ts`, update `getFileType` to return `"code"` for dev extensions. In `Editor.tsx`, route `"code"` types to your new `CodeEditor` instead of `MarkdownEditor`. Wire up the `onUpdate` to the same debounced `onSave` logic.

### 2.5. Split Editor View
**Priority:** Low
**Approach:**
- Add a "Split" icon button to the editor tab bar.
- When active, render two `Editor` components side-by-side separated by a draggable resize handle (mirror the logic used for the sidebar/chat resizers).
- You will need to track which pane is "focused" so clicks in the sidebar open files in the correct pane. 
- *Note: Only implement this AFTER Multi-Tab Editor (2.1) is stable, as it drastically complicates state.*

---

## PILLAR 3: AI & Learning Tools

### 3.1. AI Flashcard Generator
**Priority:** Medium
**Approach:**
- **Backend:** `ai_client.rs` -> `generate_flashcards(paths, model)`. Prompt the model to return ONLY a JSON array structure: `[{ "front": "Q", "back": "A" }]`.
- **Frontend Regex:** Models often forcefully wrap JSON in markdown blockquotes (\`\`\`json). Before running `JSON.parse()`, run a regex replacement to strip these fences, or the parser will crash.
- **UI:** `FlashcardViewer.tsx` using Framer Motion 3D transforms (`rotateY`) to flip cards.
- **Storage:** Persist generated flashcards as a sidecar JSON file in the target directory (e.g., `biology-notes.flashcards.json`) so the user can review them later without regenerating.

### 3.3. AI Explain Text Selection
**Priority:** Low
**Approach:**
- In `MarkdownEditor.tsx` or `PdfViewer.tsx`, listen to text selection events (`window.getSelection()`).
- If text is selected, float a small absolute-positioned popover (using the new `.glass-layer-2` style from #5.5) near the cursor with options: "Explain", "Summarize".
- Clicking these copies the highlighted text, prepends a prompt ("Explain this text: ..."), and submits it directly to the `useStudyAI` instance, jumping focus to the Chat panel.

### 3.4. AI Chat History Persistence
**Priority:** Low
**Approach:**
- The chat context (`messages` array in `useStudyAI.ts`) is currently lost on reload.
- **Storage:** Since chat arrays can grow large, write a background Tauri command to save history to a local SQLite DB or a JSON file in the app's `appData` directory, OR just use `localStorage` with a hard length cap (e.g., store only the last 200 messages). Serialize using `JSON.stringify`.

---

## PILLAR 4: Polish & Productivity

### 4.2. Recent Files & Pinned Files
**Priority:** Medium
**Approach:**
- Track an array of `recentFiles: FileNode[]` in `App.tsx` (using `localStorage` to persist).
- Prepend the file to this array every time `handleFileSelect` fires. Deduplicate by path. Limit to 10.
- Render a new highly-visible "Recent" section at the top of `Sidebar.tsx`, above the Explorer file tree.

## PILLAR 5: UI & Visual Polish

### 5.1. Fluid View Transitions
**Priority:** Medium
**Approach:**
- Currently, `Editor.tsx` uses a simple `AnimatePresence` fade.
- **Enhancement:** Implement a spatial transition. When a user clicks a file in the sidebar, animate the new editor pane sliding in smoothly (`initial={{ opacity: 0, scale: 0.98 }}` or similar) while the old one transitions out.
- **Shared Layout:** Use Framer Motion's `layoutId` on the tab bar indicator (once Multi-Tab is implemented) to make the active tab underline visually "slide" between tabs.

### 5.2. Premium Empty States & Micro-Animations
**Priority:** Low
**Approach:**
- The current `EmptyState` in `Editor.tsx` is mostly static.
- **Enhancement:** Add a continuous, subtle floating animation (`y: [0, -4, 0]`) to the central `GraduationCap` icon. 
- On hover over the file-type pills at the bottom, add a slight scale and glow effect.
- In `Sidebar.tsx`, add a subtle pulse to the `FolderSearch` icon when no root is selected to instinctively draw the user's eye.

### 5.3. Universal Custom Scrollbars
**Priority:** Low
**Approach:**
- The app uses a `.custom-scrollbar` utility, but some areas might default to the OS scrollbar.
- **Enhancement:** Apply a global `::-webkit-scrollbar` styling in `index.css`. Make the scrollbar track transparent and the thumb use `--color-shell-border-subtle`. On hover, transition the thumb to `--color-shell-text-muted` for a cleaner, unified OS-agnostic look.

### 5.4. Focus Rings & Keyboard Navigation Polish
**Priority:** Low
**Approach:**
- **Enhancement:** Ensure every interactive element (`button`, `input`) has a distinct, branded `:focus-visible` state.
- Define a global focus utility in `index.css`: `outline: 2px solid var(--color-shell-accent); outline-offset: 2px;`.
- Remove any native browser focus outlines that don't match the slate/accent color palette.

### 5.5. Glassmorphism Depth Calibration
**Priority:** Low
**Approach:**
- The app currently relies heavily on solid `bg-shell-surface`. 
- **Enhancement:** Introduce multiple depths of glass (`.glass-layer-1`, `.glass-layer-2`) into `index.css` by calibrating `backdrop-blur` values (e.g., 8px vs 16px) and subtle white borders (`rgba(255,255,255,0.05)`). 
- Apply deeper glass to floating elements like `ConfirmDialog`, `CreationModal`, `ToastNotification`, and AI popovers so they visually separate stronger from the underlying editor.

---
*End of Master Roadmap.*
