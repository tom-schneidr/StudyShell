import { useMemo, useEffect, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, RotateCw } from "lucide-react";

interface ImageViewerProps {
  imageData: Uint8Array;
  mimeType: string;
  fileName: string;
}

export default function ImageViewer({ imageData, mimeType, fileName }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Create a blob URL from the binary data
  const blobUrl = useMemo(() => {
    const blob = new Blob([imageData.buffer as ArrayBuffer], { type: mimeType });
    return URL.createObjectURL(blob);
  }, [imageData, mimeType]);

  // Clean up blob URL
  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  const zoomIn = () => setScale((s) => Math.min(5, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(0.1, s - 0.25));
  const resetZoom = () => {
    setScale(1);
    setRotation(0);
  };
  const rotate = () => setRotation((r) => (r + 90) % 360);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-2
        border-b border-shell-border bg-shell-surface"
      >
        <span className="text-xs text-shell-text-secondary">{fileName}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="p-1.5 rounded-md text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-shell-text-secondary min-w-[48px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-1.5 rounded-md text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={rotate}
            className="p-1.5 rounded-md text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
            title="Rotate"
          >
            <RotateCw size={14} />
          </button>
          <button
            onClick={resetZoom}
            className="p-1.5 rounded-md text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
            title="Reset"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center p-4 bg-shell-bg"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #1a1d28 25%, transparent 25%), linear-gradient(-45deg, #1a1d28 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1d28 75%), linear-gradient(-45deg, transparent 75%, #1a1d28 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
        }}
      >
        <img
          src={blobUrl}
          alt={fileName}
          className="max-w-none shadow-2xl shadow-black/30 rounded-lg transition-transform duration-200"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
