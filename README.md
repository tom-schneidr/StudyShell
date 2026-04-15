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
