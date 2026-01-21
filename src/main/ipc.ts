import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import {
  readTasks,
  getPreviousTaskNames,
  addTaskEntry,
  updateTaskEntry,
  deleteTaskEntry,
  getLastEntry,
  readAppState,
  writeAppState,
} from './storage';
import { startTimer, getRemainingMinutes, getElapsedMinutes } from './timer';
import { closeDialogWindow } from './windows';
import { updateTrayMenu } from './tray';
import { TaskEntry, CurrentState } from '../shared/types';

export function setupIpcHandlers(): void {
  ipcMain.handle('get-tasks', async (): Promise<TaskEntry[]> => {
    return readTasks();
  });

  ipcMain.handle('get-previous-task-names', async () => {
    return getPreviousTaskNames();
  });

  ipcMain.handle('start-task', async (_event, taskName: string, durationMinutes: number): Promise<void> => {
    const state = readAppState();
    const lastEntry = getLastEntry();
    const now = new Date();
    const MIN_DURATION = 5; // Minimum 5 minutes per entry for rapid task creation

    // Calculate elapsed time for the previous task
    if (state.currentTask && state.currentTaskStartTime && lastEntry) {
      const startTime = new Date(state.currentTaskStartTime);
      const elapsedMinutes = Math.round((now.getTime() - startTime.getTime()) / (60 * 1000));
      const recordedMinutes = Math.max(MIN_DURATION, elapsedMinutes);

      if (taskName === state.currentTask) {
        // Same task - merge: add elapsed time to last entry
        updateTaskEntry(lastEntry.id, {
          durationMinutes: lastEntry.durationMinutes + recordedMinutes,
        });
      } else {
        // Different task - update last entry's duration (min 5 minutes)
        updateTaskEntry(lastEntry.id, {
          durationMinutes: recordedMinutes,
        });

        // Create new entry for the new task
        const newEntry: TaskEntry = {
          id: uuidv4(),
          task: taskName,
          startTime: now.toISOString(),
          durationMinutes: durationMinutes, // Planned duration (will be updated when task ends)
        };
        addTaskEntry(newEntry);
      }
    } else {
      // No current task - create new entry
      const newEntry: TaskEntry = {
        id: uuidv4(),
        task: taskName,
        startTime: now.toISOString(),
        durationMinutes: durationMinutes,
      };
      addTaskEntry(newEntry);
    }

    // Update app state
    writeAppState({
      currentTask: taskName,
      currentTaskStartTime: now.toISOString(),
      plannedDurationMinutes: durationMinutes,
      timerEndTime: new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString(),
    });

    // Start the timer
    startTimer(durationMinutes);

    // Update tray menu to show current task
    updateTrayMenu();

    // Close the dialog
    closeDialogWindow();
  });

  ipcMain.handle(
    'update-entry',
    async (_event, id: string, updates: Partial<Pick<TaskEntry, 'task' | 'durationMinutes' | 'notes' | 'completed'>>): Promise<void> => {
      updateTaskEntry(id, updates);
    }
  );

  ipcMain.handle('delete-entry', async (_event, id: string): Promise<void> => {
    deleteTaskEntry(id);
  });

  ipcMain.handle('get-current-state', async (): Promise<CurrentState> => {
    const state = readAppState();
    return {
      currentTask: state.currentTask,
      remainingMinutes: getRemainingMinutes(),
      elapsedMinutes: getElapsedMinutes(),
    };
  });

  ipcMain.handle('close-dialog', async (): Promise<void> => {
    closeDialogWindow();
  });
}
