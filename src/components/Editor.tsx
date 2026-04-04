import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, FileType, File, GraduationCap, Loader2, Image as ImageIcon, BookOpen, Film, Music } from "lucide-react";
import MarkdownEditor from "./MarkdownEditor";
import PdfViewer from "./PdfViewer";
import ImageViewer from "./ImageViewer";
import NotebookViewer from "./NotebookViewer";
import MediaViewer from "./MediaViewer";
import type { FileNode, NotebookData, PdfAnnotationData } from "../types";
import { getFileType, getMimeType } from "../types";

interface EditorProps {
  activeFile: FileNode | null;
  fileContent: string | null;
  binaryData: Uint8Array | null;
  binaryLoading: boolean;
  notebookData: NotebookData | null;
  pdfAnnotations: PdfAnnotationData | null;
  onSaveFile: (path: string, content: string) => void;
  onCloseFile: () => void;
  onUpdatePdfAnnotations: (path: string, annotations: PdfAnnotationData) => void;
}

export default function Editor({
  activeFile,
  fileContent,
  binaryData,
  binaryLoading,
  notebookData,
  pdfAnnotations,
  onSaveFile,
  onCloseFile,
  onUpdatePdfAnnotations,
}: EditorProps) {
  if (!activeFile) {
    return <EmptyState />;
  }

  const fileType = getFileType(activeFile.extension);
  const fileName = activeFile.name;

  const fileTypeIcon = () => {
    switch (fileType) {
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

      case "markdown":
      case "text":
        return fileContent !== null ? (
          <MarkdownEditor
            content={fileContent}
            onSave={(content) => onSaveFile(activeFile.path, content)}
            filePath={activeFile.path}
            isMarkdown={fileType === "markdown"}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-shell-text-muted">Loading...</div>
        );

      default:
        return fileContent !== null ? (
          <MarkdownEditor
            content={fileContent}
            onSave={(content) => onSaveFile(activeFile.path, content)}
            filePath={activeFile.path}
            isMarkdown={false}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-shell-text-muted">Preview not available</div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-shell-surface">
      {/* Tab Bar */}
      <div className="flex-shrink-0 flex items-center border-b border-shell-border bg-shell-bg">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-shell-surface border-r border-shell-border min-w-0 max-w-[240px]">
          {fileTypeIcon()}
          <span className="text-[12.5px] text-shell-text truncate">{fileName}</span>
          <button
            onClick={onCloseFile}
            className="ml-auto p-0.5 rounded text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors flex-shrink-0 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
        <div className="flex-1" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFile.path}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
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
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-shell-accent/10 to-purple-500/10 border border-shell-border flex items-center justify-center">
          <GraduationCap size={36} className="text-shell-accent/50" />
        </div>
        <h2 className="text-lg font-semibold text-shell-text mb-2 tracking-tight">Welcome to StudyShell</h2>
        <p className="text-sm text-shell-text-muted max-w-[300px] leading-relaxed">
          Select a file from the sidebar to view or edit it. Right-click folders to generate AI summaries.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-shell-text-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400/50" />.md</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400/50" />.pdf</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400/50" />.png</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400/50" />.mp4</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400/50" />.ipynb</span>
        </div>
      </motion.div>
    </div>
  );
}
