export function detectPathSeparator(path: string): "/" | "\\" {
  return path.includes("\\") ? "\\" : "/";
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
