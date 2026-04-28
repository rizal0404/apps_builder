import { useEffect, useMemo, useRef } from 'react';
import type { ChatMessage } from '@/shared/types';
import { extractFiles, type ExtractedFile } from '@/shared/codeBlocks';
import type { Template } from '@/shared/templates';
import type { FrontendStackId, DesignSkillId } from '@/shared/constants';
import { TemplateGallery } from './TemplateGallery';
import { StackPicker } from './StackPicker';

interface Props {
  messages: ChatMessage[];
  streamingId: string | null;
  onReview: (files: ExtractedFile[], messageId: string) => void;
  onUseTemplate: (t: Template) => void;
  frontendStack: FrontendStackId;
  designSkill: DesignSkillId;
  onFrontendStackChange: (id: FrontendStackId) => void;
  onDesignSkillChange: (id: DesignSkillId) => void;
}

export function MessageList({
  messages,
  streamingId,
  onReview,
  onUseTemplate,
  frontendStack,
  designSkill,
  onFrontendStackChange,
  onDesignSkillChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (!messages.length) {
    return (
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-6 text-center">
        <div className="rounded-full bg-gaspoll-50 p-3 text-gaspoll-600">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h2 className="mt-3 text-sm font-semibold text-slate-800">Build something with GASPOLL</h2>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          Describe the Apps Script app or automation you want — or pick a template below to start
          fast. When the assistant replies with fenced code blocks tagged with file names (e.g.{' '}
          <code>js Code.gs</code>), a Review button appears so you can apply them directly to your
          project.
        </p>
        <StackPicker
          frontendStack={frontendStack}
          designSkill={designSkill}
          onFrontendStackChange={onFrontendStackChange}
          onDesignSkillChange={onDesignSkillChange}
        />
        <div className="mt-5 w-full max-w-md text-left">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Starter templates
          </div>
          <TemplateGallery onUseTemplate={onUseTemplate} />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {messages.map((m) => (
        <Bubble key={m.id} m={m} isStreaming={m.id === streamingId} onReview={onReview} />
      ))}
    </div>
  );
}

function Bubble({
  m,
  isStreaming,
  onReview,
}: {
  m: ChatMessage;
  isStreaming: boolean;
  onReview: (files: ExtractedFile[], messageId: string) => void;
}) {
  const isUser = m.role === 'user';
  const files = useMemo(
    () => (m.role === 'assistant' && !isStreaming ? extractFiles(m.content) : []),
    [m.role, m.content, isStreaming],
  );
  return (
    <div className={'flex ' + (isUser ? 'justify-end' : 'justify-start')}>
      <div className={'flex max-w-[85%] flex-col gap-2 ' + (isUser ? 'items-end' : 'items-start')}>
        <div
          className={
            'whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed ' +
            (isUser
              ? 'bg-gaspoll-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-800 shadow-sm')
          }
        >
          {m.content || (isStreaming ? '…' : ' ')}
        </div>
        {files.length ? (
          <button
            onClick={() => onReview(files, m.id)}
            className="rounded-md border border-gaspoll-300 bg-white px-2 py-1 text-xs font-semibold text-gaspoll-700 shadow-sm hover:bg-gaspoll-50"
          >
            Review {files.length} file{files.length === 1 ? '' : 's'} →
          </button>
        ) : null}
      </div>
    </div>
  );
}
