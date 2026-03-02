import React, { useState, useRef, useEffect, useCallback } from 'react';

interface InlineTimePickerProps {
  value: string;
  minTime: string;
  maxTime: string;
  onSave: (newIsoTime: string) => void;
  onCancel: () => void;
}

type FocusedField = 'hour' | 'minute';

function InlineTimePicker({ value, minTime, maxTime, onSave, onCancel }: InlineTimePickerProps) {
  const date = new Date(value);
  const [hours, setHours] = useState(date.getHours());
  const [minutes, setMinutes] = useState(date.getMinutes());
  const [focusedField, setFocusedField] = useState<FocusedField>('hour');
  const containerRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef(false);

  const clamp = useCallback((h: number, m: number): { hours: number; minutes: number } => {
    const candidate = new Date(date);
    candidate.setHours(h, m, 0, 0);

    const min = new Date(minTime);
    const max = new Date(maxTime);

    if (candidate.getTime() < min.getTime()) {
      return { hours: min.getHours(), minutes: min.getMinutes() };
    }
    if (candidate.getTime() > max.getTime()) {
      return { hours: max.getHours(), minutes: max.getMinutes() };
    }
    return { hours: h, minutes: m };
  }, [date, minTime, maxTime]);

  const adjustHour = useCallback((delta: number) => {
    setHours(prev => {
      const clamped = clamp(prev + delta, minutes);
      setMinutes(clamped.minutes);
      return clamped.hours;
    });
  }, [clamp, minutes]);

  const adjustMinute = useCallback((delta: number) => {
    setMinutes(prev => {
      const clamped = clamp(hours, prev + delta);
      setHours(clamped.hours);
      return clamped.minutes;
    });
  }, [clamp, hours]);

  const save = useCallback(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    onSave(result.toISOString());
  }, [date, hours, minutes, onSave]);

  // Click outside to save
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        save();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [save]);

  // Keyboard handling
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (focusedField === 'hour') adjustHour(1);
        else adjustMinute(1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (focusedField === 'hour') adjustHour(-1);
        else adjustMinute(-1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setFocusedField('hour');
        break;
      case 'ArrowRight':
        e.preventDefault();
        setFocusedField('minute');
        break;
      case 'Enter':
        e.preventDefault();
        save();
        break;
      case 'Escape':
        e.preventDefault();
        onCancel();
        break;
    }
  }, [focusedField, adjustHour, adjustMinute, save, onCancel]);

  // Scroll wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    if (focusedField === 'hour') adjustHour(delta);
    else adjustMinute(delta);
  }, [focusedField, adjustHour, adjustMinute]);

  // Auto-focus
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const displayHour = hours % 12 || 12;
  const ampm = hours < 12 ? 'AM' : 'PM';

  return (
    <div
      ref={containerRef}
      className="inline-time-picker"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
    >
      <span
        className={`time-segment ${focusedField === 'hour' ? 'focused' : ''}`}
        onClick={() => setFocusedField('hour')}
      >
        {displayHour}
      </span>
      <span className="time-separator">:</span>
      <span
        className={`time-segment ${focusedField === 'minute' ? 'focused' : ''}`}
        onClick={() => setFocusedField('minute')}
      >
        {String(minutes).padStart(2, '0')}
      </span>
      <span className="time-ampm">{ampm}</span>
    </div>
  );
}

export default InlineTimePicker;
