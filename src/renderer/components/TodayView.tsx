import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { KanbanTask, CalendarEvent, GitHubPR, JiraTicketStatus, TodayData } from '../../shared/types';
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

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000' : '#fff';
}

function PRCard({ pr, ticketStatusMap, devBranchSet, jiraBaseUrl, ticketPattern }: {
  pr: GitHubPR;
  ticketStatusMap: Map<string, JiraTicketStatus>;
  devBranchSet: Set<string>;
  jiraBaseUrl: string | null;
  ticketPattern: RegExp | null;
}) {
  const repoShort = pr.repoFullName.split('/').pop() || pr.repoFullName;

  const ticketKeys: string[] = [];
  if (ticketPattern) {
    for (const match of pr.title.matchAll(ticketPattern)) {
      ticketKeys.push(match[0]);
    }
  }

  const jiraItems = ticketKeys
    .map(key => ticketStatusMap.get(key) ?? null)
    .filter(Boolean) as JiraTicketStatus[];

  const isOnDevBranch = ticketKeys.some(k => devBranchSet.has(k));

  return (
    <div className="today-card today-pr-card">
      <div className="today-pr-top">
        <span className="today-pr-repo">{repoShort}</span>
        <span className="today-pr-number">#{pr.number}</span>
        <span className="today-pr-time">{relativeTime(pr.updatedAt)}</span>
      </div>
      <a
        className="today-card-title today-pr-link"
        href="#"
        onClick={e => { e.preventDefault(); window.electronAPI.openExternal(pr.htmlUrl); }}
        title={pr.title}
      >
        {pr.title}
      </a>
      <div className="today-pr-badges">
        {isOnDevBranch && <span className="pr-card-dev-env">DEV-ENV</span>}
        {pr.draft && <span className="pr-card-draft">Draft</span>}
        {pr.labels.map(label => (
          <span
            key={label.name}
            className="pr-card-label"
            style={{
              backgroundColor: label.color ? `#${label.color}` : '#eee',
              color: label.color ? contrastColor(label.color) : '#333',
            }}
          >
            {label.name}
          </span>
        ))}
        {jiraItems.map(ts => (
          <span
            key={ts.key}
            className={`jira-badge clickable status-${ts.statusCategory}`}
            onClick={() => jiraBaseUrl && window.electronAPI.openExternal(`${jiraBaseUrl}/browse/${ts.key}`)}
          >
            {ts.status}
          </span>
        ))}
      </div>
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

  const [jiraConfig, setJiraConfig] = useState<{ baseUrl: string; ticketPattern?: string } | null>(null);
  useEffect(() => {
    window.electronAPI.getJiraConfig().then(cfg => {
      if (cfg) setJiraConfig({ baseUrl: cfg.baseUrl, ticketPattern: cfg.ticketPattern });
    }).catch(() => {});
  }, []);

  const ticketStatusMap = useMemo(() => {
    const map = new Map<string, JiraTicketStatus>();
    if (data) {
      for (const s of data.jiraTicketStatuses) map.set(s.key, s);
    }
    return map;
  }, [data?.jiraTicketStatuses]);

  const devBranchSet = useMemo(
    () => new Set(data?.devBranchTickets ?? []),
    [data?.devBranchTickets],
  );

  const ticketPattern = useMemo(() => {
    if (!jiraConfig?.ticketPattern) return null;
    try { return new RegExp(jiraConfig.ticketPattern, 'g'); } catch { return null; }
  }, [jiraConfig?.ticketPattern]);

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

          {data.myPRs.length > 0 && (
            <div className="today-section">
              <h2 className="today-section-title">My PRs</h2>
              <div className="today-card-list">
                {data.myPRs.map(pr => (
                  <PRCard
                    key={`${pr.repoFullName}#${pr.number}`}
                    pr={pr}
                    ticketStatusMap={ticketStatusMap}
                    devBranchSet={devBranchSet}
                    jiraBaseUrl={jiraConfig?.baseUrl ?? null}
                    ticketPattern={ticketPattern}
                  />
                ))}
              </div>
            </div>
          )}

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
