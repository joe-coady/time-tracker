import * as https from 'https';
import { URL } from 'url';
import { JiraConfig, JiraSearchResult } from '../shared/types';
import { readJiraConfig } from './storage';

function jiraRequest(url: string, auth: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
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
  url.searchParams.set('currentJQL', '');
  url.searchParams.set('showSubTasks', 'true');

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  try {
    const body = await jiraRequest(url.toString(), auth);
    const data = JSON.parse(body);
    const results: JiraSearchResult[] = [];
    for (const section of data.sections ?? []) {
      for (const issue of section.issues ?? []) {
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
