import {
  BookOpen,
  File,
  FileCode,
  FileText,
  FileType,
  Film,
  Image as ImageIcon,
  Music,
  Sparkles,
} from "lucide-react";
import { getFileType } from "../types";

interface FileTypeIconProps {
  extension: string | null | undefined;
  name?: string;
  size?: number;
  active?: boolean;
  className?: string;
}

/** Minimal file-type icon — accent only when `active`. */
export function FileTypeIcon({
  extension,
  name,
  size = 14,
  active = false,
  className = "",
}: FileTypeIconProps) {
  const type = getFileType(extension ?? null, name);
  const color = active ? "text-shell-accent" : "text-shell-text-muted";
  const props = { size, className: `flex-shrink-0 ${color} ${className}` };

  switch (type) {
    case "flashcard":
      return <Sparkles {...props} />;
    case "markdown":
    case "text":
      return <FileText {...props} />;
    case "pdf":
      return <FileType {...props} />;
    case "image":
      return <ImageIcon {...props} />;
    case "notebook":
      return <BookOpen {...props} />;
    case "video":
      return <Film {...props} />;
    case "audio":
      return <Music {...props} />;
    case "code":
      return <FileCode {...props} />;
    default:
      return <File {...props} />;
  }
}
