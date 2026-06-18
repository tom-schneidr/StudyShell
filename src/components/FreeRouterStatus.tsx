import { Loader2, RefreshCw } from "lucide-react";
import { aiConfigGuidance } from "../utils/aiConfig";
import { FREEROUTER_MODEL, FREEROUTER_PRODUCT_NAME } from "../utils/freerouter";
import type { AiStatus } from "../hooks/useStudyAI";

interface FreeRouterStatusProps {
  aiStatus: AiStatus | null;
  isConfigured: boolean | null;
  onRefresh?: () => void;
}

export default function FreeRouterStatus({
  aiStatus,
  isConfigured,
  onRefresh,
}: FreeRouterStatusProps) {
  const checking = isConfigured === null;
  const connected = isConfigured === true;
  const baseUrl = aiStatus?.baseUrl ?? "http://127.0.0.1:8000/v1";

  const dotClass = checking
    ? "bg-amber-400 animate-pulse"
    : connected
      ? "bg-emerald-500"
      : "bg-red-400";

  const label = checking
    ? "Checking gateway…"
    : connected
      ? `${FREEROUTER_PRODUCT_NAME} · ${FREEROUTER_MODEL}`
      : `${FREEROUTER_PRODUCT_NAME} offline`;

  return (
    <div className="flex items-center gap-2 min-w-0 text-[11px] text-shell-text-muted">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
      <span className="truncate flex-1" title={baseUrl}>
        {label}
      </span>
      {onRefresh && (
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="flex-shrink-0 p-1 rounded text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
          title="Refresh status"
        >
          {checking ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        </button>
      )}
      {!connected && !checking && (
        <a
          href="https://github.com/tom-schneidr/FreeRouter#readme"
          target="_blank"
          rel="noreferrer"
          className="flex-shrink-0 text-shell-accent hover:underline"
          title={aiConfigGuidance}
        >
          Setup
        </a>
      )}
    </div>
  );
}
