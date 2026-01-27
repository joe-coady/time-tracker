import { useState, useEffect, useCallback } from 'react';
import { CalculatedTaskEntry, CurrentState, PreviousTask, TaskEntry } from '../../shared/types';

export function useTaskData() {
  const [tasks, setTasks] = useState<CalculatedTaskEntry[]>([]);
  const [previousTasks, setPreviousTasks] = useState<PreviousTask[]>([]);
  const [currentState, setCurrentState] = useState<CurrentState>({
    currentTask: null,
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

  const updateEntry = useCallback(async (id: string, updates: Partial<Pick<TaskEntry, 'task' | 'durationMinutes' | 'notes' | 'completed' | 'taskTypeIds'>>) => {
    await window.electronAPI.updateEntry(id, updates);
    await loadData();
  }, [loadData]);

  const deleteEntry = useCallback(async (id: string) => {
    await window.electronAPI.deleteEntry(id);
    await loadData();
  }, [loadData]);

  const setExplicitDuration = useCallback(async (id: string, durationMinutes: number) => {
    await window.electronAPI.setExplicitDuration(id, durationMinutes);
    await loadData();
  }, [loadData]);

  const clearExplicitDuration = useCallback(async (id: string) => {
    await window.electronAPI.clearExplicitDuration(id);
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
    setExplicitDuration,
    clearExplicitDuration,
    refresh: loadData,
  };
}
