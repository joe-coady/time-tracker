import React, { useEffect, useRef } from 'react';
import { PreviousTask } from '../../shared/types';

interface PreviousTasksProps {
  tasks: PreviousTask[];
  selectedIndex: number;
  onSelect: (task: string, duration: number, taskTypeIds: string[]) => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins}m`;
}

function PreviousTasks({ tasks, selectedIndex, onSelect }: PreviousTasksProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <div className="previous-tasks" ref={listRef}>
      {tasks.length === 0 ? (
        <div className="previous-tasks-empty">No matching tasks</div>
      ) : (
        tasks.slice(0, 10).map((task, index) => (
          <div
            key={task.name}
            className={`previous-task-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => onSelect(task.name, task.lastDuration, task.lastTaskTypeIds)}
          >
            <span className="previous-task-name">{task.name}</span>
            <span className="previous-task-duration">{formatDuration(task.lastDuration)}</span>
          </div>
        ))
      )}
    </div>
  );
}

export default PreviousTasks;
