import { useState, useEffect, useCallback } from 'react';
import { TaskEntry, CurrentState, PreviousTask } from '../../shared/types';

export function useTaskData() {
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [previousTasks, setPreviousTasks] = useState<PreviousTask[]>([]);
  const [currentState, setCurrentState] = useState<CurrentState>({
    currentTask: null,
    remainingMinutes: null,
    elapsedMinutes: null,
  });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [tasksData, namesData, stateData] = await Promise.all([
        window.electronAPI.getTasks(),
        window.electronAPI.getPreviousTaskNames(),
        window.electronAPI.getCurrentState(),
      ]);
      setTasks(tasksData);
      setPreviousTasks(namesData);
      setCurrentState(stateData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startTask = useCallback(async (taskName: string, durationMinutes: number) => {
    await window.electronAPI.startTask(taskName, durationMinutes);
    await loadData();
  }, [loadData]);

  const updateEntry = useCallback(async (id: string, updates: Partial<Pick<TaskEntry, 'task' | 'durationMinutes'>>) => {
    await window.electronAPI.updateEntry(id, updates);
    await loadData();
  }, [loadData]);

  const deleteEntry = useCallback(async (id: string) => {
    await window.electronAPI.deleteEntry(id);
    await loadData();
  }, [loadData]);

  return {
    tasks,
    previousTasks,
    currentState,
    loading,
    startTask,
    updateEntry,
    deleteEntry,
    refresh: loadData,
  };
}
