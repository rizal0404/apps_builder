import { UNKNOWN_SCRIPT_ID } from '@/shared/scriptId';

interface HeaderProps {
  appName: string;
  tagline: string;
  scriptId: string;
  onNewChat: () => void;
  onOpenOptions: () => void;
  onToggleDrawer: () => void;
}

export function Header({
  appName,
  tagline,
  scriptId,
  onNewChat,
  onOpenOptions,
  onToggleDrawer,
}: HeaderProps) {
  const onScriptPage = scriptId !== UNKNOWN_SCRIPT_ID;
  return (
    <header className="border-b border-slate-200 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Show conversations"
          onClick={onToggleDrawer}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="flex flex-col text-center leading-tight">
          <span className="text-sm font-semibold text-gaspoll-600">{appName}</span>
          <span className="text-[10px] text-slate-500">{tagline}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNewChat}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="New chat"
            title="New chat"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onOpenOptions}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Settings"
            title="Settings"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-slate-500">
        <span
          className={
            'h-1.5 w-1.5 rounded-full ' + (onScriptPage ? 'bg-emerald-500' : 'bg-slate-300')
          }
        />
        {onScriptPage ? (
          <>
            <span>Apps Script project:</span>
            <code className="rounded bg-slate-100 px-1 font-mono text-[10px]">
              {scriptId.slice(0, 8)}…
            </code>
          </>
        ) : (
          <span>Open a project on script.google.com to bind this chat</span>
        )}
      </div>
    </header>
  );
}
