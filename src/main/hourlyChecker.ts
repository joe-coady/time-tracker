import { getLastEntry } from './storage';
import { showDialogWindow, sendToDialog } from './windows';

const ONE_HOUR_MS = 60 * 60 * 1000;
let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Check if the current task has been running for more than an hour
 * without an explicit duration set. If so, show the task dialog.
 */
function checkOngoingTask(): void {
  const lastEntry = getLastEntry();

  if (!lastEntry) {
    return; // No tasks
  }

  // Only check if the task has no explicit duration (ongoing)
  if (lastEntry.durationMinutes !== undefined) {
    return; // Task has explicit duration, not ongoing
  }

  const startTime = new Date(lastEntry.startTime).getTime();
  const now = Date.now();
  const elapsedMs = now - startTime;

  if (elapsedMs >= ONE_HOUR_MS) {
    // Task has been running for an hour or more - prompt the user
    showDialogWindow();
    sendToDialog('timer-expired');
  }
}

/**
 * Start the hourly checker that prompts users about long-running tasks.
 */
export function startHourlyChecker(): void {
  if (intervalId !== null) {
    return; // Already running
  }

  // Check every hour
  intervalId = setInterval(checkOngoingTask, ONE_HOUR_MS);
}

/**
 * Stop the hourly checker.
 */
export function stopHourlyChecker(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
