import { Loader2, RefreshCw, Router } from "lucide-react";
import { aiConfigGuidance } from "../utils/aiConfig";
import { FREEROUTER_MODEL, FREEROUTER_PRODUCT_NAME } from "../utils/freerouter";
import type { AiStatus } from "../hooks/useStudyAI";

interface FreeRouterStatusProps {
  aiStatus: AiStatus | null;
  isConfigured: boolean | null;
  onRefresh?: () => void;
  compact?: boolean;
}

export default function FreeRouterStatus({
  aiStatus,
  isConfigured,
  onRefresh,
  compact = false,
}: FreeRouterStatusProps) {
  const checking = isConfigured === null;
  const connected = isConfigured === true;
  const baseUrl = aiStatus?.baseUrl ?? "http://127.0.0.1:8000/v1";

  if (compact) {
    return (
      <span className="px-2 py-1 rounded bg-shell-surface flex items-center gap-1.5 text-[9px] text-shell-text-muted font-bold uppercase tracking-widest border border-shell-border/40">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            checking
              ? "bg-amber-400 animate-pulse"
              : connected
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                : "bg-red-400"
          }`}
        />
        {checking ? "FreeRouter…" : connected ? "FreeRouter OK" : "FreeRouter offline"}
      </span>
    );
  }

  return (
    <div
      className={`rounded-xl border px-3 py-3 text-[11px] leading-relaxed ${
        connected
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
          : checking
            ? "border-shell-border bg-shell-bg text-shell-text-secondary"
            : "border-amber-500/20 bg-amber-500/10 text-amber-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
              connected ? "bg-emerald-500/20 text-emerald-300" : "bg-shell-surface text-shell-text-muted"
            }`}
          >
            {checking ? <Loader2 size={16} className="animate-spin" /> : <Router size={16} />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[12px]">
              {FREEROUTER_PRODUCT_NAME}
              <span className="ml-2 font-normal opacity-80">model: {FREEROUTER_MODEL}</span>
            </p>
            <p className="mt-1 break-all font-mono text-[10px] opacity-90">{baseUrl}</p>
            <p className="mt-1.5 opacity-90">
              {checking
                ? "Checking local gateway…"
                : connected
                  ? "Connected. Requests are routed automatically across your configured providers."
                  : "Not reachable. Start FreeRouter locally, then refresh."}
            </p>
            {!connected && !checking && (
              <p className="mt-1 text-[10px] opacity-80">
                {aiConfigGuidance}{" "}
                <a
                  href="https://github.com/tom-schneidr/FreeRouter#readme"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:opacity-100"
                >
                  Setup guide
                </a>
              </p>
            )}
          </div>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="flex-shrink-0 rounded-lg border border-shell-border/60 p-2 text-shell-text-muted transition-colors hover:text-shell-text hover:bg-shell-surface cursor-pointer"
            title="Refresh FreeRouter status"
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
