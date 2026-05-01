export const vertexConfigGuidance =
  "Set PROJECT_ID in .env and make sure Google application default credentials are available on this machine.";

export function getVertexConfigErrorMessage(): string {
  return `Vertex AI is not configured. ${vertexConfigGuidance}`;
}

export function getChatPlaceholder(isConfigured: boolean | null, useSearch: boolean): string {
  if (isConfigured === null) {
    return "Checking Vertex AI setup...";
  }

  if (!isConfigured) {
    return "Configure Vertex AI to start chatting...";
  }

  return useSearch ? "Search and ask..." : "Ask your sources...";
}
