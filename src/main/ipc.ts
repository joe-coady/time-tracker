import { ipcMain, shell } from 'electron';
import * as pty from 'node-pty';
import * as os from 'os';
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
  readKanbanColumns,
  saveKanbanColumns,
  syncKanbanWithJira,
  readTerminalConfig,
  saveTerminalConfig,
  updateTerminalShortcutLastRan,
  readConfigFilesConfig,
  saveConfigFilesConfig,
  resetConfigFilesConfig,
  readConfigFileContent,
  writeConfigFileContent,
  readClaudeConfig,
  saveClaudeConfig,
  readGoogleCalendarConfig,
  saveGoogleCalendarConfig,
  readScriptConfig,
  saveScriptConfig,
  readKanbanScripts,
  saveKanbanScripts,
} from './storage';
import { startTimer, getElapsedMinutes } from './timer';
import * as fs from 'fs';
import * as path from 'path';
import { searchJiraIssues, testJiraConnection, fetchJiraTicketStatuses, fetchAssignedJiraTickets, fetchJiraProjects, fetchJiraVersions, fetchReleaseTickets, fetchJiraTicketMarkdown } from './jira';
import { testGitHubConnection, fetchGitHubPRs, fetchDevBranchTickets } from './github';
import { reregisterShortcuts } from './globalShortcut';
import { closeDialogWindow, closeQuickLaunchWindow, showDialogWindow, showEditWindow, showNotesWindow, showNotebookWindow, showGitHubPRsWindow, showExportWindow, showSettingsWindow, showKanbanWindow, showTerminalLauncherWindow, closeTerminalLauncherWindow, showConfigFilesWindow, showChatWindow, getChatWindow, showTodayWindow, showReleaseWindow, createTerminalExecWindow, getTerminalExecWindow, cleanupTerminalExecWindow } from './windows';
import { updateTrayMenu } from './tray';
import { TaskEntry, CalculatedTaskEntry, CurrentState, TaskType, DailyNote, Note, QuickLinkRule, JiraConfig, JiraProject, JiraSearchResult, JiraTicketStatus, JiraVersion, GitHubConfig, GitHubPR, HotkeyConfig, KanbanBoard, KanbanTask, KanbanColumnConfig, TerminalConfig, ConfigFilesConfig, ClaudeConfig, ChatMessage, GoogleCalendarConfig, GoogleCalendarListItem, CalendarEvent, TodayData, ReleaseData, ScriptConfig, KanbanScript } from '../shared/types';
import { calculateDurations } from '../shared/durationUtils';
import { handleChatMessage, clearChatHistory, getChatHistory } from './chatHandler';
import { fetchTodayCalendarEvents, testCalendarUrl, startOAuthFlow, signOut, listGoogleCalendars, selectCalendars } from './googleCalendar';

const activePtys = new Map<string, pty.IPty>();

export function killTerminalProcess(execId: string): void {
  const p = activePtys.get(execId);
  if (p) {
    p.kill();
    activePtys.delete(execId);
  }
}

export function killAllTerminalProcesses(): void {
  for (const [id, p] of activePtys) {
    p.kill();
    activePtys.delete(id);
  }
}

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

  ipcMain.handle('sync-kanban-with-jira', async (_event, date: string): Promise<{ imported: number; updated: number }> => {
    return syncKanbanWithJira(date, fetchJiraTicketStatuses, fetchAssignedJiraTickets);
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

  // Kanban column config handlers
  ipcMain.handle('get-kanban-columns', async (): Promise<KanbanColumnConfig[]> => {
    return readKanbanColumns();
  });

  ipcMain.handle('save-kanban-columns', async (_event, columns: KanbanColumnConfig[]): Promise<void> => {
    saveKanbanColumns(columns);
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
      'terminal-launcher': showTerminalLauncherWindow,
      'config-files': showConfigFilesWindow,
      'chat': showChatWindow,
      'today': showTodayWindow,
      'release': showReleaseWindow,
    };
    const showFn = viewMap[view];
    if (showFn) showFn();
  });

  // Terminal launcher handlers
  ipcMain.handle('get-terminal-config', async (): Promise<TerminalConfig | null> => {
    return readTerminalConfig();
  });

  ipcMain.handle('save-terminal-config', async (_event, config: TerminalConfig): Promise<void> => {
    saveTerminalConfig(config);
  });

  ipcMain.handle('run-terminal-shortcut', async (_event, id: string): Promise<void> => {
    const config = readTerminalConfig();
    if (!config) return;
    const shortcut = config.shortcuts.find(s => s.id === id);
    if (!shortcut) return;

    updateTerminalShortcutLastRan(id);

    const expandedDir = shortcut.directory.replace(/^~(?=\/|$)/, os.homedir());
    const command = shortcut.command || 'ls -la';

    const execId = uuidv4();
    const win = createTerminalExecWindow(execId, shortcut.name);

    closeTerminalLauncherWindow();

    ipcMain.once(`terminal-ready-${execId}`, () => {
      const ptyProcess = pty.spawn('/bin/zsh', ['-il', '-c', command], {
        cwd: expandedDir,
        cols: 80,
        rows: 24,
      });
      activePtys.set(execId, ptyProcess);

      ptyProcess.onData((data: string) => {
        if (!win.isDestroyed()) {
          win.webContents.send(`terminal-output-${execId}`, data);
        }
      });

      ptyProcess.onExit(({ exitCode }) => {
        if (!win.isDestroyed()) {
          win.webContents.send(`terminal-exit-${execId}`, exitCode);
        }
        activePtys.delete(execId);
      });
    });
  });

  ipcMain.on('resize-terminal', (_event, execId: string, cols: number, rows: number) => {
    const p = activePtys.get(execId);
    if (p) p.resize(cols, rows);
  });

  ipcMain.handle('close-terminal-launcher', async (): Promise<void> => {
    closeTerminalLauncherWindow();
  });

  ipcMain.handle('close-terminal-exec', async (_event, execId: string): Promise<void> => {
    killTerminalProcess(execId);
    cleanupTerminalExecWindow(execId);
  });

  // Config Files handlers
  ipcMain.handle('get-config-files-config', async (): Promise<ConfigFilesConfig> => {
    return readConfigFilesConfig();
  });

  ipcMain.handle('save-config-files-config', async (_event, config: ConfigFilesConfig): Promise<void> => {
    saveConfigFilesConfig(config);
  });

  ipcMain.handle('reset-config-files-config', async (): Promise<ConfigFilesConfig> => {
    return resetConfigFilesConfig();
  });

  ipcMain.handle('read-config-file-content', async (_event, filePath: string): Promise<string> => {
    return readConfigFileContent(filePath);
  });

  ipcMain.handle('write-config-file-content', async (_event, filePath: string, content: string): Promise<void> => {
    writeConfigFileContent(filePath, content);
  });

  // Claude config handlers
  ipcMain.handle('get-claude-config', async (): Promise<ClaudeConfig | null> => {
    return readClaudeConfig();
  });

  ipcMain.handle('save-claude-config', async (_event, config: ClaudeConfig): Promise<void> => {
    saveClaudeConfig(config);
  });

  // Chat handlers
  ipcMain.handle('chat-send-message', async (_event, message: string): Promise<void> => {
    const win = getChatWindow();
    await handleChatMessage(message, win);
  });

  ipcMain.handle('chat-clear-history', async (): Promise<void> => {
    clearChatHistory();
  });

  ipcMain.handle('chat-get-history', async (): Promise<ChatMessage[]> => {
    return getChatHistory();
  });

  // Google Calendar handlers
  ipcMain.handle('get-google-calendar-config', async (): Promise<GoogleCalendarConfig | null> => {
    return readGoogleCalendarConfig();
  });

  ipcMain.handle('save-google-calendar-config', async (_event, config: GoogleCalendarConfig): Promise<void> => {
    saveGoogleCalendarConfig(config);
  });

  ipcMain.handle('fetch-calendar-events', async (): Promise<CalendarEvent[]> => {
    return fetchTodayCalendarEvents();
  });

  ipcMain.handle('test-calendar-url', async (_event, url: string): Promise<{ ok: boolean; error?: string; resolvedUrl?: string }> => {
    return testCalendarUrl(url);
  });

  ipcMain.handle('google-oauth-sign-in', async (_event, clientId: string, clientSecret: string): Promise<{ email: string }> => {
    return startOAuthFlow(clientId, clientSecret);
  });

  ipcMain.handle('google-oauth-sign-out', async (): Promise<void> => {
    return signOut();
  });

  ipcMain.handle('google-list-calendars', async (): Promise<GoogleCalendarListItem[]> => {
    return listGoogleCalendars();
  });

  ipcMain.handle('google-select-calendars', async (_event, calendarIds: string[]): Promise<void> => {
    return selectCalendars(calendarIds);
  });

  // Release view handlers
  ipcMain.handle('fetch-jira-projects', async (): Promise<JiraProject[]> => {
    return fetchJiraProjects();
  });

  ipcMain.handle('fetch-jira-versions', async (_event, projectKey: string): Promise<JiraVersion[]> => {
    return fetchJiraVersions(projectKey);
  });

  ipcMain.handle('get-release-data', async (_event, projectKey: string, versionName: string): Promise<ReleaseData> => {
    const tickets = await fetchReleaseTickets(projectKey, versionName);

    let prs: GitHubPR[] = [];
    let devBranchTickets: string[] = [];

    try {
      const ghConfig = readGitHubConfig();
      if (ghConfig?.token) {
        prs = await fetchGitHubPRs();

        if (ghConfig.devBranch && prs.length > 0) {
          try {
            const repos = Array.from(new Set(prs.map(pr => pr.repoFullName)));
            devBranchTickets = await fetchDevBranchTickets(repos);
          } catch {
            // Dev branch fetch failed
          }
        }
      }
    } catch {
      // GitHub fetch failed
    }

    return { tickets, prs, devBranchTickets };
  });

  // Script config handlers
  ipcMain.handle('get-script-config', async (): Promise<ScriptConfig | null> => {
    return readScriptConfig();
  });

  ipcMain.handle('save-script-config', async (_event, config: ScriptConfig): Promise<void> => {
    saveScriptConfig(config);
  });

  ipcMain.handle('run-ticket-script', async (_event, ticketId: string, body: string, isJira?: boolean, scriptPath?: string, scriptDir?: string): Promise<void> => {
    let resolvedPath = scriptPath;
    let resolvedDir = scriptDir;

    if (!resolvedPath) {
      const config = readScriptConfig();
      if (!config?.scriptPath) return;
      resolvedPath = config.scriptPath;
      resolvedDir = config.scriptDir;
    }

    const expandedDir = resolvedDir?.replace(/^~(?=\/|$)/, os.homedir()) || os.homedir();
    const expandedCommand = resolvedPath!.replace(/^~(?=\/|$)/, os.homedir());

    let scriptArgs: string;
    let tempFilePath: string | null = null;

    if (isJira) {
      const markdown = await fetchJiraTicketMarkdown(ticketId);
      tempFilePath = path.join('/tmp', `jira-ticket-${ticketId}-${Date.now()}.md`);
      fs.writeFileSync(tempFilePath, markdown, 'utf-8');
      scriptArgs = `${JSON.stringify(ticketId)} ${JSON.stringify(tempFilePath)}`;
    } else {
      scriptArgs = `${JSON.stringify(ticketId)} ${JSON.stringify(body)}`;
    }

    const execId = uuidv4();
    const win = createTerminalExecWindow(execId, ticketId);

    ipcMain.once(`terminal-ready-${execId}`, () => {
      const ptyProcess = pty.spawn('/bin/zsh', ['-il', '-c', `${expandedCommand} ${scriptArgs}`], {
        cwd: expandedDir,
        cols: 80,
        rows: 24,
      });
      activePtys.set(execId, ptyProcess);

      ptyProcess.onData((data: string) => {
        if (!win.isDestroyed()) {
          win.webContents.send(`terminal-output-${execId}`, data);
        }
      });

      ptyProcess.onExit(({ exitCode }) => {
        if (!win.isDestroyed()) {
          win.webContents.send(`terminal-exit-${execId}`, exitCode);
        }
        activePtys.delete(execId);
        // Clean up temp file
        if (tempFilePath) {
          try { fs.unlinkSync(tempFilePath); } catch { /* ignore */ }
        }
      });
    });
  });

  // Kanban scripts handlers
  ipcMain.handle('get-kanban-scripts', async (): Promise<KanbanScript[]> => {
    return readKanbanScripts();
  });

  ipcMain.handle('save-kanban-scripts', async (_event, scripts: KanbanScript[]): Promise<void> => {
    saveKanbanScripts(scripts);
  });

  ipcMain.handle('get-today-data', async (): Promise<TodayData> => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Get kanban board for today
    const board = getKanbanBoardForDate(todayStr);
    const columns = readKanbanColumns();

    // Build hidden→visible column mapping
    const hiddenMap = new Map<string, string>();
    for (const col of columns) {
      if (col.hidden && col.mappedTo) {
        hiddenMap.set(col.name, col.mappedTo);
      }
    }

    // Resolve a task's status to the visible column it belongs to,
    // then check columnType on that visible column
    const columnByName = new Map(columns.map(c => [c.name, c]));

    function resolveColumnType(status: string): string | undefined {
      // Check if status matches a column name directly
      const direct = columnByName.get(status);
      if (direct) {
        const resolved = direct.hidden && direct.mappedTo ? columnByName.get(direct.mappedTo) : direct;
        return resolved?.columnType;
      }
      // Check if status is a jiraStatus mapped to a column
      for (const col of columns) {
        if (col.jiraStatuses?.some(s => s.toLowerCase() === status.toLowerCase())) {
          const resolved = col.hidden && col.mappedTo ? columnByName.get(col.mappedTo) : col;
          return resolved?.columnType;
        }
      }
      return undefined;
    }

    const tasks = board?.tasks || [];
    const workingTasks = tasks.filter(t => resolveColumnType(t.Status) === 'working');
    const todoTasks = tasks.filter(t => resolveColumnType(t.Status) === 'todo');

    let meetings: CalendarEvent[] = [];
    try {
      meetings = await fetchTodayCalendarEvents();
    } catch {
      // Calendar fetch failed — return empty meetings
    }

    // Fetch GitHub PRs for the current user
    let myPRs: GitHubPR[] = [];
    let assignedPRs: GitHubPR[] = [];
    let jiraTicketStatuses: JiraTicketStatus[] = [];
    let devBranchTickets: string[] = [];
    let githubUsername: string | null = null;

    try {
      const ghConfig = readGitHubConfig();
      if (ghConfig?.token) {
        const allPRs = await fetchGitHubPRs();
        const username = ghConfig.username?.toLowerCase();
        githubUsername = username ?? null;
        myPRs = username
          ? allPRs.filter(pr => pr.author.toLowerCase() === username)
          : allPRs;
        assignedPRs = username
          ? allPRs.filter(pr =>
              pr.author.toLowerCase() !== username &&
              pr.requestedReviewers.some(r => r.toLowerCase() === username)
            )
          : [];

        const allRelevantPRs = [...myPRs, ...assignedPRs];

        // Fetch Jira ticket statuses for ticket keys in PR titles
        const jiraConfig = readJiraConfig();
        if (jiraConfig?.ticketPattern && allRelevantPRs.length > 0) {
          try {
            const regex = new RegExp(jiraConfig.ticketPattern, 'g');
            const keys = new Set<string>();
            for (const pr of allRelevantPRs) {
              for (const match of pr.title.matchAll(regex)) {
                keys.add(match[0]);
              }
            }
            if (keys.size > 0) {
              jiraTicketStatuses = await fetchJiraTicketStatuses(Array.from(keys));
            }
          } catch {
            // Jira fetch failed — leave empty
          }
        }

        // Fetch dev branch tickets
        if (ghConfig.devBranch && allRelevantPRs.length > 0) {
          try {
            const repos = Array.from(new Set(allRelevantPRs.map(pr => pr.repoFullName)));
            devBranchTickets = await fetchDevBranchTickets(repos);
          } catch {
            // Dev branch fetch failed — leave empty
          }
        }
      }
    } catch {
      // GitHub fetch failed — leave empty
    }

    return { workingTasks, todoTasks, meetings, myPRs, assignedPRs, jiraTicketStatuses, devBranchTickets, githubUsername };
  });
}
