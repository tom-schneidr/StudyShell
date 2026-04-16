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

