import React, { useState, useEffect } from 'react';
import TaskDialog from './components/TaskDialog';
import EditView from './components/EditView';
import TaskTypesView from './components/TaskTypesView';
import ExportView from './components/ExportView';
import NotesView from './components/NotesView';
import NotebookView from './components/NotebookView';
import SettingsView from './components/SettingsView';
import GitHubPRsView from './components/GitHubPRsView';
import QuickLaunchView from './components/QuickLaunchView';

type View = 'dialog' | 'edit' | 'task-types' | 'export' | 'notes' | 'notebook' | 'settings' | 'github-prs' | 'quick-launch';

function App() {
  const [view, setView] = useState<View>('dialog');

  useEffect(() => {
    // Check hash for routing
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/edit') {
        setView('edit');
      } else if (hash === '#/task-types') {
        setView('task-types');
      } else if (hash === '#/export') {
        setView('export');
      } else if (hash === '#/notes') {
        setView('notes');
      } else if (hash === '#/notebook') {
        setView('notebook');
      } else if (hash === '#/settings') {
        setView('settings');
      } else if (hash === '#/github-prs') {
        setView('github-prs');
      } else if (hash === '#/quick-launch') {
        setView('quick-launch');
      } else {
        setView('dialog');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (view === 'edit') return <EditView />;
  if (view === 'task-types') return <TaskTypesView />;
  if (view === 'export') return <ExportView />;
  if (view === 'notes') return <NotesView />;
  if (view === 'notebook') return <NotebookView />;
  if (view === 'settings') return <SettingsView />;
  if (view === 'github-prs') return <GitHubPRsView />;
  if (view === 'quick-launch') return <QuickLaunchView />;
  return <TaskDialog />;
}

export default App;
