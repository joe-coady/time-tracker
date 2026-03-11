import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TerminalShortcut } from '../../shared/types';

export default function TerminalSettingsView() {
  const [shortcuts, setShortcuts] = useState<TerminalShortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<TerminalShortcut>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [scriptPath, setScriptPath] = useState('');
  const [scriptDir, setScriptDir] = useState('');
  const [scriptSaved, setScriptSaved] = useState(false);

  const toggleGroup = (dir: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  };

  const loadConfig = useCallback(async () => {
    const config = await window.electronAPI.getTerminalConfig();
    if (config) {
      setShortcuts(config.shortcuts);
      setExpandedGroups(new Set(['']));  // Only Uncategorized expanded by default
    }
    const sc = await window.electronAPI.getScriptConfig();
    if (sc) {
      setScriptPath(sc.scriptPath);
      setScriptDir(sc.scriptDir);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const grouped = useMemo(() => {
    const groups: Record<string, TerminalShortcut[]> = {};
    for (const s of shortcuts) {
      const key = s.directory?.trim() || '';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (!a) return -1;
      if (!b) return 1;
      return a.localeCompare(b);
    });
  }, [shortcuts]);

  const startEditing = (s: TerminalShortcut) => {
    setEditingId(s.id);
    setEditDraft({ name: s.name, directory: s.directory, command: s.command });
  };

  const cancelEditing = () => {
    // If editing a new shortcut with no name, remove it
    if (editingId) {
      const s = shortcuts.find(sc => sc.id === editingId);
      if (s && !s.name && !s.directory && !s.command) {
        setShortcuts(shortcuts.filter(sc => sc.id !== editingId));
      }
    }
    setEditingId(null);
    setEditDraft({});
  };

  const saveEditing = async () => {
    if (!editingId) return;
    const updated = shortcuts.map(s =>
      s.id === editingId ? { ...s, ...editDraft, command: editDraft.command || undefined } : s
    );
    setShortcuts(updated);
    await window.electronAPI.saveTerminalConfig({ shortcuts: updated });
    setEditingId(null);
    setEditDraft({});
  };

  const removeShortcut = async (id: string) => {
    const updated = shortcuts.filter(s => s.id !== id);
    setShortcuts(updated);
    setEditingId(null);
    setEditDraft({});
    await window.electronAPI.saveTerminalConfig({ shortcuts: updated });
  };

  const addShortcut = () => {
    const newId = uuidv4();
    const newShortcut: TerminalShortcut = { id: newId, name: '', directory: '' };
    setShortcuts([...shortcuts, newShortcut]);
    setEditingId(newId);
    setEditDraft({ name: '', directory: '', command: '' });
  };

  if (loading) {
    return (
      <div className="settings-tab-content">
        <div className="empty-state">Loading...</div>
      </div>
    );
  }

  const handleSaveScriptConfig = async () => {
    await window.electronAPI.saveScriptConfig({ scriptPath: scriptPath.trim(), scriptDir: scriptDir.trim() });
    setScriptSaved(true);
    setTimeout(() => setScriptSaved(false), 2000);
  };

  return (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h3>Ticket Script</h3>
        <p className="settings-description">
          Configure a script to run from kanban cards. The script receives the ticket ID and description as arguments.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <input
            className="task-input"
            value={scriptDir}
            onChange={e => setScriptDir(e.target.value)}
            placeholder="~/repo/my-project"
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="task-input"
              style={{ flex: 1 }}
              value={scriptPath}
              onChange={e => setScriptPath(e.target.value)}
              placeholder="node ./my-script.js"
            />
            <button className="btn-primary btn-sm" onClick={handleSaveScriptConfig}>
              {scriptSaved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </div>
      <div className="settings-section">
        <h3>Terminal Shortcuts</h3>
        <p className="settings-description">
          Configure shortcuts to quickly open Terminal.app at specific directories with optional commands.
        </p>
      </div>
      <button
        className="btn-secondary"
        style={{ marginBottom: 16 }}
        onClick={addShortcut}
      >
        + Add Shortcut
      </button>
      <div className="terminal-shortcuts-list">
        {grouped.map(([dir, items]) => {
          const groupKey = dir || '';
          const isExpanded = expandedGroups.has(groupKey);
          return (
          <div key={dir || '__uncategorized'} className="terminal-group">
            <div className="terminal-group-header" onClick={() => toggleGroup(groupKey)}>
              <span className="terminal-group-toggle">{isExpanded ? '▼' : '▶'}</span>
              <span className="terminal-group-text">{dir || 'Uncategorized'}</span>
              <span className="terminal-group-summary">{items.length} shortcut{items.length !== 1 ? 's' : ''}</span>
            </div>
            {isExpanded && <div className="terminal-group-entries">{items.map(s => (
              editingId === s.id ? (
                <div key={s.id} className="terminal-shortcut-card">
                  <label className="terminal-shortcut-field">
                    <span className="settings-label">Name</span>
                    <input
                      className="task-input"
                      value={editDraft.name ?? ''}
                      onChange={e => setEditDraft({ ...editDraft, name: e.target.value })}
                      placeholder="e.g. incept-backend"
                      autoFocus
                    />
                  </label>
                  <label className="terminal-shortcut-field">
                    <span className="settings-label">Directory</span>
                    <input
                      className="task-input"
                      value={editDraft.directory ?? ''}
                      onChange={e => setEditDraft({ ...editDraft, directory: e.target.value })}
                      placeholder="/Users/joe/repo/my-project"
                    />
                  </label>
                  <label className="terminal-shortcut-field">
                    <span className="settings-label">Command (optional)</span>
                    <input
                      className="task-input"
                      value={editDraft.command ?? ''}
                      onChange={e => setEditDraft({ ...editDraft, command: e.target.value })}
                      placeholder="docker compose up -d"
                    />
                  </label>
                  <div className="terminal-edit-actions">
                    <button className="btn-primary btn-sm" onClick={saveEditing}>Save</button>
                    <button className="btn-secondary btn-sm" onClick={cancelEditing}>Cancel</button>
                    <button
                      className="terminal-shortcut-delete btn-sm"
                      onClick={() => removeShortcut(s.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div key={s.id} className="terminal-compact-row" onClick={() => startEditing(s)}>
                  <div className="terminal-compact-info">
                    <span className="terminal-compact-name">{s.name || '(unnamed)'}</span>
                    {s.command && (
                      <>
                        <span className="terminal-compact-sep">—</span>
                        <span className="terminal-compact-command">{s.command}</span>
                      </>
                    )}
                  </div>
                  <button
                    className="terminal-compact-edit-btn"
                    onClick={(e) => { e.stopPropagation(); startEditing(s); }}
                  >
                    Edit
                  </button>
                </div>
              )
            ))}</div>}
          </div>
          );
        })}
        {shortcuts.length === 0 && (
          <div className="empty-state">No shortcuts configured. Click "+ Add Shortcut" to get started.</div>
        )}
      </div>
    </div>
  );
}
