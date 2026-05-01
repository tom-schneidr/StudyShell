export function detectPathSeparator(path: string): "/" | "\\" {
  return path.includes("\\") ? "\\" : "/";
}

export function getPathBaseName(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, "");
  if (!trimmed) {
    return path;
  }

  const lastSlash = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
  return lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
}

export function getPathExtension(path: string): string | null {
  const baseName = getPathBaseName(path);
  const dotIndex = baseName.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === baseName.length - 1) {
    return null;
  }

  return baseName.slice(dotIndex + 1);
}

export function getParentPath(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return lastSlash >= 0 ? path.slice(0, lastSlash) : path;
}

export function joinPath(directory: string, name: string): string {
  if (!directory) {
    return name;
  }

  if (directory.endsWith("/") || directory.endsWith("\\")) {
    return `${directory}${name}`;
  }

  return `${directory}${detectPathSeparator(directory)}${name}`;
}

export function isSameOrDescendantPath(path: string, ancestorPath: string): boolean {
  if (path === ancestorPath) {
    return true;
  }

  if (!path.startsWith(ancestorPath)) {
    return false;
  }

  const boundary = path.charAt(ancestorPath.length);
  return boundary === "/" || boundary === "\\";
}

export function remapPathPrefix(
  path: string,
  oldPrefix: string,
  newPrefix: string,
): string | null {
  if (!isSameOrDescendantPath(path, oldPrefix)) {
    return null;
  }

  return `${newPrefix}${path.slice(oldPrefix.length)}`;
}

export function getRelativePathFromRoot(path: string, rootPath: string): string {
  if (path === rootPath) {
    return ".";
  }

  if (!isSameOrDescendantPath(path, rootPath)) {
    return path;
  }

  return path.slice(rootPath.length).replace(/^[/\\]/, "");
}

export function buildExportCopyFilename(path: string): string {
  const baseName = getPathBaseName(path);
  if (!baseName) {
    return "annotated.pdf";
  }

  if (/\.pdf$/i.test(baseName)) {
    return baseName.replace(/\.pdf$/i, "_annotated.pdf");
  }

  return `${baseName}_annotated.pdf`;
}
