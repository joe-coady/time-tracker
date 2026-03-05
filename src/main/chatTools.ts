import { readTasks, getLastEntry, getKanbanBoardForDate, readNotebookNotes, getDailyNoteForDate } from './storage';
import { searchJiraIssues, fetchAssignedJiraTickets, fetchJiraTicketStatuses, fetchJiraTicketComments } from './jira';
import { fetchGitHubPRs, fetchDevBranchTickets } from './github';
import { calculateDurations } from '../shared/durationUtils';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_jira_issues',
    description: 'Search Jira issues by text query. Returns matching issue keys and summaries.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text to find Jira issues' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_assigned_jira_tickets',
    description: 'Get all Jira tickets currently assigned to me that are not done.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_jira_ticket_statuses',
    description: 'Get the current status for specific Jira ticket keys.',
    input_schema: {
      type: 'object',
      properties: {
        keys: { type: 'array', items: { type: 'string' }, description: 'Array of Jira ticket keys like ["PROJ-123", "PROJ-456"]' },
      },
      required: ['keys'],
    },
  },
  {
    name: 'get_jira_ticket_comments',
    description: 'Get comments on a specific Jira ticket, most recent first.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Jira ticket key like "PROJ-123"' },
      },
      required: ['key'],
    },
  },
  {
    name: 'get_github_prs',
    description: 'Get all open GitHub pull requests from configured organizations.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_dev_branch_tickets',
    description: 'Get Jira ticket keys mentioned in recent commits on the dev branch for specified repos.',
    input_schema: {
      type: 'object',
      properties: {
        repos: { type: 'array', items: { type: 'string' }, description: 'Array of repo full names like ["org/repo"]' },
      },
      required: ['repos'],
    },
  },
  {
    name: 'get_time_entries',
    description: 'Get time tracking entries for today with calculated durations. Shows what tasks were worked on and for how long.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_current_task',
    description: 'Get what I am currently working on right now (the most recent time entry).',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_kanban_board',
    description: 'Get the kanban board for a specific date, showing tasks organized by status columns.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format. Use today\'s date if not specified.' },
      },
      required: ['date'],
    },
  },
  {
    name: 'get_notebook_notes',
    description: 'Get all notebook notes (persistent notes, not daily notes).',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_daily_note',
    description: 'Get the daily note for a specific date.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format. Use today\'s date if not specified.' },
      },
      required: ['date'],
    },
  },
];

export async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'search_jira_issues': {
        const results = await searchJiraIssues(input.query as string);
        return JSON.stringify(results);
      }
      case 'get_assigned_jira_tickets': {
        const results = await fetchAssignedJiraTickets();
        return JSON.stringify(results);
      }
      case 'get_jira_ticket_statuses': {
        const results = await fetchJiraTicketStatuses(input.keys as string[]);
        return JSON.stringify(results);
      }
      case 'get_jira_ticket_comments': {
        const results = await fetchJiraTicketComments(input.key as string);
        return JSON.stringify(results);
      }
      case 'get_github_prs': {
        const results = await fetchGitHubPRs();
        return JSON.stringify(results);
      }
      case 'get_dev_branch_tickets': {
        const results = await fetchDevBranchTickets(input.repos as string[]);
        return JSON.stringify(results);
      }
      case 'get_time_entries': {
        const tasks = readTasks();
        const today = new Date().toISOString().slice(0, 10);
        const todayTasks = tasks.filter(t => t.startTime.startsWith(today));
        const calculated = calculateDurations(todayTasks);
        return JSON.stringify(calculated);
      }
      case 'get_current_task': {
        const entry = getLastEntry();
        return entry ? JSON.stringify(entry) : JSON.stringify({ message: 'No current task' });
      }
      case 'get_kanban_board': {
        const board = getKanbanBoardForDate(input.date as string);
        return board ? JSON.stringify(board) : JSON.stringify({ message: 'No board found for this date' });
      }
      case 'get_notebook_notes': {
        const notes = readNotebookNotes();
        return JSON.stringify(notes);
      }
      case 'get_daily_note': {
        const note = getDailyNoteForDate(input.date as string);
        return note ? JSON.stringify(note) : JSON.stringify({ message: 'No daily note for this date' });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
