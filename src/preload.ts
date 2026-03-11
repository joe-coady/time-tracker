import { contextBridge, ipcRenderer } from 'electron';
import { CalculatedTaskEntry, CurrentState, DailyNote, ElectronAPI, GitHubConfig, GitHubPR, HotkeyConfig, JiraConfig, JiraProject, JiraSearchResult, JiraTicketStatus, JiraVersion, KanbanBoard, KanbanColumnConfig, KanbanTask, Note, PreviousTask, QuickLinkRule, TaskEntry, TaskType, TerminalConfig, ConfigFilesConfig, ClaudeConfig, ChatMessage, GoogleCalendarConfig, GoogleCalendarListItem, CalendarEvent, TodayData, ReleaseData, ScriptConfig } from './shared/types';

const electronAPI: ElectronAPI = {
  getTasks: (): Promise<CalculatedTaskEntry[]> => ipcRenderer.invoke('get-tasks'),

  getPreviousTaskNames: (): Promise<PreviousTask[]> => ipcRenderer.invoke('get-previous-task-names'),

  startTask: (taskName: string, durationMinutes: number, taskTypeIds?: string[], notes?: string): Promise<void> =>
    ipcRenderer.invoke('start-task', taskName, durationMinutes, taskTypeIds, notes),

  updateEntry: (id: string, updates: Partial<Pick<TaskEntry, 'task' | 'startTime' | 'durationMinutes' | 'notes' | 'completed' | 'taskTypeIds'>>): Promise<void> =>
    ipcRenderer.invoke('update-entry', id, updates),

  deleteEntry: (id: string): Promise<void> => ipcRenderer.invoke('delete-entry', id),

  getCurrentState: (): Promise<CurrentState> => ipcRenderer.invoke('get-current-state'),

  closeDialog: (): Promise<void> => ipcRenderer.invoke('close-dialog'),

  setExplicitDuration: (id: string, durationMinutes: number): Promise<void> =>
    ipcRenderer.invoke('set-explicit-duration', id, durationMinutes),

  clearExplicitDuration: (id: string): Promise<void> =>
    ipcRenderer.invoke('clear-explicit-duration', id),

  onTimerExpired: (callback: () => void): void => {
    ipcRenderer.on('timer-expired', callback);
  },

  removeTimerExpiredListener: (): void => {
    ipcRenderer.removeAllListeners('timer-expired');
  },

  getTaskTypes: (): Promise<TaskType[]> => ipcRenderer.invoke('get-task-types'),

  addTaskType: (name: string): Promise<TaskType> => ipcRenderer.invoke('add-task-type', name),

  updateTaskType: (id: string, name: string): Promise<void> =>
    ipcRenderer.invoke('update-task-type', id, name),

  deleteTaskType: (id: string): Promise<void> => ipcRenderer.invoke('delete-task-type', id),

  getExportFilterTagIds: (): Promise<string[]> => ipcRenderer.invoke('get-export-filter-tag-ids'),

  setExportFilterTagIds: (tagIds: string[]): Promise<void> =>
    ipcRenderer.invoke('set-export-filter-tag-ids', tagIds),

  getDailyNote: (date: string): Promise<DailyNote | null> =>
    ipcRenderer.invoke('get-daily-note', date),

  saveDailyNote: (content: string): Promise<DailyNote> =>
    ipcRenderer.invoke('save-daily-note', content),

  getAllNoteDates: (): Promise<string[]> =>
    ipcRenderer.invoke('get-all-note-dates'),

  getNotebookNotes: (): Promise<Note[]> =>
    ipcRenderer.invoke('get-notebook-notes'),

  createNotebookNote: (title: string, content: string): Promise<Note> =>
    ipcRenderer.invoke('create-notebook-note', title, content),

  updateNotebookNote: (id: string, title: string, content: string): Promise<Note> =>
    ipcRenderer.invoke('update-notebook-note', id, title, content),

  deleteNotebookNote: (id: string): Promise<void> =>
    ipcRenderer.invoke('delete-notebook-note', id),

  togglePinNotebookNote: (id: string): Promise<Note> =>
    ipcRenderer.invoke('toggle-pin-notebook-note', id),

  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),

  getQuickLinkRules: (): Promise<QuickLinkRule[]> =>
    ipcRenderer.invoke('get-quick-link-rules'),

  addQuickLinkRule: (linkPattern: string, linkTarget: string): Promise<QuickLinkRule> =>
    ipcRenderer.invoke('add-quick-link-rule', linkPattern, linkTarget),

  deleteQuickLinkRule: (id: string): Promise<void> =>
    ipcRenderer.invoke('delete-quick-link-rule', id),

  getJiraConfig: (): Promise<JiraConfig | null> =>
    ipcRenderer.invoke('get-jira-config'),

  saveJiraConfig: (config: JiraConfig): Promise<void> =>
    ipcRenderer.invoke('save-jira-config', config),

  searchJira: (query: string): Promise<JiraSearchResult[]> =>
    ipcRenderer.invoke('search-jira', query),

  testJiraConnection: (config: JiraConfig): Promise<boolean> =>
    ipcRenderer.invoke('test-jira-connection', config),

  getGitHubConfig: (): Promise<GitHubConfig | null> =>
    ipcRenderer.invoke('get-github-config'),

  saveGitHubConfig: (config: GitHubConfig): Promise<void> =>
    ipcRenderer.invoke('save-github-config', config),

  testGitHubConnection: (config: GitHubConfig): Promise<string | null> =>
    ipcRenderer.invoke('test-github-connection', config),

  fetchGitHubPRs: (): Promise<GitHubPR[]> =>
    ipcRenderer.invoke('fetch-github-prs'),

  fetchJiraTicketStatuses: (keys: string[]): Promise<JiraTicketStatus[]> =>
    ipcRenderer.invoke('fetch-jira-ticket-statuses', keys),

  fetchDevBranchTickets: (repos: string[]): Promise<string[]> =>
    ipcRenderer.invoke('fetch-dev-branch-tickets', repos),

  getHotkeyConfig: (): Promise<HotkeyConfig | null> =>
    ipcRenderer.invoke('get-hotkey-config'),

  saveHotkeyConfig: (config: HotkeyConfig): Promise<void> =>
    ipcRenderer.invoke('save-hotkey-config', config),

  closeQuickLaunch: (): Promise<void> =>
    ipcRenderer.invoke('close-quick-launch'),

  openView: (view: string): Promise<void> =>
    ipcRenderer.invoke('open-view', view),

  getKanbanBoard: (date: string): Promise<KanbanBoard | null> =>
    ipcRenderer.invoke('get-kanban-board', date),

  getAllKanbanDates: (): Promise<string[]> =>
    ipcRenderer.invoke('get-all-kanban-dates'),

  addKanbanTask: (date: string, title: string, description: string): Promise<KanbanTask> =>
    ipcRenderer.invoke('add-kanban-task', date, title, description),

  updateKanbanTask: (date: string, taskId: string, updates: Partial<Pick<KanbanTask, 'Title' | 'Description' | 'Status'>>): Promise<void> =>
    ipcRenderer.invoke('update-kanban-task', date, taskId, updates),

  deleteKanbanTask: (date: string, taskId: string): Promise<void> =>
    ipcRenderer.invoke('delete-kanban-task', date, taskId),

  reorderKanbanTasks: (date: string, tasks: KanbanTask[]): Promise<void> =>
    ipcRenderer.invoke('reorder-kanban-tasks', date, tasks),

  getKanbanColumns: (): Promise<KanbanColumnConfig[]> =>
    ipcRenderer.invoke('get-kanban-columns'),

  saveKanbanColumns: (columns: KanbanColumnConfig[]): Promise<void> =>
    ipcRenderer.invoke('save-kanban-columns', columns),

  syncKanbanWithJira: (date: string): Promise<{ imported: number; updated: number }> =>
    ipcRenderer.invoke('sync-kanban-with-jira', date),

  getTerminalConfig: (): Promise<TerminalConfig | null> =>
    ipcRenderer.invoke('get-terminal-config'),

  saveTerminalConfig: (config: TerminalConfig): Promise<void> =>
    ipcRenderer.invoke('save-terminal-config', config),

  runTerminalShortcut: (id: string): Promise<void> =>
    ipcRenderer.invoke('run-terminal-shortcut', id),

  closeTerminalLauncher: (): Promise<void> =>
    ipcRenderer.invoke('close-terminal-launcher'),

  closeTerminalExec: (execId: string): Promise<void> =>
    ipcRenderer.invoke('close-terminal-exec', execId),

  onTerminalExecOutput: (execId: string, callback: (data: string) => void): void => {
    ipcRenderer.on(`terminal-output-${execId}`, (_e, data: string) => callback(data));
  },

  onTerminalExecExit: (execId: string, callback: (code: number | null) => void): void => {
    ipcRenderer.on(`terminal-exit-${execId}`, (_e, code: number | null) => callback(code));
  },

  removeTerminalExecListeners: (execId: string): void => {
    ipcRenderer.removeAllListeners(`terminal-output-${execId}`);
    ipcRenderer.removeAllListeners(`terminal-exit-${execId}`);
  },

  resizeTerminalExec: (execId: string, cols: number, rows: number): void => {
    ipcRenderer.send('resize-terminal', execId, cols, rows);
  },

  getConfigFilesConfig: (): Promise<ConfigFilesConfig> =>
    ipcRenderer.invoke('get-config-files-config'),

  saveConfigFilesConfig: (config: ConfigFilesConfig): Promise<void> =>
    ipcRenderer.invoke('save-config-files-config', config),

  resetConfigFilesConfig: (): Promise<ConfigFilesConfig> =>
    ipcRenderer.invoke('reset-config-files-config'),

  readConfigFileContent: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('read-config-file-content', filePath),

  writeConfigFileContent: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke('write-config-file-content', filePath, content),

  getClaudeConfig: (): Promise<ClaudeConfig | null> =>
    ipcRenderer.invoke('get-claude-config'),

  saveClaudeConfig: (config: ClaudeConfig): Promise<void> =>
    ipcRenderer.invoke('save-claude-config', config),

  chatSendMessage: (message: string): Promise<void> =>
    ipcRenderer.invoke('chat-send-message', message),

  chatClearHistory: (): Promise<void> =>
    ipcRenderer.invoke('chat-clear-history'),

  chatGetHistory: (): Promise<ChatMessage[]> =>
    ipcRenderer.invoke('chat-get-history'),

  onChatDelta: (callback: (data: { type: string; content?: string; toolName?: string; toolCallId?: string; result?: string }) => void): void => {
    ipcRenderer.on('chat-delta', (_e, data) => callback(data));
  },

  onChatError: (callback: (error: string) => void): void => {
    ipcRenderer.on('chat-error', (_e, error: string) => callback(error));
  },

  onChatDone: (callback: (usage?: { inputTokens: number; outputTokens: number }) => void): void => {
    ipcRenderer.on('chat-done', (_e, usage) => callback(usage));
  },

  removeChatListeners: (): void => {
    ipcRenderer.removeAllListeners('chat-delta');
    ipcRenderer.removeAllListeners('chat-error');
    ipcRenderer.removeAllListeners('chat-done');
  },

  getGoogleCalendarConfig: (): Promise<GoogleCalendarConfig | null> =>
    ipcRenderer.invoke('get-google-calendar-config'),

  saveGoogleCalendarConfig: (config: GoogleCalendarConfig): Promise<void> =>
    ipcRenderer.invoke('save-google-calendar-config', config),

  fetchCalendarEvents: (): Promise<CalendarEvent[]> =>
    ipcRenderer.invoke('fetch-calendar-events'),

  testCalendarUrl: (url: string): Promise<{ ok: boolean; error?: string; resolvedUrl?: string }> =>
    ipcRenderer.invoke('test-calendar-url', url),

  googleOAuthSignIn: (clientId: string, clientSecret: string): Promise<{ email: string }> =>
    ipcRenderer.invoke('google-oauth-sign-in', clientId, clientSecret),

  googleOAuthSignOut: (): Promise<void> =>
    ipcRenderer.invoke('google-oauth-sign-out'),

  googleListCalendars: (): Promise<GoogleCalendarListItem[]> =>
    ipcRenderer.invoke('google-list-calendars'),

  googleSelectCalendars: (calendarIds: string[]): Promise<void> =>
    ipcRenderer.invoke('google-select-calendars', calendarIds),

  getTodayData: (): Promise<TodayData> =>
    ipcRenderer.invoke('get-today-data'),

  fetchJiraProjects: (): Promise<JiraProject[]> =>
    ipcRenderer.invoke('fetch-jira-projects'),

  fetchJiraVersions: (projectKey: string): Promise<JiraVersion[]> =>
    ipcRenderer.invoke('fetch-jira-versions', projectKey),

  getReleaseData: (projectKey: string, versionName: string): Promise<ReleaseData> =>
    ipcRenderer.invoke('get-release-data', projectKey, versionName),

  getScriptConfig: (): Promise<ScriptConfig | null> =>
    ipcRenderer.invoke('get-script-config'),

  saveScriptConfig: (config: ScriptConfig): Promise<void> =>
    ipcRenderer.invoke('save-script-config', config),

  runTicketScript: (ticketId: string, body: string): Promise<void> =>
    ipcRenderer.invoke('run-ticket-script', ticketId, body),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
