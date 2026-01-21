import React, { useState, useEffect, useRef } from 'react';
import { useTaskData } from '../hooks/useTaskData';
import TaskInput from './TaskInput';
import DurationPicker from './DurationPicker';
import PreviousTasks from './PreviousTasks';

function TaskDialog() {
  const { previousTasks, currentState, loading, startTask, refresh } = useTaskData();
  const [taskName, setTaskName] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter previous tasks based on input
  const filteredTasks = taskName
    ? previousTasks.filter(task => task.name.toLowerCase().includes(taskName.toLowerCase()))
    : previousTasks;

  // Pre-fill with current task on timer expiry
  useEffect(() => {
    if (currentState.currentTask) {
      setTaskName(currentState.currentTask);
      // Also set the duration from the matching task if found
      const match = previousTasks.find(t => t.name === currentState.currentTask);
      if (match) {
        setDuration(match.lastDuration);
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

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!taskName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await startTask(taskName.trim(), duration);
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
      if (selectedIndex >= 0 && filteredTasks[selectedIndex]) {
        const task = filteredTasks[selectedIndex];
        setTaskName(task.name);
        setDuration(task.lastDuration);
        setSelectedIndex(-1);
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
        setSelectedIndex(-1);
      } else if (filteredTasks.length === 1) {
        const task = filteredTasks[0];
        setTaskName(task.name);
        setDuration(task.lastDuration);
      }
    }
  };

  const handleTaskSelect = (name: string, taskDuration: number) => {
    setTaskName(name);
    setDuration(taskDuration);
    setSelectedIndex(-1);
    inputRef.current?.focus();
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
      {currentState.currentTask && currentState.remainingMinutes !== null && (
        <div className="current-status">
          {currentState.remainingMinutes > 0
            ? `${currentState.remainingMinutes}m left on: ${currentState.currentTask}`
            : `Timer ended: ${currentState.currentTask}`}
        </div>
      )}

      <TaskInput
        ref={inputRef}
        value={taskName}
        onChange={setTaskName}
        placeholder="Enter task name..."
      />

      <PreviousTasks
        tasks={filteredTasks}
        selectedIndex={selectedIndex}
        onSelect={handleTaskSelect}
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
