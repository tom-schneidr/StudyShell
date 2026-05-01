# StudyShell

[StudyShell](https://github.com/tom-schneidr/studyshell) is a Tauri-powered desktop study workspace built with React and TypeScript.
It combines a local file explorer, Markdown and code editing, multimodal document viewers, PDF annotation, and Vertex AI-powered study assistance in one app.

## Features

- Local workspace browser with live filesystem refresh
- Markdown, plain text, and code editing with syntax-aware support
- Notebook, image, audio, video, and PDF previewing
- PDF annotation, save, and export workflows
- AI chat assistant contextualized by active files and selected sources
- Flashcard and quiz generation from study materials
- Workspace search, command palette, and recent file history
- Persistent layout, theme, and study timer state
- Google Vertex AI / Gemini integration for AI-powered summaries

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- Rust toolchain
- Tauri CLI: `npm install -D @tauri-apps/cli`
- Google Cloud application default credentials for Vertex AI

### Run locally

```bash
npm install
npm run dev
```

Then open the local Tauri development window or use `npm run tauri` when ready.

### Build for production

```bash
npm run build
```

### Run tests

```bash
npm run typecheck
npm run test
cargo test --manifest-path src-tauri/Cargo.toml
```

## Configuration

Create a `.env` file at the project root with the following values:

```env
PROJECT_ID=your-google-cloud-project-id
VERTEX_LOCATION=global
```

`VERTEX_LOCATION` is optional and defaults to `global`.

The Rust backend also requires valid Google application default credentials for Vertex AI requests.

## Project Structure

- `src/` — React frontend code and UI components
- `src-tauri/` — Tauri backend, Rust commands, and native integrations
- `public/` — static assets
- `tests/` — lightweight Node test utilities

## Contributing

Contributions are welcome. Please open an issue before submitting major changes and follow the repository conventions.

## License

This project is released under the MIT License.
