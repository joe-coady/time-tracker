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
      <div className="task-types-container">
        <div className="empty-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="task-types-container">
      <div className="task-types-header">
        <h1 className="task-types-title">Jira Settings</h1>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        <label>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Base URL</div>
          <input
            className="task-input"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://mycompany.atlassian.net"
          />
        </label>
        <label>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Email</div>
          <input
            className="task-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </label>
        <label>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            API Token
            <a
              href="#"
              onClick={e => { e.preventDefault(); window.electronAPI.openExternal('https://id.atlassian.com/manage-profile/security/api-tokens'); }}
              style={{ fontSize: '11px', color: '#007aff', textDecoration: 'none', cursor: 'pointer' }}
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
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            Ticket Pattern
            <span style={{ fontSize: '11px', color: '#999', marginLeft: '6px' }}>
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
            : testStatus === 'success' ? 'Connected!'
            : testStatus === 'failed' ? 'Failed - Retry'
            : 'Test Connection'}
        </button>
      </div>
    </div>
  );
}

export default JiraSettingsView;
