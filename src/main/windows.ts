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

export function createDialogWindow(): BrowserWindow {
  if (dialogWindow && !dialogWindow.isDestroyed()) {
    dialogWindow.show();
    dialogWindow.focus();
    return dialogWindow;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  dialogWindow = new BrowserWindow({
    width: 800,
    height: 550,
    x: Math.round((screenWidth - 800) / 2),
    y: Math.round((screenHeight - 550) / 2),
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
    editWindow.show();
    editWindow.focus();
    return editWindow;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = Math.min(Math.round(screenWidth * 0.8), 1200);
  const windowHeight = Math.round(screenHeight * 0.8);

  editWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: Math.round((screenHeight - windowHeight) / 2),
    title: 'Edit Time Entries',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  editWindow.loadURL(getRendererUrl('/edit'));

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
    taskTypesWindow.show();
    taskTypesWindow.focus();
    return taskTypesWindow;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  taskTypesWindow = new BrowserWindow({
    width: 400,
    height: 500,
    x: Math.round((screenWidth - 400) / 2),
    y: Math.round((screenHeight - 500) / 2),
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
    exportWindow.show();
    exportWindow.focus();
    return exportWindow;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = Math.round(screenWidth * 0.8);
  const windowHeight = Math.round(screenHeight * 0.8);

  exportWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: Math.round((screenHeight - windowHeight) / 2),
    title: 'Export View',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  exportWindow.loadURL(getRendererUrl('/export'));

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
    notesWindow.show();
    notesWindow.focus();
    return notesWindow;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = Math.min(Math.round(screenWidth * 0.8), 1200);
  const windowHeight = Math.round(screenHeight * 0.8);

  notesWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: Math.round((screenHeight - windowHeight) / 2),
    title: 'Daily Notes',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  notesWindow.loadURL(getRendererUrl('/notes'));

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
    notebookWindow.show();
    notebookWindow.focus();
    return notebookWindow;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = Math.min(Math.round(screenWidth * 0.8), 1200);
  const windowHeight = Math.round(screenHeight * 0.8);

  notebookWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: Math.round((screenHeight - windowHeight) / 2),
    title: 'Notebook',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  notebookWindow.loadURL(getRendererUrl('/notebook'));

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
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = Math.min(Math.round(screenWidth * 0.8), 1200);
  const windowHeight = Math.round(screenHeight * 0.8);

  settingsWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: Math.round((screenHeight - windowHeight) / 2),
    title: 'Settings',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadURL(getRendererUrl('/settings'));

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
    githubPRsWindow.show();
    githubPRsWindow.focus();
    return githubPRsWindow;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = Math.round(screenWidth * 0.8);
  const windowHeight = Math.round(screenHeight * 0.8);

  githubPRsWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: Math.round((screenHeight - windowHeight) / 2),
    title: 'GitHub PRs',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  githubPRsWindow.loadURL(getRendererUrl('/github-prs'));

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
    quickLaunchWindow.show();
    quickLaunchWindow.focus();
    return quickLaunchWindow;
  }

  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  quickLaunchWindow = new BrowserWindow({
    width: screenWidth,
    height: 80,
    x: 0,
    y: 0,
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
    kanbanWindow.show();
    kanbanWindow.focus();
    return kanbanWindow;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = Math.min(Math.round(screenWidth * 0.9), 1400);
  const windowHeight = Math.round(screenHeight * 0.8);

  kanbanWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: Math.round((screenHeight - windowHeight) / 2),
    title: 'Kanban Board',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  kanbanWindow.loadURL(getRendererUrl('/kanban'));

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
