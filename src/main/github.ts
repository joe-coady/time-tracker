import * as https from 'https';
import { GitHubConfig, GitHubPR } from '../shared/types';
import { readGitHubConfig, readJiraConfig, saveGitHubConfig } from './storage';

function githubRequest(url: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'time-tracker-app',
      },
      timeout: 10000,
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

export async function testGitHubConnection(config: GitHubConfig): Promise<string | null> {
  try {
    const body = await githubRequest('https://api.github.com/user', config.token);
    const data = JSON.parse(body);
    return data.login || null;
  } catch {
    return null;
  }
}

export async function fetchGitHubPRs(): Promise<GitHubPR[]> {
  const config = readGitHubConfig();
  if (!config || !config.token || config.orgs.length === 0) return [];

  // Cache username on first fetch
  if (!config.username) {
    const username = await testGitHubConnection(config);
    if (username) {
      config.username = username;
      saveGitHubConfig(config);
    }
  }

  const allPRs: GitHubPR[] = [];

  for (const org of config.orgs) {
    try {
      const q = encodeURIComponent(`is:pr is:open org:${org}`);
      const url = `https://api.github.com/search/issues?q=${q}&per_page=100&sort=updated`;
      const body = await githubRequest(url, config.token);
      const data = JSON.parse(body);

      for (const item of data.items ?? []) {
        const repoUrl: string = item.repository_url ?? '';
        const repoFullName = repoUrl.replace('https://api.github.com/repos/', '');

        allPRs.push({
          number: item.number,
          title: item.title,
          htmlUrl: item.html_url,
          state: item.state,
          author: item.user?.login ?? '',
          assignees: (item.assignees ?? []).map((a: { login: string }) => a.login),
          labels: (item.labels ?? []).map((l: { name: string; color?: string }) => ({
            name: l.name,
            color: l.color,
          })),
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          draft: item.draft ?? false,
          repoFullName,
          requestedReviewers: [],
        });
      }
    } catch {
      // Continue to next org on error
    }
  }

  // Fetch review status and requested reviewers for each PR in parallel
  const reviewResults = await Promise.allSettled(
    allPRs.map(async (pr) => {
      const [reviewsBody, prBody] = await Promise.all([
        githubRequest(`https://api.github.com/repos/${pr.repoFullName}/pulls/${pr.number}/reviews`, config.token),
        githubRequest(`https://api.github.com/repos/${pr.repoFullName}/pulls/${pr.number}`, config.token),
      ]);
      const reviews = JSON.parse(reviewsBody) as { state: string }[];
      let approved = false;
      for (const review of reviews) {
        if (review.state === 'APPROVED') approved = true;
        else if (review.state === 'CHANGES_REQUESTED') approved = false;
      }
      const prData = JSON.parse(prBody);
      const requestedReviewers = (prData.requested_reviewers ?? []).map((r: { login: string }) => r.login);
      return { approved, requestedReviewers };
    })
  );

  for (let i = 0; i < allPRs.length; i++) {
    const result = reviewResults[i];
    if (result.status === 'fulfilled') {
      allPRs[i].approved = result.value.approved;
      allPRs[i].requestedReviewers = result.value.requestedReviewers;
    }
  }

  allPRs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return allPRs;
}

export async function fetchDevBranchTickets(repos: string[]): Promise<string[]> {
  const config = readGitHubConfig();
  if (!config || !config.token || !config.devBranch) return [];

  const jiraConfig = readJiraConfig();
  const pattern = jiraConfig?.ticketPattern || '[A-Z]+-\\d+';
  const regex = new RegExp(pattern, 'g');

  const results = await Promise.allSettled(
    repos.map(async (repo) => {
      const url = `https://api.github.com/repos/${repo}/commits?sha=${encodeURIComponent(config.devBranch!)}&per_page=100`;
      const body = await githubRequest(url, config.token);
      const commits = JSON.parse(body) as { commit: { message: string } }[];
      const keys: string[] = [];
      for (const c of commits) {
        for (const match of c.commit.message.matchAll(regex)) {
          keys.push(match[0]);
        }
      }
      return keys;
    })
  );

  const allKeys = new Set<string>();
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const key of result.value) {
        allKeys.add(key);
      }
    }
  }
  return Array.from(allKeys);
}
