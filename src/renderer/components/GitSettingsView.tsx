import React, { useState, useEffect, useCallback } from 'react';
import { GitRepoEntry, GitConfig } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export default function GitSettingsView() {
  const [config, setConfig] = useState<GitConfig | null>(null);
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');

  const loadConfig = useCallback(async () => {
    const loaded = await window.electronAPI.getGitConfig();
    setConfig(loaded || { repos: [] });
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleAdd = async () => {
    if (!config || !newName.trim() || !newPath.trim()) return;
    const entry: GitRepoEntry = {
      id: uuidv4(),
      name: newName.trim(),
      path: newPath.trim(),
    };
    const updated = { repos: [...config.repos, entry] };
    await window.electronAPI.saveGitConfig(updated);
    setConfig(updated);
    setNewName('');
    setNewPath('');
  };

  const handleDelete = async (id: string) => {
    if (!config) return;
    const updated = { repos: config.repos.filter(r => r.id !== id) };
    await window.electronAPI.saveGitConfig(updated);
    setConfig(updated);
  };

  if (!config) return null;

  return (
    <div className="settings-section">
      <h3>Git Repositories</h3>
      <p className="settings-description">Manage local git repositories that appear in the Git Changes view.</p>

      <div className="config-files-settings-list">
        {config.repos.map(repo => (
          <div key={repo.id} className="config-files-settings-item">
            <div className="config-files-settings-item-info">
              <span className="config-files-settings-item-name">{repo.name}</span>
              <span className="config-files-settings-item-path">{repo.path}</span>
            </div>
            <button
              className="config-files-settings-delete"
              onClick={() => handleDelete(repo.id)}
            >
              Delete
            </button>
          </div>
        ))}
        {config.repos.length === 0 && (
          <div className="config-files-settings-empty">No repositories added yet.</div>
        )}
      </div>

      <div className="config-files-settings-add">
        <input
          type="text"
          placeholder="Display name (e.g. my-app)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="config-files-settings-input"
        />
        <input
          type="text"
          placeholder="Absolute path (e.g. /Users/joe/repo/my-app)"
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
