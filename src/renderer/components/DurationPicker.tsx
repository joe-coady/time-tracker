import React from 'react';
import { DURATION_OPTIONS } from '../../shared/types';

interface DurationPickerProps {
  value: number;
  onChange: (value: number) => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function DurationPicker({ value, onChange }: DurationPickerProps) {
  const isPreset = DURATION_OPTIONS.some(opt => opt.value === value);

  return (
    <div className="duration-container">
      <div className="duration-label">Duration</div>
      <div className="duration-buttons">
        {DURATION_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            className={`duration-button ${value === option.value ? 'selected' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
        {!isPreset && (
          <button
            type="button"
            className="duration-button selected custom"
          >
            {formatDuration(value)}
          </button>
        )}
      </div>
    </div>
  );
}

export default DurationPicker;
