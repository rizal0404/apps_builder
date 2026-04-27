/**
 * Curated starter templates for common Apps Script use cases. Each template provides:
 *  - a short label and description for the gallery
 *  - a `prompt` that we drop into the composer (the user can edit it before sending)
 *  - optional `bootstrap` files that can be Applied directly via the Review panel
 *
 * Phase 3 scope: a small but realistic set covering web apps, sheet automations, mail
 * merge, form handlers, and a custom function.
 */

import type { ExtractedFile } from './codeBlocks';

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'web-app' | 'automation' | 'sheet' | 'form' | 'custom-function';
  /** Prompt prefilled into the composer when the template is selected. */
  prompt: string;
  /** Optional starter files the user can apply straight away. */
  bootstrap?: ExtractedFile[];
}

const APPSSCRIPT_JSON_WEB_APP: ExtractedFile = {
  type: 'JSON',
  // Apps Script API stores manifest under the key "appsscript" (no extension).
  name: 'appsscript',
  source: JSON.stringify(
    {
      timeZone: 'Asia/Jakarta',
      runtimeVersion: 'V8',
      webapp: { access: 'ANYONE_ANONYMOUS', executeAs: 'USER_DEPLOYING' },
      exceptionLogging: 'STACKDRIVER',
    },
    null,
    2,
  ),
};

export const TEMPLATES: Template[] = [
  {
    id: 'web-app-hello',
    name: 'Web App: Hello world',
    description: 'Minimal HtmlService web app with a server-rendered greeting.',
    category: 'web-app',
    prompt:
      'Create a simple HtmlService web app called "Hello GASPOLL". The doGet should serve an HTML page with a heading, a textbox for a name, and a button. When the button is clicked, the client calls google.script.run.greet(name) and shows the returned greeting in a #out div. Include a friendly Tailwind-free CSS reset.',
    bootstrap: [
      {
        type: 'SERVER_JS',
        name: 'Code',
        source: `function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Hello GASPOLL');
}

function greet(name) {
  const safe = String(name || '').trim() || 'world';
  return 'Hello, ' + safe + '!';
}
`,
      },
      {
        type: 'HTML',
        name: 'Index',
        source: `<!doctype html>
<html>
<head>
  <base target="_top">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 2rem auto; }
    input, button { padding: .5rem .75rem; font-size: 1rem; }
    #out { margin-top: 1rem; color: #4b6cff; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Hello GASPOLL</h1>
  <p>Type a name and click greet:</p>
  <input id="name" placeholder="World">
  <button onclick="run()">Greet</button>
  <div id="out"></div>
  <script>
    function run() {
      const name = document.getElementById('name').value;
      google.script.run
        .withSuccessHandler(function (msg) { document.getElementById('out').textContent = msg; })
        .greet(name);
    }
  </script>
</body>
</html>
`,
      },
      APPSSCRIPT_JSON_WEB_APP,
    ],
  },
  {
    id: 'sheet-onedit-audit',
    name: 'Sheet: onEdit audit log',
    description:
      'Append an audit row (user / cell / old / new value) to a "_log" tab whenever the active sheet is edited.',
    category: 'sheet',
    prompt:
      'Create an installable onEdit trigger handler that appends [timestamp, userEmail, sheetName, A1 range, oldValue, newValue] to a sheet named "_log" (create it if missing). Skip edits that come from the _log sheet itself. Add an installer function that registers the trigger when run manually.',
  },
  {
    id: 'mail-merge',
    name: 'Mail merge from a sheet',
    description:
      'Send personalized emails to each row in a sheet using a template stored in another tab.',
    category: 'automation',
    prompt:
      'Build a mail-merge automation. Sheet "Recipients" has columns: email, name, amount. Sheet "Template" has cell A1 with the email subject and A2 with the body containing {{name}} and {{amount}} placeholders. A function sendMailMerge() iterates Recipients, replaces placeholders, calls MailApp.sendEmail, and writes a "Sent" timestamp to a 4th column. Skip rows already sent. Add a custom menu "Mail Merge → Send" via onOpen.',
  },
  {
    id: 'form-to-slack',
    name: 'Form responses → Slack',
    description: 'Forward each Google Forms submission to a Slack incoming webhook.',
    category: 'form',
    prompt:
      'Add an onFormSubmit handler that posts each new response to a Slack incoming webhook. The webhook URL must be read from PropertiesService.getScriptProperties().getProperty("SLACK_WEBHOOK"). Format the message as a bullet list of "question: answer". Include a setup function that prompts the user for the webhook URL and stores it.',
  },
  {
    id: 'custom-fn-gpt',
    name: 'Custom function: =GASPOLL_ASK',
    description: 'A spreadsheet custom function that calls an LLM via UrlFetchApp.',
    category: 'custom-function',
    prompt:
      'Create a custom spreadsheet function GASPOLL_ASK(prompt) that calls OpenRouter chat completions via UrlFetchApp. The API key is stored in Script Properties under OPENROUTER_API_KEY. Use a small/cheap model. Cache results for 6 hours via CacheService keyed by prompt hash. Document usage in JSDoc with @customfunction.',
  },
];

export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
