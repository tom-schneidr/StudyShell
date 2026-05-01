# Changelog

## [Unreleased] - 2026-04-16

### Fixed
- **System prompt updates now apply immediately**: the React AI hook now includes the latest `systemPrompt` when sending both standard and streaming chat requests, so changes in Settings affect the next message without waiting for a remount.
- **Workspace search is whitespace-safe**: full-text search now trims incoming queries on both the frontend and Rust backend, which prevents accidental leading/trailing spaces from hiding valid matches.
- **Workspace search skips hidden folders**: the Rust search traversal now ignores hidden directories as well as hidden files, which keeps `.git`, dot-folders, and other private caches out of search results.
- **Quiz command availability tightened**: the command palette no longer advertises quiz generation when there is no text content available to build a quiz from.
- **Settings drafts behave predictably**: theme changes inside Preferences no longer leak into the app before pressing Apply, and Cancel now truly discards unsaved prompt/theme edits.
- **Rename flow is safer**: rename operations now sanitize invalid characters, preserve the existing file extension when users edit only the basename, and quietly handle unchanged names.
- **Move and rename state stays in sync**: active tabs, recent files, selected sources, PDF annotation caches, and the side pane now remap correctly after file moves and renames instead of drifting to stale paths.
- **Explorer filter clears cleanly**: pressing `Escape` in the explorer filter now clears the query immediately for faster navigation resets.
- **Clear chat actions are self-aware**: both the command palette action and the AI panel button are disabled when there is no conversation to clear or a response is still loading.

### Added
- **Persistent AI preferences**: selected model, Google Search grounding, and the custom system prompt now survive app restarts.
- **Workspace restore**: StudyShell remembers the last opened workspace and restores it automatically on launch.
- **Shortcut-aware command search**: command palette queries can now match keyboard shortcut labels like `Ctrl+B`.
- **Version sync and docs refresh**: app metadata is now aligned to `0.2.1`, and the README reflects the current shipped capabilities more accurately.
- **Persistent timer and layout state**: the study timer now restores its last state, the app remembers sidebar/chat layout preferences, and timer session transitions can surface desktop notifications when supported.
- **Persistent split view**: split mode now remembers whether it was open and restores the last side-pane file on relaunch when that file still exists in the workspace.
- **Tabbed split toggle**: the editor tab bar now exposes a dedicated split-view control, making side-by-side study sessions easier to reach without the context menu.

### Improved
- **Frontend code-splitting**: heavyweight editors, viewers, and modal surfaces now load lazily, reducing the initial bundle and keeping the primary shell lighter.
- **Second pane loading behavior**: opening a file in the side pane now clears stale data first, shows a dedicated loading state for binary assets, and supports notebook previews in split view.
- **Explorer file icons are type-aware**: the file tree now reflects more file categories such as notebooks, images, audio, and video instead of collapsing many formats into a generic file icon.

## [0.2.1] - 2026-04-16

### Fixed
- **Flashcard generation now works**: `parseFlashcardsResponse` was silently discarding all cards because the AI prompt requested `{question, answer}` keys while the parser only read `{front, back}`. The parser now accepts **both key layouts** (`front/back` and `question/answer`) and normalizes everything to `front/back`. The prompt was also updated to explicitly request `front`/`back` keys for maximum reliability.
- **Quiz parsing hardened**: Replaced the fragile inline `replace(/```json...```/)` regex in `handleGenerateQuiz` with the new `parseQuizResponse` utility, which properly handles all markdown code fence variants, validates each question's structure, and rejects entries with an out-of-range `correctIndex`. The `quizSession.questions` state is now typed as `QuizQuestion[]` instead of `any[]`.
- **Real-time AI Chat Streaming**: The Rust `stream_chat_with_ai` endpoint previously attempted to parse individual raw network chunks as full JSON objects, which frequently failed. It has been entirely refactored to accumulate raw network bytes into a single buffer and extract complete JSON sequence items accurately on boundaries.
- **System Prompt Propagated Properly**: Custom system instructions from the app settings were completely ignored by the Rust backend because the parameter wasn't mapped through from Tauri IPC. Both `chat_with_ai` and `stream_chat_with_ai` now accept and use the user's `system_prompt`.

### Added
- **`parseQuizResponse` utility** (`src/utils/flashcards.ts`): Extracts and validates quiz question arrays from an AI response string. Filters out malformed entries (missing fields, out-of-range `correctIndex`, fewer than 2 options) and throws for fully empty results.
- **`QuizQuestion` interface** (`src/utils/flashcards.ts`): Shared type for quiz question objects, eliminating the `any[]` usage in `App.tsx` and providing the same definition used by `QuizView.tsx`.
- **Test coverage** (`tests/types.test.mjs`, `src-tauri/src/vertex_client.rs`): comprehensive new assertion sets. 5 JS unit tests covering the new flashcard parsing fallbacks. 9 Rust unit tests meticulously verifying the behavior of chunk accumulations and incomplete responses in the new `vertex_client` codebase.

## [0.2.0] - 2026-04-16

### Added
- **Pomodoro Study Timer**: Interactive widget with 25/5 intervals and desktop notifications.
- **AI Quiz Mode**: Generate multiple-choice quizzes from study materials with explanations.
- **Global Error Boundary**: Catch runtime crashes with a dedicated "Reset Workspace" UI.
- **Dark/Light Mode**: Full theme support with manual/auto toggle.
- **Image Paste Support**: Automatic asset management for markdown notes.
- **Sidecar PDF Persistence**: Annotations are now auto-saved to separate JSON files.
- **Markdown Table of Contents**: Navigable sidebar for long markdown documents.

### Improved
- **Design System overhaul**: Enhanced glassmorphism, refined scrollbars, and premium micro-animations.
- **Empty State UX**: Animated "Learning Focus" screen when no file is active.
- **Toast Notifications**: Added progress bars and better visual feedback.
- **Sidebar UX**: Added pulse effects to call-to-action buttons.
- **Command Palette search**: Better fuzzy-matching and category organization.

### Fixed
- Replaced legacy browser `alert()` and `confirm()` calls with custom UI dialogs.
- Improved path resolution for file creation and renaming.
