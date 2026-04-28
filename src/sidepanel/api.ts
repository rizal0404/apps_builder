/**
 * Promisified `chrome.runtime.sendMessage` calls used by the side panel for
 * Apps Script REST operations brokered through the background service worker.
 */

import { MsgType } from '@/shared/constants';
import type { ExtractedFile } from '@/shared/codeBlocks';
import type { ProjectContent } from '@/shared/appsScriptApi';
import type { ProjectPatch } from '@/shared/patch';

interface OkResp<T> {
  ok: true;
  [key: string]: unknown;
  // We pull the payload field out via the helper below.
  __payload?: T;
}

type ErrResp = { ok: false; error: string; code?: string };

type Resp<T> = OkResp<T> | ErrResp;

function send<T>(message: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (resp: Resp<T>) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message ?? 'runtime error'));
        return;
      }
      if (!resp || typeof resp !== 'object') {
        reject(new Error('No response from background worker'));
        return;
      }
      if (!resp.ok) {
        const err = new Error(resp.error) as Error & { code?: string };
        err.code = resp.code;
        reject(err);
        return;
      }
      resolve(resp as unknown as T);
    });
  });
}

export async function buildPatchViaBackground(
  scriptId: string,
  files: ExtractedFile[],
): Promise<ProjectPatch> {
  const resp = await send<{ patch: ProjectPatch }>({
    type: MsgType.BUILD_PATCH,
    scriptId,
    files,
  });
  return resp.patch;
}

export async function applyPatchViaBackground(patch: ProjectPatch): Promise<void> {
  await send<{ ok: true }>({ type: MsgType.APPLY_PATCH, patch });
}

export async function getProjectContentViaBackground(scriptId: string): Promise<ProjectContent> {
  const resp = await send<{ content: ProjectContent }>({
    type: MsgType.GET_PROJECT_CONTENT,
    scriptId,
  });
  return resp.content;
}

export async function enhancePromptViaBackground(
  providerId: string,
  model: string,
  text: string,
  frontendStack?: string,
  designSkill?: string,
): Promise<string> {
  const resp = await send<{ text: string }>({
    type: MsgType.ENHANCE_PROMPT,
    providerId,
    model,
    text,
    frontendStack,
    designSkill,
  });
  return resp.text;
}

// ── Phase 4: Version / Deploy / Run helpers ─────────────────────────────────────

export async function createVersionViaBackground(
  scriptId: string,
  description: string,
): Promise<import('@/shared/appsScriptApi').ScriptVersion> {
  const resp = await send<{ version: import('@/shared/appsScriptApi').ScriptVersion }>({
    type: MsgType.CREATE_VERSION,
    scriptId,
    description,
  });
  return resp.version;
}

export async function createDeploymentViaBackground(
  scriptId: string,
  versionNumber: number,
  description: string,
): Promise<import('@/shared/appsScriptApi').Deployment> {
  const resp = await send<{ deployment: import('@/shared/appsScriptApi').Deployment }>({
    type: MsgType.CREATE_DEPLOYMENT,
    scriptId,
    versionNumber,
    description,
  });
  return resp.deployment;
}

export async function runFunctionViaBackground(
  scriptId: string,
  functionName: string,
  parameters?: unknown[],
): Promise<import('@/shared/appsScriptApi').RunResult> {
  const resp = await send<{ result: import('@/shared/appsScriptApi').RunResult }>({
    type: MsgType.RUN_FUNCTION,
    scriptId,
    functionName,
    parameters,
  });
  return resp.result;
}

