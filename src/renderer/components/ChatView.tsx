import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, ChatToolCall, QuickLinkRule } from '../../shared/types';

function applyQuickLinks(text: string, rules: QuickLinkRule[]): string {
  let result = text;
  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.linkPattern, 'g');
      result = result.replace(regex, (match) => {
        const url = rule.linkTarget.replace('$0', match);
        return `[${match}](${url})`;
      });
    } catch {
      // skip invalid regex
    }
  }
  return result;
}

interface StreamingToolCall {
  id: string;
  toolName: string;
  status: 'running' | 'done';
  result?: string;
}

export default function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingTools, setStreamingTools] = useState<StreamingToolCall[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [quickLinkRules, setQuickLinkRules] = useState<QuickLinkRule[]>([]);
  const [tokenUsage, setTokenUsage] = useState<{ input: number; output: number }>({ input: 0, output: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    const container = messagesEndRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, streamingTools, scrollToBottom]);

  // Load history and quick link rules on mount
  useEffect(() => {
    window.electronAPI.chatGetHistory().then(setMessages);
    window.electronAPI.getQuickLinkRules().then(setQuickLinkRules);
  }, []);

  // Set up streaming listeners
  useEffect(() => {
    window.electronAPI.onChatDelta((data) => {
      if (data.type === 'text') {
        setStreamingText(prev => prev + (data.content ?? ''));
      } else if (data.type === 'tool_use_start') {
        setStreamingTools(prev => [...prev, {
          id: data.toolCallId!,
          toolName: data.toolName!,
          status: 'running',
        }]);
      } else if (data.type === 'tool_use_end') {
        setStreamingTools(prev => prev.map(tc =>
          tc.id === data.toolCallId
            ? { ...tc, status: 'done' as const, result: data.result }
            : tc
        ));
      }
    });

    window.electronAPI.onChatError((err) => {
      setError(err);
      setStreaming(false);
    });

    window.electronAPI.onChatDone((usage) => {
      setStreaming(false);
      setStreamingText('');
      setStreamingTools([]);
      if (usage) {
        setTokenUsage(prev => ({
          input: prev.input + usage.inputTokens,
          output: prev.output + usage.outputTokens,
        }));
      }
      window.electronAPI.chatGetHistory().then(setMessages);
    });

    return () => {
      window.electronAPI.removeChatListeners();
    };
  }, []);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || streaming) return;

    setInput('');
    setError(null);
    setStreaming(true);
    setStreamingText('');
    setStreamingTools([]);

    // Optimistically add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    }]);

    await window.electronAPI.chatSendMessage(msg);
  }, [input, streaming]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!streaming) handleSend();
    }
  }, [handleSend]);

  const handleClear = useCallback(async () => {
    await window.electronAPI.chatClearHistory();
    setMessages([]);
    setStreamingText('');
    setStreamingTools([]);
    setError(null);
    setTokenUsage({ input: 0, output: 0 });
  }, []);

  const toggleTool = useCallback((id: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderToolCall = (tc: ChatToolCall | StreamingToolCall, isStreaming = false) => {
    const isDone = 'result' in tc && tc.result !== undefined;
    const expanded = expandedTools.has(tc.id);
    return (
      <div key={tc.id} className="chat-tool-call">
        <button
          className="chat-tool-header"
          onClick={() => toggleTool(tc.id)}
        >
          <span className="chat-tool-indicator" data-status={isDone ? 'done' : 'running'} />
          <span className="chat-tool-name">{tc.toolName}</span>
          <span className="chat-tool-chevron">{expanded ? '\u25BC' : '\u25B6'}</span>
        </button>
        {expanded && isDone && (
          <pre className="chat-tool-result">{formatToolResult(tc.result ?? (tc as ChatToolCall).result ?? '')}</pre>
        )}
      </div>
    );
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2 className="chat-title">AI Chat</h2>
        <button className="btn-secondary chat-clear-btn" onClick={handleClear}>
          Clear
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message chat-message-${msg.role}`}>
            {msg.role === 'assistant' && msg.toolCalls?.map(tc => renderToolCall(tc))}
            {msg.content && (
              <div className="chat-bubble">
                {msg.role === 'assistant' ? (
                  <ReactMarkdown components={{ a: ({ href, children }) => (
                    <a href={href} onClick={(e) => { e.preventDefault(); if (href) window.electronAPI.openExternal(href); }}>{children}</a>
                  ) }}>{applyQuickLinks(msg.content, quickLinkRules)}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            )}
          </div>
        ))}

        {/* Streaming state */}
        {streaming && (
          <div className="chat-message chat-message-assistant">
            {streamingTools.map(tc => renderToolCall(tc, true))}
            {streamingText ? (
              <div className="chat-bubble">
                <ReactMarkdown components={{ a: ({ href, children }) => (
                  <a href={href} onClick={(e) => { e.preventDefault(); if (href) window.electronAPI.openExternal(href); }}>{children}</a>
                ) }}>{applyQuickLinks(streamingText, quickLinkRules)}</ReactMarkdown>
              </div>
            ) : streamingTools.length === 0 ? (
              <div className="chat-thinking">Thinking...</div>
            ) : null}
          </div>
        )}

        {error && (
          <div className="chat-error">{error}</div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask something..."
          rows={1}
        />
        <button
          className="btn-primary chat-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || streaming}
        >
          Send
        </button>
      </div>
      {(tokenUsage.input > 0 || tokenUsage.output > 0) && (
        <div className="chat-token-badge">
          {formatTokenCount(tokenUsage.input + tokenUsage.output)} tokens
        </div>
      )}
    </div>
  );
}

function formatTokenCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function formatToolResult(result: string): string {
  try {
    const parsed = JSON.parse(result);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return result;
  }
}
