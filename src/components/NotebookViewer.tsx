import { useMemo } from "react";
import { marked } from "marked";
import { Play, FileText } from "lucide-react";
import type { NotebookData } from "../types";
import { cellSourceToString } from "../types";

marked.setOptions({ breaks: true, gfm: true });

interface NotebookViewerProps {
  data: NotebookData;
}

export default function NotebookViewer({ data }: NotebookViewerProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[900px] mx-auto py-6 px-8 space-y-2">
        {data.cells.map((cell, idx) => (
          <NotebookCellView key={idx} cell={cell} />
        ))}
      </div>
    </div>
  );
}

function NotebookCellView({
  cell,
}: {
  cell: NotebookData["cells"][number];
}) {
  const source = cellSourceToString(cell.source);

  if (cell.cell_type === "markdown") {
    return <MarkdownCellView source={source} />;
  }

  if (cell.cell_type === "code") {
    return (
      <CodeCellView
        source={source}
        outputs={cell.outputs || []}
        executionCount={cell.execution_count}
      />
    );
  }

  // Raw cell
  return (
    <div className="rounded-lg border border-shell-border bg-shell-surface p-4">
      <div className="flex items-center gap-1.5 mb-2 text-[10px] text-shell-text-muted uppercase tracking-wider font-medium">
        <FileText size={11} />
        Raw
      </div>
      <pre className="text-[13px] text-shell-text-secondary font-mono whitespace-pre-wrap">{source}</pre>
    </div>
  );
}

function MarkdownCellView({ source }: { source: string }) {
  const html = useMemo(() => marked.parse(source) as string, [source]);

  return (
    <div className="tiptap-editor">
      <div
        className="ProseMirror px-4 py-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function CodeCellView({
  source,
  outputs,
  executionCount,
}: {
  source: string;
  outputs: NotebookData["cells"][number]["outputs"];
  executionCount?: number | null;
}) {
  return (
    <div className="rounded-lg border border-shell-border overflow-hidden">
      {/* Code input */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-10 flex items-start justify-center pt-3
          bg-shell-bg border-r border-shell-border text-[10px] text-shell-text-muted select-none">
          <div className="flex items-center gap-0.5">
            <Play size={8} />
            {executionCount != null ? executionCount : " "}
          </div>
        </div>
        <pre className="pl-12 pr-4 py-3 bg-shell-bg overflow-x-auto">
          <code className="text-[12.5px] leading-[1.7] font-mono text-shell-text">{source}</code>
        </pre>
      </div>

      {/* Outputs */}
      {outputs && outputs.length > 0 && (
        <div className="border-t border-shell-border bg-shell-surface">
          {outputs.map((output, i) => (
            <OutputView key={i} output={output} />
          ))}
        </div>
      )}
    </div>
  );
}

function OutputView({ output }: { output: NonNullable<NotebookData["cells"][number]["outputs"]>[number] }) {
  // Error output
  if (output.output_type === "error") {
    return (
      <div className="px-4 py-3 overflow-x-auto">
        <pre className="text-[12px] font-mono text-shell-error whitespace-pre-wrap">
          {output.traceback
            ? output.traceback.join("\n").replace(/\x1b\[[0-9;]*m/g, "")
            : `${output.ename}: ${output.evalue}`}
        </pre>
      </div>
    );
  }

  // Stream output (stdout/stderr)
  if (output.output_type === "stream") {
    const text = Array.isArray(output.text) ? output.text.join("") : output.text || "";
    return (
      <div className="px-4 py-3 overflow-x-auto">
        <pre className="text-[12.5px] font-mono text-shell-text-secondary whitespace-pre-wrap">{text}</pre>
      </div>
    );
  }

  // execute_result or display_data
  if (output.output_type === "execute_result" || output.output_type === "display_data") {
    const data = output.data || {};

    // HTML output
    if (data["text/html"]) {
      const html = Array.isArray(data["text/html"]) ? data["text/html"].join("") : data["text/html"];
      return (
        <div className="px-4 py-3 overflow-x-auto notebook-html-output">
          <div dangerouslySetInnerHTML={{ __html: html }} className="text-[12.5px] text-shell-text" />
        </div>
      );
    }

    // Image output (base64)
    if (data["image/png"]) {
      const imgSrc = Array.isArray(data["image/png"]) ? data["image/png"].join("") : data["image/png"];
      return (
        <div className="px-4 py-3">
          <img src={`data:image/png;base64,${imgSrc.trim()}`} alt="Output" className="max-w-full rounded" />
        </div>
      );
    }

    if (data["image/jpeg"]) {
      const imgSrc = Array.isArray(data["image/jpeg"]) ? data["image/jpeg"].join("") : data["image/jpeg"];
      return (
        <div className="px-4 py-3">
          <img src={`data:image/jpeg;base64,${imgSrc.trim()}`} alt="Output" className="max-w-full rounded" />
        </div>
      );
    }

    // Plain text fallback
    if (data["text/plain"]) {
      const text = Array.isArray(data["text/plain"]) ? data["text/plain"].join("") : data["text/plain"];
      return (
        <div className="px-4 py-3 overflow-x-auto">
          <pre className="text-[12.5px] font-mono text-shell-text-secondary whitespace-pre-wrap">{text}</pre>
        </div>
      );
    }
  }

  return null;
}
