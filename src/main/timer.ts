import { readAppState, writeAppState } from './storage';

let currentTimer: NodeJS.Timeout | null = null;
let timerExpiryCallback: (() => void) | null = null;

export function setTimerExpiryCallback(callback: () => void): void {
  timerExpiryCallback = callback;
}

export function startTimer(durationMinutes: number): void {
  clearTimer();

  const endTime = new Date(Date.now() + durationMinutes * 60 * 1000);
  const state = readAppState();
  state.timerEndTime = endTime.toISOString();
  writeAppState(state);

  currentTimer = setTimeout(() => {
    if (timerExpiryCallback) {
      timerExpiryCallback();
    }
  }, durationMinutes * 60 * 1000);
}

export function clearTimer(): void {
  if (currentTimer) {
    clearTimeout(currentTimer);
    currentTimer = null;
  }
}

export function getRemainingMinutes(): number | null {
  const state = readAppState();
  if (!state.timerEndTime) return null;

  const endTime = new Date(state.timerEndTime);
  const remaining = (endTime.getTime() - Date.now()) / (60 * 1000);
  return Math.max(0, Math.round(remaining));
}

export function getElapsedMinutes(): number | null {
  const state = readAppState();
  if (!state.currentTaskStartTime) return null;

  const startTime = new Date(state.currentTaskStartTime);
  const elapsed = (Date.now() - startTime.getTime()) / (60 * 1000);
  return Math.round(elapsed);
}

export function restoreTimerFromState(): void {
  const state = readAppState();
  if (!state.timerEndTime) return;

  const endTime = new Date(state.timerEndTime);
  const remaining = endTime.getTime() - Date.now();

  if (remaining > 0) {
    currentTimer = setTimeout(() => {
      if (timerExpiryCallback) {
        timerExpiryCallback();
      }
    }, remaining);
  } else if (timerExpiryCallback) {
    // Timer already expired while app was closed
    timerExpiryCallback();
  }
}
