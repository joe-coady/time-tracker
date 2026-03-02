import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { TaskEntry, TaskType, TasksData, DailyNote, Note, QuickLinkRule } from '../shared/types';

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

export function updateTaskEntry(id: string, updates: Partial<Pick<TaskEntry, 'task' | 'startTime' | 'durationMinutes' | 'notes' | 'completed' | 'taskTypeIds'>>): void {
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

export function getPreviousTaskNames(): { name: string; lastDuration: number; lastTaskTypeIds: string[] }[] {
  const tasks = readTasks();
  const taskMap = new Map<string, { lastDuration: number; lastTaskTypeIds: string[] }>();
  // Get unique task names from non-completed tasks with their last duration and tags, most recent first
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (!tasks[i].completed && !taskMap.has(tasks[i].task)) {
      taskMap.set(tasks[i].task, {
        lastDuration: tasks[i].durationMinutes ?? 60,
        lastTaskTypeIds: tasks[i].taskTypeIds ?? [],
      });
    }
  }
  return Array.from(taskMap.entries()).map(([name, data]) => ({
    name,
    lastDuration: data.lastDuration,
    lastTaskTypeIds: data.lastTaskTypeIds,
  }));
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

// Daily Notes functions
function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export function readDailyNotes(): DailyNote[] {
  return readTasksData().dailyNotes || [];
}

export function getDailyNoteForDate(date: string): DailyNote | null {
  const notes = readDailyNotes();
  const existingNote = notes.find(n => n.date === date);

  if (existingNote) {
    return existingNote;
  }

  // If requesting today's note and it doesn't exist, create it by copying from previous day
  const today = getTodayDateString();
  if (date === today) {
    // Find the most recent previous note
    const sortedNotes = [...notes].sort((a, b) => b.date.localeCompare(a.date));
    const previousNote = sortedNotes.find(n => n.date < today);
    const content = previousNote?.content || '';

    // Create today's note
    const newNote = upsertDailyNote(today, content);
    return newNote;
  }

  return null;
}

export function upsertDailyNote(date: string, content: string): DailyNote {
  const data = readTasksData();
  if (!data.dailyNotes) {
    data.dailyNotes = [];
  }

  const existingIndex = data.dailyNotes.findIndex(n => n.date === date);
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    // Update existing note
    data.dailyNotes[existingIndex].content = content;
    data.dailyNotes[existingIndex].updatedAt = now;
    writeTasksData(data);
    return data.dailyNotes[existingIndex];
  } else {
    // Create new note
    const newNote: DailyNote = {
      id: uuidv4(),
      date,
      content,
      createdAt: now,
      updatedAt: now,
    };
    data.dailyNotes.push(newNote);
    writeTasksData(data);
    return newNote;
  }
}

export function getAllNoteDates(): string[] {
  const notes = readDailyNotes();
  return notes.map(n => n.date).sort((a, b) => b.localeCompare(a)); // Most recent first
}

// Notebook Notes functions
export function readNotebookNotes(): Note[] {
  return readTasksData().notes || [];
}

export function createNotebookNote(title: string, content: string): Note {
  const data = readTasksData();
  if (!data.notes) {
    data.notes = [];
  }
  const now = new Date().toISOString();
  const newNote: Note = {
    id: uuidv4(),
    title,
    content,
    createdAt: now,
    updatedAt: now,
  };
  data.notes.push(newNote);
  writeTasksData(data);
  return newNote;
}

export function updateNotebookNote(id: string, title: string, content: string): Note {
  const data = readTasksData();
  if (!data.notes) {
    throw new Error(`Note with id ${id} not found`);
  }
  const index = data.notes.findIndex(n => n.id === id);
  if (index === -1) {
    throw new Error(`Note with id ${id} not found`);
  }
  data.notes[index].title = title;
  data.notes[index].content = content;
  data.notes[index].updatedAt = new Date().toISOString();
  writeTasksData(data);
  return data.notes[index];
}

export function togglePinNotebookNote(id: string): Note {
  const data = readTasksData();
  if (!data.notes) {
    throw new Error(`Note with id ${id} not found`);
  }
  const index = data.notes.findIndex(n => n.id === id);
  if (index === -1) {
    throw new Error(`Note with id ${id} not found`);
  }
  data.notes[index].pinned = !data.notes[index].pinned;
  writeTasksData(data);
  return data.notes[index];
}

export function deleteNotebookNote(id: string): void {
  const data = readTasksData();
  if (!data.notes) {
    throw new Error(`Note with id ${id} not found`);
  }
  const index = data.notes.findIndex(n => n.id === id);
  if (index === -1) {
    throw new Error(`Note with id ${id} not found`);
  }
  data.notes.splice(index, 1);
  writeTasksData(data);
}

// Quick Link Rules functions
export function readQuickLinkRules(): QuickLinkRule[] {
  return readTasksData().quickLinkRules || [];
}

export function addQuickLinkRule(linkPattern: string, linkTarget: string): QuickLinkRule {
  const data = readTasksData();
  if (!data.quickLinkRules) {
    data.quickLinkRules = [];
  }
  const newRule: QuickLinkRule = {
    id: uuidv4(),
    linkPattern,
    linkTarget,
  };
  data.quickLinkRules.push(newRule);
  writeTasksData(data);
  return newRule;
}

export function deleteQuickLinkRule(id: string): void {
  const data = readTasksData();
  if (!data.quickLinkRules) {
    throw new Error(`QuickLinkRule with id ${id} not found`);
  }
  const index = data.quickLinkRules.findIndex(r => r.id === id);
  if (index === -1) {
    throw new Error(`QuickLinkRule with id ${id} not found`);
  }
  data.quickLinkRules.splice(index, 1);
  writeTasksData(data);
}
