/**
 * Compute and apply patches against an Apps Script project.
 *
 * `buildPatch`: given the current project files (`getProjectContent`) and a set of
 * proposed files (from `extractFiles`), produces a `FilePatch[]` that the side panel
 * can render as a diff. Files in the project that aren't touched by the proposal
 * pass through unchanged.
 *
 * `applyPatch`: merges the proposed files into the existing project file list and
 * sends the result through `updateProjectContent`.
 */

import { type AppsScriptFile, getProjectContent, updateProjectContent } from './appsScriptApi';
import type { DiffResult } from './diff';
import { diffStrings } from './diff';
import type { ExtractedFile } from './codeBlocks';
import { smartMerge } from './smartMerge';

export type PatchOp = 'create' | 'update' | 'unchanged';

export interface FilePatch {
  name: string;
  type: AppsScriptFile['type'];
  op: PatchOp;
  before: string;
  after: string;
  diff: DiffResult;
}

export interface ProjectPatch {
  scriptId: string;
  files: FilePatch[];
  /** Files in the project that are not touched by the proposal. */
  untouched: AppsScriptFile[];
}

function key(f: { name: string; type: AppsScriptFile['type'] }): string {
  return `${f.type}:${f.name}`;
}

export async function buildPatch(
  scriptId: string,
  proposed: ExtractedFile[],
): Promise<ProjectPatch> {
  const current = await getProjectContent(scriptId);
  const currentByKey = new Map(current.files.map((f) => [key(f), f]));

  const files: FilePatch[] = [];
  const touched = new Set<string>();
  for (const p of proposed) {
    touched.add(key(p));
    const existing = currentByKey.get(key(p));
    const before = existing?.source ?? '';
    // Smart merge: resolve any truncation markers in the AI output
    // by filling them in with the corresponding original code.
    const after = existing ? smartMerge(before, p.source) : p.source;
    const op: PatchOp = !existing ? 'create' : before === after ? 'unchanged' : 'update';
    files.push({
      name: p.name,
      type: p.type,
      op,
      before,
      after,
      diff: diffStrings(before, after),
    });
  }

  const untouched = current.files.filter((f) => !touched.has(key(f)));
  return { scriptId, files, untouched };
}

export async function applyPatch(patch: ProjectPatch): Promise<void> {
  const merged: AppsScriptFile[] = [
    ...patch.untouched,
    ...patch.files.map<AppsScriptFile>((f) => ({
      name: f.name,
      type: f.type,
      source: f.after,
    })),
  ];
  await updateProjectContent(patch.scriptId, merged);
}
