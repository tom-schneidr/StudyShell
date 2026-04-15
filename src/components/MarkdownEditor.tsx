import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { marked } from "marked";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  Quote,
  Minus,
  Undo,
  Redo,
  Eye,
  PenLine,
  ListTree,
} from "lucide-react";
import { useToast } from "./ToastProvider";
import {
  buildMarkdownImageTag,
  buildPastedImageFilename,
  insertTextAtSelection,
} from "../utils/markdownAssets";
import { getMarkdownHeadingOffset, parseMarkdownHeadings } from "../utils/markdownHeadings";

interface MarkdownEditorProps {
  content: string;
  onSave: (content: string) => void;
  filePath: string;
  isMarkdown: boolean;
  onSaveAsset?: (documentPath: string, filename: string, base64: string) => Promise<string>;
}

// Configure marked for parsing markdown → HTML
marked.setOptions({
  breaks: true,
  gfm: true,
});


export default function MarkdownEditor({
  content,
  onSave,
  filePath,
  isMarkdown,
  onSaveAsset,
}: MarkdownEditorProps) {
  const toast = useToast();
  const [isEditMode, setIsEditMode] = useState(!isMarkdown);
  const [rawContent, setRawContent] = useState(content);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(content);
  const isInitialLoadRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const markdownHeadings = useMemo(
    () => (isMarkdown ? parseMarkdownHeadings(rawContent) : []),
    [isMarkdown, rawContent],
  );

  // Convert markdown to HTML for TipTap
  const htmlContent = useMemo(() => {
    if (!isMarkdown) return content;
    return marked.parse(content) as string;
  }, [content, isMarkdown]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: htmlContent,
    editable: isEditMode && !isMarkdown,
    editorProps: {
      attributes: {
        class: "min-h-full outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        return;
      }

      // Debounce autosave — only in WYSIWYG edit mode for non-markdown files
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        const html = editor.getHTML();
        if (html !== lastSavedRef.current) {
          lastSavedRef.current = html;
          onSave(html);
        }
      }, 1000);
    },
  });

  // Update content when file changes
  useEffect(() => {
    setRawContent(content);
    lastSavedRef.current = content;
    if (editor) {
      isInitialLoadRef.current = true;
      const html = isMarkdown ? (marked.parse(content) as string) : content;
      editor.commands.setContent(html);
    }
    // Reset to preview for markdown, edit for others
    setIsEditMode(!isMarkdown);
  }, [filePath]);

  // Toggle between edit & preview for markdown
  useEffect(() => {
    if (!editor || !isMarkdown) return;
    if (isEditMode) {
      // Switching TO edit mode — nothing to do for TipTap, we show raw textarea
    } else {
      // Switching TO preview — re-render from the raw content
      isInitialLoadRef.current = true;
      const html = marked.parse(rawContent) as string;
      editor.commands.setContent(html);
      editor.setEditable(false);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (!isMarkdown || isEditMode || !previewContainerRef.current) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const headingElements = previewContainerRef.current?.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
      if (!headingElements) {
        return;
      }

      headingElements.forEach((element, index) => {
        const heading = markdownHeadings[index];
        if (!heading) {
          element.removeAttribute("id");
          return;
        }

        element.id = heading.id;
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isEditMode, isMarkdown, markdownHeadings, rawContent]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const scheduleSave = useCallback((value: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (value !== lastSavedRef.current) {
        lastSavedRef.current = value;
        onSave(value);
      }
    }, 1000);
  }, [onSave]);

  // Handle raw markdown edits
  const handleRawChange = useCallback((value: string) => {
    setRawContent(value);
    scheduleSave(value);
  }, [scheduleSave]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onSaveAsset || !isMarkdown || !isEditMode) return;

    const imageItem = Array.from(e.clipboardData.items).find((item) =>
      item.type.startsWith("image/"),
    );
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    e.preventDefault();

    const textarea = e.currentTarget;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const filename = buildPastedImageFilename(file.type);

    try {
      const base64 = await readFileAsDataUrl(file);
      const relativePath = await onSaveAsset(filePath, filename, base64);
      const markdownLink = buildMarkdownImageTag(filename, relativePath);
      const nextCaretPosition = selectionStart + markdownLink.length;

      setRawContent((previousContent) => {
        const nextValue = insertTextAtSelection(
          previousContent,
          selectionStart,
          selectionEnd,
          markdownLink,
        );
        scheduleSave(nextValue);
        return nextValue;
      });

      window.requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCaretPosition, nextCaretPosition);
      });

      toast.success("Image pasted into note.");
    } catch (error) {
      console.error("Paste failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to paste image.");
    }
  }, [filePath, isEditMode, isMarkdown, onSaveAsset, scheduleSave, toast]);

  const handleHeadingSelect = useCallback((line: number, headingId: string) => {
    if (isEditMode) {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      const offset = getMarkdownHeadingOffset(rawContent, line);
      const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight || "24");

      textarea.focus();
      textarea.setSelectionRange(offset, offset);
      textarea.scrollTop = Math.max((line - 1) * lineHeight - textarea.clientHeight / 3, 0);
      return;
    }

    const target = previewContainerRef.current?.querySelector<HTMLElement>(`#${headingId}`);
    target?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [isEditMode, rawContent]);

  const toggleMode = () => {
    if (isEditMode && isMarkdown) {
      // Was editing raw MD, now switch to preview — update editor
      setIsEditMode(false);
    } else if (!isEditMode && isMarkdown) {
      setIsEditMode(true);
    }
  };

  if (!editor) return null;

  const ToolbarButton = ({
    onClick,
    active,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors duration-100 cursor-pointer
        ${
          active
            ? "bg-shell-accent/15 text-shell-accent"
            : "text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover"
        }`}
    >
      {children}
    </button>
  );

  return (
    <div className="h-full flex flex-col tiptap-editor">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-0.5 px-4 py-2 border-b border-shell-border
        bg-shell-surface">

        {/* Show formatting toolbar only for non-markdown edit mode */}
        {isEditMode && !isMarkdown && (
          <>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive("bold")}
              title="Bold (Ctrl+B)"
            >
              <Bold size={14} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive("italic")}
              title="Italic (Ctrl+I)"
            >
              <Italic size={14} />
            </ToolbarButton>

            <div className="w-px h-4 bg-shell-border mx-1" />

            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              active={editor.isActive("heading", { level: 1 })}
              title="Heading 1"
            >
              <Heading1 size={14} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              active={editor.isActive("heading", { level: 2 })}
              title="Heading 2"
            >
              <Heading2 size={14} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
              active={editor.isActive("heading", { level: 3 })}
              title="Heading 3"
            >
              <Heading3 size={14} />
            </ToolbarButton>

            <div className="w-px h-4 bg-shell-border mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive("bulletList")}
              title="Bullet List"
            >
              <List size={14} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive("orderedList")}
              title="Ordered List"
            >
              <ListOrdered size={14} />
            </ToolbarButton>

            <div className="w-px h-4 bg-shell-border mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              active={editor.isActive("codeBlock")}
              title="Code Block"
            >
              <Code size={14} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive("blockquote")}
              title="Blockquote"
            >
              <Quote size={14} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Horizontal Rule"
            >
              <Minus size={14} />
            </ToolbarButton>

            <div className="w-px h-4 bg-shell-border mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              title="Undo (Ctrl+Z)"
            >
              <Undo size={14} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo size={14} />
            </ToolbarButton>
          </>
        )}

        {/* Edit mode label for raw markdown */}
        {isEditMode && isMarkdown && (
          <span className="text-[11px] text-shell-text-muted font-medium uppercase tracking-wider">
            Markdown Source
          </span>
        )}

        {/* Preview label */}
        {!isEditMode && isMarkdown && (
          <span className="text-[11px] text-shell-text-muted font-medium uppercase tracking-wider">
            Preview
          </span>
        )}

        <div className="flex-1" />

        {/* Mode toggle for markdown files */}
        {isMarkdown && (
          <button
            onClick={toggleMode}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium
              transition-all duration-200 cursor-pointer border
              bg-shell-accent/10 text-shell-accent border-shell-accent/20
              hover:bg-shell-accent/20 hover:border-shell-accent/30"
          >
            {isEditMode ? (
              <>
                <Eye size={13} />
                Preview
              </>
            ) : (
              <>
                <PenLine size={13} />
                Edit
              </>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex">
        <div ref={previewContainerRef} className="flex-1 min-w-0 overflow-y-auto">
          {isEditMode && isMarkdown ? (
            <textarea
              ref={textareaRef}
              value={rawContent}
              onChange={(e) => handleRawChange(e.target.value)}
              onPaste={handlePaste}
              className="w-full h-full bg-transparent text-shell-text text-[13px] leading-[1.8]
                font-mono p-8 outline-none resize-none"
              spellCheck={false}
            />
          ) : (
            <EditorContent editor={editor} className="h-full" />
          )}
        </div>

        {isMarkdown && markdownHeadings.length > 0 && (
          <aside className="hidden xl:flex w-64 flex-shrink-0 flex-col border-l border-shell-border bg-shell-bg/30">
            <div className="px-4 py-3 border-b border-shell-border">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-shell-text-muted">
                <ListTree size={13} />
                <span>Contents</span>
              </div>
              <p className="mt-1 text-[11px] text-shell-text-secondary">
                {markdownHeadings.length} heading{markdownHeadings.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-3 custom-scrollbar">
              {markdownHeadings.map((heading) => (
                <button
                  key={heading.id}
                  onClick={() => handleHeadingSelect(heading.line, heading.id)}
                  className="w-full rounded-lg px-3 py-2 text-left text-[12px] text-shell-text-secondary hover:bg-shell-surface hover:text-shell-text transition-colors cursor-pointer"
                  style={{ paddingLeft: `${Math.max(heading.level - 1, 0) * 14 + 12}px` }}
                  title={`Jump to ${heading.text}`}
                >
                  <span className="line-clamp-2">{heading.text}</span>
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to read pasted image."));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read pasted image."));
    };

    reader.readAsDataURL(file);
  });
}
