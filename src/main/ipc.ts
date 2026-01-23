import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import {
  readTasks,
  getPreviousTaskNames,
  addTaskEntry,
  updateTaskEntry,
  deleteTaskEntry,
  readAppState,
  writeAppState,
} from './storage';
import { startTimer, getRemainingMinutes, getElapsedMinutes } from './timer';
import { closeDialogWindow } from './windows';
import { updateTrayMenu } from './tray';
import { TaskEntry, CalculatedTaskEntry, CurrentState } from '../shared/types';
import { calculateDurations } from '../shared/durationUtils';

export function setupIpcHandlers(): void {
  ipcMain.handle('get-tasks', async (): Promise<CalculatedTaskEntry[]> => {
    const tasks = readTasks();
    return calculateDurations(tasks);
  });

  ipcMain.handle('get-previous-task-names', async () => {
    return getPreviousTaskNames();
  });

  ipcMain.handle('start-task', async (_event, taskName: string, durationMinutes: number): Promise<void> => {
    const now = new Date();

    // Create new entry for the task (no explicit duration - will be calculated)
    const newEntry: TaskEntry = {
      id: uuidv4(),
      task: taskName,
      startTime: now.toISOString(),
      // No durationMinutes - will be calculated dynamically
    };
    addTaskEntry(newEntry);

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

  ipcMain.handle('set-explicit-duration', async (_event, id: string, durationMinutes: number): Promise<void> => {
    updateTaskEntry(id, { durationMinutes });
  });

  ipcMain.handle('clear-explicit-duration', async (_event, id: string): Promise<void> => {
    // Remove the explicit duration by setting it to undefined
    updateTaskEntry(id, { durationMinutes: undefined });
  });
}
