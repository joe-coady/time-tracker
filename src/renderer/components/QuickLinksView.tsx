import React, { useState, useEffect, useCallback } from 'react';
import { QuickLinkRule } from '../../shared/types';

export default function QuickLinksView() {
  const [rules, setRules] = useState<QuickLinkRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPattern, setNewPattern] = useState('');
  const [newTarget, setNewTarget] = useState('');

  const loadRules = useCallback(async () => {
    const loaded = await window.electronAPI.getQuickLinkRules();
    setRules(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleAdd = async () => {
    const pattern = newPattern.trim();
    const target = newTarget.trim();
    if (!pattern || !target) return;
    await window.electronAPI.addQuickLinkRule(pattern, target);
    setNewPattern('');
    setNewTarget('');
    await loadRules();
  };

  const handleDelete = async (id: string) => {
    await window.electronAPI.deleteQuickLinkRule(id);
    await loadRules();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  if (loading) {
    return (
      <div className="settings-tab-content">
        <div className="empty-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="settings-tab-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="entry-count">{rules.length} rules</span>
      </div>

      <div className="task-types-list">
        {rules.length === 0 ? (
          <div className="empty-state">No quick link rules yet. Add one below.</div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="task-type-row">
              <div className="quick-link-rule">
                <code className="quick-link-pattern">{rule.linkPattern}</code>
                <span className="quick-link-arrow">&rarr;</span>
                <span className="quick-link-target">{rule.linkTarget}</span>
                <button
                  className="delete-button"
                  onClick={() => handleDelete(rule.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="quick-link-add-row">
        <input
          type="text"
          className="task-type-input"
          placeholder="Pattern (e.g. INCPT-\d+)"
          value={newPattern}
          onChange={(e) => setNewPattern(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <input
          type="text"
          className="task-type-input"
          placeholder="URL (e.g. https://jira.com/browse/$0)"
          value={newTarget}
          onChange={(e) => setNewTarget(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="submit-button"
          onClick={handleAdd}
          disabled={!newPattern.trim() || !newTarget.trim()}
        >
          Add
        </button>
      </div>
    </div>
  );
}
