import React, { useState } from 'react';
import QuickLinksView from './QuickLinksView';
import JiraSettingsView from './JiraSettingsView';
import GitHubSettingsView from './GitHubSettingsView';
import HotkeySettingsView from './HotkeySettingsView';

type SettingsTab = 'quick-links' | 'jira' | 'github' | 'hotkeys';

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('quick-links');

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
      </div>
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'quick-links' ? 'active' : ''}`}
          onClick={() => setActiveTab('quick-links')}
        >
          Quick Links
        </button>
        <button
          className={`settings-tab ${activeTab === 'jira' ? 'active' : ''}`}
          onClick={() => setActiveTab('jira')}
        >
          Jira
        </button>
        <button
          className={`settings-tab ${activeTab === 'github' ? 'active' : ''}`}
          onClick={() => setActiveTab('github')}
        >
          GitHub
        </button>
        <button
          className={`settings-tab ${activeTab === 'hotkeys' ? 'active' : ''}`}
          onClick={() => setActiveTab('hotkeys')}
        >
          Hotkeys
        </button>
      </div>
      <div className="settings-content">
        {activeTab === 'quick-links' && <QuickLinksView />}
        {activeTab === 'jira' && <JiraSettingsView />}
        {activeTab === 'github' && <GitHubSettingsView />}
        {activeTab === 'hotkeys' && <HotkeySettingsView />}
      </div>
    </div>
  );
}
