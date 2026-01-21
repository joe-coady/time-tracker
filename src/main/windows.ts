import { BrowserWindow, screen, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let dialogWindow: BrowserWindow | null = null;
let editWindow: BrowserWindow | null = null;

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

  editWindow = new BrowserWindow({
    width: 600,
    height: 500,
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
