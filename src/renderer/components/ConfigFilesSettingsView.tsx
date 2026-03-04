import React, { useState, useEffect, useCallback } from 'react';
import { ConfigFileEntry, ConfigFilesConfig } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export default function ConfigFilesSettingsView() {
  const [config, setConfig] = useState<ConfigFilesConfig | null>(null);
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');

  const loadConfig = useCallback(async () => {
    const loaded = await window.electronAPI.getConfigFilesConfig();
    setConfig(loaded);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleAdd = async () => {
    if (!config || !newName.trim() || !newPath.trim()) return;
    const entry: ConfigFileEntry = {
      id: uuidv4(),
      name: newName.trim(),
      path: newPath.trim(),
    };
    const updated = { files: [...config.files, entry] };
    await window.electronAPI.saveConfigFilesConfig(updated);
    setConfig(updated);
    setNewName('');
    setNewPath('');
  };

  const handleDelete = async (id: string) => {
    if (!config) return;
    const updated = { files: config.files.filter(f => f.id !== id) };
    await window.electronAPI.saveConfigFilesConfig(updated);
    setConfig(updated);
  };

  const handleReset = async () => {
    const defaults = await window.electronAPI.resetConfigFilesConfig();
    setConfig(defaults);
  };

  if (!config) return null;

  return (
    <div className="settings-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Config Files</h3>
        <button className="btn-secondary" onClick={handleReset}>
          Reset to Defaults
        </button>
      </div>
      <p className="settings-description">Manage the list of config files that appear in the Config Files editor.</p>

      <div className="config-files-settings-list">
        {config.files.map(file => (
          <div key={file.id} className="config-files-settings-item">
            <div className="config-files-settings-item-info">
              <span className="config-files-settings-item-name">{file.name}</span>
              <span className="config-files-settings-item-path">{file.path}</span>
            </div>
            <button
              className="config-files-settings-delete"
              onClick={() => handleDelete(file.id)}
            >
              Delete
            </button>
          </div>
        ))}
        {config.files.length === 0 && (
          <div className="config-files-settings-empty">No config files added yet.</div>
        )}
      </div>

      <div className="config-files-settings-add">
        <input
          type="text"
          placeholder="Display name (e.g. zshrc)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="config-files-settings-input"
        />
        <input
          type="text"
          placeholder="Absolute path (e.g. /Users/joe/.zshrc)"
          value={newPath}
          onChange={e => setNewPath(e.target.value)}
          className="config-files-settings-input config-files-settings-path-input"
        />
        <button
          className="config-files-settings-add-btn"
          onClick={handleAdd}
          disabled={!newName.trim() || !newPath.trim()}
        >
          Add
        </button>
      </div>
    </div>
  );
}
