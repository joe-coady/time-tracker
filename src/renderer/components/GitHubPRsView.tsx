import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GitHubPR, GitHubConfig, JiraConfig, JiraTicketStatus } from '../../shared/types';

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

type Involvement = 'all' | 'mine' | 'assigned';

function GitHubPRsView() {
  const [prs, setPrs] = useState<GitHubPR[]>([]);
  const [config, setConfig] = useState<GitHubConfig | null>(null);
  const [jiraConfig, setJiraConfig] = useState<JiraConfig | null>(null);
  const [ticketStatuses, setTicketStatuses] = useState<Map<string, JiraTicketStatus>>(new Map());
  const [ticketStatusLoading, setTicketStatusLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [repoFilter, setRepoFilter] = useState('');
  const [involvement, setInvolvement] = useState<Involvement>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    const [cfg, jiraCfg, results] = await Promise.all([
      window.electronAPI.getGitHubConfig(),
      window.electronAPI.getJiraConfig(),
      window.electronAPI.fetchGitHubPRs(),
    ]);
    setConfig(cfg);
    setJiraConfig(jiraCfg);
    setPrs(results);
    setLoading(false);

    // After loading, extract ticket keys and fetch statuses
    if (jiraCfg?.ticketPattern && results.length > 0) {
      try {
        const regex = new RegExp(jiraCfg.ticketPattern, 'g');
        const keys = new Set<string>();
        for (const pr of results) {
          for (const match of pr.title.matchAll(regex)) {
            keys.add(match[0]);
          }
        }
        console.log('[jira-tickets] extracted keys:', Array.from(keys));
        if (keys.size > 0) {
          setTicketStatusLoading(true);
          const statuses = await window.electronAPI.fetchJiraTicketStatuses(Array.from(keys));
          console.log('[jira-tickets] API response:', statuses);
          const map = new Map<string, JiraTicketStatus>();
          for (const s of statuses) {
            map.set(s.key, s);
          }
          setTicketStatuses(map);
          setTicketStatusLoading(false);
        }
      } catch (err) {
        console.error('[jira-tickets] failed to fetch ticket statuses:', err);
        setTicketStatusLoading(false);
      }
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let result = prs;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(pr =>
        pr.title.toLowerCase().includes(q) ||
        pr.author.toLowerCase().includes(q) ||
        pr.repoFullName.toLowerCase().includes(q) ||
        `#${pr.number}`.includes(q)
      );
    }

    if (repoFilter) {
      result = result.filter(pr => pr.repoFullName === repoFilter);
    }

    if (involvement !== 'all' && config?.username) {
      const u = config.username.toLowerCase();
      if (involvement === 'mine') {
        result = result.filter(pr => pr.author.toLowerCase() === u);
      } else if (involvement === 'assigned') {
        result = result.filter(pr => pr.assignees.some(a => a.toLowerCase() === u));
      }
    }

    return result;
  }, [prs, search, repoFilter, involvement, config]);

  const grouped = useMemo(() => {
    const map = new Map<string, GitHubPR[]>();
    for (const pr of filtered) {
      const group = map.get(pr.repoFullName) || [];
      group.push(pr);
      map.set(pr.repoFullName, group);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const repos = useMemo(() => {
    const set = new Set(prs.map(pr => pr.repoFullName));
    return Array.from(set).sort();
  }, [prs]);

  const getTicketKeys = useCallback((title: string): string[] => {
    if (!jiraConfig?.ticketPattern) return [];
    try {
      const regex = new RegExp(jiraConfig.ticketPattern, 'g');
      return Array.from(title.matchAll(regex), m => m[0]);
    } catch {
      return [];
    }
  }, [jiraConfig]);

  const toggleGroup = (repo: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(repo)) next.delete(repo);
      else next.add(repo);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="edit-container">
        <div className="empty-state">Loading PRs...</div>
      </div>
    );
  }

  if (!config || !config.token) {
    return (
      <div className="edit-container">
        <div className="empty-state">Open GitHub Settings from the tray menu to get started.</div>
      </div>
    );
  }

  return (
    <div className="edit-container">
      <div className="edit-header">
        <span className="edit-title">GitHub PRs</span>
        <span className="entry-count">
          {filtered.length} PR{filtered.length !== 1 ? 's' : ''}
          <button
            className="copy-button"
            style={{ marginLeft: 12 }}
            onClick={loadData}
          >
            Refresh
          </button>
        </span>
      </div>

      <div className="filter-bar">
        <input
          className="filter-search"
          placeholder="Search PRs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={repoFilter}
          onChange={e => setRepoFilter(e.target.value)}
        >
          <option value="">All repos</option>
          {repos.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          className="filter-select"
          value={involvement}
          onChange={e => setInvolvement(e.target.value as Involvement)}
        >
          <option value="all">All PRs</option>
          <option value="mine">My PRs</option>
          <option value="assigned">Assigned to me</option>
        </select>
      </div>

      <div className="entries-list">
        {grouped.length === 0 && (
          <div className="empty-state">No matching PRs</div>
        )}
        {grouped.map(([repo, reposPrs]) => {
          const collapsed = collapsedGroups.has(repo);
          return (
            <div className="date-group" key={repo}>
              <div className="date-header" onClick={() => toggleGroup(repo)}>
                <span className="date-toggle">{collapsed ? '▶' : '▼'}</span>
                <span className="date-text">{repo}</span>
                <span className="date-summary">{reposPrs.length} PR{reposPrs.length !== 1 ? 's' : ''}</span>
              </div>
              {!collapsed && (
                <div className="date-entries">
                  {reposPrs.map(pr => (
                    <div className="github-pr-item" key={`${pr.repoFullName}#${pr.number}`}>
                      <span className="github-pr-number">#{pr.number}</span>
                      <a
                        className="github-pr-title"
                        href="#"
                        onClick={e => { e.preventDefault(); window.electronAPI.openExternal(pr.htmlUrl); }}
                        title={pr.title}
                      >
                        {pr.title}
                      </a>
                      {getTicketKeys(pr.title).map(key => {
                        const ts = ticketStatuses.get(key);
                        if (ts) {
                          return (
                            <span
                              key={key}
                              className={`jira-badge clickable status-${ts.statusCategory}`}
                              title={`${key}: ${ts.status}`}
                              onClick={() => window.electronAPI.openExternal(`${jiraConfig!.baseUrl}/browse/${key}`)}
                            >
                              {ts.status}
                            </span>
                          );
                        }
                        if (ticketStatusLoading) {
                          return (
                            <span key={key} className="jira-badge status-loading" title={key}>
                              {key}
                            </span>
                          );
                        }
                        return null;
                      })}
                      {pr.draft && <span className="github-pr-draft">Draft</span>}
                      {pr.labels.map(label => (
                        <span
                          key={label.name}
                          className="github-pr-label"
                          style={{
                            backgroundColor: label.color ? `#${label.color}` : '#eee',
                            color: label.color ? contrastColor(label.color) : '#333',
                          }}
                        >
                          {label.name}
                        </span>
                      ))}
                      <span className="github-pr-author">{pr.author}</span>
                      <span className="github-pr-age">{relativeTime(pr.updatedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GitHubPRsView;
