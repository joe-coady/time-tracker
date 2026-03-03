import React, { useState } from 'react';
import { useTaskTypes } from '../hooks/useTaskTypes';

export default function TaskTypesView() {
  const { taskTypes, loading, addTaskType, updateTaskType } = useTaskTypes();
  const [newTypeName, setNewTypeName] = useState('');
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const handleAddType = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    await addTaskType(trimmed);
    setNewTypeName('');
  };

  const handleChange = (id: string, value: string) => {
    setLocalValues(prev => ({ ...prev, [id]: value }));
  };

  const handleBlur = async (id: string, originalName: string) => {
    const localValue = localValues[id];
    if (localValue === undefined) return;

    const trimmed = localValue.trim();
    if (trimmed && trimmed !== originalName) {
      await updateTaskType(id, trimmed);
    }
    setLocalValues(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, id?: string, originalName?: string) => {
    if (e.key === 'Enter') {
      if (id && originalName !== undefined) {
        (e.target as HTMLInputElement).blur();
      } else {
        handleAddType();
      }
    } else if (e.key === 'Escape' && id) {
      setLocalValues(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      (e.target as HTMLInputElement).blur();
    }
  };

  if (loading) {
    return (
      <div className="settings-tab-content">
        <div className="task-types-header">
          <h1 className="task-types-title">Task Types</h1>
        </div>
        <div className="task-types-list">
          <div className="empty-state">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-tab-content">
      <div className="task-types-header">
        <h1 className="task-types-title">Task Types</h1>
        <span className="entry-count">{taskTypes.length} types</span>
      </div>

      <div className="task-types-list">
        {taskTypes.length === 0 ? (
          <div className="empty-state">No task types yet. Add one below.</div>
        ) : (
          taskTypes.map((type) => (
            <div key={type.id} className="task-type-row">
              <input
                type="text"
                className="task-type-input"
                value={localValues[type.id] ?? type.name}
                onChange={(e) => handleChange(type.id, e.target.value)}
                onBlur={() => handleBlur(type.id, type.name)}
                onKeyDown={(e) => handleKeyDown(e, type.id, type.name)}
              />
            </div>
          ))
        )}
      </div>

      <div className="add-type-row">
        <input
          type="text"
          className="task-type-input"
          placeholder="Add new type..."
          value={newTypeName}
          onChange={(e) => setNewTypeName(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e)}
        />
        <button
          className="submit-button"
          onClick={handleAddType}
          disabled={!newTypeName.trim()}
        >
          Add
        </button>
      </div>
    </div>
  );
}
