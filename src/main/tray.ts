import { Tray, Menu, nativeImage, app } from 'electron';
import * as path from 'path';
import { showDialogWindow, showEditWindow } from './windows';
import { readAppState } from './storage';
import { getRemainingMinutes } from './timer';

let tray: Tray | null = null;
let menuUpdateInterval: NodeJS.Timeout | null = null;

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
  const state = readAppState();
  const remaining = getRemainingMinutes();

  const menuItems: Electron.MenuItemConstructorOptions[] = [];

  if (state.currentTask) {
    menuItems.push({
      label: `Current: ${state.currentTask}`,
      enabled: false,
    });
    if (remaining !== null) {
      menuItems.push({
        label: `${remaining} min remaining`,
        enabled: false,
      });
    }
    menuItems.push({ type: 'separator' });
  }

  menuItems.push(
    {
      label: 'What are you working on?',
      click: () => showDialogWindow(),
    },
    {
      label: 'Edit entries',
      click: () => showEditWindow(),
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
  tray.setContextMenu(getContextMenu());

  // Update menu every minute so remaining time stays current
  menuUpdateInterval = setInterval(() => {
    updateTrayMenu();
  }, 60 * 1000);

  return tray;
}

export function updateTrayMenu(): void {
  if (tray) {
    tray.setContextMenu(getContextMenu());
  }
}

export function destroyTray(): void {
  if (menuUpdateInterval) {
    clearInterval(menuUpdateInterval);
    menuUpdateInterval = null;
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
