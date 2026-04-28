import type { ProviderId } from './constants';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Epoch ms. */
  createdAt: number;
}

export interface Conversation {
  id: string;
  /**
   * Apps Script project id detected from the editor URL, or `'unknown'` when
   * the side panel is opened outside script.google.com.
   */
  scriptId: string;
  title: string;
  providerId: ProviderId;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  defaultProvider: ProviderId;
  defaultModel: string;
  systemPrompt: string;
}

export const DEFAULT_SYSTEM_PROMPT = `You are GASPOLL, an AI pair programmer that lives inside the Google Apps Script editor.
You help the user build web apps and automations on top of Google Workspace.
Always prefer Apps Script idioms (SpreadsheetApp, DriveApp, GmailApp, HtmlService, ContentService, ScriptApp triggers).
When generating files, use clearly fenced code blocks tagged with the file name on the first line, e.g.:

\`\`\`js Code.gs
function doGet() { /* ... */ }
\`\`\`

\`\`\`html Index.html
<!doctype html>...
\`\`\`

\`\`\`json appsscript.json
{ "timeZone": "Asia/Jakarta" }
\`\`\`

Be concise. If the user asks a question that does not need code, just answer.`;

export interface ChatRequest {
  conversationId: string;
  scriptId: string;
  providerId: ProviderId;
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
}

export type ChatStreamEvent =
  | { type: 'chunk'; delta: string }
  | { type: 'done'; finishReason?: string }
  | { type: 'error'; error: string };

// ───────────────────────── Phase 4: Autonomous mode types ─────────────────────────

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultInfo {
  toolCallId: string;
  name: string;
  result: string;
  isError: boolean;
}

export interface PlannerRequest {
  conversationId: string;
  scriptId: string;
  providerId: ProviderId;
  model: string;
  goal: string;
  /** Previous chat messages to provide context. */
  messages: ChatMessage[];
  systemPrompt?: string;
  maxIterations?: number;
  maxTokens?: number;
}

export type PlannerEvent =
  | { type: 'progress'; text: string }
  | { type: 'tool_call'; call: ToolCallInfo }
  | { type: 'tool_result'; result: ToolResultInfo }
  | { type: 'iteration'; iteration: number; maxIterations: number }
  | { type: 'done'; summary: string }
  | { type: 'error'; error: string };
