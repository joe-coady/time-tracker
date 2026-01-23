import { app, BrowserWindow } from 'electron';
import { createTray, destroyTray } from './tray';
import { showDialogWindow, sendToDialog } from './windows';
import { registerGlobalShortcut, unregisterAllShortcuts } from './globalShortcut';
import { setTimerExpiryCallback } from './timer';
import { setupIpcHandlers } from './ipc';
import { startHourlyChecker, stopHourlyChecker } from './hourlyChecker';

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showDialogWindow();
  });
}

// Hide dock icon on macOS (we're a tray-only app)
if (process.platform === 'darwin') {
  app.dock?.hide();
}

app.whenReady().then(() => {
  // Set up IPC handlers
  setupIpcHandlers();

  // Create system tray
  createTray();

  // Register global shortcut
  registerGlobalShortcut();

  // Set up timer expiry callback
  setTimerExpiryCallback(() => {
    showDialogWindow();
    sendToDialog('timer-expired');
  });

  // Start hourly checker for ongoing tasks
  startHourlyChecker();

  // Always show dialog on app start - user confirms/updates what they're working on
  showDialogWindow();
});

app.on('window-all-closed', () => {
  // Don't quit when all windows are closed - we're a tray app
});

app.on('will-quit', () => {
  unregisterAllShortcuts();
  destroyTray();
  stopHourlyChecker();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    showDialogWindow();
  }
});
