export const aiConfigGuidance =
  "Start FreeRouter locally (default http://127.0.0.1:8000/v1) and set FREEROUTER_BASE_URL in .env if you use a different host or port.";

export function getAiConfigErrorMessage(): string {
  return `FreeRouter is not reachable. ${aiConfigGuidance}`;
}

export function getChatPlaceholder(isConfigured: boolean | null, useSearch: boolean): string {
  if (isConfigured === null) {
    return "Checking FreeRouter connection...";
  }

  if (!isConfigured) {
    return "Start FreeRouter to begin chatting...";
  }

  return useSearch ? "Search the web and ask..." : "Ask your sources...";
}
