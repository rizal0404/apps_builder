/**
 * Phase 4 — Autonomous planner loop.
 *
 * The planner is an agent loop that:
 *   1. Receives a goal from the user + project context
 *   2. Sends messages to the AI provider with tool definitions
 *   3. When the AI returns tool_calls, executes them and appends results
 *   4. Loops until the AI returns text-only (done) or hits iteration/token cap
 *   5. Streams progress events back to the caller
 */

import { ProviderId } from '@/shared/constants';
import { getApiKey } from '@/shared/storage';
import { getProvider } from '@/providers/registry';
import { toOpenAITools, executeTool } from '@/shared/tools';
import type { ChatMessage, PlannerRequest, PlannerEvent } from '@/shared/types';
import { generateId } from '@/shared/id';

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_MAX_TOKENS = 100_000;

const PLANNER_SYSTEM_PROMPT = `You are GASPOLL's autonomous planner. You are given a goal and access to tools to manage a Google Apps Script project.

Available tools:
- read_file: Read a file from the project
- write_file: Create or update a file in the project
- run_function: Execute a function in the project (requires API Executable deployment)
- deploy_web_app: Create a versioned deployment as a web app

Workflow:
1. First, read existing files to understand the current project state.
2. Plan the changes needed to achieve the goal.
3. Write the necessary files one at a time using write_file.
4. If the goal involves deploying, use deploy_web_app after writing all files.
5. When done, provide a brief summary of what was accomplished.

Important:
- Always read existing files before overwriting them to avoid losing code.
- Use Apps Script idioms (SpreadsheetApp, DriveApp, GmailApp, HtmlService, etc.).
- Include proper error handling in the generated code.
- The appsscript.json file type is "JSON" and must include required oauthScopes.
- For web apps, always include doGet() in a SERVER_JS file.
- CRITICAL: In appsscript.json, the only valid values for "webapp.executeAs" are: "USER_DEPLOYING" or "USER_ACCESSING". Do NOT use "DEPLOYER" — it is invalid and will cause API errors.
- The only valid values for "webapp.access" are: "ANYONE", "ANYONE_ANONYMOUS", "MYSELF", or "DOMAIN".
- CRITICAL: Only use REAL Google OAuth scopes in oauthScopes. PropertiesService, CacheService, LockService, and Utilities do NOT need any scope. Do NOT invent scopes like "https://www.googleapis.com/auth/script.properties" — it does not exist and will cause a 400 error. Common valid scopes: auth/spreadsheets, auth/drive, auth/gmail.send, auth/gmail.readonly, auth/calendar, auth/documents, auth/forms, auth/script.external_request.
- For Advanced Services in dependencies.enabledAdvancedServices, use the correct serviceId: "sheets" (NOT "sheetsapi"), "drive" (NOT "driveapi"), "calendar", "docs", "slides", "gmail", "youtube", "bigquery", "analytics".`;

export type PlannerEventCallback = (event: PlannerEvent) => void;

export interface PlannerSession {
  /** Start the planner loop. Resolves when done or aborted. */
  run(): Promise<void>;
  /** Abort the planner loop. */
  cancel(): void;
}

export function createPlannerSession(
  request: PlannerRequest,
  onEvent: PlannerEventCallback,
): PlannerSession {
  const aborter = new AbortController();

  async function run(): Promise<void> {
    try {
      const apiKey = await getApiKey(request.providerId as ProviderId);
      if (!apiKey) {
        onEvent({
          type: 'error',
          error: `Missing API key for provider "${request.providerId}". Open Settings to add it.`,
        });
        return;
      }

      const provider = getProvider(request.providerId as ProviderId);
      if (!provider.streamChatWithTools) {
        onEvent({
          type: 'error',
          error: `Provider "${request.providerId}" does not support tool calling. Use OpenRouter or Gemini.`,
        });
        return;
      }

      const maxIter = request.maxIterations ?? DEFAULT_MAX_ITERATIONS;
      // Token tracking reserved for future use (maxTokens cap)
      void (request.maxTokens ?? DEFAULT_MAX_TOKENS);

      // Build initial message history
      const systemPrompt = [
        request.systemPrompt ?? PLANNER_SYSTEM_PROMPT,
        `\nTarget scriptId: ${request.scriptId}`,
      ].join('\n');

      // Start with user's goal as the latest message
      const messages: ChatMessage[] = [
        ...request.messages.filter((m) => m.role !== 'system'),
        {
          id: generateId('msg'),
          role: 'user',
          content: request.goal,
          createdAt: Date.now(),
        },
      ];

      const tools = toOpenAITools();
      const toolMessages: Array<{ role: 'tool'; tool_call_id: string; content: string }> = [];

      // Track assistant messages with tool_calls for the conversation
      const assistantToolCallMessages: Array<{
        role: 'assistant';
        content: string;
        tool_calls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
      }> = [];

      let iteration = 0;

      while (iteration < maxIter) {
        if (aborter.signal.aborted) {
          onEvent({ type: 'error', error: 'Cancelled by user.' });
          return;
        }

        iteration++;
        onEvent({ type: 'iteration', iteration, maxIterations: maxIter });

        // Build the full message list for this iteration
        // We need to rebuild because messages grow with tool results
        const allMessages: ChatMessage[] = [...messages];

        // Add any assistant tool_call messages and tool results as synthetic messages
        for (const atcm of assistantToolCallMessages) {
          allMessages.push({
            id: generateId('msg'),
            role: 'assistant',
            content: atcm.content || `[Tool calls: ${atcm.tool_calls.map((tc) => tc.function.name).join(', ')}]`,
            createdAt: Date.now(),
          });
        }

        let progressText = '';
        const result = await provider.streamChatWithTools(
          {
            apiKey,
            model: request.model,
            systemPrompt,
            messages: allMessages,
            signal: aborter.signal,
            tools,
            toolMessages: toolMessages.length ? toolMessages : undefined,
          },
          ({ delta }) => {
            progressText += delta;
            onEvent({ type: 'progress', text: delta });
          },
        );

        // Check if the AI wants to call tools
        if (result.toolCalls?.length) {
          // Record the assistant message with tool_calls
          assistantToolCallMessages.push({
            role: 'assistant',
            content: result.text,
            tool_calls: result.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: tc.arguments },
            })),
          });

          // Execute each tool call
          for (const tc of result.toolCalls) {
            let args: Record<string, unknown>;
            try {
              args = JSON.parse(tc.arguments) as Record<string, unknown>;
            } catch {
              args = {};
            }

            onEvent({
              type: 'tool_call',
              call: { id: tc.id, name: tc.name, arguments: args },
            });

            const toolResult = await executeTool(request.scriptId, tc.name, args);

            onEvent({
              type: 'tool_result',
              result: {
                toolCallId: tc.id,
                name: tc.name,
                result: toolResult.result,
                isError: toolResult.isError,
              },
            });

            // For OpenRouter: append tool results
            toolMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: toolResult.result,
            });
          }

          // Continue the loop for next iteration
          continue;
        }

        // No tool calls — the AI is done
        onEvent({ type: 'done', summary: result.text || progressText });
        return;
      }

      // Hit iteration limit
      onEvent({
        type: 'done',
        summary: `Reached maximum iterations (${maxIter}). The planner stopped. You may run it again to continue.`,
      });
    } catch (err) {
      if (aborter.signal.aborted) {
        onEvent({ type: 'error', error: 'Cancelled by user.' });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      onEvent({ type: 'error', error: msg });
    }
  }

  function cancel(): void {
    aborter.abort();
  }

  return { run, cancel };
}
