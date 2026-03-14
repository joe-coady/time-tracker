export interface TaskType {
  id: string;
  name: string;
}

export interface QuickLinkRule {
  id: string;
  linkPattern: string;
  linkTarget: string;
}

export interface JiraCustomFieldConfig {
  id: string;          // UUID for the config entry
  fieldId: string;     // Jira API field ID: "fixVersions", "customfield_10001"
  label: string;       // Display label: "Fix Versions"
}

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  ticketPattern?: string;  // regex string, e.g. "[A-Z]+-\\d+"
  customFields?: JiraCustomFieldConfig[];
}

export interface JiraTicketStatus {
  key: string;          // "PROJ-123"
  summary: string;      // "Fix the auth flow for SSO users"
  status: string;       // "In Progress"
  statusCategory: string; // "new" | "indeterminate" | "done"
  customFields?: Record<string, string>; // fieldId → display value
}

export interface JiraSearchResult {
  key: string;
  summary: string;
}

export interface HotkeyConfig {
  showDialog: string; // Electron accelerator string, e.g. "Control+Option+Space"
  quickLaunch?: string; // Electron accelerator string, e.g. "Command+`"
}

export interface TerminalShortcut {
  id: string;
  name: string;          // "incept-backend"
  directory: string;     // "/Users/joe/repo/resimac-incept"
  command?: string;      // "docker compose exec app php artisan migrate"
  lastRanAt?: string;    // ISO timestamp for sort order
}

export interface TerminalConfig {
  shortcuts: TerminalShortcut[];
}

export interface KanbanColumnConfig {
  name: string;
  hidden?: boolean;
  mappedTo?: string;         // required when hidden — must point to a visible column
  jiraStatuses?: string[];   // Jira status names that resolve to this column
  columnType?: 'working' | 'todo' | 'done';
}

export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  email?: string;
}

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  primary?: boolean;
}

export interface GoogleCalendarConfig {
  icalUrls: { id: string; name: string; url: string }[];
  oauth?: GoogleOAuthTokens;
  selectedCalendarIds?: string[];
  clientId?: string;
  clientSecret?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  startTime: string;   // ISO string
  endTime: string;     // ISO string
  location?: string;
  calendarName: string;
}

export interface JiraProject {
  key: string;
  name: string;
}

export interface JiraVersion {
  id: string;
  name: string;
  released: boolean;
  releaseDate?: string;
}

export interface ReleaseData {
  tickets: JiraTicketStatus[];
  prs: GitHubPR[];
  devBranchTickets: string[];
}

export interface TodayData {
  workingTasks: KanbanTask[];
  todoTasks: KanbanTask[];
  meetings: CalendarEvent[];
  myPRs: GitHubPR[];
  assignedPRs: GitHubPR[];
  jiraTicketStatuses: JiraTicketStatus[];
  devBranchTickets: string[];
  githubUsername: string | null;
}

export interface ConfigFileEntry {
  id: string;
  name: string;   // display name, e.g. "zshrc"
  path: string;   // absolute path, e.g. "/Users/joe/.zshrc"
}

export interface ConfigFilesConfig {
  files: ConfigFileEntry[];
}

export interface ScriptConfig {
  scriptPath: string;      // full command, e.g. "node ./prep-ticket.js"
  scriptDir: string;       // working directory, e.g. "~/repo/my-project"
}

export interface KanbanScript {
  name: string;
  scriptPath: string;
  scriptDir: string;
}

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
}

export interface ChatToolCall {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  result?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ChatToolCall[];
  timestamp: string;
}

export const DEFAULT_KANBAN_COLUMNS: KanbanColumnConfig[] = [
  { name: 'Todo' },
  { name: 'In Progress' },
  { name: 'Dev Review' },
  { name: 'QA' },
  { name: 'Done' },
];

export type KanbanStatus = string;

export interface KanbanTask {
  Id: string;
  Title: string;
  Description: string;
  Status: KanbanStatus;
  customFields?: Record<string, string>; // fieldId → display value
}

export interface KanbanBoard {
  id: string;
  date: string;         // YYYY-MM-DD
  tasks: KanbanTask[];
  createdAt: string;
  updatedAt: string;
}

export interface GitHubConfig {
  token: string;
  orgs: string[];
  username?: string;
  excludedRepos?: string[];
  devBranch?: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  htmlUrl: string;
  state: string;
  author: string;
  assignees: string[];
  labels: { name: string; color?: string }[];
  createdAt: string;
  updatedAt: string;
  draft: boolean;
  repoFullName: string;
  approved?: boolean;
  requestedReviewers: string[];
  reviewHistory: { user: string; state: 'APPROVED' | 'CHANGES_REQUESTED' }[];
}

export interface DailyNote {
  id: string;           // UUID
  date: string;         // YYYY-MM-DD format (unique key)
  content: string;      // The note text
  createdAt: string;    // ISO timestamp
  updatedAt: string;    // ISO timestamp
}

export interface Note {
  id: string;
  title: string;
  content: string;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEntry {
  id: string;
  task: string;
  startTime: string;
  durationMinutes?: number; // Explicit duration override (optional)
  notes?: string;
  completed?: boolean;
  taskTypeIds?: string[]; // Optional array of TaskType IDs
}

export interface TasksData {
  version: 1;
  taskTypes: TaskType[];
  entries: TaskEntry[];
  dailyNotes?: DailyNote[];
  notes?: Note[];
  exportFilterTagIds?: string[];
  quickLinkRules?: QuickLinkRule[];
  jiraConfig?: JiraConfig;
  githubConfig?: GitHubConfig;
  hotkeyConfig?: HotkeyConfig;
  kanbanBoards?: KanbanBoard[];
  kanbanColumns?: KanbanColumnConfig[];
  terminalConfig?: TerminalConfig;
  configFiles?: ConfigFilesConfig;
  claudeConfig?: ClaudeConfig;
  googleCalendarConfig?: GoogleCalendarConfig;
  scriptConfig?: ScriptConfig;
  kanbanScripts?: KanbanScript[];
}

export interface CalculatedTaskEntry extends TaskEntry {
  calculatedDurationMinutes: number | null; // null = ongoing task
  isExplicitDuration: boolean;
}

export interface CurrentState {
  currentTask: string | null;
  elapsedMinutes: number | null;
}

export type DurationOption = 15 | 30 | 60 | 120 | 180 | 240;

export const DURATION_OPTIONS: { value: DurationOption; label: string }[] = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
  { value: 240, label: '4 hours' },
];

export interface PreviousTask {
  name: string;
  lastDuration: number;
  lastTaskTypeIds: string[];
  source?: 'jira';
}

export interface ElectronAPI {
  getTasks: () => Promise<CalculatedTaskEntry[]>;
  getPreviousTaskNames: () => Promise<PreviousTask[]>;
  startTask: (taskName: string, durationMinutes: number, taskTypeIds?: string[], notes?: string) => Promise<void>;
  updateEntry: (id: string, updates: Partial<Pick<TaskEntry, 'task' | 'startTime' | 'durationMinutes' | 'notes' | 'completed' | 'taskTypeIds'>>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getCurrentState: () => Promise<CurrentState>;
  closeDialog: () => Promise<void>;
  setExplicitDuration: (id: string, durationMinutes: number) => Promise<void>;
  clearExplicitDuration: (id: string) => Promise<void>;
  onTimerExpired: (callback: () => void) => void;
  removeTimerExpiredListener: () => void;
  getTaskTypes: () => Promise<TaskType[]>;
  addTaskType: (name: string) => Promise<TaskType>;
  updateTaskType: (id: string, name: string) => Promise<void>;
  deleteTaskType: (id: string) => Promise<void>;
  getExportFilterTagIds: () => Promise<string[]>;
  setExportFilterTagIds: (tagIds: string[]) => Promise<void>;
  getDailyNote: (date: string) => Promise<DailyNote | null>;
  saveDailyNote: (content: string) => Promise<DailyNote>;
  getAllNoteDates: () => Promise<string[]>;
  getNotebookNotes: () => Promise<Note[]>;
  createNotebookNote: (title: string, content: string) => Promise<Note>;
  updateNotebookNote: (id: string, title: string, content: string) => Promise<Note>;
  deleteNotebookNote: (id: string) => Promise<void>;
  togglePinNotebookNote: (id: string) => Promise<Note>;
  openExternal: (url: string) => Promise<void>;
  getQuickLinkRules: () => Promise<QuickLinkRule[]>;
  addQuickLinkRule: (linkPattern: string, linkTarget: string) => Promise<QuickLinkRule>;
  deleteQuickLinkRule: (id: string) => Promise<void>;
  getJiraConfig: () => Promise<JiraConfig | null>;
  saveJiraConfig: (config: JiraConfig) => Promise<void>;
  searchJira: (query: string) => Promise<JiraSearchResult[]>;
  testJiraConnection: (config: JiraConfig) => Promise<boolean>;
  getGitHubConfig: () => Promise<GitHubConfig | null>;
  saveGitHubConfig: (config: GitHubConfig) => Promise<void>;
  testGitHubConnection: (config: GitHubConfig) => Promise<string | null>;
  fetchGitHubPRs: () => Promise<GitHubPR[]>;
  fetchJiraTicketStatuses: (keys: string[]) => Promise<JiraTicketStatus[]>;
  fetchDevBranchTickets: (repos: string[]) => Promise<string[]>;
  getHotkeyConfig: () => Promise<HotkeyConfig | null>;
  saveHotkeyConfig: (config: HotkeyConfig) => Promise<void>;
  closeQuickLaunch: () => Promise<void>;
  openView: (view: string) => Promise<void>;
  getKanbanBoard: (date: string) => Promise<KanbanBoard | null>;
  getAllKanbanDates: () => Promise<string[]>;
  addKanbanTask: (date: string, title: string, description: string) => Promise<KanbanTask>;
  updateKanbanTask: (date: string, taskId: string, updates: Partial<Pick<KanbanTask, 'Title' | 'Description' | 'Status'>>) => Promise<void>;
  deleteKanbanTask: (date: string, taskId: string) => Promise<void>;
  reorderKanbanTasks: (date: string, tasks: KanbanTask[]) => Promise<void>;
  getKanbanColumns: () => Promise<KanbanColumnConfig[]>;
  saveKanbanColumns: (columns: KanbanColumnConfig[]) => Promise<void>;
  syncKanbanWithJira: (date: string) => Promise<{ imported: number; updated: number }>;
  getTerminalConfig: () => Promise<TerminalConfig | null>;
  saveTerminalConfig: (config: TerminalConfig) => Promise<void>;
  runTerminalShortcut: (id: string) => Promise<void>;
  closeTerminalLauncher: () => Promise<void>;
  closeTerminalExec: (execId: string) => Promise<void>;
  onTerminalExecOutput: (execId: string, callback: (data: string) => void) => void;
  onTerminalExecExit: (execId: string, callback: (code: number | null) => void) => void;
  removeTerminalExecListeners: (execId: string) => void;
  resizeTerminalExec: (execId: string, cols: number, rows: number) => void;
  terminalReady: (execId: string) => void;
  getConfigFilesConfig: () => Promise<ConfigFilesConfig>;
  saveConfigFilesConfig: (config: ConfigFilesConfig) => Promise<void>;
  resetConfigFilesConfig: () => Promise<ConfigFilesConfig>;
  readConfigFileContent: (path: string) => Promise<string>;
  writeConfigFileContent: (path: string, content: string) => Promise<void>;
  getClaudeConfig: () => Promise<ClaudeConfig | null>;
  saveClaudeConfig: (config: ClaudeConfig) => Promise<void>;
  chatSendMessage: (message: string) => Promise<void>;
  chatClearHistory: () => Promise<void>;
  chatGetHistory: () => Promise<ChatMessage[]>;
  onChatDelta: (callback: (data: { type: string; content?: string; toolName?: string; toolCallId?: string; result?: string }) => void) => void;
  onChatError: (callback: (error: string) => void) => void;
  onChatDone: (callback: (usage?: { inputTokens: number; outputTokens: number }) => void) => void;
  removeChatListeners: () => void;
  getGoogleCalendarConfig: () => Promise<GoogleCalendarConfig | null>;
  saveGoogleCalendarConfig: (config: GoogleCalendarConfig) => Promise<void>;
  fetchCalendarEvents: () => Promise<CalendarEvent[]>;
  testCalendarUrl: (url: string) => Promise<{ ok: boolean; error?: string; resolvedUrl?: string }>;
  googleOAuthSignIn: (clientId: string, clientSecret: string) => Promise<{ email: string }>;
  googleOAuthSignOut: () => Promise<void>;
  googleListCalendars: () => Promise<GoogleCalendarListItem[]>;
  googleSelectCalendars: (calendarIds: string[]) => Promise<void>;
  getTodayData: () => Promise<TodayData>;
  fetchJiraProjects: () => Promise<JiraProject[]>;
  fetchJiraVersions: (projectKey: string) => Promise<JiraVersion[]>;
  getReleaseData: (projectKey: string, versionName: string) => Promise<ReleaseData>;
  getScriptConfig: () => Promise<ScriptConfig | null>;
  saveScriptConfig: (config: ScriptConfig) => Promise<void>;
  runTicketScript: (ticketId: string, body: string, isJira?: boolean, scriptPath?: string, scriptDir?: string) => Promise<void>;
  getKanbanScripts: () => Promise<KanbanScript[]>;
  saveKanbanScripts: (scripts: KanbanScript[]) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
