import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import {
  readTasks,
  getPreviousTaskNames,
  addTaskEntry,
  updateTaskEntry,
  deleteTaskEntry,
  getLastEntry,
} from './storage';
import { startTimer, getElapsedMinutes } from './timer';
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
    const lastEntry = getLastEntry();

    // If same task as current, just restart timer (continue working)
    if (lastEntry && lastEntry.task === taskName) {
      startTimer(durationMinutes);
      closeDialogWindow();
      return;
    }

    // Different task - create new entry
    const now = new Date();
    const newEntry: TaskEntry = {
      id: uuidv4(),
      task: taskName,
      startTime: now.toISOString(),
    };
    addTaskEntry(newEntry);

    // Start the in-memory timer
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
    const lastEntry = getLastEntry();
    return {
      currentTask: lastEntry?.task ?? null,
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
