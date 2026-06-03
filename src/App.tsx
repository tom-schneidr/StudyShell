import { lazy, Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import ChatPanel from "./components/ChatPanel";
import ContextMenu from "./components/ContextMenu";
import CreationModal from "./components/CreationModal";
import ConfirmDialog from "./components/ConfirmDialog";
import StudyTimer from "./components/StudyTimer";
import type { CommandItem } from "./components/CommandPalette";
import DropOverlay from "./components/DropOverlay";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { 
  MessageSquareText, 
  Files, 
  FilePlus2, 
  FolderPlus, 
  Trash2, 
  Sidebar as SidebarIcon, 
  MessageSquare,
  FolderSearch,
  RefreshCw,
  Sparkles,
  Sun,
  Moon
} from "lucide-react";
import { useFileSystem } from "./hooks/useFileSystem";
import { useFileSystemActions } from "./hooks/useFileSystemActions";
import { useStudyAI } from "./hooks/useStudyAI";
import { useToast } from "./components/ToastProvider";
import type { FileNode, NotebookData, PdfAnnotationData, StudyShellExplainEventDetail, TauriDragDropPayload } from "./types";
import { getFileType } from "./types";
import { buildChatContext, canUseFileAsChatContext } from "./utils/chatContext";
import { parseFlashcardsResponse, parseQuizResponse, type FlashcardCard, type QuizQuestion } from "./utils/flashcards";
import {
  normalizeDirectoryName,
  normalizeMarkdownFileName,
  resolveCreationDirectory,
} from "./utils/fileCreation";
import {
  getPathBaseName,
  isSameOrDescendantPath,
  joinPath,
  remapPathPrefix,
} from "./utils/pathUtils";
import {
  collectFilePaths as collectWorkspaceFilePaths,
  filterFileNodesByPaths,
  filterRecordByPaths,
  removeFileNodesWithinPath,
} from "./utils/fileState";
import { buildWorkspaceCommandTarget } from "./utils/commandPalette";
import {
  deserializeRecentFiles,
  filterRecentFilesForWorkspace,
  normalizeRecentFiles,
  serializeRecentFiles,
} from "./utils/recentFiles";
import { normalizeSelectedSources } from "./utils/sourceSelection";
import {
  buildPdfAnnotationSidecarPath,
  parsePdfAnnotationData,
  serializePdfAnnotationData,
} from "./utils/pdfAnnotations";
import { STORAGE_KEYS, parseStoredBoolean, parseStoredRootPath } from "./utils/appPreferences";
import {
  clampChatWidth,
  clampSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH,
  readStoredChatPanelVisible,
  readStoredChatWidth,
  readStoredSidebarWidth,
} from "./utils/layoutPreferences";

const CommandPalette = lazy(() => import("./components/CommandPalette"));
const FlashcardDeck = lazy(() => import("./components/FlashcardDeck"));
const QuizView = lazy(() => import("./components/QuizView"));
const ShortcutsModal = lazy(() => import("./components/ShortcutsModal"));
const SettingsView = lazy(() => import("./components/SettingsView"));

function findFileNodeByPath(nodes: FileNode[], targetPath: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return node;
    }

    if (node.is_dir && node.children) {
      const match = findFileNodeByPath(node.children, targetPath);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

function remapFileNodePath(node: FileNode, oldPath: string, newPath: string, exactName: string): FileNode {
  const remappedPath = remapPathPrefix(node.path, oldPath, newPath);
  if (!remappedPath) {
    return node;
  }

  return {
    ...node,
    path: remappedPath,
    name: node.path === oldPath ? exactName : node.name,
  };
}

function remapFileNodeList(nodes: FileNode[], oldPath: string, newPath: string, exactName: string): FileNode[] {
  return nodes.map((node) => remapFileNodePath(node, oldPath, newPath, exactName));
}

function remapRecordKeys<T>(record: Record<string, T>, oldPath: string, newPath: string): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).map(([path, value]) => [remapPathPrefix(path, oldPath, newPath) ?? path, value]),
  );
}

export default function App() {
  const toast = useToast();
  
  const [activeFile, setActiveFile] = useState<FileNode | null>(null);

  const fs = useFileSystem();
  const ai = useStudyAI();
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [binaryData, setBinaryData] = useState<Uint8Array | null>(null);
  const [binaryLoading, setBinaryLoading] = useState(false);
  const [notebookData, setNotebookData] = useState<NotebookData | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileNode[]>(() => {
    try {
      const stored = localStorage.getItem("recentFiles");
      if (stored) return deserializeRecentFiles(stored);
    } catch {}
    return [];
  });

  const [pinnedFiles, setPinnedFiles] = useState<FileNode[]>(() => {
    try {
      const stored = localStorage.getItem("pinnedFiles");
      return stored ? JSON.parse(stored) : [];
    } catch {}
    return [];
  });

  const handleTogglePinFile = useCallback((node: FileNode) => {
    setPinnedFiles((prev) => {
      const isAlreadyPinned = prev.some((f) => f.path === node.path);
      const next = isAlreadyPinned
        ? prev.filter((f) => f.path !== node.path)
        : [...prev, node];
      localStorage.setItem("pinnedFiles", JSON.stringify(next));
      return next;
    });
  }, []);

  const [showChatPanel, setShowChatPanel] = useState(() => readStoredChatPanelVisible(window.localStorage));
  const [selectedSources, setSelectedSources] = useState<FileNode[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredSidebarWidth(window.localStorage));
  const [chatWidth, setChatWidth] = useState(() => readStoredChatWidth(window.localStorage));

  const [flashcardSession, setFlashcardSession] = useState<{
    isOpen: boolean;
    cards: FlashcardCard[];
  }>({
    isOpen: false,
    cards: [],
  });
  
  const [quizSession, setQuizSession] = useState<{
    isOpen: boolean;
    questions: QuizQuestion[];
  }>({
    isOpen: false,
    questions: [],
  });

  const [pdfAnnotations, setPdfAnnotations] = useState<Record<string, PdfAnnotationData>>({});
  const lastPersistedPdfAnnotationsRef = useRef<Record<string, string>>({});

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode | null;
    visible: boolean;
  }>({ x: 0, y: 0, node: null, visible: false });

  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null);
  const [openTabs, setOpenTabs] = useState<FileNode[]>(() => {
    try {
        const stored = localStorage.getItem("openTabs");
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSplit, setIsSplit] = useState(() =>
    parseStoredBoolean(window.localStorage.getItem(STORAGE_KEYS.splitViewEnabled), false),
  );
  const [restoredSecondPanePath, setRestoredSecondPanePath] = useState<string | null>(() =>
    parseStoredRootPath(window.localStorage.getItem(STORAGE_KEYS.splitViewPath)),
  );
  const [secondActiveFile, setSecondActiveFile] = useState<FileNode | null>(null);
  const [secondFileContent, setSecondFileContent] = useState<string | null>(null);
  const [secondBinaryData, setSecondBinaryData] = useState<Uint8Array | null>(null);
  const [secondBinaryLoading, setSecondBinaryLoading] = useState(false);
  const [secondNotebookData, setSecondNotebookData] = useState<NotebookData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const storedTheme = localStorage.getItem(STORAGE_KEYS.theme) ?? localStorage.getItem("theme");
    return storedTheme === "light" ? "light" : "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("theme-light");
    } else {
      root.classList.remove("theme-light");
    }
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sidebarWidth, String(clampSidebarWidth(sidebarWidth)));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.chatWidth, String(clampChatWidth(chatWidth)));
  }, [chatWidth]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.chatPanelVisible, String(showChatPanel));
  }, [showChatPanel]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.splitViewEnabled, String(isSplit));
  }, [isSplit]);

  useEffect(() => {
    if (secondActiveFile) {
      localStorage.setItem(STORAGE_KEYS.splitViewPath, secondActiveFile.path);
      return;
    }

    if (!restoredSecondPanePath) {
      localStorage.removeItem(STORAGE_KEYS.splitViewPath);
    }
  }, [restoredSecondPanePath, secondActiveFile]);

  const resetFileState = useCallback(() => {
    setFileContent(null);
    setBinaryData(null);
    setBinaryLoading(false);
    setNotebookData(null);
  }, []);

  const resetSecondPaneState = useCallback(() => {
    setSecondActiveFile(null);
    setSecondFileContent(null);
    setSecondBinaryData(null);
    setSecondBinaryLoading(false);
    setSecondNotebookData(null);
    setRestoredSecondPanePath(null);
  }, []);

  const liveFilePaths = useMemo(() => collectWorkspaceFilePaths(fs.fileTree), [fs.fileTree]);

  const handleFileSelect = useCallback(
    async (node: FileNode) => {
      if (node.is_dir) return;

      setOpenTabs(prev => {
        if (!prev.find(t => t.path === node.path)) {
          return [...prev, node];
        }
        return prev;
      });

      setRecentFiles(prev => {
        const filtered = prev.filter(t => t.path !== node.path);
        const next = filterRecentFilesForWorkspace(
          normalizeRecentFiles([node, ...filtered]),
          fs.rootPath,
          new Set([...liveFilePaths, node.path]),
        );
        localStorage.setItem("recentFiles", serializeRecentFiles(next));
        return next;
      });

      setActiveFile(node);
      resetFileState();

      const fileType = getFileType(node.extension, node.name);

      switch (fileType) {
        case "pdf":
        case "image":
        case "video":
        case "audio": {
          setBinaryLoading(true);
          try {
            const [data, annotationData] = await Promise.all([
              fs.readFileBinary(node.path),
              fileType === "pdf"
                ? fs.readFile(buildPdfAnnotationSidecarPath(node.path)).catch(() => null)
                : Promise.resolve(null),
            ]);
            setBinaryData(data);

            if (fileType === "pdf") {
              const parsedAnnotations = annotationData ? parsePdfAnnotationData(annotationData) : null;

              setPdfAnnotations((prev) => {
                const next = { ...prev };
                if (parsedAnnotations) {
                  next[node.path] = parsedAnnotations;
                  lastPersistedPdfAnnotationsRef.current[node.path] = annotationData ?? "";
                } else {
                  delete next[node.path];
                  delete lastPersistedPdfAnnotationsRef.current[node.path];
                }
                return next;
              });
            }
          } catch (e) {
            console.error("Failed to read binary file:", e);
          } finally {
            setBinaryLoading(false);
          }
          break;
        }

        case "notebook": {
          try {
            const content = await fs.readFile(node.path);
            const parsed = JSON.parse(content) as NotebookData;
            setNotebookData(parsed);
            setFileContent(content);
          } catch (e) {
            console.error("Failed to parse notebook:", e);
          }
          break;
        }

        case "flashcard":
        case "markdown":
        case "text":
        default: {
          try {
            const content = await fs.readFile(node.path);
            setFileContent(content);
          } catch (e) {
            console.error("Failed to read file as text:", e);
          }
          break;
        }
      }
    },
    [fs, liveFilePaths, resetFileState]
  );

  const fsa = useFileSystemActions(fs, (node) => handleFileSelect(node));

  const remapWorkspaceState = useCallback((oldPath: string, newPath: string, exactName = getPathBaseName(newPath)) => {
    if (activeFile && isSameOrDescendantPath(activeFile.path, oldPath)) {
      setActiveFile((prev) => (prev ? remapFileNodePath(prev, oldPath, newPath, exactName) : null));
    }

    if (secondActiveFile && isSameOrDescendantPath(secondActiveFile.path, oldPath)) {
      setSecondActiveFile((prev) => (prev ? remapFileNodePath(prev, oldPath, newPath, exactName) : null));
    }

    setOpenTabs((prev) => remapFileNodeList(prev, oldPath, newPath, exactName));
    setSelectedSources((prev) => remapFileNodeList(prev, oldPath, newPath, exactName));
    setRecentFiles((prev) => {
      const next = normalizeRecentFiles(remapFileNodeList(prev, oldPath, newPath, exactName));
      localStorage.setItem("recentFiles", serializeRecentFiles(next));
      return next;
    });
    setPinnedFiles((prev) => {
      const next = remapFileNodeList(prev, oldPath, newPath, exactName);
      localStorage.setItem("pinnedFiles", JSON.stringify(next));
      return next;
    });
    setPdfAnnotations((prev) => remapRecordKeys(prev, oldPath, newPath));
    lastPersistedPdfAnnotationsRef.current = remapRecordKeys(
      lastPersistedPdfAnnotationsRef.current,
      oldPath,
      newPath,
    );
  }, [activeFile, secondActiveFile]);

  const handleToggleSplit = useCallback(() => {
    if (isSplit) {
      setIsSplit(false);
      resetSecondPaneState();
      return;
    }

    if (!activeFile) {
      return;
    }

    setIsSplit(true);

    if (!secondActiveFile) {
      setSecondActiveFile(activeFile);
      setSecondFileContent(fileContent);
      setSecondBinaryData(binaryData);
      setSecondBinaryLoading(binaryLoading);
      setSecondNotebookData(notebookData);
    }
  }, [
    activeFile,
    binaryData,
    binaryLoading,
    fileContent,
    isSplit,
    notebookData,
    resetSecondPaneState,
    secondActiveFile,
  ]);

  const handleSelectSecondFile = useCallback(async (node: FileNode) => {
    if (node.is_dir) return;

    setIsSplit(true);
    setSecondActiveFile(node);
    setSecondFileContent(null);
    setSecondBinaryData(null);
    setSecondBinaryLoading(false);
    setSecondNotebookData(null);
    setRestoredSecondPanePath(null);

    const fileType = getFileType(node.extension, node.name);
    try {
        if (fileType === "pdf" || fileType === "image" || fileType === "video" || fileType === "audio") {
            setSecondBinaryLoading(true);
            const data = await fs.readFileBinary(node.path);
            setSecondBinaryData(data);
        } else if (fileType === "notebook") {
            const content = await fs.readFile(node.path);
            const parsed = JSON.parse(content) as NotebookData;
            setSecondNotebookData(parsed);
            setSecondFileContent(content);
        } else {
            const content = await fs.readFile(node.path);
            setSecondFileContent(content);
        }
    } catch (e) {
        console.error("Failed to load second file for split view:", e);
        resetSecondPaneState();
        setIsSplit(false);
    } finally {
        setSecondBinaryLoading(false);
    }
  }, [fs, resetSecondPaneState]);

  const handleSaveFile = useCallback(
    async (path: string, content: string) => {
      try {
        await fs.writeFile(path, content);
      } catch (e) {
        console.error("Failed to save file:", e);
        toast.error(`Failed to save file: ${e}`);
      }
    },
    [fs, toast]
  );

  const handleToggleSource = useCallback((node: FileNode) => {
    setSelectedSources(prev => {
        if (prev.find(s => s.path === node.path)) {
            return prev.filter(s => s.path !== node.path);
        }
        return normalizeSelectedSources([...prev, node]);
    });
  }, []);

  const handleCloseTab = useCallback((path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenTabs(prev => {
      const filtered = prev.filter(t => t.path !== path);
      if (activeFile?.path === path) {
        if (filtered.length > 0) {
          const oldIndex = prev.findIndex(t => t.path === path);
          const nextTab = filtered[Math.min(oldIndex, filtered.length - 1)];
          setTimeout(() => handleFileSelect(nextTab), 0);
        } else {
          setActiveFile(null);
          resetFileState();
        }
      }
      return filtered;
    });
  }, [activeFile, handleFileSelect, resetFileState]);

  const handleClearRecentFiles = useCallback(() => {
    setRecentFiles([]);
    localStorage.setItem("recentFiles", serializeRecentFiles([]));
  }, []);

  const handleGenerateFlashcards = useCallback(async () => {
    if (!activeFile || !fileContent) return;
    try {
        const response = await ai.sendMessage(
            "Generate 5 high-quality flashcards from this content. Return ONLY a JSON array with no extra explanation: [{\"front\": \"<term or question>\", \"back\": \"<definition or answer>\"}]",
            fileContent
        );
        if (response) {
            const cards = parseFlashcardsResponse(response);
            const targetPath = activeFile.path.replace(/\.[^/.]+$/, "") + ".flashcards.json";
            await fs.writeFile(targetPath, JSON.stringify(cards, null, 2));
            await fs.refreshTree();
            toast.success("Flashcards generated and saved locally.");
            
            const newNode: FileNode = {
              name: getPathBaseName(targetPath),
              path: targetPath,
              is_dir: false,
              extension: "json",
              children: null
            };
            setTimeout(() => handleFileSelect(newNode), 100);
        }
    } catch (e) {
        toast.error("Failed to generate flashcards.");
    }
  }, [activeFile, fileContent, ai, toast, fs, handleFileSelect]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setSidebarWidth(prev => (prev === 0 ? DEFAULT_SIDEBAR_WIDTH : 0));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "j") {
        e.preventDefault();
        setShowChatPanel(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        const hiding = sidebarWidth > 0 || showChatPanel;
        if (hiding) {
            setSidebarWidth(0);
            setShowChatPanel(false);
            toast.info("Focus Mode active.");
        } else {
            setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
            setShowChatPanel(true);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "w") {
        if (activeFile) {
          e.preventDefault();
          handleCloseTab(activeFile.path);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    const unlistenFuncs: Array<() => void> = [];
    
    const setupDnd = async () => {
      unlistenFuncs.push(await listen("tauri://drag-enter", () => setIsDragging(true)));
      unlistenFuncs.push(await listen("tauri://drag-leave", () => setIsDragging(false)));
      unlistenFuncs.push(await listen<TauriDragDropPayload>("tauri://drag-drop", async (event) => {
        setIsDragging(false);
        const paths = event.payload.paths;
        if (paths.length > 0 && fs.rootPath) {
          try {
            const targetDir = activeFile?.is_dir ? activeFile.path : (activeFile ? resolveCreationDirectory(activeFile) : fs.rootPath);
            await fs.importFiles(paths, targetDir);
            toast.success(`Imported ${paths.length} items.`);
            fs.refreshTree();
          } catch (err) {
            toast.error(`Import failed: ${err}`);
          }
        }
      }));
    };

    setupDnd();

    const handleExplain = (e: Event) => {
        const text = (e as CustomEvent<StudyShellExplainEventDetail>).detail?.text;
        if (text) {
            setShowChatPanel(true);
            void handleSendChatMessage(`Explain this content in detail:\n\n> ${text}`);
        }
    };
    window.addEventListener("studyshell:explain", handleExplain);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("studyshell:explain", handleExplain);
      unlistenFuncs.forEach(fn => fn());
    };
  }, [activeFile, handleCloseTab, fs, toast, showChatPanel, sidebarWidth]);

  useEffect(() => {
    if (activeFile && !liveFilePaths.has(activeFile.path)) {
      setActiveFile(null);
      resetFileState();
    }

    if (secondActiveFile && !liveFilePaths.has(secondActiveFile.path)) {
      setIsSplit(false);
      resetSecondPaneState();
    }

    setOpenTabs((prev) => filterFileNodesByPaths(prev, liveFilePaths));
    setSelectedSources((prev) => filterFileNodesByPaths(prev, liveFilePaths));
    setPdfAnnotations((prev) => filterRecordByPaths(prev, liveFilePaths));

    const filteredPersisted = filterRecordByPaths(lastPersistedPdfAnnotationsRef.current, liveFilePaths);
    if (Object.keys(filteredPersisted).length !== Object.keys(lastPersistedPdfAnnotationsRef.current).length) {
      lastPersistedPdfAnnotationsRef.current = filteredPersisted;
    }

    setRecentFiles((prev) => {
      const next = filterRecentFilesForWorkspace(prev, fs.rootPath, liveFilePaths);
      localStorage.setItem("recentFiles", serializeRecentFiles(next));
      return next;
    });

    setPinnedFiles((prev) => {
      const next = filterFileNodesByPaths(prev, liveFilePaths);
      localStorage.setItem("pinnedFiles", JSON.stringify(next));
      return next;
    });
  }, [activeFile, fs.rootPath, liveFilePaths, resetFileState, resetSecondPaneState, secondActiveFile]);

  useEffect(() => {
    if (!fs.rootPath || !isSplit || secondActiveFile || !restoredSecondPanePath) {
      return;
    }

    if (!liveFilePaths.has(restoredSecondPanePath)) {
      setRestoredSecondPanePath(null);
      return;
    }

    const restoredNode = findFileNodeByPath(fs.fileTree, restoredSecondPanePath);
    if (!restoredNode) {
      return;
    }

    setRestoredSecondPanePath(null);
    void handleSelectSecondFile(restoredNode);
  }, [
    fs.fileTree,
    fs.rootPath,
    handleSelectSecondFile,
    isSplit,
    liveFilePaths,
    restoredSecondPanePath,
    secondActiveFile,
  ]);

  useEffect(() => {
    localStorage.setItem("openTabs", JSON.stringify(openTabs));
  }, [openTabs]);

  useEffect(() => {
    if (activeFile) {
        localStorage.setItem("lastActiveFilePath", activeFile.path);
    }
  }, [activeFile]);

  const firstBootRef = useRef(true);
  useEffect(() => {
    if (firstBootRef.current && fs.rootPath && openTabs.length > 0) {
        firstBootRef.current = false;
        const lastPath = localStorage.getItem("lastActiveFilePath");
        if (lastPath) {
            const found = openTabs.find(t => t.path === lastPath);
            if (found) {
                handleFileSelect(found);
            }
        }
    }
  }, [fs.rootPath, openTabs, handleFileSelect]);

  const workspaceCommandTarget = buildWorkspaceCommandTarget(activeFile, fs.rootPath, fs.fileTree);
  const canCreateInWorkspace = workspaceCommandTarget !== null;
  const canSummarizeActiveFile = Boolean(activeFile && fileContent);
  const canGenerateQuiz = Boolean(activeFile && fileContent);
  const canClearChat = !ai.loading && ai.messages.length > 0;

  useEffect(() => {
    const annotationEntries = Object.entries(pdfAnnotations);
    if (annotationEntries.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      void Promise.all(
        annotationEntries.map(async ([path, annotations]) => {
          const serialized = serializePdfAnnotationData(annotations);
          if (lastPersistedPdfAnnotationsRef.current[path] === serialized) {
            return;
          }

          try {
            await fs.writeFile(buildPdfAnnotationSidecarPath(path), serialized);
            lastPersistedPdfAnnotationsRef.current[path] = serialized;
          } catch (error) {
            console.error(`Failed to persist PDF annotations for ${path}:`, error);
          }
        })
      );
    }, 500);

    return () => window.clearTimeout(timer);
  }, [pdfAnnotations, fs.writeFile]);

  const handleUpdatePdfAnnotations = useCallback((path: string, annotations: PdfAnnotationData) => {
    setPdfAnnotations(prev => ({
        ...prev,
        [path]: annotations
    }));
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: FileNode) => {
      setContextMenu({ x: e.clientX, y: e.clientY, node, visible: true });
    },
    []
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleDeleteRequest = useCallback((node: FileNode) => {
    setDeleteTarget(node);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await fs.deleteEntry(deleteTarget.path, deleteTarget.is_dir);

      if (activeFile && isSameOrDescendantPath(activeFile.path, deleteTarget.path)) {
        setActiveFile(null);
        resetFileState();
      }

      if (secondActiveFile && isSameOrDescendantPath(secondActiveFile.path, deleteTarget.path)) {
        setIsSplit(false);
        resetSecondPaneState();
      }

      setOpenTabs((prev) => removeFileNodesWithinPath(prev, deleteTarget.path));
      setRecentFiles((prev) => {
        const next = filterRecentFilesForWorkspace(
          removeFileNodesWithinPath(prev, deleteTarget.path),
          fs.rootPath,
          liveFilePaths,
        );
        localStorage.setItem("recentFiles", serializeRecentFiles(next));
        return next;
      });
      setPinnedFiles((prev) => {
        const next = removeFileNodesWithinPath(prev, deleteTarget.path);
        localStorage.setItem("pinnedFiles", JSON.stringify(next));
        return next;
      });

      setSelectedSources(prev =>
        prev.filter((source) => !isSameOrDescendantPath(source.path, deleteTarget.path))
      );

      toast.success("Deleted successfully.");
      await fs.refreshTree();
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error(`Failed to delete: ${error}`);
    } finally {
      setDeleteTarget(null);
    }
  }, [activeFile, deleteTarget, fs, liveFilePaths, resetFileState, resetSecondPaneState, secondActiveFile, toast]);

  const handleMoveRequest = useCallback(async (node: FileNode) => {
    try {
      const selectedThemeFolder = await open({
        directory: true,
        multiple: false,
        title: "Select Destination Folder",
        defaultPath: fs.rootPath ?? undefined
      });

      if (!selectedThemeFolder || typeof selectedThemeFolder !== "string") {
        return; // Cancelled
      }

      if (node.is_dir && isSameOrDescendantPath(selectedThemeFolder, node.path)) {
         toast.error("Cannot move a folder into itself.");
         return;
      }

      const newPath = joinPath(selectedThemeFolder, node.name);
      if (newPath === node.path) {
        toast.info("Item is already in that folder.");
        return;
      }
      
      await fs.renameEntry(node.path, newPath);
      await fs.refreshTree();
      remapWorkspaceState(node.path, newPath, node.name);
      toast.success("Moved successfully.");

    } catch (e) {
      toast.error(`Move failed: ${e}`);
    }
  }, [fs, remapWorkspaceState, toast]);

  const handleCopyPath = useCallback(async (node: FileNode) => {
    try {
      await navigator.clipboard.writeText(node.path);
      toast.success(`${node.is_dir ? "Folder" : "File"} path copied.`);
    } catch (error) {
      console.error("Failed to copy path:", error);
      toast.error("Failed to copy path.");
    }
  }, [toast]);

  const handleCreateRootNote = useCallback(() => {
    if (fs.rootPath) {
      fsa.handleCreateNote({
        name: normalizeMarkdownFileName("untitled-note"),
        path: fs.rootPath,
        is_dir: true,
        extension: null,
        children: fs.fileTree,
      });
    }
  }, [fs, fsa]);

  const handleCreateRootFolder = useCallback(() => {
    if (fs.rootPath) {
      fsa.handleCreateFolder({
        name: normalizeDirectoryName("untitled-folder"),
        path: fs.rootPath,
        is_dir: true,
        extension: null,
        children: fs.fileTree,
      });
    }
  }, [fs, fsa]);

  const collectFilePaths = useCallback((node: FileNode): string[] => {
    const paths: string[] = [];
    
    const traverse = (current: FileNode) => {
        if (current.is_dir && current.children) {
            for (const child of current.children) {
                traverse(child);
            }
        } else if (!current.is_dir) {
            const ft = getFileType(current.extension);
            if (ft === "markdown" || ft === "text" || ft === "pdf") {
                paths.push(current.path);
            }
        }
    };

    traverse(node);
    return paths;
  }, []);

  const handleGenerateSummary = useCallback(
    async (node: FileNode) => {
      const paths = collectFilePaths(node);
      if (paths.length === 0) {
        toast.info("No text files found to summarize.");
        return;
      }
      try {
        const summary = await ai.summarizeFiles(paths);
        const summaryPath = joinPath(resolveCreationDirectory(node), "summary.md");
        await fs.writeFile(summaryPath, summary);
        await fs.refreshTree();
        handleFileSelect({ name: "summary.md", path: summaryPath, is_dir: false, extension: "md", children: null });
      } catch (e) {
        console.error("Failed to generate summary:", e);
        toast.error("Failed to generate summary.");
      }
    },
    [ai, fs, collectFilePaths, handleFileSelect, toast]
  );

  const handleCreateStudyGuide = useCallback(
    async (node: FileNode) => {
      const paths = collectFilePaths(node);
      if (paths.length === 0) {
        toast.info("No text files found to create study guide from.");
        return;
      }
      try {
        const guide = await ai.generateStudyGuide(paths);
        const guidePath = joinPath(resolveCreationDirectory(node), "study_guide.md");
        await fs.writeFile(guidePath, guide);
        await fs.refreshTree();
        handleFileSelect({ name: "study_guide.md", path: guidePath, is_dir: false, extension: "md", children: null });
      } catch (e) {
        console.error("Failed to create study guide:", e);
        toast.error("Failed to create study guide.");
      }
    },
    [ai, fs, collectFilePaths, handleFileSelect, toast]
  );

  const handleSummarizeCurrentFile = useCallback(() => {
    if (activeFile && fileContent) {
      ai.sendMessage(
        "Please provide a concise summary of this file highlighting the key concepts.",
        fileContent
      );
    }
  }, [activeFile, fileContent, ai]);

  const handleGenerateQuiz = useCallback(async () => {
    if (!activeFile || !fileContent) return;

    const prompt = `Based on the following study material, generate 5 multiple-choice questions.
    Return ONLY a raw JSON array of objects with no extra text, where each object has:
    - "question": string
    - "options": string array of exactly 4 items
    - "correctIndex": number (0-3)
    - "explanation": string
    Material:
      ${fileContent}`;

    try {
        const response = await ai.sendMessage(prompt, "You are a specialized quiz engine. Return ONLY JSON. No explanations.");
        if (!response) {
          toast.error("Failed to generate quiz.");
          return;
        }

        const questions = parseQuizResponse(response);
        setQuizSession({ isOpen: true, questions });
    } catch (e) {
        console.error("Quiz error:", e);
        toast.error("Failed to parse quiz response. AI might have returned invalid JSON.");
    }
  }, [activeFile, fileContent, ai, toast]);


  const handleSendChatMessage = useCallback(
    async (message: string) => {
      const seenPaths = new Set<string>();
      const contextSections: Array<{ label: string; path: string; content: string }> = [];

      if (activeFile && fileContent && canUseFileAsChatContext(activeFile)) {
        seenPaths.add(activeFile.path);
        contextSections.push({
          label: `Active file: ${activeFile.name}`,
          path: activeFile.path,
          content: fileContent,
        });
      }

      const additionalSources = await Promise.all(
        selectedSources
          .filter((source) => !seenPaths.has(source.path) && canUseFileAsChatContext(source))
          .map(async (source) => {
            try {
              const content = await fs.readFile(source.path);
              seenPaths.add(source.path);
              return {
                label: `Selected source: ${source.name}`,
                path: source.path,
                content,
              };
            } catch (error) {
              console.error(`Failed to read selected source ${source.path}:`, error);
              return null;
            }
          })
      );

      const context = buildChatContext([
        ...contextSections,
        ...additionalSources.filter((source): source is NonNullable<typeof source> => source !== null),
      ]);

      await ai.sendMessageStreaming(message, context);
    },
    [activeFile, fileContent, selectedSources, fs, ai]
  );

  const globalCommands: CommandItem[] = [
    {
      id: "new-note",
      label: "New Markdown Note",
      category: "Files",
      icon: <FilePlus2 size={16} />,
      description: canCreateInWorkspace
        ? "Create a new note in the active folder or workspace root"
        : "Select a workspace first",
      disabled: !workspaceCommandTarget,
      onSelect: () => {
        if (workspaceCommandTarget) {
          fsa.handleCreateNote(workspaceCommandTarget);
        }
      },
    },
    {
      id: "new-folder",
      label: "New Folder",
      category: "Files",
      icon: <FolderPlus size={16} />,
      description: canCreateInWorkspace
        ? "Create a folder in the active folder or workspace root"
        : "Select a workspace first",
      disabled: !workspaceCommandTarget,
      onSelect: () => {
        if (workspaceCommandTarget) {
          fsa.handleCreateFolder(workspaceCommandTarget);
        }
      },
    },
    {
      id: "toggle-sidebar",
      label: "Toggle Sidebar",
      category: "View",
      icon: <SidebarIcon size={16} />,
      shortcut: "Ctrl+B",
      onSelect: () => setSidebarWidth(prev => (prev === 0 ? DEFAULT_SIDEBAR_WIDTH : 0)),
    },
    {
      id: "toggle-chat",
      label: "Toggle AI Assistant",
      category: "View",
      icon: <MessageSquare size={16} />,
      shortcut: "Ctrl+J",
      onSelect: () => setShowChatPanel(prev => !prev),
    },
    {
      id: "open-workspace",
      label: "Open Workspace Folder",
      category: "System",
      icon: <FolderSearch size={16} />,
      onSelect: () => fs.selectRootFolder(),
    },
    {
      id: "refresh-tree",
      label: "Refresh File Tree",
      category: "System",
      icon: <RefreshCw size={16} />,
      onSelect: () => fs.refreshTree(),
    },
    {
      id: "clear-chat",
      label: "Clear AI Chat History",
      category: "AI",
      icon: <Trash2 size={16} />,
      description: canClearChat ? "Remove the current AI conversation" : "No chat history to clear",
      disabled: !canClearChat,
      onSelect: () => ai.clearChat(),
    },
    {
      id: "clear-recent-files",
      label: "Clear Recent Files",
      category: "Files",
      icon: <Trash2 size={16} />,
      description: recentFiles.length > 0 ? "Reset the current workspace recent list" : "No recent files to clear",
      disabled: recentFiles.length === 0,
      onSelect: handleClearRecentFiles,
    },
    {
      id: "summarize-file",
      label: "Summarize Active File",
      category: "AI",
      icon: <Sparkles size={16} />,
      description: canSummarizeActiveFile ? "Send the open file to the AI assistant" : "Open a text file first",
      disabled: !canSummarizeActiveFile,
      onSelect: () => {
        if (canSummarizeActiveFile) {
          handleSummarizeCurrentFile();
        }
      },
    },
    {
      id: "generate-quiz",
      label: "Generate AI Quiz",
      category: "AI",
      icon: <MessageSquare size={16} />,
      description: canGenerateQuiz
        ? "Create 5 multiple choice questions from the open file"
        : "Open a text-based file first",
      disabled: !canGenerateQuiz,
      onSelect: () => handleGenerateQuiz(),
    },
    {
      id: "toggle-theme",
      label: `Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`,
      category: "View",
      icon: theme === "dark" ? <Sun size={16} /> : <Moon size={16} />,
      onSelect: () => setTheme(prev => prev === "dark" ? "light" : "dark"),
    }
  ];

  return (
    <div className="h-screen w-screen flex bg-shell-bg overflow-hidden relative text-shell-text select-none">
      <div className="bg-glow" />

      {sidebarWidth > 0 && (
          <div 
            className="flex-shrink-0 z-10 relative group h-full border-r border-shell-border bg-shell-surface/30 shadow-2xl overflow-hidden"
            style={{ width: sidebarWidth }}
          >
            <Sidebar
              rootPath={fs.rootPath}
              fileTree={fs.fileTree}
              directoryStats={fs.directoryStats}
              loading={fs.loading}
              statsLoading={fs.statsLoading}
              error={fs.error}
              activeFilePath={activeFile?.path || null}
              selectedSourcePaths={selectedSources.map(s => s.path)}
              recentFiles={recentFiles}
              pinnedFiles={pinnedFiles}
              onTogglePin={handleTogglePinFile}
              onClearRecentFiles={handleClearRecentFiles}
              onSelectRoot={fs.selectRootFolder}
              onRefresh={() => fs.refreshTree()}
              onFileSelect={handleFileSelect}
              onContextMenu={handleContextMenu}
              onToggleSource={handleToggleSource}
              onCreateRootNote={handleCreateRootNote}
              onCreateRootFolder={handleCreateRootFolder}
              onCollapse={() => setSidebarWidth(0)}
              onSearch={fs.searchFiles}
            />
            <div 
              onMouseDown={() => {
                  const handleMove = (e: MouseEvent) => setSidebarWidth(clampSidebarWidth(e.clientX));
                  const handleUp = () => {
                      window.removeEventListener("mousemove", handleMove);
                      window.removeEventListener("mouseup", handleUp);
                  };
                  window.addEventListener("mousemove", handleMove);
                  window.addEventListener("mouseup", handleUp);
              }}
              className="absolute right-0 top-0 bottom-0 w-1 hover:bg-shell-accent/40 cursor-col-resize transition-colors z-50"
            />
          </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-shell-bg relative">
        <div className="h-10 border-b border-shell-border bg-shell-surface/10 flex items-center justify-between px-2">
          <div className="flex items-center gap-1">
            {sidebarWidth === 0 && (
                <button 
                  onClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
                  className="p-1.5 rounded-lg text-shell-text-muted hover:text-shell-accent hover:bg-shell-accent/10 transition-all cursor-pointer"
                  title="Open Explorer"
                >
                  <Files size={16} />
                </button>
            )}
            <div className="flex items-center gap-2 text-[10px] ml-2 font-bold text-shell-text-muted uppercase tracking-[0.2em] truncate">
              <span className="w-1 h-1 rounded-full bg-shell-accent/30" />
              {activeFile?.name || "STUDYSHELL"}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <StudyTimer />
            <div className="h-4 w-px bg-shell-border mx-1" />
            <div className="flex items-center gap-1">
            <button 
              onClick={() => setTheme(prev => (prev === "dark" ? "light" : "dark"))}
              className="p-1.5 rounded-lg text-shell-text-muted hover:text-shell-accent hover:bg-shell-accent/10 transition-all cursor-pointer"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {!showChatPanel && (
                <button 
                  onClick={() => setShowChatPanel(true)}
                  className="p-1.5 rounded-lg text-shell-text-muted hover:text-shell-accent hover:bg-shell-accent/10 transition-all cursor-pointer"
                  title="Open AI Assistant"
                >
                  <MessageSquareText size={16} />
                </button>
            )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative">
          <Editor
            activeFile={activeFile}
            openTabs={openTabs}
            fileContent={fileContent}
            binaryData={binaryData}
            binaryLoading={binaryLoading}
            notebookData={notebookData}
            pdfAnnotations={activeFile ? pdfAnnotations[activeFile.path] : null}
            onSaveFile={handleSaveFile}
            onSelectTab={handleFileSelect}
            onCloseTab={handleCloseTab}
            onUpdatePdfAnnotations={handleUpdatePdfAnnotations}
            onSaveAsset={fs.saveImageAsset}
            isSplit={isSplit}
            onToggleSplit={handleToggleSplit}
            secondActiveFile={secondActiveFile}
            secondFileContent={secondFileContent}
            secondBinaryData={secondBinaryData}
            secondBinaryLoading={secondBinaryLoading}
            secondNotebookData={secondNotebookData}
            fileTree={fs.fileTree}
            ai={ai}
            onCloseSecondPane={() => {
                setIsSplit(false);
                resetSecondPaneState();
            }}
          />
        </div>
      </div>

      {/* AI Assistant Side Panel */}
      {showChatPanel && (
        <div 
          className="flex-shrink-0 z-10 relative group h-full border-l border-shell-border bg-shell-surface/40 overflow-hidden"
          style={{ width: chatWidth }}
        >
          {/* Chat Resize Handle */}
          <div 
            onMouseDown={() => {
                const handleMove = (e: MouseEvent) => {
                    const newW = window.innerWidth - e.clientX;
                    setChatWidth(clampChatWidth(newW));
                };
                const handleUp = () => {
                    window.removeEventListener("mousemove", handleMove);
                    window.removeEventListener("mouseup", handleUp);
                };
                window.addEventListener("mousemove", handleMove);
                window.addEventListener("mouseup", handleUp);
            }}
            className="absolute left-0 top-0 bottom-0 w-1 hover:bg-shell-accent/40 cursor-col-resize transition-colors z-50"
          />
          <ChatPanel
            messages={ai.messages}
            loading={ai.loading}
            error={ai.error}
            aiStatus={ai.aiStatus}
            isConfigured={ai.isConfigured}
            useSearch={ai.useSearch}
            activeFileName={activeFile?.name || null}
            activeFileContent={fileContent}
            selectedSources={selectedSources}
            onSendMessage={handleSendChatMessage}
            onRefreshAiStatus={ai.refreshAiStatus}
            onSearchChange={ai.setUseSearch}
            onClearChat={ai.clearChat}
            canClearChat={canClearChat}
            onSummarizeCurrentFile={handleSummarizeCurrentFile}
            onGenerateFlashcards={handleGenerateFlashcards}
            onRemoveSource={(path: string) => setSelectedSources(prev => normalizeSelectedSources(prev.filter(s => s.path !== path)))}
            onClearSources={() => setSelectedSources([])}
            onCollapse={() => setShowChatPanel(false)}
          />
        </div>
      )}

      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        node={contextMenu.node}
        visible={contextMenu.visible}
        onClose={handleCloseContextMenu}
        onCreateNote={fsa.handleCreateNote}
        onCreateFolder={fsa.handleCreateFolder}
        onRename={fsa.handleRenameRequest}
        onMove={handleMoveRequest}
        onCopyPath={handleCopyPath}
        onDelete={handleDeleteRequest}
        onGenerateSummary={handleGenerateSummary}
        onCreateStudyGuide={handleCreateStudyGuide}
        onOpenInSidePane={handleSelectSecondFile}
        isSplit={isSplit}
        pinnedFiles={pinnedFiles}
        onTogglePin={handleTogglePinFile}
      />

      <CreationModal
        isOpen={fsa.creationModal.isOpen}
        mode={fsa.creationModal.mode}
        suggestedName={fsa.creationModal.suggestedName}
        onConfirm={(name) => {
          if (fsa.creationModal.mode === "rename") {
            const node = fsa.creationModal.targetNode;
            if (!node) return;
            fsa.handleConfirmRename(name, async (oldPath, newPath) => {
                await fs.refreshTree();
                remapWorkspaceState(oldPath, newPath, getPathBaseName(newPath));
            });
          } else {
            fsa.handleConfirmCreation(name);
          }
        }}
        onCancel={() => fsa.setCreationModal(prev => ({ ...prev, isOpen: false }))}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={deleteTarget?.is_dir ? "Delete Folder" : "Delete File"}
        message={
          deleteTarget?.is_dir
            ? "This will permanently delete this folder and all its contents."
            : "This will permanently delete this file."
        }
        detail={deleteTarget?.name}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <Suspense fallback={null}>
        <CommandPalette 
          isOpen={isCommandPaletteOpen} 
          onClose={() => setIsCommandPaletteOpen(false)} 
          commands={globalCommands}
        />
      </Suspense>
      <DropOverlay isVisible={isDragging} />

      <Suspense fallback={null}>
        {flashcardSession.isOpen && (
          <FlashcardDeck
            cards={flashcardSession.cards}
            title={`Review: ${activeFile?.name}`}
            onClose={() => setFlashcardSession({ isOpen: false, cards: [] })}
          />
        )}

        {quizSession.isOpen && (
          <QuizView
            questions={quizSession.questions}
            title={`Quiz: ${activeFile?.name}`}
            onClose={() => setQuizSession({ isOpen: false, questions: [] })}
          />
        )}

        <ShortcutsModal 
          isOpen={isShortcutsModalOpen}
          onClose={() => setIsShortcutsModalOpen(false)}
        />

        <SettingsView
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          systemPrompt={ai.systemPrompt}
          onSystemPromptChange={ai.setSystemPrompt}
          theme={theme}
          onThemeChange={setTheme}
          aiStatus={ai.aiStatus}
          isAiConfigured={ai.isConfigured}
          onRefreshAiStatus={ai.refreshAiStatus}
        />
      </Suspense>
    </div>
  );
}
