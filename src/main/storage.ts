import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TaskEntry } from '../shared/types';

const TASKS_FILE_PATH = path.join(os.homedir(), 'notes', 'general', 'tasks.json');

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readTasks(): TaskEntry[] {
  try {
    if (!fs.existsSync(TASKS_FILE_PATH)) {
      return [];
    }
    const content = fs.readFileSync(TASKS_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      console.error('tasks.json is not an array, returning empty array');
      return [];
    }
    return parsed;
  } catch (error) {
    console.error('Error reading tasks.json:', error);
    return [];
  }
}

export function writeTasks(tasks: TaskEntry[]): void {
  try {
    ensureDirectoryExists(TASKS_FILE_PATH);
    fs.writeFileSync(TASKS_FILE_PATH, JSON.stringify(tasks, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing tasks.json:', error);
    throw error;
  }
}

export function addTaskEntry(entry: TaskEntry): void {
  const tasks = readTasks();
  tasks.push(entry);
  writeTasks(tasks);
}

export function updateTaskEntry(id: string, updates: Partial<Pick<TaskEntry, 'task' | 'durationMinutes' | 'notes' | 'completed'>>): void {
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
