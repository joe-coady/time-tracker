import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ConfigFileEntry, ConfigFilesConfig } from '../../shared/types';

export default function ConfigFilesView() {
  const [config, setConfig] = useState<ConfigFilesConfig | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const selectedFile = config?.files.find(f => f.id === selectedFileId) || null;

  const loadConfig = useCallback(async () => {
    const loaded = await window.electronAPI.getConfigFilesConfig();
    setConfig(loaded);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Load file content when selection changes
  useEffect(() => {
    if (!selectedFile) return;
    setFileError(null);
    setContent('');
    window.electronAPI.readConfigFileContent(selectedFile.path)
      .then(text => setContent(text))
      .catch(() => setFileError(`File not found: ${selectedFile.path}`));
  }, [selectedFileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleAutoSave = useCallback((newContent: string) => {
    const file = selectedFile;
    if (!file) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await window.electronAPI.writeConfigFileContent(file.path, newContent);
      } catch {
        // ignore write errors silently
      } finally {
        setIsSaving(false);
      }
    }, 500);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    scheduleAutoSave(newContent);
  };

  if (!config) return null;

  return (
    <div className="notebook-container">
      <div className="notebook-sidebar">
        <div className="notebook-sidebar-header">
          <h2>Config Files</h2>
        </div>
        <div className="notebook-list">
          {config.files.map(file => (
            <div
              key={file.id}
              className={`notebook-list-item ${file.id === selectedFileId ? 'active' : ''}`}
              onClick={() => setSelectedFileId(file.id)}
            >
              <div className="notebook-list-item-title">{file.name}</div>
              <div className="notebook-list-item-snippet">{file.path}</div>
            </div>
          ))}
          {config.files.length === 0 && (
            <div className="config-files-empty">
              No config files configured. Add some in Settings &gt; Config Files.
            </div>
          )}
        </div>
      </div>

      {selectedFile ? (
        <div className="notebook-main">
          <div className="notebook-header">
            <div className="config-files-header-info">
              <span className="config-files-header-name">{selectedFile.name}</span>
              <span className="config-files-header-path">{selectedFile.path}</span>
            </div>
            {isSaving && <span className="notes-saving-indicator">Saving...</span>}
          </div>

          {fileError ? (
            <div className="config-files-error">{fileError}</div>
          ) : (
            <div className="notes-content">
              <textarea
                className="notes-editor config-files-editor"
                value={content}
                onChange={e => handleContentChange(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="notebook-no-selection">
          Select a config file to edit
        </div>
      )}
    </div>
  );
}
