let currentTimer: NodeJS.Timeout | null = null;
let timerExpiryCallback: (() => void) | null = null;
let timerStartTime: number | null = null;

export function setTimerExpiryCallback(callback: () => void): void {
  timerExpiryCallback = callback;
}

export function startTimer(durationMinutes: number): void {
  clearTimer();

  timerStartTime = Date.now();

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
  timerStartTime = null;
}

export function getElapsedMinutes(): number | null {
  if (!timerStartTime) return null;
  const elapsed = (Date.now() - timerStartTime) / (60 * 1000);
  return Math.round(elapsed);
}
