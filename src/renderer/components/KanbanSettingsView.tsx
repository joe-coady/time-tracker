import React, { useState, useEffect, useCallback } from 'react';
import { KanbanColumnConfig, DEFAULT_KANBAN_COLUMNS } from '../../shared/types';

export default function KanbanSettingsView() {
  const [columns, setColumns] = useState<KanbanColumnConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadColumns = useCallback(async () => {
    const cols = await window.electronAPI.getKanbanColumns();
    setColumns(cols);
    setLoading(false);
  }, []);

  useEffect(() => { loadColumns(); }, [loadColumns]);

  const visibleColumns = columns.filter(c => !c.hidden);

  const updateColumn = (index: number, updates: Partial<KanbanColumnConfig>) => {
    setColumns(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
    setError(null);
  };

  const addColumn = () => {
    setColumns(prev => [...prev, { name: '' }]);
    setError(null);
  };

  const deleteColumn = (index: number) => {
    setColumns(prev => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const moveColumn = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= columns.length) return;
    setColumns(prev => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  };

  const resetToDefaults = () => {
    setColumns(DEFAULT_KANBAN_COLUMNS.map(c => ({ ...c })));
    setError(null);
  };

  const validate = (): string | null => {
    const names = columns.map(c => c.name.trim());
    if (names.some(n => !n)) return 'All columns must have a name.';
    if (new Set(names).size !== names.length) return 'Column names must be unique.';
    const visibleNames = new Set(columns.filter(c => !c.hidden).map(c => c.name.trim()));
    if (visibleNames.size === 0) return 'At least one column must be visible.';
    for (const col of columns) {
      if (col.hidden && !col.mappedTo) return `Hidden column "${col.name}" must have a "Mapped To" column set.`;
      if (col.hidden && col.mappedTo && !visibleNames.has(col.mappedTo)) {
        return `Hidden column "${col.name}" is mapped to "${col.mappedTo}" which is not a visible column.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    // Clean up data before saving
    const cleaned = columns.map(c => {
      const col: KanbanColumnConfig = { name: c.name.trim() };
      if (c.hidden) {
        col.hidden = true;
        col.mappedTo = c.mappedTo;
      }
      if (c.jiraStatuses && c.jiraStatuses.length > 0) {
        col.jiraStatuses = c.jiraStatuses;
      }
      if (c.columnType) {
        col.columnType = c.columnType;
      }
      return col;
    });
    await window.electronAPI.saveKanbanColumns(cleaned);
    setSaved(true);
    setError(null);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="settings-tab-content">Loading...</div>;

  return (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h3>Kanban Columns</h3>
        <p className="settings-description">
          Configure the columns on your kanban board. Hidden columns map their tasks to a visible column.
        </p>

        <div className="kanban-column-list">
          {columns.map((col, i) => (
            <div key={i} className="kanban-column-row">
              <div className="kanban-column-main">
                <input
                  type="text"
                  className="task-input"
                  value={col.name}
                  onChange={(e) => updateColumn(i, { name: e.target.value })}
                  placeholder="Column name"
                />
                <label className="settings-inline-row" style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={!!col.hidden}
                    onChange={(e) => updateColumn(i, {
                      hidden: e.target.checked || undefined,
                      mappedTo: e.target.checked ? (col.mappedTo || visibleColumns[0]?.name || '') : undefined,
                    })}
                  />
                  Hidden
                </label>
                <div className="kanban-column-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => moveColumn(i, -1)}
                    disabled={i === 0}
                  >
                    Up
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => moveColumn(i, 1)}
                    disabled={i === columns.length - 1}
                  >
                    Down
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => deleteColumn(i)}
                    disabled={columns.length <= 2}
                    title="Delete column"
                  >
                    X
                  </button>
                </div>
              </div>
              <div className="kanban-column-fields">
                {col.hidden && (
                  <div className="kanban-column-field">
                    <span className="kanban-column-field-label">Mapped to</span>
                    <select
                      className="task-input"
                      value={col.mappedTo || ''}
                      onChange={(e) => updateColumn(i, { mappedTo: e.target.value })}
                    >
                      <option value="">-- Select --</option>
                      {columns.filter(c => !c.hidden && c.name.trim() && c.name !== col.name).map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="kanban-column-field">
                  <span className="kanban-column-field-label">Column type</span>
                  <select
                    className="task-input"
                    value={col.columnType || ''}
                    onChange={(e) => updateColumn(i, { columnType: (e.target.value || undefined) as KanbanColumnConfig['columnType'] })}
                  >
                    <option value="">--</option>
                    <option value="working">Working</option>
                    <option value="todo">Todo</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div className="kanban-column-field">
                  <span className="kanban-column-field-label">Jira statuses</span>
                  <input
                    type="text"
                    className="task-input"
                    value={(col.jiraStatuses || []).join(', ')}
                    onChange={(e) => {
                      const statuses = e.target.value
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean);
                      updateColumn(i, { jiraStatuses: statuses.length > 0 ? statuses : undefined });
                    }}
                    placeholder="e.g. To Do, Open"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="settings-actions" style={{ marginTop: 0 }}>
          <button className="btn-secondary" onClick={addColumn}>
            + Add Column
          </button>
          <button className="btn-secondary" onClick={resetToDefaults}>
            Reset to Defaults
          </button>
        </div>

        {error && <div className="settings-error">{error}</div>}

        <div className="settings-actions">
          <button className="btn-primary" onClick={handleSave}>
            Save
          </button>
          {saved && <span className="settings-saved">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
