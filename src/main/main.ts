import { app, BrowserWindow, dialog, Menu } from 'electron';
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
  // Set up app menu so Cmd+Q triggers app.quit() instead of just closing the window
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'quit' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'close' },
        { role: 'minimize' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ]));

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

app.on('before-quit', (e) => {
  e.preventDefault();
  const choice = dialog.showMessageBoxSync({
    type: 'question',
    buttons: ['Quit', 'Cancel'],
    defaultId: 1,
    title: 'Quit Time Tracker?',
    message: 'Are you sure you want to quit?',
  });
  if (choice === 0) {
    unregisterAllShortcuts();
    destroyTray();
    stopHourlyChecker();
    app.exit(0);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    showDialogWindow();
  }
});
