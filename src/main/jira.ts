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

function jiraRequestBinary(url: string, auth: string): Promise<{ data: Buffer; redirectUrl?: string }> {
  return new Promise((resolve, reject) => {
    const makeRequest = (requestUrl: string) => {
      const parsedUrl = new URL(requestUrl);
      const mod = https;
      const req = mod.get(requestUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
        timeout: 30000,
      }, (res) => {
        // Follow redirects (Jira S3 presigned URLs)
        if (res.statusCode && (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) && res.headers.location) {
          const redirectLocation = res.headers.location;
          // For redirects to S3, don't send auth header
          const redirectReq = https.get(redirectLocation, { timeout: 30000 }, (redirectRes) => {
            const chunks: Buffer[] = [];
            redirectRes.on('data', (chunk: Buffer) => { chunks.push(chunk); });
            redirectRes.on('end', () => {
              if (redirectRes.statusCode && redirectRes.statusCode >= 200 && redirectRes.statusCode < 300) {
                resolve({ data: Buffer.concat(chunks), redirectUrl: redirectLocation });
              } else {
                reject(new Error(`HTTP ${redirectRes.statusCode} on redirect`));
              }
            });
          });
          redirectReq.on('error', reject);
          redirectReq.on('timeout', () => { redirectReq.destroy(); reject(new Error('timeout on redirect')); });
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => { chunks.push(chunk); });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ data: Buffer.concat(chunks) });
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    };

    makeRequest(url);
  });
}

// --- ADF to Markdown converter ---

interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
}

interface AdfConvertContext {
  mediaMap: Map<string, string>;
  listDepth?: number;
  orderedIndex?: number;
}

function adfToMarkdown(node: AdfNode, context: AdfConvertContext): string {
  if (!node) return '';

  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(c => adfToMarkdown(c, context)).join('\n\n');

    case 'paragraph':
      return (node.content ?? []).map(c => adfToMarkdown(c, context)).join('');

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      const prefix = '#'.repeat(Math.min(level, 6));
      const text = (node.content ?? []).map(c => adfToMarkdown(c, context)).join('');
      return `${prefix} ${text}`;
    }

    case 'bulletList':
      return (node.content ?? []).map(c => adfToMarkdown(c, { ...context, listDepth: (context.listDepth ?? 0), orderedIndex: undefined })).join('\n');

    case 'orderedList':
      return (node.content ?? []).map((c, i) => adfToMarkdown(c, { ...context, listDepth: (context.listDepth ?? 0), orderedIndex: i + 1 })).join('\n');

    case 'listItem': {
      const indent = '  '.repeat(context.listDepth ?? 0);
      const bullet = context.orderedIndex != null ? `${context.orderedIndex}.` : '-';
      const childContext = { ...context, listDepth: (context.listDepth ?? 0) + 1 };
      const text = (node.content ?? []).map(c => {
        if (c.type === 'bulletList' || c.type === 'orderedList') {
          return '\n' + adfToMarkdown(c, childContext);
        }
        return adfToMarkdown(c, childContext);
      }).join('');
      return `${indent}${bullet} ${text}`;
    }

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? '';
      const code = (node.content ?? []).map(c => c.text ?? '').join('');
      return '```' + lang + '\n' + code + '\n```';
    }

    case 'blockquote': {
      const inner = (node.content ?? []).map(c => adfToMarkdown(c, context)).join('\n');
      return inner.split('\n').map(line => `> ${line}`).join('\n');
    }

    case 'table': {
      const rows = (node.content ?? []).filter(c => c.type === 'tableRow');
      if (rows.length === 0) return '';
      const result: string[] = [];
      rows.forEach((row, rowIdx) => {
        const cells = (row.content ?? []).map(cell => {
          return (cell.content ?? []).map(c => adfToMarkdown(c, context)).join(' ').replace(/\|/g, '\\|');
        });
        result.push('| ' + cells.join(' | ') + ' |');
        if (rowIdx === 0) {
          result.push('| ' + cells.map(() => '---').join(' | ') + ' |');
        }
      });
      return result.join('\n');
    }

    case 'rule':
      return '---';

    case 'text': {
      let text = node.text ?? '';
      for (const mark of node.marks ?? []) {
        switch (mark.type) {
          case 'strong': text = `**${text}**`; break;
          case 'em': text = `*${text}*`; break;
          case 'code': text = `\`${text}\``; break;
          case 'strike': text = `~~${text}~~`; break;
          case 'link': {
            const href = (mark.attrs?.href as string) ?? '';
            text = `[${text}](${href})`;
            break;
          }
        }
      }
      return text;
    }

    case 'mention': {
      const mentionText = (node.attrs?.text as string) ?? (node.attrs?.id as string) ?? 'someone';
      return `@${mentionText}`;
    }

    case 'emoji':
      return (node.attrs?.shortName as string) ?? (node.attrs?.text as string) ?? '';

    case 'hardBreak':
      return '\n';

    case 'mediaSingle':
    case 'mediaGroup':
      return (node.content ?? []).map(c => adfToMarkdown(c, context)).join('\n');

    case 'media': {
      const mediaId = (node.attrs?.id as string) ?? '';
      const localPath = context.mediaMap.get(mediaId);
      if (localPath) {
        return `![image](${localPath})`;
      }
      return `![image](attachment:${mediaId})`;
    }

    case 'inlineCard': {
      const url = (node.attrs?.url as string) ?? '';
      return url ? `[${url}](${url})` : '';
    }

    default:
      // For unknown types, try to recurse into content
      if (node.content) {
        return (node.content).map(c => adfToMarkdown(c, context)).join('');
      }
      return '';
  }
}

function collectMediaIds(node: AdfNode): Set<string> {
  const ids = new Set<string>();
  if (node.type === 'media' && node.attrs?.id) {
    ids.add(node.attrs.id as string);
  }
  for (const child of node.content ?? []) {
    for (const id of collectMediaIds(child)) {
      ids.add(id);
    }
  }
  return ids;
}

interface JiraAttachment {
  id: string;
  filename: string;
  content: string; // download URL
  mediaType?: string;
}

async function downloadAttachments(
  attachments: JiraAttachment[],
  mediaIds: Set<string>,
  auth: string
): Promise<Map<string, string>> {
  const mediaMap = new Map<string, string>();
  if (mediaIds.size === 0) return mediaMap;

  for (const att of attachments) {
    const isImage = att.mediaType?.startsWith('image/') ?? /\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(att.filename);
    if (!isImage) continue;

    try {
      const result = await jiraRequestBinary(att.content, auth);

      // Extract media UUID from redirect URL (e.g. /file/{uuid}/binary)
      let mapKey = att.id;
      if (result.redirectUrl) {
        const uuidMatch = result.redirectUrl.match(/\/file\/([a-f0-9-]{36})\//);
        if (uuidMatch) {
          mapKey = uuidMatch[1];
        }
      }

      const mimeType = att.mediaType ?? 'image/png';
      const base64 = result.data.toString('base64');
      mediaMap.set(mapKey, `data:${mimeType};base64,${base64}`);
    } catch (err) {
      console.error(`Failed to download attachment ${att.filename}:`, err);
    }
  }

  return mediaMap;
}

export async function fetchJiraTicketMarkdown(key: string): Promise<string> {
  const config = readJiraConfig();
  if (!config) throw new Error('Jira not configured');

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  const customFieldIds = (config.customFields ?? []).map(cf => cf.fieldId);
  const standardFields = 'summary,description,comment,attachment,status,fixVersions,priority,assignee,reporter,labels,created,updated';
  const allFields = customFieldIds.length > 0 ? `${standardFields},${customFieldIds.join(',')}` : standardFields;
  const url = `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(key)}?fields=${allFields}`;

  const body = await jiraRequest(url, auth);
  const issue = JSON.parse(body);

  const summary = issue.fields?.summary ?? key;
  const descriptionAdf = issue.fields?.description as AdfNode | null;
  const comments = issue.fields?.comment?.comments ?? [];
  const attachments: JiraAttachment[] = (issue.fields?.attachment ?? []).map((a: Record<string, unknown>) => ({
    id: String(a.id ?? ''),
    filename: String(a.filename ?? ''),
    content: String(a.content ?? ''),
    mediaType: a.mimeType != null ? String(a.mimeType) : undefined,
  }));

  // Collect all media IDs from description and comments
  const allMediaIds = new Set<string>();
  if (descriptionAdf) {
    for (const id of collectMediaIds(descriptionAdf)) allMediaIds.add(id);
  }
  for (const c of comments) {
    if (c.body) {
      for (const id of collectMediaIds(c.body as AdfNode)) allMediaIds.add(id);
    }
  }

  // Download attachments
  const mediaMap = await downloadAttachments(attachments, allMediaIds, auth);

  const context: AdfConvertContext = { mediaMap };

  // Build markdown
  const parts: string[] = [];
  parts.push(`# ${key}: ${summary}`);

  if (descriptionAdf) {
    parts.push('## Description');
    parts.push(adfToMarkdown(descriptionAdf, context));
  }

  // Build Fields section
  const fieldLines: string[] = [];
  const fieldEntries: Array<{ label: string; value: string }> = [
    { label: 'Status', value: extractFieldDisplayValue(issue.fields?.status) },
    { label: 'Priority', value: extractFieldDisplayValue(issue.fields?.priority) },
    { label: 'Fix Versions', value: extractFieldDisplayValue(issue.fields?.fixVersions) },
    { label: 'Assignee', value: extractFieldDisplayValue(issue.fields?.assignee) },
    { label: 'Reporter', value: extractFieldDisplayValue(issue.fields?.reporter) },
    { label: 'Labels', value: (issue.fields?.labels ?? []).join(', ') },
    { label: 'Created', value: issue.fields?.created ? issue.fields.created.substring(0, 10) : '' },
    { label: 'Updated', value: issue.fields?.updated ? issue.fields.updated.substring(0, 10) : '' },
  ];
  // Add custom fields
  for (const cf of config.customFields ?? []) {
    fieldEntries.push({
      label: cf.label,
      value: extractFieldDisplayValue(issue.fields?.[cf.fieldId]),
    });
  }
  for (const entry of fieldEntries) {
    if (entry.value) {
      fieldLines.push(`- **${entry.label}:** ${entry.value}`);
    }
  }
  if (fieldLines.length > 0) {
    parts.push('---\n## Fields\n' + fieldLines.join('\n') + '\n---');
  }

  if (comments.length > 0) {
    parts.push('## Comments');
    for (const c of comments) {
      const author = c.author?.displayName ?? c.author?.emailAddress ?? 'Unknown';
      const created = c.created ? c.created.substring(0, 10) : '';
      parts.push(`### ${author} (${created})`);
      if (c.body) {
        parts.push(adfToMarkdown(c.body as AdfNode, context));
      }
    }
  }

  return parts.join('\n\n');
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
