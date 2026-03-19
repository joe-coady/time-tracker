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

function getMeetingStatus(startTime: string, endTime: string): { label: string; status: 'previous' | 'active' | 'upcoming' } {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  if (now >= start && now < end) {
    return { label: 'Active', status: 'active' };
  }
  if (now >= end) {
    return { label: 'Previous', status: 'previous' };
  }
  const diffMs = start - now;
  const totalMins = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const label = hours > 0 ? `In ${hours}h ${mins}m` : `In ${mins}m`;
  return { label, status: 'upcoming' };
}

function MeetingCard({ event }: { event: CalendarEvent }) {
  const allDay = isAllDay(event.startTime, event.endTime);
  const { label: statusLabel, status } = getMeetingStatus(event.startTime, event.endTime);
  return (
    <div className={`today-card today-meeting-card today-meeting-card--${status}`}>
      <div className="today-meeting-left">
        <div className="today-meeting-time">
          {allDay ? 'All day' : `${formatTime(event.startTime)} \u2013 ${formatTime(event.endTime)}`}
        </div>
        <div className="today-card-title">{event.summary}</div>
        {event.location && (
          <div className="today-card-desc">{event.location}</div>
        )}
        <div className="today-meeting-status">{statusLabel}</div>
        <div className="today-card-calendar">{event.calendarName}</div>
      </div>
      <div className="today-meeting-right">
        <div className="today-meeting-clock">{statusLabel}</div>
      </div>
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

function PRRow({ pr, devBranchSet, ticketKeys, githubUsername }: {
  pr: GitHubPR;
  devBranchSet: Set<string>;
  ticketKeys: string[];
  githubUsername?: string | null;
}) {
  const repoShort = pr.repoFullName.split('/').pop() || pr.repoFullName;
  const isOnDevBranch = ticketKeys.some(k => devBranchSet.has(k));

  const myReviewHistory = githubUsername
    ? pr.reviewHistory.filter(r => r.user.toLowerCase() === githubUsername.toLowerCase())
    : [];

  return (
    <div className="today-pr-row">
      <span className="today-pr-row-number">#{pr.number}</span>
      <span className="today-pr-row-repo">{repoShort}</span>
      <span className="today-pr-row-age">{relativeTime(pr.updatedAt)}</span>
      <a
        className="today-pr-row-title"
        href="#"
        onClick={e => { e.preventDefault(); window.electronAPI.openExternal(pr.htmlUrl); }}
        title={pr.title}
      >
        {pr.title}
      </a>
      <div className="today-pr-badges">
        {myReviewHistory.length > 0 && (
          <span className="pr-review-history">
            {myReviewHistory.map((r, i) => (
              <span key={i} className={r.state === 'APPROVED' ? 'pr-review-approved' : 'pr-review-changes'}>
                {r.state === 'APPROVED' ? '✓' : '✗'}
              </span>
            ))}
          </span>
        )}
        {pr.approved && <span className="pr-card-approved">✓</span>}
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
      </div>
    </div>
  );
}

function TicketPRGroup({ ticketKey, prs, ticketStatusMap, devBranchSet, jiraBaseUrl, ticketPattern, githubUsername }: {
  ticketKey: string | null;
  prs: GitHubPR[];
  ticketStatusMap: Map<string, JiraTicketStatus>;
  devBranchSet: Set<string>;
  jiraBaseUrl: string | null;
  ticketPattern: RegExp | null;
  githubUsername?: string | null;
}) {
  const ticketStatus = ticketKey ? ticketStatusMap.get(ticketKey) ?? null : null;

  const getTicketKeys = (pr: GitHubPR): string[] => {
    if (!ticketPattern) return [];
    const keys: string[] = [];
    for (const match of pr.title.matchAll(new RegExp(ticketPattern.source, ticketPattern.flags))) {
      keys.push(match[0]);
    }
    return keys;
  };

  return (
    <div className="today-ticket-group">
      <div className="today-ticket-header">
        {ticketKey ? (
          <>
            <a
              className="today-ticket-key"
              href="#"
              onClick={e => { e.preventDefault(); jiraBaseUrl && window.electronAPI.openExternal(`${jiraBaseUrl}/browse/${ticketKey}`); }}
            >
              {ticketKey}
            </a>
            {ticketStatus && (
              <span className={`jira-badge status-${ticketStatus.statusCategory}`}>
                {ticketStatus.status}
              </span>
            )}
            {ticketStatus?.summary && (
              <span className="today-ticket-summary">{ticketStatus.summary}</span>
            )}
          </>
        ) : (
          <span className="today-ticket-key unlinked">Unlinked PRs</span>
        )}
      </div>
      <div className="today-ticket-prs">
        {prs.map(pr => (
          <PRRow
            key={`${pr.repoFullName}#${pr.number}`}
            pr={pr}
            devBranchSet={devBranchSet}
            ticketKeys={getTicketKeys(pr)}
            githubUsername={githubUsername}
          />
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

  const groupPRsByTicket = (prs: GitHubPR[]) => {
    const groupMap = new Map<string | null, GitHubPR[]>();
    const assigned = new Set<string>();

    for (const pr of prs) {
      const prKey = `${pr.repoFullName}#${pr.number}`;
      if (assigned.has(prKey)) continue;

      let ticketKey: string | null = null;
      if (ticketPattern) {
        const match = pr.title.match(new RegExp(ticketPattern.source, ticketPattern.flags));
        if (match) ticketKey = match[0];
      }

      if (!groupMap.has(ticketKey)) groupMap.set(ticketKey, []);
      groupMap.get(ticketKey)!.push(pr);
      assigned.add(prKey);
    }

    for (const prs of groupMap.values()) {
      prs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    const entries = Array.from(groupMap.entries());
    const linked = entries.filter(([key]) => key !== null);
    const unlinked = entries.find(([key]) => key === null);

    linked.sort((a, b) => {
      const maxA = new Date(a[1][0].updatedAt).getTime();
      const maxB = new Date(b[1][0].updatedAt).getTime();
      return maxB - maxA;
    });

    const result = linked as [string | null, GitHubPR[]][];
    if (unlinked) result.push(unlinked);
    return result;
  };

  const prGroups = useMemo(() => {
    if (!data?.myPRs.length) return [];
    return groupPRsByTicket(data.myPRs);
  }, [data?.myPRs, ticketPattern]);

  const assignedPrGroups = useMemo(() => {
    if (!data?.assignedPRs?.length) return [];
    return groupPRsByTicket(data.assignedPRs);
  }, [data?.assignedPRs, ticketPattern]);

  return (
    <div className="today-container">
      <div className="today-header">
        <h1 className="today-title">Today &mdash; {new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long' })}</h1>
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

          {assignedPrGroups.length > 0 && (
            <div className="today-section">
              <h2 className="today-section-title">PRs Assigned to Me</h2>
              {assignedPrGroups.map(([ticketKey, prs]) => (
                <TicketPRGroup
                  key={ticketKey ?? '__unlinked'}
                  ticketKey={ticketKey}
                  prs={prs}
                  ticketStatusMap={ticketStatusMap}
                  devBranchSet={devBranchSet}
                  jiraBaseUrl={jiraConfig?.baseUrl ?? null}
                  ticketPattern={ticketPattern}
                  githubUsername={data.githubUsername}
                />
              ))}
            </div>
          )}

          {prGroups.length > 0 && (
            <div className="today-section">
              <h2 className="today-section-title">My PRs</h2>
              {prGroups.map(([ticketKey, prs]) => (
                <TicketPRGroup
                  key={ticketKey ?? '__unlinked'}
                  ticketKey={ticketKey}
                  prs={prs}
                  ticketStatusMap={ticketStatusMap}
                  devBranchSet={devBranchSet}
                  jiraBaseUrl={jiraConfig?.baseUrl ?? null}
                  ticketPattern={ticketPattern}
                />
              ))}
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
