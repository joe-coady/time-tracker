import React, { useState, useEffect, useRef } from 'react';
import { useTaskData } from '../hooks/useTaskData';
import { useTaskTypes } from '../hooks/useTaskTypes';
import { PreviousTask } from '../../shared/types';
import TaskInput from './TaskInput';
import DurationPicker from './DurationPicker';
import PreviousTasks from './PreviousTasks';
import TaskTypeSelector from './TaskTypeSelector';

function TaskDialog() {
  const { previousTasks, currentState, loading, startTask, refresh } = useTaskData();
  const { taskTypes, addTaskType, deleteTaskType } = useTaskTypes();
  const [taskName, setTaskName] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [selectedTaskTypeIds, setSelectedTaskTypeIds] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [jiraResults, setJiraResults] = useState<PreviousTask[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter local previous tasks based on input
  const filteredLocalTasks = taskName
    ? previousTasks.filter(task => task.name.toLowerCase().includes(taskName.toLowerCase()))
    : previousTasks;

  // Merge: local tasks first, then deduplicated Jira results
  const localNames = new Set(filteredLocalTasks.map(t => t.name));
  const dedupedJira = jiraResults.filter(j => !localNames.has(j.name));
  const filteredTasks = [...filteredLocalTasks, ...dedupedJira];

  // Pre-fill with current task on timer expiry
  useEffect(() => {
    if (currentState.currentTask) {
      setTaskName(currentState.currentTask);
      // Also set the duration and tags from the matching task if found
      const match = previousTasks.find(t => t.name === currentState.currentTask);
      if (match) {
        setDuration(match.lastDuration);
        setSelectedTaskTypeIds(match.lastTaskTypeIds);
      }
    }
  }, [currentState.currentTask, previousTasks]);

  // Listen for timer expired events
  useEffect(() => {
    window.electronAPI.onTimerExpired(() => {
      refresh();
      inputRef.current?.focus();
    });

    return () => {
      window.electronAPI.removeTimerExpiredListener();
    };
  }, [refresh]);

  // Debounced Jira search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = taskName.trim();
    if (trimmed.length < 2) {
      setJiraResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await window.electronAPI.searchJira(trimmed);
        setJiraResults(
          results.map(r => ({
            name: `${r.key} - ${r.summary}`,
            lastDuration: 60,
            lastTaskTypeIds: [],
            source: 'jira' as const,
          }))
        );
      } catch {
        setJiraResults([]);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [taskName]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!taskName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await startTask(taskName.trim(), duration, selectedTaskTypeIds, notes);
    } catch (error) {
      console.error('Failed to start task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredTasks.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      // Allow Enter to create new lines in textarea
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') {
        return; // Don't prevent default - let textarea handle the Enter
      }
      if (selectedIndex >= 0 && filteredTasks[selectedIndex]) {
        const task = filteredTasks[selectedIndex];
        setTaskName(task.name);
        setDuration(task.lastDuration);
        setSelectedTaskTypeIds(task.lastTaskTypeIds);
        setSelectedIndex(-1);
        setNotes('');
      } else {
        handleSubmit();
      }
    } else if (e.key === 'Escape') {
      window.electronAPI.closeDialog();
    } else if (e.key === 'Tab' && !e.shiftKey && filteredTasks.length > 0) {
      e.preventDefault();
      if (selectedIndex >= 0) {
        const task = filteredTasks[selectedIndex];
        setTaskName(task.name);
        setDuration(task.lastDuration);
        setSelectedTaskTypeIds(task.lastTaskTypeIds);
        setSelectedIndex(-1);
        setNotes('');
      } else if (filteredTasks.length === 1) {
        const task = filteredTasks[0];
        setTaskName(task.name);
        setDuration(task.lastDuration);
        setSelectedTaskTypeIds(task.lastTaskTypeIds);
        setNotes('');
      }
    }
  };

  const handleTaskSelect = (name: string, taskDuration: number, taskTypeIds: string[]) => {
    const localMatch = previousTasks.find(t => t.name === name);
    setTaskName(name);
    setDuration(localMatch?.lastDuration ?? taskDuration);
    setSelectedTaskTypeIds(localMatch?.lastTaskTypeIds ?? taskTypeIds);
    setSelectedIndex(-1);
    setNotes('');
    inputRef.current?.focus();
  };

  // Reset tags when typing a new task name that doesn't match a previous task
  const handleTaskNameChange = (name: string) => {
    setTaskName(name);
    // If the new name doesn't exactly match any previous task, reset tags
    const exactMatch = previousTasks.find(t => t.name === name);
    if (!exactMatch) {
      setSelectedTaskTypeIds([]);
    }
  };

  if (loading) {
    return (
      <div className="dialog-container">
        <div className="empty-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dialog-container" onKeyDown={handleKeyDown}>
      <div className="dialog-header">
        <span className="dialog-title">What are you working on?</span>
        <button
          className="close-button"
          onClick={() => window.electronAPI.closeDialog()}
          title="Close (Esc)"
        >
          ×
        </button>
      </div>
      {currentState.currentTask && (
        <div className="current-status">
          Currently: {currentState.currentTask}
          {currentState.elapsedMinutes !== null && ` (${currentState.elapsedMinutes}m elapsed)`}
        </div>
      )}

      <TaskInput
        ref={inputRef}
        value={taskName}
        onChange={handleTaskNameChange}
        placeholder="Enter task name..."
      />

      <PreviousTasks
        tasks={filteredTasks}
        selectedIndex={selectedIndex}
        onSelect={handleTaskSelect}
      />

      <TaskTypeSelector
        taskTypes={taskTypes}
        selectedTypeIds={selectedTaskTypeIds}
        onSelectionChange={setSelectedTaskTypeIds}
        onCreateType={addTaskType}
        onDeleteType={deleteTaskType}
      />

      <textarea
        className="dialog-notes-input"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Why are you switching to this task? (optional)"
        rows={2}
      />

      <DurationPicker value={duration} onChange={setDuration} />

      <button
        className="submit-button"
        onClick={handleSubmit}
        disabled={!taskName.trim() || isSubmitting}
      >
        {currentState.currentTask === taskName.trim() ? 'Continue Task' : 'Start Task'}
      </button>
    </div>
  );
}

export default TaskDialog;
