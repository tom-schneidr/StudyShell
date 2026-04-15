import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, FileType, File, GraduationCap, Loader2, Image as ImageIcon, BookOpen, Film, Music } from "lucide-react";
import MarkdownEditor from "./MarkdownEditor";
import PdfViewer from "./PdfViewer";
import ImageViewer from "./ImageViewer";
import NotebookViewer from "./NotebookViewer";
import MediaViewer from "./MediaViewer";
import CodeEditor from "./CodeEditor";
import type { FileNode, NotebookData, PdfAnnotationData } from "../types";
import { getFileType, getMimeType } from "../types";

interface EditorProps {
  activeFile: FileNode | null;
  openTabs: FileNode[];
  fileContent: string | null;
  binaryData: Uint8Array | null;
  binaryLoading: boolean;
  notebookData: NotebookData | null;
  pdfAnnotations: PdfAnnotationData | null;
  onSaveFile: (path: string, content: string) => void;
  onSelectTab: (node: FileNode) => void;
  onCloseTab: (path: string, e?: React.MouseEvent) => void;
  onUpdatePdfAnnotations: (path: string, annotations: PdfAnnotationData) => void;
  onSaveAsset?: (documentPath: string, filename: string, base64: string) => Promise<string>;
}

export default function Editor({
  activeFile,
  openTabs,
  fileContent,
  binaryData,
  binaryLoading,
  notebookData,
  pdfAnnotations,
  onSaveFile,
  onSelectTab,
  onCloseTab,
  onUpdatePdfAnnotations,
  onSaveAsset,
}: EditorProps) {
  if (!activeFile) {
    return <EmptyState />;
  }

  const fileType = getFileType(activeFile.extension);
  const fileName = activeFile.name;

  const fileTypeIcon = (ext: string | null | undefined) => {
    switch (getFileType(ext ?? null)) {
      case "pdf": return <FileType size={13} className="text-red-400 flex-shrink-0" />;
      case "markdown": return <FileText size={13} className="text-blue-400 flex-shrink-0" />;
      case "image": return <ImageIcon size={13} className="text-purple-400 flex-shrink-0" />;
      case "notebook": return <BookOpen size={13} className="text-orange-400 flex-shrink-0" />;
      case "video": return <Film size={13} className="text-cyan-400 flex-shrink-0" />;
      case "audio": return <Music size={13} className="text-emerald-400 flex-shrink-0" />;
      default: return <File size={13} className="text-shell-text-muted flex-shrink-0" />;
    }
  };

  const renderContent = () => {
    if (binaryLoading) {
      return (
        <div className="flex items-center justify-center h-full gap-2 text-shell-text-muted">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      );
    }

    switch (fileType) {
      case "pdf":
        return binaryData ? (
          <PdfViewer
            pdfData={binaryData}
            filePath={activeFile.path}
            initialAnnotations={pdfAnnotations}
            onUpdateAnnotations={(anns) => onUpdatePdfAnnotations(activeFile.path, anns)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-shell-error text-sm">Failed to load PDF</div>
        );

      case "image":
        return binaryData ? (
          <ImageViewer
            imageData={binaryData}
            mimeType={getMimeType(activeFile.extension)}
            fileName={fileName}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-shell-error text-sm">Failed to load image</div>
        );

      case "video":
      case "audio":
        return binaryData ? (
          <MediaViewer
            data={binaryData}
            mimeType={getMimeType(activeFile.extension)}
            type={fileType as "video" | "audio"}
            fileName={fileName}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-shell-error text-sm">Failed to load media</div>
        );

      case "notebook":
        return notebookData ? (
          <NotebookViewer data={notebookData} />
        ) : (
          <div className="flex items-center justify-center h-full text-shell-text-muted">Loading notebook...</div>
        );

      case "code":
        return fileContent !== null ? (
          <CodeEditor
            content={fileContent}
            onSave={(content) => onSaveFile(activeFile.path, content)}
            filePath={activeFile.path}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-shell-text-muted">Loading code...</div>
        );

      case "markdown":
      case "text":
      default: {
        const isMarkdown = fileType === "markdown";
        return fileContent !== null ? (
          <MarkdownEditor
            content={fileContent}
            onSave={(content) => onSaveFile(activeFile.path, content)}
            filePath={activeFile.path}
            isMarkdown={isMarkdown}
            onSaveAsset={onSaveAsset}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-shell-text-muted">
            {fileType === "unsupported" ? "Preview not available" : "Loading..."}
          </div>
        );
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-shell-surface">
      {/* Tab Bar */}
      <div className="flex-shrink-0 flex items-center border-b border-shell-border bg-shell-bg overflow-x-auto custom-scrollbar scrollbar-hide">
        {openTabs.map((tab) => {
          const isActive = tab.path === activeFile.path;
          return (
            <button
              key={tab.path}
              onClick={() => onSelectTab(tab)}
              className={`group flex items-center gap-2 px-4 py-2.5 min-w-0 max-w-[200px] flex-shrink-0 relative transition-colors ${
                isActive ? "bg-shell-surface text-shell-text" : "bg-shell-bg text-shell-text-muted hover:bg-shell-surface-hover hover:text-shell-text"
              }`}
            >
              {fileTypeIcon(tab.extension)}
              <span className="text-[12.5px] truncate select-none">{tab.name}</span>
              <div
                onClick={(e) => onCloseTab(tab.path, e)}
                className={`ml-auto p-0.5 rounded transition-all cursor-pointer ${
                  isActive ? "opacity-100 hover:bg-shell-surface-hover" : "opacity-0 group-hover:opacity-100 hover:bg-shell-surface"
                }`}
              >
                <X size={13} />
              </div>
              {isActive && (
                <motion.div
                  layoutId="active-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-shell-accent z-10"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
        <div className="flex-1 border-l border-shell-border h-full min-h-[35px]" />
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFile?.path || "empty"}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="h-full absolute inset-0"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center bg-shell-surface relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <motion.div
        className="text-center relative z-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <motion.div 
            className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-shell-accent/10 to-purple-500/10 border border-shell-border flex items-center justify-center shadow-inner"
            animate={{ y: [-4, 4, -4] }}
            transition={{ ease: "easeInOut", duration: 4, repeat: Infinity }}
        >
          <GraduationCap size={36} className="text-shell-accent/50" />
        </motion.div>
        <h2 className="text-lg font-semibold text-shell-text mb-2 tracking-tight">Welcome to StudyShell</h2>
        <p className="text-sm text-shell-text-muted max-w-[300px] leading-relaxed">
          Select a file from the sidebar to view or edit it. Right-click folders to generate AI summaries.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 text-[11px] text-shell-text-muted">
          <motion.span whileHover={{ scale: 1.05 }} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-blue-400/10 hover:text-blue-200 transition-colors cursor-default"><span className="w-1.5 h-1.5 rounded-full bg-blue-400/50" />.md</motion.span>
          <motion.span whileHover={{ scale: 1.05 }} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-red-400/10 hover:text-red-200 transition-colors cursor-default"><span className="w-1.5 h-1.5 rounded-full bg-red-400/50" />.pdf</motion.span>
          <motion.span whileHover={{ scale: 1.05 }} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-purple-400/10 hover:text-purple-200 transition-colors cursor-default"><span className="w-1.5 h-1.5 rounded-full bg-purple-400/50" />.png</motion.span>
          <motion.span whileHover={{ scale: 1.05 }} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-cyan-400/10 hover:text-cyan-200 transition-colors cursor-default"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400/50" />.mp4</motion.span>
          <motion.span whileHover={{ scale: 1.05 }} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-orange-400/10 hover:text-orange-200 transition-colors cursor-default"><span className="w-1.5 h-1.5 rounded-full bg-orange-400/50" />.ipynb</motion.span>
        </div>
      </motion.div>
    </div>
  );
}
