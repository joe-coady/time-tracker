import React, { useState, useEffect, useCallback } from 'react';
import { GoogleCalendarConfig, GoogleCalendarListItem } from '../../shared/types';

interface CalendarEntry {
  id: string;
  name: string;
  url: string;
  testing?: boolean;
  testResult?: { ok: boolean; error?: string; resolvedUrl?: string } | null;
}

export default function GoogleCalendarSettingsView() {
  // iCal state
  const [calendars, setCalendars] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  // OAuth state
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarListItem[]>([]);
  const [selectedCalIds, setSelectedCalIds] = useState<Set<string>>(new Set());
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarsSaved, setCalendarsSaved] = useState(false);

  const load = useCallback(async () => {
    const config = await window.electronAPI.getGoogleCalendarConfig();
    if (config) {
      setCalendars(config.icalUrls.map(c => ({ ...c })));
      setClientId(config.clientId || '');
      setClientSecret(config.clientSecret || '');
      if (config.oauth?.email) {
        setSignedInEmail(config.oauth.email);
        setSelectedCalIds(new Set(config.selectedCalendarIds || []));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load calendar list when signed in
  useEffect(() => {
    if (signedInEmail) {
      loadCalendarList();
    }
  }, [signedInEmail]);

  const loadCalendarList = async () => {
    setLoadingCalendars(true);
    setCalendarError(null);
    try {
      const cals = await window.electronAPI.googleListCalendars();
      setGoogleCalendars(cals);
    } catch (e) {
      setCalendarError(e instanceof Error ? e.message : String(e));
    }
    setLoadingCalendars(false);
  };

  // ── OAuth actions ──

  const handleSignIn = async () => {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setSigningIn(true);
    setSignInError(null);
    try {
      const result = await window.electronAPI.googleOAuthSignIn(clientId.trim(), clientSecret.trim());
      setSignedInEmail(result.email);
    } catch (e) {
      setSignInError(e instanceof Error ? e.message : String(e));
    }
    setSigningIn(false);
  };

  const handleSignOut = async () => {
    await window.electronAPI.googleOAuthSignOut();
    setSignedInEmail(null);
    setGoogleCalendars([]);
    setSelectedCalIds(new Set());
  };

  const toggleCalendar = (id: string) => {
    setSelectedCalIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveCalendarSelection = async () => {
    await window.electronAPI.googleSelectCalendars([...selectedCalIds]);
    setCalendarsSaved(true);
    setTimeout(() => setCalendarsSaved(false), 2000);
  };

  // ── iCal actions ──

  const addCalendar = () => {
    setCalendars(prev => [...prev, {
      id: crypto.randomUUID(),
      name: '',
      url: '',
    }]);
  };

  const removeCalendar = (id: string) => {
    setCalendars(prev => prev.filter(c => c.id !== id));
  };

  const updateCalendar = (id: string, updates: Partial<CalendarEntry>) => {
    setCalendars(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const testUrl = async (id: string) => {
    const cal = calendars.find(c => c.id === id);
    if (!cal || !cal.url) return;
    updateCalendar(id, { testing: true, testResult: null });
    const result = await window.electronAPI.testCalendarUrl(cal.url);
    updateCalendar(id, { testing: false, testResult: result });
    if (result.ok && result.resolvedUrl) {
      updateCalendar(id, { url: result.resolvedUrl });
    }
  };

  const handleSave = async () => {
    const config: GoogleCalendarConfig = {
      icalUrls: calendars
        .filter(c => c.name.trim() && c.url.trim())
        .map(c => ({ id: c.id, name: c.name.trim(), url: c.url.trim() })),
    };

    // Preserve OAuth fields
    const existing = await window.electronAPI.getGoogleCalendarConfig();
    if (existing?.oauth) config.oauth = existing.oauth;
    if (existing?.clientId) config.clientId = existing.clientId;
    if (existing?.clientSecret) config.clientSecret = existing.clientSecret;
    if (existing?.selectedCalendarIds) config.selectedCalendarIds = existing.selectedCalendarIds;

    await window.electronAPI.saveGoogleCalendarConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="settings-tab-content">Loading...</div>;

  const hasCredentials = clientId.trim().length > 0 && clientSecret.trim().length > 0;

  return (
    <div className="settings-tab-content">
      {/* Section 1: Google Cloud Credentials */}
      <div className="settings-section">
        <h3>Google Cloud Credentials</h3>
        <p className="settings-description">
          Enter your Google Cloud OAuth Client ID and Client Secret.
          Create them at{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.openExternal('https://console.cloud.google.com/apis/credentials'); }}>
            Google Cloud Console
          </a>{' '}
          &gt; Credentials &gt; Create OAuth client ID (Desktop app). Enable the Google Calendar API.
        </p>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Client ID</label>
          <input
            type="text"
            className="task-input"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="xxxx.apps.googleusercontent.com"
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Client Secret</label>
          <input
            type="password"
            className="task-input"
            value={clientSecret}
            onChange={e => setClientSecret(e.target.value)}
            placeholder="Client secret"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Section 2: Google Account */}
      <div className="settings-section" style={{ marginTop: 16 }}>
        <h3>Google Account</h3>

        {!signedInEmail ? (
          <div>
            <button
              className="btn-primary"
              onClick={handleSignIn}
              disabled={!hasCredentials || signingIn}
            >
              {signingIn ? 'Signing in...' : 'Sign in with Google'}
            </button>
            {!hasCredentials && (
              <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>
                Enter credentials above first
              </span>
            )}
            {signInError && (
              <div style={{ fontSize: 12, color: '#dc3545', marginTop: 4 }}>{signInError}</div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 13 }}>
                Signed in as <strong>{signedInEmail}</strong>
              </span>
              <button className="btn-danger" onClick={handleSignOut} style={{ fontSize: 12 }}>
                Sign out
              </button>
            </div>

            <h4 style={{ margin: '12px 0 8px', fontSize: 14 }}>Calendars</h4>
            {loadingCalendars ? (
              <div style={{ fontSize: 13, color: '#888' }}>Loading calendars...</div>
            ) : googleCalendars.length === 0 ? (
              <div style={{ fontSize: 13, color: '#888' }}>
                No calendars found.{' '}
                <button className="btn-secondary" onClick={loadCalendarList} style={{ fontSize: 12 }}>
                  Refresh
                </button>
                {calendarError && (
                  <div style={{ fontSize: 12, color: '#dc3545', marginTop: 4 }}>{calendarError}</div>
                )}
              </div>
            ) : (
              <div>
                {googleCalendars.map(cal => (
                  <label
                    key={cal.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 0',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCalIds.has(cal.id)}
                      onChange={() => toggleCalendar(cal.id)}
                    />
                    {cal.summary}
                    {cal.primary && <span style={{ fontSize: 11, color: '#888' }}>(primary)</span>}
                  </label>
                ))}
                <div className="settings-actions" style={{ marginTop: 8 }}>
                  <button className="btn-primary" onClick={handleSaveCalendarSelection}>
                    Save Calendar Selection
                  </button>
                  <button className="btn-secondary" onClick={loadCalendarList} style={{ marginLeft: 8 }}>
                    Refresh List
                  </button>
                  {calendarsSaved && <span className="settings-saved">Saved!</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Additional Calendars (iCal) */}
      <div className="settings-section" style={{ marginTop: 16 }}>
        <h3>Additional Calendars (iCal)</h3>
        <p className="settings-description">
          Add calendars using a share link or iCal URL. You can paste:
        </p>
        <ul className="settings-description" style={{ margin: '4px 0 8px 20px', fontSize: 13, color: '#666' }}>
          <li><strong>Share link</strong> — In Google Calendar, click the three dots next to a calendar &gt; "Settings and sharing" &gt; "Get shareable link". The calendar must be set to public.</li>
          <li><strong>Secret iCal URL</strong> — Same settings page &gt; "Integrate calendar" &gt; "Secret address in iCal format" (works for private calendars).</li>
        </ul>

        {calendars.map(cal => (
          <div key={cal.id} style={{ marginBottom: 16, padding: '12px', background: '#f9f9f9', borderRadius: '6px', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                className="task-input"
                value={cal.name}
                onChange={e => updateCalendar(cal.id, { name: e.target.value })}
                placeholder="Calendar name"
                style={{ flex: 1 }}
              />
              <button className="btn-danger" onClick={() => removeCalendar(cal.id)}>Remove</button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                className="task-input"
                value={cal.url}
                onChange={e => updateCalendar(cal.id, { url: e.target.value, testResult: null })}
                placeholder="Share link or iCal URL"
                style={{ flex: 1 }}
              />
              <button
                className="btn-secondary"
                onClick={() => testUrl(cal.id)}
                disabled={cal.testing || !cal.url}
              >
                {cal.testing ? 'Testing...' : 'Test'}
              </button>
            </div>
            {cal.testResult?.ok && (
              <div style={{ fontSize: 12, color: '#28a745', marginTop: 4 }}>
                Valid iCal feed{cal.testResult.resolvedUrl ? ' (URL converted from share link)' : ''}
              </div>
            )}
            {cal.testResult && !cal.testResult.ok && (
              <div style={{ fontSize: 12, color: '#dc3545', marginTop: 4 }}>
                {cal.testResult.error || 'Invalid or unreachable URL'}
              </div>
            )}
          </div>
        ))}

        <div className="settings-actions" style={{ marginTop: 0 }}>
          <button className="btn-secondary" onClick={addCalendar}>+ Add Calendar</button>
        </div>

        <div className="settings-actions">
          <button className="btn-primary" onClick={handleSave}>Save</button>
          {saved && <span className="settings-saved">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
