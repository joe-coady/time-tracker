import { contextBridge, ipcRenderer } from 'electron';
import { CalculatedTaskEntry, CurrentState, ElectronAPI, PreviousTask, TaskEntry, TaskType } from './shared/types';

const electronAPI: ElectronAPI = {
  getTasks: (): Promise<CalculatedTaskEntry[]> => ipcRenderer.invoke('get-tasks'),

  getPreviousTaskNames: (): Promise<PreviousTask[]> => ipcRenderer.invoke('get-previous-task-names'),

  startTask: (taskName: string, durationMinutes: number): Promise<void> =>
    ipcRenderer.invoke('start-task', taskName, durationMinutes),

  updateEntry: (id: string, updates: Partial<Pick<TaskEntry, 'task' | 'durationMinutes' | 'notes' | 'completed' | 'taskTypeIds'>>): Promise<void> =>
    ipcRenderer.invoke('update-entry', id, updates),

  deleteEntry: (id: string): Promise<void> => ipcRenderer.invoke('delete-entry', id),

  getCurrentState: (): Promise<CurrentState> => ipcRenderer.invoke('get-current-state'),

  closeDialog: (): Promise<void> => ipcRenderer.invoke('close-dialog'),

  setExplicitDuration: (id: string, durationMinutes: number): Promise<void> =>
    ipcRenderer.invoke('set-explicit-duration', id, durationMinutes),

  clearExplicitDuration: (id: string): Promise<void> =>
    ipcRenderer.invoke('clear-explicit-duration', id),

  onTimerExpired: (callback: () => void): void => {
    ipcRenderer.on('timer-expired', callback);
  },

  removeTimerExpiredListener: (): void => {
    ipcRenderer.removeAllListeners('timer-expired');
  },

  getTaskTypes: (): Promise<TaskType[]> => ipcRenderer.invoke('get-task-types'),

  addTaskType: (name: string): Promise<TaskType> => ipcRenderer.invoke('add-task-type', name),

  updateTaskType: (id: string, name: string): Promise<void> =>
    ipcRenderer.invoke('update-task-type', id, name),

  deleteTaskType: (id: string): Promise<void> => ipcRenderer.invoke('delete-task-type', id),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
