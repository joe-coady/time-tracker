import React, { useState } from 'react';
import TaskTypesView from './TaskTypesView';
import QuickLinksView from './QuickLinksView';
import JiraSettingsView from './JiraSettingsView';
import GitHubSettingsView from './GitHubSettingsView';
import HotkeySettingsView from './HotkeySettingsView';
import KanbanSettingsView from './KanbanSettingsView';

type SettingsTab = 'task-types' | 'quick-links' | 'jira' | 'github' | 'hotkeys' | 'kanban';

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
      </div>
      <div className="settings-content">
        {activeTab === 'task-types' && <TaskTypesView />}
        {activeTab === 'quick-links' && <QuickLinksView />}
        {activeTab === 'jira' && <JiraSettingsView />}
        {activeTab === 'github' && <GitHubSettingsView />}
        {activeTab === 'hotkeys' && <HotkeySettingsView />}
        {activeTab === 'kanban' && <KanbanSettingsView />}
      </div>
    </div>
  );
}
