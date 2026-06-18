import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-shell-bg p-8">
          <div className="max-w-md w-full glass-layer-2 border border-shell-error/20 p-8 rounded-[32px] text-center shadow-2xl">
            <div className="w-16 h-16 bg-shell-error/10 text-shell-error rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-shell-text mb-2">Something went wrong</h2>
            <p className="text-sm text-shell-text-secondary leading-relaxed mb-8">
              An unexpected error occurred. You can try refreshing the application to restore
              functionality.
            </p>
            <div className="bg-shell-bg/50 p-4 rounded-xl border border-shell-border mb-8 text-left">
              <p className="text-[11px] font-mono text-shell-error truncate">
                {this.state.error?.message || "Unknown error"}
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-shell-accent text-white font-bold hover:bg-shell-accent-hover transition-all shadow-lg shadow-shell-accent/20"
            >
              <RefreshCw size={18} />
              Reset Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
