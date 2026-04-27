import { ProviderId } from '@/shared/constants';
import { openRouterProvider } from './openrouter';
import { geminiProvider } from './gemini';
import type { IProvider } from './types';

const REGISTRY: Partial<Record<ProviderId, IProvider>> = {
  [ProviderId.OPENROUTER]: openRouterProvider,
  [ProviderId.GEMINI]: geminiProvider,
};

export function getProvider(id: ProviderId): IProvider {
  const p = REGISTRY[id];
  if (!p) {
    throw new Error(`Provider "${id}" is not registered yet (planned for a later phase).`);
  }
  return p;
}
