/**
 * Tiny line-based diff for the Review-mode side-panel.
 *
 * Produces a list of hunks in the canonical "added/removed/context" form. We use a
 * simple LCS-based algorithm — adequate for the size of an Apps Script file (a few
 * hundred lines). Runtime is O(n*m) where n,m are line counts of the two inputs.
 *
 * No third-party dependency: keeps the side-panel bundle small.
 */

export type DiffOp = 'context' | 'added' | 'removed';

export interface DiffLine {
  op: DiffOp;
  text: string;
  /** 1-based line number in the original file (null on `added`). */
  oldLine: number | null;
  /** 1-based line number in the new file (null on `removed`). */
  newLine: number | null;
}

export interface DiffStats {
  added: number;
  removed: number;
}

export interface DiffResult {
  lines: DiffLine[];
  stats: DiffStats;
}

function splitLines(s: string): string[] {
  if (s === '') return [];
  return s.replace(/\r\n/g, '\n').split('\n');
}

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const table: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }
  return table;
}

export function diffStrings(oldText: string, newText: string): DiffResult {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const table = lcs(a, b);
  const out: DiffLine[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      out.push({ op: 'context', text: a[i - 1], oldLine: i, newLine: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      out.push({ op: 'added', text: b[j - 1], oldLine: null, newLine: j });
      j--;
    } else if (i > 0) {
      out.push({ op: 'removed', text: a[i - 1], oldLine: i, newLine: null });
      i--;
    }
  }
  out.reverse();
  let added = 0;
  let removed = 0;
  for (const l of out) {
    if (l.op === 'added') added++;
    else if (l.op === 'removed') removed++;
  }
  return { lines: out, stats: { added, removed } };
}
