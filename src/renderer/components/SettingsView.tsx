import React, { useState } from 'react';
import TaskTypesView from './TaskTypesView';
import QuickLinksView from './QuickLinksView';
import JiraSettingsView from './JiraSettingsView';
import GitHubSettingsView from './GitHubSettingsView';
import HotkeySettingsView from './HotkeySettingsView';
import KanbanSettingsView from './KanbanSettingsView';
import TerminalSettingsView from './TerminalSettingsView';
import ConfigFilesSettingsView from './ConfigFilesSettingsView';
import ClaudeSettingsView from './ClaudeSettingsView';
import GoogleCalendarSettingsView from './GoogleCalendarSettingsView';
import GitSettingsView from './GitSettingsView';

type SettingsTab = 'task-types' | 'quick-links' | 'jira' | 'github' | 'hotkeys' | 'kanban' | 'terminal' | 'config-files' | 'claude' | 'google-calendar' | 'git';

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('task-types');

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
      </div>
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'task-types' ? 'active' : ''}`}
          onClick={() => setActiveTab('task-types')}
        >
          Task Types
        </button>
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
        <button
          className={`settings-tab ${activeTab === 'kanban' ? 'active' : ''}`}
          onClick={() => setActiveTab('kanban')}
        >
          Kanban
        </button>
        <button
          className={`settings-tab ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => setActiveTab('terminal')}
        >
          Terminal
        </button>
        <button
          className={`settings-tab ${activeTab === 'config-files' ? 'active' : ''}`}
          onClick={() => setActiveTab('config-files')}
        >
          Config Files
        </button>
        <button
          className={`settings-tab ${activeTab === 'claude' ? 'active' : ''}`}
          onClick={() => setActiveTab('claude')}
        >
          Claude
        </button>
        <button
          className={`settings-tab ${activeTab === 'google-calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('google-calendar')}
        >
          Calendar
        </button>
        <button
          className={`settings-tab ${activeTab === 'git' ? 'active' : ''}`}
          onClick={() => setActiveTab('git')}
        >
          Git
        </button>
      </div>
      <div className="settings-content">
        {activeTab === 'task-types' && <TaskTypesView />}
        {activeTab === 'quick-links' && <QuickLinksView />}
        {activeTab === 'jira' && <JiraSettingsView />}
        {activeTab === 'github' && <GitHubSettingsView />}
        {activeTab === 'hotkeys' && <HotkeySettingsView />}
        {activeTab === 'kanban' && <KanbanSettingsView />}
        {activeTab === 'terminal' && <TerminalSettingsView />}
        {activeTab === 'config-files' && <ConfigFilesSettingsView />}
        {activeTab === 'claude' && <ClaudeSettingsView />}
        {activeTab === 'google-calendar' && <GoogleCalendarSettingsView />}
        {activeTab === 'git' && <GitSettingsView />}
      </div>
    </div>
  );
}
