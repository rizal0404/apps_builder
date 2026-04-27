import type { DiffResult } from '@/shared/diff';

interface Props {
  diff: DiffResult;
}

export function DiffView({ diff }: Props) {
  if (diff.lines.length === 0) {
    return <div className="p-3 text-xs text-slate-500">No changes.</div>;
  }
  return (
    <div className="overflow-auto rounded border border-slate-200 bg-slate-50 font-mono text-[11px] leading-relaxed">
      <table className="w-full border-collapse">
        <tbody>
          {diff.lines.map((line, i) => {
            const bg =
              line.op === 'added'
                ? 'bg-emerald-50'
                : line.op === 'removed'
                  ? 'bg-rose-50'
                  : 'bg-white';
            const sign = line.op === 'added' ? '+' : line.op === 'removed' ? '-' : ' ';
            const fg =
              line.op === 'added'
                ? 'text-emerald-800'
                : line.op === 'removed'
                  ? 'text-rose-800'
                  : 'text-slate-600';
            return (
              <tr key={i} className={bg}>
                <td className="select-none px-2 py-0.5 text-right text-slate-400">
                  {line.oldLine ?? ''}
                </td>
                <td className="select-none px-2 py-0.5 text-right text-slate-400">
                  {line.newLine ?? ''}
                </td>
                <td className={`select-none px-1 py-0.5 ${fg}`}>{sign}</td>
                <td className={`whitespace-pre-wrap break-words px-2 py-0.5 ${fg}`}>
                  {line.text || '\u00A0'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
