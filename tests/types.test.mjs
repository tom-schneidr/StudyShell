import assert from "node:assert/strict";

import { cellSourceToString, formatBytes, getFileType } from "../src/types.ts";
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
  resolveCreationDirectory,
  suggestUniqueDirectoryName,
  suggestUniqueMarkdownFileName,
} from "../src/utils/fileCreation.ts";
import { filterFileTree } from "../src/utils/fileTreeFilter.ts";
import {
  getChatPlaceholder,
  getVertexConfigErrorMessage,
  vertexConfigGuidance,
} from "../src/utils/aiConfig.ts";
import {
  extractJsonArrayCandidate,
  parseFlashcardsResponse,
} from "../src/utils/flashcards.ts";
import {
  buildMarkdownImageTag,
  buildPastedImageFilename,
  extensionFromImageMimeType,
  insertTextAtSelection,
} from "../src/utils/markdownAssets.ts";
import {
  getParentPath,
  isSameOrDescendantPath,
  joinPath,
  remapPathPrefix,
} from "../src/utils/pathUtils.ts";
import { removeFileNodesWithinPath } from "../src/utils/fileState.ts";
import {
  resolveCodeLanguage,
  shouldPersistCodeContent,
} from "../src/utils/codeEditor.ts";
import {
  CHAT_HISTORY_LIMIT,
  deserializeChatHistory,
  limitChatHistory,
  serializeChatHistory,
} from "../src/utils/aiHistory.ts";
import {
  buildPdfAnnotationSidecarPath,
  createEmptyPdfAnnotationData,
  parsePdfAnnotationData,
  serializePdfAnnotationData,
} from "../src/utils/pdfAnnotations.ts";

assert.equal(getFileType("md"), "markdown");
assert.equal(getFileType("PDF"), "pdf");
assert.equal(getFileType("png"), "image");
assert.equal(getFileType("ipynb"), "notebook");
assert.equal(getFileType("ts"), "code");
assert.equal(getFileType("rs"), "code");
assert.equal(getFileType("bin"), "unsupported");
assert.equal(getFileType(null), "unsupported");

assert.equal(formatBytes(0), "0 B");
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
assert.equal(buildChatContext([{ label: "Empty", path: "C:\\empty.txt", content: "   " }]), undefined);

assert.equal(normalizeMarkdownFileName("Lecture 1"), "Lecture 1.md");
assert.equal(normalizeMarkdownFileName("summary.md"), "summary.md");
assert.equal(normalizeMarkdownFileName("  inva<lid>|name  "), "inva-lid--name.md");
assert.equal(normalizeDirectoryName(" Week <1> "), "Week -1-");
assert.equal(suggestUniqueMarkdownFileName(["untitled-note.md"], "untitled-note"), "untitled-note-2.md");
assert.equal(
  suggestUniqueMarkdownFileName(["Lecture 1.md", "Lecture 1-2.md"], "Lecture 1"),
  "Lecture 1-3.md",
);
assert.equal(suggestUniqueDirectoryName(["untitled-folder"], "untitled-folder"), "untitled-folder-2");
assert.equal(
  suggestUniqueDirectoryName(["Week 1", "Week 1-2"], "Week 1"),
  "Week 1-3",
);
assert.equal(resolveCreationDirectory({ is_dir: true, path: "C:\\Notes" }), "C:\\Notes");
assert.equal(resolveCreationDirectory({ is_dir: false, path: "C:\\Notes\\week1.txt" }), "C:\\Notes");
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
assert.deepEqual(listChildNamesForDirectory(fileTree, "C:\\Coursework\\Week 1"), ["lecture-notes.md"]);
assert.deepEqual(listChildNamesForDirectory(fileTree, "C:\\missing"), []);
assert.equal(filterFileTree(fileTree, "todo")[0].name, "todo.txt");
assert.equal(filterFileTree(fileTree, "lecture")[0].name, "Coursework");
assert.equal(
  filterFileTree(fileTree, "lecture")[0].children[0].children[0].name,
  "lecture-notes.md",
);
assert.equal(filterFileTree(fileTree, "missing").length, 0);

assert.match(getVertexConfigErrorMessage(), /Vertex AI is not configured/);
assert.match(getVertexConfigErrorMessage(), /PROJECT_ID/);
assert.equal(getChatPlaceholder(null, false), "Checking Vertex AI setup...");
assert.equal(getChatPlaceholder(false, true), "Configure Vertex AI to start chatting...");
assert.equal(getChatPlaceholder(true, false), "Ask your sources...");
assert.equal(getChatPlaceholder(true, true), "Search and ask...");
assert.match(vertexConfigGuidance, /Google application default credentials/);

assert.equal(
  extractJsonArrayCandidate('```json\n[{"front":"Q1","back":"A1"}]\n```'),
  '[{"front":"Q1","back":"A1"}]',
);
assert.deepEqual(
  parseFlashcardsResponse('```json\n[{"front":" Term ","back":" Definition "},{"front":"","back":"skip"}]\n```'),
  [{ front: "Term", back: "Definition" }],
);
assert.deepEqual(
  parseFlashcardsResponse('Here you go:\n[{"front":"Q1","back":"A1"},{"front":"Q2","back":"A2"}]'),
  [
    { front: "Q1", back: "A1" },
    { front: "Q2", back: "A2" },
  ],
);
assert.throws(() => parseFlashcardsResponse("[]"), /valid flashcards/);
assert.equal(extensionFromImageMimeType("image/png"), "png");
assert.equal(extensionFromImageMimeType("image/jpeg"), "jpg");
assert.equal(extensionFromImageMimeType("image/svg+xml"), "svg");
assert.equal(buildPastedImageFilename("image/webp", 123), "pasted-image-123.webp");
assert.equal(
  buildMarkdownImageTag("pasted-image-123.png", "_assets/pasted-image-123.png"),
  "\n![pasted-image-123.png](_assets/pasted-image-123.png)\n",
);
assert.equal(
  insertTextAtSelection("alpha omega", 6, 11, "study"),
  "alpha study",
);
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
assert.equal(
  remapPathPrefix("/tmp/coursework/notes.md", "/tmp/course", "/tmp/archive"),
  null,
);
assert.equal(resolveCodeLanguage(undefined, "C:\\Study\\main.tsx"), "tsx");
assert.equal(resolveCodeLanguage("PY", "/tmp/example.txt"), "py");
assert.equal(resolveCodeLanguage(undefined, "Makefile"), "makefile");
assert.equal(shouldPersistCodeContent("const x = 1;", "const x = 1;"), false);
assert.equal(shouldPersistCodeContent("const x = 2;", "const x = 1;"), true);
assert.deepEqual(
  removeFileNodesWithinPath(
    [
      { name: "notes.md", path: "C:\\Study\\notes.md", is_dir: false, extension: "md", children: null },
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
    model: "gemini-2.5-flash",
  },
];
const serializedHistory = serializeChatHistory(chatHistory);
const parsedHistory = deserializeChatHistory(serializedHistory);
assert.equal(parsedHistory.length, 2);
assert.equal(parsedHistory[0].timestamp.toISOString(), "2026-01-01T00:00:00.000Z");
assert.equal(parsedHistory[1].model, "gemini-2.5-flash");
assert.deepEqual(deserializeChatHistory('{"bad":true}'), []);
assert.deepEqual(
  deserializeChatHistory('[{"id":"bad","role":"user","content":"x","timestamp":"nope"}]'),
  [],
);
assert.equal(limitChatHistory(Array.from({ length: CHAT_HISTORY_LIMIT + 5 }, (_, index) => ({
  id: `m-${index}`,
  role: "user",
  content: `Message ${index}`,
  timestamp: new Date("2026-01-01T00:00:00.000Z"),
}))).length, CHAT_HISTORY_LIMIT);

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
assert.equal(parsePdfAnnotationData('{"version":1,"pages":{"zero":{"ink":[],"highlights":[],"notes":[],"textboxes":[]}}}'), null);
assert.equal(parsePdfAnnotationData('{"version":1,"pages":{"1":{"ink":"bad"}}}'), null);
assert.equal(parsePdfAnnotationData("not-json"), null);

console.log("Utility checks passed.");
