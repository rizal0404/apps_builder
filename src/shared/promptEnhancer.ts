/**
 * "Enhance prompt" support — turns a short user idea into a richer, more specific
 * Apps Script-flavoured request before it is sent to the main chat. The enhancement is
 * a single non-streaming completion run by the configured chat provider.
 */

import { ProviderId } from '@/shared/constants';
import { getApiKey } from '@/shared/storage';
import { getProvider } from '@/providers/registry';

export const ENHANCER_SYSTEM_PROMPT = `You are GASPOLL's prompt enhancer. The user will give you a short idea
for a Google Apps Script project. Rewrite it as a precise, implementation-ready prompt for an AI coding
assistant. Output ONLY the rewritten prompt — no preamble, no quotes, no markdown fences.

Guidelines:
- Preserve the user's intent and language (if they wrote in Indonesian, reply in Indonesian).
- Specify which Apps Script services are involved (SpreadsheetApp, DriveApp, GmailApp, HtmlService, etc.).
- Spell out the input(s), the output(s), the trigger (manual run / time-driven / onEdit / web app),
  and any required appsscript.json scopes.
- Suggest a sensible UI (HtmlService web app or sidebar) when the request implies a UI.
- Mention error handling, idempotency, and basic logging when it is non-trivial.
- Keep it under 220 words.`;

export async function enhancePrompt(opts: {
  providerId: ProviderId;
  model: string;
  text: string;
  signal?: AbortSignal;
}): Promise<string> {
  const apiKey = await getApiKey(opts.providerId);
  if (!apiKey) {
    throw new Error(`Missing API key for provider "${opts.providerId}". Open Settings to add it.`);
  }
  const provider = getProvider(opts.providerId);
  const result = await provider.streamChat(
    {
      apiKey,
      model: opts.model,
      systemPrompt: ENHANCER_SYSTEM_PROMPT,
      messages: [
        {
          id: 'enhancer-user',
          role: 'user',
          content: opts.text,
          createdAt: Date.now(),
        },
      ],
      signal: opts.signal,
    },
    () => {
      // streamed chunks are ignored here; we want the full text only.
    },
  );
  return result.text.trim();
}
