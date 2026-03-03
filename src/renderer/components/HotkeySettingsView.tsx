import React, { useState, useEffect, useCallback, useRef } from 'react';

const DEFAULT_HOTKEY = 'Control+Option+Space';
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
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);

  const loadConfig = useCallback(async () => {
    const config = await window.electronAPI.getHotkeyConfig();
    if (config) {
      setHotkey(config.showDialog);
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
        setHotkey(accelerator);
        setRecording(false);
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  const handleSave = async () => {
    await window.electronAPI.saveHotkeyConfig({ showDialog: hotkey });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setHotkey(DEFAULT_HOTKEY);
  };

  if (loading) return <div className="settings-tab-content">Loading...</div>;

  return (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h3>Global Shortcuts</h3>
        <div className="form-group">
          <label>"What are you working on?" dialog</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={recording ? 'Press a key combo...' : hotkey}
              readOnly={recording}
              onChange={(e) => setHotkey(e.target.value)}
              style={{
                flex: 1,
                fontFamily: 'monospace',
                backgroundColor: recording ? '#2a2a3e' : undefined,
                borderColor: recording ? '#7c6fe0' : undefined,
              }}
            />
            <button
              className={recording ? 'btn-danger' : 'btn-secondary'}
              onClick={() => setRecording(!recording)}
            >
              {recording ? 'Cancel' : 'Record'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
          <button className="btn-primary" onClick={handleSave}>
            Save
          </button>
          <button className="btn-secondary" onClick={handleReset}>
            Reset to Default
          </button>
          {saved && <span style={{ color: '#4ade80', fontSize: '13px' }}>Saved!</span>}
        </div>
      </div>
    </div>
  );
}
