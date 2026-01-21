import React, { forwardRef } from 'react';

interface TaskInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const TaskInput = forwardRef<HTMLInputElement, TaskInputProps>(
  ({ value, onChange, placeholder }, ref) => {
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
      </div>
    );
  }
);

TaskInput.displayName = 'TaskInput';

export default TaskInput;
