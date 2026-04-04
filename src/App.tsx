import { useState, useCallback } from "react";
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

  // PDF Sessions (In-memory persistent only during app lifetime)
  const [pdfAnnotations, setPdfAnnotations] = useState<Record<string, any>>({});

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode | null;
    visible: boolean;
  }>({ x: 0, y: 0, node: null, visible: false });

  const [showChatPanel] = useState(true);

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

  // Collect all text file paths in a directory
  const collectFilePaths = useCallback((node: FileNode): string[] => {
    const paths: string[] = [];
    if (node.is_dir && node.children) {
      for (const child of node.children) {
        if (!child.is_dir) {
          const ft = getFileType(child.extension);
          if (ft === "markdown" || ft === "text") {
            paths.push(child.path);
          }
        }
      }
    } else if (!node.is_dir) {
      const ft = getFileType(node.extension);
      if (ft === "markdown" || ft === "text") {
        paths.push(node.path);
      }
    }
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
    <div className="h-screen w-screen flex overflow-hidden relative">
      <div className="bg-glow" />

      <div className="w-[280px] flex-shrink-0 z-10">
        <Sidebar
          rootPath={fs.rootPath}
          fileTree={fs.fileTree}
          loading={fs.loading}
          activeFilePath={activeFile?.path || null}
          onSelectRoot={fs.selectRootFolder}
          onRefresh={() => fs.refreshTree()}
          onFileSelect={handleFileSelect}
          onContextMenu={handleContextMenu}
        />
      </div>

      <div className="flex-1 min-w-0 z-10">
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

      {showChatPanel && (
        <div className="w-[350px] flex-shrink-0 z-10">
          <ChatPanel
            messages={ai.messages}
            loading={ai.loading}
            error={ai.error}
            model={ai.model}
            activeFileName={activeFile?.name || null}
            activeFileContent={fileContent}
            onSendMessage={ai.sendMessage}
            onModelChange={ai.setModel}
            onClearChat={ai.clearChat}
            onSummarizeCurrentFile={handleSummarizeCurrentFile}
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
