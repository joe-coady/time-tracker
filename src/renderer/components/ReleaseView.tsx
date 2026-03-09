import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { JiraProject, JiraVersion, JiraTicketStatus, GitHubPR, ReleaseData, KanbanColumnConfig } from '../../shared/types';
import '../styles/release.css';

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

function PRRow({ pr, devBranchSet, ticketKeys }: {
  pr: GitHubPR;
  devBranchSet: Set<string>;
  ticketKeys: string[];
}) {
  const repoShort = pr.repoFullName.split('/').pop() || pr.repoFullName;
  const isOnDevBranch = ticketKeys.some(k => devBranchSet.has(k));

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

function sortVersions(versions: JiraVersion[]): JiraVersion[] {
  const unreleased = versions.filter(v => !v.released);
  const released = versions.filter(v => v.released);

  // Unreleased: nearest release date first
  unreleased.sort((a, b) => {
    if (a.releaseDate && b.releaseDate) return a.releaseDate.localeCompare(b.releaseDate);
    if (a.releaseDate) return -1;
    if (b.releaseDate) return 1;
    return a.name.localeCompare(b.name);
  });

  // Released: most recent first
  released.sort((a, b) => {
    if (a.releaseDate && b.releaseDate) return b.releaseDate.localeCompare(a.releaseDate);
    if (a.releaseDate) return -1;
    if (b.releaseDate) return 1;
    return b.name.localeCompare(a.name);
  });

  return [...unreleased, ...released];
}

export default function ReleaseView() {
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [versions, setVersions] = useState<JiraVersion[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [releaseData, setReleaseData] = useState<ReleaseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [doneCollapsed, setDoneCollapsed] = useState(true);

  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumnConfig[]>([]);

  const [jiraConfig, setJiraConfig] = useState<{ baseUrl: string; ticketPattern?: string; customFields?: { fieldId: string; label: string }[] } | null>(null);

  useEffect(() => {
    window.electronAPI.getJiraConfig().then(cfg => {
      if (cfg) setJiraConfig({ baseUrl: cfg.baseUrl, ticketPattern: cfg.ticketPattern, customFields: cfg.customFields });
    }).catch(() => {});
    window.electronAPI.getKanbanColumns().then(setKanbanColumns).catch(() => {});
  }, []);

  // Map Jira status name → columnType using kanban column config
  // Hidden columns inherit columnType from the column they're mappedTo
  const statusToColumnType = useMemo(() => {
    const colByName = new Map<string, KanbanColumnConfig>();
    for (const col of kanbanColumns) {
      colByName.set(col.name, col);
    }

    const resolveColumnType = (col: KanbanColumnConfig): 'working' | 'todo' | 'done' | undefined => {
      if (col.columnType) return col.columnType;
      if (col.hidden && col.mappedTo) {
        const target = colByName.get(col.mappedTo);
        if (target) return target.columnType;
      }
      return undefined;
    };

    const map = new Map<string, 'working' | 'todo' | 'done'>();
    for (const col of kanbanColumns) {
      const colType = resolveColumnType(col);
      if (!colType) continue;
      // Use explicit jiraStatuses if set, otherwise fall back to column name
      const statuses = col.jiraStatuses && col.jiraStatuses.length > 0
        ? col.jiraStatuses
        : [col.name];
      for (const status of statuses) {
        map.set(status.toLowerCase(), colType);
      }
    }
    return map;
  }, [kanbanColumns]);

  useEffect(() => {
    setLoadingProjects(true);
    window.electronAPI.fetchJiraProjects().then(p => {
      setProjects(p.sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(() => {}).finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (!selectedProject) { setVersions([]); setSelectedVersion(''); return; }
    setVersions([]);
    setSelectedVersion('');
    setReleaseData(null);
    window.electronAPI.fetchJiraVersions(selectedProject).then(v => {
      setVersions(sortVersions(v));
    }).catch(() => {});
  }, [selectedProject]);

  const loadRelease = useCallback(async () => {
    if (!selectedProject || !selectedVersion) return;
    setLoading(true);
    try {
      const data = await window.electronAPI.getReleaseData(selectedProject, selectedVersion);
      setReleaseData(data);
    } catch {
      setReleaseData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, selectedVersion]);

  useEffect(() => { loadRelease(); }, [loadRelease]);

  const ticketPattern = useMemo(() => {
    if (!jiraConfig?.ticketPattern) return null;
    try { return new RegExp(jiraConfig.ticketPattern, 'g'); } catch { return null; }
  }, [jiraConfig?.ticketPattern]);

  const devBranchSet = useMemo(
    () => new Set(releaseData?.devBranchTickets ?? []),
    [releaseData?.devBranchTickets],
  );

  const customFieldMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cf of jiraConfig?.customFields ?? []) {
      map.set(cf.fieldId, cf.label);
    }
    return map;
  }, [jiraConfig?.customFields]);

  // Group: for each ticket, find PRs whose title contains ticket key
  const ticketGroups = useMemo(() => {
    if (!releaseData) return [];
    const groups: { ticket: JiraTicketStatus; prs: GitHubPR[] }[] = [];

    for (const ticket of releaseData.tickets) {
      const matchedPRs = releaseData.prs.filter(pr => {
        if (!ticketPattern) return false;
        const regex = new RegExp(ticketPattern.source, ticketPattern.flags);
        for (const match of pr.title.matchAll(regex)) {
          if (match[0] === ticket.key) return true;
        }
        return false;
      });
      groups.push({ ticket, prs: matchedPRs });
    }

    return groups;
  }, [releaseData, ticketPattern]);

  // Split into status sections using kanban column mappings, fallback to statusCategory
  const { inProgressGroups, todoGroups, doneGroups } = useMemo(() => {
    const inProgress: typeof ticketGroups = [];
    const todo: typeof ticketGroups = [];
    const done: typeof ticketGroups = [];
    for (const g of ticketGroups) {
      const colType = statusToColumnType.get(g.ticket.status.toLowerCase());
      const bucket = colType ?? (
        g.ticket.statusCategory === 'done' ? 'done'
        : g.ticket.statusCategory === 'indeterminate' ? 'working'
        : 'todo'
      );
      if (bucket === 'done') done.push(g);
      else if (bucket === 'working') inProgress.push(g);
      else todo.push(g);
    }
    return { inProgressGroups: inProgress, todoGroups: todo, doneGroups: done };
  }, [ticketGroups, statusToColumnType]);

  // Build a color index for unique custom field values
  const cfColorIndex = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const g of ticketGroups) {
      if (!g.ticket.customFields) continue;
      for (const value of Object.values(g.ticket.customFields)) {
        if (!map.has(value)) {
          map.set(value, idx % 4);
          idx++;
        }
      }
    }
    return map;
  }, [ticketGroups]);

  const ticketsWithPRs = ticketGroups.filter(g => g.prs.length > 0).length;
  const doneCount = doneGroups.length;
  const totalCount = ticketGroups.length;
  const versionObj = versions.find(v => v.name === selectedVersion);

  return (
    <div className="release-container">
      <div className="release-header">
        <h1>Release</h1>
        {selectedVersion && (
          <button className="btn-secondary" onClick={loadRelease} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        )}
      </div>

      <div className="release-selectors">
        <select
          className="release-select"
          value={selectedProject}
          onChange={e => setSelectedProject(e.target.value)}
          disabled={loadingProjects}
        >
          <option value="">{loadingProjects ? 'Loading projects...' : 'Select project'}</option>
          {projects.map(p => (
            <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
          ))}
        </select>

        <select
          className="release-select"
          value={selectedVersion}
          onChange={e => setSelectedVersion(e.target.value)}
          disabled={!selectedProject || versions.length === 0}
        >
          <option value="">Select version</option>
          {versions.map(v => (
            <option key={v.id} value={v.name}>
              {v.name}{v.released ? ' (released)' : ''}{v.releaseDate ? ` — ${v.releaseDate}` : ''}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="today-empty">Loading release data...</div>}

      {!loading && releaseData && (
        <>
          <div className="release-stats">
            {releaseData.tickets.length} ticket{releaseData.tickets.length !== 1 ? 's' : ''}, {ticketsWithPRs} with PRs
            {versionObj && !versionObj.released && versionObj.releaseDate && (
              <> &middot; Target: {versionObj.releaseDate}</>
            )}
          </div>

          {totalCount > 0 && (
            <div className="release-progress-bar">
              <div
                className="release-progress-fill"
                style={{ width: `${(doneCount / totalCount) * 100}%` }}
              />
              <span className="release-progress-label">{doneCount}/{totalCount} done</span>
            </div>
          )}

          {inProgressGroups.length > 0 && (
            <div className="release-section">
              <div className="release-section-title">In Progress ({inProgressGroups.length})</div>
              {inProgressGroups.map(({ ticket, prs }) => (
                <div key={ticket.key} className="release-ticket-inprogress">
                  <div className="today-ticket-group">
                    <div className="today-ticket-header">
                      <a className="today-ticket-key" href="#" onClick={e => { e.preventDefault(); jiraConfig && window.electronAPI.openExternal(`${jiraConfig.baseUrl}/browse/${ticket.key}`); }}>{ticket.key}</a>
                      <span className={`jira-badge status-${ticket.statusCategory}`}>{ticket.status}</span>
                      {ticket.customFields && (
                        <span className="release-custom-field-badges">
                          {Object.entries(ticket.customFields).map(([fieldId, value]) => (
                            <span key={fieldId} className={`jira-badge release-cf-badge-${cfColorIndex.get(value) ?? 0}`} title={customFieldMap.get(fieldId) ?? fieldId}>{value}</span>
                          ))}
                        </span>
                      )}
                      <span className="today-ticket-summary">{ticket.summary}</span>
                    </div>
                    {prs.length > 0 && (
                      <div className="today-ticket-prs">
                        {prs.map(pr => <PRRow key={`${pr.repoFullName}#${pr.number}`} pr={pr} devBranchSet={devBranchSet} ticketKeys={[ticket.key]} />)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {todoGroups.length > 0 && (
            <div className="release-section">
              <div className="release-section-title">To Do ({todoGroups.length})</div>
              {todoGroups.map(({ ticket, prs }) => (
                <div key={ticket.key} className="release-ticket-todo">
                  <div className="today-ticket-group">
                    <div className="today-ticket-header">
                      <a className="today-ticket-key" href="#" onClick={e => { e.preventDefault(); jiraConfig && window.electronAPI.openExternal(`${jiraConfig.baseUrl}/browse/${ticket.key}`); }}>{ticket.key}</a>
                      <span className={`jira-badge status-${ticket.statusCategory}`}>{ticket.status}</span>
                      {ticket.customFields && (
                        <span className="release-custom-field-badges">
                          {Object.entries(ticket.customFields).map(([fieldId, value]) => (
                            <span key={fieldId} className={`jira-badge release-cf-badge-${cfColorIndex.get(value) ?? 0}`} title={customFieldMap.get(fieldId) ?? fieldId}>{value}</span>
                          ))}
                        </span>
                      )}
                      <span className="today-ticket-summary">{ticket.summary}</span>
                    </div>
                    {prs.length > 0 && (
                      <div className="today-ticket-prs">
                        {prs.map(pr => <PRRow key={`${pr.repoFullName}#${pr.number}`} pr={pr} devBranchSet={devBranchSet} ticketKeys={[ticket.key]} />)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {doneGroups.length > 0 && (
            <div className="release-section">
              <div className="release-section-toggle" onClick={() => setDoneCollapsed(c => !c)}>
                <span className={`release-toggle-chevron ${doneCollapsed ? '' : 'release-toggle-open'}`}>&#9654;</span>
                Done ({doneGroups.length})
              </div>
              {!doneCollapsed && doneGroups.map(({ ticket, prs }) => (
                <div key={ticket.key} className="release-ticket-done">
                  <div className="today-ticket-group">
                    <div className="today-ticket-header">
                      <a className="today-ticket-key" href="#" onClick={e => { e.preventDefault(); jiraConfig && window.electronAPI.openExternal(`${jiraConfig.baseUrl}/browse/${ticket.key}`); }}>{ticket.key}</a>
                      <span className={`jira-badge status-${ticket.statusCategory}`}>{ticket.status}</span>
                      {ticket.customFields && (
                        <span className="release-custom-field-badges">
                          {Object.entries(ticket.customFields).map(([fieldId, value]) => (
                            <span key={fieldId} className={`jira-badge release-cf-badge-${cfColorIndex.get(value) ?? 0}`} title={customFieldMap.get(fieldId) ?? fieldId}>{value}</span>
                          ))}
                        </span>
                      )}
                      <span className="today-ticket-summary">{ticket.summary}</span>
                    </div>
                    {prs.length > 0 && (
                      <div className="today-ticket-prs">
                        {prs.map(pr => <PRRow key={`${pr.repoFullName}#${pr.number}`} pr={pr} devBranchSet={devBranchSet} ticketKeys={[ticket.key]} />)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {releaseData.tickets.length === 0 && (
            <div className="today-empty">No tickets in this release</div>
          )}
        </>
      )}
    </div>
  );
}
