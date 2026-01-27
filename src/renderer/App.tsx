import React, { useState, useEffect } from 'react';
import TaskDialog from './components/TaskDialog';
import EditView from './components/EditView';
import TaskTypesView from './components/TaskTypesView';

type View = 'dialog' | 'edit' | 'task-types';

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
  return <TaskDialog />;
}

export default App;
