import React, { useState, useEffect, useCallback } from 'react';
import { JiraConfig } from '../../shared/types';

function JiraSettingsView() {
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [ticketPattern, setTicketPattern] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  const loadConfig = useCallback(async () => {
    const config = await window.electronAPI.getJiraConfig();
    if (config) {
      setBaseUrl(config.baseUrl);
      setEmail(config.email);
      setApiToken(config.apiToken);
      setTicketPattern(config.ticketPattern ?? '');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const isValid = baseUrl.trim() && email.trim() && apiToken.trim();

  const handleSave = async () => {
    if (!isValid) return;
    const config: JiraConfig = {
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      email: email.trim(),
      apiToken: apiToken.trim(),
      ticketPattern: ticketPattern.trim() || undefined,
    };
    await window.electronAPI.saveJiraConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    if (!isValid) return;
    setTestStatus('testing');
    const config: JiraConfig = {
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      email: email.trim(),
      apiToken: apiToken.trim(),
      ticketPattern: ticketPattern.trim() || undefined,
    };
    const ok = await window.electronAPI.testJiraConnection(config);
    setTestStatus(ok ? 'success' : 'failed');
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
          <div className="settings-label">Base URL</div>
          <input
            className="task-input"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://mycompany.atlassian.net"
          />
        </label>
        <label>
          <div className="settings-label">Email</div>
          <input
            className="task-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </label>
        <label>
          <div className="settings-label-row">
            API Token
            <a
              href="#"
              onClick={e => { e.preventDefault(); window.electronAPI.openExternal('https://id.atlassian.com/manage-profile/security/api-tokens'); }}
              className="settings-label-link"
            >
              Get token
            </a>
          </div>
          <input
            className="task-input"
            type="password"
            value={apiToken}
            onChange={e => setApiToken(e.target.value)}
            placeholder="Your Atlassian API token"
          />
        </label>
        <label>
          <div className="settings-label">
            Ticket Pattern
            <span className="settings-label-hint">
              Regex to extract ticket keys from PR titles
            </span>
          </div>
          <input
            className="task-input"
            value={ticketPattern}
            onChange={e => setTicketPattern(e.target.value)}
            placeholder="[A-Z]+-\d+"
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
            : testStatus === 'success' ? 'Connected!'
            : testStatus === 'failed' ? 'Failed - Retry'
            : 'Test Connection'}
        </button>
      </div>
    </div>
  );
}

export default JiraSettingsView;
