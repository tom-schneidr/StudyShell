export type SidebarTab = "explorer" | "search";

export const DEFAULT_SIDEBAR_TAB: SidebarTab = "explorer";

export function parseSidebarTab(value: string | null | undefined): SidebarTab {
  return value === "search" ? "search" : DEFAULT_SIDEBAR_TAB;
}

export function formatSearchTabBadge(matchCount: number): string | null {
  if (!Number.isFinite(matchCount) || matchCount <= 0) {
    return null;
  }

  return matchCount > 99 ? "99+" : String(Math.floor(matchCount));
}
