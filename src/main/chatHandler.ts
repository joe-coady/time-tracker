import Anthropic from '@anthropic-ai/sdk';
import { BrowserWindow } from 'electron';
import { ChatMessage, ChatToolCall } from '../shared/types';
import { readClaudeConfig } from './storage';
import { TOOL_DEFINITIONS, executeTool } from './chatTools';

let messages: ChatMessage[] = [];
let anthropicMessages: Anthropic.MessageParam[] = [];

const SYSTEM_PROMPT = `You are a helpful assistant integrated into a personal productivity app called Time Tracker. You have access to tools that can fetch data from the user's Jira, GitHub, time tracking, kanban boards, and notes. Use these tools to answer questions about what the user is working on, their tickets, PRs, and notes. Be concise and helpful. Today's date is ${new Date().toISOString().slice(0, 10)}.

If you're unsure what the user is asking about, proactively use your tools to find the answer rather than asking for clarification. For example, search their notes, check their current task, look up Jira tickets, or check their kanban board. The user's question may reference something stored in their data that you can look up.`;

export function getChatHistory(): ChatMessage[] {
  return messages;
}

export function clearChatHistory(): void {
  messages = [];
  anthropicMessages = [];
}

export async function handleChatMessage(userMessage: string, win: BrowserWindow | null): Promise<void> {
  const config = readClaudeConfig();
  if (!config?.apiKey) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('chat-error', 'No API key configured. Go to Settings > Claude to add your Anthropic API key.');
    }
    return;
  }

  const client = new Anthropic({ apiKey: config.apiKey });
  const model = config.model || 'claude-sonnet-4-20250514';

  // Add user message
  const userMsg: ChatMessage = {
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  };
  messages.push(userMsg);
  anthropicMessages.push({ role: 'user', content: userMessage });

  // Stream conversation turns until we get a final response
  try {
    await streamConversationTurn(client, model, win);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (win && !win.isDestroyed()) {
      win.webContents.send('chat-error', errorMsg);
    }
  }
}

async function streamConversationTurn(
  client: Anthropic,
  model: string,
  win: BrowserWindow | null,
): Promise<void> {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  while (true) {
    let fullText = '';
    const toolCalls: ChatToolCall[] = [];
    let currentToolUseId = '';
    let currentToolName = '';
    let currentToolInput = '';

    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: anthropicMessages,
      tools: TOOL_DEFINITIONS as Anthropic.Tool[],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          currentToolUseId = event.content_block.id;
          currentToolName = event.content_block.name;
          currentToolInput = '';
          if (win && !win.isDestroyed()) {
            win.webContents.send('chat-delta', {
              type: 'tool_use_start',
              toolName: currentToolName,
              toolCallId: currentToolUseId,
            });
          }
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullText += event.delta.text;
          if (win && !win.isDestroyed()) {
            win.webContents.send('chat-delta', {
              type: 'text',
              content: event.delta.text,
            });
          }
        } else if (event.delta.type === 'input_json_delta') {
          currentToolInput += event.delta.partial_json;
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolName) {
          let parsedInput: Record<string, unknown> = {};
          try {
            parsedInput = currentToolInput ? JSON.parse(currentToolInput) : {};
          } catch {
            // empty input
          }
          toolCalls.push({
            id: currentToolUseId,
            toolName: currentToolName,
            input: parsedInput,
          });
          currentToolName = '';
          currentToolUseId = '';
          currentToolInput = '';
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    totalInputTokens += finalMessage.usage?.input_tokens ?? 0;
    totalOutputTokens += finalMessage.usage?.output_tokens ?? 0;
    const stopReason = finalMessage.stop_reason;

    if (stopReason === 'tool_use') {
      // Add the assistant message with tool use blocks to anthropic messages
      anthropicMessages.push({ role: 'assistant', content: finalMessage.content });

      // Execute each tool and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tc of toolCalls) {
        const result = await executeTool(tc.toolName, tc.input);
        tc.result = result;

        if (win && !win.isDestroyed()) {
          win.webContents.send('chat-delta', {
            type: 'tool_use_end',
            toolCallId: tc.id,
            toolName: tc.toolName,
            result,
          });
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tc.id,
          content: result,
        });
      }

      // Add tool results to conversation
      anthropicMessages.push({ role: 'user', content: toolResults });

      // Continue the loop for next turn
      continue;
    }

    // end_turn or other stop reason — finalize
    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: fullText,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      timestamp: new Date().toISOString(),
    };
    messages.push(assistantMsg);

    if (win && !win.isDestroyed()) {
      win.webContents.send('chat-done', {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      });
    }
    break;
  }
}
