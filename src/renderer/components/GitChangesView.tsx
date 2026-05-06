import React, { useState, useEffect, useCallback } from 'react';
import { GitConfig, GitFileStatus, GitStatusResult } from '../../shared/types';
import '../../renderer/styles/git-changes.css';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  status?: string;
  staged?: boolean;
  children: TreeNode[];
}

function buildTree(files: GitFileStatus[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const pathSoFar = parts.slice(0, i + 1).join('/');

      let existing = current.find(n => n.name === part && n.type === (isFile ? 'file' : 'directory'));

      if (!existing) {
        existing = {
          name: part,
          path: pathSoFar,
          type: isFile ? 'file' : 'directory',
          children: [],
          ...(isFile ? { status: file.status, staged: file.staged } : {}),
        };
        current.push(existing);
      }

      if (!isFile) {
        current = existing.children;
      }
    }
  }

  // Sort: directories first (alphabetical), then files (alphabetical)
  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortNodes(node.children);
      }
    }
    return nodes;
  }

  return sortNodes(root);
}

function countFiles(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'file') count++;
    else count += countFiles(node.children);
  }
  return count;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'M': return '#24292e';
    case 'A': return '#22863a';
    case 'D': return '#cb2431';
    case 'R': return '#0366d6';
    case '?': return '#22863a';
    default: return '#6a737d';
  }
}

function getStatusBadgeLabel(status: string): string {
  switch (status) {
    case 'M': return 'modified';
    case 'A': return 'new file';
    case 'D': return 'deleted';
    case 'R': return 'renamed';
    case '?': return 'new file';
    case 'C': return 'copied';
    case 'U': return 'unmerged';
    default: return status;
  }
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'A': case '?': return 'git-badge-added';
    case 'D': return 'git-badge-deleted';
    case 'R': return 'git-badge-renamed';
    default: return 'git-badge-modified';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'M': return 'Modified';
    case 'A': return 'Added';
    case 'D': return 'Deleted';
    case 'R': return 'Renamed';
    case '?': return 'Untracked';
    case 'C': return 'Copied';
    case 'U': return 'Unmerged';
    default: return status;
  }
}

export default function GitChangesView() {
  const [config, setConfig] = useState<GitConfig | null>(null);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [statusResult, setStatusResult] = useState<GitStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const selectedRepo = config?.repos.find(r => r.id === selectedRepoId) || null;

  const loadConfig = useCallback(async () => {
    const loaded = await window.electronAPI.getGitConfig();
    setConfig(loaded || { repos: [] });
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const fetchStatus = useCallback(async (repoPath: string) => {
    setLoading(true);
    setStatusResult(null);
    try {
      const result = await window.electronAPI.getGitStatus(repoPath);
      setStatusResult(result);
      // Expand all directories by default
      const tree = buildTree(result.files);
      const allDirs = new Set<string>();
      function collectDirs(nodes: TreeNode[]) {
        for (const node of nodes) {
          if (node.type === 'directory') {
            allDirs.add(node.path);
            collectDirs(node.children);
          }
        }
      }
      collectDirs(tree);
      setExpandedDirs(allDirs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRepo) {
      fetchStatus(selectedRepo.path);
    }
  }, [selectedRepoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDir = (dirPath: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };

  const renderTree = (nodes: TreeNode[], depth: number) => {
    return nodes.map(node => {
      if (node.type === 'directory') {
        const isExpanded = expandedDirs.has(node.path);
        const fileCount = countFiles(node.children);
        return (
          <React.Fragment key={`dir-${node.path}`}>
            <div
              className="git-tree-row git-tree-dir"
              style={{ paddingLeft: depth * 20 + 8 }}
              onClick={() => toggleDir(node.path)}
            >
              <span className="git-tree-toggle">{isExpanded ? '▼' : '▶'}</span>
              <span className="git-tree-icon">📁</span>
              <span className="git-tree-name">{node.name}</span>
              <span className="git-tree-badge">{fileCount}</span>
            </div>
            {isExpanded && renderTree(node.children, depth + 1)}
          </React.Fragment>
        );
      }

      return (
        <div
          key={`file-${node.path}-${node.staged ? 'staged' : 'unstaged'}`}
          className="git-tree-row git-tree-file git-tree-clickable"
          style={{ paddingLeft: depth * 20 + 8 }}
          onClick={() => {
            if (selectedRepo) {
              window.electronAPI.openGitDiff(selectedRepo.path, node.path, !!node.staged);
            }
          }}
          title="Click to open diff in VS Code"
        >
          <span className="git-tree-toggle" />
          <span
            className="git-tree-status"
            style={{ color: getStatusColor(node.status || '?') }}
            title={`${getStatusLabel(node.status || '?')}${node.staged ? ' (staged)' : ''}`}
          >
            {node.status}
          </span>
          <span className="git-tree-name" style={{ color: getStatusColor(node.status || '?') }}>{node.name}</span>
          <span className={`git-file-badge ${getStatusBadgeClass(node.status || 'M')}`}>
            {getStatusBadgeLabel(node.status || 'M')}
          </span>
          {node.staged && <span className="git-tree-staged-badge">staged</span>}
        </div>
      );
    });
  };

  const tree = statusResult ? buildTree(statusResult.files) : [];

  return (
    <div className="notebook-container">
      <div className="notebook-sidebar">
        <div className="notebook-sidebar-header">
          <h2>Git Changes</h2>
          <button
            className="notebook-add-btn"
            onClick={() => window.electronAPI.openView('settings')}
            title="Configure repositories"
          >
            ⚙
          </button>
        </div>
        <div className="notebook-list">
          {config?.repos.map(repo => (
            <div
              key={repo.id}
              className={`notebook-list-item ${selectedRepoId === repo.id ? 'active' : ''}`}
              onClick={() => setSelectedRepoId(repo.id)}
              title={repo.path}
            >
              <span className="notebook-list-item-title">{repo.name}</span>
            </div>
          ))}
          {config?.repos.length === 0 && (
            <div className="git-empty-sidebar">
              No repos configured.<br />
              Add some in Settings &gt; Git.
            </div>
          )}
        </div>
      </div>
      <div className="notebook-main">
        {selectedRepo ? (
          <>
            <div className="git-changes-header">
              <div className="git-changes-header-left">
                <h2>{selectedRepo.name}</h2>
                {statusResult?.branch && (
                  <span className="git-branch-badge">{statusResult.branch}</span>
                )}
              </div>
              <button
                className="btn-secondary btn-sm"
                onClick={() => fetchStatus(selectedRepo.path)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div className="git-tree-container">
              {loading && <div className="git-loading">Loading git status...</div>}
              {statusResult?.error && (
                <div className="git-error">{statusResult.error}</div>
              )}
              {!loading && statusResult && tree.length === 0 && !statusResult.error && (
                <div className="git-clean">Working tree clean — no changes.</div>
              )}
              {!loading && tree.length > 0 && (
                <div className="git-tree">
                  {renderTree(tree, 0)}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="git-empty-main">
            Select a repository from the sidebar to view changes.
          </div>
        )}
      </div>
    </div>
  );
}
