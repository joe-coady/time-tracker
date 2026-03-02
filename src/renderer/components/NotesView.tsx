import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { DailyNote, QuickLinkRule } from '../../shared/types';

type Tab = 'edit' | 'preview';

function applyQuickLinks(text: string, rules: QuickLinkRule[]): string {
  let result = text;
  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.linkPattern, 'g');
      result = result.replace(regex, (match) => {
        const url = rule.linkTarget.replace('$0', match);
        return `[${match}](${url})`;
      });
    } catch {
      // skip invalid regex
    }
  }
  return result;
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = getTodayDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (dateStr === today) {
    return 'Today';
  } else if (dateStr === yesterdayStr) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

export default function NotesView() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [note, setNote] = useState<DailyNote | null>(null);
  const [content, setContent] = useState<string>('');
  const [allDates, setAllDates] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [quickLinkRules, setQuickLinkRules] = useState<QuickLinkRule[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const isToday = selectedDate === getTodayDateString();

  // Load all note dates
  const loadAllDates = useCallback(async () => {
    const dates = await window.electronAPI.getAllNoteDates();
    // Ensure today is in the list
    const today = getTodayDateString();
    if (!dates.includes(today)) {
      dates.unshift(today);
    }
    setAllDates(dates);
  }, []);

  // Load note for selected date
  const loadNote = useCallback(async (date: string) => {
    const loadedNote = await window.electronAPI.getDailyNote(date);
    setNote(loadedNote);
    setContent(loadedNote?.content || '');
  }, []);

  useEffect(() => {
    loadAllDates();
    window.electronAPI.getQuickLinkRules().then(setQuickLinkRules);
  }, [loadAllDates]);

  useEffect(() => {
    loadNote(selectedDate);
  }, [selectedDate, loadNote]);

  // Refresh dates when switching to today (in case a new day started)
  useEffect(() => {
    if (isToday) {
      loadAllDates();
    }
  }, [isToday, loadAllDates]);

  // Auto-save with debounce (only for today)
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);

    if (!isToday) return;

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new timeout for auto-save
    debounceRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        const savedNote = await window.electronAPI.saveDailyNote(newContent);
        setNote(savedNote);
        // Refresh dates list in case this is the first note
        loadAllDates();
      } finally {
        setIsSaving(false);
      }
    }, 500);
  }, [isToday, loadAllDates]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleJumpToToday = () => {
    setSelectedDate(getTodayDateString());
  };

  return (
    <div className="notes-container">
      <div className="notes-header">
        <h1 className="notes-title">Daily Notes</h1>
        <div className="notes-controls">
          <select
            className="notes-date-picker"
            value={selectedDate}
            onChange={handleDateChange}
          >
            {allDates.map(date => (
              <option key={date} value={date}>
                {formatDateForDisplay(date)} ({date})
              </option>
            ))}
          </select>
          {!isToday && (
            <button className="notes-today-button" onClick={handleJumpToToday}>
              Today
            </button>
          )}
          {!isToday && <span className="notes-readonly-badge">Read only</span>}
          {isSaving && <span className="notes-saving-indicator">Saving...</span>}
        </div>
      </div>

      <div className="notes-tabs">
        <button
          className={`notes-tab ${activeTab === 'edit' ? 'active' : ''}`}
          onClick={() => setActiveTab('edit')}
        >
          Edit
        </button>
        <button
          className={`notes-tab ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          Preview
        </button>
      </div>

      <div className="notes-content">
        {activeTab === 'edit' ? (
          <textarea
            className="notes-editor"
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            readOnly={!isToday}
            placeholder={isToday ? 'Write your notes for today...' : 'No notes for this date'}
          />
        ) : (
          <div className="notes-preview">
            {content ? (
              <ReactMarkdown components={{ a: ({ href, children }) => (
                <a href={href} onClick={(e) => { e.preventDefault(); if (href) window.electronAPI.openExternal(href); }}>{children}</a>
              ) }}>{applyQuickLinks(content, quickLinkRules)}</ReactMarkdown>
            ) : (
              <p className="notes-empty">No notes for this date</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
