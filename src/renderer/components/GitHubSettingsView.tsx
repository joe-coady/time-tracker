import React, { useState, useEffect, useCallback } from 'react';
import { GitHubConfig } from '../../shared/types';

function GitHubSettingsView() {
  const [token, setToken] = useState('');
  const [orgs, setOrgs] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [username, setUsername] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    const config = await window.electronAPI.getGitHubConfig();
    if (config) {
      setToken(config.token);
      setOrgs(config.orgs.join(', '));
      if (config.username) setUsername(config.username);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const isValid = token.trim() && orgs.trim();

  const buildConfig = (): GitHubConfig => ({
    token: token.trim(),
    orgs: orgs.split(',').map(o => o.trim()).filter(Boolean),
  });

  const handleSave = async () => {
    if (!isValid) return;
    await window.electronAPI.saveGitHubConfig(buildConfig());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    if (!isValid) return;
    setTestStatus('testing');
    const result = await window.electronAPI.testGitHubConnection(buildConfig());
    if (result) {
      setTestStatus('success');
      setUsername(result);
    } else {
      setTestStatus('failed');
      setUsername(null);
    }
  };

  if (loading) {
    return (
      <div className="task-types-container">
        <div className="empty-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="task-types-container">
      <div className="task-types-header">
        <h1 className="task-types-title">GitHub Settings</h1>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        <label>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Personal Access Token
            <a
              href="#"
              onClick={e => { e.preventDefault(); window.electronAPI.openExternal('https://github.com/settings/tokens/new?scopes=repo&description=Time+Tracker'); }}
              style={{ fontSize: '11px', color: '#007aff', textDecoration: 'none', cursor: 'pointer' }}
            >
              Get token
            </a>
          </div>
          <input
            className="task-input"
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxx"
          />
        </label>
        <label>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Organizations (comma-separated)
            <a
              href="#"
              onClick={e => { e.preventDefault(); window.electronAPI.openExternal('https://github.com/settings/organizations'); }}
              style={{ fontSize: '11px', color: '#007aff', textDecoration: 'none', cursor: 'pointer' }}
            >
              Your orgs
            </a>
          </div>
          <input
            className="task-input"
            value={orgs}
            onChange={e => setOrgs(e.target.value)}
            placeholder="my-org, another-org"
          />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="submit-button"
          style={{ flex: 1 }}
          onClick={handleSave}
          disabled={!isValid}
        >
          {saved ? 'Saved!' : 'Save'}
        </button>
        <button
          className="submit-button"
          style={{
            flex: 1,
            backgroundColor: testStatus === 'success' ? '#28a745'
              : testStatus === 'failed' ? '#dc3545'
              : '#007aff',
          }}
          onClick={handleTest}
          disabled={!isValid || testStatus === 'testing'}
        >
          {testStatus === 'testing' ? 'Testing...'
            : testStatus === 'success' ? `Connected as ${username}!`
            : testStatus === 'failed' ? 'Failed - Retry'
            : 'Test Connection'}
        </button>
      </div>
    </div>
  );
}

export default GitHubSettingsView;
