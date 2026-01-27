import { BrowserWindow, screen, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let dialogWindow: BrowserWindow | null = null;
let editWindow: BrowserWindow | null = null;
let taskTypesWindow: BrowserWindow | null = null;
let exportWindow: BrowserWindow | null = null;

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
    width: 400,
    height: 550,
    x: Math.round((screenWidth - 400) / 2),
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
  const windowWidth = Math.round(screenWidth * 0.8);
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
