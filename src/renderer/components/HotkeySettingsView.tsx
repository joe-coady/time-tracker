import React, { useState, useEffect, useCallback, useRef } from 'react';

const DEFAULT_HOTKEY = 'Control+Option+Space';
const DEFAULT_QUICK_LAUNCH = 'Command+`';
const IS_MAC = navigator.platform.toUpperCase().includes('MAC');

function keyEventToAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = [];

  if (e.ctrlKey) parts.push('Control');
  if (e.altKey) parts.push(IS_MAC ? 'Option' : 'Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push(IS_MAC ? 'Command' : 'Super');

  // Ignore standalone modifier keys
  const modifierKeys = ['Control', 'Alt', 'Shift', 'Meta'];
  if (modifierKeys.includes(e.key)) return null;

  // Need at least one modifier
  if (parts.length === 0) return null;

  // Map the main key — use e.code for reliable physical key detection
  // (e.key can return dead keys or composed characters with modifier combos)
  let key: string;
  const code = e.code;
  if (code.startsWith('Key')) key = code.slice(3); // KeyA → A
  else if (code.startsWith('Digit')) key = code.slice(5); // Digit1 → 1
  else if (code === 'Space') key = 'Space';
  else if (code === 'Minus') key = '-';
  else if (code === 'Equal') key = '=';
  else if (code === 'BracketLeft') key = '[';
  else if (code === 'BracketRight') key = ']';
  else if (code === 'Backslash') key = '\\';
  else if (code === 'Semicolon') key = ';';
  else if (code === 'Quote') key = "'";
  else if (code === 'Backquote') key = '`';
  else if (code === 'Comma') key = ',';
  else if (code === 'Period') key = '.';
  else if (code === 'Slash') key = '/';
  else if (code === 'ArrowUp') key = 'Up';
  else if (code === 'ArrowDown') key = 'Down';
  else if (code === 'ArrowLeft') key = 'Left';
  else if (code === 'ArrowRight') key = 'Right';
  else if (code === 'Escape') key = 'Escape';
  else if (code === 'Enter') key = 'Return';
  else if (code === 'Backspace') key = 'Backspace';
  else if (code === 'Delete') key = 'Delete';
  else if (code === 'Tab') key = 'Tab';
  else if (code.startsWith('F') && /^F\d+$/.test(code)) key = code; // F1–F12
  else key = e.key.length === 1 ? e.key.toUpperCase() : e.key;

  parts.push(key);
  return parts.join('+');
}

export default function HotkeySettingsView() {
  const [hotkey, setHotkey] = useState(DEFAULT_HOTKEY);
  const [quickLaunchHotkey, setQuickLaunchHotkey] = useState(DEFAULT_QUICK_LAUNCH);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [recording, setRecording] = useState<null | 'dialog' | 'quickLaunch'>(null);
  const recordingRef = useRef<null | 'dialog' | 'quickLaunch'>(null);

  const loadConfig = useCallback(async () => {
    const config = await window.electronAPI.getHotkeyConfig();
    if (config) {
      setHotkey(config.showDialog);
      if (config.quickLaunch) setQuickLaunchHotkey(config.quickLaunch);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!recordingRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const accelerator = keyEventToAccelerator(e as KeyboardEvent);
      if (accelerator) {
        if (recordingRef.current === 'dialog') {
          setHotkey(accelerator);
        } else {
          setQuickLaunchHotkey(accelerator);
        }
        setRecording(null);
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  const handleSave = async () => {
    await window.electronAPI.saveHotkeyConfig({ showDialog: hotkey, quickLaunch: quickLaunchHotkey });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setHotkey(DEFAULT_HOTKEY);
    setQuickLaunchHotkey(DEFAULT_QUICK_LAUNCH);
  };

  if (loading) return <div className="settings-tab-content">Loading...</div>;

  return (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h3>Global Shortcuts</h3>
        <div className="form-group">
          <label>"What are you working on?" dialog</label>
          <div className="settings-inline-row">
            <input
              type="text"
              className="task-input"
              value={recording === 'dialog' ? 'Press a key combo...' : hotkey}
              readOnly={recording === 'dialog'}
              onChange={(e) => setHotkey(e.target.value)}
              style={{
                flex: 1,
                fontFamily: 'monospace',
                backgroundColor: recording === 'dialog' ? '#2a2a3e' : undefined,
                borderColor: recording === 'dialog' ? '#7c6fe0' : undefined,
              }}
            />
            <button
              className={recording === 'dialog' ? 'btn-danger' : 'btn-secondary'}
              onClick={() => setRecording(recording === 'dialog' ? null : 'dialog')}
            >
              {recording === 'dialog' ? 'Cancel' : 'Record'}
            </button>
          </div>
        </div>
        <div className="form-group">
          <label>Quick Launch</label>
          <div className="settings-inline-row">
            <input
              type="text"
              className="task-input"
              value={recording === 'quickLaunch' ? 'Press a key combo...' : quickLaunchHotkey}
              readOnly={recording === 'quickLaunch'}
              onChange={(e) => setQuickLaunchHotkey(e.target.value)}
              style={{
                flex: 1,
                fontFamily: 'monospace',
                backgroundColor: recording === 'quickLaunch' ? '#2a2a3e' : undefined,
                borderColor: recording === 'quickLaunch' ? '#7c6fe0' : undefined,
              }}
            />
            <button
              className={recording === 'quickLaunch' ? 'btn-danger' : 'btn-secondary'}
              onClick={() => setRecording(recording === 'quickLaunch' ? null : 'quickLaunch')}
            >
              {recording === 'quickLaunch' ? 'Cancel' : 'Record'}
            </button>
          </div>
        </div>
        <div className="settings-actions">
          <button className="btn-primary" onClick={handleSave}>
            Save
          </button>
          <button className="btn-secondary" onClick={handleReset}>
            Reset to Default
          </button>
          {saved && <span className="settings-saved">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
