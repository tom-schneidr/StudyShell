/// File tree node structure
export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string | null;
  children: FileNode[] | null;
}

/// Chat message
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: VertexModel;
}

/// Supported file types for the editor
export type FileType = "markdown" | "text" | "pdf" | "image" | "video" | "audio" | "notebook" | "code" | "svg" | "unsupported";

/// Vertex AI model options
export type VertexModel = "gemini-3.1-pro-preview" | "gemini-3-flash-preview" | "gemini-2.5-pro" | "gemini-2.5-flash";

export const modelLabels: Record<VertexModel, string> = {
  "gemini-3.1-pro-preview": "Gemini 3.1 Pro (Preview)",
  "gemini-3-flash-preview": "Gemini 3 Flash (Preview)",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
};

/// Filesystem change event from the watcher
export interface FsChangeEvent {
  path: string;
  kind: string;
}

/// Directory statistics
export interface DirectoryStats {
  file_count: number;
  dir_count: number;
  total_size: number;
}

/// Jupyter Notebook types
export interface NotebookData {
  cells: NotebookCell[];
  metadata?: Record<string, unknown>;
}

export interface NotebookCell {
  cell_type: "code" | "markdown" | "raw";
  source: string[] | string;
  outputs?: NotebookOutput[];
  execution_count?: number | null;
  metadata?: Record<string, unknown>;
}

export interface NotebookOutput {
  output_type: string;
  text?: string[] | string;
  data?: Record<string, string[] | string>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

/// PDF Annotations
export interface PdfAnnotationData {
  version: number;
  pages: Record<number, PageAnnotations>;
}

export interface PageAnnotations {
  ink: InkPath[];
  highlights: HighlightRect[];
  notes: StickyNote[];
  textboxes: Textbox[];
}

export interface InkPath {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface HighlightRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  content: string;
  author: string;
}

export interface Textbox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  fontSize: number;
}

/// Get the file type from an extension
export function getFileType(extension: string | null): FileType {
  if (!extension) return "unsupported";
  const ext = extension.toLowerCase();

  const pdfExtensions = ["pdf"];
  const imgExtensions = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "tiff", "tif", "svg"];
  const videoExtensions = ["mp4", "webm", "avi", "mov", "mkv"];
  const audioExtensions = ["mp3", "wav", "m4a", "ogg", "flac"];
  const notebookExtensions = ["ipynb"];
  const markdownExtensions = ["md", "markdown", "mdx"];

  const codeExtensions = [
    "rs", "py", "js", "ts", "tsx", "jsx", "html", "css", "scss", "sass", "less", "java", "c", "cpp",
    "h", "hpp", "cs", "go", "rb", "php", "swift", "kt", "kts", "scala", "r", "m", "sql", "sh", "bash",
    "zsh", "ps1", "bat", "cmd", "xml", "lua", "vim", "diff", "patch", "svelte", "vue", "astro", "graphql", "gql", "prisma"
  ];

  const textExtensions = ["txt", "text", "log", "csv", "json", "json5", "yaml", "yml", "toml", "lock", "ini", "cfg", "conf"];

  if (ext === "svg") return "svg";
  if (markdownExtensions.includes(ext)) return "markdown";
  if (pdfExtensions.includes(ext)) return "pdf";
  if (imgExtensions.includes(ext)) return "image";
  if (videoExtensions.includes(ext)) return "video";
  if (audioExtensions.includes(ext)) return "audio";
  if (notebookExtensions.includes(ext)) return "notebook";
  if (codeExtensions.includes(ext)) return "code";
  if (textExtensions.includes(ext)) return "text";
  return "unsupported";
}

/// Get MIME type from extension
export function getMimeType(extension: string | null): string {
  if (!extension) return "application/octet-stream";
  switch (extension.toLowerCase()) {
    case "png": return "image/png";
    case "jpg": case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "bmp": return "image/bmp";
    case "ico": return "image/x-icon";
    case "tiff": case "tif": return "image/tiff";
    case "svg": return "image/svg+xml";
    case "pdf": return "application/pdf";
    case "mp4": return "video/mp4";
    case "webm": return "video/webm";
    case "mp3": return "audio/mpeg";
    case "wav": return "audio/wav";
    case "m4a": return "audio/mp4";
    case "ogg": return "audio/ogg";
    case "avi": return "video/x-msvideo";
    case "mov": return "video/quicktime";
    default: return "application/octet-stream";
  }
}

/// Format bytes to human-readable string
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/// Generate a unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/// Normalize notebook cell source to string
export function cellSourceToString(source: string[] | string): string {
  return Array.isArray(source) ? source.join("") : source;
}
