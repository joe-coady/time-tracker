import { useState, useEffect, useCallback } from 'react';
import { TaskType } from '../../shared/types';

export function useTaskTypes() {
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const types = await window.electronAPI.getTaskTypes();
      setTaskTypes(types);
    } catch (error) {
      console.error('Failed to load task types:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addTaskType = useCallback(async (name: string) => {
    const newType = await window.electronAPI.addTaskType(name);
    setTaskTypes(prev => [...prev, newType]);
    return newType;
  }, []);

  const updateTaskType = useCallback(async (id: string, name: string) => {
    await window.electronAPI.updateTaskType(id, name);
    setTaskTypes(prev => prev.map(t => (t.id === id ? { ...t, name } : t)));
  }, []);

  const deleteTaskType = useCallback(async (id: string) => {
    await window.electronAPI.deleteTaskType(id);
    setTaskTypes(prev => prev.filter(t => t.id !== id));
  }, []);

  return {
    taskTypes,
    loading,
    addTaskType,
    updateTaskType,
    deleteTaskType,
    refresh,
  };
}
