import React, { useState, useEffect, useCallback } from 'react';
import { ClaudeConfig } from '../../shared/types';

export default function ClaudeSettingsView() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const loadConfig = useCallback(async () => {
    const config = await window.electronAPI.getClaudeConfig();
    if (config) {
      setApiKey(config.apiKey);
      setModel(config.model ?? '');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    const config: ClaudeConfig = {
      apiKey: apiKey.trim(),
      model: model.trim() || undefined,
    };
    await window.electronAPI.saveClaudeConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
      <div className="settings-form">
        <label>
          <div className="settings-label-row">
            API Key
            <a
              href="#"
              onClick={e => { e.preventDefault(); window.electronAPI.openExternal('https://console.anthropic.com/settings/keys'); }}
              className="settings-label-link"
            >
              Get key
            </a>
          </div>
          <input
            className="task-input"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
          />
        </label>
        <label>
          <div className="settings-label">
            Model
            <span className="settings-label-hint">
              Leave blank for default (claude-sonnet-4-20250514)
            </span>
          </div>
          <input
            className="task-input"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="claude-sonnet-4-20250514"
          />
        </label>
      </div>
      <div className="settings-actions" style={{ marginTop: 0 }}>
        <button
          className="btn-primary"
          style={{ flex: 1 }}
          onClick={handleSave}
          disabled={!apiKey.trim()}
        >
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  );
}
