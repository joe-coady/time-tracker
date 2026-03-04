import React, { useEffect, useRef, useCallback } from 'react';

interface QuickLaunchButton {
  label: string;
  view: string;
}

const BUTTONS: QuickLaunchButton[] = [
  { label: 'Terminal', view: 'terminal-launcher' },
  { label: 'Daily Notes', view: 'notes' },
  { label: 'Kanban', view: 'kanban' },
  { label: 'Notebook', view: 'notebook' },
  { label: 'GitHub PRs', view: 'github-prs' },
  { label: 'Edit Entries', view: 'edit' },
  { label: 'Working On?', view: 'dialog' },
];

export default function QuickLaunchView() {
  const firstBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstBtnRef.current?.focus();
  }, []);

  const handleClick = useCallback(async (view: string) => {
    await window.electronAPI.openView(view);
    // Quick launch closes automatically via blur when the new window takes focus
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI.closeQuickLaunch();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('.quick-launch-btn'));
        const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
        if (idx === -1) return;
        const next = e.key === 'ArrowRight'
          ? (idx + 1) % btns.length
          : (idx - 1 + btns.length) % btns.length;
        btns[next].focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="quick-launch-container">
      {BUTTONS.map((btn, i) => (
        <button
          key={btn.view}
          ref={i === 0 ? firstBtnRef : undefined}
          className="quick-launch-btn"
          onClick={() => handleClick(btn.view)}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
