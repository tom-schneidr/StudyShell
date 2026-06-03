import { lazy, Suspense } from "react";
import { X, Loader2, Columns2 } from "lucide-react";
import { FileTypeIcon } from "../utils/fileIcons";
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
                        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-1.5 bg-shell-surface border-b border-shell-border text-[12px] text-shell-text-secondary">
                            <div className="flex items-center gap-2 truncate">
                                <FileTypeIcon extension={secondActiveFile.extension} name={secondActiveFile.name} size={13} />
                                <span className="truncate">{secondActiveFile.name}</span>
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
      <div className="flex-shrink-0 flex items-center border-b border-shell-border bg-shell-bg overflow-x-auto">
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
              title={tab.name}
              className={`group flex items-center gap-1.5 px-3 py-2 min-w-0 max-w-[180px] flex-shrink-0 border-r border-shell-border transition-colors ${
                isActive
                  ? "bg-shell-surface text-shell-text border-b-2 border-b-shell-accent -mb-px"
                  : "text-shell-text-muted hover:bg-shell-surface-hover hover:text-shell-text"
              }`}
            >
              <FileTypeIcon extension={tab.extension} name={tab.name} size={13} active={isActive} />
              <span className="text-[12px] truncate select-none">{tab.name}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => onCloseTab(tab.path, e)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onCloseTab(tab.path);
                }}
                className={`p-0.5 rounded hover:bg-shell-surface-hover cursor-pointer ${
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <X size={12} />
              </span>
            </button>
          );
        })}
        <div className="flex-1 min-h-[34px]" />
        {onToggleSplit && (
          <button
            type="button"
            onClick={onToggleSplit}
            className={`m-1 p-1.5 rounded-md transition-colors cursor-pointer ${
              isSplit
                ? "text-shell-accent bg-shell-accent/10"
                : "text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover"
            }`}
            title={isSplit ? "Close split" : "Split editor"}
          >
            <Columns2 size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative">
        {renderContent()}
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
    <div className="h-full flex items-center justify-center bg-shell-surface">
      <div className="text-center px-6 max-w-sm">
        <p className="text-[14px] text-shell-text mb-1">No file open</p>
        <p className="text-[12px] text-shell-text-muted leading-relaxed">
          Pick a file from the sidebar, or press{" "}
          <kbd className="px-1 py-0.5 rounded border border-shell-border bg-shell-bg font-mono text-[11px]">
            Ctrl+K
          </kbd>{" "}
          for commands.
        </p>
      </div>
    </div>
  );
}
