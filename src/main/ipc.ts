import { ipcMain, shell } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import {
  readTasks,
  getPreviousTaskNames,
  addTaskEntry,
  updateTaskEntry,
  deleteTaskEntry,
  getLastEntry,
  readTaskTypes,
  addTaskType,
  updateTaskType,
  deleteTaskType,
  getExportFilterTagIds,
  setExportFilterTagIds,
  getDailyNoteForDate,
  upsertDailyNote,
  getAllNoteDates,
  readNotebookNotes,
  createNotebookNote,
  updateNotebookNote,
  deleteNotebookNote,
  togglePinNotebookNote,
  readQuickLinkRules,
  addQuickLinkRule,
  deleteQuickLinkRule,
} from './storage';
import { startTimer, getElapsedMinutes } from './timer';
import { closeDialogWindow } from './windows';
import { updateTrayMenu } from './tray';
import { TaskEntry, CalculatedTaskEntry, CurrentState, TaskType, DailyNote, Note, QuickLinkRule } from '../shared/types';
import { calculateDurations } from '../shared/durationUtils';

export function setupIpcHandlers(): void {
  ipcMain.handle('get-tasks', async (): Promise<CalculatedTaskEntry[]> => {
    const tasks = readTasks();
    return calculateDurations(tasks);
  });

  ipcMain.handle('get-previous-task-names', async () => {
    return getPreviousTaskNames();
  });

  ipcMain.handle('start-task', async (_event, taskName: string, durationMinutes: number, taskTypeIds?: string[], notes?: string): Promise<void> => {
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
      taskTypeIds: taskTypeIds?.length ? taskTypeIds : undefined,
      notes: notes?.trim() || undefined,
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
    async (_event, id: string, updates: Partial<Pick<TaskEntry, 'task' | 'startTime' | 'durationMinutes' | 'notes' | 'completed' | 'taskTypeIds'>>): Promise<void> => {
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

  // Task Types handlers
  ipcMain.handle('get-task-types', async (): Promise<TaskType[]> => {
    return readTaskTypes();
  });

  ipcMain.handle('add-task-type', async (_event, name: string): Promise<TaskType> => {
    return addTaskType(name);
  });

  ipcMain.handle('update-task-type', async (_event, id: string, name: string): Promise<void> => {
    updateTaskType(id, name);
  });

  ipcMain.handle('delete-task-type', async (_event, id: string): Promise<void> => {
    deleteTaskType(id);
  });

  // Export filter handlers
  ipcMain.handle('get-export-filter-tag-ids', async (): Promise<string[]> => {
    return getExportFilterTagIds();
  });

  ipcMain.handle('set-export-filter-tag-ids', async (_event, tagIds: string[]): Promise<void> => {
    setExportFilterTagIds(tagIds);
  });

  // Daily Notes handlers
  ipcMain.handle('get-daily-note', async (_event, date: string): Promise<DailyNote | null> => {
    return getDailyNoteForDate(date);
  });

  ipcMain.handle('save-daily-note', async (_event, content: string): Promise<DailyNote> => {
    // Only allow saving today's note
    const today = new Date().toISOString().split('T')[0];
    return upsertDailyNote(today, content);
  });

  ipcMain.handle('get-all-note-dates', async (): Promise<string[]> => {
    return getAllNoteDates();
  });

  // Notebook Notes handlers
  ipcMain.handle('get-notebook-notes', async (): Promise<Note[]> => {
    return readNotebookNotes();
  });

  ipcMain.handle('create-notebook-note', async (_event, title: string, content: string): Promise<Note> => {
    return createNotebookNote(title, content);
  });

  ipcMain.handle('update-notebook-note', async (_event, id: string, title: string, content: string): Promise<Note> => {
    return updateNotebookNote(id, title, content);
  });

  ipcMain.handle('delete-notebook-note', async (_event, id: string): Promise<void> => {
    deleteNotebookNote(id);
  });

  ipcMain.handle('toggle-pin-notebook-note', async (_event, id: string): Promise<Note> => {
    return togglePinNotebookNote(id);
  });

  ipcMain.handle('open-external', async (_event, url: string): Promise<void> => {
    await shell.openExternal(url);
  });

  // Quick Link Rules handlers
  ipcMain.handle('get-quick-link-rules', async (): Promise<QuickLinkRule[]> => {
    return readQuickLinkRules();
  });

  ipcMain.handle('add-quick-link-rule', async (_event, linkPattern: string, linkTarget: string): Promise<QuickLinkRule> => {
    return addQuickLinkRule(linkPattern, linkTarget);
  });

  ipcMain.handle('delete-quick-link-rule', async (_event, id: string): Promise<void> => {
    deleteQuickLinkRule(id);
  });
}
