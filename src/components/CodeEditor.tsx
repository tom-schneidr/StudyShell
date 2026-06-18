import { useCallback, useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightActiveLine,
  lineNumbers,
  drawSelection,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { indentOnInput, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";
import { oneDark } from "@codemirror/theme-one-dark";

// Languages
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { html } from "@codemirror/lang-html";
import { resolveCodeLanguage, shouldPersistCodeContent } from "../utils/codeEditor";

interface CodeEditorProps {
  content: string;
  onSave: (content: string) => void;
  filePath: string;
  language?: string;
}

export default function CodeEditor({ content, onSave, filePath, language }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef(content);
  const lastSavedRef = useRef(content);

  const getLanguageExtension = (lang?: string, path?: string) => {
    const ext = resolveCodeLanguage(lang, path);
    switch (ext) {
      case "js":
      case "ts":
      case "jsx":
      case "tsx":
        return javascript({ jsx: true, typescript: ext.includes("ts") });
      case "py":
        return python();
      case "rs":
        return rust();
      case "html":
        return html();
      default:
        return javascript(); // fallback
    }
  };

  const persistContent = useCallback(
    (nextContent: string) => {
      if (!shouldPersistCodeContent(nextContent, lastSavedRef.current)) {
        return;
      }

      lastSavedRef.current = nextContent;
      onSave(nextContent);
    },
    [onSave],
  );

  const flushPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    persistContent(latestContentRef.current);
  }, [persistContent]);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        indentOnInput(),
        foldGutter(),
        oneDark,
        getLanguageExtension(language, filePath),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...closeBracketsKeymap,
          ...completionKeymap,
          ...foldKeymap,
          ...searchKeymap,
          ...lintKeymap,
          {
            key: "Ctrl-s",
            run: (view) => {
              latestContentRef.current = view.state.doc.toString();
              flushPendingSave();
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            latestContentRef.current = update.state.doc.toString();

            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }

            saveTimeoutRef.current = setTimeout(() => {
              persistContent(latestContentRef.current);
              saveTimeoutRef.current = null;
            }, 750);
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      flushPendingSave();
      view.destroy();
    };
  }, [filePath, flushPendingSave, language, persistContent]);

  // Update content if it changes externally (e.g. switching tabs)
  useEffect(() => {
    if (viewRef.current && content !== viewRef.current.state.doc.toString()) {
      latestContentRef.current = content;
      lastSavedRef.current = content;
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: content,
        },
      });
    }
    lastSavedRef.current = content;
    latestContentRef.current = content;
  }, [content]);

  return (
    <div className="h-full flex flex-col bg-[#282c34]">
      {/* CodeMirror renders its own internal overflow, so we wrap it simply */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden text-[14px] custom-scrollbar selection:bg-shell-accent/30"
      />
    </div>
  );
}
