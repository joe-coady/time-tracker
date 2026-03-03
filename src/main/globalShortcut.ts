import { globalShortcut } from 'electron';
import { showDialogWindow } from './windows';
import { readHotkeyConfig } from './storage';

const DEFAULT_HOTKEY = 'Control+Option+Space';

function getHotkey(): string {
  const config = readHotkeyConfig();
  return config?.showDialog || DEFAULT_HOTKEY;
}

export function registerGlobalShortcut(): boolean {
  const hotkey = getHotkey();
  const registered = globalShortcut.register(hotkey, () => {
    showDialogWindow();
  });

  if (!registered) {
    console.error(`Failed to register global shortcut: ${hotkey}`);
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
