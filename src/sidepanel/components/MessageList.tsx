import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/shared/types';

interface Props {
  messages: ChatMessage[];
  streamingId: string | null;
}

export function MessageList({ messages, streamingId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (!messages.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
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
        <p className="mt-1 text-xs text-slate-500">
          Describe the Apps Script app or automation you want. The assistant will reply here, and
          starting in Phase 2 it will write code straight into your editor.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {messages.map((m) => (
        <Bubble key={m.id} m={m} isStreaming={m.id === streamingId} />
      ))}
    </div>
  );
}

function Bubble({ m, isStreaming }: { m: ChatMessage; isStreaming: boolean }) {
  const isUser = m.role === 'user';
  return (
    <div className={'flex ' + (isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={
          'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed ' +
          (isUser ? 'bg-gaspoll-600 text-white shadow-sm' : 'bg-slate-100 text-slate-800 shadow-sm')
        }
      >
        {m.content || (isStreaming ? '…' : ' ')}
      </div>
    </div>
  );
}
