import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTaskData } from '../hooks/useTaskData';
import { useTaskTypes } from '../hooks/useTaskTypes';
import { CalculatedTaskEntry, TaskType } from '../../shared/types';
import { formatDuration } from '../../shared/durationUtils';

interface GroupedByDate {
  [date: string]: CalculatedTaskEntry[];
}

interface ExportSubgroup {
  remainderKey: string;        // Sorted remainder tag IDs joined, or "none"
  remainderTagNames: string[]; // Display names (e.g., ["C", "D"])
  entries: CalculatedTaskEntry[];
  totalMinutes: number;
}

interface ExportGroup {
  tagKey: string;              // Primary group key (intersection)
  tagNames: string[];          // Primary group display names (e.g., ["A", "B"])
  subgroups: ExportSubgroup[]; // Secondary groups by remainder tags
  totalMinutes: number;        // Sum across all subgroups
}

function ExportView() {
  const { tasks, loading } = useTaskData();
  const { taskTypes } = useTaskTypes();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [filterLoaded, setFilterLoaded] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return new Set([today]);
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Tag selector state
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const tagSelectorRef = useRef<HTMLDivElement>(null);

  // Load saved filter on mount
  useEffect(() => {
    window.electronAPI.getExportFilterTagIds().then(tagIds => {
      setSelectedTagIds(tagIds);
      setFilterLoaded(true);
    });
  }, []);

  // Save filter when it changes (but only after initial load)
  useEffect(() => {
    if (filterLoaded) {
      window.electronAPI.setExportFilterTagIds(selectedTagIds);
    }
  }, [selectedTagIds, filterLoaded]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tagSelectorRef.current && !tagSelectorRef.current.contains(event.target as Node)) {
        setIsTagSelectorOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build a map of taskType id -> name for quick lookups
  const taskTypeMap = useMemo(() => {
    const map = new Map<string, TaskType>();
    taskTypes.forEach(t => map.set(t.id, t));
    return map;
  }, [taskTypes]);

  // Group tasks by date and then by tag intersection
  const { groupedByDate, sortedDates } = useMemo(() => {
    // First group by date
    const byDate = tasks.reduce<GroupedByDate>((acc, task) => {
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
    const sorted = Object.keys(byDate).sort((a, b) => {
      const dateA = new Date(byDate[a][0].startTime);
      const dateB = new Date(byDate[b][0].startTime);
      return dateB.getTime() - dateA.getTime();
    });

    return { groupedByDate: byDate, sortedDates: sorted };
  }, [tasks]);

  // For each date, group tasks by tag intersection (primary) then by remainder tags (secondary)
  const getGroupsForDate = (date: string): ExportGroup[] => {
    const tasksForDate = groupedByDate[date] || [];
    const selectedSet = new Set(selectedTagIds);

    if (selectedTagIds.length === 0) {
      // No filter selected - put all in one "All tasks" group with one subgroup
      const totalMinutes = tasksForDate.reduce(
        (sum, t) => sum + (t.calculatedDurationMinutes ?? 0),
        0
      );
      const allTagIds = new Set<string>();
      tasksForDate.forEach(t => {
        (t.taskTypeIds || []).forEach(id => allTagIds.add(id));
      });
      return [
        {
          tagKey: 'all',
          tagNames: ['All tasks'],
          subgroups: [
            {
              remainderKey: 'none',
              remainderTagNames: Array.from(allTagIds)
                .map(id => taskTypeMap.get(id)?.name)
                .filter((n): n is string => !!n)
                .sort(),
              entries: tasksForDate,
              totalMinutes,
            },
          ],
          totalMinutes,
        },
      ];
    }

    // Step 1: Group by intersection key (primary grouping)
    const primaryGroupsMap = new Map<string, CalculatedTaskEntry[]>();

    tasksForDate.forEach(task => {
      const taskTags = task.taskTypeIds || [];
      // Intersection of task tags with selected tags
      const intersection = taskTags.filter(id => selectedSet.has(id)).sort();
      const key = intersection.length > 0 ? intersection.join(',') : 'other';

      if (!primaryGroupsMap.has(key)) {
        primaryGroupsMap.set(key, []);
      }
      primaryGroupsMap.get(key)!.push(task);
    });

    // Step 2: Convert to ExportGroup array with subgroups
    const groups: ExportGroup[] = [];
    primaryGroupsMap.forEach((entries, primaryKey) => {
      const tagIds = primaryKey === 'other' ? [] : primaryKey.split(',');
      const tagNames =
        primaryKey === 'other'
          ? ['Other']
          : tagIds.map(id => taskTypeMap.get(id)?.name || id).sort();

      // Step 3: Within each primary group, group by remainder tags (secondary grouping)
      const subgroupsMap = new Map<string, CalculatedTaskEntry[]>();

      entries.forEach(task => {
        const taskTags = task.taskTypeIds || [];
        // Remainder = task tags NOT in selectedTagIds
        const remainder = taskTags.filter(id => !selectedSet.has(id)).sort();
        const remainderKey = remainder.length > 0 ? remainder.join(',') : 'none';

        if (!subgroupsMap.has(remainderKey)) {
          subgroupsMap.set(remainderKey, []);
        }
        subgroupsMap.get(remainderKey)!.push(task);
      });

      // Convert subgroups map to array
      const subgroups: ExportSubgroup[] = [];
      subgroupsMap.forEach((subgroupEntries, remainderKey) => {
        const remainderTagNames =
          remainderKey === 'none'
            ? []
            : remainderKey
                .split(',')
                .map(id => taskTypeMap.get(id)?.name)
                .filter((n): n is string => !!n)
                .sort();

        const subgroupMinutes = subgroupEntries.reduce(
          (sum, t) => sum + (t.calculatedDurationMinutes ?? 0),
          0
        );

        subgroups.push({
          remainderKey,
          remainderTagNames,
          entries: subgroupEntries,
          totalMinutes: subgroupMinutes,
        });
      });

      // Sort subgroups: alphabetically by name, "(none)" last
      subgroups.sort((a, b) => {
        if (a.remainderKey === 'none') return 1;
        if (b.remainderKey === 'none') return -1;
        return a.remainderTagNames.join(', ').localeCompare(b.remainderTagNames.join(', '));
      });

      const totalMinutes = subgroups.reduce((sum, sg) => sum + sg.totalMinutes, 0);

      groups.push({
        tagKey: primaryKey,
        tagNames,
        subgroups,
        totalMinutes,
      });
    });

    // Sort groups: matching tags first (by name), "other" last
    groups.sort((a, b) => {
      if (a.tagKey === 'other') return 1;
      if (b.tagKey === 'other') return -1;
      return a.tagNames.join(',').localeCompare(b.tagNames.join(','));
    });

    return groups;
  };

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

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      setSelectedTagIds(selectedTagIds.filter(id => id !== tagId));
    } else {
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
  };

  const handleRemoveTag = (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    setSelectedTagIds(selectedTagIds.filter(id => id !== tagId));
  };

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDescription = (entries: CalculatedTaskEntry[]): string => {
    // Group entries by task name, collecting all unique notes
    const taskMap = new Map<string, Set<string>>();

    entries.forEach(entry => {
      const taskName = entry.task;
      if (!taskMap.has(taskName)) {
        taskMap.set(taskName, new Set());
      }
      if (entry.notes) {
        taskMap.get(taskName)!.add(entry.notes);
      }
    });

    // Format unique tasks with their combined notes
    return Array.from(taskMap.entries())
      .map(([taskName, notesSet]) => {
        let text = taskName;
        const notes = Array.from(notesSet);
        if (notes.length > 0) {
          text += '\nnotes: ' + notes.join('\n\n');
        }
        return text;
      })
      .join('\n\n');
  };

  const selectedTypes = taskTypes.filter(t => selectedTagIds.includes(t.id));

  if (loading) {
    return (
      <div className="export-container">
        <div className="empty-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="export-container">
      <div className="edit-header">
        <h1 className="edit-title">Export View</h1>
        <span className="entry-count">{tasks.length} entries</span>
      </div>

      <div className="export-filter-section">
        <label className="export-filter-label">Filter by tags:</label>
        <div className="task-type-selector export-tag-selector" ref={tagSelectorRef}>
          <div
            className="selected-types"
            onClick={() => setIsTagSelectorOpen(!isTagSelectorOpen)}
          >
            {selectedTypes.length === 0 ? (
              <span className="no-types-placeholder">All tags (no filter)</span>
            ) : (
              selectedTypes.map(type => (
                <span key={type.id} className="type-chip">
                  {type.name}
                  <button
                    className="type-chip-remove"
                    onClick={e => handleRemoveTag(e, type.id)}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          {isTagSelectorOpen && (
            <div className="type-dropdown">
              {taskTypes.length === 0 ? (
                <div className="no-types-message">No tags available</div>
              ) : (
                taskTypes.map(type => (
                  <div key={type.id} className="type-option">
                    <label className="type-option-label">
                      <input
                        type="checkbox"
                        checked={selectedTagIds.includes(type.id)}
                        onChange={() => handleToggleTag(type.id)}
                      />
                      <span className="type-option-name">{type.name}</span>
                    </label>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="export-list">
        {sortedDates.map(date => {
          const isExpanded = expandedDates.has(date);
          const groups = getGroupsForDate(date);
          const totalMinutes = groups.reduce((sum, g) => sum + g.totalMinutes, 0);

          return (
            <div key={date} className="date-group">
              <div className="date-header" onClick={() => toggleDate(date)}>
                <span className="date-toggle">{isExpanded ? '▼' : '▶'}</span>
                <span className="date-text">{date}</span>
                <span className="date-summary">
                  {groups.reduce((sum, g) => sum + g.subgroups.reduce((s, sg) => s + sg.entries.length, 0), 0)} entries ·{' '}
                  {formatDuration(totalMinutes)}
                </span>
              </div>

              {isExpanded && (
                <div className="export-groups">
                  {groups.map(group => (
                    <div key={group.tagKey} className="export-primary-group">
                      <div className="export-primary-header">
                        <span className="export-primary-tags">{group.tagNames.join(', ')}</span>
                        <span className="export-primary-total">
                          {group.subgroups.reduce((sum, sg) => sum + sg.entries.length, 0)} entries · {formatDuration(group.totalMinutes)}
                        </span>
                      </div>

                      <div className="export-subgroups">
                        {group.subgroups.map(subgroup => {
                          const subgroupId = `${date}-${group.tagKey}-${subgroup.remainderKey}`;
                          const titleText = subgroup.remainderTagNames.join(', ') || '(none)';
                          const descriptionText = formatDescription(subgroup.entries);
                          const durationText = formatDuration(subgroup.totalMinutes);

                          return (
                            <div key={subgroup.remainderKey} className="export-subgroup">
                              <div className="export-subgroup-header">
                                {subgroup.remainderTagNames.length > 0
                                  ? subgroup.remainderTagNames.join(', ')
                                  : '(none)'}
                                <span className="export-group-count">
                                  ({subgroup.entries.length} entries)
                                </span>
                              </div>

                              <div className="export-field">
                                <div className="export-field-header">
                                  <span className="export-field-label">Title</span>
                                  <button
                                    className="copy-button"
                                    onClick={() => copyToClipboard(titleText, `${subgroupId}-title`)}
                                  >
                                    {copiedField === `${subgroupId}-title` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                                <div className="export-field-value">{titleText}</div>
                              </div>

                              <div className="export-field">
                                <div className="export-field-header">
                                  <span className="export-field-label">Description</span>
                                  <button
                                    className="copy-button"
                                    onClick={() =>
                                      copyToClipboard(descriptionText, `${subgroupId}-desc`)
                                    }
                                  >
                                    {copiedField === `${subgroupId}-desc` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                                <pre className="export-field-value export-description">
                                  {descriptionText}
                                </pre>
                              </div>

                              <div className="export-field">
                                <div className="export-field-header">
                                  <span className="export-field-label">Duration</span>
                                  <button
                                    className="copy-button"
                                    onClick={() =>
                                      copyToClipboard(durationText, `${subgroupId}-duration`)
                                    }
                                  >
                                    {copiedField === `${subgroupId}-duration` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                                <div className="export-field-value">{durationText}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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

export default ExportView;
