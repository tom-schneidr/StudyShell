import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { hasDuplicateToast } from "../utils/toasts";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2);
    const nextToast = { id, type, message };
    let shouldScheduleRemoval = false;

    setToasts((prev) => {
      if (hasDuplicateToast(prev, nextToast)) {
        return prev;
      }

      shouldScheduleRemoval = true;
      return [...prev, nextToast];
    });

    if (!shouldScheduleRemoval) {
      return;
    }

    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((msg: string) => addToast("success", msg), [addToast]);
  const error = useCallback((msg: string) => addToast("error", msg), [addToast]);
  const info = useCallback((msg: string) => addToast("info", msg), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none w-80 max-w-[calc(100vw-3rem)]">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.2 } }}
              className="pointer-events-auto flex items-start gap-4 p-5 rounded-2xl border glass-layer-2 shadow-2xl relative overflow-hidden"
            >
              {/* Type-based border glow */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  toast.type === "success"
                    ? "bg-shell-success"
                    : toast.type === "error"
                      ? "bg-shell-error"
                      : "bg-shell-accent"
                }`}
              />

              {/* Type-based accent background glow */}
              <div
                className={`absolute inset-0 opacity-5 pointer-events-none ${
                  toast.type === "success"
                    ? "bg-shell-success"
                    : toast.type === "error"
                      ? "bg-shell-error"
                      : "bg-shell-accent"
                }`}
              />

              <div className="flex-shrink-0 mt-0.5">
                {toast.type === "success" && (
                  <CheckCircle size={20} className="text-shell-success" />
                )}
                {toast.type === "error" && <AlertCircle size={20} className="text-shell-error" />}
                {toast.type === "info" && <Info size={20} className="text-shell-accent" />}
              </div>

              <div className="flex-1 text-[13.5px] text-shell-text font-semibold leading-relaxed">
                {toast.message}
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 p-1.5 -mr-2 -mt-1 text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>

              {/* Progress Bar */}
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 4, ease: "linear" }}
                className={`absolute bottom-0 left-0 h-0.5 opacity-40 ${
                  toast.type === "success"
                    ? "bg-shell-success"
                    : toast.type === "error"
                      ? "bg-shell-error"
                      : "bg-shell-accent"
                }`}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
