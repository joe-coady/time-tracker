import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TerminalShortcut } from '../../shared/types';

type Mode = 'picker' | 'running';

// Strip ANSI escape codes so output is plain text
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07/g;

// Process raw terminal text: strip ANSI, handle \r overwrites per line
function processTerminalText(raw: string): string {
  const stripped = raw.replace(ANSI_RE, '');
  // Process carriage returns: for each line, \r resets cursor to start
  return stripped.split('\n').map(line => {
    if (!line.includes('\r')) return line;
    const parts = line.split('\r');
    // Each \r segment overwrites from the beginning
    let result = '';
    for (const part of parts) {
      if (part.length >= result.length) {
        result = part;
      } else {
        result = part + result.slice(part.length);
      }
    }
    return result;
  }).join('\n');
}

export default function TerminalLauncherView() {
  const [shortcuts, setShortcuts] = useState<TerminalShortcut[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('picker');
  const [rawOutput, setRawOutput] = useState('');
  const [exitCode, setExitCode] = useState<number | null | undefined>(undefined);
  const [runningShortcut, setRunningShortcut] = useState<TerminalShortcut | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadShortcuts = useCallback(async () => {
    const config = await window.electronAPI.getTerminalConfig();
    if (config) {
      const sorted = [...config.shortcuts].sort((a, b) => {
        if (!a.lastRanAt && !b.lastRanAt) return 0;
        if (!a.lastRanAt) return 1;
        if (!b.lastRanAt) return -1;
        return b.lastRanAt.localeCompare(a.lastRanAt);
      });
      setShortcuts(sorted);
    }
  }, []);

  useEffect(() => { loadShortcuts(); }, [loadShortcuts]);

  const displayOutput = processTerminalText(rawOutput);

  // Auto-scroll output
  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [displayOutput]);

  // Auto-close after process exits
  useEffect(() => {
    if (exitCode !== undefined) {
      closeTimerRef.current = setTimeout(() => {
        window.electronAPI.closeTerminalLauncher();
      }, 1500);
    }
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [exitCode]);

  const goBackToPicker = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    window.electronAPI.removeTerminalListeners();
    setMode('picker');
    setRawOutput('');
    setExitCode(undefined);
    setRunningShortcut(null);
    loadShortcuts();
  }, [loadShortcuts]);

  const runShortcut = useCallback(async (shortcut: TerminalShortcut) => {
    setMode('running');
    setRawOutput('');
    setExitCode(undefined);
    setRunningShortcut(shortcut);

    window.electronAPI.removeTerminalListeners();

    window.electronAPI.onTerminalOutput((data: string) => {
      setRawOutput(prev => prev + data);
    });

    window.electronAPI.onTerminalExit((code: number | null) => {
      setExitCode(code);
    });

    await window.electronAPI.runTerminalShortcut(shortcut.id);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode === 'running') {
          if (exitCode !== undefined) {
            // Already exiting, just close now
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            window.electronAPI.closeTerminalLauncher();
          } else {
            goBackToPicker();
          }
        } else {
          window.electronAPI.closeTerminalLauncher();
        }
        return;
      }

      if (mode === 'picker') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex(i => Math.min(i + 1, shortcuts.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex(i => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter' && shortcuts.length > 0) {
          e.preventDefault();
          runShortcut(shortcuts[activeIndex]);
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, activeIndex, runShortcut, mode, goBackToPicker, exitCode]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      window.electronAPI.removeTerminalListeners();
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  if (mode === 'running') {
    return (
      <div className="terminal-launcher-container">
        <div className="terminal-output-header">
          <button className="terminal-output-back" onClick={goBackToPicker}>
            &#x2190;
          </button>
          <div className="terminal-output-info">
            <span className="terminal-output-name">{runningShortcut?.name}</span>
            <span className="terminal-output-dir">{runningShortcut?.directory}</span>
          </div>
        </div>
        <pre className="terminal-output-pre" ref={preRef}>
          {displayOutput}
          {exitCode !== undefined && (
            <span className="terminal-output-exit">
              {'\n'}Process exited with code {exitCode}
            </span>
          )}
        </pre>
      </div>
    );
  }

  if (shortcuts.length === 0) {
    return (
      <div className="terminal-launcher-container">
        <div className="terminal-launcher-empty">
          No terminal shortcuts configured. Add them in Settings &gt; Terminal.
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-launcher-container">
      <div className="terminal-launcher-list" ref={listRef}>
        {shortcuts.map((s, i) => (
          <div
            key={s.id}
            className={`terminal-launcher-item${i === activeIndex ? ' active' : ''}`}
            onClick={() => runShortcut(s)}
            onMouseEnter={() => setActiveIndex(i)}
          >
            <div className="terminal-launcher-name">{s.name}</div>
            <div className="terminal-launcher-detail">{s.directory}</div>
            {s.command && (
              <div className="terminal-launcher-detail terminal-launcher-cmd">{s.command}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
