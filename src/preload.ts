import { contextBridge, ipcRenderer } from 'electron';
import { TaskEntry, CurrentState, ElectronAPI, PreviousTask } from './shared/types';

const electronAPI: ElectronAPI = {
  getTasks: (): Promise<TaskEntry[]> => ipcRenderer.invoke('get-tasks'),

  getPreviousTaskNames: (): Promise<PreviousTask[]> => ipcRenderer.invoke('get-previous-task-names'),

  startTask: (taskName: string, durationMinutes: number): Promise<void> =>
    ipcRenderer.invoke('start-task', taskName, durationMinutes),

  updateEntry: (id: string, updates: Partial<Pick<TaskEntry, 'task' | 'durationMinutes'>>): Promise<void> =>
    ipcRenderer.invoke('update-entry', id, updates),

  deleteEntry: (id: string): Promise<void> => ipcRenderer.invoke('delete-entry', id),

  getCurrentState: (): Promise<CurrentState> => ipcRenderer.invoke('get-current-state'),

  closeDialog: (): Promise<void> => ipcRenderer.invoke('close-dialog'),

  onTimerExpired: (callback: () => void): void => {
    ipcRenderer.on('timer-expired', callback);
  },

  removeTimerExpiredListener: (): void => {
    ipcRenderer.removeAllListeners('timer-expired');
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
