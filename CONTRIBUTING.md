# Contributing to StudyShell

Thank you for helping improve StudyShell!

## Getting started

1. Fork the repository.
2. Create a feature branch from `main`.
3. Install dependencies:

```bash
npm install
```

4. Run the development app:

```bash
npm run tauri:dev
```

`npm run dev` starts Vite alone (browser UI only). Use `npm run tauri:dev` for the full desktop app with filesystem and AI integration.

## Development workflow

- Keep changes focused and small.
- Add tests for new behavior when possible.
- Update the README if you add or change app features.
- Bump the version only in `package.json`, then run `node scripts/sync-version.mjs` (or use `npm version`, which runs it via `preversion`).

## Verification before a pull request

```bash
npm run verify
```

This runs TypeScript checking, Node unit tests, and Rust tests. You can also run them individually:

```bash
npm run typecheck
npm run test
cargo test --manifest-path src-tauri/Cargo.toml
```

## Reporting issues

Use the issue templates in `.github/ISSUE_TEMPLATE/` to report bugs or request enhancements.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
