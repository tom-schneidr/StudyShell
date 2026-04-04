import { useRef, useEffect, useState, useCallback } from "react";
import { Trash2 } from "lucide-react";
import type { PageAnnotations, InkPath, Textbox } from "../types";
import { generateId } from "../types";

interface PdfInkCanvasProps {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
  annotations: PageAnnotations;
  onUpdateAnnotations: (pageNumber: number, annotations: PageAnnotations) => void;
  tool: "pen" | "highlighter" | "eraser" | "select" | "text";
  color: string;
  brushWidth: number;
}

export default function PdfInkCanvas({
  pageNumber,
  width,
  height,
  scale,
  annotations,
  onUpdateAnnotations,
  tool,
  color,
  brushWidth,
}: PdfInkCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<InkPath | null>(null);

  // Editing state
  const [editingTb, setEditingTb] = useState<{ id?: string; x: number; y: number; content: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Interaction state (Using refs for real-time smooth tracking to avoid React render lag)
  const [activeResizingId, setActiveResizingId] = useState<string | null>(null);
  const [activeDraggingId, setActiveDraggingId] = useState<string | null>(null);
  
  // Pivot points to prevent jittering
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeInitial = useRef({ width: 0, height: 0, x: 0, y: 0 });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    (annotations.ink || []).forEach((path) => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width * scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(path.points[0].x * scale, path.points[0].y * scale);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x * scale, path.points[i].y * scale);
      }
      ctx.stroke();
    });

    if (currentPath && currentPath.points.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = currentPath.color;
      ctx.lineWidth = currentPath.width * scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(currentPath.points[0].x * scale, currentPath.points[0].y * scale);
      for (let i = 1; i < currentPath.points.length; i++) {
        ctx.lineTo(currentPath.points[i].x * scale, currentPath.points[i].y * scale);
      }
      ctx.stroke();
    }
  }, [annotations.ink, currentPath, scale]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    if (editingTb) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editingTb]);

  // Global Mouse Handlers - Jitter-Free Version
  useEffect(() => {
    if (!activeResizingId && !activeDraggingId) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / scale;
      const mouseY = (e.clientY - rect.top) / scale;

      if (activeResizingId) {
        const next = (annotations.textboxes || []).map(t => {
          if (t.id === activeResizingId) {
             // Precise Resizing: Initial Width + (Current Mouse - Initial Mouse)
             const newWidth = resizeInitial.current.width + (mouseX - resizeInitial.current.x);
             const newHeight = resizeInitial.current.height + (mouseY - resizeInitial.current.y);
             return { ...t, width: Math.max(30/scale, newWidth), height: Math.max(20/scale, newHeight) };
          }
          return t;
        });
        onUpdateAnnotations(pageNumber, { ...annotations, textboxes: next });
      } else if (activeDraggingId) {
        const next = (annotations.textboxes || []).map(t => {
          if (t.id === activeDraggingId) {
             // Absolute Dragging: Mouse Position - Click Offset (literally pinned to mouse)
             return { ...t, x: mouseX - dragOffset.current.x, y: mouseY - dragOffset.current.y };
          }
          return t;
        });
        onUpdateAnnotations(pageNumber, { ...annotations, textboxes: next });
      }
    };

    const handleGlobalMouseUp = () => {
      setActiveResizingId(null);
      setActiveDraggingId(null);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [activeResizingId, activeDraggingId, scale, annotations, onUpdateAnnotations, pageNumber]);

  const commitTb = () => {
    if (!editingTb) return;
    let newTextboxes = [...(annotations.textboxes || [])];
    if (editingTb.id) {
        newTextboxes = newTextboxes.map(t => t.id === editingTb.id ? { ...t, content: editingTb.content } : t);
    } else if (editingTb.content.trim()) {
        newTextboxes.push({
            id: generateId(),
            x: editingTb.x,
            y: editingTb.y,
            width: 200 / scale,
            height: 50 / scale,
            content: editingTb.content,
            color,
            fontSize: 22 / scale
        });
    }
    onUpdateAnnotations(pageNumber, { ...annotations, textboxes: newTextboxes });
    setEditingTb(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (editingTb) {
      commitTb();
      return;
    }

    if (tool === "text") {
      setEditingTb({ x, y, content: "" });
      return;
    }

    if (tool === "eraser") {
      const remainingInk = (annotations.ink || []).filter(path => 
        !path.points.some(p => Math.sqrt((p.x-x)**2 + (p.y-y)**2) < 20 / scale)
      );
      const remainingTb = (annotations.textboxes || []).filter(t => 
        x < t.x || x > t.x + t.width || y < t.y || y > t.y + t.height
      );
      onUpdateAnnotations(pageNumber, { ...annotations, ink: remainingInk, textboxes: remainingTb });
      return;
    }

    if (tool === "select") {
        for (const t of (annotations.textboxes || [])) {
            if (x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + t.height) {
                // Initialize "Pinned" Dragging
                dragOffset.current = { x: x - t.x, y: y - t.y };
                setActiveDraggingId(t.id);
                return;
            }
        }
        return;
    }

    setIsDrawing(true);
    setCurrentPath({
      id: generateId(),
      points: [{ x, y }],
      color: tool === "highlighter" ? `${color}44` : color,
      width: tool === "highlighter" ? brushWidth * 8 : brushWidth,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !currentPath) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    setCurrentPath(p => p ? { ...p, points: [...p.points, { x, y }] } : null);
  };

  const handleMouseUp = () => {
    if (isDrawing && currentPath) {
      onUpdateAnnotations(pageNumber, { ...annotations, ink: [...(annotations.ink || []), currentPath] });
    }
    setIsDrawing(false);
    setCurrentPath(null);
  };

  const handleTbDoubleClick = (t: Textbox) => {
    if (tool === "select") {
        setEditingTb({ id: t.id, x: t.x, y: t.y, content: t.content });
    }
  };

  const deleteTb = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = (annotations.textboxes || []).filter(t => t.id !== id);
    onUpdateAnnotations(pageNumber, { ...annotations, textboxes: next });
  };

  return (
    <div className="absolute inset-0 z-10 pointer-events-auto overflow-hidden">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`absolute inset-0 z-10 ${tool === "select" ? "cursor-default" : "cursor-crosshair"}`}
      />

      {/* Render Textboxes */}
      {(annotations.textboxes || []).map((t) => (
        <div
          key={t.id}
          onDoubleClick={(e) => {
              e.stopPropagation();
              handleTbDoubleClick(t);
          }}
          onMouseDown={(e) => {
              if (tool === "select") {
                  e.stopPropagation();
                  const rect = canvasRef.current!.getBoundingClientRect();
                  const mouseX = (e.clientX - rect.left) / scale;
                  const mouseY = (e.clientY - rect.top) / scale;
                  // Pin the mouse offset to the box location for jitter-free dragging
                  dragOffset.current = { x: mouseX - t.x, y: mouseY - t.y };
                  setActiveDraggingId(t.id);
              }
          }}
          style={{
            position: "absolute",
            left: `${t.x * scale}px`,
            top: `${t.y * scale}px`,
            width: `${t.width * scale}px`,
            height: `${t.height * scale}px`,
            color: t.color,
            fontSize: `${t.fontSize * scale}px`,
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            whiteSpace: "pre-wrap",
            pointerEvents: tool === "select" || tool === "eraser" ? "auto" : "none",
            userSelect: "none",
            background: tool === "select" ? "rgba(108, 138, 255, 0.08)" : "transparent",
            border: tool === "select" ? "2px dashed #6c8aff44" : "none",
            borderRadius: "4px",
            zIndex: activeDraggingId === t.id || activeResizingId === t.id ? 100 : 20,
            cursor: tool === "select" ? "move" : "inherit"
          }}
          className="flex items-center p-2 group"
        >
          {t.content}
          
          {/* Action Buttons in Select Mode */}
          {tool === "select" && (
            <>
              {/* Trash Button - Small and premium */}
              <button 
                onMouseDown={(e) => deleteTb(e, t.id)}
                className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center 
                shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 scale-75 group-hover:scale-100 cursor-pointer"
              >
                <Trash2 size={12} />
              </button>

              {/* Resize Handle */}
              <div 
                onMouseDown={(e) => {
                    e.stopPropagation();
                    const rect = canvasRef.current!.getBoundingClientRect();
                    const mouseX = (e.clientX - rect.left) / scale;
                    const mouseY = (e.clientY - rect.top) / scale;
                    // Store initial dimensions for precise math-based resizing
                    resizeInitial.current = { width: t.width, height: t.height, x: mouseX, y: mouseY };
                    setActiveResizingId(t.id);
                }}
                className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-shell-accent rounded-sm cursor-nwse-resize shadow-md flex items-center justify-center hover:scale-125 transition-transform z-50"
              >
                <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-white opacity-90" />
              </div>
            </>
          )}
        </div>
      ))}

      {/* Editing Layer */}
      {editingTb && (
        <div
          style={{
            position: "absolute",
            left: `${editingTb.x * scale}px`,
            top: `${editingTb.y * scale}px`,
            zIndex: 1000
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={editingTb.content}
            onChange={(e) => setEditingTb({ ...editingTb, content: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTb();
              if (e.key === "Escape") setEditingTb(null);
            }}
            onBlur={commitTb}
            className="modern-text-input"
            style={{
                color: color,
                fontSize: `${22}px`,
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                background: "rgba(255, 255, 255, 1)",
                border: "2px solid #6c8aff",
                outline: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                boxShadow: "0 10px 40px -10px rgba(0, 0, 0, 0.6)",
                minWidth: "200px"
            }}
          />
        </div>
      )}
    </div>
  );
}
