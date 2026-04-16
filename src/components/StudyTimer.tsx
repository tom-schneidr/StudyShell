import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, Coffee, BookOpen } from "lucide-react";
import { useToast } from "./ToastProvider";

type TimerMode = "work" | "break";

export default function StudyTimer() {
  const [seconds, setSeconds] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<TimerMode>("work");
  const toast = useToast();

  const switchMode = useCallback(() => {
    const nextMode = mode === "work" ? "break" : "work";
    setMode(nextMode);
    setSeconds(nextMode === "work" ? 25 * 60 : 5 * 60);
    setIsActive(false);
    
    if (nextMode === "work") {
        toast.info("Break finished! Time to focus.");
    } else {
        toast.success("Work session complete! Take a well-deserved break.");
    }
  }, [mode, toast]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((s) => s - 1);
      }, 1000);
    } else if (isActive && seconds === 0) {
      switchMode();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, seconds, switchMode]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setSeconds(mode === "work" ? 25 * 60 : 5 * 60);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = 1 - seconds / (mode === "work" ? 25 * 60 : 5 * 60);

  return (
    <div className="flex items-center gap-4 px-3 py-1.5 rounded-2xl bg-shell-surface/50 border border-shell-border shadow-inner group">
      <div className="flex items-center gap-2.5">
        <div className="relative w-7 h-7 flex items-center justify-center">
            {/* Circular Progress */}
            <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle 
                  cx="14" cy="14" r="12" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  className="text-shell-border" 
                />
                <motion.circle 
                  cx="14" cy="14" r="12" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeDasharray="75.4" // 2 * PI * 12
                  animate={{ strokeDashoffset: 75.4 * (1 - progress) }}
                  className={mode === "work" ? "text-shell-accent" : "text-emerald-400"}
                />
            </svg>
            <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.5 }}
                >
                    {mode === "work" ? <BookOpen size={12} className="text-shell-accent" /> : <Coffee size={12} className="text-emerald-400" />}
                </motion.div>
            </AnimatePresence>
        </div>

        <div className="flex flex-col min-w-[45px]">
            <span className="text-[13px] font-mono font-bold text-shell-text tabular-nums leading-none">
                {formatTime(seconds)}
            </span>
            <span className="text-[8px] font-black uppercase tracking-widest text-shell-text-muted mt-0.5 leading-none">
                {mode}
            </span>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={toggleTimer}
          className={`p-1.5 rounded-lg transition-all ${
            isActive ? "bg-shell-surface-active text-shell-text" : "hover:bg-shell-accent/10 hover:text-shell-accent"
          }`}
          title={isActive ? "Pause" : "Start"}
        >
          {isActive ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
        <button
          onClick={resetTimer}
          className="p-1.5 rounded-lg hover:bg-shell-surface-hover hover:text-shell-text text-shell-text-muted transition-all"
          title="Reset"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
