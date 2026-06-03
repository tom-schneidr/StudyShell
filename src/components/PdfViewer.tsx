import { useState, useMemo, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFPageProxy } from "pdfjs-dist";
import {
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  PenTool,
  Highlighter,
  Eraser,
  MousePointer2,
  Type,
  Download,
  Save,
  Trash2,
} from "lucide-react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import PdfInkCanvas from "./PdfInkCanvas";
import type { PdfAnnotationData, PageAnnotations } from "../types";
import { useFileSystem } from "../hooks/useFileSystem";
import { useToast } from "./ToastProvider";
import ConfirmDialog from "./ConfirmDialog";
import { buildExportCopyFilename } from "../utils/pathUtils";
import {
  DEFAULT_PDF_SCALE,
  getNextPdfPageNumber,
  getNextPdfScale,
  parsePdfPageNumberInput,
} from "../utils/pdfViewer";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  pdfData: Uint8Array;
  filePath: string;
  initialAnnotations: PdfAnnotationData | null;
  onUpdateAnnotations: (annotations: PdfAnnotationData) => void;
}

export default function PdfViewer({ pdfData, filePath, initialAnnotations, onUpdateAnnotations }: PdfViewerProps) {
  const fs = useFileSystem();
  const toast = useToast();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInputValue, setPageInputValue] = useState("1");
  const [scale, setScale] = useState(DEFAULT_PDF_SCALE);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Editor State
  const [tool, setTool] = useState<"pen" | "highlighter" | "eraser" | "select" | "text">("select");
  const [color, setColor] = useState("#6c8aff");
  const [brushWidth] = useState(2);
  const [pageDimensions, setPageDimensions] = useState<Record<number, { width: number; height: number }>>({});

  // Use the memory-synced annotations from props
  const annotations = useMemo(() => initialAnnotations || { version: 1, pages: {} }, [initialAnnotations]);

  const pdfBase64 = useMemo(() => {
    let binary = "";
    const len = pdfData.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(pdfData[i]);
    }
    return `data:application/pdf;base64,${btoa(binary)}`;
  }, [pdfData]);

  const handleUpdateAnnotations = (page: number, pageAnns: PageAnnotations) => {
    const next = {
      ...annotations,
      pages: {
        ...annotations.pages,
        [page]: pageAnns,
      },
    };
    onUpdateAnnotations(next);
  };

  const clearAllAnnotations = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    onUpdateAnnotations({ version: 1, pages: {} });
    setShowClearConfirm(false);
  };

  // The Big One: Save and Overwrite original file
  const saveAndOverwrite = async () => {
    try {
      const pdfBytes = await generateAnnotatedPdf();
      if (!pdfBytes) return;

      // Overwrite the original file using Tauri FS
      await fs.writeFileBinary(filePath, pdfBytes);
      toast.success("Changes saved and file overwritten successfully.");
    } catch (e) {
      toast.error(`Save failed: ${e}`);
    }
  };

  const exportCopy = async () => {
    try {
      const pdfBytes = await generateAnnotatedPdf();
      if (!pdfBytes) return;

      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = buildExportCopyFilename(filePath);
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(`Export failed: ${e}`);
    }
  };

  const generateAnnotatedPdf = async (): Promise<Uint8Array | null> => {
    try {
      const pdfDoc = await PDFDocument.load(pdfData);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();

      Object.entries(annotations.pages).forEach(([pageNumStr, pageAnns]) => {
        const idx = parseInt(pageNumStr) - 1;
        if (idx >= pages.length) return;
        const page = pages[idx];
        const { height } = page.getSize();

        (pageAnns.ink || []).forEach((path) => {
          if (path.points.length < 2) return;
          const hex = path.color.replace("#", "").substring(0, 6);
          const r = parseInt(hex.substring(0, 2), 16) / 255;
          const g = parseInt(hex.substring(2, 4), 16) / 255;
          const b = parseInt(hex.substring(4, 6), 16) / 255;
          const isHighlighter = path.color.length > 7;

          for (let i = 0; i < path.points.length - 1; i++) {
            const p1 = path.points[i];
            const p2 = path.points[i + 1];
            page.drawLine({
              start: { x: p1.x, y: height - p1.y },
              end: { x: p2.x, y: height - p2.y },
              thickness: path.width,
              color: rgb(r, g, b),
              opacity: isHighlighter ? 0.4 : 1,
            });
          }
        });

        (pageAnns.textboxes || []).forEach((tb) => {
          const hex = tb.color.replace("#", "").substring(0, 6);
          const r = parseInt(hex.substring(0, 2), 16) / 255;
          const g = parseInt(hex.substring(2, 4), 16) / 255;
          const b = parseInt(hex.substring(4, 6), 16) / 255;

          page.drawText(tb.content, {
            x: tb.x,
            y: height - tb.y - (tb.fontSize * 0.8),
            size: tb.fontSize,
            font: helveticaFont,
            color: rgb(r, g, b),
            maxWidth: tb.width,
          });
        });
      });

      return await pdfDoc.save();
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setError(null);
  }

  const handlePageRenderSuccess = useCallback((page: PDFPageProxy) => {
    const viewport = page.getViewport({ scale: 1 });
    setPageDimensions(prev => ({
        ...prev,
        [page.pageNumber]: { width: viewport.width, height: viewport.height }
    }));
  }, []);

  const goToPrev = useCallback(() => {
    setPageNumber((page) => getNextPdfPageNumber(page, numPages, -1));
  }, [numPages]);

  const goToNext = useCallback(() => {
    setPageNumber((page) => getNextPdfPageNumber(page, numPages, 1));
  }, [numPages]);

  const commitPageInput = useCallback(() => {
    setPageNumber((currentPage) => parsePdfPageNumberInput(pageInputValue, numPages, currentPage));
  }, [numPages, pageInputValue]);

  useEffect(() => {
    setPageInputValue(String(pageNumber));
  }, [pageNumber]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPrev();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNext();
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setScale((currentScale) => getNextPdfScale(currentScale, 1));
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        setScale((currentScale) => getNextPdfScale(currentScale, -1));
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        setScale(DEFAULT_PDF_SCALE);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrev]);

  return (
    <div className="h-full flex flex-col bg-shell-bg overflow-hidden relative">
      {/* Premium Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2
        border-b border-shell-border bg-shell-surface z-50">
        <div className="flex items-center gap-2">
          {/* Navigation */}
          <div className="flex items-center gap-1 bg-shell-bg rounded-lg border border-shell-border px-1.5 py-1">
            <button onClick={goToPrev} disabled={pageNumber <= 1} className="p-1 rounded hover:bg-shell-surface-hover text-shell-text-muted disabled:opacity-20 flex-shrink-0 cursor-pointer">
              <ChevronLeft size={14} />
            </button>
            <div className="flex items-center gap-1 text-[11px] font-medium text-shell-text-muted">
              <input
                value={pageInputValue}
                onChange={(event) => setPageInputValue(event.target.value)}
                onBlur={commitPageInput}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitPageInput();
                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    setPageInputValue(String(pageNumber));
                  }
                }}
                inputMode="numeric"
                aria-label="Current page"
                className="w-10 rounded bg-transparent px-1 py-0.5 text-center text-shell-text outline-none transition-colors focus:bg-shell-surface focus:ring-1 focus:ring-shell-accent/40"
              />
              <span>/ {numPages}</span>
            </div>
            <button onClick={goToNext} disabled={pageNumber >= numPages} className="p-1 rounded hover:bg-shell-surface-hover text-shell-text-muted disabled:opacity-20 flex-shrink-0 cursor-pointer">
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="h-4 w-px bg-shell-border mx-1" />

          {/* Tools */}
          <div className="flex items-center gap-1">
            <ToolButton active={tool === "select"} onClick={() => setTool("select")} icon={<MousePointer2 size={13} />} label="Select" />
            <ToolButton active={tool === "pen"} onClick={() => setTool("pen")} icon={<PenTool size={13} />} label="Ink" />
            <ToolButton active={tool === "highlighter"} onClick={() => setTool("highlighter")} icon={<Highlighter size={13} />} label="Highlight" />
            <ToolButton active={tool === "text"} onClick={() => setTool("text")} icon={<Type size={13} />} label="Text" />
            <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")} icon={<Eraser size={13} />} label="Erase" />
          </div>

          {(tool === "pen" || tool === "highlighter" || tool === "text") && (
            <div className="flex items-center gap-1.5 ml-2 px-2 border-l border-shell-border">
              {["#6c8aff", "#4ade80", "#f87171", "#fbbf24", "#e8eaf0"].map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-4 h-4 rounded-full border-2 transition-transform cursor-pointer ${
                    color === c ? "scale-125 border-white" : "border-transparent opacity-50 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setScale((currentScale) => getNextPdfScale(currentScale, -1))} className="p-1.5 text-shell-text-muted hover:text-shell-text cursor-pointer" title="Zoom out (-)"><ZoomOut size={14} /></button>
            <span className="text-[10px] text-shell-text-muted w-10 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((currentScale) => getNextPdfScale(currentScale, 1))} className="p-1.5 text-shell-text-muted hover:text-shell-text cursor-pointer" title="Zoom in (+)"><ZoomIn size={14} /></button>
            <button onClick={() => setScale(DEFAULT_PDF_SCALE)} className="rounded border border-shell-border px-2 py-1 text-[11px] text-shell-text-muted hover:text-shell-text cursor-pointer" title="Reset zoom (0)">100%</button>
          </div>
          <div className="h-4 w-px bg-shell-border" />
          
          <button onClick={saveAndOverwrite} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700 transition-colors cursor-pointer" title="Save annotated PDF">
            <Save size={13} /> Save Changes
          </button>

          <button onClick={exportCopy} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-shell-accent text-white text-[11px] font-medium hover:bg-shell-accent-hover transition-colors cursor-pointer" title="Export annotated copy">
            <Download size={13} /> Export Copy
          </button>
          
          <button onClick={clearAllAnnotations} className="p-1.5 rounded-md text-shell-error hover:bg-shell-error/10 transition-colors cursor-pointer" title="Clear All Drawings">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className={`flex-1 overflow-auto bg-shell-bg custom-scrollbar p-8 ${
        tool === "select" ? "select-mode" : "drawing-active"
      }`}>
        <div className="flex flex-col items-center gap-8 pb-20">
          {error ? (
            <div className="text-shell-error text-sm">{error}</div>
          ) : (
            <Document
              file={pdfBase64}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={(e) => setError(e.message)}
              loading={<div className="animate-shimmer w-[600px] h-[800px] rounded-xl" />}
            >
              {Array.from(new Array(numPages), (_, index) => {
                const pageNum = index + 1;
                const dims = pageDimensions[pageNum];
                return (
                  <div key={pageNum} className="relative shadow-2xl shadow-black/80 rounded-lg overflow-hidden border border-white/5 bg-white">
                    <Page
                      pageNumber={pageNum}
                      scale={scale}
                      renderAnnotationLayer={false}
                      renderTextLayer={true}
                      onRenderSuccess={handlePageRenderSuccess}
                      loading={<div className="animate-shimmer w-[600px] h-[800px]" />}
                    />
                    {dims && (
                      <PdfInkCanvas
                        pageNumber={pageNum}
                        width={dims.width}
                        height={dims.height}
                        scale={scale}
                        brushWidth={brushWidth}
                        color={color}
                        tool={tool}
                        annotations={annotations.pages[pageNum] || { ink: [], highlights: [], notes: [], textboxes: [] }}
                        onUpdateAnnotations={handleUpdateAnnotations}
                      />
                    )}
                  </div>
                );
              })}
            </Document>
          )}
        </div>
      </div>
      
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear All Annotations"
        message="Are you sure you want to clear all drawings, highlights, and text from this PDF?"
        detail="This will only be saved to disk if you click 'Save Changes' afterwards."
        confirmLabel="Clear All"
        onConfirm={handleConfirmClear}
        onCancel={() => setShowClearConfirm(false)}
      />

    </div>
  );
}

function ToolButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
        active
          ? "bg-shell-accent text-white shadow-lg shadow-shell-accent/20"
          : "text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover"
      }`}
    >
      {icon}
    </button>
  );
}
