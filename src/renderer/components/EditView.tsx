import React, { useState, useMemo } from 'react';
import { useTaskData } from '../hooks/useTaskData';
import { TaskEntry } from '../../shared/types';

interface GroupedTasks {
  [date: string]: TaskEntry[];
}

function EditView() {
  const { tasks, loading, updateEntry, deleteEntry } = useTaskData();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [completedFilter, setCompletedFilter] = useState<'all' | 'completed' | 'not-completed'>('all');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => {
    // Start with today expanded
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return new Set([today]);
  });

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Filter by completed status
      if (completedFilter === 'completed' && !task.completed) {
        return false;
      }
      if (completedFilter === 'not-completed' && task.completed) {
        return false;
      }
      // Filter by search string
      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        const matchesTask = task.task.toLowerCase().includes(search);
        const matchesNotes = task.notes?.toLowerCase().includes(search);
        if (!matchesTask && !matchesNotes) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, searchFilter, completedFilter]);

  // Group tasks by date
  const { groupedTasks, sortedDates, totalsByDate } = useMemo(() => {
    const grouped = filteredTasks.reduce<GroupedTasks>((acc, task) => {
      const date = new Date(task.startTime).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(task);
      return acc;
    }, {});

    // Sort dates in reverse chronological order
    const sorted = Object.keys(grouped).sort((a, b) => {
      const dateA = new Date(grouped[a][0].startTime);
      const dateB = new Date(grouped[b][0].startTime);
      return dateB.getTime() - dateA.getTime();
    });

    // Calculate totals per date
    const totals: { [date: string]: number } = {};
    for (const date of sorted) {
      totals[date] = grouped[date].reduce((sum, entry) => sum + entry.durationMinutes, 0);
    }

    return { groupedTasks: grouped, sortedDates: sorted, totalsByDate: totals };
  }, [filteredTasks]);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const handleTaskChange = async (id: string, newTask: string) => {
    if (newTask.trim()) {
      await updateEntry(id, { task: newTask.trim() });
    }
  };

  const handleDurationChange = async (id: string, newDuration: string) => {
    const minutes = parseInt(newDuration, 10);
    if (!isNaN(minutes) && minutes > 0) {
      await updateEntry(id, { durationMinutes: minutes });
    }
  };

  const handleNotesChange = async (id: string, notes: string) => {
    await updateEntry(id, { notes: notes || undefined });
  };

  const handleToggleCompleted = async (id: string, completed: boolean) => {
    await updateEntry(id, { completed });
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId === id) {
      await deleteEntry(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="edit-container">
        <div className="empty-state">Loading...</div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="edit-container">
        <div className="edit-header">
          <h1 className="edit-title">Time Entries</h1>
        </div>
        <div className="empty-state">No entries yet. Start tracking your time!</div>
      </div>
    );
  }

  return (
    <div className="edit-container">
      <div className="edit-header">
        <h1 className="edit-title">Time Entries</h1>
        <span className="entry-count">
          {filteredTasks.length === tasks.length
            ? `${tasks.length} entries`
            : `${filteredTasks.length} of ${tasks.length} entries`}
        </span>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          className="filter-search"
          placeholder="Search tasks and notes..."
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
        />
        <select
          className="filter-select"
          value={completedFilter}
          onChange={e => setCompletedFilter(e.target.value as 'all' | 'completed' | 'not-completed')}
        >
          <option value="all">All</option>
          <option value="completed">Completed</option>
          <option value="not-completed">Not completed</option>
        </select>
      </div>

      <div className="entries-list">
        {sortedDates.map(date => {
          const isExpanded = expandedDates.has(date);
          const entries = groupedTasks[date];
          const totalMinutes = totalsByDate[date];

          return (
            <div key={date} className="date-group">
              <div
                className="date-header"
                onClick={() => toggleDate(date)}
              >
                <span className="date-toggle">{isExpanded ? '▼' : '▶'}</span>
                <span className="date-text">{date}</span>
                <span className="date-summary">
                  {entries.length} entries · {formatDuration(totalMinutes)}
                </span>
              </div>

              {isExpanded && (
                <div className="date-entries">
                  {entries
                    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                    .map(entry => (
                      <div key={entry.id} className={`entry-wrapper ${entry.completed ? 'completed' : ''}`}>
                        <div className="entry-item">
                          <input
                            type="checkbox"
                            className="entry-checkbox"
                            checked={entry.completed || false}
                            onChange={e => handleToggleCompleted(entry.id, e.target.checked)}
                          />
                          <span className="entry-time">{formatTime(entry.startTime)}</span>
                          <input
                            type="text"
                            className={`entry-task ${entry.completed ? 'completed' : ''}`}
                            defaultValue={entry.task}
                            onBlur={e => handleTaskChange(entry.id, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                          />
                          <input
                            type="text"
                            className="entry-duration"
                            defaultValue={`${entry.durationMinutes}m`}
                            onBlur={e => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              handleDurationChange(entry.id, value);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                          />
                          <button
                            className={`notes-toggle ${entry.notes ? 'has-notes' : ''}`}
                            onClick={() => setEditingNotesId(editingNotesId === entry.id ? null : entry.id)}
                            title={entry.notes || 'Add notes'}
                          >
                            {entry.notes ? '📝' : '+'}
                          </button>
                          <button
                            className="delete-button"
                            onClick={() => handleDelete(entry.id)}
                          >
                            {confirmDeleteId === entry.id ? 'Confirm?' : 'Delete'}
                          </button>
                        </div>
                        {editingNotesId === entry.id && (
                          <div className="entry-notes">
                            <textarea
                              className="notes-input"
                              placeholder="Add notes..."
                              defaultValue={entry.notes || ''}
                              autoFocus
                              onBlur={e => {
                                handleNotesChange(entry.id, e.target.value.trim());
                                setEditingNotesId(null);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Escape') {
                                  setEditingNotesId(null);
                                }
                              }}
                            />
                          </div>
                        )}
                        {entry.notes && editingNotesId !== entry.id && (
                          <div
                            className="entry-notes-preview"
                            onClick={() => setEditingNotesId(entry.id)}
                          >
                            {entry.notes}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EditView;
