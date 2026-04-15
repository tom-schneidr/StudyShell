import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    MessageSquareText, 
    Files, 
    PanelLeft, 
    PanelRight, 
    Sparkles 
} from "lucide-react";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import ChatPanel from "./components/ChatPanel";
import ContextMenu from "./components/ContextMenu";
import { useFileSystem } from "./hooks/useFileSystem";
import { useVertexAI } from "./hooks/useVertexAI";
import type { FileNode, NotebookData } from "./types";
import { getFileType } from "./types";

export default function App() {
  const fs = useFileSystem();
  const ai = useVertexAI();

  // Active file state
  const [activeFile, setActiveFile] = useState<FileNode | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [binaryData, setBinaryData] = useState<Uint8Array | null>(null);
  const [binaryLoading, setBinaryLoading] = useState(false);
  const [notebookData, setNotebookData] = useState<NotebookData | null>(null);

  // AI & Chat state
  const [showChatPanel, setShowChatPanel] = useState(true);
  const [selectedSources, setSelectedSources] = useState<FileNode[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [chatWidth, setChatWidth] = useState(400);

  const [pdfAnnotations, setPdfAnnotations] = useState<Record<string, any>>({});

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode | null;
    visible: boolean;
  }>({ x: 0, y: 0, node: null, visible: false });

  // Reset all file state
  const resetFileState = useCallback(() => {
    setFileContent(null);
    setBinaryData(null);
    setBinaryLoading(false);
    setNotebookData(null);
  }, []);

  // Open a file
  const handleFileSelect = useCallback(
    async (node: FileNode) => {
      if (node.is_dir) return;

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
            const data = await fs.readFileBinary(node.path);
            setBinaryData(data);
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
    [fs, resetFileState]
  );

  // Toggle multi-source selection
  const handleToggleSource = useCallback((node: FileNode) => {
    setSelectedSources(prev => {
        if (prev.find(s => s.path === node.path)) {
            return prev.filter(s => s.path !== node.path);
        }
        return [...prev, node];
    });
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

  // Close active file
  const handleCloseFile = useCallback(() => {
    setActiveFile(null);
    resetFileState();
  }, [resetFileState]);

  // Update PDF annotations globally
  const handleUpdatePdfAnnotations = useCallback((path: string, annotations: any) => {
    setPdfAnnotations(prev => ({
        ...prev,
        [path]: annotations
    }));
  }, []);

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
        alert("No text files found to summarize.");
        return;
      }
      try {
        const summary = await ai.summarizeFiles(paths);
        const dir = node.is_dir ? node.path : node.path.substring(0, node.path.lastIndexOf("\\"));
        const summaryPath = `${dir}\\summary.md`;
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
        alert("No text files found to create study guide from.");
        return;
      }
      try {
        const guide = await ai.generateStudyGuide(paths);
        const dir = node.is_dir ? node.path : node.path.substring(0, node.path.lastIndexOf("\\"));
        const guidePath = `${dir}\\study_guide.md`;
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
              loading={fs.loading}
              activeFilePath={activeFile?.path || null}
              selectedSourcePaths={selectedSources.map(s => s.path)}
              onSelectRoot={fs.selectRootFolder}
              onRefresh={() => fs.refreshTree()}
              onFileSelect={handleFileSelect}
              onContextMenu={handleContextMenu}
              onToggleSource={handleToggleSource}
              onCollapse={() => setSidebarWidth(0)}
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
            fileContent={fileContent}
            binaryData={binaryData}
            binaryLoading={binaryLoading}
            notebookData={notebookData}
            pdfAnnotations={activeFile ? pdfAnnotations[activeFile.path] : null}
            onSaveFile={handleSaveFile}
            onCloseFile={handleCloseFile}
            onUpdatePdfAnnotations={handleUpdatePdfAnnotations}
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
            useSearch={ai.useSearch}
            activeFileName={activeFile?.name || null}
            activeFileContent={fileContent}
            selectedSources={selectedSources}
            onSendMessage={ai.sendMessage}
            onModelChange={ai.setModel}
            onSearchChange={ai.setUseSearch}
            onClearChat={ai.clearChat}
            onSummarizeCurrentFile={handleSummarizeCurrentFile}
            onRemoveSource={(path: string) => setSelectedSources(prev => prev.filter(s => s.path !== path))}
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
        onGenerateSummary={handleGenerateSummary}
        onCreateStudyGuide={handleCreateStudyGuide}
      />
    </div>
  );
}
