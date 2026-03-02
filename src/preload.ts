import { contextBridge, ipcRenderer } from 'electron';
import { CalculatedTaskEntry, CurrentState, DailyNote, ElectronAPI, GitHubConfig, GitHubPR, JiraConfig, JiraSearchResult, JiraTicketStatus, Note, PreviousTask, QuickLinkRule, TaskEntry, TaskType } from './shared/types';

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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
