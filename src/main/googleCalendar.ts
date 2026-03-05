import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { BrowserWindow } from 'electron';
import { CalendarEvent, GoogleCalendarConfig, GoogleCalendarListItem, GoogleOAuthTokens } from '../shared/types';
import { readGoogleCalendarConfig, saveGoogleCalendarConfig } from './storage';

function fetchUrl(url: string): Promise<string> {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.get(url, { timeout: 15000 }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve, reject);
        return;
      }
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

// RFC 5545 line unfolding: lines starting with a space or tab are continuations
function unfoldIcal(text: string): string {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function getIcalProp(block: string, prop: string): string | null {
  // Match PROP:value or PROP;params:value
  const regex = new RegExp(`^${prop}(?:;[^:]*)?:(.*)$`, 'm');
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

function parseIcalDate(value: string): Date | null {
  if (!value) return null;

  // All-day: YYYYMMDD
  if (/^\d{8}$/.test(value)) {
    const y = parseInt(value.slice(0, 4));
    const m = parseInt(value.slice(4, 6)) - 1;
    const d = parseInt(value.slice(6, 8));
    return new Date(y, m, d);
  }

  // UTC: YYYYMMDDTHHmmssZ
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    const y = parseInt(value.slice(0, 4));
    const m = parseInt(value.slice(4, 6)) - 1;
    const d = parseInt(value.slice(6, 8));
    const h = parseInt(value.slice(9, 11));
    const mi = parseInt(value.slice(11, 13));
    const s = parseInt(value.slice(13, 15));
    return new Date(Date.UTC(y, m, d, h, mi, s));
  }

  // Local or TZID: YYYYMMDDTHHmmss (treat as local time)
  if (/^\d{8}T\d{6}$/.test(value)) {
    const y = parseInt(value.slice(0, 4));
    const m = parseInt(value.slice(4, 6)) - 1;
    const d = parseInt(value.slice(6, 8));
    const h = parseInt(value.slice(9, 11));
    const mi = parseInt(value.slice(11, 13));
    const s = parseInt(value.slice(13, 15));
    return new Date(y, m, d, h, mi, s);
  }

  return null;
}

function getDtstartValue(block: string): string | null {
  // DTSTART may have TZID param: DTSTART;TZID=America/Sydney:20260305T090000
  const match = block.match(/^DTSTART(?:;[^:]*)?:(.*)$/m);
  return match ? match[1].trim() : null;
}

function getDtendValue(block: string): string | null {
  const match = block.match(/^DTEND(?:;[^:]*)?:(.*)$/m);
  return match ? match[1].trim() : null;
}

function isAllDay(dtstart: string): boolean {
  return /^\d{8}$/.test(dtstart);
}

function isSameDay(date: Date, todayStr: string): boolean {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}` === todayStr;
}

function spansTodayCheck(start: Date, end: Date, todayStart: Date, todayEnd: Date): boolean {
  return start < todayEnd && end > todayStart;
}

function parseEvents(icalText: string, calendarName: string, todayStr: string): CalendarEvent[] {
  const unfolded = unfoldIcal(icalText);
  const events: CalendarEvent[] = [];

  const todayStart = new Date(`${todayStr}T00:00:00`);
  const todayEnd = new Date(`${todayStr}T23:59:59.999`);

  const blocks = unfolded.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const endIdx = blocks[i].indexOf('END:VEVENT');
    const block = endIdx >= 0 ? blocks[i].slice(0, endIdx) : blocks[i];

    const summary = getIcalProp(block, 'SUMMARY') || '(No title)';
    const uid = getIcalProp(block, 'UID') || `event-${i}`;
    const location = getIcalProp(block, 'LOCATION') || undefined;

    const dtstartVal = getDtstartValue(block);
    const dtendVal = getDtendValue(block);
    if (!dtstartVal) continue;

    const startDate = parseIcalDate(dtstartVal);
    if (!startDate) continue;

    let endDate: Date;
    if (dtendVal) {
      endDate = parseIcalDate(dtendVal) || new Date(startDate.getTime() + 3600000);
    } else {
      // Default to 1 hour for timed events, or next day for all-day
      if (isAllDay(dtstartVal)) {
        endDate = new Date(startDate.getTime() + 86400000);
      } else {
        endDate = new Date(startDate.getTime() + 3600000);
      }
    }

    // Check if event occurs today
    if (isAllDay(dtstartVal)) {
      // All-day: check if today falls within the range
      if (!spansTodayCheck(startDate, endDate, todayStart, todayEnd)) continue;
    } else {
      if (!isSameDay(startDate, todayStr) && !spansTodayCheck(startDate, endDate, todayStart, todayEnd)) continue;
    }

    events.push({
      id: uid,
      summary,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      location,
      calendarName,
    });
  }

  return events;
}

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── OAuth helpers ──

function httpsPost(url: string, body: string): Promise<string> {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 15000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

function googleApiGet(path: string, accessToken: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://www.googleapis.com${path}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  }).toString();
  const raw = await httpsPost('https://oauth2.googleapis.com/token', body);
  return JSON.parse(raw);
}

async function refreshAccessToken(config: GoogleCalendarConfig): Promise<string> {
  if (!config.oauth?.refreshToken || !config.clientId || !config.clientSecret) {
    throw new Error('No refresh token or client credentials');
  }
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.oauth.refreshToken,
    grant_type: 'refresh_token',
  }).toString();
  const raw = await httpsPost('https://oauth2.googleapis.com/token', body);
  const data = JSON.parse(raw);

  config.oauth.accessToken = data.access_token;
  config.oauth.expiresAt = Date.now() + data.expires_in * 1000;
  saveGoogleCalendarConfig(config);
  return data.access_token;
}

async function getValidAccessToken(): Promise<string | null> {
  const config = readGoogleCalendarConfig();
  if (!config?.oauth) return null;

  // Refresh if expires within 60 seconds
  if (Date.now() > config.oauth.expiresAt - 60000) {
    return refreshAccessToken(config);
  }
  return config.oauth.accessToken;
}

export async function startOAuthFlow(clientId: string, clientSecret: string): Promise<{ email: string }> {
  // Save credentials to config
  const config = readGoogleCalendarConfig() || { icalUrls: [] };
  config.clientId = clientId;
  config.clientSecret = clientSecret;
  saveGoogleCalendarConfig(config);

  return new Promise((resolve, reject) => {
    const server = http.createServer();

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Failed to start loopback server'));
        return;
      }
      const port = addr.port;
      const redirectUri = `http://127.0.0.1:${port}`;

      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'https://www.googleapis.com/auth/calendar.readonly email',
          access_type: 'offline',
          prompt: 'consent',
        }).toString();

      const win = new BrowserWindow({
        width: 600,
        height: 700,
        title: 'Sign in with Google',
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      let settled = false;

      const cleanup = () => {
        if (!settled) {
          settled = true;
          server.close();
          if (!win.isDestroyed()) win.close();
        }
      };

      win.on('closed', () => {
        if (!settled) {
          settled = true;
          server.close();
          reject(new Error('Window closed by user'));
        }
      });

      server.on('request', async (req, res) => {
        if (settled) { res.end(); return; }

        const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
        const code = reqUrl.searchParams.get('code');
        const error = reqUrl.searchParams.get('error');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Authorization denied.</h2><p>You can close this window.</p></body></html>');
          cleanup();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Missing authorization code.</h2></body></html>');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Signed in successfully!</h2><p>You can close this window.</p></body></html>');

        try {
          const tokens = await exchangeCodeForTokens(code, redirectUri, clientId, clientSecret);

          // Fetch user email
          let email = '';
          try {
            const userInfoRaw = await googleApiGet('/oauth2/v2/userinfo', tokens.access_token);
            const userInfo = JSON.parse(userInfoRaw);
            email = userInfo.email || '';
          } catch {
            // Non-critical — proceed without email
          }

          const oauth: GoogleOAuthTokens = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: Date.now() + tokens.expires_in * 1000,
            email,
          };

          const latestConfig = readGoogleCalendarConfig() || { icalUrls: [] };
          latestConfig.clientId = clientId;
          latestConfig.clientSecret = clientSecret;
          latestConfig.oauth = oauth;
          saveGoogleCalendarConfig(latestConfig);

          cleanup();
          resolve({ email });
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      win.loadURL(authUrl);
    });
  });
}

export async function signOut(): Promise<void> {
  const config = readGoogleCalendarConfig();
  if (!config) return;
  delete config.oauth;
  delete config.selectedCalendarIds;
  saveGoogleCalendarConfig(config);
}

export async function listGoogleCalendars(): Promise<GoogleCalendarListItem[]> {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not signed in');

  const raw = await googleApiGet('/calendar/v3/users/me/calendarList', token);
  const data = JSON.parse(raw);
  return (data.items || []).map((item: { id: string; summary: string; primary?: boolean }) => ({
    id: item.id,
    summary: item.summary,
    primary: item.primary || false,
  }));
}

export async function selectCalendars(calendarIds: string[]): Promise<void> {
  const config = readGoogleCalendarConfig();
  if (!config) return;
  config.selectedCalendarIds = calendarIds;
  saveGoogleCalendarConfig(config);
}

async function fetchTodayEventsViaApi(): Promise<CalendarEvent[]> {
  const config = readGoogleCalendarConfig();
  if (!config?.oauth || !config.selectedCalendarIds?.length) return [];

  const token = await getValidAccessToken();
  if (!token) return [];

  const todayStr = getTodayString();
  const timeMin = `${todayStr}T00:00:00Z`;
  const tomorrow = new Date(`${todayStr}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const timeMax = tomorrow.toISOString();

  const allEvents: CalendarEvent[] = [];

  const results = await Promise.allSettled(
    config.selectedCalendarIds.map(async (calId) => {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
      });
      const path = `/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`;
      const raw = await googleApiGet(path, token);
      const data = JSON.parse(raw);
      const calSummary = data.summary || calId;

      return (data.items || []).map((ev: { id?: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; location?: string }) => ({
        id: ev.id || `api-${Math.random().toString(36).slice(2)}`,
        summary: ev.summary || '(No title)',
        startTime: ev.start?.dateTime || ev.start?.date || '',
        endTime: ev.end?.dateTime || ev.end?.date || '',
        location: ev.location,
        calendarName: calSummary,
      })) as CalendarEvent[];
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value);
    }
  }

  return allEvents;
}

async function fetchTodayEventsViaIcal(): Promise<CalendarEvent[]> {
  const config = readGoogleCalendarConfig();
  if (!config || config.icalUrls.length === 0) return [];

  const todayStr = getTodayString();
  const allEvents: CalendarEvent[] = [];

  const results = await Promise.allSettled(
    config.icalUrls.map(async (cal) => {
      const url = normalizeCalendarUrl(cal.url);
      const body = await fetchUrl(url);
      return parseEvents(body, cal.name, todayStr);
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value);
    }
  }

  return allEvents;
}

export async function fetchTodayCalendarEvents(): Promise<CalendarEvent[]> {
  const [apiEvents, icalEvents] = await Promise.allSettled([
    fetchTodayEventsViaApi(),
    fetchTodayEventsViaIcal(),
  ]);

  const allEvents: CalendarEvent[] = [];
  if (apiEvents.status === 'fulfilled') allEvents.push(...apiEvents.value);
  if (icalEvents.status === 'fulfilled') allEvents.push(...icalEvents.value);

  // Deduplicate by event ID
  const seen = new Set<string>();
  const unique = allEvents.filter(ev => {
    if (seen.has(ev.id)) return false;
    seen.add(ev.id);
    return true;
  });

  unique.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  return unique;
}

/**
 * Convert various Google Calendar URL formats to an iCal feed URL.
 * Supports:
 *   - Direct iCal URLs (returned as-is)
 *   - Share links: https://calendar.google.com/calendar/u/0?cid=BASE64
 *   - HTML calendar links with calendar ID in path
 */
export function normalizeCalendarUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Share link: ?cid=BASE64_CALENDAR_ID
    const cid = parsed.searchParams.get('cid');
    if (cid && parsed.hostname.includes('calendar.google.com')) {
      const calendarId = Buffer.from(cid, 'base64').toString('utf-8');
      const encodedId = encodeURIComponent(calendarId);
      return `https://calendar.google.com/calendar/ical/${encodedId}/public/basic.ics`;
    }
  } catch {
    // Not a valid URL, return as-is
  }
  return url;
}

export async function testCalendarUrl(rawUrl: string): Promise<{ ok: boolean; error?: string; resolvedUrl?: string }> {
  const url = normalizeCalendarUrl(rawUrl);
  const isConverted = url !== rawUrl;

  try {
    const body = await fetchUrl(url);
    if (body.includes('BEGIN:VCALENDAR')) {
      return { ok: true, resolvedUrl: isConverted ? url : undefined };
    }
    return { ok: false, error: 'Response is not a valid iCal feed' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('404') && isConverted) {
      return {
        ok: false,
        error: 'Calendar not public. In Google Calendar: Settings > select calendar > "Access permissions" > enable "Make available to public", then try again.',
      };
    }
    return { ok: false, error: msg };
  }
}
