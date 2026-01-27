import { TaskEntry, CalculatedTaskEntry } from './types';

/**
 * Calculate durations for tasks based on start times.
 * Tasks must be sorted by startTime (ascending) before calling.
 *
 * Duration logic:
 * - If task has explicit durationMinutes, use it
 * - Otherwise, calculate as (nextTask.startTime - thisTask.startTime)
 * - Last task without explicit duration → null (ongoing)
 */
export function calculateDurations(tasks: TaskEntry[]): CalculatedTaskEntry[] {
  // Sort by startTime ascending
  const sorted = [...tasks].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return sorted.map((task, index) => {
    const isLast = index === sorted.length - 1;
    const hasExplicitDuration = task.durationMinutes !== undefined;

    let calculatedDurationMinutes: number | null;

    if (hasExplicitDuration) {
      calculatedDurationMinutes = task.durationMinutes!;
    } else if (isLast) {
      // Ongoing task
      calculatedDurationMinutes = null;
    } else {
      // Calculate to next task's start time
      const nextTask = sorted[index + 1];
      const startTime = new Date(task.startTime).getTime();
      const nextStartTime = new Date(nextTask.startTime).getTime();
      calculatedDurationMinutes = Math.round((nextStartTime - startTime) / (60 * 1000));
    }

    return {
      ...task,
      calculatedDurationMinutes,
      isExplicitDuration: hasExplicitDuration,
    };
  });
}

/**
 * Format duration in minutes to a human-readable string.
 * Returns "∞" for null (ongoing tasks).
 */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) {
    return '∞';
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins}m`;
}

/**
 * Calculate total minutes from calculated task entries.
 * Excludes ongoing tasks (null duration).
 */
export function calculateTotalMinutes(entries: CalculatedTaskEntry[]): number {
  return entries.reduce((sum, entry) => {
    if (entry.calculatedDurationMinutes === null) {
      return sum;
    }
    return sum + entry.calculatedDurationMinutes;
  }, 0);
}
