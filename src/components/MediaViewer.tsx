import { useMemo, useEffect } from "react";
import { Volume2, Maximize2 } from "lucide-react";

interface MediaViewerProps {
  data: Uint8Array;
  mimeType: string;
  type: "video" | "audio";
  fileName: string;
}

export default function MediaViewer({ data, mimeType, type, fileName }: MediaViewerProps) {
  // Create binary blob URL for the native player
  const blobUrl = useMemo(() => {
    // We create the Blob directly from the data buffer to avoid detachment issues
    const blob = new Blob([data as any], { type: mimeType });
    return URL.createObjectURL(blob);
  }, [data, mimeType]);

  // Clean up
  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  return (
    <div className="h-full flex flex-col bg-shell-bg overflow-hidden p-8">
      {/* Container to keep content centered */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 max-w-4xl mx-auto w-full">
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className={`p-4 rounded-2xl ${type === "video" ? "bg-purple-500/10" : "bg-blue-500/10"} 
            border border-shell-border shadow-xl`}>
            {type === "video" ? (
              <Maximize2 size={32} className="text-purple-400" />
            ) : (
              <Volume2 size={32} className="text-blue-400" />
            )}
          </div>
          <h3 className="text-lg font-medium text-shell-text mt-4">{fileName}</h3>
          <p className="text-xs text-shell-text-muted uppercase tracking-widest">{type} media ({mimeType})</p>
        </div>

        {/* The Native Player */}
        <div className={`w-full rounded-2xl overflow-hidden glass shadow-2xl border border-white/5 
          ${type === "audio" ? "max-w-[400px]" : "aspect-video"}`}>
          {type === "video" ? (
            <video
              src={blobUrl}
              controls
              className="w-full h-full object-contain"
              autoPlay={false}
            />
          ) : (
            <div className="p-8 pb-10 flex flex-col items-center justify-center gap-4 bg-shell-surface">
              <div className="w-full h-1 bg-shell-border rounded-full overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 animate-pulse-subtle" />
              </div>
              <audio
                src={blobUrl}
                controls
                className="w-full max-w-xs h-12"
                autoPlay={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
