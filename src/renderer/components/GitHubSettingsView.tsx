import React, { useState, useEffect, useCallback } from 'react';
import { GitHubConfig } from '../../shared/types';

function GitHubSettingsView() {
  const [token, setToken] = useState('');
  const [orgs, setOrgs] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [devBranch, setDevBranch] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [username, setUsername] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    const config = await window.electronAPI.getGitHubConfig();
    if (config) {
      setToken(config.token);
      setOrgs(config.orgs.join(', '));
      if (config.devBranch) setDevBranch(config.devBranch);
      if (config.username) setUsername(config.username);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const isValid = token.trim() && orgs.trim();

  const buildConfig = (): GitHubConfig => ({
    token: token.trim(),
    orgs: orgs.split(',').map(o => o.trim()).filter(Boolean),
    ...(devBranch.trim() ? { devBranch: devBranch.trim() } : {}),
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
            Personal Access Token
            <a
              href="#"
              onClick={e => { e.preventDefault(); window.electronAPI.openExternal('https://github.com/settings/tokens/new?scopes=repo&description=Time+Tracker'); }}
              className="settings-label-link"
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
          <div className="settings-label-row">
            Organizations (comma-separated)
            <a
              href="#"
              onClick={e => { e.preventDefault(); window.electronAPI.openExternal('https://github.com/settings/organizations'); }}
              className="settings-label-link"
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
        <label>
          <div className="settings-label">
            Dev Branch (optional)
          </div>
          <input
            className="task-input"
            value={devBranch}
            onChange={e => setDevBranch(e.target.value)}
            placeholder="my-dev-branch"
          />
        </label>
      </div>
      <div className="settings-actions" style={{ marginTop: 0 }}>
        <button
          className="btn-primary"
          style={{ flex: 1 }}
          onClick={handleSave}
          disabled={!isValid}
        >
          {saved ? 'Saved!' : 'Save'}
        </button>
        <button
          className="btn-primary"
          style={{
            flex: 1,
            backgroundColor: testStatus === 'success' ? '#28a745'
              : testStatus === 'failed' ? '#dc3545'
              : undefined,
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
