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
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
          Configure the columns on your kanban board. Hidden columns map their tasks to a visible column.
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Name</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', width: '60px' }}>Hidden</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', width: '140px' }}>Mapped To</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Jira Statuses</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', width: '100px' }}>Order</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: '6px 8px' }}>
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => updateColumn(i, { name: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="Column name"
                  />
                </td>
                <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                  <input
                    type="checkbox"
                    checked={!!col.hidden}
                    onChange={(e) => updateColumn(i, {
                      hidden: e.target.checked || undefined,
                      mappedTo: e.target.checked ? (col.mappedTo || visibleColumns[0]?.name || '') : undefined,
                    })}
                  />
                </td>
                <td style={{ padding: '6px 8px' }}>
                  {col.hidden ? (
                    <select
                      value={col.mappedTo || ''}
                      onChange={(e) => updateColumn(i, { mappedTo: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    >
                      <option value="">-- Select --</option>
                      {columns.filter(c => !c.hidden && c.name.trim() && c.name !== col.name).map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ color: '#555' }}>-</span>
                  )}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <input
                    type="text"
                    value={(col.jiraStatuses || []).join(', ')}
                    onChange={(e) => {
                      const statuses = e.target.value
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean);
                      updateColumn(i, { jiraStatuses: statuses.length > 0 ? statuses : undefined });
                    }}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. To Do, Open"
                  />
                </td>
                <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '12px', marginRight: '4px' }}
                    onClick={() => moveColumn(i, -1)}
                    disabled={i === 0}
                  >
                    Up
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '12px' }}
                    onClick={() => moveColumn(i, 1)}
                    disabled={i === columns.length - 1}
                  >
                    Down
                  </button>
                </td>
                <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                  <button
                    className="btn-danger"
                    style={{ padding: '2px 8px', fontSize: '12px' }}
                    onClick={() => deleteColumn(i)}
                    disabled={columns.length <= 2}
                    title="Delete column"
                  >
                    X
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
          <button className="btn-secondary" onClick={addColumn}>
            + Add Column
          </button>
          <button className="btn-secondary" onClick={resetToDefaults}>
            Reset to Defaults
          </button>
        </div>

        {error && (
          <div style={{ color: '#f87171', fontSize: '13px', marginTop: '8px' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
          <button className="btn-primary" onClick={handleSave}>
            Save
          </button>
          {saved && <span style={{ color: '#4ade80', fontSize: '13px' }}>Saved!</span>}
        </div>
      </div>
    </div>
  );
}
