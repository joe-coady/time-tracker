import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { TerminalShortcut } from '../../shared/types';

type Mode = 'picker' | 'running';

export default function TerminalLauncherView() {
  const [shortcuts, setShortcuts] = useState<TerminalShortcut[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('picker');
  const [exitCode, setExitCode] = useState<number | null | undefined>(undefined);
  const [runningShortcut, setRunningShortcut] = useState<TerminalShortcut | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const xtermContainerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const filteredShortcuts = searchQuery.trim()
    ? shortcuts.filter(s => {
        const name = s.name.toLowerCase();
        return searchQuery.toLowerCase().split(/\s+/).every(term => name.includes(term));
      })
    : shortcuts;

  // Reset active index when search query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  // Auto-close after process exits
  useEffect(() => {
    if (exitCode !== undefined) {
      if (terminalRef.current) {
        terminalRef.current.write(`\r\n\x1b[2m\x1b[3mProcess exited with code ${exitCode}\x1b[0m\r\n`);
      }
      closeTimerRef.current = setTimeout(() => {
        window.electronAPI.closeTerminalLauncher();
      }, 1500);
    }
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [exitCode]);

  const disposeTerminal = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
    }
    fitAddonRef.current = null;
  }, []);

  const goBackToPicker = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    window.electronAPI.removeTerminalListeners();
    disposeTerminal();
    setMode('picker');
    setExitCode(undefined);
    setRunningShortcut(null);
    setSearchQuery('');
    loadShortcuts();
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [loadShortcuts, disposeTerminal]);

  const runShortcut = useCallback(async (shortcut: TerminalShortcut) => {
    setMode('running');
    setExitCode(undefined);
    setRunningShortcut(shortcut);

    window.electronAPI.removeTerminalListeners();

    // Terminal will be initialized in the effect below once the container mounts
    await window.electronAPI.runTerminalShortcut(shortcut.id);
  }, []);

  // Initialize xterm when entering running mode and container is mounted
  useEffect(() => {
    if (mode !== 'running' || !xtermContainerRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#1e1e28',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
      },
      fontFamily: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Menlo, monospace",
      fontSize: 12,
      lineHeight: 1.5,
      cursorBlink: false,
      convertEol: false,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(xtermContainerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Send initial size to PTY
    window.electronAPI.resizeTerminal(term.cols, term.rows);

    // Listen for output from main process
    window.electronAPI.onTerminalOutput((data: string) => {
      term.write(data);
    });

    window.electronAPI.onTerminalExit((code: number | null) => {
      setExitCode(code);
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(xtermContainerRef.current);

    // Sync PTY size when terminal resizes
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      window.electronAPI.resizeTerminal(cols, rows);
    });

    return () => {
      resizeObserver.disconnect();
      resizeDisposable.dispose();
    };
  }, [mode]);

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
          setActiveIndex(i => Math.min(i + 1, filteredShortcuts.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex(i => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter' && filteredShortcuts.length > 0) {
          e.preventDefault();
          runShortcut(filteredShortcuts[activeIndex]);
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredShortcuts, activeIndex, runShortcut, mode, goBackToPicker, exitCode]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      window.electronAPI.removeTerminalListeners();
      disposeTerminal();
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [disposeTerminal]);

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
        <div className="terminal-output-xterm" ref={xtermContainerRef} />
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
      <input
        ref={searchInputRef}
        className="terminal-launcher-search"
        type="text"
        placeholder="Search shortcuts…"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        autoFocus
      />
      <div className="terminal-launcher-list" ref={listRef}>
        {filteredShortcuts.length === 0 ? (
          <div className="terminal-launcher-empty">No matching shortcuts</div>
        ) : (
          filteredShortcuts.map((s, i) => (
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
          ))
        )}
      </div>
    </div>
  );
}
