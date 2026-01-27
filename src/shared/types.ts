export interface TaskType {
  id: string;
  name: string;
}

export interface TaskEntry {
  id: string;
  task: string;
  startTime: string;
  durationMinutes?: number; // Explicit duration override (optional)
  notes?: string;
  completed?: boolean;
  taskTypeIds?: string[]; // Optional array of TaskType IDs
}

export interface TasksData {
  version: 1;
  taskTypes: TaskType[];
  entries: TaskEntry[];
}

export interface CalculatedTaskEntry extends TaskEntry {
  calculatedDurationMinutes: number | null; // null = ongoing task
  isExplicitDuration: boolean;
}

export interface CurrentState {
  currentTask: string | null;
  elapsedMinutes: number | null;
}

export type DurationOption = 15 | 30 | 60 | 120 | 180 | 240;

export const DURATION_OPTIONS: { value: DurationOption; label: string }[] = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
  { value: 240, label: '4 hours' },
];

export interface PreviousTask {
  name: string;
  lastDuration: number;
}

export interface ElectronAPI {
  getTasks: () => Promise<CalculatedTaskEntry[]>;
  getPreviousTaskNames: () => Promise<PreviousTask[]>;
  startTask: (taskName: string, durationMinutes: number) => Promise<void>;
  updateEntry: (id: string, updates: Partial<Pick<TaskEntry, 'task' | 'durationMinutes' | 'notes' | 'completed' | 'taskTypeIds'>>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getCurrentState: () => Promise<CurrentState>;
  closeDialog: () => Promise<void>;
  setExplicitDuration: (id: string, durationMinutes: number) => Promise<void>;
  clearExplicitDuration: (id: string) => Promise<void>;
  onTimerExpired: (callback: () => void) => void;
  removeTimerExpiredListener: () => void;
  getTaskTypes: () => Promise<TaskType[]>;
  addTaskType: (name: string) => Promise<TaskType>;
  updateTaskType: (id: string, name: string) => Promise<void>;
  deleteTaskType: (id: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
