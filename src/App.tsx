import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import ChatPanel from "./components/ChatPanel";
import ContextMenu from "./components/ContextMenu";
import CreationModal from "./components/CreationModal";
import ConfirmDialog from "./components/ConfirmDialog";
import FlashcardDeck from "./components/FlashcardDeck";
import CommandPalette, { CommandItem } from "./components/CommandPalette";
import DropOverlay from "./components/DropOverlay";
import { listen } from "@tauri-apps/api/event";
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
  Sparkles
} from "lucide-react";
import { useFileSystem } from "./hooks/useFilesystem";
import { useVertexAI } from "./hooks/useVertexAI";
import { useToast } from "./components/ToastProvider";
import type { FileNode, NotebookData } from "./types";
import { getFileType } from "./types";
import { buildChatContext, canUseFileAsChatContext } from "./utils/chatContext";
import { parseFlashcardsResponse, type FlashcardCard } from "./utils/flashcards";
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
} from "./utils/fileCreation";
import {
  getParentPath,
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

export default function App() {
  const fs = useFileSystem();
  const ai = useVertexAI();
  const toast = useToast();

  // Active file state
  const [openTabs, setOpenTabs] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<FileNode | null>(null);
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

  // AI & Chat state
  const [showChatPanel, setShowChatPanel] = useState(true);
  const [selectedSources, setSelectedSources] = useState<FileNode[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [chatWidth, setChatWidth] = useState(400);

  const [flashcardSession, setFlashcardSession] = useState<{
    isOpen: boolean;
    cards: FlashcardCard[];
  }>({
    isOpen: false,
    cards: [],
  });

  const [pdfAnnotations, setPdfAnnotations] = useState<Record<string, any>>({});
  const lastPersistedPdfAnnotationsRef = useRef<Record<string, string>>({});

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode | null;
    visible: boolean;
  }>({ x: 0, y: 0, node: null, visible: false });

  // Creation modal state (shared for Create and Rename)
  const [creationModal, setCreationModal] = useState<{
    isOpen: boolean;
    mode: "file" | "folder" | "rename";
    targetNode: FileNode | null;
    suggestedName: string;
  }>({
    isOpen: false,
    mode: "file",
    targetNode: null,
    suggestedName: "",
  });

  // Deletion confirmation state
  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null);

  // Command Palette state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);



  // Reset all file state
  const resetFileState = useCallback(() => {
    setFileContent(null);
    setBinaryData(null);
    setBinaryLoading(false);
    setNotebookData(null);
  }, []);

  const liveFilePaths = useMemo(() => collectWorkspaceFilePaths(fs.fileTree), [fs.fileTree]);

  // Open a file
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

      const fileType = getFileType(node.extension);

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
            setFileContent(content); // also store raw for AI context
          } catch (e) {
            console.error("Failed to parse notebook:", e);
          }
          break;
        }

        case "markdown":
        case "text":
        default: {
          // "default" covers all other file types — we try to read them as text
          try {
            const content = await fs.readFile(node.path);
            setFileContent(content);
          } catch (e) {
            console.error("Failed to read file as text:", e);
            // If it fails (likely binary), we just leave it empty and let the UI show preview unavailable
          }
          break;
        }
      }
    },
    [fs, liveFilePaths, resetFileState]
  );

  // Toggle multi-source selection
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
          // Prefer opening the previously adjacent tab.
          const oldIndex = prev.findIndex(t => t.path === path);
          const nextTab = filtered[Math.min(oldIndex, filtered.length - 1)];
          // We must trigger file fetch async outside of React setState if we can,
          // but calling handleFileSelect here creates a stale closure loop easily.
          // Let's just unset it safely and trust a useEffect to sync or user to click.
          // Actually, we can just setTimeout to avoid React warnings.
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

  // Save a file
  const handleSaveFile = useCallback(
    async (path: string, content: string) => {
      try {
        await fs.writeFile(path, content);
      } catch (e) {
        console.error("Failed to save file:", e);
      }
    },
    [fs]
  );

  // Keyboard Shortcuts & DND
  useEffect(() => {
    // Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K: Open Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      // Ctrl+B: Toggle Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setSidebarWidth(prev => (prev === 0 ? 280 : 0));
      }
      // Ctrl+J: Toggle Chat
      if ((e.ctrlKey || e.metaKey) && e.key === "j") {
        e.preventDefault();
        setShowChatPanel(prev => !prev);
      }
      // Ctrl+W: Close Current Tab
      if ((e.ctrlKey || e.metaKey) && e.key === "w") {
        if (activeFile) {
          e.preventDefault();
          handleCloseTab(activeFile.path);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // native drag and drop listeners
    const unlistenFuncs: Array<() => void> = [];
    
    const setupDnd = async () => {
      unlistenFuncs.push(await listen("tauri://drag-enter", () => setIsDragging(true)));
      unlistenFuncs.push(await listen("tauri://drag-leave", () => setIsDragging(false)));
      unlistenFuncs.push(await listen<any>("tauri://drag-drop", async (event) => {
        setIsDragging(false);
        const paths = event.payload.paths as string[];
        if (paths.length > 0 && fs.rootPath) {
          try {
            // Import to the currently folder of the active file or root
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

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlistenFuncs.forEach(fn => fn());
    };
  }, [activeFile, handleCloseTab, fs, toast]);

  useEffect(() => {
    if (activeFile && !liveFilePaths.has(activeFile.path)) {
      setActiveFile(null);
      resetFileState();
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
  }, [activeFile, fs.rootPath, liveFilePaths, resetFileState]);

  const workspaceCommandTarget = buildWorkspaceCommandTarget(activeFile, fs.rootPath, fs.fileTree);
  const canCreateInWorkspace = workspaceCommandTarget !== null;
  const canSummarizeActiveFile = Boolean(activeFile && fileContent);

  // Define global commands
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
          void handleCreateNote(workspaceCommandTarget);
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
          void handleCreateFolder(workspaceCommandTarget);
        }
      },
    },
    {
      id: "toggle-sidebar",
      label: "Toggle Sidebar",
      category: "View",
      icon: <SidebarIcon size={16} />,
      shortcut: "Ctrl+B",
      onSelect: () => setSidebarWidth(prev => (prev === 0 ? 280 : 0)),
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
    }
  ];



  // Update PDF annotations globally
  const handleUpdatePdfAnnotations = useCallback((path: string, annotations: any) => {
    setPdfAnnotations(prev => ({
        ...prev,
        [path]: annotations
    }));
  }, []);

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

  // Context menu handlers
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: FileNode) => {
      setContextMenu({ x: e.clientX, y: e.clientY, node, visible: true });
    },
    []
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleCopyPath = useCallback(async (node: FileNode) => {
    try {
      await navigator.clipboard.writeText(node.path);
      toast.success(`${node.is_dir ? "Folder" : "File"} path copied.`);
    } catch (error) {
      console.error("Failed to copy path:", error);
      toast.error("Failed to copy path.");
    }
  }, [toast]);

  const handleCreateNote = useCallback(
    async (node: FileNode) => {
      const targetDirectory = resolveCreationDirectory(node);
      const existingNames = listChildNamesForDirectory(fs.fileTree, targetDirectory, fs.rootPath);
      const suggestedName = suggestUniqueMarkdownFileName(existingNames, "untitled-note");
      
      setCreationModal({
        isOpen: true,
        mode: "file",
        targetNode: node,
        suggestedName,
      });
    },
    [fs]
  );

  const handleCreateFolder = useCallback(
    async (node: FileNode) => {
      const targetDirectory = resolveCreationDirectory(node);
      const existingNames = listChildNamesForDirectory(fs.fileTree, targetDirectory, fs.rootPath);
      const suggestedName = suggestUniqueDirectoryName(existingNames, "untitled-folder");
      
      setCreationModal({
        isOpen: true,
        mode: "folder",
        targetNode: node,
        suggestedName,
      });
    },
    [fs]
  );

  const handleConfirmCreation = useCallback(
    async (name: string) => {
      if (!creationModal.targetNode) return;

      const node = creationModal.targetNode;
      const targetDirectory = resolveCreationDirectory(node);
      const existingNames = listChildNamesForDirectory(fs.fileTree, targetDirectory, fs.rootPath);

      try {
        if (creationModal.mode === "file") {
          const fileName = suggestUniqueMarkdownFileName(existingNames, name);
          const notePath = buildMarkdownNotePath(node, fileName);
          await fs.createFile(notePath, buildNewMarkdownContent(fileName));
          await fs.refreshTree();
          await handleFileSelect({
            name: fileName,
            path: notePath,
            is_dir: false,
            extension: "md",
            children: null,
          });
        } else {
          const folderName = suggestUniqueDirectoryName(existingNames, name);
          const folderPath = buildDirectoryPath(node, folderName);
          await fs.createDirectory(folderPath);
          await fs.refreshTree();
        }
      } catch (error) {
        console.error(`Failed to create ${creationModal.mode}:`, error);
        toast.error(`Failed to create ${creationModal.mode}: ${error}`);
      } finally {
        setCreationModal(prev => ({ ...prev, isOpen: false }));
      }
    },
    [fs, creationModal, handleFileSelect]
  );

  // Rename handlers
  const handleRenameRequest = useCallback((node: FileNode) => {
    setCreationModal({
      isOpen: true,
      mode: "rename",
      targetNode: node,
      suggestedName: node.name,
    });
  }, []);

  const handleConfirmRename = useCallback(async (newName: string) => {
    if (!creationModal.targetNode) return;
    const node = creationModal.targetNode;
    
    try {
      const newPath = joinPath(getParentPath(node.path), newName);
      
      await fs.renameEntry(node.path, newPath);

      if (activeFile && isSameOrDescendantPath(activeFile.path, node.path)) {
        const updatedPath = remapPathPrefix(activeFile.path, node.path, newPath);
        setActiveFile((prev) => (
          prev && updatedPath
            ? { ...prev, path: updatedPath, name: prev.path === node.path ? newName : prev.name }
            : prev
        ));
      }

      setOpenTabs(prev => prev.map(tab => {
        const updatedPath = remapPathPrefix(tab.path, node.path, newPath);
        if (updatedPath) {
          return { ...tab, path: updatedPath, name: tab.path === node.path ? newName : tab.name };
        }
        return tab;
      }));

      setSelectedSources(prev => prev.map(source => {
        const updatedPath = remapPathPrefix(source.path, node.path, newPath);
        if (updatedPath) {
          return { ...source, path: updatedPath, name: source.path === node.path ? newName : source.name };
        }
        return source;
      }));

      setPdfAnnotations((prev) => {
        const next: Record<string, any> = {};
        for (const [path, annotations] of Object.entries(prev)) {
          const updatedPath = remapPathPrefix(path, node.path, newPath);
          next[updatedPath ?? path] = annotations;
        }
        return next;
      });

      const remappedPersisted: Record<string, string> = {};
      for (const [path, serialized] of Object.entries(lastPersistedPdfAnnotationsRef.current)) {
        const updatedPath = remapPathPrefix(path, node.path, newPath);
        remappedPersisted[updatedPath ?? path] = serialized;
      }
      lastPersistedPdfAnnotationsRef.current = remappedPersisted;

      await fs.refreshTree();
    } catch (e) {
      console.error("Failed to rename:", e);
      toast.error(`Failed to rename: ${e}`);
    } finally {
      setCreationModal(prev => ({ ...prev, isOpen: false }));
    }
  }, [creationModal, activeFile, fs, toast]);

  // Deletion handlers
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

      setSelectedSources(prev =>
        prev.filter((source) => !isSameOrDescendantPath(source.path, deleteTarget.path))
      );

      setPdfAnnotations((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(([path]) => !isSameOrDescendantPath(path, deleteTarget.path))
        )
      );

      lastPersistedPdfAnnotationsRef.current = Object.fromEntries(
        Object.entries(lastPersistedPdfAnnotationsRef.current).filter(
          ([path]) => !isSameOrDescendantPath(path, deleteTarget.path)
        )
      );

      await fs.refreshTree();
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error(`Failed to delete: ${error}`);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, activeFile, fs, resetFileState]);

  const handleCreateRootNote = useCallback(() => {
    if (!fs.rootPath) {
      return;
    }

    void handleCreateNote({
      name: normalizeMarkdownFileName("untitled-note"),
      path: fs.rootPath,
      is_dir: true,
      extension: null,
      children: fs.fileTree,
    });
  }, [fs.rootPath, fs.fileTree, handleCreateNote]);

  const handleCreateRootFolder = useCallback(() => {
    if (!fs.rootPath) {
      return;
    }

    void handleCreateFolder({
      name: normalizeDirectoryName("untitled-folder"),
      path: fs.rootPath,
      is_dir: true,
      extension: null,
      children: fs.fileTree,
    });
  }, [fs.rootPath, fs.fileTree, handleCreateFolder]);

  // Collect all file paths recursively (including subfolders)
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

  // Generate summary
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
      }
    },
    [ai, fs, collectFilePaths, handleFileSelect]
  );

  // Create study guide
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
      }
    },
    [ai, fs, collectFilePaths, handleFileSelect]
  );

  // Summarize current file via chat
  const handleSummarizeCurrentFile = useCallback(() => {
    if (activeFile && fileContent) {
      ai.sendMessage(
        "Please provide a concise summary of this file highlighting the key concepts.",
        fileContent
      );
    }
  }, [activeFile, fileContent, ai]);

  const handleGenerateFlashcards = useCallback(async () => {
    if (!activeFile || !fileContent) return;
    
    const prompt = `Based on the following study material, generate a set of 8-10 high-quality flashcards. 
    Return ONLY a raw JSON array of objects, where each object has "front" (question/term) and "back" (answer/definition) keys.
    Material:
      ${fileContent}`;

    try {
        const response = await ai.sendMessage(prompt, "You are a specialized study assistant. Return ONLY JSON. No explanations.");
        if (!response) {
          toast.error("Failed to generate flashcards.");
          return;
        }

        const cards = parseFlashcardsResponse(response);
        setFlashcardSession({ isOpen: true, cards });
    } catch (e) {
        console.error("Flashcard error:", e);
        toast.error(e instanceof Error ? e.message : "Failed to generate flashcards.");
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

      await ai.sendMessage(message, context);
    },
    [activeFile, fileContent, selectedSources, fs, ai]
  );

  return (
    <div className="h-screen w-screen flex bg-shell-bg overflow-hidden relative text-shell-text select-none">
      <div className="bg-glow" />

      {/* Resizable Sidebar */}
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
            {/* Sidebar Resize Handle */}
            <div 
              onMouseDown={() => {
                  const handleMove = (e: MouseEvent) => setSidebarWidth(Math.max(150, Math.min(e.clientX, 600)));
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

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-shell-bg relative">
        {/* Subtle Panel Controls - Blending into the Header */}
        <div className="h-10 border-b border-shell-border bg-shell-surface/10 flex items-center justify-between px-2">
          <div className="flex items-center gap-1">
            {sidebarWidth === 0 && (
                <button 
                  onClick={() => setSidebarWidth(280)}
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

          <div className="flex items-center gap-1">
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
                    setChatWidth(Math.max(250, Math.min(newW, 800)));
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
            model={ai.model}
            isConfigured={ai.isConfigured}
            useSearch={ai.useSearch}
            activeFileName={activeFile?.name || null}
            activeFileContent={fileContent}
            selectedSources={selectedSources}
            onSendMessage={handleSendChatMessage}
            onModelChange={ai.setModel}
            onSearchChange={ai.setUseSearch}
            onClearChat={ai.clearChat}
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
        onCreateNote={handleCreateNote}
        onCreateFolder={handleCreateFolder}
        onRename={handleRenameRequest}
        onCopyPath={handleCopyPath}
        onDelete={handleDeleteRequest}
        onGenerateSummary={handleGenerateSummary}
        onCreateStudyGuide={handleCreateStudyGuide}
      />

      <CreationModal
        isOpen={creationModal.isOpen}
        mode={creationModal.mode}
        suggestedName={creationModal.suggestedName}
        onConfirm={(name) => {
          if (creationModal.mode === "rename") {
            handleConfirmRename(name);
          } else {
            handleConfirmCreation(name);
          }
        }}
        onCancel={() => setCreationModal(prev => ({ ...prev, isOpen: false }))}
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
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)} 
        commands={globalCommands}
      />
      <DropOverlay isVisible={isDragging} />

      {flashcardSession.isOpen && (
        <FlashcardDeck
          cards={flashcardSession.cards}
          title={`Review: ${activeFile?.name}`}
          onClose={() => setFlashcardSession({ isOpen: false, cards: [] })}
        />
      )}
    </div>
  );
}
