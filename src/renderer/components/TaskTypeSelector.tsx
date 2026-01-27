import React, { useState, useRef, useEffect } from 'react';
import { TaskType } from '../../shared/types';

interface TaskTypeSelectorProps {
  taskTypes: TaskType[];
  selectedTypeIds: string[];
  onSelectionChange: (typeIds: string[]) => void;
  onCreateType: (name: string) => Promise<TaskType>;
  onDeleteType: (id: string) => Promise<void>;
}

function TaskTypeSelector({
  taskTypes,
  selectedTypeIds,
  onSelectionChange,
  onCreateType,
  onDeleteType,
}: TaskTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleType = (typeId: string) => {
    if (selectedTypeIds.includes(typeId)) {
      onSelectionChange(selectedTypeIds.filter(id => id !== typeId));
    } else {
      onSelectionChange([...selectedTypeIds, typeId]);
    }
  };

  const handleRemoveType = (e: React.MouseEvent, typeId: string) => {
    e.stopPropagation();
    onSelectionChange(selectedTypeIds.filter(id => id !== typeId));
  };

  const handleCreateType = async () => {
    const trimmedName = newTypeName.trim();
    if (!trimmedName) return;
    const newType = await onCreateType(trimmedName);
    setNewTypeName('');
    onSelectionChange([...selectedTypeIds, newType.id]);
  };

  const handleDeleteType = async (e: React.MouseEvent, typeId: string) => {
    e.stopPropagation();
    await onDeleteType(typeId);
  };

  const selectedTypes = taskTypes.filter(t => selectedTypeIds.includes(t.id));

  return (
    <div className="task-type-selector" ref={containerRef}>
      <div className="selected-types" onClick={() => setIsOpen(!isOpen)}>
        {selectedTypes.length === 0 ? (
          <span className="no-types-placeholder">+ Types</span>
        ) : (
          selectedTypes.map(type => (
            <span key={type.id} className="type-chip">
              {type.name}
              <button
                className="type-chip-remove"
                onClick={e => handleRemoveType(e, type.id)}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      {isOpen && (
        <div className="type-dropdown">
          {taskTypes.length === 0 ? (
            <div className="no-types-message">No types yet</div>
          ) : (
            taskTypes.map(type => (
              <div key={type.id} className="type-option">
                <label className="type-option-label">
                  <input
                    type="checkbox"
                    checked={selectedTypeIds.includes(type.id)}
                    onChange={() => handleToggleType(type.id)}
                  />
                  <span className="type-option-name">{type.name}</span>
                </label>
                <button
                  className="type-option-delete"
                  onClick={e => handleDeleteType(e, type.id)}
                  title="Delete type"
                >
                  ×
                </button>
              </div>
            ))
          )}
          <div className="create-new-type">
            <input
              type="text"
              placeholder="New type..."
              value={newTypeName}
              onChange={e => setNewTypeName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleCreateType();
                }
              }}
            />
            <button onClick={handleCreateType} disabled={!newTypeName.trim()}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskTypeSelector;
