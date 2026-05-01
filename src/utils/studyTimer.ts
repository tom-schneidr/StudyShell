import { STORAGE_KEYS } from "./appPreferences.ts";

export type TimerMode = "work" | "break";

export interface StudyTimerState {
  mode: TimerMode;
  seconds: number;
  isActive: boolean;
  updatedAt: number;
}

export const WORK_DURATION_SECONDS = 25 * 60;
export const BREAK_DURATION_SECONDS = 5 * 60;

export function getTimerDuration(mode: TimerMode): number {
  return mode === "work" ? WORK_DURATION_SECONDS : BREAK_DURATION_SECONDS;
}

export function getNextTimerMode(mode: TimerMode): TimerMode {
  return mode === "work" ? "break" : "work";
}

export function createDefaultStudyTimerState(now = Date.now()): StudyTimerState {
  return {
    mode: "work",
    seconds: WORK_DURATION_SECONDS,
    isActive: false,
    updatedAt: now,
  };
}

export function clampTimerSeconds(seconds: number, mode: TimerMode): number {
  if (!Number.isFinite(seconds)) {
    return getTimerDuration(mode);
  }

  return Math.min(getTimerDuration(mode), Math.max(0, Math.round(seconds)));
}

export function serializeStudyTimerState(state: StudyTimerState): string {
  return JSON.stringify({
    mode: state.mode,
    seconds: clampTimerSeconds(state.seconds, state.mode),
    isActive: state.isActive,
    updatedAt: Number.isFinite(state.updatedAt) ? state.updatedAt : Date.now(),
  });
}

export function deserializeStudyTimerState(
  raw: string | null | undefined,
  now = Date.now(),
): StudyTimerState {
  if (!raw) {
    return createDefaultStudyTimerState(now);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StudyTimerState> | null;
    const mode: TimerMode = parsed?.mode === "break" ? "break" : "work";
    const baseState: StudyTimerState = {
      mode,
      seconds: clampTimerSeconds(parsed?.seconds ?? getTimerDuration(mode), mode),
      isActive: parsed?.isActive === true,
      updatedAt: Number.isFinite(parsed?.updatedAt) ? Number(parsed?.updatedAt) : now,
    };

    if (!baseState.isActive) {
      return baseState;
    }

    const elapsedSeconds = Math.max(0, Math.floor((now - baseState.updatedAt) / 1000));
    if (elapsedSeconds >= baseState.seconds) {
      const nextMode = getNextTimerMode(baseState.mode);
      return {
        mode: nextMode,
        seconds: getTimerDuration(nextMode),
        isActive: false,
        updatedAt: now,
      };
    }

    return {
      ...baseState,
      seconds: baseState.seconds - elapsedSeconds,
      updatedAt: now,
    };
  } catch {
    return createDefaultStudyTimerState(now);
  }
}

export function saveStudyTimerState(storage: Pick<Storage, "setItem">, state: StudyTimerState): void {
  storage.setItem(STORAGE_KEYS.studyTimer, serializeStudyTimerState(state));
}

export function readStudyTimerState(
  storage: Pick<Storage, "getItem">,
  now = Date.now(),
): StudyTimerState {
  return deserializeStudyTimerState(storage.getItem(STORAGE_KEYS.studyTimer), now);
}

export function formatStudyTimerTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getStudyTimerProgress(mode: TimerMode, seconds: number): number {
  const duration = getTimerDuration(mode);
  return 1 - clampTimerSeconds(seconds, mode) / duration;
}

export function canShowDesktopNotification(): boolean {
  return typeof Notification !== "undefined";
}

export async function requestDesktopNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!canShowDesktopNotification()) {
    return "unsupported";
  }

  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }

  return Notification.requestPermission();
}

export function sendStudyTimerNotification(mode: TimerMode): void {
  if (!canShowDesktopNotification() || Notification.permission !== "granted") {
    return;
  }

  const nextMode = getNextTimerMode(mode);
  const title = mode === "work" ? "Work session complete" : "Break finished";
  const body =
    nextMode === "work"
      ? "Time to focus again in StudyShell."
      : "Take a quick break before the next study session.";

  new Notification(title, { body });
}
