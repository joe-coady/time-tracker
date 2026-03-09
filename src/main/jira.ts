import * as https from 'https';
import { URL } from 'url';
import { JiraConfig, JiraProject, JiraSearchResult, JiraTicketStatus, JiraVersion } from '../shared/types';
import { readJiraConfig } from './storage';

function jiraRequest(url: string, auth: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

export async function searchJiraIssues(query: string): Promise<JiraSearchResult[]> {
  const config = readJiraConfig();
  if (!config) return [];

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = new URL(`${config.baseUrl}/rest/api/3/issue/picker`);
  url.searchParams.set('query', trimmed);
  url.searchParams.set('currentJQL', 'statusCategory != Done');
  url.searchParams.set('showSubTasks', 'true');

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  try {
    const body = await jiraRequest(url.toString(), auth);
    const data = JSON.parse(body);
    const seen = new Set<string>();
    const results: JiraSearchResult[] = [];
    for (const section of data.sections ?? []) {
      for (const issue of section.issues ?? []) {
        if (seen.has(issue.key)) continue;
        seen.add(issue.key);
        results.push({
          key: issue.key,
          summary: issue.summaryText ?? issue.summary ?? '',
        });
      }
    }
    return results.slice(0, 8);
  } catch {
    return [];
  }
}

export function extractFieldDisplayValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value.map(extractFieldDisplayValue).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.displayName === 'string') return obj.displayName;
  }
  return '';
}

export async function fetchJiraTicketStatuses(keys: string[]): Promise<JiraTicketStatus[]> {
  const config = readJiraConfig();
  if (!config || keys.length === 0) return [];

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  const results: JiraTicketStatus[] = [];

  const customFieldIds = (config.customFields ?? []).map(cf => cf.fieldId);
  const fields = ['status', 'summary', ...customFieldIds].join(',');

  // Batch up to 50 keys per request (Jira limit)
  for (let i = 0; i < keys.length; i += 50) {
    const batch = keys.slice(i, i + 50);
    const jql = `key in (${batch.join(',')})`;
    const url = new URL(`${config.baseUrl}/rest/api/3/search/jql`);
    url.searchParams.set('jql', jql);
    url.searchParams.set('fields', fields);
    url.searchParams.set('maxResults', '50');

    try {
      const body = await jiraRequest(url.toString(), auth);
      const data = JSON.parse(body);
      for (const issue of data.issues ?? []) {
        const customFields: Record<string, string> = {};
        for (const fieldId of customFieldIds) {
          const displayValue = extractFieldDisplayValue(issue.fields[fieldId]);
          if (displayValue) {
            customFields[fieldId] = displayValue;
          }
        }
        results.push({
          key: issue.key,
          summary: issue.fields.summary ?? '',
          status: issue.fields.status.name,
          statusCategory: issue.fields.status.statusCategory.key,
          customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
        });
      }
    } catch (err) {
      console.error('fetchJiraTicketStatuses failed for batch:', batch, err);
    }
  }

  return results;
}

export async function fetchAssignedJiraTickets(): Promise<JiraSearchResult[]> {
  const config = readJiraConfig();
  if (!config) return [];

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  const jql = 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';
  const url = new URL(`${config.baseUrl}/rest/api/3/search/jql`);
  url.searchParams.set('jql', jql);
  url.searchParams.set('fields', 'summary,status');
  url.searchParams.set('maxResults', '50');

  try {
    const body = await jiraRequest(url.toString(), auth);
    const data = JSON.parse(body);
    const results: JiraSearchResult[] = [];
    for (const issue of data.issues ?? []) {
      results.push({
        key: issue.key,
        summary: issue.fields.summary ?? '',
      });
    }
    return results;
  } catch (err) {
    console.error('fetchAssignedJiraTickets failed:', err);
    return [];
  }
}

export interface JiraComment {
  author: string;
  body: string;
  created: string;
}

export async function fetchJiraTicketComments(key: string): Promise<JiraComment[]> {
  const config = readJiraConfig();
  if (!config) return [];

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  const url = `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(key)}/comment?orderBy=-created&maxResults=20`;

  try {
    const body = await jiraRequest(url, auth);
    const data = JSON.parse(body);
    const results: JiraComment[] = [];
    for (const c of data.comments ?? []) {
      // ADF body → extract plain text from paragraph/text nodes
      let text = '';
      if (c.body?.content) {
        for (const block of c.body.content) {
          for (const inline of block.content ?? []) {
            if (inline.type === 'text') text += inline.text;
          }
          text += '\n';
        }
      }
      results.push({
        author: c.author?.displayName ?? c.author?.emailAddress ?? 'Unknown',
        body: text.trim(),
        created: c.created,
      });
    }
    return results;
  } catch (err) {
    console.error('fetchJiraTicketComments failed:', err);
    return [];
  }
}

export async function fetchJiraProjects(): Promise<JiraProject[]> {
  const config = readJiraConfig();
  if (!config) return [];

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  const url = `${config.baseUrl}/rest/api/3/project`;

  try {
    const body = await jiraRequest(url, auth);
    const data = JSON.parse(body);
    return (data as Array<{ key: string; name: string }>).map(p => ({ key: p.key, name: p.name }));
  } catch (err) {
    console.error('fetchJiraProjects failed:', err);
    return [];
  }
}

export async function fetchJiraVersions(projectKey: string): Promise<JiraVersion[]> {
  const config = readJiraConfig();
  if (!config) return [];

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  const url = `${config.baseUrl}/rest/api/3/project/${encodeURIComponent(projectKey)}/versions`;

  try {
    const body = await jiraRequest(url, auth);
    const data = JSON.parse(body) as Array<{ id: string; name: string; released: boolean; releaseDate?: string }>;
    return data.map(v => ({
      id: v.id,
      name: v.name,
      released: v.released,
      releaseDate: v.releaseDate,
    }));
  } catch (err) {
    console.error('fetchJiraVersions failed:', err);
    return [];
  }
}

export async function fetchReleaseTickets(projectKey: string, versionName: string): Promise<JiraTicketStatus[]> {
  const config = readJiraConfig();
  if (!config) return [];

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  const customFieldIds = (config.customFields ?? []).map(cf => cf.fieldId);
  const fields = ['status', 'summary', ...customFieldIds].join(',');
  const results: JiraTicketStatus[] = [];

  let startAt = 0;
  const maxResults = 50;
  let total = Infinity;

  while (startAt < total) {
    const jql = `fixVersion = "${versionName}" AND project = "${projectKey}"`;
    const url = new URL(`${config.baseUrl}/rest/api/3/search/jql`);
    url.searchParams.set('jql', jql);
    url.searchParams.set('fields', fields);
    url.searchParams.set('maxResults', String(maxResults));
    url.searchParams.set('startAt', String(startAt));

    try {
      const body = await jiraRequest(url.toString(), auth);
      const data = JSON.parse(body);
      total = data.total ?? 0;

      for (const issue of data.issues ?? []) {
        const customFields: Record<string, string> = {};
        for (const fieldId of customFieldIds) {
          const displayValue = extractFieldDisplayValue(issue.fields[fieldId]);
          if (displayValue) {
            customFields[fieldId] = displayValue;
          }
        }
        results.push({
          key: issue.key,
          summary: issue.fields.summary ?? '',
          status: issue.fields.status.name,
          statusCategory: issue.fields.status.statusCategory.key,
          customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
        });
      }

      startAt += maxResults;
    } catch (err) {
      console.error('fetchReleaseTickets failed:', err);
      break;
    }
  }

  return results;
}

export async function testJiraConnection(config: JiraConfig): Promise<boolean> {
  const url = `${config.baseUrl}/rest/api/3/myself`;
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  try {
    await jiraRequest(url, auth);
    return true;
  } catch {
    return false;
  }
}
