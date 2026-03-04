import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TerminalShortcut, TerminalConfig } from '../../shared/types';

export default function TerminalSettingsView() {
  const [shortcuts, setShortcuts] = useState<TerminalShortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const loadConfig = useCallback(async () => {
    const config = await window.electronAPI.getTerminalConfig();
    if (config) {
      setShortcuts(config.shortcuts);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    const config: TerminalConfig = { shortcuts };
    await window.electronAPI.saveTerminalConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addShortcut = () => {
    setShortcuts([...shortcuts, {
      id: uuidv4(),
      name: '',
      directory: '',
    }]);
  };

  const updateShortcut = (index: number, updates: Partial<TerminalShortcut>) => {
    const updated = [...shortcuts];
    updated[index] = { ...updated[index], ...updates };
    setShortcuts(updated);
  };

  const removeShortcut = (index: number) => {
    setShortcuts(shortcuts.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="settings-tab-content">
        <div className="empty-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h3>Terminal Shortcuts</h3>
        <p className="settings-description">
          Configure shortcuts to quickly open Terminal.app at specific directories with optional commands.
        </p>
      </div>
      <div className="terminal-shortcuts-list">
        {shortcuts.map((s, i) => (
          <div key={s.id} className="terminal-shortcut-card">
            <div className="terminal-shortcut-row">
              <label className="terminal-shortcut-field">
                <span className="settings-label">Name</span>
                <input
                  className="task-input"
                  value={s.name}
                  onChange={e => updateShortcut(i, { name: e.target.value })}
                  placeholder="e.g. incept-backend"
                />
              </label>
              <button
                className="terminal-shortcut-delete"
                onClick={() => removeShortcut(i)}
                title="Remove shortcut"
              >
                ×
              </button>
            </div>
            <label className="terminal-shortcut-field">
              <span className="settings-label">Directory</span>
              <input
                className="task-input"
                value={s.directory}
                onChange={e => updateShortcut(i, { directory: e.target.value })}
                placeholder="/Users/joe/repo/my-project"
              />
            </label>
            <label className="terminal-shortcut-field">
              <span className="settings-label">Command (optional)</span>
              <input
                className="task-input"
                value={s.command || ''}
                onChange={e => updateShortcut(i, { command: e.target.value || undefined })}
                placeholder="docker compose up -d"
              />
            </label>
          </div>
        ))}
      </div>
      <button
        className="btn-secondary"
        style={{ marginBottom: 16 }}
        onClick={addShortcut}
      >
        + Add Shortcut
      </button>
      <div className="settings-actions" style={{ marginTop: 0 }}>
        <button
          className="btn-primary"
          style={{ flex: 1 }}
          onClick={handleSave}
        >
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  );
}
