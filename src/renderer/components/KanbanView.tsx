import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Kanban, BoardData, BoardItem } from 'react-kanban-kit';
import { KanbanBoard, KanbanTask, JiraSearchResult, JiraConfig, KanbanColumnConfig } from '../../shared/types';
import '../styles/kanban.css';

function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = getTodayDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

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

function colId(name: string): string {
  return `col-${name.toLowerCase().replace(/\s+/g, '-')}`;
}

function buildHiddenMap(columns: KanbanColumnConfig[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const col of columns) {
    if (col.hidden && col.mappedTo) {
      map.set(col.name, col.mappedTo);
    }
  }
  return map;
}

function buildBoardData(
  tasks: KanbanTask[],
  columns: KanbanColumnConfig[],
  unmappedStatuses: string[],
): BoardData {
  const hiddenMap = buildHiddenMap(columns);
  const visibleCols = columns.filter(c => !c.hidden).map(c => c.name);
  const allCols = [...visibleCols, ...unmappedStatuses];
  const columnIds = allCols.map(colId);

  // Group tasks by display column (resolve hidden→visible)
  const grouped: Record<string, KanbanTask[]> = {};
  for (const col of allCols) {
    grouped[col] = [];
  }
  for (const task of tasks) {
    const displayCol = hiddenMap.get(task.Status) || task.Status;
    if (grouped[displayCol]) {
      grouped[displayCol].push(task);
    }
  }

  const data: BoardData = {
    root: {
      id: 'root',
      title: 'Root',
      children: columnIds,
      totalChildrenCount: columnIds.length,
      parentId: null,
    },
  };

  for (const col of allCols) {
    const cId = colId(col);
    const colTasks = grouped[col];
    const childIds = colTasks.map(t => t.Id);

    data[cId] = {
      id: cId,
      title: col,
      children: childIds,
      totalChildrenCount: childIds.length,
      parentId: 'root',
    };

    for (const task of colTasks) {
      data[task.Id] = {
        id: task.Id,
        title: task.Title,
        parentId: cId,
        children: [],
        totalChildrenCount: 0,
        type: 'card',
        content: {
          description: task.Description,
          status: task.Status, // preserve original stored status
        },
      };
    }
  }

  return data;
}

// Reconstruct KanbanTask[] from BoardData after a move.
// movedCardId tells us which card was dragged — its status becomes the target column.
// All other cards keep their original stored status (content.status).
function boardDataToTasks(boardData: BoardData, allCols: string[], movedCardId: string): KanbanTask[] {
  const tasks: KanbanTask[] = [];
  for (const col of allCols) {
    const cId = colId(col);
    const column = boardData[cId];
    if (!column) continue;
    for (const childId of column.children) {
      const item = boardData[childId];
      if (item && item.type === 'card') {
        tasks.push({
          Id: item.id,
          Title: item.title,
          Description: item.content?.description || '',
          Status: item.id === movedCardId ? col : (item.content?.status || col),
        });
      }
    }
  }
  return tasks;
}

export default function KanbanView() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [allDates, setAllDates] = useState<string[]>([]);
  const [columns, setColumns] = useState<KanbanColumnConfig[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [jiraResults, setJiraResults] = useState<JiraSearchResult[]>([]);
  const [showJiraDropdown, setShowJiraDropdown] = useState(false);
  const [selectedJiraIndex, setSelectedJiraIndex] = useState(0);
  const [jiraConfig, setJiraConfig] = useState<JiraConfig | null>(null);
  const [syncing, setSyncing] = useState(false);
  const jiraDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isToday = selectedDate === getTodayDateString();
  const tasks = board?.tasks || [];

  const visibleColumns = useMemo(
    () => columns.filter(c => !c.hidden).map(c => c.name),
    [columns]
  );

  const hiddenMap = useMemo(() => buildHiddenMap(columns), [columns]);

  // Detect tasks with statuses that don't resolve to any visible column (truly unmapped)
  const unmappedStatuses = useMemo(() => {
    const visibleSet = new Set(visibleColumns);
    const unmapped = new Set<string>();
    for (const task of tasks) {
      const resolved = hiddenMap.get(task.Status) || task.Status;
      if (!visibleSet.has(resolved)) {
        unmapped.add(resolved);
      }
    }
    return Array.from(unmapped);
  }, [tasks, visibleColumns, hiddenMap]);

  const allBoardColumns = useMemo(
    () => [...visibleColumns, ...unmappedStatuses],
    [visibleColumns, unmappedStatuses]
  );

  const loadAllDates = useCallback(async () => {
    const dates = await window.electronAPI.getAllKanbanDates();
    const today = getTodayDateString();
    if (!dates.includes(today)) {
      dates.unshift(today);
    }
    setAllDates(dates);
  }, []);

  const loadBoard = useCallback(async (date: string) => {
    const loaded = await window.electronAPI.getKanbanBoard(date);
    setBoard(loaded);
  }, []);

  useEffect(() => {
    loadAllDates();
    window.electronAPI.getKanbanColumns().then(setColumns);
  }, [loadAllDates]);

  useEffect(() => {
    window.electronAPI.getJiraConfig().then(setJiraConfig);
  }, []);

  useEffect(() => {
    loadBoard(selectedDate);
  }, [selectedDate, loadBoard]);

  useEffect(() => {
    if (isToday) {
      loadAllDates();
    }
  }, [isToday, loadAllDates]);

  // Debounced Jira search
  useEffect(() => {
    if (jiraDebounceRef.current) {
      clearTimeout(jiraDebounceRef.current);
    }

    const trimmed = newTitle.trim();
    if (trimmed.length < 2) {
      setJiraResults([]);
      setShowJiraDropdown(false);
      return;
    }

    jiraDebounceRef.current = setTimeout(async () => {
      try {
        const results = await window.electronAPI.searchJira(trimmed);
        setJiraResults(results);
        setShowJiraDropdown(results.length > 0);
        setSelectedJiraIndex(0);
      } catch {
        setJiraResults([]);
        setShowJiraDropdown(false);
      }
    }, 300);

    return () => {
      if (jiraDebounceRef.current) {
        clearTimeout(jiraDebounceRef.current);
      }
    };
  }, [newTitle]);

  const handleJiraSelect = (result: JiraSearchResult) => {
    setNewTitle(result.key);
    setNewDescription(result.summary);
    setShowJiraDropdown(false);
    setJiraResults([]);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showJiraDropdown && jiraResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedJiraIndex(prev => Math.min(prev + 1, jiraResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedJiraIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleJiraSelect(jiraResults[selectedJiraIndex]);
      } else if (e.key === 'Escape') {
        setShowJiraDropdown(false);
      }
    } else if (e.key === 'Enter') {
      handleAddTask();
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleJumpToToday = () => {
    setSelectedDate(getTodayDateString());
  };

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;
    await window.electronAPI.addKanbanTask(selectedDate, newTitle.trim(), newDescription.trim());
    setNewTitle('');
    setNewDescription('');
    await loadBoard(selectedDate);
    loadAllDates();
  };

  const handleDeleteTask = async (taskId: string) => {
    await window.electronAPI.deleteKanbanTask(selectedDate, taskId);
    await loadBoard(selectedDate);
  };

  const handleSyncWithJira = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await window.electronAPI.syncKanbanWithJira(selectedDate);
      await loadBoard(selectedDate);
      loadAllDates();
    } finally {
      setSyncing(false);
    }
  };

  const boardData = useMemo(
    () => buildBoardData(tasks, columns, unmappedStatuses),
    [tasks, columns, unmappedStatuses]
  );

  const handleCardMove = useCallback(async (move: {
    cardId: string;
    fromColumnId: string;
    toColumnId: string;
    position: number;
  }) => {
    if (!isToday) return;

    // Build updated boardData from move
    const newData = { ...boardData };

    // Deep copy the affected columns
    const fromCol = { ...newData[move.fromColumnId], children: [...newData[move.fromColumnId].children] };
    const toCol = move.fromColumnId === move.toColumnId
      ? fromCol
      : { ...newData[move.toColumnId], children: [...newData[move.toColumnId].children] };

    // Remove card from source
    fromCol.children = fromCol.children.filter(id => id !== move.cardId);
    fromCol.totalChildrenCount = fromCol.children.length;

    // Insert card at target position
    toCol.children.splice(move.position, 0, move.cardId);
    toCol.totalChildrenCount = toCol.children.length;

    // Update card's parent
    const card = { ...newData[move.cardId], parentId: move.toColumnId };

    newData[move.fromColumnId] = fromCol;
    newData[move.toColumnId] = toCol;
    newData[move.cardId] = card;

    // Persist the full task list with updated statuses/order
    const updatedTasks = boardDataToTasks(newData, allBoardColumns, move.cardId);
    await window.electronAPI.reorderKanbanTasks(selectedDate, updatedTasks);
    await loadBoard(selectedDate);
  }, [isToday, boardData, selectedDate, loadBoard, allBoardColumns]);

  const getJiraTicketKey = useCallback((title: string): string | null => {
    if (!jiraConfig?.ticketPattern) return null;
    try {
      const match = title.match(new RegExp(jiraConfig.ticketPattern));
      return match ? match[0] : null;
    } catch {
      return null;
    }
  }, [jiraConfig]);

  const configMap = useMemo(() => ({
    card: {
      render: ({ data }: { data: BoardItem }) => {
        const ticketKey = getJiraTicketKey(data.title);
        return (
          <div className="kanban-card">
            <div className="kanban-card-header">
              <div className="kanban-card-title">{data.title}</div>
              {ticketKey && jiraConfig?.baseUrl && (
                <button
                  className="kanban-card-jira-link"
                  title={`Open ${ticketKey} in Jira`}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.electronAPI.openExternal(`${jiraConfig.baseUrl}/browse/${ticketKey}`);
                  }}
                >
                  ↗
                </button>
              )}
              {isToday && (
                <button
                  className="kanban-card-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTask(data.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <div className="kanban-card-body">
              {data.content?.description ? (
                <div className="kanban-card-description">{data.content.description}</div>
              ) : (
                <div className="kanban-card-no-desc">No description</div>
              )}
            </div>
          </div>
        );
      },
      isDraggable: isToday,
    },
  }), [isToday, jiraConfig, getJiraTicketKey]);

  const unmappedSet = useMemo(() => new Set(unmappedStatuses), [unmappedStatuses]);

  const renderColumnHeader = useCallback((column: BoardItem) => {
    const count = column.children.length;
    const isUnmapped = unmappedSet.has(column.title);
    return (
      <div className={`kanban-column-header${isUnmapped ? ' unmapped' : ''}`}>
        <span className="kanban-column-title">{column.title}</span>
        {isUnmapped && (
          <button
            className="kanban-column-copy"
            title="Copy status name"
            onClick={() => navigator.clipboard.writeText(column.title)}
          >
            Copy
          </button>
        )}
        <span className="kanban-column-count">{count}</span>
      </div>
    );
  }, [unmappedSet]);

  return (
    <div className="kanban-container">
      <div className="kanban-header">
        <h1 className="kanban-title">Kanban Board</h1>
        <div className="kanban-controls">
          <select
            className="kanban-date-picker"
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
            <button className="kanban-today-button" onClick={handleJumpToToday}>
              Today
            </button>
          )}
          {!isToday && <span className="kanban-readonly-badge">Read only</span>}
        </div>
      </div>

      {isToday && (
        <div className="kanban-add-form">
          <div className="kanban-title-wrapper">
            <input
              ref={titleInputRef}
              type="text"
              placeholder="Task title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={() => setTimeout(() => setShowJiraDropdown(false), 200)}
            />
            {showJiraDropdown && jiraResults.length > 0 && (
              <div className="kanban-jira-dropdown">
                {jiraResults.map((result, index) => (
                  <div
                    key={result.key}
                    className={`kanban-jira-item${index === selectedJiraIndex ? ' selected' : ''}`}
                    onMouseDown={() => handleJiraSelect(result)}
                    onMouseEnter={() => setSelectedJiraIndex(index)}
                  >
                    <span className="jira-badge">JIRA</span>
                    <span className="kanban-jira-item-key">{result.key}</span>
                    <span className="kanban-jira-item-summary">{result.summary}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <textarea
            placeholder="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <button
            className="kanban-add-btn"
            onClick={handleAddTask}
            disabled={!newTitle.trim()}
          >
            + Add Task
          </button>
          <button
            className="kanban-import-btn"
            onClick={handleSyncWithJira}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Sync with Jira'}
          </button>
        </div>
      )}

      <div className="kanban-board-wrapper">
        <Kanban
          dataSource={boardData}
          configMap={configMap}
          viewOnly={!isToday}
          onCardMove={handleCardMove}
          renderColumnHeader={renderColumnHeader}
          cardsGap={8}
          rootClassName="kanban-root"
        />
      </div>
    </div>
  );
}
