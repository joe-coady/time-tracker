import { Tray, Menu, nativeImage, app } from 'electron';
import * as path from 'path';
import { showDialogWindow, showEditWindow, showExportWindow, showNotesWindow, showNotebookWindow, showSettingsWindow, showGitHubPRsWindow, showQuickLaunchWindow, showKanbanWindow, showConfigFilesWindow, showChatWindow, showTodayWindow, showReleaseWindow } from './windows';
import { getLastEntry } from './storage';

let tray: Tray | null = null;

function createTrayIcon(): Electron.NativeImage {
  // Create a simple clock icon using native image
  // In production, you'd use an actual icon file
  const iconPath = path.join(__dirname, '../../../assets/trayIcon.png');
  try {
    return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    // Fallback: create an empty template image
    return nativeImage.createEmpty();
  }
}

function getContextMenu(): Menu {
  const lastEntry = getLastEntry();

  const menuItems: Electron.MenuItemConstructorOptions[] = [];

  if (lastEntry) {
    menuItems.push({
      label: `Current: ${lastEntry.task}`,
      enabled: false,
    });
    menuItems.push({ type: 'separator' });
  }

  menuItems.push(
    {
      label: 'What are you working on?',
      click: () => showDialogWindow(),
    },
    {
      label: 'Today',
      click: () => showTodayWindow(),
    },
    { type: 'separator' },
    {
      label: 'Edit entries',
      click: () => showEditWindow(),
    },
    {
      label: 'Daily Notes',
      click: () => showNotesWindow(),
    },
    {
      label: 'Kanban Board',
      click: () => showKanbanWindow(),
    },
    {
      label: 'Notebook',
      click: () => showNotebookWindow(),
    },
    {
      label: 'Config Files',
      click: () => showConfigFilesWindow(),
    },
    {
      label: 'GitHub PRs',
      click: () => showGitHubPRsWindow(),
    },
    {
      label: 'Release',
      click: () => showReleaseWindow(),
    },
    {
      label: 'AI Chat',
      click: () => showChatWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quick Launch',
      click: () => showQuickLaunchWindow(),
    },
    {
      label: 'Settings',
      click: () => showSettingsWindow(),
    },
    { type: 'separator' },
    {
      label: 'Export view',
      click: () => showExportWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    }
  );

  return Menu.buildFromTemplate(menuItems);
}

export function createTray(): Tray {
  if (tray) return tray;

  tray = new Tray(createTrayIcon());
  tray.setToolTip('Time Tracker');

  // Build menu fresh on each click to avoid focus-stealing from setContextMenu intervals
  tray.on('click', () => {
    tray?.popUpContextMenu(getContextMenu());
  });
  tray.on('right-click', () => {
    tray?.popUpContextMenu(getContextMenu());
  });

  return tray;
}

export function updateTrayMenu(): void {
  if (tray) {
    tray.setContextMenu(getContextMenu());
  }
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
