import { globalShortcut } from 'electron';
import { showDialogWindow } from './windows';

const HOTKEY = 'Control+Option+Space';

export function registerGlobalShortcut(): boolean {
  const registered = globalShortcut.register(HOTKEY, () => {
    showDialogWindow();
  });

  if (!registered) {
    console.error(`Failed to register global shortcut: ${HOTKEY}`);
  }

  return registered;
}

export function unregisterGlobalShortcut(): void {
  globalShortcut.unregister(HOTKEY);
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
}
