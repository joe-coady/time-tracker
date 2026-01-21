import React, { useState, useEffect } from 'react';
import TaskDialog from './components/TaskDialog';
import EditView from './components/EditView';

type View = 'dialog' | 'edit';

function App() {
  const [view, setView] = useState<View>('dialog');

  useEffect(() => {
    // Check hash for routing
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/edit') {
        setView('edit');
      } else {
        setView('dialog');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return view === 'edit' ? <EditView /> : <TaskDialog />;
}

export default App;
