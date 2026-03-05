import React, { useState, useEffect, useCallback } from 'react';
import { KanbanTask, CalendarEvent, TodayData } from '../../shared/types';
import '../styles/today.css';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isAllDay(startTime: string, endTime: string): boolean {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  return diffMs >= 86400000 && start.getHours() === 0 && start.getMinutes() === 0;
}

function TaskCard({ task }: { task: KanbanTask }) {
  return (
    <div className="today-card">
      <div className="today-card-title">{task.Title}</div>
      {task.Description && (
        <div className="today-card-desc">{task.Description}</div>
      )}
      <div className="today-card-status">{task.Status}</div>
    </div>
  );
}

function MeetingCard({ event }: { event: CalendarEvent }) {
  const allDay = isAllDay(event.startTime, event.endTime);
  return (
    <div className="today-card today-meeting-card">
      <div className="today-meeting-time">
        {allDay ? 'All day' : `${formatTime(event.startTime)} \u2013 ${formatTime(event.endTime)}`}
      </div>
      <div className="today-card-title">{event.summary}</div>
      {event.location && (
        <div className="today-card-desc">{event.location}</div>
      )}
      <div className="today-card-calendar">{event.calendarName}</div>
    </div>
  );
}

export default function TodayView() {
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.getTodayData();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasNoColumnTags = data && data.workingTasks.length === 0 && data.todoTasks.length === 0;

  return (
    <div className="today-container">
      <div className="today-header">
        <h1 className="today-title">Today</h1>
        <button className="btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="settings-error">{error}</div>}

      {!loading && data && (
        <div className="today-sections">
          <div className="today-section">
            <h2 className="today-section-title">Meetings</h2>
            {data.meetings.length > 0 ? (
              <div className="today-card-list">
                {data.meetings.map(e => <MeetingCard key={e.id} event={e} />)}
              </div>
            ) : (
              <div className="today-empty">No meetings today</div>
            )}
          </div>

          <div className="today-section">
            <h2 className="today-section-title">Working On</h2>
            {data.workingTasks.length > 0 ? (
              <div className="today-card-list">
                {data.workingTasks.map(t => <TaskCard key={t.Id} task={t} />)}
              </div>
            ) : (
              <div className="today-empty">No tasks in progress</div>
            )}
          </div>

          <div className="today-section">
            <h2 className="today-section-title">Up Next</h2>
            {data.todoTasks.length > 0 ? (
              <div className="today-card-list">
                {data.todoTasks.map(t => <TaskCard key={t.Id} task={t} />)}
              </div>
            ) : (
              <div className="today-empty">No upcoming tasks</div>
            )}
          </div>

          {hasNoColumnTags && (
            <div className="today-hint">
              Tag your kanban columns with Working / Todo / Done types in Settings &gt; Kanban to see tasks here.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
