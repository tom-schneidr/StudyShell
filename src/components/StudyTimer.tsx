import { useState, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { useToast } from "./ToastProvider";
import {
  createDefaultStudyTimerState,
  formatStudyTimerTime,
  getNextTimerMode,
  getTimerDuration,
  readStudyTimerState,
  requestDesktopNotificationPermission,
  saveStudyTimerState,
  sendStudyTimerNotification,
} from "../utils/studyTimer";

export default function StudyTimer() {
  const [timerState, setTimerState] = useState(() => readStudyTimerState(window.localStorage));
  const toast = useToast();
  const { seconds, isActive, mode } = timerState;

  const switchMode = useCallback(() => {
    const completedMode = mode;
    const nextMode = getNextTimerMode(completedMode);
    setTimerState({
      mode: nextMode,
      seconds: getTimerDuration(nextMode),
      isActive: false,
      updatedAt: Date.now(),
    });
    sendStudyTimerNotification(completedMode);

    if (nextMode === "work") {
      toast.info("Break finished. Back to focus.");
    } else {
      toast.success("Focus session complete. Take a break.");
    }
  }, [mode, toast]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setTimerState((prev) => ({
          ...prev,
          seconds: Math.max(0, prev.seconds - 1),
          updatedAt: Date.now(),
        }));
      }, 1000);
    } else if (isActive && seconds === 0) {
      switchMode();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, seconds, switchMode]);

  useEffect(() => {
    saveStudyTimerState(window.localStorage, timerState);
  }, [timerState]);

  const toggleTimer = () => {
    const nextIsActive = !isActive;
    setTimerState((prev) => ({
      ...prev,
      isActive: nextIsActive,
      updatedAt: Date.now(),
    }));

    if (nextIsActive) {
      void requestDesktopNotificationPermission();
    }
  };

  const resetTimer = () => {
    setTimerState({
      ...createDefaultStudyTimerState(Date.now()),
      mode,
      seconds: getTimerDuration(mode),
    });
  };

  return (
    <div className="flex items-center gap-0.5 text-[12px] text-shell-text-secondary">
      <span className="font-mono tabular-nums text-shell-text min-w-[42px]">
        {formatStudyTimerTime(seconds)}
      </span>
      <span className="text-[10px] text-shell-text-muted capitalize">{mode}</span>
      <button
        type="button"
        onClick={toggleTimer}
        className="p-1.5 rounded-md text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
        title={isActive ? "Pause" : "Start"}
      >
        {isActive ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button
        type="button"
        onClick={resetTimer}
        className="p-1.5 rounded-md text-shell-text-muted hover:text-shell-text hover:bg-shell-surface-hover transition-colors cursor-pointer"
        title="Reset"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
}
