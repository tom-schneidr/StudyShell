# Changelog

## 2026-04-15

- Made PDF export-copy filenames path-safe across platforms instead of relying on Windows-only path splitting.
- Added keyboard controls to flashcard review so arrow keys navigate, Enter/Space flip cards, Escape closes, and `R` restarts completed decks.
- Clamped the file-tree context menu to the viewport so it remains visible and usable near screen edges.
- Added PDF viewer keyboard shortcuts for page navigation plus zoom in, zoom out, and reset.
- Added a `Copy Path` action to the file-tree context menu for quick clipboard access.
- Deduplicated identical active toasts so repeated errors do not stack into notification spam.
- Persisted the sidebar's active tab so Explorer versus Search survives app restarts and workspace switching.
- Kept the file search panel state alive across tab switches and surfaced a live result-count badge on the Search tab.
- Added PDF page-jump input and an explicit zoom reset control, while ignoring viewer shortcuts when typing into form fields.
