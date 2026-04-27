import type { Conversation } from '@/shared/types';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSwitch: (c: Conversation) => void;
  onDelete: (c: Conversation) => void;
  onClose: () => void;
}

export function ConversationsDrawer({
  conversations,
  activeId,
  onSwitch,
  onDelete,
  onClose,
}: Props) {
  return (
    <div className="border-b border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600">
        <span>Conversations for this project</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-500 hover:bg-slate-200"
          aria-label="Close drawer"
        >
          ×
        </button>
      </div>
      <ul className="max-h-48 overflow-y-auto pb-2">
        {conversations.length === 0 ? (
          <li className="px-3 py-2 text-xs text-slate-500">No conversations yet.</li>
        ) : (
          conversations.map((c) => (
            <li
              key={c.id}
              className={
                'group flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs ' +
                (activeId === c.id ? 'bg-gaspoll-50 text-gaspoll-700' : 'hover:bg-slate-100')
              }
              onClick={() => onSwitch(c)}
            >
              <span className="flex-1 truncate">{c.title || 'Untitled chat'}</span>
              <span className="shrink-0 text-[10px] text-slate-400">{c.model}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c);
                }}
                className="invisible rounded p-1 text-slate-400 hover:text-rose-600 group-hover:visible"
                aria-label="Delete conversation"
                title="Delete conversation"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
