import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Kanban, BoardData, BoardItem } from 'react-kanban-kit';
import { KanbanBoard, KanbanTask, KanbanStatus } from '../../shared/types';
import '../styles/kanban.css';

const COLUMNS: KanbanStatus[] = ['Todo', 'In Progress', 'Dev Review', 'QA', 'Done'];

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

function colId(status: KanbanStatus): string {
  return `col-${status.toLowerCase().replace(/\s+/g, '-')}`;
}

function buildBoardData(tasks: KanbanTask[]): BoardData {
  const columnIds = COLUMNS.map(colId);

  // Group tasks by status
  const grouped: Record<string, KanbanTask[]> = {};
  for (const col of COLUMNS) {
    grouped[col] = [];
  }
  for (const task of tasks) {
    if (grouped[task.Status]) {
      grouped[task.Status].push(task);
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

  for (const col of COLUMNS) {
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
          status: task.Status,
        },
      };
    }
  }

  return data;
}

// Reconstruct KanbanTask[] from BoardData after a move
function boardDataToTasks(boardData: BoardData): KanbanTask[] {
  const tasks: KanbanTask[] = [];
  for (const col of COLUMNS) {
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
          Status: col,
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
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const isToday = selectedDate === getTodayDateString();
  const tasks = board?.tasks || [];

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
  }, [loadAllDates]);

  useEffect(() => {
    loadBoard(selectedDate);
  }, [selectedDate, loadBoard]);

  useEffect(() => {
    if (isToday) {
      loadAllDates();
    }
  }, [isToday, loadAllDates]);

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

  const boardData = useMemo(() => buildBoardData(tasks), [tasks]);

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
    const updatedTasks = boardDataToTasks(newData);
    await window.electronAPI.reorderKanbanTasks(selectedDate, updatedTasks);
    await loadBoard(selectedDate);
  }, [isToday, boardData, selectedDate, loadBoard]);

  const configMap = useMemo(() => ({
    card: {
      render: ({ data }: { data: BoardItem }) => (
        <div className="kanban-card">
          <div className="kanban-card-header">
            <div className="kanban-card-title">{data.title}</div>
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
      ),
      isDraggable: isToday,
    },
  }), [isToday]);

  const renderColumnHeader = useCallback((column: BoardItem) => {
    const count = column.children.length;
    return (
      <div className="kanban-column-header">
        <span className="kanban-column-title">{column.title}</span>
        <span className="kanban-column-count">{count}</span>
      </div>
    );
  }, []);

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
          <input
            type="text"
            placeholder="Task title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); }}
          />
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
