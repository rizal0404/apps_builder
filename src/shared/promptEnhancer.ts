/**
 * "Enhance prompt" support — turns a short user idea into a richer, more specific
 * Apps Script-flavoured request before it is sent to the main chat. The enhancement is
 * a single non-streaming completion run by the configured chat provider.
 *
 * When a frontend stack and/or design skill are selected, the enhancer will incorporate
 * those choices into the rewritten prompt — producing detailed, structured output that
 * includes UI specifications, database schemas, and GAS function details.
 */

import { ProviderId, FRONTEND_STACKS, DESIGN_SKILLS } from '@/shared/constants';
import type { FrontendStackId, DesignSkillId } from '@/shared/constants';
import { getApiKey } from '@/shared/storage';
import { getProvider } from '@/providers/registry';

// ── Stack & design context snippets ────────────────────────────────────────────

const STACK_CONTEXT: Record<string, string> = {
  'alpine-tailwind': `- Frontend Stack: Alpine.js 3 (CDN-based) + Tailwind CSS
- Use Alpine.js for reactive behavior (x-data, x-bind, x-on, x-show, x-for) and Tailwind CSS utility classes for all styling.
- Include CDN links for both Alpine.js and Tailwind CSS in the HTML template served via HtmlService.`,

  'vue-tailwind': `- Frontend Stack: Vue.js 3 (CDN-based via importmap or global build) + Tailwind CSS
- Use Vue 3 Composition API (setup, ref, reactive, computed, onMounted) for component logic.
- Include CDN links for Vue 3 and Tailwind CSS in the HTML template served via HtmlService.
- Use google.script.run for frontend-backend communication.`,

  'alpine-daisyui': `- Frontend Stack: Alpine.js 3 (CDN-based) + DaisyUI (on top of Tailwind CSS)
- Use Alpine.js for reactive behavior and DaisyUI component classes (btn, card, modal, table, navbar, etc.) for UI.
- Include CDN links for Alpine.js, Tailwind CSS, and DaisyUI in the HTML template.`,

  'jquery-bootstrap': `- Frontend Stack: jQuery 3 + Bootstrap 5 (CDN-based)
- Use jQuery for DOM manipulation and AJAX patterns, Bootstrap 5 for layout grid, components (modals, cards, tables, navs, forms), and utility classes.
- Include CDN links for jQuery, Bootstrap CSS, and Bootstrap JS bundle.`,

  'vanilla-picocss': `- Frontend Stack: Vanilla JavaScript (no framework) + PicoCSS
- Use plain ES6+ JavaScript with no build step. PicoCSS for minimal, classless CSS styling.
- Include CDN link for PicoCSS. Use semantic HTML elements that PicoCSS styles automatically.`,
};

const DESIGN_CONTEXT: Record<string, string> = {
  agentic: `- Design System: Agentic UI
- Focus on AI-agent interaction patterns: conversational interfaces, step-by-step progress indicators, real-time streaming output panels, tool-call visualization, and status dashboards.
- Use clean card layouts with clear information hierarchy. Prioritize scanability and minimal cognitive load.`,

  bento: `- Design System: Bento Design System
- Visual Style: Modern, clean, and consistent grid-based layout (Bento Grid).
- Typography: Primary & Display Font: Inter; Monospace: JetBrains Mono; Scale: 12/14/16/20/24/32; Weights: 400, 500, 600, 700.
- Color Palette (use semantic tokens): primary: #FAD4C0, secondary: #80A1C1, success: #16A34A, warning: #D97706, danger: #DC2626, surface: #FFF5E6, text: #111827.
- Spacing Scale: 4/8/12/16/24/32 for all layout and components.
- Component Families: buttons, inputs, forms, selects, cards, tables, modals, alerts, navigation — all following Bento anatomy, states (default, hover, focus-visible, active, disabled, loading, error), and variants.
- Accessibility: WCAG 2.2 AA compliant. Keyboard-first interactions, clear focus-visible states.`,

  clean: `- Design System: Clean UI
- Minimalist approach with generous whitespace, clear typography hierarchy, and subtle borders/dividers.
- Use a neutral color palette with one accent color. Soft shadows for elevation. Simple, readable sans-serif fonts.`,

  modern: `- Design System: Modern UI
- Bold typography, vibrant accent colors, rounded corners (8-12px), subtle shadows and gradients.
- Card-based layouts with clear visual hierarchy. Smooth transitions and micro-animations for interactivity.
- Dark mode support recommended.`,

  glassmorphism: `- Design System: Glassmorphism
- Semi-transparent backgrounds with backdrop-filter blur (backdrop-blur-md/lg). Subtle border (1px solid rgba(255,255,255,0.18)).
- Layered depth with frosted glass effect. Light, airy color palette. Soft shadows for elevation.
- Ensure text readability over glass surfaces with appropriate contrast.`,

  neumorphism: `- Design System: Neumorphism (Soft UI)
- Soft, extruded appearance using inset and outer box-shadows on matching background color.
- Subtle, monochromatic color palette. Rounded corners (12-20px). Pressed/unpressed states for interactive elements.
- Light background (#e0e5ec or similar) with light and dark shadow pairs.`,

  minimalist: `- Design System: Minimalist
- Maximum simplicity: remove all unnecessary elements. Monochrome or very limited color palette.
- Large whitespace, simple typography (single font family), minimal borders and shadows.
- Content-first approach — every element must earn its place.`,
};

// ── System prompt builder ──────────────────────────────────────────────────────

function buildEnhancerSystemPrompt(
  frontendStack?: FrontendStackId,
  designSkill?: DesignSkillId,
): string {
  const hasStack = frontendStack && frontendStack !== 'auto';
  const hasDesign = designSkill && designSkill !== 'auto';
  const hasContext = hasStack || hasDesign;

  // Build the frontend/design context block
  let contextBlock = '';
  if (hasContext) {
    const lines: string[] = [];
    if (hasStack) {
      const snippet = STACK_CONTEXT[frontendStack];
      if (snippet) {
        lines.push(snippet);
      } else {
        // 'custom' or unknown — just mention the label
        const label = FRONTEND_STACKS.find((s) => s.id === frontendStack)?.label ?? frontendStack;
        lines.push(`- Frontend Stack: ${label}`);
      }
    }
    if (hasDesign) {
      const snippet = DESIGN_CONTEXT[designSkill];
      if (snippet) {
        lines.push(snippet);
      } else {
        const label = DESIGN_SKILLS.find((s) => s.id === designSkill)?.label ?? designSkill;
        lines.push(`- Design Style: ${label}`);
      }
    }
    contextBlock = `\nFRONTEND & DESIGN CONTEXT (incorporate these into your rewritten prompt):\n${lines.join('\n')}\n`;
  }

  // Build structured output instructions when we have context
  const structuredInstructions = hasContext
    ? `
STRUCTURE YOUR OUTPUT with these sections (use Roman numerals):
I.   Tujuan Aplikasi — concise statement of what the app does and for whom.
II.  Frontend Stack & Design System Mandate — detail the chosen stack, design tokens (typography, colors, spacing), component families, and accessibility requirements.
III. Backend Stack & Database — Google Apps Script as backend, Google Sheets as database.
IV.  Fitur Aplikasi Detail — break down by user role/interface (e.g., Employee vs Admin). Include detailed UI flows, form fields, validation rules.
V.   Struktur Google Sheets (Database) — define each sheet with column names, types, and relationships.
VI.  Google Apps Script (GAS) Logic — specify doGet/doPost handlers, utility functions (CRUD helpers, distance calculation, email, hashing, etc.).
VII. Persyaratan Tambahan — responsive design, error handling, performance, security considerations.

The output should be 400–800 words, comprehensive and implementation-ready.`
    : `
The output should be under 300 words, focused and implementation-ready.
Suggest a sensible UI (HtmlService web app or sidebar) when the request implies a UI.`;

  return `You are GASPOLL's prompt enhancer. The user will give you a short idea for a Google Apps Script project.
Rewrite it as a precise, implementation-ready prompt for an AI coding assistant.
Output ONLY the rewritten prompt — no preamble, no quotes, no markdown fences.
${contextBlock}
Guidelines:
- Preserve the user's intent and language (if they wrote in Indonesian, reply in Indonesian).
- Specify which Apps Script services are involved (SpreadsheetApp, DriveApp, GmailApp, HtmlService, ContentService, ScriptApp triggers).
- Spell out the input(s), the output(s), the trigger (manual run / time-driven / onEdit / web app), and any required appsscript.json configuration.
- Mention error handling, idempotency, and basic logging when it is non-trivial.
- If a frontend stack and/or design system context is provided above, integrate those specifications deeply into your rewritten prompt. Include specific design tokens, component guidelines, and technical implementation details relevant to the chosen stack.
${structuredInstructions}`;
}

// ── Legacy export for backwards compat (tests, etc.) ───────────────────────────
export const ENHANCER_SYSTEM_PROMPT = buildEnhancerSystemPrompt();

// ── Main export ────────────────────────────────────────────────────────────────

export async function enhancePrompt(opts: {
  providerId: ProviderId;
  model: string;
  text: string;
  frontendStack?: FrontendStackId;
  designSkill?: DesignSkillId;
  signal?: AbortSignal;
}): Promise<string> {
  const apiKey = await getApiKey(opts.providerId);
  if (!apiKey) {
    throw new Error(`Missing API key for provider "${opts.providerId}". Open Settings to add it.`);
  }
  const provider = getProvider(opts.providerId);
  const systemPrompt = buildEnhancerSystemPrompt(opts.frontendStack, opts.designSkill);
  const result = await provider.streamChat(
    {
      apiKey,
      model: opts.model,
      systemPrompt,
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
