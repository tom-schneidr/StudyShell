# Security and data handling

This document describes the current implementation and trust boundaries. It is not a
formal security audit or a promise that the application is safe for untrusted content.

## Trust model

StudyShell is a local desktop application. When it runs, the Tauri backend has the same
operating-system permissions as the user who launched it. The folder selected in the UI
is a workspace convention, not a kernel-enforced sandbox: the backend commands operate
on the paths supplied by the frontend so that users can open, move, import, and edit
ordinary files.

Treat the repository and any installed build as trusted code. Do not use StudyShell as
an isolation boundary for hostile files, hostile plugins, or untrusted desktop users.

## Data flow

- The selected workspace path, layout preferences, recent files, pinned files, and chat
  history are stored locally. Chat history is kept in the WebView's `localStorage`.
- File browsing, editing, search, imports, PDF annotation sidecars, and file watching
  are handled locally by the Rust/Tauri boundary.
- AI is optional and is not an embedded provider. StudyShell sends requests to the
  configured FreeRouter-compatible base URL. The default is loopback at
  `http://127.0.0.1:8000/v1`.
- Chat context is selected by the user and bounded by the frontend before a chat
  request. Summary and study-guide actions read the selected text/PDF files in Rust and
  include their contents in the AI request, so those actions should be treated as
  explicit data-sharing operations.
- Setting `use_search` allows the gateway's web-search endpoint to be used. This can
  introduce third-party network access beyond the local machine.
- Provider credentials and routing configuration belong in FreeRouter. StudyShell does
  not store provider API keys in the repository or expose them to the React WebView.

## Safeguards in the current implementation

- `.env` files are ignored and only a non-secret `.env.example` is tracked.
- The main UI routes destructive file actions through an in-app confirmation flow.
- Imports avoid overwriting existing files and directories by choosing a unique target.
- Pasted Markdown assets must use a single safe filename and are written beneath the
  document's `_assets` directory; path components are rejected.
- Search skips hidden entries, ignores files larger than 1 MiB, and caps a search at
  200 matches to avoid locking the UI on ordinary workspaces.
- CI runs `npm audit --omit=dev --audit-level=high` alongside the TypeScript and Rust
  checks.

## Known limitations

- Filesystem commands are intentionally not confined to the selected workspace. A user
  can choose or enter paths outside it, and a compromised frontend would have the same
  file access as the desktop process.
- Markdown, notebook HTML output, and SVG previews are rendered inside the WebView.
  They are not a complete sanitizer for hostile documents. Do not open untrusted
  document content when a hostile-content threat model matters.
- AI requests are not encrypted by StudyShell itself. Use an HTTPS gateway when the
  configured provider is remote and do not send sensitive material without checking the
  provider's handling.
- There are no published signed installers, reproducible release artifacts, or formal
  third-party security assessment in this repository.

## Reporting

For a suspected vulnerability, avoid putting credentials, private documents, or a
working exploit in a public issue. Use GitHub's private security-reporting path if it is
available for the repository; otherwise contact the maintainer through the GitHub
profile before public disclosure.
