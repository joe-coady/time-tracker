import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TerminalShortcut } from '../../shared/types';

export default function TerminalLauncherView() {
  const [shortcuts, setShortcuts] = useState<TerminalShortcut[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  const runShortcut = useCallback(async (shortcut: TerminalShortcut) => {
    await window.electronAPI.runTerminalShortcut(shortcut.id);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI.closeTerminalLauncher();
        return;
      }
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
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredShortcuts, activeIndex, runShortcut]);

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

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
