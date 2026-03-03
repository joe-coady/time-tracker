import { globalShortcut } from 'electron';
import { showDialogWindow, showQuickLaunchWindow } from './windows';
import { readHotkeyConfig } from './storage';

const DEFAULT_HOTKEY = 'Control+Option+Space';
const DEFAULT_QUICK_LAUNCH_HOTKEY = 'Command+`';

function getHotkey(): string {
  const config = readHotkeyConfig();
  return config?.showDialog || DEFAULT_HOTKEY;
}

function getQuickLaunchHotkey(): string {
  const config = readHotkeyConfig();
  return config?.quickLaunch || DEFAULT_QUICK_LAUNCH_HOTKEY;
}

export function registerGlobalShortcut(): boolean {
  const hotkey = getHotkey();
  const registered = globalShortcut.register(hotkey, () => {
    showDialogWindow();
  });

  if (!registered) {
    console.error(`Failed to register global shortcut: ${hotkey}`);
  }

  const quickLaunchHotkey = getQuickLaunchHotkey();
  const qlRegistered = globalShortcut.register(quickLaunchHotkey, () => {
    showQuickLaunchWindow();
  });

  if (!qlRegistered) {
    console.error(`Failed to register quick launch shortcut: ${quickLaunchHotkey}`);
  }

  return registered;
}

export function reregisterShortcuts(): void {
  globalShortcut.unregisterAll();
  registerGlobalShortcut();
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
}
