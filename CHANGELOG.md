# Changelog

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
