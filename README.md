# StudyShell

StudyShell is a desktop study workspace built with Tauri, React, and TypeScript. It combines a local file explorer, multimodal document viewers, note editing, PDF annotation, and Vertex AI-powered study assistance in a single app.

## Current Capabilities

- Browse a local study folder with live filesystem refresh.
- Open and edit Markdown and text files.
- View notebooks, images, media, and PDFs.
- Annotate PDFs and save changes back to disk or export a copy.
- Chat with Vertex AI using the active file or selected source files as context.
- Generate folder-level summaries and study guides from supported materials.

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion
- Desktop shell: Tauri 2
- Backend: Rust with Tauri commands for filesystem access, file watching, and Vertex AI requests
- AI integration: Google Vertex AI / Gemini models

## Commands

- `npm run dev` starts the Vite frontend for Tauri development.
- `npm run typecheck` runs the TypeScript compiler in no-emit mode.
- `npm run test` runs lightweight utility tests with Node's built-in test runner.
- `npm run build` builds the frontend bundle.
- `cargo test` from [`src-tauri/Cargo.toml`](/C:/Users/tomla/My%20Drive/Code/StudyShell/src-tauri/Cargo.toml) runs Rust tests.

## Configuration

StudyShell loads environment variables from `.env` when the Tauri app starts.

- `PROJECT_ID` should point to your Google Cloud project for Vertex AI.
- `VERTEX_LOCATION` is optional and defaults to `global`.

You will also need local Google application default credentials available for the Rust backend.

## Session Notes

- Replaced the template README with project-specific documentation.
- Added a frontend `typecheck` command and a lightweight utility test suite.
- Fixed frontend build issues caused by unused imports and inconsistent hook import casing.
- Added live sidebar directory stats and surfaced filesystem load errors in the explorer UI.
- Added Rust filesystem unit tests covering tree ordering, hidden-file filtering, nested writes, and directory stats.
- Wired selected AI source files into chat context so source selection now affects assistant responses.
- Added explorer-driven Markdown note creation so new notes can be started directly from the context menu.
- Added sidebar file-tree filtering so large study folders can be narrowed quickly from the explorer.
- Improved note creation with a quick root-level action and automatic duplicate filename handling.
- Added explorer folder creation with duplicate-safe naming from both the context menu and root toolbar.
- Surfaced Vertex AI configuration status in the chat panel and blocked unconfigured AI actions with clearer setup guidance.
- Replaced native `window.prompt` dialogs with a custom, premium themed `CreationModal` for a consistent desktop experience when creating files and folders.
- Added file and folder deletion via the context menu with a themed confirmation dialog, automatic cleanup of active file and AI sources when their paths are deleted, and Rust-side safety validation.
- Fixed a debounce bug in the filesystem watcher listener where rapid changes would trigger redundant tree refreshes instead of coalescing into a single refresh.
- Made drag-and-drop imports conflict-safe so incoming files and folders get duplicate-safe names instead of overwriting existing workspace content.
- Fixed the AI flashcard flow to parse the direct model response instead of relying on stale chat state, with tests covering fenced JSON and invalid-card filtering.
- Completed markdown image paste support so pasted images save into note-local `_assets` folders, insert links at the cursor reliably, and avoid filename collisions.
- Hardened cross-platform path handling for rename, delete cleanup, and AI-generated summary/study-guide files so these flows no longer rely on Windows-only path slicing.
- Fixed code-file editing so CodeMirror now autosaves while typing and flushes pending edits before tab switches or unmounts instead of relying only on `Ctrl+S`.
- Added local chat history persistence for the AI assistant, with bounded storage and safe recovery from malformed saved data.
- Added persistent PDF annotation sidecars so in-progress markup survives reloads, with safe parsing of saved annotation JSON.
- Cleaned up deleted files and folders from open tabs and recent-file history so the workspace no longer keeps stale entries after removals.
- Made command-palette creation actions workspace-aware, added disabled-state guidance for unavailable commands, and hardened keyboard navigation when a query has no matches.
- Hardened recent-file persistence so malformed local storage no longer breaks startup, duplicate entries are normalized, and the saved list stays bounded consistently.
- Hardened search-result path rendering so relative paths only collapse for true descendants of the workspace root, avoiding false matches when sibling folders share a prefix.
- Normalized workspace root display names so sidebar labels remain correct even when selected paths include trailing separators.
- Made chat-history deserialization resilient to malformed JSON at the utility layer so saved assistant history now fails closed consistently.
- Sorted grouped search results by file path and line number so the search panel presents matches in a stable, easier-to-scan order.
- Centralized path-extension parsing for search results so hidden files and extensionless files no longer rely on brittle string splitting when opened from search.
- Surfaced formatted filesystem load errors directly in the explorer so workspace problems are visible instead of only living in hook state.
- Reused centralized path-extension parsing for code-language detection so editor mode inference now matches search-open behavior on edge-case filenames.
- Hardened byte-size formatting so invalid or negative directory statistics now fall back safely instead of producing unstable display values.
- Deduplicated identical AI-generated flashcards during parsing so repeated cards no longer clutter review sessions when the model echoes itself.
- Improved explorer filtering so folders that directly match the query keep their full subtree visible instead of appearing as empty matches.
- Tightened file and folder name normalization so trailing dots and spaces are stripped before creation, improving cross-platform filesystem safety.
- Centralized search eligibility rules so the search panel now clears stale results when no workspace is selected instead of implying old matches are still valid.
- Normalized image MIME parsing for pasted assets so clipboard parameters no longer leak into generated filenames or extensions.
- Expanded command-palette matching to include descriptions, making commands easier to discover from more natural search terms.
- Normalized explorer error whitespace so multi-line filesystem failures now render as clean inline messages instead of awkward wrapped fragments.
- Deduplicated repeated chat-context sections by source path so the AI prompt stays cleaner even if the same file is passed in twice.
- Surfaced inline search failures in the search panel so users now get clear feedback instead of silent empty results when a search request errors.
- Added a clear-all action for selected AI sources so multi-file context can be reset from the chat panel without removing each source chip one by one.
- Tightened AI source selection so only chat-compatible files can be added from the explorer, duplicate source state is normalized, and the chat panel now shows a live source-count summary with a consistent clear-all action.
- Reconciled filesystem-backed UI state after tree refreshes so externally removed files are pruned from tabs, active-file state, selected AI sources, recent files, and cached PDF annotation state.
- Scoped recent files to the active workspace and live file tree so switching roots no longer surfaces stale entries from older folders.
- Stopped filesystem watchers explicitly before root switches and during cleanup so workspace changes do not leave orphaned watchers running.
- Added a clear recent-files action in both the sidebar and command palette, plus an explicit empty state when the current workspace has no recent items yet.
- Hardened command-palette keyboard navigation so arrow keys skip disabled actions, and cleaned up the footer shortcut hint text.
- Added desktop-style middle-click tab closing so open-file tabs behave more naturally during multi-file study sessions.
- Hardened sidebar search against stale async responses so rapidly changing queries no longer flash outdated matches back into view.
- Added keyboard navigation and enter-to-open behavior for file search results, making the search panel feel more desktop-native.
- Added clear-search input affordances and lightweight match/file summaries so search state is easier to scan and reset.
- Added a markdown table of contents rail with heading parsing and click-to-jump navigation for long notes in both source and preview workflows.
- Extracted markdown heading parsing into a shared utility with tests, including fenced-code exclusion and duplicate heading slug handling.
- Made the AI model picker dismiss on outside click and Escape so it behaves more like the app’s other overlays.
