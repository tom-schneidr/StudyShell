# StudyShell

[![CI](https://github.com/tom-schneidr/studyshell/actions/workflows/ci.yml/badge.svg)](https://github.com/tom-schneidr/studyshell/actions/workflows/ci.yml)

> A local-first desktop workspace for working with course material as files.

StudyShell turns a selected folder into a focused study environment: browse and search
course material, edit notes and code, read PDFs and notebooks, annotate documents, and
optionally ask a local OpenAI-compatible gateway for study assistance. It is a desktop
application rather than an LMS, cloud drive, or hosted AI service.

The strongest engineering story is the boundary between a React/TypeScript experience
and a Rust/Tauri desktop backend. The frontend owns interaction state and rendering;
Rust owns filesystem access, watching, imports, binary reads, search, and the AI HTTP
bridge. The project is intentionally local-first, so the trust and data-flow boundary
is documented in [SECURITY.md](SECURITY.md).

## Current status

- Version `0.2.1` is the current unreleased application version.
- The repository contains source and build configuration, not published installers or a
  production deployment.
- AI features are optional. Without FreeRouter, the local workspace, editors, viewers,
  search, annotations, and study utilities remain the core product.
- The roadmap is a candid list of follow-up work, not a claim that every planned feature
  is complete: see [docs/roadmap.html](docs/roadmap.html).

## What is implemented

| Area                | Evidence in the repository                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace shell     | Native folder selection, recursive file tree, live refresh, recent/pinned files, split view, command palette, and study timer                     |
| Editors and viewers | Markdown and plain-text editing, CodeMirror code editing, PDF viewing and annotation sidecars, notebook rendering, and image/audio/video previews |
| Study workflows     | Full-text search, source selection, flashcards, quizzes, summaries, and study-guide generation                                                    |
| Desktop boundary    | Typed Tauri commands backed by Rust for file I/O, imports, binary content, directory statistics, search, and debounced watching                   |
| AI boundary         | Optional streaming and non-streaming OpenAI-compatible requests routed through FreeRouter, with provider keys kept outside this repository        |

## Architecture and engineering evidence

- React 19, TypeScript, Vite, and Tailwind provide the UI and interaction model.
- Rust 2021 and Tauri 2 provide the privileged desktop boundary.
- Pure TypeScript utilities cover path handling, parsing, persistence, search results,
  PDF state, timers, and AI response normalization so they can be regression-tested
  without starting the desktop shell.
- Rust unit tests exercise filesystem mutations, collision handling, search limits,
  asset-path validation, and AI response parsing.
- CI runs formatting, ESLint, strict TypeScript checking, frontend utility tests, a
  production frontend build, Rust formatting, Clippy with warnings denied, Rust tests,
  and a runtime dependency audit.

More detail is available in [docs/overview.html](docs/overview.html) and
[docs/architecture.html](docs/architecture.html).

## Quick start

Requirements:

- Node.js 22+
- Rust stable toolchain
- Tauri system dependencies for your OS
- Optional: [FreeRouter](https://github.com/tom-schneidr/FreeRouter) running at
  `http://127.0.0.1:8000/v1` for AI features

```bash
npm ci
npm run tauri:dev
```

`npm run dev` starts the browser-oriented Vite frontend for UI work. Filesystem and AI
workflows require the Tauri shell because they use the Rust command boundary.

To use a different gateway, copy `.env.example` to `.env` and set
`FREEROUTER_BASE_URL`. Provider credentials and model routing belong in FreeRouter,
not in StudyShell.

## Verification

```bash
npm run verify:frontend
npm run verify:rust
npm run build
npm audit --omit=dev --audit-level=high
```

`npm run verify` runs both frontend and Rust checks. `npm run verify:rust` uses
`scratch/cargo-target` so local Rust checks avoid stale locks in Tauri's default target
directory on Windows. `npm run build` also synchronises the application version into
the Tauri and frontend metadata; CI fails if that generated state is not committed.

`npm run tauri:build` creates a platform-specific installer locally. It is deliberately
not run in the Linux CI job because Tauri packaging requires platform-specific system
dependencies and signing decisions.

## Documentation

- [Overview](docs/overview.html)
- [Architecture](docs/architecture.html)
- [Roadmap](docs/roadmap.html)
- [Security and data handling](SECURITY.md)
- [Contributing](CONTRIBUTING.html)

## License

MIT. See [LICENSE](LICENSE).
