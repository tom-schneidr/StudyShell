import assert from "node:assert/strict";

import { cellSourceToString, formatBytes, getFileType } from "../src/types.ts";
import { FREEROUTER_MODEL } from "../src/utils/freerouter.ts";
import {
  APP_VERSION,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USE_SEARCH,
  parseStoredBoolean,
  parseStoredRootPath,
  parseStoredString,
} from "../src/utils/appPreferences.ts";
import {
  buildChatContext,
  canUseFileAsChatContext,
  truncateChatContextContent,
} from "../src/utils/chatContext.ts";
import {
  buildDirectoryPath,
  buildMarkdownNotePath,
  buildNewMarkdownContent,
  listChildNamesForDirectory,
  normalizeDirectoryName,
  normalizeMarkdownFileName,
  normalizeRenameName,
  resolveCreationDirectory,
  sanitizeEntryName,
  suggestUniqueDirectoryName,
  suggestUniqueMarkdownFileName,
} from "../src/utils/fileCreation.ts";
import { filterFileTree } from "../src/utils/fileTreeFilter.ts";
import {
  getChatPlaceholder,
  aiConfigGuidance,
  getAiConfigErrorMessage,
} from "../src/utils/aiConfig.ts";
import {
  extractJsonArrayCandidate,
  parseFlashcardsResponse,
  parseQuizResponse,
} from "../src/utils/flashcards.ts";
import {
  buildMarkdownImageTag,
  buildPastedImageFilename,
  extensionFromImageMimeType,
  insertTextAtSelection,
} from "../src/utils/markdownAssets.ts";
import { getMarkdownHeadingOffset, parseMarkdownHeadings } from "../src/utils/markdownHeadings.ts";
import {
  buildExportCopyFilename,
  getPathBaseName,
  getPathExtension,
  getParentPath,
  getRelativePathFromRoot,
  isSameOrDescendantPath,
  joinPath,
  remapPathPrefix,
} from "../src/utils/pathUtils.ts";
import { clampFloatingPosition } from "../src/utils/floatingPosition.ts";
import {
  clampPdfPageNumber,
  clampPdfScale,
  DEFAULT_PDF_SCALE,
  getNextPdfPageNumber,
  getNextPdfScale,
  parsePdfPageNumberInput,
} from "../src/utils/pdfViewer.ts";
import {
  collectFilePaths,
  filterFileNodesByPaths,
  filterRecordByPaths,
  removeFileNodesWithinPath,
} from "../src/utils/fileState.ts";
import {
  buildWorkspaceCommandTarget,
  commandMatchesQuery,
  getDefaultCommandIndex,
  getNextEnabledCommandIndex,
  hasCommandPaletteMatches,
} from "../src/utils/commandPalette.ts";
import {
  deserializeRecentFiles,
  filterRecentFilesForWorkspace,
  normalizeRecentFiles,
  RECENT_FILES_LIMIT,
  serializeRecentFiles,
} from "../src/utils/recentFiles.ts";
import {
  formatSearchError,
  getDefaultSearchResultIndex,
  getNextSearchResultIndex,
  getSearchResultsSummary,
  groupSearchResultsByFile,
  normalizeSearchQuery,
  shouldExecuteSearch,
} from "../src/utils/searchResults.ts";
import { formatFilesystemError } from "../src/utils/filesystemErrors.ts";
import {
  canClearSelectedSources,
  canSelectSource,
  getSelectedSourcesSummary,
  normalizeSelectedSources,
} from "../src/utils/sourceSelection.ts";
import { resolveCodeLanguage, shouldPersistCodeContent } from "../src/utils/codeEditor.ts";
import {
  CHAT_HISTORY_LIMIT,
  deserializeChatHistory,
  limitChatHistory,
  serializeChatHistory,
} from "../src/utils/aiHistory.ts";
import {
  clampChatWidth,
  clampSidebarWidth,
  DEFAULT_CHAT_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  readStoredChatPanelVisible,
  readStoredChatWidth,
  readStoredSidebarWidth,
} from "../src/utils/layoutPreferences.ts";
import { hasDuplicateToast } from "../src/utils/toasts.ts";
import {
  DEFAULT_SIDEBAR_TAB,
  formatSearchTabBadge,
  parseSidebarTab,
} from "../src/utils/sidebarState.ts";
import {
  buildPdfAnnotationSidecarPath,
  createEmptyPdfAnnotationData,
  parsePdfAnnotationData,
  serializePdfAnnotationData,
} from "../src/utils/pdfAnnotations.ts";
import {
  BREAK_DURATION_SECONDS,
  WORK_DURATION_SECONDS,
  createDefaultStudyTimerState,
  deserializeStudyTimerState,
  formatStudyTimerTime,
  getNextTimerMode,
  getStudyTimerProgress,
  getTimerDuration,
  readStudyTimerState,
  serializeStudyTimerState,
} from "../src/utils/studyTimer.ts";

assert.equal(getFileType("md"), "markdown");
assert.equal(getFileType("PDF"), "pdf");
assert.equal(getFileType("png"), "image");
assert.equal(getFileType("ipynb"), "notebook");
assert.equal(getFileType("ts"), "code");
assert.equal(getFileType("rs"), "code");
assert.equal(getFileType("bin"), "unsupported");
assert.equal(getFileType(null), "unsupported");

assert.equal(formatBytes(0), "0 B");
assert.equal(formatBytes(-1), "0 B");
assert.equal(formatBytes(Number.NaN), "0 B");
assert.equal(formatBytes(1024), "1 KB");
assert.equal(formatBytes(1536), "1.5 KB");
assert.equal(formatBytes(1024 * 1024), "1 MB");
assert.equal(formatBytes(5 * 1024 * 1024 * 1024), "5 GB");

assert.equal(cellSourceToString("plain text"), "plain text");
assert.equal(cellSourceToString(["line 1", "\n", "line 2"]), "line 1\nline 2");

assert.equal(canUseFileAsChatContext({ extension: "md" }), true);
assert.equal(canUseFileAsChatContext({ extension: "txt" }), true);
assert.equal(canUseFileAsChatContext({ extension: "ipynb" }), true);
assert.equal(canUseFileAsChatContext({ extension: "pdf" }), false);
assert.equal(canUseFileAsChatContext({ extension: "png" }), false);

const truncated = truncateChatContextContent("A".repeat(80), 40);
assert.match(truncated, /\[Truncated for AI context\]$/);

const context = buildChatContext([
  {
    label: "Active file: notes.md",
    path: "C:\\notes.md",
    content: "Exam review material",
  },
  {
    label: "Selected source: lecture.txt",
    path: "C:\\lecture.txt",
    content: "Lecture transcript",
  },
]);

assert.match(context, /Active file: notes.md/);
assert.match(context, /Selected source: lecture.txt/);
const dedupedContext = buildChatContext([
  {
    label: "Active file: notes.md",
    path: "C:\\notes.md",
    content: "Exam review material",
  },
  {
    label: "Selected source: notes.md",
    path: "C:\\notes.md",
    content: "Duplicate material",
  },
]);
assert.equal((dedupedContext?.match(/Path: C:\\notes\.md/g) ?? []).length, 1);
assert.equal(
  buildChatContext([{ label: "Empty", path: "C:\\empty.txt", content: "   " }]),
  undefined,
);

assert.equal(normalizeMarkdownFileName("Lecture 1"), "Lecture 1.md");
assert.equal(normalizeMarkdownFileName("summary.md"), "summary.md");
assert.equal(normalizeMarkdownFileName("  inva<lid>|name  "), "inva-lid--name.md");
assert.equal(normalizeMarkdownFileName("weekly notes... "), "weekly notes.md");
assert.equal(normalizeDirectoryName(" Week <1> "), "Week -1-");
assert.equal(normalizeDirectoryName(" Topic 1... "), "Topic 1");
assert.equal(sanitizeEntryName("  exam<review>?  "), "exam-review--");
assert.equal(
  suggestUniqueMarkdownFileName(["untitled-note.md"], "untitled-note"),
  "untitled-note-2.md",
);
assert.equal(
  suggestUniqueMarkdownFileName(["Lecture 1.md", "Lecture 1-2.md"], "Lecture 1"),
  "Lecture 1-3.md",
);
assert.equal(
  suggestUniqueDirectoryName(["untitled-folder"], "untitled-folder"),
  "untitled-folder-2",
);
assert.equal(suggestUniqueDirectoryName(["Week 1", "Week 1-2"], "Week 1"), "Week 1-3");
assert.equal(resolveCreationDirectory({ is_dir: true, path: "C:\\Notes" }), "C:\\Notes");
assert.equal(
  resolveCreationDirectory({ is_dir: false, path: "C:\\Notes\\week1.txt" }),
  "C:\\Notes",
);
assert.equal(
  buildMarkdownNotePath({ is_dir: true, path: "C:\\Notes" }, "Week 2"),
  "C:\\Notes\\Week 2.md",
);
assert.equal(
  buildMarkdownNotePath({ is_dir: false, path: "/tmp/lecture.txt" }, "Ideas"),
  "/tmp/Ideas.md",
);
assert.equal(
  buildDirectoryPath({ is_dir: true, path: "C:\\Notes" }, "Week 3"),
  "C:\\Notes\\Week 3",
);
assert.equal(
  buildDirectoryPath({ is_dir: false, path: "/tmp/lecture.txt" }, "Ideas"),
  "/tmp/Ideas",
);
assert.equal(buildNewMarkdownContent("week-2.md"), "# Week 2\n\n");
assert.equal(
  normalizeRenameName({ is_dir: false, name: "lecture-notes.md", extension: "md" }, "Week 2"),
  "Week 2.md",
);
assert.equal(
  normalizeRenameName({ is_dir: false, name: "lecture-notes.md", extension: "md" }, "Week 2.txt"),
  "Week 2.txt",
);
assert.equal(
  normalizeRenameName({ is_dir: true, name: "Week 1", extension: null }, "  Week <2> "),
  "Week -2-",
);

const fileTree = [
  {
    name: "Coursework",
    path: "C:\\Coursework",
    is_dir: true,
    extension: null,
    children: [
      {
        name: "Week 1",
        path: "C:\\Coursework\\Week 1",
        is_dir: true,
        extension: null,
        children: [
          {
            name: "lecture-notes.md",
            path: "C:\\Coursework\\Week 1\\lecture-notes.md",
            is_dir: false,
            extension: "md",
            children: null,
          },
        ],
      },
    ],
  },
  {
    name: "todo.txt",
    path: "C:\\todo.txt",
    is_dir: false,
    extension: "txt",
    children: null,
  },
];

assert.equal(filterFileTree(fileTree, "").length, 2);
assert.deepEqual(listChildNamesForDirectory(fileTree, "C:\\Coursework"), ["Week 1"]);
assert.deepEqual(listChildNamesForDirectory(fileTree, "C:\\Coursework\\Week 1"), [
  "lecture-notes.md",
]);
assert.deepEqual(listChildNamesForDirectory(fileTree, "C:\\missing"), []);
assert.equal(filterFileTree(fileTree, "todo")[0].name, "todo.txt");
assert.equal(filterFileTree(fileTree, "lecture")[0].name, "Coursework");
assert.equal(
  filterFileTree(fileTree, "lecture")[0].children[0].children[0].name,
  "lecture-notes.md",
);
assert.equal(filterFileTree(fileTree, "coursework")[0].children.length, 1);
assert.equal(filterFileTree(fileTree, "week 1")[0].children[0].children.length, 1);
assert.equal(filterFileTree(fileTree, "missing").length, 0);

assert.match(getAiConfigErrorMessage(), /FreeRouter is not reachable/);
assert.match(getAiConfigErrorMessage(), /FREEROUTER_BASE_URL/);
assert.equal(getChatPlaceholder(null, false), "Checking FreeRouter connection...");
assert.equal(getChatPlaceholder(false, true), "Start FreeRouter to begin chatting...");
assert.equal(getChatPlaceholder(true, false), "Ask your sources...");
assert.equal(getChatPlaceholder(true, true), "Search the web and ask...");
assert.match(aiConfigGuidance, /127\.0\.0\.1:8000/);
assert.equal(APP_VERSION, "0.2.1");
assert.equal(FREEROUTER_MODEL, "auto");
assert.equal(parseStoredBoolean("true", DEFAULT_USE_SEARCH), true);
assert.equal(parseStoredBoolean("false", true), false);
assert.equal(parseStoredBoolean("not-a-bool", true), true);
assert.equal(parseStoredString("  Custom prompt  ", DEFAULT_SYSTEM_PROMPT), "Custom prompt");
assert.equal(parseStoredString("   ", DEFAULT_SYSTEM_PROMPT), DEFAULT_SYSTEM_PROMPT);
assert.equal(parseStoredRootPath("  C:\\Study  "), "C:\\Study");
assert.equal(parseStoredRootPath("   "), null);
assert.equal(clampSidebarWidth(Number.NaN), DEFAULT_SIDEBAR_WIDTH);
assert.equal(clampSidebarWidth(0), 0);
assert.equal(clampSidebarWidth(999), 600);
assert.equal(clampChatWidth(Number.NaN), DEFAULT_CHAT_WIDTH);
assert.equal(clampChatWidth(999), 800);
assert.equal(readStoredSidebarWidth({ getItem: () => "420" }), 420);
assert.equal(readStoredChatWidth({ getItem: () => "300" }), 300);
assert.equal(readStoredChatPanelVisible({ getItem: () => "false" }), false);

assert.equal(
  extractJsonArrayCandidate('```json\n[{"front":"Q1","back":"A1"}]\n```'),
  '[{"front":"Q1","back":"A1"}]',
);
assert.deepEqual(
  parseFlashcardsResponse(
    '```json\n[{"front":" Term ","back":" Definition "},{"front":"","back":"skip"}]\n```',
  ),
  [{ front: "Term", back: "Definition" }],
);
assert.deepEqual(
  parseFlashcardsResponse('Here you go:\n[{"front":"Q1","back":"A1"},{"front":"Q2","back":"A2"}]'),
  [
    { front: "Q1", back: "A1" },
    { front: "Q2", back: "A2" },
  ],
);
assert.deepEqual(
  parseFlashcardsResponse(
    '[{"front":"Q1","back":"A1"},{"front":"Q1","back":"A1"},{"front":"Q2","back":"A2"}]',
  ),
  [
    { front: "Q1", back: "A1" },
    { front: "Q2", back: "A2" },
  ],
);
assert.throws(() => parseFlashcardsResponse("[]"), /valid flashcards/);
// Alternative {question, answer} key layout that the AI may emit
assert.deepEqual(
  parseFlashcardsResponse('[{"question":"What is React?","answer":"A UI library"}]'),
  [{ front: "What is React?", back: "A UI library" }],
);
// {front} takes priority over {question} when both present
assert.deepEqual(
  parseFlashcardsResponse('[{"front":"Front wins","question":"Question ignored","back":"B"}]'),
  [{ front: "Front wins", back: "B" }],
);
// parseQuizResponse: happy path with markdown fences
assert.deepEqual(
  parseQuizResponse(
    '```json\n[{"question":"2+2?","options":["1","2","4","8"],"correctIndex":2,"explanation":"Basic arithmetic"}]\n```',
  ),
  [
    {
      question: "2+2?",
      options: ["1", "2", "4", "8"],
      correctIndex: 2,
      explanation: "Basic arithmetic",
    },
  ],
);
// parseQuizResponse: filters entries with out-of-range correctIndex
assert.deepEqual(
  parseQuizResponse(
    '[{"question":"X?","options":["A","B"],"correctIndex":0,"explanation":"ok"},{"question":"Y?","options":["A","B"],"correctIndex":5,"explanation":"bad"}]',
  ),
  [{ question: "X?", options: ["A", "B"], correctIndex: 0, explanation: "ok" }],
);
// parseQuizResponse: throws on empty result
assert.throws(() => parseQuizResponse("[]"), /valid quiz questions/);
assert.equal(extensionFromImageMimeType("image/png"), "png");
assert.equal(extensionFromImageMimeType("image/jpeg"), "jpg");
assert.equal(extensionFromImageMimeType("image/png; charset=utf-8"), "png");
assert.equal(extensionFromImageMimeType("image/svg+xml"), "svg");
assert.equal(buildPastedImageFilename("image/webp", 123), "pasted-image-123.webp");
assert.equal(
  buildMarkdownImageTag("pasted-image-123.png", "_assets/pasted-image-123.png"),
  "\n![pasted-image-123.png](_assets/pasted-image-123.png)\n",
);
assert.equal(insertTextAtSelection("alpha omega", 6, 11, "study"), "alpha study");
assert.deepEqual(
  parseMarkdownHeadings(
    ["# Intro", "Some text", "## Deep Dive", "```md", "# Ignored", "```", "## Deep Dive"].join(
      "\n",
    ),
  ),
  [
    { id: "intro", level: 1, line: 1, text: "Intro" },
    { id: "deep-dive", level: 2, line: 3, text: "Deep Dive" },
    { id: "deep-dive-2", level: 2, line: 7, text: "Deep Dive" },
  ],
);
assert.equal(
  getMarkdownHeadingOffset("# Intro\nBody\n## Deep Dive\nMore text", 3),
  "# Intro\nBody\n".length,
);
assert.equal(getPathBaseName("C:\\Notes\\Week 1\\"), "Week 1");
assert.equal(getPathBaseName("/tmp/course/week1/"), "week1");
assert.equal(getPathBaseName("README.md"), "README.md");
assert.equal(buildExportCopyFilename("C:\\Notes\\lecture.pdf"), "lecture_annotated.pdf");
assert.equal(buildExportCopyFilename("/tmp/lecture.PDF"), "lecture_annotated.pdf");
assert.equal(buildExportCopyFilename("lecture"), "lecture_annotated.pdf");
assert.equal(getPathExtension("C:\\Notes\\week1.txt"), "txt");
assert.equal(getPathExtension("/tmp/course/archive.tar.gz"), "gz");
assert.equal(getPathExtension("/tmp/.env"), null);
assert.equal(getPathExtension("LICENSE"), null);
assert.equal(getParentPath("C:\\Notes\\week1.txt"), "C:\\Notes");
assert.equal(getParentPath("/tmp/lecture.txt"), "/tmp");
assert.equal(joinPath("C:\\Notes", "summary.md"), "C:\\Notes\\summary.md");
assert.equal(joinPath("/tmp", "summary.md"), "/tmp/summary.md");
assert.equal(isSameOrDescendantPath("C:\\Study\\Week 1\\notes.md", "C:\\Study\\Week 1"), true);
assert.equal(isSameOrDescendantPath("C:\\Study\\Week 10\\notes.md", "C:\\Study\\Week 1"), false);
assert.equal(isSameOrDescendantPath("/tmp/course/week1/notes.md", "/tmp/course"), true);
assert.equal(isSameOrDescendantPath("/tmp/coursework/notes.md", "/tmp/course"), false);
assert.equal(
  remapPathPrefix("C:\\Study\\Week 1\\notes.md", "C:\\Study\\Week 1", "C:\\Study\\Week 2"),
  "C:\\Study\\Week 2\\notes.md",
);
assert.equal(
  remapPathPrefix("/tmp/course/week1/notes.md", "/tmp/course", "/tmp/archive"),
  "/tmp/archive/week1/notes.md",
);
assert.equal(remapPathPrefix("/tmp/coursework/notes.md", "/tmp/course", "/tmp/archive"), null);
assert.equal(
  getRelativePathFromRoot("C:\\Study\\Week 1\\notes.md", "C:\\Study"),
  "Week 1\\notes.md",
);
assert.equal(
  getRelativePathFromRoot("/tmp/course/week1/notes.md", "/tmp/course"),
  "week1/notes.md",
);
assert.equal(getRelativePathFromRoot("C:\\Study", "C:\\Study"), ".");
assert.equal(
  getRelativePathFromRoot("C:\\Study Hall\\notes.md", "C:\\Study"),
  "C:\\Study Hall\\notes.md",
);
assert.deepEqual(
  clampFloatingPosition(
    { x: 980, y: 760 },
    { width: 220, height: 180 },
    { width: 1024, height: 768 },
  ),
  { x: 792, y: 576 },
);
assert.deepEqual(
  clampFloatingPosition({ x: 2, y: 3 }, { width: 220, height: 180 }, { width: 1024, height: 768 }),
  { x: 12, y: 12 },
);
assert.equal(clampPdfScale(Number.NaN), DEFAULT_PDF_SCALE);
assert.equal(clampPdfScale(10), 3);
assert.equal(clampPdfScale(0.1), 0.4);
assert.equal(clampPdfPageNumber(9, 4), 4);
assert.equal(clampPdfPageNumber(0, 4), 1);
assert.equal(clampPdfPageNumber(Number.NaN, 4), 1);
assert.equal(getNextPdfScale(0.8, 1), 1);
assert.equal(getNextPdfScale(0.4, -1), 0.4);
assert.equal(getNextPdfPageNumber(2, 5, 1), 3);
assert.equal(getNextPdfPageNumber(1, 5, -1), 1);
assert.equal(getNextPdfPageNumber(3, 0, 1), 1);
assert.equal(parsePdfPageNumberInput(" 4 ", 8, 2), 4);
assert.equal(parsePdfPageNumberInput("20", 8, 2), 8);
assert.equal(parsePdfPageNumberInput("oops", 8, 2), 2);
assert.equal(resolveCodeLanguage(undefined, "C:\\Study\\main.tsx"), "tsx");
assert.equal(resolveCodeLanguage("PY", "/tmp/example.txt"), "py");
assert.equal(resolveCodeLanguage(undefined, "Makefile"), "makefile");
assert.equal(resolveCodeLanguage(undefined, "/tmp/.env"), undefined);
assert.equal(resolveCodeLanguage(undefined, "/tmp/archive."), undefined);
assert.equal(shouldPersistCodeContent("const x = 1;", "const x = 1;"), false);
assert.equal(shouldPersistCodeContent("const x = 2;", "const x = 1;"), true);
assert.deepEqual(
  removeFileNodesWithinPath(
    [
      {
        name: "notes.md",
        path: "C:\\Study\\notes.md",
        is_dir: false,
        extension: "md",
        children: null,
      },
      { name: "Week 1", path: "C:\\Study\\Week 1", is_dir: true, extension: null, children: [] },
      { name: "todo.txt", path: "C:\\todo.txt", is_dir: false, extension: "txt", children: null },
    ],
    "C:\\Study",
  ),
  [{ name: "todo.txt", path: "C:\\todo.txt", is_dir: false, extension: "txt", children: null }],
);
assert.deepEqual(
  removeFileNodesWithinPath(
    [
      { name: "Week 1", path: "/tmp/course/week1", is_dir: true, extension: null, children: [] },
      { name: "Week 10", path: "/tmp/course/week10", is_dir: true, extension: null, children: [] },
    ],
    "/tmp/course/week1",
  ),
  [{ name: "Week 10", path: "/tmp/course/week10", is_dir: true, extension: null, children: [] }],
);
assert.deepEqual(Array.from(collectFilePaths(fileTree)).sort(), [
  "C:\\Coursework\\Week 1\\lecture-notes.md",
  "C:\\todo.txt",
]);
assert.deepEqual(
  filterFileNodesByPaths(
    [
      {
        name: "lecture-notes.md",
        path: "C:\\Coursework\\Week 1\\lecture-notes.md",
        is_dir: false,
        extension: "md",
        children: null,
      },
      {
        name: "missing.md",
        path: "C:\\Coursework\\missing.md",
        is_dir: false,
        extension: "md",
        children: null,
      },
    ],
    new Set(["C:\\Coursework\\Week 1\\lecture-notes.md"]),
  ),
  [
    {
      name: "lecture-notes.md",
      path: "C:\\Coursework\\Week 1\\lecture-notes.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
  ],
);
assert.deepEqual(
  filterRecordByPaths(
    {
      "C:\\Coursework\\Week 1\\lecture-notes.md": { saved: true },
      "C:\\Coursework\\missing.md": { saved: false },
    },
    new Set(["C:\\Coursework\\Week 1\\lecture-notes.md"]),
  ),
  {
    "C:\\Coursework\\Week 1\\lecture-notes.md": { saved: true },
  },
);
assert.deepEqual(
  buildWorkspaceCommandTarget(
    {
      name: "notes.md",
      path: "C:\\Study\\notes.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
    "C:\\Study",
    fileTree,
  ),
  { name: "notes.md", path: "C:\\Study\\notes.md", is_dir: false, extension: "md", children: null },
);
assert.deepEqual(buildWorkspaceCommandTarget(null, "C:\\Study", fileTree), {
  name: "Study",
  path: "C:\\Study",
  is_dir: true,
  extension: null,
  children: fileTree,
});
assert.equal(buildWorkspaceCommandTarget(null, null, fileTree), null);
assert.equal(hasCommandPaletteMatches(2), true);
assert.equal(hasCommandPaletteMatches(0), false);
assert.equal(
  getDefaultCommandIndex([{ disabled: true }, { disabled: false }, { disabled: false }]),
  1,
);
assert.equal(getDefaultCommandIndex([]), -1);
assert.equal(
  getNextEnabledCommandIndex([{ disabled: false }, { disabled: true }, { disabled: false }], 0, 1),
  2,
);
assert.equal(
  getNextEnabledCommandIndex([{ disabled: false }, { disabled: true }, { disabled: false }], 2, -1),
  0,
);
assert.equal(
  commandMatchesQuery(
    { label: "New Note", category: "Files", description: "Create a markdown note" },
    "markdown",
  ),
  true,
);
assert.equal(
  commandMatchesQuery(
    { label: "New Note", category: "Files", description: "Create a markdown note" },
    "system",
  ),
  false,
);
assert.equal(
  commandMatchesQuery(
    {
      label: "Toggle Sidebar",
      category: "View",
      description: "Show or hide the explorer",
      shortcut: "Ctrl+B",
    },
    "ctrl+b",
  ),
  true,
);
assert.deepEqual(
  normalizeRecentFiles([
    {
      name: "notes.md",
      path: "C:\\Study\\notes.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
    {
      name: "notes.md",
      path: "C:\\Study\\notes.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
    {
      name: "week-1.md",
      path: "C:\\Study\\week-1.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
  ]),
  [
    {
      name: "notes.md",
      path: "C:\\Study\\notes.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
    {
      name: "week-1.md",
      path: "C:\\Study\\week-1.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
  ],
);
assert.equal(
  normalizeRecentFiles(
    Array.from({ length: RECENT_FILES_LIMIT + 2 }, (_, index) => ({
      name: `file-${index}.md`,
      path: `C:\\Study\\file-${index}.md`,
      is_dir: false,
      extension: "md",
      children: null,
    })),
  ).length,
  RECENT_FILES_LIMIT,
);
assert.deepEqual(deserializeRecentFiles('{"bad":true}'), []);
assert.deepEqual(
  deserializeRecentFiles(
    '[{"name":"notes.md","path":"C:\\\\Study\\\\notes.md","is_dir":false,"extension":"md","children":null},{"name":"bad"}]',
  ),
  [
    {
      name: "notes.md",
      path: "C:\\Study\\notes.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
  ],
);
assert.equal(
  serializeRecentFiles([
    {
      name: "notes.md",
      path: "C:\\Study\\notes.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
    {
      name: "notes.md",
      path: "C:\\Study\\notes.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
  ]),
  '[{"name":"notes.md","path":"C:\\\\Study\\\\notes.md","is_dir":false,"extension":"md","children":null}]',
);
assert.deepEqual(
  filterRecentFilesForWorkspace(
    [
      {
        name: "notes.md",
        path: "C:\\Study\\notes.md",
        is_dir: false,
        extension: "md",
        children: null,
      },
      {
        name: "week-1.md",
        path: "C:\\Study\\week-1.md",
        is_dir: false,
        extension: "md",
        children: null,
      },
      {
        name: "other.md",
        path: "C:\\Other\\other.md",
        is_dir: false,
        extension: "md",
        children: null,
      },
    ],
    "C:\\Study",
    new Set(["C:\\Study\\notes.md"]),
  ),
  [
    {
      name: "notes.md",
      path: "C:\\Study\\notes.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
  ],
);
assert.deepEqual(
  filterRecentFilesForWorkspace(
    [
      {
        name: "notes.md",
        path: "C:\\Study\\notes.md",
        is_dir: false,
        extension: "md",
        children: null,
      },
    ],
    null,
    new Set(["C:\\Study\\notes.md"]),
  ),
  [],
);
assert.deepEqual(
  groupSearchResultsByFile([
    { path: "C:\\Study\\b.md", line_number: 9, content: "later" },
    { path: "C:\\Study\\a.md", line_number: 5, content: "middle" },
    { path: "C:\\Study\\a.md", line_number: 1, content: "first" },
  ]),
  [
    {
      path: "C:\\Study\\a.md",
      results: [
        { path: "C:\\Study\\a.md", line_number: 1, content: "first" },
        { path: "C:\\Study\\a.md", line_number: 5, content: "middle" },
      ],
    },
    {
      path: "C:\\Study\\b.md",
      results: [{ path: "C:\\Study\\b.md", line_number: 9, content: "later" }],
    },
  ],
);
assert.equal(normalizeSearchQuery("  exam   prep  "), "exam prep");
assert.equal(shouldExecuteSearch("ab", "C:\\Study"), true);
assert.equal(shouldExecuteSearch("  ab  ", "C:\\Study"), true);
assert.equal(shouldExecuteSearch(" a ", null), false);
assert.equal(shouldExecuteSearch("x", "C:\\Study"), false);
assert.equal(getDefaultSearchResultIndex(3), 0);
assert.equal(getDefaultSearchResultIndex(0), -1);
assert.equal(getNextSearchResultIndex(4, 0, 1), 1);
assert.equal(getNextSearchResultIndex(4, 0, -1), 3);
assert.equal(getNextSearchResultIndex(4, -1, 1), 0);
assert.equal(getNextSearchResultIndex(4, -1, -1), 3);
assert.equal(getSearchResultsSummary(0, 0), "No matches");
assert.equal(getSearchResultsSummary(1, 1), "1 match in 1 file");
assert.equal(getSearchResultsSummary(5, 2), "5 matches in 2 files");
assert.equal(formatSearchError("Permission denied"), "Search failed: Permission denied");
assert.equal(formatSearchError(new Error("Disk offline")), "Search failed: Disk offline");
assert.equal(formatSearchError("   "), "Search failed. Please try again.");
assert.equal(formatFilesystemError(null), null);
assert.equal(formatFilesystemError(""), null);
assert.equal(
  formatFilesystemError("Failed to load directory: denied"),
  "Failed to load directory: denied.",
);
assert.equal(
  formatFilesystemError("Failed to load\n directory:\tdenied "),
  "Failed to load directory: denied.",
);
assert.equal(formatFilesystemError("Already punctuated."), "Already punctuated.");
assert.equal(canSelectSource({ is_dir: false, extension: "md" }), true);
assert.equal(canSelectSource({ is_dir: false, extension: "txt" }), true);
assert.equal(canSelectSource({ is_dir: false, extension: "pdf" }), false);
assert.equal(canSelectSource({ is_dir: true, extension: null }), false);
assert.deepEqual(
  normalizeSelectedSources([
    {
      name: "notes.md",
      path: "C:\\Study\\notes.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
    {
      name: "notes.md",
      path: "C:\\Study\\notes.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
    {
      name: "lecture.pdf",
      path: "C:\\Study\\lecture.pdf",
      is_dir: false,
      extension: "pdf",
      children: null,
    },
    { name: "Week 1", path: "C:\\Study\\Week 1", is_dir: true, extension: null, children: [] },
    {
      name: "outline.txt",
      path: "C:\\Study\\outline.txt",
      is_dir: false,
      extension: "txt",
      children: null,
    },
  ]),
  [
    {
      name: "notes.md",
      path: "C:\\Study\\notes.md",
      is_dir: false,
      extension: "md",
      children: null,
    },
    {
      name: "outline.txt",
      path: "C:\\Study\\outline.txt",
      is_dir: false,
      extension: "txt",
      children: null,
    },
  ],
);
assert.equal(canClearSelectedSources(0), false);
assert.equal(canClearSelectedSources(1), true);
assert.equal(canClearSelectedSources(2), true);
assert.equal(getSelectedSourcesSummary(1), "1 source attached");
assert.equal(getSelectedSourcesSummary(3), "3 sources attached");
assert.equal(
  hasDuplicateToast(
    [
      { type: "error", message: "Disk offline" },
      { type: "success", message: "Saved" },
    ],
    { type: "error", message: "Disk offline" },
  ),
  true,
);
assert.equal(
  hasDuplicateToast([{ type: "error", message: "Disk offline" }], {
    type: "info",
    message: "Disk offline",
  }),
  false,
);
assert.equal(parseSidebarTab("search"), "search");
assert.equal(parseSidebarTab("anything"), DEFAULT_SIDEBAR_TAB);
assert.equal(parseSidebarTab(null), DEFAULT_SIDEBAR_TAB);
assert.equal(formatSearchTabBadge(0), null);
assert.equal(formatSearchTabBadge(7), "7");
assert.equal(formatSearchTabBadge(142), "99+");
assert.equal(createDefaultStudyTimerState(1000).seconds, WORK_DURATION_SECONDS);
assert.equal(getTimerDuration("break"), BREAK_DURATION_SECONDS);
assert.equal(getNextTimerMode("work"), "break");
assert.equal(formatStudyTimerTime(65), "1:05");
assert.equal(getStudyTimerProgress("work", WORK_DURATION_SECONDS), 0);
assert.equal(getStudyTimerProgress("break", 0), 1);
const serializedTimer = serializeStudyTimerState({
  mode: "work",
  seconds: 90,
  isActive: true,
  updatedAt: 1_000,
});
assert.deepEqual(deserializeStudyTimerState(serializedTimer, 95_000), {
  mode: "break",
  seconds: BREAK_DURATION_SECONDS,
  isActive: false,
  updatedAt: 95_000,
});
assert.equal(readStudyTimerState({ getItem: () => null }, 2_000).seconds, WORK_DURATION_SECONDS);

const chatHistory = [
  {
    id: "m1",
    role: "user",
    content: "Hello",
    timestamp: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "m2",
    role: "assistant",
    content: "Hi there",
    timestamp: new Date("2026-01-01T00:00:01.000Z"),
  },
];
const serializedHistory = serializeChatHistory(chatHistory);
const parsedHistory = deserializeChatHistory(serializedHistory);
assert.equal(parsedHistory.length, 2);
assert.equal(parsedHistory[0].timestamp.toISOString(), "2026-01-01T00:00:00.000Z");
assert.equal(parsedHistory[1].content, "Hi there");
assert.deepEqual(deserializeChatHistory("{"), []);
assert.deepEqual(deserializeChatHistory('{"bad":true}'), []);
assert.deepEqual(
  deserializeChatHistory('[{"id":"bad","role":"user","content":"x","timestamp":"nope"}]'),
  [],
);
assert.equal(
  limitChatHistory(
    Array.from({ length: CHAT_HISTORY_LIMIT + 5 }, (_, index) => ({
      id: `m-${index}`,
      role: "user",
      content: `Message ${index}`,
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
    })),
  ).length,
  CHAT_HISTORY_LIMIT,
);

const pdfAnnotations = {
  version: 1,
  pages: {
    1: {
      ink: [
        {
          id: "ink-1",
          points: [{ x: 10, y: 20 }],
          color: "#6c8aff",
          width: 2,
        },
      ],
      highlights: [],
      notes: [],
      textboxes: [],
    },
  },
};
assert.equal(
  buildPdfAnnotationSidecarPath("C:\\Study\\lecture.pdf"),
  "C:\\Study\\lecture.pdf.annotations.json",
);
assert.deepEqual(createEmptyPdfAnnotationData(), { version: 1, pages: {} });
assert.deepEqual(
  parsePdfAnnotationData(serializePdfAnnotationData(pdfAnnotations)),
  pdfAnnotations,
);
assert.equal(
  parsePdfAnnotationData(
    '{"version":1,"pages":{"zero":{"ink":[],"highlights":[],"notes":[],"textboxes":[]}}}',
  ),
  null,
);
assert.equal(parsePdfAnnotationData('{"version":1,"pages":{"1":{"ink":"bad"}}}'), null);
assert.equal(parsePdfAnnotationData("not-json"), null);

console.log("Utility checks passed.");
