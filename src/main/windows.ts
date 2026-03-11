import { BrowserWindow, screen, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let dialogWindow: BrowserWindow | null = null;
let editWindow: BrowserWindow | null = null;
let taskTypesWindow: BrowserWindow | null = null;
let exportWindow: BrowserWindow | null = null;
let notesWindow: BrowserWindow | null = null;
let notebookWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let githubPRsWindow: BrowserWindow | null = null;
let quickLaunchWindow: BrowserWindow | null = null;
let kanbanWindow: BrowserWindow | null = null;
let terminalLauncherWindow: BrowserWindow | null = null;
let configFilesWindow: BrowserWindow | null = null;
let chatWindow: BrowserWindow | null = null;
let todayWindow: BrowserWindow | null = null;
let releaseWindow: BrowserWindow | null = null;
const terminalExecWindows = new Map<string, BrowserWindow>();

// Check if we're in dev mode by seeing if the built renderer exists
const rendererPath = path.join(__dirname, '../../renderer/index.html');
const isDev = !fs.existsSync(rendererPath) && !app.isPackaged;

function getPreloadPath(): string {
  return path.join(__dirname, '../preload.js');
}

function getRendererUrl(route: string = ''): string {
  if (isDev) {
    return `http://localhost:5173${route}`;
  }
  return `file://${path.join(__dirname, '../../renderer/index.html')}${route ? `#${route}` : ''}`;
}

interface StandardWindowOptions {
  title: string;
  route: string;
  widthRatio?: number;
  heightRatio?: number;
  maxWidth?: number;
}

function getCurrentDisplay(): Electron.Display {
  const cursorPoint = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(cursorPoint);
}

function repositionToCurrentDisplay(win: BrowserWindow): void {
  const { x, y, width, height } = getCurrentDisplay().workArea;
  const bounds = win.getBounds();
  win.setPosition(
    Math.round(x + (width - bounds.width) / 2),
    Math.round(y + (height - bounds.height) / 2)
  );
}

function createStandardWindow(opts: StandardWindowOptions): BrowserWindow {
  const { x: displayX, y: displayY, width: screenWidth, height: screenHeight } = getCurrentDisplay().workArea;
  const windowWidth = Math.min(
    Math.round(screenWidth * (opts.widthRatio ?? 0.8)),
    opts.maxWidth ?? 1200
  );
  const windowHeight = Math.round(screenHeight * (opts.heightRatio ?? 0.8));

  const win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round(displayX + (screenWidth - windowWidth) / 2),
    y: Math.round(displayY + (screenHeight - windowHeight) / 2),
    title: opts.title,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(getRendererUrl(opts.route));

  return win;
}

export function createDialogWindow(): BrowserWindow {
  if (dialogWindow && !dialogWindow.isDestroyed()) {
    repositionToCurrentDisplay(dialogWindow);
    dialogWindow.show();
    dialogWindow.focus();
    return dialogWindow;
  }

  const { x: displayX, y: displayY, width: screenWidth, height: screenHeight } = getCurrentDisplay().workArea;

  dialogWindow = new BrowserWindow({
    width: 800,
    height: 550,
    x: Math.round(displayX + (screenWidth - 800) / 2),
    y: Math.round(displayY + (screenHeight - 550) / 2),
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  dialogWindow.loadURL(getRendererUrl());

  dialogWindow.once('ready-to-show', () => {
    dialogWindow?.show();
    dialogWindow?.focus();
  });

  dialogWindow.on('closed', () => {
    dialogWindow = null;
  });

  dialogWindow.on('blur', () => {
    // Keep dialog visible but don't force focus
  });

  return dialogWindow;
}

export function showDialogWindow(): void {
  createDialogWindow();
}

export function closeDialogWindow(): void {
  if (dialogWindow && !dialogWindow.isDestroyed()) {
    dialogWindow.close();
    dialogWindow = null;
  }
}

export function getDialogWindow(): BrowserWindow | null {
  return dialogWindow;
}

export function createEditWindow(): BrowserWindow {
  if (editWindow && !editWindow.isDestroyed()) {
    repositionToCurrentDisplay(editWindow);
    editWindow.show();
    editWindow.focus();
    return editWindow;
  }

  editWindow = createStandardWindow({ title: 'Edit Time Entries', route: '/edit' });

  editWindow.once('ready-to-show', () => {
    editWindow?.show();
  });

  editWindow.on('closed', () => {
    editWindow = null;
  });

  return editWindow;
}

export function showEditWindow(): void {
  createEditWindow();
}

export function sendToDialog(channel: string, ...args: unknown[]): void {
  if (dialogWindow && !dialogWindow.isDestroyed()) {
    dialogWindow.webContents.send(channel, ...args);
  }
}

export function createTaskTypesWindow(): BrowserWindow {
  if (taskTypesWindow && !taskTypesWindow.isDestroyed()) {
    repositionToCurrentDisplay(taskTypesWindow);
    taskTypesWindow.show();
    taskTypesWindow.focus();
    return taskTypesWindow;
  }

  const { x: displayX, y: displayY, width: screenWidth, height: screenHeight } = getCurrentDisplay().workArea;

  taskTypesWindow = new BrowserWindow({
    width: 400,
    height: 500,
    x: Math.round(displayX + (screenWidth - 400) / 2),
    y: Math.round(displayY + (screenHeight - 500) / 2),
    title: 'Manage Task Types',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  taskTypesWindow.loadURL(getRendererUrl('/task-types'));

  taskTypesWindow.once('ready-to-show', () => {
    taskTypesWindow?.show();
  });

  taskTypesWindow.on('closed', () => {
    taskTypesWindow = null;
  });

  return taskTypesWindow;
}

export function showTaskTypesWindow(): void {
  createTaskTypesWindow();
}

export function createExportWindow(): BrowserWindow {
  if (exportWindow && !exportWindow.isDestroyed()) {
    repositionToCurrentDisplay(exportWindow);
    exportWindow.show();
    exportWindow.focus();
    return exportWindow;
  }

  exportWindow = createStandardWindow({ title: 'Export View', route: '/export' });

  exportWindow.once('ready-to-show', () => {
    exportWindow?.show();
  });

  exportWindow.on('closed', () => {
    exportWindow = null;
  });

  return exportWindow;
}

export function showExportWindow(): void {
  createExportWindow();
}

export function createNotesWindow(): BrowserWindow {
  if (notesWindow && !notesWindow.isDestroyed()) {
    repositionToCurrentDisplay(notesWindow);
    notesWindow.show();
    notesWindow.focus();
    return notesWindow;
  }

  notesWindow = createStandardWindow({ title: 'Daily Notes', route: '/notes' });

  notesWindow.once('ready-to-show', () => {
    notesWindow?.show();
  });

  notesWindow.on('closed', () => {
    notesWindow = null;
  });

  return notesWindow;
}

export function showNotesWindow(): void {
  createNotesWindow();
}

export function createNotebookWindow(): BrowserWindow {
  if (notebookWindow && !notebookWindow.isDestroyed()) {
    repositionToCurrentDisplay(notebookWindow);
    notebookWindow.show();
    notebookWindow.focus();
    return notebookWindow;
  }

  notebookWindow = createStandardWindow({ title: 'Notebook', route: '/notebook' });

  notebookWindow.once('ready-to-show', () => {
    notebookWindow?.show();
  });

  notebookWindow.on('closed', () => {
    notebookWindow = null;
  });

  return notebookWindow;
}

export function showNotebookWindow(): void {
  createNotebookWindow();
}

export function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    repositionToCurrentDisplay(settingsWindow);
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = createStandardWindow({ title: 'Settings', route: '/settings' });

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

export function showSettingsWindow(): void {
  createSettingsWindow();
}

export function createGitHubPRsWindow(): BrowserWindow {
  if (githubPRsWindow && !githubPRsWindow.isDestroyed()) {
    repositionToCurrentDisplay(githubPRsWindow);
    githubPRsWindow.show();
    githubPRsWindow.focus();
    return githubPRsWindow;
  }

  githubPRsWindow = createStandardWindow({ title: 'GitHub PRs', route: '/github-prs' });

  githubPRsWindow.once('ready-to-show', () => {
    githubPRsWindow?.show();
  });

  githubPRsWindow.on('closed', () => {
    githubPRsWindow = null;
  });

  return githubPRsWindow;
}

export function showGitHubPRsWindow(): void {
  createGitHubPRsWindow();
}

export function createQuickLaunchWindow(): BrowserWindow {
  if (quickLaunchWindow && !quickLaunchWindow.isDestroyed()) {
    const { x, y, width } = getCurrentDisplay().workArea;
    quickLaunchWindow.setBounds({ x, y, width, height: 80 });
    quickLaunchWindow.show();
    quickLaunchWindow.focus();
    return quickLaunchWindow;
  }

  const { x: displayX, y: displayY, width: screenWidth } = getCurrentDisplay().workArea;

  quickLaunchWindow = new BrowserWindow({
    width: screenWidth,
    height: 80,
    x: displayX,
    y: displayY,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    transparent: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  quickLaunchWindow.loadURL(getRendererUrl('/quick-launch'));

  quickLaunchWindow.once('ready-to-show', () => {
    quickLaunchWindow?.show();
    quickLaunchWindow?.focus();
  });

  quickLaunchWindow.on('blur', () => {
    closeQuickLaunchWindow();
  });

  quickLaunchWindow.on('closed', () => {
    quickLaunchWindow = null;
  });

  return quickLaunchWindow;
}

export function showQuickLaunchWindow(): void {
  if (quickLaunchWindow && !quickLaunchWindow.isDestroyed() && quickLaunchWindow.isVisible()) {
    closeQuickLaunchWindow();
    return;
  }
  createQuickLaunchWindow();
}

export function closeQuickLaunchWindow(): void {
  if (quickLaunchWindow && !quickLaunchWindow.isDestroyed()) {
    quickLaunchWindow.close();
    quickLaunchWindow = null;
  }
}

export function getQuickLaunchWindow(): BrowserWindow | null {
  return quickLaunchWindow;
}

export function createKanbanWindow(): BrowserWindow {
  if (kanbanWindow && !kanbanWindow.isDestroyed()) {
    repositionToCurrentDisplay(kanbanWindow);
    kanbanWindow.show();
    kanbanWindow.focus();
    return kanbanWindow;
  }

  kanbanWindow = createStandardWindow({ title: 'Kanban Board', route: '/kanban', widthRatio: 0.9, maxWidth: 1400 });

  kanbanWindow.once('ready-to-show', () => {
    kanbanWindow?.show();
  });

  kanbanWindow.on('closed', () => {
    kanbanWindow = null;
  });

  return kanbanWindow;
}

export function showKanbanWindow(): void {
  createKanbanWindow();
}

export function createTerminalLauncherWindow(): BrowserWindow {
  if (terminalLauncherWindow && !terminalLauncherWindow.isDestroyed()) {
    repositionToCurrentDisplay(terminalLauncherWindow);
    terminalLauncherWindow.show();
    terminalLauncherWindow.focus();
    return terminalLauncherWindow;
  }

  const { x: displayX, y: displayY, width: screenWidth, height: screenHeight } = getCurrentDisplay().workArea;

  terminalLauncherWindow = new BrowserWindow({
    width: 500,
    height: 400,
    x: Math.round(displayX + (screenWidth - 500) / 2),
    y: Math.round(displayY + (screenHeight - 400) / 2),
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  terminalLauncherWindow.loadURL(getRendererUrl('/terminal-launcher'));

  terminalLauncherWindow.once('ready-to-show', () => {
    terminalLauncherWindow?.show();
    terminalLauncherWindow?.focus();
  });

  terminalLauncherWindow.on('closed', () => {
    terminalLauncherWindow = null;
  });

  return terminalLauncherWindow;
}

export function showTerminalLauncherWindow(): void {
  createTerminalLauncherWindow();
}

export function getTerminalLauncherWindow(): BrowserWindow | null {
  return terminalLauncherWindow;
}

export function closeTerminalLauncherWindow(): void {
  if (terminalLauncherWindow && !terminalLauncherWindow.isDestroyed()) {
    terminalLauncherWindow.destroy();
    terminalLauncherWindow = null;
  }
}

export function createConfigFilesWindow(): BrowserWindow {
  if (configFilesWindow && !configFilesWindow.isDestroyed()) {
    repositionToCurrentDisplay(configFilesWindow);
    configFilesWindow.show();
    configFilesWindow.focus();
    return configFilesWindow;
  }

  configFilesWindow = createStandardWindow({ title: 'Config Files', route: '/config-files' });

  configFilesWindow.once('ready-to-show', () => {
    configFilesWindow?.show();
  });

  configFilesWindow.on('closed', () => {
    configFilesWindow = null;
  });

  return configFilesWindow;
}

export function showConfigFilesWindow(): void {
  createConfigFilesWindow();
}

export function createChatWindow(): BrowserWindow {
  if (chatWindow && !chatWindow.isDestroyed()) {
    repositionToCurrentDisplay(chatWindow);
    chatWindow.show();
    chatWindow.focus();
    return chatWindow;
  }

  chatWindow = createStandardWindow({ title: 'AI Chat', route: '/chat', widthRatio: 0.5, maxWidth: 700 });

  chatWindow.once('ready-to-show', () => {
    chatWindow?.show();
  });

  chatWindow.on('closed', () => {
    chatWindow = null;
  });

  return chatWindow;
}

export function showChatWindow(): void {
  createChatWindow();
}

export function getChatWindow(): BrowserWindow | null {
  return chatWindow;
}

export function createTodayWindow(): BrowserWindow {
  if (todayWindow && !todayWindow.isDestroyed()) {
    repositionToCurrentDisplay(todayWindow);
    todayWindow.show();
    todayWindow.focus();
    return todayWindow;
  }

  todayWindow = createStandardWindow({ title: 'Today', route: '/today', widthRatio: 0.5, maxWidth: 700 });

  todayWindow.once('ready-to-show', () => {
    todayWindow?.show();
  });

  todayWindow.on('closed', () => {
    todayWindow = null;
  });

  return todayWindow;
}

export function showTodayWindow(): void {
  createTodayWindow();
}

export function createReleaseWindow(): BrowserWindow {
  if (releaseWindow && !releaseWindow.isDestroyed()) {
    repositionToCurrentDisplay(releaseWindow);
    releaseWindow.show();
    releaseWindow.focus();
    return releaseWindow;
  }

  releaseWindow = createStandardWindow({ title: 'Release', route: '/release', widthRatio: 0.7, maxWidth: 1000 });

  releaseWindow.once('ready-to-show', () => {
    releaseWindow?.show();
  });

  releaseWindow.on('closed', () => {
    releaseWindow = null;
  });

  return releaseWindow;
}

export function showReleaseWindow(): void {
  createReleaseWindow();
}

export function createTerminalExecWindow(execId: string, title: string): BrowserWindow {
  const { x: displayX, y: displayY, width: screenWidth, height: screenHeight } = getCurrentDisplay().workArea;

  const win = new BrowserWindow({
    width: 600,
    height: 400,
    x: Math.round(displayX + (screenWidth - 600) / 2),
    y: Math.round(displayY + (screenHeight - 400) / 2),
    title,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(getRendererUrl(`/terminal-exec?execId=${execId}`));

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    terminalExecWindows.delete(execId);
  });

  terminalExecWindows.set(execId, win);
  return win;
}

export function getTerminalExecWindow(execId: string): BrowserWindow | undefined {
  const win = terminalExecWindows.get(execId);
  return win && !win.isDestroyed() ? win : undefined;
}

export function cleanupTerminalExecWindow(execId: string): void {
  const win = terminalExecWindows.get(execId);
  if (win && !win.isDestroyed()) {
    win.destroy();
  }
  terminalExecWindows.delete(execId);
}
