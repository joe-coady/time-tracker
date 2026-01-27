import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { TaskEntry, TaskType, TasksData } from '../shared/types';

const TASKS_FILE_PATH = path.join(os.homedir(), 'notes', 'general', 'tasks.json');

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function migrateData(parsed: unknown): TasksData {
  // If it's an array (old format), migrate to new format
  if (Array.isArray(parsed)) {
    return {
      version: 1,
      taskTypes: [],
      entries: parsed as TaskEntry[],
    };
  }
  // If it's already the new format, return as-is
  if (parsed && typeof parsed === 'object' && 'version' in parsed) {
    return parsed as TasksData;
  }
  // Fallback to empty data
  return {
    version: 1,
    taskTypes: [],
    entries: [],
  };
}

function readTasksData(): TasksData {
  try {
    if (!fs.existsSync(TASKS_FILE_PATH)) {
      return { version: 1, taskTypes: [], entries: [] };
    }
    const content = fs.readFileSync(TASKS_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return migrateData(parsed);
  } catch (error) {
    console.error('Error reading tasks.json:', error);
    return { version: 1, taskTypes: [], entries: [] };
  }
}

function writeTasksData(data: TasksData): void {
  try {
    ensureDirectoryExists(TASKS_FILE_PATH);
    fs.writeFileSync(TASKS_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing tasks.json:', error);
    throw error;
  }
}

export function readTasks(): TaskEntry[] {
  return readTasksData().entries;
}

export function writeTasks(tasks: TaskEntry[]): void {
  const data = readTasksData();
  data.entries = tasks;
  writeTasksData(data);
}

export function addTaskEntry(entry: TaskEntry): void {
  const tasks = readTasks();
  tasks.push(entry);
  writeTasks(tasks);
}

export function updateTaskEntry(id: string, updates: Partial<Pick<TaskEntry, 'task' | 'durationMinutes' | 'notes' | 'completed' | 'taskTypeIds'>>): void {
  const tasks = readTasks();
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) {
    throw new Error(`Task with id ${id} not found`);
  }
  // Apply updates, handling explicit undefined to delete the key
  const updated = { ...tasks[index] };
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      delete (updated as Record<string, unknown>)[key];
    } else {
      (updated as Record<string, unknown>)[key] = value;
    }
  }
  tasks[index] = updated;
  writeTasks(tasks);
}

export function deleteTaskEntry(id: string): void {
  const tasks = readTasks();
  const filtered = tasks.filter(t => t.id !== id);
  if (filtered.length === tasks.length) {
    throw new Error(`Task with id ${id} not found`);
  }
  writeTasks(filtered);
}

export function getLastEntry(): TaskEntry | null {
  const tasks = readTasks();
  if (tasks.length === 0) return null;
  return tasks[tasks.length - 1];
}

export function getPreviousTaskNames(): { name: string; lastDuration: number }[] {
  const tasks = readTasks();
  const taskMap = new Map<string, number>();
  // Get unique task names from non-completed tasks with their last duration, most recent first
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (!tasks[i].completed && !taskMap.has(tasks[i].task)) {
      // Default to 60 minutes if no explicit duration
      taskMap.set(tasks[i].task, tasks[i].durationMinutes ?? 60);
    }
  }
  return Array.from(taskMap.entries()).map(([name, lastDuration]) => ({ name, lastDuration }));
}

// Task Types functions
export function readTaskTypes(): TaskType[] {
  return readTasksData().taskTypes;
}

export function addTaskType(name: string): TaskType {
  const data = readTasksData();
  const newType: TaskType = {
    id: uuidv4(),
    name,
  };
  data.taskTypes.push(newType);
  writeTasksData(data);
  return newType;
}

export function updateTaskType(id: string, name: string): void {
  const data = readTasksData();
  const index = data.taskTypes.findIndex(t => t.id === id);
  if (index === -1) {
    throw new Error(`TaskType with id ${id} not found`);
  }
  data.taskTypes[index].name = name;
  writeTasksData(data);
}

export function deleteTaskType(id: string): void {
  const data = readTasksData();
  const index = data.taskTypes.findIndex(t => t.id === id);
  if (index === -1) {
    throw new Error(`TaskType with id ${id} not found`);
  }
  // Remove the task type
  data.taskTypes.splice(index, 1);
  // Remove this type ID from all entries that reference it
  for (const entry of data.entries) {
    if (entry.taskTypeIds) {
      entry.taskTypeIds = entry.taskTypeIds.filter(typeId => typeId !== id);
      if (entry.taskTypeIds.length === 0) {
        delete entry.taskTypeIds;
      }
    }
  }
  // Also remove from export filter if present
  if (data.exportFilterTagIds) {
    data.exportFilterTagIds = data.exportFilterTagIds.filter(typeId => typeId !== id);
  }
  writeTasksData(data);
}

// Export filter functions
export function getExportFilterTagIds(): string[] {
  return readTasksData().exportFilterTagIds || [];
}

export function setExportFilterTagIds(tagIds: string[]): void {
  const data = readTasksData();
  data.exportFilterTagIds = tagIds;
  writeTasksData(data);
}
