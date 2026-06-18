# StudyShell

[![CI](https://github.com/tom-schneidr/studyshell/actions/workflows/ci.yml/badge.svg)](https://github.com/tom-schneidr/studyshell/actions/workflows/ci.yml)

StudyShell is a Tauri-powered desktop study workspace for local notes, PDFs, notebooks, media, search, and FreeRouter-backed AI study assistance.

## Quick Start

Requirements:

- Node.js 22+
- Rust stable toolchain
- Tauri system dependencies for your OS
- Optional: [FreeRouter](https://github.com/tom-schneidr/FreeRouter) running at `http://127.0.0.1:8000/v1` for AI features

```bash
npm install
npm run tauri:dev
```

`npm run dev` starts the browser-only Vite app for UI work. Most filesystem and AI workflows need the Tauri shell.

## Verify

```bash
npm run verify
npm run build
npm run tauri:build
```

`npm run verify:rust` uses `scratch/cargo-target` so local Rust checks avoid stale locks in Tauri's default target directory on Windows.

## Documentation

- [Overview](docs/overview.html)
- [Architecture](docs/architecture.html)
- [Roadmap](docs/roadmap.html)
- [Contributing](CONTRIBUTING.html)

## License

MIT. See [LICENSE](LICENSE).
