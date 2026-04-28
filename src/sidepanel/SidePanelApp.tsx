import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APP_NAME,
  APP_TAGLINE,
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  ProviderId,
} from '@/shared/constants';
import { getActiveScriptId, UNKNOWN_SCRIPT_ID } from '@/shared/scriptId';
import { hasApiKey, getSettings } from '@/shared/storage';
import { listConversationsForScript, saveConversation, deleteConversation } from '@/shared/db';
import { generateId } from '@/shared/id';
import type { Conversation, Settings } from '@/shared/types';
import { DEFAULT_SYSTEM_PROMPT } from '@/shared/types';
import { useChatSession } from './useChatSession';
import { usePlannerSession } from './usePlannerSession';
import { Composer } from './components/Composer';
import { MessageList } from './components/MessageList';
import { Header } from './components/Header';
import { ConversationsDrawer } from './components/ConversationsDrawer';
import { ReviewPanel } from './components/ReviewPanel';
import { PlannerPanel } from './components/PlannerPanel';
import { DeployPanel } from './components/DeployPanel';
import type { ExtractedFile } from '@/shared/codeBlocks';
import type { Template } from '@/shared/templates';

export function SidePanelApp() {
  const [scriptId, setScriptId] = useState<string>(UNKNOWN_SCRIPT_ID);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [providerHasKey, setProviderHasKey] = useState<boolean>(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reviewing, setReviewing] = useState<{ files: ExtractedFile[]; messageId: string } | null>(
    null,
  );
  const [composerSeed, setComposerSeed] = useState<{ value: string; nonce: number } | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);

  const refreshSettings = useCallback(async () => {
    const next = await getSettings();
    setSettings(next);
    setProviderHasKey(await hasApiKey(next.defaultProvider));
  }, []);

  const refreshConversations = useCallback(async (sid: string) => {
    const list = await listConversationsForScript(sid);
    setConversations(list);
    return list;
  }, []);

  // Bootstrap: detect scriptId, load settings, load (or create) a conversation.
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const sid = await getActiveScriptId();
      if (!mounted) return;
      setScriptId(sid);
      const next = await getSettings();
      if (!mounted) return;
      setSettings(next);
      setProviderHasKey(await hasApiKey(next.defaultProvider));
      const list = await listConversationsForScript(sid);
      if (!mounted) return;
      setConversations(list);
      if (list.length) {
        setActiveConv(list[0]);
      } else {
        const c: Conversation = {
          id: generateId('conv'),
          scriptId: sid,
          title: 'New chat',
          providerId: next.defaultProvider,
          model: next.defaultModel || DEFAULT_MODELS[next.defaultProvider][0],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await saveConversation(c);
        setConversations([c]);
        setActiveConv(c);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Listen to chrome.tabs URL changes so the script id auto-refreshes.
  useEffect(() => {
    const onActivated = () => {
      void getActiveScriptId().then((sid) => {
        setScriptId(sid);
        void refreshConversations(sid).then((list) => {
          if (list.length) setActiveConv(list[0]);
          else setActiveConv(null);
        });
      });
    };
    chrome.tabs?.onActivated.addListener(onActivated);
    chrome.tabs?.onUpdated.addListener(onActivated);
    return () => {
      chrome.tabs?.onActivated.removeListener(onActivated);
      chrome.tabs?.onUpdated.removeListener(onActivated);
    };
  }, [refreshConversations]);

  // Listen for storage changes so the side panel reflects settings updates from the options page.
  useEffect(() => {
    const onStorage = () => void refreshSettings();
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, [refreshSettings]);

  const session = useChatSession({
    conversation: activeConv,
    systemPrompt: settings?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    onConversationSaved: (c) => {
      setConversations((prev) => {
        const without = prev.filter((p) => p.id !== c.id);
        return [c, ...without];
      });
    },
  });

  // Phase 4: Planner session
  const planner = usePlannerSession({
    scriptId,
    providerId: activeConv?.providerId ?? DEFAULT_PROVIDER,
    model: activeConv?.model ?? DEFAULT_MODELS[DEFAULT_PROVIDER][0],
    systemPrompt: settings?.systemPrompt,
    messages: session.messages,
  });

  const newChat = useCallback(async () => {
    if (!settings) return;
    const c: Conversation = {
      id: generateId('conv'),
      scriptId,
      title: 'New chat',
      providerId: settings.defaultProvider,
      model: settings.defaultModel || DEFAULT_MODELS[settings.defaultProvider][0],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveConversation(c);
    setConversations((prev) => [c, ...prev]);
    setActiveConv(c);
    setDrawerOpen(false);
  }, [scriptId, settings]);

  const switchConversation = useCallback(async (c: Conversation) => {
    setActiveConv(c);
    setDrawerOpen(false);
  }, []);

  const removeConversation = useCallback(
    async (c: Conversation) => {
      await deleteConversation(c.id);
      const list = await refreshConversations(scriptId);
      if (activeConv?.id === c.id) setActiveConv(list[0] ?? null);
    },
    [refreshConversations, scriptId, activeConv?.id],
  );

  const setModel = useCallback(
    async (model: string) => {
      if (!activeConv) return;
      const next = { ...activeConv, model, updatedAt: Date.now() };
      await saveConversation(next);
      setActiveConv(next);
      setConversations((prev) => prev.map((c) => (c.id === next.id ? next : c)));
    },
    [activeConv],
  );

  const setProvider = useCallback(
    async (providerId: ProviderId) => {
      if (!activeConv) return;
      const fallbackModel = DEFAULT_MODELS[providerId][0];
      const next = {
        ...activeConv,
        providerId,
        model: fallbackModel,
        updatedAt: Date.now(),
      };
      await saveConversation(next);
      setActiveConv(next);
      setProviderHasKey(await hasApiKey(providerId));
    },
    [activeConv],
  );

  const openOptions = useCallback(() => {
    chrome.runtime.openOptionsPage?.();
  }, []);

  const handleStartPlan = useCallback(
    (goal: string) => {
      planner.startPlan(goal);
      setPlannerOpen(true);
    },
    [planner],
  );

  const composerDisabled = useMemo(
    () => !activeConv || !providerHasKey || session.pending || planner.status === 'running',
    [activeConv, providerHasKey, session.pending, planner.status],
  );

  return (
    <div className="flex h-full flex-col bg-white">
      <Header
        appName={APP_NAME}
        tagline={APP_TAGLINE}
        scriptId={scriptId}
        onNewChat={newChat}
        onOpenOptions={openOptions}
        onToggleDrawer={() => setDrawerOpen((o) => !o)}
        onDeploy={() => setDeployOpen(true)}
      />

      {drawerOpen ? (
        <ConversationsDrawer
          conversations={conversations}
          activeId={activeConv?.id ?? null}
          onSwitch={switchConversation}
          onDelete={removeConversation}
          onClose={() => setDrawerOpen(false)}
        />
      ) : null}

      <main className="flex flex-1 flex-col overflow-hidden">
        {!providerHasKey ? (
          <div className="m-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            No API key configured for{' '}
            <span className="font-semibold">{activeConv?.providerId ?? DEFAULT_PROVIDER}</span>.{' '}
            <button onClick={openOptions} className="underline hover:text-amber-900">
              Open settings to add one
            </button>
            .
          </div>
        ) : null}

        <MessageList
          messages={session.messages}
          streamingId={session.streamingId}
          onReview={(files, messageId) => setReviewing({ files, messageId })}
          onUseTemplate={(t: Template) => {
            setComposerSeed({ value: t.prompt, nonce: Date.now() });
            if (t.bootstrap?.length) {
              setReviewing({ files: t.bootstrap, messageId: `template:${t.id}` });
            }
          }}
        />

        {session.error ? (
          <div className="mx-3 mb-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">
            {session.error}
          </div>
        ) : null}

        <Composer
          providerId={activeConv?.providerId ?? DEFAULT_PROVIDER}
          model={activeConv?.model ?? DEFAULT_MODELS[DEFAULT_PROVIDER][0]}
          onModelChange={setModel}
          onProviderChange={setProvider}
          onSend={session.sendUserMessage}
          onCancel={session.cancel}
          onStartPlan={handleStartPlan}
          pending={session.pending}
          disabled={composerDisabled}
          providerKeyMissing={!providerHasKey}
          seedText={composerSeed}
          plannerRunning={planner.status === 'running'}
          onCancelPlan={planner.cancel}
        />
      </main>

      {reviewing ? (
        <ReviewPanel
          scriptId={scriptId}
          files={reviewing.files}
          onClose={() => setReviewing(null)}
        />
      ) : null}

      {plannerOpen ? (
        <PlannerPanel
          status={planner.status}
          steps={planner.steps}
          progressText={planner.progressText}
          error={planner.error}
          summary={planner.summary}
          onCancel={planner.cancel}
          onReset={() => {
            planner.reset();
            setPlannerOpen(false);
          }}
          onClose={() => setPlannerOpen(false)}
        />
      ) : null}

      {deployOpen ? <DeployPanel scriptId={scriptId} onClose={() => setDeployOpen(false)} /> : null}
    </div>
  );
}
