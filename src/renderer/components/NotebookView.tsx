import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Note } from '../../shared/types';

type Tab = 'edit' | 'preview';

export default function NotebookView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const selectedNote = notes.find(n => n.id === selectedNoteId) || null;

  const pinnedNotes = notes.filter(n => n.pinned);
  const unpinnedNotes = notes.filter(n => !n.pinned);

  const loadNotes = useCallback(async () => {
    const loaded = await window.electronAPI.getNotebookNotes();
    setNotes(loaded.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // When selecting a note, populate the editor
  useEffect(() => {
    if (selectedNote) {
      setTitle(selectedNote.title);
      setContent(selectedNote.content);
      setActiveTab('edit');
    }
  }, [selectedNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save with debounce
  const scheduleAutoSave = useCallback((newTitle: string, newContent: string) => {
    const noteId = selectedNoteId;
    if (!noteId) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await window.electronAPI.updateNotebookNote(noteId, newTitle, newContent);
        await loadNotes();
      } finally {
        setIsSaving(false);
      }
    }, 500);
  }, [selectedNoteId, loadNotes]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    scheduleAutoSave(newTitle, content);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    scheduleAutoSave(title, newContent);
  };

  const handleCreate = async () => {
    const newNote = await window.electronAPI.createNotebookNote('Untitled', '');
    await loadNotes();
    setSelectedNoteId(newNote.id);
  };

  const handleTogglePin = async () => {
    if (!selectedNoteId) return;
    await window.electronAPI.togglePinNotebookNote(selectedNoteId);
    await loadNotes();
  };

  const handleDelete = async () => {
    if (!selectedNoteId) return;
    const ok = confirm('Delete this note?');
    if (!ok) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    await window.electronAPI.deleteNotebookNote(selectedNoteId);
    setSelectedNoteId(null);
    setTitle('');
    setContent('');
    await loadNotes();
  };

  return (
    <div className="notebook-container">
      <div className="notebook-sidebar">
        <div className="notebook-sidebar-header">
          <h2>Notes</h2>
          <button className="notebook-add-button" onClick={handleCreate}>+</button>
        </div>
        <div className="notebook-list">
          {pinnedNotes.map(note => (
            <div
              key={note.id}
              className={`notebook-list-item ${note.id === selectedNoteId ? 'active' : ''}`}
              onClick={() => setSelectedNoteId(note.id)}
            >
              <div className="notebook-list-item-title">{note.title || 'Untitled'}</div>
              <div className="notebook-list-item-snippet">
                {note.content.slice(0, 80) || 'No content'}
              </div>
            </div>
          ))}
          {pinnedNotes.length > 0 && unpinnedNotes.length > 0 && (
            <div className="notebook-list-separator" />
          )}
          {unpinnedNotes.map(note => (
            <div
              key={note.id}
              className={`notebook-list-item ${note.id === selectedNoteId ? 'active' : ''}`}
              onClick={() => setSelectedNoteId(note.id)}
            >
              <div className="notebook-list-item-title">{note.title || 'Untitled'}</div>
              <div className="notebook-list-item-snippet">
                {note.content.slice(0, 80) || 'No content'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedNote ? (
        <div className="notebook-main">
          <div className="notebook-header">
            <input
              className="notebook-title-input"
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Note title"
            />
            {isSaving && <span className="notes-saving-indicator">Saving...</span>}
            <button
              className={`notebook-pin-button ${selectedNote?.pinned ? 'pinned' : ''}`}
              onClick={handleTogglePin}
            >
              {selectedNote?.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button className="notebook-delete-button" onClick={handleDelete}>Delete</button>
          </div>

          <div className="notes-tabs">
            <button
              className={`notes-tab ${activeTab === 'edit' ? 'active' : ''}`}
              onClick={() => setActiveTab('edit')}
            >
              Edit
            </button>
            <button
              className={`notes-tab ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              Preview
            </button>
          </div>

          <div className="notes-content">
            {activeTab === 'edit' ? (
              <textarea
                className="notes-editor"
                value={content}
                onChange={e => handleContentChange(e.target.value)}
                placeholder="Write your note..."
              />
            ) : (
              <div className="notes-preview">
                {content ? (
                  <ReactMarkdown>{content}</ReactMarkdown>
                ) : (
                  <p className="notes-empty">No content</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="notebook-no-selection">
          Select a note or create a new one
        </div>
      )}
    </div>
  );
}
