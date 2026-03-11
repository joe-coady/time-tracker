import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

function getExecIdFromUrl(): string {
  // Check hash first (prod: #/terminal-exec?execId=abc), then search params (dev: ?execId=abc)
  const hashMatch = window.location.hash.match(/execId=([^&]+)/);
  if (hashMatch) return hashMatch[1];
  const searchMatch = window.location.search.match(/execId=([^&]+)/);
  return searchMatch ? searchMatch[1] : '';
}

export default function TerminalExecView() {
  const execId = useRef(getExecIdFromUrl()).current;
  const xtermContainerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [exited, setExited] = useState(false);

  useEffect(() => {
    if (!execId || !xtermContainerRef.current) return;

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

    window.electronAPI.resizeTerminalExec(execId, term.cols, term.rows);

    window.electronAPI.onTerminalExecOutput(execId, (data: string) => {
      term.write(data);
    });

    window.electronAPI.onTerminalExecExit(execId, () => {
      setExited(true);
    });

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    });
    resizeObserver.observe(xtermContainerRef.current);

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      window.electronAPI.resizeTerminalExec(execId, cols, rows);
    });

    return () => {
      resizeObserver.disconnect();
      resizeDisposable.dispose();
      window.electronAPI.removeTerminalExecListeners(execId);
      term.dispose();
    };
  }, [execId]);

  // Auto-close on exit
  useEffect(() => {
    if (exited) {
      window.electronAPI.closeTerminalExec(execId);
    }
  }, [exited, execId]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI.closeTerminalExec(execId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [execId]);

  return (
    <div className="terminal-launcher-container">
      <div className="terminal-output-xterm" ref={xtermContainerRef} />
    </div>
  );
}
