import { lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, FileType, File, GraduationCap, Loader2, Image as ImageIcon, BookOpen, Film, Music, Sparkles } from "lucide-react";
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";
import type { StudyAI } from "../hooks/useStudyAI";
import type { FileNode, NotebookData, PdfAnnotationData } from "../types";
import { getFileType, getMimeType } from "../types";

const MarkdownEditor = lazy(() => import("./MarkdownEditor"));
const PdfViewer = lazy(() => import("./PdfViewer"));
const ImageViewer = lazy(() => import("./ImageViewer"));
const NotebookViewer = lazy(() => import("./NotebookViewer"));
const MediaViewer = lazy(() => import("./MediaViewer"));
const CodeEditor = lazy(() => import("./CodeEditor"));
const FlashcardStudio = lazy(() => import("./FlashcardStudio"));

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
  isSplit?: boolean;
  onToggleSplit?: () => void;
  secondActiveFile?: FileNode | null;
  secondFileContent?: string | null;
  secondBinaryData?: Uint8Array | null;
  secondBinaryLoading?: boolean;
  secondNotebookData?: NotebookData | null;
  onCloseSecondPane?: () => void;
  fileTree?: FileNode[];
  ai?: StudyAI;
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
  isSplit,
  onToggleSplit,
  secondActiveFile,
  secondFileContent,
  secondBinaryData,
  secondBinaryLoading,
  secondNotebookData,
  onCloseSecondPane,
  fileTree = [],
  ai,
}: EditorProps) {
  if (!activeFile) {
    return <EmptyState />;
  }

  const fileTypeIcon = (ext: string | null | undefined, name?: string) => {
    switch (getFileType(ext ?? null, name)) {
      case "flashcard": return <Sparkles size={13} className="text-amber-400 flex-shrink-0" />;
      case "pdf": return <FileType size={13} className="text-red-400 flex-shrink-0" />;
      case "markdown": return <FileText size={13} className="text-blue-400 flex-shrink-0" />;
      case "image": return <ImageIcon size={13} className="text-purple-400 flex-shrink-0" />;
      case "notebook": return <BookOpen size={13} className="text-orange-400 flex-shrink-0" />;
      case "video": return <Film size={13} className="text-cyan-400 flex-shrink-0" />;
      case "audio": return <Music size={13} className="text-emerald-400 flex-shrink-0" />;
      default: return <File size={13} className="text-shell-text-muted flex-shrink-0" />;
    }
  };

  const renderSingleContent = (
    node: FileNode,
    content: string | null,
    binary: Uint8Array | null,
    notebook: NotebookData | null,
    isSecondPane = false
  ) => {
    const type = getFileType(node.extension, node.name);
    
    switch (type) {
      case "flashcard":
        return content !== null && ai ? (
          <Suspense fallback={<ContentLoading label="Loading Flashcard Studio..." />}>
            <FlashcardStudio
              content={content}
              filePath={node.path}
              onSave={(val) => onSaveFile(node.path, val)}
              onFileSelect={onSelectTab}
              fileTree={fileTree}
              ai={ai}
            />
          </Suspense>
        ) : content !== null ? (
          <div className="flex items-center justify-center h-full text-shell-text-muted">AI assistant unavailable for flashcards.</div>
        ) : (
          <div className="flex items-center justify-center h-full text-shell-text-muted">Loading Flashcard Studio...</div>
        );

      case "pdf":
        return binary ? (
          <Suspense fallback={<ContentLoading label="Loading PDF..." />}>
            <PdfViewer
              pdfData={binary}
              filePath={node.path}
              initialAnnotations={!isSecondPane ? pdfAnnotations : null}
              onUpdateAnnotations={(anns) => !isSecondPane && onUpdatePdfAnnotations(node.path, anns)}
            />
          </Suspense>
        ) : (
          <div className="flex items-center justify-center h-full text-shell-error text-sm">Failed to load PDF</div>
        );

      case "image":
        return binary ? (
          <Suspense fallback={<ContentLoading label="Loading image..." />}>
            <ImageViewer
              imageData={binary}
              mimeType={getMimeType(node.extension)}
              fileName={node.name}
            />
          </Suspense>
        ) : (
          <div className="flex items-center justify-center h-full text-shell-error text-sm">Failed to load image</div>
        );

      case "video":
      case "audio":
        return binary ? (
          <Suspense fallback={<ContentLoading label="Loading media..." />}>
            <MediaViewer
              data={binary}
              mimeType={getMimeType(node.extension)}
              type={type as "video" | "audio"}
              fileName={node.name}
            />
          </Suspense>
        ) : (
          <div className="flex items-center justify-center h-full text-shell-error text-sm">Failed to load media</div>
        );

      case "notebook":
        return notebook ? (
          <Suspense fallback={<ContentLoading label="Loading notebook..." />}>
            <NotebookViewer data={notebook} />
          </Suspense>
        ) : (
          <div className="flex items-center justify-center h-full text-shell-text-muted">Loading notebook...</div>
        );

      case "svg":
        return content !== null ? (
          <div className="h-full flex items-center justify-center p-8 bg-white/5 overflow-auto">
             <div 
                className="max-w-full max-h-full"
                dangerouslySetInnerHTML={{ __html: content }} 
             />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-shell-text-muted">Loading SVG...</div>
        );

      case "code":
        return content !== null ? (
          <Suspense fallback={<ContentLoading label="Loading code editor..." />}>
            <CodeEditor
              content={content}
              onSave={(val) => onSaveFile(node.path, val)}
              filePath={node.path}
            />
          </Suspense>
        ) : (
          <div className="flex items-center justify-center h-full text-shell-text-muted">Loading code...</div>
        );

      case "markdown":
      case "text":
      default: {
        const isMarkdown = type === "markdown";
        return content !== null ? (
          <Suspense fallback={<ContentLoading label={isMarkdown ? "Loading markdown editor..." : "Loading editor..."} />}>
            <MarkdownEditor
              content={content}
              onSave={(val) => onSaveFile(node.path, val)}
              filePath={node.path}
              isMarkdown={isMarkdown}
              onSaveAsset={onSaveAsset}
            />
          </Suspense>
        ) : (
          <div className="flex items-center justify-center h-full text-shell-text-muted">
            {type === "unsupported" ? "Preview not available" : "Loading..."}
          </div>
        );
      }
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

    if (isSplit && secondActiveFile) {
        return (
            <Splitpanes className="default-theme h-full">
                <Pane minSize={20}>
                    <div className="h-full relative overflow-hidden">
                        {renderSingleContent(activeFile, fileContent, binaryData, notebookData)}
                    </div>
                </Pane>
                <Pane minSize={20}>
                    <div className="h-full relative overflow-hidden border-l border-shell-border bg-shell-surface/20">
                        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-1.5 bg-shell-bg/80 border-b border-shell-border text-[11px] font-bold text-shell-text-secondary uppercase tracking-wider backdrop-blur-md">
                            <div className="flex items-center gap-2 truncate">
                                {fileTypeIcon(secondActiveFile.extension, secondActiveFile.name)}
                                <span className="truncate">{secondActiveFile.name} (Side Pane)</span>
                            </div>
                            <button onClick={onCloseSecondPane} className="p-1 hover:bg-shell-surface-hover rounded transition-colors text-shell-text-muted hover:text-shell-text">
                                <X size={12} />
                            </button>
                        </div>
                        <div className="h-full pt-8">
                            {secondBinaryLoading
                              ? <ContentLoading label="Loading side pane..." />
                              : renderSingleContent(
                                  secondActiveFile,
                                  secondFileContent || null,
                                  secondBinaryData || null,
                                  secondNotebookData || null,
                                  true,
                                )}
                        </div>
                    </div>
                </Pane>
            </Splitpanes>
        );
    }

    return renderSingleContent(activeFile, fileContent, binaryData, notebookData);
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
              onMouseDown={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  onCloseTab(tab.path);
                }
              }}
              title={`${tab.name} (middle-click to close)`}
              className={`group flex items-center gap-2 px-4 py-2.5 min-w-0 max-w-[200px] flex-shrink-0 relative transition-colors ${
                isActive ? "bg-shell-surface text-shell-text" : "bg-shell-bg text-shell-text-muted hover:bg-shell-surface-hover hover:text-shell-text"
              }`}
            >
              {fileTypeIcon(tab.extension, tab.name)}
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
        {onToggleSplit && (
          <button
            onClick={onToggleSplit}
            className={`mr-2 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
              isSplit
                ? "border-shell-accent/30 bg-shell-accent/10 text-shell-accent"
                : "border-shell-border bg-shell-bg text-shell-text-muted hover:text-shell-text"
            }`}
            title={isSplit ? "Close split view" : "Open split view"}
          >
            {isSplit ? "Close Split" : "Split View"}
          </button>
        )}
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

function ContentLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full gap-2 text-shell-text-muted">
      <Loader2 size={18} className="animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center bg-shell-surface relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.03, 0.07, 0.03],
          x: [-20, 20, -20],
          y: [-20, 20, -20]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-shell-accent rounded-full blur-[100px] pointer-events-none"
      />
      <motion.div 
        animate={{ 
          scale: [1.2, 1, 1.2],
          opacity: [0.02, 0.05, 0.02],
          x: [20, -20, 20],
          y: [20, -20, 20]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-[100px] pointer-events-none"
      />

      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <motion.div
        className="text-center relative z-10"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div 
            className="w-24 h-24 mx-auto mb-8 rounded-[2rem] bg-gradient-to-br from-shell-accent/20 to-purple-500/20 border border-shell-border-subtle flex items-center justify-center shadow-2xl relative"
            animate={{ 
              y: [-6, 6, -6],
              rotate: [-2, 2, -2]
            }}
            transition={{ ease: "easeInOut", duration: 5, repeat: Infinity }}
        >
          <div className="absolute inset-0 rounded-[2rem] bg-shell-accent/10 blur-xl animate-pulse-subtle" />
          <GraduationCap size={44} className="text-shell-accent relative z-10" />
        </motion.div>

        <h2 className="text-2xl font-bold text-shell-text mb-3 tracking-tight">Focus Your Learning</h2>
        <p className="text-sm text-shell-text-secondary max-w-[320px] mx-auto leading-relaxed mb-10">
          Open a file to start studying, or use the AI Assistant to generate summaries and guides.
        </p>
        <p className="text-xs text-shell-text-muted mb-10">
          Tip: press <kbd className="px-1.5 py-0.5 rounded bg-shell-surface-hover border border-shell-border font-mono text-[10px]">Ctrl</kbd>
          {" + "}
          <kbd className="px-1.5 py-0.5 rounded bg-shell-surface-hover border border-shell-border font-mono text-[10px]">K</kbd>
          {" "}for the command palette.
        </p>

        <div className="flex items-center justify-center gap-4">
          <FilePill label=".md" color="blue" />
          <FilePill label=".pdf" color="red" />
          <FilePill label=".png" color="purple" />
          <FilePill label=".ipynb" color="orange" />
        </div>
      </motion.div>
    </div>
  );
}

function FilePill({ label, color }: { label: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };

  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`px-3 py-1.5 rounded-xl border ${colorMap[color]} text-[11px] font-bold tracking-wider transition-all cursor-default shadow-sm hover:shadow-lg hover:shadow-${color}-500/10`}
    >
      {label}
    </motion.div>
  );
}
