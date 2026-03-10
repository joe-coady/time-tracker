import React, { forwardRef } from 'react';

interface TaskInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
}

const TaskInput = forwardRef<HTMLInputElement, TaskInputProps>(
  ({ value, onChange, onClear, placeholder }, ref) => {
    return (
      <div className="task-input-container">
        <input
          ref={ref}
          type="text"
          className="task-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus
        />
        {value && onClear && (
          <button
            className="task-input-clear"
            onClick={onClear}
            tabIndex={-1}
            title="Clear"
          >
            ×
          </button>
        )}
      </div>
    );
  }
);

TaskInput.displayName = 'TaskInput';

export default TaskInput;
