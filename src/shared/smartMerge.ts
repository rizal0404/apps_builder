/**
 * Smart Merge — detects AI truncation markers and preserves original code.
 *
 * When an AI model outputs truncated code with markers like:
 *   // ... sisanya tetap sama ...
 *   // ... rest stays the same ...
 *   <!-- ... existing code ... -->
 *
 * This module intelligently merges the AI's changes with the original file,
 * preserving the code that the AI intended to leave unchanged.
 *
 * Algorithm (Context-Anchored Smart Merge v2):
 *   1. Detect truncation markers in the proposed code
 *   2. Split proposed code into alternating "code" and "marker" segments
 *   3. For each marker, determine original-line boundaries by anchoring:
 *      - End of preceding code segment → start boundary
 *      - Start of following code segment → end boundary
 *   4. Replace each marker with the original lines between the boundaries
 *   5. Handle overlap / deduplication between code segments and original
 */

// ── Truncation marker detection ─────────────────────────────────────────────────

/**
 * Patterns that indicate a truncation/ellipsis placeholder left by the AI.
 * Covers JS/TS single-line, block comments, and HTML comments in both
 * English and Indonesian (the two languages GASPOLL users commonly see).
 */
const TRUNCATION_PATTERNS: RegExp[] = [
  // JS/TS single-line: "// ... <keyword> ..."
  /^\s*\/\/\s*\.{2,}\s*.*(?:sama|same|unchanged|remains?|existing|tetap|sisa|lanjut|rest|continue|below|selanjut|sebelum|previous|original|keep|omit|skip|truncat|snip|cut|kode|code|here|dst|dll|etc).*$/i,
  // JS/TS single-line: bare "// ..." (three or more dots only)
  /^\s*\/\/\s*\.{3,}\s*$/,
  // JS/TS single-line: "// [...]" or "// <...>"
  /^\s*\/\/\s*[\[<]\.{3,}[\]>]\s*.*$/i,

  // JS/TS block comments: "/* ... keyword ... */"
  /^\s*\/\*\s*\.{2,}\s*.*(?:sama|same|unchanged|remains?|existing|tetap|sisa|rest|continue|kode|code).*\*\/\s*$/i,
  // JS/TS block comments: bare "/* ... */"
  /^\s*\/\*\s*\.{3,}\s*\*\/\s*$/,

  // HTML comments: "<!-- ... keyword ... -->"
  /^\s*<!--\s*\.{2,}\s*.*(?:sama|same|unchanged|remains?|existing|tetap|sisa|rest|continue|kode|code).*-->\s*$/i,
  // HTML comments: bare "<!-- ... -->"
  /^\s*<!--\s*\.{3,}\s*-->\s*$/,
];

/** Test whether a single line is a truncation marker. */
export function isTruncationMarker(line: string): boolean {
  return TRUNCATION_PATTERNS.some((p) => p.test(line));
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function splitLines(s: string): string[] {
  if (s === '') return [];
  return s.replace(/\r\n/g, '\n').split('\n');
}

/** Normalize a line for fuzzy comparison: trim + collapse whitespace. */
function norm(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

/** Max number of context lines to use for anchor matching. */
const ANCHOR_SIZE = 5;

/**
 * Find a contiguous sequence of lines (`needle`) inside `haystack`,
 * starting the search from index `startFrom`. Returns the index of
 * the first matched line, or -1 if not found.
 */
function findSequence(
  haystack: string[],
  needle: string[],
  startFrom: number = 0,
): number {
  if (needle.length === 0) return -1;
  const needleNorm = needle.map(norm);
  outer: for (let i = startFrom; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needleNorm.length; j++) {
      if (norm(haystack[i + j]) !== needleNorm[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Find where a code segment's LAST lines anchor in the original.
 * Uses the tail of the code segment (distinctive lines) to find
 * the position in origLines starting from `startFrom`.
 *
 * Returns the origLine index AFTER the last matched line, or -1.
 */
function anchorEnd(origLines: string[], codeLines: string[], startFrom: number): number {
  // Try matching a sequence from the tail, starting from the largest window
  for (let size = Math.min(codeLines.length, ANCHOR_SIZE); size >= 1; size--) {
    const anchor = codeLines.slice(-size);
    const pos = findSequence(origLines, anchor, startFrom);
    if (pos >= 0) return pos + anchor.length;
  }
  return -1;
}

/**
 * Find where a code segment's FIRST lines anchor in the original.
 * Uses the head of the code segment to find the position.
 *
 * Returns the origLine index of the first matched line, or -1.
 */
function anchorStart(origLines: string[], codeLines: string[], startFrom: number): number {
  // Try matching a sequence from the head, starting from the largest window
  for (let size = Math.min(codeLines.length, ANCHOR_SIZE); size >= 1; size--) {
    const anchor = codeLines.slice(0, size);
    const pos = findSequence(origLines, anchor, startFrom);
    if (pos >= 0) return pos;
  }
  return -1;
}

/**
 * Find the longest contiguous overlap between the tail of `a` and the head of `b`.
 * Returns the number of overlapping lines.
 */
function overlapLength(a: string[], b: string[]): number {
  const maxOverlap = Math.min(a.length, b.length);
  for (let len = maxOverlap; len >= 1; len--) {
    const tailOfA = a.slice(-len);
    const headOfB = b.slice(0, len);
    let match = true;
    for (let i = 0; i < len; i++) {
      if (norm(tailOfA[i]) !== norm(headOfB[i])) {
        match = false;
        break;
      }
    }
    if (match) return len;
  }
  return 0;
}

// ── Core merge ──────────────────────────────────────────────────────────────────

interface Segment {
  kind: 'code' | 'marker';
  lines: string[];
}

/**
 * Intelligently merge proposed code with the original, replacing truncation
 * markers with the corresponding original code.
 *
 * @param original  The complete original file content
 * @param proposed  The AI-generated (possibly truncated) file content
 * @returns         The merged content, or `proposed` unchanged if no markers found
 */
export function smartMerge(original: string, proposed: string): string {
  if (!original) return proposed; // New file, nothing to merge with

  const origLines = splitLines(original);
  const propLines = splitLines(proposed);

  // Find truncation marker indices
  const markerIndices: number[] = [];
  for (let i = 0; i < propLines.length; i++) {
    if (isTruncationMarker(propLines[i])) markerIndices.push(i);
  }
  if (markerIndices.length === 0) return proposed;

  // Build alternating segments
  const segments: Segment[] = [];
  let cursor = 0;
  for (const mi of markerIndices) {
    if (mi > cursor) {
      segments.push({ kind: 'code', lines: propLines.slice(cursor, mi) });
    }
    segments.push({ kind: 'marker', lines: [propLines[mi]] });
    cursor = mi + 1;
  }
  if (cursor < propLines.length) {
    segments.push({ kind: 'code', lines: propLines.slice(cursor) });
  }

  // ── Two-pass marker resolution ───────────────────────────────────────

  const result: string[] = [];
  let origCursor = 0;

  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];

    if (seg.kind === 'code') {
      result.push(...seg.lines);

      // Advance origCursor past this code segment's anchor in the original.
      // Try to find the tail of this code segment in the original.
      const end = anchorEnd(origLines, seg.lines, origCursor);
      if (end >= 0) {
        origCursor = end;
      } else {
        // The code segment contains modified lines that don't exist in the
        // original. Try to anchor using just the last line(s) that DO match.
        // Walk backwards through the code segment to find any matching line.
        let found = false;
        for (let i = seg.lines.length - 1; i >= 0; i--) {
          if (norm(seg.lines[i]).length === 0) continue;
          const pos = findSequence(origLines, [seg.lines[i]], origCursor);
          if (pos >= 0) {
            // Lines after index i in the code segment are modified/new lines
            // that replace the corresponding original lines after `pos`.
            const remainingCodeLines = seg.lines.length - 1 - i;
            origCursor = Math.min(pos + 1 + remainingCodeLines, origLines.length);
            found = true;
            break;
          }
        }
        // If still no match, try anchoring the head of the segment
        if (!found) {
          for (let i = 0; i < seg.lines.length; i++) {
            if (norm(seg.lines[i]).length === 0) continue;
            const pos = findSequence(origLines, [seg.lines[i]], origCursor);
            if (pos >= 0) {
              const remainingCodeLines = seg.lines.length - 1 - i;
              origCursor = Math.min(pos + 1 + remainingCodeLines, origLines.length);
              break;
            }
          }
        }
      }
      continue;
    }

    // ── Marker resolution ──────────────────────────────────────────────
    // Determine the end boundary by looking at the next code segment
    const nextCode = segments.slice(s + 1).find((ns) => ns.kind === 'code');

    if (nextCode) {
      const start = anchorStart(origLines, nextCode.lines, origCursor);
      if (start >= 0 && start >= origCursor) {
        // Insert original lines between current position and next anchor
        const origSlice = origLines.slice(origCursor, start);

        // Check for overlap: the tail of origSlice might duplicate lines
        // that are already in `result` (from the preceding code segment)
        const overlap = overlapLength(result, origSlice);
        if (overlap > 0) {
          result.push(...origSlice.slice(overlap));
        } else {
          result.push(...origSlice);
        }
        origCursor = start;

        // Also check if the head of nextCode overlaps with the tail of
        // what we just inserted (origSlice). If the next code segment
        // starts with lines that are already in the original slice,
        // we need to skip those in nextCode to avoid duplication.
        // We handle this by adjusting nextCode's lines when we emit it.
      } else {
        // Fallback: keep the marker text as a visible warning
        result.push(...seg.lines);
      }
    } else {
      // Marker at the end — copy all remaining original lines
      if (origCursor < origLines.length) {
        const origSlice = origLines.slice(origCursor);
        // Check for overlap with already-emitted result
        const overlap = overlapLength(result, origSlice);
        if (overlap > 0) {
          result.push(...origSlice.slice(overlap));
        } else {
          result.push(...origSlice);
        }
        origCursor = origLines.length;
      } else {
        // Nothing left in original; keep marker as a warning
        result.push(...seg.lines);
      }
    }
  }

  return result.join('\n');
}
