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
  readJiraConfig,
  saveJiraConfig,
  readGitHubConfig,
  saveGitHubConfig,
  readHotkeyConfig,
  saveHotkeyConfig,
  getKanbanBoardForDate,
  getAllKanbanDates,
  addKanbanTask,
  updateKanbanTask,
  deleteKanbanTask,
  reorderKanbanTasks,
} from './storage';
import { startTimer, getElapsedMinutes } from './timer';
import { searchJiraIssues, testJiraConnection, fetchJiraTicketStatuses } from './jira';
import { testGitHubConnection, fetchGitHubPRs, fetchDevBranchTickets } from './github';
import { reregisterShortcuts } from './globalShortcut';
import { closeDialogWindow, closeQuickLaunchWindow, showDialogWindow, showEditWindow, showNotesWindow, showNotebookWindow, showGitHubPRsWindow, showExportWindow, showSettingsWindow, showKanbanWindow } from './windows';
import { updateTrayMenu } from './tray';
import { TaskEntry, CalculatedTaskEntry, CurrentState, TaskType, DailyNote, Note, QuickLinkRule, JiraConfig, JiraSearchResult, JiraTicketStatus, GitHubConfig, GitHubPR, HotkeyConfig, KanbanBoard, KanbanTask } from '../shared/types';
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
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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

  // Jira handlers
  ipcMain.handle('get-jira-config', async (): Promise<JiraConfig | null> => {
    return readJiraConfig();
  });

  ipcMain.handle('save-jira-config', async (_event, config: JiraConfig): Promise<void> => {
    saveJiraConfig(config);
  });

  ipcMain.handle('search-jira', async (_event, query: string): Promise<JiraSearchResult[]> => {
    return searchJiraIssues(query);
  });

  ipcMain.handle('test-jira-connection', async (_event, config: JiraConfig): Promise<boolean> => {
    return testJiraConnection(config);
  });

  ipcMain.handle('fetch-jira-ticket-statuses', async (_event, keys: string[]): Promise<JiraTicketStatus[]> => {
    return fetchJiraTicketStatuses(keys);
  });

  // GitHub handlers
  ipcMain.handle('get-github-config', async (): Promise<GitHubConfig | null> => {
    return readGitHubConfig();
  });

  ipcMain.handle('save-github-config', async (_event, config: GitHubConfig): Promise<void> => {
    saveGitHubConfig(config);
  });

  ipcMain.handle('test-github-connection', async (_event, config: GitHubConfig): Promise<string | null> => {
    return testGitHubConnection(config);
  });

  ipcMain.handle('fetch-github-prs', async (): Promise<GitHubPR[]> => {
    return fetchGitHubPRs();
  });

  ipcMain.handle('fetch-dev-branch-tickets', async (_event, repos: string[]): Promise<string[]> => {
    return fetchDevBranchTickets(repos);
  });

  // Hotkey handlers
  ipcMain.handle('get-hotkey-config', async (): Promise<HotkeyConfig | null> => {
    return readHotkeyConfig();
  });

  ipcMain.handle('save-hotkey-config', async (_event, config: HotkeyConfig): Promise<void> => {
    saveHotkeyConfig(config);
    reregisterShortcuts();
  });

  // Quick Launch handlers
  ipcMain.handle('close-quick-launch', async (): Promise<void> => {
    closeQuickLaunchWindow();
  });

  // Kanban handlers
  ipcMain.handle('get-kanban-board', async (_event, date: string): Promise<KanbanBoard | null> => {
    return getKanbanBoardForDate(date);
  });

  ipcMain.handle('get-all-kanban-dates', async (): Promise<string[]> => {
    return getAllKanbanDates();
  });

  ipcMain.handle('add-kanban-task', async (_event, date: string, title: string, description: string): Promise<KanbanTask> => {
    return addKanbanTask(date, title, description);
  });

  ipcMain.handle('update-kanban-task', async (_event, date: string, taskId: string, updates: Partial<Pick<KanbanTask, 'Title' | 'Description' | 'Status'>>): Promise<void> => {
    updateKanbanTask(date, taskId, updates);
  });

  ipcMain.handle('delete-kanban-task', async (_event, date: string, taskId: string): Promise<void> => {
    deleteKanbanTask(date, taskId);
  });

  ipcMain.handle('reorder-kanban-tasks', async (_event, date: string, tasks: KanbanTask[]): Promise<void> => {
    reorderKanbanTasks(date, tasks);
  });

  ipcMain.handle('open-view', async (_event, view: string): Promise<void> => {
    const viewMap: Record<string, () => void> = {
      'dialog': showDialogWindow,
      'edit': showEditWindow,
      'notes': showNotesWindow,
      'notebook': showNotebookWindow,
      'github-prs': showGitHubPRsWindow,
      'export': showExportWindow,
      'settings': showSettingsWindow,
      'task-types': showSettingsWindow,
      'kanban': showKanbanWindow,
    };
    const showFn = viewMap[view];
    if (showFn) showFn();
  });
}
